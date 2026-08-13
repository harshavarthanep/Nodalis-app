/**
 * theme.js — theme *style* (Nodalis / Notion / Nothing / Glass) plus light/dark
 * *mode* resolution (manual, follows system, or follows time of day).
 */
import { state, bus, saveSettings } from './state.js';

const STYLES_WITH_MODE = ['nodalis', 'notion']; // styles that support light/dark switching
let timeTicker = null;

export function initTheme() {
  migrateLegacySettings();
  applyAll();

  document.getElementById('btn-theme').addEventListener('click', cycleMode);
  bus.on('theme:toggle', cycleMode);
  bus.on('theme:setStyle', async (style) => { state.settings.themeStyle = style; await saveSettings(); applyAll(); });
  bus.on('theme:setMode', async (mode) => { state.settings.themeMode = mode; await saveSettings(); applyAll(); });
  bus.on('theme:setGlassShade', async (shade) => { state.settings.glassShade = shade; await saveSettings(); applyAll(); });
  bus.on('vault:loaded', applyAll);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.themeMode === 'auto-system') applyAll();
  });

  clearInterval(timeTicker);
  timeTicker = setInterval(() => {
    if (state.settings.themeMode === 'auto-time') applyAll();
  }, 60 * 1000);
}

function migrateLegacySettings() {
  // Older builds stored a single `theme: 'auto'|'light'|'dark'` value — map it forward.
  if (state.settings.theme && !state.settings.themeStyle) {
    const legacy = state.settings.theme;
    state.settings.themeStyle = 'nodalis';
    state.settings.themeMode = legacy === 'auto' ? 'auto-system' : legacy;
  }
  if (!state.settings.themeStyle) state.settings.themeStyle = 'nodalis';
  if (!state.settings.themeMode) state.settings.themeMode = 'auto-system';
  if (!state.settings.glassShade) state.settings.glassShade = 'clear';
}

function resolveMode() {
  const mode = state.settings.themeMode;
  if (mode === 'light' || mode === 'dark') return mode;
  if (mode === 'auto-time') {
    const hour = new Date().getHours();
    return (hour >= 19 || hour < 7) ? 'dark' : 'light';
  }
  // auto-system
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAll() {
  const style = state.settings.themeStyle || 'nodalis';
  const body = document.body;
  body.dataset.style = style;

  if (STYLES_WITH_MODE.includes(style)) {
    body.dataset.mode = resolveMode();
    body.removeAttribute('data-glass-shade');
  } else if (style === 'glass') {
    body.dataset.mode = state.settings.glassShade === 'dark' ? 'dark' : 'light';
    body.dataset.glassShade = state.settings.glassShade || 'clear';
  } else {
    // 'nothing' is a fixed single look
    body.removeAttribute('data-mode');
    body.removeAttribute('data-glass-shade');
  }

  // Accent customization only applies to styles that don't already define a fixed brand accent
  if (style === 'nothing') {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-hover');
    document.documentElement.style.removeProperty('--accent-soft');
  } else if (state.settings.accent) {
    applyAccent(state.settings.accent);
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = getComputedStyle(body).getPropertyValue('--accent').trim() || '#6c5ce7';
}

export function applyAccent(hex) {
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-hover', shade(hex, -12));
  document.documentElement.style.setProperty('--accent-soft', hexToRgba(hex, 0.14));
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const bigint = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const adj = (c) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}

async function cycleMode() {
  const style = state.settings.themeStyle;
  if (!STYLES_WITH_MODE.includes(style)) {
    // For fixed/glass styles, "toggle" just flips glass shade or is a no-op for Nothing
    if (style === 'glass') {
      state.settings.glassShade = state.settings.glassShade === 'dark' ? 'clear' : 'dark';
      await saveSettings();
      applyAll();
    }
    return;
  }
  const order = ['auto-system', 'light', 'dark', 'auto-time'];
  const idx = order.indexOf(state.settings.themeMode);
  state.settings.themeMode = order[(idx + 1) % order.length];
  await saveSettings();
  applyAll();
}
