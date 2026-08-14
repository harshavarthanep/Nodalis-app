/* =========================================================================
 * Nodalis — ui/theme.js
 * Applies every appearance setting to the document in one place.
 *
 * The old build had a bug where changing the font appeared to do nothing:
 * the CSS override only targeted the editor textarea, so the preview, UI and
 * everything else kept the theme's font. Here a single apply() writes every
 * appearance attribute and custom property at once, and every setting change
 * routes through it — so what you pick is what you get, everywhere.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const bus = N.bus;

  const STYLES = ['nodalis', 'notion', 'nothing', 'glass'];
  const MODE_CAPABLE = { nodalis: true, notion: true, nothing: true, glass: true };

  const ACCENT_PRESETS = [
    { name: 'Violet', hex: '#6c5ce7' },
    { name: 'Indigo', hex: '#4361ee' },
    { name: 'Ocean', hex: '#0284c7' },
    { name: 'Teal', hex: '#0d9488' },
    { name: 'Forest', hex: '#16a34a' },
    { name: 'Amber', hex: '#d97706' },
    { name: 'Rose', hex: '#e11d48' },
    { name: 'Nothing red', hex: '#d71921' },
    { name: 'Graphite', hex: '#475569' },
  ];

  const UI_FONTS = [
    { id: 'default', name: 'Theme default', preview: 'Aa' },
    { id: 'inter', name: 'Inter', preview: 'Aa' },
    { id: 'grotesk', name: 'Space Grotesk', preview: 'Aa' },
    { id: 'mono', name: 'Space Mono', preview: 'Aa' },
    { id: 'dot', name: 'Doto (dot matrix)', preview: 'Aa' },
    { id: 'serif', name: 'Serif', preview: 'Aa' },
    { id: 'system', name: 'System UI', preview: 'Aa' },
  ];

  const EDITOR_FONTS = [
    { id: 'inherit', name: 'Match interface' },
    { id: 'sans', name: 'Inter (sans)' },
    { id: 'serif', name: 'Serif' },
    { id: 'mono', name: 'Space Mono' },
    { id: 'grotesk', name: 'Space Grotesk' },
    { id: 'dot', name: 'Doto (dot matrix)' },
    { id: 'system', name: 'System UI' },
  ];

  let timeTicker = null;
  let mediaQuery = null;

  function settings() { return N.store.state.settings; }

  function resolveMode() {
    const s = settings();
    const mode = s.themeMode;
    if (mode === 'light' || mode === 'dark') return mode;
    if (mode === 'auto-time') {
      const hour = new Date().getHours();
      return (hour >= 19 || hour < 7) ? 'dark' : 'light';
    }
    if (window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return 'light';
  }

  /** The one function that writes appearance to the DOM. */
  function apply() {
    const s = settings();
    const body = document.body;
    const rootEl = document.documentElement;

    const style = STYLES.indexOf(s.themeStyle) !== -1 ? s.themeStyle : 'nodalis';
    body.dataset.style = style;
    // Tells the stylesheet that a real theme is in charge, so the
    // scripts-blocked colour fallback in tokens.css steps aside.
    rootEl.dataset.themed = style;
    body.dataset.mode = MODE_CAPABLE[style] ? resolveMode() : 'light';

    if (style === 'glass') {
      body.dataset.glassIntensity = s.glassIntensity || 'medium';
      body.dataset.ambient = s.ambientBackground === false ? 'off' : 'on';
    } else {
      body.removeAttribute('data-glass-intensity');
      body.removeAttribute('data-ambient');
    }

    /* --- fonts. Applied to <html> so *everything* inherits, including
       portals appended to <body> like menus, toasts and the palette. --- */
    rootEl.dataset.uiFont = s.uiFont || 'default';
    rootEl.dataset.editorFont = s.editorFont || 'sans';
    body.dataset.uiFont = s.uiFont || 'default';
    body.dataset.editorFont = s.editorFont || 'sans';

    /* --- density, width, roundness, motion --- */
    rootEl.dataset.density = s.density || 'comfortable';
    rootEl.dataset.contentWidth = s.contentWidth || 'comfortable';
    rootEl.dataset.roundness = s.roundness || 'default';
    rootEl.dataset.animations = s.animations || 'full';
    body.dataset.density = s.density || 'comfortable';

    /* --- numeric typography --- */
    const size = U.clamp(Number(s.fontSize) || 16, 11, 28);
    const lh = U.clamp(Number(s.lineHeight) || 1.7, 1.1, 2.6);
    rootEl.style.setProperty('--editor-font-size', size + 'px');
    rootEl.style.setProperty('--editor-line-height', String(lh));

    /* --- accent. The Nothing theme owns its red; everything else is free. --- */
    if (style === 'nothing') {
      rootEl.style.removeProperty('--accent');
      rootEl.style.removeProperty('--accent-hover');
      rootEl.style.removeProperty('--accent-soft');
      rootEl.style.removeProperty('--accent-on');
    } else {
      applyAccent(s.accent || '#6c5ce7');
    }

    /* --- feature visibility --- */
    const views = s.visibleViews || {};
    ['graph', 'canvas', 'database', 'tasks', 'matrix', 'sticky', 'scratch', 'review'].forEach(function (v) {
      body.dataset['show' + v.charAt(0).toUpperCase() + v.slice(1)] = views[v] === false ? '0' : '1';
    });

    /* --- browser chrome colour --- */
    updateThemeColor();

    bus.emit('theme:applied', { style: style, mode: body.dataset.mode });
  }

  function applyAccent(hex) {
    const rootEl = document.documentElement;
    const clean = /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(hex).replace('#', '')) ? hex : '#6c5ce7';
    rootEl.style.setProperty('--accent', clean);
    rootEl.style.setProperty('--accent-hover', U.mix(clean, U.luminance(clean) > 0.5 ? '#000000' : '#ffffff', 0.16));
    rootEl.style.setProperty('--accent-soft', U.rgba(clean, 0.14));
    rootEl.style.setProperty('--accent-on', U.readableOn(clean));
  }

  function updateThemeColor() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    // Match the top bar, so the status bar blends with the app on mobile.
    const probe = document.querySelector('.topbar') || document.body;
    let color = '';
    try { color = getComputedStyle(probe).backgroundColor; } catch (err) { color = ''; }
    // A translucent glass bar would give a see-through status bar; fall back.
    if (!color || /rgba\([^)]*,\s*0?\.\d+\)/.test(color)) {
      color = document.body.dataset.mode === 'dark' ? '#101018' : '#f6f2e9';
    }
    meta.content = color;
  }

  /* --------------------------------------------------------------- setters */

  async function setStyle(style) {
    if (STYLES.indexOf(style) === -1) return;
    const s = settings();
    const previous = s.themeStyle;
    s.themeStyle = style;

    // The Nothing look is a black OLED interface with one red. Landing on it in
    // light mode misses the point entirely, so the first switch adopts dark —
    // but only while the user is on an automatic mode, never overriding a
    // deliberate light/dark choice.
    if (style === 'nothing' && previous !== 'nothing' && String(s.themeMode).startsWith('auto')) {
      s.rememberedThemeMode = s.themeMode;
      s.themeMode = 'dark';
    } else if (previous === 'nothing' && style !== 'nothing' && s.rememberedThemeMode) {
      s.themeMode = s.rememberedThemeMode;
      delete s.rememberedThemeMode;
    }

    await N.store.saveSettings();
    apply();
  }

  async function setMode(mode) {
    N.store.state.settings.themeMode = mode;
    await N.store.saveSettings();
    apply();
  }

  async function setAccent(hex) {
    N.store.state.settings.accent = hex;
    await N.store.saveSettings();
    apply();
  }

  async function set(key, value) {
    N.store.state.settings[key] = value;
    await N.store.saveSettings();
    apply();
  }

  /** Cycles light -> dark -> auto, staying honest about what "auto" resolves to. */
  async function toggleMode() {
    const order = ['light', 'dark', 'auto-system'];
    const current = settings().themeMode;
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    await setMode(next);
    const label = next === 'auto-system'
      ? 'Following your system (' + resolveMode() + ')'
      : next.charAt(0).toUpperCase() + next.slice(1);
    N.toast.info(label, { ms: 1600, key: 'theme-mode' });
    return next;
  }

  async function cycleStyle() {
    const idx = STYLES.indexOf(settings().themeStyle);
    const next = STYLES[(idx + 1) % STYLES.length];
    await setStyle(next);
    N.toast.info(next.charAt(0).toUpperCase() + next.slice(1) + ' theme', { ms: 1600, key: 'theme-style' });
    return next;
  }

  function init() {
    apply();

    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = function () { if (settings().themeMode === 'auto-system') apply(); };
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onChange);
      else if (mediaQuery.addListener) mediaQuery.addListener(onChange);   // Safari < 14
    }

    clearInterval(timeTicker);
    timeTicker = setInterval(function () {
      if (settings().themeMode === 'auto-time') apply();
    }, 60000);

    bus.on('settings:changed', apply);
    bus.on('vault:loaded', apply);
  }

  N.theme = {
    init: init, apply: apply, applyAccent: applyAccent,
    setStyle: setStyle, setMode: setMode, setAccent: setAccent, set: set,
    toggleMode: toggleMode, cycleStyle: cycleStyle, resolveMode: resolveMode,
    STYLES: STYLES, ACCENT_PRESETS: ACCENT_PRESETS, UI_FONTS: UI_FONTS, EDITOR_FONTS: EDITOR_FONTS,
  };
})(window.NODALIS = window.NODALIS || {});
