/* =========================================================================
 * Nodalis — ui/palette.js
 * One overlay, three modes:
 *   'all'      commands + notes + tags   (Mod+K)
 *   'notes'    quick switcher            (Mod+O)
 *   'commands' commands only             (Mod+Shift+P)
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let node = null, input = null, list = null;
  let results = [];
  let index = 0;
  let mode = 'all';
  let closeFn = null;

  const PLACEHOLDER = {
    all: 'Search notes, run a command, jump to a tag…',
    notes: 'Jump to a note…',
    commands: 'Run a command…',
  };

  function open(which) {
    mode = which || 'all';
    if (node) { input.value = ''; input.placeholder = PLACEHOLDER[mode]; refresh(); input.focus(); return; }

    node = el('div.palette', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' });

    const row = el('div.palette-input-row');
    row.appendChild(N.icons.node(mode === 'commands' ? 'command' : 'search', { size: 18 }));
    input = el('input.palette-input', {
      type: 'text', placeholder: PLACEHOLDER[mode], autocomplete: 'off',
      spellcheck: 'false', 'aria-label': 'Search', 'aria-autocomplete': 'list',
    });
    row.appendChild(input);
    node.appendChild(row);

    list = el('div.palette-results', { role: 'listbox' });
    node.appendChild(list);

    const foot = el('div.palette-foot');
    foot.appendChild(el('span', null, [el('kbd.kbd', null, '↑↓'), ' navigate']));
    foot.appendChild(el('span', null, [el('kbd.kbd', null, '↵'), ' open']));
    foot.appendChild(el('span', null, [el('kbd.kbd', null, 'esc'), ' close']));
    if (mode !== 'commands') foot.appendChild(el('span', null, [el('kbd.kbd', null, '>'), ' commands only']));
    node.appendChild(foot);

    document.body.appendChild(node);
    const scrim = document.getElementById('scrim');
    if (scrim) scrim.classList.add('is-open');

    input.addEventListener('input', refresh);
    input.addEventListener('keydown', onKey);

    const onOutside = function (e) { if (node && !node.contains(e.target)) close(); };
    setTimeout(function () { document.addEventListener('mousedown', onOutside, true); }, 0);
    closeFn = function () { document.removeEventListener('mousedown', onOutside, true); };

    refresh();
    input.focus();
  }

  function close() {
    if (!node) return;
    if (closeFn) { closeFn(); closeFn = null; }
    node.style.animation = 'fade-out 130ms var(--ease-in-out) forwards';
    const dead = node;
    setTimeout(function () { if (dead.parentNode) dead.parentNode.removeChild(dead); }, 180);
    node = null; input = null; list = null; results = []; index = 0;
    const scrim = document.getElementById('scrim');
    if (scrim && !N.modal.anyOpen()) scrim.classList.remove('is-open');
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); move(-1); return; }
    if (e.key === 'Home') { e.preventDefault(); index = 0; paintSelection(); return; }
    if (e.key === 'End') { e.preventDefault(); index = Math.max(0, results.length - 1); paintSelection(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[index];
      if (hit) activate(hit, e.shiftKey);
      else if (mode !== 'commands' && input.value.trim()) createFromQuery(input.value.trim());
      return;
    }
    if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
  }

  function move(delta) {
    if (!results.length) return;
    index = (index + delta + results.length) % results.length;
    paintSelection();
  }

  function paintSelection() {
    const rows = U.$$('.palette-item', list);
    rows.forEach(function (r, i) { r.classList.toggle('is-selected', i === index); });
    if (rows[index]) rows[index].scrollIntoView({ block: 'nearest' });
  }

  function refresh() {
    if (!node) return;
    const raw = input.value;
    let query = raw;
    let effectiveMode = mode;

    // ">" switches to commands, "#" to tags — a familiar convention.
    if (raw.startsWith('>')) { effectiveMode = 'commands'; query = raw.slice(1).trim(); }
    else if (raw.startsWith('#')) { effectiveMode = 'tags'; query = raw.slice(1).trim(); }

    results = [];

    if (effectiveMode === 'commands' || effectiveMode === 'all') {
      const cmds = N.commands.search(query).slice(0, effectiveMode === 'commands' ? 60 : 8);
      cmds.forEach(function (r) {
        results.push({
          kind: 'command', id: r.cmd.id, icon: r.cmd.icon,
          title: r.cmd.title, titleHtml: U.highlightIndices(r.cmd.title, r.indices),
          sub: r.cmd.group, hint: formatAccel(r.cmd.id), score: r.score + (effectiveMode === 'commands' ? 200 : 0),
        });
      });
    }

    if (effectiveMode === 'notes' || effectiveMode === 'all') {
      const notes = searchNotes(query, effectiveMode === 'notes' ? 60 : 12);
      notes.forEach(function (r) { results.push(r); });
    }

    if (effectiveMode === 'tags' || (effectiveMode === 'all' && query)) {
      N.store.allTags().forEach(function (t) {
        const m = query ? U.fuzzyMatch(query, t.tag) : { score: t.count, indices: [] };
        if (!m) return;
        results.push({
          kind: 'tag', id: t.tag, icon: 'tag', title: '#' + t.tag,
          titleHtml: '#' + U.highlightIndices(t.tag, m.indices),
          sub: U.pluralize(t.count, 'note'), score: m.score,
        });
      });
    }

    results.sort(function (a, b) { return b.score - a.score; });
    if (effectiveMode === 'all') results = results.slice(0, 40);
    index = 0;
    paint(query, effectiveMode);
  }

  function searchNotes(query, limit) {
    const out = [];
    N.store.allNotes().forEach(function (note) {
      const title = N.store.noteTitle(note);
      const m = query ? U.fuzzyMatch(query, title) : null;
      let score, indices = [];
      if (m) { score = m.score; indices = m.indices; }
      else if (!query) { score = (note.lastOpenedAt || note.updatedAt || 0) / 1e9; }
      else {
        // Fall back to a path or alias match so [[Folder/Note]] is findable.
        const alt = U.fuzzyMatch(query, note.path + ' ' + (note.aliases || []).join(' '));
        if (!alt) return;
        score = alt.score - 30;
      }
      if (note.pinned) score += 15;
      out.push({
        kind: 'note', id: note.id, icon: note.pinned ? 'pin' : 'note',
        title: title, titleHtml: U.highlightIndices(title, indices),
        sub: (note.folder || 'Vault root') + ' · ' + U.relativeTime(note.updatedAt),
        score: score,
      });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit);
  }

  function formatAccel(commandId) {
    const accel = N.shortcuts.accelFor(commandId);
    return accel ? N.shortcuts.format(accel) : '';
  }

  function paint(query, effectiveMode) {
    U.clear(list);

    if (!results.length) {
      const empty = el('div.empty-state', { style: { minHeight: '150px' } });
      empty.appendChild(N.icons.node('search', { size: 26 }));
      empty.appendChild(el('div.empty-state-title', { style: { fontSize: 'var(--text-base)' } }, 'Nothing found'));
      if (effectiveMode !== 'commands' && query) {
        empty.appendChild(el('p.empty-state-text.small', null, 'Press Enter to create a note called "' + query + '".'));
      }
      list.appendChild(empty);
      return;
    }

    let lastGroup = null;
    results.forEach(function (r, i) {
      const group = r.kind === 'command' ? 'Commands' : (r.kind === 'note' ? 'Notes' : 'Tags');
      if (group !== lastGroup) {
        list.appendChild(el('div.palette-group-label', null, group));
        lastGroup = group;
      }
      const row = el('button.palette-item' + (i === index ? '.is-selected' : ''), {
        type: 'button', role: 'option',
        onclick: function () { activate(r); },
        onmousemove: function () { if (index !== i) { index = i; paintSelection(); } },
      });
      row.appendChild(N.icons.node(r.icon, { size: 16 }));
      const main = el('div.palette-item-main');
      main.appendChild(el('div.palette-item-title', { html: r.titleHtml || U.escapeHtml(r.title) }));
      if (r.sub) main.appendChild(el('div.palette-item-sub', null, r.sub));
      row.appendChild(main);
      if (r.hint) row.appendChild(el('span.kbd', null, r.hint));
      list.appendChild(row);
    });
  }

  function activate(hit) {
    close();
    if (hit.kind === 'command') N.commands.run(hit.id, { source: 'palette' });
    else if (hit.kind === 'note') N.app.openNote(hit.id);
    else if (hit.kind === 'tag') N.search.openTag(hit.id);
  }

  async function createFromQuery(title) {
    close();
    const note = await N.store.createNote({ title: title });
    N.app.openNote(note.id);
    N.toast.success('Created "' + N.store.noteTitle(note) + '"', { ms: 2000 });
  }

  function isOpen() { return !!node; }

  N.palette = { open: open, close: close, isOpen: isOpen };
})(window.NODALIS = window.NODALIS || {});
