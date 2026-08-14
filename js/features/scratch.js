/* =========================================================================
 * Nodalis — features/scratch.js
 * Quick capture. One keystroke from anywhere, type the thought, close it.
 * Sorting it out later is optional — that is the whole point.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let body;
  let filter = 'inbox';

  function init() {
    body = document.getElementById('scratch-body');
    if (!body) return;

    U.delegate(document.getElementById('scratch-filter'), 'click', 'button', function (e, btn) {
      filter = btn.dataset.filter;
      U.$$('#scratch-filter button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      render();
    });

    N.bus.on('view:changed', function (v) { if (v === 'scratch') render(); });
    N.bus.on('scratch:changed', U.debounce(function () {
      if (N.store.state.activeView === 'scratch') render();
    }, 200));

    registerCommands();
  }

  function items() {
    let list = Array.from(N.store.state.scratch.values());
    if (filter === 'inbox') list = list.filter(function (s) { return !s.archived; });
    else if (filter === 'archived') list = list.filter(function (s) { return s.archived; });
    return list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  async function capture(text, opts) {
    const clean = String(text || '').trim();
    if (!clean) return null;
    const record = {
      id: U.uid('sc'),
      text: clean,
      tags: N.serialize.extractTags(clean),
      archived: false,
      source: (opts && opts.source) || 'manual',
      createdAt: Date.now(),
    };
    await N.store.saveRecord('scratch', record);
    return record;
  }

  /** The floating capture box — reachable from anywhere, closes on save. */
  function openQuickCapture() {
    let textarea;
    const api = N.modal.open({
      title: 'Quick capture',
      size: 'sm',
      preferSheet: true,
      render: function (a) {
        const wrap = el('div');
        textarea = el('textarea.field', {
          placeholder: 'What just occurred to you?',
          'data-autofocus': '',
          style: { minHeight: '130px', fontSize: 'var(--text-md)', lineHeight: '1.55' },
        });
        textarea.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(a, false); }
          if (e.key === 'Enter' && e.shiftKey && e.altKey) { e.preventDefault(); save(a, true); }
        });
        wrap.appendChild(textarea);
        wrap.appendChild(el('p.field-hint', null,
          'Saved to your scratchpad. Cmd/Ctrl + Enter to save and close. Use #tags if you want to find it again.'));
        return wrap;
      },
      footer: function (a) {
        return [
          el('button.btn', { type: 'button', onclick: function () { a.close(null); } }, 'Cancel'),
          el('span.spacer'),
          el('button.btn', { type: 'button', onclick: function () { save(a, true); } }, 'Save as note'),
          el('button.btn.btn-primary', { type: 'button', onclick: function () { save(a, false); } }, 'Capture'),
        ];
      },
    });

    async function save(a, asNote) {
      const text = textarea.value.trim();
      if (!text) { a.close(null); return; }
      if (asNote) {
        const title = text.split('\n')[0].slice(0, 60) || 'Captured note';
        const note = await N.store.createNote({ title: title, content: text });
        a.close(note.id);
        N.app.openNote(note.id);
        N.toast.success('Saved as a note', { ms: 1800 });
        return;
      }
      await capture(text);
      a.close(true);
      N.toast.success('Captured', {
        ms: 2600,
        action: { label: 'Open scratchpad', onClick: function () { N.app.setView('scratch'); } },
      });
    }

    return api.promise;
  }

  /* ------------------------------------------------------------- rendering */

  function render() {
    if (!body) return;
    U.clear(body);

    /* compose box */
    const compose = el('div.scratch-compose');
    const input = el('textarea.scratch-input', { placeholder: 'Type a thought and press Cmd/Ctrl + Enter…' });
    input.addEventListener('keydown', async function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await capture(text);
        render();
      }
    });
    compose.appendChild(input);
    const saveBtn = el('button.btn.btn-primary', {
      type: 'button', style: { alignSelf: 'flex-end' },
      onclick: async function () {
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        input.value = '';
        await capture(text);
        render();
      },
    }, 'Capture');
    compose.appendChild(saveBtn);
    body.appendChild(compose);

    const list = items();
    if (!list.length) {
      const empty = el('div.empty-state');
      empty.appendChild(N.icons.node('inbox', { size: 42 }));
      empty.appendChild(el('div.empty-state-title', null, filter === 'archived' ? 'Nothing archived' : 'Nothing captured yet'));
      empty.appendChild(el('p.empty-state-text', null,
        'This is the place for thoughts that are not ready to be notes. Press ' +
        N.shortcuts.format(N.shortcuts.accelFor('scratch.capture') || 'Mod+Shift+C') +
        ' from anywhere in the app and it lands here.'));
      body.appendChild(empty);
      return;
    }

    const grouped = groupByDay(list);
    const wrap = el('div.stagger');
    grouped.forEach(function (group) {
      wrap.appendChild(el('div.section-label', null, group.label + ' · ' + group.entries.length));
      group.entries.forEach(function (entry, i) { wrap.appendChild(card(entry, i)); });
    });
    body.appendChild(wrap);
  }

  function groupByDay(list) {
    const map = new Map();
    list.forEach(function (entry) {
      const key = U.todayKey(entry.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    const today = U.todayKey();
    return Array.from(map.entries())
      .sort(function (a, b) { return b[0].localeCompare(a[0]); })
      .map(function (e) {
        const diff = U.daysBetween(e[0], today);
        let label = U.formatDate(U.parseDayKey(e[0]));
        if (diff === 0) label = 'Today';
        else if (diff === 1) label = 'Yesterday';
        else if (diff !== null && diff < 7) label = diff + ' days ago';
        return { label: label, entries: e[1] };
      });
  }

  function card(entry, i) {
    const node = el('div.scratch-item' + (entry.archived ? '.is-archived' : ''), { style: { '--i': i } });
    node.appendChild(el('div.scratch-item-text', { html: N.markdown.renderInline(entry.text) }));

    const foot = el('div.scratch-item-foot');
    foot.appendChild(el('span', null, U.formatTime(entry.createdAt)));
    (entry.tags || []).forEach(function (t) {
      const chip = el('span.chip', { style: { height: '18px', fontSize: '11px', cursor: 'pointer' } }, '#' + t);
      chip.addEventListener('click', function () { N.search.openTag(t); });
      foot.appendChild(chip);
    });
    foot.appendChild(el('span.spacer'));

    const action = function (icon, title, fn) {
      const btn = el('button.icon-btn.icon-btn-sm', { type: 'button', title: title, onclick: fn });
      btn.appendChild(N.icons.node(icon, { size: 14 }));
      return btn;
    };

    foot.appendChild(action('file-plus', 'Turn into a note', async function () {
      const title = entry.text.split('\n')[0].slice(0, 60) || 'Captured thought';
      const note = await N.store.createNote({ title: title, content: entry.text });
      entry.archived = true;
      entry.promotedTo = note.id;
      await N.store.saveRecord('scratch', entry);
      N.app.openNote(note.id);
      N.toast.success('Turned into a note', { ms: 2000 });
    }));
    foot.appendChild(action('list-check', 'Turn into a task', async function () {
      await N.store.saveRecord('tasks', {
        id: U.uid('tk'), text: U.truncate(entry.text, 140), done: false,
        due: null, priority: null, tags: entry.tags || [], createdAt: Date.now(),
      });
      entry.archived = true;
      await N.store.saveRecord('scratch', entry);
      render();
      N.toast.success('Added to your tasks', { ms: 2000 });
    }));
    foot.appendChild(action('sticky', 'Turn into a sticky', async function () {
      await N.sticky.create({ text: entry.text });
      entry.archived = true;
      await N.store.saveRecord('scratch', entry);
      render();
      N.toast.success('Pinned to the sticky wall', { ms: 2000 });
    }));
    foot.appendChild(action('edit', 'Edit', async function () {
      const next = await N.modal.prompt({ title: 'Edit thought', value: entry.text, multiline: true });
      if (next === null) return;
      entry.text = next;
      entry.tags = N.serialize.extractTags(next);
      await N.store.saveRecord('scratch', entry);
      render();
    }));
    foot.appendChild(action(entry.archived ? 'inbox' : 'archive', entry.archived ? 'Back to inbox' : 'Archive', async function () {
      entry.archived = !entry.archived;
      await N.store.saveRecord('scratch', entry);
      render();
    }));
    foot.appendChild(action('trash', 'Delete', async function () {
      await N.store.deleteRecord('scratch', entry.id);
      render();
      N.toast.show('Deleted', { kind: 'info', ms: 5000, action: { label: 'Undo', onClick: function () { N.store.undo().then(render); } } });
    }));

    node.appendChild(foot);
    return node;
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'scratch.capture', title: 'Quick capture a thought', group: 'Create', icon: 'zap', accel: 'Mod+Shift+C',
        allowInInput: true, run: openQuickCapture },
      { id: 'scratch.open', title: 'Open scratchpad', group: 'View', icon: 'inbox',
        run: function () { N.app.setView('scratch'); } },
      { id: 'scratch.clearArchived', title: 'Clear archived thoughts', group: 'Scratchpad', icon: 'trash', danger: true,
        run: async function () {
          const archived = Array.from(N.store.state.scratch.values()).filter(function (s) { return s.archived; });
          if (!archived.length) { N.toast.info('Nothing archived to clear.'); return; }
          const ok = await N.modal.confirm({
            title: 'Clear ' + U.pluralize(archived.length, 'archived thought') + '?',
            message: 'This cannot be undone.', danger: true, confirmLabel: 'Clear',
          });
          if (!ok) return;
          for (const entry of archived) await N.store.deleteRecord('scratch', entry.id);
          render();
          N.toast.success('Cleared', { ms: 1800 });
        } },
    ]);
  }

  N.scratch = { init: init, render: render, capture: capture, openQuickCapture: openQuickCapture };
})(window.NODALIS = window.NODALIS || {});
