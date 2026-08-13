/**
 * theme.js — light/dark/auto theme toggle, persisted via settings.
 */
import { state, bus, saveSettings } from './state.js';

const ORDER = ['auto', 'light', 'dark'];

export function initTheme() {
  applyTheme(state.settings.theme || 'auto');

  document.getElementById('btn-theme').addEventListener('click', cycleTheme);
  bus.on('theme:toggle', cycleTheme);
  bus.on('vault:loaded', () => applyTheme(state.settings.theme || 'auto'));
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

async function cycleTheme() {
  const idx = ORDER.indexOf(state.settings.theme || 'auto');
  const next = ORDER[(idx + 1) % ORDER.length];
  state.settings.theme = next;
  applyTheme(next);
  await saveSettings();
}
