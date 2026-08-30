#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v9.9 - reading aloud, in the language it is written in
=============================================================================

    python3 fix_v99_standalone.py index.html --dry-run
    python3 fix_v99_standalone.py index.html

Run this on a v9.8 index.html. It does not touch the loading screen, so it
applies the same whether you are on the old loader or the new one.

WHAT IT FIXES

 1. "READ THIS NOTE ALOUD" READ THE SELECTION INSTEAD OF THE NOTE.
    start() with no argument prefers the selection - which is right for the
    toolbar's play button and wrong for a command called "read this NOTE".
    Both the command and the "..." menu row now read the whole note whether
    or not something is highlighted. The selection still has its own button
    and its own command.

 2. IT ONLY EVER SPOKE ENGLISH.
    One voice was picked for the whole note, from the INTERFACE language -
    so a Tamil note read by an en-US voice, letter salad. The note is now
    split into runs by script, each run gets a voice that actually matches
    it, and a note that mixes Tamil and English is spoken by two voices in
    turn. Nothing to choose: it reads what is written.

    24 scripts are recognised. Where a language has no voice installed on
    the device the app says so once, by name, with how to add one - because
    the browser cannot synthesise a language the system has no voice for,
    and pretending otherwise would just be silence.

 3. THE PROGRESS BAR DID NOT MOVE.
    Progress was counted in whole utterances, and a short note is ONE
    utterance - so the bar sat at zero and then jumped to full. It now
    follows the word boundary events the engine emits, so it advances as
    the voice speaks, and the count reads a percentage.

 4. THE THREE-DOT BUTTON WAS INVISIBLE IN EVERY DARK THEME.
    --dot-strength was declared on :root as var(--text-1), but the themes
    declare --text-1 on BODY. So it froze at the :root light-mode value and
    every dark theme drew dark grey dots on a dark background. Measured from
    rendered pixels: contrast 1.24-1.29 against the row in all six dark
    themes, where 3.0 is the floor for a UI glyph. Moving the declaration to
    body makes it follow the theme, and the resting opacity comes up.

 5. THE MOBILE MENU'S ICONS SAT ABOVE THEIR LABELS.
    .sheet-item .icon carries align-self:flex-start, which beats the row's
    own align-items:center - so on every single-line row the icon was pinned
    to the top of a 46px row while the label was centred in it. Measured 5px
    out in English, 3px in Tamil, on every row. Rows WITH a description still
    align their icon to the first line, which is correct.

 NOT IN THIS PATCH: saving the audio. You asked to hold it for its own round.
 The short version of why it needs one: the browser gives no access to the
 audio speechSynthesis produces, so the only route is recording the tab while
 it speaks, and MediaRecorder cannot emit MP3 (verified - audio/mpeg is not a
 supported type). That is a real decision about format and dependencies, not
 something to slip in untested.
=============================================================================
"""

import io
import os
import sys

_BLOCKS = {}

_BLOCKS['css.css'] = r'''
/* =========================================================================
 * v9.9 — THE THREE-DOT BUTTON, AND THE MOBILE MENU'S ICONS
 * ========================================================================= */

/* -- the three-dot button, in every theme --------------------------------
 * v9.6 put these on :root. The THEMES declare --text-0/1/2/3 on BODY, so a
 * var(--text-1) evaluated at :root resolves against the :root defaults and
 * then never moves again - it was frozen at the light-mode ink, #4a4438, in
 * all six dark themes. Measured from rendered pixels on a sidebar row:
 *
 *     nodalis/dark 1.26   notion/dark 1.24   nothing/dark 1.26
 *     slate/dark   1.26   aurora/dark 1.27   terminal/dark 1.29
 *
 * against a 3.0 floor for a UI glyph - which is the "sometimes I cannot see
 * it" that was reported. Declaring them on BODY is the whole fix: the same
 * var() now resolves against whichever theme is on.
 *
 * Still the two numbers to tune, and still the only two:
 *   --dot-size      dot diameter, as the stroke width in a 24-unit viewBox
 *   --dot-strength  the resting ink
 */
body {
  --dot-size: 2.8;
  --dot-strength: var(--text-1);
  --dot-strength-hover: var(--text-0);
}

/*
 * The second half of "sometimes I cannot see it": the row's actions rest at
 * 45% opacity, which even over correct ink lands at ~2.2 contrast. 0.68 is
 * the value that puts ALL TWELVE theme/mode pairs over the 3.0 floor -
 * measured, the worst of them (notion light) sits at 3.09 - while still
 * reading as secondary next to the note's title. Touch devices, which have
 * no hover to reveal anything with, stay at 1.
 */
.tree-row-actions { opacity: 0.68; }
.tree-row:hover .tree-row-actions,
.tree-row:focus-within .tree-row-actions { opacity: 1; }
@media (hover: none) { .tree-row-actions { opacity: 1; } }

/* -- the mobile menu: icon and label on the same line ---------------------
 * .sheet-item .icon sets align-self:flex-start, and align-self on the CHILD
 * beats align-items on the row. So the v9.4 rule that centres single-line
 * rows only ever centred the label, and the icon stayed pinned to the top of
 * a 46px row: measured 5px above the label's centre in English, 3px in
 * Tamil, on every row of the More sheet.
 *
 * A row WITH a description is a different case and was already right - there
 * the icon belongs on the first line, not in the middle of a two-line block.
 */
.sheet-item:not(:has(.sheet-item-desc)) > .icon {
  align-self: center;
  margin-top: 0;
}

/* -- reading aloud -------------------------------------------------------- */
.speak-count { min-width: 34px; text-align: right; }
/* The meter is the one part of this bar that reports live state; give it
   room to be read as a bar rather than a hairline. */
.speak-meter { height: 4px; }
.speak-meter-fill { transition: transform 120ms linear; }
[data-animations='none'] .speak-meter-fill { transition: none; }
'''

_BLOCKS['lang.js'] = r'''  /* ===================================================================== *
   * v9.9: IT READS WHAT IS WRITTEN, IN THE LANGUAGE IT IS WRITTEN IN.
   *
   * Until now one voice was chosen for the whole note, and it was chosen
   * from the INTERFACE language - so a Tamil note read with an en-US
   * interface got an en-US voice trying to pronounce Tamil, which is the
   * letter salad that was reported.
   *
   * The note is split into runs by SCRIPT instead. Latin is a script like
   * any other here, so a note that mixes Tamil and English becomes Tamil
   * runs and English runs, each spoken by a voice that matches it, in
   * order. Nothing to choose and nothing to configure: what is written is
   * what decides.
   *
   * Script is not language - Devanagari carries Hindi and Marathi, Arabic
   * carries Urdu and Persian - so this maps a script to the language most
   * likely meant by it and lets the engine's own matching do the rest. It
   * is a better guess than "whatever the menus are in", which is what it
   * replaces, and it never has to be right for the text to be readable.
   *
   * WHAT IT CANNOT DO: synthesise a language the device has no voice for.
   * That is the operating system's business, not the page's. Where a voice
   * is missing it is named, once, with how to install one - which is worth
   * more than silence and far more than a wrong voice.
   * ===================================================================== */
  const LANG_SCRIPTS = [
    /* kana before Han: Japanese uses both, Chinese only the latter */
    ['ja', /[぀-ゟ゠-ヿ]/],
    ['ko', /[가-힯ᄀ-ᇿ㄰-㆏]/],
    ['zh', /[一-鿿㐀-䶿]/],
    ['ta', /[஀-௿]/],
    ['hi', /[ऀ-ॿ]/],
    ['bn', /[ঀ-৿]/],
    ['pa', /[਀-੿]/],
    ['gu', /[઀-૿]/],
    ['or', /[଀-୿]/],
    ['te', /[ఀ-౿]/],
    ['kn', /[ಀ-೿]/],
    ['ml', /[ഀ-ൿ]/],
    ['si', /[඀-෿]/],
    ['th', /[฀-๿]/],
    ['lo', /[຀-໿]/],
    ['my', /[က-႟]/],
    ['ka', /[Ⴀ-ჿ]/],
    ['am', /[ሀ-፿]/],
    ['km', /[ក-៿]/],
    ['he', /[֐-׿]/],
    ['ar', /[؀-ۿݐ-ݿﭐ-﷿]/],
    ['el', /[Ͱ-Ͽ]/],
    ['ru', /[Ѐ-ӿ]/],
    ['hy', /[԰-֏]/],
    /* last, so every script above claims its own characters first */
    ['latin', /[A-Za-zÀ-ɏ]/],
  ];

  const LANG_NAMES = {
    ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ta: 'Tamil', hi: 'Hindi',
    bn: 'Bengali', pa: 'Punjabi', gu: 'Gujarati', or: 'Odia', te: 'Telugu',
    kn: 'Kannada', ml: 'Malayalam', si: 'Sinhala', th: 'Thai', lo: 'Lao',
    my: 'Burmese', ka: 'Georgian', am: 'Amharic', km: 'Khmer', he: 'Hebrew',
    ar: 'Arabic', el: 'Greek', ru: 'Russian', hy: 'Armenian', latin: 'English',
  };

  function langName(code) { return LANG_NAMES[code] || String(code || '').toUpperCase(); }

  /** The language of one character, or null for spaces, digits and punctuation. */
  function langOfChar(ch) {
    for (let i = 0; i < LANG_SCRIPTS.length; i++) {
      if (LANG_SCRIPTS[i][1].test(ch)) return LANG_SCRIPTS[i][0];
    }
    return null;
  }

  /**
   * Split text into consecutive same-language runs.
   *
   * Neutral characters - spaces, digits, punctuation - belong to whichever
   * run is being built, which is what keeps "2,000" and a full stop with the
   * sentence they came from instead of ending it.
   */
  function languageRuns(text) {
    const s = String(text || '');
    const runs = [];
    let cur = null;        // the language of the run being built
    let buf = '';
    let pending = '';      // neutrals waiting to learn which run they are in

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const l = langOfChar(ch);
      if (l === null) { pending += ch; continue; }
      if (!buf) { cur = l; buf = pending + ch; pending = ''; continue; }
      if (l === cur) { buf += pending + ch; pending = ''; continue; }
      runs.push({ lang: cur, text: buf });
      cur = l; buf = pending + ch; pending = '';
    }
    if (buf) runs.push({ lang: cur, text: buf + pending });
    else if (pending.trim() && runs.length) runs[runs.length - 1].text += pending;

    /*
     * A stray word of one language inside another - a product name in a
     * Tamil sentence - is not worth changing voice twice for. Runs shorter
     * than this are folded into the run before them.
     */
    const merged = [];
    runs.forEach(function (r) {
      const prev = merged[merged.length - 1];
      if (prev && r.text.trim().length < 4) { prev.text += r.text; return; }
      if (prev && prev.lang === r.lang) { prev.text += r.text; return; }
      merged.push({ lang: r.lang, text: r.text });
    });
    return merged.filter(function (r) { return r.text.trim(); });
  }

  /** Every voice whose language matches, local ones first. */
  function voicesForLang(code) {
    const list = voiceList();
    const c = String(code || '').toLowerCase();
    if (!c || !list.length) return [];
    const norm = function (v) { return String(v.lang || '').toLowerCase().replace(/_/g, '-'); };
    const hit = list.filter(function (v) {
      const n = norm(v);
      return n === c || n.indexOf(c + '-') === 0;
    });
    /* A local voice does not need the network and does not go quiet offline. */
    return hit.filter(function (v) { return v.localService; }).concat(
           hit.filter(function (v) { return !v.localService; }));
  }

  /**
   * The voice for one run. Latin honours the voice you picked by hand,
   * because that is the one people actually set; every other script is
   * matched to its own language, because a hand-picked English voice
   * reading Tamil is the bug this replaces.
   */
  function voiceForLang(code) {
    const list = voiceList();
    if (!list.length) return null;
    if (!code || code === 'latin') {
      const want = N.store.state.settings.speakVoice;
      if (want) {
        const exact = list.filter(function (v) { return v.voiceURI === want || v.name === want; })[0];
        if (exact) return exact;
      }
      const ui = String((N.i18n && N.i18n.current && N.i18n.current()) || 'en').toLowerCase();
      const byUi = voicesForLang(ui)[0];
      if (byUi) return byUi;
      return list.filter(function (v) { return v.default; })[0] || list[0];
    }
    return voicesForLang(code)[0] || null;
  }

  /** Which of these languages this device cannot speak. */
  function missingVoices(plan) {
    const seen = {};
    const missing = [];
    (plan || []).forEach(function (piece) {
      const code = piece.lang;
      if (!code || code === 'latin' || seen[code]) return;
      seen[code] = true;
      if (!voicesForLang(code).length) missing.push(code);
    });
    return missing;
  }

  /** Runs, then each run cut into utterance-sized pieces that keep its language. */
  function planChunks(text) {
    const plan = [];
    languageRuns(text).forEach(function (run) {
      split(run.text).forEach(function (piece) {
        plan.push({ text: piece, lang: run.lang });
      });
    });
    return plan;
  }

'''

_BLOCKS['speaknext.js'] = r'''  function speakNext() {
    if (!speaking || at >= chunks.length) {
      if (speaking) {
        speaking = false;
        spokenInChunk = 0;
        N.bus.emit('speak:done');
        paint();
        if (panel) closePanel();
      }
      return;
    }
    const piece = chunks[at];
    const u = new window.SpeechSynthesisUtterance(piece.text);
    /*
     * Setting .voice throws outright if the object is not a real
     * SpeechSynthesisVoice - and getVoices() has been known to hand back
     * stale entries after a system voice is removed, on top of every
     * platform's own quirks. An engine detail must never be able to take
     * reading aloud down with an uncaught exception: the default voice is a
     * perfectly good outcome, silence is not.
     */
    try {
      const v = voiceForLang(piece.lang);
      if (v) { u.voice = v; if (v.lang) u.lang = v.lang; }
      else if (piece.lang && piece.lang !== 'latin') {
        /* No installed voice for it. Naming the language anyway lets an
           engine that resolves languages itself have a go, and costs
           nothing where it cannot. */
        u.lang = piece.lang;
      }
    } catch (err) {
      console.warn('[speak] that voice was refused; using the default', err);
    }
    try { u.rate = rate(); u.pitch = 1; } catch (err) { /* clamped by the engine */ }

    /*
     * v9.9: PROGRESS THAT MOVES.
     *
     * It used to be counted in whole utterances, and a short note is one
     * utterance - so the bar sat at 0 and then jumped to 1 with nothing in
     * between, which is what "it does not show any progress" was. boundary
     * fires as the engine reaches each word, so the bar can follow the
     * voice. Engines that do not fire it fall back to the old per-chunk
     * stepping rather than to a timer pretending to be progress.
     */
    spokenInChunk = 0;
    u.onboundary = function (e) {
      if (!speaking || currentUtterance !== u) return;
      const i = e && typeof e.charIndex === 'number' ? e.charIndex : 0;
      spokenInChunk = Math.max(0, Math.min(piece.text.length, i));
      paint();
    };
    u.onend = function () {
      if (!speaking || currentUtterance !== u) return;
      at++;
      spokenInChunk = 0;
      paint();
      speakNext();
    };
    u.onerror = function (e) {
      // 'interrupted' and 'canceled' are what stop() produces; they are not faults.
      if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
      console.warn('[speak] utterance failed', e && e.error);
      at++;
      spokenInChunk = 0;
      if (at < chunks.length) speakNext(); else stop();
    };
    currentUtterance = u;
    try { window.speechSynthesis.speak(u); }
    catch (err) { console.warn('[speak] refused', err); stop(); }
  }
'''

_BLOCKS['start.js'] = r'''  /**
   * start(text) - or, with nothing passed, the selection if there is one and
   * the whole note if there is not. That rule is what makes the toolbar's
   * play button one button; startNote() is for the places that say "this
   * NOTE" and must mean it.
   */
  function start(text) {
    if (!supported()) {
      N.toast.warn('This browser cannot read text aloud.', { ms: 4000 });
      return false;
    }
    let source = text;
    if (source === undefined || source === null) {
      const s = N.format && N.format.selection ? N.format.selection() : null;
      if (s && s.text && s.text.trim()) source = s.text;
      else {
        const note = N.store.getNote(N.store.state.activeNoteId);
        source = note ? note.content : '';
      }
    }
    const speech = toSpeech(source);
    if (!speech) {
      N.toast.show('Nothing to read.', { kind: 'info', ms: 2200 });
      return false;
    }
    stop({ keepPanel: true });
    loadVoices();
    chunks = planChunks(speech);
    if (!chunks.length) {
      N.toast.show('Nothing to read.', { kind: 'info', ms: 2200 });
      return false;
    }
    /* Precomputed so progress is one subtraction per boundary event. */
    charsBefore = [];
    totalChars = 0;
    chunks.forEach(function (c) { charsBefore.push(totalChars); totalChars += c.text.length; });
    at = 0;
    spokenInChunk = 0;
    speaking = true;
    paused = false;
    openPanel();
    reportMissingVoices(chunks);
    speakNext();
    return true;
  }

  /**
   * The whole note, whatever is highlighted. "Read this note aloud" that
   * reads three highlighted words instead is not a smaller version of the
   * feature, it is the wrong one.
   */
  function startNote() {
    const note = N.store.getNote(N.store.state.activeNoteId);
    if (!note) { N.toast.show('Open a note first.', { kind: 'info', ms: 2200 }); return false; }
    return start(note.content);
  }

  /**
   * Said once per set of languages, not once per note, because the answer is
   * the same every time and the second telling is nagging.
   */
  let warnedFor = '';
  function reportMissingVoices(plan) {
    let missing;
    try { missing = missingVoices(plan); }
    catch (err) { return; }
    if (!missing.length) { warnedFor = ''; return; }
    const key = missing.slice().sort().join(',');
    if (key === warnedFor) return;
    warnedFor = key;
    const names = missing.map(langName);
    const list = names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    N.toast.warn(
      'No ' + list + ' voice is installed, so those parts will not sound right. ' +
      'Windows: Settings → Time & language → Speech → Add voices. ' +
      'Android: Settings → System → Languages → Text-to-speech.',
      { ms: 8000, key: 'speak-voice' }
    );
  }
'''

_BLOCKS['paint.js'] = r'''  function paint() {
    if (!panel) return;
    const play = panel.querySelector('.speak-play');
    if (play) {
      const label = !speaking ? T('speak.speak', 'Read aloud')
        : paused ? T('speak.resume', 'Resume') : T('speak.pause', 'Pause');
      play.title = label;
      play.setAttribute('aria-label', label);
      play.innerHTML = '';
      play.appendChild(N.icons.node(!speaking || paused ? 'play' : 'pause', { size: 16 }));
    }
    /*
     * v9.9: measured in CHARACTERS SPOKEN, not utterances finished, so a
     * one-utterance note has a bar that moves instead of a bar that waits.
     */
    let ratio = 0;
    if (totalChars > 0) {
      if (at >= chunks.length) ratio = 1;
      else ratio = Math.min(1, ((charsBefore[at] || 0) + spokenInChunk) / totalChars);
    }
    const fill = panel.querySelector('.speak-meter-fill');
    if (fill) fill.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    const count = panel.querySelector('.speak-count');
    if (count) count.textContent = totalChars ? Math.round(ratio * 100) + '%' : '';
    panel.querySelectorAll('.speak-speed').forEach(function (b) {
      b.classList.toggle('is-on', Number(b.dataset.rate) === rate());
    });
    panel.classList.toggle('is-paused', paused);
  }
'''


def block(name):
    return _BLOCKS[name]


MARKER = 'v9.9: IT READS WHAT IS WRITTEN'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    path = args[0] if args else 'index.html'

    if not os.path.exists(path):
        print('ERROR: %s not found.' % path)
        return 1

    src = io.open(path, encoding='utf-8').read()
    if MARKER in src:
        print('ERROR: v9.9 is already installed in this file.')
        return 1
    if 'v9.8: NOTHING IS LIFTED OUT ANY MORE' not in src:
        print('ERROR: this file is not at v9.8 yet. Run fix_v98_standalone.py first.')
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
        """Replace start_at .. the NEXT end_at after it.

        end_at is searched from the start anchor forward on purpose: several of
        these end markers (a section comment, say) also occur earlier in the
        file, and a plain find() would hand back a bound above the start and
        silently splice the wrong region.
        """
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
        print('   %-44s %s' % (name, 'ok' if ok else 'FAILED'))

    print('=' * 76)
    print(' Nodalis v9.9 - reading aloud, in the language it is written in')
    print('=' * 76)
    print(' file: %s  (%d bytes)\n' % (path, len(src)))

    # ------------------------------------------------------------ 1. stylesheet
    report('stylesheet', once('\n</style>\n</head>',
                              '\n' + block('css.css') + '\n</style>\n</head>', 'stylesheet'))

    # -------------------------------------------- 2. the module's new state
    report('speak: progress state', once(
        """  let currentUtterance = null;
  let voices = [];
""",
        """  let currentUtterance = null;
  let voices = [];
  /* v9.9: progress is counted in characters, so it can move inside one
     utterance instead of only between utterances. */
  let spokenInChunk = 0;
  let charsBefore = [];
  let totalChars = 0;
""", 'speak state'))

    # ------------------------- 3. language detection replaces preferredVoice()
    report('speak: language runs + per-run voices', splice(
        '  function preferredVoice() {',
        '  function rate() {',
        block('lang.js'), 'language engine'))

    # ------------------------------------------------------------ 4. speakNext
    report('speak: one voice per run + boundary events', splice(
        '  function speakNext() {',
        '  /**\n   * start(text) - or, with nothing passed,',
        block('speaknext.js') + '\n', 'speakNext'))

    # ---------------------------------------------------- 5. start + startNote
    report('speak: start() plans runs, startNote() added', splice(
        '  /**\n   * start(text) - or, with nothing passed,',
        '  function pause() {',
        block('start.js') + '\n', 'start/startNote'))

    # ---------------------------------------------------------------- 6. paint
    report('speak: progress bar follows the voice', splice(
        '  function paint() {\n    if (!panel) return;',
        '  /* ------------------------------------------------------------------ init */',
        block('paint.js') + '\n', 'paint'))

    # ------------------------------------------- 7. stop() resets the counters
    report('speak: stop() clears progress', once(
        """  function stop(opts) {
    speaking = false;
    paused = false;
    chunks = [];
    at = 0;
    currentUtterance = null;""",
        """  function stop(opts) {
    speaking = false;
    paused = false;
    chunks = [];
    at = 0;
    spokenInChunk = 0;
    charsBefore = [];
    totalChars = 0;
    currentUtterance = null;""", 'stop resets'))

    # ------------------------------------- 8. the command reads the whole note
    report('command "Read this note aloud" reads the note', once(
        """        { id: 'speak.note', title: 'Read this note aloud', group: 'Note', icon: 'play',
          accel: 'Mod+Shift+Space',
          when: function () { return !!N.store.state.activeNoteId; },
          run: function () { start(); } },""",
        """        { id: 'speak.note', title: 'Read this note aloud', group: 'Note', icon: 'play',
          accel: 'Mod+Shift+Space',
          when: function () { return !!N.store.state.activeNoteId; },
          /* v9.9: the WHOLE note, whatever happens to be highlighted. */
          run: function () { startNote(); } },""", 'speak.note command'))

    # --------------------------------- 9. the "..." menu row reads the whole note
    report('"..." menu row reads the note, not the selection', once(
        "      row('play', T('speak.readNote', 'Read this note aloud'), function () { N.speak.start(); });",
        "      row('play', T('speak.readNote', 'Read this note aloud'), function () { N.speak.startNote(); });",
        'more-menu row'))

    # ------------------------------------------------------------ 10. exports
    report('module exports', once(
        """  N.speak = {
    init: init, supported: supported, start: start, stop: stop, pause: pause,""",
        """  N.speak = {
    init: init, supported: supported, start: start, startNote: startNote,
    languageRuns: languageRuns, planChunks: planChunks, voiceForLang: voiceForLang,
    missingVoices: missingVoices, langName: langName,
    stop: stop, pause: pause,""", 'exports'))

    print('\n' + '=' * 76)
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
    print('=' * 76)
    return 0


if __name__ == '__main__':
    sys.exit(main())
