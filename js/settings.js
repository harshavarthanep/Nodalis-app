/**
 * settings.js — renders the Settings view: appearance, sync, customization,
 * templates, data, sharing, and about.
 */
import { state, bus, saveSettings } from './state.js';
import { showToast } from './layout-manager.js';
import * as GitHub from './sync/github-sync.js';
import * as FS from './sync/fs-sync.js';
import * as ExportImport from './sync/export-import.js';
import { getTemplates } from './templates.js';
import { DB } from './db.js';
import { updateHealthIndicator } from './auto-backup.js';
import { applyAll as applyTheme } from './theme.js';
import {
  ACCENT_PRESETS, setAccent, setDensity, setEditorFont, setViewVisible,
  setSidebarTabVisible, resetCustomization,
} from './customization.js';

export function initSettings() {
  bus.on('view:changed', (v) => { if (v === 'settings') render(); });
  bus.on('sync:export', () => ExportImport.exportZip().then(() => showToast('Vault exported')));
  bus.on('sync:now', () => quickSyncNow());
  bus.on('settings:openSyncSection', () => { render(); setTimeout(() => scrollToSection('sync'), 60); });
  bus.on('settings:scrollTo', (id) => { render(); setTimeout(() => scrollToSection(id), 60); });
  render();
}

function scrollToSection(id) {
  document.getElementById(`settings-${id}-section`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function quickSyncNow() {
  if (state.settings.syncMode === 'github') {
    try { await GitHub.push(); await GitHub.pull(); showToast('Synced with GitHub'); updateHealthIndicator(); }
    catch (e) { showToast('Sync failed: ' + e.message, 'error'); updateHealthIndicator('error'); }
  } else if (state.settings.syncMode === 'fs') {
    try {
      const handle = await FS.getSavedDirectory();
      if (!handle || !(await FS.ensurePermission(handle))) return showToast('Reconnect your local folder in Settings', 'error');
      await FS.push(handle); await FS.pull(handle);
      showToast('Synced with local folder');
      updateHealthIndicator();
    } catch (e) { showToast('Sync failed: ' + e.message, 'error'); updateHealthIndicator('error'); }
  } else {
    showToast('Local-only mode — use Export to back up your vault, or connect GitHub/a folder for automatic backup');
  }
}

async function render() {
  const root = document.getElementById('settings-container');
  root.innerHTML = '';
  root.appendChild(await appearanceSection());
  root.appendChild(await customizationSection());
  root.appendChild(await syncSection());
  root.appendChild(await templatesSection());
  root.appendChild(await dataSection());
  root.appendChild(shareSection());
  root.appendChild(aboutSection());
}

function section(title, id) {
  const s = document.createElement('div');
  s.className = 'settings-section';
  if (id) s.id = `settings-${id}-section`;
  s.innerHTML = `<h3>${title}</h3>`;
  return s;
}

const THEME_STYLES = [
  { id: 'nodalis', name: 'Nodalis (default)', desc: 'Warm paper-white light, rich dark, violet accent.' },
  { id: 'notion', name: 'Notion-style', desc: 'Clean, minimal, near-white workspace.' },
  { id: 'nothing', name: 'Nothing-inspired', desc: 'Monochrome, dot-matrix, red accent. Always dark.' },
  { id: 'glass', name: 'Glass (iOS 26-style)', desc: 'Frosted, translucent panels over a soft gradient.' },
];

async function appearanceSection() {
  const s = section('Appearance', 'appearance');

  const styleRow = document.createElement('div');
  styleRow.className = 'settings-row';
  styleRow.style.flexWrap = 'wrap';
  styleRow.innerHTML = `<div><div class="label">Theme style</div><div class="desc">Pick a whole look — you can fine-tune colors below</div></div>`;
  const styleWrap = document.createElement('div');
  styleWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
  THEME_STYLES.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'btn small' + (state.settings.themeStyle === t.id ? ' btn-primary' : '');
    btn.textContent = t.name;
    btn.title = t.desc;
    btn.addEventListener('click', async () => { state.settings.themeStyle = t.id; await saveSettings(); applyTheme(); render(); });
    styleWrap.appendChild(btn);
  });
  styleRow.appendChild(styleWrap);
  s.appendChild(styleRow);

  const activeDesc = document.createElement('p');
  activeDesc.className = 'desc';
  activeDesc.style.marginTop = '-4px';
  activeDesc.textContent = THEME_STYLES.find((t) => t.id === state.settings.themeStyle)?.desc || '';
  s.appendChild(activeDesc);

  if (['nodalis', 'notion'].includes(state.settings.themeStyle)) {
    const modeRow = document.createElement('div');
    modeRow.className = 'settings-row';
    modeRow.innerHTML = `<div><div class="label">Light / dark</div><div class="desc">"Auto (time)" switches to dark from 7pm–7am</div></div>`;
    const select = document.createElement('select');
    [['light', 'Light'], ['dark', 'Dark'], ['auto-system', 'Auto (system)'], ['auto-time', 'Auto (time of day)']].forEach(([v, label]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = label;
      if (state.settings.themeMode === v) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', async () => { state.settings.themeMode = select.value; await saveSettings(); applyTheme(); });
    modeRow.appendChild(select);
    s.appendChild(modeRow);
  }

  if (state.settings.themeStyle === 'glass') {
    const shadeRow = document.createElement('div');
    shadeRow.className = 'settings-row';
    shadeRow.innerHTML = `<div><div class="label">Glass shade</div><div class="desc">Clear (no color) or a slight black tint</div></div>`;
    const select = document.createElement('select');
    [['clear', 'Clear'], ['dark', 'Slight black shade']].forEach(([v, label]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = label;
      if (state.settings.glassShade === v) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', async () => { state.settings.glassShade = select.value; await saveSettings(); applyTheme(); });
    shadeRow.appendChild(select);
    s.appendChild(shadeRow);
  }

  return s;
}

async function customizationSection() {
  const s = section('Customization — make it yours', 'customization');
  const intro = document.createElement('p');
  intro.className = 'desc';
  intro.style.marginBottom = '12px';
  intro.textContent = 'This app should feel like something you built for your own workflow, not a fixed template. Everything here is per-device and resettable.';
  s.appendChild(intro);

  if (state.settings.themeStyle !== 'nothing') {
    const accentRow = document.createElement('div');
    accentRow.innerHTML = `<div class="label">Accent color</div>`;
    const swatchRow = document.createElement('div');
    swatchRow.className = 'accent-swatch-row';
    ACCENT_PRESETS.forEach((p) => {
      const sw = document.createElement('span');
      sw.className = 'accent-swatch' + (state.settings.accent === p.hex ? ' active' : '');
      sw.style.background = p.hex;
      sw.title = p.name;
      sw.addEventListener('click', async () => { await setAccent(p.hex); render(); });
      swatchRow.appendChild(sw);
    });
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.value = state.settings.accent || '#6c5ce7';
    custom.style.cssText = 'width:36px;height:30px;padding:2px;cursor:pointer;';
    custom.addEventListener('input', async () => { await setAccent(custom.value); });
    swatchRow.appendChild(custom);
    accentRow.appendChild(swatchRow);
    s.appendChild(accentRow);
  } else {
    const note = document.createElement('p');
    note.className = 'desc';
    note.textContent = 'The Nothing theme is intentionally monochrome + red — switch theme style above to customize accent color.';
    s.appendChild(note);
  }

  const fontRow = document.createElement('div');
  fontRow.className = 'settings-row';
  fontRow.innerHTML = `<div><div class="label">Editor font</div><div class="desc">The font used while writing</div></div>`;
  const fontSelect = document.createElement('select');
  [['mono', 'Monospace'], ['sans', 'Sans-serif'], ['serif', 'Serif']].forEach(([v, label]) => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = label;
    if (state.settings.editorFont === v) opt.selected = true;
    fontSelect.appendChild(opt);
  });
  fontSelect.addEventListener('change', () => setEditorFont(fontSelect.value));
  fontRow.appendChild(fontSelect);
  s.appendChild(fontRow);

  const densityRow = document.createElement('div');
  densityRow.className = 'settings-row';
  densityRow.innerHTML = `<div><div class="label">Density</div><div class="desc">Compact tightens spacing throughout the app</div></div>`;
  const densitySelect = document.createElement('select');
  [['comfortable', 'Comfortable'], ['compact', 'Compact']].forEach(([v, label]) => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = label;
    if (state.settings.density === v) opt.selected = true;
    densitySelect.appendChild(opt);
  });
  densitySelect.addEventListener('change', () => setDensity(densitySelect.value));
  densityRow.appendChild(densitySelect);
  s.appendChild(densityRow);

  const visLabel = document.createElement('div');
  visLabel.className = 'label';
  visLabel.style.marginTop = '14px';
  visLabel.textContent = 'Show or hide features';
  s.appendChild(visLabel);
  const visDesc = document.createElement('div');
  visDesc.className = 'desc';
  visDesc.style.marginBottom = '6px';
  visDesc.textContent = "Don't use Canvas or the Database view? Hide them so the app only shows what you actually use.";
  s.appendChild(visDesc);

  [['graph', 'Graph view'], ['canvas', 'Canvas / whiteboard'], ['database', 'Database / kanban']].forEach(([key, label]) => {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const visible = !(state.settings.visibleViews && state.settings.visibleViews[key] === false);
    row.innerHTML = `<div class="label">${label}</div>`;
    const toggle = document.createElement('button');
    toggle.className = 'btn small' + (visible ? ' btn-primary' : '');
    toggle.textContent = visible ? 'Visible' : 'Hidden';
    toggle.addEventListener('click', async () => { await setViewVisible(key, !visible); render(); });
    row.appendChild(toggle);
    s.appendChild(row);
  });

  [['tags', 'Tags tab in sidebar'], ['canvases', 'Canvases tab in sidebar']].forEach(([key, label]) => {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const visible = !(state.settings.visibleSidebarTabs && state.settings.visibleSidebarTabs[key] === false);
    row.innerHTML = `<div class="label">${label}</div>`;
    const toggle = document.createElement('button');
    toggle.className = 'btn small' + (visible ? ' btn-primary' : '');
    toggle.textContent = visible ? 'Visible' : 'Hidden';
    toggle.addEventListener('click', async () => { await setSidebarTabVisible(key, !visible); render(); });
    row.appendChild(toggle);
    s.appendChild(row);
  });

  const resetRow = document.createElement('div');
  resetRow.className = 'settings-row';
  resetRow.innerHTML = `<div><div class="label">Reset customization</div><div class="desc">Back to defaults — your notes are never affected</div></div>`;
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn small';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', async () => { await resetCustomization(); render(); showToast('Customization reset'); });
  resetRow.appendChild(resetBtn);
  s.appendChild(resetRow);

  return s;
}

async function syncSection() {
  const s = section('Sync & data safety — choose anytime, switch anytime', 'sync');
  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.style.marginBottom = '14px';
  desc.innerHTML = `GitHub Pages only serves static files, so Nodalis never needs a server — but that also means <strong>local-only storage can be cleared by your browser</strong>. If these notes matter, pick option ② or ③ below; either takes under a minute and means your vault exists as real files outside this browser.`;
  s.appendChild(desc);

  // Local only
  const localCard = document.createElement('div');
  localCard.className = 'sync-option-card' + (state.settings.syncMode === 'local' ? ' active' : '');
  localCard.innerHTML = `<h4>① Local-only (private, manual backup)</h4>
    <p>Everything stays in this browser. Use Export/Import below to move or back up your vault. Good for trying things out; not recommended long-term.</p>
    <button class="btn small" id="btn-use-local">Use this mode</button>`;
  localCard.querySelector('#btn-use-local').addEventListener('click', async () => { state.settings.syncMode = 'local'; await saveSettings(); updateHealthIndicator(); render(); showToast('Sync mode set to local-only'); });
  s.appendChild(localCard);

  // GitHub
  const ghCard = document.createElement('div');
  ghCard.className = 'sync-option-card' + (state.settings.syncMode === 'github' ? ' active' : '');
  const cfg = (() => { try { return JSON.parse(localStorage.getItem('nodalis-github-config') || 'null'); } catch { return null; } })() || {};
  ghCard.innerHTML = `<h4>② GitHub repo sync (cross-device, free)</h4>
    <p>Push/pull your markdown notes as real files in a GitHub repo — like Obsidian's community Git plugin, no server needed.
    <strong>Sensitive:</strong> the token below is stored only in this browser's local storage — use a fine-grained personal access token scoped to just this repo's Contents permission.</p>
    <div class="field-row"><label>Owner (user or org)</label><input id="gh-owner" value="${cfg.owner || ''}"></div>
    <div class="field-row"><label>Repository name</label><input id="gh-repo" value="${cfg.repo || ''}"></div>
    <div class="field-row"><label>Branch</label><input id="gh-branch" value="${cfg.branch || 'main'}"></div>
    <div class="field-row"><label>Folder in repo (e.g. "vault")</label><input id="gh-folder" value="${cfg.folder || 'vault'}"></div>
    <div class="field-row"><label>Personal access token</label><input id="gh-token" type="password" value="${cfg.token || ''}"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn small btn-primary" id="btn-gh-save">Save & use this mode</button>
      <button class="btn small" id="btn-gh-push">Push now</button>
      <button class="btn small" id="btn-gh-pull">Pull now</button>
    </div>`;
  ghCard.querySelector('#btn-gh-save').addEventListener('click', async () => {
    GitHub.saveConfig({
      owner: ghCard.querySelector('#gh-owner').value.trim(),
      repo: ghCard.querySelector('#gh-repo').value.trim(),
      branch: ghCard.querySelector('#gh-branch').value.trim() || 'main',
      folder: ghCard.querySelector('#gh-folder').value.trim() || 'vault',
      token: ghCard.querySelector('#gh-token').value.trim(),
    });
    try {
      await GitHub.testConnection();
      state.settings.syncMode = 'github';
      await saveSettings();
      updateHealthIndicator();
      showToast('Connected to GitHub — mode set to GitHub sync');
      bus.emit('celebrate', { emoji: '✅' });
      render();
    } catch (e) { showToast('Could not connect: ' + e.message, 'error'); }
  });
  ghCard.querySelector('#btn-gh-push').addEventListener('click', async () => {
    updateHealthIndicator('syncing');
    try { const r = await GitHub.push(); showToast(`Pushed ${r.pushed} notes to GitHub`); updateHealthIndicator(); }
    catch (e) { showToast('Push failed: ' + e.message, 'error'); updateHealthIndicator('error'); }
  });
  ghCard.querySelector('#btn-gh-pull').addEventListener('click', async () => {
    updateHealthIndicator('syncing');
    try { const r = await GitHub.pull(); showToast(`Pulled ${r.pulled} notes from GitHub`); updateHealthIndicator(); }
    catch (e) { showToast('Pull failed: ' + e.message, 'error'); updateHealthIndicator('error'); }
  });
  s.appendChild(ghCard);

  // File System Access
  const fsCard = document.createElement('div');
  fsCard.className = 'sync-option-card' + (state.settings.syncMode === 'fs' ? ' active' : '');
  if (FS.isSupported()) {
    fsCard.innerHTML = `<h4>③ Local folder (Chrome/Edge desktop, vault as real files)</h4>
      <p>Point Nodalis at a real folder on your computer — like an Obsidian vault. Once connected, every change is written to disk automatically (auto-backup, below) — even if this browser's cache is cleared, your notes are safe in that folder. Sync that folder yourself with Dropbox, Syncthing, or iCloud for cross-device access.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn small btn-primary" id="btn-fs-connect">Choose folder & use this mode</button>
        <button class="btn small" id="btn-fs-push">Push now</button>
        <button class="btn small" id="btn-fs-pull">Pull now</button>
      </div>`;
    fsCard.querySelector('#btn-fs-connect').addEventListener('click', async () => {
      try {
        const handle = await FS.pickDirectory();
        await FS.ensurePermission(handle);
        state.settings.syncMode = 'fs';
        await saveSettings();
        updateHealthIndicator();
        showToast('Connected — every change now auto-backs up to this folder');
        bus.emit('celebrate', { emoji: '✅' });
        render();
      } catch (e) { showToast('Could not connect: ' + e.message, 'error'); }
    });
    fsCard.querySelector('#btn-fs-push').addEventListener('click', async () => {
      const handle = await FS.getSavedDirectory();
      if (!handle) return showToast('Choose a folder first', 'error');
      await FS.ensurePermission(handle);
      updateHealthIndicator('syncing');
      try { const r = await FS.push(handle); showToast(`Wrote ${r.pushed} notes to folder`); updateHealthIndicator(); }
      catch (e) { showToast('Push failed: ' + e.message, 'error'); updateHealthIndicator('error'); }
    });
    fsCard.querySelector('#btn-fs-pull').addEventListener('click', async () => {
      const handle = await FS.getSavedDirectory();
      if (!handle) return showToast('Choose a folder first', 'error');
      await FS.ensurePermission(handle);
      updateHealthIndicator('syncing');
      try { const r = await FS.pull(handle); showToast(`Read ${r.pulled} notes from folder`); updateHealthIndicator(); }
      catch (e) { showToast('Pull failed: ' + e.message, 'error'); updateHealthIndicator('error'); }
    });
  } else {
    fsCard.innerHTML = `<h4>③ Local folder — not available in this browser</h4>
      <p>This requires the File System Access API (Chrome or Edge on desktop). Use GitHub sync or manual export/import instead.</p>`;
  }
  s.appendChild(fsCard);

  if (state.settings.syncMode === 'fs') {
    const autoRow = document.createElement('div');
    autoRow.className = 'settings-row';
    autoRow.innerHTML = `<div><div class="label">Continuous auto-backup</div><div class="desc">Write every change to the connected folder automatically (recommended)</div></div>`;
    const toggle = document.createElement('button');
    toggle.className = 'btn small' + (state.settings.autoBackup ? ' btn-primary' : '');
    toggle.textContent = state.settings.autoBackup ? 'On' : 'Off';
    toggle.addEventListener('click', async () => { state.settings.autoBackup = !state.settings.autoBackup; await saveSettings(); render(); });
    autoRow.appendChild(toggle);
    s.appendChild(autoRow);
  }

  return s;
}

async function templatesSection() {
  const s = section('Templates', 'templates');
  const templates = await getTemplates();
  templates.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'template-list-item';
    row.innerHTML = `<span>${t.name}</span>`;
    s.appendChild(row);
  });
  const hint = document.createElement('p');
  hint.className = 'desc';
  hint.textContent = 'Use the daily note button for the built-in Daily template, or start a new note and paste one of these bodies. Placeholders: {{date}}, {{time}}, {{title}}.';
  s.appendChild(hint);
  return s;
}

async function dataSection() {
  const s = section('Data & backup', 'data');
  const row = document.createElement('div');
  row.className = 'settings-row';
  row.innerHTML = `<div><div class="label">Export vault</div><div class="desc">Download every note + canvas as a .zip</div></div>`;
  const btn = document.createElement('button');
  btn.className = 'btn small btn-primary';
  btn.textContent = 'Export .zip';
  btn.addEventListener('click', () => ExportImport.exportZip().then(() => showToast('Vault exported')));
  row.appendChild(btn);
  s.appendChild(row);

  const importRow = document.createElement('div');
  importRow.className = 'settings-row';
  importRow.innerHTML = `<div><div class="label">Import vault</div><div class="desc">Restore or merge a .zip exported from Nodalis — comes back exactly as you left it</div></div>`;
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = '.zip'; fileInput.style.display = 'none';
  const importBtn = document.createElement('button');
  importBtn.className = 'btn small';
  importBtn.textContent = 'Choose .zip…';
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files[0]) return;
    try { const r = await ExportImport.importZip(fileInput.files[0]); showToast(`Imported ${r.imported} notes`); }
    catch (e) { showToast('Import failed: ' + e.message, 'error'); }
  });
  importRow.appendChild(importBtn);
  importRow.appendChild(fileInput);
  s.appendChild(importRow);

  const clearRow = document.createElement('div');
  clearRow.className = 'settings-row';
  clearRow.innerHTML = `<div><div class="label">Reset vault</div><div class="desc">Permanently delete all local notes, folders and canvases</div></div>`;
  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn small danger';
  clearBtn.textContent = 'Delete everything';
  clearBtn.addEventListener('click', async () => {
    if (confirm('This deletes ALL local notes, folders and canvases on this device. Export a backup first. Continue?')) {
      await Promise.all(['notes', 'folders', 'canvases'].map((store) => DB.clear(store)));
      location.reload();
    }
  });
  clearRow.appendChild(clearBtn);
  s.appendChild(clearRow);

  return s;
}

function shareSection() {
  const s = section('Share Nodalis', 'share');
  const row = document.createElement('div');
  row.className = 'settings-row';
  row.innerHTML = `<div><div class="label">Tell someone about Nodalis</div><div class="desc">Share the app itself (not a specific note)</div></div>`;
  const btn = document.createElement('button');
  btn.className = 'btn small btn-primary';
  btn.textContent = 'Share app';
  btn.addEventListener('click', async () => {
    const shareData = { title: 'Nodalis', text: 'Nodalis — a fast, local-first notes + canvas + graph app. Your knowledge, connected.', url: location.href.split('?')[0] };
    if (navigator.share) { try { await navigator.share(shareData); } catch { /* cancelled */ } }
    else if (navigator.clipboard) { await navigator.clipboard.writeText(shareData.url); showToast('Link copied to clipboard'); }
    else showToast('Sharing not supported in this browser', 'error');
  });
  row.appendChild(btn);
  s.appendChild(row);
  return s;
}

function aboutSection() {
  const s = section('About & help', 'about');
  const p = document.createElement('p');
  p.className = 'desc';
  p.innerHTML = `Nodalis is a local-first PWA inspired by Obsidian and AFFiNE, shaped directly by public user feedback (Reddit, Product Hunt, Hacker News, dev blogs) about what people find missing or frustrating in both. It has no server, no account, and no lock-in — your notes are plain markdown, always exportable. See the bundled README for the full feature list, credited feedback sources, and roadmap.`;
  s.appendChild(p);

  const row = document.createElement('div');
  row.className = 'settings-row';
  row.innerHTML = `<div><div class="label">Need a refresher?</div><div class="desc">Replay the guided tour or open the full feature manual</div></div>`;
  const btn = document.createElement('button');
  btn.className = 'btn small';
  btn.textContent = 'Open Help';
  btn.addEventListener('click', () => bus.emit('help:open'));
  row.appendChild(btn);
  s.appendChild(row);

  return s;
}

bus.on('vault:loaded', () => updateHealthIndicator());
bus.on('settings:changed', () => updateHealthIndicator());
