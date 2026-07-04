"""
RYSAO Studio — moteur audio (DSP) côté serveur.

Tout est en numpy/scipy, sans dépendance à ffmpeg :
  - décodage via soundfile (libsndfile : WAV / FLAC / OGG / MP3)
  - analyse de tempo (BPM) et estimation de tonalité
  - vrai time-stretch (vocodeur de phase) : change le tempo SANS toucher
    à la hauteur — ce que le navigateur ne peut pas faire
  - pitch-shift indépendant (semitons)
  - rendu de remix : découpe rythmique, ré-arrangement, beatmatch avec
    conservation de la hauteur, reverb, delay, filtre, stutter, reverse
  - export WAV
"""
from __future__ import annotations
import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100  # fréquence d'échantillonnage de travail


# ------------------------------------------------------------------ I/O
def load_audio(path: str, target_sr: int = SR) -> np.ndarray:
    """Retourne un tableau stéréo float32 de forme (n, 2), rééchantillonné."""
    x, sr = sf.read(path, always_2d=True, dtype="float32")
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    elif x.shape[1] > 2:
        x = x[:, :2]
    if sr != target_sr:
        x = np.stack([_resample_linear(x[:, c], int(round(x.shape[0] * target_sr / sr)))
                      for c in range(x.shape[1])], axis=1)
    return np.ascontiguousarray(x, dtype=np.float32)


def write_wav(path: str, x: np.ndarray, sr: int = SR) -> None:
    x = np.clip(x, -1.0, 1.0)
    sf.write(path, x, sr, subtype="PCM_16")


# formats d'export disponibles selon la libsndfile installée
_WRITE_FORMATS = {k for k in ("WAV", "FLAC", "OGG", "MP3") if k in sf.available_formats()}


def can_encode(fmt: str) -> bool:
    return fmt.upper() in _WRITE_FORMATS


def encode_file(dest: str, x: np.ndarray, sr: int, fmt: str) -> None:
    """Écrit x dans dest au format demandé (WAV/MP3/OGG/FLAC)."""
    fmt = fmt.upper()
    x = np.clip(x, -1.0, 1.0)
    if fmt == "WAV":
        sf.write(dest, x, sr, subtype="PCM_16")
    else:
        sf.write(dest, x, sr, format=fmt)


# --------------------------------------------------------------- helpers
def _resample_linear(x: np.ndarray, new_len: int) -> np.ndarray:
    if new_len <= 0:
        return np.zeros(0, dtype=np.float32)
    if len(x) == new_len:
        return x.astype(np.float32)
    old = np.linspace(0.0, 1.0, num=len(x), endpoint=False)
    new = np.linspace(0.0, 1.0, num=new_len, endpoint=False)
    return np.interp(new, old, x).astype(np.float32)


def _mono(x: np.ndarray) -> np.ndarray:
    return x.mean(axis=1) if x.ndim == 2 else x


# --------------------------------------------------------------- analyse
def estimate_bpm(x: np.ndarray, sr: int = SR) -> float:
    """Tempo par enveloppe d'énergie + autocorrélation (plage 70-180)."""
    y = _mono(x)
    win = int(sr * 0.02)
    if win < 1 or len(y) < win * 4:
        return 120.0
    n = len(y) // win
    frames = y[: n * win].reshape(n, win)
    env = np.sqrt((frames ** 2).mean(axis=1))
    onset = np.diff(env)
    onset[onset < 0] = 0.0
    fps = sr / win
    min_lag = int(fps * 60 / 180)
    max_lag = int(fps * 60 / 70)
    best, best_lag = -1.0, min_lag
    for lag in range(min_lag, max_lag + 1):
        if lag >= len(onset):
            break
        s = float(np.dot(onset[:-lag], onset[lag:]))
        if s > best:
            best, best_lag = s, lag
    bpm = 60.0 * fps / max(best_lag, 1)
    while bpm < 70:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return round(bpm, 1)


_KEYS = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"]
# profils de Krumhansl (majeur / mineur)
_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def estimate_key(x: np.ndarray, sr: int = SR) -> str:
    """Estimation simple de tonalité par chromagramme + corrélation de profils."""
    y = _mono(x)
    n_fft = 8192
    if len(y) < n_fft:
        return "—"
    hop = n_fft
    chroma = np.zeros(12)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    freqs[0] = 1e-6
    midi = 69 + 12 * np.log2(freqs / 440.0)
    pc = np.mod(np.round(midi).astype(int), 12)
    for i in range(0, len(y) - n_fft, hop):
        mag = np.abs(np.fft.rfft(y[i:i + n_fft] * np.hanning(n_fft)))
        for p in range(12):
            chroma[p] += mag[pc == p].sum()
    if chroma.sum() == 0:
        return "—"
    chroma /= chroma.sum()
    best_score, best = -1e9, ("Do", "maj")
    for shift in range(12):
        c = np.roll(chroma, -shift)
        for prof, name in ((_MAJ, "maj"), (_MIN, "min")):
            score = float(np.corrcoef(c, prof)[0, 1])
            if score > best_score:
                best_score, best = score, (_KEYS[shift], name)
    return f"{best[0]} {best[1]}"


def analyze(path: str) -> dict:
    x = load_audio(path)
    return {
        "duration": round(len(x) / SR, 2),
        "bpm": estimate_bpm(x),
        "key": estimate_key(x),
        "channels": 2,
        "sampleRate": SR,
    }


# ---------------------------------------------- vocodeur de phase (STFT)
def _stft(x: np.ndarray, n_fft: int, hop: int, win: np.ndarray) -> np.ndarray:
    pad = n_fft // 2
    x = np.pad(x, pad, mode="reflect")
    n = 1 + (len(x) - n_fft) // hop
    out = np.empty((n_fft // 2 + 1, n), dtype=np.complex64)
    for i in range(n):
        out[:, i] = np.fft.rfft(x[i * hop:i * hop + n_fft] * win)
    return out


def _istft(S: np.ndarray, n_fft: int, hop: int, win: np.ndarray) -> np.ndarray:
    n = S.shape[1]
    length = n_fft + hop * (n - 1)
    x = np.zeros(length, dtype=np.float64)
    wsum = np.zeros(length, dtype=np.float64)
    w2 = win ** 2
    for i in range(n):
        frame = np.fft.irfft(S[:, i], n_fft) * win
        x[i * hop:i * hop + n_fft] += frame
        wsum[i * hop:i * hop + n_fft] += w2
    wsum[wsum < 1e-8] = 1e-8
    x /= wsum
    return x[n_fft // 2: len(x) - n_fft // 2].astype(np.float32)


def _phase_vocoder(D: np.ndarray, rate: float, hop: int, n_fft: int) -> np.ndarray:
    """Étire les trames STFT d'un facteur 1/rate (rate>1 => plus court)."""
    n_bins, n_frames = D.shape
    time_steps = np.arange(0, n_frames, rate)
    out = np.zeros((n_bins, len(time_steps)), dtype=np.complex64)
    phi_adv = 2 * np.pi * hop * np.arange(n_bins) / n_fft  # avance de phase attendue
    phase_acc = np.angle(D[:, 0])
    for t, step in enumerate(time_steps):
        i = int(np.floor(step))
        frac = step - i
        if i + 1 < n_frames:
            mag = (1 - frac) * np.abs(D[:, i]) + frac * np.abs(D[:, i + 1])
            dphi = np.angle(D[:, i + 1]) - np.angle(D[:, i]) - phi_adv
        else:
            mag = np.abs(D[:, i])
            dphi = np.zeros(n_bins)
        dphi -= 2 * np.pi * np.round(dphi / (2 * np.pi))
        out[:, t] = mag * np.exp(1j * phase_acc)
        phase_acc = phase_acc + phi_adv + dphi
    return out


def time_stretch(x: np.ndarray, rate: float) -> np.ndarray:
    """Change la durée sans changer la hauteur. rate>1 => plus rapide/court."""
    if abs(rate - 1.0) < 1e-3:
        return x.astype(np.float32)
    n_fft, hop = 2048, 512
    win = np.hanning(n_fft).astype(np.float32)
    if x.ndim == 1:
        D = _stft(x, n_fft, hop, win)
        return _istft(_phase_vocoder(D, rate, hop, n_fft), n_fft, hop, win)
    return np.stack([time_stretch(x[:, c], rate) for c in range(x.shape[1])], axis=1)


def pitch_shift(x: np.ndarray, semitones: float) -> np.ndarray:
    """Décale la hauteur sans changer la durée."""
    if abs(semitones) < 1e-3:
        return x.astype(np.float32)
    rate = 2.0 ** (-semitones / 12.0)          # stretch (garde la hauteur)
    stretched = time_stretch(x, rate)          # plus long si semitones>0
    if x.ndim == 1:
        return _resample_linear(stretched, len(x))
    return np.stack([_resample_linear(stretched[:, c], x.shape[0])
                     for c in range(x.shape[1])], axis=1)


# --------------------------------------------------------------- effets
def _reverb_ir(seconds: float = 2.0, decay: float = 2.5) -> np.ndarray:
    n = int(SR * seconds)
    t = np.arange(n)
    env = (1 - t / n) ** decay
    ir = np.random.RandomState(7).randn(n, 2) * env[:, None]
    ir /= np.abs(ir).max() + 1e-9
    return ir.astype(np.float32)


def apply_reverb(x: np.ndarray, amount: float) -> np.ndarray:
    if amount <= 0:
        return x
    ir = _reverb_ir()
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    wet /= np.abs(wet).max() + 1e-9
    return (1 - amount * 0.6) * x + amount * 0.6 * wet


def apply_delay(x: np.ndarray, amount: float, bpm: float) -> np.ndarray:
    if amount <= 0:
        return x
    d = max(1, int(SR * (60 / bpm) * 0.75))    # croche pointée
    fb = min(0.6, amount * 0.7)
    echo = np.zeros_like(x)
    cur = x * amount
    for _ in range(5):                          # 5 répétitions décroissantes
        shifted = np.zeros_like(cur)
        shifted[d:] = cur[:-d]
        echo += shifted
        cur = shifted * fb
    return x + echo


def _biquad_sos(kind: str, f0: float, gain_db: float, Q: float = 1.0):
    """Coefficients biquad RBJ (cookbook) -> sos, pour shelf/peaking."""
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * Q)
    if kind == "peaking":
        b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A
        a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A
    elif kind == "lowshelf":
        s = 2 * np.sqrt(A) * alpha
        b0 = A * ((A + 1) - (A - 1) * cw + s)
        b1 = 2 * A * ((A - 1) - (A + 1) * cw)
        b2 = A * ((A + 1) - (A - 1) * cw - s)
        a0 = (A + 1) + (A - 1) * cw + s
        a1 = -2 * ((A - 1) + (A + 1) * cw)
        a2 = (A + 1) + (A - 1) * cw - s
    else:  # highshelf
        s = 2 * np.sqrt(A) * alpha
        b0 = A * ((A + 1) + (A - 1) * cw + s)
        b1 = -2 * A * ((A - 1) + (A + 1) * cw)
        b2 = A * ((A + 1) + (A - 1) * cw - s)
        a0 = (A + 1) - (A - 1) * cw + s
        a1 = 2 * ((A - 1) - (A + 1) * cw)
        a2 = (A + 1) - (A - 1) * cw - s
    return np.array([[b0/a0, b1/a0, b2/a0, 1.0, a1/a0, a2/a0]])


def apply_eq(x: np.ndarray, eq: dict) -> np.ndarray:
    """Égaliseur 3 bandes : graves (shelf 200Hz), médiums (peak 1kHz), aigus (shelf 4kHz)."""
    if not eq:
        return x
    low, mid, high = float(eq.get("low", 0)), float(eq.get("mid", 0)), float(eq.get("high", 0))
    if low == 0 and mid == 0 and high == 0:
        return x
    out = x
    if low:  out = sosfilt(_biquad_sos("lowshelf", 200, low), out, axis=0)
    if mid:  out = sosfilt(_biquad_sos("peaking", 1000, mid, 1.0), out, axis=0)
    if high: out = sosfilt(_biquad_sos("highshelf", 4000, high), out, axis=0)
    return out.astype(np.float32)


def apply_filter(x: np.ndarray, mode: str) -> np.ndarray:
    if mode == "none" or not mode:
        return x
    n = len(x)
    if mode == "lowpass":
        sos = butter(4, 1500 / (SR / 2), btype="low", output="sos")
        return sosfilt(sos, x, axis=0).astype(np.float32)
    if mode == "highpass":
        sos = butter(4, 600 / (SR / 2), btype="high", output="sos")
        return sosfilt(sos, x, axis=0).astype(np.float32)
    # balayages : automation par blocs
    out = np.zeros_like(x)
    blocks = 64
    step = max(1, n // blocks)
    for b in range(0, n, step):
        frac = b / max(1, n)
        if mode == "sweepup":
            fc = 300 * (16000 / 300) ** frac
        elif mode == "sweepdown":
            fc = 16000 * (400 / 16000) ** frac
        else:
            fc = 8000
        fc = min(max(fc, 60), SR / 2 - 100)
        sos = butter(2, fc / (SR / 2), btype="low", output="sos")
        seg = x[b:b + step]
        out[b:b + step] = sosfilt(sos, seg, axis=0)
    return out.astype(np.float32)


# --------------------------------------------------------------- remix
def _rng(seed: int):
    return np.random.RandomState(seed & 0x7FFFFFFF)


def render_remix(layers: list[dict], recipe: dict) -> np.ndarray:
    """
    layers : [{ 'samples': (n,2), 'bpm': float, 'gain': float,
                'role': str }]
    recipe : { bpm, dur, beats_per_cell, shuffle, reverb, delay, stutter,
               reverse, filter, keep_pitch, speed, seed }
    """
    bpm = float(recipe["bpm"])
    dur = float(recipe["dur"])
    bpc = int(recipe.get("beats_per_cell", 1))
    keep_pitch = bool(recipe.get("keep_pitch", True))
    speed = float(recipe.get("speed", 1.0))
    seed = int(recipe.get("seed", 12345))

    cell = (60.0 / bpm) * bpc
    n_cells = max(1, int(np.ceil(dur / cell)))
    out_len = int(dur * SR)
    mix = np.zeros((out_len, 2), dtype=np.float32)
    cell_s = int(cell * SR)

    for li, layer in enumerate(layers):
        src = layer["samples"]
        src_bpm = float(layer.get("bpm") or bpm)
        gain = float(layer.get("gain", 1.0))
        rng = _rng(seed + li * 101)

        # beatmatch : amener src_bpm -> bpm * speed
        target = bpm * speed
        if keep_pitch:
            rate = target / src_bpm            # stretch (garde la hauteur)
            work = time_stretch(src, rate) if abs(rate - 1) > 1e-3 else src
            play_speed = 1.0
        else:
            work = src                          # on jouera plus vite (change hauteur)
            play_speed = target / src_bpm

        # grille source alignée sur le tempo cible
        src_cell = int(cell_s * play_speed)
        src_cells = max(1, work.shape[0] // max(1, src_cell))

        arrangement = [i % src_cells for i in range(n_cells)]
        shuffle = float(recipe.get("shuffle", 0.0))
        for i in range(n_cells):
            if rng.random_sample() < shuffle:
                j = rng.randint(n_cells)
                arrangement[i], arrangement[j] = arrangement[j], arrangement[i]

        layer_buf = np.zeros((out_len, 2), dtype=np.float32)
        for i in range(n_cells):
            start = i * cell_s
            if start >= out_len:
                break
            reverse = rng.random_sample() < float(recipe.get("reverse", 0.0))
            idx = arrangement[i]
            src_off = idx * src_cell
            seg = work[src_off:src_off + src_cell]
            if seg.shape[0] < 4:
                continue
            if play_speed != 1.0:
                seg = np.stack([_resample_linear(seg[:, c], cell_s) for c in range(2)], axis=1)
            elif seg.shape[0] != cell_s:
                seg = seg[:cell_s]
            if reverse:
                seg = seg[::-1]

            # stutter : re-déclenche des sous-tranches
            stutter = rng.random_sample() < float(recipe.get("stutter", 0.0))
            if stutter:
                reps = int(rng.choice([2, 3, 4]))
                sub = cell_s // reps
                base = seg[:sub].copy()
                seg = np.tile(base, (reps + 1, 1))[:cell_s]

            L = min(cell_s, out_len - start, seg.shape[0])
            seg = seg[:L].copy()
            # enveloppe anti-clic
            f = min(64, L // 4)
            if f > 0:
                ramp = np.linspace(0, 1, f)[:, None]
                seg[:f] *= ramp
                seg[-f:] *= ramp[::-1]
            layer_buf[start:start + L] += seg

        layer_buf = apply_eq(layer_buf, layer.get("eq"))
        mix += layer_buf * gain

    # effets globaux
    mix = apply_filter(mix, recipe.get("filter", "none"))
    mix = apply_reverb(mix, float(recipe.get("reverb", 0.0)))
    mix = apply_delay(mix, float(recipe.get("delay", 0.0)), bpm)

    # normalisation douce
    peak = np.abs(mix).max()
    if peak > 1e-6:
        mix = mix / peak * 0.97
    return mix.astype(np.float32)
