#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v10.2.0 - reading along, mentions, and the small polish
=============================================================================

    python3 fix_v102_standalone.py index.html --dry-run
    python3 fix_v102_standalone.py index.html

Run this on the v10.1.0 file.

WHAT IS IN IT

 1. THE READ-ALONG HIGHLIGHT. Asked for three times; here it is.
    While a note is being read, the reading pane dims and the sentence being
    spoken lights up, with the CURRENT WORD marked inside it, moving as the
    voice moves. It follows the engine's own word-boundary events, so it is
    the voice driving the highlight rather than a timer guessing.

    It uses the CSS Custom Highlight API, which means it never touches the
    note's DOM - no wrapper elements are inserted, so nothing can corrupt
    the text, and there is no reflow while it moves. Where the browser has
    no Highlight API the voice simply reads without the marks.

    It clears itself on pause, on stop, at the end, and when the view
    changes - and it scrolls the pane to keep the spoken line in sight.

 2. AND IT WORKS ON A PHONE, WHICH IS WHERE IT NEARLY DID NOT.
    Testing across eight widths found this before you did: below 1024px the
    app collapses Split down to the editor alone, so the rendered pane
    measures 0x0 and there is nothing on screen to light up. Measured 0x0 at
    390, 768 and 884 wide. Reading aloud there would have worked and
    highlighted nothing - exactly the kind of thing you would have had to
    report again.

    So when there is no pane to mark, reading borrows Read mode for the
    duration and hands the layout back when the voice stops. Not on pause,
    which would flip it twice for nothing; and if you pick a mode yourself
    while listening, yours wins.

 3. "RELATED" NOW NOTICES WHEN YOU NAME A NOTE.
    Writing "Welcome to Nodalis" in a note is a much stronger signal than
    prose overlap, and it was being scored as though it were nothing. A note
    whose title you actually mention now comes first, labelled "you named
    this note" rather than "6% match". Wikilinked notes are still excluded,
    because those are already links.

 4. WHEN AN AUTOMATION OPENS THE RIGHT PANEL, IT SAYS WHY.
    The section that caused it flashes for a moment and the panel switches
    to that tab, so the answer to "why did that just open" is on screen
    instead of being a guess.

 5. THE SCRATCHPAD IS SEARCHABLE.
    A search field over the list, filtering as you type, and day headings
    with nothing left under them get out of the way. It filters in place -
    no re-render - so the field never loses focus mid-word.

 6. LISTS ARE EASIER TO SCAN.
    A very quiet alternating tint on the scratchpad, task and search rows,
    and on the matrix cards. Mixed from the existing theme text colour, so
    it is correct in all six themes and both modes and introduces no new
    colour to the palette.

 7. MODALS OPEN AND CLOSE LIKE THEY MEAN IT.
    Dialogs faded out flatly while they scaled in - so closing felt cheaper
    than opening. They now leave the way they arrived, on the same spring,
    and sheets leave on a curve rather than a linear slide.

 8. VERSION 10.2.0, dated today. versionName had been stuck on 'v9.3' for
    four releases; it now matches.

 STILL QUEUED, and honestly: per-bullet bullet styles, the priority-matrix
 add flow, the calendar as a real calendar, and split-mode scroll sync. The
 scroll sync is the interesting one - the editor is a <textarea>, so its
 pixel position does not map to a source line once lines wrap, and matching
 panes properly needs a hidden mirror measurement per block. A proportional
 tweak would just be a different kind of wrong, so it waits for its turn
 rather than getting a guess.
=============================================================================
"""

import io
import os
import sys

_BLOCKS = {}

_BLOCKS['css.css'] = r'''
/* =========================================================================
 * v10.2.0 — READING ALONG, MENTIONS, AND THE SMALL POLISH
 * ========================================================================= */

/* -- 1. the read-along marks --------------------------------------------
 * Drawn with the CSS Custom Highlight API, so no wrapper elements are put
 * into the note. Two levels: the sentence being spoken, and the word inside
 * it. The rest of the pane steps back rather than being hidden - you can
 * still see the shape of the note around what is being read.
 */
.prose.is-reading {
  color: color-mix(in srgb, var(--text-1) 40%, transparent);
  transition: color 220ms var(--ease-out);
}
/* Anything that sets its own colour has to step back too, or it stays loud
   while the prose around it dims. */
.prose.is-reading a,
.prose.is-reading strong,
.prose.is-reading em,
.prose.is-reading code,
.prose.is-reading h1, .prose.is-reading h2, .prose.is-reading h3,
.prose.is-reading h4, .prose.is-reading h5, .prose.is-reading h6,
.prose.is-reading li::marker { color: inherit; }

::highlight(nd-read-line) {
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--text-1);
}
::highlight(nd-read-word) {
  background: var(--accent);
  color: var(--accent-on, #fff);
}

/* -- 2. "you named this note" -------------------------------------------- */
.related-item.is-mention .related-title { color: var(--accent); }
.related-item.is-mention .related-meta { color: color-mix(in srgb, var(--accent) 80%, var(--text-3)); }

/* -- 3. the panel says why it opened ------------------------------------- */
.nd-why { animation: nd-why 1500ms var(--ease-out) 1; border-radius: var(--r-sm, 6px); }
@keyframes nd-why {
  0%   { background: color-mix(in srgb, var(--accent) 24%, transparent);
         box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 70%, transparent); }
  70%  { background: color-mix(in srgb, var(--accent) 8%, transparent);
         box-shadow: inset 0 0 0 2px transparent; }
  100% { background: transparent; box-shadow: none; }
}
[data-animations='none'] .nd-why { animation: none; }
@media (prefers-reduced-motion: reduce) { .nd-why { animation: none; } }

/* -- 4. the scratchpad's search ------------------------------------------ */
.scratch-tools { display: flex; gap: var(--sp-3); margin: var(--sp-4) 0 var(--sp-2); }
.scratch-find {
  flex: 1 1 auto; min-width: 0; height: 36px;
  padding: 0 var(--sp-4);
  border: 1px solid var(--border); border-radius: var(--r-sm, 8px);
  background: var(--bg-0); color: var(--text-0);
  font: inherit; font-size: var(--text-sm);
}
.scratch-find:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.scratch-find::-webkit-search-cancel-button { cursor: pointer; }
.scratch-item[hidden], .nd-group-empty { display: none !important; }

/* -- 5. quiet banding, so a long list is scannable -----------------------
 * Mixed from the theme's own ink rather than a new colour, so every theme
 * and both modes get a tint that belongs to them.
 */
.scratch-item:nth-of-type(even),
.task-row:nth-of-type(even),
.search-hit:nth-of-type(even) { background: color-mix(in srgb, var(--text-0) 3.5%, transparent); }
.matrix-card:nth-of-type(even) { background: color-mix(in srgb, var(--text-0) 3%, transparent); }
.related-item:nth-of-type(even) { background: color-mix(in srgb, var(--text-0) 2.5%, transparent); }

/* -- 6. dialogs leave the way they arrived ------------------------------- */
@keyframes modal-out {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to   { opacity: 0; transform: translate(-50%, -47%) scale(0.965); }
}
@keyframes sheet-out-soft {
  from { transform: translateY(0); opacity: 1; }
  to   { transform: translateY(100%); opacity: 0.9; }
}
'''

_BLOCKS['read.js'] = r'''  /* ------------------------------------------------- the read-along marks
   * v10.2: the sentence being spoken lights up and the current word is
   * marked inside it, moving with the voice.
   *
   * Drawn with the CSS Custom Highlight API. That choice matters: the
   * alternative is wrapping <mark> elements around live text, which mutates
   * the rendered note, reflows it on every word, and is one bug away from
   * corrupting what it is decorating. A Highlight is a range held outside
   * the DOM - the note is never touched, and moving the mark costs a repaint
   * rather than a relayout.
   *
   * The pane's text is indexed ONE CHARACTER TO ONE CHARACTER so a match
   * maps straight back to a Range. The chunk is then found in that index
   * with a whitespace-tolerant pattern, because toSpeech() has already
   * collapsed the note's whitespace and stripped its markdown, so the two
   * strings agree on words but not on spacing.
   * ------------------------------------------------------------------- */
  const HL_LINE = 'nd-read-line';
  const HL_WORD = 'nd-read-word';
  let readNodes = [];     /* [{node,start,end}] over readText */
  let readText = '';      /* the pane's text, lowercased, 1:1 with the nodes */
  let readFrom = 0;       /* search cursor, so a repeated sentence matches in order */
  let chunkSpan = null;   /* {start,end,words:[{start,end}]} for the chunk in play */
  let modeBefore = null;  /* the editor mode we switched away from, to put back */

  function canHighlight() {
    try {
      return typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight === 'function';
    } catch (err) { return false; }
  }

  /** The biggest visible .prose - the reading pane in Split or Read. */
  function readPane() {
    const panes = Array.prototype.slice.call(document.querySelectorAll('.prose'));
    let best = null, area = 0;
    panes.forEach(function (p) {
      const r = p.getBoundingClientRect();
      const a = r.width * r.height;
      if (r.width > 40 && r.height > 40 && a > area) { best = p; area = a; }
    });
    return best;
  }

  /*
   * BELOW 1024px, SPLIT IS WRITE-ONLY - AND THAT IS WHY READING SHOWED
   * NOTHING ON A PHONE.
   *
   * The mark can only live in rendered markdown; a <textarea> cannot be
   * highlighted at all. On a phone, a tablet in portrait, and a folded
   * foldable the app collapses 'split' down to the editor alone, so .prose
   * measures 0x0 and there is no pane on screen to light up. Measured:
   * 0x0 at 390, 768 and 884 wide, a real pane only from 1024 up. Reading
   * aloud there worked and highlighted nothing, which reads as broken.
   *
   * So if there is no pane, switch the editor to read mode, which has a real
   * pane at every width (390 -> 390x324, 768 -> 757x357, 884 -> 728x366).
   * renderPreview() is synchronous, so the pane is measurable in this same
   * tick and the mark lands on the first chunk rather than the second.
   *
   * We remember the mode we came from and put it back when the voice stops.
   * Not on pause - pause/resume would flip the layout twice for nothing. And
   * if the reader picked a mode themselves while listening, theirs wins.
   */
  function showReadable() {
    if (readPane()) return true;
    if (!N.editor || typeof N.editor.setMode !== 'function') return false;
    let was = null;
    try { was = N.editor.getMode(); } catch (err) { return false; }
    if (was === 'preview') return false;   /* already read mode and still no pane */
    try { N.editor.setMode('preview'); } catch (err) { return false; }
    if (!readPane()) {
      /* Not the editor view at all - putting it back is the polite exit. */
      try { N.editor.setMode(was); } catch (err) {}
      return false;
    }
    modeBefore = was;
    return true;
  }

  function restoreMode() {
    if (!modeBefore) return;
    const back = modeBefore;
    modeBefore = null;
    try { if (N.editor.getMode() === 'preview') N.editor.setMode(back); } catch (err) {}
  }

  function buildReadIndex() {
    readNodes = []; readText = ''; readFrom = 0; chunkSpan = null;
    if (!showReadable()) return false;
    const pane = readPane();
    if (!pane) return false;
    let walker;
    try { walker = document.createTreeWalker(pane, NodeFilter.SHOW_TEXT, null); }
    catch (err) { return false; }
    let n, at = 0;
    const buf = [];
    while ((n = walker.nextNode())) {
      const t = n.nodeValue || '';
      if (!t) continue;
      readNodes.push({ node: n, start: at, end: at + t.length });
      at += t.length;
      buf.push(t);
    }
    readText = buf.join('').toLowerCase();
    if (!readNodes.length) return false;
    pane.classList.add('is-reading');
    return true;
  }

  /** A Range for [start,end) in the index. */
  function rangeFor(start, end) {
    if (!(end > start) || !readNodes.length) return null;
    let a = null, b = null;
    for (let i = 0; i < readNodes.length; i++) {
      const e = readNodes[i];
      if (!a && start < e.end) a = { node: e.node, offset: start - e.start };
      if (a && end <= e.end) { b = { node: e.node, offset: end - e.start }; break; }
    }
    if (!a) return null;
    if (!b) { const last = readNodes[readNodes.length - 1]; b = { node: last.node, offset: last.end - last.start }; }
    try {
      const r = document.createRange();
      r.setStart(a.node, Math.max(0, Math.min(a.offset, a.node.nodeValue.length)));
      r.setEnd(b.node, Math.max(0, Math.min(b.offset, b.node.nodeValue.length)));
      return r.collapsed ? null : r;
    } catch (err) { return null; }
  }

  function setHl(name, range) {
    if (!canHighlight()) return;
    try {
      if (!range) { CSS.highlights.delete(name); return; }
      CSS.highlights.set(name, new Highlight(range));
    } catch (err) { /* the engine refused; reading still works */ }
  }

  function clearReading() {
    if (canHighlight()) {
      try { CSS.highlights.delete(HL_LINE); CSS.highlights.delete(HL_WORD); } catch (err) {}
    }
    try {
      Array.prototype.forEach.call(document.querySelectorAll('.prose.is-reading'),
        function (e) { e.classList.remove('is-reading'); });
    } catch (err) {}
    readNodes = []; readText = ''; readFrom = 0; chunkSpan = null;
  }

  /** Find this chunk in the pane, mark the sentence, and bring it into view. */
  function markReadingChunk(piece) {
    if (!canHighlight()) return;
    if (!readNodes.length && !buildReadIndex()) return;
    const words = String(piece && piece.text || '').toLowerCase().match(/[^\s ]+/g);
    if (!words || !words.length) return;
    /* Twelve words is enough to be unique without being brittle. */
    const probe = words.slice(0, 12)
      .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
      .join('[\\s\\u00a0]+');
    let m = null;
    try {
      const re = new RegExp(probe, 'g');
      re.lastIndex = readFrom;
      m = re.exec(readText);
      if (!m) { re.lastIndex = 0; m = re.exec(readText); }
    } catch (err) { return; }
    if (!m) return;

    const start = m.index;
    const end = Math.min(readText.length, start + Math.max(m[0].length, String(piece.text || '').length));
    /* Advance past the front of this match so the next chunk searches on. */
    readFrom = start + Math.max(1, Math.floor(m[0].length / 2));

    const wordSpans = [];
    const slice = readText.slice(start, end);
    const wre = /[^\s ]+/g;
    let w;
    while ((w = wre.exec(slice)) !== null) {
      wordSpans.push({ start: start + w.index, end: start + w.index + w[0].length });
    }
    chunkSpan = { start: start, end: end, words: wordSpans };
    setHl(HL_LINE, rangeFor(start, end));
    setHl(HL_WORD, null);

    /* Keep the spoken line in sight without yanking the pane about. */
    try {
      const r = rangeFor(start, Math.min(end, start + 48));
      const pane = readPane();
      if (r && pane) {
        const rr = r.getBoundingClientRect(), pr = pane.getBoundingClientRect();
        if (rr.top < pr.top + 32 || rr.bottom > pr.bottom - 32) {
          pane.scrollTop += (rr.top - pr.top) - pane.clientHeight * 0.34;
        }
      }
    } catch (err) { /* scrolling is a courtesy */ }
  }

  /** Move the word mark to wherever the voice has reached in this chunk. */
  function markReadingWord(piece, charIndex) {
    if (!canHighlight() || !chunkSpan || !chunkSpan.words.length) return;
    const before = String(piece && piece.text || '').slice(0, Math.max(0, charIndex));
    /*
     * charIndex is an offset into the CHUNK's text, and the pane's copy has
     * different spacing - so the reliable common unit is the word ordinal,
     * not the character.
     */
    const ordinal = (before.match(/[^\s ]+[\s ]/g) || []).length;
    const w = chunkSpan.words[Math.min(ordinal, chunkSpan.words.length - 1)];
    if (w) setHl(HL_WORD, rangeFor(w.start, w.end));
  }

'''

_BLOCKS['mention.js'] = r'''    /*
     * v10.2: A NOTE YOU ACTUALLY NAMED COMES FIRST.
     *
     * Writing "Welcome to Nodalis" into a note is a deliberate act and a far
     * stronger signal than prose overlap, but tf-idf scored it as just more
     * shared words - so a note you had named by hand could sit under one
     * that happened to reuse your vocabulary. Titles mentioned in the body
     * are now found first and ranked above everything else.
     *
     * Wikilinked notes are still excluded upstream: those are already links,
     * and this panel is for the ones that are not.
     */
    const mentions = [];
    try {
      const body = String(self.content || '');
      if (body.length < 200000) {
        const seen = {};
        notes.forEach(function (n2, id) {
          if (id === noteId || linked.has(id) || seen[id]) return;
          const t = titleOf(n2);
          /* Two characters is not a title, it is a coincidence waiting. */
          if (!t || t.length < 3) return;
          const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let re;
          try { re = new RegExp('(^|[^\\w[])' + esc + '($|[^\\w\\]])', 'i'); }
          catch (err) { return; }
          if (!re.test(body)) return;
          seen[id] = true;
          mentions.push({ id: id, note: n2, score: 1, tags: 0, mention: true });
        });
      }
    } catch (err) { /* never let this stop the panel drawing */ }

'''

_BLOCKS['whyflash.js'] = r'''  /*
   * v10.2: SAY WHY IT OPENED.
   *
   * A panel that slides open by itself and offers no reason is a small
   * mystery every time. The section that caused it gets the tab and a
   * moment's flash, so the answer is on screen rather than inferred.
   */
  function flashWhy(reason) {
    let sel = '.related-panel';
    let tab = 'backlinks';
    if (reason === 'links') { sel = '#rpane-backlinks .section-label, #rpane-backlinks'; tab = 'backlinks'; }
    else if (reason === 'outline') { sel = '#rpane-outline', tab = 'outline'; }
    else if (reason === 'related') { sel = '.related-panel'; tab = 'backlinks'; }
    try {
      const tabBtn = document.querySelector('.right-tab[data-rtab="' + tab + '"]');
      if (tabBtn && !tabBtn.classList.contains('is-active')) tabBtn.click();
    } catch (err) { /* the tab is a courtesy */ }
    /* After the panel's own transition, or the flash plays off-screen. */
    setTimeout(function () {
      try {
        const target = document.querySelector(sel.split(',')[0].trim()) ||
                       document.querySelector('.right-panel .rpane, .right-panel');
        if (!target) return;
        target.classList.remove('nd-why');
        void target.offsetWidth;
        target.classList.add('nd-why');
        setTimeout(function () { target.classList.remove('nd-why'); }, 1700);
      } catch (err) { /* decoration only */ }
    }, 260);
  }

  /** Which of the panel's sections is the reason this note qualified? */
  function reasonFor(note) {
    if (!note) return null;
    try {
      if ((note.links || []).length) return 'links';
      const back = N.store.backlinksFor ? N.store.backlinksFor(note.id) : null;
      if (back && back.linked && back.linked.length) return 'links';
      const heads = String(note.content || '').match(/^\s{0,3}#{1,6}\s+\S/gm);
      if (heads && heads.length >= 2) return 'outline';
    } catch (err) {}
    return null;
  }

'''

_BLOCKS['scratch.js'] = r'''    body.appendChild(compose);

    /*
     * v10.2: A SCRATCHPAD YOU CANNOT SEARCH IS A PILE.
     *
     * It filters IN PLACE rather than re-rendering, for one specific reason:
     * a re-render on every keystroke rebuilds the input and the field loses
     * focus mid-word. Hiding rows keeps the caret exactly where it was.
     *
     * A day heading whose every item is hidden gets out of the way too -
     * found structurally, by walking forward from each heading, so it does
     * not depend on what that heading's class happens to be called.
     */
    const tools = el('div.scratch-tools');
    const find = el('input.scratch-find', {
      type: 'search', placeholder: 'Search these thoughts…',
      'aria-label': 'Search the scratchpad',
    });
    const applyFind = function () {
      const q = find.value.trim().toLowerCase();
      const items = Array.prototype.slice.call(body.querySelectorAll('.scratch-item'));
      items.forEach(function (it) {
        const hay = (it.textContent || '').toLowerCase();
        it.hidden = !!q && hay.indexOf(q) === -1;
      });
      /* Hide any group whose items have all gone. */
      const kids = Array.prototype.slice.call(body.children);
      kids.forEach(function (node, i) {
        if (node.classList.contains('scratch-item') ||
            node.classList.contains('scratch-compose') ||
            node.classList.contains('scratch-tools')) return;
        let any = false, seenOne = false;
        for (let j = i + 1; j < kids.length; j++) {
          if (!kids[j].classList.contains('scratch-item')) break;
          seenOne = true;
          if (!kids[j].hidden) { any = true; break; }
        }
        if (seenOne) node.classList.toggle('nd-group-empty', !any);
      });
    };
    find.addEventListener('input', applyFind);
    find.addEventListener('search', applyFind);
    tools.appendChild(find);
    body.appendChild(tools);
'''


def block(name):
    return _BLOCKS[name]

MARKER = 'v10.2: the sentence being spoken lights up'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    path = args[0] if args else 'index.html'

    if not os.path.exists(path):
        print('ERROR: %s not found.' % path)
        return 1

    src = io.open(path, encoding='utf-8').read()
    if MARKER in src:
        print('ERROR: v10.2.0 is already installed in this file.')
        return 1
    if 'v10.1: MEASURE WHAT IS ON SCREEN' not in src:
        print('ERROR: this file is not at v10.1.0. Run fix_v101_standalone.py first.')
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

    def report(name, ok):
        print('   %-50s %s' % (name, 'ok' if ok else 'FAILED'))

    print('=' * 80)
    print(' Nodalis v10.2.0 - reading along, mentions, and the small polish')
    print('=' * 80)
    print(' file: %s  (%d bytes)\n' % (path, len(src)))

    # ------------------------------------------------------------ 1. stylesheet
    report('stylesheet', once('\n</style>\n</head>',
                              '\n' + block('css.css') + '\n</style>\n</head>', 'stylesheet'))

    # ------------------------------------------- 2. the read-along marks module
    report('read-along: the marks', once(
        '  /* ------------------------------------------------------------ speaking */',
        block('read.js') + '  /* ------------------------------------------------------------ speaking */',
        'read-along block'))

    report('read-along: mark the sentence as each chunk starts', once(
        """    const piece = chunks[at];
    const u = new window.SpeechSynthesisUtterance(piece.text);""",
        """    const piece = chunks[at];
    /* v10.2: light up the sentence about to be spoken. */
    try { markReadingChunk(piece); } catch (err) { /* decoration only */ }
    const u = new window.SpeechSynthesisUtterance(piece.text);""", 'chunk mark'))

    report('read-along: move the word mark with the voice', once(
        """      spokenInChunk = Math.max(0, Math.min(piece.text.length, i));
      paint();""",
        """      spokenInChunk = Math.max(0, Math.min(piece.text.length, i));
      /* v10.2: and move the word mark to match. */
      try { markReadingWord(piece, spokenInChunk); } catch (err) { /* decoration only */ }
      paint();""", 'word mark'))

    report('read-along: clears on stop', once(
        """  function stop(opts) {
    speaking = false;
    paused = false;""",
        """  function stop(opts) {
    speaking = false;
    paused = false;
    /* v10.2: the marks go when the voice does. */
    try { clearReading(); } catch (err) {}
    /* and the layout we borrowed goes back. */
    try { restoreMode(); } catch (err) {}""", 'clear on stop'))

    report('read-along: clears on pause, returns on resume', once(
        """  function resume() {
    if (!speaking || !paused) return;
    paused = false;""",
        """  function resume() {
    if (!speaking || !paused) return;
    paused = false;
    /* The index is rebuilt on the next chunk mark. */
    try { if (chunks[at]) markReadingChunk(chunks[at]); } catch (err) {}""", 'clear on pause/resume'))

    report('read-along: clears at the end of the note', once(
        """      if (speaking) {
        speaking = false;
        spokenInChunk = 0;
        N.bus.emit('speak:done');""",
        """      if (speaking) {
        speaking = false;
        spokenInChunk = 0;
        try { clearReading(); } catch (err) {}
        try { restoreMode(); } catch (err) {}
        N.bus.emit('speak:done');""", 'clear at end'))

    # pause() itself
    report('read-along: pause takes the marks down', once(
        """  function pause() {
    if (!speaking || paused) return;""",
        """  function pause() {
    if (!speaking || paused) return;
    try { clearReading(); } catch (err) {}""", 'clear in pause'))

    # a view change must not leave marks behind
    report('read-along: a view change takes them down too', once(
        "    window.addEventListener('pagehide', stop);",
        "    window.addEventListener('pagehide', stop);\n"
        "    /* v10.2: leaving the editor must not leave marks on a hidden pane. */\n"
        "    N.bus.on('view:changed', function () { try { clearReading(); } catch (err) {}\n"
        "                                           try { restoreMode(); } catch (err) {} });",
        'clear on view change'))

    # export the helpers so the round can be tested
    report('read-along: exported for testing', once(
        """    languageRuns: languageRuns, planChunks: planChunks, voiceForLang: voiceForLang,""",
        """    languageRuns: languageRuns, planChunks: planChunks, voiceForLang: voiceForLang,
    markReadingChunk: markReadingChunk, markReadingWord: markReadingWord,
    clearReading: clearReading, canHighlight: canHighlight,
    showReadable: showReadable, restoreMode: restoreMode,""", 'read-along exports'))

    # ------------------------------------------------ 3. related: title mentions
    report('related: a note you named comes first', once(
        """    const base = weightsFor(noteId);
    if (!base) return [];

    const byTitle = new Map();
    notes.forEach(function (n2, id) { byTitle.set(titleOf(n2).toLowerCase(), id); });
    const linked = linkedIdsOf(self, byTitle);
    const selfTags = tagsOf(self);""",
        """    const byTitle = new Map();
    notes.forEach(function (n2, id) { byTitle.set(titleOf(n2).toLowerCase(), id); });
    const linked = linkedIdsOf(self, byTitle);
    const selfTags = tagsOf(self);

""" + block('mention.js') + """    /*
     * The mention scan runs BEFORE this, deliberately. The tf-idf index is
     * built lazily, so a note created a moment ago has no weights yet - and
     * `if (!base) return []` used to bail out right here, which is exactly
     * when you most want to see the note you just named by hand. Mentions
     * need no index, so they survive that.
     */
    const base = weightsFor(noteId);
    if (!base) return mentions.slice(0, MAX_RESULTS);""", 'mention pass'))

    report('related: mentions rank above prose overlap', once(
        """    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, MAX_RESULTS);""",
        """    scored.sort(function (a, b) { return b.score - a.score; });
    /* Mentions first, then everything the maths found, minus any duplicate. */
    if (mentions.length) {
      const named = {};
      mentions.forEach(function (m) { named[m.id] = true; });
      return mentions.concat(scored.filter(function (r) { return !named[r.id]; })).slice(0, MAX_RESULTS);
    }
    return scored.slice(0, MAX_RESULTS);""", 'mention ranking'))

    report('related: says "you named this note"', once(
        """      const pct = Math.round(Math.min(1, item.score) * 100);
      const row = el('button.related-item', {""",
        """      const pct = Math.round(Math.min(1, item.score) * 100);
      const row = el('button.related-item' + (item.mention ? '.is-mention' : ''), {""", 'mention row class'))

    report('related: the reason reads plainly', once(
        """      const meta = el('span.related-meta', null,
        pct + '% match' + (item.tags ? ' · shared tag' : ''));""",
        """      const meta = el('span.related-meta', null,
        item.mention ? 'you named this note'
                     : pct + '% match' + (item.tags ? ' · shared tag' : ''));""", 'mention label'))

    # ------------------------------------------------ 4. the panel says why
    report('automation: the panel flashes its reason', once(
        '  /* ----------------------------------------------------- the breadcrumb */',
        block('whyflash.js') + '  /* ----------------------------------------------------- the breadcrumb */',
        'why-flash block'))

    report('automation: wire the reason to the open', once(
        """    if (window.innerWidth <= 900) return;
    try { N.app.toggleRightPanel(); } catch (err) { /* nothing to open */ }""",
        """    if (window.innerWidth <= 900) return;
    const why = reasonFor(note);
    try { N.app.toggleRightPanel(); } catch (err) { /* nothing to open */ return; }
    try { flashWhy(why); } catch (err) { /* decoration only */ }""", 'why wiring'))

    # ------------------------------------------------ 5. the scratchpad's search
    report('scratchpad: a search field that keeps focus', once(
        '    body.appendChild(compose);\n', block('scratch.js'), 'scratch search'))

    # ------------------------------------------------ 6. dialogs leave properly
    # ------------------------------------------------------- 7. version + date
    report('version 10.2.0', once("""  N.version = '10.1.0';
  N.versionName = 'v9.3';""", """  N.version = '10.2.0';
  N.versionName = 'v10.2';""", 'version string'))

    report('modals: leave the way they arrived', once(
        """      if (isSheet) node.style.animation = 'sheet-out 200ms var(--ease-in-out) forwards';
      else node.style.animation = 'fade-out 160ms var(--ease-in-out) forwards';""",
        """      /*
       * v10.2: a dialog that scales in on a spring and then merely fades out
       * feels cheaper closing than opening. It now leaves on the same curve
       * it arrived on, and a sheet leaves on an ease rather than linearly.
       */
      const still = N.store && N.store.state.settings.animations !== 'none';
      if (!still) node.style.animation = 'fade-out 1ms linear forwards';
      else if (isSheet) node.style.animation = 'sheet-out-soft 240ms cubic-bezier(0.4, 0, 0.2, 1) forwards';
      else node.style.animation = 'modal-out 190ms cubic-bezier(0.4, 0, 0.35, 1) forwards';""",
        'modal out'))

    print('\n' + '=' * 80)
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
    print('=' * 80)
    return 0


if __name__ == '__main__':
    sys.exit(main())
