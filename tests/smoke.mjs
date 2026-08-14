/* =========================================================================
 * Nodalis — smoke and regression tests
 *
 *   node tests/smoke.mjs            test the modular build
 *   node tests/smoke.mjs --single   test dist/nodalis.html instead
 *
 * Runs every view at three viewports, exercises the real features, and
 * fails on any console error. Screenshots land in tests/shots/.
 * ========================================================================= */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SINGLE = process.argv.includes('--single');
const SHOTS = join(ROOT, 'tests', 'shots');
const CHROME = '/opt/pw-browsers/chromium';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

let passed = 0, failed = 0;
const failures = [];

function ok(name) { passed++; console.log('  ✓ ' + name); }
function bad(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log('  ✗ ' + name + (detail ? '\n      ' + String(detail).split('\n')[0] : ''));
}

async function check(name, fn) {
  try {
    const result = await fn();
    if (result === false) bad(name, 'assertion returned false');
    else ok(name);
  } catch (err) {
    bad(name, err && err.message ? err.message : String(err));
  }
}

/* ------------------------------------------------------------- static server */

function startServer(port) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === '/') path = SINGLE ? '/dist/index.html' : '/index.html';
      let file = join(ROOT, path);
      // The single-file build ships its own manifest, sw and icons in dist/.
      if (SINGLE && !existsSync(file)) {
        const inDist = join(ROOT, 'dist', path);
        if (existsSync(inDist)) file = inDist;
      }
      if (!file.startsWith(ROOT) || !existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

/* ---------------------------------------------------------------- helpers */

function attachConsole(page, sink) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push(msg.text());
  });
  page.on('pageerror', (err) => sink.push('PAGEERROR: ' + err.message));
}

async function bootApp(browser, viewport, opts = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: !!opts.touch,
    isMobile: !!opts.touch,
    permissions: [],
  });
  const page = await context.newPage();
  const errors = [];
  attachConsole(page, errors);
  await page.goto('http://127.0.0.1:8974/', { waitUntil: 'domcontentloaded' });
  // Skip the intro animation and any first-run dialog.
  await page.waitForFunction(() => window.NODALIS && window.NODALIS.store, null, { timeout: 15000 });
  await page.evaluate(async () => {
    if (window.NODALIS.loader) await window.NODALIS.loader.finish(true);
  });
  // The storage chooser is the one blocking dialog on a fresh profile. Wait for
  // it properly rather than guessing at a timeout, or the scrim stays up and
  // every later click is intercepted.
  const firstRun = await page.evaluate(() => !window.NODALIS.store.state.settings.firstRunComplete);
  if (firstRun) {
    try {
      await page.waitForSelector('.onboard-choice', { timeout: 8000 });
      await page.locator('.onboard-choice', { hasText: 'this device' }).first().click();
    } catch (err) {
      // Already past onboarding, or it never opened — force the flag and move on.
      await page.evaluate(() => window.NODALIS.store.setSetting('firstRunComplete', true));
    }
  }
  await page.waitForFunction(
    () => window.NODALIS.store.state.settings.firstRunComplete && window.NODALIS.store.state.notes.size > 0,
    null, { timeout: 12000 }).catch(() => {});
  await page.evaluate(async () => {
    if (window.NODALIS.help) window.NODALIS.help.closeTour();
    while (window.NODALIS.modal.anyOpen()) window.NODALIS.modal.closeTop();
    if (window.NODALIS.palette.isOpen()) window.NODALIS.palette.close();
  });
  // Nothing should be left covering the page.
  await page.waitForFunction(() => {
    const scrim = document.getElementById('scrim');
    return !scrim || !scrim.classList.contains('is-open');
  }, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  return { context, page, errors };
}

/* -------------------------------------------------------------------- run */

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const server = await startServer(8974);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  console.log('\nNodalis test run — ' + (SINGLE ? 'single-file build' : 'modular build') + '\n');

  /* ================================================== 1. desktop boot === */
  console.log('Desktop (1440x900)');
  {
    const { context, page, errors } = await bootApp(browser, { width: 1440, height: 900 });

    await check('app shell renders', async () => {
      return await page.locator('#app').isVisible();
    });

    await check('no emoji anywhere in the rendered DOM', async () => {
      const found = await page.evaluate(() => {
        const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(n) {
            // Inlined source in the single-file build is not user-facing text.
            const tag = n.parentElement && n.parentElement.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        const hits = [];
        let node;
        while ((node = walker.nextNode())) {
          if (re.test(node.nodeValue)) hits.push(node.nodeValue.trim().slice(0, 40));
        }
        return hits;
      });
      if (found.length) throw new Error('emoji found: ' + JSON.stringify(found.slice(0, 5)));
      return true;
    });

    await check('icons hydrated to inline SVG', async () => {
      const unhydrated = await page.locator('[data-icon]:not([data-icon-done])').count();
      if (unhydrated > 0) throw new Error(unhydrated + ' placeholders left unhydrated');
      const svgs = await page.locator('svg.icon').count();
      if (svgs < 10) throw new Error('only ' + svgs + ' icons rendered');
      return true;
    });

    await check('welcome vault seeded', async () => {
      const count = await page.evaluate(() => window.NODALIS.store.state.notes.size);
      if (count < 1) throw new Error('no notes seeded');
      return true;
    });

    await check('a note opens and renders markdown', async () => {
      await page.evaluate(() => {
        const first = window.NODALIS.store.allNotes()[0];
        window.NODALIS.app.openNote(first.id);
      });
      await page.waitForTimeout(400);
      const html = await page.locator('#note-preview').innerHTML();
      if (!html || html.length < 40) throw new Error('preview did not render');
      return true;
    });

    await check('typing saves and re-renders', async () => {
      await page.evaluate(() => window.NODALIS.app.createNoteIn(''));
      await page.waitForTimeout(300);
      await page.locator('#note-editor').fill('# Test heading\n\nSome **bold** text and a [[link]] and a #tag.');
      await page.waitForTimeout(700);
      const preview = await page.locator('#note-preview').innerHTML();
      if (!preview.includes('<strong>bold</strong>')) throw new Error('bold not rendered');
      if (!preview.includes('wikilink')) throw new Error('wikilink not rendered');
      if (!preview.includes('tag-inline')) throw new Error('tag not rendered');
      const saved = await page.evaluate(() => {
        const id = window.NODALIS.store.state.activeNoteId;
        return window.NODALIS.store.getNote(id).content;
      });
      if (!saved.includes('Test heading')) throw new Error('content not persisted to the store');
      return true;
    });

    await check('command palette opens and finds commands', async () => {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(300);
      if (!(await page.locator('.palette').isVisible())) throw new Error('palette did not open');
      await page.locator('.palette-input').fill('graph');
      await page.waitForTimeout(250);
      const count = await page.locator('.palette-item').count();
      if (count === 0) throw new Error('no results for "graph"');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      return true;
    });

    await check('every view opens without error', async () => {
      const views = ['graph', 'canvas', 'database', 'tasks', 'matrix', 'sticky', 'scratch', 'review', 'search', 'settings', 'editor'];
      for (const view of views) {
        await page.evaluate((v) => window.NODALIS.app.setView(v), view);
        await page.waitForTimeout(360);
        const visible = await page.locator('#view-' + view).isVisible();
        if (!visible) throw new Error(view + ' did not become visible');
      }
      return true;
    });

    await check('graph draws nodes', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('graph'));
      await page.waitForTimeout(900);
      const painted = await page.evaluate(() => {
        const c = document.getElementById('graph-canvas');
        if (!c || !c.width) return false;
        const ctx = c.getContext('2d');
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < data.length; i += 40) if (data[i] > 0) return true;
        return false;
      });
      if (!painted) throw new Error('graph canvas is blank');
      return true;
    });

    await check('canvas creates and moves an item', async () => {
      await page.evaluate(async () => {
        window.NODALIS.app.setView('canvas');
        await new Promise((r) => setTimeout(r, 200));
        if (!window.NODALIS.canvas.current()) await window.NODALIS.canvas.createCanvas('Test canvas');
      });
      await page.waitForTimeout(500);
      await page.locator('#canvas-toolbar [data-add="sticky"]').click();
      await page.waitForTimeout(400);
      const items = await page.locator('.canvas-item').count();
      if (items < 1) throw new Error('sticky was not added to the canvas');
      return true;
    });

    await check('sticky wall creates a note', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('sticky'));
      await page.waitForTimeout(300);
      await page.locator('#sticky-new').click();
      await page.waitForTimeout(500);
      const count = await page.locator('.sticky-note').count();
      if (count < 1) throw new Error('no sticky rendered');
      return true;
    });

    await check('tasks aggregate from note content', async () => {
      await page.evaluate(async () => {
        const note = await window.NODALIS.store.createNote({ title: 'Task source', content: '- [ ] alpha task\n- [x] beta done\n- [ ] gamma !1 due:2020-01-01' });
        window.NODALIS.app.openNote(note.id);
      });
      await page.waitForTimeout(400);
      const stats = await page.evaluate(() => {
        const all = window.NODALIS.tasks.collect();
        return {
          total: all.length,
          open: all.filter((t) => !t.done).length,
          overdue: all.filter((t) => t.due && t.due < window.NODALIS.util.todayKey() && !t.done).length,
        };
      });
      if (stats.total < 3) throw new Error('expected at least 3 tasks, got ' + stats.total);
      if (stats.overdue < 1) throw new Error('overdue task not detected');
      return true;
    });

    await check('matrix places tasks into quadrants', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('matrix'));
      await page.waitForTimeout(500);
      const quads = await page.locator('.matrix-quad').count();
      if (quads !== 4) throw new Error('expected 4 quadrants, got ' + quads);
      const cards = await page.locator('.matrix-card').count();
      if (cards < 1) throw new Error('no task cards in the matrix');
      return true;
    });

    await check('search finds text with operators', async () => {
      const results = await page.evaluate(() => {
        const r = window.NODALIS.search.search('alpha');
        const tagged = window.NODALIS.search.search('tag:guide');
        return { plain: r.hits.length, tagged: tagged.hits.length };
      });
      if (results.plain < 1) throw new Error('plain search found nothing');
      if (results.tagged < 1) throw new Error('tag: operator found nothing');
      return true;
    });

    await check('database view renders a table', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('database'));
      await page.waitForTimeout(600);
      const rows = await page.locator('.db-table tbody tr').count();
      if (rows < 1) throw new Error('no rows in the table');
      return true;
    });

    await check('all four themes apply cleanly', async () => {
      for (const style of ['nodalis', 'notion', 'nothing', 'glass']) {
        await page.evaluate((s) => window.NODALIS.theme.setStyle(s), style);
        await page.waitForTimeout(320);
        const applied = await page.evaluate(() => ({
          style: document.body.dataset.style,
          bg: getComputedStyle(document.body).backgroundColor,
          text: getComputedStyle(document.body).color,
        }));
        if (applied.style !== style) throw new Error(style + ' was not applied');
        if (applied.bg === applied.text) throw new Error(style + ' has identical background and text colour');
      }
      await page.evaluate(() => window.NODALIS.theme.setStyle('nodalis'));
      await page.waitForTimeout(250);
      return true;
    });

    await check('font switching actually changes the rendered font', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('editor'));
      await page.waitForTimeout(200);
      const before = await page.evaluate(() => getComputedStyle(document.getElementById('note-editor')).fontFamily);
      await page.evaluate(() => window.NODALIS.theme.set('editorFont', 'mono'));
      await page.waitForTimeout(300);
      const afterEditor = await page.evaluate(() => getComputedStyle(document.getElementById('note-editor')).fontFamily);
      const afterPreview = await page.evaluate(() => getComputedStyle(document.getElementById('note-preview')).fontFamily);
      if (before === afterEditor) throw new Error('editor font did not change');
      if (!/Space Mono/i.test(afterEditor)) throw new Error('editor font is not mono: ' + afterEditor);
      if (!/Space Mono/i.test(afterPreview)) throw new Error('preview font did not follow: ' + afterPreview);

      // UI font must move independently, and reach portal elements too.
      await page.evaluate(() => window.NODALIS.theme.set('uiFont', 'grotesk'));
      await page.waitForTimeout(300);
      const uiFont = await page.evaluate(() => getComputedStyle(document.querySelector('.brand-name')).fontFamily);
      if (!/Space Grotesk/i.test(uiFont)) throw new Error('UI font did not change: ' + uiFont);
      await page.evaluate(() => {
        window.NODALIS.theme.set('editorFont', 'sans');
        window.NODALIS.theme.set('uiFont', 'default');
      });
      await page.waitForTimeout(250);
      return true;
    });

    await check('text size and line height apply live', async () => {
      await page.evaluate(() => window.NODALIS.theme.set('fontSize', 22));
      await page.waitForTimeout(250);
      const size = await page.evaluate(() => getComputedStyle(document.getElementById('note-editor')).fontSize);
      if (parseFloat(size) < 21) throw new Error('font size did not apply: ' + size);
      await page.evaluate(() => window.NODALIS.theme.set('fontSize', 16));
      await page.waitForTimeout(200);
      return true;
    });

    await check('shortcuts can be rebound and take effect', async () => {
      const result = await page.evaluate(async () => {
        await window.NODALIS.shortcuts.rebind('view.sidebar', 'Mod+Shift+9');
        const accel = window.NODALIS.shortcuts.accelFor('view.sidebar');
        const conflict = window.NODALIS.shortcuts.conflictFor('Mod+K', 'view.sidebar');
        await window.NODALIS.shortcuts.resetBinding('view.sidebar');
        return { accel, conflict, restored: window.NODALIS.shortcuts.accelFor('view.sidebar') };
      });
      if (result.accel !== 'mod+shift+9') throw new Error('rebind did not stick: ' + result.accel);
      if (result.conflict !== 'palette.open') throw new Error('conflict detection failed: ' + result.conflict);
      if (result.restored !== 'Mod+B') throw new Error('reset did not restore the default');
      return true;
    });

    await check('every command has a runnable definition', async () => {
      const broken = await page.evaluate(() => {
        return window.NODALIS.commands.all()
          .filter((c) => typeof c.run !== 'function' || !c.title || !c.group)
          .map((c) => c.id);
      });
      if (broken.length) throw new Error('malformed commands: ' + broken.join(', '));
      const count = await page.evaluate(() => window.NODALIS.commands.all().length);
      if (count < 60) throw new Error('only ' + count + ' commands registered');
      return true;
    });

    await check('no duplicate keyboard bindings', async () => {
      const dupes = await page.evaluate(() => {
        const seen = new Map();
        const out = [];
        window.NODALIS.commands.all().forEach((c) => {
          const accel = window.NODALIS.shortcuts.accelFor(c.id);
          if (!accel) return;
          const key = window.NODALIS.shortcuts.normalize(accel);
          if (seen.has(key)) out.push(key + ' -> ' + seen.get(key) + ' & ' + c.id);
          else seen.set(key, c.id);
        });
        return out;
      });
      if (dupes.length) throw new Error(dupes.join('; '));
      return true;
    });

    await check('undo restores a deleted note', async () => {
      const result = await page.evaluate(async () => {
        const note = await window.NODALIS.store.createNote({ title: 'Doomed note', content: 'temporary' });
        const before = window.NODALIS.store.state.notes.size;
        await window.NODALIS.store.deleteNote(note.id);
        const after = window.NODALIS.store.state.notes.size;
        await window.NODALIS.store.undo();
        const restored = window.NODALIS.store.state.notes.size;
        return { before, after, restored, exists: !!window.NODALIS.store.getNote(note.id) };
      });
      if (result.after !== result.before - 1) throw new Error('delete did not remove the note');
      if (result.restored !== result.before) throw new Error('undo did not restore it');
      if (!result.exists) throw new Error('restored note is missing from the store');
      return true;
    });

    await check('renaming a note rewrites links elsewhere', async () => {
      const result = await page.evaluate(async () => {
        const target = await window.NODALIS.store.createNote({ title: 'Rename target', content: 'body' });
        const linker = await window.NODALIS.store.createNote({ title: 'Linker', content: 'See [[Rename target]] please.' });
        await window.NODALIS.store.renameNote(target.id, 'Renamed thing');
        return window.NODALIS.store.getNote(linker.id).content;
      });
      if (!result.includes('[[Renamed thing]]')) throw new Error('link was not rewritten: ' + result);
      return true;
    });

    await check('markdown handles tables, callouts, tasks and code', async () => {
      const html = await page.evaluate(() => window.NODALIS.markdown.render([
        '| a | b |', '| --- | --- |', '| 1 | 2 |', '',
        '> [!warning] Careful', '> body text', '',
        '- [ ] open', '- [x] done', '',
        '```js', 'const x = 1;', '```', '',
        'A [^1] footnote.', '', '[^1]: the note',
      ].join('\n')));
      const need = ['<table>', 'callout', 'task-item', 'tok-keyword', 'footnote'];
      const missing = need.filter((n) => !html.includes(n));
      if (missing.length) throw new Error('missing: ' + missing.join(', '));
      return true;
    });

    await check('markdown escapes injected HTML', async () => {
      const html = await page.evaluate(() =>
        window.NODALIS.markdown.render('<img src=x onerror="alert(1)"> and <script>bad()</' + 'script>'));
      if (/<img[^>]*onerror/i.test(html)) throw new Error('raw img survived');
      if (/<script/i.test(html)) throw new Error('raw script survived');
      return true;
    });

    await check('markdown blocks javascript: links', async () => {
      const html = await page.evaluate(() => window.NODALIS.markdown.render(
        '[click](javascript:alert(1))\n\n[b](JaVaScRiPt:x)\n\n[c](data:text/html,<script>x</scr' + 'ipt>)'));
      // No anchor may ever carry an executable scheme; escaped literal text is fine.
      if (/href\s*=\s*["']?\s*(javascript|vbscript|data:text\/html)/i.test(html)) {
        throw new Error('executable URL survived into an href');
      }
      if (/<a[^>]*javascript/i.test(html)) throw new Error('javascript reached an anchor tag');
      return true;
    });

    await check('frontmatter round-trips without loss', async () => {
      const result = await page.evaluate(() => {
        const S = window.NODALIS.serialize;
        const original = '---\nstatus: doing\ntags: [a, b]\ncount: 42\nflag: true\ntitle: "Quoted: thing"\n---\n\nBody here.';
        const parsed = S.parseFrontmatter(original);
        const back = S.stringifyFrontmatter(parsed.properties) + parsed.body;
        const reparsed = S.parseFrontmatter(back);
        return { first: parsed.properties, second: reparsed.properties, body: reparsed.body };
      });
      if (result.first.status !== result.second.status) throw new Error('status drifted');
      if (JSON.stringify(result.first.tags) !== JSON.stringify(result.second.tags)) throw new Error('tags drifted');
      if (result.first.count !== 42 || result.second.count !== 42) throw new Error('number drifted');
      if (result.first.flag !== true || result.second.flag !== true) throw new Error('boolean drifted');
      if (!result.body.includes('Body here')) throw new Error('body lost');
      return true;
    });

    await check('safe filenames reject path traversal and reserved names', async () => {
      const result = await page.evaluate(() => {
        const f = window.NODALIS.util.safeFileName;
        return { trav: f('../../etc/passwd'), con: f('CON'), empty: f('   '), slash: f('a/b\\c') };
      });
      if (result.trav.includes('/') || result.trav.includes('..')) throw new Error('traversal survived: ' + result.trav);
      if (result.con === 'CON') throw new Error('reserved name not escaped');
      if (!result.empty) throw new Error('empty name produced an empty filename');
      if (result.slash.includes('/') || result.slash.includes('\\')) throw new Error('separators survived');
      return true;
    });

    await check('exports produce valid output', async () => {
      const result = await page.evaluate(async () => {
        const note = window.NODALIS.store.allNotes()[0];
        const md = window.NODALIS.exporter.toMarkdown(note);
        const html = window.NODALIS.exporter.toStandaloneHtml(note, { includeMeta: true });
        return { mdLength: md.length, hasDoctype: html.startsWith('<!DOCTYPE html>'), hasBody: html.includes('<main>') };
      });
      if (result.mdLength < 10) throw new Error('markdown export is empty');
      if (!result.hasDoctype || !result.hasBody) throw new Error('html export is malformed');
      return true;
    });

    await check('storage status is reported honestly', async () => {
      const info = await page.evaluate(() => window.NODALIS.vault.describe());
      if (info.safe !== false) throw new Error('claimed to be safe without a folder connected');
      if (!info.reason) throw new Error('no explanation given for the unsafe state');
      const label = await page.locator('#vault-status .vault-status-label').textContent();
      if (!label || !label.trim()) throw new Error('status label is empty');
      return true;
    });

    await check('features can be switched off and disappear', async () => {
      await page.evaluate(async () => {
        await window.NODALIS.store.setSetting('visibleViews.graph', false);
        window.NODALIS.app.rebuildNav();
      });
      await page.waitForTimeout(300);
      const hidden = await page.evaluate(() => {
        const btn = document.querySelector('#view-tabs button[data-feature="graph"]');
        return btn && btn.style.display === 'none';
      });
      if (!hidden) throw new Error('graph tab is still visible');
      await page.evaluate(async () => {
        await window.NODALIS.store.setSetting('visibleViews.graph', true);
        window.NODALIS.app.rebuildNav();
      });
      return true;
    });

    await check('settings render every section', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('settings'));
      await page.waitForTimeout(400);
      const sections = ['storage', 'appearance', 'typography', 'editor', 'features', 'shortcuts', 'daily', 'data', 'about'];
      for (const id of sections) {
        await page.evaluate((s) => window.NODALIS.settings.open(s), id);
        await page.waitForTimeout(200);
        const content = await page.locator('#settings-body').textContent();
        if (!content || content.trim().length < 40) throw new Error(id + ' rendered empty');
      }
      return true;
    });

    await check('desktop screenshots captured', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('editor'));
      await page.waitForTimeout(400);
      for (const style of ['nodalis', 'nothing', 'glass', 'notion']) {
        await page.evaluate((s) => window.NODALIS.theme.setStyle(s), style);
        await page.waitForTimeout(450);
        await page.screenshot({ path: join(SHOTS, 'desktop-' + style + '.png') });
      }
      await page.evaluate(() => window.NODALIS.theme.setStyle('nodalis'));
      await page.waitForTimeout(300);
      for (const view of ['graph', 'canvas', 'database', 'tasks', 'matrix', 'sticky', 'review', 'settings']) {
        await page.evaluate((v) => window.NODALIS.app.setView(v), view);
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(SHOTS, 'view-' + view + '.png') });
      }
      return true;
    });

    if (SINGLE) {
      await check('the single-file build ships its PWA assets', async () => {
        const results = await page.evaluate(async () => {
          const out = {};
          for (const path of ['manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/favicon-32.png', 'icons/icon.svg']) {
            try {
              const res = await fetch(path, { cache: 'no-store' });
              out[path] = res.status;
            } catch (err) { out[path] = 'error'; }
          }
          out.manifestLink = !!document.querySelector('link[rel="manifest"]');
          out.inlineFavicon = !!document.querySelector('link[rel="icon"][href^="data:"]');
          out.appleIcon = !!document.querySelector('link[rel="apple-touch-icon"]');
          return out;
        });
        const missing = Object.keys(results).filter((k) => results[k] !== 200 && typeof results[k] === 'number');
        if (missing.length) throw new Error('not served: ' + missing.join(', '));
        if (!results.manifestLink) throw new Error('no manifest link in the document');
        if (!results.inlineFavicon) throw new Error('no inline data-URL favicon');
        if (!results.appleIcon) throw new Error('no apple-touch-icon');
        return true;
      });

      await check('the manifest is valid and self-consistent', async () => {
        const manifest = await page.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
        if (!manifest.name || !manifest.icons || !manifest.icons.length) throw new Error('manifest is incomplete');
        if (!/index\.html$/.test(manifest.start_url)) throw new Error('start_url is wrong: ' + manifest.start_url);
        const maskable = manifest.icons.some((i) => (i.purpose || '').includes('maskable'));
        if (!maskable) throw new Error('no maskable icon');
        return true;
      });
    }

    await check('no console errors during the desktop pass', () => {
      const real = errors.filter((e) =>
        !/favicon|manifest|service worker|Failed to load resource.*404|sw\.js/i.test(e));
      if (real.length) throw new Error(real.slice(0, 3).join(' | '));
      return true;
    });

    await context.close();
  }

  /* ===================================================== 2. stress test === */
  console.log('\nStress');
  {
    const { context, page, errors } = await bootApp(browser, { width: 1440, height: 900 });

    await check('handles 600 notes without breaking', async () => {
      const start = Date.now();
      await page.evaluate(async () => {
        const N = window.NODALIS;
        for (let i = 0; i < 600; i++) {
          await N.store.createNote({
            title: 'Bulk note ' + i,
            folder: i % 7 === 0 ? 'Bulk/Deep/Nested' : (i % 3 === 0 ? 'Bulk' : ''),
            content: '# Bulk ' + i + '\n\n- [ ] task ' + i + '\n\nLinks to [[Bulk note ' + ((i + 1) % 600) + ']] #bulk',
            silent: true,
          });
        }
      });
      const elapsed = Date.now() - start;
      const count = await page.evaluate(() => window.NODALIS.store.state.notes.size);
      if (count < 600) throw new Error('only ' + count + ' notes created');
      console.log('      (' + count + ' notes in ' + (elapsed / 1000).toFixed(1) + 's)');
      return true;
    });

    await check('sidebar renders a large tree quickly', async () => {
      const start = Date.now();
      await page.evaluate(() => window.NODALIS.sidebar.render());
      await page.waitForTimeout(200);
      const elapsed = Date.now() - start;
      if (elapsed > 4000) throw new Error('took ' + elapsed + 'ms');
      const rows = await page.locator('.tree-row').count();
      if (rows < 5) throw new Error('tree looks empty');
      return true;
    });

    await check('graph handles a large vault', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('graph'));
      await page.waitForTimeout(2500);
      const nodes = await page.evaluate(() => {
        const c = document.getElementById('graph-canvas');
        return c && c.width > 0;
      });
      if (!nodes) throw new Error('graph canvas has no size');
      return true;
    });

    await check('search across a large vault stays fast', async () => {
      const ms = await page.evaluate(() => {
        const t = performance.now();
        window.NODALIS.search.search('bulk');
        return performance.now() - t;
      });
      if (ms > 2500) throw new Error('search took ' + ms.toFixed(0) + 'ms');
      console.log('      (search ' + ms.toFixed(0) + 'ms over 600 notes)');
      return true;
    });

    await check('duplicate titles get unique paths', async () => {
      const paths = await page.evaluate(async () => {
        const a = await window.NODALIS.store.createNote({ title: 'Same name' });
        const b = await window.NODALIS.store.createNote({ title: 'Same name' });
        const c = await window.NODALIS.store.createNote({ title: 'Same name' });
        return [a.path, b.path, c.path];
      });
      if (new Set(paths).size !== 3) throw new Error('paths collided: ' + paths.join(', '));
      return true;
    });

    await check('deeply nested folders survive a rename', async () => {
      const result = await page.evaluate(async () => {
        const N = window.NODALIS;
        await N.store.ensureFolderChain('Alpha/Beta/Gamma/Delta');
        const note = await N.store.createNote({ title: 'Deep note', folder: 'Alpha/Beta/Gamma/Delta' });
        const alpha = N.store.folderByPath('Alpha');
        await N.store.renameFolder(alpha.id, 'Renamed');
        return {
          note: N.store.getNote(note.id).path,
          folderExists: !!N.store.folderByPath('Renamed/Beta/Gamma/Delta'),
        };
      });
      if (!result.note.startsWith('Renamed/Beta/Gamma/Delta/')) throw new Error('note path is wrong: ' + result.note);
      if (!result.folderExists) throw new Error('nested folder path did not update');
      return true;
    });

    await check('rapid typing does not lose content', async () => {
      await page.evaluate(async () => {
        const note = await window.NODALIS.store.createNote({ title: 'Rapid typing' });
        window.NODALIS.app.openNote(note.id);
      });
      await page.waitForTimeout(300);
      const target = 'abcdefghijklmnopqrstuvwxyz0123456789';
      await page.locator('#note-editor').click();
      await page.keyboard.type(target, { delay: 8 });
      await page.waitForTimeout(1200);
      const saved = await page.evaluate(() => {
        const id = window.NODALIS.store.state.activeNoteId;
        return window.NODALIS.store.getNote(id).content;
      });
      if (saved.trim() !== target) throw new Error('expected "' + target + '", stored "' + saved.trim() + '"');
      return true;
    });

    await check('circular embeds do not hang the renderer', async () => {
      const html = await page.evaluate(async () => {
        const N = window.NODALIS;
        await N.store.createNote({ title: 'Loop A', content: 'A embeds ![[Loop B]]' });
        await N.store.createNote({ title: 'Loop B', content: 'B embeds ![[Loop A]]' });
        return N.markdown.render('![[Loop A]]');
      });
      if (!html.includes('nested too deeply')) throw new Error('recursion guard did not trigger');
      return true;
    });

    await check('malformed markdown does not throw', async () => {
      const result = await page.evaluate(() => {
        const cases = [
          '| broken | table', '```unclosed fence', '> [!nonsense] unknown callout',
          '[[', ']]', '![[', '- [ ', '#'.repeat(80), '*'.repeat(200),
          '$$\nunclosed math', '[^orphan]', '  control chars',
        ];
        const errors = [];
        cases.forEach((c) => {
          try { window.NODALIS.markdown.render(c); }
          catch (err) { errors.push(c.slice(0, 20) + ': ' + err.message); }
        });
        return errors;
      });
      if (result.length) throw new Error(result.join(' | '));
      return true;
    });

    await check('no console errors under stress', () => {
      const real = errors.filter((e) => !/favicon|manifest|service worker|404|sw\.js/i.test(e));
      if (real.length) throw new Error(real.slice(0, 3).join(' | '));
      return true;
    });

    await context.close();
  }

  /* ======================================================= 3. tablet === */
  console.log('\nTablet (834x1112)');
  {
    const { context, page, errors } = await bootApp(browser, { width: 834, height: 1112 }, { touch: true });

    await check('layout has no horizontal overflow', async () => {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error(overflow + 'px of horizontal overflow');
      return true;
    });

    await check('sidebar behaves as a drawer', async () => {
      await page.evaluate(() => { document.getElementById('app').dataset.sidebar = 'open'; });
      await page.waitForTimeout(400);
      const box = await page.locator('#sidebar').boundingBox();
      if (!box || box.width < 100) throw new Error('sidebar did not open');
      return true;
    });

    await check('tablet screenshots captured', async () => {
      for (const view of ['editor', 'tasks', 'matrix', 'settings']) {
        await page.evaluate((v) => window.NODALIS.app.setView(v), view);
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(SHOTS, 'tablet-' + view + '.png') });
      }
      return true;
    });

    await check('no console errors on tablet', () => {
      const real = errors.filter((e) => !/favicon|manifest|service worker|404|sw\.js/i.test(e));
      if (real.length) throw new Error(real.slice(0, 3).join(' | '));
      return true;
    });

    await context.close();
  }

  /* ======================================================= 4. mobile === */
  console.log('\nMobile (390x844)');
  {
    const { context, page, errors } = await bootApp(browser, { width: 390, height: 844 }, { touch: true });

    await check('bottom navigation is visible', async () => {
      const visible = await page.locator('#mobile-nav').isVisible();
      if (!visible) throw new Error('mobile nav is hidden');
      const buttons = await page.locator('.mobile-nav-btn').count();
      if (buttons < 4) throw new Error('only ' + buttons + ' nav buttons');
      return true;
    });

    await check('no horizontal overflow at 390px', async () => {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error(overflow + 'px of horizontal overflow');
      return true;
    });

    await check('editor text is at least 16px so iOS will not zoom', async () => {
      await page.evaluate(() => window.NODALIS.app.setView('editor'));
      await page.waitForTimeout(300);
      const size = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.getElementById('note-editor')).fontSize));
      if (size < 16) throw new Error('editor font is ' + size + 'px');
      return true;
    });

    await check('touch targets are at least 36px', async () => {
      const small = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('.mobile-nav-btn, .topbar .icon-btn, .btn').forEach((node) => {
          if (node.offsetParent === null) return;
          const r = node.getBoundingClientRect();
          if (r.height > 0 && r.height < 36) out.push((node.id || node.className) + ' ' + Math.round(r.height) + 'px');
        });
        return out;
      });
      if (small.length) throw new Error('too small: ' + small.slice(0, 4).join(', '));
      return true;
    });

    await check('palette becomes a bottom sheet', async () => {
      await page.evaluate(() => window.NODALIS.palette.open('all'));
      await page.waitForTimeout(400);
      const box = await page.locator('.palette').boundingBox();
      if (!box) throw new Error('palette did not open');
      if (box.width < 380) throw new Error('palette is not full width: ' + box.width);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      return true;
    });

    await check('every view fits without overflow on mobile', async () => {
      const views = ['editor', 'graph', 'canvas', 'database', 'tasks', 'matrix', 'sticky', 'scratch', 'review', 'settings'];
      const bad = [];
      for (const view of views) {
        await page.evaluate((v) => window.NODALIS.app.setView(v), view);
        await page.waitForTimeout(420);
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 2) bad.push(view + ' (+' + overflow + 'px)');
      }
      if (bad.length) throw new Error(bad.join(', '));
      return true;
    });

    await check('mobile screenshots captured', async () => {
      for (const view of ['editor', 'tasks', 'sticky', 'review']) {
        await page.evaluate((v) => window.NODALIS.app.setView(v), view);
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(SHOTS, 'mobile-' + view + '.png') });
      }
      await page.evaluate(() => window.NODALIS.theme.setStyle('nothing'));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.NODALIS.app.setView('editor'));
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(SHOTS, 'mobile-nothing.png') });
      return true;
    });

    await check('no console errors on mobile', () => {
      const real = errors.filter((e) => !/favicon|manifest|service worker|404|sw\.js/i.test(e));
      if (real.length) throw new Error(real.slice(0, 3).join(' | '));
      return true;
    });

    await context.close();
  }

  /* ============================== 5. a storage layer that never answers === */
  console.log('\nStalled storage');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    attachConsole(page, errors);

    // The failure a user actually hit: indexedDB.open() returns a request whose
    // callbacks never fire. WebKit drops early requests, a blocked upgrade in
    // another tab does the same, and hardened modes stall instead of erroring.
    await page.addInitScript(() => {
      const realOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = function () {
        const req = realOpen.apply(null, arguments);
        ['onsuccess', 'onerror', 'onupgradeneeded', 'onblocked'].forEach((prop) => {
          Object.defineProperty(req, prop, { set() {}, get() { return null; }, configurable: true });
        });
        return req;
      };
    });
    await page.goto('http://127.0.0.1:8974/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.NODALIS && window.NODALIS.store, null, { timeout: 15000 });

    await check('the active toolbar icon is visible before any script styles it', async () => {
      const probe = await page.evaluate(() => {
        const btn = document.querySelector('#view-tabs button.is-active');
        if (!btn) return null;
        const cs = getComputedStyle(btn);
        return {
          accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
          bg: cs.backgroundColor,
          color: cs.color,
        };
      });
      if (!probe) throw new Error('no active tab found');
      if (!probe.accent) throw new Error('--accent has no CSS fallback');
      if (probe.bg === 'rgba(0, 0, 0, 0)' && probe.color === 'rgb(255, 255, 255)') {
        throw new Error('white icon on a transparent background — invisible in light mode');
      }
      return true;
    });

    await check('boot finishes instead of hanging on the loader', async () => {
      await page.waitForFunction(() => !document.getElementById('loader'), null, { timeout: 30000 });
      return true;
    });

    await check('the interface actually works afterwards', async () => {
      const up = await page.evaluate(() => ({
        editor: !!(window.NODALIS.editor.getTextarea && window.NODALIS.editor.getTextarea()),
        commands: window.NODALIS.commands.all().length,
        loaded: window.NODALIS.store.state.loaded,
      }));
      if (!up.editor) throw new Error('the editor never initialised');
      if (up.commands < 60) throw new Error('only ' + up.commands + ' commands registered');
      if (!up.loaded) throw new Error('the store never finished loading');
      return true;
    });

    await check('the storage indicator stops saying it is still checking', async () => {
      const label = await page.locator('#vault-status .vault-status-label').textContent();
      if (!label || /starting|checking/i.test(label)) throw new Error('stuck at "' + label + '"');
      return true;
    });

    await check('it admits storage is unavailable', async () => {
      const degraded = await page.evaluate(() => window.NODALIS.db.isDegraded());
      if (!degraded) throw new Error('degraded mode was not detected');
      const text = await page.evaluate(() => document.body.innerText);
      if (!/memory|unavailable|not being saved|export/i.test(text)) {
        throw new Error('the user was never told');
      }
      return true;
    });

    await check('notes can still be written and read back', async () => {
      // Get past the first-run chooser the way a real user would.
      const chooser = page.locator('.onboard-choice', { hasText: 'this device' });
      if (await chooser.count()) await chooser.first().click();
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        if (window.NODALIS.help) window.NODALIS.help.closeTour();
        while (window.NODALIS.modal.anyOpen()) window.NODALIS.modal.closeTop();
      });
      const value = await page.evaluate(async () => {
        const note = await window.NODALIS.store.createNote({ title: 'Safe mode note', content: 'typed while storage was down' });
        window.NODALIS.app.openNote(note.id);
        return window.NODALIS.store.getNote(note.id).content;
      });
      if (value !== 'typed while storage was down') throw new Error('in-memory write failed');
      return true;
    });

    await page.screenshot({ path: join(SHOTS, 'stalled-storage.png') });
    await context.close();
  }

  /* ============================ 6. skip during a stall gets you in fast === */
  console.log('\nSkipping past a stall');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const realOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = function () {
        const req = realOpen.apply(null, arguments);
        ['onsuccess', 'onerror', 'onupgradeneeded', 'onblocked'].forEach((prop) => {
          Object.defineProperty(req, prop, { set() {}, get() { return null; }, configurable: true });
        });
        return req;
      };
    });
    await page.goto('http://127.0.0.1:8974/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.loader-skip', { timeout: 15000 });

    await check('Skip leads to a working app, not a dead shell', async () => {
      const started = Date.now();
      await page.locator('.loader-skip').click();
      await page.waitForFunction(
        () => !document.getElementById('loader') &&
              !!(window.NODALIS.editor.getTextarea && window.NODALIS.editor.getTextarea()),
        null, { timeout: 15000 });
      const elapsed = Date.now() - started;
      if (elapsed > 12000) throw new Error('took ' + elapsed + 'ms after Skip');
      console.log('      (usable ' + (elapsed / 1000).toFixed(1) + 's after clicking Skip)');
      return true;
    });

    await context.close();
  }

  /* ================================================ 7. degraded modes === */
  console.log('\nDegraded environments');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    attachConsole(page, errors);

    // Simulate a browser with no File System Access API and no IndexedDB.
    await page.addInitScript(() => {
      delete window.showDirectoryPicker;
      Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true });
    });
    await page.goto('http://127.0.0.1:8974/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.NODALIS && window.NODALIS.store, null, { timeout: 15000 });
    await page.evaluate(async () => { if (window.NODALIS.loader) await window.NODALIS.loader.finish(true); });
    await page.waitForTimeout(700);

    await check('app still boots with no IndexedDB', async () => {
      const visible = await page.locator('#app').isVisible();
      if (!visible) throw new Error('app did not render');
      const degraded = await page.evaluate(() => window.NODALIS.db.isDegraded());
      if (!degraded) throw new Error('degraded mode was not detected');
      return true;
    });

    await check('it says so rather than pretending', async () => {
      const text = await page.evaluate(() => document.body.innerText);
      if (!/memory|unavailable|export/i.test(text)) throw new Error('no warning shown to the user');
      return true;
    });

    await check('notes can still be written in memory', async () => {
      const result = await page.evaluate(async () => {
        const note = await window.NODALIS.store.createNote({ title: 'Memory note', content: 'still works' });
        return window.NODALIS.store.getNote(note.id).content;
      });
      if (result !== 'still works') throw new Error('in-memory write failed');
      return true;
    });

    await check('folder storage is honestly reported as unavailable', async () => {
      const info = await page.evaluate(() => window.NODALIS.vault.describe());
      if (info.safe) throw new Error('claimed safe storage without any');
      if (!/cannot write directly to a folder/i.test(info.reason)) throw new Error('unclear reason: ' + info.reason);
      return true;
    });

    await page.screenshot({ path: join(SHOTS, 'degraded.png') });
    await context.close();
  }

  await browser.close();
  server.close();

  /* --------------------------------------------------------------- report */
  console.log('\n' + '-'.repeat(52));
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log('  * ' + f.name + '\n    ' + f.detail));
  }
  console.log('Screenshots: tests/shots/');
  console.log('-'.repeat(52) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nTest harness crashed:', err);
  process.exit(2);
});
