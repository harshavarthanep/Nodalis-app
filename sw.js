/* ZenDocs service worker — v5
   v5: the shell now includes the split css/ and js/ files (the app used
   to ship as one big index.html; it's now index.html + css/styles.css +
   js/*.js). Bumped from v4 so returning visitors pick up the new shell
   instead of continuing to serve a stale single-file cache. */
const CACHE = 'zendocs-shell-v5';
const SHELL = [
    './', './index.html', './manifest.json', './icon-192.png',
    './css/styles.css',
    './js/01-core-firebase-editor.js',
    './js/02-tags-graph-daily-planner.js',
    './js/03-media-status-home-focus-pwa.js',
    './js/04-eisenhower-downloads-patch1.js',
    './js/05-production-patches-2.js',
    './js/06-auth-header-guest.js',
    './js/07-locked-notes-capture-stats.js',
    './js/08-header-fixes-connections.js',
    './js/09-notes-qa-timeline-voice-trackers.js',
    './js/10-trackers-companion-consequence.js',
    './js/11-transitions-review-shortcuts-meeting.js',
    './js/12-weather-alerts-init.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return; /* never intercept Firebase/CDNs */
    e.respondWith(
        fetch(e.request).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
            return res;
        }).catch(() =>
            caches.match(e.request).then(m => m || caches.match('./index.html'))
        )
    );
});

/* Snooze / Open buttons on reminder notifications */
self.addEventListener('notificationclick', (e) => {
    const tag = e.notification.tag || '';
    e.notification.close();
    e.waitUntil((async () => {
        const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (e.action === 'snooze') {
            if (cs.length) cs[0].postMessage({ type: 'zd-snooze', tag });
            return;
        }
        if (cs.length) { cs[0].focus(); cs[0].postMessage({ type: 'zd-open', tag }); }
        else self.clients.openWindow('./');
    })());
});
