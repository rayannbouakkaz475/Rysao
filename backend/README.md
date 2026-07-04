# RYSAO Studio — Backend

Serveur qui apporte au studio de remix les capacités que le navigateur **ne
peut pas** offrir :

| Capacité | Navigateur seul | Avec backend |
|---|:---:|:---:|
| Import multi-morceaux, remix, effets, export WAV | ✅ | ✅ |
| Détection de tempo (BPM) | ✅ (approx.) | ✅ (+ tonalité) |
| **Time-stretch en conservant la hauteur** (vrai) | ❌ | ✅ |
| **Pitch-shift indépendant** | ❌ | ✅ |
| Beatmatch pro pour les mashups | approx. | ✅ |
| **Séparation de pistes IA** (voix / batterie / basse / autres) | ❌ | ✅* |
| **Création de musique** (compose un morceau original) | ❌ | ✅ |
| **Génération neuronale texte→musique** (MusicGen) | ❌ | ✅** |

\* nécessite Demucs (inclus dans l'image Docker « full », voir plus bas).
\** nécessite l'installation optionnelle d'audiocraft.

Le studio fonctionne **sans** le backend (mode 100 % navigateur). Quand le
serveur est présent, l'interface le détecte automatiquement et débloque les
fonctions Pro.

---

## Démarrage rapide

```bash
cd backend
./run.sh
```

Puis ouvrez **http://127.0.0.1:8000** — le studio est servi par le serveur et
affiche « Serveur connecté ».

Ou manuellement :

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Docker — image légère (sans séparation IA)

```bash
docker build -t rysao-studio -f backend/Dockerfile .
docker run -p 8000:8000 rysao-studio
```

### Docker Compose — tout inclus (avec séparation de pistes IA) ⭐

Recommandé : la séparation Demucs fonctionne sans rien installer à la main.

```bash
docker compose up --build
```

Puis ouvrez **http://localhost:8000**. La première séparation télécharge le
modèle Demucs (~80 Mo), conservé ensuite dans le volume `model-cache`. Pour
un GPU NVIDIA, décommentez la section `deploy` de `docker-compose.yml`.

---

## Séparation de pistes IA (optionnel)

Isole voix, batterie, basse et « autres » grâce à
[Demucs](https://github.com/facebookresearch/demucs). Non installé par défaut
(gros modèle). Pour l'activer :

```bash
pip install demucs torch
# puis redémarrez le serveur
```

- Le premier appel télécharge le modèle (~2 Go dans `~/.cache/torch`).
- Un **GPU** accélère fortement le traitement ; sur CPU comptez quelques
  minutes par morceau.
- Sans Demucs, le bouton « Séparer IA » reste masqué et tout le reste
  fonctionne normalement.

Une fois séparé, chaque piste (Voix / Batterie / Basse / Autres) apparaît
comme un morceau à part : cochez celles que vous voulez garder pour remixer
uniquement la voix, faire un instrumental, etc.

---

## Créer une musique (IA générative)

Deux moteurs, exposés dans la section « Créer une musique » du studio :

- **Algorithmique** (par défaut, instantané, sans GPU) : compose un vrai
  morceau original — gamme + accords, basse, nappes, mélodie et batterie
  synthétisés, puis mixés avec reverb/delay. Ambiances : lo-fi, cinématique,
  house, trap, ambient. Réglages : tonalité, gamme, durée, intensité, graine.
- **Neuronal texte→musique** (optionnel) : [MusicGen](https://github.com/facebookresearch/audiocraft).

  ```bash
  pip install audiocraft   # gros modèle, GPU conseillé
  ```

  ou décommentez la ligne `audiocraft` dans `backend/Dockerfile.demucs`.

## API

| Méthode | Route | Rôle |
|---|---|---|
| `GET`  | `/api/health` | état + capacités du serveur |
| `POST` | `/api/analyze` | upload audio → `{id, bpm, key, duration}` |
| `POST` | `/api/separate` | `id` → pistes séparées (Demucs) |
| `POST` | `/api/process` | `id`, `stretch`, `semitones` → WAV traité |
| `POST` | `/api/remix` | `spec` (JSON) → remix rendu, WAV |
| `POST` | `/api/generate` | `spec` (JSON) → musique générée, WAV |
| `GET`  | `/api/file/{id}` | récupère un fichier généré |
| `GET`  | `/` | le studio (`remix.html`) |

Exemple `spec` pour `/api/remix` :

```json
{
  "recipe": { "bpm": 120, "dur": 30, "beats_per_cell": 1, "shuffle": 0.4,
              "reverb": 0.25, "delay": 0.2, "stutter": 0.2, "reverse": 0.1,
              "filter": "sweepup", "keep_pitch": true, "speed": 1.0, "seed": 42 },
  "layers": [ { "id": "<id_upload>", "bpm": 120, "gain": 1.0, "role": "rythme" } ]
}
```

---

## Notes

- Décodage audio via **libsndfile** (`soundfile`) : WAV, FLAC, OGG et MP3 sans
  ffmpeg. Pour d'autres formats exotiques, installez `ffmpeg`.
- Tout le DSP (time-stretch, pitch, effets, rendu) est en **numpy/scipy**,
  sans service tiers : votre musique ne quitte pas la machine.
- `uploads/` et `outputs/` sont des dossiers de travail (ignorés par git).
