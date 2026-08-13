/**
 * settings.js — renders the Settings view: appearance, sync (3 modes), templates, data, about.
 */
import { state, bus, saveSettings } from './state.js';
import { showToast } from './layout-manager.js';
import * as GitHub from './sync/github-sync.js';
import * as FS from './sync/fs-sync.js';
import * as ExportImport from './sync/export-import.js';
import { getTemplates } from './templates.js';
import { DB } from './db.js';

export function initSettings() {
  bus.on('view:changed', (v) => { if (v === 'settings') render(); });
  bus.on('sync:export', () => ExportImport.exportZip().then(() => showToast('Vault exported')));
  bus.on('sync:now', () => quickSyncNow());
  render();
}

async function quickSyncNow() {
  if (state.settings.syncMode === 'github') {
    try { await GitHub.push(); await GitHub.pull(); showToast('Synced with GitHub'); }
    catch (e) { showToast('Sync failed: ' + e.message, 'error'); }
  } else if (state.settings.syncMode === 'fs') {
    try {
      const handle = await FS.getSavedDirectory();
      if (!handle || !(await FS.ensurePermission(handle))) return showToast('Reconnect your local folder in Settings', 'error');
      await FS.push(handle); await FS.pull(handle);
      showToast('Synced with local folder');
    } catch (e) { showToast('Sync failed: ' + e.message, 'error'); }
  } else {
    showToast('Local-only mode — use Export to back up your vault');
  }
}

async function render() {
  const root = document.getElementById('settings-container');
  root.innerHTML = '';
  root.appendChild(await appearanceSection());
  root.appendChild(await syncSection());
  root.appendChild(await templatesSection());
  root.appendChild(await dataSection());
  root.appendChild(aboutSection());
}

function section(title) {
  const s = document.createElement('div');
  s.className = 'settings-section';
  s.innerHTML = `<h3>${title}</h3>`;
  return s;
}

async function appearanceSection() {
  const s = section('Appearance');
  const row = document.createElement('div');
  row.className = 'settings-row';
  row.innerHTML = `<div><div class="label">Theme</div><div class="desc">Light, dark, or match your system setting</div></div>`;
  const select = document.createElement('select');
  ['auto', 'light', 'dark'].forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v[0].toUpperCase() + v.slice(1);
    if (state.settings.theme === v) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', async () => {
    state.settings.theme = select.value;
    document.body.dataset.theme = select.value;
    await saveSettings();
  });
  row.appendChild(select);
  s.appendChild(row);
  return s;
}

async function syncSection() {
  const s = section('Sync — choose anytime, switch anytime');
  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.style.marginBottom = '14px';
  desc.textContent = 'GitHub Pages only serves static files, so Nodalis never needs a server: pick whichever of these fits how you work.';
  s.appendChild(desc);

  // Local only
  const localCard = document.createElement('div');
  localCard.className = 'sync-option-card' + (state.settings.syncMode === 'local' ? ' active' : '');
  localCard.innerHTML = `<h4>① Local-only (private, manual backup)</h4>
    <p>Everything stays in this browser. Use Export/Import below to move or back up your vault.</p>
    <button class="btn small" id="btn-use-local">Use this mode</button>`;
  localCard.querySelector('#btn-use-local').addEventListener('click', async () => { state.settings.syncMode = 'local'; await saveSettings(); updateSyncStatus(); render(); showToast('Sync mode set to local-only'); });
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
      updateSyncStatus();
      showToast('Connected to GitHub — mode set to GitHub sync');
      render();
    } catch (e) { showToast('Could not connect: ' + e.message, 'error'); }
  });
  ghCard.querySelector('#btn-gh-push').addEventListener('click', async () => {
    updateSyncStatus('syncing');
    try { const r = await GitHub.push(); showToast(`Pushed ${r.pushed} notes to GitHub`); updateSyncStatus('connected'); }
    catch (e) { showToast('Push failed: ' + e.message, 'error'); updateSyncStatus('error'); }
  });
  ghCard.querySelector('#btn-gh-pull').addEventListener('click', async () => {
    updateSyncStatus('syncing');
    try { const r = await GitHub.pull(); showToast(`Pulled ${r.pulled} notes from GitHub`); updateSyncStatus('connected'); }
    catch (e) { showToast('Pull failed: ' + e.message, 'error'); updateSyncStatus('error'); }
  });
  s.appendChild(ghCard);

  // File System Access
  const fsCard = document.createElement('div');
  fsCard.className = 'sync-option-card' + (state.settings.syncMode === 'fs' ? ' active' : '');
  if (FS.isSupported()) {
    fsCard.innerHTML = `<h4>③ Local folder (Chrome/Edge desktop, vault as real files)</h4>
      <p>Point Nodalis at a real folder on your computer — like an Obsidian vault — then sync that folder yourself with Dropbox, Syncthing, or iCloud.</p>
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
        updateSyncStatus('connected');
        showToast('Connected to local folder — mode set to local-folder sync');
      } catch (e) { showToast('Could not connect: ' + e.message, 'error'); }
    });
    fsCard.querySelector('#btn-fs-push').addEventListener('click', async () => {
      const handle = await FS.getSavedDirectory();
      if (!handle) return showToast('Choose a folder first', 'error');
      await FS.ensurePermission(handle);
      updateSyncStatus('syncing');
      try { const r = await FS.push(handle); showToast(`Wrote ${r.pushed} notes to folder`); updateSyncStatus('connected'); }
      catch (e) { showToast('Push failed: ' + e.message, 'error'); updateSyncStatus('error'); }
    });
    fsCard.querySelector('#btn-fs-pull').addEventListener('click', async () => {
      const handle = await FS.getSavedDirectory();
      if (!handle) return showToast('Choose a folder first', 'error');
      await FS.ensurePermission(handle);
      updateSyncStatus('syncing');
      try { const r = await FS.pull(handle); showToast(`Read ${r.pulled} notes from folder`); updateSyncStatus('connected'); }
      catch (e) { showToast('Pull failed: ' + e.message, 'error'); updateSyncStatus('error'); }
    });
  } else {
    fsCard.innerHTML = `<h4>③ Local folder — not available in this browser</h4>
      <p>This requires the File System Access API (Chrome or Edge on desktop). Use GitHub sync or manual export/import instead.</p>`;
  }
  s.appendChild(fsCard);

  return s;
}

async function templatesSection() {
  const s = section('Templates');
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
  const s = section('Data & backup');
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
  importRow.innerHTML = `<div><div class="label">Import vault</div><div class="desc">Restore or merge a .zip exported from Nodalis</div></div>`;
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

function aboutSection() {
  const s = section('About Nodalis');
  const p = document.createElement('p');
  p.className = 'desc';
  p.innerHTML = `Nodalis is a local-first PWA inspired by Obsidian and AFFiNE, shaped directly by public user feedback (Reddit, Product Hunt, Hacker News, dev blogs) about what people find missing or frustrating in both. It has no server, no account, and no lock-in — your notes are plain markdown, always exportable. See the bundled README for the full feature list, credited feedback sources, and roadmap.`;
  s.appendChild(p);
  return s;
}

function updateSyncStatus(status) {
  const el = document.getElementById('sync-status');
  const label = el.querySelector('.sync-label');
  el.classList.remove('connected', 'error', 'syncing');
  if (status === 'syncing') { el.classList.add('syncing'); label.textContent = 'Syncing…'; return; }
  if (status === 'error') { el.classList.add('error'); label.textContent = 'Sync error'; return; }
  const mode = state.settings.syncMode;
  if (mode === 'github') { el.classList.add('connected'); label.textContent = 'GitHub sync'; }
  else if (mode === 'fs') { el.classList.add('connected'); label.textContent = 'Local folder sync'; }
  else { label.textContent = 'Local only'; }
}

bus.on('vault:loaded', () => updateSyncStatus());
bus.on('settings:changed', () => updateSyncStatus());
