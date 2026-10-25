// Cazacartas: permite instalar la app y muestra la última versión guardada si no hay conexión.
// Las búsquedas (/api) nunca se guardan: los precios tienen que ser siempre los actuales.
const CACHE = "cazacartas-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && new URL(req.url).pathname === "/") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
        }
        return res;
      })
      .catch(() => caches.match("/").then((r) => r || Response.error()))
  );
});

// Avisos al celular: llega el aviso del servidor y se muestra la notificación
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Cazacartas", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "Cazacartas", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: d.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
