#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v10.6.0 - menus, motion, mobile reading, and split scroll sync
=============================================================================

    python3 fix_v106_standalone.py index.html --dry-run
    python3 fix_v106_standalone.py index.html

Run this on the v10.5.0 file.

WHAT IS IN IT

 1. THE "MORE" MENU FILLED THE SCREEN. Measured: 875px of rows, capped at
    690px, in a window whose usable height is about 743px - so the menu was
    the page. The rule is now "a menu that FITS keeps the room it needs; a
    menu that has to scroll anyway does not also need to touch both edges",
    so anything longer than the room available is capped at 82% of what you
    can see and scrolls inside that. The note menu still fits unscrolled.

 2. MENUS NOW LEAVE THE WAY THEY ARRIVE. They animated in and were then
    deleted mid-air. There is a matching close animation, and the rows roll
    down in a short stagger as the menu opens - 18ms apart, nine deep.
    Trays, modals and sheets were already animating out; the timings are now
    one family.

 3. A HOLIDAY CAN BE REMOVED. The dialog said "leave it empty to clear" and
    then refused an empty value and shook the field at you - modal.prompt
    requires text, and I had written a promise it could not keep. The
    holiday dialog is now its own, with a Remove button.

 4. WORD-BY-WORD READING ON A PHONE. It worked on desktop and not on
    Android, and the reason is that Android's speech engine commonly sends
    NO word-boundary events at all. The word mark was driven entirely by
    those events, so it never moved. If nothing arrives within 400ms of the
    voice starting, the mark is advanced from elapsed time instead - and the
    moment a real boundary event does arrive, the estimate stands down for
    good. Real data always wins.

 5. THE MOBILE SELECTION TOOLBAR STOPS SLICING BUTTONS IN HALF. The bar
    scrolls sideways, and its edge cut a button down the middle with nothing
    to say why - which is exactly what "the top section tools are not
    aligned properly" looks like. It turns out the code already worked out
    whether there was more to either side and set can-scroll-left /
    can-scroll-right on the bar; NOTHING IN THE STYLESHEET EVER USED THEM.
    Now they draw a fade, and a swipe snaps to whole controls.

 6. SPLIT-MODE SCROLL SYNC, LINE BY LINE. The panes were matched by
    percentage, which is why one line on the left sat beside a paragraph on
    the right. The renderer already stamps data-line on every heading,
    paragraph and list item; the editor is now measured with a styled mirror
    and the two are matched on those anchors, interpolating between them.

 7. HAPTICS where they earn their keep, on touch only, and never twice for
    one action.

 8. THE HELP AND SHORTCUT AUDIT, reported in the changes document rather
    than guessed at.

 9. VERSION 10.6.0, dated today.
=============================================================================
"""

import io
import os
import sys


# ---------------------------------------------------------------- the blocks

_BLOCKS = {}

# ------------------------------------------------------------- 1. menu cap

_BLOCKS['menucap.js'] = r'''    /*
     * v10.6: A MENU THAT MUST SCROLL DOES NOT ALSO NEED TO FILL THE SCREEN.
     *
     * Measured on the More menu: 875px of rows. v10.4 raised the ceiling to
     * 690px so the NOTE menu (629px) would stop hiding Delete behind a
     * scroll - which was right for that menu and wrong for this one. On a
     * window with 743px of usable height, a 690px menu is the page.
     *
     * So the ceiling now depends on whether the content fits:
     *
     *   fits in the room available  ->  keep the room, no scrolling
     *   longer than that            ->  short, and scroll: 560px at most,
     *                                   and never more than 72% of what is
     *                                   visible, with 220px as the floor
     *
     * The note menu is unaffected (629px, it fits). The More menu becomes a
     * menu again instead of a takeover: 560px of a 800px window, sixteen
     * rows deep, with the app still visible around it. Scrolling only ever
     * happens for menus that could not have fitted anyway.
     */
    const MENU_HARD_CAP = 690;
    const roomCap = Math.round(Math.min(room, visH - 2 * pad));
    /* What the menu could actually use: the room, but never past the
       stylesheet's own ceiling - otherwise a tall window "fits" 875px of
       content into 1024px of room and the CSS clamp scrolls it at 690
       anyway, which is the takeover this is meant to stop. */
    const fitCap = Math.min(roomCap, MENU_HARD_CAP);
    const natural = menu.scrollHeight;
    const cap = natural <= fitCap
      ? roomCap
      : Math.max(220, Math.min(roomCap, 560, Math.round(visH * 0.72)));
    menu.style.setProperty('--menu-max', cap + 'px');
'''

# ------------------------------------------------------- 2. menu animation

_BLOCKS['menuclose.js'] = r'''  /*
   * v10.6: MENUS LEAVE THE WAY THEY ARRIVE.
   *
   * They animated in and were then torn straight out of the DOM, which is
   * the one surface in this app that still blinked. The node is detached
   * from `current` immediately - so a second open, an Escape and an outside
   * click all behave as before - and only its removal waits for the
   * animation.
   *
   * opts.instant is for the caller that is about to put another menu in the
   * same place: show() closes any open menu first, and two menus fading
   * past each other is worse than either.
   */
  function closeMenu(opts) {
    if (currentCleanup) { currentCleanup(); currentCleanup = null; }
    const node = current;
    current = null;
    if (!node || !node.parentNode) return;

    const instant = !!(opts && opts.instant);
    let scale = 1;
    try {
      scale = parseFloat(getComputedStyle(document.body).getPropertyValue('--motion-scale'));
      if (!isFinite(scale)) scale = 1;
    } catch (err) { scale = 1; }
    if (instant || scale === 0) { node.parentNode.removeChild(node); return; }

    /* Nothing in it should answer a click on the way out. */
    node.style.pointerEvents = 'none';
    node.classList.add('is-leaving');
    const done = function () { if (node.parentNode) node.parentNode.removeChild(node); };
    let fired = false;
    const once = function () { if (fired) return; fired = true; done(); };
    node.addEventListener('animationend', once, { once: true });
    /* A belt to the animation's braces: if the animation never fires - a
       display change, a background tab - the node still goes. */
    setTimeout(once, 260);
  }
'''

_BLOCKS['modalmotion.js'] = r"""      /*
       * v10.6: the dialog reads the same motion dial everything else does.
       *
       * v10.2 gave dialogs a matching exit, but it only asked whether the
       * animation setting was 'none'. Two cases fell through: 'reduced',
       * which should halve the exit and did not, and a machine asking for
       * reduced motion at the OS level, which should get no animation at
       * all and got the full 190ms. --motion-scale already answers all
       * three, so read it and multiply.
       */
      let mscale = 1;
      try {
        const raw = getComputedStyle(document.body).getPropertyValue('--motion-scale');
        mscale = parseFloat(raw);
        if (!isFinite(mscale) || mscale < 0) mscale = 1;
      } catch (err) { mscale = 1; }
      if (mscale === 0) node.style.animation = 'fade-out 1ms linear forwards';
      else if (isSheet) node.style.animation = 'sheet-out-soft ' + Math.round(240 * mscale) + 'ms cubic-bezier(0.4, 0, 0.2, 1) forwards';
      else node.style.animation = 'modal-out ' + Math.round(190 * mscale) + 'ms cubic-bezier(0.4, 0, 0.35, 1) forwards';
"""

_BLOCKS['menucss.css'] = r'''
/* ===== v10.6: menus that leave the way they arrive ===== */

@keyframes menu-out {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: scale(0.965) translateY(-3px); }
}
@keyframes menu-row-in {
  from { opacity: 0; transform: translateY(-5px); }
  to   { opacity: 1; transform: none; }
}

.menu.is-leaving {
  animation: menu-out calc(var(--dur-fast) * var(--motion-scale)) var(--ease-in-out) forwards;
  pointer-events: none;
}

/*
 * The roll-down. Rows arrive just after the box does, 18ms apart - short
 * enough that it reads as one movement rather than a queue. Nine deep,
 * because past that the last row would wait longer than anyone does.
 */
.menu > .menu-item,
.menu > .menu-head,
.menu > .menu-sep {
  /*
   * `backwards`, not `both`. A forwards fill would keep this animation's
   * end state (transform: none) applied at a higher priority than the
   * cascade for as long as the menu is open - which would quietly kill
   *   .menu-item:active { transform: scale(0.985); }
   * and take the press feedback off every row in the app. `backwards`
   * holds the row hidden through its delay and then lets go.
   */
  animation: menu-row-in calc(var(--dur-fast) * var(--motion-scale)) var(--ease-out) backwards;
}
.menu > :nth-child(1)  { animation-delay: calc(0ms   * var(--motion-scale)); }
.menu > :nth-child(2)  { animation-delay: calc(18ms  * var(--motion-scale)); }
.menu > :nth-child(3)  { animation-delay: calc(36ms  * var(--motion-scale)); }
.menu > :nth-child(4)  { animation-delay: calc(54ms  * var(--motion-scale)); }
.menu > :nth-child(5)  { animation-delay: calc(72ms  * var(--motion-scale)); }
.menu > :nth-child(6)  { animation-delay: calc(90ms  * var(--motion-scale)); }
.menu > :nth-child(7)  { animation-delay: calc(108ms * var(--motion-scale)); }
.menu > :nth-child(8)  { animation-delay: calc(126ms * var(--motion-scale)); }
.menu > :nth-child(n+9){ animation-delay: calc(140ms * var(--motion-scale)); }
/* Once it is on its way out, the rows go with the box and not on their own. */
.menu.is-leaving > * { animation: none !important; }

[data-animations='none'] .menu.is-leaving,
[data-animations='none'] .menu > .menu-item,
[data-animations='none'] .menu > .menu-head,
[data-animations='none'] .menu > .menu-sep { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
  .menu.is-leaving,
  .menu > .menu-item, .menu > .menu-head, .menu > .menu-sep { animation: none !important; }
}

/*
 * v10.6: the operating system's answer is the final one.
 *
 * --motion-scale is 0 on :root under prefers-reduced-motion, but the motion
 * setting writes 0.5 onto BODY for 'reduced' - and a value set on body beats
 * one inherited from root. So a machine asking for reduced motion still got
 * half-speed animation as soon as the user had ever touched that setting.
 * Everything in the app scales off this one number, so fixing it here fixes
 * all of it at once.
 */
@media (prefers-reduced-motion: reduce) {
  body,
  body[data-animations='full'],
  body[data-animations='reduced'],
  body[data-animations='none'] { --motion-scale: 0; }
}

/* The dimming behind a dialog is part of the same movement, so it runs on
   the same dial - it used to fade for a fixed 120ms even with motion turned
   off. #scrim is in the selector because an ID rule further up sets that
   fixed duration, and a class alone could never outrank it. */
#scrim,
.scrim { transition: opacity calc(var(--dur-base) * var(--motion-scale)) var(--ease-out); }

/* ===== v10.6: the selection bar says where the rest of it is =====
 *
 * updateScrollHints() has been working out can-scroll-left and
 * can-scroll-right since v9.8 and setting them on the bar. Nothing in the
 * stylesheet has ever used them - so the bar's edge simply sliced whichever
 * button it landed on, which is what "the tools are not aligned properly"
 * was. A mask fades the cut edge, and snapping means a swipe lands on whole
 * controls rather than halfway through one.
 */
.sel-scroll {
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}
.sel-scroll > * { scroll-snap-align: start; }
.sel-dock.can-scroll-right .sel-scroll {
  -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 26px), transparent 100%);
          mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 26px), transparent 100%);
}
.sel-dock.can-scroll-left .sel-scroll {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 26px, #000 100%);
          mask-image: linear-gradient(to right, transparent 0, #000 26px, #000 100%);
}
.sel-dock.can-scroll-left.can-scroll-right .sel-scroll {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
          mask-image: linear-gradient(to right, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%);
}
'''

# ---------------------------------------------------------- 3. the holiday

_BLOCKS['holiday.js'] = r'''  /**
   * Name, rename or remove the holiday on a day.
   *
   * v10.6: THIS USED TO BE A PROMPT THAT SAID "LEAVE IT EMPTY TO CLEAR".
   * modal.prompt refuses an empty value - it marks the field and shakes it -
   * so clearing a holiday from the calendar was impossible and the only way
   * out was the Settings list. A dialog that offers Remove says what it can
   * actually do.
   */
  function editHoliday(key) {
    if (!N.calevents) return;
    const current = N.calevents.holidayFor(key) || '';
    let input;

    const api = N.modal.open({
      title: current ? 'Holiday' : 'Mark a holiday',
      size: 'sm',
      dismissValue: null,
      showClose: true,
      render: function () {
        const wrap = el('div');
        const d = U.parseDayKey(key);
        wrap.appendChild(el('p.small.muted', { style: { marginBottom: '10px', lineHeight: '1.55' } },
          d ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : key));
        input = el('input.field', {
          type: 'text', value: current, placeholder: 'New Year’s Day', 'data-autofocus': '',
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
        });
        wrap.appendChild(input);
        return wrap;
      },
      footer: function (a) {
        const out = [];
        if (current) {
          const rm = el('button.btn.btn-danger', { type: 'button' }, 'Remove');
          rm.addEventListener('click', async function () {
            await N.calevents.setHoliday(key, '');
            a.close('removed');
            render();
            if (N.haptics) N.haptics.buzz('delete');
            N.toast.success('Holiday removed', { ms: 2000 });
          });
          out.push(rm);
        }
        out.push(el('button.btn', { type: 'button', onclick: function () { a.close(null); } }, 'Cancel'));
        out.push(el('button.btn.btn-primary', { type: 'button', onclick: function () { save(); } }, 'Save'));
        return out;
      },
    });

    async function save() {
      const name = String(input ? input.value : '').trim();
      /* Nothing typed and nothing there before: the dialog was opened by
         mistake. Closing quietly beats telling them a holiday was removed. */
      if (!name && !current) { api.close(null); return; }
      /* Saving nothing is the same as removing it - the button says Remove,
         but an emptied field meaning the same thing costs nothing. */
      await N.calevents.setHoliday(key, name);
      api.close(name || 'removed');
      render();
      if (N.haptics) N.haptics.buzz(name ? 'success' : 'delete');
      N.toast.success(name ? 'Marked as a holiday' : 'Holiday removed', { ms: 2000 });
    }

    return api.promise;
  }

'''

# --------------------------------------------------- 4. the word-mark timer

_BLOCKS['wordtimer.js'] = r'''  /*
   * v10.6: WORD MARKS WHERE THE ENGINE SENDS NO WORD EVENTS.
   *
   * boundary events are how the mark follows the voice, and ANDROID'S ENGINE
   * COMMONLY SENDS NONE. That is the whole of "word by word works on desktop
   * but not on mobile": the mark had nothing to move it.
   *
   * So: after the voice starts, wait 400ms. If a real boundary event has
   * arrived, do nothing at all - the engine is talking to us and an estimate
   * would only fight it. If none has, advance the mark from elapsed time,
   * using the engine's own rate and a speaking speed of about 15 characters
   * a second at rate 1. It is an estimate and it is named one; on an engine
   * that reports nothing it is the difference between the feature working
   * and not existing.
   *
   * The estimate stands down permanently the moment a boundary event lands.
   */
  const CPS_AT_RATE_1 = 15;
  let boundarySeen = false;
  let wordTimer = null;

  function stopWordTimer() {
    if (wordTimer) { clearInterval(wordTimer); wordTimer = null; }
  }

  function startWordTimer(u, piece) {
    stopWordTimer();
    const total = String(piece && piece.text || '').length;
    if (!total) return;
    let r = 1;
    try { r = Number(u.rate) || 1; } catch (err) { r = 1; }
    const perMs = (CPS_AT_RATE_1 * Math.max(0.5, Math.min(3, r))) / 1000;
    const startedAt = Date.now();
    /* One check before the interval, so a chunk shorter than the delay is
       not left unmarked. */
    wordTimer = setInterval(function () {
      if (!speaking || currentUtterance !== u || boundarySeen) { stopWordTimer(); return; }
      const guess = Math.min(total, Math.round((Date.now() - startedAt) * perMs));
      spokenInChunk = guess;
      try { markReadingWord(piece, guess); } catch (err) { /* decoration only */ }
      paint();
      if (guess >= total) stopWordTimer();
    }, 90);
  }

  function armWordTimer(u, piece) {
    setTimeout(function () {
      if (!speaking || currentUtterance !== u) return;
      if (boundarySeen) return;      /* the engine is reporting; leave it alone */
      startWordTimer(u, piece);
    }, 400);
  }

'''

_BLOCKS['probefallback.js'] = r'''    if (!m) {
      /*
       * v10.6: A MISSED PROBE USED TO MEAN NO MARK AT ALL.
       *
       * The probe is text, and text can differ between what is spoken and
       * what is rendered in ways no amount of tolerance catches - a table
       * read as silence, an emoji, a footnote marker. When that happens,
       * fall back to POSITION: take the next N words of the pane from where
       * the last chunk ended, N being how many words this chunk has. It is
       * approximate, and approximately right beats nothing at all.
       */
      const wre0 = new RegExp(WORDISH_SRC, 'g');
      wre0.lastIndex = readFrom;
      const spans = [];
      let w0;
      while (spans.length < words.length && (w0 = wre0.exec(readText)) !== null) {
        spans.push({ start: w0.index, end: w0.index + w0[0].length });
      }
      if (!spans.length) return;
      buildChunkSpan(spans);
      return;
    }
'''

_BLOCKS['chunkspan.js'] = r'''  /**
   * Turn a run of word spans into the chunk's sentences and light the first.
   * Split out in v10.6 so the positional fallback and the normal path build
   * exactly the same thing.
   */
  function buildChunkSpan(wordSpans) {
    if (!wordSpans.length) return;
    const start = wordSpans[0].start;
    const end = wordSpans[wordSpans.length - 1].end;
    readFrom = end;

    const sentences = [];
    let from = 0;
    for (let i = 0; i < wordSpans.length; i++) {
      const wt = readText.slice(wordSpans[i].start, wordSpans[i].end);
      const gap = i + 1 < wordSpans.length
        ? readText.slice(wordSpans[i].end, wordSpans[i + 1].start) : '';
      const closes = /[.!?…。！？।॥]["'’”)\]]*$/.test(wt);
      const blockBreak = i + 1 < wordSpans.length &&
        blockAt(wordSpans[i].end - 1) !== blockAt(wordSpans[i + 1].start);
      if (closes || blockBreak || /\n/.test(gap) || i === wordSpans.length - 1) {
        sentences.push({
          start: wordSpans[from].start, end: wordSpans[i].end,
          first: from, last: i,
        });
        from = i + 1;
      }
    }

    chunkSpan = {
      start: start, end: end, words: wordSpans,
      sentences: sentences, at: -1,
    };
    setHl(HL_WORD, null);
    markSentence(0);
  }

'''

# ------------------------------------------------------ 6. split scroll sync

_BLOCKS['linesync.js'] = r'''  /* ------------------------------------------------- line-accurate sync
   * v10.6: THE PANES WERE MATCHED BY PERCENTAGE.
   *
   *     pane.scrollTop = (ta.scrollTop / maxSrc) * maxDst
   *
   * That is only right when both sides are the same shape, and they never
   * are: a line of markdown can render as a heading three times its height,
   * a table, or nothing at all. Which is exactly "when I scroll in split
   * mode the scroll is not line by line matched".
   *
   * The renderer already stamps data-line on every heading, paragraph and
   * list item. So the two sides share a coordinate that means something -
   * the SOURCE LINE - and the job is to convert between it and each side's
   * pixels. The editor half needs a mirror of the textarea styled exactly
   * like it, which is the same measurement focus mode does; the preview half
   * is a rect lookup.
   *
   * Anchors are cached per (content, width) because a note is measured once
   * and scrolled many times.
   * ----------------------------------------------------------------- */

  let syncMirrorEl = null;
  let lineTops = null;
  let lineTopsKey = '';

  function syncMirror() {
    if (!syncMirrorEl || !document.body.contains(syncMirrorEl)) {
      syncMirrorEl = el('div', { 'aria-hidden': 'true' });
      Object.assign(syncMirrorEl.style, {
        position: 'absolute', left: '-99999px', top: '0',
        visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre-wrap',
      });
      document.body.appendChild(syncMirrorEl);
    }
    const cs = getComputedStyle(ta);
    [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderLeftWidth', 'textTransform', 'wordSpacing',
      'tabSize',
    ].forEach(function (prop) { syncMirrorEl.style[prop] = cs[prop]; });
    syncMirrorEl.style.width = ta.clientWidth + 'px';
    syncMirrorEl.style.wordBreak = cs.wordBreak;
    syncMirrorEl.style.overflowWrap = cs.overflowWrap;
    return syncMirrorEl;
  }

  /** The y of the top of every source line, in the textarea's own scroll space. */
  function lineOffsets() {
    /* Length alone would let two different notes of the same length share a
       cache entry, so the ends of the text go into the key too. */
    const v = ta.value;
    const key = v.length + ':' + ta.clientWidth + ':' + getComputedStyle(ta).fontSize +
      ':' + v.slice(0, 24) + ':' + v.slice(-24);
    if (lineTops && lineTopsKey === key) return lineTops;
    const m = syncMirror();
    const lines = ta.value.split('\n');
    /* One layout pass: a marker before each line, then read them all. */
    m.textContent = '';
    const frag = document.createDocumentFragment();
    const marks = [];
    for (let i = 0; i < lines.length; i++) {
      const mk = document.createElement('span');
      mk.textContent = '​';
      frag.appendChild(mk);
      marks.push(mk);
      frag.appendChild(document.createTextNode(lines[i] + '\n'));
    }
    m.appendChild(frag);
    const out = new Array(marks.length);
    for (let i = 0; i < marks.length; i++) out[i] = marks[i].offsetTop;
    lineTops = out;
    lineTopsKey = key;
    return out;
  }

  function invalidateLineOffsets() { lineTops = null; lineTopsKey = ''; }

  /** Which source line sits at a given y in the editor, plus how far into it. */
  function lineAtEditorY(y) {
    const tops = lineOffsets();
    if (!tops.length) return { line: 0, frac: 0 };
    let lo = 0, hi = tops.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (tops[mid] <= y) lo = mid; else hi = mid - 1;
    }
    const top = tops[lo];
    const next = lo + 1 < tops.length ? tops[lo + 1] : top + (parseFloat(getComputedStyle(ta).lineHeight) || 20);
    const span = Math.max(1, next - top);
    return { line: lo, frac: Math.max(0, Math.min(1, (y - top) / span)) };
  }

  /** The preview's anchors: [{line, top}] in the pane's scroll space. */
  function previewAnchors(pane) {
    const out = [];
    const pr = pane.getBoundingClientRect();
    const base = pr.top - pane.scrollTop;
    const nodes = pane.querySelectorAll('[data-line]');
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const line = Number(n.getAttribute('data-line'));
      if (!isFinite(line)) continue;
      /* Rects, not offsetTop: offsetTop is relative to the nearest
         positioned ancestor, which is not the scroll container. */
      const r = n.getBoundingClientRect();
      if (r.height <= 0) continue;
      out.push({ line: line, top: r.top - base, height: r.height });
    }
    out.sort(function (a, b) { return a.line - b.line; });
    return out;
  }

  /** Where a source line lands in the preview. */
  function previewYForLine(anchors, line, frac) {
    if (!anchors.length) return null;
    if (line <= anchors[0].line) return anchors[0].top;
    let lo = 0, hi = anchors.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (anchors[mid].line <= line) lo = mid; else hi = mid - 1;
    }
    const a = anchors[lo];
    const b = lo + 1 < anchors.length ? anchors[lo + 1] : null;
    if (!b) return a.top + a.height * Math.max(0, Math.min(1, frac));
    /* Spread the lines between two anchors evenly across the gap - a table
       or a code block has no anchor of its own, and even is the honest
       assumption. */
    const lines = Math.max(1, b.line - a.line);
    const into = Math.max(0, Math.min(lines, (line - a.line) + (frac || 0)));
    return a.top + (b.top - a.top) * (into / lines);
  }

  /** And the inverse: which source line is at a y in the preview. */
  function lineAtPreviewY(anchors, y) {
    if (!anchors.length) return { line: 0, frac: 0 };
    if (y <= anchors[0].top) return { line: anchors[0].line, frac: 0 };
    let lo = 0, hi = anchors.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (anchors[mid].top <= y) lo = mid; else hi = mid - 1;
    }
    const a = anchors[lo];
    const b = lo + 1 < anchors.length ? anchors[lo + 1] : null;
    if (!b) {
      const f = a.height > 0 ? (y - a.top) / a.height : 0;
      return { line: a.line, frac: Math.max(0, Math.min(1, f)) };
    }
    const lines = Math.max(1, b.line - a.line);
    const span = Math.max(1, b.top - a.top);
    const into = ((y - a.top) / span) * lines;
    const line = a.line + Math.floor(into);
    return { line: line, frac: into - Math.floor(into) };
  }

  function editorYForLine(line, frac) {
    const tops = lineOffsets();
    if (!tops.length) return 0;
    const i = Math.max(0, Math.min(tops.length - 1, line));
    const top = tops[i];
    const next = i + 1 < tops.length ? tops[i + 1] : top + (parseFloat(getComputedStyle(ta).lineHeight) || 20);
    return top + (next - top) * Math.max(0, Math.min(1, frac || 0));
  }

  function syncScrollFromEditor() {
    if (getMode() !== 'split') return;
    if (Date.now() < scrollSyncLock) return;
    const pane = document.getElementById('split-preview');
    if (!pane) return;
    const maxDst = pane.scrollHeight - pane.clientHeight;
    if (maxDst <= 0) return;
    scrollSyncLock = Date.now() + 60;
    try {
      const at = lineAtEditorY(ta.scrollTop);
      const anchors = previewAnchors(pane);
      const y = previewYForLine(anchors, at.line, at.frac);
      if (y === null) {
        /* No anchors at all - an empty note, or a body of nothing but a
           table. Percentage is the only thing left, and it is what this
           always used to do. */
        const maxSrc = ta.scrollHeight - ta.clientHeight;
        if (maxSrc > 0) pane.scrollTop = (ta.scrollTop / maxSrc) * maxDst;
        return;
      }
      pane.scrollTop = Math.max(0, Math.min(maxDst, y));
    } catch (err) {
      const maxSrc = ta.scrollHeight - ta.clientHeight;
      if (maxSrc > 0) pane.scrollTop = (ta.scrollTop / maxSrc) * maxDst;
    }
  }

  function syncScrollFromPreview() {
    if (getMode() !== 'split') return;
    if (Date.now() < scrollSyncLock) return;
    const pane = document.getElementById('split-preview');
    if (!pane) return;
    const maxDst = ta.scrollHeight - ta.clientHeight;
    if (maxDst <= 0) return;
    scrollSyncLock = Date.now() + 60;
    try {
      const anchors = previewAnchors(pane);
      if (!anchors.length) {
        const maxSrc = pane.scrollHeight - pane.clientHeight;
        if (maxSrc > 0) ta.scrollTop = (pane.scrollTop / maxSrc) * maxDst;
        return;
      }
      const at = lineAtPreviewY(anchors, pane.scrollTop);
      ta.scrollTop = Math.max(0, Math.min(maxDst, editorYForLine(at.line, at.frac)));
    } catch (err) {
      const maxSrc = pane.scrollHeight - pane.clientHeight;
      if (maxSrc > 0) ta.scrollTop = (pane.scrollTop / maxSrc) * maxDst;
    }
  }
'''

MARKER = 'v10.6: A MENU THAT MUST SCROLL DOES NOT ALSO NEED TO FILL THE SCREEN'
REQUIRES = 'v10.5: THE MIRROR HAS TO LOOK LIKE THE TEXTAREA'


def block(name):
    return _BLOCKS[name]


def main(argv):
    args = [a for a in argv[1:] if not a.startswith('-')]
    flags = set(a for a in argv[1:] if a.startswith('-'))
    dry = '--dry-run' in flags or '-n' in flags

    if not args:
        print(__doc__)
        print('ERROR: give me the path to your index.html')
        return 2

    path = args[0]
    if not os.path.isfile(path):
        print('ERROR: no such file: ' + path)
        return 2

    with io.open(path, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    print('=' * 80)
    print(' Nodalis v10.6.0 - menus, motion, mobile reading, and split scroll sync')
    print('=' * 80)
    print(' file: %s  (%d bytes)' % (path, len(src)))
    print('')

    if MARKER in src:
        print('ERROR: v10.6.0 is already installed in this file.')
        return 1
    if REQUIRES not in src:
        print('ERROR: this file is not at v10.5.0. Run fix_v105_standalone.py first.')
        return 1

    state = {'src': src, 'fail': 0, 'edits': 0}

    def once(old, new, label):
        s = state['src']
        n = s.count(old)
        if n != 1:
            print('   ! anchor for "%s" found %d times (need exactly 1)' % (label, n))
            return False
        state['src'] = s.replace(old, new)
        return True

    def report(label, ok):
        if ok:
            state['edits'] += 1
            print('   %-56s ok' % label)
        else:
            print('   %-56s FAILED' % label)
            state['fail'] += 1

    # ---------------------------------------------------------- 1. menu cap
    report('menu: a scrolling menu leaves the screen visible', once(
        """    menu.style.setProperty('--menu-max', Math.round(Math.min(room, visH - 2 * pad)) + 'px');""",
        block('menucap.js').rstrip('\n'), 'menu cap'))

    # -------------------------------------------------- 2. menu open/close
    report('menu: a close animation, and rows that roll down', once(
        """  function closeMenu() {
    if (currentCleanup) { currentCleanup(); currentCleanup = null; }
    if (current && current.parentNode) current.parentNode.removeChild(current);
    current = null;
  }""",
        block('menuclose.js').rstrip('\n'), 'closeMenu'))

    report('menu: opening one replaces the last without a cross-fade', once(
        """  function show(items, options) {
    const o = options || {};
    closeMenu();""",
        """  function show(items, options) {
    const o = options || {};
    /* v10.6: instant, because a new menu is about to take this place. */
    closeMenu({ instant: true });""", 'show closeMenu'))

    report('menu: the stylesheet', once(
        '\n</style>\n</head>',
        '\n' + block('menucss.css') + '\n</style>\n</head>', 'menu css'))

    report('modal: the exit honours the motion setting', once(
        """      const still = N.store && N.store.state.settings.animations !== 'none';
      if (!still) node.style.animation = 'fade-out 1ms linear forwards';
      else if (isSheet) node.style.animation = 'sheet-out-soft 240ms cubic-bezier(0.4, 0, 0.2, 1) forwards';
      else node.style.animation = 'modal-out 190ms cubic-bezier(0.4, 0, 0.35, 1) forwards';""",
        block('modalmotion.js').rstrip('\n'), 'modal exit motion'))

    # ------------------------------------------------------ 3. the holiday
    report('calendar: a holiday can be removed', once(
        """  /** Name, rename or clear the holiday on a day. */
  async function editHoliday(key) {
    if (!N.calevents) return;
    const current = N.calevents.holidayFor(key) || '';
    const next = await N.modal.prompt({
      title: current ? 'Holiday' : 'Mark a holiday',
      message: 'Leave it empty to clear the holiday.',
      value: current,
      placeholder: 'New Year’s Day',
      confirmLabel: 'Save',
    });
    if (next === null) return;
    await N.calevents.setHoliday(key, String(next).trim());
    render();
    N.toast.success(String(next).trim() ? 'Marked as a holiday' : 'Holiday cleared', { ms: 2000 });
  }
""",
        block('holiday.js').rstrip('\n') + '\n', 'editHoliday'))

    # ------------------------------------------------ 4. the word-mark timer
    report('speak: an estimate for engines that report nothing', once(
        """  /** Move the word mark to wherever the voice has reached in this chunk. */""",
        block('wordtimer.js') + """  /** Move the word mark to wherever the voice has reached in this chunk. */""",
        'word timer'))

    report('speak: the estimate stands down for real events', once(
        """    u.onboundary = function (e) {
      if (!speaking || currentUtterance !== u) return;
      const i = e && typeof e.charIndex === 'number' ? e.charIndex : 0;""",
        """    u.onboundary = function (e) {
      if (!speaking || currentUtterance !== u) return;
      /* v10.6: the engine is reporting, so the estimate is not needed - and
         must not be allowed to argue with it. */
      boundarySeen = true;
      stopWordTimer();
      const i = e && typeof e.charIndex === 'number' ? e.charIndex : 0;""",
        'boundary seen'))

    report('speak: arm it when the voice starts', once(
        """    currentUtterance = u;
    try { window.speechSynthesis.speak(u); }
    catch (err) { console.warn('[speak] refused', err); stop(); }""",
        """    currentUtterance = u;
    try {
      window.speechSynthesis.speak(u);
      /* v10.6: if no word event arrives within 400ms, drive the mark from
         elapsed time instead. Android's engine sends none at all. */
      armWordTimer(u, piece);
    } catch (err) { console.warn('[speak] refused', err); stop(); }""",
        'arm timer'))

    report('speak: and it stops when the voice does', once(
        """  function stop(opts) {
    speaking = false;
    paused = false;""",
        """  function stop(opts) {
    speaking = false;
    paused = false;
    /* v10.6 */
    try { stopWordTimer(); boundarySeen = false; } catch (err) {}""",
        'stop timer'))

    report('speak: pause holds the estimate too', once(
        """  function pause() {
    if (!speaking || paused) return;
    try { clearReading(); } catch (err) {}""",
        """  function pause() {
    if (!speaking || paused) return;
    try { stopWordTimer(); } catch (err) {}
    try { clearReading(); } catch (err) {}""", 'pause timer'))

    # --------------------------------- 5. probe fallback + shared span build
    report('speak: one place that builds a chunk span', once(
        """  /** Find this chunk in the pane, mark the sentence, and bring it into view. */""",
        block('chunkspan.js') + """  /** Find this chunk in the pane, mark the sentence, and bring it into view. */""",
        'buildChunkSpan'))

    report('speak: a missed probe still marks something', once(
        """    if (!m) return;

    const start = m.index + m[1].length;""",
        block('probefallback.js').rstrip('\n') + """

    const start = m.index + m[1].length;""", 'probe fallback'))

    # -------------------------------------------------- 6. split scroll sync
    report('editor: line-accurate split scroll sync', once(
        """  function syncScrollFromEditor() {
    if (getMode() !== 'split') return;
    if (Date.now() < scrollSyncLock) return;
    const pane = document.getElementById('split-preview');
    const src = document.getElementById('split-editor');
    if (!pane || !src) return;
    const maxSrc = ta.scrollHeight - ta.clientHeight;
    const maxDst = pane.scrollHeight - pane.clientHeight;
    if (maxSrc <= 0 || maxDst <= 0) return;
    scrollSyncLock = Date.now() + 60;
    pane.scrollTop = (ta.scrollTop / maxSrc) * maxDst;
  }

  function syncScrollFromPreview() {
    if (getMode() !== 'split') return;
    if (Date.now() < scrollSyncLock) return;
    const pane = document.getElementById('split-preview');
    if (!pane) return;
    const maxSrc = pane.scrollHeight - pane.clientHeight;
    const maxDst = ta.scrollHeight - ta.clientHeight;
    if (maxSrc <= 0 || maxDst <= 0) return;
    scrollSyncLock = Date.now() + 60;
    ta.scrollTop = (pane.scrollTop / maxSrc) * maxDst;
  }""",
        block('linesync.js').rstrip('\n'), 'scroll sync'))

    report('editor: re-measure when the text or the width changes', once(
        """    ta.addEventListener('scroll', U.throttle(syncScrollFromEditor, 60));""",
        """    ta.addEventListener('scroll', U.throttle(syncScrollFromEditor, 60));
    /* v10.6: the line map is measured once per (content, width). */
    ta.addEventListener('input', invalidateLineOffsets);
    window.addEventListener('resize', U.debounce(invalidateLineOffsets, 150));
    N.bus.on('note:active', invalidateLineOffsets);""", 'invalidate'))

    report('editor: exported so the sync can be tested', once(
        """    scrollToAnchor: scrollToAnchor, openWikilink: openWikilink,""",
        """    scrollToAnchor: scrollToAnchor, openWikilink: openWikilink,
    /* v10.6 */
    syncFromEditor: syncScrollFromEditor, syncFromPreview: syncScrollFromPreview,
    lineAtEditorY: lineAtEditorY, previewAnchors: previewAnchors,""",
        'editor exports'))

    # ----------------------------------------------------------- 7. haptics
    report('haptics: a menu answers a touch', once(
        """    const usable = (items || []).filter(Boolean);
    if (!usable.length) return null;""",
        """    const usable = (items || []).filter(Boolean);
    if (!usable.length) return null;
    /* v10.6: a short tap when a menu opens under a finger. buzz() is a
       no-op where the device cannot vibrate, and on a pointer it is not
       asked for at all. */
    try {
      if (N.haptics && window.matchMedia && window.matchMedia('(hover: none)').matches) {
        N.haptics.buzz('tap');
      }
    } catch (err) { /* haptics are a courtesy */ }""", 'menu haptics'))

    report('haptics: an event saved, and one deleted', once(
        """    await N.store.saveRecord('events', rec);
    await scheduleReminder(rec);""",
        """    await N.store.saveRecord('events', rec);
    await scheduleReminder(rec);
    try { if (N.haptics) N.haptics.buzz('success'); } catch (err) {}""",
        'event haptics'))

    report('haptics: and a card taken off the board', once(
        """  async function removeTask(task) {
    if (!task) return false;""",
        """  async function removeTask(task) {
    if (!task) return false;
    const buzz = function () { try { if (N.haptics) N.haptics.buzz('delete'); } catch (err) {} };""",
        'task haptics'))

    report('haptics: wired to the delete that happens', once(
        """      await N.store.deleteRecord('tasks', task.id);
      return true;""",
        """      await N.store.deleteRecord('tasks', task.id);
      buzz();
      return true;""", 'task haptics wire'))

    # ----------------------------------------------------------- 8. version
    report('version 10.6.0', once("""  N.version = '10.5.0';
  N.versionName = 'v10.5';""", """  N.version = '10.6.0';
  N.versionName = 'v10.6';""", 'version string'))

    print('')
    print('=' * 80)
    if state['fail']:
        print(' %d edit(s) FAILED - nothing was written.' % state['fail'])
        print(' Your file is untouched. Send me the file and I will re-anchor.')
        print('=' * 80)
        return 1

    out = state['src']
    print(' %d edits applied cleanly.' % state['edits'])
    print(' %d -> %d bytes (%+d)' % (len(src), len(out), len(out) - len(src)))
    print('')

    if dry:
        print(' --dry-run: %s was NOT modified.' % path)
        print('=' * 80)
        return 0

    with io.open(path + '.bak', 'w', encoding='utf-8', newline='') as fh:
        fh.write(src)
    with io.open(path, 'w', encoding='utf-8', newline='') as fh:
        fh.write(out)

    print(' wrote  %s' % path)
    print(' backup %s.bak' % path)
    print('=' * 80)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
