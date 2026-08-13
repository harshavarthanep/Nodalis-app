/**
 * app.js — bootstraps Nodalis: loads the vault, wires up every module,
 * registers the service worker, and handles the PWA install prompt.
 */
import { state, bus, loadAll, noteTitle } from './state.js';
import { initLayout, setActiveView, showToast } from './layout-manager.js';
import { initSidebar } from './sidebar.js';
import { initEditor } from './editor.js';
import { initBacklinks } from './backlinks.js';
import { initGraph } from './graph.js';
import { initCanvasBoard } from './canvas.js';
import { initDatabaseView } from './database-view.js';
import { initCommandPalette } from './command-palette.js';
import { initDailyNotes } from './daily-notes.js';
import { initSettings } from './settings.js';
import { initTheme } from './theme.js';

async function main() {
  initLayout();
  initTheme();
  initSidebar();
  initEditor();
  initBacklinks();
  initGraph();
  initCanvasBoard();
  initDatabaseView();
  initCommandPalette();
  initDailyNotes();
  initSettings();

  await loadAll();

  // Open the most recently updated note by default (desktop/tablet only —
  // mobile starts on the file list so first-time users see their vault).
  const isNarrow = window.matchMedia('(max-width: 699px)').matches;
  const notes = [...state.notes.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  if (notes.length && !isNarrow) {
    bus.emit('note:open', notes[0].id);
  }

  handleShortcutParams();
  registerServiceWorker();
  setupInstallPrompt();
}

function handleShortcutParams() {
  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  if (action === 'new-note') document.getElementById('btn-new-note').click();
  else if (action === 'daily-note') bus.emit('daily-note:open');
  else if (action === 'graph') setActiveView('graph');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const doRegister = () => navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW registration failed', err));
  // The page's "load" event may have already fired by the time our async
  // bootstrap (IndexedDB, etc.) finishes, so don't gate registration on an
  // event that could be missed — register immediately once ready.
  if (document.readyState === 'complete') doRegister();
  else window.addEventListener('load', doRegister);
}

function setupInstallPrompt() {
  let deferredPrompt = null;
  const btn = document.getElementById('btn-install');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.remove('hidden');
  });
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('Nodalis installed');
    deferredPrompt = null;
    btn.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => btn.classList.add('hidden'));
}

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

main().catch((err) => {
  console.error('Failed to start Nodalis', err);
  document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;">
    <h2>Nodalis failed to start</h2><p>${(err && err.message) || err}</p>
    <p>Try reloading. If the problem persists, clear this site's storage from your browser settings.</p></div>`;
});
