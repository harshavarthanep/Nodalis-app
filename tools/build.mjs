/* =========================================================================
 * Nodalis — build script
 *
 *   node tools/build.mjs
 *
 * Produces a complete, deployable dist/ folder:
 *
 *   dist/index.html              the whole app in one file — styles, scripts,
 *                                fonts and icons all inlined. Opens straight
 *                                from file:// with no server.
 *   dist/manifest.webmanifest    so it installs as a real PWA
 *   dist/sw.js                   offline cache for the single file
 *   dist/icons/*                 favicon, apple-touch-icon, maskable icons
 *   dist/README.txt              how to deploy it
 *
 * The one HTML file covers both cases: opened directly it uses its inlined
 * data-URL favicon and ignores the missing manifest; served from the folder it
 * becomes a full installable offline app.
 *
 * The modular version is the source of truth; this is a pure concatenation,
 * so the two can never drift apart.
 * ========================================================================= */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readBin = (p) => readFileSync(join(ROOT, p));
const exists = (p) => existsSync(join(ROOT, p));

const log = (...args) => console.log('[build]', ...args);

/* ------------------------------------------------------------------ fonts */

const FONT_MIME = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function dataUrl(path) {
  const ext = path.slice(path.lastIndexOf('.'));
  const mime = FONT_MIME[ext] || (ext === '.svg' ? 'image/svg+xml' : (ext === '.png' ? 'image/png' : 'application/octet-stream'));
  const buf = readBin(path);
  if (ext === '.svg') {
    // SVG survives as UTF-8, which stays smaller and more readable than base64.
    const text = buf.toString('utf8').replace(/\s+/g, ' ').replace(/#/g, '%23').replace(/"/g, "'");
    return `data:image/svg+xml,${encodeURIComponent(text).replace(/%20/g, ' ')}`;
  }
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/** Rewrite url(...) references inside CSS to inline data URLs. */
function inlineCssUrls(css, cssPath) {
  return css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (match, url) => {
    if (/^(data:|https?:|#)/.test(url)) return match;
    const target = resolve(join(ROOT, dirname(cssPath)), url).replace(ROOT + '/', '');
    if (!exists(target)) {
      log('  ! missing asset referenced by CSS:', url);
      return match;
    }
    return `url("${dataUrl(target)}")`;
  });
}

/* ----------------------------------------------------------------- parse */

const html = read('index.html');

const cssFiles = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g)]
  .map((m) => m[1]);
const jsFiles = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/g)]
  .map((m) => m[1]);

log(`found ${cssFiles.length} stylesheets, ${jsFiles.length} scripts`);

/* ------------------------------------------------------------- assemble */

let totalCss = 0;
const css = cssFiles.map((file) => {
  const raw = read(file);
  totalCss += raw.length;
  return `/* ===== ${file} ===== */\n` + inlineCssUrls(raw, file);
}).join('\n\n');

let totalJs = 0;
const scripts = [];

// The zip library is loaded on demand in the modular build; inline it here so
// the single file can export a vault with no network at all.
if (exists('vendor/jszip.min.js')) {
  const jszip = read('vendor/jszip.min.js');
  totalJs += jszip.length;
  scripts.push('/* ===== vendor/jszip.min.js ===== */\n' + jszip);
}

jsFiles.forEach((file) => {
  if (!exists(file)) { log('  ! missing script:', file); return; }
  const raw = read(file);
  totalJs += raw.length;
  scripts.push(`/* ===== ${file} ===== */\n` + raw);
});

const js = scripts.join('\n\n');

/* --------------------------------------------------------------- rewrite */

let out = html;

// Drop the individual <link> and <script src> tags.
cssFiles.forEach((file) => {
  out = out.replace(new RegExp(`\\s*<link[^>]+href=["']${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'g'), '');
});
jsFiles.forEach((file) => {
  out = out.replace(new RegExp(`\\s*<script[^>]+src=["']${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*><\\/script>`, 'g'), '');
});

// Preload hints point at font files that no longer exist as siblings.
out = out.replace(/\s*<link[^>]+rel=["']preload["'][^>]*>/g, '');

/* Icons are handled twice over, on purpose:
   - an inlined data-URL favicon, so a lone file still has a tab icon
   - the original file references kept afterwards, so a browser serving the
     dist/ folder picks up the real PNGs for install and home-screen use
   The manifest link stays too. On file:// it is ignored with no visible error;
   from the folder it makes the app installable. */
const inlineFavicon = exists('icons/icon.svg')
  ? `<link rel="icon" href="${dataUrl('icons/icon.svg')}" type="image/svg+xml">`
  : '';
out = out.replace('<link rel="icon" href="icons/icon.svg" type="image/svg+xml">',
  () => inlineFavicon + '\n<link rel="icon" href="icons/icon.svg" type="image/svg+xml">');

// Comment marking where the single-file build differs, for anyone reading it.
const banner = [
  '<!--',
  '  Nodalis — single-file build',
  '',
  `  Generated ${new Date().toISOString().slice(0, 10)} from the modular source.`,
  '  Everything is inlined: styles, scripts, fonts and icons. Open this file',
  '  directly in a browser (no server needed) or drop it on any static host.',
  '',
  '  Deployed inside the dist/ folder (with manifest.webmanifest, sw.js and',
  '  icons/ beside it) this is a complete installable offline PWA.',
  '',
  '  Opened on its own from file:// it still works fully — it just cannot',
  '  register a service worker or be installed, because a lone file has no',
  '  sibling manifest to point at. Folder storage, all four themes, canvas,',
  '  graph, OCR and every export work identically either way.',
  '-->',
].join('\n');

out = out.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + banner);

// Mark the build so the app can adapt (it skips SW registration on file://
// already, but this makes the intent explicit).
out = out.replace('<body ', '<body data-build="single" ');

// Replacement *functions*, not strings: `$$`, `$&` and `$1` inside the
// inlined source would otherwise be interpreted as replacement patterns and
// silently mangle the code (this ate `$$` from the DOM helpers once already).
out = out.replace('</head>', () => `<style>\n${css}\n</style>\n</head>`);
out = out.replace('</body>', () => `<script>\n${js}\n</script>\n</body>`);

/* ----------------------------------------------------------------- write */

mkdirSync(join(ROOT, 'dist'), { recursive: true });
mkdirSync(join(ROOT, 'dist/icons'), { recursive: true });

const target = 'dist/index.html';
writeFileSync(join(ROOT, target), out, 'utf8');

/* --- icons ---------------------------------------------------------------- */
const ICONS = ['icon.svg', 'favicon-32.png', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
let copiedIcons = 0;
ICONS.forEach((name) => {
  const from = 'icons/' + name;
  if (!exists(from)) { log('  ! icon missing from source:', name); return; }
  copyFileSync(join(ROOT, from), join(ROOT, 'dist/icons', name));
  copiedIcons++;
});

/* --- manifest ------------------------------------------------------------- */
if (exists('manifest.webmanifest')) {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  manifest.name = manifest.name || 'Nodalis';
  manifest.start_url = './index.html';
  manifest.scope = './';
  // Shortcuts must resolve inside dist/, and this build has a single page.
  if (Array.isArray(manifest.shortcuts)) {
    manifest.shortcuts = manifest.shortcuts.map((s2) => Object.assign({}, s2, {
      url: './index.html' + (s2.url.includes('#') ? s2.url.slice(s2.url.indexOf('#')) : ''),
    }));
  }
  writeFileSync(join(ROOT, 'dist/manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/* --- service worker ------------------------------------------------------- */
const swVersion = 'nodalis-single-' + Date.now().toString(36);
const distSw = `/* =========================================================================
 * Nodalis — service worker for the single-file build.
 *
 * Generated by tools/build.mjs. There is only one page and a handful of icons,
 * so the whole app is precached on install and served cache-first afterwards.
 * ========================================================================= */

const VERSION = '${swVersion}';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
${ICONS.filter((n) => exists('icons/' + n)).map((n) => `  './icons/${n}',`).join('\n')}
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(SHELL.map((url) =>
        // One missing file must not leave the whole app uncached.
        cache.add(new Request(url, { cache: 'reload' }))
          .catch((err) => console.warn('[sw] could not cache', url, err))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === VERSION ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Any navigation resolves to the single page, so deep links work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(request).catch(() =>
        new Response(
          '<!DOCTYPE html><meta charset="utf-8"><title>Nodalis is offline</title>' +
          '<body style="font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:0 auto;text-align:center">' +
          '<h1>Not cached yet</h1><p>Load Nodalis once while online and it will work offline from then on.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      ))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Only the optional OCR engine is third-party. Cache it opportunistically
    // so the second scan works with no connection.
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response && response.ok && /tesseract|tessdata/i.test(url.href)) {
          const copy = response.clone();
          caches.open(VERSION + '-ext').then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => new Response('', { status: 504, statusText: 'Offline' })))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
`;
writeFileSync(join(ROOT, 'dist/sw.js'), distSw, 'utf8');

/* --- readme --------------------------------------------------------------- */
writeFileSync(join(ROOT, 'dist/README.txt'), [
  'Nodalis — single-file build',
  '===========================',
  '',
  'Two ways to use this folder.',
  '',
  '1. Just open it',
  '   Double-click index.html. That is the entire app — no server, no install,',
  '   no internet. Everything is inlined into that one file.',
  '',
  '2. Deploy the folder (recommended)',
  '   Upload all of dist/ to any static host — GitHub Pages, Netlify, S3, a',
  '   folder on your own server. Served over http(s) it becomes a full PWA:',
  '   installable, offline-cached, with a proper icon and app name.',
  '',
  '   For GitHub Pages, either publish this folder as the site root, or copy',
  '   its contents into your repository root and enable Pages on that branch.',
  '',
  'Files',
  '  index.html             the app (about ' + Math.round(statSync(join(ROOT, target)).size / 1024) + ' KB)',
  '  manifest.webmanifest   name, icons and install metadata',
  '  sw.js                  offline cache',
  '  icons/                 favicon, apple-touch-icon, 192px and 512px icons',
  '',
  'Where your notes go',
  '  On Chrome, Edge, Brave, Opera or Arc on a desktop, Nodalis asks for a',
  '  folder on first run and writes every change to plain .md files there.',
  '  Everywhere else it stores notes in the browser and tells you to export',
  '  a backup regularly — it will never claim to be backed up when it is not.',
  '',
  'A note on file:// mode',
  '  Opened directly, the browser will not register a service worker and will',
  '  not offer to install the app. Nothing else is affected. Deploy the folder',
  '  if you want those two things.',
  '',
  'Generated ' + new Date().toISOString().slice(0, 10) + ' from the modular source by tools/build.mjs.',
].join('\n') + '\n', 'utf8');

const size = statSync(join(ROOT, target)).size;
log(`css inlined: ${(totalCss / 1024).toFixed(0)} KB`);
log(`js inlined:  ${(totalJs / 1024).toFixed(0)} KB`);
log(`fonts inlined as data URLs`);
log(`wrote ${target} — ${(size / 1024).toFixed(0)} KB`);
log(`wrote dist/manifest.webmanifest, dist/sw.js, dist/README.txt and ${copiedIcons} icons`);

/* ---------------------------------------------------- sanity assertions */

const problems = [];
if (!/NODALIS/.test(out)) problems.push('the namespace is missing — scripts did not inline');
if (out.includes('src="js/')) problems.push('a script tag survived the rewrite');
if (out.includes('href="css/')) problems.push('a stylesheet link survived the rewrite');
if (!out.includes('@font-face')) problems.push('fonts did not inline');
if (out.includes("url('../vendor")) problems.push('a font url was not rewritten');
if (size < 200 * 1024) problems.push('output looks suspiciously small');
if (!out.includes('rel="manifest"')) problems.push('the manifest link was stripped — the PWA would not install');
if (!out.includes('data:image/svg+xml')) problems.push('no inline favicon — a lone file would have no icon');
if (!/--accent:\s*#/.test(out)) problems.push('no static accent colour — a stalled boot would render white-on-white');
['manifest.webmanifest', 'sw.js', 'README.txt', 'icons/icon-192.png', 'icons/favicon-32.png'].forEach((f) => {
  if (!existsSync(join(ROOT, 'dist', f))) problems.push('dist/' + f + ' was not written');
});

// Parse the inlined bundle for real, rather than trusting the concatenation.
try {
  const scriptStart = out.indexOf('<script>') + '<script>'.length;
  const scriptEnd = out.lastIndexOf('</script>');
  const bundle = out.slice(scriptStart, scriptEnd);
  new Function(bundle);
} catch (err) {
  problems.push('the inlined bundle does not parse: ' + err.message);
}

if (problems.length) {
  console.error('[build] FAILED sanity checks:');
  problems.forEach((p) => console.error('  -', p));
  process.exit(1);
}
log('sanity checks passed');
