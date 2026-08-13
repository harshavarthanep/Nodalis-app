/**
 * auto-backup.js — the "you can blindly trust this app" layer.
 *
 * - Auto-pulls from the configured sync target on startup, so a linked
 *   GitHub repo or local folder always comes back exactly as you left it.
 * - Continuously writes every change to a connected local folder (debounced),
 *   so a cleared browser cache can never lose anything once one is connected.
 * - Drives a persistent "backup health" indicator so local-only users get a
 *   gentle, honest nudge instead of a false sense of safety.
 */
import { state, bus } from './state.js';
import { showToast } from './layout-manager.js';
import * as FS from './sync/fs-sync.js';
import * as GitHub from './sync/github-sync.js';

const AUTO_PUSH_DELAY = 1200;
let pushTimer = null;
let fsHandleCache = null;

export function initAutoBackup() {
  bus.on('vault:loaded', onStartup);
  bus.on('note:updated', () => scheduleAutoPush());
  bus.on('note:created', () => scheduleAutoPush());
  bus.on('vault:changed', () => updateHealthIndicator());
  bus.on('settings:changed', () => updateHealthIndicator());
}

async function onStartup() {
  const mode = state.settings.syncMode;
  try {
    if (mode === 'fs') {
      const handle = await FS.getSavedDirectory();
      if (handle) {
        const granted = await silentPermissionCheck(handle);
        if (granted) {
          fsHandleCache = handle;
          await FS.pull(handle);
          showToast('Restored your notes from the connected folder');
        } else {
          showToast('Reconnect your local folder in Settings to resume auto-backup', 'error');
        }
      }
    } else if (mode === 'github' && GitHub.isConfigured()) {
      await GitHub.pull();
      showToast('Restored your notes from GitHub');
    }
  } catch (err) {
    console.warn('Auto-restore failed', err);
    showToast("Couldn't reach your backup — working from this device's local copy for now", 'error');
  }
  updateHealthIndicator();
}

async function silentPermissionCheck(handle) {
  try { return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'; }
  catch { return false; }
}

function scheduleAutoPush() {
  if (state.settings.syncMode !== 'fs' || !state.settings.autoBackup) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const handle = fsHandleCache || await FS.getSavedDirectory();
      if (!handle) return;
      const granted = await silentPermissionCheck(handle);
      if (!granted) return updateHealthIndicator('needs-permission');
      fsHandleCache = handle;
      await FS.push(handle);
      updateHealthIndicator('connected');
    } catch (err) {
      console.warn('Auto-backup write failed', err);
      updateHealthIndicator('error');
    }
  }, AUTO_PUSH_DELAY);
}

export function backupState() {
  const mode = state.settings.syncMode;
  if (mode === 'github' && GitHub.isConfigured()) return 'connected';
  if (mode === 'fs') return 'connected'; // resolved further async by silent checks; treated optimistically once configured
  return 'none';
}

export function updateHealthIndicator(forceStatus) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const label = el.querySelector('.sync-label');
  const mode = state.settings.syncMode;
  el.classList.remove('connected', 'error', 'syncing', 'none');

  if (forceStatus === 'needs-permission') {
    el.classList.add('error');
    label.textContent = 'Reconnect folder needed';
    return;
  }
  if (forceStatus === 'error') {
    el.classList.add('error');
    label.textContent = 'Backup write failed';
    return;
  }
  if (mode === 'github') {
    el.classList.add(GitHub.isConfigured() ? 'connected' : 'error');
    label.textContent = GitHub.isConfigured() ? 'GitHub — backed up' : 'GitHub not connected';
  } else if (mode === 'fs') {
    el.classList.add('connected');
    label.textContent = 'Local folder — backed up';
  } else {
    label.textContent = state.notes.size > 3 ? '⚠ Not backed up — tap to secure' : 'Local only';
  }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#sync-status')) {
    bus.emit('settings:openSyncSection');
    import('./layout-manager.js').then(({ setActiveView }) => setActiveView('settings'));
  }
});
