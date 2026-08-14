/* =========================================================================
 * Nodalis — features/graph.js
 * Force-directed knowledge graph on a 2D canvas. No dependencies.
 *
 * Simulation: repulsion via a coarse spatial grid (so 2,000 notes stays
 * smooth), spring attraction along links, mild gravity toward the centre.
 * It cools to a stop rather than spinning forever burning battery.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;

  let canvas, ctx, wrap;
  let nodes = [], links = [];
  let running = false, raf = null;
  let alpha = 1;
  let view = { x: 0, y: 0, k: 1 };
  let dragging = null, panning = null, hovered = null;
  let scope = 'global', showTags = false, showOrphans = true;
  let dpr = 1;
  let tooltip = null;

  const REPULSION = 5200;
  const SPRING = 0.014;
  const SPRING_LENGTH = 92;
  const GRAVITY = 0.011;
  const DAMPING = 0.86;
  const ALPHA_DECAY = 0.986;
  const ALPHA_MIN = 0.004;

  function init() {
    canvas = document.getElementById('graph-canvas');
    wrap = document.getElementById('graph-wrap');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    const scopeGroup = document.getElementById('graph-scope');
    if (scopeGroup) U.delegate(scopeGroup, 'click', 'button', function (e, btn) {
      scope = btn.dataset.scope;
      U.$$('button', scopeGroup).forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      build();
    });

    const tagsToggle = document.getElementById('graph-show-tags');
    if (tagsToggle) tagsToggle.addEventListener('change', function () { showTags = tagsToggle.checked; build(); });
    const orphanToggle = document.getElementById('graph-show-orphans');
    if (orphanToggle) orphanToggle.addEventListener('change', function () { showOrphans = orphanToggle.checked; build(); });

    document.getElementById('graph-reset').addEventListener('click', function () { build(); fit(); });
    document.getElementById('graph-zoom-in').addEventListener('click', function () { zoomBy(1.25); });
    document.getElementById('graph-zoom-out').addEventListener('click', function () { zoomBy(0.8); });
    document.getElementById('graph-fit').addEventListener('click', fit);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', function () { hovered = null; hideTooltip(); });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);

    // Pinch-zoom on touch.
    let pinchStart = null;
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinchStart = { dist: touchDist(e.touches), k: view.k };
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinchStart) {
        e.preventDefault();
        const ratio = touchDist(e.touches) / pinchStart.dist;
        const rect = canvas.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        zoomAt(U.clamp(pinchStart.k * ratio, 0.12, 5), cx, cy);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function () { pinchStart = null; });

    window.addEventListener('resize', U.debounce(resize, 140));
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'graph') build();
    }, 600));
    N.bus.on('note:active', function () { if (scope === 'local' && N.store.state.activeView === 'graph') build(); });
    N.bus.on('theme:applied', function () { if (running) draw(); });
    N.bus.on('view:changed', function (v) {
      if (v === 'graph') { resize(); build(); start(); }
      else stop();
    });

    registerCommands();
  }

  function touchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  function resize() {
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    draw();
  }

  /* ----------------------------------------------------------- build data */

  function build() {
    const result = N.store.buildLinkGraph();
    const graph = result.graph;
    const active = N.store.state.activeNoteId;

    let included = new Set();
    if (scope === 'local' && active && graph.has(active)) {
      // Two hops out from the current note — enough context, still readable.
      included.add(active);
      const first = graph.get(active);
      first.outgoing.concat(first.incoming).forEach(function (id) {
        included.add(id);
        const second = graph.get(id);
        if (second) second.outgoing.concat(second.incoming).forEach(function (x) { included.add(x); });
      });
    } else {
      graph.forEach(function (_, id) { included.add(id); });
    }

    const previous = new Map();
    nodes.forEach(function (n) { previous.set(n.id, { x: n.x, y: n.y }); });

    nodes = [];
    links = [];
    const byId = new Map();
    const rect = wrap ? wrap.getBoundingClientRect() : { width: 800, height: 600 };
    const cx = rect.width / 2, cy = rect.height / 2;

    graph.forEach(function (entry, id) {
      if (!included.has(id)) return;
      const degree = entry.outgoing.length + entry.incoming.length;
      if (!showOrphans && degree === 0) return;
      const prev = previous.get(id);
      const node = {
        id: id, kind: 'note', note: entry.note,
        label: N.store.noteTitle(entry.note),
        degree: degree,
        x: prev ? prev.x : cx + (Math.random() - 0.5) * 340,
        y: prev ? prev.y : cy + (Math.random() - 0.5) * 340,
        vx: 0, vy: 0,
        r: U.clamp(4.5 + Math.sqrt(degree) * 2.6, 4.5, 17),
      };
      nodes.push(node);
      byId.set(id, node);
    });

    graph.forEach(function (entry, id) {
      if (!byId.has(id)) return;
      entry.outgoing.forEach(function (target) {
        if (!byId.has(target)) return;
        links.push({ source: byId.get(id), target: byId.get(target) });
      });
    });

    if (showTags) {
      const tagNodes = new Map();
      N.store.allTags().slice(0, 60).forEach(function (t) {
        const prev = previous.get('tag:' + t.tag);
        const node = {
          id: 'tag:' + t.tag, kind: 'tag', label: '#' + t.tag, degree: t.count,
          x: prev ? prev.x : cx + (Math.random() - 0.5) * 420,
          y: prev ? prev.y : cy + (Math.random() - 0.5) * 420,
          vx: 0, vy: 0, r: U.clamp(4 + Math.sqrt(t.count) * 2.2, 4, 14),
          color: U.colorFromString(t.tag),
        };
        tagNodes.set(t.tag, node);
        nodes.push(node);
      });
      nodes.forEach(function (node) {
        if (node.kind !== 'note') return;
        (node.note.tags || []).forEach(function (tag) {
          const tn = tagNodes.get(tag);
          if (tn) links.push({ source: node, target: tn, isTag: true });
        });
      });
    }

    alpha = 1;
    renderLegend(result.unresolved.size);
    if (N.store.state.activeView === 'graph') start();
  }

  function renderLegend(unresolvedCount) {
    const legend = document.getElementById('graph-legend');
    if (!legend) return;
    const noteCount = nodes.filter(function (n) { return n.kind === 'note'; }).length;
    const orphans = nodes.filter(function (n) { return n.kind === 'note' && n.degree === 0; }).length;
    legend.innerHTML = '';
    const add = function (text) { legend.appendChild(U.el('div.graph-legend-row', null, text)); };
    add(U.pluralize(noteCount, 'note') + ' · ' + U.pluralize(links.length, 'link'));
    if (orphans) add(U.pluralize(orphans, 'orphan') + ' (nothing links to them)');
    if (unresolvedCount) add(U.pluralize(unresolvedCount, 'link') + ' point at notes that do not exist yet');
    if (!noteCount) add('Nothing to show — write a note with [[links]] in it.');
  }

  /* ------------------------------------------------------------ simulation */

  function start() {
    if (running) return;
    running = true;
    tick();
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function tick() {
    if (!running) return;
    if (alpha > ALPHA_MIN || dragging) {
      step();
      alpha *= ALPHA_DECAY;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  function step() {
    if (!nodes.length) return;
    const rect = wrap ? wrap.getBoundingClientRect() : { width: 800, height: 600 };
    const cx = rect.width / 2, cy = rect.height / 2;

    // Spatial hashing keeps repulsion O(n) instead of O(n²).
    const cell = 120;
    const grid = new Map();
    nodes.forEach(function (n) {
      const key = Math.floor(n.x / cell) + ':' + Math.floor(n.y / cell);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(n);
    });

    nodes.forEach(function (a) {
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get((gx + dx) + ':' + (gy + dy));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            const b = bucket[i];
            if (a === b) continue;
            let ddx = a.x - b.x, ddy = a.y - b.y;
            let dist2 = ddx * ddx + ddy * ddy;
            if (dist2 < 0.01) { ddx = (Math.random() - 0.5) * 2; ddy = (Math.random() - 0.5) * 2; dist2 = 4; }
            if (dist2 > 62500) continue;              // beyond 250px, ignore
            const force = REPULSION / dist2;
            const dist = Math.sqrt(dist2);
            a.vx += (ddx / dist) * force * alpha * 0.02;
            a.vy += (ddy / dist) * force * alpha * 0.02;
          }
        }
      }
    });

    links.forEach(function (link) {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = (dist - SPRING_LENGTH) * SPRING * alpha;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      link.source.vx += fx; link.source.vy += fy;
      link.target.vx -= fx; link.target.vy -= fy;
    });

    nodes.forEach(function (n) {
      if (n === dragging) { n.vx = 0; n.vy = 0; return; }
      n.vx += (cx - n.x) * GRAVITY * alpha;
      n.vy += (cy - n.y) * GRAVITY * alpha;
      n.vx *= DAMPING; n.vy *= DAMPING;
      n.x += U.clamp(n.vx, -40, 40);
      n.y += U.clamp(n.vy, -40, 40);
    });
  }

  /* --------------------------------------------------------------- render */

  function css(name, fallback) {
    try {
      const value = getComputedStyle(document.body).getPropertyValue(name).trim();
      return value || fallback;
    } catch (err) { return fallback; }
  }

  function draw() {
    if (!ctx || !canvas.width) return;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!nodes.length) {
      ctx.fillStyle = css('--text-3', '#999');
      ctx.font = '14px ' + css('--font-ui', 'sans-serif');
      ctx.textAlign = 'center';
      ctx.fillText('No notes to graph yet', w / 2, h / 2);
      return;
    }

    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.k, view.k);

    const accent = css('--accent', '#6c5ce7');
    const border = css('--border-strong', '#ccc');
    const text0 = css('--text-0', '#222');
    const text2 = css('--text-2', '#888');
    const activeId = N.store.state.activeNoteId;
    const highlight = hovered || nodes.find(function (n) { return n.id === activeId; });
    const connected = new Set();
    if (highlight) {
      connected.add(highlight.id);
      links.forEach(function (l) {
        if (l.source === highlight) connected.add(l.target.id);
        if (l.target === highlight) connected.add(l.source.id);
      });
    }

    /* links */
    ctx.lineWidth = 1 / view.k;
    links.forEach(function (link) {
      const lit = highlight && (link.source === highlight || link.target === highlight);
      ctx.strokeStyle = lit ? accent : border;
      ctx.globalAlpha = lit ? 0.85 : (highlight ? 0.14 : 0.4);
      ctx.lineWidth = (lit ? 1.8 : 1) / view.k;
      if (link.isTag) ctx.setLineDash([3 / view.k, 3 / view.k]);
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.globalAlpha = 1;

    /* nodes */
    nodes.forEach(function (n) {
      const dim = highlight && !connected.has(n.id);
      ctx.globalAlpha = dim ? 0.22 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (n.kind === 'tag') { ctx.fillStyle = n.color || accent; }
      else if (n.id === activeId) { ctx.fillStyle = accent; }
      else if (n.degree === 0) { ctx.fillStyle = css('--text-3', '#999'); }
      else { ctx.fillStyle = U.mix(accent, css('--bg-canvas', '#fff'), 0.42); }
      ctx.fill();

      if (n.id === activeId || n === hovered) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.4 / view.k;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    /* labels — only when they will actually be readable */
    const showLabels = view.k > 0.55;
    if (showLabels) {
      ctx.font = (11 / view.k).toFixed(1) + 'px ' + css('--font-ui', 'sans-serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      nodes.forEach(function (n) {
        const dim = highlight && !connected.has(n.id);
        if (dim && view.k < 1.4) return;
        if (n.degree === 0 && view.k < 0.85 && n !== hovered) return;
        ctx.globalAlpha = dim ? 0.3 : 1;
        ctx.fillStyle = (n.id === activeId || n === hovered) ? text0 : text2;
        const label = U.truncate(n.label, view.k > 1.1 ? 34 : 20);
        ctx.fillText(label, n.x, n.y + n.r + 3 / view.k);
      });
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /* -------------------------------------------------------------- pointer */

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.k,
      y: (clientY - rect.top - view.y) / view.k,
    };
  }

  function nodeAt(world) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const grab = Math.max(n.r, 10 / view.k);
      if (Math.hypot(n.x - world.x, n.y - world.y) <= grab) return n;
    }
    return null;
  }

  function onPointerDown(e) {
    if (e.button === 2) return;
    canvas.setPointerCapture(e.pointerId);
    const world = toWorld(e.clientX, e.clientY);
    const hit = nodeAt(world);
    if (hit) {
      dragging = hit;
      dragging.dragOffsetX = hit.x - world.x;
      dragging.dragOffsetY = hit.y - world.y;
      dragging.moved = false;
      alpha = Math.max(alpha, 0.35);
      start();
    } else {
      panning = { x: e.clientX - view.x, y: e.clientY - view.y };
      canvas.style.cursor = 'grabbing';
    }
  }

  function onPointerMove(e) {
    if (dragging) {
      const world = toWorld(e.clientX, e.clientY);
      dragging.x = world.x + dragging.dragOffsetX;
      dragging.y = world.y + dragging.dragOffsetY;
      dragging.moved = true;
      alpha = Math.max(alpha, 0.25);
      return;
    }
    if (panning) {
      view.x = e.clientX - panning.x;
      view.y = e.clientY - panning.y;
      draw();
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    const hit = nodeAt(world);
    if (hit !== hovered) {
      hovered = hit;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (hit) showTooltip(hit, e.clientX, e.clientY);
      else hideTooltip();
      draw();
    } else if (hit && tooltip) {
      positionTooltip(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    if (dragging) {
      if (!dragging.moved) openNode(dragging);
      dragging = null;
    }
    panning = null;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
  }

  function onDoubleClick(e) {
    const hit = nodeAt(toWorld(e.clientX, e.clientY));
    if (hit) openNode(hit);
    else fit();
  }

  function openNode(node) {
    hideTooltip();
    if (node.kind === 'tag') N.search.openTag(node.label.replace(/^#/, ''));
    else N.app.openNote(node.id);
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomAt(U.clamp(view.k * factor, 0.12, 5), e.clientX - rect.left, e.clientY - rect.top);
  }

  function zoomAt(k, px, py) {
    const worldX = (px - view.x) / view.k;
    const worldY = (py - view.y) / view.k;
    view.k = k;
    view.x = px - worldX * k;
    view.y = py - worldY * k;
    draw();
  }

  function zoomBy(factor) {
    const rect = canvas.getBoundingClientRect();
    zoomAt(U.clamp(view.k * factor, 0.12, 5), rect.width / 2, rect.height / 2);
  }

  function fit() {
    if (!nodes.length || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r);
    });
    const pad = 60;
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    const k = U.clamp(Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h), 0.12, 2.2);
    view.k = k;
    view.x = rect.width / 2 - ((minX + maxX) / 2) * k;
    view.y = rect.height / 2 - ((minY + maxY) / 2) * k;
    draw();
  }

  /* -------------------------------------------------------------- tooltip */

  function showTooltip(node, x, y) {
    hideTooltip();
    tooltip = U.el('div.graph-tooltip');
    if (node.kind === 'tag') {
      tooltip.textContent = node.label + ' · ' + U.pluralize(node.degree, 'note');
    } else {
      tooltip.textContent = node.label + ' · ' + U.pluralize(node.degree, 'link');
    }
    wrap.appendChild(tooltip);
    positionTooltip(x, y);
  }

  function positionTooltip(x, y) {
    if (!tooltip || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    tooltip.style.left = (x - rect.left) + 'px';
    tooltip.style.top = (y - rect.top - 6) + 'px';
  }

  function hideTooltip() {
    if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    tooltip = null;
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'graph.open', title: 'Open knowledge graph', group: 'View', icon: 'graph', accel: 'Mod+G',
        run: function () { N.app.setView('graph'); } },
      { id: 'graph.local', title: 'Graph around this note', group: 'View', icon: 'graph',
        when: function () { return !!N.store.state.activeNoteId; },
        run: function () {
          scope = 'local';
          const group = document.getElementById('graph-scope');
          if (group) U.$$('button', group).forEach(function (b) { b.classList.toggle('is-active', b.dataset.scope === 'local'); });
          N.app.setView('graph');
          build(); fit();
        } },
      { id: 'graph.fit', title: 'Fit graph to view', group: 'View', icon: 'maximize',
        when: function () { return N.store.state.activeView === 'graph'; }, run: fit },
    ]);
  }

  N.graph = { init: init, build: build, resize: resize, fit: fit, start: start, stop: stop };
})(window.NODALIS = window.NODALIS || {});
