# 🚀 Déployer OnziA sur Vercel

OnziA est une **app web (PWA)** : une fois en ligne, elle s'installe sur l'écran
d'accueil (iPhone/Android) et fonctionne comme une application, notifications
comprises. Pas d'App Store, pas de compte développeur Apple.

---

## 1. Prérequis

- Le repo GitHub (déjà en place).
- Un compte [Vercel](https://vercel.com) (gratuit) connecté à GitHub.
- Tes clés : **API-Football**, **Anthropic** (optionnelle).

---

## 2. Importer le projet

1. Sur Vercel : **Add New → Project**.
2. Sélectionne le dépôt GitHub `OnziA`.
3. Framework détecté : **Next.js** (laisse les réglages par défaut).
4. **Ne déploie pas encore** — ajoute d'abord le stockage et les variables.

---

## 3. Créer le stockage KV (notifications persistantes)

Indispensable pour que les abonnements aux notifications survivent.

1. Onglet **Storage → Create Database → KV**.
2. Donne un nom, crée-le, puis **Connect to Project** (relie-le à OnziA).
3. Vercel injecte automatiquement `KV_REST_API_URL` et `KV_REST_API_TOKEN`.
   → Le code bascule tout seul sur KV (sinon il utiliserait des fichiers).

---

## 4. Variables d'environnement

**Settings → Environment Variables.** Ajoute (Production + Preview) :

| Variable | Valeur | Comment l'obtenir |
|---|---|---|
| `API_FOOTBALL_KEY` | ta clé | Dashboard API-Football.com |
| `ANTHROPIC_API_KEY` | ta clé (optionnel) | console.anthropic.com |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | optionnel |
| `VAPID_PUBLIC_KEY` | générée | `node scripts/generate-vapid.mjs` |
| `VAPID_PRIVATE_KEY` | générée | idem (⚠️ secret) |
| `VAPID_SUBJECT` | `mailto:ton@email` | ton e-mail de contact |
| `CRON_SECRET` | aléatoire | `openssl rand -hex 32` |
| `API_FOOTBALL_SEASON` | ex `2024` | optionnel (sinon auto) |

> `KV_REST_API_URL` / `KV_REST_API_TOKEN` sont ajoutées automatiquement à
> l'étape 3 — ne pas les saisir à la main.

### Générer les clés VAPID

```bash
node scripts/generate-vapid.mjs
```

Copie les 2 lignes affichées dans les variables Vercel. **Garde la même paire**
en local et en prod (sinon les abonnements existants cessent de fonctionner).

---

## 5. Déployer

Clique **Deploy**. À la fin tu obtiens une URL `https://onzia-xxx.vercel.app`.
Tu peux brancher un domaine perso dans **Settings → Domains**.

---

## 6. Le cron des notifications live

`vercel.json` programme `/api/cron/live` **toutes les minutes**. Selon ton plan :

| Plan Vercel | Fréquence cron autorisée |
|---|---|
| **Hobby** (gratuit) | 1×/jour seulement → trop lent pour le live |
| **Pro** | jusqu'à la minute → recommandé pour le direct |

**Si tu restes en Hobby** et que tu veux les notifs live à la minute, utilise un
planificateur externe gratuit qui appelle l'URL chaque minute :

- [cron-job.org](https://cron-job.org) ou un workflow **GitHub Actions**
- URL à appeler :
  `https://ton-domaine.vercel.app/api/cron/live?secret=TON_CRON_SECRET`

Le `secret` doit correspondre à `CRON_SECRET`. (Vercel Cron, lui, envoie
automatiquement l'en-tête `Authorization: Bearer CRON_SECRET`.)

---

## 7. Installer l'app (côté utilisateur)

- **iPhone (Safari)** : bouton **Partager** → **Sur l'écran d'accueil**. Rouvre
  OnziA depuis l'icône → notifications actives, même écran verrouillé.
- **Android (Chrome)** : bannière « Installer » ou menu → **Installer l'application**.
- **Ordinateur** : icône d'installation dans la barre d'adresse.

---

## 8. Vérifications post-déploiement

- [ ] La page d'accueil liste des compétitions (ta clé API-Football fonctionne).
- [ ] Ouvrir un match affiche prédiction, cotes, comparateur, compositions, buteurs.
- [ ] `GET /api/push/subscribe` renvoie `enabled: true`.
- [ ] Sur mobile : « Suivre ce match » demande l'autorisation puis confirme.
- [ ] Appeler `/api/cron/live?secret=...` renvoie `{ ok: true }`.

---

## ⚠️ Rappels

- Ne committe **jamais** tes clés ( `.env.local` est ignoré par git ).
- Jeu responsable : les pronostics ne garantissent rien. **09 74 75 13 13**.
