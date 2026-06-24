"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// iOS impose l'ajout à l'écran d'accueil avant d'autoriser le push
function isIosNotStandalone() {
  if (typeof window === "undefined") return false;
  const iOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const standalone =
    window.navigator.standalone ||
    window.matchMedia?.("(display-mode: standalone)").matches;
  return iOS && !standalone;
}

export default function NotifyButton({ fixtureId }) {
  const [supported, setSupported] = useState(true);
  const [iosHint, setIosHint] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    setIosHint(isIosNotStandalone());
  }, []);

  async function follow() {
    setBusy(true);
    setMsg("");
    try {
      // 1. Service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 2. Permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications refusées dans le navigateur.");
        setBusy(false);
        return;
      }

      // 3. Clé publique VAPID
      const conf = await fetch("/api/push/subscribe").then((r) => r.json());
      if (!conf.enabled || !conf.publicKey) {
        setMsg("Notifications non configurées côté serveur (clés VAPID).");
        setBusy(false);
        return;
      }

      // 4. Abonnement push
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(conf.publicKey),
        });
      }
      const subJson = sub.toJSON();

      // 5. Enregistre l'abonnement puis suit le match
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subJson }),
      });
      await fetch("/api/push/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          fixtureId,
          follow: true,
        }),
      });

      setFollowing(true);
      setMsg("Tu recevras les buts, cartons et le coup d'envoi de ce match.");
    } catch (e) {
      setMsg("Erreur : " + (e?.message || "abonnement impossible"));
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="muted-line">
        🔔 Les notifications ne sont pas supportées par ce navigateur.
      </p>
    );
  }

  return (
    <div className="notify-box">
      {iosHint && (
        <p className="notify-ios">
          📱 Sur iPhone : appuie sur <b>Partager</b> → <b>Sur l&apos;écran
          d&apos;accueil</b>, puis rouvre Rysao depuis l&apos;icône pour activer
          les notifications (verrouillage compris).
        </p>
      )}
      <button className="btn notify-btn" onClick={follow} disabled={busy || following}>
        {following ? "🔔 Match suivi" : busy ? "…" : "🔔 Suivre ce match"}
      </button>
      {msg && <p className="muted-line">{msg}</p>}
    </div>
  );
}
