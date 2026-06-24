// ============================================================
//  Stockage simple (abonnements push + état du poller live)
//  Fichiers JSON locaux. En production sur Vercel, remplacer par
//  un store persistant (Vercel KV / Redis / base de données) car
//  le système de fichiers serverless est éphémère.
// ============================================================

import fs from "fs";
import path from "path";

const DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");

function file(name) {
  return path.join(DIR, name);
}
function read(name, def) {
  try {
    return JSON.parse(fs.readFileSync(file(name), "utf8"));
  } catch {
    return def;
  }
}
function write(name, data) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file(name), JSON.stringify(data));
}

// --- Abonnements push ---
// sub = { endpoint, keys:{p256dh, auth}, follows:[fixtureId...] }
export function getSubscriptions() {
  return read("subs.json", []);
}

export function saveSubscription(subscription) {
  const subs = getSubscriptions();
  const existing = subs.find((s) => s.endpoint === subscription.endpoint);
  if (existing) {
    existing.keys = subscription.keys;
  } else {
    subs.push({ ...subscription, follows: [] });
  }
  write("subs.json", subs);
}

export function removeSubscription(endpoint) {
  write(
    "subs.json",
    getSubscriptions().filter((s) => s.endpoint !== endpoint)
  );
}

// Ajoute/retire le suivi d'un match pour un abonnement
export function setFollow(endpoint, fixtureId, follow) {
  const subs = getSubscriptions();
  const sub = subs.find((s) => s.endpoint === endpoint);
  if (!sub) return false;
  sub.follows = sub.follows || [];
  const has = sub.follows.includes(fixtureId);
  if (follow && !has) sub.follows.push(fixtureId);
  if (!follow && has) sub.follows = sub.follows.filter((f) => f !== fixtureId);
  write("subs.json", subs);
  return true;
}

export function followersOf(fixtureId) {
  return getSubscriptions().filter((s) => (s.follows || []).includes(fixtureId));
}

// --- État du poller live (événements déjà notifiés par match) ---
export function getLiveState() {
  return read("live-state.json", { fixtures: {} });
}
export function setLiveState(state) {
  write("live-state.json", state);
}
