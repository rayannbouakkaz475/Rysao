#!/usr/bin/env bash
# Démarre le studio RYSAO (API + frontend) sur http://127.0.0.1:8000
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "→ Création de l'environnement virtuel…"
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt
fi

# Accès privé : définissez votre mot de passe avant de lancer, ex :
#   export RYSAO_PASSWORD="votre-secret"
# Sinon un mot de passe aléatoire est généré et affiché ci-dessous.
echo "→ Studio disponible sur http://127.0.0.1:8000"
exec ./.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
