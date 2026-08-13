/**
 * command-palette.js — Ctrl/Cmd+K fuzzy command palette + Ctrl/Cmd+O quick switcher.
 */
import { state, bus, noteTitle, createNote } from './state.js';
import { setActiveView } from './layout-manager.js';

function fuzzyScore(query, text) {
  query = query.toLowerCase(); text = text.toLowerCase();
  if (!query) return 1;
  if (text.includes(query)) return 100 - text.indexOf(query);
  let qi = 0, score = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) { score++; qi++; }
  }
  return qi === query.length ? score : -1;
}

function getCommands() {
  return [
    { label: 'New note', hint: 'Ctrl+N', action: async () => { const n = await createNote({ title: 'Untitled' }); bus.emit('note:open', n.id); setActiveView('editor'); } },
    { label: 'Open graph view', hint: 'Ctrl+G', action: () => setActiveView('graph') },
    { label: 'Open canvas / whiteboard', hint: '', action: () => setActiveView('canvas') },
    { label: 'Open database / kanban view', hint: '', action: () => setActiveView('database') },
    { label: "Open today's daily note", hint: '', action: () => bus.emit('daily-note:open') },
    { label: 'Open settings', hint: '', action: () => setActiveView('settings') },
    { label: 'Toggle theme', hint: '', action: () => bus.emit('theme:toggle') },
    { label: 'Export vault as .zip', hint: '', action: () => bus.emit('sync:export') },
    { label: 'Sync now', hint: '', action: () => bus.emit('sync:now') },
  ];
}

export function initCommandPalette() {
  const backdrop = document.getElementById('modal-backdrop');
  const palette = document.getElementById('command-palette');
  const input = document.getElementById('palette-input');
  const results = document.getElementById('palette-results');

  const switcher = document.getElementById('quick-switcher');
  const switcherInput = document.getElementById('switcher-input');
  const switcherResults = document.getElementById('switcher-results');

  function openPalette() {
    palette.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    input.value = '';
    input.focus();
    renderPaletteResults('');
  }
  function closePalette() { palette.classList.add('hidden'); backdrop.classList.add('hidden'); }

  function openSwitcher() {
    switcher.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    switcherInput.value = '';
    switcherInput.focus();
    renderSwitcherResults('');
  }
  function closeSwitcher() { switcher.classList.add('hidden'); backdrop.classList.add('hidden'); }

  function renderPaletteResults(query) {
    results.innerHTML = '';
    const cmdMatches = getCommands()
      .map((c) => ({ c, score: fuzzyScore(query, c.label) }))
      .filter((x) => x.score >= 0).sort((a, b) => b.score - a.score);
    const noteMatches = [...state.notes.values()]
      .map((n) => ({ n, score: fuzzyScore(query, noteTitle(n)) }))
      .filter((x) => x.score >= 0).sort((a, b) => b.score - a.score).slice(0, 6);

    cmdMatches.forEach(({ c }) => {
      const row = document.createElement('div');
      row.className = 'palette-item';
      row.innerHTML = `<span>${c.label}</span><span class="hint">${c.hint || ''}</span>`;
      row.addEventListener('click', () => { c.action(); closePalette(); });
      results.appendChild(row);
    });
    if (noteMatches.length) {
      const label = document.createElement('div');
      label.style.cssText = 'font-size:11px;color:var(--text-2);padding:8px 12px 4px;';
      label.textContent = 'NOTES';
      results.appendChild(label);
      noteMatches.forEach(({ n }) => {
        const row = document.createElement('div');
        row.className = 'palette-item';
        row.innerHTML = `<span>📄 ${noteTitle(n)}</span>`;
        row.addEventListener('click', () => { bus.emit('note:open', n.id); setActiveView('editor'); closePalette(); });
        results.appendChild(row);
      });
    }
    if (results.children.length) results.children[0].classList.add('active');
  }

  function renderSwitcherResults(query) {
    switcherResults.innerHTML = '';
    const matches = [...state.notes.values()]
      .map((n) => ({ n, score: fuzzyScore(query, noteTitle(n)) }))
      .filter((x) => x.score >= 0).sort((a, b) => b.score - a.score).slice(0, 20);
    if (!matches.length) {
      switcherResults.innerHTML = `<div class="palette-item">Create note "${query}" ↵</div>`;
      switcherResults.firstChild.addEventListener('click', async () => {
        const n = await createNote({ title: query || 'Untitled' });
        bus.emit('note:open', n.id); setActiveView('editor'); closeSwitcher();
      });
      return;
    }
    matches.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'palette-item' + (i === 0 ? ' active' : '');
      row.textContent = noteTitle(m.n);
      row.addEventListener('click', () => { bus.emit('note:open', m.n.id); setActiveView('editor'); closeSwitcher(); });
      switcherResults.appendChild(row);
    });
  }

  function navigate(container, key) {
    const items = [...container.querySelectorAll('.palette-item')];
    const idx = items.findIndex((i) => i.classList.contains('active'));
    if (key === 'Enter') { (items[idx] || items[0])?.click(); return; }
    let next = key === 'ArrowDown' ? idx + 1 : idx - 1;
    next = Math.max(0, Math.min(items.length - 1, next));
    items.forEach((i) => i.classList.remove('active'));
    if (items[next]) items[next].classList.add('active');
  }

  input.addEventListener('input', () => renderPaletteResults(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePalette();
    else if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) { e.preventDefault(); navigate(results, e.key); }
  });
  switcherInput.addEventListener('input', () => renderSwitcherResults(switcherInput.value));
  switcherInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSwitcher();
    else if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) { e.preventDefault(); navigate(switcherResults, e.key); }
  });

  document.getElementById('btn-search').addEventListener('click', openPalette);
  bus.on('ui:open-palette', openPalette);
  backdrop.addEventListener('click', () => { closePalette(); closeSwitcher(); });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); openSwitcher(); }
    else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); document.getElementById('btn-new-note').click(); }
    else if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); setActiveView('graph'); }
    else if (e.key === 'Escape') { closePalette(); closeSwitcher(); }
  });
}
