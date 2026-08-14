/* =========================================================================
 * Nodalis — features/settings.js
 * Every preference in one place, grouped and searchable, including the
 * storage panel (the most important screen in the app) and a full shortcut
 * editor where any command can be rebound.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let body;
  let activeSection = 'storage';

  const SECTIONS = [
    { id: 'storage', label: 'Storage', icon: 'save' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'typography', label: 'Typography', icon: 'type' },
    { id: 'editor', label: 'Editor', icon: 'edit' },
    { id: 'features', label: 'Features', icon: 'layers' },
    { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
    { id: 'daily', label: 'Daily notes', icon: 'calendar' },
    { id: 'data', label: 'Backup & data', icon: 'archive' },
    { id: 'about', label: 'About', icon: 'info' },
  ];

  function init() {
    body = document.getElementById('settings-body');
    if (!body) return;

    const exportBtn = document.getElementById('settings-export-config');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      U.downloadText(JSON.stringify(N.store.state.settings, null, 2), 'nodalis-settings.json', 'application/json');
      N.toast.success('Settings exported', { ms: 1800 });
    });

    N.bus.on('view:changed', function (v) { if (v === 'settings') render(); });
    N.bus.on('settings:openSection', function (id) { activeSection = id; N.app.setView('settings'); render(); });
    N.bus.on('vault:status', U.debounce(function () {
      if (N.store.state.activeView === 'settings' && activeSection === 'storage') render();
    }, 300));

    registerCommands();
  }

  function s() { return N.store.state.settings; }

  async function set(key, value) {
    await N.store.setSetting(key, value);
    N.theme.apply();
  }

  /* ------------------------------------------------------------ scaffolding */

  function render() {
    if (!body) return;
    U.clear(body);

    const layout = el('div.settings-layout');
    const nav = el('div.settings-nav');
    SECTIONS.forEach(function (section) {
      const btn = el('button.settings-nav-item' + (section.id === activeSection ? '.is-active' : ''), {
        type: 'button', dataset: { label: section.label },
        onclick: function () { activeSection = section.id; render(); },
      });
      btn.appendChild(N.icons.node(section.icon, { size: 16 }));
      btn.appendChild(el('span', null, section.label));
      nav.appendChild(btn);
    });
    layout.appendChild(nav);

    const content = el('div');
    const builder = {
      storage: renderStorage, appearance: renderAppearance, typography: renderTypography,
      editor: renderEditor, features: renderFeatures, shortcuts: renderShortcuts,
      daily: renderDaily, data: renderData, about: renderAbout,
    }[activeSection] || renderStorage;
    content.appendChild(builder());
    layout.appendChild(content);

    body.appendChild(layout);
  }

  function section(title, description) {
    const wrap = el('div.settings-section');
    wrap.appendChild(el('h3.settings-section-title', null, title));
    if (description) wrap.appendChild(el('p.settings-section-desc', null, description));
    return wrap;
  }

  function row(name, description, control) {
    const r = el('div.setting-row');
    const info = el('div.setting-info');
    info.appendChild(el('div.setting-name', null, name));
    if (description) info.appendChild(el('div.setting-desc', null, description));
    r.appendChild(info);
    const c = el('div.setting-control');
    if (Array.isArray(control)) control.forEach(function (x) { c.appendChild(x); });
    else if (control) c.appendChild(control);
    r.appendChild(c);
    return r;
  }

  function toggle(key, onChange) {
    const value = U.deepClone(getPath(s(), key));
    const sw = el('div.switch' + (value ? '.is-on' : ''), {
      role: 'switch', tabindex: '0', 'aria-checked': String(!!value),
    });
    const flip = async function () {
      const next = !getPath(s(), key);
      sw.classList.toggle('is-on', next);
      sw.setAttribute('aria-checked', String(next));
      await set(key, next);
      if (onChange) onChange(next);
    };
    sw.addEventListener('click', flip);
    sw.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    return sw;
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (acc, k) { return acc === undefined || acc === null ? undefined : acc[k]; }, obj);
  }

  function select(key, options, onChange) {
    const field = el('select.field');
    options.forEach(function (o) {
      field.appendChild(el('option', { value: o.value, selected: String(getPath(s(), key)) === String(o.value) }, o.label));
    });
    field.addEventListener('change', async function () {
      let value = field.value;
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
      await set(key, value);
      if (onChange) onChange(value);
    });
    return field;
  }

  function slider(key, min, max, step, format, onChange) {
    const wrap = el('div.row', { style: { gap: '10px' } });
    const input = el('input', { type: 'range', min: min, max: max, step: step, value: getPath(s(), key), style: { width: '150px' } });
    const label = el('span.small.muted', { style: { minWidth: '52px' } }, format(getPath(s(), key)));
    input.addEventListener('input', function () { label.textContent = format(Number(input.value)); });
    input.addEventListener('change', async function () {
      await set(key, Number(input.value));
      if (onChange) onChange(Number(input.value));
    });
    wrap.appendChild(input);
    wrap.appendChild(label);
    return wrap;
  }

  /* ------------------------------------------------------------- storage */

  function renderStorage() {
    const wrap = section('Where your notes live',
      'Nodalis works best pointed at a real folder on your disk. Every change is written straight to plain .md files you own — no cache to clear, no account, nothing to lose.');

    const info = N.vault.describe();
    const state = N.vault.state;

    /* status banner */
    const banner = el('div.banner' + (info.safe ? '.is-success' : (U.supports.fileSystemAccess ? '.is-warn' : '')));
    banner.appendChild(N.icons.node(info.safe ? 'success' : 'warning', { size: 20 }));
    const bmain = el('div.banner-main');
    bmain.appendChild(el('div.banner-title', null, info.safe
      ? 'Saving to "' + state.name + '"'
      : 'Your notes are only in this browser'));
    bmain.appendChild(el('div', { style: { lineHeight: '1.55' } }, info.safe
      ? 'Every edit is written to disk within a second. ' + U.pluralize(N.store.state.notes.size, 'note') + ' currently synced.'
      : (info.reason || '')));

    const actions = el('div.banner-actions');
    if (U.supports.fileSystemAccess) {
      if (info.safe) {
        actions.appendChild(el('button.btn.btn-sm', { type: 'button', onclick: syncNow }, 'Sync now'));
        actions.appendChild(el('button.btn.btn-sm', { type: 'button', onclick: changeFolder }, 'Change folder'));
        actions.appendChild(el('button.btn.btn-sm.btn-danger', { type: 'button', onclick: disconnect }, 'Disconnect'));
      } else if (state.status === 'permission' && state.handle) {
        actions.appendChild(el('button.btn.btn-sm.btn-primary', { type: 'button', onclick: reconnect }, 'Reconnect "' + state.name + '"'));
        actions.appendChild(el('button.btn.btn-sm', { type: 'button', onclick: changeFolder }, 'Choose a different folder'));
      } else {
        actions.appendChild(el('button.btn.btn-sm.btn-primary', { type: 'button', onclick: changeFolder }, 'Choose a folder'));
      }
    } else {
      actions.appendChild(el('button.btn.btn-sm.btn-primary', {
        type: 'button', onclick: function () { N.commands.run('export.vault'); },
      }, 'Download a backup now'));
    }
    bmain.appendChild(actions);
    banner.appendChild(bmain);
    wrap.appendChild(banner);

    /* how it works */
    if (!U.supports.fileSystemAccess) {
      const note = el('div.panel', { style: { marginTop: '18px' } });
      note.appendChild(el('div.panel-head', null, [N.icons.node('info', { size: 16 }), el('div.panel-title', null, 'Why this browser cannot use a folder')]));
      const nb = el('div.panel-body');
      nb.appendChild(el('p', { style: { lineHeight: '1.6' } },
        U.supports.isIOS
          ? 'Apple does not allow any iPhone or iPad browser to write directly into a folder — that includes Safari, Chrome and Firefox on iOS, which all use the same engine underneath.'
          : 'This browser has not implemented the File System Access API. Chrome, Edge, Brave, Opera and Arc on desktop all support it.'));
      nb.appendChild(el('p', { style: { lineHeight: '1.6', marginTop: '10px' } },
        'Nodalis still works completely here — your notes are stored on this device. The one real risk is clearing site data, which would erase them. Keep a periodic .zip export and you are covered.'));
      nb.appendChild(el('div.row', { style: { gap: '10px', marginTop: '14px', flexWrap: 'wrap' } }, [
        el('button.btn.btn-sm.btn-primary', { type: 'button', onclick: function () { N.commands.run('export.vault'); } }, 'Export a backup'),
        el('button.btn.btn-sm', { type: 'button', onclick: requestPersistence }, 'Ask the browser to keep this data'),
      ]));
      note.appendChild(nb);
      wrap.appendChild(note);
    }

    wrap.appendChild(row('Write changes automatically',
      'When a folder is connected, every edit is saved within about a second. Turning this off means you must use "Sync now" by hand.',
      toggle('autoBackupToFolder')));

    wrap.appendChild(row('Remind me to export a backup',
      'Only relevant when no folder is connected.',
      select('snapshotReminderDays', [
        { value: 1, label: 'Every day' },
        { value: 3, label: 'Every 3 days' },
        { value: 7, label: 'Weekly' },
        { value: 0, label: 'Never' },
      ])));

    /* storage usage */
    const usage = el('div.panel', { style: { marginTop: '22px' } });
    usage.appendChild(el('div.panel-head', null, [N.icons.node('database', { size: 16 }), el('div.panel-title', null, 'On this device')]));
    const ub = el('div.panel-body');
    const usageLine = el('div.small.muted', null, 'Checking…');
    ub.appendChild(usageLine);
    const bar = el('div.progress', { style: { marginTop: '10px' } });
    const fill = el('div.progress-fill', { style: { width: '0%' } });
    bar.appendChild(fill);
    ub.appendChild(bar);
    N.db.estimate().then(function (est) {
      if (est.unknown) { usageLine.textContent = 'This browser does not report storage usage.'; return; }
      usageLine.textContent = U.formatBytes(est.usage) + ' used of roughly ' + U.formatBytes(est.quota) + ' available';
      fill.style.width = Math.max(1, Math.round(est.ratio * 100)) + '%';
      if (est.ratio > 0.85) {
        ub.appendChild(el('div.field-error', null, 'Storage is nearly full. Export and trim old attachments.'));
      }
    });
    usage.appendChild(ub);
    wrap.appendChild(usage);

    if (N.db.isDegraded()) {
      const danger = el('div.banner.is-danger', { style: { marginTop: '18px' } });
      danger.appendChild(N.icons.node('error', { size: 20 }));
      danger.appendChild(el('div.banner-main', null, [
        el('div.banner-title', null, 'Local database unavailable'),
        el('div', null, N.db.degradedReason() + ' Nodalis is running from memory only — nothing will survive a refresh. Export your work now.'),
      ]));
      wrap.appendChild(danger);
    }

    return wrap;
  }

  async function changeFolder() {
    try {
      await N.vault.connectFolder();
      const choice = await N.modal.choose({
        title: 'Folder connected',
        message: 'Should Nodalis write what it already has into that folder, or read what is already in there?',
        options: [
          { value: 'push', label: 'Write my notes into the folder', description: 'Recommended when the folder is empty', icon: 'upload' },
          { value: 'pull', label: 'Read the folder into Nodalis', description: 'Recommended for an existing vault, e.g. from Obsidian', icon: 'download' },
          { value: 'merge', label: 'Do both', description: 'Read first, then write everything back', icon: 'repeat' },
        ],
      });
      if (!choice) { render(); return; }
      const closing = N.toast.info('Syncing…', { ms: 0, key: 'sync' });
      try {
        if (choice === 'pull' || choice === 'merge') await N.vault.pullAll();
        if (choice === 'push' || choice === 'merge') await N.vault.pushAll();
        closing();
        N.toast.success('Your notes are now saved to "' + N.vault.state.name + '"', { ms: 4000 });
        N.loader.celebrate({ count: 30 });
      } catch (err) {
        closing();
        N.toast.error(U.describeError(err), { title: 'Sync failed' });
      }
      render();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      N.toast.error(U.describeError(err), { title: 'Could not connect that folder' });
    }
  }

  async function reconnect() {
    try {
      const handle = await N.vault.reconnect();
      if (!handle) { N.toast.warn('Access was not granted.'); return; }
      await N.vault.pullAll();
      N.toast.success('Reconnected to "' + N.vault.state.name + '"', { ms: 3000 });
      render();
    } catch (err) {
      N.toast.error(U.describeError(err));
    }
  }

  async function syncNow() {
    const closing = N.toast.info('Syncing…', { ms: 0, key: 'sync' });
    try {
      await N.vault.flushNow();
      await N.vault.pushAll();
      closing();
      N.toast.success('Everything is on disk', { ms: 2200 });
    } catch (err) {
      closing();
      N.toast.error(U.describeError(err), { title: 'Sync failed' });
    }
    render();
  }

  async function disconnect() {
    const ok = await N.modal.confirm({
      title: 'Disconnect the folder?',
      message: 'Your files stay exactly where they are on disk. Nodalis will stop writing to them and keep working from this device instead.',
      confirmLabel: 'Disconnect',
    });
    if (!ok) return;
    await N.vault.disconnectFolder();
    render();
  }

  async function requestPersistence() {
    const result = await N.db.requestPersistence();
    if (!result.supported) N.toast.warn('This browser does not offer persistent storage.');
    else if (result.granted) N.toast.success('The browser agreed to keep this data. It will not be cleared automatically.', { ms: 4000 });
    else N.toast.warn('The browser declined. It usually agrees once you have used the app a few times, or after installing it.', { ms: 6000 });
  }

  /* ---------------------------------------------------------- appearance */

  function renderAppearance() {
    const wrap = section('Appearance', 'Four complete looks, each with its own personality. Everything here applies instantly.');

    const picker = el('div.theme-picker');
    [
      { id: 'nodalis', name: 'Nodalis paper', colors: ['#faf6ed', '#fffdf8', '#6c5ce7', '#e5dcc7'] },
      { id: 'notion', name: 'Notion', colors: ['#f7f7f5', '#ffffff', '#37352f', '#eae9e6'] },
      { id: 'nothing', name: 'Nothing', colors: ['#0a0a0a', '#000000', '#d71921', '#262626'] },
      { id: 'glass', name: 'Liquid Glass', colors: ['#dfe6f6', '#ffffff', '#6c5ce7', '#cbd6f2'] },
    ].forEach(function (theme) {
      const card = el('button.theme-card' + (s().themeStyle === theme.id ? '.is-active' : ''), { type: 'button' });
      const preview = el('div.theme-preview');
      preview.appendChild(el('div.theme-preview-side', { style: { background: theme.colors[0] } }));
      const main = el('div.theme-preview-main', { style: { background: theme.colors[1] } });
      main.appendChild(el('div.theme-preview-line', { style: { background: theme.colors[2], width: '62%' } }));
      main.appendChild(el('div.theme-preview-line', { style: { background: theme.colors[3], width: '88%' } }));
      main.appendChild(el('div.theme-preview-line', { style: { background: theme.colors[3], width: '74%' } }));
      preview.appendChild(main);
      card.appendChild(preview);
      const label = el('div.theme-card-label');
      label.appendChild(el('span', null, theme.name));
      if (s().themeStyle === theme.id) label.appendChild(N.icons.node('check-small', { size: 15 }));
      card.appendChild(label);
      card.addEventListener('click', async function () { await N.theme.setStyle(theme.id); render(); });
      picker.appendChild(card);
    });
    wrap.appendChild(picker);

    wrap.appendChild(row('Light or dark', 'Auto follows your system, or the clock.',
      select('themeMode', [
        { value: 'auto-system', label: 'Follow system' },
        { value: 'auto-time', label: 'Follow time of day' },
        { value: 'light', label: 'Always light' },
        { value: 'dark', label: 'Always dark' },
      ])));

    if (s().themeStyle === 'glass') {
      wrap.appendChild(row('Glass intensity', 'How much blur and colour the panels pick up from behind.',
        select('glassIntensity', [
          { value: 'subtle', label: 'Subtle' },
          { value: 'medium', label: 'Medium' },
          { value: 'vivid', label: 'Vivid' },
        ])));
      wrap.appendChild(row('Animated background', 'The slow-moving colour wash behind the glass.', toggle('ambientBackground')));
    }

    if (s().themeStyle !== 'nothing') {
      const swatches = el('div.swatch-row');
      N.theme.ACCENT_PRESETS.forEach(function (preset) {
        const sw = el('button.swatch' + (s().accent === preset.hex ? '.is-active' : ''), {
          type: 'button', title: preset.name, style: { background: preset.hex },
          onclick: async function () { await N.theme.setAccent(preset.hex); render(); },
        });
        swatches.appendChild(sw);
      });
      const custom = el('input', { type: 'color', value: s().accent, title: 'Custom colour' });
      custom.addEventListener('change', async function () { await N.theme.setAccent(custom.value); });
      swatches.appendChild(custom);
      wrap.appendChild(row('Accent colour', 'Used for links, selections and highlights.', swatches));
    } else {
      wrap.appendChild(row('Accent colour', 'The Nothing theme uses its own red (#D71921) and ignores custom accents.',
        el('span.chip', null, '#D71921')));
    }

    wrap.appendChild(row('Corner style', 'How rounded everything is.',
      select('roundness', [
        { value: 'sharp', label: 'Sharp' },
        { value: 'default', label: 'Default' },
        { value: 'soft', label: 'Soft' },
      ])));

    wrap.appendChild(row('Density', 'Spacing throughout the interface.',
      select('density', [
        { value: 'compact', label: 'Compact' },
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'roomy', label: 'Roomy' },
      ])));

    wrap.appendChild(row('Animations', 'Reduced keeps motion but halves it. None removes it entirely.',
      select('animations', [
        { value: 'full', label: 'Full' },
        { value: 'reduced', label: 'Reduced' },
        { value: 'none', label: 'None' },
      ])));

    wrap.appendChild(row('Show the intro animation', 'The graph that assembles itself when Nodalis starts.',
      toggle('showLoaderOnStart')));

    return wrap;
  }

  /* --------------------------------------------------------- typography */

  function renderTypography() {
    const wrap = section('Typography', 'Interface and writing fonts are set separately, and both apply everywhere immediately.');

    wrap.appendChild(row('Interface font', 'Menus, sidebar, buttons — everything except the note body.',
      select('uiFont', N.theme.UI_FONTS.map(function (f) { return { value: f.id, label: f.name }; }))));

    wrap.appendChild(row('Writing font', 'The note editor and the rendered preview.',
      select('editorFont', N.theme.EDITOR_FONTS.map(function (f) { return { value: f.id, label: f.name }; }))));

    wrap.appendChild(row('Text size', 'Applies to the note body.',
      slider('fontSize', 12, 26, 1, function (v) { return v + 'px'; })));

    wrap.appendChild(row('Line spacing', 'Comfortable reading is usually between 1.6 and 1.8.',
      slider('lineHeight', 1.2, 2.4, 0.05, function (v) { return Number(v).toFixed(2); })));

    wrap.appendChild(row('Line width', 'How wide a paragraph gets before it wraps.',
      select('contentWidth', [
        { value: 'narrow', label: 'Narrow' },
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'wide', label: 'Wide' },
        { value: 'full', label: 'Full width' },
      ])));

    /* live preview */
    const preview = el('div.panel', { style: { marginTop: '24px' } });
    preview.appendChild(el('div.panel-head', null, [N.icons.node('eye', { size: 16 }), el('div.panel-title', null, 'Preview')]));
    const pb = el('div.panel-body.prose');
    pb.innerHTML = N.markdown.render([
      '## The quick brown fox',
      '',
      'Typography is the craft of making letters behave. A good writing font disappears — you notice the sentence, not the shapes.',
      '',
      '- A list item, to check spacing',
      '- [ ] And a task, to check the checkbox',
      '',
      '`inline code` and a [[wikilink]] and a #tag.',
    ].join('\n'));
    preview.appendChild(pb);
    wrap.appendChild(preview);

    return wrap;
  }

  /* ------------------------------------------------------------- editor */

  function renderEditor() {
    const wrap = section('Editor', 'How the writing surface behaves.');

    wrap.appendChild(row('Default mode', 'What you see when a note opens.',
      select('editorMode', [
        { value: 'edit', label: 'Write only' },
        { value: 'split', label: 'Split' },
        { value: 'preview', label: 'Read only' },
      ], function (v) { N.editor.setMode(v); })));

    wrap.appendChild(row('Spell check', "Uses your browser's dictionary.", toggle('spellcheck')));
    wrap.appendChild(row('Continue lists automatically',
      'Pressing Enter in a list starts the next item; pressing it on an empty item ends the list.', toggle('smartLists')));
    wrap.appendChild(row('Close brackets and quotes', 'Typing ( inserts (), and typing ) steps over it.', toggle('autoPairBrackets')));
    wrap.appendChild(row('Typewriter scrolling', 'Keeps the line you are writing near the middle of the screen.', toggle('typewriterMode')));
    wrap.appendChild(row('Vim key bindings', 'Modal editing. Escape leaves insert mode.', toggle('vimMode')));
    wrap.appendChild(row('Confirm before deleting', 'Turn off if you trust undo. Deleting is always undoable.', toggle('confirmDelete')));
    wrap.appendChild(row('Indent size', 'Spaces inserted by Tab.',
      select('tabSize', [{ value: 2, label: '2 spaces' }, { value: 4, label: '4 spaces' }])));

    wrap.appendChild(row('New notes go in',
      'Where the "New note" button puts things when no folder is selected.',
      folderSelect('defaultNewNoteFolder')));

    return wrap;
  }

  function folderSelect(key) {
    const field = el('select.field');
    field.appendChild(el('option', { value: '', selected: !getPath(s(), key) }, 'Vault root'));
    Array.from(N.store.state.folders.values())
      .sort(function (a, b) { return a.path.localeCompare(b.path); })
      .forEach(function (f) {
        field.appendChild(el('option', { value: f.path, selected: getPath(s(), key) === f.path }, f.path));
      });
    field.addEventListener('change', function () { set(key, field.value); });
    return field;
  }

  /* ----------------------------------------------------------- features */

  function renderFeatures() {
    const wrap = section('Features',
      'Nodalis has a lot in it. Switch off whatever you do not use and it disappears from the interface entirely — the app gets smaller, not just tidier.');

    [
      ['graph', 'Knowledge graph', 'The force-directed map of how your notes connect.'],
      ['canvas', 'Canvas', 'Infinite whiteboard with cards, shapes and ink.'],
      ['database', 'Database views', 'Table, board, gallery and calendar over your notes.'],
      ['tasks', 'Tasks', 'Every checkbox in your vault, gathered in one list.'],
      ['matrix', 'Priority matrix', 'The Eisenhower grid for deciding what matters.'],
      ['sticky', 'Sticky wall', 'Colour-coded stickies with text, lists or sketches.'],
      ['scratch', 'Scratchpad', 'Quick capture for half-formed thoughts.'],
      ['review', 'Daily review', 'Streaks, pending work and the activity heat-map.'],
    ].forEach(function (item) {
      wrap.appendChild(row(item[1], item[2], toggle('visibleViews.' + item[0], function () {
        N.app.rebuildNav();
      })));
    });

    const sub = section('Sidebar tabs', 'Which tabs appear in the left panel.');
    [
      ['files', 'Files'],
      ['tags', 'Tags'],
      ['recent', 'Recent'],
      ['canvases', 'Boards'],
    ].forEach(function (item) {
      sub.appendChild(row(item[1], null, toggle('visibleSidebarTabs.' + item[0], function () { N.sidebar.render(); })));
    });
    wrap.appendChild(sub);

    return wrap;
  }

  /* ---------------------------------------------------------- shortcuts */

  function renderShortcuts() {
    const wrap = section('Shortcuts',
      'Every command in Nodalis has a keyboard shortcut, and every one can be changed. Click a shortcut to record a new one; press Backspace while recording to unbind it.');

    const search = el('input.field', { type: 'search', placeholder: 'Filter commands…', style: { marginBottom: '16px' } });
    wrap.appendChild(search);

    const tableWrap = el('div');
    wrap.appendChild(tableWrap);

    const buildTable = function (filter) {
      U.clear(tableWrap);
      const table = el('table.keymap-table');
      const tbody = el('tbody');
      const groups = N.commands.groups();
      let shown = 0;

      Array.from(groups.keys()).sort().forEach(function (group) {
        const commands = groups.get(group).filter(function (c) {
          if (!filter) return true;
          const accel = N.shortcuts.accelFor(c.id) || '';
          return (c.title + ' ' + group + ' ' + c.keywords + ' ' + N.shortcuts.format(accel)).toLowerCase().indexOf(filter.toLowerCase()) !== -1;
        });
        if (!commands.length) return;

        const gr = el('tr');
        gr.appendChild(el('td.keymap-group', { colspan: '3' }, group));
        tbody.appendChild(gr);

        commands.forEach(function (cmd) {
          shown++;
          const tr = el('tr');
          tr.appendChild(el('td.keymap-cmd', null, cmd.title));

          const accel = N.shortcuts.accelFor(cmd.id);
          const keyCell = el('td.keymap-keys');
          const keyBtn = el('button.kbd', { type: 'button', style: { cursor: 'pointer' }, title: 'Click to change' },
            accel ? N.shortcuts.format(accel) : '—');
          keyBtn.addEventListener('click', function () { recordFor(cmd, keyBtn); });
          keyCell.appendChild(keyBtn);
          tr.appendChild(keyCell);

          const actions = el('td', { style: { width: '36px', textAlign: 'right' } });
          const isCustom = Object.prototype.hasOwnProperty.call(s().keymap || {}, cmd.id);
          if (isCustom) {
            const reset = el('button.icon-btn.icon-btn-sm', { type: 'button', title: 'Reset to default' });
            reset.appendChild(N.icons.node('refresh', { size: 13 }));
            reset.addEventListener('click', async function () {
              await N.shortcuts.resetBinding(cmd.id);
              buildTable(search.value);
            });
            actions.appendChild(reset);
          }
          tr.appendChild(actions);
          tbody.appendChild(tr);
        });
      });

      if (!shown) {
        tbody.appendChild(el('tr', null, el('td', { colspan: '3', style: { padding: '24px', textAlign: 'center', color: 'var(--text-3)' } },
          'No commands match "' + filter + '".')));
      }
      table.appendChild(tbody);
      tableWrap.appendChild(table);
    };

    search.addEventListener('input', U.debounce(function () { buildTable(search.value.trim()); }, 140));
    buildTable('');

    const footer = el('div.row', { style: { gap: '10px', marginTop: '20px', flexWrap: 'wrap' } });
    footer.appendChild(el('button.btn.btn-sm', {
      type: 'button',
      onclick: async function () {
        const ok = await N.modal.confirm({ title: 'Reset all shortcuts?', message: 'Every custom binding goes back to its default.', confirmLabel: 'Reset all' });
        if (!ok) return;
        await N.shortcuts.resetAll();
        render();
      },
    }, 'Reset all to defaults'));
    footer.appendChild(el('button.btn.btn-sm', {
      type: 'button',
      onclick: function () {
        const lines = N.commands.all()
          .filter(function (c) { return N.shortcuts.accelFor(c.id); })
          .sort(function (a, b) { return a.group.localeCompare(b.group) || a.title.localeCompare(b.title); })
          .map(function (c) { return '| ' + c.group + ' | ' + c.title + ' | `' + N.shortcuts.format(N.shortcuts.accelFor(c.id)) + '` |'; });
        U.copyToClipboard('| Group | Command | Shortcut |\n| --- | --- | --- |\n' + lines.join('\n'));
        N.toast.success('Shortcut table copied as markdown', { ms: 2400 });
      },
    }, 'Copy as a markdown table'));
    wrap.appendChild(footer);

    return wrap;
  }

  function recordFor(cmd, button) {
    const original = button.textContent;
    button.textContent = 'press keys…';
    button.classList.add('keymap-record');
    N.shortcuts.capture(async function (accel) {
      button.classList.remove('keymap-record');
      if (accel === null) { button.textContent = original; return; }
      if (accel === '') {
        await N.shortcuts.rebind(cmd.id, '');
        button.textContent = '—';
        N.toast.info('"' + cmd.title + '" now has no shortcut.', { ms: 2400 });
        return;
      }
      const conflict = N.shortcuts.conflictFor(accel, cmd.id);
      if (conflict) {
        const other = N.commands.get(conflict);
        const ok = await N.modal.confirm({
          title: 'That shortcut is taken',
          message: N.shortcuts.format(accel) + ' is currently "' + (other ? other.title : conflict) + '".',
          detail: 'Assigning it here will leave that command without a shortcut.',
          confirmLabel: 'Reassign it',
        });
        if (!ok) { button.textContent = original; return; }
        await N.shortcuts.rebind(conflict, '');
      }
      await N.shortcuts.rebind(cmd.id, accel);
      button.textContent = N.shortcuts.format(accel);
      N.toast.success('"' + cmd.title + '" is now ' + N.shortcuts.format(accel), { ms: 2400 });
      render();
    });
  }

  /* -------------------------------------------------------------- daily */

  function renderDaily() {
    const wrap = section('Daily notes', 'One note per day, created automatically the first time you open it.');

    const folderInput = el('input.field', { type: 'text', value: s().dailyNoteFolder || 'Daily', placeholder: 'Daily' });
    folderInput.addEventListener('change', function () { set('dailyNoteFolder', folderInput.value.trim() || 'Daily'); });
    wrap.appendChild(row('Folder', 'Where daily notes are created.', folderInput));

    wrap.appendChild(row('Week starts on', 'Affects the calendar view and the heat-map.',
      select('weekStartsOn', [{ value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }])));

    const template = el('textarea.field', {
      placeholder: 'Leave blank to use the built-in template.',
      style: { minHeight: '190px', fontFamily: 'var(--font-code)', fontSize: '13px' },
    });
    template.value = s().dailyNoteTemplate || '';
    template.addEventListener('change', function () { set('dailyNoteTemplate', template.value); });
    const tplRow = el('div.settings-section');
    tplRow.appendChild(el('div.setting-name', { style: { marginBottom: '6px' } }, 'Template'));
    tplRow.appendChild(el('div.setting-desc', { style: { marginBottom: '10px' } },
      'Placeholders: {{date}} for 2026-08-14, {{date:pretty}} for the long form, {{time}} for the current time.'));
    tplRow.appendChild(template);
    wrap.appendChild(tplRow);

    const streakInfo = N.daily.streak();
    const panel = el('div.panel', { style: { marginTop: '22px' } });
    panel.appendChild(el('div.panel-head', null, [N.icons.node('flame', { size: 16 }), el('div.panel-title', null, 'Your streak')]));
    const pb = el('div.panel-body');
    pb.appendChild(el('p', { style: { lineHeight: '1.6' } },
      streakInfo.current
        ? 'You have written on ' + U.pluralize(streakInfo.current, 'consecutive day') + '. Your longest run so far is ' + U.pluralize(streakInfo.best, 'day') + '.'
        : 'No active streak. Write anything today and it starts at one.'));
    pb.appendChild(el('p.small.muted', { style: { marginTop: '8px', lineHeight: '1.55' } },
      'A streak counts any day you created or edited a note. It survives one missed day being counted from yesterday, and then resets honestly.'));
    panel.appendChild(pb);
    wrap.appendChild(panel);

    return wrap;
  }

  /* --------------------------------------------------------------- data */

  function renderData() {
    const wrap = section('Backup and data', 'Your notes belong to you. Take them anywhere, any time.');

    wrap.appendChild(row('Export everything',
      'A .zip with every note as a plain .md file, plus canvases, stickies, tasks and attachments.',
      el('button.btn.btn-primary', { type: 'button', onclick: function () { N.commands.run('export.vault'); } }, 'Export vault')));

    const importBtn = el('button.btn', { type: 'button' }, 'Import a backup');
    importBtn.addEventListener('click', importFlow);
    wrap.appendChild(row('Import a backup',
      'Reads a Nodalis .zip, or any folder of markdown files zipped up.',
      importBtn));

    wrap.appendChild(row('Import a single file',
      'Add one .md or .txt file as a new note.',
      el('button.btn', { type: 'button', onclick: importSingleFile }, 'Choose a file')));

    const stats = el('div.stat-grid', { style: { marginTop: '24px' } });
    [
      [String(N.store.state.notes.size), 'Notes'],
      [String(N.store.state.folders.size), 'Folders'],
      [String(N.store.state.canvases.size), 'Canvases'],
      [String(N.store.state.stickies.size), 'Stickies'],
      [String(N.store.allTags().length), 'Tags'],
      [String(totalWords()), 'Words'],
    ].forEach(function (pair) {
      const tile = el('div.stat');
      tile.appendChild(el('div.stat-value', null, pair[0]));
      tile.appendChild(el('div.stat-label', null, pair[1]));
      stats.appendChild(tile);
    });
    wrap.appendChild(stats);

    const danger = section('Danger zone', 'These cannot be undone.');
    const resetSettings = el('button.btn.btn-danger', { type: 'button' }, 'Reset all settings');
    resetSettings.addEventListener('click', async function () {
      const ok = await N.modal.confirm({
        title: 'Reset every setting?',
        message: 'Theme, fonts, shortcuts and preferences go back to defaults. Your notes are not touched.',
        confirmLabel: 'Reset settings', danger: true,
      });
      if (!ok) return;
      N.store.state.settings = U.deepClone(N.store.DEFAULT_SETTINGS);
      await N.store.saveSettings();
      N.theme.apply();
      N.shortcuts.rebuild();
      render();
      N.toast.success('Settings reset', { ms: 2000 });
    });
    danger.appendChild(row('Reset settings', 'Notes, canvases and stickies are kept.', resetSettings));

    const wipe = el('button.btn.btn-danger-solid', { type: 'button' }, 'Delete everything');
    wipe.addEventListener('click', async function () {
      const ok = await N.modal.confirm({
        title: 'Delete every note in Nodalis?',
        message: N.vault.isFolderMode()
          ? 'This clears the app. Files already written to "' + N.vault.state.name + '" stay on your disk.'
          : 'This permanently erases every note, canvas and sticky on this device. There is no undo.',
        detail: 'Export a backup first if there is any doubt.',
        confirmLabel: 'Delete everything', danger: true,
      });
      if (!ok) return;
      const typed = await N.modal.prompt({
        title: 'Type DELETE to confirm', placeholder: 'DELETE',
        validate: function (v) { return v.trim() === 'DELETE' ? null : 'Type DELETE exactly.'; },
      });
      if (typed === null) return;
      await N.db.destroy();
      location.reload();
    });
    danger.appendChild(row('Delete all data', 'Wipes this device clean and restarts the app.', wipe));
    wrap.appendChild(danger);

    return wrap;
  }

  function totalWords() {
    let total = 0;
    N.store.state.notes.forEach(function (n) { total += n.words || 0; });
    return total;
  }

  function importFlow() {
    const input = el('input', { type: 'file', accept: '.zip,application/zip', style: { display: 'none' } });
    input.addEventListener('change', async function () {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      const mode = await N.modal.choose({
        title: 'How should this be imported?',
        message: file.name,
        options: [
          { value: 'merge', label: 'Merge into what I have', description: 'Existing notes with the same path are updated', icon: 'repeat' },
          { value: 'replace', label: 'Replace everything', description: 'Deletes current notes first', icon: 'warning', danger: true },
        ],
      });
      if (!mode) return;
      const closing = N.toast.info('Importing…', { ms: 0, key: 'import' });
      try {
        const result = await N.exporter.importVaultZip(file, mode);
        closing();
        if (!result) return;
        N.toast.success(result.created + ' created, ' + result.updated + ' updated' +
          (result.skipped ? ', ' + result.skipped + ' skipped' : ''), { title: 'Import complete', ms: 5000 });
        render();
      } catch (err) {
        closing();
        N.toast.error(U.describeError(err), { title: 'Import failed' });
      }
    });
    document.body.appendChild(input);
    input.click();
  }

  function importSingleFile() {
    const input = el('input', { type: 'file', accept: '.md,.txt,.markdown,text/*', style: { display: 'none' } });
    input.addEventListener('change', async function () {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      try {
        const text = await file.text();
        const title = file.name.replace(/\.(md|txt|markdown)$/i, '');
        const note = await N.store.createNote({ title: title, content: text });
        N.app.openNote(note.id);
        N.toast.success('Imported "' + N.store.noteTitle(note) + '"', { ms: 2400 });
      } catch (err) {
        N.toast.error(U.describeError(err), { title: 'Could not read that file' });
      }
    });
    document.body.appendChild(input);
    input.click();
  }

  /* -------------------------------------------------------------- about */

  function renderAbout() {
    const wrap = section('About Nodalis', null);

    const card = el('div.panel');
    const pb = el('div.panel-body');
    pb.appendChild(el('p', { style: { lineHeight: '1.65' } },
      'Nodalis is a local-first knowledge base: notes, tasks, an infinite canvas, and a graph of how everything connects. ' +
      'It runs entirely in your browser, works offline, and stores your notes as plain markdown files on your own disk.'));
    pb.appendChild(el('p', { style: { lineHeight: '1.65', marginTop: '12px' } },
      'It is free, and it stays free. There is no account, no server, no telemetry and nothing to subscribe to — ' +
      'because there is nothing running anywhere except on your machine. Nobody can take it away or start charging for it.'));

    const facts = el('div', { style: { marginTop: '16px' } });
    [
      ['Version', '2.0'],
      ['Storage', N.vault.isFolderMode() ? 'Folder: ' + N.vault.state.name : 'This device only'],
      ['Notes', String(N.store.state.notes.size)],
      ['Commands', String(N.commands.all().length)],
      ['Offline', navigator.onLine === false ? 'You are offline right now — everything still works' : 'Ready'],
    ].forEach(function (pair) {
      const r = el('div.row', { style: { justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' } });
      r.appendChild(el('span.muted', null, pair[0]));
      r.appendChild(el('span', null, pair[1]));
      facts.appendChild(r);
    });
    pb.appendChild(facts);

    const actions = el('div.row', { style: { gap: '10px', marginTop: '18px', flexWrap: 'wrap' } });
    actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { N.help.openTour(); } }, 'Replay the tour'));
    actions.appendChild(el('button.btn', { type: 'button', onclick: function () { N.help.open(); } }, 'Open the manual'));
    actions.appendChild(el('button.btn', { type: 'button', onclick: function () { N.exporter.shareApp(); } }, 'Share Nodalis'));
    pb.appendChild(actions);

    card.appendChild(pb);
    wrap.appendChild(card);

    const credits = el('div.panel', { style: { marginTop: '18px' } });
    credits.appendChild(el('div.panel-head', null, [N.icons.node('heart', { size: 16 }), el('div.panel-title', null, 'Built with')]));
    const cb = el('div.panel-body');
    cb.appendChild(el('p.small.muted', { style: { lineHeight: '1.6' } },
      'No framework. The fonts are Inter, Space Grotesk, Space Mono and Doto, all under the SIL Open Font License. ' +
      'Zip handling uses JSZip (MIT). Optional text recognition uses Tesseract.js (Apache 2.0), downloaded only if you use the scan feature.'));
    credits.appendChild(cb);
    wrap.appendChild(credits);

    return wrap;
  }

  function open(sectionId) {
    if (sectionId) activeSection = sectionId;
    N.app.setView('settings');
    render();
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'settings.open', title: 'Open settings', group: 'App', icon: 'settings', accel: 'Mod+,',
        run: function () { open(); } },
      { id: 'settings.storage', title: 'Settings: storage and backup', group: 'App', icon: 'save',
        run: function () { open('storage'); } },
      { id: 'settings.appearance', title: 'Settings: appearance', group: 'App', icon: 'palette',
        run: function () { open('appearance'); } },
      { id: 'settings.shortcuts', title: 'Settings: keyboard shortcuts', group: 'App', icon: 'keyboard',
        run: function () { open('shortcuts'); } },
      { id: 'settings.features', title: 'Settings: turn features on or off', group: 'App', icon: 'layers',
        run: function () { open('features'); } },
      { id: 'vault.connect', title: 'Connect a folder on disk', group: 'App', icon: 'folder-open',
        when: function () { return U.supports.fileSystemAccess; },
        run: changeFolder },
      { id: 'vault.sync', title: 'Sync to disk now', group: 'App', icon: 'refresh',
        when: function () { return N.vault.isFolderMode(); },
        run: syncNow },
    ]);
  }

  N.settings = { init: init, render: render, open: open };
})(window.NODALIS = window.NODALIS || {});
