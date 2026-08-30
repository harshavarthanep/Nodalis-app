#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v9.8 - the formatting bar, the bullet picker, and the settings header
=============================================================================

    python3 fix_v98_standalone.py index.html --dry-run
    python3 fix_v98_standalone.py index.html

Run this on a v9.7 index.html (the file that already has the selection-toolbar
bullet button). It works the same whether or not the optional v9.6-L loading
screen was applied - it does not touch the loader.

WHAT IT FIXES

 1. THE FORMATTING BAR WAS EMPTY ON EVERY SMALL SCREEN.
    Measured on a 390px phone: zero formatting buttons. Zero on a 344px
    foldable. Zero on a 768px tablet. The bar dropped a whole group into the
    "..." menu whenever the row was too narrow, and on a narrow row that meant
    all five groups - bold, headings, lists, quote, link - leaving a
    highlighter and three menus. Nothing is lifted out any more: the groups
    stay put and the strip scrolls, with a fade at whichever end has more to
    show and a mouse wheel that scrolls it sideways.

 2. THE BULLET PICKER IS A SPLIT BUTTON NOW, LIKE WORD'S.
    The separate slider-icon button is gone. The bullet button in the toolbar
    has an arrow on its right: the button applies the list, the arrow opens
    the style picker. Picking a style COMMITS AND CLOSES, exactly like picking
    a highlight colour a few pixels away - and on a mouse, moving down the
    list previews each style live before you commit to one.

 3. THE PICKER FITS EVERY SCREEN NOW.
    It was 382px wide on a 390px phone because one long sentence in its footer
    had nothing to wrap against, which is what threw the marks and the labels
    so far apart. It is a 288px-max column with a fixed mark gutter, and it
    measures itself against visualViewport so an open keyboard cannot park it
    off the bottom of the screen.

 4. BULLET STYLE IS NO LONGER A SEPARATE SETTINGS ROW.
    It lives on the bullet button's arrow, and on "Bullet style..." in any
    note menu. The Settings > Typography row is removed and the manual is
    corrected to match.

 5. THE SETTINGS TAB BAR HAD A TRANSPARENT STRIP ABOVE IT.
    position:sticky measures from the scrollport inset by the scroll
    container's padding, so #settings-body's 12px top padding parked the
    sticky tab bar 12px down the screen - and settings rows scrolled visibly
    through the gap between the header and the tabs. The padding moves off the
    scroll container.

 6. A TRAY COULD OUTLIVE ITS TOOLBAR.
    Opening the bullet tray and then switching to Settings left the tray
    floating over the settings page. Changing view now closes it.
=============================================================================
"""

import io
import os
import sys

# --- the inserted blocks, embedded so this file is the only file you need ---
_BLOCKS = {}

_BLOCKS['css.css'] = r'''
/* =========================================================================
 * v9.8 — THE FORMATTING BAR, THE BULLET PICKER, THE SETTINGS HEADER
 * ========================================================================= */

/* -- the bullet button is a split control, the way Word's is -------------
 * The left half applies the list; the arrow opens the style picker. One
 * button doing both would have to guess which you meant. Two halves never
 * guess - and it is the same shape as the highlighter and its caret, which
 * sit a few pixels away doing exactly this.
 */
.sel-split { display: inline-flex; align-items: center; flex: none; }
.sel-dock .sel-split .sel-btn { border-radius: var(--r-sm, 6px) 0 0 var(--r-sm, 6px); }
.sel-dock .sel-bullet-caret {
  width: 15px; height: 34px; flex: none;
  display: flex; align-items: center; justify-content: center;
  border: 0; background: transparent; color: var(--text-2);
  border-radius: 0 var(--r-sm, 6px) var(--r-sm, 6px) 0;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.sel-dock .sel-bullet-caret:hover { background: var(--bg-2); color: var(--text-0); }
.sel-dock .sel-split:has(.sel-bullet-caret[aria-expanded='true']) .sel-btn,
.sel-dock .sel-bullet-caret[aria-expanded='true'] { background: var(--bg-2); color: var(--accent); }

/* -- the strip scrolls, and says which way -------------------------------
 * A mask rather than an overlay, so the fade costs no layout and cannot sit
 * on top of a button and eat its taps.
 */
.sel-dock.can-scroll-right .sel-scroll {
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
          mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
}
.sel-dock.can-scroll-left .sel-scroll {
  -webkit-mask-image: linear-gradient(to left, #000 calc(100% - 24px), transparent 100%);
          mask-image: linear-gradient(to left, #000 calc(100% - 24px), transparent 100%);
}
.sel-dock.can-scroll-left.can-scroll-right .sel-scroll {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
          mask-image: linear-gradient(to right, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
}
.sel-dock .sel-scroll { scroll-behavior: smooth; scroll-padding: 0 8px; }
[data-animations='none'] .sel-dock .sel-scroll { scroll-behavior: auto; }

/* -- the bullet style tray ----------------------------------------------
 * v9.7 let one long footer sentence set the width, and on a 390px phone the
 * tray came out 382px wide - which is why the marks and the labels looked so
 * far apart on a phone and correct on a desktop. A real column, a fixed mark
 * gutter, and a sentence that wraps.
 */
.sel-tray-bullets { min-width: 224px; max-width: min(288px, calc(100vw - 24px)); }
.sel-tray-bullets .sel-tray-menu { min-width: 0; max-height: none; }
.sel-row-bullet { gap: 8px; }
.sel-row-mark {
  flex: none;
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; line-height: 1;
  color: var(--text-2);
}
.sel-row-label { flex: 1 1 auto; min-width: 0; }
.sel-row.is-on { color: var(--accent); background: var(--accent-soft); }
.sel-row.is-on .sel-row-mark { color: var(--accent); }
.sel-row.is-on .icon { color: var(--accent); }
.sel-tray-note {
  display: flex; align-items: flex-start; gap: 6px;
  margin-top: 4px; padding: 7px 8px 3px;
  border-top: 1px solid var(--border);
  font-size: 11px; line-height: 1.45; color: var(--text-3);
}
.sel-tray-note .icon { flex: none; margin-top: 1px; color: var(--text-3); }

/* -- a squeezed bar gives up the tail, not the buttons -------------------
 * Driven by .is-compact, which JS sets from the BAR'S OWN WIDTH rather than
 * the window's - see updateScrollHints(). The word count and the read-aloud
 * button are the two things in the tail that also live somewhere else (the
 * note's info panel, and the "..." menu), so they are what goes first.
 */
.sel-dock.is-compact .sel-stats { display: none; }
.sel-dock.is-compact .sel-btn-speak { display: none; }
@media (max-width: 620px) {
  .sel-dock .sel-bullet-caret { width: 18px; height: 38px; }
}

/* -- a two-column shell actually needs two columns -----------------------
 * The 761-900px tablet rule puts .sidebar AND .main-view in grid-column 1,
 * which is correct while the grid has one column. Two later rules - the
 * "unfolded foldable" aspect-ratio rule and the hinge rule - hand the grid
 * two columns again WITHOUT putting the main view back in the second one.
 * Any viewport matching both ends up with the sidebar and the editor stacked
 * in column one and column two left empty.
 *
 * Measured on the shipped build: a 768x1024 iPad in portrait renders the
 * editor 286px wide with 482px of dead background beside it - and identically
 * whether the sidebar is open or closed, which is the tell. 900x1200 and an
 * 884x1104 Fold in portrait do the same. A 1000x800 landscape viewport, which
 * misses the 761-900 rule, has been correct all along.
 */
@media (min-width: 600px) and (max-width: 1000px) and (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3) {
  .sidebar { grid-column: 1; }
  .main-view { grid-column: 2; }
  /*
   * The 761-900 rule pins margin-left to 0 with !important, so that the base
   * rule cannot drag its FIXED overlay off-screen. On these viewports the
   * sidebar is back in the flow instead, and closing it has to mean something
   * again - without this it stays on screen whatever the toggle says.
   */
  .app[data-sidebar='closed'] .sidebar { margin-left: calc(-1 * min(240px, 30vw)) !important; }
}
@media (horizontal-viewport-segments: 2) {
  .sidebar { grid-column: 1; }
  .main-view { grid-column: 2; }
  .app[data-sidebar='closed'] .sidebar { margin-left: -100% !important; }
}

/* -- settings: the sticky tab bar sits flush under the header ------------
 * position:sticky measures from the scrollport INSET BY THE SCROLL
 * CONTAINER'S PADDING. #settings-body carried 12px of top padding, so the
 * tab bar stuck 12px down the screen and left a transparent strip that the
 * settings rows scrolled through - visible as a line of text floating
 * between the header and the tabs. The padding moves onto the content, and
 * the shadow paints the band opaque whatever any future padding does.
 */
@media (max-width: 760px) {
  #settings-body { padding-top: 0; }
  .settings-nav { top: 0; box-shadow: 0 -14px 0 var(--bg-panel); }
  .settings-content { padding-top: var(--sp-5); }
}
'''

_BLOCKS['lists.js'] = r'''    /*
     * v9.8: THE ORDER IS THE ORDER YOU REACH FOR THEM IN.
     *
     * The strip scrolls now, so nothing is unreachable - but on a 390px phone
     * only about five buttons are on screen at a time, and which five is a
     * decision rather than an accident. The lists lead, because the bullet
     * button carries the style picker and that is the control this toolbar
     * was rebuilt around; then the headings, the quote, the character marks
     * and the link. Bold and italic have not gone anywhere - they are one
     * swipe left, and they still have their shortcuts.
     *
     * If you would rather lead with the headings, move the `heads` block
     * above the `lists` block below. Nothing else depends on the order.
     */
    const lists = group('lists');
    /*
     * THE BULLET BUTTON IS A SPLIT CONTROL, the way Word's is. The left half
     * applies the list; the arrow opens the style picker. One button doing
     * both would have to guess which you meant. Two halves never guess - and
     * it is the shape the highlighter in this same toolbar already uses.
     */
    const bulletApply = action('list', 'Bulleted list', function () { F.setBlock('- '); });
    if (N.theme && N.theme.bulletStyles && N.theme.setBulletStyle) {
      const split = el('span.sel-split');
      split.appendChild(bulletApply);
      const bCaret = el('button.sel-caret.sel-bullet-caret', {
        type: 'button', 'aria-expanded': 'false',
        title: T('fmt.bulletStyle', 'Bullet style'), 'aria-label': T('fmt.bulletStyle', 'Bullet style'),
      });
      bCaret.appendChild(N.icons.node('chevron-down', { size: 11 }));
      bCaret.addEventListener('mousedown', function (e) { e.preventDefault(); });
      bCaret.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (sub && sub.dataset.kind === 'bullets') { closeSub(); return; }
        openBulletStyles(bCaret);
      });
      split.appendChild(bCaret);
      lists.appendChild(split);
    } else {
      lists.appendChild(bulletApply);
    }
    lists.appendChild(action('list-ordered', 'Numbered list', function () { F.setBlock('number'); }));
    lists.appendChild(action('list-check', 'Task list', function () { F.setBlock('- [ ] '); }));

    const heads = group('heads');
    heads.appendChild(action('heading-1', 'Heading 1', function () { F.setBlock('# '); }));
    heads.appendChild(action('heading-2', 'Heading 2', function () { F.setBlock('## '); }));
    heads.appendChild(action('heading-3', 'Heading 3', function () { F.setBlock('### '); }));

    const quote = group('quote');
    quote.appendChild(action('quote', 'Quote', function () { F.setBlock('> '); }));

    const marks = group('marks');
    marks.appendChild(action('bold', T('fmt.bold', 'Bold'), function () { F.toggleWrap('**'); }, { accel: 'format.bold' }));
    marks.appendChild(action('italic', T('fmt.italic', 'Italic'), function () { F.toggleWrap('*'); }, { accel: 'format.italic' }));
    marks.appendChild(action('strikethrough', T('fmt.strike', 'Strikethrough'), function () { F.toggleWrap('~~'); }, { accel: 'format.strike' }));
    marks.appendChild(action('code', T('fmt.code', 'Inline code'), function () { F.toggleWrap('`'); }, { accel: 'format.code' }));

    const links = group('links');
    links.appendChild(action('link', T('fmt.link', 'Add a link'), function () { F.makeLink(); }, { keepOpen: false }));
    links.appendChild(action('eraser', T('fmt.clear', 'Clear formatting'), function () { F.clearFormatting(); }));
'''

_BLOCKS['tail.js'] = r'''    if (N.speak && N.speak.supported()) {
      tail.appendChild(action('play', T('speak.readSelection', 'Read the selection aloud'), function () {
        const s = N.format.selection();
        N.speak.start(s && s.text);
      }, { keepOpen: false, className: 'sel-btn-speak' }));
    }

    const moreBtn = el('button.sel-btn.is-more', { type: 'button', title: T('fmt.more', 'More'), 'aria-label': T('fmt.more', 'More formatting') });
'''

_BLOCKS['fit.js'] = r'''  /**
   * v9.8: NOTHING IS LIFTED OUT ANY MORE — THE STRIP SCROLLS.
   *
   * The old rule was "drop a whole group into the ... menu whenever the row
   * is too narrow". On a narrow row that means ALL of them. Measured: a 390px
   * phone showed ZERO formatting buttons, a 344px foldable zero, a 768px
   * tablet zero. Bold, the headings, the lists, the quote and the link had
   * all left the bar, and what was left was a highlighter and three menus.
   *
   * A toolbar you have to open a menu to use is not a toolbar. So the groups
   * stay where they are and the strip scrolls — which is what every other
   * narrow row of controls in this app does — and the fade at each end says
   * which way there is more to see.
   */
  function fitToWidth() {
    if (!dock || !dock._nd) return;
    overflow = [];
    dock.classList.remove('has-overflow');
    updateScrollHints();
  }

  /** Fade the end that still has something behind it, and only that end. */
  function updateScrollHints() {
    if (!dock || !dock._nd) return;
    const scroll = dock._nd.scroll;
    /*
     * v9.8: COMPACT IS ABOUT THE BAR'S OWN WIDTH, NOT THE WINDOW'S.
     *
     * A 768px tablet with both drawers pinned leaves the note's title row
     * 286px wide - narrower than a phone - while the same tablet with them
     * closed leaves it the full 768. No media query can tell those two apart,
     * because the window is identical in both; the element's own width can.
     * Measured at 768 with both drawers open, the tail alone was 221px of a
     * 286px row. Dropping the two tail items that also live elsewhere - the
     * word count, and read-aloud, which keeps its row in the "..." menu -
     * hands that room back to the buttons.
     */
    dock.classList.toggle('is-compact', dock.clientWidth < 430);
    const max = scroll.scrollWidth - scroll.clientWidth;
    const x = scroll.scrollLeft;
    dock.classList.toggle('can-scroll-left', max > 1 && x > 1);
    dock.classList.toggle('can-scroll-right', max > 1 && x < max - 1);
  }
'''

_BLOCKS['tray.js'] = r'''  /* ------------------------------------------------- the bullet style tray
   * v9.8: a Word-shaped style picker, opened by the arrow on the bullet
   * button. Two things changed from v9.7, both because using it showed the
   * first design was wrong:
   *
   *   - picking a style COMMITS AND CLOSES. The highlight swatches a few
   *     pixels away close on pick, and two pickers in one toolbar behaving
   *     differently is worse than either behaviour is good.
   *   - on a mouse, running down the list PREVIEWS each style live, so the
   *     comparing that the open tray was for still happens — it just happens
   *     without a click each time.
   *
   * Preview is an attribute on <body> and nothing else. The saved setting is
   * not touched until a row is actually clicked, so Escape, a click away, or
   * simply not choosing always puts back exactly what was there before.
   *
   * As ever: this changes how a list is DRAWN and nothing else. On disk every
   * bullet is still "- ".
   * ------------------------------------------------------------------- */

  /* Touch has no hover, so there is nothing to preview with — a tap is the
     commit. Asking the media query beats sniffing the user agent. */
  const CAN_HOVER = (function () {
    try { return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches); }
    catch (err) { return false; }
  }());

  function savedBulletStyle() {
    return (N.store && N.store.state.settings.bulletStyle) || 'disc';
  }
  function previewBulletStyle(id) {
    if (!CAN_HOVER) return;
    document.body.dataset.bulletStyle = id || savedBulletStyle();
  }
  /** Whatever was being previewed, the saved value comes back. */
  function endBulletPreview() {
    document.body.dataset.bulletStyle = savedBulletStyle();
  }

  function openBulletStyles(anchor) {
    if (!N.theme || !N.theme.bulletStyles) return;
    const tray = trayAt(anchor, 'bullets');
    const here = savedBulletStyle();
    if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');

    const list = el('div.sel-tray-menu');
    N.theme.bulletStyles().forEach(function (b) {
      const row = el('button.sel-row.sel-row-bullet', { type: 'button', dataset: { bulletId: b.id } });
      if (b.id === here) row.classList.add('is-on');
      row.appendChild(el('span.sel-row-mark', null, b.mark));
      row.appendChild(el('span.sel-row-label', null, b.label));
      if (b.id === here) row.appendChild(N.icons.node('check-small', { size: 14 }));
      row.addEventListener('mousedown', function (e) { e.preventDefault(); });
      row.addEventListener('mouseenter', function () { previewBulletStyle(b.id); });
      row.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        /* Paint first so the change is on screen before the tray leaves,
           then persist. setBulletStyle() re-applies the same value. */
        document.body.dataset.bulletStyle = b.id;
        N.theme.setBulletStyle(b.id);
        N.toast.success(b.mark + '  ' + b.label, { ms: 1500, key: 'bullet' });
        closeSub();
        refresh();
      });
      list.appendChild(row);
    });
    list.addEventListener('mouseleave', endBulletPreview);
    tray.appendChild(list);

    const note = el('div.sel-tray-note');
    note.appendChild(N.icons.node('info', { size: 13 }));
    note.appendChild(el('span', null, 'Only how bullets are drawn. On disk every bullet is still "- ".'));
    tray.appendChild(note);

    placeTray(tray);
  }

'''

_BLOCKS['closesub.js'] = r'''  function closeSub() {
    if (!sub) return;
    const node = sub;
    /* v9.8: a tray that was previewing puts the saved style back, and the
       control that opened it stops claiming to be open. */
    if (node.dataset.kind === 'bullets') {
      endBulletPreview();
      const opener = node._nd && node._nd.anchor;
      if (opener && opener.setAttribute) opener.setAttribute('aria-expanded', 'false');
    }
    sub = null;
    node.classList.remove('is-in');
    setTimeout(function () { if (node.parentNode) node.remove(); }, 160);
  }
'''

_BLOCKS['place.js'] = r'''  function placeTray(node) {
    if (!node || !node._nd) return;
    const box = node._nd.anchor.getBoundingClientRect();
    const margin = 8;
    /*
     * v9.8: an open keyboard does not change innerHeight, so a tray measured
     * against innerHeight will happily lay itself out underneath the
     * keyboard - which is where the bullet list ended up on a phone with the
     * editor focused. visualViewport is the part actually being looked at.
     */
    const vv = window.visualViewport;
    const vh = vv ? Math.max(180, Math.min(window.innerHeight, (vv.offsetTop || 0) + vv.height)) : window.innerHeight;
'''


def block(name):
    return _BLOCKS[name]


MARKER = 'v9.8: NOTHING IS LIFTED OUT ANY MORE'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    path = args[0] if args else 'index.html'

    if not os.path.exists(path):
        print('ERROR: %s not found.' % path)
        return 1

    src = io.open(path, encoding='utf-8').read()
    if MARKER in src:
        print('ERROR: v9.8 is already installed in this file.')
        return 1
    if 'function openBulletStyles(anchor)' not in src:
        print('ERROR: this file is not at v9.7 yet.')
        print('       Run add_bullet_selection_toolbar_standalone.py on it first.')
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
        """Replace everything from start_at up to (not including) end_at."""
        nonlocal s
        a = s.find(start_at)
        b = s.find(end_at)
        if a == -1 or b == -1 or b < a:
            errors.append('%s: could not find its bounds' % label)
            return False
        s = s[:a] + new + s[b:]
        log.append(label)
        return True

    def report(name, ok):
        print('   %-42s %s' % (name, 'ok' if ok else 'FAILED'))

    print('=' * 74)
    print(' Nodalis v9.8 - formatting bar, bullet picker, settings header')
    print('=' * 74)
    print(' file: %s  (%d bytes)\n' % (path, len(src)))

    # ---------------------------------------------------------------- 1. CSS
    report('stylesheet', once('\n</style>\n</head>',
                              '\n' + block('css.css') + '\n</style>\n</head>', 'stylesheet'))

    # ------------------------------------------- 2. the strip's own listeners
    report('strip scroll + wheel listeners', once(
        """    const node = el('div.sel-dock', { role: 'toolbar', 'aria-label': T('fmt.more', 'Formatting') });
    const scroll = el('div.sel-scroll');
    const tail = el('div.sel-tail');""",
        """    const node = el('div.sel-dock', { role: 'toolbar', 'aria-label': T('fmt.more', 'Formatting') });
    const scroll = el('div.sel-scroll');
    const tail = el('div.sel-tail');
    /*
     * v9.8: the strip scrolls instead of shedding its buttons, so it has to
     * say so. The fades follow the scroll position; the wheel handler is
     * there because a mouse has no sideways scroll and a desktop window with
     * both panels open is narrow enough to need one.
     */
    scroll.addEventListener('scroll', updateScrollHints, { passive: true });
    scroll.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (scroll.scrollWidth - scroll.clientWidth <= 1) return;
      e.preventDefault();
      scroll.scrollLeft += e.deltaY;
    }, { passive: false });""", 'strip listeners'))

    # ------------------------------------------------ 3. the split bullet button
    report('bar order + split bullet button', splice(
        "    const marks = group('marks');",
        "    /* ---- the pinned tail: never scrolls away ---- */",
        block('lists.js') + '\n', 'bar order + split button'))

    # -------------------- 4. drop v9.7's tail button, tag the read-aloud button
    report("retire v9.7's slider button from the tail", splice(
        """    if (N.speak && N.speak.supported()) {
      tail.appendChild(action('play', T('speak.readSelection', 'Read the selection aloud'), function () {
        const s = N.format.selection();
        N.speak.start(s && s.text);
      }, { keepOpen: false }));
    }
""",
        "    moreBtn.appendChild(N.icons.node('more', { size: 16 }));",
        block('tail.js'), 'tail rebuilt'))

    # ------------------------------------------------------- 5. fitToWidth()
    report('fitToWidth: scroll instead of shedding', splice(
        '  /** Lift groups out of the strip, lowest priority first, until it fits. */',
        '  /* ---------------------------------------------------------------- trays */',
        block('fit.js') + '\n', 'fitToWidth'))

    # --------------------------------------------------------- 6. closeSub()
    report('closeSub: restore the previewed style', once(
        """  function closeSub() {
    if (!sub) return;
    const node = sub;
    sub = null;
    node.classList.remove('is-in');
    setTimeout(function () { if (node.parentNode) node.remove(); }, 160);
  }
""", block('closesub.js'), 'closeSub'))

    # -------------------------------------------------------- 7. placeTray()
    report('placeTray: measure the visual viewport', once(
        """  function placeTray(node) {
    if (!node || !node._nd) return;
    const box = node._nd.anchor.getBoundingClientRect();
    const margin = 8;
    const vh = window.innerHeight;
""", block('place.js'), 'placeTray'))

    # ------------------------------------------------- 8. the tray itself
    report('bullet tray: commit-and-close + preview', splice(
        '  /* ------------------------------------------------- the bullet style tray',
        '  /* --------------------------------------------------------- show and hide */',
        block('tray.js'), 'bullet tray'))

    # ------------------------------------------------- 9. refresh() keeps hints
    report('refresh: keep the scroll fades honest', once(
        """    dock.querySelectorAll('.sel-swatch').forEach(function (b) {
      b.classList.toggle('is-on', (b.dataset.hl || '') === highlightColour());
    });
    if (sub) placeTray(sub);""",
        """    dock.querySelectorAll('.sel-swatch').forEach(function (b) {
      b.classList.toggle('is-on', (b.dataset.hl || '') === highlightColour());
    });
    updateScrollHints();
    if (sub) placeTray(sub);""", 'refresh'))

    # ---------------------------------------- 10. a tray cannot outlive its view
    report('close the bar when the view changes', once(
        "    N.bus.on('note:active', function () { hide(); });",
        "    /* v9.8: opening a tray and then leaving for Settings used to leave it\n"
        "       floating over the settings page. A view change takes it with it. */\n"
        "    N.bus.on('view:changed', function () { hide(true); });\n"
        "    N.bus.on('note:active', function () { hide(); });", 'hide on view change'))

    # ------------------------------- 11. bullet style leaves the settings page
    report('remove the Settings > Typography row', once(
        r"""    /*
     * v9.6. Sits with the other reading settings rather than with the theme,
     * because it is about the shape of a paragraph, not the colour of the app.
     */
    wrap.appendChild(row('Bullet style', 'How a list mark is drawn. Your files are not changed \u2014 a bullet is always "- " on disk.',
      (function () {
        const field = el('select.field');
        N.theme.bulletStyles().forEach(function (b) {
          field.appendChild(el('option', { value: b.id, selected: (s().bulletStyle || 'disc') === b.id },
            b.mark + '   ' + b.label));
        });
        field.addEventListener('change', async function () {
          await N.theme.setBulletStyle(field.value);
          render({ anchor: '#settings-typography' });
        });
        return field;
      }())));
""",
        """    /*
     * v9.8: bullet style is not a settings row any more. It is the arrow on
     * the bullet button in the formatting bar, and "Bullet style..." in any
     * note menu - both of them next to a list you can watch redraw, which a
     * settings page three taps away is not.
     */
""", 'settings row removed'))

    # ------------------------------------------------- 12. the manual matches
    report('manual: where bullet style lives now', once(
        'Settings → Typography, or "Bullet style…" in any note menu. Ten marks',
        'The arrow beside the bullet button in the formatting bar — select any '
        'text — or "Bullet style…" in any note menu. Ten marks', 'manual'))

    print('\n' + '=' * 74)
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
    print('=' * 74)
    return 0


if __name__ == '__main__':
    sys.exit(main())
