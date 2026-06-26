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

Le temps réel Supabase couvre l'app **ouverte**. Le **push** (app fermée) est
implémenté via **Web Push** (service worker `sw.js`) + une **Edge Function**
`push` déclenchée sur `bids` (nouvelle enchère → propriétaire du post) et
`messages` (nouveau message → destinataire).

### Mise en place

1. **Clés VAPID** :
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Table + triggers** : exécute [`push.sql`](./push.sql) dans le SQL Editor
   (renseigne `fn_url` = URL de ta fonction et un `shared` secret).
3. **Déploie la fonction** ([`functions/push/index.ts`](./functions/push/index.ts)) :
   ```bash
   supabase functions deploy push --no-verify-jwt
   supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... PUSH_SHARED_SECRET=... \
     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
   ```
   (Alternative au trigger SQL : Dashboard ▸ Database ▸ **Webhooks** → POST vers
   la fonction `push` sur INSERT de `bids` et `messages`.)
4. **Côté app** : Réglages ▸ Notifications → colle la **clé publique VAPID** →
   *Activer*. L'abonnement est enregistré dans `push_subscriptions` (membre
   connecté requis). iOS : l'app doit être **installée sur l'écran d'accueil**
   pour autoriser le push.

### Flux

```
enchère/message inséré → trigger notify_push (pg_net) → Edge Function push
→ lookup destinataire → web-push vers ses abonnements → notification système
→ clic → ouvre l'app
```
