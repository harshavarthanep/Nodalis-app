/* =========================================================================
 * Nodalis — ui/loader.js
 * The boot sequence. A small knowledge graph draws itself: nodes fly in from
 * the edges and settle, links stitch between them, the lattice contracts and
 * blooms into the mark, and the shell fades through underneath.
 *
 * It is genuinely tied to real progress — the step line reports what the app
 * is actually doing — and it can always be skipped with any key, tap or click.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;
  const NS = 'http://www.w3.org/2000/svg';

  /* A deliberate, hand-placed constellation. Randomised layouts read as noise;
     this one is balanced, with the densest cluster off-centre. */
  const NODES = [
    { x: 50,  y: 34,  r: 4.5, from: [-60, -40] },
    { x: 96,  y: 20,  r: 3.4, from: [0, -70] },
    { x: 140, y: 44,  r: 5.2, from: [70, -50] },
    { x: 26,  y: 84,  r: 3.8, from: [-75, 0] },
    { x: 74,  y: 76,  r: 6.4, from: [0, 0] },
    { x: 128, y: 96,  x2: 1, r: 4.2, from: [70, 30] },
    { x: 54,  y: 128, r: 4.8, from: [-40, 70] },
    { x: 104, y: 140, r: 3.6, from: [20, 80] },
    { x: 158, y: 122, r: 3.2, from: [80, 60] },
    { x: 18,  y: 46,  r: 2.8, from: [-70, -30] },
  ];

  const LINKS = [
    [0, 1], [1, 2], [0, 4], [2, 5], [3, 4], [4, 5],
    [4, 6], [6, 7], [7, 8], [5, 8], [0, 3], [9, 0], [3, 6],
  ];

  const STEPS = [
    'preparing workspace',
    'opening local database',
    'reading your vault',
    'building the link graph',
    'ready',
  ];

  let root = null;
  let barFill = null;
  let stepLine = null;
  let finished = false;
  let skipHandlers = [];
  let startedAt = 0;
  const MIN_VISIBLE_MS = 900;    // never flash-and-vanish; that reads as a bug

  function build() {
    root = el('div.loader#loader', { role: 'status', 'aria-live': 'polite', 'aria-label': 'Loading Nodalis' });

    const stage = el('div.loader-stage');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'loader-svg');
    svg.setAttribute('viewBox', '0 0 190 175');

    // links first so nodes paint over their ends
    LINKS.forEach(function (pair, i) {
      const a = NODES[pair[0]], b = NODES[pair[1]];
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('class', 'loader-link');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      line.style.setProperty('--len', len.toFixed(1));
      line.style.setProperty('--i', i);
      svg.appendChild(line);
    });

    NODES.forEach(function (n, i) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'loader-node');
      c.setAttribute('cx', n.x); c.setAttribute('cy', n.y); c.setAttribute('r', n.r);
      c.style.setProperty('--i', i);
      c.style.setProperty('--r0', n.r);
      c.style.setProperty('--fx', n.from[0] + 'px');
      c.style.setProperty('--fy', n.from[1] + 'px');
      svg.appendChild(c);
    });

    // the mark that blooms once the lattice contracts
    const core = document.createElementNS(NS, 'path');
    core.setAttribute('class', 'loader-core');
    core.setAttribute('d', markPath());
    svg.appendChild(core);

    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('class', 'loader-ring');
    ring.setAttribute('cx', 88); ring.setAttribute('cy', 84); ring.setAttribute('r', 34);
    svg.appendChild(ring);

    stage.appendChild(svg);
    root.appendChild(stage);

    const word = el('div.loader-word', { 'aria-hidden': 'true' });
    'Nodalis'.split('').forEach(function (ch, i) {
      const span = el('span', null, ch);
      span.style.setProperty('--i', i);
      word.appendChild(span);
    });
    root.appendChild(word);

    root.appendChild(el('div.loader-tagline', null, 'Your knowledge, connected.'));

    const bar = el('div.loader-bar');
    barFill = el('div.loader-bar-fill');
    bar.appendChild(barFill);
    root.appendChild(bar);

    stepLine = el('div.loader-step', null, STEPS[0]);
    root.appendChild(stepLine);

    const skip = el('button.loader-skip', { type: 'button' }, 'Skip');
    skip.addEventListener('click', function (e) { e.stopPropagation(); requestSkip(); });
    root.appendChild(skip);

    return root;
  }

  /** The Nodalis mark: a hexagonal node lattice, drawn as one path. */
  function markPath() {
    const cx = 88, cy = 84, R = 26;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 1; i < 6; i++) d += 'L' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
    d += 'Z';
    // three inner spokes — the "connections"
    d += 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1) + 'L' + pts[3][0].toFixed(1) + ' ' + pts[3][1].toFixed(1);
    d += 'M' + pts[1][0].toFixed(1) + ' ' + pts[1][1].toFixed(1) + 'L' + pts[4][0].toFixed(1) + ' ' + pts[4][1].toFixed(1);
    d += 'M' + pts[2][0].toFixed(1) + ' ' + pts[2][1].toFixed(1) + 'L' + pts[5][0].toFixed(1) + ' ' + pts[5][1].toFixed(1);
    return d;
  }

  function start() {
    if (root) return;
    startedAt = Date.now();
    finished = false;
    const existing = document.getElementById('loader');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    document.body.appendChild(build());

    // Any deliberate input skips the rest of the sequence.
    const skip = function (e) {
      // Ignore modifier-only keypresses so Cmd-Tab doesn't count as a skip.
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].indexOf(e.key) !== -1) return;
      requestSkip();
    };
    ['keydown', 'pointerdown', 'wheel'].forEach(function (type) {
      document.addEventListener(type, skip, { once: true, passive: true });
      skipHandlers.push([type, skip]);
    });
  }

  /**
   * Skipping must not just hide the animation — an earlier build left people
   * staring at a dead shell because boot was still stuck behind it. Announcing
   * the intent lets the app cut short whatever it is waiting on, then fade out.
   */
  function requestSkip() {
    N.bus.emit('loader:skip');
    finish(true);
  }

  /** progress(0..1, optionalStepIndexOrText) */
  function progress(ratio, step) {
    if (!root) return;
    const pct = U.clamp(ratio, 0, 1) * 100;
    if (barFill) barFill.style.width = pct.toFixed(0) + '%';
    if (stepLine) {
      const text = typeof step === 'number' ? STEPS[U.clamp(step, 0, STEPS.length - 1)] : step;
      if (text && stepLine.textContent !== text) stepLine.textContent = text;
    }
  }

  /**
   * Fade the loader out. Waits out MIN_VISIBLE_MS unless skipped, so a fast
   * machine doesn't get a jarring one-frame flash.
   */
  function finish(immediate) {
    if (finished || !root) return Promise.resolve();
    finished = true;
    skipHandlers.forEach(function (h) { document.removeEventListener(h[0], h[1]); });
    skipHandlers = [];

    const elapsed = Date.now() - startedAt;
    const wait = immediate ? 0 : Math.max(0, MIN_VISIBLE_MS - elapsed);

    return new Promise(function (resolve) {
      setTimeout(function () {
        progress(1, 'ready');
        if (!root) return resolve();
        root.classList.add('is-done');
        const cleanup = function () {
          if (root && root.parentNode) root.parentNode.removeChild(root);
          root = null; barFill = null; stepLine = null;
          N.bus.emit('loader:done');
          resolve();
        };
        root.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 700);
      }, wait);
    });
  }

  function isVisible() { return !!root && !finished; }

  /* --------------------------------------------------------- celebration */

  const CONFETTI_COLORS = ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393'];

  /**
   * A short burst of confetti. Used for streak milestones and finishing the
   * tour — never for routine actions, which would get tiring fast.
   */
  function celebrate(opts) {
    const o = opts || {};
    if (N.store && N.store.state.settings.animations === 'none') return;
    if (U.supports.reducedMotion) return;

    const layer = el('div.celebrate');
    const originX = o.x === undefined ? window.innerWidth / 2 : o.x;
    const originY = o.y === undefined ? window.innerHeight / 2 : o.y;
    const count = o.count || 40;
    const colors = o.colors || CONFETTI_COLORS;

    for (let i = 0; i < count; i++) {
      const bit = el('div.celebrate-bit');
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const dist = 90 + Math.random() * 190;
      bit.style.left = originX + 'px';
      bit.style.top = originY + 'px';
      bit.style.background = colors[i % colors.length];
      bit.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
      bit.style.setProperty('--dy', (Math.sin(angle) * dist + 180).toFixed(0) + 'px');
      bit.style.setProperty('--dr', (Math.random() * 900 - 450).toFixed(0) + 'deg');
      bit.style.setProperty('--fall-dur', (1100 + Math.random() * 900).toFixed(0) + 'ms');
      if (Math.random() > 0.6) bit.style.borderRadius = '50%';
      layer.appendChild(bit);
    }

    document.body.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 2400);
  }

  N.loader = { start: start, progress: progress, finish: finish, requestSkip: requestSkip, isVisible: isVisible, celebrate: celebrate };
})(window.NODALIS = window.NODALIS || {});
