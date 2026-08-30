#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v9.9-L - the loading screen
=============================================================================

    python3 loader_v99_standalone.py index.html --dry-run
    python3 loader_v99_standalone.py index.html

Run this AFTER fix_v99_standalone.py, on a file that already has the v9.6-L
card loader. It is a separate script on purpose: the v9.9 fixes are things
that were broken, this is a matter of taste, and you should be able to take
one without the other. index.html.bak lets you undo it on its own.

WHAT IT DOES

 The v9.6-L card had three problems you named: a ghost outline behind it that
 read as a misaligned box, five "wave" bars that were the only part of the
 screen NOT reporting anything real, and no motion worth watching.

 What replaces it:

   THE MARK SPINS. The Nodalis hexagon turns continuously at the centre of a
   node ring - the app's own logo, doing the thing the app is named after.

   THE NOTE WRITES ITSELF. Under the mark is a sheet with five lines of text
   that write themselves in, left to right, with a caret that blinks at the
   writing position. One line per boot step, so the note finishes exactly
   when the app does. It is a notes app; this is a note being written.

   THE LINKS STITCH. Six chords across the node ring draw themselves in one
   per step - the link graph being built, which is literally what step four
   is doing.

   AND IT ENDS WITH A BOOM. At 100% three shockwave rings burst out of the
   mark, the mark flares to the accent colour and snaps, the sheet's lines
   flash, and the whole screen blooms once before the app rises through it.

 Every moving part still reports real state - the lines, the chords, the
 meter and the caption are all driven by actual boot progress, not a timer.
 The one thing that is pure decoration is the spin, and the spin is the logo.

 Every colour is a theme token, so this is correct in all six themes and in
 both light and dark with no per-theme rules. Under "Animations: none" or the
 system's reduced-motion setting it holds still and just reports progress.
=============================================================================
"""

import io
import os
import sys

_BLOCKS = {}

_BLOCKS['css.css'] = r'''
/* =========================================================================
 * v9.9-L — THE LOADING SCREEN
 *
 * Namespaced .nd9- throughout so none of the v9.6-L card rules can reach it;
 * the two that would have (the ghost outline, and the five wave bars) are
 * switched off explicitly below rather than left to specificity.
 * ========================================================================= */

/* The ghost outline behind the old card - the "thin box that looks
   misaligned". It was a hard offset border standing in for a shadow. Gone. */
.loader-card::after { display: none !important; }
.loader-bars { display: none !important; }

.loader {
  --nd9-rule: color-mix(in srgb, var(--text-0) 9%, transparent);
  --nd9-dim: var(--text-3);
  gap: 0;
}

/* A slow bloom behind everything, so the centre of the screen has weight. */
.nd9-glow {
  position: absolute;
  left: 50%; top: 46%;
  width: min(720px, 120vw); aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 13%, transparent) 0%, transparent 62%);
  animation: nd9-breathe 5.5s var(--ease-in-out, ease-in-out) infinite;
  pointer-events: none;
}
@keyframes nd9-breathe {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.95); }
  50%      { opacity: 1;    transform: translate(-50%, -50%) scale(1.06); }
}

/* ---- the stage: node ring, chords, and the spinning mark --------------- */
.nd9-stage {
  position: relative;
  width: 172px; height: 172px;
  display: grid; place-items: center;
  animation: nd9-stage-in 700ms cubic-bezier(0.16, 0.84, 0.3, 1) both;
}
@keyframes nd9-stage-in {
  from { opacity: 0; transform: scale(0.86); }
  to   { opacity: 1; transform: none; }
}
.nd9-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }

/* The dashed orbit turns one way, slowly. */
.nd9-orbit {
  fill: none;
  stroke: var(--nd9-rule);
  stroke-width: 1;
  stroke-dasharray: 3 7;
  transform-origin: 86px 86px;
  animation: nd9-spin 26s linear infinite;
}
/* The mark turns the other way, faster. Opposed rotation reads as mechanism
   rather than as a spinner. */
.nd9-mark {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-linecap: round;
  transform-origin: 86px 86px;
  animation: nd9-spin 7s linear infinite, nd9-mark-breathe 3.4s var(--ease-in-out, ease-in-out) infinite;
}
@keyframes nd9-spin { to { transform: rotate(360deg); } }
@keyframes nd9-mark-breathe {
  0%, 100% { stroke-width: 1.8; }
  50%      { stroke-width: 2.5; }
}

.nd9-node {
  fill: var(--nd9-dim);
  transform-origin: 86px 86px;
  animation: nd9-node-pulse 2.6s var(--ease-in-out, ease-in-out) infinite;
  animation-delay: calc(var(--i) * 180ms);
}
@keyframes nd9-node-pulse {
  0%, 100% { opacity: 0.35; r: 2.6; }
  50%      { opacity: 1;    r: 4.2; }
}
/* A chord is drawn in when its boot step lands - stroke-dashoffset is the
   whole trick, and it is honest: six chords, six things that had to happen. */
.nd9-link {
  stroke: var(--accent);
  stroke-width: 1.2;
  stroke-linecap: round;
  opacity: 0;
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  transition: stroke-dashoffset 620ms var(--ease-out), opacity 300ms var(--ease-out);
}
.nd9-link.is-on { opacity: 0.75; stroke-dashoffset: 0; }

/* ---- the wordmark ------------------------------------------------------ */
.nd9-name {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: 26px; font-weight: 700; letter-spacing: -0.015em;
  color: var(--text-0);
  animation: nd9-rise 640ms cubic-bezier(0.16, 0.84, 0.3, 1) 120ms both;
}
.nd9-sub {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--nd9-dim);
  animation: nd9-rise 640ms cubic-bezier(0.16, 0.84, 0.3, 1) 200ms both;
}
@keyframes nd9-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }

/* ---- the sheet: a note writing itself --------------------------------- */
.nd9-sheet {
  position: relative;
  margin-top: 22px;
  width: min(340px, calc(100vw - 56px));
  padding: 18px 18px 16px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: var(--r-md, 10px);
  box-shadow: 0 18px 50px -30px color-mix(in srgb, var(--text-0) 55%, transparent);
  animation: nd9-rise 700ms cubic-bezier(0.16, 0.84, 0.3, 1) 260ms both;
}
/* The ruled margin down the left, like a real sheet. */
.nd9-sheet::before {
  content: '';
  position: absolute; top: 15px; bottom: 46px; left: 11px;
  width: 1px; background: color-mix(in srgb, var(--accent) 45%, transparent);
}
.nd9-lines { display: flex; flex-direction: column; gap: 9px; padding-left: 12px; }
/*
 * Each line is a RULED TRACK with ink written over it, not a bar that grows
 * from nothing. A sheet whose unwritten lines are invisible is a blank box
 * with two bars in it; a sheet with faint rules on it is a page, and you can
 * see how much of the note is still to come.
 */
.nd9-line {
  position: relative;
  height: 7px; width: 100%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-0) 8%, transparent);
}
.nd9-line::before {
  content: '';
  position: absolute; inset: 0 auto 0 0;
  width: 0; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 48%, transparent);
  transition: width 560ms cubic-bezier(0.22, 0.9, 0.3, 1), background 400ms var(--ease-out);
}
/* Written lines are done; the line being written is filling in right now. */
.nd9-line.is-written::before,
.nd9-line.is-writing::before { width: var(--w); }

/* The caret sits at the writing head, on the line being written. */
.nd9-line.is-writing::after {
  content: '';
  position: absolute; left: var(--w); top: -3px; margin-left: 3px;
  width: 2px; height: 13px; border-radius: 1px;
  background: var(--accent);
  animation: nd9-caret 900ms steps(2, jump-none) infinite;
}
@keyframes nd9-caret { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

/* ---- the meter and the caption ---------------------------------------- */
.nd9-meter {
  position: relative;
  height: 4px; margin: 18px 0 10px;
  background: color-mix(in srgb, var(--text-0) 10%, transparent);
  border-radius: 999px; overflow: hidden;
}
.nd9-meter-fill {
  position: absolute; inset: 0 auto 0 0; width: 0;
  background: var(--accent); border-radius: 999px;
  transition: width 420ms cubic-bezier(0.22, 0.9, 0.3, 1);
}
.nd9-meter-fill::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-on, #fff) 55%, transparent), transparent);
  transform: translateX(-100%);
  animation: nd9-sheen 1.6s var(--ease-in-out, ease-in-out) infinite;
}
.nd9-meter.is-full .nd9-meter-fill::after { animation: none; opacity: 0; }
@keyframes nd9-sheen { to { transform: translateX(220%); } }

.nd9-foot {
  display: flex; align-items: baseline; gap: 12px;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em;
  color: var(--nd9-dim);
}
.nd9-step { flex: 1 1 auto; min-width: 0; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nd9-pct { flex: none; font-variant-numeric: tabular-nums; color: var(--text-2); }

.nd9-claims {
  margin-top: 22px;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: color-mix(in srgb, var(--text-3) 80%, transparent);
  text-align: center;
  animation: nd9-rise 700ms var(--ease-out) 420ms both;
}
.nd9-claims span { white-space: nowrap; }
.nd9-claims i { font-style: normal; opacity: 0.45; margin: 0 8px; }
.nd9-ver {
  margin-top: 9px;
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.1em;
  color: color-mix(in srgb, var(--text-3) 55%, transparent);
  text-align: center;
}

/* ---- THE BOOM ----------------------------------------------------------
 * Three rings out of the mark, the mark flares and snaps, the sheet's lines
 * all light at once, and one bloom across the whole screen. It fires when
 * progress actually reaches 1, so it is the app arriving, not a cue.
 */
.nd9-ring {
  position: absolute; left: 50%; top: 50%;
  width: 96px; height: 96px; margin: -48px 0 0 -48px;
  border: 2px solid var(--accent);
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
}
.loader.is-boom .nd9-ring {
  animation: nd9-ring-out 900ms cubic-bezier(0.16, 0.84, 0.3, 1) both;
  animation-delay: calc(var(--i) * 130ms);
}
@keyframes nd9-ring-out {
  0%   { opacity: 0.85; transform: scale(0.35); border-width: 3px; }
  70%  { opacity: 0.22; }
  100% { opacity: 0; transform: scale(3.1); border-width: 0.5px; }
}
.loader.is-boom .nd9-mark {
  animation: nd9-spin 7s linear infinite, nd9-mark-pop 760ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
  stroke-width: 2.6;
}
@keyframes nd9-mark-pop {
  0%   { transform: scale(1); }
  38%  { transform: scale(1.32); }
  100% { transform: scale(1.06); }
}
.loader.is-boom .nd9-node { animation: none; opacity: 1; fill: var(--accent); }
.loader.is-boom .nd9-link { opacity: 1; stroke-width: 1.8; }
.loader.is-boom .nd9-line::before { background: color-mix(in srgb, var(--accent) 78%, transparent); }
.loader.is-boom .nd9-glow { animation: nd9-bloom 820ms var(--ease-out) both; }
@keyframes nd9-bloom {
  0%   { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  30%  { opacity: 1;   transform: translate(-50%, -50%) scale(1.5); }
  100% { opacity: 0.2; transform: translate(-50%, -50%) scale(2.2); }
}
.loader.is-boom .nd9-sheet { animation: nd9-sheet-pop 620ms cubic-bezier(0.2, 1.4, 0.4, 1) both; }
@keyframes nd9-sheet-pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.035); }
  100% { transform: scale(1); }
}

/* ---- the exit ---------------------------------------------------------- */
.loader.is-done .nd9-stage,
.loader.is-done .nd9-sheet,
.loader.is-done .nd9-name,
.loader.is-done .nd9-sub,
.loader.is-done .nd9-claims,
.loader.is-done .nd9-ver { animation: nd9-out 380ms cubic-bezier(0.55, 0, 0.35, 1) forwards; }
@keyframes nd9-out { to { opacity: 0; transform: translateY(-14px) scale(0.97); } }

@media (max-width: 480px) {
  .nd9-stage { width: 148px; height: 148px; }
  .nd9-name { font-size: 23px; }
  .nd9-sheet { padding: 15px 15px 13px; }
  .nd9-claims { font-size: 9px; letter-spacing: 0.1em; padding: 0 16px; line-height: 1.9; }
  .nd9-claims i { margin: 0 5px; }
}

/* Motion off: it still reports, it just does not move. */
[data-animations='none'] .nd9-glow,
[data-animations='none'] .nd9-orbit,
[data-animations='none'] .nd9-mark,
[data-animations='none'] .nd9-node,
[data-animations='none'] .nd9-stage,
[data-animations='none'] .nd9-name,
[data-animations='none'] .nd9-sub,
[data-animations='none'] .nd9-sheet,
[data-animations='none'] .nd9-claims,
[data-animations='none'] .nd9-meter-fill::after,
[data-animations='none'] .nd9-line.is-writing::after,
[data-animations='none'] .loader.is-boom .nd9-ring { animation: none !important; }

@media (prefers-reduced-motion: reduce) {
  .nd9-glow, .nd9-orbit, .nd9-mark, .nd9-node, .nd9-stage, .nd9-name,
  .nd9-sub, .nd9-sheet, .nd9-claims, .nd9-meter-fill::after,
  .nd9-line.is-writing::after, .loader.is-boom .nd9-ring { animation: none !important; }
  .loader.is-done { animation: none; opacity: 0; visibility: hidden; }
}
'''

_BLOCKS['build.js'] = r'''  /* ===================================================================== *
   * v9.9-L: THE LOADING SCREEN.
   *
   * Same contract as v9.6-L - every moving part reports real state - with
   * the three things that were wrong about it fixed:
   *
   *   - the ghost outline behind the card is gone. It was a hard offset
   *     border standing in for a shadow, and it read as a second box that
   *     had slipped out of alignment, because that is what it looked like.
   *   - the five "wave" bars are gone. They were the only thing on the
   *     screen not reporting anything, and a decorative bar next to an
   *     honest meter makes the meter look decorative too.
   *   - and there is something to watch: the mark spins inside a node ring
   *     whose chords stitch as the graph is built, a sheet writes itself a
   *     line per boot step with a caret that blinks where the writing is,
   *     and the whole thing goes off like a firework when it lands.
   *
   * The sheet is the part worth explaining. This is a notes app, so the
   * loading screen is a note being written: five lines, one per boot step,
   * each drawn when its step actually completes. The note finishes exactly
   * when the app does, which is the only honest way to animate a wait.
   * ===================================================================== */
  function build() {
    root = el('div.loader#loader', { role: 'status', 'aria-live': 'polite', 'aria-label': 'Loading Nodalis' });
    root.appendChild(el('div.loader-grid', { 'aria-hidden': 'true' }));
    root.appendChild(el('div.nd9-glow', { 'aria-hidden': 'true' }));

    /* ---- the stage ---------------------------------------------------- */
    const stage = el('div.nd9-stage', { 'aria-hidden': 'true' });
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'nd9-svg');
    svg.setAttribute('viewBox', '0 0 172 172');

    const orbit = document.createElementNS(NS, 'circle');
    orbit.setAttribute('class', 'nd9-orbit');
    orbit.setAttribute('cx', '86'); orbit.setAttribute('cy', '86'); orbit.setAttribute('r', '68');
    svg.appendChild(orbit);

    /*
     * Six nodes on the orbit, and six chords between them. One chord per
     * boot step plus one for the finish, so "building the link graph" is
     * drawn by the thing it describes.
     */
    const RING = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      RING.push([86 + 68 * Math.cos(a), 86 + 68 * Math.sin(a)]);
    }
    const CHORDS = [[0, 2], [2, 4], [4, 0], [1, 3], [3, 5], [5, 1]];
    links = [];
    CHORDS.forEach(function (pair) {
      const a = RING[pair[0]], b = RING[pair[1]];
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('class', 'nd9-link');
      line.setAttribute('x1', a[0].toFixed(1)); line.setAttribute('y1', a[1].toFixed(1));
      line.setAttribute('x2', b[0].toFixed(1)); line.setAttribute('y2', b[1].toFixed(1));
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      line.style.setProperty('--len', len.toFixed(1));
      svg.appendChild(line);
      links.push(line);
    });
    RING.forEach(function (pt, i) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'nd9-node');
      c.setAttribute('cx', pt[0].toFixed(1)); c.setAttribute('cy', pt[1].toFixed(1));
      c.setAttribute('r', '3.2');
      c.style.setProperty('--i', i);
      svg.appendChild(c);
    });

    /*
     * markPath() draws the hexagon at (88,84) r=26 in the old 190x175 stage.
     * Shifting it by (-2,+2) centres it on this 172x172 one, which is what
     * lets it spin about its own middle instead of orbiting a point near it.
     */
    const mark = document.createElementNS(NS, 'path');
    mark.setAttribute('class', 'nd9-mark');
    mark.setAttribute('d', markPath());
    mark.setAttribute('transform', 'translate(-2, 2)');
    svg.appendChild(mark);
    stage.appendChild(svg);

    /* The boom's shockwaves. Idle and invisible until progress reaches 1. */
    for (let i = 0; i < 3; i++) {
      const ring = el('span.nd9-ring');
      ring.style.setProperty('--i', i);
      stage.appendChild(ring);
    }
    root.appendChild(stage);

    root.appendChild(el('div.nd9-name', null, 'Nodalis'));
    root.appendChild(el('div.nd9-sub', null, 'Local-first markdown notes'));

    /* ---- the sheet ---------------------------------------------------- */
    const sheet = el('div.nd9-sheet');
    const lines = el('div.nd9-lines');
    noteLines = [];
    /* Ragged on purpose - five equal bars read as a loading placeholder,
       these read as a paragraph. */
    [78, 96, 62, 88, 46].forEach(function (w) {
      const ln = el('span.nd9-line');
      ln.style.setProperty('--w', w + '%');
      lines.appendChild(ln);
      noteLines.push(ln);
    });
    sheet.appendChild(lines);

    meter = el('div.nd9-meter');
    barFill = el('div.nd9-meter-fill');
    meter.appendChild(barFill);
    sheet.appendChild(meter);

    const foot = el('div.nd9-foot');
    stepLine = el('div.nd9-step', null, STEPS[0]);
    pctLine = el('div.nd9-pct', null, '0%');
    foot.appendChild(stepLine);
    foot.appendChild(pctLine);
    sheet.appendChild(foot);
    root.appendChild(sheet);

    /*
     * The three claims are the three things Nodalis actually does
     * differently, and all three are verifiable by the person reading them.
     */
    const claims = el('div.nd9-claims', { 'aria-hidden': 'true' });
    ['No upload', 'No account', 'Your files, your disk'].forEach(function (text, i) {
      if (i) claims.appendChild(el('i', null, '//'));
      claims.appendChild(el('span', null, text));
    });
    root.appendChild(claims);
    root.appendChild(el('div.nd9-ver', null, (N.versionLabel ? N.versionLabel() : '')));

    const skip = el('button.loader-skip', { type: 'button' }, 'Skip');
    skip.addEventListener('click', function (e) { e.stopPropagation(); requestSkip(); });
    root.appendChild(skip);

    boomed = false;
    return root;
  }
'''

_BLOCKS['progress.js'] = r'''  /** progress(0..1, optionalStepIndexOrText) */
  function progress(ratio, step) {
    if (!root) return;
    const clamped = U.clamp(ratio, 0, 1);
    const pct = clamped * 100;
    if (barFill) barFill.style.width = pct.toFixed(0) + '%';
    if (pctLine) pctLine.textContent = pct.toFixed(0) + '%';
    if (meter) meter.classList.toggle('is-full', clamped >= 0.999);

    /*
     * One written line per completed step, and the caret parked on the line
     * being written. Derived from the ratio rather than from the step
     * argument, because callers pass a step name as often as an index - and
     * the ratio is the one thing every caller supplies.
     */
    if (noteLines && noteLines.length) {
      const done = Math.round(clamped * noteLines.length);
      for (let i = 0; i < noteLines.length; i++) {
        noteLines[i].classList.toggle('is-written', i < done);
        noteLines[i].classList.toggle('is-writing', i === done && clamped < 0.999);
      }
    }
    /* A chord per step, so the graph is stitched by the step that builds it. */
    if (links && links.length) {
      const lit = Math.round(clamped * links.length);
      for (let i = 0; i < links.length; i++) links[i].classList.toggle('is-on', i < lit);
    }
    if (stepLine) {
      const text = typeof step === 'number' ? STEPS[U.clamp(step, 0, STEPS.length - 1)] : step;
      if (text && stepLine.textContent !== text) stepLine.textContent = text;
    }

    /* The boom, once, when the app has actually arrived. */
    if (clamped >= 0.999 && !boomed) {
      boomed = true;
      root.classList.add('is-boom');
    }
  }
'''


def block(name):
    return _BLOCKS[name]

MARKER = 'v9.9-L: THE LOADING SCREEN'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    path = args[0] if args else 'index.html'

    if not os.path.exists(path):
        print('ERROR: %s not found.' % path)
        return 1

    src = io.open(path, encoding='utf-8').read()
    if MARKER in src:
        print('ERROR: the v9.9 loading screen is already installed in this file.')
        return 1
    if 'loader-claims' not in src:
        print('ERROR: this file does not have the v9.6-L card loader to replace.')
        print('       Apply add_loader_standalone.py (v9.6-L) first, or use the')
        print('       -with-loader build.')
        return 1

    s = src
    log = []
    errors = []

    def once(old, new, label):
        nonlocal s
        n = s.count(old)
        if n != 1:
            errors.append('%s: anchor found %d times, expected 1' % (label, n))
            return False
        s = s.replace(old, new, 1)
        log.append(label)
        return True

    def splice(start_at, end_at, new, label):
        nonlocal s
        n = s.count(start_at)
        if n != 1:
            errors.append('%s: start anchor found %d times, expected 1' % (label, n))
            return False
        a = s.find(start_at)
        b = s.find(end_at, a + len(start_at))
        if b == -1:
            errors.append('%s: no end anchor after the start anchor' % label)
            return False
        s = s[:a] + new + s[b:]
        log.append(label)
        return True

    def report(name, ok):
        print('   %-40s %s' % (name, 'ok' if ok else 'FAILED'))

    print('=' * 72)
    print(' Nodalis v9.9-L - the loading screen')
    print('=' * 72)
    print(' file: %s  (%d bytes)\n' % (path, len(src)))

    report('stylesheet', once('\n</style>\n</head>',
                              '\n' + block('css.css') + '\n</style>\n</head>', 'stylesheet'))

    report('module state', once(
        """  /* v9.6-L: the card's own parts. */
  let bars = null;
  let meter = null;
  let pctLine = null;""",
        """  /* v9.6-L: the card's own parts. */
  let bars = null;
  let meter = null;
  let pctLine = null;
  /* v9.9-L: the sheet's lines, the ring's chords, and the one-shot boom. */
  let noteLines = [];
  let links = [];
  let boomed = false;""", 'module state'))

    report('build() rebuilt', splice(
        '  /* ===================================================================== *\n'
        '   * v9.6-L: THE LOADING SCREEN.',
        '  /** The Nodalis mark:',
        block('build.js') + '\n', 'build'))

    report('progress() drives the sheet and the boom', splice(
        '  /** progress(0..1, optionalStepIndexOrText) */',
        '  /**\n   * Let the sequence land, then pull focus into the app.',
        block('progress.js') + '\n', 'progress'))

    report('teardown clears the new handles', once(
        "          root = null; barFill = null; stepLine = null;\n"
        "          bars = null; meter = null; pctLine = null;",
        "          root = null; barFill = null; stepLine = null;\n"
        "          bars = null; meter = null; pctLine = null;\n"
        "          noteLines = []; links = []; boomed = false;", 'teardown'))

    # A boom worth watching needs a beat to play in.
    report('sequence 1900ms -> 2350ms', once(
        "  const SEQUENCE_MS = 1900;   // v9.6-L: long enough to read the card, short enough not to be a toll",
        "  const SEQUENCE_MS = 2350;   // v9.9-L: the extra 450ms is the boom; the Skip button is still there",
        'sequence length'))

    print('\n' + '=' * 72)
    if errors:
        print(' %d PROBLEM(S) - nothing was written:' % len(errors))
        for e in errors:
            print('   - %s' % e)
        return 1
    print(' %d edits applied cleanly.' % len(log))
    print(' %d -> %d bytes (%+d)' % (len(src), len(s), len(s) - len(src)))

    if dry:
        print('\n --dry-run: %s was NOT modified.' % path)
        return 0

    io.open(path + '.bak', 'w', encoding='utf-8').write(src)
    io.open(path, 'w', encoding='utf-8').write(s)
    print('\n wrote  %s\n backup %s.bak' % (path, path))
    print('=' * 72)
    return 0


if __name__ == '__main__':
    sys.exit(main())
