# Atelier de Paroles RYSAO — version backend (usage personnel)

Ce petit serveur sert le site **et** relaie les requêtes de l'Atelier de Paroles
vers l'API Claude (Anthropic). La clé API reste **côté serveur** : elle n'est
jamais exposée dans le navigateur.

> **Outil privé.** L'Atelier n'est pas lié depuis le site public : la page
> `paroles.html` n'est accessible que si vous ouvrez son adresse vous-même.
> Pour un usage local (localhost), c'est déjà privé. Si vous hébergez le serveur,
> protégez-le avec un **code d'accès** (voir plus bas).

Aucune dépendance à installer — uniquement **Node.js 18 ou plus récent**.

## Démarrage rapide

1. Récupérez une clé API sur https://console.anthropic.com/settings/keys
2. Copiez le modèle de configuration et renseignez la clé :

   ```bash
   cp .env.example .env
   # puis éditez .env pour y mettre votre ANTHROPIC_API_KEY
   ```

3. Lancez le serveur :

   ```bash
   npm start
   # équivalent : node server.js
   ```

4. Ouvrez **http://localhost:3000/paroles.html**

   Aucune clé à saisir dans la page : tout passe par le serveur.

### Sans fichier .env

Vous pouvez aussi passer la clé directement :

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

## Comment ça marche

- `GET /` et les autres chemins → fichiers statiques du site.
- `POST /api/paroles` → le serveur ajoute la clé API et appelle
  `https://api.anthropic.com/v1/messages` (modèle `claude-opus-4-8`, en
  streaming), puis renvoie le flux tel quel au navigateur.
- La page `paroles.html` appelle `/api/paroles` par défaut. Si vous ouvrez le
  fichier **sans serveur**, un « mode direct » optionnel permet de coller une
  clé dans le navigateur (repli pratique pour tester en local).

## Accès privé (recommandé si vous hébergez le serveur)

En local (localhost), le serveur n'est accessible que depuis votre machine :
aucune protection supplémentaire n'est nécessaire.

Si vous mettez le serveur en ligne, définissez un code d'accès. La génération de
paroles exigera alors ce code (à saisir une fois dans la page, section
« Accès privé ») :

```bash
ACCESS_CODE=mon-code-secret ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Sans `ACCESS_CODE`, l'endpoint reste ouvert — à réserver au strict usage local.

## Déploiement

Toute plateforme qui exécute Node convient (un VPS, Render, Railway, Fly.io,
etc.). Définissez la variable d'environnement `ANTHROPIC_API_KEY` (et
éventuellement `PORT`) dans la configuration de la plateforme, puis lancez
`node server.js`.

> Sur un hébergement **purement statique** (GitHub Pages, Netlify sans
> fonctions…), il n'y a pas de serveur : utilisez alors le « mode direct » de la
> page, ou déployez le proxy comme fonction serverless.

Ne commitez jamais votre clé : le fichier `.env` est déjà ignoré par git.
