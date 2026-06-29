/* ============================================================
   sw.js — Service worker: precache de l'app shell + offline
   ============================================================ */
const CACHE = "cambra-v23";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/db.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/i18n.js",
  "./js/theme.js",
  "./js/views/login.js",
  "./js/views/admin.js",
  "./js/views/board.js",
  "./js/views/room.js",
  "./js/views/incidents.js",
  "./js/views/setup.js",
  "./js/views/report.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Fonts de Google: cache-first (per a ús offline)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          cache.put(request, res.clone());
          return res;
        } catch { return hit || Response.error(); }
      })
    );
    return;
  }

  // Mateix origen: stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((res) => { if (res && res.status === 200) cache.put(request, res.clone()); return res; })
          .catch(() => hit);
        return hit || fetchPromise;
      })
    );
  }
});
