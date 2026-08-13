/**
 * help.js — Help Center: replay the tour, a full feature manual, and the
 * keyboard shortcuts reference. Opened from the (?) icon or the command palette.
 */
import { bus } from './state.js';

const SHORTCUTS = [
  ['Ctrl / Cmd + K', 'Command palette'],
  ['Ctrl / Cmd + O', 'Quick switcher (jump to note)'],
  ['Ctrl / Cmd + N', 'New note'],
  ['Ctrl / Cmd + G', 'Open graph view'],
  ['Ctrl / Cmd + B', 'Bold selection'],
  ['Ctrl / Cmd + I', 'Italic selection'],
  ['[[', 'Start a note link (autocompletes)'],
  ['#', 'Tag (anywhere in text)'],
  ['> [!note]', 'Callout block — try note, tip, warning, danger, success, question'],
  ['Esc', 'Close any panel / palette / dialog'],
];

const MANUAL = [
  { title: '📝 Editor', body: 'Plain markdown with live preview. Split, edit-only, or preview-only modes. Paste or drag an image straight into a note — it is stored as an attachment automatically. Word count and reading time show at the bottom while you write.' },
  { title: '🔗 Wikilinks, tags & backlinks', body: 'Type [[Note Name]] to link — it autocompletes and creates the note if it does not exist yet. Type #tag anywhere. The right-hand panel shows every note that links here (Linked mentions), every note that just mentions the title without a link yet (Unlinked mentions), a clickable Outline of this note\'s headings, and its YAML Properties.' },
  { title: '🕸️ Graph view', body: 'Every note is a node, every link an edge. Drag nodes to rearrange, scroll/pinch to zoom, click a node to open that note, double-click empty space to reset the view.' },
  { title: '🖼️ Canvas (Edgeless mode)', body: 'An infinite whiteboard. Add a card linked to any note, a sticky note, or a shape. Drag to move, use the corner handle to resize, pan by dragging empty space, scroll/pinch to zoom.' },
  { title: '📊 Database & kanban', body: 'Pick a folder or a tag as scope; view it as a sortable table or a kanban board. Kanban columns come from any YAML frontmatter property you add — drag a card to a different column to update that property automatically.' },
  { title: '📁 Folders & organization', body: 'Right-click (or long-press on touch) any folder for "New note here", "New subfolder", rename, or delete. Right-click a note for pin, duplicate, move to another folder, rename, or delete. Pinned notes and your 5 most recently opened notes get their own quick-access sections above the file tree.' },
  { title: '🗓️ Daily notes & templates', body: 'One click creates (or opens) today\'s note from the built-in Daily template. Templates support {{date}}, {{time}} and {{title}} placeholders — see Settings → Templates.' },
  { title: '💾 Data safety & sync', body: 'Local-only keeps everything in this browser — fine for trying things out, but browser storage can be cleared. For anything that matters, connect a GitHub repo (free, your own repo, your own files) or a real folder on disk (Chrome/Edge desktop) in Settings → Sync — Nodalis then keeps that folder continuously up to date as you type. You can also export a full .zip backup anytime and import it back exactly as you left it.' },
  { title: '🎨 Themes & customization', body: 'Choose a whole look — classic Nodalis, Notion-style, monochrome "Nothing"-inspired, or frosted Glass — in Settings → Appearance. Then make it yours: accent color, editor font, density, and which views (graph/canvas/database) even show up, in Settings → Customization.' },
  { title: '📤 Sharing', body: 'Use the share icon in the editor toolbar to send a note via your device\'s native share sheet (or copy it, on desktop browsers without one). Export your whole vault as a .zip anytime from Settings → Data.' },
];

export function initHelp() {
  const modal = document.getElementById('help-modal');
  const backdrop = document.getElementById('modal-backdrop');
  const closeBtn = document.getElementById('help-close');
  const body = document.getElementById('help-body');

  function render() {
    body.innerHTML = `
      <div class="help-section">
        <button id="btn-help-tour" class="btn btn-primary">▶ Replay the guided tour</button>
      </div>
      <div class="help-section">
        <h3>Keyboard shortcuts</h3>
        <table class="help-shortcuts">${SHORTCUTS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>
      </div>
      <div class="help-section">
        <h3>Feature manual</h3>
        ${MANUAL.map((m) => `<details class="help-manual-item"><summary>${m.title}</summary><p>${m.body}</p></details>`).join('')}
      </div>`;
    document.getElementById('btn-help-tour').addEventListener('click', () => { close(); bus.emit('tour:start'); });
  }

  function open() {
    render();
    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');
  }
  function close() {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
  }

  document.getElementById('btn-help').addEventListener('click', open);
  document.getElementById('sheet-help')?.addEventListener('click', () => {
    document.getElementById('mobile-more-sheet').classList.add('hidden');
    open();
  });
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  bus.on('help:open', open);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
