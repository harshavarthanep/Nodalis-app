/* =========================================================================
 * Nodalis — service worker
 * Cache-first for the app shell so it launches instantly and works with no
 * connection at all. Network-first for nothing, because nothing here needs
 * the network. A version bump replaces the whole cache atomically.
 * ========================================================================= */

const VERSION = 'nodalis-v2.0.1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/themes.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/views.css',
  './css/motion.css',
  './css/responsive.css',
  './js/core/util.js',
  './js/core/bus.js',
  './js/core/db.js',
  './js/core/serialize.js',
  './js/core/vault.js',
  './js/core/store.js',
  './js/ui/icons.js',
  './js/ui/toast.js',
  './js/ui/modal.js',
  './js/ui/menu.js',
  './js/ui/loader.js',
  './js/ui/theme.js',
  './js/ui/commands.js',
  './js/ui/shortcuts.js',
  './js/ui/palette.js',
  './js/features/markdown.js',
  './js/features/search.js',
  './js/features/sidebar.js',
  './js/features/editor.js',
  './js/features/panels.js',
  './js/features/graph.js',
  './js/features/canvas.js',
  './js/features/database.js',
  './js/features/tasks.js',
  './js/features/matrix.js',
  './js/features/sticky.js',
  './js/features/scratch.js',
  './js/features/daily.js',
  './js/features/ocr.js',
  './js/features/exporter.js',
  './js/features/settings.js',
  './js/features/onboarding.js',
  './js/features/help.js',
  './js/app.js',
  './vendor/jszip.min.js',
  './vendor/fonts/inter-latin-400-normal.woff2',
  './vendor/fonts/inter-latin-500-normal.woff2',
  './vendor/fonts/inter-latin-700-normal.woff2',
  './vendor/fonts/space-grotesk-latin-400-normal.woff2',
  './vendor/fonts/space-grotesk-latin-500-normal.woff2',
  './vendor/fonts/space-grotesk-latin-700-normal.woff2',
  './vendor/fonts/space-mono-latin-400-normal.woff2',
  './vendor/fonts/space-mono-latin-700-normal.woff2',
  './vendor/fonts/doto-latin-400-normal.woff2',
  './vendor/fonts/doto-latin-500-normal.woff2',
  './vendor/fonts/doto-latin-700-normal.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // addAll rejects entirely if one file 404s, which would leave the app
      // uncached forever. Add them individually and tolerate gaps instead.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function (err) {
          console.warn('[sw] could not cache', url, err);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== VERSION) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Third-party requests (only the optional OCR engine) go straight out,
    // and are cached opportunistically so the second scan works offline.
    event.respondWith(
      caches.match(request).then(function (hit) {
        if (hit) return hit;
        return fetch(request).then(function (response) {
          if (response && response.ok && /tesseract|tessdata/i.test(url.href)) {
            const copy = response.clone();
            caches.open(VERSION + '-ext').then(function (cache) { cache.put(request, copy); });
          }
          return response;
        }).catch(function () {
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Navigations always resolve to the shell so deep links work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(function (hit) {
        return hit || fetch(request).catch(function () {
          return new Response(
            '<!DOCTYPE html><meta charset="utf-8"><title>Nodalis is offline</title>' +
            '<body style="font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:0 auto;text-align:center">' +
            '<h1>Nodalis is not cached yet</h1>' +
            '<p>Load the app once while online and it will work offline from then on.</p></body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) {
        // Refresh in the background so the next load is current.
        fetch(request).then(function (response) {
          if (response && response.ok) {
            caches.open(VERSION).then(function (cache) { cache.put(request, response); });
          }
        }).catch(function () { /* offline; the cached copy is correct */ });
        return hit;
      }
      return fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
