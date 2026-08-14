/* =========================================================================
 * Nodalis — features/sidebar.js
 * File tree (nested folders, pins, drag-and-drop), tag browser, recents,
 * and the board list. Rebuilt from state on every vault change, but cheap:
 * only the active panel renders, and open/closed folder state is remembered.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;
  const bus = N.bus;

  const collapsed = new Set();       // folder paths currently closed
  let activeTab = 'files';
  let sortMode = 'name';             // name | modified | created | manual
  let filterText = '';
  let dragPayload = null;

  function panels() {
    return {
      files: document.getElementById('panel-files'),
      tags: document.getElementById('panel-tags'),
      recent: document.getElementById('panel-recent'),
      canvases: document.getElementById('panel-canvases'),
    };
  }

  function init() {
    const tabs = document.querySelector('.sidebar-tabs');
    if (tabs) {
      U.delegate(tabs, 'click', '.sidebar-tab', function (e, btn) { setTab(btn.dataset.tab); });
    }

    document.getElementById('btn-new-note').addEventListener('click', function () { N.commands.run('note.new'); });
    document.getElementById('btn-new-folder').addEventListener('click', function () { N.commands.run('folder.new'); });
    document.getElementById('btn-new-canvas').addEventListener('click', function () { N.commands.run('canvas.new'); });
    document.getElementById('btn-daily').addEventListener('click', function () { N.commands.run('daily.today'); });
    document.getElementById('btn-sort').addEventListener('click', function (e) { openSortMenu(e.currentTarget); });

    bus.on('vault:changed', scheduleRender);
    bus.on('vault:loaded', function () { restoreCollapsed(); render(); });
    bus.on('note:active', highlightActive);
    bus.on('recent:changed', function () { if (activeTab === 'recent') render(); });
    bus.on('settings:changed', applyTabVisibility);

    attachContextMenus();
    applyTabVisibility();
    render();
  }

  const scheduleRender = U.debounce(function () { render(); }, 40);

  function setTab(tab) {
    activeTab = tab;
    U.$$('.sidebar-tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
    const p = panels();
    Object.keys(p).forEach(function (key) {
      if (p[key]) p[key].classList.toggle('is-active', key === tab);
    });
    render();
  }

  function applyTabVisibility() {
    const visible = N.store.state.settings.visibleSidebarTabs || {};
    let firstVisible = null;
    U.$$('.sidebar-tab').forEach(function (b) {
      const on = visible[b.dataset.tab] !== false;
      b.style.display = on ? '' : 'none';
      if (on && !firstVisible) firstVisible = b.dataset.tab;
    });
    if (visible[activeTab] === false && firstVisible) setTab(firstVisible);
  }

  async function restoreCollapsed() {
    try {
      const saved = await N.db.getMeta('collapsed-folders', []);
      collapsed.clear();
      (Array.isArray(saved) ? saved : []).forEach(function (p) { collapsed.add(p); });
    } catch (err) { /* not important enough to surface */ }
  }

  const persistCollapsed = U.debounce(function () {
    N.db.setMeta('collapsed-folders', Array.from(collapsed));
  }, 500);

  /* ------------------------------------------------------------- rendering */

  function render() {
    const p = panels();
    if (activeTab === 'files' && p.files) renderFiles(p.files);
    else if (activeTab === 'tags' && p.tags) renderTags(p.tags);
    else if (activeTab === 'recent' && p.recent) renderRecent(p.recent);
    else if (activeTab === 'canvases' && p.canvases) renderCanvases(p.canvases);
    highlightActive();
  }

  function matchesFilter(text) {
    if (!filterText) return true;
    return String(text).toLowerCase().indexOf(filterText.toLowerCase()) !== -1;
  }

  function sortNotes(list) {
    const sorted = list.slice();
    if (sortMode === 'modified') sorted.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    else if (sortMode === 'created') sorted.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    else sorted.sort(function (a, b) { return N.store.noteTitle(a).localeCompare(N.store.noteTitle(b), undefined, { numeric: true }); });
    return sorted;
  }

  function renderFiles(host) {
    U.clear(host);
    const all = N.store.allNotes();

    if (!all.length && !N.store.state.folders.size) {
      host.appendChild(emptyBlock('note', 'No notes yet', 'Create your first note to get started.',
        [{ label: 'New note', primary: true, onClick: function () { N.commands.run('note.new'); } }]));
      return;
    }

    /* pinned */
    const pinned = all.filter(function (n) { return n.pinned && matchesFilter(N.store.noteTitle(n)); });
    if (pinned.length) {
      host.appendChild(sectionLabel('Pinned', N.icons.node('pin', { size: 12 })));
      const wrap = el('div.tree');
      sortNotes(pinned).forEach(function (note) { wrap.appendChild(noteRow(note, 0)); });
      host.appendChild(wrap);
    }

    /* folder tree */
    const byParent = N.store.folderTree();
    const tree = el('div.tree');
    tree.appendChild(buildFolderLevel('', byParent, 0));

    /* root-level notes */
    const rootNotes = sortNotes(all.filter(function (n) {
      return !n.folder && !n.pinned && matchesFilter(N.store.noteTitle(n));
    }));
    rootNotes.forEach(function (note) { tree.appendChild(noteRow(note, 0)); });

    if (!tree.children.length) {
      host.appendChild(emptyBlock('search', 'Nothing matches', 'No notes or folders match "' + filterText + '".'));
      return;
    }
    host.appendChild(tree);
    makeDroppable(host, '');
  }

  function buildFolderLevel(parentPath, byParent, depth) {
    const frag = document.createDocumentFragment();
    const children = byParent.get(parentPath) || [];
    children.forEach(function (folder) {
      const notes = sortNotes(N.store.notesInFolder(folder.path, false).filter(function (n) {
        return !n.pinned && matchesFilter(N.store.noteTitle(n));
      }));
      const subCount = (byParent.get(folder.path) || []).length;
      const deepCount = N.store.notesInFolder(folder.path, true).length;

      // When filtering, hide folders with no surviving descendants.
      if (filterText && !notes.length && !subCount && !matchesFilter(folder.name)) return;

      const isOpen = !collapsed.has(folder.path);
      const row = el('div.tree-row' + (isOpen ? '.is-open' : ''), {
        dataset: { folder: folder.path, kind: 'folder' },
        tabindex: '0', role: 'treeitem', 'aria-expanded': String(isOpen), draggable: 'true',
      });
      row.appendChild(el('span.tree-indent', { style: { width: (depth * 12) + 'px' } }));
      const twist = N.icons.node('chevron-right', { size: 13 });
      twist.classList.add('tree-twist');
      row.appendChild(twist);
      row.appendChild(N.icons.node(isOpen ? 'folder-open' : 'folder', { size: 15 }));
      row.appendChild(el('span.tree-label', { title: folder.path }, folder.name));
      if (deepCount) row.appendChild(el('span.tree-meta', null, String(deepCount)));

      const actions = el('div.tree-row-actions');
      actions.appendChild(iconAction('plus', 'New note here', function (e) {
        e.stopPropagation();
        N.app.createNoteIn(folder.path);
      }));
      actions.appendChild(iconAction('more', 'Folder actions', function (e) {
        e.stopPropagation();
        openFolderMenu(folder, e.currentTarget);
      }));
      row.appendChild(actions);

      row.addEventListener('click', function (e) {
        if (e.target.closest('.tree-row-actions')) return;
        toggleFolder(folder.path);
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFolder(folder.path); }
        if (e.key === 'ArrowRight' && collapsed.has(folder.path)) { e.preventDefault(); toggleFolder(folder.path); }
        if (e.key === 'ArrowLeft' && !collapsed.has(folder.path)) { e.preventDefault(); toggleFolder(folder.path); }
        if (e.key === 'F2') { e.preventDefault(); renameFolderPrompt(folder); }
        if (e.key === 'Delete') { e.preventDefault(); deleteFolderPrompt(folder); }
      });
      makeDraggable(row, { type: 'folder', id: folder.id, path: folder.path });
      makeDroppable(row, folder.path);
      frag.appendChild(row);

      const kids = el('div.tree-children' + (isOpen ? '' : '.is-collapsed'));
      kids.appendChild(buildFolderLevel(folder.path, byParent, depth + 1));
      notes.forEach(function (note) { kids.appendChild(noteRow(note, depth + 1)); });
      if (isOpen && !kids.children.length) {
        kids.appendChild(el('div.tree-row.dim.small', {
          style: { paddingLeft: ((depth + 1) * 12 + 26) + 'px', cursor: 'default' },
        }, 'Empty'));
      }
      frag.appendChild(kids);
    });
    return frag;
  }

  function noteRow(note, depth) {
    const active = N.store.state.activeNoteId === note.id;
    const row = el('div.tree-row' + (active ? '.is-active' : ''), {
      dataset: { note: note.id, kind: 'note' },
      tabindex: '0', role: 'treeitem', draggable: 'true',
      title: note.path,
    });
    row.appendChild(el('span.tree-indent', { style: { width: (depth * 12 + 13) + 'px' } }));
    row.appendChild(N.icons.node(note.icon || 'note', { size: 15 }));
    row.appendChild(el('span.tree-label', null, N.store.noteTitle(note)));
    if (note.pinned) {
      const pin = N.icons.node('pin', { size: 12 });
      pin.classList.add('tree-pin');
      row.appendChild(pin);
    }
    if (note.taskCounts && note.taskCounts.open) {
      row.appendChild(el('span.tree-meta', { title: note.taskCounts.open + ' open tasks' }, String(note.taskCounts.open)));
    }

    const actions = el('div.tree-row-actions');
    actions.appendChild(iconAction('more', 'Note actions', function (e) {
      e.stopPropagation();
      openNoteMenu(note, e.currentTarget);
    }));
    row.appendChild(actions);

    row.addEventListener('click', function (e) {
      if (e.target.closest('.tree-row-actions')) return;
      N.app.openNote(note.id);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); N.app.openNote(note.id); }
      if (e.key === 'F2') { e.preventDefault(); renameNotePrompt(note); }
      if (e.key === 'Delete') { e.preventDefault(); deleteNotePrompt(note); }
    });
    makeDraggable(row, { type: 'note', id: note.id });
    return row;
  }

  function iconAction(icon, title, onClick) {
    const btn = el('button.icon-btn.icon-btn-sm', { type: 'button', title: title, 'aria-label': title, onclick: onClick });
    btn.appendChild(N.icons.node(icon, { size: 14 }));
    return btn;
  }

  function sectionLabel(text, iconNode) {
    const label = el('div.section-label');
    if (iconNode) label.appendChild(iconNode);
    label.appendChild(el('span', null, text));
    return label;
  }

  function emptyBlock(icon, title, text, actions) {
    const wrap = el('div.empty-state', { style: { minHeight: '160px', padding: '32px 16px' } });
    wrap.appendChild(N.icons.node(icon, { size: 30 }));
    wrap.appendChild(el('div.empty-state-title', { style: { fontSize: 'var(--text-base)' } }, title));
    if (text) wrap.appendChild(el('p.empty-state-text.small', null, text));
    if (actions && actions.length) {
      const row = el('div.empty-state-actions');
      actions.forEach(function (a) {
        row.appendChild(el('button.btn.btn-sm' + (a.primary ? '.btn-primary' : ''), { type: 'button', onclick: a.onClick }, a.label));
      });
      wrap.appendChild(row);
    }
    return wrap;
  }

  function toggleFolder(path) {
    if (collapsed.has(path)) collapsed.delete(path);
    else collapsed.add(path);
    persistCollapsed();
    render();
  }

  function renderTags(host) {
    U.clear(host);
    const tags = N.store.allTags().filter(function (t) { return matchesFilter(t.tag); });
    if (!tags.length) {
      host.appendChild(emptyBlock('tag', 'No tags yet',
        'Write #anything in a note and it will appear here, ready to filter by.'));
      return;
    }

    // Group nested tags (a/b) under their parent.
    const roots = new Map();
    tags.forEach(function (t) {
      const root = t.tag.split('/')[0];
      if (!roots.has(root)) roots.set(root, { tag: root, count: 0, children: [] });
      if (t.tag === root) roots.get(root).count = t.count;
      else roots.get(root).children.push(t);
    });

    const tree = el('div.tree');
    Array.from(roots.values())
      .sort(function (a, b) { return (b.count + b.children.length) - (a.count + a.children.length) || a.tag.localeCompare(b.tag); })
      .forEach(function (root) {
        tree.appendChild(tagRow(root.tag, root.count + root.children.reduce(function (s, c) { return s + c.count; }, 0), 0));
        root.children
          .sort(function (a, b) { return b.count - a.count; })
          .forEach(function (child) { tree.appendChild(tagRow(child.tag, child.count, 1)); });
      });
    host.appendChild(tree);
  }

  function tagRow(tag, count, depth) {
    const row = el('div.tree-row', { dataset: { tag: tag, kind: 'tag' }, tabindex: '0' });
    row.appendChild(el('span.tree-indent', { style: { width: (depth * 14) + 'px' } }));
    const dot = el('span.chip-dot', { style: { background: U.colorFromString(tag) } });
    row.appendChild(dot);
    row.appendChild(el('span.tree-label', null, '#' + tag.split('/').pop()));
    row.appendChild(el('span.tree-meta', null, String(count)));
    row.addEventListener('click', function () { N.search.openTag(tag); });
    row.addEventListener('keydown', function (e) { if (e.key === 'Enter') N.search.openTag(tag); });
    return row;
  }

  function renderRecent(host) {
    U.clear(host);
    const ids = N.store.state.recentNoteIds;
    const notes = ids.map(function (id) { return N.store.getNote(id); }).filter(Boolean);
    if (!notes.length) {
      host.appendChild(emptyBlock('history', 'Nothing recent', 'Notes you open will be listed here.'));
      return;
    }
    const tree = el('div.tree');
    notes.forEach(function (note) {
      const row = noteRow(note, 0);
      const meta = row.querySelector('.tree-meta');
      if (meta) meta.remove();
      row.appendChild(el('span.tree-meta', null, U.relativeTime(note.lastOpenedAt || note.updatedAt)));
      tree.appendChild(row);
    });
    host.appendChild(tree);
  }

  function renderCanvases(host) {
    U.clear(host);
    const canvases = Array.from(N.store.state.canvases.values())
      .filter(function (c) { return matchesFilter(c.title); })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    host.appendChild(sectionLabel('Canvases'));
    if (!canvases.length) {
      host.appendChild(emptyBlock('canvas', 'No canvases', 'A canvas is an infinite whiteboard for cards, sketches and connections.',
        [{ label: 'New canvas', primary: true, onClick: function () { N.commands.run('canvas.new'); } }]));
    } else {
      const tree = el('div.tree');
      canvases.forEach(function (canvas) {
        const row = el('div.tree-row' + (N.store.state.activeCanvasId === canvas.id ? '.is-active' : ''), { tabindex: '0' });
        row.appendChild(N.icons.node('canvas', { size: 15 }));
        row.appendChild(el('span.tree-label', null, canvas.title || 'Untitled canvas'));
        row.appendChild(el('span.tree-meta', null, String((canvas.items || []).length)));
        row.addEventListener('click', function () { N.canvas.open(canvas.id); });
        tree.appendChild(row);
      });
      host.appendChild(tree);
    }

    host.appendChild(sectionLabel('Other boards'));
    const boards = el('div.tree');
    [
      { view: 'sticky', icon: 'sticky', label: 'Sticky wall', count: N.store.state.stickies.size },
      { view: 'matrix', icon: 'matrix', label: 'Priority matrix' },
      { view: 'scratch', icon: 'inbox', label: 'Scratchpad', count: Array.from(N.store.state.scratch.values()).filter(function (s) { return !s.archived; }).length },
      { view: 'review', icon: 'flame', label: 'Daily review' },
    ].forEach(function (item) {
      const row = el('div.tree-row', { tabindex: '0' });
      row.appendChild(N.icons.node(item.icon, { size: 15 }));
      row.appendChild(el('span.tree-label', null, item.label));
      if (item.count) row.appendChild(el('span.tree-meta', null, String(item.count)));
      row.addEventListener('click', function () { N.app.setView(item.view); });
      boards.appendChild(row);
    });
    host.appendChild(boards);
  }

  function highlightActive() {
    U.$$('.tree-row[data-note]').forEach(function (row) {
      row.classList.toggle('is-active', row.dataset.note === N.store.state.activeNoteId);
    });
  }

  /* ------------------------------------------------------------ drag/drop */

  function makeDraggable(row, payload) {
    row.addEventListener('dragstart', function (e) {
      dragPayload = payload;
      row.classList.add('is-dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      } catch (err) { /* Safari can be fussy; the module-level payload still works */ }
    });
    row.addEventListener('dragend', function () {
      row.classList.remove('is-dragging');
      dragPayload = null;
      U.$$('.is-drop-target').forEach(function (n) { n.classList.remove('is-drop-target'); });
    });
  }

  function makeDroppable(node, folderPath) {
    node.addEventListener('dragover', function (e) {
      if (!dragPayload) return;
      if (dragPayload.type === 'folder' && (folderPath === dragPayload.path || folderPath.startsWith(dragPayload.path + '/'))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (node.classList.contains('tree-row')) node.classList.add('is-drop-target');
    });
    node.addEventListener('dragleave', function () { node.classList.remove('is-drop-target'); });
    node.addEventListener('drop', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove('is-drop-target');
      const payload = dragPayload;
      dragPayload = null;
      if (!payload) return;
      try {
        if (payload.type === 'note') {
          await N.store.moveNote(payload.id, folderPath);
          N.toast.success('Moved to ' + (folderPath || 'the vault root'), { ms: 1800 });
        } else if (payload.type === 'folder') {
          if (folderPath === payload.path || folderPath.startsWith(payload.path + '/')) return;
          const result = await N.store.moveFolder(payload.id, folderPath);
          if (result) N.toast.success('Folder moved', { ms: 1800 });
        }
      } catch (err) {
        N.toast.error(U.describeError(err), { title: 'Could not move that' });
      }
    });
  }

  /* --------------------------------------------------------------- menus */

  function attachContextMenus() {
    const body = document.querySelector('.sidebar-body');
    if (!body) return;
    N.menu.attach(body, '.tree-row[data-note]', function (row) {
      const note = N.store.getNote(row.dataset.note);
      return note ? noteMenuItems(note) : null;
    }, { title: function (row) { const n = N.store.getNote(row.dataset.note); return n ? N.store.noteTitle(n) : ''; } });

    N.menu.attach(body, '.tree-row[data-folder]', function (row) {
      const folder = N.store.folderByPath(row.dataset.folder);
      return folder ? folderMenuItems(folder) : null;
    }, { title: function (row) { return row.dataset.folder; } });

    N.menu.attach(body, '.tree-row[data-tag]', function (row) {
      const tag = row.dataset.tag;
      return [
        { label: 'Show notes with #' + tag, icon: 'search', onClick: function () { N.search.openTag(tag); } },
        { label: 'Copy tag', icon: 'copy', onClick: function () { U.copyToClipboard('#' + tag); N.toast.success('Copied', { ms: 1200 }); } },
        { label: 'Rename tag everywhere…', icon: 'edit', onClick: function () { renameTagPrompt(tag); } },
      ];
    });
  }

  function noteMenuItems(note) {
    return [
      { label: 'Open', icon: 'note', onClick: function () { N.app.openNote(note.id); } },
      { label: note.pinned ? 'Unpin' : 'Pin to top', icon: note.pinned ? 'pin-off' : 'pin', onClick: function () { N.store.togglePin(note.id); } },
      { separator: true },
      { label: 'Rename…', icon: 'edit', hint: 'F2', onClick: function () { renameNotePrompt(note); } },
      { label: 'Duplicate', icon: 'duplicate', onClick: function () { N.store.duplicateNote(note.id); } },
      { label: 'Move to…', icon: 'folder', onClick: function () { moveNotePrompt(note); } },
      { separator: true },
      { label: 'Copy link', icon: 'link', onClick: function () { U.copyToClipboard('[[' + N.store.noteTitle(note) + ']]'); N.toast.success('Link copied', { ms: 1400 }); } },
      { label: 'Export…', icon: 'download', onClick: function () { N.exporter.exportNoteDialog(note.id); } },
      { separator: true },
      { label: 'Delete', icon: 'trash', danger: true, hint: 'Del', onClick: function () { deleteNotePrompt(note); } },
    ];
  }

  function folderMenuItems(folder) {
    return [
      { label: 'New note here', icon: 'file-plus', onClick: function () { N.app.createNoteIn(folder.path); } },
      { label: 'New subfolder', icon: 'folder-plus', onClick: function () { newSubfolderPrompt(folder.path); } },
      { separator: true },
      { label: 'Rename…', icon: 'edit', hint: 'F2', onClick: function () { renameFolderPrompt(folder); } },
      { label: 'Move to…', icon: 'move', onClick: function () { moveFolderPrompt(folder); } },
      { label: 'Open in database view', icon: 'database', onClick: function () { N.database.openScope('folder:' + folder.path); } },
      { label: 'Export folder…', icon: 'download', onClick: function () { N.exporter.exportFolderDialog(folder.path); } },
      { separator: true },
      { label: 'Delete folder', icon: 'trash', danger: true, onClick: function () { deleteFolderPrompt(folder); } },
    ];
  }

  function openNoteMenu(note, anchor) { N.menu.show(noteMenuItems(note), { anchor: anchor, align: 'right', title: N.store.noteTitle(note) }); }
  function openFolderMenu(folder, anchor) { N.menu.show(folderMenuItems(folder), { anchor: anchor, align: 'right', title: folder.name }); }

  function openSortMenu(anchor) {
    N.menu.show([
      { header: 'Sort by' },
      { label: 'Name', icon: 'sort', checked: sortMode === 'name', onClick: function () { sortMode = 'name'; render(); } },
      { label: 'Last modified', icon: 'clock', checked: sortMode === 'modified', onClick: function () { sortMode = 'modified'; render(); } },
      { label: 'Date created', icon: 'calendar', checked: sortMode === 'created', onClick: function () { sortMode = 'created'; render(); } },
      { separator: true },
      { label: 'Filter this list…', icon: 'filter', onClick: openFilterPrompt },
      filterText ? { label: 'Clear filter', icon: 'close', onClick: function () { filterText = ''; render(); } } : null,
      { separator: true },
      { label: 'Expand all folders', icon: 'expand', onClick: function () { collapsed.clear(); persistCollapsed(); render(); } },
      { label: 'Collapse all folders', icon: 'collapse', onClick: function () {
        N.store.state.folders.forEach(function (f) { collapsed.add(f.path); });
        persistCollapsed(); render();
      } },
    ].filter(Boolean), { anchor: anchor, align: 'right' });
  }

  async function openFilterPrompt() {
    const value = await N.modal.prompt({
      title: 'Filter the sidebar', placeholder: 'Type part of a name…', value: filterText, required: false,
    });
    if (value === null) return;
    filterText = value.trim();
    render();
  }

  /* -------------------------------------------------------------- prompts */

  async function renameNotePrompt(note) {
    const next = await N.modal.prompt({
      title: 'Rename note', value: N.store.noteTitle(note), placeholder: 'Note name',
      message: 'Links to this note in other notes will be updated automatically.',
    });
    if (next === null) return;
    await N.store.renameNote(note.id, next);
  }

  async function deleteNotePrompt(note) {
    if (N.store.state.settings.confirmDelete !== false) {
      const ok = await N.modal.confirm({
        title: 'Delete "' + N.store.noteTitle(note) + '"?',
        message: N.vault.isFolderMode()
          ? 'The file will be removed from your folder on disk. You can undo this straight away with Ctrl/Cmd+Z.'
          : 'You can undo this straight away with Ctrl/Cmd+Z.',
        confirmLabel: 'Delete', danger: true,
      });
      if (!ok) return;
    }
    await N.store.deleteNote(note.id);
    N.toast.show('Note deleted', {
      kind: 'info', ms: 7000,
      action: { label: 'Undo', onClick: function () { N.store.undo(); } },
    });
  }

  async function moveNotePrompt(note) {
    const target = await pickFolder('Move "' + N.store.noteTitle(note) + '" to…', note.folder);
    if (target === null) return;
    await N.store.moveNote(note.id, target);
    N.toast.success('Moved to ' + (target || 'the vault root'), { ms: 1800 });
  }

  async function newSubfolderPrompt(parent) {
    const name = await N.modal.prompt({ title: 'New folder in ' + parent, placeholder: 'Folder name' });
    if (!name) return;
    const folder = await N.store.createFolder(name, parent);
    if (folder) { collapsed.delete(parent); render(); }
  }

  async function renameFolderPrompt(folder) {
    const next = await N.modal.prompt({
      title: 'Rename folder', value: folder.name, placeholder: 'Folder name',
      message: 'Notes inside will move with it.',
    });
    if (next === null) return;
    await N.store.renameFolder(folder.id, next);
  }

  async function moveFolderPrompt(folder) {
    const target = await pickFolder('Move "' + folder.name + '" into…', folder.parent, folder.path);
    if (target === null) return;
    await N.store.moveFolder(folder.id, target);
  }

  async function deleteFolderPrompt(folder) {
    const noteCount = N.store.notesInFolder(folder.path, true).length;
    if (noteCount) {
      const choice = await N.modal.choose({
        title: 'Delete "' + folder.name + '"?',
        message: 'This folder holds ' + U.pluralize(noteCount, 'note') + '.',
        options: [
          { value: 'keep', label: 'Delete the folder, keep the notes', description: 'Notes move to the vault root.', icon: 'folder-open' },
          { value: 'all', label: 'Delete the folder and its notes', description: 'Undoable with Ctrl/Cmd+Z.', icon: 'trash', danger: true },
        ],
      });
      if (!choice) return;
      await N.store.deleteFolder(folder.id, { keepNotes: choice === 'keep' });
      N.toast.show(choice === 'keep' ? 'Folder deleted, notes kept' : 'Folder and notes deleted', {
        kind: 'info', ms: 7000, action: { label: 'Undo', onClick: function () { N.store.undo(); } },
      });
      return;
    }
    const ok = await N.modal.confirm({ title: 'Delete "' + folder.name + '"?', message: 'This folder is empty.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await N.store.deleteFolder(folder.id);
  }

  async function renameTagPrompt(tag) {
    const next = await N.modal.prompt({
      title: 'Rename #' + tag, value: tag, placeholder: 'new-tag-name',
      message: 'Every note using this tag will be rewritten.',
      validate: function (v) { return /^[A-Za-z][\w/-]*$/.test(v.trim()) ? null : 'Tags start with a letter and contain letters, numbers, - / _'; },
    });
    if (!next || next === tag) return;
    const notes = N.store.notesWithTag(tag);
    let changed = 0;
    for (const note of notes) {
      const re = new RegExp('(^|[\\s(>])#' + U.escapeRegExp(tag) + '\\b', 'g');
      const updated = note.content.replace(re, '$1#' + next.trim());
      if (updated !== note.content) { await N.store.updateNoteContent(note.id, updated, { quiet: true }); changed++; }
    }
    bus.emit('vault:changed');
    N.toast.success('Renamed in ' + U.pluralize(changed, 'note'));
  }

  /** Shared folder picker used by move dialogs across the app. */
  function pickFolder(title, currentPath, excludePath) {
    const options = [{ value: '', label: 'Vault root', icon: 'home', description: currentPath === '' ? 'Current location' : '' }];
    Array.from(N.store.state.folders.values())
      .sort(function (a, b) { return a.path.localeCompare(b.path); })
      .forEach(function (f) {
        if (excludePath && (f.path === excludePath || f.path.startsWith(excludePath + '/'))) return;
        options.push({
          value: f.path,
          label: f.path,
          icon: 'folder',
          description: f.path === currentPath ? 'Current location' : '',
        });
      });
    options.push({ value: '__new__', label: 'New folder…', icon: 'folder-plus' });

    return N.modal.choose({ title: title, options: options }).then(async function (value) {
      if (value === '__new__') {
        const name = await N.modal.prompt({ title: 'New folder', placeholder: 'Folder name' });
        if (!name) return null;
        const folder = await N.store.createFolder(name, '');
        return folder ? folder.path : null;
      }
      return value;
    });
  }

  N.sidebar = {
    init: init, render: render, setTab: setTab,
    pickFolder: pickFolder,
    expandTo: function (folderPath) {
      if (!folderPath) return;
      const parts = folderPath.split('/');
      let acc = '';
      parts.forEach(function (p) { acc = acc ? acc + '/' + p : p; collapsed.delete(acc); });
      persistCollapsed();
      render();
    },
  };
})(window.NODALIS = window.NODALIS || {});
