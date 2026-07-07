"""
RYSAO Studio — authentification (accès privé).

But : que personne d'autre que le propriétaire ne puisse utiliser le studio
quand le serveur est joignable (réseau, hébergement, téléphone…).

Mécanisme simple et robuste, sans dépendance externe :
  - un mot de passe (variable d'environnement RYSAO_PASSWORD ; sinon un mot
    de passe aléatoire est généré et affiché au démarrage) ;
  - /api/login échange le mot de passe contre un jeton signé (HMAC-SHA256)
    à durée de vie limitée ;
  - toutes les routes de traitement exigent ce jeton.

Pour choisir votre mot de passe :   export RYSAO_PASSWORD="votre-secret"
Pour garder vos sessions après redémarrage : export RYSAO_SECRET="…"
"""
from __future__ import annotations
import os
import time
import json
import hmac
import base64
import hashlib
import secrets

TOKEN_TTL = 7 * 24 * 3600  # 7 jours

# Secret de signature des jetons. Fixez RYSAO_SECRET pour que les sessions
# survivent aux redémarrages ; sinon il est éphémère (les jetons expirent au
# prochain démarrage, ce qui est plus sûr par défaut).
SECRET = os.environ.get("RYSAO_SECRET") or secrets.token_hex(32)

PASSWORD = os.environ.get("RYSAO_PASSWORD")
_GENERATED = PASSWORD is None
if _GENERATED:
    PASSWORD = secrets.token_urlsafe(9)


def startup_banner() -> None:
    line = "=" * 62
    print(line)
    print("  RYSAO Studio — accès privé (protégé par mot de passe)")
    if _GENERATED:
        print(f"  Mot de passe (généré) : {PASSWORD}")
        print("  → définissez RYSAO_PASSWORD pour en choisir un fixe.")
    else:
        print("  Mot de passe : (défini via RYSAO_PASSWORD)")
    print(line)


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest())


def make_token(ttl: int = TOKEN_TTL) -> str:
    payload = _b64(json.dumps({"exp": int(time.time()) + ttl}).encode())
    return f"{payload}.{_sign(payload)}"


def verify_token(token: str) -> bool:
    try:
        payload, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, _sign(payload)):
            return False
        data = json.loads(_unb64(payload))
        return int(data.get("exp", 0)) > time.time()
    except Exception:
        return False


def check_password(pw: str) -> bool:
    return hmac.compare_digest((pw or "").encode(), PASSWORD.encode())
