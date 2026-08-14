/* =========================================================================
 * Nodalis — features/database.js
 * Notion-style views over your notes: table, board, gallery and calendar,
 * driven by frontmatter properties. Filters, sorts, grouping and saved views.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let body, sourceSel, groupSel;
  let layout = 'table';
  let scope = 'all';
  let groupBy = '';
  let sortKey = 'updatedAt';
  let sortDir = -1;
  let filters = [];              // [{ key, op, value }]
  let dragCard = null;

  const BUILTIN_COLUMNS = [
    { key: '__title', label: 'Name', type: 'title' },
    { key: '__folder', label: 'Folder', type: 'text' },
    { key: '__tags', label: 'Tags', type: 'tags' },
    { key: '__tasks', label: 'Tasks', type: 'text' },
    { key: '__words', label: 'Words', type: 'number' },
    { key: 'updatedAt', label: 'Modified', type: 'date' },
    { key: 'createdAt', label: 'Created', type: 'date' },
  ];

  function init() {
    body = document.getElementById('db-body');
    sourceSel = document.getElementById('db-source');
    groupSel = document.getElementById('db-group');
    if (!body) return;

    U.delegate(document.getElementById('db-layout'), 'click', 'button', function (e, btn) {
      layout = btn.dataset.layout;
      U.$$('#db-layout button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      render();
    });
    sourceSel.addEventListener('change', function () { scope = sourceSel.value; render(); });
    groupSel.addEventListener('change', function () { groupBy = groupSel.value; render(); });
    document.getElementById('db-filter').addEventListener('click', function (e) { openFilterMenu(e.currentTarget); });
    document.getElementById('db-new-view').addEventListener('click', saveView);

    N.bus.on('view:changed', function (v) { if (v === 'database') { refreshSelectors(); render(); } });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'database') { refreshSelectors(); render(); }
    }, 400));

    registerCommands();
  }

  /* ------------------------------------------------------------- data */

  function propertyKeys() {
    const keys = new Set();
    N.store.allNotes().forEach(function (n) {
      Object.keys(n.properties || {}).forEach(function (k) { if (k !== '__raw') keys.add(k); });
    });
    return Array.from(keys).sort();
  }

  function rows() {
    let list = N.store.allNotes();
    if (scope.startsWith('folder:')) {
      const path = scope.slice(7);
      list = list.filter(function (n) { return n.folder === path || n.folder.startsWith(path + '/'); });
    } else if (scope.startsWith('tag:')) {
      const tag = scope.slice(4);
      list = N.store.notesWithTag(tag);
    } else if (scope.startsWith('search:')) {
      const result = N.search.search(scope.slice(7));
      list = (result.hits || []).map(function (h) { return h.note; });
    }

    filters.forEach(function (f) {
      list = list.filter(function (note) { return passesFilter(note, f); });
    });

    list.sort(function (a, b) {
      const av = valueOf(a, sortKey), bv = valueOf(b, sortKey);
      return U.compareValues(av, bv) * sortDir;
    });
    return list;
  }

  function passesFilter(note, f) {
    const value = valueOf(note, f.key);
    const want = f.value;
    const s = String(value === null || value === undefined ? '' : value).toLowerCase();
    const w = String(want === null || want === undefined ? '' : want).toLowerCase();
    switch (f.op) {
      case 'is': return s === w;
      case 'is-not': return s !== w;
      case 'contains': return s.indexOf(w) !== -1;
      case 'not-contains': return s.indexOf(w) === -1;
      case 'empty': return !s;
      case 'not-empty': return !!s;
      case 'gt': return Number(value) > Number(want);
      case 'lt': return Number(value) < Number(want);
      default: return true;
    }
  }

  function valueOf(note, key) {
    if (key === '__title') return N.store.noteTitle(note);
    if (key === '__folder') return note.folder || '';
    if (key === '__tags') return (note.tags || []).join(', ');
    if (key === '__words') return note.words || 0;
    if (key === '__tasks') return note.taskCounts ? (note.taskCounts.done + '/' + note.taskCounts.total) : '';
    if (key === 'updatedAt' || key === 'createdAt') return note[key] || 0;
    const v = note.properties ? note.properties[key] : undefined;
    return Array.isArray(v) ? v.join(', ') : v;
  }

  function columns() {
    return BUILTIN_COLUMNS.concat(propertyKeys().map(function (k) {
      return { key: k, label: k, type: guessType(k) };
    }));
  }

  function guessType(key) {
    const values = N.store.allNotes()
      .map(function (n) { return n.properties ? n.properties[key] : undefined; })
      .filter(function (v) { return v !== undefined && v !== ''; });
    if (!values.length) return 'text';
    if (values.every(function (v) { return typeof v === 'boolean'; })) return 'checkbox';
    if (values.every(function (v) { return typeof v === 'number'; })) return 'number';
    if (values.every(function (v) { return /^\d{4}-\d{2}-\d{2}/.test(String(v)); })) return 'date';
    if (values.every(function (v) { return Array.isArray(v); })) return 'multi';
    const unique = new Set(values.map(String));
    if (unique.size <= Math.max(6, values.length / 3)) return 'select';
    return 'text';
  }

  function refreshSelectors() {
    if (!sourceSel) return;
    const prevScope = scope;
    sourceSel.innerHTML = '';
    sourceSel.appendChild(el('option', { value: 'all' }, 'All notes'));
    Array.from(N.store.state.folders.values())
      .sort(function (a, b) { return a.path.localeCompare(b.path); })
      .forEach(function (f) { sourceSel.appendChild(el('option', { value: 'folder:' + f.path }, f.path)); });
    N.store.allTags().slice(0, 40).forEach(function (t) {
      sourceSel.appendChild(el('option', { value: 'tag:' + t.tag }, '#' + t.tag));
    });
    sourceSel.value = prevScope;
    if (sourceSel.value !== prevScope) { scope = 'all'; sourceSel.value = 'all'; }

    const prevGroup = groupBy;
    groupSel.innerHTML = '';
    groupSel.appendChild(el('option', { value: '' }, 'No grouping'));
    groupSel.appendChild(el('option', { value: '__folder' }, 'Group by folder'));
    propertyKeys().forEach(function (k) {
      groupSel.appendChild(el('option', { value: k }, 'Group by ' + k));
    });
    groupSel.value = prevGroup;
    if (groupSel.value !== prevGroup) groupBy = '';
  }

  /* ---------------------------------------------------------- rendering */

  function render() {
    if (!body) return;
    U.clear(body);
    const list = rows();

    if (!list.length) {
      body.appendChild(emptyState());
      return;
    }

    if (layout === 'table') renderTable(list);
    else if (layout === 'board') renderBoard(list);
    else if (layout === 'gallery') renderGallery(list);
    else renderCalendar(list);
  }

  function emptyState() {
    const wrap = el('div.empty-state');
    wrap.appendChild(N.icons.node('database', { size: 44 }));
    wrap.appendChild(el('div.empty-state-title', null, filters.length ? 'Nothing matches these filters' : 'No notes in this view'));
    wrap.appendChild(el('p.empty-state-text', null,
      filters.length
        ? 'Loosen or clear the filters to see more.'
        : 'Add a YAML block at the top of a note — like status: doing — and it becomes a column here.'));
    const actions = el('div.empty-state-actions');
    if (filters.length) {
      actions.appendChild(el('button.btn', { type: 'button', onclick: function () { filters = []; render(); } }, 'Clear filters'));
    }
    actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { N.commands.run('note.new'); } }, 'New note'));
    wrap.appendChild(actions);
    return wrap;
  }

  function renderTable(list) {
    const scroll = el('div.db-scroll');
    const table = el('table.db-table');
    const cols = columns().filter(function (c) {
      if (c.key.startsWith('__') || c.key === 'updatedAt' || c.key === 'createdAt') return c.key !== 'createdAt';
      return true;
    });

    const thead = el('thead');
    const hr = el('tr');
    cols.forEach(function (col) {
      const th = el('th', { title: 'Sort by ' + col.label });
      th.appendChild(el('span', null, col.label));
      if (sortKey === col.key) th.appendChild(el('span.sort-mark', null, sortDir === 1 ? '↑' : '↓'));
      th.addEventListener('click', function () {
        if (sortKey === col.key) sortDir = -sortDir;
        else { sortKey = col.key; sortDir = 1; }
        render();
      });
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el('tbody');
    list.forEach(function (note) {
      const tr = el('tr');
      cols.forEach(function (col) {
        const td = el('td');
        renderCell(td, note, col);
        tr.appendChild(td);
      });
      tr.addEventListener('click', function (e) {
        if (e.target.closest('[contenteditable],input,button,a')) return;
        N.app.openNote(note.id);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);

    const foot = el('div', { style: { padding: '10px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-2)' } },
      U.pluralize(list.length, 'note') + (filters.length ? ' · ' + U.pluralize(filters.length, 'filter') : ''));
    scroll.appendChild(foot);
    body.appendChild(scroll);
  }

  function renderCell(td, note, col) {
    const value = valueOf(note, col.key);
    if (col.key === '__title') {
      const wrap = el('div.row', { style: { gap: '8px' } });
      wrap.appendChild(N.icons.node(note.pinned ? 'pin' : 'note', { size: 14 }));
      wrap.appendChild(el('span.truncate', null, String(value)));
      td.appendChild(wrap);
      return;
    }
    if (col.key === '__tags') {
      if (!(note.tags || []).length) { td.appendChild(el('span.dim', null, '—')); return; }
      const wrap = el('div.row', { style: { gap: '4px', flexWrap: 'wrap' } });
      (note.tags || []).slice(0, 4).forEach(function (t) {
        wrap.appendChild(el('span.chip', { style: { height: '18px', fontSize: '11px' } }, '#' + t));
      });
      td.appendChild(wrap);
      return;
    }
    if (col.type === 'date' && (col.key === 'updatedAt' || col.key === 'createdAt')) {
      td.appendChild(el('span.small.muted', { title: U.formatDate(value) + ' ' + U.formatTime(value) }, U.relativeTime(value)));
      return;
    }
    if (col.type === 'checkbox') {
      const box = el('input', { type: 'checkbox', checked: value === true });
      box.addEventListener('change', function () {
        N.store.updateNoteProperties(note.id, defineProp(col.key, box.checked));
      });
      td.appendChild(box);
      return;
    }
    if (col.key.startsWith('__')) {
      td.appendChild(el('span' + (value ? '' : '.dim'), null, value ? String(value) : '—'));
      return;
    }

    // Editable property cell.
    const cell = el('div.db-cell-editable', {
      contenteditable: 'plaintext-only', tabindex: '0',
    }, value === undefined || value === '' ? '' : String(value));
    if (value === undefined || value === '') cell.appendChild(el('span.dim', null, '—'));
    cell.addEventListener('focus', function () { if (value === undefined || value === '') cell.textContent = ''; });
    cell.addEventListener('blur', function () {
      const next = cell.textContent.trim();
      const original = value === undefined ? '' : String(value);
      if (next === original) { if (!next) { cell.textContent = ''; cell.appendChild(el('span.dim', null, '—')); } return; }
      N.store.updateNoteProperties(note.id, defineProp(col.key, coerce(next)));
    });
    cell.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); }
      if (e.key === 'Escape') { cell.textContent = original(); cell.blur(); }
      function original() { return value === undefined ? '' : String(value); }
    });
    td.appendChild(cell);
  }

  function defineProp(key, value) {
    const patch = {};
    patch[key] = value;
    return patch;
  }

  function coerce(raw) {
    const v = String(raw).trim();
    if (v === '') return undefined;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.indexOf(',') !== -1) return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return v;
  }

  function groupsFor(list) {
    const key = groupBy || guessBoardKey();
    const map = new Map();
    list.forEach(function (note) {
      let value = key === '__folder' ? (note.folder || 'Vault root') : valueOf(note, key);
      if (value === undefined || value === null || value === '') value = 'No ' + (key === '__folder' ? 'folder' : key);
      const label = String(value);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(note);
    });
    return { key: key, map: map };
  }

  function guessBoardKey() {
    const keys = propertyKeys();
    const preferred = ['status', 'stage', 'state', 'kanban', 'column', 'priority', 'category', 'type'];
    for (const p of preferred) if (keys.indexOf(p) !== -1) return p;
    return keys[0] || '__folder';
  }

  function renderBoard(list) {
    const grouped = groupsFor(list);
    const board = el('div.db-board');

    if (grouped.key === '__folder' && !propertyKeys().length) {
      board.appendChild(el('div.banner', { style: { marginBottom: '12px', flex: '0 0 100%' } }, [
        N.icons.node('info', { size: 18 }),
        el('div.banner-main', null, [
          el('div.banner-title', null, 'Grouping by folder'),
          el('div', null, 'Add a property like status: doing to a note and the board will group by that instead.'),
        ]),
      ]));
    }

    Array.from(grouped.map.entries())
      .sort(function (a, b) { return a[0].localeCompare(b[0]); })
      .forEach(function (entry) {
        const label = entry[0], notes = entry[1];
        const col = el('div.kanban-col', { dataset: { group: label } });
        const head = el('div.kanban-col-head');
        head.appendChild(el('span.chip-dot', { style: { background: U.colorFromString(label) } }));
        head.appendChild(el('span.truncate', { style: { flex: '1' } }, label));
        head.appendChild(el('span.badge.badge-quiet', null, String(notes.length)));
        col.appendChild(head);

        const colBody = el('div.kanban-col-body');
        notes.forEach(function (note) {
          const card = el('div.kanban-card', { draggable: 'true', dataset: { note: note.id } });
          card.appendChild(el('div.kanban-card-title', null, N.store.noteTitle(note)));
          const excerpt = N.markdown.excerpt(note.content, 90);
          if (excerpt) card.appendChild(el('div.small.muted', { style: { lineHeight: '1.45' } }, excerpt));
          const meta = el('div.kanban-card-meta');
          (note.tags || []).slice(0, 3).forEach(function (t) { meta.appendChild(el('span', null, '#' + t)); });
          if (note.taskCounts && note.taskCounts.total) meta.appendChild(el('span', null, note.taskCounts.done + '/' + note.taskCounts.total));
          meta.appendChild(el('span', null, U.relativeTime(note.updatedAt)));
          card.appendChild(meta);

          card.addEventListener('click', function () { N.app.openNote(note.id); });
          card.addEventListener('dragstart', function (e) {
            dragCard = { noteId: note.id, from: label };
            card.classList.add('is-dragging');
            try { e.dataTransfer.setData('text/plain', note.id); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
          });
          card.addEventListener('dragend', function () { card.classList.remove('is-dragging'); dragCard = null; });
          colBody.appendChild(card);
        });
        col.appendChild(colBody);

        col.addEventListener('dragover', function (e) {
          if (!dragCard) return;
          e.preventDefault();
          col.classList.add('is-drop-target');
        });
        col.addEventListener('dragleave', function () { col.classList.remove('is-drop-target'); });
        col.addEventListener('drop', async function (e) {
          e.preventDefault();
          col.classList.remove('is-drop-target');
          if (!dragCard) return;
          const noteId = dragCard.noteId;
          dragCard = null;
          if (grouped.key === '__folder') {
            const folder = label === 'Vault root' ? '' : label;
            await N.store.moveNote(noteId, folder);
          } else {
            const value = label.startsWith('No ') ? undefined : label;
            await N.store.updateNoteProperties(noteId, defineProp(grouped.key, value));
          }
          render();
        });

        board.appendChild(col);
      });

    if (grouped.key !== '__folder') {
      const addCol = el('div.kanban-col', { style: { background: 'transparent', borderStyle: 'dashed', minHeight: '80px' } });
      const btn = el('button.btn.btn-ghost.btn-block', { type: 'button', style: { height: '100%' } },
        [N.icons.node('plus', { size: 15 }), el('span', null, 'New group')]);
      btn.addEventListener('click', async function () {
        const value = await N.modal.prompt({ title: 'New ' + grouped.key + ' value', placeholder: 'e.g. blocked' });
        if (!value) return;
        const noteChoice = await N.modal.choose({
          title: 'Add which note to "' + value + '"?',
          options: N.store.allNotes().slice(0, 40).map(function (n) {
            return { value: n.id, label: N.store.noteTitle(n), icon: 'note' };
          }),
        });
        if (!noteChoice) return;
        await N.store.updateNoteProperties(noteChoice, defineProp(grouped.key, value));
        render();
      });
      addCol.appendChild(btn);
      board.appendChild(addCol);
    }

    body.appendChild(board);
  }

  function renderGallery(list) {
    const scroll = el('div.db-scroll');
    const grid = el('div.db-gallery.stagger');
    list.forEach(function (note, i) {
      const card = el('div.gallery-card', { style: { '--i': i } });
      const head = el('div.row', { style: { gap: '8px' } });
      head.appendChild(N.icons.node(note.pinned ? 'pin' : 'note', { size: 15 }));
      head.appendChild(el('strong.truncate', null, N.store.noteTitle(note)));
      card.appendChild(head);
      card.appendChild(el('div.gallery-card-excerpt', null, N.markdown.excerpt(note.content, 150) || 'Empty note'));
      const meta = el('div.row', { style: { gap: '6px', flexWrap: 'wrap' } });
      (note.tags || []).slice(0, 3).forEach(function (t) {
        meta.appendChild(el('span.chip', { style: { height: '18px', fontSize: '11px' } }, '#' + t));
      });
      card.appendChild(meta);
      card.appendChild(el('div.small.dim', null, U.relativeTime(note.updatedAt)));
      card.addEventListener('click', function () { N.app.openNote(note.id); });
      grid.appendChild(card);
    });
    scroll.appendChild(grid);
    body.appendChild(scroll);
  }

  function renderCalendar(list) {
    const scroll = el('div.db-scroll');
    const wrap = el('div.db-calendar');
    const state = { month: renderCalendar.month === undefined ? new Date().getMonth() : renderCalendar.month,
                    year: renderCalendar.year === undefined ? new Date().getFullYear() : renderCalendar.year };

    const dateKey = pickDateKey();
    const head = el('div.row', { style: { gap: '10px', marginBottom: '14px' } });
    const prev = el('button.icon-btn', { type: 'button', title: 'Previous month' });
    prev.appendChild(N.icons.node('chevron-left', { size: 17 }));
    prev.addEventListener('click', function () {
      renderCalendar.month = state.month - 1;
      if (renderCalendar.month < 0) { renderCalendar.month = 11; renderCalendar.year = state.year - 1; }
      else renderCalendar.year = state.year;
      render();
    });
    const next = el('button.icon-btn', { type: 'button', title: 'Next month' });
    next.appendChild(N.icons.node('chevron-right', { size: 17 }));
    next.addEventListener('click', function () {
      renderCalendar.month = state.month + 1;
      if (renderCalendar.month > 11) { renderCalendar.month = 0; renderCalendar.year = state.year + 1; }
      else renderCalendar.year = state.year;
      render();
    });
    head.appendChild(prev);
    head.appendChild(el('strong', { style: { minWidth: '160px', textAlign: 'center' } },
      new Date(state.year, state.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })));
    head.appendChild(next);
    head.appendChild(el('span.spacer'));
    head.appendChild(el('span.small.muted', null, 'Using "' + dateKey + '" as the date'));
    wrap.appendChild(head);

    const byDay = new Map();
    list.forEach(function (note) {
      let raw = dateKey === 'createdAt' || dateKey === 'updatedAt'
        ? U.todayKey(note[dateKey])
        : String(valueOf(note, dateKey) || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
      if (!byDay.has(raw)) byDay.set(raw, []);
      byDay.get(raw).push(note);
    });

    const grid = el('div.cal-grid');
    const weekStart = N.store.state.settings.weekStartsOn || 1;
    const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) grid.appendChild(el('div.cal-dow', null, dows[(i + weekStart) % 7]));

    const first = new Date(state.year, state.month, 1);
    const startOffset = (first.getDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const todayStr = U.todayKey();

    for (let i = 0; i < startOffset; i++) grid.appendChild(el('div.cal-day.is-other'));
    for (let d = 1; d <= daysInMonth; d++) {
      const key = state.year + '-' + String(state.month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const cell = el('div.cal-day' + (key === todayStr ? '.is-today' : ''));
      cell.appendChild(el('div.cal-daynum', null, String(d)));
      (byDay.get(key) || []).slice(0, 4).forEach(function (note) {
        const chip = el('div.cal-chip', { title: N.store.noteTitle(note) }, N.store.noteTitle(note));
        chip.addEventListener('click', function () { N.app.openNote(note.id); });
        cell.appendChild(chip);
      });
      const extra = (byDay.get(key) || []).length - 4;
      if (extra > 0) cell.appendChild(el('div.small.dim', null, '+' + extra + ' more'));
      grid.appendChild(cell);
    }
    const trailing = (7 - ((startOffset + daysInMonth) % 7)) % 7;
    for (let i = 0; i < trailing; i++) grid.appendChild(el('div.cal-day.is-other'));

    wrap.appendChild(grid);
    scroll.appendChild(wrap);
    body.appendChild(scroll);
  }

  function pickDateKey() {
    const keys = propertyKeys();
    for (const k of ['due', 'date', 'when', 'scheduled', 'deadline']) if (keys.indexOf(k) !== -1) return k;
    for (const k of keys) if (guessType(k) === 'date') return k;
    return 'updatedAt';
  }

  /* ------------------------------------------------------------ filters */

  function openFilterMenu(anchor) {
    const cols = columns();
    const items = [
      { header: filters.length ? U.pluralize(filters.length, 'active filter') : 'No filters' },
    ];
    filters.forEach(function (f, i) {
      items.push({
        label: f.key.replace('__', '') + ' ' + f.op + ' ' + (f.value || ''),
        icon: 'close',
        onClick: function () { filters.splice(i, 1); render(); },
      });
    });
    items.push({ separator: true }, { label: 'Add filter…', icon: 'plus', onClick: function () { addFilter(cols); } });
    if (filters.length) items.push({ label: 'Clear all filters', icon: 'trash', onClick: function () { filters = []; render(); } });
    N.menu.show(items, { anchor: anchor, align: 'right' });
  }

  async function addFilter(cols) {
    const key = await N.modal.choose({
      title: 'Filter on which field?',
      options: cols.map(function (c) { return { value: c.key, label: c.label, icon: 'filter' }; }),
    });
    if (!key) return;
    const op = await N.modal.choose({
      title: 'How should it match?',
      options: [
        { value: 'contains', label: 'contains' },
        { value: 'is', label: 'is exactly' },
        { value: 'is-not', label: 'is not' },
        { value: 'not-contains', label: 'does not contain' },
        { value: 'empty', label: 'is empty' },
        { value: 'not-empty', label: 'is not empty' },
        { value: 'gt', label: 'is greater than' },
        { value: 'lt', label: 'is less than' },
      ],
    });
    if (!op) return;
    let value = '';
    if (op !== 'empty' && op !== 'not-empty') {
      value = await N.modal.prompt({ title: 'Value', placeholder: 'Type a value', required: false });
      if (value === null) return;
    }
    filters.push({ key: key, op: op, value: value });
    render();
  }

  async function saveView() {
    const name = await N.modal.prompt({ title: 'Name this view', placeholder: 'e.g. Active projects' });
    if (!name) return;
    const views = (N.store.state.settings.savedViews || []).slice();
    views.push({ name: name, layout: layout, scope: scope, groupBy: groupBy, sortKey: sortKey, sortDir: sortDir, filters: U.deepClone(filters) });
    await N.store.setSetting('savedViews', views);
    N.toast.success('View saved — find it in the command palette', { ms: 2600 });
    N.commands.register({
      id: 'db.view.' + U.slugify(name),
      title: 'Open view: ' + name,
      group: 'Database', icon: 'database',
      run: function () { applyView(views[views.length - 1]); },
    });
  }

  function applyView(view) {
    layout = view.layout; scope = view.scope; groupBy = view.groupBy;
    sortKey = view.sortKey; sortDir = view.sortDir; filters = U.deepClone(view.filters || []);
    N.app.setView('database');
    refreshSelectors();
    U.$$('#db-layout button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.layout === layout); });
    if (sourceSel) sourceSel.value = scope;
    if (groupSel) groupSel.value = groupBy;
    render();
  }

  function openScope(nextScope) {
    scope = nextScope;
    N.app.setView('database');
    refreshSelectors();
    if (sourceSel) sourceSel.value = scope;
    render();
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'db.open', title: 'Open database view', group: 'View', icon: 'database', accel: 'Mod+Shift+B',
        run: function () { N.app.setView('database'); } },
      { id: 'db.table', title: 'Database: table layout', group: 'Database', icon: 'table',
        run: function () { layout = 'table'; openScope(scope); } },
      { id: 'db.board', title: 'Database: board layout', group: 'Database', icon: 'kanban',
        run: function () { layout = 'board'; openScope(scope); } },
      { id: 'db.gallery', title: 'Database: gallery layout', group: 'Database', icon: 'gallery',
        run: function () { layout = 'gallery'; openScope(scope); } },
      { id: 'db.calendar', title: 'Database: calendar layout', group: 'Database', icon: 'calendar',
        run: function () { layout = 'calendar'; openScope(scope); } },
      { id: 'db.clearFilters', title: 'Database: clear filters', group: 'Database', icon: 'filter',
        when: function () { return filters.length > 0; },
        run: function () { filters = []; render(); } },
    ]);

    // Re-register saved views on boot so their palette entries survive a reload.
    (N.store.state.settings.savedViews || []).forEach(function (view) {
      N.commands.register({
        id: 'db.view.' + U.slugify(view.name),
        title: 'Open view: ' + view.name,
        group: 'Database', icon: 'database',
        run: function () { applyView(view); },
      });
    });
  }

  N.database = { init: init, render: render, openScope: openScope, applyView: applyView };
})(window.NODALIS = window.NODALIS || {});
