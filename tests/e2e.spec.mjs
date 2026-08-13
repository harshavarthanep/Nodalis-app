/**
 * Smoke test for Nodalis: loads the app over a real static server (like GitHub
 * Pages would serve it), exercises core flows, and screenshots mobile/tablet/
 * desktop viewports for every major view.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import handler from 'serve-handler';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 8934;

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1194 },
  desktop: { width: 1440, height: 900 },
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => handler(req, res, { public: ROOT }));
    server.listen(PORT, () => resolve(server));
  });
}

async function run() {
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' }).catch(() => chromium.launch());
  const errors = [];
  let passed = 0, failed = 0;

  function check(name, cond) {
    if (cond) { console.log(`PASS  ${name}`); passed++; }
    else { console.log(`FAIL  ${name}`); failed++; }
  }

  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[${device}] ${msg.text()}`); });
    page.on('pageerror', (err) => errors.push(`[${device}] pageerror: ${err.message}`));

    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    check(`${device}: app root rendered`, await page.locator('#app').count() === 1);
    check(`${device}: welcome note seeded`, (await page.locator('#file-tree').textContent()).includes('Welcome to Nodalis'));

    await page.screenshot({ path: path.join(__dirname, `screenshot-${device}-editor.png`) });

    // Open command palette
    await page.keyboard.press(device === 'mobile' ? 'Control+k' : 'Control+k');
    await page.waitForTimeout(200);
    check(`${device}: command palette opens`, await page.locator('#command-palette:not(.hidden)').count() === 1);
    await page.keyboard.press('Escape');

    // Create a new note via sidebar button (open sidebar first on mobile/tablet)
    if (device !== 'desktop') {
      await page.click('#btn-toggle-sidebar');
      await page.waitForTimeout(150);
    }
    await page.click('#btn-new-note');
    await page.waitForTimeout(200);
    await page.fill('#note-title-input', 'Test Note ' + device);
    await page.click('#note-editor');
    await page.keyboard.type('Linking to [[Welcome to Nodalis]] and tagging #demo.');
    await page.waitForTimeout(400);
    const previewText = await page.locator('#note-preview').textContent();
    check(`${device}: wikilink rendered in preview`, previewText.includes('Welcome to Nodalis'));
    check(`${device}: tag rendered in preview`, previewText.includes('demo'));

    // Graph view
    if (device === 'mobile') {
      await page.click('.mobile-nav-btn[data-view="graph"]');
    } else {
      await page.click('#btn-view-graph');
    }
    await page.waitForTimeout(500);
    check(`${device}: graph view active`, await page.locator('#view-graph.active').count() === 1);
    await page.screenshot({ path: path.join(__dirname, `screenshot-${device}-graph.png`) });

    // Canvas view
    if (device === 'mobile') await page.click('.mobile-nav-btn[data-view="canvas"]');
    else await page.click('#btn-view-canvas');
    await page.waitForTimeout(200);
    await page.click('#btn-canvas-add-sticky');
    await page.waitForTimeout(200);
    check(`${device}: sticky card added to canvas`, await page.locator('.canvas-card.sticky').count() >= 1);
    await page.screenshot({ path: path.join(__dirname, `screenshot-${device}-canvas.png`) });

    // Database view
    if (device === 'mobile') {
      await page.click('[data-mobile-action="more"]');
      await page.waitForTimeout(150);
      await page.click('#mobile-more-sheet button[data-view="database"]');
    } else {
      await page.click('#btn-view-database');
    }
    await page.waitForTimeout(200);
    check(`${device}: database view active`, await page.locator('#view-database.active').count() === 1);
    check(`${device}: database table shows rows`, (await page.locator('.db-table').count()) >= 1);
    await page.screenshot({ path: path.join(__dirname, `screenshot-${device}-database.png`) });

    // Settings view + theme toggle
    if (device === 'mobile') {
      await page.click('[data-mobile-action="more"]');
      await page.waitForTimeout(150);
      await page.click('#mobile-more-sheet button[data-view="settings"]');
    } else {
      await page.click('#btn-settings');
    }
    await page.waitForTimeout(200);
    check(`${device}: settings view active`, await page.locator('#view-settings.active').count() === 1);
    check(`${device}: sync options rendered`, (await page.locator('.sync-option-card').count()) === 3);
    await page.screenshot({ path: path.join(__dirname, `screenshot-${device}-settings.png`) });

    await context.close();
  }

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
