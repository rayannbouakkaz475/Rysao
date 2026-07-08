# Séparation IA en ligne — Hugging Face Space (gratuit)

Objectif : avoir le studio **avec la séparation de pistes IA (Demucs)** en
ligne, gratuitement. On utilise un **Space Docker** sur Hugging Face, qui a
assez de mémoire pour l'IA (contrairement au plan gratuit de Render).

> Le Space récupère ton code tout seul depuis le dépôt **public** GitHub — tu
> n'as qu'un fichier à coller et un mot de passe à définir.

Résultat : une adresse `https://<toi>-rysao.hf.space` = ton studio complet + la
séparation IA. La séparation prend **1 à 3 min par morceau** (processeur, pas de
GPU sur le gratuit).

---

## Étapes (≈ 10 min, une seule fois)

1. Crée un compte sur **https://huggingface.co** (gratuit, sans carte).
2. Va sur **https://huggingface.co/new-space** :
   - **Owner** : toi. **Space name** : `rysao` (par ex.).
   - **License** : au choix.
   - **Select the Space SDK** : choisis **Docker** → **Blank**.
   - **Visibility** : **Private** (recommandé — visible par toi seul).
   - Clique **Create Space**.
3. Le Space est créé avec un fichier `README.md`. Ajoute maintenant le
   **Dockerfile** :
   - Onglet **Files** → **Add file** → **Create a new file**.
   - Nom du fichier : `Dockerfile`
   - Colle **tout le contenu** de [`backend/Dockerfile.hf`](Dockerfile.hf)
     (dans ton dépôt GitHub).
   - **Commit new file**.
4. Définis ton **mot de passe** :
   - Onglet **Settings** → section **Variables and secrets** →
     **New secret**.
   - Name : `RYSAO_PASSWORD` — Value : *ton mot de passe*.
   - (Optionnel) ajoute aussi `RYSAO_SECRET` = une longue chaîne au hasard,
     pour rester connecté après un redémarrage.
5. Le Space se (re)construit automatiquement. **Le premier build prend
   10-20 min** (il installe PyTorch + Demucs). Suis l'avancement dans l'onglet
   **Logs**. Quand c'est prêt, le statut passe à **Running**.
6. Ouvre l'adresse du Space (bouton en haut, ou `https://<toi>-rysao.hf.space`)
   sur ton ordi ou ton iPhone → entre ton mot de passe.
   Le bouton **« ⃝ Séparer IA »** apparaît maintenant sur chaque morceau. 🎤

---

## Utilisation

1. Importe une chanson.
2. Clique **« ⃝ Séparer IA »** sur la piste → patiente (1-3 min).
3. Le morceau se transforme en 4 pistes : **Voix / Batterie / Basse / Autres**.
4. Coche celles que tu veux garder (ex. juste la voix), puis remixe / mixe
   normalement.

---

## Bon à savoir

- **Mise en veille** : un Space gratuit se met en pause après inactivité ; le
  premier accès le réveille (quelques dizaines de secondes).
- **Mettre à jour le code** : le Dockerfile clone le dépôt au moment du build.
  Pour récupérer une nouvelle version, va dans **Settings → Factory rebuild**.
- **Plus rapide** : dans les réglages du Space, tu peux passer à un matériel
  **GPU** (payant) — la séparation devient quasi instantanée.
- **Confidentialité** : Space en **Private** + mot de passe = toi seul y as
  accès ; ta musique est traitée sur ton Space, pas revendue à un tiers.

---

## Alternatives

Voir [`DEPLOY.md`](DEPLOY.md) pour héberger sur Render/Railway (payant pour
l'IA) ou faire tourner Demucs **sur ton ordinateur** via
`docker compose up --build` (gratuit, mais l'ordi doit rester allumé).
