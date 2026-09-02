const CACHE = "rx-tasks-shell-v2";
const SHELL = ["/today", "/properties", "/calendar", "/profile", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.webmanifest"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/today"))));
});
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "RX Tasks", { body: data.body || "A task needs your attention.", icon: "/icon.svg", badge: "/icon.svg", tag: data.tag || "rx-task", data: { url: data.url || "/today" } }));
});
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => { const target = event.notification.data?.url || "/today"; for (const client of windows) { if ("focus" in client) { client.navigate(target); return client.focus(); } } return clients.openWindow(target); })); });
