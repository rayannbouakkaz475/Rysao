"""
RYSAO Studio — Déchiffreur de mix.

Prend un mix (DJ set, mashup, enchaînement de plusieurs musiques) et retrouve
de quoi il est composé :

  1. Structure (100 % local, numpy) : on calcule, seconde par seconde, une
     empreinte timbrale (bandes de fréquences) et harmonique (chroma), puis on
     cherche les instants où le « contenu » change brusquement → transitions.
  2. Analyse de chaque segment : BPM, tonalité, énergie.
  3. Identification (optionnelle) : des extraits de ~12 s pris à intervalles
     réguliers sont envoyés à Shazam (bibliothèque `shazamio`). Les réponses
     sont votées par segment ; si deux titres différents tombent dans un même
     segment, il est coupé en deux (transition ratée par l'étape 1) ; deux
     segments voisins reconnus comme le même titre sont fusionnés.

Sans `shazamio` (ou sans internet), l'étape 3 est simplement sautée : on
obtient quand même le découpage, les horodatages, BPM et tonalités.
"""
from __future__ import annotations
import io
import os
import shutil
import asyncio
import subprocess
from collections import Counter
from typing import Callable, Optional

import numpy as np
import soundfile as sf

import audio_engine as ae

SR = 11025           # fréquence d'analyse (suffisante pour la structure)
ID_SR = 16000        # fréquence des extraits envoyés à la reconnaissance
SNIPPET = 12.0       # durée d'un extrait de reconnaissance (s)


# ----------------------------------------------------------- disponibilité
def id_available() -> bool:
    try:
        import shazamio  # noqa: F401
        return True
    except Exception:
        return False


# ---------------------------------------------------------------- décodage
def load_mono(path: str, sr: int = SR) -> np.ndarray:
    """Décode en mono float32. ffmpeg (si présent) gère tous les formats
    (M4A/AAC compris) et reste léger en mémoire pour des mix d'une heure."""
    if shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr),
               "-f", "f32le", "-"]
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p.returncode == 0 and p.stdout:
            return np.frombuffer(p.stdout, dtype=np.float32).copy()
    x, file_sr = sf.read(path, always_2d=True, dtype="float32")
    y = x.mean(axis=1)
    if file_sr != sr:
        y = ae._resample_linear(y, int(round(len(y) * sr / file_sr)))
    return y.astype(np.float32)


# ------------------------------------------------------------ empreintes
def _features(y: np.ndarray, sr: int = SR, hop_s: float = 1.0):
    """Une colonne par seconde : 24 bandes log (timbre) + 12 chroma (harmonie).
    Retourne (features normalisées, énergie RMS par trame)."""
    n_fft = 4096
    hop = int(sr * hop_s)
    n = max(1, (len(y) - n_fft) // hop + 1)
    win = np.hanning(n_fft).astype(np.float32)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)

    edges = np.geomspace(40, sr / 2 * 0.95, 25)
    band_idx = np.clip(np.digitize(freqs, edges) - 1, -1, 23)
    valid = (freqs >= 55) & (freqs <= 4000)
    midi = 69 + 12 * np.log2(np.maximum(freqs, 1e-6) / 440.0)
    pc = np.mod(np.round(midi).astype(int), 12)

    bands = np.zeros((n, 24), dtype=np.float32)
    chroma = np.zeros((n, 12), dtype=np.float32)
    rms = np.zeros(n, dtype=np.float32)
    for b0 in range(0, n, 256):                       # par blocs (mémoire)
        idx = np.arange(b0, min(n, b0 + 256))
        frames = np.stack([y[i * hop:i * hop + n_fft] for i in idx])
        if frames.shape[1] < n_fft:
            frames = np.pad(frames, ((0, 0), (0, n_fft - frames.shape[1])))
        rms[idx] = np.sqrt((frames ** 2).mean(axis=1))
        mag = np.abs(np.fft.rfft(frames * win, axis=1)) ** 2
        for b in range(24):
            m = band_idx == b
            if m.any():
                bands[idx, b] = mag[:, m].sum(axis=1)
        for p in range(12):
            m = valid & (pc == p)
            chroma[idx, p] = mag[:, m].sum(axis=1)

    bands = np.log1p(bands / (bands.mean() + 1e-9))
    bands -= bands.mean(axis=1, keepdims=True)        # forme spectrale, pas volume
    chroma /= chroma.sum(axis=1, keepdims=True) + 1e-9

    def z(a):
        return (a - a.mean(axis=0)) / (a.std(axis=0) + 1e-6)

    feats = np.hstack([z(bands), 1.2 * z(chroma)])
    return feats.astype(np.float32), rms


def _smooth(v: np.ndarray, k: int) -> np.ndarray:
    if k <= 1 or len(v) < k:
        return v
    w = np.hanning(k + 2)[1:-1]
    return np.convolve(v, w / w.sum(), mode="same")


def novelty_curve(feats: np.ndarray, half: int = 16) -> np.ndarray:
    """Distance entre le contenu des `half` secondes avant et après chaque
    instant. Pic = changement de morceau probable."""
    n = len(feats)
    nov = np.zeros(n, dtype=np.float32)
    if n < 2 * half + 2:
        return nov
    c = np.vstack([np.zeros((1, feats.shape[1]), np.float32), np.cumsum(feats, axis=0)])
    for t in range(half, n - half):
        a = (c[t] - c[t - half]) / half
        b = (c[t + half] - c[t]) / half
        na, nb = np.linalg.norm(a), np.linalg.norm(b)
        nov[t] = np.linalg.norm(a - b) / (np.sqrt(na * nb) + np.linalg.norm(a - b) + 1e-6)
    return _smooth(nov, 5)


def pick_boundaries(nov: np.ndarray, min_len: int, sensitivity: float = 0.5) -> list[int]:
    """Pics de nouveauté espacés d'au moins `min_len` secondes.
    sensitivity ∈ [0,1] : plus haut = plus de transitions détectées."""
    n = len(nov)
    if n == 0 or nov.max() <= 0:
        return []
    thr = np.median(nov) + (1.6 - 1.4 * sensitivity) * nov.std()
    cand = [t for t in range(1, n - 1)
            if nov[t] >= nov[t - 1] and nov[t] >= nov[t + 1] and nov[t] > thr]
    cand.sort(key=lambda t: -nov[t])
    chosen: list[int] = []
    for t in cand:
        if t < min_len * 0.5 or t > n - min_len * 0.5:
            continue
        if all(abs(t - u) >= min_len for u in chosen):
            chosen.append(t)
    return sorted(chosen)


# ------------------------------------------------------- analyse segment
def _segment_info(y: np.ndarray, start: float, end: float, sr: int = SR) -> dict:
    a, b = int(start * sr), int(end * sr)
    seg = y[a:b]
    # BPM/tonalité sur le cœur du segment (≤ 60 s) : rapide et évite les fondus
    mid = (a + b) // 2
    half = min(len(seg) // 2, int(30 * sr))
    core = y[mid - half:mid + half]
    rms = float(np.sqrt((seg ** 2).mean())) if len(seg) else 0.0
    return {
        "start": round(start, 1),
        "end": round(end, 1),
        "duration": round(end - start, 1),
        "bpm": ae.estimate_bpm(core, sr) if len(core) > sr * 4 else None,
        "key": ae.estimate_key(core, sr) if len(core) > sr * 4 else "—",
        "energy": round(20 * np.log10(rms + 1e-9), 1),
    }


# ------------------------------------------------------- identification
def _snippet_wav(path: str, t: float) -> bytes:
    """Extrait de SNIPPET secondes à partir de t, en WAV mono 16 kHz."""
    y = None
    if shutil.which("ffmpeg"):
        cmd = ["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-t", f"{SNIPPET:.2f}",
               "-i", path, "-ac", "1", "-ar", str(ID_SR), "-f", "f32le", "-"]
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p.returncode == 0 and p.stdout:
            y = np.frombuffer(p.stdout, dtype=np.float32)
    if y is None:
        info = sf.info(path)
        x, file_sr = sf.read(path, start=int(t * info.samplerate),
                             frames=int(SNIPPET * info.samplerate),
                             always_2d=True, dtype="float32")
        y = ae._resample_linear(x.mean(axis=1), int(len(x) * ID_SR / file_sr))
    buf = io.BytesIO()
    sf.write(buf, np.clip(y, -1, 1), ID_SR, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def _parse_shazam(res: dict) -> Optional[dict]:
    tr = (res or {}).get("track")
    if not tr:
        return None
    images = tr.get("images") or {}
    meta = {}
    for sec in tr.get("sections") or []:
        for m in sec.get("metadata") or []:
            meta[(m.get("title") or "").lower()] = m.get("text")
    return {
        "key": str(tr.get("key") or tr.get("title")),
        "title": tr.get("title") or "?",
        "artist": tr.get("subtitle") or "",
        "cover": images.get("coverart") or "",
        "url": tr.get("url") or "",
        "album": meta.get("album", ""),
        "year": meta.get("released", ""),
    }


Recognizer = Callable[[bytes], "asyncio.Future"]


def default_recognizer():
    from shazamio import Shazam
    sh = Shazam()

    async def rec(wav: bytes) -> Optional[dict]:
        return _parse_shazam(await sh.recognize(wav))
    return rec


async def _identify_probes(path: str, times: list[float], recognizer,
                           progress: Callable[[float, str], None]) -> list[Optional[dict]]:
    out: list[Optional[dict]] = [None] * len(times)
    sem = asyncio.Semaphore(3)
    done = 0

    async def one(i: int, t: float):
        nonlocal done
        async with sem:
            try:
                wav = await asyncio.to_thread(_snippet_wav, path, t)
                out[i] = await recognizer(wav)
            except Exception:
                out[i] = None
            await asyncio.sleep(0.3)                # ménage le service
            done += 1
            progress(done / max(1, len(times)),
                     f"Identification des morceaux… {done}/{len(times)}")

    await asyncio.gather(*(one(i, t) for i, t in enumerate(times)))
    return out


# -------------------------------------------------------------- fusion
def _assign_tracks(segments: list[dict], probes: list[tuple[float, Optional[dict]]],
                   nov: np.ndarray) -> list[dict]:
    """Vote par segment ; coupe un segment contenant 2 titres ; fusionne les
    voisins identiques."""
    tracks = {}
    # 1) découpe les segments qui contiennent clairement deux titres
    split: list[dict] = []
    for s in segments:
        inside = [(t, p) for t, p in probes if s["start"] <= t < s["end"] and p]
        for _, p in inside:
            tracks[p["key"]] = p
        runs: list[list] = []                       # [clé, t_début, t_fin, n]
        for t, p in inside:
            if runs and runs[-1][0] == p["key"]:
                runs[-1][2] = t
                runs[-1][3] += 1
            else:
                runs.append([p["key"], t, t, 1])
        strong = [r for r in runs if r[3] >= 2]
        if len(strong) >= 2:
            cuts = [s["start"]]
            for prev, nxt in zip(strong, strong[1:]):
                lo, hi = int(prev[2] + SNIPPET), int(nxt[1])
                if hi > lo and hi <= len(nov):
                    c = lo + int(np.argmax(nov[lo:hi]))
                else:
                    c = int((prev[2] + SNIPPET + nxt[1]) / 2)
                cuts.append(float(min(max(c, cuts[-1] + 1), s["end"] - 1)))
            cuts.append(s["end"])
            for a, b in zip(cuts, cuts[1:]):
                split.append({**s, "start": a, "end": b})
        else:
            split.append(s)

    # 2) vote
    for s in split:
        votes = Counter(p["key"] for t, p in probes if s["start"] <= t < s["end"] and p)
        n_probes = sum(1 for t, _ in probes if s["start"] <= t < s["end"])
        if votes:
            k, c = votes.most_common(1)[0]
            s["track"] = tracks[k]
            s["confidence"] = round(c / max(1, n_probes), 2)
            s["matches"] = c
        else:
            s["track"] = None
            s["confidence"] = 0.0
            s["matches"] = 0

    # 3) fusionne les voisins reconnus comme le même titre
    merged: list[dict] = []
    for s in split:
        if merged and s["track"] and merged[-1]["track"] \
                and merged[-1]["track"]["key"] == s["track"]["key"]:
            m = merged[-1]
            m["end"] = s["end"]
            m["matches"] += s["matches"]
            m["confidence"] = max(m["confidence"], s["confidence"])
        else:
            merged.append(dict(s))
    return merged


# ----------------------------------------------------------- principal
def decode_mix(path: str, *, identify: bool = True, min_len: float = 45.0,
               sensitivity: float = 0.5, step: float = 20.0,
               progress: Optional[Callable[[float, str], None]] = None,
               recognizer=None) -> dict:
    """Analyse complète d'un mix. Retourne {duration, segments, curve, …}."""
    prog = progress or (lambda f, m: None)

    prog(0.02, "Décodage du mix…")
    y = load_mono(path)
    duration = len(y) / SR
    if duration < 5:
        raise ValueError("Fichier trop court pour être un mix.")

    prog(0.10, "Empreinte sonore seconde par seconde…")
    feats, rms = _features(y)
    half = int(np.clip(min_len / 3, 8, 30))
    nov = novelty_curve(feats, half=half)

    prog(0.25, "Recherche des transitions…")
    bounds = pick_boundaries(nov, int(min_len), sensitivity)
    edges = [0.0] + [float(b) for b in bounds] + [duration]

    segments = []
    for i, (a, b) in enumerate(zip(edges, edges[1:])):
        segments.append({"start": a, "end": b})
        prog(0.25 + 0.15 * (i + 1) / (len(edges) - 1), "Analyse BPM et tonalité…")

    id_status = "off"
    if identify:
        rec = recognizer
        if rec is None and id_available():
            try:
                rec = default_recognizer()
            except Exception:
                rec = None
        if rec is None:
            id_status = "unavailable"
        else:
            t_max = max(0.0, duration - SNIPPET)
            times = list(np.arange(min(5.0, t_max), t_max + 1e-6, max(step, 6.0)))
            # garantit au moins 2 sondes par segment, même court
            for s in segments:
                d = s["end"] - s["start"]
                for f in (0.3, 0.65):
                    t = s["start"] + f * d - SNIPPET / 2
                    if 0 <= t <= t_max and all(abs(t - u) > SNIPPET * 0.6 for u in times):
                        times.append(t)
            times = sorted(float(t) for t in times)
            prog(0.40, "Identification des morceaux…")
            results = asyncio.run(_identify_probes(
                path, times, rec, lambda f, m: prog(0.40 + 0.55 * f, m)))
            # l'instant représentatif d'une sonde = son milieu
            probes = [(t + SNIPPET / 2, r) for t, r in zip(times, results)]
            segments = _assign_tracks(segments, probes, nov)
            n_ok = sum(1 for r in results if r)
            id_status = "ok" if n_ok else "no_match"

    out_segments = []
    for s in segments:
        info = _segment_info(y, s["start"], s["end"])
        for k in ("track", "confidence", "matches"):
            if k in s:
                info[k] = s[k]
        out_segments.append(info)

    # courbes compactes pour l'affichage (≈ 600 points)
    k = max(1, len(rms) // 600)
    curve_e = rms[: len(rms) // k * k].reshape(-1, k).mean(axis=1)
    curve_n = nov[: len(nov) // k * k].reshape(-1, k).max(axis=1)
    prog(1.0, "Terminé")
    return {
        "duration": round(duration, 1),
        "segments": out_segments,
        "identification": id_status,
        "curve": {
            "step": k,
            "energy": np.round(curve_e / (curve_e.max() + 1e-9), 3).tolist(),
            "novelty": np.round(curve_n / (curve_n.max() + 1e-9), 3).tolist(),
        },
    }
