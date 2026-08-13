/**
 * Regression coverage for the second-pass feature set: first-run tour, help
 * center, nested-folder note creation, pin/duplicate, callouts, word count,
 * theme styles (Nodalis/Notion/Nothing/Glass), and customization toggles.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import handler from 'serve-handler';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 8960;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
    server.listen(PORT, () => resolve(server));
  });
}

async function run() {
  const server = await startServer();
  const browser = await chromium.launch();
  const errors = [];
  let passed = 0, failed = 0;
  function check(name, cond) {
    if (cond) { console.log(`PASS  ${name}`); passed++; }
    else { console.log(`FAIL  ${name}`); failed++; }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // --- First-run tour ---
  check('tour auto-shows on first run', await page.locator('#tour-next').count() === 1);
  for (let i = 0; i < 20; i++) {
    if (await page.locator('#tour-next').count() === 0) break;
    await page.click('#tour-next');
    await page.waitForTimeout(120);
  }
  check('tour can be clicked through to completion', await page.locator('#tour-next').count() === 0);

  // --- Help center ---
  await page.click('#btn-help');
  await page.waitForTimeout(200);
  check('help modal opens', await page.locator('#help-modal:not(.hidden)').count() === 1);
  check('help manual has entries', (await page.locator('.help-manual-item').count()) >= 8);
  await page.click('#help-close');
  await page.waitForTimeout(150);
  check('help modal closes', await page.locator('#help-modal.hidden').count() === 1);

  // --- Folder note creation bug fix ---
  await page.click('#file-tree >> text=Getting Started');
  await page.waitForTimeout(150);
  const folderRow = page.locator('.folder-row', { hasText: 'Getting Started' });
  await folderRow.click({ button: 'right' });
  await page.waitForTimeout(150);
  const hasNewNoteHere = await page.locator('text=+ New note here').count();
  check('folder context menu offers "New note here"', hasNewNoteHere === 1);
  await page.click('text=+ New note here');
  await page.waitForTimeout(250);
  const activeTitle = await page.inputValue('#note-title-input');
  check('note created inside folder opens for editing', activeTitle === 'Untitled' || activeTitle.length > 0);
  // verify the created note actually has the folder set
  const noteFolderOk = await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.open('nodalis-db');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('notes', 'readonly');
        const store = tx.objectStore('notes');
        const all = store.getAll();
        all.onsuccess = () => {
          const found = all.result.find((n) => n.title === 'Untitled' && n.folder === 'Getting Started');
          resolve(!!found);
        };
      };
    });
  });
  check('new note is actually stored with folder="Getting Started"', noteFolderOk);

  // --- Pin & duplicate ---
  await page.click('#btn-pin-note');
  await page.waitForTimeout(200);
  check('pin button becomes active', await page.locator('#btn-pin-note.active').count() === 1);
  check('pinned section appears in sidebar', (await page.locator('.tree-section-label', { hasText: 'PINNED' }).count()) === 1);
  await page.click('#btn-duplicate-note');
  await page.waitForTimeout(250);
  check('duplicate created a copy', (await page.inputValue('#note-title-input')).includes('copy'));

  // --- Callout rendering ---
  await page.click('#note-editor');
  await page.fill('#note-editor', '> [!warning] Careful\n> This is a callout body.');
  await page.waitForTimeout(400);
  check('callout renders with type class', (await page.locator('.callout.callout-warning').count()) === 1);

  // --- Word count ---
  check('word count footer shows a count', /\d+ words/.test(await page.locator('#word-count').textContent()));

  // --- Theme styles ---
  await page.click('#btn-settings');
  await page.waitForTimeout(200);
  for (const style of ['Notion-style', 'Nothing-inspired', 'Glass (iOS 26-style)', 'Nodalis (default)']) {
    await page.click(`button:text("${style}")`);
    await page.waitForTimeout(200);
    const dataStyle = await page.getAttribute('body', 'data-style');
    const expected = style.toLowerCase().startsWith('nodalis') ? 'nodalis' : style.toLowerCase().startsWith('notion') ? 'notion' : style.toLowerCase().startsWith('nothing') ? 'nothing' : 'glass';
    check(`theme style "${style}" applies data-style="${expected}"`, dataStyle === expected);
  }
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'screenshot-theme-notion.png') });
  await page.click('button:text("Nothing-inspired")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'screenshot-theme-nothing.png') });
  await page.click('button:text("Glass (iOS 26-style)")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'screenshot-theme-glass.png') });
  await page.click('button:text("Nodalis (default)")');
  await page.waitForTimeout(200);

  // --- Customization: density + feature visibility ---
  const densitySelect = page.locator('.settings-row', { hasText: 'Density' }).locator('select');
  await densitySelect.selectOption('compact');
  await page.waitForTimeout(150);
  check('compact density applies data-density', (await page.getAttribute('body', 'data-density')) === 'compact');
  await densitySelect.selectOption('comfortable');

  // hide the Canvas view, confirm the topbar icon disappears, then restore
  const canvasVisBtn = page.locator('.settings-row', { hasText: 'Canvas / whiteboard' }).locator('button');
  await canvasVisBtn.click();
  await page.waitForTimeout(150);
  check('hiding Canvas view hides its topbar icon', await page.locator('#btn-view-canvas').isHidden());
  await canvasVisBtn.click();
  await page.waitForTimeout(150);
  check('re-showing Canvas view restores its topbar icon', await page.locator('#btn-view-canvas').isVisible());

  // --- Backup health indicator ---
  const syncLabelText = await page.locator('.sync-label').textContent();
  check('sync/backup status label is present', syncLabelText.trim().length > 0);

  await context.close();
  await browser.close();
  server.close();

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (errors.length) {
    console.log('\nConsole/page errors captured:');
    errors.forEach((e) => console.log(' -', e));
  } else {
    console.log('No console/page errors captured.');
  }
  process.exit(failed || errors.length ? 1 : 0);
}

run();
