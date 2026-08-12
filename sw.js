/* ZenDocz — service worker.
   Goal: after the first successful load, the ENTIRE app (including the
   third-party editor/auth SDK scripts) is cached, so Local mode truly
   works with the network off, not just "mostly". Cloud mode also benefits
   — the app shell loads instantly offline, and Firestore's own offline
   persistence (enabled in cloud-firebase-adapter.js) takes it from there
   for data. Bump CACHE_NAME whenever you ship a new build so old assets
   don't linger. */
const CACHE_NAME = "zendocz-shell-v1";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "https://cdn.quilljs.com/1.3.6/quill.snow.css",
  "https://cdn.quilljs.com/1.3.6/quill.min.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => console.warn("[ZenDocz SW] failed to precache", url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigations: try the network for a fresh shell, fall back to cache so
  // a page reload while offline still opens the app.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else (CSS/JS/icons/fonts/CDN libs): cache-first, refresh in
  // the background when online so updates still arrive eventually.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
