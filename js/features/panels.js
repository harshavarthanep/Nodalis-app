/* =========================================================================
 * Nodalis — features/panels.js
 * The right-hand context panel: linked & unlinked backlinks, document
 * outline, and editable frontmatter properties.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let activeTab = 'backlinks';

  function init() {
    const tabs = document.querySelector('.right-tabs');
    if (tabs) U.delegate(tabs, 'click', '.right-tab', function (e, btn) { setTab(btn.dataset.rtab); });

    N.bus.on('editor:loaded', renderAll);
    N.bus.on('note:updated', U.debounce(function (note) {
      if (note && note.id === N.store.state.activeNoteId) renderAll();
    }, 400));
    N.bus.on('vault:changed', U.debounce(renderAll, 500));
    N.bus.on('preview:rendered', U.debounce(function () { if (activeTab === 'outline') renderOutline(); }, 200));

    renderAll();
  }

  function setTab(tab) {
    activeTab = tab;
    U.$$('.right-tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.rtab === tab); });
    ['backlinks', 'outline', 'props'].forEach(function (key) {
      const pane = document.getElementById('rpane-' + key);
      if (pane) pane.classList.toggle('is-active', key === tab);
    });
    renderAll();
  }

  function currentNote() {
    const id = N.store.state.activeNoteId;
    return id ? N.store.getNote(id) : null;
  }

  function renderAll() {
    if (activeTab === 'backlinks') renderBacklinks();
    else if (activeTab === 'outline') renderOutline();
    else renderProps();
  }

  function emptyMsg(icon, title, text) {
    const wrap = el('div.empty-state', { style: { minHeight: '140px', padding: '28px 8px' } });
    wrap.appendChild(N.icons.node(icon, { size: 26 }));
    wrap.appendChild(el('div.empty-state-title', { style: { fontSize: 'var(--text-base)' } }, title));
    if (text) wrap.appendChild(el('p.empty-state-text.small', null, text));
    return wrap;
  }

  /* ---------------------------------------------------------- backlinks */

  function renderBacklinks() {
    const host = document.getElementById('rpane-backlinks');
    if (!host) return;
    U.clear(host);
    const note = currentNote();
    if (!note) { host.appendChild(emptyMsg('link', 'No note open', 'Open a note to see what links to it.')); return; }

    const links = N.store.backlinksFor(note.id);

    /* outgoing */
    const outgoing = (note.links || []).map(function (target) {
      return { target: target, note: N.store.findNoteByTitle(target) };
    });
    if (outgoing.length) {
      host.appendChild(el('div.section-label', null, 'Links from this note (' + outgoing.length + ')'));
      outgoing.forEach(function (item) {
        const row = el('button.backlink-note', { type: 'button' });
        row.appendChild(el('span.row', { style: { gap: '8px' } }, [
          N.icons.node(item.note ? 'arrow-right' : 'plus', { size: 14 }),
          el('span.truncate', null, item.target),
        ]));
        if (!item.note) row.appendChild(el('span.small.dim', null, 'not created yet'));
        row.addEventListener('click', function () { N.editor.openWikilink(item.target); });
        host.appendChild(row);
      });
    }

    /* linked mentions */
    host.appendChild(el('div.section-label', null, 'Linked mentions (' + links.linked.length + ')'));
    if (!links.linked.length) {
      host.appendChild(el('p.small.dim', { style: { padding: '4px 16px 12px' } },
        'Nothing links here yet. Type [[' + N.store.noteTitle(note) + ']] in another note.'));
    } else {
      links.linked.forEach(function (entry) { host.appendChild(backlinkGroup(entry)); });
    }

    /* unlinked mentions */
    if (links.unlinked.length) {
      host.appendChild(el('div.section-label', null, 'Unlinked mentions (' + links.unlinked.length + ')'));
      links.unlinked.slice(0, 30).forEach(function (entry) {
        const group = backlinkGroup(entry);
        const linkBtn = el('button.btn.btn-sm', {
          type: 'button', style: { margin: '4px 0 10px 20px' },
          onclick: function () { linkMention(entry.note, note); },
        }, 'Link this mention');
        group.appendChild(linkBtn);
        host.appendChild(group);
      });
      if (links.unlinked.length > 30) {
        host.appendChild(el('p.small.dim', { style: { padding: '8px 16px' } },
          'and ' + (links.unlinked.length - 30) + ' more…'));
      }
    }
  }

  function backlinkGroup(entry) {
    const group = el('div.backlink-group');
    const head = el('button.backlink-note', { type: 'button', onclick: function () { N.app.openNote(entry.note.id); } });
    head.appendChild(el('span.truncate', null, N.store.noteTitle(entry.note)));
    group.appendChild(head);
    entry.contexts.forEach(function (ctx) {
      const line = el('div.backlink-context', { title: 'Jump to this line' }, U.truncate(ctx.text, 200));
      line.addEventListener('click', function () {
        N.app.openNote(entry.note.id);
        setTimeout(function () { N.search.run && jumpTo(ctx.line); }, 200);
      });
      group.appendChild(line);
    });
    return group;
  }

  function jumpTo(lineNo) {
    const ta = N.editor.getTextarea();
    if (!ta) return;
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(lineNo, lines.length); i++) pos += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos + (lines[lineNo] || '').length);
  }

  async function linkMention(sourceNote, targetNote) {
    const title = N.store.noteTitle(targetNote);
    const re = new RegExp('(^|[^\\w\\[])(' + U.escapeRegExp(title) + ')($|[^\\w\\]])', 'i');
    if (!re.test(sourceNote.content)) { N.toast.info('That mention has moved — reopen the panel.'); return; }
    const updated = sourceNote.content.replace(re, function (_, a, mid, b) { return a + '[[' + mid + ']]' + b; });
    await N.store.updateNoteContent(sourceNote.id, updated);
    N.toast.success('Mention linked', { ms: 1600 });
    renderBacklinks();
  }

  /* ------------------------------------------------------------- outline */

  function renderOutline() {
    const host = document.getElementById('rpane-outline');
    if (!host) return;
    U.clear(host);
    const note = currentNote();
    if (!note) { host.appendChild(emptyMsg('list-tree', 'No note open')); return; }

    const ta = N.editor.getTextarea();
    const source = ta && N.editor.currentNoteId() === note.id ? ta.value : note.content;
    const heads = N.serialize.headings(source);

    if (!heads.length) {
      host.appendChild(emptyMsg('heading', 'No headings',
        'Add a line starting with # and it will appear here as a jump link.'));
      return;
    }

    host.appendChild(el('div.section-label', null, U.pluralize(heads.length, 'heading')));
    heads.forEach(function (h) {
      const item = el('button.outline-item', {
        type: 'button', dataset: { level: String(h.level) }, title: h.text,
        onclick: function () {
          if (N.editor.getMode() === 'edit') jumpTo(h.line);
          else N.editor.scrollToAnchor(h.text, null);
        },
      }, h.text);
      host.appendChild(item);
    });

    const stats = N.serialize.wordStats(source);
    const foot = el('div', { style: { marginTop: '18px', padding: '12px 16px', borderTop: '1px solid var(--border)' } });
    foot.appendChild(el('div.small.muted', null, U.pluralize(stats.words, 'word') + ' · ' + stats.readingMinutes + ' min read'));
    host.appendChild(foot);
  }

  /* ---------------------------------------------------------- properties */

  function renderProps() {
    const host = document.getElementById('rpane-props');
    if (!host) return;
    U.clear(host);
    const note = currentNote();
    if (!note) { host.appendChild(emptyMsg('sliders', 'No note open')); return; }

    host.appendChild(el('div.section-label', null, 'Properties'));
    const props = note.properties || {};
    const keys = Object.keys(props).filter(function (k) { return k !== '__raw'; });

    if (!keys.length) {
      host.appendChild(el('p.small.dim', { style: { padding: '0 16px 12px', lineHeight: '1.55' } },
        'Properties are the YAML block at the top of a note. Add some and they become sortable columns in the database view.'));
    }

    keys.forEach(function (key) {
      const row = el('div.prop-row');
      row.appendChild(el('div.prop-key.truncate', { title: key }, key));
      const value = el('input.field', {
        type: 'text', value: formatValue(props[key]), style: { height: '26px', fontSize: 'var(--text-sm)' },
      });
      value.addEventListener('change', async function () {
        const next = Object.assign({}, note.properties);
        next[key] = parseValue(value.value);
        await N.store.updateNoteProperties(note.id, next);
      });
      row.appendChild(value);
      const del = el('button.icon-btn.icon-btn-sm', {
        type: 'button', title: 'Remove property',
        onclick: async function () {
          const next = Object.assign({}, note.properties);
          delete next[key];
          await N.store.updateNoteProperties(note.id, next);
          renderProps();
        },
      });
      del.appendChild(N.icons.node('close', { size: 13 }));
      row.appendChild(del);
      host.appendChild(row);
    });

    const addBtn = el('button.btn.btn-sm.btn-block', { type: 'button', style: { marginTop: '10px' } },
      [N.icons.node('plus', { size: 14 }), el('span', null, 'Add property')]);
    addBtn.addEventListener('click', addProperty);
    host.appendChild(addBtn);

    /* tags */
    host.appendChild(el('div.section-label', null, 'Tags'));
    const tagRow = el('div.swatch-row', { style: { padding: '0 12px' } });
    if (!(note.tags || []).length) tagRow.appendChild(el('span.small.dim', null, 'No tags'));
    (note.tags || []).forEach(function (tag) {
      const chip = el('button.chip', { type: 'button', onclick: function () { N.search.openTag(tag); } }, '#' + tag);
      tagRow.appendChild(chip);
    });
    host.appendChild(tagRow);

    /* info */
    host.appendChild(el('div.section-label', null, 'File'));
    const info = el('div', { style: { padding: '0 12px' } });
    [
      ['Path', note.path],
      ['Created', U.formatDate(note.createdAt) + ' ' + U.formatTime(note.createdAt)],
      ['Modified', U.relativeTime(note.updatedAt)],
      ['Words', String(note.words || 0)],
      ['Characters', String(note.chars || 0)],
      ['Links out', String((note.links || []).length)],
      ['Tasks', note.taskCounts ? (note.taskCounts.done + ' / ' + note.taskCounts.total) : '0'],
      ['Stored', N.vault.isFolderMode() ? 'On disk in ' + N.vault.state.name : 'In this browser only'],
    ].forEach(function (pair) {
      const row = el('div.row', { style: { justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: 'var(--text-sm)' } });
      row.appendChild(el('span.muted', null, pair[0]));
      row.appendChild(el('span.truncate', { title: pair[1], style: { textAlign: 'right' } }, pair[1]));
      info.appendChild(row);
    });
    host.appendChild(info);
  }

  function formatValue(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function parseValue(raw) {
    const v = String(raw).trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v.indexOf(',') !== -1) return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }

  async function addProperty() {
    const note = currentNote();
    if (!note) return;
    const suggestions = new Set();
    N.store.allNotes().forEach(function (n) {
      Object.keys(n.properties || {}).forEach(function (k) { if (k !== '__raw') suggestions.add(k); });
    });
    const key = await N.modal.prompt({
      title: 'New property',
      placeholder: 'status, priority, due, author…',
      message: suggestions.size ? 'Already used in this vault: ' + Array.from(suggestions).slice(0, 10).join(', ') : '',
      validate: function (v) {
        if (!/^[\w .-]+$/.test(v.trim())) return 'Use letters, numbers, spaces, dots or dashes.';
        if ((note.properties || {})[v.trim()] !== undefined) return 'This note already has that property.';
        return null;
      },
    });
    if (!key) return;
    const value = await N.modal.prompt({ title: 'Value for "' + key.trim() + '"', placeholder: 'Leave blank for none', required: false });
    if (value === null) return;
    const next = Object.assign({}, note.properties);
    next[key.trim()] = parseValue(value);
    await N.store.updateNoteProperties(note.id, next);
    renderProps();
  }

  N.panels = { init: init, setTab: setTab, render: renderAll };
})(window.NODALIS = window.NODALIS || {});
