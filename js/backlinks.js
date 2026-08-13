/**
 * backlinks.js — right panel: linked/unlinked backlinks, outline, properties.
 */
import { state, bus, noteTitle, extractLinks, escapeRegExp } from './state.js';

export function initBacklinks() {
  bus.on('note:opened', (note) => {
    renderBacklinks(note);
    renderOutline(note);
    renderProperties(note);
  });
  bus.on('note:updated', (note) => {
    if (note.id === state.activeNoteId) {
      renderBacklinks(note);
      renderOutline(note);
      renderProperties(note);
    }
  });
}

function snippetAround(content, index, len) {
  const start = Math.max(0, index - 40);
  const end = Math.min(content.length, index + len + 40);
  return (start > 0 ? '…' : '') + content.slice(start, end).replace(/\n/g, ' ') + (end < content.length ? '…' : '');
}

function renderBacklinks(activeNote) {
  const root = document.getElementById('right-backlinks');
  root.innerHTML = '';
  const title = noteTitle(activeNote);
  const linked = [];
  const unlinked = [];

  for (const n of state.notes.values()) {
    if (n.id === activeNote.id) continue;
    const links = extractLinks(n.content).map((t) => t.toLowerCase());
    if (links.includes(title.toLowerCase())) {
      const re = new RegExp(`\\[\\[${escapeRegExp(title)}[^\\]]*\\]\\]`, 'i');
      const m = re.exec(n.content);
      linked.push({ note: n, snippet: m ? snippetAround(n.content, m.index, m[0].length) : '' });
    } else {
      const re = new RegExp(escapeRegExp(title), 'i');
      const m = re.exec(n.content);
      if (m) unlinked.push({ note: n, snippet: snippetAround(n.content, m.index, title.length) });
    }
  }

  root.appendChild(section('Linked mentions', linked));
  root.appendChild(section('Unlinked mentions', unlinked));

  function section(label, arr) {
    const wrap = document.createElement('div');
    wrap.className = 'backlink-group';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;text-transform:uppercase;color:var(--text-2);margin-bottom:8px;letter-spacing:.04em;';
    h.textContent = `${label} (${arr.length})`;
    wrap.appendChild(h);
    if (!arr.length) {
      const e = document.createElement('div');
      e.className = 'panel-empty';
      e.textContent = 'None yet.';
      wrap.appendChild(e);
    }
    arr.forEach(({ note, snippet }) => {
      const src = document.createElement('div');
      src.className = 'backlink-source';
      src.textContent = noteTitle(note);
      src.addEventListener('click', () => bus.emit('note:open', note.id));
      wrap.appendChild(src);
      if (snippet) {
        const sn = document.createElement('div');
        sn.className = 'backlink-snippet';
        sn.innerHTML = escapeHtml(snippet).replace(new RegExp(escapeRegExp(title), 'gi'), (m) => `<mark>${m}</mark>`);
        wrap.appendChild(sn);
      }
    });
    return wrap;
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderOutline(note) {
  const root = document.getElementById('right-outline');
  root.innerHTML = '';
  const lines = note.content.split('\n');
  const headings = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^#{1,3}\s+/.test(l));
  if (!headings.length) { root.innerHTML = '<div class="panel-empty">No headings in this note.</div>'; return; }
  headings.forEach(({ l }) => {
    const level = l.match(/^#+/)[0].length;
    const text = l.replace(/^#+\s+/, '');
    const item = document.createElement('div');
    item.className = `outline-item level-${level}`;
    item.textContent = text;
    item.addEventListener('click', () => {
      const textarea = document.getElementById('note-editor');
      const idx = textarea.value.indexOf(l);
      if (idx >= 0) { textarea.focus(); textarea.selectionStart = textarea.selectionEnd = idx; }
    });
    root.appendChild(item);
  });
}

function renderProperties(note) {
  const root = document.getElementById('right-properties');
  root.innerHTML = '';
  const props = note.properties || {};
  const keys = Object.keys(props);
  if (!keys.length) { root.innerHTML = '<div class="panel-empty">No properties. Add a YAML frontmatter block at the top of the note.</div>'; return; }
  keys.forEach((k) => {
    const row = document.createElement('div');
    row.className = 'prop-row';
    const val = Array.isArray(props[k]) ? props[k].join(', ') : props[k];
    row.innerHTML = `<span class="prop-key">${k}</span><span>${val}</span>`;
    root.appendChild(row);
  });
}
