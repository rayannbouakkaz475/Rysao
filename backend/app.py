"""
RYSAO Studio — API FastAPI.

Sert le frontend (remix.html) et expose les « super-pouvoirs » que le
navigateur ne peut pas offrir :
  GET  /api/health              état du serveur + capacités
  POST /api/analyze             upload -> {id, bpm, key, duration}
  POST /api/separate            id  -> pistes séparées (Demucs, optionnel)
  POST /api/process             id  -> time-stretch / pitch-shift (garde la hauteur)
  POST /api/remix               rendu serveur haute qualité -> WAV
  GET  /api/file/{name}         récupère un fichier généré/uploadé
"""
from __future__ import annotations
import os
import uuid
import json
import asyncio

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, Response
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import audio_engine as ae
import stems as stemmod
import music_gen as mg
import auth

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # dépôt (contient remix.html)
UP = os.path.join(HERE, "uploads")
OUT = os.path.join(HERE, "outputs")
os.makedirs(UP, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

app = FastAPI(title="RYSAO Studio API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# registre en mémoire : id -> chemin fichier
REG: dict[str, str] = {}


def _register(path: str) -> str:
    fid = uuid.uuid4().hex[:12]
    REG[fid] = path
    return fid


def _path(fid: str) -> str:
    p = REG.get(fid)
    if not p or not os.path.exists(p):
        raise HTTPException(404, f"Fichier introuvable : {fid}")
    return p


# --------------------------------------------------------------- auth
def require_auth(request: Request) -> bool:
    """Exige un jeton valide (cookie ou en-tête Authorization: Bearer)."""
    token = request.cookies.get("rysao_auth") or ""
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not auth.verify_token(token):
        raise HTTPException(401, "Authentification requise")
    return True


auth.startup_banner()


@app.post("/api/login")
async def api_login(response: Response, password: str = Form(...)):
    if not auth.check_password(password):
        await asyncio.sleep(1.0)          # ralentit les tentatives par force brute
        raise HTTPException(401, "Mot de passe incorrect")
    token = auth.make_token()
    response.set_cookie("rysao_auth", token, httponly=True, samesite="lax",
                        max_age=auth.TOKEN_TTL)
    return {"ok": True, "token": token}


@app.get("/api/me")
def api_me(_: bool = Depends(require_auth)):
    return {"ok": True}


# --------------------------------------------------------------- santé
@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "RYSAO Studio API",
        "auth_required": True,
        "capabilities": {
            "analyze": True,
            "time_stretch_keep_pitch": True,
            "pitch_shift": True,
            "server_remix": True,
            "mp3_export": ae.can_encode("MP3"),
            "ogg_export": ae.can_encode("OGG"),
            "music_generation": True,
            "neural_music": mg.neural_available(),
            "stem_separation": stemmod.AVAILABLE,
            "ffmpeg": stemmod.has_ffmpeg(),
        },
        "moods": mg.MOODS,
    }


# ------------------------------------------------------------- analyse
@app.post("/api/analyze")
async def api_analyze(file: UploadFile = File(...), _: bool = Depends(require_auth)):
    ext = os.path.splitext(file.filename or "audio")[1] or ".bin"
    dest = os.path.join(UP, uuid.uuid4().hex[:12] + ext)
    with open(dest, "wb") as f:
        f.write(await file.read())
    try:
        info = ae.analyze(dest)
    except Exception as e:
        os.remove(dest)
        raise HTTPException(400, f"Fichier audio illisible : {e}")
    fid = _register(dest)
    info["id"] = fid
    info["name"] = os.path.splitext(file.filename or "piste")[0]
    return info


# ------------------------------------------------------ séparation IA
@app.post("/api/separate")
async def api_separate(id: str = Form(...), _: bool = Depends(require_auth)):
    src = _path(id)
    res = stemmod.separate(src, os.path.join(OUT, "stems_" + id))
    if res.get("stems"):
        # enregistre chaque stem pour réutilisation par le frontend
        out = {"available": True, "labels": res.get("labels", {}), "stems": {}}
        for name, p in res["stems"].items():
            info = ae.analyze(p)
            info["id"] = _register(p)
            info["stem"] = name
            out["stems"][name] = info
        return out
    return JSONResponse(res, status_code=200)


# --------------------------------------- time-stretch / pitch-shift
@app.post("/api/process")
async def api_process(id: str = Form(...),
                      stretch: float = Form(1.0),
                      semitones: float = Form(0.0),
                      _: bool = Depends(require_auth)):
    src = _path(id)
    x = ae.load_audio(src)
    if abs(stretch - 1.0) > 1e-3:
        x = ae.time_stretch(x, 1.0 / stretch)   # stretch>1 => plus long
    if abs(semitones) > 1e-3:
        x = ae.pitch_shift(x, semitones)
    name = f"proc_{uuid.uuid4().hex[:10]}.wav"
    dest = os.path.join(OUT, name)
    ae.write_wav(dest, x)
    fid = _register(dest)
    return {"id": fid, "file": name, "duration": round(len(x) / ae.SR, 2)}


# ---------------------------------------------------- remix serveur
@app.post("/api/remix")
async def api_remix(spec: str = Form(...), _: bool = Depends(require_auth)):
    """
    spec (JSON) :
      { "recipe": {...}, "layers": [ {"id": "...", "bpm": .., "gain": ..,
                                       "role": ".."} ] }
    """
    try:
        data = json.loads(spec)
    except Exception:
        raise HTTPException(400, "spec JSON invalide")
    recipe = data.get("recipe", {})
    layers_in = data.get("layers", [])
    if not layers_in:
        raise HTTPException(400, "Aucune couche fournie")

    layers = []
    for L in layers_in:
        src = _path(L["id"])
        samples = ae.load_audio(src)
        bpm = L.get("bpm") or ae.estimate_bpm(samples)
        layers.append({"samples": samples, "bpm": float(bpm),
                       "gain": float(L.get("gain", 1.0)),
                       "role": L.get("role", "rythme"),
                       "eq": L.get("eq")})
    if "bpm" not in recipe:
        recipe["bpm"] = layers[0]["bpm"]
    recipe.setdefault("dur", 30)

    mix = ae.render_remix(layers, recipe)
    name = f"remix_{uuid.uuid4().hex[:10]}.wav"
    dest = os.path.join(OUT, name)
    ae.write_wav(dest, mix)
    fid = _register(dest)
    return {"id": fid, "file": name, "duration": round(len(mix) / ae.SR, 2),
            "url": f"/api/file/{fid}"}


# ------------------------------------------------ génération de musique
@app.post("/api/generate")
async def api_generate(spec: str = Form(...), _: bool = Depends(require_auth)):
    """
    spec (JSON) :
      { "mood": "lofi", "key": "La", "scale": "min", "bpm": 78,
        "duration": 30, "intensity": 0.6, "seed": 7 }
      ou pour le neuronal : { "engine": "neural", "prompt": "...", "duration": 12 }
    """
    try:
        p = json.loads(spec)
    except Exception:
        raise HTTPException(400, "spec JSON invalide")

    if p.get("engine") == "neural":
        if not mg.neural_available():
            return JSONResponse({
                "error": "MusicGen n'est pas installé sur ce serveur.",
                "how_to": "Installez-le avec : pip install audiocraft — "
                          "puis redémarrez. Gros modèle, GPU conseillé.",
            }, status_code=200)
        x = mg.generate_neural(p.get("prompt", "calm melodic music"),
                               float(p.get("duration", 12)))
    else:
        x = mg.generate(p)

    name = f"gen_{uuid.uuid4().hex[:10]}.wav"
    dest = os.path.join(OUT, name)
    ae.write_wav(dest, x)
    fid = _register(dest)
    return {"id": fid, "file": name, "duration": round(len(x) / ae.SR, 2),
            "url": f"/api/file/{fid}"}


# ------------------------------------------------------- encodage MP3/OGG
_MIME = {"mp3": "audio/mpeg", "ogg": "audio/ogg", "flac": "audio/flac", "wav": "audio/wav"}


@app.post("/api/encode")
async def api_encode(file: UploadFile = File(...), fmt: str = Form("mp3"),
                     _: bool = Depends(require_auth)):
    """Reçoit un WAV, renvoie le même audio encodé (mp3/ogg/flac/wav)."""
    fmt = fmt.lower()
    if fmt not in _MIME or not ae.can_encode(fmt):
        raise HTTPException(400, f"Format non disponible : {fmt}")
    import io
    try:
        x, sr = ae.sf.read(io.BytesIO(await file.read()), always_2d=True, dtype="float32")
    except Exception as e:
        raise HTTPException(400, f"Audio illisible : {e}")
    name = f"enc_{uuid.uuid4().hex[:10]}.{fmt}"
    dest = os.path.join(OUT, name)
    ae.encode_file(dest, x, sr, fmt)
    return FileResponse(dest, media_type=_MIME[fmt], filename=name)


# ------------------------------------------------------- récupération
@app.get("/api/file/{fid}")
def api_file(fid: str, _: bool = Depends(require_auth)):
    p = _path(fid)
    return FileResponse(p, media_type="audio/wav", filename=os.path.basename(p))


# ------------------------------------------- frontend statique
@app.get("/")
def index():
    return FileResponse(os.path.join(ROOT, "remix.html"))


# ---- Analyseur EuroMillions : ACCÈS PRIVÉ (même mot de passe RYSAO_PASSWORD) ----
# La page n'est renvoyée qu'avec un cookie de session valide. Sinon, on affiche
# une page de connexion. Ces routes sont déclarées AVANT le mount /site pour
# qu'elles aient priorité et que le fichier ne soit jamais servi en clair.
_LOGIN_HTML = """<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Accès privé — EuroMillions</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
 .box{background:#161b22;border:1px solid #2a3441;border-radius:14px;padding:28px 26px;width:min(92vw,340px);text-align:center}
 h1{font-size:20px;margin:0 0 4px}.s{color:#8b98a9;font-size:13.5px;margin:0 0 18px}
 input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid #2a3441;background:#1c2330;color:#e6edf3;font-size:15px}
 button{width:100%;margin-top:12px;padding:11px;border-radius:10px;border:0;background:#f5c518;color:#111;font-weight:700;font-size:15px;cursor:pointer}
 .err{color:#ff8a8d;font-size:13px;min-height:18px;margin-top:10px}
</style></head><body>
<form class="box" onsubmit="return login(event)">
 <h1>★ Accès privé</h1>
 <p class="s">Analyseur EuroMillions — réservé au propriétaire.</p>
 <input id="pw" type="password" placeholder="Mot de passe" autofocus autocomplete="current-password">
 <button type="submit">Entrer</button>
 <div class="err" id="err"></div>
</form>
<script>
async function login(e){e.preventDefault();
 const err=document.getElementById('err');err.textContent='';
 const fd=new FormData();fd.append('password',document.getElementById('pw').value);
 try{const r=await fetch('/api/login',{method:'POST',body:fd});
  if(r.ok){location.href='/euromillions';}else{err.textContent='Mot de passe incorrect.';}
 }catch(_){err.textContent='Erreur de connexion.';}
 return false;}
</script></body></html>"""


def _serve_euromillions(request: Request):
    token = request.cookies.get("rysao_auth") or ""
    if not auth.verify_token(token):
        return HTMLResponse(_LOGIN_HTML, status_code=401)
    return FileResponse(os.path.join(ROOT, "euromillions.html"))


@app.get("/euromillions")
def euromillions_page(request: Request):
    return _serve_euromillions(request)


# Empêche l'accès public au fichier via le mount /site (route prioritaire).
@app.get("/site/euromillions.html")
def euromillions_static(request: Request):
    return _serve_euromillions(request)


# Le reste du dépôt (site vitrine, images…) reste accessible sous /site
app.mount("/site", StaticFiles(directory=ROOT, html=True), name="site")
