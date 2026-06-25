# RYSAO TCG — Application

Application web (PWA, installable sur iPhone / Android / PC) pour **authentifier,
analyser le centrage et estimer la note de gradation** de tes cartes, avec prix
marché, collection, mises à jour de sorties et un mini-réseau de recherche.

Jeux couverts : **Pokémon, One Piece, Lorcana, Topps** (+ produits **scellés**).
Chaque jeu a son propre **arrière-plan thématique**.

## Lancer l'app

```bash
cd app
python3 -m http.server 8099
# puis ouvrir http://localhost:8099/index.html
```

> Le **scan caméra** nécessite `https://` ou `localhost` (contrainte navigateur
> pour `getUserMedia`). En production, hébergez le dossier `app/` sur HTTPS.

## Fonctionnalités

| Fonction | État | Détail |
|---|---|---|
| 📷 Scan caméra **temps réel** | ✅ réel | analyse en direct, pas de photo à prendre (`js/scanner.js`) |
| 📐 Analyse de **centrage** | ✅ réel | mesure des marges H/B/G/D → ratio type 55/45 + score |
| 🏆 **Gradation** mondiale & européenne | ✅ réel | PSA, BGS, CGC, SGC, TAG, ARS, PCA, AFG, MGC, Gradia… + **probabilité de grosse note** |
| 📚 **Références** TCG & scellés | ✅ réel (seed) | séries avec année, nb de cartes, **langues** (fr/en/de/it/es/ja/ko/zh) |
| 🔄 **Mise à jour des sorties** | ✅ réel | calendrier dans `engine.js` → ajout auto quand la date est atteinte |
| 🌍 **Interface multilingue** | ✅ réel | FR, EN, DE, IT, JA, ZH |
| 💱 **Multi-devises** | ✅ réel | EUR, USD, GBP, CHF, JPY, CNY, CAD |
| 🗂️ **Collection** + valeur totale | ✅ réel | stockage local, total dans la devise choisie, export (Premium) |
| 🤝 **Réseau / recherches** | ✅ réel (démo) | « je recherche cette carte → on me contacte » |
| 🆓 / 💎 **Gratuit / Premium** | ✅ réel | gating des fonctions Premium |
| 🔗 **PokéCardex** | ✅ lien | bouton d'accès intégré dans Réglages |
| 💶 **Prix Cardmarket / eBay** | ⚠️ estimation | voir ci-dessous |

## Prix marché — à brancher

Les API **Cardmarket** et **eBay** sont **payantes / sur autorisation**, et le
scraping viole leurs CGU. L'app fournit donc un **moteur d'estimation** stable et
**l'emplacement prêt** pour ta vraie clé :

- `js/engine.js` → `getPrice()` : décommente le bloc `if (PRICE_API_KEY)` et
  branche ton backend / fournisseur (ex. agrégateur de prix sous licence).
- Stocke la clé via `localStorage.setItem("rysao_price_api", "…")`.

## Reconnaissance auto de la carte

La détection assistée fournit centrage + cadre. La **reconnaissance exacte de la
série/carte par IA** demande un modèle entraîné (TensorFlow.js / API de vision) :
point d'extension prévu dans `js/scanner.js`.

## Structure

```
app/
├── index.html              # shell de l'app
├── css/styles.css          # design + arrière-plans thématiques par TCG
├── js/
│   ├── i18n.js             # 6 langues d'interface
│   ├── data.js             # séries, scellés, sociétés de gradation, devises
│   ├── engine.js           # prix, gradation, devises, mises à jour de sorties
│   ├── scanner.js          # caméra temps réel + analyse de centrage
│   └── app.js              # routing + vues + état
├── manifest.webmanifest    # PWA
├── sw.js                   # service worker (hors-ligne)
└── README.md
```

## Avertissement

Les estimations de note et de prix sont **indicatives** et ne remplacent pas
l'avis d'une société de gradation officielle.
