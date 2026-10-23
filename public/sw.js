// Cazacartas: permite instalar la app y muestra la última versión guardada si no hay conexión.
// Las búsquedas (/api) nunca se guardan: los precios tienen que ser siempre los actuales.
const CACHE = "cazacartas-v1";

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
