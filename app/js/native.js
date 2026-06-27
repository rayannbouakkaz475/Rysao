/* ===========================================================================
   RYSAO TCG — Intégration native (Capacitor)
   Actif uniquement dans l'app empaquetée (iOS/Android). Dans un navigateur
   classique, window.Capacitor est absent -> ce fichier ne fait rien.
   - Push natif (APNs/FCM) : demande la permission, enregistre le token côté
     backend (table native_tokens) pour l'envoi par l'Edge Function.
   - Status bar, masquage du splash, bouton retour Android.
   =========================================================================== */
(function () {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const P = C.Plugins || {};

  function meName() {
    try { const p = JSON.parse(localStorage.getItem("rysao_profile") || "{}"); return (p.name || "").trim() || "Membre"; }
    catch { return "Membre"; }
  }

  async function saveNativeToken(token) {
    try {
      const platform = C.getPlatform ? C.getPlatform() : "unknown";
      localStorage.setItem("rysao_native_token", token);
      if (window.Backend && Backend.isCloud && Backend.isCloud()) {
        await Backend.client.from("native_tokens").upsert(
          { token, user_id: Backend.user().id, username: meName(), platform },
          { onConflict: "token" }
        );
      }
    } catch (_) {}
  }

  async function setupPush() {
    const Push = P.PushNotifications;
    if (!Push) return;
    try {
      let perm = await Push.checkPermissions();
      if (perm.receive !== "granted") perm = await Push.requestPermissions();
      if (perm.receive !== "granted") return;
      await Push.register();
      Push.addListener("registration", (t) => saveNativeToken(t.value));
      Push.addListener("registrationError", () => {});
      // tap sur une notification -> ouvrir l'onglet pertinent
      Push.addListener("pushNotificationActionPerformed", (a) => {
        const data = (a && a.notification && a.notification.data) || {};
        if (data.view && window.RYSAO_nav) window.RYSAO_nav(data.view);
      });
    } catch (_) {}
  }

  function setupChrome() {
    try { P.StatusBar && P.StatusBar.setStyle({ style: "DARK" }); } catch (_) {}
    try { P.StatusBar && P.StatusBar.setBackgroundColor({ color: "#0b1020" }); } catch (_) {}
    try { P.SplashScreen && P.SplashScreen.hide(); } catch (_) {}
    // bouton retour Android : quitte seulement depuis l'accueil
    try {
      P.App && P.App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back(); else P.App.exitApp();
      });
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", () => { setupChrome(); setupPush(); });
})();
