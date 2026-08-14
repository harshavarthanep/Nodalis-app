/* =========================================================================
 * Nodalis — features/daily.js
 * Daily notes, the daily review, writing streaks and a year heat-map.
 *
 * The encouragement here is deliberately understated: a streak is only
 * motivating while it stays honest, so nothing is inflated and a broken
 * streak is stated plainly rather than hidden.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let body;

  const GREETINGS = [
    { until: 5, text: 'Still up' },
    { until: 12, text: 'Good morning' },
    { until: 18, text: 'Good afternoon' },
    { until: 22, text: 'Good evening' },
    { until: 24, text: 'Late one' },
  ];

  const NUDGES = {
    fresh: [
      'Nothing on the list. A good day to write something you have been putting off.',
      'Clear slate. What is actually worth your attention today?',
    ],
    few: [
      'A short list. That is usually the sign of a well-run week.',
      'Manageable. Start with the one you have been avoiding.',
    ],
    many: [
      'That is a lot in one place. The matrix might help you pick.',
      'Long list. Pick three that matter and let the rest wait.',
    ],
    overdue: [
      'A few things have slipped past their date. Reschedule them honestly rather than letting them rot.',
      'Some dates have passed. Either do them, move them, or drop them — leaving them is the worst option.',
    ],
    allDone: [
      'Everything is done. Genuinely nothing left.',
      'Clean sweep. Take the win.',
    ],
  };

  function init() {
    body = document.getElementById('review-body');
    const openBtn = document.getElementById('review-open-daily');
    if (openBtn) openBtn.addEventListener('click', function () { openToday(); });

    N.bus.on('view:changed', function (v) { if (v === 'review') render(); });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'review') render();
    }, 800));
    N.bus.on('note:updated', U.debounce(recordActivity, 2000));
    N.bus.on('note:created', recordActivity);
    N.bus.on('task:completed', function () { recordActivity({ tasksDone: 1 }); });

    registerCommands();
  }

  /* ------------------------------------------------------------- journal */

  /** One row per day: was there activity, and how much. */
  async function recordActivity(extra) {
    const day = U.todayKey();
    const existing = N.store.state.journal.get(day) || { day: day, edits: 0, notesCreated: 0, tasksDone: 0, words: 0 };
    existing.edits = (existing.edits || 0) + 1;
    if (extra && extra.tasksDone) existing.tasksDone = (existing.tasksDone || 0) + extra.tasksDone;
    existing.lastAt = Date.now();
    await N.store.saveRecord('journal', existing);
  }

  /** Consecutive days with activity, counting back from today (or yesterday). */
  function streak() {
    const days = Array.from(N.store.state.journal.keys()).sort();
    if (!days.length) return { current: 0, best: 0, activeToday: false };
    const set = new Set(days);
    const today = U.todayKey();
    const activeToday = set.has(today);

    let current = 0;
    // Yesterday still counts — the streak only breaks after a full missed day.
    let cursor = activeToday ? today : U.todayKey(new Date(Date.now() - 86400000));
    if (!set.has(cursor)) current = 0;
    else {
      while (set.has(cursor)) {
        current++;
        const d = U.parseDayKey(cursor);
        d.setDate(d.getDate() - 1);
        cursor = U.todayKey(d);
      }
    }

    let best = 0, run = 0, prev = null;
    days.forEach(function (day) {
      if (prev && U.daysBetween(prev, day) === 1) run++;
      else run = 1;
      best = Math.max(best, run);
      prev = day;
    });

    return { current: current, best: best, activeToday: activeToday };
  }

  /* -------------------------------------------------------- daily notes */

  function dailyFolder() { return N.store.state.settings.dailyNoteFolder || 'Daily'; }

  function dailyTemplate(dayKey) {
    const custom = N.store.state.settings.dailyNoteTemplate;
    const date = U.parseDayKey(dayKey) || new Date();
    const pretty = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (custom && custom.trim()) {
      return custom
        .replace(/\{\{date\}\}/g, dayKey)
        .replace(/\{\{date:pretty\}\}/g, pretty)
        .replace(/\{\{time\}\}/g, U.formatTime(Date.now()))
        .replace(/\{\{title\}\}/g, dayKey);
    }
    const yesterday = U.todayKey(new Date(date.getTime() - 86400000));
    const tomorrow = U.todayKey(new Date(date.getTime() + 86400000));
    return [
      '# ' + pretty,
      '',
      '[[' + yesterday + ']] · [[' + tomorrow + ']]',
      '',
      '## Today',
      '',
      '- [ ] ',
      '',
      '## Notes',
      '',
      '',
      '## Worth remembering',
      '',
      '',
    ].join('\n');
  }

  async function openDay(dayKey) {
    const key = dayKey || U.todayKey();
    const folder = dailyFolder();
    let note = N.store.allNotes().find(function (n) {
      return n.folder === folder && N.store.noteTitle(n) === key;
    });
    if (!note) {
      await N.store.ensureFolderChain(folder);
      note = await N.store.createNote({ title: key, folder: folder, content: dailyTemplate(key) });
      N.toast.success('Created ' + key, { ms: 1800 });
    }
    N.app.openNote(note.id);
    N.sidebar.expandTo(folder);
    return note;
  }

  function openToday() { return openDay(U.todayKey()); }
  function openYesterday() { return openDay(U.todayKey(new Date(Date.now() - 86400000))); }
  function openTomorrow() { return openDay(U.todayKey(new Date(Date.now() + 86400000))); }

  /* ------------------------------------------------------------ rendering */

  function render() {
    if (!body) return;
    U.clear(body);

    const s = streak();
    const tasks = N.tasks.collect();
    const open = tasks.filter(function (t) { return !t.done && !t.cancelled; });
    const today = U.todayKey();
    const dueToday = open.filter(function (t) { return t.due === today; });
    const overdue = open.filter(function (t) { return t.due && t.due < today; });
    const doneToday = tasks.filter(function (t) { return t.done; }).length;

    /* hero */
    const hero = el('div.review-hero');
    hero.appendChild(streakRing(s));
    const main = el('div', { style: { flex: '1', minWidth: '220px' } });
    main.appendChild(el('div.review-greeting', null, greeting() + '.'));
    main.appendChild(el('p.review-line', null, summaryLine(open.length, overdue.length, dueToday.length)));
    const actions = el('div.row', { style: { gap: '10px', marginTop: '16px', flexWrap: 'wrap' } });
    actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { openToday(); } },
      [N.icons.node('calendar', { size: 15 }), el('span', null, "Today's note")]));
    actions.appendChild(el('button.btn', { type: 'button', onclick: function () { N.app.setView('matrix'); } },
      [N.icons.node('matrix', { size: 15 }), el('span', null, 'Sort by priority')]));
    actions.appendChild(el('button.btn', { type: 'button', onclick: function () { N.scratch.openQuickCapture(); } },
      [N.icons.node('zap', { size: 15 }), el('span', null, 'Capture a thought')]));
    main.appendChild(actions);
    hero.appendChild(main);
    body.appendChild(hero);

    /* stats */
    const stats = el('div.stat-grid', { style: { marginTop: '24px' } });
    stats.appendChild(tile(String(N.store.state.notes.size), 'Notes', null));
    stats.appendChild(tile(String(open.length), 'Open tasks', null));
    stats.appendChild(tile(String(overdue.length), 'Overdue', overdue.length ? '#e0245e' : null));
    stats.appendChild(tile(String(doneToday), 'Completed', null));
    stats.appendChild(tile(String(s.current), s.current === 1 ? 'Day streak' : 'Day streak', null));
    stats.appendChild(tile(String(totalWords()), 'Words written', null));
    body.appendChild(stats);

    /* overdue */
    if (overdue.length) {
      body.appendChild(section('Needs attention', overdue.slice(0, 8).map(taskRow), 'warning'));
    }
    /* due today */
    if (dueToday.length) {
      body.appendChild(section('Due today', dueToday.map(taskRow), 'calendar'));
    }
    /* no-date, high priority */
    const priority = open.filter(function (t) { return !t.due && t.priority && t.priority <= 2; });
    if (priority.length) {
      body.appendChild(section('Marked important', priority.slice(0, 6).map(taskRow), 'star'));
    }

    /* recent notes */
    const recent = N.store.allNotes()
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
      .slice(0, 6);
    if (recent.length) {
      body.appendChild(section('Recently touched', recent.map(function (note) {
        const row = el('div.list-row');
        row.appendChild(N.icons.node('note', { size: 15 }));
        const rowMain = el('div.list-row-main');
        rowMain.appendChild(el('div.list-row-title', null, N.store.noteTitle(note)));
        rowMain.appendChild(el('div.list-row-sub', null, (note.folder || 'Vault root') + ' · ' + U.relativeTime(note.updatedAt)));
        row.appendChild(rowMain);
        row.addEventListener('click', function () { N.app.openNote(note.id); });
        return row;
      }), 'history'));
    }

    /* unsorted captures */
    const inbox = Array.from(N.store.state.scratch.values()).filter(function (s2) { return !s2.archived; });
    if (inbox.length) {
      const panel = el('div.panel', { style: { marginTop: '24px' } });
      const head = el('div.panel-head');
      head.appendChild(N.icons.node('inbox', { size: 16 }));
      head.appendChild(el('div.panel-title', null, U.pluralize(inbox.length, 'unsorted thought')));
      head.appendChild(el('button.btn.btn-sm', { type: 'button', onclick: function () { N.app.setView('scratch'); } }, 'Open scratchpad'));
      panel.appendChild(head);
      const pbody = el('div.panel-body');
      inbox.slice(0, 4).forEach(function (entry) {
        pbody.appendChild(el('div.small', { style: { lineHeight: '1.5', paddingBottom: '6px', borderBottom: '1px solid var(--border)' } },
          U.truncate(entry.text, 140)));
      });
      panel.appendChild(pbody);
      body.appendChild(panel);
    }

    /* heat map */
    body.appendChild(heatmap());
  }

  function greeting() {
    const hour = new Date().getHours();
    const match = GREETINGS.find(function (g) { return hour < g.until; });
    return match ? match.text : 'Hello';
  }

  function summaryLine(openCount, overdueCount, todayCount) {
    // Deterministic pick so the message does not change on every re-render.
    const pool = overdueCount ? NUDGES.overdue
      : (openCount === 0 ? NUDGES.allDone
        : (openCount <= 4 ? NUDGES.few : (openCount > 14 ? NUDGES.many : NUDGES.few)));
    const index = new Date().getDate() % pool.length;
    const facts = [];
    if (todayCount) facts.push(U.pluralize(todayCount, 'task') + ' due today');
    if (overdueCount) facts.push(U.pluralize(overdueCount, 'task') + ' overdue');
    if (!facts.length && openCount) facts.push(U.pluralize(openCount, 'open task'));
    return (facts.length ? facts.join(', ') + '. ' : '') + pool[index];
  }

  function streakRing(s) {
    const wrap = el('div.streak-ring', { title: 'Longest run so far: ' + U.pluralize(s.best, 'day') });
    const size = 96, stroke = 7, r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    // The ring fills over a week, then resets — a reachable, repeating target.
    const progress = Math.min(1, (s.current % 7 || (s.current ? 7 : 0)) / 7);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'progress-ring');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', size / 2); track.setAttribute('cy', size / 2); track.setAttribute('r', r);
    track.setAttribute('stroke', 'var(--bg-3)');
    track.setAttribute('stroke-width', stroke);
    svg.appendChild(track);

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fill.setAttribute('cx', size / 2); fill.setAttribute('cy', size / 2); fill.setAttribute('r', r);
    fill.setAttribute('stroke', s.activeToday ? 'var(--accent)' : 'var(--text-3)');
    fill.setAttribute('stroke-width', stroke);
    fill.setAttribute('stroke-dasharray', circumference);
    fill.setAttribute('stroke-dashoffset', circumference);
    svg.appendChild(fill);
    requestAnimationFrame(function () {
      fill.setAttribute('stroke-dashoffset', String(circumference * (1 - progress)));
    });

    wrap.appendChild(svg);
    const count = el('div.streak-count', null, String(s.current));
    wrap.appendChild(count);

    const label = el('div.small.muted', { style: { textAlign: 'center', marginTop: '6px' } },
      s.current === 0 ? 'no streak' : (s.activeToday ? 'day streak' : 'keep it alive'));
    const holder = el('div', { style: { textAlign: 'center' } });
    holder.appendChild(wrap);
    holder.appendChild(label);
    return holder;
  }

  function tile(value, label, color) {
    const t = el('div.stat');
    const v = el('div.stat-value', null, value);
    if (color) v.style.color = color;
    t.appendChild(v);
    t.appendChild(el('div.stat-label', null, label));
    return t;
  }

  function section(title, children, icon) {
    const panel = el('div.panel', { style: { marginTop: '24px' } });
    const head = el('div.panel-head');
    head.appendChild(N.icons.node(icon || 'list', { size: 16 }));
    head.appendChild(el('div.panel-title', null, title));
    panel.appendChild(head);
    const pbody = el('div.panel-body', { style: { padding: '8px' } });
    children.forEach(function (c) { pbody.appendChild(c); });
    panel.appendChild(pbody);
    return panel;
  }

  function taskRow(task) {
    const row = el('div.task-row');
    const check = el('button.task-check', {
      type: 'button', title: 'Mark as done',
      onclick: async function () { await N.tasks.toggle(task); render(); },
    });
    check.appendChild(N.icons.node('check-small', { size: 12 }));
    row.appendChild(check);
    const main = el('div.task-main');
    main.appendChild(el('div.task-text', null, task.text || '(empty task)'));
    const meta = el('div.task-meta');
    if (task.noteTitle) {
      const src = el('span.task-source', null, [N.icons.node('note', { size: 12 }), el('span', null, task.noteTitle)]);
      src.addEventListener('click', function () { N.app.openNote(task.noteId); });
      meta.appendChild(src);
    }
    if (task.due) {
      const overdue = task.due < U.todayKey();
      meta.appendChild(el('span.task-due' + (overdue ? '.is-overdue' : '.is-today'), null, task.due));
    }
    main.appendChild(meta);
    row.appendChild(main);
    return row;
  }

  function totalWords() {
    let total = 0;
    N.store.state.notes.forEach(function (n) { total += n.words || 0; });
    return total;
  }

  function heatmap() {
    const panel = el('div.panel', { style: { marginTop: '24px' } });
    const head = el('div.panel-head');
    head.appendChild(N.icons.node('activity', { size: 16 }));
    head.appendChild(el('div.panel-title', null, 'Last 26 weeks'));
    const s = streak();
    head.appendChild(el('span.small.muted', null, 'best run: ' + U.pluralize(s.best, 'day')));
    panel.appendChild(head);

    const pbody = el('div.panel-body');
    const grid = el('div.review-heat');
    const journal = N.store.state.journal;
    const days = 26 * 7;
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    // Align to the start of a week so columns line up.
    start.setDate(start.getDate() - start.getDay());

    for (let i = 0; i < days + 7; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      if (d > new Date()) break;
      const key = U.todayKey(d);
      const entry = journal.get(key);
      const edits = entry ? entry.edits || 0 : 0;
      const level = edits === 0 ? 0 : (edits < 3 ? 1 : (edits < 8 ? 2 : (edits < 20 ? 3 : 4)));
      const cell = el('div.heat-cell', {
        dataset: { level: String(level) },
        title: key + (edits ? ' — ' + U.pluralize(edits, 'change') : ' — nothing'),
      });
      cell.addEventListener('click', function () { openDay(key); });
      cell.style.cursor = 'pointer';
      grid.appendChild(cell);
    }
    pbody.appendChild(grid);
    pbody.appendChild(el('p.small.muted', { style: { marginTop: '10px' } },
      'Each square is a day. Click one to open that daily note.'));
    panel.appendChild(pbody);
    return panel;
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'daily.today', title: "Open today's daily note", group: 'Daily', icon: 'calendar', accel: 'Mod+D', run: openToday },
      { id: 'daily.yesterday', title: "Open yesterday's note", group: 'Daily', icon: 'chevron-left', run: openYesterday },
      { id: 'daily.tomorrow', title: "Open tomorrow's note", group: 'Daily', icon: 'chevron-right', run: openTomorrow },
      { id: 'daily.pick', title: 'Open a daily note by date…', group: 'Daily', icon: 'calendar',
        run: async function () {
          const value = await N.modal.prompt({
            title: 'Which day?', value: U.todayKey(), placeholder: 'YYYY-MM-DD',
            validate: function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : 'Use the format YYYY-MM-DD.'; },
          });
          if (!value) return;
          openDay(value.trim());
        } },
      { id: 'review.open', title: 'Open daily review', group: 'View', icon: 'flame', accel: 'Mod+Shift+R',
        run: function () { N.app.setView('review'); } },
    ]);
  }

  N.daily = {
    init: init, render: render, openToday: openToday, openDay: openDay,
    streak: streak, recordActivity: recordActivity,
  };
})(window.NODALIS = window.NODALIS || {});
