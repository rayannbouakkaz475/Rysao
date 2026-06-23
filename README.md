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

### Comment marchent les prédictions

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
