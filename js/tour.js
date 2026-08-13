/**
 * tour.js — first-run guided walkthrough of every major feature, replayable
 * anytime from the help center or command palette. Spotlights a real element
 * when one is visible; falls back to a centered card (e.g. on mobile, where
 * some controls live behind the bottom-sheet "More" menu) when it isn't.
 */
import { state, bus, saveSettings } from './state.js';
import { setActiveView } from './layout-manager.js';

function isNarrow() { return window.matchMedia('(max-width: 699px)').matches; }

const STEPS = [
  {
    title: 'Welcome to Nodalis 👋',
    body: `Your knowledge, connected — a fast, local-first alternative to Obsidian and AFFiNE. This short tour covers every major feature in about a minute. You can replay it anytime from the Help (?) icon.`,
  },
  {
    title: 'Create notes',
    body: `Start here. Notes are plain markdown — nothing proprietary, ever.`,
    selector: '#btn-new-note',
  },
  {
    title: 'Organize with folders',
    body: `Right-click (or long-press on mobile) any folder to add a note inside it, add a subfolder, rename, or delete. Right-click a note for pin, duplicate, move, and share.`,
    selector: '#file-tree',
    mobileNote: 'Open the sidebar (☰ top-left) to see your files, then long-press any folder or note for its menu.',
  },
  {
    title: 'Tags & search',
    body: `Type #tags anywhere in a note — they show up here automatically and can filter your Database view.`,
    selector: '.sidebar-tab[data-tab="tags"]',
  },
  {
    title: 'Command palette',
    body: `Press Ctrl/Cmd+K anytime to jump to a note or run any command. Ctrl/Cmd+O is a dedicated quick-switcher.`,
    selector: '#btn-search',
  },
  {
    title: 'Write & link',
    body: `Type [[ to link another note (autocomplete included), #tag to tag, and > [!note] for a callout box. Drop or paste an image directly in — it's stored right in your note.`,
    selector: '#note-editor',
  },
  {
    title: 'Backlinks, outline & properties',
    body: `See who links to this note (and who mentions it without a link yet), a jump-to outline, and this note's YAML properties.`,
    selector: '#right-panel',
    mobileNote: 'Tap More → Backlinks / Outline on mobile.',
  },
  {
    title: 'Knowledge graph',
    body: `Every note and link, visualized. Drag nodes, scroll or pinch to zoom, click a node to open it.`,
    selector: '#btn-view-graph',
    mobileSelector: '.mobile-nav-btn[data-view="graph"]',
  },
  {
    title: 'Infinite canvas',
    body: `A freeform whiteboard — like AFFiNE's Edgeless mode. Add linked-note cards, sticky notes, and shapes; drag, resize, pan and zoom.`,
    selector: '#btn-view-canvas',
    mobileSelector: '.mobile-nav-btn[data-view="canvas"]',
  },
  {
    title: 'Database & kanban',
    body: `Turn any folder or tag into a sortable table — or a drag-and-drop kanban board grouped by any property you add to your notes' frontmatter.`,
    selector: '#btn-view-database',
    mobileNote: 'Tap More → Database / Kanban on mobile.',
  },
  {
    title: 'Daily notes & templates',
    body: `One tap for today's note, pre-filled from a template. Build your own templates with {{date}}, {{time}}, {{title}} placeholders in Settings.`,
    selector: '#btn-daily-note',
    mobileNote: 'Tap More → Today\'s daily note on mobile.',
  },
  {
    title: 'Make it yours',
    body: `Pick a whole theme style — the classic Nodalis look, a Notion-style workspace, a monochrome "Nothing"-inspired look, or an iOS-style frosted Glass — then fine-tune the accent color, editor font, density, and which views even show up. This app should feel like something you built for yourself.`,
    selector: '#btn-settings',
  },
  {
    title: "You're never one bad cache away from losing anything",
    body: `Local-only is fine for trying things out, but for anything that matters, connect a real GitHub repo or a real folder on disk in Settings → Sync — both are free and both mean your notes exist as real files outside this browser. Nodalis will gently remind you if you haven't yet.`,
    selector: '#sync-status',
  },
  {
    title: "You're all set 🎉",
    body: `Replay this tour anytime from the Help (?) icon, which also has a full feature manual and keyboard shortcuts. Happy writing!`,
  },
];

let overlay, ring, card, currentIndex = 0;

export function initTour() {
  bus.on('tour:start', () => startTour());
  bus.on('vault:loaded', () => {
    if (!state.settings.tourCompleted) {
      setTimeout(() => startTour(), 700);
    }
  });
  document.getElementById('btn-help-tour')?.addEventListener('click', startTour);
}

export function startTour() {
  currentIndex = 0;
  buildOverlay();
  renderStep();
}

function buildOverlay() {
  teardown();
  overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.style.zIndex = '200';
  overlay.style.background = 'rgba(10,10,16,0.35)';
  document.body.appendChild(overlay);

  ring = document.createElement('div');
  ring.className = 'tour-spotlight-ring hidden';
  document.body.appendChild(ring);

  card = document.createElement('div');
  card.className = 'palette';
  card.style.cssText = 'top:auto;bottom:24px;left:50%;transform:translateX(-50%);position:fixed;max-width:420px;width:92vw;z-index:206;padding:20px;';
  document.body.appendChild(card);
}

function teardown() {
  overlay?.remove(); ring?.remove(); card?.remove();
  overlay = ring = card = null;
}

function renderStep() {
  const step = STEPS[currentIndex];
  const narrow = isNarrow();
  const selector = narrow && step.mobileSelector ? step.mobileSelector : step.selector;
  let el = selector ? document.querySelector(selector) : null;

  // On narrow layouts, sidebar/right-panel content is off-screen until opened —
  // open the relevant drawer so the spotlight can actually land on it.
  if (narrow && el) {
    if (el.closest('#sidebar') && !document.getElementById('sidebar').classList.contains('open')) {
      document.getElementById('btn-toggle-sidebar')?.click();
    } else if (el.closest('#right-panel') && !document.getElementById('right-panel').classList.contains('open')) {
      document.getElementById('sheet-toggle-right')?.click();
    }
  }

  const rect = el ? el.getBoundingClientRect() : null;
  const onScreen = rect && rect.width > 0 && rect.height > 0 &&
    rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight;
  const visible = !!onScreen;

  if (visible) {
    ring.classList.remove('hidden');
    ring.style.left = `${rect.left - 6}px`;
    ring.style.top = `${rect.top - 6}px`;
    ring.style.width = `${rect.width + 12}px`;
    ring.style.height = `${rect.height + 12}px`;
  } else {
    ring.classList.add('hidden');
  }

  const note = narrow && step.mobileNote && !visible ? `<p style="font-size:12.5px;color:var(--text-2);margin-top:8px;">${step.mobileNote}</p>` : '';
  card.innerHTML = `
    <div style="font-size:11px;color:var(--text-2);margin-bottom:6px;">STEP ${currentIndex + 1} OF ${STEPS.length}</div>
    <h3 style="margin:0 0 8px;font-size:17px;">${step.title}</h3>
    <p style="margin:0;font-size:14px;color:var(--text-1);line-height:1.5;">${step.body}</p>
    ${note}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
      <button id="tour-skip" class="btn btn-ghost small">Skip tour</button>
      <div style="display:flex;gap:8px;">
        ${currentIndex > 0 ? '<button id="tour-back" class="btn small">Back</button>' : ''}
        <button id="tour-next" class="btn btn-primary small">${currentIndex === STEPS.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
    </div>`;

  document.getElementById('tour-skip').addEventListener('click', finish);
  document.getElementById('tour-next').addEventListener('click', next);
  document.getElementById('tour-back')?.addEventListener('click', back);
}

function next() {
  if (currentIndex >= STEPS.length - 1) return finish();
  currentIndex++;
  renderStep();
}
function back() {
  if (currentIndex === 0) return;
  currentIndex--;
  renderStep();
}
async function finish() {
  teardown();
  if (!state.settings.tourCompleted) {
    state.settings.tourCompleted = true;
    await saveSettings();
    bus.emit('celebrate', { emoji: '🎉' });
  }
}

document.addEventListener('keydown', (e) => {
  if (!card) return;
  if (e.key === 'Escape') finish();
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') back();
});
