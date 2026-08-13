/**
 * canvas.js — infinite pannable/zoomable whiteboard ("Edgeless mode"),
 * with draggable/resizable cards: linked notes, sticky notes, and shapes.
 */
import { state, bus, createCanvas, saveCanvas, noteTitle, findNoteByTitle, createNote } from './state.js';
import { uid } from './db.js';

let board, inner, select;
let activeCanvasId = null;
let view = { x: 0, y: 0, scale: 1 };
let panStart = null;

export function initCanvasBoard() {
  board = document.getElementById('canvas-board');
  inner = document.getElementById('canvas-board-inner');
  select = document.getElementById('canvas-select');

  bus.on('vault:loaded', refreshSelect);
  bus.on('vault:changed', refreshSelect);
  bus.on('canvas:open', (id) => { activeCanvasId = id; refreshSelect(); renderBoard(); });
  bus.on('view:changed', (v) => { if (v === 'canvas') { if (!activeCanvasId && state.canvases.size) activeCanvasId = [...state.canvases.keys()][0]; renderBoard(); } });

  select.addEventListener('change', () => { activeCanvasId = select.value; renderBoard(); });

  document.getElementById('btn-canvas-add-card').addEventListener('click', async () => {
    const title = prompt('Link which note? (type exact title, or new title to create one)');
    if (!title) return;
    let note = findNoteByTitle(title);
    if (!note) note = await createNote({ title });
    addCard({ type: 'note', noteId: note.id, x: 60 - view.x, y: 60 - view.y, w: 220, h: 120 });
  });
  document.getElementById('btn-canvas-add-sticky').addEventListener('click', () => {
    addCard({ type: 'sticky', text: '', x: 60 - view.x, y: 60 - view.y, w: 180, h: 140 });
  });
  document.getElementById('btn-canvas-add-shape').addEventListener('click', () => {
    const shape = confirm('OK = rectangle, Cancel = ellipse') ? 'rect' : 'ellipse';
    addCard({ type: 'shape', shape, x: 60 - view.x, y: 60 - view.y, w: 160, h: 100 });
  });
  document.getElementById('btn-canvas-zoom-reset').addEventListener('click', () => { view = { x: 0, y: 0, scale: 1 }; applyTransform(); });

  board.addEventListener('pointerdown', (e) => {
    if (e.target !== board && e.target !== inner) return;
    panStart = { x: e.clientX - view.x, y: e.clientY - view.y };
  });
  window.addEventListener('pointermove', (e) => {
    if (panStart) { view.x = e.clientX - panStart.x; view.y = e.clientY - panStart.y; applyTransform(); }
  });
  window.addEventListener('pointerup', () => { panStart = null; });
  board.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    view.scale = Math.max(0.2, Math.min(3, view.scale + delta));
    applyTransform();
  }, { passive: false });
}

function refreshSelect() {
  select.innerHTML = '';
  if (!state.canvases.size) {
    const opt = document.createElement('option');
    opt.textContent = 'No canvases — click "+ Card" to create one';
    select.appendChild(opt);
    return;
  }
  [...state.canvases.values()].forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.title;
    if (c.id === activeCanvasId) opt.selected = true;
    select.appendChild(opt);
  });
  if (!activeCanvasId) activeCanvasId = select.value;
}

async function getOrCreateActiveCanvas() {
  if (activeCanvasId && state.canvases.has(activeCanvasId)) return state.canvases.get(activeCanvasId);
  const c = await createCanvas('Untitled Canvas');
  activeCanvasId = c.id;
  refreshSelect();
  return c;
}

async function addCard(card) {
  const canvas = await getOrCreateActiveCanvas();
  card.id = uid();
  canvas.cards.push(card);
  await saveCanvas(canvas);
  renderBoard();
}

function applyTransform() {
  inner.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

function renderBoard() {
  applyTransform();
  inner.innerHTML = '';
  const canvas = state.canvases.get(activeCanvasId);
  if (!canvas) return;
  canvas.cards.forEach((card) => inner.appendChild(renderCard(canvas, card)));
}

function renderCard(canvas, card) {
  const el = document.createElement('div');
  el.className = 'canvas-card';
  el.style.left = card.x + 'px';
  el.style.top = card.y + 'px';
  el.style.width = card.w + 'px';
  el.style.height = card.h + 'px';

  if (card.type === 'note') {
    el.classList.add('linked-note');
    const note = state.notes.get(card.noteId);
    el.innerHTML = `<div class="card-handle"></div><div class="card-note-title">📄 ${note ? noteTitle(note) : '(deleted note)'}</div><div style="font-size:12px;color:var(--text-2);max-height:70%;overflow:hidden;">${note ? note.content.replace(/[#*_>`-]/g, '').slice(0, 140) : ''}</div>`;
    el.addEventListener('dblclick', (e) => {
      if (e.target.closest('.card-remove')) return;
      if (note) bus.emit('note:open', note.id);
    });
  } else if (card.type === 'sticky') {
    el.classList.add('sticky');
    el.innerHTML = `<div class="card-handle"></div><textarea placeholder="Sticky note…">${card.text || ''}</textarea>`;
    const ta = el.querySelector('textarea');
    ta.addEventListener('pointerdown', (e) => e.stopPropagation());
    ta.addEventListener('input', debounce(async () => { card.text = ta.value; await saveCanvas(canvas); }, 300));
  } else if (card.type === 'shape') {
    el.classList.add(card.shape === 'ellipse' ? 'shape-ellipse' : 'shape-rect');
    el.innerHTML = `<div class="card-handle"></div>`;
  }

  const remove = document.createElement('button');
  remove.className = 'card-remove';
  remove.textContent = '×';
  remove.addEventListener('click', async (e) => {
    e.stopPropagation();
    canvas.cards = canvas.cards.filter((c) => c.id !== card.id);
    await saveCanvas(canvas);
    renderBoard();
  });
  el.appendChild(remove);

  const resize = document.createElement('div');
  resize.className = 'card-resize';
  el.appendChild(resize);

  makeDraggable(el, card, canvas);
  makeResizable(resize, el, card, canvas);

  return el;
}

function makeDraggable(el, card, canvas) {
  const handle = el.querySelector('.card-handle') || el;
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const origX = card.x, origY = card.y;
    function onMove(ev) {
      card.x = origX + (ev.clientX - startX) / view.scale;
      card.y = origY + (ev.clientY - startY) / view.scale;
      el.style.left = card.x + 'px';
      el.style.top = card.y + 'px';
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      saveCanvas(canvas);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function makeResizable(handle, el, card, canvas) {
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const origW = card.w, origH = card.h;
    function onMove(ev) {
      card.w = Math.max(100, origW + (ev.clientX - startX) / view.scale);
      card.h = Math.max(60, origH + (ev.clientY - startY) / view.scale);
      el.style.width = card.w + 'px';
      el.style.height = card.h + 'px';
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      saveCanvas(canvas);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
