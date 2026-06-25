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
| 🤝 **Communauté** | ✅ réel (démo) | hub **Profil · Feed · Chat · Boutiques** (voir ci-dessous) |
| 🆓 / 💎 **Gratuit / Premium** | ✅ réel | Premium **10 CHF/mois** ; gating des fonctions Premium |
| 🔗 **PokéCardex** | ✅ lien | bouton d'accès intégré dans Réglages |
| 💶 **Prix Cardmarket** | ✅ réel (Pokémon) | prix réels via `pokemontcg.io`, repli estimation |
| 🌐 **Catalogue complet** | ✅ réel | toutes les séries chargées via API (Pokémon, Lorcana) |
| 🔎 **Reconnaissance OCR** | ✅ réel | OCR du nom (Tesseract.js) + correspondance catalogue |

## Prix marché (`js/providers.js`)

- **Pokémon** : prix **Cardmarket réels** via l'API publique `pokemontcg.io`
  (`getLivePrice`). Clé optionnelle pour un débit plus élevé →
  Réglages ▸ *Clé pokemontcg.io*.
- **Autres jeux / repli** : moteur d'estimation déterministe stable
  (`engine.js` → `getPrice`), clairement étiqueté **Estimation**.
- **eBay / fournisseur commercial** : `localStorage` `rysao_price_api` + point
  d'extension prévu (leurs API sont payantes / sur autorisation).

## Catalogue complet — « toutes les séries depuis l'origine »

`Providers.loadFullCatalog()` récupère et **fusionne** dynamiquement :

- **Pokémon** : `https://api.pokemontcg.io/v2/sets` (tous les sets depuis 1999) ;
- **Lorcana** : `https://api.lorcast.com/v0/sets`.

Résultat mis en **cache 7 jours** (`localStorage`). Le seed statique
(`data.js`) couvre One Piece, Topps et l'usage hors-ligne. Bouton manuel
*« Charger toutes les séries »* dans l'onglet Références.

> ⚠️ Ces appels passent par le navigateur du client. Selon l'hébergement, vérifie
> que les API ci-dessus sont accessibles (CORS public côté `pokemontcg.io` /
> `lorcast.com`).

## Communauté — vivre la passion (pas d'achat sur l'app)

Aucune transaction n'a lieu dans l'app : les membres se montrent, échangent et
se contactent. Onglet **Communauté** → 4 segments :

- **Profil** : pseudo + listes *« à vendre »* et *« je recherche »* (visibles des autres membres).
- **Feed** : vrai fil social — publications **photo/texte**, **likes**, **commentaires**, et **enchères** (mise de départ, enchérir). Chaque publication porte le **pseudo de l'auteur**.
  - 🤖 **Analyse IA automatique** : à l'ajout d'une photo, l'OCR reconnaît la carte/série et propose une valeur, affichées sur la publication.
- **Chat** : messagerie entre membres (démo locale ; le temps réel nécessite un serveur — point d'extension).
- **Boutiques** : une boutique inscrit son **nom + adresse** (lien carte OpenStreetMap) ; ses annonces/événements remontent dans le Feed.

> Stockage local (localStorage) pour la démo. Pour du multi-utilisateur réel
> (chat live, feed partagé, enchères), brancher un backend (Firebase / Supabase /
> WebSocket) — l'architecture des vues est prête à recevoir une API.

## Reconnaissance de carte (OCR)

`Providers.recognize()` lit le **nom imprimé** (bande supérieure de la carte)
avec **Tesseract.js** (chargé à la demande depuis un CDN), puis fait
correspondre le texte au catalogue pour déterminer la série, et lance le prix.
Si le CDN/OCR est indisponible, l'app le signale sans planter. Pour une
reconnaissance visuelle complète (image → carte exacte), brancher un modèle
TensorFlow.js / API de vision reste le point d'extension prévu.

## Structure

```
app/
├── index.html              # shell de l'app
├── css/styles.css          # design + arrière-plans thématiques par TCG
├── js/
│   ├── i18n.js             # 6 langues d'interface
│   ├── data.js             # séries, scellés, sociétés de gradation, devises
│   ├── providers.js        # API réelles : prix Cardmarket, catalogue, OCR
│   ├── engine.js           # prix (live+repli), gradation, devises, sorties
│   ├── scanner.js          # caméra temps réel + analyse de centrage
│   └── app.js              # routing + vues + état
├── manifest.webmanifest    # PWA
├── sw.js                   # service worker (hors-ligne)
└── README.md
```

## Avertissement

Les estimations de note et de prix sont **indicatives** et ne remplacent pas
l'avis d'une société de gradation officielle.
