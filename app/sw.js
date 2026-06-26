/* RYSAO TCG — service worker (cache app-shell, hors-ligne, push) */
const CACHE = "rysao-tcg-v4";
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='42' fill='%230b1020'/%3E%3Ctext x='96' y='128' font-family='Arial' font-weight='bold' font-size='100' fill='%2300e0c6' text-anchor='middle'%3ER%3C/text%3E%3C/svg%3E";
const ASSETS = [
  "./", "./index.html", "./css/styles.css",
  "./js/i18n.js", "./js/data.js", "./js/providers.js", "./js/backend.js", "./js/engine.js", "./js/scanner.js", "./js/app.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});

/* ---------- Push notifications (téléphone fermé) ---------- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || "RYSAO TCG";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: d.icon || ICON,
    badge: ICON,
    tag: d.tag,
    data: { url: d.url || "./index.html" },
    vibrate: [80, 40, 80],
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./index.html";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((cl) => {
    for (const c of cl) { if ("focus" in c) { try { c.navigate(url); } catch {} return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
