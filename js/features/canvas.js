/* =========================================================================
 * Nodalis — features/canvas.js
 * Infinite whiteboard: cards, stickies, shapes, frames, images, embedded
 * note references, freehand ink, and connectors that stay attached to the
 * things they join. Pan, zoom, multi-select, alignment guides, snapping.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;
  const SVGNS = 'http://www.w3.org/2000/svg';

  let wrap, layer, svg, grid, gridCtx;
  let canvasId = null;
  let doc = null;                       // { id, title, items:[], connections:[], strokes:[] }
  let view = { x: 0, y: 0, k: 1 };
  let tool = 'select';
  let selection = new Set();
  let interaction = null;
  let inkColor = null, inkWidth = 3;
  let marquee = null;

  const STICKY_COLORS = ['#ffe9a8', '#ffd0d6', '#cfe8ff', '#d4f5d4', '#e6d9ff', '#ffe0c2', '#d9f2f0', '#f0f0f0'];
  const SNAP = 6;
  const GRID_SIZE = 24;

  function init() {
    wrap = document.getElementById('canvas-wrap');
    layer = document.getElementById('canvas-layer');
    svg = document.getElementById('canvas-svg');
    grid = document.getElementById('canvas-grid');
    if (!wrap) return;
    gridCtx = grid.getContext('2d');

    const toolbar = document.getElementById('canvas-toolbar');
    U.delegate(toolbar, 'click', '[data-tool]', function (e, btn) { setTool(btn.dataset.tool); });
    U.delegate(toolbar, 'click', '[data-add]', function (e, btn) { addItem(btn.dataset.add); });

    document.getElementById('canvas-new').addEventListener('click', function () { N.commands.run('canvas.new'); });
    document.getElementById('canvas-rename').addEventListener('click', renameCanvas);
    document.getElementById('canvas-delete').addEventListener('click', deleteCanvas);
    document.getElementById('canvas-picker').addEventListener('change', function (e) { open(e.target.value); });
    document.getElementById('canvas-zoom-in').addEventListener('click', function () { zoomBy(1.2); });
    document.getElementById('canvas-zoom-out').addEventListener('click', function () { zoomBy(0.83); });
    document.getElementById('canvas-zoom-fit').addEventListener('click', fit);

    wrap.addEventListener('pointerdown', onPointerDown);
    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('pointerup', onPointerUp);
    wrap.addEventListener('pointercancel', onPointerUp);
    wrap.addEventListener('wheel', onWheel, { passive: false });
    wrap.addEventListener('contextmenu', onContextMenu);
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); });
    wrap.addEventListener('drop', onDrop);
    wrap.addEventListener('paste', onPaste);

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', U.debounce(function () { drawGrid(); }, 150));

    N.bus.on('view:changed', function (v) {
      if (v === 'canvas') { ensureOpen(); drawGrid(); }
    });
    N.bus.on('vault:changed', U.debounce(refreshPicker, 300));

    registerCommands();
    refreshPicker();
  }

  /* ------------------------------------------------------------ documents */

  function ensureOpen() {
    if (doc) return;
    const list = Array.from(N.store.state.canvases.values());
    if (list.length) open(list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0].id);
    else createCanvas('My first canvas');
  }

  async function createCanvas(title) {
    const canvas = {
      id: U.uid('cv'),
      title: title || 'Untitled canvas',
      items: [], connections: [], strokes: [],
      view: { x: 0, y: 0, k: 1 },
      createdAt: Date.now(),
    };
    await N.store.saveRecord('canvases', canvas);
    refreshPicker();
    open(canvas.id);
    return canvas;
  }

  function open(id) {
    const canvas = N.store.state.canvases.get(id);
    if (!canvas) { doc = null; canvasId = null; render(); return; }
    canvasId = id;
    N.store.state.activeCanvasId = id;
    doc = canvas;
    if (!Array.isArray(doc.items)) doc.items = [];
    if (!Array.isArray(doc.connections)) doc.connections = [];
    if (!Array.isArray(doc.strokes)) doc.strokes = [];
    view = Object.assign({ x: 0, y: 0, k: 1 }, doc.view || {});
    selection.clear();
    N.app.setView('canvas');
    refreshPicker();
    render();
    drawGrid();
  }

  function refreshPicker() {
    const picker = document.getElementById('canvas-picker');
    if (!picker) return;
    const list = Array.from(N.store.state.canvases.values())
      .sort(function (a, b) { return (a.title || '').localeCompare(b.title || ''); });
    picker.innerHTML = '';
    if (!list.length) {
      picker.appendChild(el('option', { value: '' }, 'No canvases yet'));
      return;
    }
    list.forEach(function (c) {
      picker.appendChild(el('option', { value: c.id, selected: c.id === canvasId }, c.title || 'Untitled'));
    });
  }

  const persist = U.debounce(function () {
    if (!doc) return;
    doc.view = { x: view.x, y: view.y, k: view.k };
    N.store.saveRecord('canvases', doc);
  }, 600);

  async function renameCanvas() {
    if (!doc) return;
    const next = await N.modal.prompt({ title: 'Rename canvas', value: doc.title, placeholder: 'Canvas name' });
    if (!next) return;
    doc.title = next.trim();
    await N.store.saveRecord('canvases', doc);
    refreshPicker();
  }

  async function deleteCanvas() {
    if (!doc) return;
    const ok = await N.modal.confirm({
      title: 'Delete "' + doc.title + '"?',
      message: 'Everything on this canvas will be removed. Undo with Ctrl/Cmd+Z.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    const id = doc.id;
    doc = null; canvasId = null;
    await N.store.deleteRecord('canvases', id);
    refreshPicker();
    ensureOpen();
  }

  /* ---------------------------------------------------------------- tools */

  function setTool(next) {
    tool = next;
    U.$$('#canvas-toolbar [data-tool]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tool === next); });
    wrap.style.cursor = next === 'pan' ? 'grab' : (next === 'pen' ? 'crosshair' : (next === 'eraser' ? 'cell' : 'default'));
  }

  /* ---------------------------------------------------------------- items */

  function centreOfView() {
    const rect = wrap.getBoundingClientRect();
    return {
      x: (rect.width / 2 - view.x) / view.k,
      y: (rect.height / 2 - view.y) / view.k,
    };
  }

  async function addItem(kind, atPoint) {
    if (!doc) { await createCanvas(); }
    const p = atPoint || centreOfView();
    const base = {
      id: U.uid('it'), kind: kind,
      x: Math.round(p.x - 90), y: Math.round(p.y - 60),
      w: 190, h: 130, z: nextZ(),
    };

    if (kind === 'card') {
      base.text = '';
      base.title = 'Card';
    } else if (kind === 'sticky') {
      base.text = '';
      base.color = STICKY_COLORS[doc.items.filter(function (i) { return i.kind === 'sticky'; }).length % STICKY_COLORS.length];
      base.w = 170; base.h = 170;
    } else if (kind === 'shape') {
      base.shape = 'rect';
      base.w = 160; base.h = 110;
    } else if (kind === 'frame') {
      base.title = 'Frame';
      base.w = 420; base.h = 300;
      base.z = -1;
    } else if (kind === 'noteref') {
      const noteId = await pickNote();
      if (!noteId) return;
      base.noteId = noteId;
      base.w = 240; base.h = 170;
    } else if (kind === 'image') {
      const file = await pickImageFile();
      if (!file) return;
      const attId = U.uid('att');
      const ext = '.' + ((file.type.split('/')[1] || 'png').replace('jpeg', 'jpg'));
      await N.db.put('attachments', { id: attId, name: file.name, type: file.type, ext: ext, blob: file, createdAt: Date.now() });
      if (N.vault.isFolderMode()) N.vault.saveAttachment(attId, ext, file);
      base.attachmentId = attId;
      base.w = 260; base.h = 200;
    } else if (kind === 'text') {
      base.text = '';
      base.h = 40;
    }

    doc.items.push(base);
    persist();
    render();
    selection.clear();
    selection.add(base.id);
    paintSelection();
    // Jump straight into typing for text-bearing items.
    if (['card', 'sticky', 'text'].indexOf(kind) !== -1) {
      setTimeout(function () {
        const node = layer.querySelector('[data-item="' + base.id + '"] .canvas-item-body');
        if (node) { node.focus(); placeCaretEnd(node); }
      }, 60);
    }
    return base;
  }

  function nextZ() {
    return doc.items.reduce(function (max, i) { return Math.max(max, i.z || 0); }, 0) + 1;
  }

  function pickNote() {
    const notes = N.store.allNotes()
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
      .slice(0, 60)
      .map(function (n) { return { value: n.id, label: N.store.noteTitle(n), description: n.folder || 'Vault root', icon: 'note' }; });
    if (!notes.length) { N.toast.info('Create a note first, then you can embed it here.'); return Promise.resolve(null); }
    return N.modal.choose({ title: 'Embed which note?', options: notes });
  }

  function pickImageFile() {
    return new Promise(function (resolve) {
      const input = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      input.addEventListener('change', function () {
        resolve(input.files && input.files[0] ? input.files[0] : null);
        input.remove();
      });
      // A cancelled picker fires no event in some browsers; clean up on refocus.
      window.addEventListener('focus', function once() {
        window.removeEventListener('focus', once);
        setTimeout(function () { if (input.parentNode) { input.remove(); resolve(null); } }, 400);
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  /* --------------------------------------------------------------- render */

  function render() {
    if (!layer) return;
    // Keep the SVG node; replace everything else.
    Array.prototype.slice.call(layer.children).forEach(function (c) { if (c !== svg) c.remove(); });

    const picker = document.getElementById('canvas-picker');
    if (!doc) {
      applyTransform();
      const empty = el('div', { style: { position: 'absolute', inset: '0' } });
      empty.appendChild(emptyState());
      layer.appendChild(empty);
      return;
    }

    doc.items
      .slice()
      .sort(function (a, b) { return (a.z || 0) - (b.z || 0); })
      .forEach(function (item) { layer.appendChild(buildItem(item)); });

    drawConnections();
    drawInk();
    applyTransform();
    paintSelection();
  }

  function emptyState() {
    const holder = el('div', {
      style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' },
    });
    const box = el('div.empty-state');
    box.appendChild(N.icons.node('canvas', { size: 44 }));
    box.appendChild(el('div.empty-state-title', null, 'No canvas open'));
    box.appendChild(el('p.empty-state-text', null, 'A canvas is an infinite board for cards, sketches and connections.'));
    const actions = el('div.empty-state-actions');
    actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { createCanvas(); } }, 'Create a canvas'));
    box.appendChild(actions);
    holder.appendChild(box);
    return holder;
  }

  function buildItem(item) {
    const node = el('div.canvas-item', {
      dataset: { item: item.id, kind: item.kind, shape: item.shape || '' },
      style: {
        left: item.x + 'px', top: item.y + 'px',
        width: item.w + 'px', height: item.h + 'px',
        zIndex: String(item.z || 0),
      },
    });
    if (item.kind === 'sticky') node.style.background = item.color || STICKY_COLORS[0];
    if (item.kind === 'shape') node.style.borderColor = item.color || 'var(--accent)';

    /* head */
    if (item.kind !== 'shape' && item.kind !== 'image') {
      const head = el('div.canvas-item-head');
      const label = item.kind === 'noteref'
        ? (N.store.getNote(item.noteId) ? N.store.noteTitle(N.store.getNote(item.noteId)) : 'Missing note')
        : (item.title || labelFor(item.kind));
      head.appendChild(N.icons.node(iconFor(item.kind), { size: 13 }));
      head.appendChild(el('span.truncate', { style: { flex: '1' } }, label));
      const menuBtn = el('button.icon-btn.icon-btn-sm', { type: 'button', title: 'Item actions' });
      menuBtn.appendChild(N.icons.node('more', { size: 13 }));
      menuBtn.addEventListener('click', function (e) { e.stopPropagation(); openItemMenu(item, e.currentTarget); });
      head.appendChild(menuBtn);
      node.appendChild(head);
    }

    /* body */
    const body = el('div.canvas-item-body');
    if (item.kind === 'noteref') {
      const note = N.store.getNote(item.noteId);
      if (note) {
        body.innerHTML = N.markdown.render(U.truncate(note.content, 900), { depth: 2, headingAnchors: false });
        body.classList.add('prose');
        body.style.fontSize = '12px';
        body.addEventListener('dblclick', function () { N.app.openNote(item.noteId); });
      } else {
        body.appendChild(el('span.dim.small', null, 'This note no longer exists.'));
      }
    } else if (item.kind === 'image') {
      const img = el('img', { alt: '' });
      N.db.get('attachments', item.attachmentId).then(function (row) {
        if (row && row.blob) img.src = URL.createObjectURL(row.blob);
        else body.appendChild(el('span.dim.small', null, 'Image missing'));
      });
      body.appendChild(img);
    } else if (item.kind !== 'shape') {
      body.setAttribute('contenteditable', 'plaintext-only');
      body.setAttribute('data-placeholder', item.kind === 'sticky' ? 'Write something…' : 'Type here…');
      body.textContent = item.text || '';
      body.addEventListener('input', U.debounce(function () {
        item.text = body.textContent;
        persist();
      }, 350));
      body.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      body.addEventListener('blur', function () { item.text = body.textContent; persist(); });
    }
    node.appendChild(body);

    /* handles + anchors */
    ['nw', 'ne', 'sw', 'se'].forEach(function (dir) {
      node.appendChild(el('div.canvas-handle', { dataset: { dir: dir, resize: item.id } }));
    });
    ['t', 'r', 'b', 'l'].forEach(function (side) {
      node.appendChild(el('div.canvas-anchor', { dataset: { side: side, anchor: item.id }, title: 'Drag to connect' }));
    });

    return node;
  }

  function labelFor(kind) {
    return { card: 'Card', sticky: 'Sticky', frame: 'Frame', noteref: 'Note', text: 'Text', image: 'Image' }[kind] || kind;
  }
  function iconFor(kind) {
    return { card: 'note', sticky: 'sticky', frame: 'layout', noteref: 'link', text: 'type', image: 'image' }[kind] || 'box';
  }

  function applyTransform() {
    layer.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
    const label = document.getElementById('canvas-zoom-level');
    if (label) label.textContent = Math.round(view.k * 100) + '%';
    drawGrid();
  }

  function drawGrid() {
    if (!grid || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    grid.width = Math.round(rect.width * dpr);
    grid.height = Math.round(rect.height * dpr);
    grid.style.width = rect.width + 'px';
    grid.style.height = rect.height + 'px';
    gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gridCtx.clearRect(0, 0, rect.width, rect.height);

    const step = GRID_SIZE * view.k;
    if (step < 7) return;                     // too dense to be useful
    let color = 'rgba(128,128,128,0.16)';
    try { color = getComputedStyle(document.body).getPropertyValue('--border').trim() || color; } catch (err) {}
    gridCtx.fillStyle = color;
    const offX = ((view.x % step) + step) % step;
    const offY = ((view.y % step) + step) % step;
    const dot = view.k > 1.6 ? 1.6 : 1.1;
    for (let x = offX; x < rect.width; x += step) {
      for (let y = offY; y < rect.height; y += step) {
        gridCtx.fillRect(x, y, dot, dot);
      }
    }
  }

  /* --------------------------------------------------------- connections */

  function drawConnections() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!doc) return;
    const byId = new Map();
    doc.items.forEach(function (i) { byId.set(i.id, i); });

    doc.connections = doc.connections.filter(function (c) { return byId.has(c.from) && byId.has(c.to); });

    doc.connections.forEach(function (conn) {
      const a = anchorPoint(byId.get(conn.from), conn.fromSide);
      const b = anchorPoint(byId.get(conn.to), conn.toSide);
      const d = curvePath(a, b, conn.fromSide, conn.toSide);

      const hit = document.createElementNS(SVGNS, 'path');
      hit.setAttribute('class', 'conn-hit');
      hit.setAttribute('d', d);
      hit.dataset.conn = conn.id;
      svg.appendChild(hit);

      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('class', 'conn');
      path.setAttribute('d', d);
      path.dataset.conn = conn.id;
      if (conn.style === 'dashed') path.setAttribute('stroke-dasharray', '6 5');
      path.setAttribute('marker-end', 'url(#arrow)');
      svg.appendChild(path);

      if (conn.label) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const text = document.createElementNS(SVGNS, 'text');
        text.setAttribute('x', mid.x);
        text.setAttribute('y', mid.y - 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '11');
        text.setAttribute('fill', 'currentColor');
        text.style.pointerEvents = 'none';
        text.textContent = conn.label;
        svg.appendChild(text);
      }
    });

    // Arrow marker.
    const defs = document.createElementNS(SVGNS, 'defs');
    defs.innerHTML =
      '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>';
    svg.insertBefore(defs, svg.firstChild);
  }

  function anchorPoint(item, side) {
    if (!item) return { x: 0, y: 0 };
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    if (side === 't') return { x: cx, y: item.y };
    if (side === 'b') return { x: cx, y: item.y + item.h };
    if (side === 'l') return { x: item.x, y: cy };
    if (side === 'r') return { x: item.x + item.w, y: cy };
    return { x: cx, y: cy };
  }

  function curvePath(a, b, fromSide, toSide) {
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    const bend = Math.max(30, Math.min(140, (dx + dy) / 3));
    const c1 = { x: a.x, y: a.y };
    const c2 = { x: b.x, y: b.y };
    if (fromSide === 'l') c1.x -= bend; else if (fromSide === 'r') c1.x += bend;
    else if (fromSide === 't') c1.y -= bend; else c1.y += bend;
    if (toSide === 'l') c2.x -= bend; else if (toSide === 'r') c2.x += bend;
    else if (toSide === 't') c2.y -= bend; else c2.y += bend;
    return 'M' + a.x + ' ' + a.y + 'C' + c1.x + ' ' + c1.y + ',' + c2.x + ' ' + c2.y + ',' + b.x + ' ' + b.y;
  }

  /* ------------------------------------------------------------------ ink */

  function drawInk() {
    if (!doc || !doc.strokes.length) return;
    doc.strokes.forEach(function (stroke) {
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', strokeToPath(stroke.points));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', stroke.color || 'currentColor');
      path.setAttribute('stroke-width', String(stroke.width || 3));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.dataset.stroke = stroke.id;
      path.style.pointerEvents = 'stroke';
      svg.appendChild(path);
    });
  }

  function strokeToPath(points) {
    if (!points || points.length < 2) {
      if (points && points.length === 1) return 'M' + points[0][0] + ' ' + points[0][1] + 'l0.1 0.1';
      return '';
    }
    let d = 'M' + points[0][0] + ' ' + points[0][1];
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i][0] + points[i + 1][0]) / 2;
      const my = (points[i][1] + points[i + 1][1]) / 2;
      d += 'Q' + points[i][0] + ' ' + points[i][1] + ',' + mx + ' ' + my;
    }
    const last = points[points.length - 1];
    d += 'L' + last[0] + ' ' + last[1];
    return d;
  }

  /* -------------------------------------------------------------- pointer */

  function toWorld(clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    return { x: (clientX - rect.left - view.x) / view.k, y: (clientY - rect.top - view.y) / view.k };
  }

  function onPointerDown(e) {
    if (!doc) return;
    if (e.button === 2) return;
    const target = e.target;

    // The floating controls sit inside the board. Without this, pressing one
    // captures the pointer on the wrapper, the click never reaches the button,
    // and a selection marquee starts underneath instead.
    if (target.closest && target.closest('.canvas-toolbar, .canvas-zoom')) return;

    const world = toWorld(e.clientX, e.clientY);

    /* connector anchor */
    const anchor = target.closest ? target.closest('[data-anchor]') : null;
    if (anchor) {
      e.preventDefault();
      wrap.setPointerCapture(e.pointerId);
      interaction = { type: 'connect', from: anchor.dataset.anchor, fromSide: anchor.dataset.side, to: world };
      return;
    }

    /* resize handle */
    const handle = target.closest ? target.closest('[data-resize]') : null;
    if (handle) {
      e.preventDefault();
      wrap.setPointerCapture(e.pointerId);
      const item = findItem(handle.dataset.resize);
      interaction = { type: 'resize', item: item, dir: handle.dataset.dir, start: world, orig: { x: item.x, y: item.y, w: item.w, h: item.h } };
      return;
    }

    /* existing connection */
    const connPath = target.closest ? target.closest('[data-conn]') : null;
    if (connPath && tool === 'select') {
      e.preventDefault();
      openConnectionMenu(connPath.dataset.conn, e.clientX, e.clientY);
      return;
    }

    /* pen / eraser */
    if (tool === 'pen') {
      e.preventDefault();
      wrap.setPointerCapture(e.pointerId);
      const stroke = { id: U.uid('sk'), points: [[round(world.x), round(world.y)]], color: inkColor || currentAccent(), width: inkWidth };
      doc.strokes.push(stroke);
      interaction = { type: 'draw', stroke: stroke };
      return;
    }
    if (tool === 'eraser') {
      const strokePath = target.closest ? target.closest('[data-stroke]') : null;
      if (strokePath) {
        doc.strokes = doc.strokes.filter(function (s) { return s.id !== strokePath.dataset.stroke; });
        persist(); render();
      }
      return;
    }

    /* item drag */
    const itemNode = target.closest ? target.closest('[data-item]') : null;
    if (itemNode && tool === 'select') {
      const item = findItem(itemNode.dataset.item);
      if (!item) return;
      const editing = target.closest('.canvas-item-body[contenteditable]');
      if (editing && selection.has(item.id)) return;   // let them type
      e.preventDefault();
      wrap.setPointerCapture(e.pointerId);

      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (selection.has(item.id)) selection.delete(item.id);
        else selection.add(item.id);
      } else if (!selection.has(item.id)) {
        selection.clear();
        selection.add(item.id);
      }
      paintSelection();

      const moving = Array.from(selection).map(findItem).filter(Boolean);
      interaction = {
        type: 'move', start: world, moved: false,
        items: moving.map(function (i) { return { item: i, ox: i.x, oy: i.y }; }),
      };
      return;
    }

    /* pan or marquee on empty space */
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    if (tool === 'pan' || e.button === 1 || e.spaceKey) {
      interaction = { type: 'pan', startX: e.clientX - view.x, startY: e.clientY - view.y };
      wrap.style.cursor = 'grabbing';
    } else {
      if (!e.shiftKey) { selection.clear(); paintSelection(); }
      interaction = { type: 'marquee', start: world };
      marquee = el('div.canvas-marquee');
      wrap.appendChild(marquee);
    }
  }

  function onPointerMove(e) {
    if (!interaction || !doc) return;
    const world = toWorld(e.clientX, e.clientY);

    if (interaction.type === 'pan') {
      view.x = e.clientX - interaction.startX;
      view.y = e.clientY - interaction.startY;
      applyTransform();
      return;
    }

    if (interaction.type === 'move') {
      const dx = world.x - interaction.start.x;
      const dy = world.y - interaction.start.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) interaction.moved = true;
      clearGuides();
      const snapped = computeSnap(interaction.items, dx, dy);
      interaction.items.forEach(function (entry) {
        entry.item.x = round(entry.ox + dx + snapped.dx);
        entry.item.y = round(entry.oy + dy + snapped.dy);
        const node = layer.querySelector('[data-item="' + entry.item.id + '"]');
        if (node) { node.style.left = entry.item.x + 'px'; node.style.top = entry.item.y + 'px'; node.classList.add('is-dragging'); }
      });
      drawConnections();
      return;
    }

    if (interaction.type === 'resize') {
      const item = interaction.item;
      const o = interaction.orig;
      const dx = world.x - interaction.start.x;
      const dy = world.y - interaction.start.y;
      const min = 60;
      if (interaction.dir.indexOf('e') !== -1) item.w = Math.max(min, round(o.w + dx));
      if (interaction.dir.indexOf('s') !== -1) item.h = Math.max(min, round(o.h + dy));
      if (interaction.dir.indexOf('w') !== -1) {
        const w = Math.max(min, round(o.w - dx));
        item.x = round(o.x + (o.w - w)); item.w = w;
      }
      if (interaction.dir.indexOf('n') !== -1) {
        const h = Math.max(min, round(o.h - dy));
        item.y = round(o.y + (o.h - h)); item.h = h;
      }
      const node = layer.querySelector('[data-item="' + item.id + '"]');
      if (node) {
        node.style.left = item.x + 'px'; node.style.top = item.y + 'px';
        node.style.width = item.w + 'px'; node.style.height = item.h + 'px';
      }
      drawConnections();
      return;
    }

    if (interaction.type === 'draw') {
      const last = interaction.stroke.points[interaction.stroke.points.length - 1];
      if (Math.hypot(world.x - last[0], world.y - last[1]) < 1.6) return;
      interaction.stroke.points.push([round(world.x), round(world.y)]);
      let path = svg.querySelector('[data-stroke="' + interaction.stroke.id + '"]');
      if (!path) {
        path = document.createElementNS(SVGNS, 'path');
        path.dataset.stroke = interaction.stroke.id;
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', interaction.stroke.color);
        path.setAttribute('stroke-width', String(interaction.stroke.width));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
      }
      path.setAttribute('d', strokeToPath(interaction.stroke.points));
      return;
    }

    if (interaction.type === 'connect') {
      interaction.to = world;
      const from = findItem(interaction.from);
      if (!from) return;
      const a = anchorPoint(from, interaction.fromSide);
      let temp = svg.querySelector('#temp-conn');
      if (!temp) {
        temp = document.createElementNS(SVGNS, 'path');
        temp.id = 'temp-conn';
        temp.setAttribute('class', 'conn');
        temp.setAttribute('stroke-dasharray', '5 4');
        svg.appendChild(temp);
      }
      temp.setAttribute('d', curvePath(a, world, interaction.fromSide, 'l'));
      return;
    }

    if (interaction.type === 'marquee' && marquee) {
      const rect = wrap.getBoundingClientRect();
      const x1 = interaction.start.x * view.k + view.x;
      const y1 = interaction.start.y * view.k + view.y;
      const x2 = e.clientX - rect.left;
      const y2 = e.clientY - rect.top;
      marquee.style.left = Math.min(x1, x2) + 'px';
      marquee.style.top = Math.min(y1, y2) + 'px';
      marquee.style.width = Math.abs(x2 - x1) + 'px';
      marquee.style.height = Math.abs(y2 - y1) + 'px';
    }
  }

  function onPointerUp(e) {
    if (!interaction) { wrap.style.cursor = tool === 'pan' ? 'grab' : 'default'; return; }
    const world = toWorld(e.clientX, e.clientY);

    if (interaction.type === 'connect') {
      const temp = svg.querySelector('#temp-conn');
      if (temp) temp.remove();
      const targetNode = document.elementFromPoint(e.clientX, e.clientY);
      const itemNode = targetNode && targetNode.closest ? targetNode.closest('[data-item]') : null;
      if (itemNode && itemNode.dataset.item !== interaction.from) {
        const anchorNode = targetNode.closest('[data-anchor]');
        doc.connections.push({
          id: U.uid('cn'),
          from: interaction.from, fromSide: interaction.fromSide,
          to: itemNode.dataset.item, toSide: anchorNode ? anchorNode.dataset.side : 'l',
        });
        persist();
      }
      drawConnections();
    } else if (interaction.type === 'marquee') {
      const x1 = Math.min(interaction.start.x, world.x), x2 = Math.max(interaction.start.x, world.x);
      const y1 = Math.min(interaction.start.y, world.y), y2 = Math.max(interaction.start.y, world.y);
      doc.items.forEach(function (item) {
        if (item.x + item.w >= x1 && item.x <= x2 && item.y + item.h >= y1 && item.y <= y2) selection.add(item.id);
      });
      paintSelection();
      if (marquee) { marquee.remove(); marquee = null; }
    } else if (interaction.type === 'move') {
      U.$$('.canvas-item.is-dragging', layer).forEach(function (n) { n.classList.remove('is-dragging'); });
      clearGuides();
      if (interaction.moved) persist();
    } else if (interaction.type === 'resize' || interaction.type === 'draw') {
      persist();
    }

    interaction = null;
    wrap.style.cursor = tool === 'pan' ? 'grab' : 'default';
    try { wrap.releasePointerCapture(e.pointerId); } catch (err) { /* fine */ }
  }

  function round(v) { return Math.round(v); }

  function currentAccent() {
    try { return getComputedStyle(document.body).getPropertyValue('--text-0').trim() || '#333'; }
    catch (err) { return '#333'; }
  }

  /* --------------------------------------------------------------- guides */

  function computeSnap(movingEntries, dx, dy) {
    const movingIds = new Set(movingEntries.map(function (e) { return e.item.id; }));
    const others = doc.items.filter(function (i) { return !movingIds.has(i.id); });
    if (!others.length) return { dx: 0, dy: 0 };

    let bestX = null, bestY = null;
    movingEntries.forEach(function (entry) {
      const x = entry.ox + dx, y = entry.oy + dy;
      const edgesX = [x, x + entry.item.w / 2, x + entry.item.w];
      const edgesY = [y, y + entry.item.h / 2, y + entry.item.h];
      others.forEach(function (o) {
        const targetsX = [o.x, o.x + o.w / 2, o.x + o.w];
        const targetsY = [o.y, o.y + o.h / 2, o.y + o.h];
        edgesX.forEach(function (ex, ei) {
          targetsX.forEach(function (tx) {
            const delta = tx - ex;
            if (Math.abs(delta) < SNAP / view.k && (bestX === null || Math.abs(delta) < Math.abs(bestX.delta))) {
              bestX = { delta: delta, at: tx };
            }
          });
        });
        edgesY.forEach(function (ey) {
          targetsY.forEach(function (ty) {
            const delta = ty - ey;
            if (Math.abs(delta) < SNAP / view.k && (bestY === null || Math.abs(delta) < Math.abs(bestY.delta))) {
              bestY = { delta: delta, at: ty };
            }
          });
        });
      });
    });

    if (bestX) showGuide('v', bestX.at);
    if (bestY) showGuide('h', bestY.at);
    return { dx: bestX ? bestX.delta : 0, dy: bestY ? bestY.delta : 0 };
  }

  function showGuide(axis, at) {
    const guide = el('div.canvas-guide.' + axis);
    if (axis === 'v') { guide.style.left = at + 'px'; guide.style.top = '-4000px'; guide.style.height = '8000px'; }
    else { guide.style.top = at + 'px'; guide.style.left = '-4000px'; guide.style.width = '8000px'; }
    layer.appendChild(guide);
  }

  function clearGuides() { U.$$('.canvas-guide', layer).forEach(function (g) { g.remove(); }); }

  function paintSelection() {
    U.$$('.canvas-item', layer).forEach(function (node) {
      node.classList.toggle('is-selected', selection.has(node.dataset.item));
    });
  }

  function findItem(id) { return doc ? doc.items.find(function (i) { return i.id === id; }) : null; }

  /* --------------------------------------------------------------- zoom */

  function onWheel(e) {
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      zoomAt(U.clamp(view.k * factor, 0.1, 4), e.clientX - rect.left, e.clientY - rect.top);
    } else {
      view.x -= e.deltaX;
      view.y -= e.deltaY;
      applyTransform();
      persist();
    }
  }

  function zoomAt(k, px, py) {
    const wx = (px - view.x) / view.k, wy = (py - view.y) / view.k;
    view.k = k;
    view.x = px - wx * k;
    view.y = py - wy * k;
    applyTransform();
    persist();
  }

  function zoomBy(factor) {
    const rect = wrap.getBoundingClientRect();
    zoomAt(U.clamp(view.k * factor, 0.1, 4), rect.width / 2, rect.height / 2);
  }

  function fit() {
    if (!doc || !doc.items.length) { view = { x: 0, y: 0, k: 1 }; applyTransform(); return; }
    const rect = wrap.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    doc.items.forEach(function (i) {
      minX = Math.min(minX, i.x); minY = Math.min(minY, i.y);
      maxX = Math.max(maxX, i.x + i.w); maxY = Math.max(maxY, i.y + i.h);
    });
    const pad = 60;
    const k = U.clamp(Math.min((rect.width - pad * 2) / (maxX - minX), (rect.height - pad * 2) / (maxY - minY)), 0.1, 2);
    view.k = k;
    view.x = rect.width / 2 - ((minX + maxX) / 2) * k;
    view.y = rect.height / 2 - ((minY + maxY) / 2) * k;
    applyTransform();
    persist();
  }

  /* ---------------------------------------------------------------- menus */

  function onContextMenu(e) {
    if (!doc) return;
    e.preventDefault();
    const itemNode = e.target.closest ? e.target.closest('[data-item]') : null;
    if (itemNode) {
      const item = findItem(itemNode.dataset.item);
      if (item) { openItemMenu(item, null, e.clientX, e.clientY); return; }
    }
    const world = toWorld(e.clientX, e.clientY);
    N.menu.show([
      { label: 'Add card', icon: 'note', onClick: function () { addItem('card', world); } },
      { label: 'Add sticky', icon: 'sticky', onClick: function () { addItem('sticky', world); } },
      { label: 'Add shape', icon: 'shapes', onClick: function () { addItem('shape', world); } },
      { label: 'Add frame', icon: 'layout', onClick: function () { addItem('frame', world); } },
      { label: 'Embed a note', icon: 'link', onClick: function () { addItem('noteref', world); } },
      { label: 'Add image', icon: 'image', onClick: function () { addItem('image', world); } },
      { separator: true },
      { label: 'Select all', icon: 'grid', hint: 'Mod+A', onClick: selectAll },
      { label: 'Fit to content', icon: 'maximize', onClick: fit },
      { label: 'Reset zoom', icon: 'refresh', onClick: function () { view.k = 1; applyTransform(); } },
      { separator: true },
      { label: 'Export canvas as PNG', icon: 'image', onClick: function () { N.exporter.exportCanvasPng(doc); } },
    ], { x: e.clientX, y: e.clientY });
  }

  function openItemMenu(item, anchor, x, y) {
    const items = [
      { label: 'Bring to front', icon: 'layers', onClick: function () { item.z = nextZ(); persist(); render(); } },
      { label: 'Send to back', icon: 'layers', onClick: function () {
        const min = doc.items.reduce(function (m, i) { return Math.min(m, i.z || 0); }, 0);
        item.z = min - 1; persist(); render();
      } },
      { label: 'Duplicate', icon: 'duplicate', onClick: function () {
        const copy = U.deepClone(item);
        copy.id = U.uid('it'); copy.x += 20; copy.y += 20; copy.z = nextZ();
        doc.items.push(copy); persist(); render();
      } },
    ];

    if (item.kind === 'sticky') {
      items.push({ separator: true }, { header: 'Colour' });
      STICKY_COLORS.forEach(function (color, i) {
        items.push({
          label: ['Butter', 'Blush', 'Sky', 'Mint', 'Lilac', 'Peach', 'Teal', 'Paper'][i],
          icon: 'droplet',
          checked: item.color === color,
          onClick: function () { item.color = color; persist(); render(); },
        });
      });
    }
    if (item.kind === 'shape') {
      items.push({ separator: true }, { header: 'Shape' });
      ['rect', 'ellipse', 'diamond'].forEach(function (shape) {
        items.push({
          label: shape.charAt(0).toUpperCase() + shape.slice(1),
          icon: 'shapes', checked: item.shape === shape,
          onClick: function () { item.shape = shape; persist(); render(); },
        });
      });
    }
    if (item.kind === 'noteref') {
      items.push({ separator: true }, {
        label: 'Open this note', icon: 'external',
        onClick: function () { N.app.openNote(item.noteId); },
      });
    }
    if (item.kind === 'card' || item.kind === 'sticky') {
      items.push({
        label: 'Turn into a note', icon: 'file-plus',
        onClick: async function () {
          const text = item.text || '';
          const title = (text.split('\n')[0] || 'From canvas').slice(0, 60).trim() || 'From canvas';
          const note = await N.store.createNote({ title: title, content: text });
          item.kind = 'noteref'; item.noteId = note.id;
          persist(); render();
          N.toast.success('Created "' + N.store.noteTitle(note) + '"', { ms: 2200 });
        },
      });
    }

    items.push({ separator: true }, {
      label: 'Delete', icon: 'trash', danger: true,
      onClick: function () { deleteItems([item.id]); },
    });

    N.menu.show(items, anchor ? { anchor: anchor, align: 'right' } : { x: x, y: y });
  }

  function openConnectionMenu(connId, x, y) {
    const conn = doc.connections.find(function (c) { return c.id === connId; });
    if (!conn) return;
    N.menu.show([
      { label: 'Add label…', icon: 'type', onClick: async function () {
        const label = await N.modal.prompt({ title: 'Connection label', value: conn.label || '', required: false });
        if (label === null) return;
        conn.label = label.trim(); persist(); drawConnections();
      } },
      { label: conn.style === 'dashed' ? 'Make solid' : 'Make dashed', icon: 'divider', onClick: function () {
        conn.style = conn.style === 'dashed' ? 'solid' : 'dashed'; persist(); drawConnections();
      } },
      { label: 'Reverse direction', icon: 'repeat', onClick: function () {
        const f = conn.from, fs = conn.fromSide;
        conn.from = conn.to; conn.fromSide = conn.toSide;
        conn.to = f; conn.toSide = fs;
        persist(); drawConnections();
      } },
      { separator: true },
      { label: 'Delete connection', icon: 'trash', danger: true, onClick: function () {
        doc.connections = doc.connections.filter(function (c) { return c.id !== connId; });
        persist(); drawConnections();
      } },
    ], { x: x, y: y });
  }

  function deleteItems(ids) {
    if (!doc || !ids.length) return;
    const removed = doc.items.filter(function (i) { return ids.indexOf(i.id) !== -1; }).map(U.deepClone);
    const removedConns = doc.connections.filter(function (c) { return ids.indexOf(c.from) !== -1 || ids.indexOf(c.to) !== -1; }).map(U.deepClone);
    doc.items = doc.items.filter(function (i) { return ids.indexOf(i.id) === -1; });
    doc.connections = doc.connections.filter(function (c) { return ids.indexOf(c.from) === -1 && ids.indexOf(c.to) === -1; });
    selection.clear();
    persist(); render();
    N.store.pushUndo('Delete canvas items',
      function () { doc.items = doc.items.concat(removed); doc.connections = doc.connections.concat(removedConns); persist(); render(); },
      function () { deleteItems(ids); });
  }

  function selectAll() {
    if (!doc) return;
    doc.items.forEach(function (i) { selection.add(i.id); });
    paintSelection();
  }

  /* ------------------------------------------------------------ keyboard */

  function onKeyDown(e) {
    if (N.store.state.activeView !== 'canvas' || !doc) return;
    if (N.shortcuts.inTextInput(e.target)) return;

    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selection.size) { e.preventDefault(); deleteItems(Array.from(selection)); }
      return;
    }
    if (e.key === 'Escape') { selection.clear(); paintSelection(); setTool('select'); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selection.size) {
      e.preventDefault();
      Array.from(selection).forEach(function (id) {
        const item = findItem(id);
        if (!item) return;
        const copy = U.deepClone(item);
        copy.id = U.uid('it'); copy.x += 20; copy.y += 20; copy.z = nextZ();
        doc.items.push(copy);
      });
      persist(); render();
      return;
    }

    const toolKeys = { v: 'select', h: 'pan', p: 'pen', e: 'eraser' };
    if (toolKeys[e.key.toLowerCase()] && !e.metaKey && !e.ctrlKey) { setTool(toolKeys[e.key.toLowerCase()]); return; }
    const addKeys = { c: 'card', s: 'sticky', r: 'shape', f: 'frame', n: 'noteref', i: 'image' };
    if (addKeys[e.key.toLowerCase()] && !e.metaKey && !e.ctrlKey) { e.preventDefault(); addItem(addKeys[e.key.toLowerCase()]); return; }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1 && selection.size) {
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
      const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
      selection.forEach(function (id) {
        const item = findItem(id);
        if (!item) return;
        item.x += dx; item.y += dy;
      });
      render(); persist();
    }
  }

  /* ------------------------------------------------------------ drop/paste */

  async function onDrop(e) {
    if (!doc) return;
    e.preventDefault();
    const world = toWorld(e.clientX, e.clientY);
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.indexOf('image/') !== 0) continue;
        const attId = U.uid('att');
        const ext = '.' + ((files[i].type.split('/')[1] || 'png').replace('jpeg', 'jpg'));
        await N.db.put('attachments', { id: attId, name: files[i].name, type: files[i].type, ext: ext, blob: files[i], createdAt: Date.now() });
        doc.items.push({ id: U.uid('it'), kind: 'image', attachmentId: attId, x: round(world.x) + i * 24, y: round(world.y) + i * 24, w: 260, h: 200, z: nextZ() });
      }
      persist(); render();
      return;
    }
    const text = e.dataTransfer.getData('text/plain');
    if (text) {
      doc.items.push({ id: U.uid('it'), kind: 'sticky', text: text, color: STICKY_COLORS[0], x: round(world.x), y: round(world.y), w: 170, h: 170, z: nextZ() });
      persist(); render();
    }
  }

  async function onPaste(e) {
    if (N.store.state.activeView !== 'canvas' || !doc) return;
    if (N.shortcuts.inTextInput(e.target)) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const centre = centreOfView();
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) {
        const file = items[i].getAsFile();
        if (!file) continue;
        e.preventDefault();
        const attId = U.uid('att');
        const ext = '.' + ((file.type.split('/')[1] || 'png').replace('jpeg', 'jpg'));
        await N.db.put('attachments', { id: attId, name: 'pasted', type: file.type, ext: ext, blob: file, createdAt: Date.now() });
        doc.items.push({ id: U.uid('it'), kind: 'image', attachmentId: attId, x: round(centre.x), y: round(centre.y), w: 260, h: 200, z: nextZ() });
        persist(); render();
        return;
      }
    }
  }

  function placeCaretEnd(node) {
    try {
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) { /* focus alone is fine */ }
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'canvas.open', title: 'Open canvas', group: 'View', icon: 'canvas', accel: 'Mod+Shift+G',
        run: function () { N.app.setView('canvas'); ensureOpen(); } },
      { id: 'canvas.new', title: 'New canvas', group: 'Create', icon: 'canvas',
        run: async function () {
          const title = await N.modal.prompt({ title: 'New canvas', placeholder: 'Canvas name', value: 'Untitled canvas' });
          if (title === null) return;
          await createCanvas(title || 'Untitled canvas');
        } },
      { id: 'canvas.addCard', title: 'Canvas: add card', group: 'Canvas', icon: 'note',
        when: function () { return N.store.state.activeView === 'canvas'; }, run: function () { addItem('card'); } },
      { id: 'canvas.addSticky', title: 'Canvas: add sticky', group: 'Canvas', icon: 'sticky',
        when: function () { return N.store.state.activeView === 'canvas'; }, run: function () { addItem('sticky'); } },
      { id: 'canvas.fit', title: 'Canvas: fit to content', group: 'Canvas', icon: 'maximize',
        when: function () { return N.store.state.activeView === 'canvas'; }, run: fit },
      { id: 'canvas.exportPng', title: 'Canvas: export as PNG', group: 'Canvas', icon: 'image',
        when: function () { return N.store.state.activeView === 'canvas' && !!doc; },
        run: function () { N.exporter.exportCanvasPng(doc); } },
    ]);
  }

  N.canvas = {
    init: init, open: open, render: render, fit: fit,
    current: function () { return doc; },
    createCanvas: createCanvas,
  };
})(window.NODALIS = window.NODALIS || {});
