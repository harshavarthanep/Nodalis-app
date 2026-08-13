/**
 * graph.js — zero-dependency force-directed knowledge graph, canvas-rendered,
 * with pan/zoom and click-to-open (mirrors Obsidian's graph view).
 */
import { state, bus, buildLinkGraph, noteTitle } from './state.js';

let canvas, ctx;
let nodes = [], edges = [];
let animId = null;
let transform = { x: 0, y: 0, scale: 1 };
let dragNode = null, panStart = null, hoverNode = null;

export function initGraph() {
  canvas = document.getElementById('graph-canvas');
  ctx = canvas.getContext('2d');

  bus.on('view:changed', (view) => { if (view === 'graph') { resize(); rebuild(); start(); } else stop(); });
  bus.on('vault:changed', () => { if (state.activeView === 'graph') rebuild(); });

  window.addEventListener('resize', resize);

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', () => resetView());

  document.getElementById('btn-graph-reset').addEventListener('click', resetView);

  // touch pinch zoom
  let lastDist = null;
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (lastDist) {
        const delta = dist - lastDist;
        transform.scale = Math.max(0.2, Math.min(3, transform.scale + delta * 0.005));
      }
      lastDist = dist;
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { lastDist = null; });

  resize();
}

function resize() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}

function rebuild() {
  const linkGraph = buildLinkGraph();
  const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
  const existingPos = new Map(nodes.map((n) => [n.id, n]));
  nodes = [...linkGraph.values()].map(({ note, outgoing, incoming }) => {
    const prev = existingPos.get(note.id);
    return {
      id: note.id,
      title: noteTitle(note),
      x: prev ? prev.x : w / 2 + (Math.random() - 0.5) * 200,
      y: prev ? prev.y : h / 2 + (Math.random() - 0.5) * 200,
      vx: 0, vy: 0,
      degree: outgoing.length + incoming.length,
    };
  });
  edges = [];
  for (const [id, { outgoing }] of linkGraph.entries()) {
    outgoing.forEach((targetId) => edges.push({ source: id, target: targetId }));
  }
}

function resetView() {
  transform = { x: 0, y: 0, scale: 1 };
}

function tick() {
  const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let dist2 = dx * dx + dy * dy || 0.01;
      const force = 1800 / dist2;
      const dist = Math.sqrt(dist2);
      dx /= dist; dy /= dist;
      a.vx += dx * force; a.vy += dy * force;
      b.vx -= dx * force; b.vy -= dy * force;
    }
  }
  // spring on edges
  edges.forEach((e) => {
    const a = byId.get(e.source), b = byId.get(e.target);
    if (!a || !b) return;
    let dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const targetDist = 120;
    const force = (dist - targetDist) * 0.02;
    dx /= dist; dy /= dist;
    a.vx += dx * force; a.vy += dy * force;
    b.vx -= dx * force; b.vy -= dy * force;
  });
  // centering
  nodes.forEach((n) => {
    n.vx += (w / 2 - n.x) * 0.001;
    n.vy += (h / 2 - n.y) * 0.001;
    n.vx *= 0.85; n.vy *= 0.85;
    if (n !== dragNode) { n.x += n.vx; n.y += n.vy; }
  });

  draw();
  animId = requestAnimationFrame(tick);
}

function draw() {
  const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
  ctx.save();
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const styles = getComputedStyle(document.body);
  const bg = styles.getPropertyValue('--bg-1').trim();
  const border = styles.getPropertyValue('--border').trim();
  const accent = styles.getPropertyValue('--accent').trim();
  const text = styles.getPropertyValue('--text-1').trim();

  ctx.clearRect(0, 0, w, h);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  edges.forEach((e) => {
    const a = byId.get(e.source), b = byId.get(e.target);
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  nodes.forEach((n) => {
    const r = 5 + Math.min(10, n.degree * 1.6);
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = n === hoverNode ? accent : (n.degree ? accent : border);
    ctx.globalAlpha = n === hoverNode ? 1 : 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (transform.scale > 0.5) {
      ctx.fillStyle = text;
      ctx.font = '12px sans-serif';
      ctx.fillText(n.title, n.x + r + 4, n.y + 4);
    }
  });
  ctx.restore();
}

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left - transform.x) / transform.scale;
  const y = (clientY - rect.top - transform.y) / transform.scale;
  return { x, y };
}

function nodeAt(x, y) {
  return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < 14);
}

function onPointerDown(e) {
  const { x, y } = toWorld(e.clientX, e.clientY);
  const n = nodeAt(x, y);
  if (n) { dragNode = n; }
  else panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  canvas.setPointerCapture(e.pointerId);
}
function onPointerMove(e) {
  const { x, y } = toWorld(e.clientX, e.clientY);
  hoverNode = nodeAt(x, y);
  canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
  if (dragNode) { dragNode.x = x; dragNode.y = y; dragNode.vx = 0; dragNode.vy = 0; }
  else if (panStart) { transform.x = e.clientX - panStart.x; transform.y = e.clientY - panStart.y; }
}
function onPointerUp(e) {
  if (dragNode) {
    const { x, y } = toWorld(e.clientX, e.clientY);
    const moved = Math.hypot(dragNode.x - x, dragNode.y - y);
    if (moved < 3) bus.emit('note:open', dragNode.id);
  }
  dragNode = null; panStart = null;
}
function onWheel(e) {
  e.preventDefault();
  const delta = -e.deltaY * 0.001;
  transform.scale = Math.max(0.2, Math.min(3, transform.scale + delta));
}

function start() { if (!animId) tick(); }
function stop() { if (animId) { cancelAnimationFrame(animId); animId = null; } }
