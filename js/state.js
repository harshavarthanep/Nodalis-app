/**
 * state.js — in-memory reactive store + pub/sub event bus.
 * Single source of truth for the running app; persists through db.js.
 */
import { DB, uid } from './db.js';
import { parseFrontmatter } from './markdown.js';

const listeners = new Map(); // event -> Set<fn>

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  },
  emit(event, payload) {
    (listeners.get(event) || []).forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[bus:${event}]`, err); }
    });
  },
};

export const state = {
  notes: new Map(),      // id -> note
  folders: new Map(),    // id -> folder
  canvases: new Map(),   // id -> canvas
  activeNoteId: null,
  activeView: 'editor',  // editor | graph | canvas | database | settings
  settings: {
    theme: 'nodalis',      // nodalis | glass | glass-dark | nothing | notion
    autoMode: 'system',    // system | time | off  (only relevant when theme allows light/dark switching)
    syncMode: 'local',     // local | github | fs
    autoBackup: true,      // continuously write to the connected local folder on every change
    fontSize: 16,
    editorFont: 'mono',    // mono | sans | serif
    density: 'comfortable',// comfortable | compact
    accent: '#6c5ce7',
    tourCompleted: false,
    visibleSidebarTabs: { files: true, tags: true, canvases: true },
    visibleViews: { editor: true, graph: true, canvas: true, database: true },
    vimMode: false,
  },
};

export async function loadAll() {
  const [notes, folders, canvases] = await Promise.all([
    DB.getAll('notes'),
    DB.getAll('folders'),
    DB.getAll('canvases'),
  ]);
  state.notes.clear();
  notes.forEach((n) => state.notes.set(n.id, n));
  state.folders.clear();
  folders.forEach((f) => state.folders.set(f.id, f));
  state.canvases.clear();
  canvases.forEach((c) => state.canvases.set(c.id, c));

  const savedSettings = await DB.getSetting('settings');
  if (savedSettings) {
    for (const [key, val] of Object.entries(savedSettings)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && typeof state.settings[key] === 'object') {
        state.settings[key] = { ...state.settings[key], ...val };
      } else {
        state.settings[key] = val;
      }
    }
  }

  if (state.notes.size === 0) {
    await seedWelcomeVault();
  }
  bus.emit('vault:loaded');
}

export async function saveSettings() {
  await DB.setSetting('settings', state.settings);
  bus.emit('settings:changed', state.settings);
}

export function noteTitle(note) {
  return note.title || note.path.split('/').pop().replace(/\.md$/, '');
}

export function findNoteByTitle(title) {
  const t = title.trim().toLowerCase();
  for (const n of state.notes.values()) {
    if (noteTitle(n).toLowerCase() === t) return n;
  }
  return null;
}

export async function createNote({ title = 'Untitled', folder = '', content = '', path = null } = {}) {
  const id = uid();
  let finalTitle = title;
  let finalPath = path || `${folder ? folder + '/' : ''}${finalTitle}.md`;
  if (!path) {
    // Avoid unique-path collisions (e.g. clicking "New note" twice in the same folder)
    const existingPaths = new Set([...state.notes.values()].map((n) => n.path));
    let n = 2;
    while (existingPaths.has(finalPath)) {
      finalTitle = `${title} ${n++}`;
      finalPath = `${folder ? folder + '/' : ''}${finalTitle}.md`;
    }
  }
  const note = {
    id,
    path: finalPath,
    title: finalTitle,
    folder,
    content,
    tags: [],
    properties: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const { properties, tags } = parseFrontmatter(content);
  note.properties = properties;
  note.tags = tags;
  state.notes.set(id, note);
  await DB.put('notes', note);
  bus.emit('note:created', note);
  bus.emit('vault:changed');
  return note;
}

export async function updateNoteContent(id, content) {
  const note = state.notes.get(id);
  if (!note) return;
  note.content = content;
  note.updatedAt = Date.now();
  const { properties, tags } = parseFrontmatter(content);
  note.properties = properties;
  note.tags = tags;
  await DB.put('notes', note);
  bus.emit('note:updated', note);
  bus.emit('vault:changed');
}

export async function renameNote(id, newTitle) {
  const note = state.notes.get(id);
  if (!note) return;
  const oldTitle = noteTitle(note);
  let finalTitle = newTitle;
  let candidatePath = `${note.folder ? note.folder + '/' : ''}${finalTitle}.md`;
  const existingPaths = new Set([...state.notes.values()].filter((n) => n.id !== id).map((n) => n.path));
  let n = 2;
  while (existingPaths.has(candidatePath)) {
    finalTitle = `${newTitle} ${n++}`;
    candidatePath = `${note.folder ? note.folder + '/' : ''}${finalTitle}.md`;
  }
  note.title = finalTitle;
  note.path = candidatePath;
  note.updatedAt = Date.now();
  await DB.put('notes', note);
  // update wikilinks referencing old title across vault
  for (const n of state.notes.values()) {
    if (n.id === id) continue;
    const re = new RegExp(`\\[\\[${escapeRegExp(oldTitle)}(\\|[^\\]]*)?\\]\\]`, 'g');
    if (re.test(n.content)) {
      n.content = n.content.replace(re, (m, alias) => `[[${newTitle}${alias || ''}]]`);
      n.updatedAt = Date.now();
      await DB.put('notes', n);
      bus.emit('note:updated', n);
    }
  }
  bus.emit('note:renamed', note);
  bus.emit('vault:changed');
}

export async function deleteNote(id) {
  state.notes.delete(id);
  await DB.delete('notes', id);
  bus.emit('note:deleted', id);
  bus.emit('vault:changed');
}

export async function touchNoteOpened(id) {
  const note = state.notes.get(id);
  if (!note) return;
  note.lastOpenedAt = Date.now();
  await DB.put('notes', note);
}

export async function togglePin(id) {
  const note = state.notes.get(id);
  if (!note) return;
  note.pinned = !note.pinned;
  await DB.put('notes', note);
  bus.emit('note:updated', note);
  bus.emit('vault:changed');
  return note.pinned;
}

export async function duplicateNote(id) {
  const note = state.notes.get(id);
  if (!note) return null;
  const base = noteTitle(note);
  let n = 2;
  let title = `${base} copy`;
  while (findNoteByTitle(title)) title = `${base} copy ${n++}`;
  return createNote({ title, folder: note.folder, content: note.content });
}

export async function moveNote(id, newFolder) {
  const note = state.notes.get(id);
  if (!note) return;
  const folder = newFolder || '';
  const title = noteTitle(note);
  let finalTitle = title;
  let candidatePath = `${folder ? folder + '/' : ''}${finalTitle}.md`;
  const existingPaths = new Set([...state.notes.values()].filter((n) => n.id !== id).map((n) => n.path));
  let n = 2;
  while (existingPaths.has(candidatePath)) {
    finalTitle = `${title} ${n++}`;
    candidatePath = `${folder ? folder + '/' : ''}${finalTitle}.md`;
  }
  note.folder = folder;
  note.title = finalTitle;
  note.path = candidatePath;
  note.updatedAt = Date.now();
  await DB.put('notes', note);
  bus.emit('note:updated', note);
  bus.emit('vault:changed');
}

export async function createFolder(name, parent = '') {
  const id = uid();
  const folder = { id, name, parent, path: parent ? `${parent}/${name}` : name };
  state.folders.set(id, folder);
  await DB.put('folders', folder);
  bus.emit('vault:changed');
  return folder;
}

export async function renameFolder(id, newName) {
  const folder = state.folders.get(id);
  if (!folder) return;
  const oldPath = folder.path;
  const newPath = folder.parent ? `${folder.parent}/${newName}` : newName;
  folder.name = newName;
  folder.path = newPath;
  await DB.put('folders', folder);

  // update any sub-folders' paths/parents
  for (const f of state.folders.values()) {
    if (f.id === id) continue;
    if (f.parent === oldPath || f.path.startsWith(oldPath + '/')) {
      f.parent = f.parent === oldPath ? newPath : newPath + f.parent.slice(oldPath.length);
      f.path = f.path === oldPath ? newPath : newPath + f.path.slice(oldPath.length);
      await DB.put('folders', f);
    }
  }
  // update notes under this folder (and sub-folders)
  for (const n of state.notes.values()) {
    if (n.folder === oldPath || n.folder.startsWith(oldPath + '/')) {
      n.folder = n.folder === oldPath ? newPath : newPath + n.folder.slice(oldPath.length);
      n.path = `${n.folder}/${noteTitle(n)}.md`;
      await DB.put('notes', n);
    }
  }
  bus.emit('vault:changed');
}

/** Recursively deletes a folder, its sub-folders, and every note inside them. */
export async function deleteFolder(id) {
  const folder = state.folders.get(id);
  if (!folder) return;
  const path = folder.path;
  const subFolders = [...state.folders.values()].filter((f) => f.path === path || f.path.startsWith(path + '/'));
  const notesToDelete = [...state.notes.values()].filter((n) => n.folder === path || n.folder.startsWith(path + '/'));
  for (const n of notesToDelete) { state.notes.delete(n.id); await DB.delete('notes', n.id); }
  for (const f of subFolders) { state.folders.delete(f.id); await DB.delete('folders', f.id); }
  bus.emit('vault:changed');
}

export async function createCanvas(title = 'Untitled Canvas') {
  const id = uid();
  const canvas = { id, title, cards: [], createdAt: Date.now(), updatedAt: Date.now() };
  state.canvases.set(id, canvas);
  await DB.put('canvases', canvas);
  bus.emit('vault:changed');
  return canvas;
}

export async function saveCanvas(canvas) {
  canvas.updatedAt = Date.now();
  state.canvases.set(canvas.id, canvas);
  await DB.put('canvases', canvas);
  bus.emit('vault:changed');
}

/** Store a pasted/dropped image blob and return an attachment id usable in markdown as attachment://id */
export async function addAttachment(blob, name = 'image') {
  const id = uid();
  await DB.put('attachments', { id, name, type: blob.type, blob, createdAt: Date.now() });
  return id;
}

const attachmentUrlCache = new Map();
export async function getAttachmentUrl(id) {
  if (attachmentUrlCache.has(id)) return attachmentUrlCache.get(id);
  const row = await DB.get('attachments', id);
  if (!row) return null;
  const url = URL.createObjectURL(row.blob);
  attachmentUrlCache.set(id, url);
  return url;
}

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract [[wikilink]] targets from a note's content */
export function extractLinks(content) {
  const links = new Set();
  const re = /\[\[([^\]|#]+)(#[^\]|]+)?(\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(content))) links.add(m[1].trim());
  return [...links];
}

/** Build a full link graph: { nodeId: { note, outgoing:[ids], incoming:[ids] } } */
export function buildLinkGraph() {
  const graph = new Map();
  for (const note of state.notes.values()) {
    graph.set(note.id, { note, outgoing: [], incoming: [] });
  }
  for (const note of state.notes.values()) {
    const links = extractLinks(note.content);
    for (const targetTitle of links) {
      const target = findNoteByTitle(targetTitle);
      if (target && target.id !== note.id) {
        graph.get(note.id).outgoing.push(target.id);
        graph.get(target.id).incoming.push(note.id);
      }
    }
  }
  return graph;
}

async function seedWelcomeVault() {
  await createFolder('Getting Started');
  await createNote({
    title: 'Welcome to Nodalis',
    folder: 'Getting Started',
    content: `# Welcome to Nodalis 🌐

Nodalis is a local-first, offline-capable knowledge base inspired by the best parts of **Obsidian** and **AFFiNE** — built from real user feedback gathered across Reddit, Quora, Product Hunt, Hacker News and dev blogs.

## Try it out
- Type \`[[Second Note]]\` to create a link to a new note.
- Press **Ctrl/Cmd + K** to open the command palette.
- Press **Ctrl/Cmd + O** to quick-switch between notes.
- Click the graph icon in the sidebar to see your knowledge graph.
- Click the canvas icon to open an infinite whiteboard.
- Click the table icon to see your notes as a sortable database or kanban board.

## Properties (frontmatter)
Add a YAML-style block at the very top of any note to give it properties usable in the database view:

\`\`\`
---
status: in-progress
priority: high
---
\`\`\`

## Tags
Use #tags anywhere in your text — like #project or #idea — and they'll show up in the sidebar tag list and can be filtered in the database view.

## Sync
Open **Settings → Sync** to connect this vault to a GitHub repository, a real local folder (desktop Chrome/Edge), or just export/import a zip backup manually. You can switch between these anytime.

Happy writing!
`,
  });
  await createNote({
    title: 'Second Note',
    folder: 'Getting Started',
    content: `# Second Note\n\nThis note is linked from [[Welcome to Nodalis]]. Backlinks to this note will show up in the panel on the right.\n\n#example`,
  });
}
