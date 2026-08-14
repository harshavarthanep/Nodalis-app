/* =========================================================================
 * Nodalis — core/vault.js
 * Folder-first persistence.
 *
 * Design contract:
 *   1. If the browser can write to a real folder (File System Access API),
 *      that folder is the SOURCE OF TRUTH. Every change is written to disk
 *      per-file, within ~700ms, including deletes and renames.
 *   2. IndexedDB is a fast local mirror/cache, never the only copy.
 *   3. Where the API does not exist (iOS Safari, Firefox), we say so plainly,
 *      keep working from IndexedDB, and offer scheduled snapshot downloads
 *      so a cleared cache still cannot wipe someone's work silently.
 *
 * On-disk layout (deliberately Obsidian-compatible):
 *   MyVault/
 *     Folder/Note.md          <- plain markdown, yours forever
 *     .nodalis/
 *       canvases/<id>.json
 *       boards.json  stickies.json  tasks.json  scratch.json  journal.json
 *       settings.json
 *       attachments/<id>.<ext>
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const bus = N.bus;

  const APP_DIR = '.nodalis';
  const WRITE_DELAY = 650;          // debounce window for coalescing edits
  const MAX_RETRIES = 3;

  const vault = {
    mode: 'browser',                // 'folder' | 'browser'
    handle: null,                   // FileSystemDirectoryHandle when mode === 'folder'
    name: '',
    status: 'idle',                 // idle | syncing | ok | error | permission | unsupported
    lastError: '',
    lastWriteAt: 0,
    pendingCount: 0,
    supported: U.supports.fileSystemAccess,
  };

  /* ------------------------------------------------------------ write queue */

  const queue = new Map();          // key -> { type, run, retries }
  let flushTimer = null;
  let flushing = false;

  function enqueue(key, type, run) {
    queue.set(key, { type: type, run: run, retries: 0 });
    vault.pendingCount = queue.size;
    setStatus('syncing');
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, WRITE_DELAY);
  }

  async function flush() {
    if (flushing) return;
    if (vault.mode !== 'folder' || !vault.handle) { queue.clear(); vault.pendingCount = 0; setStatus('idle'); return; }
    if (!queue.size) { setStatus('ok'); return; }

    flushing = true;
    const ok = await ensurePermission(false);
    if (!ok) {
      flushing = false;
      setStatus('permission', 'Nodalis lost write access to your folder. Reconnect it to resume saving to disk.');
      return;
    }

    const jobs = Array.from(queue.entries());
    let failed = 0;
    for (const entry of jobs) {
      const key = entry[0], job = entry[1];
      try {
        await job.run();
        queue.delete(key);
      } catch (err) {
        job.retries++;
        console.warn('[vault] write failed (' + job.retries + '/' + MAX_RETRIES + ') for ' + key, err);
        if (job.retries >= MAX_RETRIES) {
          queue.delete(key);
          failed++;
          vault.lastError = U.describeError(err);
        }
      }
    }
    vault.pendingCount = queue.size;
    flushing = false;

    if (queue.size) {
      // Something is still pending (fresh edits or retries) — come back for it.
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, WRITE_DELAY * 2);
      return;
    }
    if (failed) setStatus('error', vault.lastError || 'Some files could not be written to disk.');
    else { vault.lastWriteAt = Date.now(); setStatus('ok'); }
  }

  /** Force everything out now — used before export, unload, and manual sync. */
  async function flushNow() {
    clearTimeout(flushTimer);
    let guard = 0;
    while (queue.size && guard++ < 10) {
      await flush();
      if (queue.size) await U.sleep(120);
    }
    return queue.size === 0;
  }

  function setStatus(status, message) {
    vault.status = status;
    if (message !== undefined) vault.lastError = message;
    bus.emit('vault:status', { status: status, message: message || '', pending: vault.pendingCount });
  }

  /* --------------------------------------------------------- fs primitives */

  async function getDir(root, path, create) {
    if (!path) return root;
    let dir = root;
    const parts = String(path).split('/').filter(Boolean);
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: !!create });
    }
    return dir;
  }

  async function writeFile(path, contents) {
    if (vault.mode !== 'folder' || !vault.handle) return false;
    const parts = String(path).split('/').filter(Boolean);
    const filename = parts.pop();
    if (!filename) throw new Error('Refusing to write a file with no name.');
    const dir = await getDir(vault.handle, parts.join('/'), true);
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(contents);
      await writable.close();
    } catch (err) {
      try { await writable.abort(); } catch (e2) { /* stream already dead */ }
      throw err;
    }
    return true;
  }

  async function readFile(path) {
    if (vault.mode !== 'folder' || !vault.handle) return null;
    const parts = String(path).split('/').filter(Boolean);
    const filename = parts.pop();
    try {
      const dir = await getDir(vault.handle, parts.join('/'), false);
      const fileHandle = await dir.getFileHandle(filename, { create: false });
      return await fileHandle.getFile();
    } catch (err) {
      if (err && (err.name === 'NotFoundError' || err.name === 'TypeMismatchError')) return null;
      throw err;
    }
  }

  async function removeFile(path) {
    if (vault.mode !== 'folder' || !vault.handle) return false;
    const parts = String(path).split('/').filter(Boolean);
    const filename = parts.pop();
    try {
      const dir = await getDir(vault.handle, parts.join('/'), false);
      await dir.removeEntry(filename);
      return true;
    } catch (err) {
      // Already gone is a success from the caller's point of view.
      if (err && err.name === 'NotFoundError') return true;
      throw err;
    }
  }

  async function removeDir(path) {
    if (vault.mode !== 'folder' || !vault.handle || !path) return false;
    const parts = String(path).split('/').filter(Boolean);
    const name = parts.pop();
    try {
      const parent = await getDir(vault.handle, parts.join('/'), false);
      await parent.removeEntry(name, { recursive: true });
      return true;
    } catch (err) {
      if (err && err.name === 'NotFoundError') return true;
      throw err;
    }
  }

  async function ensureDir(path) {
    if (vault.mode !== 'folder' || !vault.handle || !path) return false;
    await getDir(vault.handle, path, true);
    return true;
  }

  /** Recursively list markdown files, skipping app/system folders. */
  async function walkMarkdown(dirHandle, prefix, out, budget) {
    const list = out || [];
    const cap = budget || { remaining: 20000 };
    for await (const entry of dirHandle.values()) {
      if (cap.remaining <= 0) break;
      const name = entry.name;
      if (name.startsWith('.')) continue;                 // .nodalis, .git, .obsidian
      const path = prefix ? prefix + '/' + name : name;
      if (entry.kind === 'file') {
        if (/\.md$/i.test(name)) { list.push({ path: path, handle: entry }); cap.remaining--; }
      } else if (entry.kind === 'directory') {
        await walkMarkdown(entry, path, list, cap);
      }
    }
    return list;
  }

  /* ------------------------------------------------------------- connecting */

  /** Show the OS folder picker and adopt that folder as the vault. */
  async function connectFolder() {
    if (!U.supports.fileSystemAccess) {
      const err = new Error('This browser cannot write directly to a folder.');
      err.name = 'UnsupportedError';
      throw err;
    }
    const handle = await window.showDirectoryPicker({
      id: 'nodalis-vault',
      mode: 'readwrite',
      startIn: 'documents',
    });
    const granted = await requestPermissionFor(handle);
    if (!granted) {
      const err = new Error('Write access to that folder was declined.');
      err.name = 'NotAllowedError';
      throw err;
    }
    vault.handle = handle;
    vault.name = handle.name;
    vault.mode = 'folder';
    await N.db.setSetting('fs-dir-handle', handle);
    await N.db.setSetting('vault-mode', 'folder');
    await N.db.setSetting('vault-name', handle.name);
    setStatus('ok', '');
    bus.emit('vault:connected', { name: handle.name });
    return handle;
  }

  async function disconnectFolder() {
    await flushNow();
    vault.handle = null;
    vault.mode = 'browser';
    vault.name = '';
    await N.db.setSetting('fs-dir-handle', null);
    await N.db.setSetting('vault-mode', 'browser');
    setStatus('idle', '');
    bus.emit('vault:disconnected');
  }

  async function requestPermissionFor(handle) {
    if (!handle || !handle.requestPermission) return false;
    try {
      const opts = { mode: 'readwrite' };
      if ((await handle.queryPermission(opts)) === 'granted') return true;
      return (await handle.requestPermission(opts)) === 'granted';
    } catch (err) {
      console.warn('[vault] permission request failed', err);
      return false;
    }
  }

  /** Silent check (no user gesture) — used before background writes. */
  async function ensurePermission(interactive) {
    if (vault.mode !== 'folder' || !vault.handle) return false;
    try {
      const state = await vault.handle.queryPermission({ mode: 'readwrite' });
      if (state === 'granted') return true;
      if (!interactive) return false;
      return (await vault.handle.requestPermission({ mode: 'readwrite' })) === 'granted';
    } catch (err) {
      return false;
    }
  }

  /**
   * Restore a previously-chosen folder on startup. Browsers keep the handle but
   * often drop the permission, which needs a click to restore — we never lie
   * about being connected when we actually cannot write.
   */
  async function restore() {
    if (!U.supports.fileSystemAccess) { setStatus('unsupported'); return { restored: false, reason: 'unsupported' }; }
    let handle = null;
    try { handle = await N.db.getSetting('fs-dir-handle', null); }
    catch (err) { handle = null; }
    if (!handle || typeof handle.queryPermission !== 'function') {
      setStatus('idle');
      return { restored: false, reason: 'none' };
    }
    vault.handle = handle;
    vault.name = handle.name || (await N.db.getSetting('vault-name', '')) || 'vault';
    const granted = await ensurePermission(false);
    if (granted) {
      vault.mode = 'folder';
      setStatus('ok', '');
      bus.emit('vault:connected', { name: vault.name, restored: true });
      return { restored: true, name: vault.name };
    }
    // Handle survived, permission did not. Keep it so one click reconnects.
    vault.mode = 'browser';
    setStatus('permission', 'Reconnect "' + vault.name + '" to resume saving to your folder.');
    return { restored: false, reason: 'permission', name: vault.name };
  }

  /** One-click reconnect from a real user gesture. */
  async function reconnect() {
    if (!vault.handle) return connectFolder();
    const granted = await requestPermissionFor(vault.handle);
    if (!granted) { setStatus('permission'); return null; }
    vault.mode = 'folder';
    vault.name = vault.handle.name;
    await N.db.setSetting('vault-mode', 'folder');
    setStatus('ok', '');
    bus.emit('vault:connected', { name: vault.name, reconnected: true });
    return vault.handle;
  }

  /* ---------------------------------------------------- high-level writers */

  function isFolderMode() { return vault.mode === 'folder' && !!vault.handle; }

  function saveNote(note) {
    if (!isFolderMode() || !note) return;
    const path = note.path;
    enqueue('note:' + note.id, 'note', async function () {
      await writeFile(path, N.serialize ? N.serialize.noteToFile(note) : note.content);
    });
  }

  function deleteNoteFile(path) {
    if (!isFolderMode() || !path) return;
    enqueue('del:' + path, 'delete', async function () { await removeFile(path); });
  }

  function renameNoteFile(oldPath, newPath, note) {
    if (!isFolderMode()) return;
    enqueue('rename:' + oldPath, 'rename', async function () {
      await writeFile(newPath, N.serialize ? N.serialize.noteToFile(note) : note.content);
      if (oldPath && oldPath !== newPath) await removeFile(oldPath);
    });
  }

  function saveFolder(path) {
    if (!isFolderMode() || !path) return;
    enqueue('mkdir:' + path, 'mkdir', async function () { await ensureDir(path); });
  }

  function deleteFolderDir(path) {
    if (!isFolderMode() || !path) return;
    enqueue('rmdir:' + path, 'rmdir', async function () { await removeDir(path); });
  }

  /** App data (canvases, stickies, tasks…) lives as JSON under .nodalis/. */
  function saveAppData(name, data) {
    if (!isFolderMode()) return;
    enqueue('app:' + name, 'app', async function () {
      await writeFile(APP_DIR + '/' + name, JSON.stringify(data, null, 2));
    });
  }

  function deleteAppData(name) {
    if (!isFolderMode()) return;
    enqueue('appdel:' + name, 'app', async function () { await removeFile(APP_DIR + '/' + name); });
  }

  async function readAppData(name) {
    if (!isFolderMode()) return null;
    try {
      const file = await readFile(APP_DIR + '/' + name);
      if (!file) return null;
      const text = await file.text();
      if (!text.trim()) return null;
      return JSON.parse(text);
    } catch (err) {
      console.warn('[vault] could not read ' + name, err);
      return null;
    }
  }

  function saveAttachment(id, ext, blob) {
    if (!isFolderMode()) return;
    enqueue('att:' + id, 'attachment', async function () {
      await writeFile(APP_DIR + '/attachments/' + id + (ext || ''), blob);
    });
  }

  async function readAttachment(id, ext) {
    if (!isFolderMode()) return null;
    return readFile(APP_DIR + '/attachments/' + id + (ext || ''));
  }

  /* ------------------------------------------------------- full sync passes */

  /** Write the entire vault to disk. Used right after connecting a folder. */
  async function pushAll(onProgress) {
    if (!isFolderMode()) return { written: 0, skipped: true };
    const granted = await ensurePermission(true);
    if (!granted) throw Object.assign(new Error('Write access was denied.'), { name: 'NotAllowedError' });

    const notes = N.store ? Array.from(N.store.state.notes.values()) : [];
    const folders = N.store ? Array.from(N.store.state.folders.values()) : [];
    let written = 0;
    const total = notes.length + 1;

    for (const folder of folders) {
      try { await ensureDir(folder.path); } catch (err) { console.warn('[vault] mkdir failed', folder.path, err); }
    }
    await U.chunked(notes, 25, async function (note) {
      try { await writeFile(note.path, N.serialize.noteToFile(note)); written++; }
      catch (err) { console.warn('[vault] could not write ' + note.path, err); }
      if (onProgress) onProgress(written, total);
    });
    await pushAppData();
    vault.lastWriteAt = Date.now();
    setStatus('ok', '');
    return { written: written, total: notes.length };
  }

  async function pushAppData() {
    if (!isFolderMode() || !N.store) return;
    const s = N.store.state;
    try {
      await writeFile(APP_DIR + '/stickies.json', JSON.stringify(Array.from(s.stickies.values()), null, 2));
      await writeFile(APP_DIR + '/tasks.json', JSON.stringify(Array.from(s.tasks.values()), null, 2));
      await writeFile(APP_DIR + '/scratch.json', JSON.stringify(Array.from(s.scratch.values()), null, 2));
      await writeFile(APP_DIR + '/journal.json', JSON.stringify(Array.from(s.journal.values()), null, 2));
      await writeFile(APP_DIR + '/settings.json', JSON.stringify(s.settings, null, 2));
      for (const canvas of s.canvases.values()) {
        await writeFile(APP_DIR + '/canvases/' + canvas.id + '.json', JSON.stringify(canvas, null, 2));
      }
    } catch (err) {
      console.warn('[vault] app-data push failed', err);
    }
  }

  /**
   * Read the folder back into the app. Disk wins on conflict — the folder is
   * the source of truth, so an edit made in Obsidian or a text editor survives.
   */
  async function pullAll(onProgress) {
    if (!isFolderMode()) return { pulled: 0, skipped: true };
    const granted = await ensurePermission(false);
    if (!granted) throw Object.assign(new Error('No permission to read the folder.'), { name: 'NotAllowedError' });

    const files = await walkMarkdown(vault.handle, '', [], { remaining: 20000 });
    let pulled = 0, created = 0, updated = 0;
    const seenPaths = new Set();

    await U.chunked(files, 20, async function (f) {
      try {
        const file = await f.handle.getFile();
        const text = await file.text();
        seenPaths.add(f.path);
        const result = await N.store.upsertFromDisk(f.path, text, file.lastModified);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        pulled++;
      } catch (err) {
        console.warn('[vault] could not read ' + f.path, err);
      }
      if (onProgress) onProgress(pulled, files.length);
    });

    // Files removed on disk (e.g. deleted in Obsidian) should disappear here too.
    if (files.length > 0) await N.store.reconcileDeletions(seenPaths);

    await pullAppData();
    bus.emit('vault:pulled', { pulled: pulled, created: created, updated: updated });
    return { pulled: pulled, created: created, updated: updated };
  }

  async function pullAppData() {
    if (!isFolderMode() || !N.store) return;
    const load = async function (name, apply) {
      const data = await readAppData(name);
      if (data) { try { await apply(data); } catch (err) { console.warn('[vault] apply ' + name, err); } }
    };
    await load('stickies.json', (d) => N.store.replaceCollection('stickies', d));
    await load('tasks.json', (d) => N.store.replaceCollection('tasks', d));
    await load('scratch.json', (d) => N.store.replaceCollection('scratch', d));
    await load('journal.json', (d) => N.store.replaceCollection('journal', d));

    // Canvases are one file each.
    try {
      const appDir = await getDir(vault.handle, APP_DIR, false).catch(() => null);
      if (appDir) {
        const canvasDir = await appDir.getDirectoryHandle('canvases', { create: false }).catch(() => null);
        if (canvasDir) {
          const canvases = [];
          for await (const entry of canvasDir.values()) {
            if (entry.kind !== 'file' || !/\.json$/i.test(entry.name)) continue;
            try {
              const text = await (await entry.getFile()).text();
              const parsed = JSON.parse(text);
              if (parsed && parsed.id) canvases.push(parsed);
            } catch (err) { console.warn('[vault] bad canvas file ' + entry.name, err); }
          }
          if (canvases.length) await N.store.replaceCollection('canvases', canvases);
        }
      }
    } catch (err) { console.warn('[vault] canvas pull failed', err); }
  }

  /* --------------------------------------------------- snapshot safety net */

  /**
   * For browsers without folder access: periodically hand the user a real file
   * they can keep. Manual by default (browsers block silent downloads), but the
   * reminder is persistent and honest rather than a one-time toast.
   */
  async function shouldRemindSnapshot(intervalDays) {
    if (isFolderMode()) return false;
    const last = await N.db.getMeta('last-snapshot-at', 0);
    const days = intervalDays || 3;
    return (Date.now() - (last || 0)) > days * 86400000;
  }

  async function markSnapshotTaken() {
    await N.db.setMeta('last-snapshot-at', Date.now());
    bus.emit('vault:snapshot-taken');
  }

  /* ------------------------------------------------------------------ info */

  function describe() {
    if (isFolderMode()) return { mode: 'folder', label: vault.name, safe: true };
    if (!U.supports.fileSystemAccess) {
      return {
        mode: 'browser', label: 'This device only', safe: false,
        reason: U.supports.isIOS
          ? 'iOS browsers cannot write directly to a folder. Your notes are stored on this device — export a backup regularly.'
          : 'This browser cannot write directly to a folder. Your notes are stored on this device — export a backup regularly.',
      };
    }
    if (vault.status === 'permission') {
      return { mode: 'browser', label: 'Reconnect needed', safe: false, reason: vault.lastError };
    }
    return {
      mode: 'browser', label: 'This device only', safe: false,
      reason: 'Your notes live in this browser. Clearing site data would erase them — connect a folder to keep them on disk.',
    };
  }

  N.vault = {
    state: vault,
    APP_DIR: APP_DIR,
    connectFolder: connectFolder, disconnectFolder: disconnectFolder,
    restore: restore, reconnect: reconnect, ensurePermission: ensurePermission,
    isFolderMode: isFolderMode, describe: describe,
    saveNote: saveNote, deleteNoteFile: deleteNoteFile, renameNoteFile: renameNoteFile,
    saveFolder: saveFolder, deleteFolderDir: deleteFolderDir,
    saveAppData: saveAppData, deleteAppData: deleteAppData, readAppData: readAppData,
    saveAttachment: saveAttachment, readAttachment: readAttachment,
    pushAll: pushAll, pullAll: pullAll, pushAppData: pushAppData,
    flushNow: flushNow, writeFile: writeFile, readFile: readFile, removeFile: removeFile,
    ensureDir: ensureDir, walkMarkdown: walkMarkdown,
    shouldRemindSnapshot: shouldRemindSnapshot, markSnapshotTaken: markSnapshotTaken,
    pending: function () { return queue.size; },
  };
})(window.NODALIS = window.NODALIS || {});
