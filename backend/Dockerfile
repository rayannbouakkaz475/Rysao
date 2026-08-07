FROM python:3.11-slim

# libsndfile : décodage audio (WAV/FLAC/OGG/MP3) ; ffmpeg optionnel
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# code backend + frontend (remix.html à la racine du dépôt)
COPY backend/ /app/backend/
COPY remix.html /app/remix.html
COPY euromillions.html /app/euromillions.html

EXPOSE 8000
# $PORT est fourni par l'hébergeur (Render, Railway, HF Spaces…) ; 8000 en local.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
