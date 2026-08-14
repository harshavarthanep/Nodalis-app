/* =========================================================================
 * Nodalis — ui/shortcuts.js
 * Keybinding engine. Every command can have one, every one can be remapped,
 * and conflicts are detected rather than silently shadowing each other.
 *
 * Accelerator syntax:  "Mod+Shift+K"   ("Mod" = Cmd on macOS, Ctrl elsewhere)
 * Chords:              "g then d"      (Vim-ish leader sequences)
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;

  const IS_MAC = typeof navigator !== 'undefined' &&
    (/Mac|iPhone|iPad|iPod/.test(navigator.platform || '') || /Mac OS X/.test(navigator.userAgent || ''));

  const KEY_ALIASES = {
    esc: 'Escape', escape: 'Escape', enter: 'Enter', return: 'Enter',
    space: ' ', spacebar: ' ', tab: 'Tab', del: 'Delete', delete: 'Delete',
    backspace: 'Backspace', up: 'ArrowUp', down: 'ArrowDown',
    left: 'ArrowLeft', right: 'ArrowRight', plus: '+', minus: '-',
    comma: ',', period: '.', slash: '/', backslash: '\\',
    pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End',
  };

  const DISPLAY = IS_MAC
    ? { Mod: '⌘', Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Enter: '↩', Escape: 'esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: '⌫', Delete: '⌦', ' ': 'space', Tab: '⇥' }
    : { Mod: 'Ctrl', Meta: 'Win', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Enter: 'Enter', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'Backspace', Delete: 'Del', ' ': 'Space', Tab: 'Tab' };

  const bindings = new Map();       // normalized accel -> commandId
  const chords = new Map();         // "g" -> Map(secondKey -> commandId)
  let chordPending = null;
  let chordTimer = null;
  let enabled = true;

  /* ------------------------------------------------------------ parsing */

  function normalizeKey(key) {
    if (!key) return '';
    const lower = String(key).toLowerCase();
    if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];
    if (key.length === 1) return key.toLowerCase();
    // F-keys and named keys keep their canonical casing.
    if (/^f\d{1,2}$/i.test(key)) return key.toUpperCase();
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  /** "Mod+Shift+K" -> canonical "mod+shift+k" (modifiers always in fixed order). */
  function normalize(accel) {
    if (!accel) return '';
    const raw = String(accel).trim();
    if (/\s+then\s+/i.test(raw)) {
      return raw.split(/\s+then\s+/i).map(function (part) { return normalize(part); }).join(' then ');
    }
    const parts = raw.split('+').map(function (p) { return p.trim(); }).filter(Boolean);
    const mods = { mod: false, ctrl: false, alt: false, shift: false, meta: false };
    let key = '';
    parts.forEach(function (p) {
      const lower = p.toLowerCase();
      if (lower === 'mod' || lower === 'cmdorctrl') mods.mod = true;
      else if (lower === 'ctrl' || lower === 'control') mods.ctrl = true;
      else if (lower === 'alt' || lower === 'option' || lower === 'opt') mods.alt = true;
      else if (lower === 'shift') mods.shift = true;
      else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super' || lower === 'win') mods.meta = true;
      else key = normalizeKey(p);
    });
    const out = [];
    if (mods.mod) out.push('mod');
    if (mods.ctrl) out.push('ctrl');
    if (mods.meta) out.push('meta');
    if (mods.alt) out.push('alt');
    if (mods.shift) out.push('shift');
    if (key) out.push(key.toLowerCase());
    return out.join('+');
  }

  /** Build the canonical string for a real keyboard event. */
  function fromEvent(e) {
    const out = [];
    const modPressed = IS_MAC ? e.metaKey : e.ctrlKey;
    if (modPressed) out.push('mod');
    // Report the *other* physical modifier too, so Ctrl+X on macOS is distinct from Cmd+X.
    if (IS_MAC && e.ctrlKey) out.push('ctrl');
    if (!IS_MAC && e.metaKey) out.push('meta');
    if (e.altKey) out.push('alt');
    if (e.shiftKey) out.push('shift');
    let key = e.key;
    if (!key || ['Control', 'Shift', 'Alt', 'Meta', 'OS'].indexOf(key) !== -1) return null;
    // With Shift held, e.key is the shifted glyph ("?" not "/"); use code for letters/digits.
    if (e.shiftKey && key.length === 1 && /^[A-Za-z]$/.test(key)) key = key.toLowerCase();
    out.push(normalizeKey(key).toLowerCase());
    return out.join('+');
  }

  /** Human-readable form for display in menus and the palette. */
  function format(accel) {
    if (!accel) return '';
    if (/\s+then\s+/i.test(accel)) {
      return accel.split(/\s+then\s+/i).map(format).join(' then ');
    }
    const parts = normalize(accel).split('+');
    const out = parts.map(function (p) {
      if (p === 'mod') return DISPLAY.Mod;
      if (p === 'ctrl') return DISPLAY.Ctrl;
      if (p === 'meta') return DISPLAY.Meta;
      if (p === 'alt') return DISPLAY.Alt;
      if (p === 'shift') return DISPLAY.Shift;
      const canonical = normalizeKey(p);
      if (DISPLAY[canonical]) return DISPLAY[canonical];
      return canonical.length === 1 ? canonical.toUpperCase() : canonical;
    });
    return IS_MAC ? out.join('') : out.join('+');
  }

  /* ------------------------------------------------------------ registry */

  function rebuild() {
    bindings.clear();
    chords.clear();
    const overrides = (N.store && N.store.state.settings.keymap) || {};
    const commands = N.commands ? N.commands.all() : [];

    commands.forEach(function (cmd) {
      const accel = Object.prototype.hasOwnProperty.call(overrides, cmd.id) ? overrides[cmd.id] : cmd.accel;
      if (!accel) return;
      register(normalize(accel), cmd.id);
    });
  }

  function register(accel, commandId) {
    if (!accel) return;
    if (accel.indexOf(' then ') !== -1) {
      const parts = accel.split(' then ');
      if (!chords.has(parts[0])) chords.set(parts[0], new Map());
      chords.get(parts[0]).set(parts[1], commandId);
      return;
    }
    bindings.set(accel, commandId);
  }

  /** Which command (if any) already owns this accelerator. */
  function conflictFor(accel, exceptCommandId) {
    const key = normalize(accel);
    if (!key) return null;
    if (key.indexOf(' then ') !== -1) {
      const parts = key.split(' then ');
      const map = chords.get(parts[0]);
      const owner = map && map.get(parts[1]);
      return owner && owner !== exceptCommandId ? owner : null;
    }
    const owner = bindings.get(key);
    return owner && owner !== exceptCommandId ? owner : null;
  }

  function accelFor(commandId) {
    const overrides = (N.store && N.store.state.settings.keymap) || {};
    if (Object.prototype.hasOwnProperty.call(overrides, commandId)) return overrides[commandId];
    const cmd = N.commands && N.commands.get(commandId);
    return cmd ? cmd.accel : null;
  }

  async function rebind(commandId, accel) {
    const store = N.store;
    if (!store) return;
    if (!store.state.settings.keymap) store.state.settings.keymap = {};
    if (accel === null || accel === '') store.state.settings.keymap[commandId] = '';
    else store.state.settings.keymap[commandId] = normalize(accel);
    await store.saveSettings();
    rebuild();
  }

  async function resetBinding(commandId) {
    const store = N.store;
    if (!store || !store.state.settings.keymap) return;
    delete store.state.settings.keymap[commandId];
    await store.saveSettings();
    rebuild();
  }

  async function resetAll() {
    if (!N.store) return;
    N.store.state.settings.keymap = {};
    await N.store.saveSettings();
    rebuild();
  }

  /* ------------------------------------------------------------ handling */

  /** True when typing into a field — most shortcuts must stay out of the way. */
  function inTextInput(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === 'INPUT') {
      const type = (target.type || 'text').toLowerCase();
      return ['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].indexOf(type) === -1;
    }
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable === true;
  }

  function clearChord() {
    chordPending = null;
    clearTimeout(chordTimer);
    if (N.bus) N.bus.emit('shortcut:chord', null);
  }

  function handle(e) {
    if (!enabled) return;
    if (e.defaultPrevented) return;
    if (e.isComposing || e.keyCode === 229) return;   // IME composition

    const accel = fromEvent(e);
    if (!accel) return;

    const typing = inTextInput(e.target);
    const hasMod = /(^|\+)(mod|ctrl|meta|alt)(\+|$)/.test(accel);

    // A pending chord swallows the next key.
    if (chordPending) {
      const map = chords.get(chordPending);
      clearChord();
      if (map && map.has(accel)) {
        e.preventDefault();
        run(map.get(accel), e);
        return;
      }
      // Not a valid continuation — fall through and treat it normally.
    }

    // Start a chord only outside text fields; "g" is a letter people type.
    if (!typing && chords.has(accel)) {
      e.preventDefault();
      chordPending = accel;
      if (N.bus) N.bus.emit('shortcut:chord', accel);
      clearTimeout(chordTimer);
      chordTimer = setTimeout(clearChord, 1600);
      return;
    }

    const commandId = bindings.get(accel);
    if (!commandId) return;

    const cmd = N.commands && N.commands.get(commandId);
    if (!cmd) return;

    // Unmodified single keys never fire while typing.
    if (typing && !hasMod && !cmd.allowInInput) return;
    if (typing && hasMod && cmd.allowInInput === false) return;

    if (cmd.when && !safeWhen(cmd)) return;

    e.preventDefault();
    e.stopPropagation();
    run(commandId, e);
  }

  function safeWhen(cmd) {
    try { return cmd.when(); }
    catch (err) { console.error('[shortcuts] when() failed for ' + cmd.id, err); return false; }
  }

  function run(commandId, event) {
    if (N.commands) N.commands.run(commandId, { source: 'keyboard', event: event });
  }

  /* -------------------------------------------------------------- capture */

  /**
   * Record the next keystroke and hand back its accelerator.
   * Used by the shortcut editor in Settings. Escape cancels.
   */
  function capture(onResult) {
    const previouslyEnabled = enabled;
    enabled = false;
    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (['Control', 'Shift', 'Alt', 'Meta', 'OS'].indexOf(e.key) !== -1) return;  // wait for a real key
      cleanup();
      if (e.key === 'Escape') { onResult(null); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { onResult(''); return; }
      onResult(fromEvent(e));
    }
    function cleanup() {
      document.removeEventListener('keydown', onKey, true);
      enabled = previouslyEnabled;
    }
    document.addEventListener('keydown', onKey, true);
    return cleanup;
  }

  function init() {
    rebuild();
    document.addEventListener('keydown', handle, false);
    if (N.bus) {
      N.bus.on('commands:changed', rebuild);
      N.bus.on('settings:changed', rebuild);
    }
  }

  N.shortcuts = {
    init: init, rebuild: rebuild, normalize: normalize, format: format, fromEvent: fromEvent,
    accelFor: accelFor, rebind: rebind, resetBinding: resetBinding, resetAll: resetAll,
    conflictFor: conflictFor, capture: capture, inTextInput: inTextInput,
    setEnabled: function (v) { enabled = !!v; },
    isMac: IS_MAC,
    bindings: bindings,
  };
})(window.NODALIS = window.NODALIS || {});
