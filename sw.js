/**
 * sw.js — offline-first service worker for Nodalis.
 * Precaches the app shell so the whole app (including the editor, graph, canvas
 * and database views) works fully offline, then uses a stale-while-revalidate
 * strategy so updates are picked up in the background on the next load.
 */
const CACHE_VERSION = 'nodalis-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/themes.css',
  './css/customization.css',
  './css/motion.css',
  './css/responsive.css',
  './js/app.js',
  './js/db.js',
  './js/state.js',
  './js/markdown.js',
  './js/layout-manager.js',
  './js/context-menu.js',
  './js/sidebar.js',
  './js/editor.js',
  './js/preview.js',
  './js/backlinks.js',
  './js/graph.js',
  './js/canvas.js',
  './js/database-view.js',
  './js/command-palette.js',
  './js/templates.js',
  './js/daily-notes.js',
  './js/settings.js',
  './js/theme.js',
  './js/customization.js',
  './js/tour.js',
  './js/help.js',
  './js/auto-backup.js',
  './js/sync/github-sync.js',
  './js/sync/fs-sync.js',
  './js/sync/export-import.js',
  './vendor/jszip.min.js',
  './vendor/fonts/dotgothic16-latin-400-normal.woff2',
  './vendor/fonts/dotgothic16-latin-400-normal.woff',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // let cross-origin (e.g. GitHub API) pass through untouched

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req).then((res) => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
