/**
 * sidebar.js — file tree (folders/notes), tag browser, canvas list.
 */
import { state, bus, noteTitle, createNote, createFolder, deleteNote, renameNote, createCanvas } from './state.js';
import { openContextMenu } from './context-menu.js';
import { setActiveView } from './layout-manager.js';
import { showToast } from './layout-manager.js';

export function initSidebar() {
  bus.on('vault:loaded', renderAll);
  bus.on('vault:changed', renderAll);
  bus.on('note:updated', renderAll);

  document.getElementById('btn-new-note').addEventListener('click', async () => {
    const note = await createNote({ title: 'Untitled' });
    bus.emit('note:open', note.id);
  });
  document.getElementById('btn-new-folder').addEventListener('click', async () => {
    const name = prompt('Folder name:');
    if (name) await createFolder(name);
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
}

function renderFileTree() {
  const root = document.getElementById('file-tree');
  root.innerHTML = '';
  const folders = [...state.folders.values()];
  const notesByFolder = new Map();
  for (const note of state.notes.values()) {
    const key = note.folder || '';
    if (!notesByFolder.has(key)) notesByFolder.set(key, []);
    notesByFolder.get(key).push(note);
  }

  function renderFolder(name, notes) {
    const wrap = document.createElement('div');
    wrap.className = 'tree-node';
    if (name) {
      const row = document.createElement('div');
      row.className = 'tree-row';
      row.innerHTML = `<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg> 📁 ${name}`;
      row.addEventListener('click', () => {
        const kids = wrap.querySelector('.tree-children');
        kids.style.display = kids.style.display === 'none' ? 'block' : 'none';
      });
      wrap.appendChild(row);
    }
    const children = document.createElement('div');
    children.className = 'tree-children';
    (notes || []).sort((a, b) => noteTitle(a).localeCompare(noteTitle(b))).forEach((note) => {
      const nrow = document.createElement('div');
      nrow.className = 'tree-row' + (state.activeNoteId === note.id ? ' active' : '');
      nrow.textContent = `📄 ${noteTitle(note)}`;
      nrow.addEventListener('click', () => bus.emit('note:open', note.id));
      nrow.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, [
          { label: 'Rename', action: async () => {
              const t = prompt('New title:', noteTitle(note));
              if (t) await renameNote(note.id, t);
            } },
          { label: 'Delete', danger: true, action: async () => {
              if (confirm(`Delete "${noteTitle(note)}"?`)) { await deleteNote(note.id); showToast('Note deleted'); bus.emit('note:closed', note.id); }
            } },
        ]);
      });
      children.appendChild(nrow);
    });
    if (!notes || !notes.length) {
      const empty = document.createElement('div');
      empty.className = 'tree-empty';
      empty.textContent = 'No notes';
      children.appendChild(empty);
    }
    wrap.appendChild(children);
    return wrap;
  }

  if (notesByFolder.has('')) root.appendChild(renderFolder('', notesByFolder.get('')));
  folders.forEach((f) => root.appendChild(renderFolder(f.name, notesByFolder.get(f.path) || notesByFolder.get(f.name))));

  if (!state.notes.size) {
    root.innerHTML = '<div class="tree-empty">No notes yet — click "+ New note" to begin.</div>';
  }
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
    chip.innerHTML = `#${tag} <span class="count">${count}</span>`;
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
    row.innerHTML = `<span>🖼️ ${c.title}</span>`;
    row.addEventListener('click', () => { setActiveView('canvas'); bus.emit('canvas:open', c.id); });
    root.appendChild(row);
  });
}
