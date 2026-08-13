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
    theme: 'auto',
    syncMode: 'local',   // local | github | fs
    fontSize: 16,
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
  if (savedSettings) Object.assign(state.settings, savedSettings);

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
  const finalPath = path || `${folder ? folder + '/' : ''}${title}.md`;
  const note = {
    id,
    path: finalPath,
    title,
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
  note.title = newTitle;
  note.path = `${note.folder ? note.folder + '/' : ''}${newTitle}.md`;
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

export async function createFolder(name, parent = '') {
  const id = uid();
  const folder = { id, name, parent, path: parent ? `${parent}/${name}` : name };
  state.folders.set(id, folder);
  await DB.put('folders', folder);
  bus.emit('vault:changed');
  return folder;
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
