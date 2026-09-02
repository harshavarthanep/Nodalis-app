#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v10.3.0 - the four things you reported, measured and fixed
=============================================================================

    python3 fix_v103_standalone.py index.html --dry-run
    python3 fix_v103_standalone.py index.html

Run this on the v10.2.0 file.

WHAT IS IN IT

 1. THE READ-ALONG HIGHLIGHT NOW MARKS THE SENTENCE, NOT A 220-CHARACTER
    BLOCK. You were right, and your screenshot showed it exactly: one
    highlight ran from "Hit" straight past "#guide". A chunk is up to 220
    characters because that is the size a speech engine likes - and the mark
    was the whole chunk. It is now cut into sentences and the mark steps from
    one to the next as the voice moves.

 2. AND IT STARTS AT THE FIRST WORD. The chunk was located in the pane by
    CHARACTER count, and the spoken text is not the pane's text - toSpeech()
    strips markdown, turns blank lines into ". " and collapses spaces, so the
    two agree on words and disagree on length. Measured on your own note:
    chunk 0 marked 108 characters of a 160-character run and stopped
    mid-word, so "The Scratchpad exists for that last one." was never lit at
    all, and chunk 1 over-ran into the next paragraph. The chunk is now
    mapped by WORD count, which is the unit both sides agree on.

 3. SETTINGS LANDS ON THE HEADING. On desktop the settings nav is a
    FULL-HEIGHT STICKY RAIL - 407px tall - and the landing code subtracted
    its whole height as though it were a top strip. So every section landed
    421px short, which is most of a section: click Automation, arrive in the
    middle of Features. Measured on all twelve sections. The obstruction is
    now measured only when the nav is actually above the content.

 4. THE RIGHT PANEL OPENS FOR A RELATED NOTE. The automation counted links,
    backlinks and headings, and "Related - not yet linked" was not on the
    list - so on a note whose only signal was a named-note mention it stayed
    shut, which is the case you hit. A mention now opens it, so does a strong
    match, and the Related block is what flashes.

 5. NOTE TASKS ARRIVE IN THE MATRIX ONLY IF YOU ASK. Eleven checkbox items
    from your notes had placed themselves in Drop. That is now an automation
    switch - Settings > Automation - and like every other one it starts OFF.
    Anything you dragged into a quadrant yourself stays put whatever the
    switch says, and while it is off the matrix tells you how many note tasks
    it is holding back rather than just looking empty.

 6. THE PRIORITY MATRIX HAS ITS PLUS. One per quadrant, adding a task
    straight into it - you asked for this in an earlier round and it kept
    getting bumped.

 7. VERSION 10.3.0, dated today.

 STILL QUEUED: per-bullet bullet styles (frontmatter map, as you chose), the
 calendar as a real calendar with recurrence and reminder lead time,
 split-mode scroll sync, and audio export. The scroll sync reason has not
 changed - the editor is a <textarea>, so its pixel position does not map to
 a source line once lines wrap, and matching panes properly needs a hidden
 mirror measurement per block. A proportional tweak would just be a
 different kind of wrong.
=============================================================================
"""

import io
import os
import sys


# ---------------------------------------------------------------- the blocks

_BLOCKS = {}

_BLOCKS['css.css'] = r'''
/* ===== v10.3: matrix add buttons and the held-back hint ===== */
.matrix-add {
  flex: 0 0 auto;
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-2, 7px);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  padding: 0;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.matrix-add:hover, .matrix-add:focus-visible {
  background: var(--surface-2);
  color: var(--text-1);
  border-color: var(--border-2, var(--border-1));
}
.matrix-add:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.nd-held {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin: 0 0 var(--sp-3, 12px) 0;
  padding: 9px 12px;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-2, 8px);
  background: color-mix(in oklab, var(--text-1) 3.5%, transparent);
  font-size: var(--text-xs);
  color: var(--text-2);
  line-height: 1.45;
}
.nd-held-text { flex: 1 1 200px; min-width: 0; }
.nd-held .btn { flex: 0 0 auto; }

@media (max-width: 520px) {
  .nd-held { padding: 8px 10px; }
}
'''

_BLOCKS['wordish.js'] = r'''  /*
   * v10.3: WHAT COUNTS AS A WORD, ON BOTH SIDES.
   *
   * The spoken text and the pane's text have to be walked with the SAME idea
   * of a word or the two never line up. toSpeech() leaves punctuation-only
   * tokens behind - a lone "." wherever a blank line was, and another after
   * a heading - and the pane has no such tokens. Counting them threw the
   * word-for-word alignment out and, on a note that opened with a heading,
   * broke the probe outright: 4 chunks spoken, 0 marks.
   *
   * So a word STARTS at a letter or digit and runs to the next space. That
   * also keeps the renderer's "#" heading permalink out of the mark, which
   * otherwise lit up as "#Second heading". The character range covers Latin,
   * CJK, Tamil, Malayalam, Arabic and the rest - this app reads 27 languages
   * and \w in JavaScript is ASCII only.
   */
  const WORDISH_SRC = '[0-9A-Za-z\\u00c0-\\uffff][^\\s\\u00a0]*';
  function wordsOf(text) {
    return String(text || '').match(new RegExp(WORDISH_SRC, 'g')) || [];
  }

'''

_BLOCKS['blockat.js'] = r'''  /* Which block of the pane a character offset falls in. */
  function blockAt(index) {
    for (let i = 0; i < readNodes.length; i++) {
      if (index < readNodes[i].end) return readNodes[i].block;
    }
    return readNodes.length ? readNodes[readNodes.length - 1].block : -1;
  }

'''

_BLOCKS['sentence.js'] = r'''  /*
   * v10.3: LIGHT THE SENTENCE, AND ONLY THE SENTENCE.
   *
   * A chunk is up to 220 characters because that is the size a speech engine
   * wants to be handed. Marking the whole chunk is what showed up as "the
   * highlight covers half the note" - one range running from "Hit" past
   * "#guide" and into the tag. The chunk is cut into sentences up front and
   * the mark steps between them as the voice moves, which is what reading
   * along actually looks like.
   */
  function markSentence(idx) {
    if (!chunkSpan || !chunkSpan.sentences || !chunkSpan.sentences.length) return;
    const i = Math.max(0, Math.min(idx, chunkSpan.sentences.length - 1));
    if (chunkSpan.at === i) return;
    chunkSpan.at = i;
    const s = chunkSpan.sentences[i];
    setHl(HL_LINE, rangeFor(s.start, s.end));
    /* Keep the spoken line in sight without yanking the pane about. */
    try {
      const r = rangeFor(s.start, Math.min(s.end, s.start + 48));
      const pane = readPane();
      if (r && pane) {
        const rr = r.getBoundingClientRect(), pr = pane.getBoundingClientRect();
        if (rr.top < pr.top + 32 || rr.bottom > pr.bottom - 32) {
          pane.scrollTop += (rr.top - pr.top) - pane.clientHeight * 0.34;
        }
      }
    } catch (err) { /* scrolling is a courtesy */ }
  }

'''

_BLOCKS['span.js'] = r'''    const start = m.index + m[1].length;

    /*
     * v10.3: MAP THE CHUNK BY WORD COUNT, NOT CHARACTER COUNT.
     *
     * The old end was start + max(probe length, chunk length). But the
     * chunk's spoken text is NOT the pane's text: toSpeech() strips
     * markdown, turns a blank line into ". " and collapses runs of spaces,
     * so the two strings agree on WORDS and disagree on LENGTH.
     *
     * Measured on a real note: chunk 0 marked 108 characters of a
     * 160-character run and stopped mid-word - which is why "The Scratchpad
     * exists for that last one." was never lit - and chunk 1 over-ran its
     * paragraph and swallowed the one after it plus the #guide tag.
     *
     * Words are the unit both sides agree on. Take exactly as many words out
     * of the pane as the chunk has and the span is right whatever the
     * spacing did in between.
     */
    const wordSpans = [];
    const wre = new RegExp(WORDISH_SRC, 'g');
    wre.lastIndex = start;
    let w;
    while (wordSpans.length < words.length && (w = wre.exec(readText)) !== null) {
      wordSpans.push({ start: w.index, end: w.index + w[0].length });
    }
    if (!wordSpans.length) return;
    const end = wordSpans[wordSpans.length - 1].end;
    /* The next chunk searches on from where this one actually ended. */
    readFrom = end;

    /*
     * Cut the span into sentences. A sentence closes on terminal punctuation
     * - including the CJK and Devanagari stops, since this app reads 27
     * languages - or on a line break, which is what ends a heading, a list
     * item, or a paragraph in rendered markdown.
     */
    const sentences = [];
    let from = 0;
    for (let i = 0; i < wordSpans.length; i++) {
      const wt = readText.slice(wordSpans[i].start, wordSpans[i].end);
      const gap = i + 1 < wordSpans.length
        ? readText.slice(wordSpans[i].end, wordSpans[i + 1].start) : '';
      const closes = /[.!?…。！？।॥]["'’”)\]]*$/.test(wt);
      /*
       * A block boundary ends a sentence too. textContent runs list items
       * and table cells together with NO separator at all - measured, three
       * list items merged into one 119-character mark - so a newline in the
       * gap is not enough on its own. The index records which block each
       * text node belongs to; a change of block is a break.
       */
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
    /* The first sentence lights the moment the chunk starts - not on the
       first boundary event, which some engines never send. */
    markSentence(0);
  }

'''

_BLOCKS['word.js'] = r'''  /** Move the word mark to wherever the voice has reached in this chunk. */
  function markReadingWord(piece, charIndex) {
    if (!canHighlight() || !chunkSpan || !chunkSpan.words.length) return;
    const before = String(piece && piece.text || '').slice(0, Math.max(0, charIndex));
    /*
     * charIndex is an offset into the CHUNK's text, and the pane's copy has
     * different spacing - so the reliable common unit is the word ordinal,
     * not the character.
     */
    let ordinal = wordsOf(before).length;
    /* If the engine's cut landed inside a word, that word is the one being
       spoken - not the one after it. */
    if (ordinal && !/[\s ]$/.test(before)) ordinal -= 1;
    const idx = Math.max(0, Math.min(ordinal, chunkSpan.words.length - 1));
    /* Move the sentence first, so the word mark is always inside it. */
    if (chunkSpan.sentences) {
      for (let i = 0; i < chunkSpan.sentences.length; i++) {
        if (idx <= chunkSpan.sentences[i].last) { markSentence(i); break; }
      }
    }
    const w = chunkSpan.words[idx];
    if (w) setHl(HL_WORD, rangeFor(w.start, w.end));
  }
'''

_BLOCKS['probe.js'] = r'''    /*
     * Twelve words is enough to be unique without being brittle - and the
     * words are joined by "anything that is not a word character" rather
     * than by whitespace.
     *
     * WHY, measured on the v10.2 build with a note that opens with a
     * heading: 4 chunks spoken, 0 marks. Two reasons, both about characters
     * that exist on one side only. toSpeech() adds a full stop after a
     * heading ("# Introduction" is spoken "Introduction. "), and the
     * renderer puts a "#" permalink INSIDE the heading with no space after
     * it, so the pane reads "#Second heading". Whitespace was the wrong
     * bridge; a run of non-word characters spans both.
     *
     * The leading group is a poor man's word boundary - lookbehind would be
     * neater but is not safe on older iOS Safari - so "one" cannot match
     * inside "someone". m[1] is discarded when the start is computed.
     */
    const probe = words.slice(0, 12)
      .map(function (raw) {
        const bare = raw.replace(/^[^0-9A-Za-z\u00c0-\uffff]+/, '')
                        .replace(/[^0-9A-Za-z\u00c0-\uffff]+$/, '');
        return (bare || raw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('[^0-9A-Za-z\\u00c0-\\uffff]*');
'''

_BLOCKS['stuck.js'] = r'''      /*
       * v10.3: THE NAV IS A SIDE RAIL ON DESKTOP, NOT A TOP STRIP.
       *
       * v10.1 subtracted the sticky nav's whole HEIGHT. On a phone that nav
       * is a 49px strip across the top and the sum works. On desktop it is a
       * full-height vertical rail beside the content - measured at 407px -
       * so every section landed 421px short, which is most of a section:
       * clicking Automation arrived in the middle of Features. Measured on
       * all twelve sections at both sizes.
       *
       * A rail beside the content obstructs nothing vertically. So decide
       * which it is by geometry - does it overlap the content's column, and
       * does it sit at the top of the scrollport - and only then treat its
       * bottom edge as the ceiling.
       */
      const nav = body.querySelector('.settings-nav');
      const bodyRect = body.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      let stuck = 0;
      if (nav && getComputedStyle(nav).position === 'sticky') {
        const navRect = nav.getBoundingClientRect();
        const shared = Math.min(navRect.right, targetRect.right) -
                       Math.max(navRect.left, targetRect.left);
        const overlapsColumn = shared > Math.max(1, targetRect.width) * 0.5;
        const atTheTop = navRect.top <= bodyRect.top + 2;
        if (overlapsColumn && atTheTop) {
          stuck = Math.max(0, Math.round(navRect.bottom - bodyRect.top));
        }
      }
'''

_BLOCKS['related.js'] = r'''      /*
       * v10.3: "RELATED - NOT YET LINKED" COUNTS TOO.
       *
       * This list was links, backlinks and headings, and the Related block
       * was not on it - so a note whose only signal was a named-note mention
       * left the panel shut while the panel had something real in it. That
       * is the case that got reported.
       *
       * A mention is a deliberate act and always worth opening for. A
       * tf-idf match has to be strong enough to be interesting: 45% is
       * about where the suggestion stops being noise, and below that the
       * panel would open on almost every note in a mature vault.
       */
      if (relatedWorthOpening(note)) return true;
'''

_BLOCKS['relatedfn.js'] = r'''  /**
   * Is there a "Related - not yet linked" row worth opening the panel for?
   * A named mention always is; a scored match has to be strong.
   */
  function relatedWorthOpening(note) {
    try {
      if (!note || !N.related || typeof N.related.related !== 'function') return false;
      const rows = N.related.related(note.id) || [];
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].mention) return true;
        if (rows[i] && Number(rows[i].score) >= 0.45) return true;
      }
    } catch (err) { /* never block on this */ }
    return false;
  }

'''

_BLOCKS['automationrow.js'] = r'''    wrap.appendChild(row('Pull tasks from your notes into the priority matrix',
      'Off by default. While it is off the matrix shows your standalone tasks and anything you have dragged into a quadrant yourself, and tells you how many note tasks it is holding back. Turn it on and every unfinished checkbox in every note is sorted into a quadrant by its priority and due date.',
      toggle('matrixPullFromNotes', function () {
        try { if (N.matrix && N.matrix.render) N.matrix.render(); } catch (err) {}
      })));

'''

_BLOCKS['scope.js'] = r'''  /*
   * v10.3: NOTE TASKS ARRIVE ONLY IF YOU ASKED THEM TO.
   *
   * Every unfinished checkbox in every note used to place itself in a
   * quadrant - eleven of them landed in Drop by themselves and read as the
   * app filling the board in on its own. That behaviour is now the
   * matrixPullFromNotes automation and, like every automation in this app,
   * it starts off.
   *
   * A task you dragged into a quadrant yourself is YOURS, whatever the
   * switch says, so an explicit task.quadrant always survives the filter.
   * Same for anything added with a quadrant's plus button.
   */
  function pullFromNotes() {
    try { return !!(N.store && N.store.state.settings && N.store.state.settings.matrixPullFromNotes); }
    catch (err) { return false; }
  }

  /** Open note tasks the switch is currently holding back. */
  function heldBack() {
    try {
      if (pullFromNotes()) return 0;
      return N.tasks.collect().filter(function (t) {
        return !t.done && !t.cancelled && t.source !== 'standalone' && !t.quadrant;
      }).length;
    } catch (err) { return 0; }
  }

'''

_BLOCKS['hint.js'] = r'''    /* v10.3: say what is being held back rather than just looking empty. */
    const held = heldBack();
    if (held > 0) {
      const hint = el('div.nd-held');
      hint.appendChild(el('span.nd-held-text', null,
        held === 1
          ? '1 unfinished task in your notes is not shown here.'
          : held + ' unfinished tasks in your notes are not shown here.'));
      hint.appendChild(el('button.btn.btn-sm', {
        type: 'button',
        onclick: async function () {
          await N.store.setSetting('matrixPullFromNotes', true);
          render();
        },
      }, 'Pull them in'));
      body.appendChild(hint);
    }

'''

_BLOCKS['stickyfit.js'] = r'''    /*
     * v10.3: A HIDDEN WALL MEASURES 0x0, AND fit() BELIEVED IT.
     *
     * "Tidy the sticky wall" is a command, so it can be run from any view
     * - and tidy() ends with requestAnimationFrame(fit). With the wall
     * hidden its rect is 0x0, so (0 - 96) / w is negative, the zoom
     * clamps to MIN_ZOOM and the offset goes negative. Measured: k 0.25,
     * x -28, y -242, and two of nine stickies off screen. Worse,
     * persistView() then SAVED that view, so coming back to the wall
     * showed a near-empty board at quarter zoom - which is what a tidied
     * wall "going black" looks like on a dark theme.
     *
     * So do not fit against a wall nobody can see. Remember that a fit is
     * owed and do it when the wall is on screen and has a size.
     */
      if (r.width < 2 || r.height < 2) { wantFit = true; return; }
      wantFit = false;
'''

MARKER = 'v10.3: LIGHT THE SENTENCE, AND ONLY THE SENTENCE'
REQUIRES = 'v10.2: the sentence being spoken lights up'


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
    print(' Nodalis v10.3.0 - the four things you reported, measured and fixed')
    print('=' * 80)
    print(' file: %s  (%d bytes)' % (path, len(src)))
    print('')

    if MARKER in src:
        print('ERROR: v10.3.0 is already installed in this file.')
        return 1
    if REQUIRES not in src:
        print('ERROR: this file is not at v10.2.0. Run fix_v102_standalone.py first.')
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
            print('   %-50s ok' % label)
        else:
            print('   %-50s FAILED' % label)
            state['fail'] += 1

    # ------------------------------------------------------------ 1. the CSS
    report('stylesheet', once('\n</style>\n</head>',
                              '\n' + block('css.css') + '\n</style>\n</head>',
                              'stylesheet'))

    # ------------------------------------- 2. read-along: a tolerant probe
    report('read-along: one idea of a word on both sides', once(
        """  function canHighlight() {""",
        block('wordish.js') + """  function canHighlight() {""", 'wordish'))

    report('read-along: ignore punctuation-only tokens', once(
        """    const words = String(piece && piece.text || '').toLowerCase().match(/[^\\s\u00a0]+/g);
    if (!words || !words.length) return;""",
        """    const words = wordsOf(String(piece && piece.text || '').toLowerCase());
    if (!words.length) return;""", 'words filter'))

    report('read-along: match a heading that gained a full stop', once(
        """    /* Twelve words is enough to be unique without being brittle. */
    const probe = words.slice(0, 12)
      .map(function (w) { return w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); })
      .join('[\\\\s\\\\u00a0]+');
""",
        block('probe.js'), 'probe'))

    # ------------------------- 3. read-along: word-count span + sentences
    old_span = (
        "    const start = m.index;\n"
        "    const end = Math.min(readText.length, start + Math.max(m[0].length, String(piece.text || '').length));\n"
        "    /* Advance past the front of this match so the next chunk searches on. */\n"
        "    readFrom = start + Math.max(1, Math.floor(m[0].length / 2));\n"
        "\n"
        "    const wordSpans = [];\n"
        "    const slice = readText.slice(start, end);\n"
        "    const wre = /[^\\s ]+/g;\n"
        "    let w;\n"
        "    while ((w = wre.exec(slice)) !== null) {\n"
        "      wordSpans.push({ start: start + w.index, end: start + w.index + w[0].length });\n"
        "    }\n"
        "    chunkSpan = { start: start, end: end, words: wordSpans };\n"
        "    setHl(HL_LINE, rangeFor(start, end));\n"
        "    setHl(HL_WORD, null);\n"
        "\n"
        "    /* Keep the spoken line in sight without yanking the pane about. */\n"
        "    try {\n"
        "      const r = rangeFor(start, Math.min(end, start + 48));\n"
        "      const pane = readPane();\n"
        "      if (r && pane) {\n"
        "        const rr = r.getBoundingClientRect(), pr = pane.getBoundingClientRect();\n"
        "        if (rr.top < pr.top + 32 || rr.bottom > pr.bottom - 32) {\n"
        "          pane.scrollTop += (rr.top - pr.top) - pane.clientHeight * 0.34;\n"
        "        }\n"
        "      }\n"
        "    } catch (err) { /* scrolling is a courtesy */ }\n"
        "  }\n"
        "\n"
    )
    report('read-along: remember which block each word is in', once(
        """    let n, at = 0;
    const buf = [];
    while ((n = walker.nextNode())) {
      const t = n.nodeValue || '';
      if (!t) continue;
      readNodes.push({ node: n, start: at, end: at + t.length });""",
        """    let n, at = 0;
    const buf = [];
    /*
     * v10.3: which BLOCK each text node sits in. textContent joins list
     * items and table cells with nothing between them, so without this a
     * sentence mark runs straight through three bullets.
     */
    const blocks = [];
    let lastBlock = -1, lastNode = null;
    const blockIdOf = function (node) {
      let host = null;
      try {
        host = node.parentElement &&
          node.parentElement.closest('p,li,h1,h2,h3,h4,h5,h6,blockquote,pre,td,th,dt,dd,figcaption,summary');
      } catch (err) { host = node.parentElement; }
      host = host || node.parentElement;
      let idx = blocks.indexOf(host);
      if (idx === -1) { blocks.push(host); idx = blocks.length - 1; }
      return idx;
    };
    while ((n = walker.nextNode())) {
      const t = n.nodeValue || '';
      if (!t) continue;
      const bid = blockIdOf(n);
      /*
       * A SEPARATOR BETWEEN BLOCKS, or the words either side get glued.
       *
       * textContent joins block-level text nodes with nothing at all, so
       * "one item" and "two item longer" became the single token "itemtwo" -
       * measured - which is why three list items lit up as one 119-character
       * mark. The spoken text has a newline there, so put one here too and
       * both sides tokenise the same way.
       *
       * The pad owns its own index entry so the mapping stays 1:1, and
       * rangeFor skips it: a mark always starts and ends on a word, never
       * inside a gap.
       */
      if (lastBlock !== -1 && bid !== lastBlock) {
        readNodes.push({ node: lastNode, start: at, end: at + 1, block: lastBlock, pad: true });
        buf.push('\\n');
        at += 1;
      }
      lastBlock = bid; lastNode = n;
      readNodes.push({ node: n, start: at, end: at + t.length, block: bid });""",
        'block ids'))

    report('read-along: a range never starts in a gap', once(
        """    for (let i = 0; i < readNodes.length; i++) {
      const e = readNodes[i];
      if (!a && start < e.end) a = { node: e.node, offset: start - e.start };""",
        """    for (let i = 0; i < readNodes.length; i++) {
      const e = readNodes[i];
      if (e.pad) continue;   /* v10.3: the synthetic block separator */
      if (!a && start < e.end) a = { node: e.node, offset: start - e.start };""",
        'rangeFor pads'))

    report('read-along: a block boundary ends a sentence', once(
        """  /** A Range for [start,end) in the index. */""",
        block('blockat.js') + """  /** A Range for [start,end) in the index. */""",
        'blockAt'))

    report('read-along: search on a word boundary', once(
        """      const re = new RegExp(probe, 'g');""",
        """      const re = new RegExp('(^|[^0-9A-Za-z\\u00c0-\\uffff])(' + probe + ')', 'g');""",
        'boundary search'))

    report('read-along: map the chunk by words, cut it into sentences', once(
        old_span, block('span.js') + block('sentence.js'), 'chunk span'))

    # ---------------------------- 4. read-along: the word mark moves the line
    old_word = (
        "  /** Move the word mark to wherever the voice has reached in this chunk. */\n"
        "  function markReadingWord(piece, charIndex) {\n"
        "    if (!canHighlight() || !chunkSpan || !chunkSpan.words.length) return;\n"
        "    const before = String(piece && piece.text || '').slice(0, Math.max(0, charIndex));\n"
        "    /*\n"
        "     * charIndex is an offset into the CHUNK's text, and the pane's copy has\n"
        "     * different spacing - so the reliable common unit is the word ordinal,\n"
        "     * not the character.\n"
        "     */\n"
        "    const ordinal = (before.match(/[^\\s ]+[\\s ]/g) || []).length;\n"
        "    const w = chunkSpan.words[Math.min(ordinal, chunkSpan.words.length - 1)];\n"
        "    if (w) setHl(HL_WORD, rangeFor(w.start, w.end));\n"
        "  }\n"
    )
    report('read-along: the sentence follows the voice', once(
        old_word, block('word.js'), 'word mark'))

    report('read-along: exported for testing', once(
        """    showReadable: showReadable, restoreMode: restoreMode,""",
        """    showReadable: showReadable, restoreMode: restoreMode,
    markSentence: markSentence, chunkSpan: function () { return chunkSpan; },""",
        'read-along exports'))

    # ------------------------------------------- 5. settings section landing
    old_stuck = """      const nav = body.querySelector('.settings-nav');
      let stuck = 0;
      if (nav && getComputedStyle(nav).position === 'sticky') {
        stuck = Math.round(nav.getBoundingClientRect().height) || 0;
      }
"""
    report('settings: measure only a nav that is actually in the way',
           once(old_stuck, block('stuck.js'), 'settings stuck'))

    report('settings: land on the heading, not behind it', once(
        """      const top = Math.max(0, body.scrollTop +
        (target.getBoundingClientRect().top - body.getBoundingClientRect().top) - stuck - 14);""",
        """      const top = Math.max(0, body.scrollTop +
        (targetRect.top - bodyRect.top) - stuck - 16);""", 'settings top'))

    # --------------------------------------- 6. the panel opens for related
    report('automation: a related note can open the panel', once(
        """      /* An outline needs at least two headings to be worth a panel. */
      const heads = String(note.content || '').match(/^\\s{0,3}#{1,6}\\s+\\S/gm);
      if (heads && heads.length >= 2) return true;
    } catch (err) { /* never block on this */ }
    return false;
  }
""",
        """      /* An outline needs at least two headings to be worth a panel. */
      const heads = String(note.content || '').match(/^\\s{0,3}#{1,6}\\s+\\S/gm);
      if (heads && heads.length >= 2) return true;
""" + block('related.js') + """    } catch (err) { /* never block on this */ }
    return false;
  }

""" + block('relatedfn.js'), 'related opens panel'))

    report('automation: and Related is what flashes', once(
        """      const heads = String(note.content || '').match(/^\\s{0,3}#{1,6}\\s+\\S/gm);
      if (heads && heads.length >= 2) return 'outline';
    } catch (err) {}
    return null;
  }""",
        """      const heads = String(note.content || '').match(/^\\s{0,3}#{1,6}\\s+\\S/gm);
      if (heads && heads.length >= 2) return 'outline';
      if (relatedWorthOpening(note)) return 'related';
    } catch (err) {}
    return null;
  }""", 'reasonFor related'))

    report('automation: document the new switch', once(
        """ *   showNoteCrumbs      A breadcrumb over the note title - Folder /""",
        """ *   matrixPullFromNotes Every unfinished checkbox in every note sorts
 *                       itself into a priority-matrix quadrant. Off by
 *                       default; cards you placed by hand ignore it.
 *
 *   showNoteCrumbs      A breadcrumb over the note title - Folder /""",
        'automation doc'))

    # --------------------------------------------- 7. the settings row for it
    report('settings: the matrix switch, off by default', once(
        """    wrap.appendChild(row('Show the folder path above a note',""",
        block('automationrow.js') +
        """    wrap.appendChild(row('Show the folder path above a note',""",
        'automation row'))

    # ------------------------------------------- 8. newTask takes a quadrant
    report('tasks: a new task can be born in a quadrant', once(
        """  async function newTask() {
    const text = await N.modal.prompt({
      title: 'New task',""",
        """  async function newTask(quadrant) {
    const text = await N.modal.prompt({
      title: quadrant ? 'New task in this quadrant' : 'New task',""",
        'newTask signature'))

    report('tasks: and it stays where it was put', once(
        """      priority: priority ? Number(priority) : null,
      quadrant: null,""",
        """      priority: priority ? Number(priority) : null,
      /* v10.3: born in a quadrant when the matrix's + asked for one, which
         also means the pull-from-notes switch can never hide it. */
      quadrant: quadrant || null,""", 'newTask quadrant'))

    # ------------------------------------------ 9. the matrix honours the switch
    report('matrix: note tasks only when asked', once(
        """  function tasksInScope() {
    let list = N.tasks.collect().filter(function (t) { return !t.done && !t.cancelled; });""",
        block('scope.js') +
        """  function tasksInScope() {
    let list = N.tasks.collect().filter(function (t) { return !t.done && !t.cancelled; });
    if (!pullFromNotes()) {
      list = list.filter(function (t) { return t.source === 'standalone' || !!t.quadrant; });
    }""", 'matrix scope'))

    report('matrix: say what is being held back', once(
        """    const list = tasksInScope();
    const buckets = { do: [], schedule: [], delegate: [], drop: [] };""",
        block('hint.js') +
        """    const list = tasksInScope();
    const buckets = { do: [], schedule: [], delegate: [], drop: [] };""",
        'matrix hint'))

    report('matrix: the empty state explains itself', once(
        """      empty.appendChild(el('p.empty-state-text', null,
        'The matrix pulls in every unfinished task from your notes and your standalone list. Add one and it will appear here.'));
      const actions = el('div.empty-state-actions');
      actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { N.tasks.newTask(); } }, 'Add a task'));""",
        """      empty.appendChild(el('p.empty-state-text', null,
        heldBack() > 0
          ? 'Your notes have unfinished tasks, but pulling them in here is switched off. Add a task by hand, or turn the automation on.'
          : 'The matrix shows your standalone tasks, plus anything you drag into a quadrant. Add one and it will appear here.'));
      const actions = el('div.empty-state-actions');
      actions.appendChild(el('button.btn.btn-primary', { type: 'button', onclick: function () { N.tasks.newTask(); } }, 'Add a task'));""",
        'matrix empty state'))

    # ------------------------------------------------- 10. the plus per quadrant
    report('matrix: a plus in every quadrant', once(
        """      head.appendChild(el('span.badge.badge-quiet', null, String(buckets[quad.id].length)));
      col.appendChild(head);""",
        """      head.appendChild(el('span.badge.badge-quiet', null, String(buckets[quad.id].length)));
      /*
       * v10.3: the plus you asked for. It adds a STANDALONE task already
       * placed in this quadrant, so it is visible whatever the
       * pull-from-notes switch is set to.
       */
      const add = el('button.matrix-add', {
        type: 'button',
        title: 'Add a task to "' + quad.title + '"',
        'aria-label': 'Add a task to ' + quad.title,
        onclick: async function (e) {
          e.stopPropagation();
          await N.tasks.newTask(quad.id);
          render();
        },
      });
      add.appendChild(N.icons.node('plus', { size: 14 }));
      head.appendChild(add);
      col.appendChild(head);""", 'matrix plus'))

    # ------------------------------------- 11. tidy must not fit a hidden wall
    report('sticky: never fit a wall nobody can see', once(
        """    if (![minX, minY, maxX, maxY].every(isFinite)) { repairView(); applyView(); return; }
    const pad = 48;
    const r = wall.getBoundingClientRect();""",
        """    if (![minX, minY, maxX, maxY].every(isFinite)) { repairView(); applyView(); return; }
    const pad = 48;
    const r = wall.getBoundingClientRect();
""" + block('stickyfit.js'), 'sticky fit guard'))

    report('sticky: and pay the fit back when it is shown', once(
        """    N.bus.on('view:changed', function (v) { if (v === 'sticky') render(); });""",
        """    N.bus.on('view:changed', function (v) {
      if (v !== 'sticky') return;
      render();
      /* v10.3: a tidy that happened while the wall was hidden owes it a fit. */
      if (wantFit) { wantFit = false; requestAnimationFrame(fit); }
    });""", 'sticky fit payback'))

    report('sticky: the flag it all hangs on', once(
        """  const MIN_ZOOM = 0.25, MAX_ZOOM = 2.2;""",
        """  const MIN_ZOOM = 0.25, MAX_ZOOM = 2.2;
  /* v10.3: set when fit() was asked to measure a wall that was not on
     screen. Paid back the moment the wall is shown. */
  let wantFit = false;""", 'wantFit'))

    # ------------------------------------------------------- 11. version + date
    report('version 10.3.0', once("""  N.version = '10.2.0';
  N.versionName = 'v10.2';""", """  N.version = '10.3.0';
  N.versionName = 'v10.3';""", 'version string'))

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
