/* =========================================================================
 * Nodalis — features/matrix.js
 * Eisenhower matrix. Tasks land in a quadrant either because you dragged
 * them there, or — when you haven't — because their priority and due date
 * imply one. Dragging always wins and is remembered.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  const QUADRANTS = [
    { id: 'do', title: 'Do now', sub: 'Urgent · Important', icon: 'flame' },
    { id: 'schedule', title: 'Schedule', sub: 'Important · Not urgent', icon: 'calendar' },
    { id: 'delegate', title: 'Delegate', sub: 'Urgent · Not important', icon: 'share' },
    { id: 'drop', title: 'Drop', sub: 'Neither', icon: 'trash' },
  ];

  let body, scopeSel;
  let scope = 'all';
  let dragging = null;

  function init() {
    body = document.getElementById('matrix-body');
    scopeSel = document.getElementById('matrix-scope');
    if (!body) return;

    scopeSel.addEventListener('change', function () { scope = scopeSel.value; render(); });
    document.getElementById('matrix-help').addEventListener('click', explain);

    N.bus.on('view:changed', function (v) { if (v === 'matrix') { refreshScopes(); render(); } });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'matrix') render();
    }, 500));

    registerCommands();
  }

  function refreshScopes() {
    if (!scopeSel) return;
    const prev = scope;
    scopeSel.innerHTML = '';
    scopeSel.appendChild(el('option', { value: 'all' }, 'Everything'));
    scopeSel.appendChild(el('option', { value: 'standalone' }, 'Standalone tasks only'));
    Array.from(N.store.state.folders.values())
      .sort(function (a, b) { return a.path.localeCompare(b.path); })
      .forEach(function (f) { scopeSel.appendChild(el('option', { value: 'folder:' + f.path }, 'Folder: ' + f.path)); });
    N.store.allNotes()
      .filter(function (n) { return n.taskCounts && n.taskCounts.open; })
      .slice(0, 30)
      .forEach(function (n) { scopeSel.appendChild(el('option', { value: 'note:' + n.id }, 'Note: ' + N.store.noteTitle(n))); });
    N.store.allTags().slice(0, 20).forEach(function (t) {
      scopeSel.appendChild(el('option', { value: 'tag:' + t.tag }, 'Tag: #' + t.tag));
    });
    scopeSel.value = prev;
    if (scopeSel.value !== prev) { scope = 'all'; scopeSel.value = 'all'; }
  }

  /** Where a task belongs when nobody has said otherwise. */
  function inferQuadrant(task) {
    const today = U.todayKey();
    const urgent = !!(task.due && task.due <= today) || task.priority === 1;
    const important = (task.priority !== null && task.priority <= 2) || (task.tags || []).some(function (t) {
      return /^(important|key|goal|priority)$/i.test(t);
    });
    if (urgent && important) return 'do';
    if (!urgent && important) return 'schedule';
    if (urgent && !important) return 'delegate';
    return 'drop';
  }

  function tasksInScope() {
    let list = N.tasks.collect().filter(function (t) { return !t.done && !t.cancelled; });
    if (scope === 'standalone') list = list.filter(function (t) { return t.source === 'standalone'; });
    else if (scope.startsWith('folder:')) {
      const path = scope.slice(7);
      list = list.filter(function (t) { return t.folder === path || (t.folder || '').startsWith(path + '/'); });
    } else if (scope.startsWith('note:')) {
      const id = scope.slice(5);
      list = list.filter(function (t) { return t.noteId === id; });
    } else if (scope.startsWith('tag:')) {
      const tag = scope.slice(4);
      list = list.filter(function (t) { return (t.tags || []).some(function (x) { return x === tag || x.startsWith(tag + '/'); }); });
    }
    return list;
  }

  function render() {
    if (!body) return;
    U.clear(body);

    const list = tasksInScope();
    const buckets = { do: [], schedule: [], delegate: [], drop: [] };
    list.forEach(function (task) {
      const q = task.quadrant || inferQuadrant(task);
      (buckets[q] || buckets.drop).push(task);
    });

    if (!list.length) {
      const empty = el('div.empty-state');
      empty.appendChild(N.icons.node('matrix', { size: 44 }));
      empty.appendChild(el('div.empty-state-title', null, 'No open tasks to sort'));
      empty.appendChild(el('p.empty-state-text', null,
        'The matrix pulls in every unfinished task from your notes and your standalone list. Add one and it will appear here.'));
      const actions = el('div.empty-state-actions');
      actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { N.tasks.newTask(); } }, 'Add a task'));
      empty.appendChild(actions);
      body.appendChild(empty);
      return;
    }

    const grid = el('div.matrix-grid');
    QUADRANTS.forEach(function (quad) {
      const col = el('div.matrix-quad', { dataset: { q: quad.id } });
      const head = el('div.matrix-head');
      head.appendChild(N.icons.node(quad.icon, { size: 16 }));
      const titles = el('div', { style: { flex: '1', minWidth: '0' } });
      titles.appendChild(el('div.matrix-title', null, quad.title));
      titles.appendChild(el('div.matrix-sub', null, quad.sub));
      head.appendChild(titles);
      head.appendChild(el('span.badge.badge-quiet', null, String(buckets[quad.id].length)));
      col.appendChild(head);

      const inner = el('div.matrix-body');
      if (!buckets[quad.id].length) {
        inner.appendChild(el('div.dim.small', {
          style: { padding: '18px 8px', textAlign: 'center', lineHeight: '1.5' },
        }, quad.id === 'drop' ? 'Nothing here — which is the point.' : 'Drag a task here.'));
      }
      buckets[quad.id].forEach(function (task) { inner.appendChild(card(task)); });
      col.appendChild(inner);

      col.addEventListener('dragover', function (e) {
        if (!dragging) return;
        e.preventDefault();
        col.classList.add('is-drop-target');
      });
      col.addEventListener('dragleave', function () { col.classList.remove('is-drop-target'); });
      col.addEventListener('drop', async function (e) {
        e.preventDefault();
        col.classList.remove('is-drop-target');
        if (!dragging) return;
        const task = dragging;
        dragging = null;
        await N.tasks.setQuadrant(task, quad.id);
        render();
      });

      grid.appendChild(col);
    });
    body.appendChild(grid);
  }

  function card(task) {
    const node = el('div.matrix-card', { draggable: 'true', dataset: { task: task.id } });

    const check = el('button.task-check', {
      type: 'button', style: { marginTop: '1px' }, title: 'Mark as done',
      onclick: async function (e) { e.stopPropagation(); await N.tasks.toggle(task); render(); },
    });
    check.appendChild(N.icons.node('check-small', { size: 11 }));
    node.appendChild(check);

    const main = el('div', { style: { flex: '1', minWidth: '0' } });
    main.appendChild(el('div', { style: { lineHeight: '1.45', wordBreak: 'break-word' } }, task.text || '(empty)'));
    const meta = el('div.row', { style: { gap: '8px', marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-3)', flexWrap: 'wrap' } });
    if (task.noteTitle) {
      const src = el('span.task-source', null, [N.icons.node('note', { size: 11 }), el('span', null, U.truncate(task.noteTitle, 22))]);
      src.addEventListener('click', function (e) { e.stopPropagation(); N.app.openNote(task.noteId); });
      meta.appendChild(src);
    }
    if (task.due) {
      const overdue = task.due < U.todayKey();
      meta.appendChild(el('span', { style: overdue ? { color: '#e0245e', fontWeight: '600' } : null }, task.due));
    }
    if (task.priority) meta.appendChild(el('span', null, '!' + task.priority));
    if (!task.quadrant) meta.appendChild(el('span.dim', { title: 'Placed automatically from priority and due date' }, 'auto'));
    main.appendChild(meta);
    node.appendChild(main);

    node.addEventListener('dragstart', function (e) {
      dragging = task;
      node.classList.add('is-dragging');
      try { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    });
    node.addEventListener('dragend', function () { node.classList.remove('is-dragging'); dragging = null; });
    node.addEventListener('dblclick', function () { if (task.noteId) N.app.openNote(task.noteId); });

    return node;
  }

  function explain() {
    N.modal.open({
      title: 'How the priority matrix works',
      render: function () {
        const wrap = el('div');
        wrap.appendChild(el('p', { style: { lineHeight: '1.6' } },
          'Every unfinished task in the vault is placed into one of four boxes, split by whether it is urgent and whether it actually matters.'));
        const list = el('div', { style: { marginTop: '14px' } });
        QUADRANTS.forEach(function (q) {
          const row = el('div.row', { style: { gap: '12px', padding: '10px 0', alignItems: 'flex-start' } });
          row.appendChild(N.icons.node(q.icon, { size: 18 }));
          const main = el('div');
          main.appendChild(el('strong', null, q.title));
          main.appendChild(el('div.small.muted', { style: { lineHeight: '1.5' } }, {
            do: 'Deadline is today or passed, and it matters. This is the only box that should feel loud.',
            schedule: 'Matters, but nothing is on fire. This is where good work actually happens — protect it.',
            delegate: 'Someone is waiting, but it is not really yours. Hand it over or timebox it.',
            drop: 'Not urgent, not important. Be honest and let it go.',
          }[q.id]));
          row.appendChild(main);
          list.appendChild(row);
        });
        wrap.appendChild(list);
        wrap.appendChild(el('p.small.muted', { style: { marginTop: '14px', lineHeight: '1.55' } },
          'Placement is automatic until you drag something — a task marked "!1" or due today counts as urgent, and "!1"/"!2" or a #important tag counts as important. Once you move a card by hand, that choice sticks and is saved with the note.'));
        return wrap;
      },
      footer: function (api) {
        return el('button.btn.btn-primary', { type: 'button', onclick: function () { api.close(); } }, 'Makes sense');
      },
    });
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'matrix.open', title: 'Open priority matrix', group: 'View', icon: 'matrix', accel: 'Mod+Shift+M',
        run: function () { N.app.setView('matrix'); } },
      { id: 'matrix.explain', title: 'Explain the priority matrix', group: 'Help', icon: 'help', run: explain },
    ]);
  }

  N.matrix = { init: init, render: render, inferQuadrant: inferQuadrant };
})(window.NODALIS = window.NODALIS || {});
