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
    "synthwave": dict(scale="min", bpm=100, progs=[[0,5,3,4],[0,6,5,4]],
                    swing=0.0, drums="synth", reverb=0.3, delay=0.24, lead=0.6),
    "boombap": dict(scale="dorien", bpm=90, progs=[[0,3,4,5],[0,5,3,4]],
                    swing=0.16, drums="boombap", reverb=0.2, delay=0.12, lead=0.45),
    "dnb":     dict(scale="min", bpm=174, progs=[[0,5,3,4],[0,3,5,5]],
                    swing=0.0, drums="dnb", reverb=0.22, delay=0.14, lead=0.5),
    "afro":    dict(scale="maj", bpm=110, progs=[[0,4,5,3],[0,3,4,4]],
                    swing=0.05, drums="afro", reverb=0.2, delay=0.16, lead=0.5),
    "reggaeton": dict(scale="min", bpm=95, progs=[[0,5,3,4],[0,4,5,3]],
                    swing=0.0, drums="dembow", reverb=0.18, delay=0.12, lead=0.5),
    "hardstyle": dict(scale="min", bpm=150, progs=[[0,0,5,3],[0,3,5,4]],
                    swing=0.0, drums="hardstyle", reverb=0.22, delay=0.12, lead=0.7,
                    hard=True, distortion=0.5, lead_kind="saw"),
    "hardcore": dict(scale="min", bpm=190, progs=[[0,0,3,5],[0,5,3,3]],
                    swing=0.0, drums="gabber", reverb=0.18, delay=0.1, lead=0.6,
                    hard=True, distortion=0.7, lead_kind="square"),
    "phonk":   dict(scale="penta", bpm=135, progs=[[0,3,5,3],[0,5,3,4]],
                    swing=0.1, drums="phonk", reverb=0.22, delay=0.16, lead=0.6,
                    distortion=0.25, lead_sound="cowbell"),
    "techno":  dict(scale="min", bpm=130, progs=[[0,0,0,3],[0,3,0,5]],
                    swing=0.0, drums="techno", reverb=0.25, delay=0.2, lead=0.4,
                    distortion=0.15, lead_kind="saw"),
    "dubstep": dict(scale="min", bpm=140, progs=[[0,0,5,3],[0,4,3,5]],
                    swing=0.0, drums="dubstep", reverb=0.24, delay=0.14, lead=0.5,
                    distortion=0.4, wobble=True, lead_kind="saw"),
    "trance":  dict(scale="min", bpm=138, progs=[[0,5,6,4],[0,4,5,3]],
                    swing=0.0, drums="four", reverb=0.4, delay=0.28, lead=0.6,
                    lead_kind="saw"),
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


def _distort(x, drive=0.5):
    """Saturation (tanh) : plus 'drive' est haut, plus le son est agressif/gros."""
    if drive <= 0:
        return x
    k = 1 + drive * 12
    return (np.tanh(x * k) / np.tanh(k)).astype(np.float32)


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


def _hard_kick(dur=0.42, root=55.0):
    """Kick puissant et distordu (hardstyle/hardcore) : claque + queue tonale."""
    n = int(dur*SR); t = np.arange(n)/SR
    # claque : balayage de hauteur rapide, fortement saturé
    click_f = 320*np.exp(-t*45) + root*2
    click = np.sin(2*np.pi*np.cumsum(click_f)/SR) * np.exp(-t*11)
    click = np.tanh(click*6)
    # queue tonale (la fameuse basse pitchée du kick)
    tail_f = root*np.exp(-t*1.2) + root*0.7
    tail = np.sin(2*np.pi*np.cumsum(tail_f)/SR) * np.exp(-t*4) * 0.9
    return ((click*0.7 + tail*0.6)*0.95).astype(np.float32)


def _cowbell(freq=540.0, dur=0.14):
    """Cloche métallique (signature phonk)."""
    n = int(dur*SR); t = np.arange(n)/SR
    sig = (np.sign(np.sin(2*np.pi*freq*t)) + np.sign(np.sin(2*np.pi*freq*1.48*t)))*0.5
    return (sig * np.exp(-t*16) * 0.5).astype(np.float32)


def _place(track, sig, at):
    i = int(at*SR)
    j = min(len(track), i+len(sig))
    if i < len(track):
        track[i:j] += sig[:j-i]


# Grooves sur une grille de 16 pas (double-croches) : kick / snare / hats.
# hats : "8" = croches (pas pairs), "16" = doubles-croches, "off" = contretemps.
_GROOVES = {
    "four":    dict(kick=[0,4,8,12],      snare=[4,12],          hats="off"),
    "soft":    dict(kick=[0,8],           snare=[4,12],          hats="8"),
    "trap":    dict(kick=[0,7,10],        snare=[8],             hats="16"),
    "boombap": dict(kick=[0,10],          snare=[4,12],          hats="8"),
    "dnb":     dict(kick=[0,10],          snare=[4,12],          hats="16"),
    "afro":    dict(kick=[0,6,10],        snare=[4,12],          hats="afro"),
    "dembow":  dict(kick=[0,8],           snare=[3,6,11,14],     hats="8"),
    "synth":   dict(kick=[0,4,8,12],      snare=[4,12],          hats="off"),
    "hardstyle":dict(kick=[0,4,8,12],     snare=[4,12],          hats="off"),
    "gabber":  dict(kick=[0,2,4,6,8,10,12,14], snare=[4,12],     hats="16"),
    "techno":  dict(kick=[0,4,8,12],      snare=[],              hats="off"),
    "dubstep": dict(kick=[0],             snare=[8],             hats="16"),
    "phonk":   dict(kick=[0,6,10],        snare=[4,12],          hats="8"),
    "none":    dict(kick=[],              snare=[],              hats="none"),
}


def _drum_track(pattern, bars, beat, total_n, rng, swing=0.0, hard=False, root=55.0):
    L = np.zeros(total_n, dtype=np.float32)
    R = np.zeros(total_n, dtype=np.float32)
    g = _GROOVES.get(pattern, _GROOVES["soft"])
    stp = beat/4                                   # 16 pas par mesure
    sw = swing*stp                                 # décalage de swing
    kickfn = (lambda: _hard_kick(root=root)) if hard else _kick
    def at_of(s):
        t = s*stp
        return t + (sw if (s % 2) else 0)          # swing sur les pas impairs
    for bar in range(bars):
        base = bar*4*beat
        for s in g["kick"]:
            k=kickfn(); _place(L,k,base+at_of(s)); _place(R,k,base+at_of(s))
        for s in g["snare"]:
            sn=_snare(rng=rng); _place(L,sn,base+at_of(s)); _place(R,sn,base+at_of(s))
        mode=g["hats"]
        if mode=="none": continue
        if mode=="8":    steps=range(0,16,2)
        elif mode=="16": steps=range(0,16)
        elif mode=="off":steps=range(2,16,4)
        elif mode=="afro":steps=[0,3,4,6,9,10,12,15]
        else:            steps=range(0,16,2)
        for s in steps:
            gain=0.4 if mode=="16" else (0.9 if s%4==0 else 0.6)
            h=_hat(dur=0.03 if mode=="16" else 0.05, rng=rng)
            _place(L,h*gain*0.85,base+at_of(s)); _place(R,h*gain,base+at_of(s))
        # roulements de charleys façon trap
        if pattern=="trap" and rng.random_sample()<0.4:
            k0=int(rng.choice([12,14])); reps=int(rng.choice([3,4,6]))
            for k in range(reps):
                h=_hat(dur=0.02,rng=rng)*0.4
                _place(L,h,base+k0*stp+k*(2*stp/reps))
                _place(R,h,base+k0*stp+k*(2*stp/reps))
    return np.stack([L,R],axis=1)


# ------------------------------------------------ structure « DJ / producteur »
def _dj_structure(total_n, beat, rng):
    """
    Enveloppes de sections d'un vrai morceau produit :
    intro → build-up (riser + snare roll) → drop → breakdown → 2e drop → outro.
    Retourne (env_batterie, env_synthés, extra_stéréo).
    """
    secs = [("intro",0.12),("build",0.12),("drop",0.26),
            ("break",0.14),("drop2",0.24),("outro",0.12)]
    drum_env = np.zeros(total_n, dtype=np.float32)
    synth_env = np.ones(total_n, dtype=np.float32)
    extra = np.zeros((total_n,2), dtype=np.float32)
    acc = 0.0
    for name, frac in secs:
        a = int(acc*total_n); acc += frac; b = min(total_n, int(acc*total_n))
        n = b-a
        if n <= 0:
            continue
        if name == "intro":
            drum_env[a:b] = np.linspace(0.0,0.45,n); synth_env[a:b] = np.linspace(0.35,0.6,n)
        elif name == "build":
            drum_env[a:b] = np.linspace(0.45,0.7,n); synth_env[a:b] = np.linspace(0.6,0.8,n)
            ramp = np.linspace(0,1,n)**2                      # riser (bruit montant)
            noise = rng.randn(n)*ramp*0.12
            extra[a:b,0] += noise; extra[a:b,1] += noise
            roll_start = max(a, b-int(2*4*beat*SR))           # snare roll accélérant
            pos = float(roll_start); step = beat/2*SR
            while pos < b:
                sn = _snare(rng=rng)*0.4*min(1.0, 0.4+(pos-roll_start)/max(1,(b-roll_start)))
                _place(extra[:,0], sn, pos/SR); _place(extra[:,1], sn, pos/SR)
                pos += step; step = max(beat/8*SR, step*0.82)
        elif name in ("drop","drop2"):
            drum_env[a:b] = 1.0; synth_env[a:b] = 1.0
        elif name == "break":
            drum_env[a:b] = 0.0; synth_env[a:b] = np.linspace(0.5,0.45,n)
        elif name == "outro":
            drum_env[a:b] = np.linspace(1.0,0.2,n); synth_env[a:b] = np.linspace(1.0,0.0,n)
    return drum_env, synth_env, extra


# --------------------------------------------------------------- compose
def generate(params: dict) -> np.ndarray:
    mood = params.get("mood","lofi")
    cfg = dict(_MOODS.get(mood, _MOODS["lofi"]))
    bpm = float(params.get("bpm") or cfg["bpm"])
    dur = float(params.get("duration", 30))
    seed = int(params.get("seed", 7))
    intensity = float(params.get("intensity", 0.5))
    dj = bool(params.get("dj", False))
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
            if cfg.get("lead_sound")=="cowbell":
                nl = _cowbell(f, beat*0.4) * (0.9*cfg["lead"])
            else:
                nl = _note(f, beat*0.45, kind=cfg.get("lead_kind","square"), detune=0.006,
                           adsr=(0.005,0.06,0.6,0.12), gain=0.12*cfg["lead"])
            _place(lead[:,0], nl, at); _place(lead[:,1], nl, at)

    # wobble sur la basse (dubstep)
    if cfg.get("wobble"):
        tt = np.arange(total_n)/SR
        lfo = (0.4 + 0.6*np.abs(np.sin(2*np.pi*(2.0/beat)*tt)))[:,None]
        bass = bass*lfo

    root_hz = _midi_hz(root)/4.0     # basse de kick calée sur la tonalité
    drums = _drum_track(cfg["drums"], total_bars, beat, total_n, rng,
                        cfg.get("swing",0.0), hard=cfg.get("hard",False), root=root_hz)

    # structure « DJ » : intro / build-up / drop / breakdown / drop / outro
    if dj:
        de, se, extra = _dj_structure(total_n, beat, rng)
        drums = drums*de[:,None] + extra
        pads = pads*se[:,None]; bass = bass*se[:,None]; lead = lead*se[:,None]

    # gros son : saturation des synthés (hardstyle / hardcore / dubstep…)
    synths = pads + bass*1.0 + lead
    if cfg.get("distortion"):
        synths = _distort(synths, float(cfg["distortion"]))
    mix = synths + drums*(0.75+0.3*intensity)

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
