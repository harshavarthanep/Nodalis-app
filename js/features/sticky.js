/* =========================================================================
 * Nodalis — features/sticky.js
 * A wall of coloured sticky notes. Each one holds free text, a checklist,
 * or a sketch. Stickies can be stacked on top of each other and fanned out
 * again, dragged anywhere, and recoloured.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  const COLORS = [
    { name: 'Butter', hex: '#ffe9a8' },
    { name: 'Blush', hex: '#ffd0d6' },
    { name: 'Sky', hex: '#cfe8ff' },
    { name: 'Mint', hex: '#d4f5d4' },
    { name: 'Lilac', hex: '#e6d9ff' },
    { name: 'Peach', hex: '#ffe0c2' },
    { name: 'Teal', hex: '#d0f0ec' },
    { name: 'Paper', hex: '#f2f0eb' },
    { name: 'Slate', hex: '#d6dbe3' },
    { name: 'Lime', hex: '#e8f5b8' },
  ];

  let body, board;
  let filter = 'all';
  let dragState = null;
  let selectedId = null;

  function init() {
    body = document.getElementById('sticky-body');
    if (!body) return;

    document.getElementById('sticky-new').addEventListener('click', function () { createSticky(); });
    document.getElementById('sticky-arrange').addEventListener('click', tidy);
    U.delegate(document.getElementById('sticky-filter'), 'click', 'button', function (e, btn) {
      filter = btn.dataset.filter;
      U.$$('#sticky-filter button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      render();
    });

    N.bus.on('view:changed', function (v) { if (v === 'sticky') render(); });
    N.bus.on('stickies:changed', U.debounce(function () {
      if (N.store.state.activeView === 'sticky') render();
    }, 250));

    document.addEventListener('keydown', function (e) {
      if (N.store.state.activeView !== 'sticky') return;
      if (N.shortcuts.inTextInput(e.target)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeSticky(selectedId);
      }
      if (e.key === 'Escape') { selectedId = null; paintSelection(); }
    });

    registerCommands();
  }

  function all() {
    return Array.from(N.store.state.stickies.values());
  }

  function visible() {
    let list = all();
    if (filter === 'text') list = list.filter(function (s) { return (s.kind || 'text') === 'text'; });
    else if (filter === 'todo') list = list.filter(function (s) { return s.kind === 'todo'; });
    else if (filter === 'draw') list = list.filter(function (s) { return s.kind === 'draw'; });
    // Only the top card of each stack is drawn; the rest sit underneath it.
    const stackTops = new Map();
    list.forEach(function (s) {
      if (!s.stack) return;
      const current = stackTops.get(s.stack);
      if (!current || (s.stackOrder || 0) > (current.stackOrder || 0)) stackTops.set(s.stack, s);
    });
    return list.filter(function (s) {
      if (!s.stack) return true;
      return stackTops.get(s.stack) === s;
    });
  }

  function stackMembers(stackId) {
    return all()
      .filter(function (s) { return s.stack === stackId; })
      .sort(function (a, b) { return (a.stackOrder || 0) - (b.stackOrder || 0); });
  }

  async function createSticky(opts) {
    const o = opts || {};
    const existing = all();
    const sticky = {
      id: U.uid('st'),
      kind: o.kind || 'text',
      text: o.text || '',
      items: o.items || [],
      strokes: o.strokes || [],
      color: o.color || COLORS[existing.length % COLORS.length].hex,
      x: o.x === undefined ? 24 + (existing.length % 5) * 214 : o.x,
      y: o.y === undefined ? 24 + Math.floor(existing.length / 5) * 214 : o.y,
      w: 200, h: 200,
      rotation: (Math.random() * 3 - 1.5),
      stack: o.stack || null,
      stackOrder: o.stackOrder || 0,
      createdAt: Date.now(),
    };
    await N.store.saveRecord('stickies', sticky);
    render();
    setTimeout(function () {
      const node = board && board.querySelector('[data-sticky="' + sticky.id + '"] .sticky-body');
      if (node && sticky.kind === 'text') node.focus();
    }, 60);
    return sticky;
  }

  async function removeSticky(id) {
    await N.store.deleteRecord('stickies', id);
    selectedId = null;
    render();
    N.toast.show('Sticky removed', {
      kind: 'info', ms: 6000,
      action: { label: 'Undo', onClick: function () { N.store.undo().then(render); } },
    });
  }

  /* ------------------------------------------------------------ rendering */

  function render() {
    if (!body) return;
    U.clear(body);

    const list = visible();
    if (!all().length) {
      const empty = el('div.empty-state');
      empty.appendChild(N.icons.node('sticky', { size: 44 }));
      empty.appendChild(el('div.empty-state-title', null, 'The wall is empty'));
      empty.appendChild(el('p.empty-state-text', null,
        'Stickies are for things too small to be a note — a phone number, a half-idea, a shopping list, a doodle.'));
      const actions = el('div.empty-state-actions');
      actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { createSticky(); } }, 'Add a sticky'));
      actions.appendChild(el('button.btn', { type: 'button', onclick: function () { createSticky({ kind: 'todo', items: [{ text: '', done: false }] }); } }, 'Add a checklist'));
      actions.appendChild(el('button.btn', { type: 'button', onclick: function () { createSticky({ kind: 'draw' }); } }, 'Add a sketch'));
      empty.appendChild(actions);
      body.appendChild(empty);
      return;
    }

    const wall = el('div.sticky-wall');
    board = el('div.sticky-board');
    let maxY = 400;
    list.forEach(function (sticky) {
      board.appendChild(buildSticky(sticky));
      maxY = Math.max(maxY, sticky.y + sticky.h + 60);
    });
    board.style.minHeight = maxY + 'px';
    wall.appendChild(board);

    if (!list.length) {
      wall.appendChild(el('p.dim', { style: { padding: '30px', textAlign: 'center' } },
        'No stickies of that kind. Switch the filter back to All.'));
    }
    body.appendChild(wall);
    paintSelection();
  }

  function buildSticky(sticky) {
    const members = sticky.stack ? stackMembers(sticky.stack) : [];
    const node = el('div.sticky-note' + (members.length > 1 ? '.is-stack' : ''), {
      dataset: { sticky: sticky.id },
      style: {
        left: sticky.x + 'px', top: sticky.y + 'px',
        width: sticky.w + 'px', height: sticky.h + 'px',
        background: sticky.color,
        transform: 'rotate(' + (sticky.rotation || 0).toFixed(2) + 'deg)',
      },
    });

    if (members.length > 1) {
      node.appendChild(el('div.sticky-stack-badge', { title: members.length + ' stacked' }, String(members.length)));
    }

    /* head */
    const head = el('div.sticky-head');
    head.appendChild(N.icons.node(sticky.kind === 'todo' ? 'list-check' : (sticky.kind === 'draw' ? 'pen' : 'sticky'), { size: 13 }));
    head.appendChild(el('span.spacer'));
    const menuBtn = el('button.icon-btn.icon-btn-sm', { type: 'button', title: 'Sticky actions' });
    menuBtn.appendChild(N.icons.node('more', { size: 13 }));
    menuBtn.addEventListener('click', function (e) { e.stopPropagation(); openMenu(sticky, e.currentTarget); });
    head.appendChild(menuBtn);
    node.appendChild(head);

    /* body by kind */
    if (sticky.kind === 'todo') node.appendChild(buildTodoBody(sticky));
    else if (sticky.kind === 'draw') node.appendChild(buildDrawBody(sticky));
    else node.appendChild(buildTextBody(sticky));

    /* colour strip */
    const foot = el('div.sticky-foot');
    const palette = el('div.sticky-palette');
    COLORS.slice(0, 6).forEach(function (c) {
      const sw = el('button.sticky-swatch' + (sticky.color === c.hex ? '.is-active' : ''), {
        type: 'button', title: c.name, style: { background: c.hex },
        onclick: async function (e) {
          e.stopPropagation();
          sticky.color = c.hex;
          await N.store.saveRecord('stickies', sticky);
          node.style.background = c.hex;
          U.$$('.sticky-swatch', palette).forEach(function (s) { s.classList.toggle('is-active', s.title === c.name); });
        },
      });
      palette.appendChild(sw);
    });
    foot.appendChild(palette);
    node.appendChild(foot);

    /* dragging by the head */
    head.addEventListener('pointerdown', function (e) { startDrag(e, sticky, node); });
    node.addEventListener('pointerdown', function (e) {
      selectedId = sticky.id;
      paintSelection();
      // Dragging from the body is fine too, as long as we are not editing.
      if (e.target.closest('[contenteditable],input,button,canvas')) return;
      startDrag(e, sticky, node);
    });

    return node;
  }

  function buildTextBody(sticky) {
    const bodyEl = el('div.sticky-body', {
      contenteditable: 'plaintext-only',
      'data-placeholder': 'Write something…',
      spellcheck: 'false',
    });
    bodyEl.textContent = sticky.text || '';
    bodyEl.addEventListener('input', U.debounce(async function () {
      sticky.text = bodyEl.textContent;
      await N.store.saveRecord('stickies', sticky);
    }, 450));
    bodyEl.addEventListener('blur', async function () {
      sticky.text = bodyEl.textContent;
      await N.store.saveRecord('stickies', sticky);
    });
    return bodyEl;
  }

  function buildTodoBody(sticky) {
    const wrap = el('div.sticky-body');
    if (!Array.isArray(sticky.items)) sticky.items = [];
    if (!sticky.items.length) sticky.items.push({ text: '', done: false });

    sticky.items.forEach(function (item, i) {
      const row = el('div.sticky-todo' + (item.done ? '.is-done' : ''));
      const box = el('input', { type: 'checkbox', checked: item.done });
      box.addEventListener('change', async function () {
        item.done = box.checked;
        row.classList.toggle('is-done', item.done);
        await N.store.saveRecord('stickies', sticky);
      });
      row.appendChild(box);
      const text = el('span', {
        contenteditable: 'plaintext-only',
        'data-placeholder': 'Item',
        style: { outline: 'none', minWidth: '40px' },
      });
      text.textContent = item.text || '';
      text.addEventListener('input', U.debounce(async function () {
        item.text = text.textContent;
        await N.store.saveRecord('stickies', sticky);
      }, 450));
      text.addEventListener('keydown', async function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          item.text = text.textContent;
          sticky.items.splice(i + 1, 0, { text: '', done: false });
          await N.store.saveRecord('stickies', sticky);
          render();
          setTimeout(function () {
            const rows = board.querySelectorAll('[data-sticky="' + sticky.id + '"] .sticky-todo span[contenteditable]');
            if (rows[i + 1]) rows[i + 1].focus();
          }, 40);
        }
        if (e.key === 'Backspace' && !text.textContent && sticky.items.length > 1) {
          e.preventDefault();
          sticky.items.splice(i, 1);
          await N.store.saveRecord('stickies', sticky);
          render();
        }
      });
      row.appendChild(text);
      wrap.appendChild(row);
    });

    const add = el('button.btn.btn-sm.btn-ghost', {
      type: 'button', style: { marginTop: '6px', color: 'rgba(0,0,0,0.55)' },
      onclick: async function () {
        sticky.items.push({ text: '', done: false });
        await N.store.saveRecord('stickies', sticky);
        render();
      },
    }, '+ item');
    wrap.appendChild(add);
    return wrap;
  }

  function buildDrawBody(sticky) {
    const canvas = el('canvas.sticky-canvas', { width: 340, height: 300 });
    const ctx = canvas.getContext('2d');
    if (!Array.isArray(sticky.strokes)) sticky.strokes = [];

    const repaint = function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sticky.strokes.forEach(function (stroke) {
        ctx.strokeStyle = stroke.color || '#1e1a10';
        ctx.lineWidth = stroke.width || 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        stroke.points.forEach(function (p, i) {
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        });
        ctx.stroke();
      });
    };

    let drawing = null;
    const toLocal = function (e) {
      const rect = canvas.getBoundingClientRect();
      return [
        Math.round((e.clientX - rect.left) * (canvas.width / rect.width)),
        Math.round((e.clientY - rect.top) * (canvas.height / rect.height)),
      ];
    };

    canvas.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      canvas.setPointerCapture(e.pointerId);
      drawing = { points: [toLocal(e)], color: sticky.inkColor || '#1e1a10', width: sticky.inkWidth || 2.4 };
      sticky.strokes.push(drawing);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      e.stopPropagation();
      drawing.points.push(toLocal(e));
      repaint();
    });
    const finish = async function () {
      if (!drawing) return;
      drawing = null;
      await N.store.saveRecord('stickies', sticky);
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointerleave', finish);

    setTimeout(repaint, 0);
    return canvas;
  }

  function paintSelection() {
    if (!board) return;
    U.$$('.sticky-note', board).forEach(function (n) {
      n.classList.toggle('is-selected', n.dataset.sticky === selectedId);
    });
  }

  /* -------------------------------------------------------------- dragging */

  function startDrag(e, sticky, node) {
    if (e.button === 2) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = sticky.x, origY = sticky.y;
    let moved = false;

    const onMove = function (ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      node.classList.add('is-dragging');
      sticky.x = Math.max(0, Math.round(origX + dx));
      sticky.y = Math.max(0, Math.round(origY + dy));
      node.style.left = sticky.x + 'px';
      node.style.top = sticky.y + 'px';
    };

    const onUp = async function (ev) {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      node.classList.remove('is-dragging');
      if (!moved) return;

      // Dropping onto another sticky stacks them.
      node.style.pointerEvents = 'none';
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      node.style.pointerEvents = '';
      const target = under && under.closest ? under.closest('.sticky-note') : null;
      if (target && target.dataset.sticky !== sticky.id) {
        const other = N.store.state.stickies.get(target.dataset.sticky);
        if (other) { await stackOnto(sticky, other); return; }
      }
      await N.store.saveRecord('stickies', sticky);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  async function stackOnto(moving, target) {
    const stackId = target.stack || U.uid('sk');
    if (!target.stack) {
      target.stack = stackId;
      target.stackOrder = 0;
      await N.store.saveRecord('stickies', target);
    }
    const members = stackMembers(stackId);
    moving.stack = stackId;
    moving.stackOrder = (members.length ? Math.max.apply(null, members.map(function (m) { return m.stackOrder || 0; })) : 0) + 1;
    moving.x = target.x;
    moving.y = target.y;
    await N.store.saveRecord('stickies', moving);
    render();
    N.toast.info('Stacked — ' + (members.length + 1) + ' stickies here', { ms: 2000, key: 'stack' });
  }

  async function unstack(sticky) {
    const members = stackMembers(sticky.stack);
    let offset = 0;
    for (const m of members) {
      m.stack = null;
      m.stackOrder = 0;
      m.x = sticky.x + offset * 30;
      m.y = sticky.y + offset * 26;
      offset++;
      await N.store.saveRecord('stickies', m);
    }
    render();
    N.toast.success('Fanned out ' + U.pluralize(members.length, 'sticky', 'stickies'), { ms: 2000 });
  }

  async function tidy() {
    const list = visible().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    if (!list.length) return;
    const perRow = Math.max(1, Math.floor((board ? board.clientWidth : 900) / 214));
    for (let i = 0; i < list.length; i++) {
      list[i].x = 12 + (i % perRow) * 214;
      list[i].y = 12 + Math.floor(i / perRow) * 214;
      list[i].rotation = (Math.random() * 3 - 1.5);
      await N.store.saveRecord('stickies', list[i]);
    }
    render();
    N.toast.success('Wall tidied', { ms: 1600 });
  }

  function openMenu(sticky, anchor) {
    const items = [
      { header: 'Type' },
      { label: 'Text', icon: 'type', checked: (sticky.kind || 'text') === 'text', onClick: function () { convert(sticky, 'text'); } },
      { label: 'Checklist', icon: 'list-check', checked: sticky.kind === 'todo', onClick: function () { convert(sticky, 'todo'); } },
      { label: 'Sketch', icon: 'pen', checked: sticky.kind === 'draw', onClick: function () { convert(sticky, 'draw'); } },
      { separator: true },
      { label: 'All colours…', icon: 'palette', onClick: function () { pickColor(sticky); } },
      { label: 'Duplicate', icon: 'duplicate', onClick: function () {
        createSticky({ kind: sticky.kind, text: sticky.text, items: U.deepClone(sticky.items), strokes: U.deepClone(sticky.strokes), color: sticky.color, x: sticky.x + 24, y: sticky.y + 24 });
      } },
    ];
    if (sticky.stack) {
      items.push({ label: 'Fan out this stack', icon: 'expand', onClick: function () { unstack(sticky); } });
      items.push({ label: 'Next in stack', icon: 'layers', onClick: function () { cycleStack(sticky); } });
    }
    items.push({ separator: true },
      { label: 'Turn into a note', icon: 'file-plus', onClick: function () { promote(sticky); } },
      { label: 'Copy text', icon: 'copy', onClick: function () {
        U.copyToClipboard(asText(sticky));
        N.toast.success('Copied', { ms: 1300 });
      } },
      { separator: true },
      { label: 'Delete', icon: 'trash', danger: true, onClick: function () { removeSticky(sticky.id); } });
    N.menu.show(items, { anchor: anchor, align: 'right' });
  }

  async function convert(sticky, kind) {
    if (sticky.kind === kind) return;
    if (kind === 'todo' && (!sticky.items || !sticky.items.length)) {
      sticky.items = (sticky.text || '').split('\n').filter(function (l) { return l.trim(); })
        .map(function (l) { return { text: l.trim().replace(/^[-*]\s*/, ''), done: false }; });
      if (!sticky.items.length) sticky.items = [{ text: '', done: false }];
    }
    if (kind === 'text' && sticky.kind === 'todo') {
      sticky.text = (sticky.items || []).map(function (i) { return (i.done ? '[x] ' : '[ ] ') + i.text; }).join('\n');
    }
    sticky.kind = kind;
    await N.store.saveRecord('stickies', sticky);
    render();
  }

  async function pickColor(sticky) {
    const choice = await N.modal.choose({
      title: 'Sticky colour',
      options: COLORS.map(function (c) { return { value: c.hex, label: c.name, icon: 'droplet' }; }),
    });
    if (!choice) return;
    sticky.color = choice;
    await N.store.saveRecord('stickies', sticky);
    render();
  }

  function asText(sticky) {
    if (sticky.kind === 'todo') {
      return (sticky.items || []).map(function (i) { return '- [' + (i.done ? 'x' : ' ') + '] ' + i.text; }).join('\n');
    }
    if (sticky.kind === 'draw') return '(sketch)';
    return sticky.text || '';
  }

  async function promote(sticky) {
    const text = asText(sticky);
    const title = (text.split('\n')[0] || 'From a sticky').slice(0, 60).trim() || 'From a sticky';
    const note = await N.store.createNote({ title: title, content: text });
    N.app.openNote(note.id);
    N.toast.success('Turned into a note', { ms: 2000 });
  }

  async function cycleStack(sticky) {
    const members = stackMembers(sticky.stack);
    if (members.length < 2) return;
    const top = members[members.length - 1];
    top.stackOrder = (members[0].stackOrder || 0) - 1;
    await N.store.saveRecord('stickies', top);
    render();
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'sticky.open', title: 'Open sticky wall', group: 'View', icon: 'sticky', accel: 'Mod+Shift+S',
        run: function () { N.app.setView('sticky'); } },
      { id: 'sticky.new', title: 'New sticky note', group: 'Create', icon: 'sticky',
        run: function () { N.app.setView('sticky'); createSticky(); } },
      { id: 'sticky.newList', title: 'New sticky checklist', group: 'Create', icon: 'list-check',
        run: function () { N.app.setView('sticky'); createSticky({ kind: 'todo', items: [{ text: '', done: false }] }); } },
      { id: 'sticky.newSketch', title: 'New sticky sketch', group: 'Create', icon: 'pen',
        run: function () { N.app.setView('sticky'); createSticky({ kind: 'draw' }); } },
      { id: 'sticky.tidy', title: 'Tidy the sticky wall', group: 'Sticky', icon: 'grid',
        when: function () { return N.store.state.activeView === 'sticky'; }, run: tidy },
    ]);
  }

  N.sticky = { init: init, render: render, create: createSticky, COLORS: COLORS };
})(window.NODALIS = window.NODALIS || {});
