# ⚽ Rysao — Pronostics Football IA

Site de pronostics football **gratuit**, propulsé par une IA qui combine :

- 📊 **un modèle statistique maison** (loi de Poisson : forme, attaque, défense, avantage du terrain) ;
- 🧠 **Claude (Anthropic)** qui rédige une analyse argumentée à partir des chiffres.

Données réelles via [football-data.org](https://www.football-data.org/). Le site
fonctionne aussi **sans aucune clé** grâce à un mode démo.

---

## 🚀 Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les clés (optionnel — le mode démo marche sans)
cp .env.example .env.local
#   puis remplir FOOTBALL_DATA_TOKEN et ANTHROPIC_API_KEY

# 3. Lancer en développement
npm run dev
# → http://localhost:3000
```

### Build de production

```bash
npm run build
npm start
```

---

## 🔑 Clés API

Le site choisit automatiquement le **fournisseur de données** selon la clé présente,
dans cet ordre : `API_FOOTBALL_KEY` → `FOOTBALL_DATA_TOKEN` → mode démo.

| Variable | Rôle | Obligatoire ? |
|----------|------|---------------|
| `API_FOOTBALL_KEY` | Données via **API-Football.com** (api-sports.io) | Non — prioritaire si présente |
| `API_FOOTBALL_SEASON` | Forcer une saison API-Football (ex `2024`) | Non — calculée auto sinon |
| `FOOTBALL_DATA_TOKEN` | Données via **football-data.org** | Non — utilisé si pas de clé API-Football |
| `ANTHROPIC_API_KEY` | Analyse rédigée par Claude | Non — sinon analyse 100 % statistique |
| `ANTHROPIC_MODEL` | Modèle Claude (défaut `claude-opus-4-8`) | Non |

> Les clés se mettent dans `.env.local` (jamais committé) ou dans les variables
> d'environnement de l'hébergeur. **Ne partage jamais tes clés**, même par message.

---

## 🧩 Architecture

```
app/
  layout.jsx            Layout global
  page.jsx              Page d'accueil (liste matchs + détail/analyse)
  globals.css           Styles
  api/
    matches/route.js    GET  — matchs à venir + prédiction stats
    predict/route.js    POST — analyse IA détaillée d'un match
components/
  Header.jsx
  MatchCard.jsx
lib/
  footballData.js       Client football-data.org (+ données démo)
  statModel.js          Modèle de prédiction Poisson
  claude.js             Analyse via Claude (+ repli statistique)
```

## 🔔 Notifications en direct (PWA)

Le site est une **PWA** : notifications de **coup d'envoi**, **buts** et **cartons**
en direct, pour les matchs que tu choisis de suivre (bouton « Suivre ce match »).

- **iPhone** : Apple impose d'**ajouter le site à l'écran d'accueil** (Partager →
  Sur l'écran d'accueil) pour autoriser les notifications. Une fois fait, elles
  arrivent **écran verrouillé**, avec son et vibration.
- **Android / desktop** : fonctionne directement après autorisation.

### Mise en place

1. Générer les clés VAPID : `node scripts/generate-vapid.mjs`
2. Copier `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` dans `.env.local` (clé privée = secret).
3. Le **poller live** (`/api/cron/live`) interroge les matchs suivis et envoie les
   notifs. En production il est déclenché par **Vercel Cron** (voir `vercel.json`,
   toutes les minutes) et protégé par `CRON_SECRET`.

### Persistance des abonnements

`lib/store.js` choisit son backend automatiquement :

- **Vercel KV** si `KV_REST_API_URL` + `KV_REST_API_TOKEN` sont définis
  (persistant — **à utiliser en production**). Sur Vercel : *Storage → KV*, lie le
  store au projet, les variables sont injectées automatiquement.
- **Fichiers JSON** (`.data/`) sinon — pratique en local, mais éphémère sur du
  serverless (ne pas utiliser en prod).

Aucun changement de code nécessaire pour basculer : il suffit que les variables KV
soient présentes.

## 🎨 Icône

Icône **originale** (ballon stylisé sur dégradé) dans `public/icon.svg`. Régénère
les PNG avec `node scripts/generate-icons.mjs`.

## Comment marchent les prédictions

1. On récupère le **classement** (buts marqués/encaissés, forme récente).
2. `statModel.js` calcule les **buts attendus** (λ) de chaque équipe puis, via la
   **loi de Poisson**, les probabilités 1/N/2, les scores probables et les
   marchés annexes (+2,5 buts, BTTS).
3. `claude.js` envoie ces chiffres à **Claude**, qui rédige une analyse claire
   et un conseil — sans jamais contredire le modèle ni promettre un résultat.

---

## ☁️ Déploiement

Déployable gratuitement sur **Vercel** : importe le repo, ajoute les variables
d'environnement, et c'est en ligne. Toute plateforme supportant Next.js 14
fonctionne aussi.

---

## ⚠️ Avertissement

Les pronostics sont des **estimations probabilistes**, jamais des certitudes.
Jouer comporte des risques (endettement, dépendance). Ce projet est fourni à
but éducatif et de divertissement.

**Joueurs info service : 09 74 75 13 13** (appel non surtaxé).
