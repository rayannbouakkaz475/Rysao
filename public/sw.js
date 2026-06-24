/* Service Worker Rysao — réception des notifications push */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Rysao", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Rysao";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge.png",
    vibrate: [80, 40, 80],
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if ("focus" in c) return c.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
