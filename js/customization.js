/**
 * customization.js — lets the user make Nodalis feel like *their* app:
 * accent color, editor font, density, and which views/tabs show up at all.
 * Applied via data-attributes on <body> so CSS in customization.css can react.
 */
import { state, bus, saveSettings } from './state.js';
import { applyAccent } from './theme.js';

export const ACCENT_PRESETS = [
  { name: 'Violet', hex: '#6c5ce7' },
  { name: 'Indigo', hex: '#4361ee' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Emerald', hex: '#16a34a' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Slate', hex: '#475569' },
  { name: 'Nothing Red', hex: '#e63c2f' },
];

export function initCustomization() {
  applyAll();
  bus.on('vault:loaded', applyAll);
  bus.on('settings:changed', applyAll);
}

export function applyAll() {
  const body = document.body;
  const s = state.settings;
  body.dataset.density = s.density || 'comfortable';
  body.dataset.editorFont = s.editorFont || 'mono';
  body.dataset.hideGraph = s.visibleViews && s.visibleViews.graph === false ? '1' : '0';
  body.dataset.hideCanvas = s.visibleViews && s.visibleViews.canvas === false ? '1' : '0';
  body.dataset.hideDatabase = s.visibleViews && s.visibleViews.database === false ? '1' : '0';
  if (s.themeStyle !== 'nothing' && s.accent) applyAccent(s.accent);
}

export async function setAccent(hex) {
  state.settings.accent = hex;
  await saveSettings();
  applyAll();
}

export async function setDensity(density) {
  state.settings.density = density;
  await saveSettings();
  applyAll();
}

export async function setEditorFont(font) {
  state.settings.editorFont = font;
  await saveSettings();
  applyAll();
}

export async function setViewVisible(view, visible) {
  state.settings.visibleViews = state.settings.visibleViews || {};
  state.settings.visibleViews[view] = visible;
  await saveSettings();
  applyAll();
}

export async function setSidebarTabVisible(tab, visible) {
  state.settings.visibleSidebarTabs = state.settings.visibleSidebarTabs || {};
  state.settings.visibleSidebarTabs[tab] = visible;
  await saveSettings();
  bus.emit('vault:changed');
}

export async function resetCustomization() {
  state.settings.accent = '#6c5ce7';
  state.settings.density = 'comfortable';
  state.settings.editorFont = 'mono';
  state.settings.visibleViews = { editor: true, graph: true, canvas: true, database: true };
  state.settings.visibleSidebarTabs = { files: true, tags: true, canvases: true };
  await saveSettings();
  applyAll();
  bus.emit('vault:changed');
}
