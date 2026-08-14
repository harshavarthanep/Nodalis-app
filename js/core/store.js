/* =========================================================================
 * Nodalis — core/store.js
 * The single source of truth in memory. Every mutation:
 *   1. updates the in-memory maps,
 *   2. persists to IndexedDB (fast local mirror),
 *   3. queues a write to the connected folder (durable copy),
 *   4. emits an event so the UI re-renders,
 *   5. records an undo step where the action is destructive.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const bus = N.bus;
  const db = N.db;
  const S = N.serialize;

  const DEFAULT_SETTINGS = {
    /* appearance */
    themeStyle: 'nodalis',            // nodalis | notion | nothing | glass
    themeMode: 'auto-system',         // light | dark | auto-system | auto-time
    glassShade: 'clear',              // clear | dark
    glassIntensity: 'medium',         // subtle | medium | vivid
    accent: '#6c5ce7',
    uiFont: 'default',                // default | inter | grotesk | mono | dot | system
    editorFont: 'sans',               // sans | serif | mono | dot | inherit
    fontSize: 16,
    lineHeight: 1.7,
    contentWidth: 'comfortable',      // narrow | comfortable | wide | full
    density: 'comfortable',           // compact | comfortable | roomy
    animations: 'full',               // full | reduced | none
    ambientBackground: true,
    roundness: 'default',             // sharp | default | soft
    showLoaderOnStart: true,

    /* editor */
    livePreview: true,
    editorMode: 'split',              // edit | preview | split
    spellcheck: false,
    vimMode: false,
    autoPairBrackets: true,
    smartLists: true,
    tabSize: 2,
    showLineNumbers: false,
    typewriterMode: false,
    focusMode: false,

    /* behaviour */
    autoSaveDelay: 400,
    confirmDelete: true,
    openLinksInNewPane: false,
    defaultNewNoteFolder: '',
    dailyNoteFolder: 'Daily',
    dailyNoteTemplate: '',
    weekStartsOn: 1,

    /* features on/off */
    visibleViews: { editor: true, graph: true, canvas: true, database: true, tasks: true, matrix: true, sticky: true, scratch: true, review: true },
    visibleSidebarTabs: { files: true, tags: true, canvases: true, recent: true },

    /* data */
    autoBackupToFolder: true,
    snapshotReminderDays: 3,
    firstRunComplete: false,
    tourCompleted: false,

    /* keymap overrides: commandId -> "Mod+Shift+K" */
    keymap: {},
  };

  const state = {
    notes: new Map(),
    folders: new Map(),
    canvases: new Map(),
    stickies: new Map(),
    tasks: new Map(),
    scratch: new Map(),
    journal: new Map(),          // dayKey -> { day, notes, streakCounted, ... }
    settings: U.deepClone(DEFAULT_SETTINGS),

    activeNoteId: null,
    activeView: 'editor',
    activeCanvasId: null,
    recentNoteIds: [],
    loaded: false,
    dirtyNoteIds: new Set(),
  };

  /* ------------------------------------------------------------ undo stack */

  const undoStack = [];
  const redoStack = [];
  const UNDO_LIMIT = 60;

  function pushUndo(label, undoFn, redoFn) {
    undoStack.push({ label: label, undo: undoFn, redo: redoFn, at: Date.now() });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;
    bus.emit('undo:changed');
  }

  async function undo() {
    const entry = undoStack.pop();
    if (!entry) return null;
    try { await entry.undo(); redoStack.push(entry); bus.emit('undo:changed'); return entry.label; }
    catch (err) { console.error('[store] undo failed', err); return null; }
  }

  async function redo() {
    const entry = redoStack.pop();
    if (!entry) return null;
    try { await entry.redo(); undoStack.push(entry); bus.emit('undo:changed'); return entry.label; }
    catch (err) { console.error('[store] redo failed', err); return null; }
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }
  function lastUndoLabel() { return undoStack.length ? undoStack[undoStack.length - 1].label : null; }

  /* ---------------------------------------------------------------- loading */

  async function loadAll() {
    const [notes, folders, canvases, stickies, tasks, scratch, journal] = await Promise.all([
      db.getAll('notes'), db.getAll('folders'), db.getAll('canvases'),
      db.getAll('stickies'), db.getAll('tasks'), db.getAll('scratch'), db.getAll('journal'),
    ]);

    fill(state.notes, notes, 'id');
    fill(state.folders, folders, 'id');
    fill(state.canvases, canvases, 'id');
    fill(state.stickies, stickies, 'id');
    fill(state.tasks, tasks, 'id');
    fill(state.scratch, scratch, 'id');
    fill(state.journal, journal, 'day');

    const saved = await db.getSetting('settings', null);
    if (saved && typeof saved === 'object') {
      state.settings = U.deepMerge(U.deepClone(DEFAULT_SETTINGS), saved);
      migrateSettings(state.settings);
    }

    const recent = await db.getMeta('recent-notes', []);
    state.recentNoteIds = Array.isArray(recent) ? recent.filter((id) => state.notes.has(id)) : [];

    // Repair any notes that lost derived fields (older builds, partial writes).
    let repaired = 0;
    state.notes.forEach(function (note) {
      if (!note.id) return;
      if (!Array.isArray(note.tags) || !Array.isArray(note.links) || note.words === undefined) {
        reindexNote(note); repaired++;
      }
      if (!note.path) { note.path = buildPath(note.folder || '', note.title || 'Untitled'); repaired++; }
    });
    if (repaired) await db.bulkPut('notes', Array.from(state.notes.values()));

    state.loaded = true;
    bus.emit('vault:loaded', { notes: state.notes.size });
    return { notes: state.notes.size, folders: state.folders.size };
  }

  function fill(map, rows, key) {
    map.clear();
    (rows || []).forEach(function (row) { if (row && row[key] !== undefined) map.set(row[key], row); });
  }

  function migrateSettings(s) {
    // v1 stored a single `theme` value.
    if (s.theme && !s.themeStyle) {
      s.themeStyle = ['glass', 'nothing', 'notion'].indexOf(s.theme) !== -1 ? s.theme : 'nodalis';
      s.themeMode = s.theme === 'auto' ? 'auto-system' : (s.theme === 'dark' ? 'dark' : 'light');
      delete s.theme;
    }
    if (s.editorFont === 'mono' && s.uiFont === undefined) s.uiFont = 'default';
    if (typeof s.fontSize !== 'number' || s.fontSize < 11 || s.fontSize > 28) s.fontSize = 16;
    if (typeof s.lineHeight !== 'number' || s.lineHeight < 1.1 || s.lineHeight > 2.6) s.lineHeight = 1.7;
    if (!s.visibleViews || typeof s.visibleViews !== 'object') s.visibleViews = U.deepClone(DEFAULT_SETTINGS.visibleViews);
    if (!s.keymap || typeof s.keymap !== 'object') s.keymap = {};
    return s;
  }

  async function saveSettings(patch) {
    if (patch) U.deepMerge(state.settings, patch);
    await db.setSetting('settings', state.settings);
    if (N.vault && N.vault.isFolderMode()) N.vault.saveAppData('settings.json', state.settings);
    bus.emit('settings:changed', state.settings);
  }

  function setSetting(key, value) {
    const parts = key.split('.');
    let target = state.settings;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!U.isPlainObject(target[parts[i]])) target[parts[i]] = {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
    return saveSettings();
  }

  function getSetting(key, fallback) {
    const parts = key.split('.');
    let target = state.settings;
    for (let i = 0; i < parts.length; i++) {
      if (target === null || target === undefined) return fallback;
      target = target[parts[i]];
    }
    return target === undefined ? fallback : target;
  }

  /* ------------------------------------------------------------------ notes */

  function noteTitle(note) {
    if (!note) return 'Untitled';
    return note.title || String(note.path || '').split('/').pop().replace(/\.md$/i, '') || 'Untitled';
  }

  function buildPath(folder, title) {
    const safe = U.safeFileName(title, 'Untitled');
    return (folder ? folder + '/' : '') + safe + '.md';
  }

  function uniquePath(folder, title, exceptId) {
    let candidate = buildPath(folder, title);
    const taken = new Set();
    state.notes.forEach(function (n) { if (n.id !== exceptId) taken.add(n.path.toLowerCase()); });
    if (!taken.has(candidate.toLowerCase())) return candidate;
    let i = 2;
    while (i < 9999) {
      candidate = buildPath(folder, title + ' ' + i);
      if (!taken.has(candidate.toLowerCase())) return candidate;
      i++;
    }
    return buildPath(folder, title + ' ' + U.uid(''));
  }

  /** Recompute every derived field on a note. Cheap enough to always run. */
  function reindexNote(note) {
    const parsed = S.parseFrontmatter(note.content || '');
    // Frontmatter written inside `content` is normalised out into properties.
    if (parsed.hadFrontmatter) {
      note.properties = Object.assign({}, note.properties, parsed.properties);
      note.content = parsed.body;
    }
    if (!note.properties) note.properties = {};
    const body = note.content || '';
    note.tags = S.extractTags(body);
    const propTags = S.normalizeList(note.properties.tags || note.properties.tag);
    propTags.forEach(function (t) {
      const clean = String(t).replace(/^#/, '');
      if (clean && note.tags.indexOf(clean) === -1) note.tags.push(clean);
    });
    note.links = S.extractLinks(body).map(function (l) { return l.target; });
    note.aliases = S.normalizeList(note.properties.aliases || note.properties.alias);
    note.blockIds = S.extractBlockIds(body);
    const stats = S.wordStats(body);
    note.words = stats.words;
    note.chars = stats.chars;
    note.readingMinutes = stats.readingMinutes;
    note.taskCounts = countTasks(body);
    return note;
  }

  function countTasks(body) {
    const tasks = S.extractTasks(body);
    let done = 0, open = 0;
    tasks.forEach(function (t) { if (t.done) done++; else if (!t.cancelled) open++; });
    return { total: tasks.length, done: done, open: open };
  }

  async function createNote(opts) {
    const o = opts || {};
    const folder = o.folder === undefined ? (state.settings.defaultNewNoteFolder || '') : (o.folder || '');
    const title = (o.title || 'Untitled').trim() || 'Untitled';
    const path = o.path || uniquePath(folder, title);
    const finalTitle = path.split('/').pop().replace(/\.md$/i, '');

    const note = {
      id: U.uid('nt'),
      path: path,
      folder: folder,
      title: finalTitle,
      content: o.content || '',
      properties: o.properties || {},
      tags: [], links: [], aliases: [], blockIds: {},
      pinned: !!o.pinned,
      color: o.color || null,
      icon: o.icon || null,
      createdAt: o.createdAt || Date.now(),
      updatedAt: Date.now(),
      lastOpenedAt: null,
    };
    reindexNote(note);
    state.notes.set(note.id, note);
    await db.put('notes', note);
    if (folder) await ensureFolderChain(folder);
    if (N.vault) N.vault.saveNote(note);

    if (!o.silent) {
      pushUndo('Create note', async function () { await deleteNote(note.id, { skipUndo: true, skipConfirm: true }); },
                             async function () { state.notes.set(note.id, note); await db.put('notes', note); if (N.vault) N.vault.saveNote(note); emitVaultChange(); });
    }
    bus.emit('note:created', note);
    emitVaultChange();
    return note;
  }

  async function updateNoteContent(id, content, opts) {
    const note = state.notes.get(id);
    if (!note) return null;
    if (note.content === content) return note;
    note.content = content;
    note.updatedAt = Date.now();
    reindexNote(note);
    await db.put('notes', note);
    if (N.vault) N.vault.saveNote(note);
    bus.emit('note:updated', note);
    if (!opts || !opts.quiet) emitVaultChange();
    return note;
  }

  async function updateNoteProperties(id, properties) {
    const note = state.notes.get(id);
    if (!note) return null;
    note.properties = Object.assign({}, note.properties, properties);
    Object.keys(note.properties).forEach(function (k) {
      if (note.properties[k] === undefined) delete note.properties[k];
    });
    note.updatedAt = Date.now();
    reindexNote(note);
    await db.put('notes', note);
    if (N.vault) N.vault.saveNote(note);
    bus.emit('note:updated', note);
    emitVaultChange();
    return note;
  }

  async function renameNote(id, newTitle, opts) {
    const note = state.notes.get(id);
    if (!note) return null;
    const clean = String(newTitle || '').trim();
    if (!clean) return note;
    const oldTitle = noteTitle(note);
    const oldPath = note.path;
    if (clean === oldTitle) return note;

    const newPath = uniquePath(note.folder, clean, id);
    note.title = newPath.split('/').pop().replace(/\.md$/i, '');
    note.path = newPath;
    note.updatedAt = Date.now();
    await db.put('notes', note);
    if (N.vault) N.vault.renameNoteFile(oldPath, newPath, note);

    const touched = (!opts || opts.updateLinks !== false) ? await rewriteLinks(oldTitle, note.title, id) : [];

    if (!opts || !opts.skipUndo) {
      pushUndo('Rename note', async function () { await renameNote(id, oldTitle, { skipUndo: true }); },
                              async function () { await renameNote(id, clean, { skipUndo: true }); });
    }
    bus.emit('note:renamed', { note: note, oldTitle: oldTitle, touched: touched.length });
    emitVaultChange();
    return note;
  }

  /** Update every [[old]] reference across the vault after a rename. */
  async function rewriteLinks(oldTitle, newTitle, exceptId) {
    if (!oldTitle || oldTitle === newTitle) return [];
    const re = new RegExp('(!?\\[\\[)' + U.escapeRegExp(oldTitle) + '((?:[#^\\|][^\\]]*)?\\]\\])', 'g');
    const touched = [];
    for (const note of state.notes.values()) {
      if (note.id === exceptId) continue;
      if (note.content.indexOf('[[') === -1) continue;
      const next = note.content.replace(re, '$1' + newTitle.replace(/\$/g, '$$$$') + '$2');
      if (next !== note.content) {
        note.content = next;
        note.updatedAt = Date.now();
        reindexNote(note);
        touched.push(note);
      }
    }
    if (touched.length) {
      await db.bulkPut('notes', touched);
      touched.forEach(function (n) { if (N.vault) N.vault.saveNote(n); bus.emit('note:updated', n); });
    }
    return touched;
  }

  async function deleteNote(id, opts) {
    const note = state.notes.get(id);
    if (!note) return false;
    const snapshot = U.deepClone(note);
    state.notes.delete(id);
    state.recentNoteIds = state.recentNoteIds.filter(function (r) { return r !== id; });
    await db.delete('notes', id);
    if (N.vault) N.vault.deleteNoteFile(note.path);
    if (state.activeNoteId === id) state.activeNoteId = null;

    if (!opts || !opts.skipUndo) {
      pushUndo('Delete "' + noteTitle(snapshot) + '"',
        async function () {
          state.notes.set(snapshot.id, snapshot);
          await db.put('notes', snapshot);
          if (N.vault) N.vault.saveNote(snapshot);
          bus.emit('note:created', snapshot);
          emitVaultChange();
        },
        async function () { await deleteNote(snapshot.id, { skipUndo: true }); });
    }
    bus.emit('note:deleted', id);
    emitVaultChange();
    return true;
  }

  async function deleteNotes(ids) {
    const snapshots = ids.map(function (id) { return state.notes.get(id); }).filter(Boolean).map(U.deepClone);
    if (!snapshots.length) return 0;
    for (const snap of snapshots) {
      state.notes.delete(snap.id);
      await db.delete('notes', snap.id);
      if (N.vault) N.vault.deleteNoteFile(snap.path);
    }
    state.recentNoteIds = state.recentNoteIds.filter(function (r) { return !ids.includes(r); });
    if (ids.includes(state.activeNoteId)) state.activeNoteId = null;
    pushUndo('Delete ' + U.pluralize(snapshots.length, 'note'),
      async function () {
        for (const s of snapshots) { state.notes.set(s.id, s); await db.put('notes', s); if (N.vault) N.vault.saveNote(s); }
        emitVaultChange();
      },
      async function () { await deleteNotes(ids); });
    bus.emit('notes:deleted', ids);
    emitVaultChange();
    return snapshots.length;
  }

  async function duplicateNote(id) {
    const note = state.notes.get(id);
    if (!note) return null;
    const base = noteTitle(note);
    let title = base + ' copy';
    let i = 2;
    while (findNoteByTitle(title)) title = base + ' copy ' + (i++);
    return createNote({ title: title, folder: note.folder, content: note.content, properties: U.deepClone(note.properties) });
  }

  async function moveNote(id, newFolder) {
    const note = state.notes.get(id);
    if (!note) return null;
    const folder = newFolder || '';
    if (note.folder === folder) return note;
    const oldFolder = note.folder;
    const oldPath = note.path;
    const newPath = uniquePath(folder, noteTitle(note), id);
    note.folder = folder;
    note.title = newPath.split('/').pop().replace(/\.md$/i, '');
    note.path = newPath;
    note.updatedAt = Date.now();
    await db.put('notes', note);
    if (folder) await ensureFolderChain(folder);
    if (N.vault) N.vault.renameNoteFile(oldPath, newPath, note);
    pushUndo('Move note', async function () { await moveNote(id, oldFolder); }, async function () { await moveNote(id, folder); });
    bus.emit('note:updated', note);
    emitVaultChange();
    return note;
  }

  async function togglePin(id) {
    const note = state.notes.get(id);
    if (!note) return false;
    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    await db.put('notes', note);
    if (N.vault) N.vault.saveNote(note);
    bus.emit('note:updated', note);
    emitVaultChange();
    return note.pinned;
  }

  async function setNoteColor(id, color) {
    const note = state.notes.get(id);
    if (!note) return;
    note.color = color || null;
    await db.put('notes', note);
    bus.emit('note:updated', note);
    emitVaultChange();
  }

  async function touchNoteOpened(id) {
    const note = state.notes.get(id);
    if (!note) return;
    note.lastOpenedAt = Date.now();
    state.recentNoteIds = [id].concat(state.recentNoteIds.filter(function (r) { return r !== id; })).slice(0, 30);
    await db.put('notes', note);
    await db.setMeta('recent-notes', state.recentNoteIds);
    bus.emit('recent:changed');
  }

  /* ---------------------------------------------------------------- lookups */

  function findNoteByTitle(title) {
    if (!title) return null;
    const t = String(title).trim().toLowerCase();
    for (const n of state.notes.values()) if (noteTitle(n).toLowerCase() === t) return n;
    for (const n of state.notes.values()) {
      if (n.aliases && n.aliases.some(function (a) { return String(a).toLowerCase() === t; })) return n;
    }
    // Allow linking by full path, e.g. [[Folder/Note]].
    for (const n of state.notes.values()) {
      if (n.path.replace(/\.md$/i, '').toLowerCase() === t) return n;
    }
    return null;
  }

  function getNote(id) { return state.notes.get(id) || null; }
  function allNotes() { return Array.from(state.notes.values()); }

  function notesInFolder(folderPath, recursive) {
    const path = folderPath || '';
    return allNotes().filter(function (n) {
      if (recursive) return n.folder === path || (path ? n.folder.startsWith(path + '/') : true);
      return n.folder === path;
    });
  }

  function allTags() {
    const counts = new Map();
    state.notes.forEach(function (note) {
      (note.tags || []).forEach(function (tag) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
        // Register parent tags so #a/b also lists under #a.
        const parts = tag.split('/');
        for (let i = 1; i < parts.length; i++) {
          const parent = parts.slice(0, i).join('/');
          if (!counts.has(parent)) counts.set(parent, 0);
        }
      });
    });
    return Array.from(counts.entries())
      .map(function (e) { return { tag: e[0], count: e[1] }; })
      .sort(function (a, b) { return b.count - a.count || a.tag.localeCompare(b.tag); });
  }

  function notesWithTag(tag) {
    const t = String(tag).toLowerCase();
    return allNotes().filter(function (n) {
      return (n.tags || []).some(function (x) {
        const lx = x.toLowerCase();
        return lx === t || lx.startsWith(t + '/');
      });
    });
  }

  /** Full link graph, including unresolved links (targets that don't exist yet). */
  function buildLinkGraph() {
    const graph = new Map();
    const unresolved = new Map();
    state.notes.forEach(function (note) { graph.set(note.id, { note: note, outgoing: [], incoming: [] }); });
    state.notes.forEach(function (note) {
      (note.links || []).forEach(function (target) {
        const found = findNoteByTitle(target);
        if (found && found.id !== note.id) {
          const from = graph.get(note.id), to = graph.get(found.id);
          if (from && from.outgoing.indexOf(found.id) === -1) from.outgoing.push(found.id);
          if (to && to.incoming.indexOf(note.id) === -1) to.incoming.push(note.id);
        } else if (!found) {
          if (!unresolved.has(target)) unresolved.set(target, []);
          unresolved.get(target).push(note.id);
        }
      });
    });
    return { graph: graph, unresolved: unresolved };
  }

  function backlinksFor(id) {
    const note = state.notes.get(id);
    if (!note) return { linked: [], unlinked: [] };
    const title = noteTitle(note).toLowerCase();
    const names = [title].concat((note.aliases || []).map(function (a) { return String(a).toLowerCase(); }));
    const linked = [], unlinked = [];
    state.notes.forEach(function (other) {
      if (other.id === id) return;
      const hasLink = (other.links || []).some(function (l) { return names.indexOf(String(l).toLowerCase()) !== -1; });
      if (hasLink) {
        linked.push({ note: other, contexts: contextsFor(other.content, names, true) });
        return;
      }
      const contexts = contextsFor(other.content, names, false);
      if (contexts.length) unlinked.push({ note: other, contexts: contexts });
    });
    return { linked: linked, unlinked: unlinked };
  }

  function contextsFor(content, names, linked) {
    const out = [];
    const lines = String(content || '').split(/\r?\n/);
    for (let i = 0; i < lines.length && out.length < 4; i++) {
      const lower = lines[i].toLowerCase();
      for (const name of names) {
        if (!name) continue;
        const hit = linked ? lower.indexOf('[[' + name) !== -1 : new RegExp('(^|[^\\w\\[])' + U.escapeRegExp(name) + '($|[^\\w\\]])', 'i').test(lines[i]);
        if (hit) { out.push({ line: i, text: lines[i].trim().slice(0, 220) }); break; }
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------- folders */

  function folderByPath(path) {
    for (const f of state.folders.values()) if (f.path === path) return f;
    return null;
  }

  async function ensureFolderChain(path) {
    if (!path) return;
    const parts = path.split('/').filter(Boolean);
    let acc = '';
    for (const part of parts) {
      const parent = acc;
      acc = acc ? acc + '/' + part : part;
      if (!folderByPath(acc)) {
        const folder = { id: U.uid('fd'), name: part, parent: parent, path: acc, createdAt: Date.now() };
        state.folders.set(folder.id, folder);
        await db.put('folders', folder);
        if (N.vault) N.vault.saveFolder(acc);
      }
    }
  }

  async function createFolder(name, parent) {
    const clean = U.safeFileName(name, 'New folder');
    const parentPath = parent || '';
    let path = parentPath ? parentPath + '/' + clean : clean;
    let finalName = clean, i = 2;
    while (folderByPath(path)) {
      finalName = clean + ' ' + (i++);
      path = parentPath ? parentPath + '/' + finalName : finalName;
    }
    const folder = { id: U.uid('fd'), name: finalName, parent: parentPath, path: path, createdAt: Date.now() };
    state.folders.set(folder.id, folder);
    await db.put('folders', folder);
    if (N.vault) N.vault.saveFolder(path);
    pushUndo('Create folder', async function () { await deleteFolder(folder.id, { skipUndo: true, keepNotes: true }); },
                              async function () { state.folders.set(folder.id, folder); await db.put('folders', folder); emitVaultChange(); });
    bus.emit('folder:created', folder);
    emitVaultChange();
    return folder;
  }

  async function renameFolder(id, newName) {
    const folder = state.folders.get(id);
    if (!folder) return null;
    const clean = U.safeFileName(newName, folder.name);
    if (clean === folder.name) return folder;
    const oldPath = folder.path;
    const newPath = folder.parent ? folder.parent + '/' + clean : clean;
    if (folderByPath(newPath)) { bus.emit('error:duplicate-folder', newPath); return null; }

    folder.name = clean;
    folder.path = newPath;
    await db.put('folders', folder);

    const changedFolders = [folder];
    state.folders.forEach(function (f) {
      if (f.id === id) return;
      if (f.path.startsWith(oldPath + '/')) {
        f.path = newPath + f.path.slice(oldPath.length);
        f.parent = f.parent === oldPath ? newPath : (f.parent.startsWith(oldPath + '/') ? newPath + f.parent.slice(oldPath.length) : f.parent);
        changedFolders.push(f);
      }
    });
    await db.bulkPut('folders', changedFolders);

    const changedNotes = [];
    state.notes.forEach(function (n) {
      if (n.folder === oldPath || n.folder.startsWith(oldPath + '/')) {
        const oldNotePath = n.path;
        n.folder = newPath + n.folder.slice(oldPath.length);
        n.path = buildPath(n.folder, noteTitle(n));
        changedNotes.push({ note: n, oldPath: oldNotePath });
      }
    });
    if (changedNotes.length) await db.bulkPut('notes', changedNotes.map(function (c) { return c.note; }));
    if (N.vault && N.vault.isFolderMode()) {
      for (const f of changedFolders) N.vault.saveFolder(f.path);
      for (const c of changedNotes) N.vault.renameNoteFile(c.oldPath, c.note.path, c.note);
      N.vault.deleteFolderDir(oldPath);
    }
    bus.emit('folder:renamed', folder);
    emitVaultChange();
    return folder;
  }

  async function deleteFolder(id, opts) {
    const folder = state.folders.get(id);
    if (!folder) return false;
    const path = folder.path;
    const subFolders = Array.from(state.folders.values()).filter(function (f) {
      return f.path === path || f.path.startsWith(path + '/');
    });
    const notes = allNotes().filter(function (n) { return n.folder === path || n.folder.startsWith(path + '/'); });

    if (opts && opts.keepNotes) {
      for (const n of notes) await moveNote(n.id, '');
    }
    const noteSnaps = (opts && opts.keepNotes) ? [] : notes.map(U.deepClone);
    const folderSnaps = subFolders.map(U.deepClone);

    for (const n of noteSnaps) { state.notes.delete(n.id); await db.delete('notes', n.id); }
    for (const f of folderSnaps) { state.folders.delete(f.id); await db.delete('folders', f.id); }
    if (N.vault) N.vault.deleteFolderDir(path);
    if (noteSnaps.some(function (n) { return n.id === state.activeNoteId; })) state.activeNoteId = null;

    if (!opts || !opts.skipUndo) {
      pushUndo('Delete folder "' + folder.name + '"',
        async function () {
          for (const f of folderSnaps) { state.folders.set(f.id, f); await db.put('folders', f); if (N.vault) N.vault.saveFolder(f.path); }
          for (const n of noteSnaps) { state.notes.set(n.id, n); await db.put('notes', n); if (N.vault) N.vault.saveNote(n); }
          emitVaultChange();
        },
        async function () { await deleteFolder(id, { skipUndo: true }); });
    }
    bus.emit('folder:deleted', path);
    emitVaultChange();
    return true;
  }

  async function moveFolder(id, newParent) {
    const folder = state.folders.get(id);
    if (!folder) return null;
    const parent = newParent || '';
    if (parent === folder.path || parent.startsWith(folder.path + '/')) {
      bus.emit('error:invalid-move', 'A folder cannot be moved inside itself.');
      return null;
    }
    if (folder.parent === parent) return folder;
    const oldPath = folder.path;
    const newPath = parent ? parent + '/' + folder.name : folder.name;
    if (folderByPath(newPath)) { bus.emit('error:duplicate-folder', newPath); return null; }
    folder.parent = parent;
    folder.path = newPath;
    await db.put('folders', folder);

    const changed = [folder];
    state.folders.forEach(function (f) {
      if (f.id !== id && f.path.startsWith(oldPath + '/')) {
        f.path = newPath + f.path.slice(oldPath.length);
        f.parent = newPath + f.parent.slice(oldPath.length);
        changed.push(f);
      }
    });
    await db.bulkPut('folders', changed);
    const movedNotes = [];
    state.notes.forEach(function (n) {
      if (n.folder === oldPath || n.folder.startsWith(oldPath + '/')) {
        const old = n.path;
        n.folder = newPath + n.folder.slice(oldPath.length);
        n.path = buildPath(n.folder, noteTitle(n));
        movedNotes.push({ note: n, oldPath: old });
      }
    });
    if (movedNotes.length) await db.bulkPut('notes', movedNotes.map(function (m) { return m.note; }));
    if (N.vault && N.vault.isFolderMode()) {
      for (const f of changed) N.vault.saveFolder(f.path);
      for (const m of movedNotes) N.vault.renameNoteFile(m.oldPath, m.note.path, m.note);
      N.vault.deleteFolderDir(oldPath);
    }
    emitVaultChange();
    return folder;
  }

  function folderTree() {
    const byParent = new Map();
    state.folders.forEach(function (f) {
      if (!byParent.has(f.parent)) byParent.set(f.parent, []);
      byParent.get(f.parent).push(f);
    });
    byParent.forEach(function (list) { list.sort(function (a, b) { return a.name.localeCompare(b.name); }); });
    return byParent;
  }

  /* ------------------------------------------------- generic collections */

  function collectionMap(name) {
    return { canvases: state.canvases, stickies: state.stickies, tasks: state.tasks, scratch: state.scratch, journal: state.journal }[name];
  }

  async function saveRecord(collection, record) {
    const map = collectionMap(collection);
    if (!map) return null;
    const key = collection === 'journal' ? 'day' : 'id';
    if (!record[key]) record[key] = collection === 'journal' ? U.todayKey() : U.uid(collection.slice(0, 2));
    record.updatedAt = Date.now();
    map.set(record[key], record);
    await db.put(collection, record);
    scheduleAppDataWrite(collection);
    bus.emit(collection + ':changed', record);
    emitVaultChange();
    return record;
  }

  async function deleteRecord(collection, id) {
    const map = collectionMap(collection);
    if (!map) return false;
    const snapshot = map.get(id) ? U.deepClone(map.get(id)) : null;
    map.delete(id);
    await db.delete(collection, id);
    if (collection === 'canvases' && N.vault) N.vault.deleteAppData('canvases/' + id + '.json');
    else scheduleAppDataWrite(collection);
    if (snapshot) {
      pushUndo('Delete item',
        async function () { map.set(id, snapshot); await db.put(collection, snapshot); scheduleAppDataWrite(collection); emitVaultChange(); },
        async function () { await deleteRecord(collection, id); });
    }
    bus.emit(collection + ':changed', null);
    emitVaultChange();
    return true;
  }

  async function replaceCollection(name, rows) {
    const map = collectionMap(name);
    if (!map || !Array.isArray(rows)) return;
    const key = name === 'journal' ? 'day' : 'id';
    map.clear();
    rows.forEach(function (r) { if (r && r[key]) map.set(r[key], r); });
    await db.clear(name);
    await db.bulkPut(name, rows.filter(function (r) { return r && r[key]; }));
    bus.emit(name + ':changed', null);
  }

  const appDataWriters = {};
  function scheduleAppDataWrite(collection) {
    if (!N.vault || !N.vault.isFolderMode()) return;
    if (!appDataWriters[collection]) {
      appDataWriters[collection] = U.debounce(function () {
        const map = collectionMap(collection);
        if (!map) return;
        if (collection === 'canvases') {
          map.forEach(function (c) { N.vault.saveAppData('canvases/' + c.id + '.json', c); });
        } else {
          N.vault.saveAppData(collection + '.json', Array.from(map.values()));
        }
      }, 900);
    }
    appDataWriters[collection]();
  }

  /* ------------------------------------------------------- disk reconcile */

  /** Called by vault.pullAll for each markdown file found on disk. */
  async function upsertFromDisk(path, raw, lastModified) {
    const parsed = S.fileToNote(path, raw);
    let existing = null;
    state.notes.forEach(function (n) { if (!existing && n.path === path) existing = n; });
    if (!existing) {
      const title = parsed.title.toLowerCase();
      state.notes.forEach(function (n) {
        if (!existing && n.folder === parsed.folder && noteTitle(n).toLowerCase() === title) existing = n;
      });
    }

    if (existing) {
      const sameBody = existing.content === parsed.content;
      const sameProps = JSON.stringify(existing.properties || {}) === JSON.stringify(parsed.properties || {});
      if (sameBody && sameProps) return 'unchanged';
      existing.content = parsed.content;
      existing.properties = parsed.properties;
      existing.pinned = parsed.pinned;
      existing.path = path;
      existing.folder = parsed.folder;
      existing.title = parsed.title;
      existing.updatedAt = lastModified || Date.now();
      reindexNote(existing);
      await db.put('notes', existing);
      bus.emit('note:updated', existing);
      return 'updated';
    }

    if (parsed.folder) await ensureFolderChain(parsed.folder);
    await createNote({
      title: parsed.title, folder: parsed.folder, content: parsed.content,
      properties: parsed.properties, path: path, pinned: parsed.pinned, silent: true,
      createdAt: lastModified || Date.now(),
    });
    return 'created';
  }

  /** Remove notes whose files vanished from disk (deleted in another app). */
  async function reconcileDeletions(seenPaths) {
    const gone = allNotes().filter(function (n) { return !seenPaths.has(n.path); });
    if (!gone.length) return 0;
    // Safety valve: if *everything* is missing the folder is probably wrong,
    // or permission dropped mid-scan. Never mass-delete on a suspicious read.
    if (gone.length === state.notes.size && state.notes.size > 1) {
      console.warn('[store] skipping reconcile — the folder looks empty, which is more likely a read error than a real delete');
      return 0;
    }
    for (const n of gone) { state.notes.delete(n.id); await db.delete('notes', n.id); }
    if (gone.some(function (n) { return n.id === state.activeNoteId; })) state.activeNoteId = null;
    emitVaultChange();
    return gone.length;
  }

  /* ---------------------------------------------------------------- events */

  const emitVaultChange = U.debounce(function () { bus.emit('vault:changed'); }, 30);

  function setActiveNote(id) {
    if (state.activeNoteId === id) return;
    state.activeNoteId = id;
    bus.emit('note:active', id ? state.notes.get(id) : null);
    if (id) touchNoteOpened(id);
  }

  /* ------------------------------------------------------------ seed vault */

  async function seedWelcomeVault() {
    await createFolder('Getting started');
    await createNote({
      title: 'Welcome to Nodalis', folder: 'Getting started', silent: true,
      properties: { status: 'reading', priority: 'high', tags: ['guide'] },
      content: [
        '# Welcome to Nodalis',
        '',
        'Everything here is a plain markdown file. Nothing is locked away, and nothing needs an account.',
        '',
        '## Three things worth trying first',
        '',
        '- Type `[[` anywhere to link to another note. Links that point nowhere yet are still valid — click one to create the note.',
        '- Press `Ctrl/Cmd + K` for the command palette. Every single feature in this app is reachable from there, and every command shows its shortcut.',
        '- Press `/` on an empty line for the block menu — tables, callouts, code, task lists, dates.',
        '',
        '## Your notes live on disk',
        '',
        'Open **Settings → Storage** and connect a folder. From then on every keystroke is written to a real `.md` file you can open in any editor, back up, or put in Dropbox. Clearing your browser cache cannot touch it.',
        '',
        '> [!tip] Already using Obsidian?',
        '> Point Nodalis at your existing vault folder. The formats match, so your notes, folders and `[[links]]` come straight across.',
        '',
        '## Tasks',
        '',
        '- [x] Open Nodalis',
        '- [ ] Connect a folder so notes are saved to disk !1',
        '- [ ] Write one note about anything at all',
        '',
        'Tasks written in any note show up in **Tasks**, and you can drag them across the **Eisenhower matrix** to decide what actually matters.',
        '',
        '## Properties',
        '',
        'The block at the top of this file is frontmatter. Any key you add becomes a column in the **Database** view, so a folder of notes can behave like a Notion table.',
        '',
        'See also: [[Keyboard shortcuts]] and [[What Nodalis is for]].',
        '',
        '#guide',
      ].join('\n'),
    });
    await createNote({
      title: 'Keyboard shortcuts', folder: 'Getting started', silent: true,
      content: [
        '# Keyboard shortcuts',
        '',
        'Every command has one, and every one of them can be changed in **Settings → Shortcuts**.',
        '',
        '| Action | Shortcut |',
        '| --- | --- |',
        '| Command palette | `Ctrl/Cmd + K` |',
        '| Jump to note | `Ctrl/Cmd + O` |',
        '| Search everything | `Ctrl/Cmd + Shift + F` |',
        '| New note | `Ctrl/Cmd + N` |',
        '| Quick capture | `Ctrl/Cmd + Shift + C` |',
        '| Today\'s daily note | `Ctrl/Cmd + D` |',
        '| Toggle sidebar | `Ctrl/Cmd + B` |',
        '| Graph view | `Ctrl/Cmd + G` |',
        '| Undo last vault action | `Ctrl/Cmd + Z` |',
        '',
        'Linked from [[Welcome to Nodalis]].',
        '',
        '#guide',
      ].join('\n'),
    });
    await createNote({
      title: 'What Nodalis is for', folder: 'Getting started', silent: true,
      content: [
        '# What Nodalis is for',
        '',
        'Notes that link to each other, tasks that come out of those notes, and a place to put a thought before it disappears.',
        '',
        'The **Scratchpad** exists for that last one. Hit `Ctrl/Cmd + Shift + C` from anywhere, type the thought, close it. Sort it out later, or never.',
        '',
        'Linked from [[Welcome to Nodalis]].',
        '',
        '#guide',
      ].join('\n'),
    });
    bus.emit('vault:seeded');
  }

  N.store = {
    state: state,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    loadAll: loadAll, saveSettings: saveSettings, setSetting: setSetting, getSetting: getSetting,
    seedWelcomeVault: seedWelcomeVault,

    noteTitle: noteTitle, buildPath: buildPath, uniquePath: uniquePath, reindexNote: reindexNote,
    createNote: createNote, updateNoteContent: updateNoteContent, updateNoteProperties: updateNoteProperties,
    renameNote: renameNote, deleteNote: deleteNote, deleteNotes: deleteNotes, duplicateNote: duplicateNote,
    moveNote: moveNote, togglePin: togglePin, setNoteColor: setNoteColor, touchNoteOpened: touchNoteOpened,
    findNoteByTitle: findNoteByTitle, getNote: getNote, allNotes: allNotes, notesInFolder: notesInFolder,
    allTags: allTags, notesWithTag: notesWithTag, buildLinkGraph: buildLinkGraph, backlinksFor: backlinksFor,
    rewriteLinks: rewriteLinks,

    createFolder: createFolder, renameFolder: renameFolder, deleteFolder: deleteFolder, moveFolder: moveFolder,
    folderByPath: folderByPath, folderTree: folderTree, ensureFolderChain: ensureFolderChain,

    saveRecord: saveRecord, deleteRecord: deleteRecord, replaceCollection: replaceCollection,
    upsertFromDisk: upsertFromDisk, reconcileDeletions: reconcileDeletions,

    setActiveNote: setActiveNote,
    pushUndo: pushUndo, undo: undo, redo: redo, canUndo: canUndo, canRedo: canRedo, lastUndoLabel: lastUndoLabel,
  };
})(window.NODALIS = window.NODALIS || {});
