# Rysao Cards — boutique de cartes

Site 100 % statique (HTML, CSS, JS) : aucun serveur ni base de données.
Le catalogue est dans `produits.js` et le panier est gardé dans le navigateur du visiteur.

## Mise en ligne (tient la charge)

Le service `rysao-cards` du `render.yaml` publie ce dossier comme **site statique Render**,
servi par leur CDN : pas de mise en veille, et chaque visiteur télécharge environ 20 Ko
(compressé) puis tout se passe dans son navigateur.

1. Sur render.com : **New → Blueprint**, choisir ce dépôt (ou **Sync** si le Blueprint existe déjà).
2. Render crée le service `rysao-cards` et donne une adresse `https://rysao-cards.onrender.com`.

N'importe quel hébergeur statique avec CDN convient aussi (Cloudflare Pages, Netlify,
GitHub Pages) : il suffit de publier le dossier `boutique-tcg`.

À éviter : servir la boutique depuis le service Docker `rysao-studio` (plan gratuit,
une seule petite machine qui se met en veille).

## Test de charge

800 connexions simultanées pendant 15 s sur un simple serveur statique Node :
environ 145 000 requêtes, 0 erreur, latence p99 de 148 ms. Un CDN fait nettement mieux.

## Quand le paiement sera ajouté

Le bouton « Passer commande » n'est pas encore branché. Pour les ventes, et surtout les
précommandes à stock limité, il faudra un vrai système qui réserve le stock côté serveur
(Shopify, Stripe Checkout, WooCommerce…). Sinon, si 800 personnes achètent en même temps
un coffret dont il reste 4 exemplaires, il sera vendu plusieurs fois.
