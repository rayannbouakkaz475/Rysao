# RYSAO TCG — Empaquetage natif (Capacitor)

Transforme la PWA `../app` en applications **iOS** et **Android** publiables sur
l'**App Store** et le **Play Store**, avec **push natif** (APNs / FCM).

La PWA reste la source unique : ce dossier ne fait que l'emballer. `copy:web`
copie `../app` (hors `backend/` et exemples) dans `www/`, que Capacitor
embarque dans les projets natifs.

## Prérequis

- **Node 18+**
- **iOS** : macOS + Xcode + CocoaPods (`sudo gem install cocoapods`)
- **Android** : Android Studio + JDK 17

## Mise en route

```bash
cd mobile
npm install
npm run add:ios       # crée le projet ios/  (macOS)
npm run add:android   # crée le projet android/
```

`add:*` lance d'abord `copy:web` (remplit `www/`) puis `cap add`.

### Lancer / ouvrir

```bash
npm run open:ios       # ouvre Xcode
npm run open:android   # ouvre Android Studio
# ou directement sur un appareil/simulateur :
npm run run:ios
npm run run:android
```

Après **toute modification** de la PWA, resynchroniser :

```bash
npm run sync           # copy:web + cap sync
```

## Identité de l'app

- `appId` : `app.rysao.tcg` — `appName` : `RYSAO TCG` (voir `capacitor.config.json`).
- Couleur de fond / splash : `#0b1020`.
- Icônes & splash : place tes visuels puis génère-les avec
  [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets)
  (`npx @capacitor/assets generate`).

## Push natif (APNs / FCM)

Le code client est prêt (`../app/js/native.js`) : il demande la permission,
appelle `PushNotifications.register()` et enregistre le **token** dans la table
`native_tokens` (voir `../app/backend/push.sql`). Côté serveur :

- **Android (FCM)** : crée un projet Firebase, ajoute `google-services.json`
  dans `android/app/`, et envoie via l'API **FCM HTTP v1** depuis l'Edge
  Function (à partir des lignes `native_tokens` de plateforme `android`).
- **iOS (APNs)** : active *Push Notifications* + *Background Modes* dans Xcode,
  configure une **clé APNs** (.p8) ; envoie via APNs HTTP/2 (ou via FCM iOS).

> L'Edge Function `push` (`../app/backend/functions/push/`) gère déjà l'envoi
> **Web Push** (navigateur/PWA). Pour le natif, ajoute-lui l'envoi FCM/APNs en
> lisant `native_tokens` — c'est la seule pièce serveur restante, car elle
> dépend de tes comptes Firebase/Apple Developer.

## Publication

- **iOS** : Xcode ▸ *Product ▸ Archive* ▸ *Distribute App* → App Store Connect
  (compte **Apple Developer**, 99 $/an).
- **Android** : Android Studio ▸ *Build ▸ Generate Signed Bundle (.aab)* →
  Play Console (compte développeur Google, 25 $ une fois).

## Note iOS / PWA

Sur iOS, le **push web** n'est possible que pour une PWA installée à l'écran
d'accueil. L'app **native Capacitor** lève cette limite : push fiable via APNs.
