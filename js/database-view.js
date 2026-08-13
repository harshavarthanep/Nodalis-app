/**
 * database-view.js — turns any folder or tag scope into a sortable/filterable
 * table, or a drag-and-drop kanban board grouped by a chosen property.
 */
import { state, bus, noteTitle, updateNoteContent } from './state.js';

let mode = 'table';
let scopeValue = 'all';
let groupByKey = null;
let sortKey = null, sortDir = 1;

export function initDatabaseView() {
  const scopeSelect = document.getElementById('db-scope');
  const groupSelect = document.getElementById('db-group-by');

  bus.on('vault:loaded', refresh);
  bus.on('vault:changed', refresh);
  bus.on('view:changed', (v) => { if (v === 'database') refresh(); });
  bus.on('tag:filter', (tag) => {
    scopeValue = 'tag:' + tag;
    document.querySelectorAll('.view-tab, .mobile-nav-btn').forEach((b) => {});
    import('./layout-manager.js').then(({ setActiveView }) => setActiveView('database'));
    refresh();
  });

  scopeSelect.addEventListener('change', () => { scopeValue = scopeSelect.value; render(); });
  groupSelect.addEventListener('change', () => { groupByKey = groupSelect.value || null; render(); });

  document.querySelectorAll('.db-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.db-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  refresh();
}

function refresh() {
  const scopeSelect = document.getElementById('db-scope');
  const groupSelect = document.getElementById('db-group-by');
  const folders = [...new Set([...state.notes.values()].map((n) => n.folder).filter(Boolean))];
  const tags = [...new Set([...state.notes.values()].flatMap((n) => n.tags || []))];

  scopeSelect.innerHTML = `<option value="all">All notes</option>` +
    folders.map((f) => `<option value="folder:${f}">📁 ${f}</option>`).join('') +
    tags.map((t) => `<option value="tag:${t}">#${t}</option>`).join('');
  if ([...scopeSelect.options].some((o) => o.value === scopeValue)) scopeSelect.value = scopeValue;
  else scopeValue = 'all';

  const propKeys = new Set();
  scopedNotes().forEach((n) => Object.keys(n.properties || {}).forEach((k) => propKeys.add(k)));
  groupSelect.innerHTML = `<option value="">Group by…</option>` + [...propKeys].map((k) => `<option value="${k}">${k}</option>`).join('');
  if (groupByKey && [...propKeys].includes(groupByKey)) groupSelect.value = groupByKey;

  render();
}

function scopedNotes() {
  let notes = [...state.notes.values()];
  if (scopeValue.startsWith('folder:')) notes = notes.filter((n) => n.folder === scopeValue.slice(7));
  else if (scopeValue.startsWith('tag:')) notes = notes.filter((n) => (n.tags || []).includes(scopeValue.slice(4)));
  return notes;
}

function render() {
  const root = document.getElementById('database-container');
  root.innerHTML = '';
  const notes = scopedNotes();
  if (!notes.length) { root.innerHTML = '<div class="panel-empty">No notes in this scope.</div>'; return; }

  if (mode === 'table') renderTable(root, notes);
  else renderKanban(root, notes);
}

function allPropKeys(notes) {
  const set = new Set();
  notes.forEach((n) => Object.keys(n.properties || {}).forEach((k) => set.add(k)));
  return [...set];
}

function renderTable(root, notes) {
  const keys = allPropKeys(notes);
  if (sortKey) {
    notes = [...notes].sort((a, b) => {
      const av = sortKey === '__title' ? noteTitle(a) : (a.properties || {})[sortKey] || '';
      const bv = sortKey === '__title' ? noteTitle(b) : (b.properties || {})[sortKey] || '';
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }
  const table = document.createElement('table');
  table.className = 'db-table';
  table.innerHTML = `<thead><tr>
    <th data-key="__title">Title</th>
    <th data-key="__folder">Folder</th>
    <th data-key="__tags">Tags</th>
    ${keys.map((k) => `<th data-key="${k}">${k}</th>`).join('')}
    <th data-key="__updated">Updated</th>
  </tr></thead><tbody>` +
    notes.map((n) => `<tr data-id="${n.id}">
      <td><a class="row-link">${noteTitle(n)}</a></td>
      <td>${n.folder || '—'}</td>
      <td>${(n.tags || []).map((t) => `#${t}`).join(' ') || '—'}</td>
      ${keys.map((k) => `<td>${formatVal((n.properties || {})[k])}</td>`).join('')}
      <td>${new Date(n.updatedAt).toLocaleDateString()}</td>
    </tr>`).join('') + '</tbody>';
  root.appendChild(table);

  table.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
    const key = th.dataset.key;
    sortDir = sortKey === key ? -sortDir : 1;
    sortKey = key;
    render();
  }));
  table.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => {
    bus.emit('note:open', tr.dataset.id);
    import('./layout-manager.js').then(({ setActiveView }) => setActiveView('editor'));
  }));
}

function formatVal(v) { return v == null ? '—' : Array.isArray(v) ? v.join(', ') : v; }

function renderKanban(root, notes) {
  const key = groupByKey;
  if (!key) {
    root.innerHTML = '<div class="panel-empty">Pick a property to group by (top right) to see the kanban board — or add YAML frontmatter like <code>status: todo</code> to your notes.</div>';
    return;
  }
  const groups = new Map();
  notes.forEach((n) => {
    const v = (n.properties || {})[key];
    const g = v == null || v === '' ? '(none)' : Array.isArray(v) ? v.join(', ') : v;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(n);
  });

  const board = document.createElement('div');
  board.className = 'kanban-board';
  [...groups.entries()].forEach(([label, arr]) => {
    const col = document.createElement('div');
    col.className = 'kanban-col';
    col.dataset.label = label;
    col.innerHTML = `<div class="kanban-col-title">${label} <span>${arr.length}</span></div>`;
    arr.forEach((n) => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.draggable = true;
      card.dataset.id = n.id;
      card.textContent = noteTitle(n);
      card.addEventListener('click', () => { bus.emit('note:open', n.id); import('./layout-manager.js').then(({ setActiveView }) => setActiveView('editor')); });
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', n.id));
      col.appendChild(card);
    });
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const note = state.notes.get(id);
      if (!note) return;
      await setPropertyAndSave(note, key, label === '(none)' ? '' : label);
      render();
    });
    board.appendChild(col);
  });
  root.appendChild(board);
}

async function setPropertyAndSave(note, key, value) {
  const fm = note.content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  let newContent;
  if (fm) {
    let body = fm[1];
    const lineRe = new RegExp(`^${key}\\s*:.*$`, 'm');
    if (lineRe.test(body)) body = body.replace(lineRe, `${key}: ${value}`);
    else body += `\n${key}: ${value}`;
    newContent = `---\n${body}\n---\n` + note.content.slice(fm[0].length);
  } else {
    newContent = `---\n${key}: ${value}\n---\n` + note.content;
  }
  await updateNoteContent(note.id, newContent);
}
