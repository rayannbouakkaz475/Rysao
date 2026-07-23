// ============================================================
//  Stockage des abonnements push + état du poller live.
//
//  Backend automatique :
//   - Vercel KV si KV_REST_API_URL + KV_REST_API_TOKEN sont définis
//     (persistant, recommandé en production)
//   - sinon fichiers JSON locaux dans .data/ (pratique en dev ;
//     éphémère sur du serverless, à ne pas utiliser en prod)
//
//  Toutes les fonctions sont asynchrones.
// ============================================================

import fs from "fs";
import path from "path";

const SUBS_KEY = "onzia:subs";
const LIVE_KEY = "onzia:live-state";

const useKv = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

export function storeBackend() {
  return useKv ? "vercel-kv" : "file";
}

// --- Backend Vercel KV (import dynamique : dépendance optionnelle) ---
let _kv = null;
async function kv() {
  if (!_kv) ({ kv: _kv } = await import("@vercel/kv"));
  return _kv;
}

// --- Backend fichier ---
const DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
function fileRead(name, def) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
  } catch {
    return def;
  }
}
function fileWrite(name, data) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, name), JSON.stringify(data));
}

// --- Accès générique ---
async function load(key, fileName, def) {
  if (useKv) {
    const v = await (await kv()).get(key);
    return v ?? def;
  }
  return fileRead(fileName, def);
}
async function save(key, fileName, data) {
  if (useKv) {
    await (await kv()).set(key, data);
    return;
  }
  fileWrite(fileName, data);
}

// --- Abonnements push ---
// sub = { endpoint, keys:{p256dh, auth}, follows:[fixtureId...] }
export async function getSubscriptions() {
  return load(SUBS_KEY, "subs.json", []);
}

export async function saveSubscription(subscription) {
  const subs = await getSubscriptions();
  const existing = subs.find((s) => s.endpoint === subscription.endpoint);
  if (existing) {
    existing.keys = subscription.keys;
  } else {
    subs.push({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      follows: [],
    });
  }
  await save(SUBS_KEY, "subs.json", subs);
}

export async function removeSubscription(endpoint) {
  const subs = await getSubscriptions();
  await save(
    SUBS_KEY,
    "subs.json",
    subs.filter((s) => s.endpoint !== endpoint)
  );
}

// Ajoute/retire le suivi d'un match pour un abonnement
export async function setFollow(endpoint, fixtureId, follow) {
  const subs = await getSubscriptions();
  const sub = subs.find((s) => s.endpoint === endpoint);
  if (!sub) return false;
  sub.follows = sub.follows || [];
  const has = sub.follows.includes(fixtureId);
  if (follow && !has) sub.follows.push(fixtureId);
  if (!follow && has) sub.follows = sub.follows.filter((f) => f !== fixtureId);
  await save(SUBS_KEY, "subs.json", subs);
  return true;
}

export async function followersOf(fixtureId) {
  const subs = await getSubscriptions();
  return subs.filter((s) => (s.follows || []).includes(fixtureId));
}

// --- État du poller live (événements déjà notifiés par match) ---
export async function getLiveState() {
  return load(LIVE_KEY, "live-state.json", { fixtures: {} });
}
export async function setLiveState(state) {
  await save(LIVE_KEY, "live-state.json", state);
}
