/* =========================================================================
 * Nodalis — features/tasks.js
 * Two kinds of task, one list:
 *   - tasks written inside notes, parsed live from the markdown
 *   - standalone tasks stored in their own collection
 * Toggling either writes back to the right place, so nothing drifts.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let body, scopeSel;
  let filter = 'open';
  let scope = 'all';

  function init() {
    body = document.getElementById('tasks-body');
    scopeSel = document.getElementById('task-scope');
    if (!body) return;

    U.delegate(document.getElementById('task-filter'), 'click', 'button', function (e, btn) {
      filter = btn.dataset.filter;
      U.$$('#task-filter button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      render();
    });
    scopeSel.addEventListener('change', function () { scope = scopeSel.value; render(); });
    document.getElementById('task-new').addEventListener('click', newTask);

    N.bus.on('view:changed', function (v) { if (v === 'tasks') { refreshScopes(); render(); } });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'tasks') render();
    }, 400));

    registerCommands();
  }

  /* ------------------------------------------------------------ gathering */

  /** All tasks across notes and the standalone list, normalised to one shape. */
  function collect() {
    const out = [];

    N.store.allNotes().forEach(function (note) {
      if (!note.taskCounts || !note.taskCounts.total) return;
      N.serialize.extractTasks(note.content).forEach(function (t) {
        out.push({
          id: note.id + ':' + t.line,
          source: 'note',
          noteId: note.id,
          line: t.line,
          text: t.text,
          done: t.done,
          cancelled: t.cancelled,
          inProgress: t.inProgress,
          due: t.due,
          priority: t.priority ? Number(t.priority) : null,
          quadrant: quadrantFromNote(note, t),
          noteTitle: N.store.noteTitle(note),
          folder: note.folder,
          tags: note.tags || [],
          updatedAt: note.updatedAt,
        });
      });
    });

    N.store.state.tasks.forEach(function (t) {
      out.push({
        id: t.id,
        source: 'standalone',
        text: t.text,
        done: !!t.done,
        cancelled: !!t.cancelled,
        inProgress: !!t.inProgress,
        due: t.due || null,
        priority: t.priority || null,
        quadrant: t.quadrant || null,
        listId: t.listId || null,
        noteId: t.noteId || null,
        noteTitle: t.noteId && N.store.getNote(t.noteId) ? N.store.noteTitle(N.store.getNote(t.noteId)) : null,
        folder: t.folder || '',
        tags: t.tags || [],
        updatedAt: t.updatedAt || t.createdAt,
        createdAt: t.createdAt,
      });
    });

    return out;
  }

  function quadrantFromNote(note, t) {
    // A stored override wins; otherwise infer from priority and due date.
    const overrides = note.properties && note.properties.matrix ? note.properties.matrix : null;
    if (overrides && overrides[String(t.line)]) return overrides[String(t.line)];
    return null;
  }

  function applyScope(list) {
    if (scope === 'all') return list;
    if (scope.startsWith('folder:')) {
      const path = scope.slice(7);
      return list.filter(function (t) { return t.folder === path || (t.folder || '').startsWith(path + '/'); });
    }
    if (scope.startsWith('note:')) {
      const id = scope.slice(5);
      return list.filter(function (t) { return t.noteId === id; });
    }
    if (scope.startsWith('tag:')) {
      const tag = scope.slice(4);
      return list.filter(function (t) { return (t.tags || []).some(function (x) { return x === tag || x.startsWith(tag + '/'); }); });
    }
    if (scope === 'standalone') return list.filter(function (t) { return t.source === 'standalone'; });
    return list;
  }

  function applyFilter(list) {
    const today = U.todayKey();
    if (filter === 'open') return list.filter(function (t) { return !t.done && !t.cancelled; });
    if (filter === 'done') return list.filter(function (t) { return t.done; });
    if (filter === 'today') return list.filter(function (t) { return !t.done && !t.cancelled && t.due && t.due <= today; });
    if (filter === 'upcoming') return list.filter(function (t) { return !t.done && !t.cancelled && t.due && t.due > today; });
    return list;
  }

  function sortTasks(list) {
    const today = U.todayKey();
    return list.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ao = a.due && a.due < today, bo = b.due && b.due < today;
      if (ao !== bo) return ao ? -1 : 1;
      const ap = a.priority || 5, bp = b.priority || 5;
      if (ap !== bp) return ap - bp;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  function refreshScopes() {
    if (!scopeSel) return;
    const prev = scope;
    scopeSel.innerHTML = '';
    scopeSel.appendChild(el('option', { value: 'all' }, 'Everything'));
    scopeSel.appendChild(el('option', { value: 'standalone' }, 'Standalone list only'));
    Array.from(N.store.state.folders.values())
      .sort(function (a, b) { return a.path.localeCompare(b.path); })
      .forEach(function (f) { scopeSel.appendChild(el('option', { value: 'folder:' + f.path }, 'Folder: ' + f.path)); });
    N.store.allNotes()
      .filter(function (n) { return n.taskCounts && n.taskCounts.total; })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
      .slice(0, 30)
      .forEach(function (n) { scopeSel.appendChild(el('option', { value: 'note:' + n.id }, 'Note: ' + N.store.noteTitle(n))); });
    N.store.allTags().slice(0, 25).forEach(function (t) {
      scopeSel.appendChild(el('option', { value: 'tag:' + t.tag }, 'Tag: #' + t.tag));
    });
    scopeSel.value = prev;
    if (scopeSel.value !== prev) { scope = 'all'; scopeSel.value = 'all'; }
  }

  /* ------------------------------------------------------------ rendering */

  function render() {
    if (!body) return;
    U.clear(body);
    const all = collect();
    const list = sortTasks(applyFilter(applyScope(all)));

    /* summary bar */
    const openCount = all.filter(function (t) { return !t.done && !t.cancelled; }).length;
    const doneCount = all.filter(function (t) { return t.done; }).length;
    const overdue = all.filter(function (t) { return !t.done && t.due && t.due < U.todayKey(); }).length;

    const summary = el('div.view-pad', { style: { paddingBottom: '0' } });
    const stats = el('div.stat-grid');
    stats.appendChild(statTile(String(openCount), 'Open'));
    stats.appendChild(statTile(String(all.filter(function (t) { return !t.done && t.due === U.todayKey(); }).length), 'Due today'));
    stats.appendChild(statTile(String(overdue), 'Overdue', overdue ? '#e0245e' : null));
    stats.appendChild(statTile(String(doneCount), 'Completed'));
    summary.appendChild(stats);
    body.appendChild(summary);

    if (!list.length) {
      const empty = el('div.empty-state');
      empty.appendChild(N.icons.node(filter === 'done' ? 'success' : 'list-check', { size: 44 }));
      empty.appendChild(el('div.empty-state-title', null, emptyTitle()));
      empty.appendChild(el('p.empty-state-text', null, emptyText()));
      const actions = el('div.empty-state-actions');
      actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: newTask }, 'Add a task'));
      if (filter !== 'all') {
        actions.appendChild(el('button.btn', {
          type: 'button',
          onclick: function () {
            filter = 'all';
            U.$$('#task-filter button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.filter === 'all'); });
            render();
          },
        }, 'Show everything'));
      }
      empty.appendChild(actions);
      body.appendChild(empty);
      return;
    }

    const wrap = el('div.view-pad');
    const grouped = groupByDue(list);
    grouped.forEach(function (group) {
      if (group.tasks.length === 0) return;
      wrap.appendChild(el('div.section-label', null, group.label + ' · ' + group.tasks.length));
      const holder = el('div.stagger');
      group.tasks.forEach(function (task, i) { holder.appendChild(taskRow(task, i)); });
      wrap.appendChild(holder);
    });
    body.appendChild(wrap);
  }

  function emptyTitle() {
    if (filter === 'done') return 'Nothing completed yet';
    if (filter === 'today') return 'Nothing due today';
    if (filter === 'upcoming') return 'Nothing scheduled';
    return 'No open tasks';
  }

  function emptyText() {
    if (filter === 'open') return 'Write "- [ ] something" in any note and it turns up here, or add a standalone task below.';
    if (filter === 'today') return 'Add "due:' + U.todayKey() + '" to a task to schedule it for today.';
    return 'Tasks from every note in your vault gather here.';
  }

  function statTile(value, label, color) {
    const tile = el('div.stat');
    const v = el('div.stat-value', null, value);
    if (color) v.style.color = color;
    tile.appendChild(v);
    tile.appendChild(el('div.stat-label', null, label));
    return tile;
  }

  function groupByDue(list) {
    const today = U.todayKey();
    const groups = [
      { label: 'Overdue', tasks: [] },
      { label: 'Today', tasks: [] },
      { label: 'Next 7 days', tasks: [] },
      { label: 'Later', tasks: [] },
      { label: 'No date', tasks: [] },
      { label: 'Completed', tasks: [] },
    ];
    list.forEach(function (t) {
      if (t.done) { groups[5].tasks.push(t); return; }
      if (!t.due) { groups[4].tasks.push(t); return; }
      if (t.due < today) { groups[0].tasks.push(t); return; }
      if (t.due === today) { groups[1].tasks.push(t); return; }
      const diff = U.daysBetween(today, t.due);
      if (diff !== null && diff <= 7) { groups[2].tasks.push(t); return; }
      groups[3].tasks.push(t);
    });
    return groups;
  }

  function taskRow(task, i) {
    const row = el('div.task-row' + (task.done ? '.is-done' : ''), { style: { '--i': i }, dataset: { task: task.id } });

    if (task.priority) row.appendChild(el('div.task-prio', { dataset: { p: String(task.priority) }, title: 'Priority ' + task.priority }));

    const check = el('button.task-check' +
      (task.done ? '.is-done' : '') +
      (task.inProgress ? '.is-progress' : '') +
      (task.cancelled ? '.is-cancelled' : ''), {
      type: 'button', 'aria-label': task.done ? 'Mark as not done' : 'Mark as done',
      onclick: function () { toggle(task); },
    });
    check.appendChild(N.icons.node('check-small', { size: 12 }));
    row.appendChild(check);

    const main = el('div.task-main');
    main.appendChild(el('div.task-text', { html: N.markdown.renderInline(task.text || '(empty task)') }));

    const meta = el('div.task-meta');
    if (task.source === 'note' && task.noteTitle) {
      const src = el('span.task-source', { title: 'Open the note this task lives in' });
      src.appendChild(N.icons.node('note', { size: 12 }));
      src.appendChild(el('span', null, task.noteTitle));
      src.addEventListener('click', function () { N.app.openNote(task.noteId); });
      meta.appendChild(src);
    } else {
      meta.appendChild(el('span.dim', null, 'Standalone'));
    }
    if (task.due) {
      const today = U.todayKey();
      const cls = task.due < today ? '.is-overdue' : (task.due === today ? '.is-today' : '');
      meta.appendChild(el('span.task-due' + cls, null, dueLabel(task.due)));
    }
    (task.tags || []).slice(0, 3).forEach(function (t) { meta.appendChild(el('span', null, '#' + t)); });
    main.appendChild(meta);
    row.appendChild(main);

    const menuBtn = el('button.icon-btn.icon-btn-sm', { type: 'button', title: 'Task actions' });
    menuBtn.appendChild(N.icons.node('more', { size: 14 }));
    menuBtn.addEventListener('click', function (e) { openTaskMenu(task, e.currentTarget); });
    row.appendChild(menuBtn);

    return row;
  }

  function dueLabel(due) {
    const today = U.todayKey();
    if (due === today) return 'Today';
    const diff = U.daysBetween(today, due);
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff !== null && diff < 0) return Math.abs(diff) + ' days overdue';
    if (diff !== null && diff <= 7) return 'In ' + diff + ' days';
    return U.formatDate(U.parseDayKey(due));
  }

  /* ------------------------------------------------------------ mutation */

  async function toggle(task) {
    if (task.source === 'standalone') {
      const record = N.store.state.tasks.get(task.id);
      if (!record) return;
      record.done = !record.done;
      record.completedAt = record.done ? Date.now() : null;
      await N.store.saveRecord('tasks', record);
      if (record.done) celebrateIfDue(task);
      render();
      return;
    }

    const note = N.store.getNote(task.noteId);
    if (!note) { N.toast.error('That note no longer exists.'); render(); return; }
    const lines = note.content.split('\n');
    const m = /^(\s*[-*+]\s+\[)([ xX/-])(\]\s*)([\s\S]*)$/.exec(lines[task.line] || '');
    if (!m) { N.toast.warn('That task has moved — refreshing the list.'); render(); return; }
    const next = m[2].toLowerCase() === 'x' ? ' ' : 'x';
    lines[task.line] = m[1] + next + m[3] + m[4];
    await N.store.updateNoteContent(note.id, lines.join('\n'));
    if (next === 'x') celebrateIfDue(task);
    render();
  }

  function celebrateIfDue(task) {
    N.bus.emit('task:completed', task);
    const remaining = collect().filter(function (t) { return !t.done && !t.cancelled; }).length;
    if (remaining === 0) {
      N.loader.celebrate({ count: 44 });
      N.toast.success('Everything is done. Genuinely nothing left on the list.', { ms: 4200 });
    }
  }

  async function newTask() {
    const text = await N.modal.prompt({
      title: 'New task',
      placeholder: 'What needs doing?',
      message: 'Tip: add "due:2026-08-20" for a date, or "!1" for top priority.',
    });
    if (!text) return;
    const due = (/due:\s*(\d{4}-\d{2}-\d{2})/i.exec(text) || [])[1] || null;
    const priority = (/(?:^|\s)!([1-4])(?:\s|$)/.exec(text) || [])[1];
    const clean = text.replace(/\s*due:\s*\d{4}-\d{2}-\d{2}/i, '').replace(/\s*![1-4]\b/, '').trim();

    await N.store.saveRecord('tasks', {
      id: U.uid('tk'),
      text: clean,
      done: false,
      due: due,
      priority: priority ? Number(priority) : null,
      quadrant: null,
      tags: N.serialize.extractTags(text),
      createdAt: Date.now(),
    });
    render();
    N.toast.success('Task added', { ms: 1500 });
  }

  function openTaskMenu(task, anchor) {
    const items = [
      { label: task.done ? 'Mark as not done' : 'Mark as done', icon: 'check', onClick: function () { toggle(task); } },
      { label: 'Set due date…', icon: 'calendar', onClick: function () { setDue(task); } },
      { label: 'Set priority…', icon: 'target', onClick: function () { setPriority(task); } },
      { label: 'Move in the matrix…', icon: 'matrix', onClick: function () { setQuadrant(task); } },
    ];
    if (task.source === 'note') {
      items.push({ separator: true },
        { label: 'Open the note', icon: 'external', onClick: function () { N.app.openNote(task.noteId); } });
    } else {
      items.push({ separator: true },
        { label: 'Edit text…', icon: 'edit', onClick: function () { editStandalone(task); } },
        { label: 'Turn into a note', icon: 'file-plus', onClick: function () { promoteToNote(task); } },
        { label: 'Delete task', icon: 'trash', danger: true, onClick: function () { N.store.deleteRecord('tasks', task.id).then(render); } });
    }
    N.menu.show(items, { anchor: anchor, align: 'right', title: U.truncate(task.text, 40) });
  }

  async function setDue(task) {
    const value = await N.modal.prompt({
      title: 'Due date', value: task.due || U.todayKey(), placeholder: 'YYYY-MM-DD',
      message: 'Leave blank to clear the date.', required: false,
      validate: function (v) { return !v.trim() || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : 'Use the format YYYY-MM-DD.'; },
    });
    if (value === null) return;
    await patchTask(task, { due: value.trim() || null });
  }

  async function setPriority(task) {
    const value = await N.modal.choose({
      title: 'Priority',
      options: [
        { value: 1, label: 'Urgent', description: 'Drop everything', icon: 'flame' },
        { value: 2, label: 'High', icon: 'arrow-up' },
        { value: 3, label: 'Normal', icon: 'minus' },
        { value: 4, label: 'Low', icon: 'arrow-down' },
        { value: 0, label: 'None', icon: 'close' },
      ],
    });
    if (value === null) return;
    await patchTask(task, { priority: value || null });
  }

  async function setQuadrant(task) {
    const value = await N.modal.choose({
      title: 'Which quadrant?',
      options: [
        { value: 'do', label: 'Do now', description: 'Urgent and important', icon: 'flame' },
        { value: 'schedule', label: 'Schedule', description: 'Important, not urgent', icon: 'calendar' },
        { value: 'delegate', label: 'Delegate', description: 'Urgent, not important', icon: 'share' },
        { value: 'drop', label: 'Drop', description: 'Neither', icon: 'trash' },
        { value: '', label: 'Unsorted', icon: 'close' },
      ],
    });
    if (value === null) return;
    await setTaskQuadrant(task, value || null);
    render();
  }

  /** Writes a quadrant for either task kind; note tasks store it in frontmatter. */
  async function setTaskQuadrant(task, quadrant) {
    if (task.source === 'standalone') {
      const record = N.store.state.tasks.get(task.id);
      if (!record) return;
      record.quadrant = quadrant;
      await N.store.saveRecord('tasks', record);
      return;
    }
    const note = N.store.getNote(task.noteId);
    if (!note) return;
    const matrix = Object.assign({}, (note.properties && note.properties.matrix) || {});
    if (quadrant) matrix[String(task.line)] = quadrant;
    else delete matrix[String(task.line)];
    const props = Object.assign({}, note.properties);
    if (Object.keys(matrix).length) props.matrix = matrix;
    else delete props.matrix;
    await N.store.updateNoteProperties(note.id, props);
  }

  async function patchTask(task, patch) {
    if (task.source === 'standalone') {
      const record = N.store.state.tasks.get(task.id);
      if (!record) return;
      Object.assign(record, patch);
      await N.store.saveRecord('tasks', record);
      render();
      return;
    }
    const note = N.store.getNote(task.noteId);
    if (!note) return;
    const lines = note.content.split('\n');
    let line = lines[task.line];
    if (!line) return;
    if ('due' in patch) {
      line = line.replace(/\s*due:\s*\d{4}-\d{2}-\d{2}/i, '');
      if (patch.due) line += ' due:' + patch.due;
    }
    if ('priority' in patch) {
      line = line.replace(/\s*![1-4]\b/, '');
      if (patch.priority) line += ' !' + patch.priority;
    }
    lines[task.line] = line;
    await N.store.updateNoteContent(note.id, lines.join('\n'));
    render();
  }

  async function editStandalone(task) {
    const record = N.store.state.tasks.get(task.id);
    if (!record) return;
    const next = await N.modal.prompt({ title: 'Edit task', value: record.text });
    if (next === null) return;
    record.text = next;
    await N.store.saveRecord('tasks', record);
    render();
  }

  async function promoteToNote(task) {
    const note = await N.store.createNote({
      title: U.truncate(task.text, 60),
      content: '# ' + task.text + '\n\n- [' + (task.done ? 'x' : ' ') + '] ' + task.text + (task.due ? ' due:' + task.due : '') + '\n',
    });
    await N.store.deleteRecord('tasks', task.id);
    N.app.openNote(note.id);
    N.toast.success('Turned into a note', { ms: 2000 });
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'tasks.open', title: 'Open tasks', group: 'View', icon: 'list-check', accel: 'Mod+Shift+T',
        run: function () { N.app.setView('tasks'); } },
      { id: 'tasks.new', title: 'New task', group: 'Create', icon: 'plus', accel: 'Mod+Shift+N', run: newTask },
      { id: 'tasks.today', title: 'Tasks due today', group: 'Tasks', icon: 'calendar',
        run: function () {
          filter = 'today';
          N.app.setView('tasks');
          U.$$('#task-filter button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.filter === 'today'); });
          render();
        } },
      { id: 'tasks.overdue', title: 'Show overdue tasks', group: 'Tasks', icon: 'warning',
        run: function () {
          filter = 'open'; scope = 'all';
          N.app.setView('tasks');
          render();
          const overdue = collect().filter(function (t) { return !t.done && t.due && t.due < U.todayKey(); });
          if (!overdue.length) N.toast.success('Nothing is overdue.', { ms: 2200 });
        } },
    ]);
  }

  N.tasks = {
    init: init, render: render, collect: collect, toggle: toggle,
    setQuadrant: setTaskQuadrant, newTask: newTask,
  };
})(window.NODALIS = window.NODALIS || {});
