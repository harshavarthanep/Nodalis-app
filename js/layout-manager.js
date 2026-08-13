/**
 * layout-manager.js — handles responsive show/hide of sidebar, right panel,
 * view switching (editor/graph/canvas/database/settings), and the mobile bottom sheet.
 */
import { state, bus } from './state.js';

export function initLayout() {
  const sidebar = document.getElementById('sidebar');
  const rightPanel = document.getElementById('right-panel');
  const backdrop = document.getElementById('modal-backdrop');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnToggleRight = document.getElementById('btn-toggle-right');
  const moreSheet = document.getElementById('mobile-more-sheet');

  function isNarrow() { return window.matchMedia('(max-width: 1099px)').matches; }

  function closeOverlays() {
    sidebar.classList.remove('open');
    rightPanel.classList.remove('open');
    moreSheet.classList.add('hidden');
    if (!isNarrow() || (!sidebar.classList.contains('open') && !rightPanel.classList.contains('open'))) {
      backdrop.classList.add('hidden');
    }
  }

  btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) backdrop.classList.remove('hidden');
    else backdrop.classList.add('hidden');
  });

  btnToggleRight.addEventListener('click', () => {
    rightPanel.classList.toggle('collapsed');
  });

  document.getElementById('sheet-toggle-right').addEventListener('click', () => {
    moreSheet.classList.add('hidden');
    rightPanel.classList.add('open');
    backdrop.classList.remove('hidden');
  });

  backdrop.addEventListener('click', closeOverlays);

  // Mobile bottom nav
  document.querySelectorAll('.mobile-nav-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveView(btn.dataset.view);
      document.querySelectorAll('.mobile-nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelector('[data-mobile-action="search"]').addEventListener('click', () => {
    bus.emit('ui:open-palette');
  });
  document.querySelector('[data-mobile-action="more"]').addEventListener('click', () => {
    moreSheet.classList.toggle('hidden');
  });
  moreSheet.querySelectorAll('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => { setActiveView(btn.dataset.view); moreSheet.classList.add('hidden'); });
  });

  // Desktop/tablet view tabs
  document.querySelectorAll('.view-tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveView(btn.dataset.view));
  });
  document.getElementById('btn-settings').addEventListener('click', () => setActiveView('settings'));

  // Sidebar tabs (Files/Tags/Canvases)
  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`sidebar-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // Right panel tabs
  document.querySelectorAll('.right-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.right-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.right-tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`right-${tab.dataset.rtab}`).classList.add('active');
    });
  });

  window.addEventListener('resize', () => {
    if (!isNarrow()) closeOverlays();
  });

  bus.on('note:opened', () => { if (isNarrow()) closeOverlays(); });
}

export function setActiveView(view) {
  state.activeView = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.view-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.mobile-nav-btn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  bus.emit('view:changed', view);
}

export function showToast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/** A tiny celebratory emoji burst — used for first note, tour completion, etc. */
export function celebrate({ emoji = '🎉', x, y } = {}) {
  const el = document.createElement('div');
  el.className = 'cheer-burst';
  el.textContent = emoji;
  el.style.left = `${x ?? window.innerWidth / 2}px`;
  el.style.top = `${y ?? window.innerHeight / 2}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

bus.on('celebrate', (payload) => celebrate(payload || {}));
