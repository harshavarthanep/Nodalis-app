/* =========================================================================
 * Nodalis — app.js
 * Boot sequence, view routing, layout state, global commands and the
 * top-level error net. Everything below is defensive on purpose: a single
 * failing module must never take the whole app down with it.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;
  const bus = N.bus;

  const VIEWS = ['editor', 'graph', 'canvas', 'database', 'tasks', 'matrix', 'sticky', 'scratch', 'review', 'search', 'settings'];
  let booted = false;
  let deferredInstallPrompt = null;

  /* ------------------------------------------------------------------ boot */

  /* ------------------------------------------------------------ resilience */

  const BOOT_BUDGET_MS = 20000;   // hard ceiling for the whole sequence
  let bootWatchdog = null;
  let bootStage = 'starting';
  let bootDegradations = [];

  // Resolves if the user asks to skip the intro. Every boot wait races it, so
  // "Skip" genuinely means "get me in now" rather than "hide the animation and
  // leave me looking at a shell that does nothing".
  let releaseSkip = function () {};
  const skipRequested = new Promise(function (resolve) { releaseSkip = resolve; });
  let userSkipped = false;
  let skipGraceUsed = false;
  bus.on('loader:skip', function () { userSkipped = true; releaseSkip({ __skipped: true }); });

  /**
   * Await a promise, but give up after `ms`.
   *
   * Every await in boot goes through this. A browser that stalls on storage —
   * WebKit dropping an IndexedDB request, a blocked upgrade in another tab,
   * a permission prompt nobody answers — must degrade the app, never freeze it.
   */
  function withTimeout(promise, ms, label) {
    let timer = null;
    const timeout = new Promise(function (resolve) {
      timer = setTimeout(function () {
        console.warn('[nodalis] "' + label + '" timed out after ' + ms + 'ms — continuing without it');
        bootDegradations.push(label);
        resolve({ __timedOut: true });
      }, ms);
    });
    return Promise.race([
      Promise.resolve(promise).then(
        function (v) { clearTimeout(timer); return v; },
        function (err) {
          clearTimeout(timer);
          console.warn('[nodalis] "' + label + '" failed — continuing without it', err);
          bootDegradations.push(label);
          return { __failed: true, error: err };
        }
      ),
      timeout,
      // After Skip, give the stage in flight a short grace period to finish on
      // its own — but only once. Every later stage bails immediately, so Skip
      // means "in now" rather than "in, one grace period per remaining step".
      skipRequested.then(function () {
        const grace = skipGraceUsed ? 0 : 1200;
        skipGraceUsed = true;
        return new Promise(function (resolve) {
          setTimeout(function () {
            clearTimeout(timer);
            bootDegradations.push(label);
            resolve({ __skipped: true });
          }, grace);
        });
      }),
    ]);
  }

  function stage(name, ratio, step, progress) {
    bootStage = name;
    progress(ratio, step);
  }

  async function boot() {
    if (booted) return;
    booted = true;

    installErrorNet();

    const wantsLoader = readLoaderPreference();
    if (wantsLoader) N.loader.start();
    const progress = function (ratio, step) { if (wantsLoader) N.loader.progress(ratio, step); };

    // These must be listening before the database is touched, because a
    // failure to open it is reported during that very call.
    bus.on('db:quota-exceeded', onQuotaExceeded);
    bus.on('db:degraded', onDbDegraded);
    bus.on('db:blocked', onDbBlocked);

    // Last line of defence. If anything below wedges despite the per-stage
    // timeouts, tear the loader down and hand the user a working shell with an
    // explanation rather than an animation that never ends.
    bootWatchdog = setTimeout(function () {
      console.error('[nodalis] boot exceeded its budget at stage "' + bootStage + '"');
      forceUsableShell('Startup took longer than expected and was cut short at "' + bootStage + '".');
    }, BOOT_BUDGET_MS);

    try {
      stage('preparing', 0.08, 0, progress);
      N.icons.hydrate(document);

      stage('opening local database', 0.18, 1, progress);
      await withTimeout(N.db.open(), 9000, 'opening local database');

      stage('reading your vault', 0.34, 2, progress);
      await withTimeout(N.store.loadAll(), 9000, 'reading your vault');

      stage('applying theme', 0.5, 2, progress);
      try { N.theme.init(); } catch (err) { console.error('[nodalis] theme failed', err); }

      stage('reconnecting your folder', 0.58, 3, progress);
      await withTimeout(restoreVault(), 8000, 'reconnecting your folder');

      stage('starting features', 0.7, 3, progress);
      initModules();

      stage('building the interface', 0.86, 3, progress);
      wireShell();
      if (N.db.isDegraded()) onDbDegraded(N.db.degradedReason());
      N.shortcuts.init();
      N.menu.initTooltips();
      registerGlobalCommands();
      rebuildNav();
      updateVaultStatus();
      applyInitialView();

      stage('ready', 0.96, 4, progress);
      clearTimeout(bootWatchdog);
      bootWatchdog = null;
      await N.loader.finish();

      afterBoot();
      reportDegradations();
    } catch (err) {
      clearTimeout(bootWatchdog);
      bootWatchdog = null;
      console.error('[nodalis] boot failed at stage "' + bootStage + '"', err);
      await N.loader.finish(true);
      // Even a hard failure should leave something usable if the shell exists.
      if (!forceUsableShell(U.describeError(err))) showFatal(err);
    }
  }

  /**
   * Bring the app up as far as it will go after a stalled or failed start.
   * Returns true if the user is left with a working interface.
   */
  let forced = false;
  function forceUsableShell(reason) {
    if (forced) return true;
    forced = true;
    clearTimeout(bootWatchdog);
    bootWatchdog = null;

    try { N.loader.finish(true); } catch (err) { /* loader may not exist */ }

    let usable = false;
    try {
      if (!N.store.state.loaded) {
        // Nothing was read from storage. Run entirely from memory so the user
        // can at least write, and make the risk unmistakable.
        N.store.state.loaded = true;
        bus.emit('vault:loaded', { notes: N.store.state.notes.size });
      }
      try { N.theme.init(); } catch (err) { /* colours already have CSS defaults */ }
      initModules();
      wireShell();
      N.shortcuts.init();
      N.menu.initTooltips();
      registerGlobalCommands();
      rebuildNav();
      updateVaultStatus();
      applyInitialView();
      if (!N.store.state.notes.size) N.store.seedWelcomeVault().then(function () { N.sidebar.render(); openFirstNote(); });
      else openFirstNote();
      usable = true;
    } catch (err) {
      console.error('[nodalis] could not force a usable shell', err);
    }

    if (usable) {
      showRecoveryBanner(reason);
    } else {
      showFatal(new Error(reason));
    }
    return usable;
  }

  /** A persistent, actionable explanation — not a toast that fades away. */
  function showRecoveryBanner(reason) {
    if (document.getElementById('recovery-banner')) return;

    const bar = el('div#recovery-banner', {
      style: {
        position: 'fixed', left: '0', right: '0', bottom: '0',
        zIndex: 'var(--z-toast)',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '12px 16px calc(12px + var(--safe-bottom))',
        background: 'var(--bg-0)', borderTop: '2px solid #f59e0b',
        boxShadow: 'var(--shadow-lg)', fontSize: 'var(--text-base)',
      },
      role: 'alert',
    });
    bar.appendChild(N.icons.node('warning', { size: 20 }));

    const main = el('div', { style: { flex: '1 1 320px', minWidth: '0', lineHeight: '1.5' } });
    main.appendChild(el('div', { style: { fontWeight: '600' } }, 'Nodalis started in safe mode'));
    main.appendChild(el('div.muted', null,
      reason + ' You can write normally, but nothing is being saved to this device — export before you close the tab.'));
    bar.appendChild(main);

    const actions = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
    actions.appendChild(el('button.btn.btn-sm.btn-primary', {
      type: 'button',
      onclick: async function () {
        const closing = N.toast.info('Trying local storage again…', { ms: 0, key: 'retry-db' });
        const ok = await N.db.retryOpen();
        closing();
        if (ok) {
          N.toast.success('Local storage is working again. Reloading to pick everything up.', { ms: 3000 });
          setTimeout(function () { location.reload(); }, 900);
        } else {
          N.toast.error('Still cannot reach local storage. Export your work to keep it.', { ms: 8000 });
        }
      },
    }, 'Try storage again'));
    actions.appendChild(el('button.btn.btn-sm', {
      type: 'button', onclick: function () { N.commands.run('export.vault'); },
    }, 'Export now'));
    if (U.supports.fileSystemAccess) {
      actions.appendChild(el('button.btn.btn-sm', {
        type: 'button', onclick: function () { N.commands.run('vault.connect'); },
      }, 'Save to a folder'));
    }
    actions.appendChild(el('button.btn.btn-sm', {
      type: 'button', onclick: function () { location.reload(); },
    }, 'Reload'));
    const dismiss = el('button.icon-btn.icon-btn-sm', {
      type: 'button', title: 'Dismiss', onclick: function () { bar.remove(); },
    });
    dismiss.appendChild(N.icons.node('close', { size: 15 }));
    actions.appendChild(dismiss);
    bar.appendChild(actions);

    document.body.appendChild(bar);
  }

  /** Softer notice for stages that timed out but left the app fully working. */
  function reportDegradations() {
    if (!bootDegradations.length) return;
    const list = Array.from(new Set(bootDegradations)).join(', ');
    if (userSkipped) {
      N.toast.info('Started early because you skipped ahead. Reload if anything looks incomplete.', { ms: 6000 });
      return;
    }
    if (N.db.isDegraded()) return;   // already reported, more seriously
    N.toast.warn('Some startup steps were slow and were skipped: ' + list + '. Everything else is working.', {
      title: 'Slow start', ms: 9000,
    });
  }

  function onDbBlocked() {
    N.toast.warn('Another Nodalis tab is holding local storage open. Close the other tabs, then reload.', {
      title: 'Storage is busy', ms: 0, key: 'db-blocked',
      action: { label: 'Reload', onClick: function () { location.reload(); } },
    });
  }

  /** Read the loader preference straight from IndexedDB is too slow; use a hint. */
  function readLoaderPreference() {
    try {
      const hint = localStorage.getItem('nodalis-loader');
      return hint !== '0';
    } catch (err) {
      return true;   // private mode without localStorage — show it, it is harmless
    }
  }

  function persistLoaderHint() {
    try { localStorage.setItem('nodalis-loader', N.store.state.settings.showLoaderOnStart === false ? '0' : '1'); }
    catch (err) { /* nothing depends on this succeeding */ }
  }

  async function restoreVault() {
    try {
      const result = await N.vault.restore();
      if (result.restored) {
        // Disk is the source of truth: read it back before the user types.
        try { await N.vault.pullAll(); }
        catch (err) { console.warn('[nodalis] initial pull failed', err); }
      }
    } catch (err) {
      console.warn('[nodalis] vault restore failed', err);
    }
  }

  function initModules() {
    const modules = [
      ['editor', N.editor], ['sidebar', N.sidebar], ['panels', N.panels], ['search', N.search],
      ['graph', N.graph], ['canvas', N.canvas], ['database', N.database], ['tasks', N.tasks],
      ['matrix', N.matrix], ['sticky', N.sticky], ['scratch', N.scratch], ['daily', N.daily],
      ['ocr', N.ocr], ['exporter', N.exporter], ['settings', N.settings], ['help', N.help],
    ];
    modules.forEach(function (entry) {
      const name = entry[0], mod = entry[1];
      if (!mod || typeof mod.init !== 'function') {
        console.warn('[nodalis] module "' + name + '" is missing');
        return;
      }
      try { mod.init(); }
      catch (err) {
        console.error('[nodalis] module "' + name + '" failed to start', err);
        N.toast.error('The ' + name + ' feature could not start. The rest of the app is fine.', { ms: 8000 });
      }
    });
  }

  async function afterBoot() {
    persistLoaderHint();
    registerServiceWorker();
    watchInstallPrompt();
    watchConnectivity();
    watchVisibility();
    watchUnload();

    if (await N.onboarding.shouldRun()) {
      await N.onboarding.run();
      N.sidebar.render();
      openFirstNote();
    } else {
      openFirstNote();
      setTimeout(function () { N.onboarding.maybeRemindBackup(); }, 4000);
    }

    N.daily.recordActivity();
    bus.emit('app:ready');
  }

  function openFirstNote() {
    if (N.store.state.activeNoteId) return;
    const recent = N.store.state.recentNoteIds.map(N.store.getNote).filter(Boolean)[0];
    const pinned = N.store.allNotes().filter(function (n) { return n.pinned; })[0];
    const newest = N.store.allNotes().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0];
    const target = recent || pinned || newest;
    if (target) openNote(target.id);
  }

  /* --------------------------------------------------------------- shell */

  function wireShell() {
    const app = document.getElementById('app');

    /* sidebar */
    document.getElementById('btn-sidebar').addEventListener('click', toggleSidebar);
    document.getElementById('scrim').addEventListener('click', function () {
      if (window.innerWidth <= 900) {
        app.dataset.sidebar = 'closed';
        app.dataset.right = 'closed';
        updateScrim();
      }
    });

    /* right panel */
    const rightBtn = document.getElementById('btn-right-panel');
    if (rightBtn) rightBtn.addEventListener('click', toggleRightPanel);

    /* view tabs */
    const tabs = document.getElementById('view-tabs');
    if (tabs) U.delegate(tabs, 'click', 'button', function (e, btn) { setView(btn.dataset.view); });

    /* mobile nav */
    const nav = document.getElementById('mobile-nav');
    if (nav) U.delegate(nav, 'click', '.mobile-nav-btn', function (e, btn) {
      if (btn.dataset.view) { setView(btn.dataset.view); return; }
      const action = btn.dataset.action;
      if (action === 'search') N.palette.open('all');
      else if (action === 'capture') N.scratch.openQuickCapture();
      else if (action === 'more') openMoreSheet();
    });

    /* topbar buttons */
    document.getElementById('btn-search').addEventListener('click', function () { N.palette.open('all'); });
    document.getElementById('btn-theme').addEventListener('click', function () { N.theme.toggleMode(); updateThemeIcon(); });
    document.getElementById('btn-settings').addEventListener('click', function () { N.settings.open(); });
    document.getElementById('btn-capture').addEventListener('click', function () { N.scratch.openQuickCapture(); });
    const moreBtn = document.getElementById('btn-more');
    if (moreBtn) moreBtn.addEventListener('click', openMoreSheet);

    /* vault status */
    document.getElementById('vault-status').addEventListener('click', function () { N.settings.open('storage'); });

    /* buttons wired by data-command */
    U.delegate(document, 'click', '[data-command]', function (e, node) {
      e.preventDefault();
      N.commands.run(node.dataset.command, { source: 'ui' });
    });

    /* ripples */
    document.addEventListener('pointerdown', function (e) {
      const btn = e.target.closest ? e.target.closest('.btn') : null;
      if (!btn || N.store.state.settings.animations === 'none') return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--ripple-x', (e.clientX - r.left) + 'px');
      btn.style.setProperty('--ripple-y', (e.clientY - r.top) + 'px');
      btn.classList.remove('is-rippling');
      void btn.offsetWidth;
      btn.classList.add('is-rippling');
      setTimeout(function () { btn.classList.remove('is-rippling'); }, 500);
    });

    /* sidebar resizing */
    installSidebarResizer();

    /* responsive defaults */
    applyResponsiveDefaults();
    window.addEventListener('resize', U.debounce(applyResponsiveDefaults, 200));

    /* status + theme reactions */
    bus.on('vault:status', updateVaultStatus);
    bus.on('vault:connected', updateVaultStatus);
    bus.on('vault:disconnected', updateVaultStatus);
    bus.on('theme:applied', updateThemeIcon);
    bus.on('settings:changed', function () { rebuildNav(); persistLoaderHint(); });
    bus.on('db:versionchange', function () {
      N.toast.warn('Nodalis was updated in another tab. Reload to continue safely.', {
        ms: 0, title: 'Reload needed',
        action: { label: 'Reload', onClick: function () { location.reload(); } },
      });
    });

    updateThemeIcon();
    updateSearchKbd();
  }

  function installSidebarResizer() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const grip = el('div.sidebar-resizer', { title: 'Drag to resize' });
    sidebar.appendChild(grip);

    let start = null;
    grip.addEventListener('pointerdown', function (e) {
      if (window.innerWidth <= 900) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      grip.classList.add('is-dragging');
      start = { x: e.clientX, width: sidebar.getBoundingClientRect().width };
      document.body.style.userSelect = 'none';
    });
    grip.addEventListener('pointermove', function (e) {
      if (!start) return;
      const next = U.clamp(start.width + (e.clientX - start.x), 190, 460);
      document.documentElement.style.setProperty('--sidebar-w', next + 'px');
    });
    grip.addEventListener('pointerup', function (e) {
      if (!start) return;
      start = null;
      grip.classList.remove('is-dragging');
      document.body.style.userSelect = '';
      try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
      const width = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
      if (width) N.db.setMeta('sidebar-width', width);
    });

    N.db.getMeta('sidebar-width', null).then(function (width) {
      if (width) document.documentElement.style.setProperty('--sidebar-w', width + 'px');
    });
  }

  function applyResponsiveDefaults() {
    const app = document.getElementById('app');
    const narrow = window.innerWidth <= 900;
    if (narrow) {
      if (!app.dataset.sidebarUserSet) app.dataset.sidebar = 'closed';
      app.dataset.right = app.dataset.right === 'open' ? 'open' : 'closed';
    } else {
      if (!app.dataset.sidebarUserSet) app.dataset.sidebar = 'open';
    }
    updateScrim();
    if (N.store.state.activeView === 'graph') N.graph.resize();
  }

  function toggleSidebar() {
    const app = document.getElementById('app');
    app.dataset.sidebar = app.dataset.sidebar === 'open' ? 'closed' : 'open';
    app.dataset.sidebarUserSet = '1';
    updateScrim();
  }

  function toggleRightPanel() {
    const app = document.getElementById('app');
    app.dataset.right = app.dataset.right === 'open' ? 'closed' : 'open';
    updateScrim();
  }

  function updateScrim() {
    const app = document.getElementById('app');
    const scrim = document.getElementById('scrim');
    if (!scrim) return;
    const narrow = window.innerWidth <= 900;
    const drawerOpen = narrow && (app.dataset.sidebar === 'open' || app.dataset.right === 'open');
    if (drawerOpen && !N.modal.anyOpen() && !N.palette.isOpen()) scrim.classList.add('is-open');
    else if (!N.modal.anyOpen() && !N.palette.isOpen()) scrim.classList.remove('is-open');
  }

  function updateThemeIcon() {
    const btn = document.getElementById('btn-theme');
    if (!btn) return;
    const mode = document.body.dataset.mode;
    btn.innerHTML = '';
    btn.appendChild(N.icons.node(mode === 'dark' ? 'moon' : 'sun', { size: 18 }));
    const setting = N.store.state.settings.themeMode;
    btn.title = setting.startsWith('auto')
      ? 'Following ' + (setting === 'auto-time' ? 'the clock' : 'your system') + ' (' + mode + ')'
      : 'Switch light / dark';
  }

  function updateSearchKbd() {
    const kbd = document.getElementById('search-kbd');
    if (kbd) kbd.textContent = N.shortcuts.format('Mod+K');
  }

  function updateVaultStatus() {
    const node = document.getElementById('vault-status');
    if (!node) return;
    const info = N.vault.describe();
    const state = N.vault.state;
    const label = node.querySelector('.vault-status-label');

    node.classList.remove('is-ok', 'is-syncing', 'is-warn', 'is-error');
    if (state.status === 'syncing') { node.classList.add('is-syncing'); label.textContent = 'Saving to disk…'; }
    else if (state.status === 'error') { node.classList.add('is-error'); label.textContent = 'Write failed — open storage'; }
    else if (state.status === 'permission') { node.classList.add('is-warn'); label.textContent = 'Reconnect "' + state.name + '"'; }
    else if (info.safe) { node.classList.add('is-ok'); label.textContent = 'Saved to ' + state.name; }
    else { node.classList.add('is-warn'); label.textContent = 'This device only'; }
    node.title = info.reason || 'Your notes are written to ' + state.name;
  }

  /* --------------------------------------------------------------- views */

  function setView(view) {
    if (VIEWS.indexOf(view) === -1) return;
    const visible = N.store.state.settings.visibleViews || {};
    if (visible[view] === false && view !== 'editor' && view !== 'settings' && view !== 'search') {
      N.toast.info('That view is switched off in Settings → Features.', { ms: 3000 });
      return;
    }

    const previous = N.store.state.activeView;
    if (previous === view) return;
    N.store.state.activeView = view;

    VIEWS.forEach(function (v) {
      const node = document.getElementById('view-' + v);
      if (node) node.classList.toggle('is-active', v === view);
    });

    const active = document.getElementById('view-' + view);
    if (active && N.store.state.settings.animations !== 'none') {
      active.classList.remove('is-entering');
      void active.offsetWidth;
      active.classList.add('is-entering');
    }

    U.$$('#view-tabs button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === view); });
    U.$$('.mobile-nav-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === view); });

    // Close drawers on a phone so the view is actually visible.
    if (window.innerWidth <= 900) {
      const app = document.getElementById('app');
      app.dataset.sidebar = 'closed';
      app.dataset.right = 'closed';
      updateScrim();
    }

    try { history.replaceState(null, '', '#' + view); } catch (err) { /* file:// blocks this */ }
    bus.emit('view:changed', view);
  }

  function applyInitialView() {
    let target = 'editor';
    try {
      const hash = (location.hash || '').replace('#', '');
      if (VIEWS.indexOf(hash) !== -1) target = hash;
    } catch (err) { /* ignore */ }
    N.store.state.activeView = null;
    setView(target);
  }

  function rebuildNav() {
    const visible = N.store.state.settings.visibleViews || {};
    U.$$('#view-tabs button[data-feature]').forEach(function (btn) {
      btn.style.display = visible[btn.dataset.feature] === false ? 'none' : '';
    });
    U.$$('.mobile-nav-btn[data-view]').forEach(function (btn) {
      const v = btn.dataset.view;
      if (v === 'editor') return;
      btn.style.display = visible[v] === false ? 'none' : '';
    });
  }

  function openNote(id) {
    const note = N.store.getNote(id);
    if (!note) { N.toast.warn('That note no longer exists.'); return; }
    if (N.store.state.activeView !== 'editor') setView('editor');
    N.store.setActiveNote(id);
    N.sidebar.expandTo(note.folder);
  }

  async function createNoteIn(folder) {
    const note = await N.store.createNote({ folder: folder || '' });
    N.sidebar.expandTo(folder);
    openNote(note.id);
    setTimeout(function () {
      const title = document.getElementById('note-title');
      if (title) { title.focus(); title.select(); }
    }, 120);
    return note;
  }

  /* ---------------------------------------------------------- more sheet */

  function openMoreSheet() {
    const visible = N.store.state.settings.visibleViews || {};
    const items = [];
    const addView = function (view, label, icon) {
      if (visible[view] === false) return;
      items.push({ label: label, icon: icon, onClick: function () { setView(view); } });
    };
    addView('graph', 'Knowledge graph', 'graph');
    addView('canvas', 'Canvas', 'canvas');
    addView('database', 'Database', 'database');
    addView('matrix', 'Priority matrix', 'matrix');
    addView('sticky', 'Sticky wall', 'sticky');
    addView('scratch', 'Scratchpad', 'inbox');
    addView('review', 'Daily review', 'flame');
    items.push({ separator: true });
    items.push({ label: "Today's daily note", icon: 'calendar', onClick: function () { N.daily.openToday(); } });
    items.push({ label: 'Scan a page (OCR)', icon: 'scan', onClick: function () { N.ocr.scanToNote(); } });
    items.push({ label: 'Backlinks and outline', icon: 'link', onClick: function () {
      const app = document.getElementById('app');
      app.dataset.right = 'open';
      updateScrim();
    } });
    items.push({ separator: true });
    items.push({ label: 'Settings', icon: 'settings', onClick: function () { N.settings.open(); } });
    items.push({ label: 'Help and tour', icon: 'help', onClick: function () { N.help.open(); } });
    items.push({ label: 'Share Nodalis', icon: 'share', onClick: function () { N.exporter.shareApp(); } });

    N.menu.show(items, { title: 'More', allowSheet: true });
  }

  /* --------------------------------------------------------- global cmds */

  function registerGlobalCommands() {
    N.commands.registerMany([
      { id: 'palette.open', title: 'Command palette', group: 'App', icon: 'command', accel: 'Mod+K', allowInInput: true,
        run: function () { N.palette.open('all'); } },
      { id: 'palette.notes', title: 'Jump to a note', group: 'App', icon: 'search', accel: 'Mod+O', allowInInput: true,
        run: function () { N.palette.open('notes'); } },
      { id: 'palette.commands', title: 'Run a command', group: 'App', icon: 'command', accel: 'Mod+Shift+P', allowInInput: true,
        run: function () { N.palette.open('commands'); } },

      { id: 'note.new', title: 'New note', group: 'Create', icon: 'file-plus', accel: 'Mod+N',
        run: function () { return createNoteIn(N.store.state.settings.defaultNewNoteFolder || ''); } },
      { id: 'folder.new', title: 'New folder', group: 'Create', icon: 'folder-plus',
        run: async function () {
          const name = await N.modal.prompt({ title: 'New folder', placeholder: 'Folder name' });
          if (!name) return;
          const folder = await N.store.createFolder(name, '');
          if (folder) N.sidebar.render();
        } },

      { id: 'note.pin', title: 'Pin or unpin this note', group: 'Note', icon: 'pin',
        when: function () { return !!N.store.state.activeNoteId; },
        run: async function () {
          const pinned = await N.store.togglePin(N.store.state.activeNoteId);
          N.toast.success(pinned ? 'Pinned' : 'Unpinned', { ms: 1400 });
        } },
      { id: 'note.duplicate', title: 'Duplicate this note', group: 'Note', icon: 'duplicate',
        when: function () { return !!N.store.state.activeNoteId; },
        run: async function () {
          const copy = await N.store.duplicateNote(N.store.state.activeNoteId);
          if (copy) openNote(copy.id);
        } },
      { id: 'note.delete', title: 'Delete this note', group: 'Note', icon: 'trash', danger: true,
        when: function () { return !!N.store.state.activeNoteId; },
        run: async function () {
          const note = N.store.getNote(N.store.state.activeNoteId);
          if (!note) return;
          if (N.store.state.settings.confirmDelete !== false) {
            const ok = await N.modal.confirm({
              title: 'Delete "' + N.store.noteTitle(note) + '"?',
              message: N.vault.isFolderMode() ? 'The file will be removed from your folder.' : 'This can be undone straight away.',
              confirmLabel: 'Delete', danger: true,
            });
            if (!ok) return;
          }
          await N.store.deleteNote(note.id);
          N.toast.show('Note deleted', {
            kind: 'info', ms: 7000,
            action: { label: 'Undo', onClick: function () { N.store.undo(); } },
          });
        } },
      { id: 'note.move', title: 'Move this note to a folder', group: 'Note', icon: 'folder',
        when: function () { return !!N.store.state.activeNoteId; },
        run: async function () {
          const note = N.store.getNote(N.store.state.activeNoteId);
          const target = await N.sidebar.pickFolder('Move "' + N.store.noteTitle(note) + '" to…', note.folder);
          if (target === null) return;
          await N.store.moveNote(note.id, target);
          N.toast.success('Moved', { ms: 1600 });
        } },
      { id: 'note.copyLink', title: 'Copy a link to this note', group: 'Note', icon: 'link',
        when: function () { return !!N.store.state.activeNoteId; },
        run: async function () {
          const note = N.store.getNote(N.store.state.activeNoteId);
          const ok = await U.copyToClipboard('[[' + N.store.noteTitle(note) + ']]');
          N.toast[ok ? 'success' : 'error'](ok ? 'Link copied' : 'Could not copy', { ms: 1600 });
        } },
      { id: 'note.copyMarkdown', title: 'Copy this note as markdown', group: 'Note', icon: 'copy',
        when: function () { return !!N.store.state.activeNoteId; },
        run: async function () {
          const note = N.store.getNote(N.store.state.activeNoteId);
          const ok = await U.copyToClipboard(N.exporter.toMarkdown(note));
          N.toast[ok ? 'success' : 'error'](ok ? 'Copied' : 'Could not copy', { ms: 1600 });
        } },
      { id: 'note.popout', title: 'Open this note in a new window', group: 'Note', icon: 'external',
        when: function () { return !!N.store.state.activeNoteId; },
        run: async function () {
          const note = N.store.getNote(N.store.state.activeNoteId);
          const html = N.exporter.toStandaloneHtml(note, { includeMeta: true, followTheme: true });
          const win = window.open('', '_blank', 'width=760,height=900');
          if (!win) { N.toast.warn('Your browser blocked the pop-up.'); return; }
          win.document.write(html);
          win.document.close();
        } },

      { id: 'view.sidebar', title: 'Toggle the sidebar', group: 'View', icon: 'sidebar', accel: 'Mod+B', run: toggleSidebar },
      { id: 'view.rightPanel', title: 'Toggle the right panel', group: 'View', icon: 'sidebar-right', accel: 'Mod+Alt+\\',
        run: toggleRightPanel },
      { id: 'view.editor', title: 'Go to notes', group: 'View', icon: 'note', accel: 'Mod+1', run: function () { setView('editor'); } },
      { id: 'view.focusMode', title: 'Focus mode', group: 'View', icon: 'target', accel: 'Mod+Shift+Z',
        run: function () {
          const app = document.getElementById('app');
          const on = app.dataset.focus === 'on';
          app.dataset.focus = on ? 'off' : 'on';
          N.toast.info(on ? 'Focus mode off' : 'Focus mode on — everything but the page is dimmed', { ms: 2200, key: 'focus' });
        } },

      { id: 'theme.toggle', title: 'Switch light / dark', group: 'Appearance', icon: 'contrast', accel: 'Mod+Shift+L',
        run: function () { N.theme.toggleMode(); } },
      { id: 'theme.cycle', title: 'Cycle through themes', group: 'Appearance', icon: 'palette',
        run: function () { N.theme.cycleStyle(); } },
      { id: 'theme.nodalis', title: 'Theme: Nodalis paper', group: 'Appearance', icon: 'droplet', run: function () { N.theme.setStyle('nodalis'); } },
      { id: 'theme.notion', title: 'Theme: Notion', group: 'Appearance', icon: 'droplet', run: function () { N.theme.setStyle('notion'); } },
      { id: 'theme.nothing', title: 'Theme: Nothing', group: 'Appearance', icon: 'droplet', run: function () { N.theme.setStyle('nothing'); } },
      { id: 'theme.glass', title: 'Theme: Liquid Glass', group: 'Appearance', icon: 'droplet', run: function () { N.theme.setStyle('glass'); } },
      { id: 'theme.biggerText', title: 'Increase text size', group: 'Appearance', icon: 'font-size', accel: 'Mod+=',
        run: function () { N.theme.set('fontSize', U.clamp(N.store.state.settings.fontSize + 1, 12, 26)); } },
      { id: 'theme.smallerText', title: 'Decrease text size', group: 'Appearance', icon: 'font-size', accel: 'Mod+-',
        run: function () { N.theme.set('fontSize', U.clamp(N.store.state.settings.fontSize - 1, 12, 26)); } },

      { id: 'app.undo', title: 'Undo the last vault action', group: 'App', icon: 'undo', accel: 'Mod+Shift+U',
        when: function () { return N.store.canUndo(); },
        run: async function () {
          const label = await N.store.undo();
          N.toast.info(label ? 'Undone: ' + label : 'Nothing to undo', { ms: 2000 });
        } },
      { id: 'app.redo', title: 'Redo', group: 'App', icon: 'redo', accel: 'Mod+Shift+Y',
        when: function () { return N.store.canRedo(); },
        run: async function () {
          const label = await N.store.redo();
          N.toast.info(label ? 'Redone: ' + label : 'Nothing to redo', { ms: 2000 });
        } },
      { id: 'app.install', title: 'Install Nodalis as an app', group: 'App', icon: 'download',
        when: function () { return !!deferredInstallPrompt; },
        run: promptInstall },
      { id: 'app.reload', title: 'Reload Nodalis', group: 'App', icon: 'refresh',
        run: async function () {
          if (N.editor.isDirty()) N.editor.flushSave();
          await N.vault.flushNow();
          location.reload();
        } },
    ]);
  }

  /* ------------------------------------------------------------ platform */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;   // service workers cannot run from file://
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function () {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            N.toast.info('A new version of Nodalis is ready.', {
              ms: 0, title: 'Update available',
              action: { label: 'Reload', onClick: function () { location.reload(); } },
            });
          }
        });
      });
    }).catch(function (err) {
      console.warn('[nodalis] service worker not registered', err);
    });
  }

  function watchInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = document.getElementById('btn-install');
      if (btn) {
        btn.classList.remove('hidden');
        btn.addEventListener('click', promptInstall);
      }
      bus.emit('commands:changed');
    });
    window.addEventListener('appinstalled', function () {
      deferredInstallPrompt = null;
      const btn = document.getElementById('btn-install');
      if (btn) btn.classList.add('hidden');
      N.toast.success('Nodalis installed. It works offline from here on.', { ms: 4000 });
    });
  }

  async function promptInstall() {
    if (!deferredInstallPrompt) {
      N.toast.info(U.supports.isIOS
        ? 'On iPhone or iPad: tap Share, then "Add to Home Screen".'
        : 'Use your browser menu and choose Install.', { ms: 6000 });
      return;
    }
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch (err) { /* dismissed */ }
    deferredInstallPrompt = null;
  }

  function watchConnectivity() {
    window.addEventListener('offline', function () {
      N.toast.info('You are offline. Everything still works — Nodalis never needed the network.',
        { ms: 0, key: 'offline' });
    });
    window.addEventListener('online', function () { N.toast.dismiss('offline'); });
  }

  function watchVisibility() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden') return;
      // Leaving the tab is the last safe moment to get everything on disk.
      try { N.editor.flushSave(); } catch (err) { /* editor may not be up */ }
      N.vault.flushNow();
    });
  }

  function watchUnload() {
    window.addEventListener('beforeunload', function (e) {
      let pending = 0;
      try { pending = N.vault.pending(); } catch (err) { pending = 0; }
      if (N.editor.isDirty() || pending > 0) {
        try { N.editor.flushSave(); } catch (err) {}
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });
  }

  /* --------------------------------------------------------- error paths */

  function onQuotaExceeded() {
    N.toast.error('This device has run out of storage for Nodalis. Export your vault, then remove some large attachments.', {
      title: 'Storage full', ms: 0,
      action: { label: 'Export now', onClick: function () { N.commands.run('export.vault'); } },
    });
  }

  function onDbDegraded(reason) {
    N.toast.error((reason || 'The local database is unavailable.') +
      ' Nodalis is running from memory — nothing will survive a reload. Export your work now.', {
      title: 'Storage unavailable', ms: 0,
      action: { label: 'Export', onClick: function () { N.commands.run('export.vault'); } },
    });
  }

  function installErrorNet() {
    window.addEventListener('error', function (e) {
      // Resource load failures (a missing image) are noisy and not fatal.
      if (e.target && e.target !== window && e.target.tagName) return;
      console.error('[nodalis] uncaught error', e.error || e.message);
      reportSoftError(e.error || new Error(e.message));
    });
    window.addEventListener('unhandledrejection', function (e) {
      console.error('[nodalis] unhandled rejection', e.reason);
      reportSoftError(e.reason);
    });
  }

  let errorBurst = 0;
  let errorBurstReset = null;

  function reportSoftError(err) {
    if (!booted) return;
    errorBurst++;
    clearTimeout(errorBurstReset);
    errorBurstReset = setTimeout(function () { errorBurst = 0; }, 5000);
    // A storm of errors means something structural broke; say so once.
    if (errorBurst === 4) {
      N.toast.error('Something has gone wrong repeatedly. Your notes are safe — reloading usually clears it.', {
        title: 'Nodalis hit a problem', ms: 0,
        action: { label: 'Reload', onClick: function () { location.reload(); } },
      });
      return;
    }
    if (errorBurst > 4) return;
    if (N.toast) N.toast.error(U.describeError(err), { ms: 7000, key: 'soft-error' });
  }

  function showFatal(err) {
    const wrap = el('div', {
      style: {
        position: 'fixed', inset: '0', zIndex: '9999',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', background: '#16161f', color: '#f2f2f8',
        font: "15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
    });
    const card = el('div', { style: { maxWidth: '460px', textAlign: 'center' } });
    card.appendChild(el('h1', { style: { fontSize: '22px', marginBottom: '12px' } }, 'Nodalis could not start'));
    card.appendChild(el('p', { style: { opacity: '0.85', marginBottom: '10px' } }, U.describeError(err)));
    card.appendChild(el('p', { style: { opacity: '0.6', fontSize: '13px', marginBottom: '20px' } },
      'Your notes are almost certainly fine — this is a startup problem, not a data problem. If a folder was connected, the files are still on your disk.'));
    const actions = el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' } });
    actions.appendChild(el('button', {
      style: { padding: '10px 18px', borderRadius: '10px', background: '#6c5ce7', color: '#fff', border: 'none', cursor: 'pointer' },
      onclick: function () { location.reload(); },
    }, 'Try again'));
    actions.appendChild(el('button', {
      style: { padding: '10px 18px', borderRadius: '10px', background: 'transparent', color: '#f2f2f8', border: '1px solid #3d3d50', cursor: 'pointer' },
      onclick: async function () {
        try {
          const dump = await N.db.exportAll();
          U.downloadText(JSON.stringify(dump), 'nodalis-recovery.json', 'application/json');
        } catch (e2) {
          alert('Recovery export failed: ' + U.describeError(e2));
        }
      },
    }, 'Download a recovery file'));
    card.appendChild(actions);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
  }

  /* ---------------------------------------------------------------- start */

  N.app = {
    boot: boot, setView: setView, openNote: openNote, createNoteIn: createNoteIn,
    toggleSidebar: toggleSidebar, toggleRightPanel: toggleRightPanel,
    rebuildNav: rebuildNav, updateVaultStatus: updateVaultStatus,
    openMoreSheet: openMoreSheet,
    // Exposed so the recovery path can be exercised by tests and triggered by
    // hand from the console if someone is ever stuck on a stalled start.
    forceUsableShell: forceUsableShell,
    bootStage: function () { return bootStage; },
    version: '2.0.1',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.NODALIS = window.NODALIS || {});
