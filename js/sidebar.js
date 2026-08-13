/**
 * sidebar.js — nested file tree (any folder depth), pinned notes, tags, canvases.
 * Every folder supports a right-click / long-press menu: New note here, New
 * subfolder, Rename, Delete — this is what fixes "can't add a note inside a folder".
 */
import {
  state, bus, noteTitle, createNote, createFolder, deleteNote, renameNote, createCanvas,
  togglePin, duplicateNote, moveNote, renameFolder, deleteFolder,
} from './state.js';
import { openContextMenu } from './context-menu.js';
import { setActiveView } from './layout-manager.js';
import { showToast } from './layout-manager.js';

const expanded = new Set(); // folder paths currently expanded (persist only for this session)

export function initSidebar() {
  bus.on('vault:loaded', renderAll);
  bus.on('vault:changed', renderAll);
  bus.on('note:updated', renderAll);
  bus.on('note:opened', renderAll);
  bus.on('settings:changed', renderAll);

  document.getElementById('btn-new-note').addEventListener('click', async () => {
    const note = await createNote({ title: 'Untitled' });
    bus.emit('note:open', note.id);
  });
  document.getElementById('btn-new-folder').addEventListener('click', async () => {
    const name = prompt('Folder name:');
    if (name) { await createFolder(name); showToast(`Created folder "${name}"`); }
  });
  document.getElementById('btn-new-canvas').addEventListener('click', async () => {
    const canvas = await createCanvas('Untitled Canvas');
    setActiveView('canvas');
    bus.emit('canvas:open', canvas.id);
  });
  document.getElementById('sheet-new-folder').addEventListener('click', () => document.getElementById('btn-new-folder').click());
  document.getElementById('sheet-new-canvas').addEventListener('click', () => document.getElementById('btn-new-canvas').click());

  renderAll();
}

function renderAll() {
  renderFileTree();
  renderTags();
  renderCanvases();
  applyTabVisibility();
}

function applyTabVisibility() {
  const vis = state.settings.visibleSidebarTabs || {};
  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    const key = tab.dataset.tab;
    tab.style.display = vis[key] === false ? 'none' : '';
  });
}

/** Build a nested tree keyed by folder path from the flat folders + notes collections. */
function buildTree() {
  const root = { path: '', name: '', children: new Map(), notes: [] };
  const nodeFor = (path) => {
    if (!path) return root;
    if (root.children.has(path)) return getDeep(path);
    return getDeep(path);
  };
  function getDeep(path) {
    const parts = path.split('/');
    let node = root;
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!node.children.has(cur)) {
        node.children.set(cur, { path: cur, name: part, children: new Map(), notes: [] });
      }
      node = node.children.get(cur);
    }
    return node;
  }
  // ensure every known folder exists in the tree (even if empty)
  [...state.folders.values()].sort((a, b) => a.path.split('/').length - b.path.split('/').length)
    .forEach((f) => getDeep(f.path));
  // attach notes
  for (const note of state.notes.values()) {
    const node = note.folder ? getDeep(note.folder) : root;
    node.notes.push(note);
  }
  return root;
}

function folderContextMenu(e, node) {
  e.preventDefault();
  const folder = [...state.folders.values()].find((f) => f.path === node.path);
  openContextMenu(e.clientX, e.clientY, [
    { label: '+ New note here', action: async () => {
        const note = await createNote({ title: 'Untitled', folder: node.path });
        bus.emit('note:open', note.id);
        showToast(`Created in "${node.name}"`);
      } },
    { label: '+ New subfolder', action: async () => {
        const name = prompt('Subfolder name:');
        if (name) await createFolder(name, node.path);
      } },
    { separator: true },
    { label: 'Rename folder', action: async () => {
        const name = prompt('New folder name:', node.name);
        if (name && folder) await renameFolder(folder.id, name);
      } },
    { label: 'Delete folder', danger: true, action: async () => {
        const count = node.notes.length + [...node.children.values()].length;
        if (confirm(`Delete "${node.name}" and everything inside it (${count}+ items)? This cannot be undone.`)) {
          if (folder) await deleteFolder(folder.id);
          showToast('Folder deleted');
        }
      } },
  ]);
}

function noteContextMenu(e, note) {
  e.preventDefault();
  const folderOptions = ['(root)', ...new Set([...state.folders.values()].map((f) => f.path))];
  openContextMenu(e.clientX, e.clientY, [
    { label: note.pinned ? 'Unpin' : 'Pin to top', action: async () => { await togglePin(note.id); } },
    { label: 'Duplicate', action: async () => {
        const dup = await duplicateNote(note.id);
        showToast('Note duplicated');
        bus.emit('note:open', dup.id);
      } },
    { label: 'Move to folder…', action: async () => {
        const target = prompt(`Move to which folder? Options:\n${folderOptions.join('\n')}\n\n(type exactly, or "(root)")`, note.folder || '(root)');
        if (target == null) return;
        await moveNote(note.id, target === '(root)' ? '' : target);
        showToast('Note moved');
      } },
    { label: 'Rename', action: async () => {
        const t = prompt('New title:', noteTitle(note));
        if (t) await renameNote(note.id, t);
      } },
    { separator: true },
    { label: 'Delete', danger: true, action: async () => {
        if (confirm(`Delete "${noteTitle(note)}"?`)) { await deleteNote(note.id); showToast('Note deleted'); bus.emit('note:closed', note.id); }
      } },
  ]);
}

function renderNoteRow(note) {
  const row = document.createElement('div');
  row.className = 'tree-row note-row' + (state.activeNoteId === note.id ? ' active' : '');
  row.innerHTML = `<span class="tree-row-label">${note.pinned ? '📌 ' : '📄 '}${escapeHtml(noteTitle(note))}</span>`;
  row.addEventListener('click', () => bus.emit('note:open', note.id));
  row.addEventListener('contextmenu', (e) => noteContextMenu(e, note));
  let pressTimer;
  row.addEventListener('touchstart', () => { pressTimer = setTimeout(() => noteContextMenu({ preventDefault(){}, clientX: 120, clientY: 200 }, note), 500); });
  row.addEventListener('touchend', () => clearTimeout(pressTimer));
  return row;
}

function renderFolderNode(node, depth) {
  const wrap = document.createElement('div');
  wrap.className = 'tree-node';
  const isOpen = expanded.has(node.path) || depth === 0;
  const row = document.createElement('div');
  row.className = 'tree-row folder-row';
  row.style.paddingLeft = `${8 + depth * 14}px`;
  row.innerHTML = `<svg class="chev" style="transform:rotate(${isOpen ? 90 : 0}deg)" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg> <span class="tree-row-label">📁 ${escapeHtml(node.name)}</span>`;
  row.addEventListener('click', () => {
    if (expanded.has(node.path)) expanded.delete(node.path); else expanded.add(node.path);
    renderFileTree();
  });
  row.addEventListener('contextmenu', (e) => folderContextMenu(e, node));
  let pressTimer;
  row.addEventListener('touchstart', () => { pressTimer = setTimeout(() => folderContextMenu({ preventDefault(){}, clientX: 120, clientY: 200 }, node), 500); });
  row.addEventListener('touchend', () => clearTimeout(pressTimer));
  wrap.appendChild(row);

  if (isOpen) {
    const children = document.createElement('div');
    children.className = 'tree-children';
    [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach((child) => {
      children.appendChild(renderFolderNode(child, depth + 1));
    });
    node.notes.sort((a, b) => noteTitle(a).localeCompare(noteTitle(b))).forEach((note) => {
      const row = renderNoteRow(note);
      row.style.paddingLeft = `${8 + (depth + 1) * 14}px`;
      children.appendChild(row);
    });
    if (!node.children.size && !node.notes.length) {
      const empty = document.createElement('div');
      empty.className = 'tree-empty';
      empty.style.paddingLeft = `${8 + (depth + 1) * 14}px`;
      empty.textContent = 'Empty — right-click to add a note';
      children.appendChild(empty);
    }
    wrap.appendChild(children);
  }
  return wrap;
}

function renderFileTree() {
  const root = document.getElementById('file-tree');
  root.innerHTML = '';

  const pinned = [...state.notes.values()].filter((n) => n.pinned).sort((a, b) => noteTitle(a).localeCompare(noteTitle(b)));
  if (pinned.length) {
    const section = document.createElement('div');
    section.className = 'tree-section-label';
    section.textContent = 'PINNED';
    root.appendChild(section);
    pinned.forEach((n) => root.appendChild(renderNoteRow(n)));
    const sep = document.createElement('div');
    sep.className = 'tree-section-sep';
    root.appendChild(sep);
  }

  const recent = [...state.notes.values()]
    .filter((n) => !n.pinned && n.lastOpenedAt)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, 5);
  if (recent.length) {
    const section = document.createElement('div');
    section.className = 'tree-section-label';
    section.textContent = 'RECENT';
    root.appendChild(section);
    recent.forEach((n) => root.appendChild(renderNoteRow(n)));
    const sep = document.createElement('div');
    sep.className = 'tree-section-sep';
    root.appendChild(sep);
  }

  const tree = buildTree();
  if (!tree.children.size && !tree.notes.length) {
    root.innerHTML += '<div class="tree-empty">No notes yet — click "+ New note" to begin.</div>';
    return;
  }
  [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach((child) => {
    root.appendChild(renderFolderNode(child, 0));
  });
  tree.notes.sort((a, b) => noteTitle(a).localeCompare(noteTitle(b))).forEach((note) => {
    root.appendChild(renderNoteRow(note));
  });
}

function renderTags() {
  const root = document.getElementById('tag-list');
  root.innerHTML = '';
  const counts = new Map();
  for (const note of state.notes.values()) {
    (note.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
  }
  if (!counts.size) { root.innerHTML = '<div class="tree-empty">No tags yet — try typing #tag in a note.</div>'; return; }
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `#${escapeHtml(tag)} <span class="count">${count}</span>`;
    chip.addEventListener('click', () => bus.emit('tag:filter', tag));
    root.appendChild(chip);
  });
}

function renderCanvases() {
  const root = document.getElementById('canvas-list');
  root.innerHTML = '';
  if (!state.canvases.size) { root.innerHTML = '<div class="tree-empty">No canvases yet.</div>'; return; }
  [...state.canvases.values()].forEach((c) => {
    const row = document.createElement('div');
    row.className = 'canvas-item';
    row.innerHTML = `<span>🖼️ ${escapeHtml(c.title)}</span>`;
    row.addEventListener('click', () => { setActiveView('canvas'); bus.emit('canvas:open', c.id); });
    root.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
