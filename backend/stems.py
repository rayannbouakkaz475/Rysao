"""
Séparation de pistes par IA (voix / batterie / basse / autres).

S'appuie sur Demucs (https://github.com/facebookresearch/demucs) s'il est
installé. Sinon, expose `AVAILABLE = False` et une explication claire, sans
faire planter le serveur : le reste du studio continue de fonctionner.

Installation (sur une machine avec quelques Go de RAM, idéalement un GPU) :
    pip install demucs torch
Le premier appel télécharge le modèle (~/.cache/torch).
"""
from __future__ import annotations
import os
import subprocess
import sys
import shutil

STEMS = ["vocals", "drums", "bass", "other"]
STEMS_FR = {"vocals": "Voix", "drums": "Batterie", "bass": "Basse", "other": "Autres"}


def is_available() -> bool:
    try:
        import demucs  # noqa: F401
        return True
    except Exception:
        return False


AVAILABLE = is_available()


def unavailable_message() -> dict:
    return {
        "available": False,
        "reason": "Demucs n'est pas installé sur ce serveur.",
        "how_to": "Installez-le avec : pip install demucs torch — "
                  "puis redémarrez le serveur. Le premier appel télécharge "
                  "le modèle (~2 Go). Un GPU accélère fortement le traitement.",
    }


def separate(input_path: str, out_dir: str, model: str = "htdemucs") -> dict:
    """
    Sépare `input_path` en pistes. Retourne un dict :
      { available: True, stems: { vocals: <chemin.wav>, drums: ..., ... } }
    ou le message d'indisponibilité.
    """
    if not is_available():
        return unavailable_message()

    os.makedirs(out_dir, exist_ok=True)
    # On appelle demucs en sous-processus : plus robuste, libère la mémoire.
    # Modèle configurable : mettez RYSAO_DEMUCS_MODEL=mdx_extra_q pour moins
    # de mémoire (utile sur un Mac 8 Go), htdemucs par défaut (meilleure qualité).
    model = os.environ.get("RYSAO_DEMUCS_MODEL", model)
    cmd = [
        sys.executable, "-m", "demucs",
        "-n", model,
        "-d", "cpu",
        "--segment", "7",          # limite la mémoire par tranche
        "-j", "1",
        "--out", out_dir,
        input_path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=3600)
    except subprocess.CalledProcessError as e:
        detail = (e.stderr or e.stdout or "")[-800:]
        if e.returncode and e.returncode < 0:      # tué par un signal (souvent OOM)
            return {"available": True,
                    "error": "Séparation interrompue — mémoire probablement insuffisante. "
                             "Donnez plus de RAM à Docker, ou utilisez un modèle plus léger "
                             "(RYSAO_DEMUCS_MODEL=mdx_extra_q), ou un morceau plus court.",
                    "detail": detail}
        return {"available": True, "error": "Échec de la séparation.", "detail": detail}
    except subprocess.TimeoutExpired:
        return {"available": True, "error": "Séparation trop longue (timeout)."}

    base = os.path.splitext(os.path.basename(input_path))[0]
    stem_dir = os.path.join(out_dir, model, base)
    result = {}
    for s in STEMS:
        p = os.path.join(stem_dir, f"{s}.wav")
        if os.path.exists(p):
            result[s] = p
    if not result:
        return {"available": True, "error": "Aucune piste produite."}
    return {"available": True, "stems": result, "labels": STEMS_FR}


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None
