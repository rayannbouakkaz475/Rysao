// ============================================================
//  Envoi de notifications Web Push (VAPID)
// ============================================================

import webpush from "web-push";
import { removeSubscription } from "./store";

let configured = false;

export function hasPush() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureConfigured() {
  if (configured) return;
  if (!hasPush()) throw new Error("Clés VAPID manquantes");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@onzia.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

export async function sendPush(sub, payload) {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload)
    );
    return true;
  } catch (e) {
    // 404/410 : abonnement expiré -> on le supprime
    if (e.statusCode === 404 || e.statusCode === 410) {
      await removeSubscription(sub.endpoint);
    } else {
      console.error("push error:", e.statusCode, e.message);
    }
    return false;
  }
}

export async function broadcast(subs, payload) {
  ensureConfigured();
  const results = await Promise.all(subs.map((s) => sendPush(s, payload)));
  return results.filter(Boolean).length;
}
