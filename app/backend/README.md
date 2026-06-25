# RYSAO TCG — Backend (Supabase)

Backend **multi-utilisateur temps réel** pour la communauté : comptes, feed,
likes, commentaires, enchères, chat et boutiques **partagés entre tous les
membres**. Aucune machine à héberger : la PWA parle directement à Supabase.

L'app fonctionne **sans backend** (mode local sur l'appareil). Dès que Supabase
est configuré et qu'un membre est connecté, elle bascule en **mode cloud**.

## 1. Créer le projet

1. Crée un compte sur https://supabase.com et un **nouveau projet** (gratuit).
2. Dans **SQL Editor**, colle le contenu de [`schema.sql`](./schema.sql) et exécute.
   Cela crée les tables, la sécurité (RLS), le temps réel et le bucket photos.
3. Dans **Project Settings ▸ API**, récupère :
   - **Project URL** (ex. `https://xxxx.supabase.co`)
   - **anon public key**

## 2. Connecter l'app

Deux possibilités :

**A. Depuis l'app** (le plus simple)
Réglages ▸ *Backend (multi-utilisateur)* → colle l'URL et la clé anon →
*Connecter le backend*. Puis crée un compte / connecte-toi.

**B. Par fichier de config** (déploiement)
Copie `js/config.example.js` en `js/config.js` et renseigne tes valeurs, puis
ajoute `<script src="./js/config.js"></script>` avant `backend.js` dans
`index.html`.

## 3. Ce qui devient temps réel

| Fonction | Table(s) | Réel |
|---|---|---|
| Comptes / pseudo | `auth.users`, `profiles` | ✅ |
| Feed (publications, photos) | `posts` (+ Storage `photos`) | ✅ live |
| Likes / commentaires | `likes`, `comments` | ✅ live |
| Enchères | `bids` + RPC `place_bid` | ✅ live |
| Chat membre à membre | `messages` | ✅ live |
| Boutiques + carte | `shops` | ✅ live |

La clé **anon** est conçue pour le client : la sécurité est assurée par les
**policies RLS** du `schema.sql` (chacun n'écrit que ses données ; l'enchère
passe par une fonction `security definer` qui valide le montant).

## Notifications push (téléphone fermé)

Le temps réel Supabase couvre l'app **ouverte**. Pour des **push** quand l'app
est fermée (iOS/Android), ajoute Web Push / FCM via le service worker + une
Edge Function Supabase déclenchée sur `bids`/`messages`. Hook prévu côté client
(`notify()` dans `app.js`).
