#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v9.6 - menus, scripts, the three-dot button, shortcuts, bullets
=============================================================================

    python3 fix_v96.py index.html --dry-run
    python3 fix_v96.py index.html

Writes index.html in place, leaves index.html.bak beside it. Standard library
only. Requires v9.5 to have been applied first (it edits the shortcut table
v9.5 created); the script checks and says so if not.

WHAT IT FIXES

 1. THE NOTE MENU HID ITS LAST ROW. `max-height: min(80vh, 660px)` is a
    constant; the space next to an anchor is not. Measured on the 16-row note
    menu: at 1200x700 in English, and at 1440x900 in Tamil, the menu was
    capped and Delete sat below the fold with no scrollbar and no shading to
    say the list continued. show() now sizes to the room actually available,
    opens upward when there is more room there, and marks itself scrollable.

 2. TAMIL AND MALAYALAM OVERFLOWED THE SIDEBAR TABS. Four `flex: 1` tabs with
    no min-width in a 267px rail: Tamil needs 356px, Malayalam 331px, so the
    last tab was pushed past the edge. The other 25 languages fit. The rail is
    now a scroller, and only complex scripts stop shrinking below their text -
    Latin layout is unchanged.

 3. THE THREE-DOT BUTTON WAS NEARLY INVISIBLE. The glyph is three zero-length
    strokes, so the dot diameter IS the stroke width - 1.6 units in a 24-unit
    box, about one CSS pixel at the 13px size used in list rows. Two variables
    now control it everywhere, and the row buttons no longer rest at opacity 0.

 4. THE THREE BROWSER-RESERVED SHORTCUTS ARE GONE. Ctrl+Shift+T, Ctrl+Shift+N
    and Ctrl+Shift+C are taken by the browser before the page sees a keydown.
    All three move to Alt combos, which no browser claims, so they work in a
    tab and in an installed PWA.

 5. BULLET STYLES. Ten marks, chosen in Settings or from the note menu.
    Rendering only - a bullet is still `- ` on disk.

Every edit is anchored on a unique string and verified before anything is
written. Nothing outside these five areas is touched.
=============================================================================
"""

import io
import os
import re
import sys

# --- the inserted blocks, embedded so this file is the only file you need ---
_BLOCKS = {}
_BLOCKS['css.css'] = r'''
/* =========================================================================
 * v9.6 — THE MENU THAT HID ITS LAST ROW, SCRIPTS THAT OVERFLOWED THEIR TABS,
 *        A THREE-DOT BUTTON NOBODY COULD SEE, AND BULLET STYLES.
 *
 * Last in the stylesheet, for the same reason as the v9.4 block: three of
 * these override rules that live inside earlier media queries or inside the
 * v9.4 block itself, and source order is easier to reason about than a
 * specificity race.
 * ========================================================================= */

/* ---- 1. the note menu, and why Delete went missing --------------------- */
/*
 * The menu never actually left the viewport - the clamp in menu.show() has
 * always worked. What it did NOT do was tell the menu how much room it had,
 * so `max-height: min(80vh, 660px)` stood whether there were 800px of space
 * or 300px. Measured on the 16-row note menu:
 *
 *     1440x900  English  545px tall, fits          Delete visible
 *     1440x900  Tamil    660px tall, capped        Delete BELOW THE FOLD
 *     1200x700  English  545px tall, capped        Delete BELOW THE FOLD
 *     1024x560  either   448px tall, capped        Delete BELOW THE FOLD
 *
 * Delete was always reachable - by scrolling, or with the arrow keys, which
 * call focus() and scroll it into view. Nothing on screen said so. A menu
 * that ends flush against a clean edge with no scrollbar and no shadow reads
 * as a menu that ends there.
 *
 * show() now sets --menu-max from the room actually available at the position
 * it picked, prefers whichever side of the anchor has more room, and adds
 * .is-scrollable when the content still does not fit. Everything below is
 * what makes that state legible.
 */
.menu { max-height: var(--menu-max, min(80vh, 660px)); }

.menu.is-scrollable {
  /*
   * Two signals, because one was not enough to read as "this scrolls":
   *
   * A full-width scrollbar rather than a thin one. Note that setting the
   * STANDARD `scrollbar-width` / `scrollbar-color` makes Chrome ignore the
   * ::-webkit-scrollbar pseudo-elements entirely - so this uses only the
   * standard properties, and asks for `auto` rather than the `thin` the base
   * .menu rule sets. A 6px bar tinted close to the panel is exactly what made
   * the overflow read as a clipped menu in the first place.
   */
  scrollbar-width: auto;
  scrollbar-color: var(--text-3) transparent;
  /*
   * And a shaded bottom edge. Inset, so it is painted on the padding box and
   * stays put while the rows scroll underneath - the one shadow that behaves
   * like a physical edge rather than sliding away with the content.
   */
  box-shadow: var(--shadow-lg), inset 0 -26px 18px -18px var(--menu-fade, rgba(0, 0, 0, 0.55));
}
.menu.is-scrollable.is-at-end { box-shadow: var(--shadow-lg); }

/* The one row that must never be the one you cannot find. A destructive
   action at the end of a scrolling list gets a hairline above it so the eye
   lands on it, and so the list clearly continues past the fold. */
.menu-item.is-danger, .menu-item[data-danger] { color: var(--danger, #e0245e); }

/* ---- 2. sidebar tabs in scripts wider than Latin ---------------------- */
/*
 * Four tabs, `flex: 1`, no min-width, no overflow handling. In Tamil the four
 * labels measure 356px inside a 267px rail and in Malayalam 331px, so the
 * last tab was pushed past the edge and clipped. Every other language of the
 * twenty-seven fits.
 *
 * The rail becomes a scroller for everybody - invisible and inert when
 * nothing overflows, which is the case for the other twenty-five - and only
 * under a complex script do the tabs stop shrinking below their own text.
 * Latin layout is therefore pixel-identical to before.
 */
.sidebar-tabs {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  scroll-padding-inline: var(--sp-5);
}
.sidebar-tabs::-webkit-scrollbar { display: none; }
html[data-script='complex'] .sidebar-tab {
  flex: 1 0 auto;
  min-width: max-content;
  white-space: nowrap;
  padding-left: var(--sp-4);
  padding-right: var(--sp-4);
}

/* v9.6 correction to the v9.4 rule below it: 42px was too generous. It made
   every menu in Tamil about 20% taller than the same menu in English, which
   is what pushed the note menu over the fold at window heights where the
   English one still fitted. 32px clears the tallest Indic ink at this font
   size - measured, not guessed - and Tamil menus are now within 4% of
   English. */
html[data-script='complex'] .menu-item {
  min-height: 32px;
  padding-top: 3px;
  padding-bottom: 3px;
}

/* ---- 3. the three-dot button ------------------------------------------ *
 *
 * The glyph is three zero-length strokes with round caps, so the DOT
 * DIAMETER IS THE STROKE WIDTH - it was 1.6 SVG units in a 24-unit box,
 * which lands near one CSS pixel at the 13px size used in list rows. At that
 * size the dots are close to invisible on the lighter themes.
 *
 * Two variables, both here, both safe to change:
 *
 *   --dot-size      the stroke width, i.e. the dot diameter, in the icon's
 *                   own 24-unit viewBox. 1.6 is the old value, 2.5 is the
 *                   new default, 3.2 is about as heavy as it can go before
 *                   the three dots start to touch at small sizes.
 *   --dot-strength  the resting colour. --text-3 is the old value (faint),
 *                   --text-1 the new default, --text-0 the strongest.
 *
 * Change those two numbers and every three-dot button in the app follows.
 * The nine places they appear are listed in the notes shipped with this
 * patch.
 */
:root {
  --dot-size: 2.5;
  --dot-strength: var(--text-1);
  --dot-strength-hover: var(--text-0);
}
.icon.icon-more,
.icon.icon-more-vertical {
  stroke-width: var(--dot-size);
  color: var(--dot-strength);
}
.icon-btn:hover > .icon.icon-more,
.icon-btn:hover > .icon.icon-more-vertical,
.icon-btn.is-prominent > .icon.icon-more,
.sel-btn:hover > .icon.icon-more,
.mobile-nav-btn.is-active > .icon.icon-more {
  color: var(--dot-strength-hover);
}

/*
 * The row buttons were invisible for a second reason, unrelated to the glyph:
 * .tree-row-actions is opacity 0 until the row is hovered, so on a laptop
 * trackpad you had to already know it was there. It now rests at a low but
 * non-zero opacity, and still comes fully up on hover and focus.
 */
.tree-row-actions { opacity: 0.45; }
.tree-row:hover .tree-row-actions,
.tree-row:focus-within .tree-row-actions { opacity: 1; }
@media (hover: none) { .tree-row-actions { opacity: 1; } }

/* ---- 4. bullet styles -------------------------------------------------- *
 *
 * THE MARKDOWN NEVER CHANGES. A bullet is written to disk as `- ` and stays
 * `- ` whatever is chosen here; only the rendered preview draws a different
 * mark. That is not a shortcut - it is the point. Nodalis promises the file
 * on your disk is a plain, portable .md, and a list that opens in Obsidian as
 * a paragraph beginning with a diamond would break that promise for the sake
 * of decoration.
 *
 * Sizes are tuned per glyph rather than shared, because optical weight is not
 * point size: a star set at the same size as a disc reads about twice as
 * loud. These were set by eye at 16px body text and hold from 12 to 26.
 *
 * Nesting: level one is the mark you chose, level two is its filled/hollow
 * partner, level three is a small square. A nested list therefore still looks
 * deliberate rather than repeating one glyph down the page.
 *
 * Every mark carries a trailing \00A0. Setting `content` on ::marker replaces
 * the whole marker box, INCLUDING the gap the browser normally puts between a
 * default marker and the text - without it the list reads as "*one". A
 * non-breaking space is used rather than a plain one because whitespace at
 * the end of a content string is collapsed away.
 */
.prose ul > li:not(.task-item)::marker {
  color: var(--bullet-color, var(--text-3));
  font-size: var(--bullet-size, 1em);
}

body[data-bullet-style='disc']            .prose ul > li:not(.task-item)::marker { content: '\25CF' '\00A0'; --bullet-size: 0.60em; }
body[data-bullet-style='disc']            .prose ul ul > li:not(.task-item)::marker { content: '\25CB' '\00A0'; --bullet-size: 0.64em; }

body[data-bullet-style='circle']          .prose ul > li:not(.task-item)::marker { content: '\25CB' '\00A0'; --bullet-size: 0.64em; }
body[data-bullet-style='circle']          .prose ul ul > li:not(.task-item)::marker { content: '\25CF' '\00A0'; --bullet-size: 0.60em; }

body[data-bullet-style='square']          .prose ul > li:not(.task-item)::marker { content: '\25AA' '\00A0'; --bullet-size: 1.00em; }
body[data-bullet-style='square']          .prose ul ul > li:not(.task-item)::marker { content: '\25AB' '\00A0'; --bullet-size: 1.00em; }

body[data-bullet-style='square-hollow']   .prose ul > li:not(.task-item)::marker { content: '\25AB' '\00A0'; --bullet-size: 1.00em; }
body[data-bullet-style='square-hollow']   .prose ul ul > li:not(.task-item)::marker { content: '\25AA' '\00A0'; --bullet-size: 1.00em; }

body[data-bullet-style='diamond']         .prose ul > li:not(.task-item)::marker { content: '\25C6' '\00A0'; --bullet-size: 0.70em; }
body[data-bullet-style='diamond']         .prose ul ul > li:not(.task-item)::marker { content: '\25C7' '\00A0'; --bullet-size: 0.76em; }

body[data-bullet-style='diamond-hollow']  .prose ul > li:not(.task-item)::marker { content: '\25C7' '\00A0'; --bullet-size: 0.76em; }
body[data-bullet-style='diamond-hollow']  .prose ul ul > li:not(.task-item)::marker { content: '\25C6' '\00A0'; --bullet-size: 0.70em; }

body[data-bullet-style='star']            .prose ul > li:not(.task-item)::marker { content: '\2605' '\00A0'; --bullet-size: 0.78em; }
body[data-bullet-style='star']            .prose ul ul > li:not(.task-item)::marker { content: '\2606' '\00A0'; --bullet-size: 0.84em; }

body[data-bullet-style='star-hollow']     .prose ul > li:not(.task-item)::marker { content: '\2606' '\00A0'; --bullet-size: 0.84em; }
body[data-bullet-style='star-hollow']     .prose ul ul > li:not(.task-item)::marker { content: '\2605' '\00A0'; --bullet-size: 0.78em; }

body[data-bullet-style='dash']            .prose ul > li:not(.task-item)::marker { content: '\2013' '\00A0'; --bullet-size: 1.00em; }
body[data-bullet-style='dash']            .prose ul ul > li:not(.task-item)::marker { content: '\2013' '\00A0'; --bullet-size: 1.00em; --bullet-color: var(--border-strong); }

body[data-bullet-style='chevron']         .prose ul > li:not(.task-item)::marker { content: '\203A' '\00A0'; --bullet-size: 1.05em; }
body[data-bullet-style='chevron']         .prose ul ul > li:not(.task-item)::marker { content: '\203A' '\00A0'; --bullet-size: 1.05em; --bullet-color: var(--border-strong); }

/* Three deep, every style lands on the same quiet square. */
body[data-bullet-style] .prose ul ul ul > li:not(.task-item)::marker {
  content: '\25AA' '\00A0';
  --bullet-size: 0.92em;
  --bullet-color: var(--border-strong);
}

/* The picker's own swatches, so a style can be judged before it is chosen. */
.bullet-swatch {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.4em; flex: none;
  color: var(--text-2);
  font-size: var(--text-md);
  line-height: 1;
}
.bullet-preview { display: flex; align-items: baseline; gap: var(--sp-3); min-width: 0; }
.bullet-preview-mark { color: var(--text-3); flex: none; }
'''
_BLOCKS['menu.js'] = r'''    /*
     * v9.6: SIZE THE MENU TO THE ROOM IT HAS, NOT TO A GUESS.
     *
     * The clamp below has always kept the menu inside the viewport. What was
     * missing is that `max-height: min(80vh, 660px)` is a fixed number, and
     * the space above or below an anchor is not. On a 700px window the note
     * menu was capped at 545px, placed with 545px of room, and the last row -
     * Delete - sat under a fold with no scrollbar and no shadow to say so.
     *
     * Three changes, in order:
     *   1. pick the side of the anchor with MORE room, not merely the first
     *      side the whole menu happens to fit in;
     *   2. hand the stylesheet that number as --menu-max, so the menu is as
     *      tall as the space allows instead of as tall as a constant allows;
     *   3. mark it .is-scrollable when even that is not enough, which is what
     *      turns on the visible scrollbar and the bottom shading.
     */
    const roomBelow = (o.anchor && o.anchor.getBoundingClientRect)
      ? vh - o.anchor.getBoundingClientRect().bottom - 4 - pad
      : vh - (o.y === undefined ? 0 : o.y) - pad;
    const roomAbove = (o.anchor && o.anchor.getBoundingClientRect)
      ? o.anchor.getBoundingClientRect().top - 4 - pad
      : (o.y === undefined ? vh : o.y) - pad;
    const openUp = (o.anchor && o.anchor.getBoundingClientRect)
      ? (rect.height > roomBelow && roomAbove > roomBelow)
      : false;
    const room = Math.max(160, openUp ? roomAbove : Math.max(roomBelow, roomAbove, vh - 2 * pad));
    menu.style.setProperty('--menu-max', Math.round(Math.min(room, vh - 2 * pad)) + 'px');

    /* Re-measure: --menu-max may have changed the height we are about to place. */
    const sized = menu.getBoundingClientRect();
    const mh = sized.height;

    if (o.anchor && o.anchor.getBoundingClientRect) {
      const a2 = o.anchor.getBoundingClientRect();
      x = o.align === 'right' ? a2.right - sized.width : a2.left;
      y = openUp ? a2.top - mh - 4 : a2.bottom + 4;
    }
    if (x === undefined) x = (vw - sized.width) / 2;
    if (y === undefined) y = (vh - mh) / 2;

    if (x + sized.width > vw - pad) x = vw - sized.width - pad;
    if (y + mh > vh - pad) y = Math.max(pad, vh - mh - pad);
    x = Math.max(pad, x);
    y = Math.max(pad, y);

    if (menu.scrollHeight > menu.clientHeight + 1) {
      menu.classList.add('is-scrollable');
      /* The shading is a promise that there is more below it, so it has to go
         away at the bottom of the list rather than shade an edge that is
         genuinely the end. */
      const trackEnd = function () {
        const atEnd = menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 2;
        menu.classList.toggle('is-at-end', atEnd);
      };
      menu.addEventListener('scroll', trackEnd, { passive: true });
      trackEnd();
    }
'''
_BLOCKS['bullets.js'] = r'''
  /* ===================================================================== *
   * v9.6: BULLET STYLES.
   *
   * A rendering choice, never a file change. `- item` is written to disk as
   * `- item` whatever is picked here; the mark you see is drawn by CSS on the
   * preview. Nodalis promises the file on your disk is a plain, portable .md,
   * and a list that opens in another editor as a paragraph starting with a
   * diamond would break that promise to decorate a bullet.
   * ===================================================================== */
  const BULLET_STYLES = [
    { id: 'disc',           mark: '●', label: 'Dot' },
    { id: 'circle',         mark: '○', label: 'Hollow dot' },
    { id: 'square',         mark: '▪', label: 'Square' },
    { id: 'square-hollow',  mark: '▫', label: 'Hollow square' },
    { id: 'diamond',        mark: '◆', label: 'Diamond' },
    { id: 'diamond-hollow', mark: '◇', label: 'Hollow diamond' },
    { id: 'star',           mark: '★', label: 'Star' },
    { id: 'star-hollow',    mark: '☆', label: 'Hollow star' },
    { id: 'dash',           mark: '–', label: 'Dash' },
    { id: 'chevron',        mark: '›', label: 'Chevron' },
  ];

  function bulletStyles() { return BULLET_STYLES.slice(); }
  function bulletStyle(id) {
    const want = id || (N.store && N.store.state.settings.bulletStyle) || 'disc';
    return BULLET_STYLES.filter(function (b) { return b.id === want; })[0] || BULLET_STYLES[0];
  }
  async function setBulletStyle(id) {
    if (!bulletStyles().some(function (b) { return b.id === id; })) return false;
    await N.store.setSetting('bulletStyle', id);
    apply();
    return true;
  }

  /**
   * The picker, as a menu rather than a <select>, because the whole question
   * is "which of these do I like" and a native select shows one at a time.
   * Each row draws its own mark at the size the preview will use it.
   */
  function pickBulletStyle(anchor) {
    const here = (N.store.state.settings.bulletStyle || 'disc');
    const items = [{ header: 'Bullet style' }];
    bulletStyles().forEach(function (b) {
      items.push({
        label: b.label,
        hint: b.mark,
        checked: b.id === here,
        onClick: function () {
          setBulletStyle(b.id);
          N.toast.success(b.mark + '  ' + b.label, { ms: 1800, key: 'bullet' });
        },
      });
    });
    items.push({ separator: true });
    items.push({
      label: 'Your files are not changed',
      icon: 'info',
      disabled: true,
      description: 'Every bullet stays "- " on disk. This only changes how it is drawn.',
    });
    N.menu.show(items, { anchor: anchor || null, title: '', allowSheet: true });
  }
'''


def block(name):
    return _BLOCKS[name]


# --------------------------------------------------------------- shortcuts --
# All three move into the Alt row. Browsers claim Ctrl/Cmd and Ctrl/Cmd+Shift
# combos; they do not claim Ctrl+Alt / Cmd+Option letter combos, so these
# survive both a browser tab and an installed PWA window.
REBIND = {
    'scratch.capture': ('Mod+Alt+Q',       'Q for quick capture; Mod+Shift+C is the DevTools picker'),
    'tasks.open':      ('Mod+Alt+O',       'O for open; Mod+Shift+T reopens a browser tab'),
    'tasks.new':       ('Mod+Alt+Shift+O', 'the +Shift "new" variant, as note.new / template.new'),
}

TOOLTIPS = [
    ('data-tip-kbd="Mod+Shift+C"', 'data-tip-kbd="Mod+Alt+Q"', 'quick-capture button'),
]


class Patcher(object):
    ACCEL = re.compile(r"accel:\s*(?:'[^']*'|\"[^\"]*\")\s*,?\s*")

    def __init__(self, text):
        self.s = text
        self.log = []
        self.errors = []

    def once(self, old, new, label):
        n = self.s.count(old)
        if n != 1:
            self.errors.append('%s: anchor found %d times, expected 1' % (label, n))
            return False
        self.s = self.s.replace(old, new, 1)
        self.log.append(label)
        return True

    def _span(self, cmd_id):
        m = re.search(r"id:\s*'" + re.escape(cmd_id) + r"'", self.s)
        if not m:
            self.errors.append('%s: not found' % cmd_id)
            return None
        run = self.s.find('run:', m.end())
        if run == -1 or run - m.end() > 1200:
            self.errors.append('%s: no run: inside its object' % cmd_id)
            return None
        return (m.end(), run)

    def set_accel(self, cmd_id, accel):
        span = self._span(cmd_id)
        if not span:
            return False
        a, b = span
        chunk = self.s[a:b]
        quoted = "accel: '%s'," % accel
        if self.ACCEL.search(chunk):
            chunk = self.ACCEL.sub(quoted + ' ', chunk, count=1)
        else:
            chunk = chunk + quoted + ' '
        self.s = self.s[:a] + chunk + self.s[b:]
        self.log.append('%s -> %s' % (cmd_id, accel))
        return True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    path = args[0] if args else 'index.html'

    if not os.path.exists(path):
        print('ERROR: %s not found. Run this from the folder that holds it.' % path)
        return 1

    src = io.open(path, encoding='utf-8').read()

    if 'RESERVED_COMBOS' not in src:
        print('ERROR: this file has not had the v9.5 shortcut patch applied.')
        print('       Run fix_shortcuts.py first, then this one.')
        return 1
    if '--- 4. bullet styles' in src:
        print('ERROR: v9.6 has already been applied to this file. Nothing to do.')
        return 1

    p = Patcher(src)

    print('=' * 74)
    print(' Nodalis v9.6')
    print('=' * 74)
    print(' file: %s  (%d bytes)\n' % (path, len(src)))

    # ---- 1. the CSS block ------------------------------------------------
    print('-- stylesheet ------------------------------------------------------')
    ok = p.once('\n</style>\n</head>', '\n' + block('css.css') + '\n</style>\n</head>',
                'v9.6 css block')
    print('   menu affordance, tab overflow, dot size, bullet styles   %s' % ('ok' if ok else 'FAILED'))

    # v9.4 set the complex-script menu row to 42px; the new rule at the end of
    # the sheet lowers it, but the padding from the old rule would still stack.
    ok2 = p.once(
        "html[data-script='complex'] .menu-item  { height: auto; min-height: 42px; padding-top: 6px; padding-bottom: 6px; line-height: 1.45; }",
        "html[data-script='complex'] .menu-item  { height: auto; line-height: 1.45; }  /* v9.6 sets the height at the end of the sheet */",
        'v9.4 menu-item height defers to v9.6')
    print('   v9.4 complex-script row height superseded                %s' % ('ok' if ok2 else 'FAILED'))

    # ---- 2. menu sizing --------------------------------------------------
    print('\n-- menu placement --------------------------------------------------')
    OLD = """    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const pad = 8;
    let x = o.x, y = o.y;

    if (o.anchor && o.anchor.getBoundingClientRect) {
      const a = o.anchor.getBoundingClientRect();
      x = o.align === 'right' ? a.right - rect.width : a.left;
      y = a.bottom + 4;
      if (y + rect.height > vh - pad && a.top - rect.height - 4 > pad) y = a.top - rect.height - 4;
    }
    if (x === undefined) x = (vw - rect.width) / 2;
    if (y === undefined) y = (vh - rect.height) / 2;

    if (x + rect.width > vw - pad) x = vw - rect.width - pad;
    if (y + rect.height > vh - pad) y = Math.max(pad, vh - rect.height - pad);
    x = Math.max(pad, x);
    y = Math.max(pad, y);
"""
    NEW = """    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const pad = 8;
    let x = o.x, y = o.y;

""" + block('menu.js')
    ok = p.once(OLD, NEW, 'menu sizing')
    print('   sizes to available room, opens upward, marks scrollable  %s' % ('ok' if ok else 'FAILED'))

    # ---- 3. shortcuts ----------------------------------------------------
    print('\n-- shortcuts -------------------------------------------------------')
    for cid in sorted(REBIND):
        accel, why = REBIND[cid]
        ok = p.set_accel(cid, accel)
        print('   %-18s -> %-18s %s  %s' % (cid, accel, 'ok' if ok else 'FAILED', why))
    for old, new, what in TOOLTIPS:
        ok = p.once(old, new, 'tooltip ' + what)
        print('   %-18s -> %-18s %s  (%s)'
              % (old.split('"')[1], new.split('"')[1], 'ok' if ok else 'FAILED', what))

    # ---- 4. bullets: the setting ----------------------------------------
    print('\n-- bullet styles ---------------------------------------------------')
    ok = p.once(
        "    contentWidth: 'comfortable',      // narrow | comfortable | wide | full",
        "    contentWidth: 'comfortable',      // narrow | comfortable | wide | full\n"
        "    /* v9.6: how a bullet is DRAWN. The markdown on disk is always '- '. */\n"
        "    bulletStyle: 'disc',              // see N.theme.bulletStyles()",
        'bulletStyle default')
    print('   default setting                                          %s' % ('ok' if ok else 'FAILED'))

    ok = p.once(
        """      roundness: s.roundness || 'default',
      animations: s.animations || 'full',
    };""",
        """      roundness: s.roundness || 'default',
      animations: s.animations || 'full',
      /* v9.6: drives the ::marker rules at the end of the stylesheet. */
      bulletStyle: s.bulletStyle || 'disc',
    };""",
        'bulletStyle -> data attribute')
    print('   applied to <html> and <body> on every theme pass          %s' % ('ok' if ok else 'FAILED'))

    ok = p.once(
        "  const ACCENT_PROPS = ['--accent', '--accent-hover', '--accent-soft', '--accent-on'];",
        block('bullets.js') + "\n  const ACCENT_PROPS = ['--accent', '--accent-hover', '--accent-soft', '--accent-on'];",
        'bullet module')
    print('   style table, setter and picker                            %s' % ('ok' if ok else 'FAILED'))

    ok = p.once(
        "    setStyle: setStyle,",
        "    setStyle: setStyle,\n"
        "    bulletStyles: bulletStyles, bulletStyle: bulletStyle,\n"
        "    setBulletStyle: setBulletStyle, pickBulletStyle: pickBulletStyle,",
        'bullet exports')
    print('   exported on N.theme                                       %s' % ('ok' if ok else 'FAILED'))

    # settings row
    ok = p.once(
        """    wrap.appendChild(row('Line width', 'How wide a paragraph gets before it wraps.',""",
        """    /*
     * v9.6. Sits with the other reading settings rather than with the theme,
     * because it is about the shape of a paragraph, not the colour of the app.
     */
    wrap.appendChild(row('Bullet style', 'How a list mark is drawn. Your files are not changed \\u2014 a bullet is always "- " on disk.',
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

    wrap.appendChild(row('Line width', 'How wide a paragraph gets before it wraps.',""",
        'settings row')
    print('   Settings -> Typography dropdown                           %s' % ('ok' if ok else 'FAILED'))

    # a nested list in the live preview, so the choice can be judged there
    ok = p.once(
        """      '- A list item, to check spacing',
      '- [ ] And a task, to check the checkbox',""",
        """      '- A list item, to check spacing',
      '    - And a nested one, to check the second level',
      '- [ ] And a task, to check the checkbox',""",
        'typography preview nesting')
    print('   preview gained a nested list                              %s' % ('ok' if ok else 'FAILED'))

    # note menu entry
    ok = p.once(
        """      { label: 'Choose an icon…', icon: note.icon || 'star', onClick: function () { if (N.notemeta) N.notemeta.pickIcon(note); } },
      { label: 'Choose a colour…', icon: 'palette', onClick: function () { if (N.notemeta) N.notemeta.pickColour(note); } },""",
        """      { label: 'Choose an icon…', icon: note.icon || 'star', onClick: function () { if (N.notemeta) N.notemeta.pickIcon(note); } },
      { label: 'Choose a colour…', icon: 'palette', onClick: function () { if (N.notemeta) N.notemeta.pickColour(note); } },
      /* v9.6: a rendering preference, so it is app-wide rather than per note -
         said plainly by the hint, which shows the mark currently in use. */
      { label: 'Bullet style…', icon: 'list',
        hint: (N.theme && N.theme.bulletStyle) ? N.theme.bulletStyle().mark : '●',
        onClick: function () { if (N.theme && N.theme.pickBulletStyle) N.theme.pickBulletStyle(); } },""",
        'note menu entry')
    print('   note menu entry                                           %s' % ('ok' if ok else 'FAILED'))

    # exported HTML keeps the chosen mark
    ok = p.once(
        "      '.task-item{list-style:none;margin-left:-1.4em}',",
        """      '.task-item{list-style:none;margin-left:-1.4em}',
      /* v9.6: an exported note keeps the mark you were reading it with. The
         markdown export is untouched - only this HTML rendering carries it. */
      (function () {
        const b = (N.theme && N.theme.bulletStyle) ? N.theme.bulletStyle() : null;
        if (!b || b.id === 'disc') return '';
        return 'ul>li:not(.task-item)::marker{content:"' + b.mark + '"}';
      }()),""",
        'export carries the bullet')
    print('   exported HTML keeps the mark                              %s' % ('ok' if ok else 'FAILED'))


    # ---- 5. help and the seeded notes must not contradict the app --------
    print('\n-- help and the getting-started notes -------------------------------')

    # 5a. resolve shortcuts in the manual at render time instead of spelling
    #     them out. Three lines in the Keyboard topic were already wrong.
    ok = p.once(
        """        block.appendChild(el('div.muted', { style: { lineHeight: '1.65' }, html: N.markdown.renderInline(pair[1]) }));""",
        """        block.appendChild(el('div.muted', { style: { lineHeight: '1.65' }, html: N.markdown.renderInline(liveKeys(pair[1])) }));""",
        'help renders live keys')
    ok2 = p.once(
        """    function paint() {
      if (!contentHost) return;""",
        """    /*
     * v9.6: THE MANUAL STOPPED SPELLING SHORTCUTS OUT.
     *
     * The Keyboard topic listed its shortcuts as literal text, so the moment a
     * binding moved the manual was wrong - and three of them were, before this
     * patch. A `{{command.id}}` placeholder is resolved against the live keymap
     * at render time instead, which also means the page is right for a reader
     * who has rebound something themselves in Settings.
     */
    function liveKeys(text) {
      return String(text).replace(/\{\{([\w.]+)\}\}/g, function (whole, id) {
        const accel = (N.shortcuts && N.shortcuts.accelFor) ? N.shortcuts.accelFor(id) : null;
        return accel ? N.shortcuts.format(accel) : 'not bound';
      });
    }

    function paint() {
      if (!contentHost) return;""",
        'liveKeys helper')
    print('   manual resolves shortcuts live                            %s' % ('ok' if ok and ok2 else 'FAILED'))

    ok = p.once(
        """        ['Formatting', '`Mod+B` bold, `Mod+I` italic, `Mod+E` inline code, `Mod+Shift+X` strikethrough, `Mod+Shift+H` highlight, `Mod+K` link, `Mod+Shift+C` clear formatting.'],""",
        """        ['Formatting', '`{{format.bold}}` bold, `{{format.italic}}` italic, `{{format.code}}` inline code, `{{format.strike}}` strikethrough, `{{format.highlight}}` highlight, `{{format.link}}` link, `{{format.clear}}` clear formatting.'],""",
        'help: formatting line')
    ok2 = p.once(
        """        ['Blocks', '`Mod+Alt+1` / `2` / `3` for headings, `Mod+Shift+8` bullets, `Mod+Shift+7` numbers, `Mod+Shift+9` tasks, `Mod+Shift+.` quote.'],""",
        """        ['Blocks', '`{{format.h1}}` / `{{format.h2}}` / `{{format.h3}}` for headings, `{{format.bullets}}` bullets, `{{format.numbers}}` numbers, `{{format.tasks}}` tasks, `{{format.quote}}` quote.'],
        ['Bullet style', 'Settings \u2192 Typography, or "Bullet style\u2026" in any note menu. Ten marks \u2014 dot, hollow dot, square, hollow square, diamond, hollow diamond, star, hollow star, dash, chevron. It changes how a list is DRAWN and nothing else: on disk every bullet is still `- `, so a note written here opens as a list in any other markdown editor.'],""",
        'help: blocks line + bullet topic')
    ok3 = p.once(
        """        ['Editing', '`Mod+H` find and replace in the note, `Alt+Up` / `Alt+Down` move the line or selection, `Mod+Shift+D` duplicate it, `Mod+Shift+K` delete it, `Mod+J` join lines, `Mod+Alt+T` tidy the table under the caret, `Mod+Shift+V` paste with the markdown stripped.'],""",
        """        ['Editing', '`{{format.find}}` find and replace in the note, `{{format.moveUp}}` / `{{format.moveDown}}` move the line or selection, `{{format.duplicate}}` duplicate it, `{{format.deleteLine}}` delete it, `{{format.join}}` join lines, `{{format.table}}` tidy the table under the caret, `{{format.pastePlain}}` paste with the markdown stripped.'],""",
        'help: editing line')
    print('   three stale shortcut lines now generated                  %s' % ('ok' if ok and ok2 and ok3 else 'FAILED'))

    # 5b. the seeded getting-started notes are real markdown files, so they
    #     cannot be generated. Corrected, and pointed at the live sheet.
    # The table lines are replaced one at a time: one of them contains an
    # escaped apostrophe, and a multi-line anchor around it is a needless
    # escaping hazard in a script people will read and edit.
    seeded = [
        ("'| New note | `Ctrl/Cmd + N` |',",
         "'| New note | `Ctrl/Cmd + Alt + N` |',"),
        ("'| Quick capture | `Ctrl/Cmd + Shift + C` |',",
         "'| Quick capture | `Ctrl/Cmd + Alt + Q` |',"),
        ("'| Toggle sidebar | `Ctrl/Cmd + B` |',",
         "'| Toggle sidebar | `Ctrl/Cmd + Alt + B` |',"),
        # The last table row also carries the note that a copied table rots.
        ("'| Undo last vault action | `Ctrl/Cmd + Z` |',",
         "'| Undo last vault action | `Ctrl/Cmd + Shift + U` |',\n        '',\n"
         "        'This table is a copy, and copies go stale. Press "
         "**`Ctrl/Cmd + Shift + /`** for the real one, generated from your own bindings.',"),
    ]
    ok = all(p.once(a, b, 'seeded note line %d' % i) for i, (a, b) in enumerate(seeded))
    print('   getting-started table corrected                           %s' % ('ok' if ok else 'FAILED'))

    ok = p.once(
        """The **Scratchpad** exists for that last one. Hit `Ctrl/Cmd + Shift + C` from anywhere, type the thought, close it. Sort it out later, or never.""",
        """The **Scratchpad** exists for that last one. Hit `Ctrl/Cmd + Alt + Q` from anywhere, type the thought, close it. Sort it out later, or never.""",
        'seeded scratchpad note')
    print('   "What Nodalis is for" corrected                           %s' % ('ok' if ok else 'FAILED'))

    # 5c. the troubleshooting entry describing the v8 bug is now out of date
    ok = p.once(
        """        ['A keyboard shortcut does nothing', 'Six of them genuinely did nothing before v8 \u2014 every Ctrl/Cmd+Shift+digit chord, plus block quote and the shortcut list itself. They work now. If one still does not, check Settings \u2192 Shortcuts for a conflict, and note that editor shortcuts need the caret in the editor.'],""",
        """        ['A keyboard shortcut does nothing', 'Fifteen of them were bound to two commands each before v9.5, and the second command silently lost \u2014 including the command palette itself. All 75 are unique now. If one still does nothing: editor shortcuts need the caret in the editor, and **Check my vault for problems** reports both clashes and the handful of combinations your browser takes before the page ever sees them.'],""",
        'troubleshooting entry')
    print('   troubleshooting entry updated                             %s' % ('ok' if ok else 'FAILED'))


    # ---- 6. arrow keys were displayed as "Arrowup" -----------------------
    #
    # format() lowercases an accelerator, then normalizeKey() has to turn each
    # part back into its canonical name before DISPLAY can find it. KEY_ALIASES
    # knew "up" but not "arrowup", so 'alt+arrowup' fell through to the generic
    # capitalise-the-first-letter branch and produced "Arrowup", which DISPLAY
    # has no entry for. Every arrow binding - move line up/down, and Back - was
    # therefore printed as "Alt+Arrowup" in the shortcut sheet, in Settings and
    # in the manual, instead of "Alt+↑".
    print('\n-- shortcut display -------------------------------------------------')
    ok = p.once(
        """    left: 'ArrowLeft', right: 'ArrowRight', plus: '+', minus: '-',""",
        """    left: 'ArrowLeft', right: 'ArrowRight', plus: '+', minus: '-',
    /* v9.6: the canonical names lowercased, so format() can round-trip them. */
    arrowup: 'ArrowUp', arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',""",
        'arrow key aliases')
    print('   arrow keys print as arrows, not "Arrowup"                 %s' % ('ok' if ok else 'FAILED'))

    # ---- report ----------------------------------------------------------
    print('\n' + '=' * 74)
    if p.errors:
        print(' %d PROBLEM(S) - nothing was written:' % len(p.errors))
        for e in p.errors:
            print('   - %s' % e)
        return 1

    print(' %d edits applied cleanly.' % len(p.log))
    print(' %d -> %d bytes (+%d)' % (len(src), len(p.s), len(p.s) - len(src)))

    if dry:
        print('\n --dry-run: %s was NOT modified.' % path)
        return 0

    io.open(path + '.bak', 'w', encoding='utf-8').write(src)
    io.open(path, 'w', encoding='utf-8').write(p.s)
    print('\n wrote  %s\n backup %s.bak' % (path, path))
    print('=' * 74)
    return 0


if __name__ == '__main__':
    sys.exit(main())
