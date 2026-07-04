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
    cmd = [
        sys.executable, "-m", "demucs",
        "-n", model,
        "--out", out_dir,
        input_path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=1800)
    except subprocess.CalledProcessError as e:
        return {"available": True, "error": "Échec de la séparation.",
                "detail": (e.stderr or e.stdout or "")[-800:]}
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
