"""
RYSAO Studio — génération de musique.

Deux moteurs :

1. GÉNÉRATIF ALGORITHMIQUE (par défaut, sans dépendance lourde) :
   compose une vraie pièce nouvelle — gamme + progression d'accords,
   basse, nappes, mélodie et batterie — synthétisée en numpy, puis mixée
   avec les effets de audio_engine (reverb / delay / filtre). Fonctionne
   partout, sans GPU.

2. NEURONAL TEXTE -> MUSIQUE (optionnel) : MusicGen (audiocraft) si installé.
   `pip install audiocraft` — gros modèle, GPU conseillé.
"""
from __future__ import annotations
import numpy as np
import audio_engine as ae

SR = ae.SR

# --------------------------------------------------------------- musique
_SCALES = {
    "min":      [0, 2, 3, 5, 7, 8, 10],   # mineur naturel
    "maj":      [0, 2, 4, 5, 7, 9, 11],   # majeur
    "dorien":   [0, 2, 3, 5, 7, 9, 10],
    "penta":    [0, 3, 5, 7, 10],         # pentatonique mineure
}

# ambiances -> (gamme, progressions en degrés, bpm conseillé, réglages)
_MOODS = {
    "lofi":    dict(scale="min",   bpm=78,  progs=[[0,5,3,4],[0,3,4,4]],
                    swing=0.14, drums="soft", reverb=0.28, delay=0.18, lead=0.5),
    "cinematique": dict(scale="min", bpm=90, progs=[[0,5,6,4],[0,3,5,4]],
                    swing=0.0, drums="none", reverb=0.5, delay=0.2, lead=0.7),
    "house":   dict(scale="min",   bpm=124, progs=[[0,0,5,3],[0,4,5,3]],
                    swing=0.0, drums="four", reverb=0.18, delay=0.16, lead=0.4),
    "trap":    dict(scale="penta", bpm=140, progs=[[0,0,3,5],[0,5,3,3]],
                    swing=0.06, drums="trap", reverb=0.22, delay=0.14, lead=0.5),
    "ambient": dict(scale="dorien", bpm=70, progs=[[0,4,5,3]],
                    swing=0.0, drums="none", reverb=0.6, delay=0.3, lead=0.3),
}

_KEY_MIDI = {"Do":60,"Do#":61,"Ré":62,"Ré#":63,"Mi":64,"Fa":65,"Fa#":66,
             "Sol":67,"Sol#":68,"La":69,"La#":70,"Si":71,
             # alias sans accents
             "C":60,"D":62,"E":64,"F":65,"G":67,"A":69,"B":71}


def _midi_hz(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def _adsr(n: int, a=0.01, d=0.1, s=0.7, r=0.2) -> np.ndarray:
    env = np.zeros(n)
    ai, di, ri = int(a*SR), int(d*SR), int(r*SR)
    ai = min(ai, n); di = min(di, max(0, n-ai))
    si = max(0, n - ai - di - ri)
    idx = 0
    if ai: env[:ai] = np.linspace(0, 1, ai); idx = ai
    if di: env[idx:idx+di] = np.linspace(1, s, di); idx += di
    if si: env[idx:idx+si] = s; idx += si
    if ri and idx < n: env[idx:idx+ri] = np.linspace(env[idx-1] if idx else s, 0, min(ri, n-idx))
    return env


def _osc(freq: float, n: int, kind="saw", detune=0.0) -> np.ndarray:
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    ph = 2 * np.pi * f * t
    if kind == "sine":
        return np.sin(ph)
    if kind == "square":
        return np.sign(np.sin(ph))
    if kind == "tri":
        return 2/np.pi*np.arcsin(np.sin(ph))
    # saw
    return 2*(t*f - np.floor(0.5 + t*f))


def _note(freq, dur, kind="saw", detune=0.008, adsr=(0.01,0.08,0.7,0.15), gain=1.0):
    n = max(1, int(dur*SR))
    sig = 0.5*_osc(freq, n, kind, +detune) + 0.5*_osc(freq, n, kind, -detune)
    return (sig * _adsr(n, *adsr) * gain).astype(np.float32)


# --------------------------------------------------------------- batterie
def _kick(dur=0.3):
    n = int(dur*SR); t = np.arange(n)/SR
    f = 120*np.exp(-t*30) + 45
    sig = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t*8)
    return (sig*0.9).astype(np.float32)


def _snare(dur=0.2, rng=None):
    rng = rng or np.random
    n = int(dur*SR); t = np.arange(n)/SR
    noise = rng.randn(n)*np.exp(-t*22)
    tone = np.sin(2*np.pi*180*t)*np.exp(-t*18)*0.4
    return ((noise*0.7+tone)*0.7).astype(np.float32)


def _hat(dur=0.05, rng=None):
    rng = rng or np.random
    n = int(dur*SR); t = np.arange(n)/SR
    return (rng.randn(n)*np.exp(-t*90)*0.4).astype(np.float32)


def _place(track, sig, at):
    i = int(at*SR)
    j = min(len(track), i+len(sig))
    if i < len(track):
        track[i:j] += sig[:j-i]


def _drum_track(pattern, bars, beat, total_n, rng):
    L = np.zeros(total_n, dtype=np.float32)
    R = np.zeros(total_n, dtype=np.float32)
    step = beat/2  # croches
    for bar in range(bars):
        base = bar*4*beat
        for b in range(4):
            tb = base + b*beat
            if pattern in ("four",):
                _place(L, _kick(), tb); _place(R, _kick(), tb)
            if pattern in ("soft","trap"):
                if b in (0,2): _place(L,_kick(),tb); _place(R,_kick(),tb)
            if pattern != "none" and b in (1,3):
                s=_snare(rng=rng); _place(L,s,tb); _place(R,s,tb)
            # charleys
            if pattern in ("soft","four","trap"):
                for k in range(2):
                    th=tb+k*step
                    h=_hat(rng=rng)
                    _place(L,h*0.8,th); _place(R,h,th)
            if pattern=="trap" and rng.random_sample()<0.35:
                for k in range(4):
                    h=_hat(dur=0.03,rng=rng)*0.5
                    _place(L,h,tb+k*beat/4)
    return np.stack([L,R],axis=1)


# --------------------------------------------------------------- compose
def generate(params: dict) -> np.ndarray:
    mood = params.get("mood","lofi")
    cfg = dict(_MOODS.get(mood, _MOODS["lofi"]))
    bpm = float(params.get("bpm") or cfg["bpm"])
    dur = float(params.get("duration", 30))
    seed = int(params.get("seed", 7))
    intensity = float(params.get("intensity", 0.5))
    key_name = params.get("key","La")
    scale_name = params.get("scale") or cfg["scale"]

    rng = np.random.RandomState(seed & 0x7FFFFFFF)
    root = _KEY_MIDI.get(key_name, 69) - 12   # une octave plus bas
    scale = _SCALES.get(scale_name, _SCALES["min"])

    beat = 60.0/bpm
    bar = 4*beat
    total_bars = max(1, int(np.ceil(dur/bar)))
    total_n = int(total_bars*bar*SR)+SR//2

    prog = cfg["progs"][rng.randint(len(cfg["progs"]))]

    def scale_note(degree, octave=0):
        octs, idx = divmod(degree, len(scale))
        return root + scale[idx] + 12*(octs+octave)

    pads = np.zeros((total_n,2),dtype=np.float32)
    bass = np.zeros((total_n,2),dtype=np.float32)
    lead = np.zeros((total_n,2),dtype=np.float32)

    for bar_i in range(total_bars):
        deg = prog[bar_i % len(prog)]
        chord_deg = [deg, deg+2, deg+4]           # triade
        t0 = bar_i*bar
        # NAPPES (accord tenu)
        for cd in chord_deg:
            f = _midi_hz(scale_note(cd, 1))
            v = _note(f, bar*0.98, kind="saw", detune=0.01,
                      adsr=(0.4,0.3,0.8,0.5), gain=0.16)
            v = ae.apply_filter(np.stack([v,v],axis=1), "lowpass")
            _place(pads[:,0], v[:,0], t0); _place(pads[:,1], v[:,1], t0)
        # BASSE (racine, rythme simple)
        for b in range(4):
            f = _midi_hz(scale_note(deg, 0))
            nb = _note(f, beat*0.9, kind="tri", detune=0.003,
                       adsr=(0.005,0.05,0.8,0.1), gain=0.5)
            _place(bass[:,0], nb, t0+b*beat); _place(bass[:,1], nb, t0+b*beat)
        # MÉLODIE (sur la gamme, densité selon intensité)
        steps = 8
        for s in range(steps):
            if rng.random_sample() > (0.35+intensity*0.5):
                continue
            deg_m = deg + rng.choice([0,2,4,5,7,4,2])
            f = _midi_hz(scale_note(int(deg_m), 2))
            swing = cfg["swing"]*beat if s % 2 else 0
            at = t0 + s*(beat/2) + swing
            nl = _note(f, beat*0.45, kind="square", detune=0.006,
                       adsr=(0.005,0.06,0.6,0.12), gain=0.12*cfg["lead"])
            _place(lead[:,0], nl, at); _place(lead[:,1], nl, at)

    drums = _drum_track(cfg["drums"], total_bars, beat, total_n, rng)

    mix = pads + bass*1.0 + lead + drums*(0.7+0.3*intensity)

    # effets d'ambiance
    mix = ae.apply_reverb(mix, cfg["reverb"])
    mix = ae.apply_delay(mix, cfg["delay"], bpm)

    out_n = int(dur*SR)
    mix = mix[:out_n] if len(mix) >= out_n else np.pad(mix, ((0,out_n-len(mix)),(0,0)))

    peak = np.abs(mix).max()
    if peak > 1e-6:
        mix = mix/peak*0.95
    return mix.astype(np.float32)


# --------------------------------------------------- neuronal (optionnel)
def neural_available() -> bool:
    try:
        import audiocraft  # noqa: F401
        return True
    except Exception:
        return False


def generate_neural(prompt: str, duration: float = 12.0) -> np.ndarray:
    """Texte -> musique via MusicGen (audiocraft). Optionnel."""
    from audiocraft.models import MusicGen
    model = MusicGen.get_pretrained("facebook/musicgen-small")
    model.set_generation_params(duration=min(duration, 30))
    wav = model.generate([prompt])          # (1, C, T)
    audio = wav[0].cpu().numpy().T          # (T, C)
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    # rééchantillonne vers SR si besoin
    msr = model.sample_rate
    if msr != SR:
        audio = np.stack([ae._resample_linear(audio[:,c], int(len(audio)*SR/msr))
                          for c in range(audio.shape[1])], axis=1)
    peak = np.abs(audio).max()
    return (audio/peak*0.95).astype(np.float32) if peak>0 else audio.astype(np.float32)


MOODS = list(_MOODS.keys())
