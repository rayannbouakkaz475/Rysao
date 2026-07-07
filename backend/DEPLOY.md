# Héberger RYSAO Studio (accès partout, iPhone inclus)

Objectif : une adresse **https** à ouvrir dans Safari sur ton iPhone, en 4G/5G,
protégée par ton mot de passe. Le serveur tourne en ligne (pas sur l'iPhone).

> Rappel : l'iPhone ne peut pas faire tourner le serveur lui-même. On héberge
> donc le studio, et l'iPhone s'y connecte.

L'image **légère** (recommandée pour commencer) donne : remix, mashup, mixage,
égaliseur, spectre, **génération de musique (10 ambiances)**, **export MP3/OGG**,
time-stretch, détection BPM/tonalité. La **séparation de pistes IA (Demucs)** et
la génération neuronale demandent beaucoup plus de mémoire → instance payante
(voir plus bas).

---

## Option 1 — Render (le plus simple) ⭐

1. Assure-toi que ce dépôt est sur **GitHub**.
2. Va sur **https://render.com** et crée un compte (connexion avec GitHub).
3. **New → Blueprint**, choisis ce dépôt. Render détecte `render.yaml`.
4. Il te demande **RYSAO_PASSWORD** : mets un **mot de passe fort** (c'est celui
   qui protège ton studio). `RYSAO_SECRET` est généré tout seul.
5. **Apply / Create** → attends la fin du build (quelques minutes).
6. Tu obtiens une adresse du type `https://rysao-studio.onrender.com`.
7. Sur ton iPhone, ouvre cette adresse dans Safari → entre ton mot de passe. ✅

Astuce iPhone : dans Safari, **Partager → Sur l'écran d'accueil** pour l'avoir
comme une appli. Le plan gratuit se met en veille après inactivité (le premier
chargement peut prendre ~30 s, c'est normal).

---

## Option 2 — Railway

1. **https://railway.app** → New Project → Deploy from GitHub → ce dépôt.
2. Railway détecte le Dockerfile. Si besoin, indique
   `backend/Dockerfile` comme chemin et la racine du dépôt comme contexte.
3. Variables : ajoute `RYSAO_PASSWORD` (ton mot de passe) et `RYSAO_SECRET`
   (une longue chaîne au hasard).
4. Deploy → tu obtiens une adresse publique à ouvrir sur iPhone.

---

## Option 3 — Hugging Face Spaces (gratuit, privé possible)

1. **https://huggingface.co/spaces** → Create new Space → **Docker** (Blank).
2. Mets le Space en **Private** (visible par toi seul).
3. Pousse le contenu de ce dépôt dans le Space, avec à la racine un `Dockerfile`
   qui reprend `backend/Dockerfile` (HF lit le port `7860` — notre `${PORT}` s'y
   adapte si tu définis `PORT=7860`, ou change le port exposé).
4. Dans les **Settings → Variables and secrets** du Space : `RYSAO_PASSWORD`.
5. L'adresse du Space s'ouvre sur iPhone.

HF Spaces peut aussi activer un **GPU** (payant) → idéal si tu veux la
séparation Demucs et MusicGen accessibles partout.

---

## Option 4 — Depuis ton ordinateur, sans héberger (tunnel)

Si tu préfères que ça tourne sur **ton ordi** mais accessible de l'extérieur,
un tunnel expose ton serveur local :

```bash
# 1) lance le studio en local
cd backend && export RYSAO_PASSWORD="ton-secret" && ./run.sh
# 2) dans un autre terminal, ouvre un tunnel (ex. cloudflared)
cloudflared tunnel --url http://localhost:8000
```

Cloudflared affiche une adresse `https://…trycloudflare.com` à ouvrir sur
iPhone. Inconvénient : **ton ordinateur doit rester allumé** et le tunnel actif.

---

## Séparation de pistes IA (Demucs) accessible partout

L'image légère n'inclut pas Demucs. Pour l'avoir en ligne :

- déploie avec `backend/Dockerfile.demucs` au lieu de `backend/Dockerfile`
  (modifie `dockerfilePath` dans `render.yaml`) ;
- choisis une instance avec **au moins 4 Go de RAM** (payant sur la plupart des
  hébergeurs), idéalement un **GPU** pour la vitesse.

---

## Sécurité

- Choisis un **mot de passe long et unique** : c'est la seule barrière entre le
  studio et Internet.
- Les tentatives de connexion échouées sont ralenties (anti-force-brute).
- Tout le traitement reste sur **ton** serveur ; aucun service tiers ne reçoit
  ta musique.
