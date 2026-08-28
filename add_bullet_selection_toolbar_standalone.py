#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v9.7 - bullet style, right in the selection toolbar
=============================================================================

    python3 add_bullet_selection_toolbar_standalone.py index.html --dry-run
    python3 add_bullet_selection_toolbar_standalone.py index.html

Run this on top of a v9.6 (or later) index.html - the file already needs
N.theme.bulletStyles() / N.theme.setBulletStyle() from the v9.6 patch. It only
touches the selection toolbar module (features/selection.js in the source
comments), so it applies cleanly whether or not the optional v9.6-L loading
screen patch was also applied.

WHAT IT DOES

 Highlight some text and a new button appears in the toolbar's pinned tail,
 next to the highlighter: "Bullet style" (the sliders icon). Click it and a
 tray drops down listing all ten bullet styles - Dot, Hollow dot, Square,
 Hollow square, Diamond, Hollow diamond, Star, Hollow star, Dash, Chevron -
 each row showing its own mark.

 Unlike every other row in this toolbar, PICKING ONE DOES NOT CLOSE THE TRAY.
 Click Star, glance at the note to see every bullet redraw as a star, click
 Diamond, glance again, and so on - the tray just re-checks the row you
 picked and stays put, so you can flip through all ten before deciding. It
 closes when you click its own trigger button again, click anywhere outside
 it, or press Escape - the same three ways every other tray in this toolbar
 already closes.

 This sets the exact same app-wide setting as Settings > Typography and the
 note "..." menu's existing bullet picker (added in v9.6) - it is a second,
 faster way to reach the same choice while you're already looking at your
 text, not a separate per-note or per-selection style. And per that same
 v9.6 rule: nothing here ever touches what's on disk. A list item is written
 to the file as "- item" no matter which style is showing; only the CSS mark
 changes.

 Requires the v9.6 base (N.theme.bulletStyles / N.theme.setBulletStyle and
 the ten body[data-bullet-style] CSS rules). If those aren't present yet,
 run fix_v96_standalone.py first.
=============================================================================
"""

import io
import os
import sys

# --- the inserted blocks, embedded so this file is the only file you need ---
_BLOCKS = {}

_BLOCKS['trigger.js'] = r'''
    /* v9.7: bullet style, right here where the selection is - opens a tray
       that stays open across picks so every style can be compared live
       against the highlighted text before it is dismissed. */
    if (N.theme && N.theme.bulletStyles && N.theme.setBulletStyle) {
      const bulletBtn = el('button.sel-btn.is-bullets', {
        type: 'button', title: T('fmt.bulletStyle', 'Bullet style'), 'aria-label': T('fmt.bulletStyle', 'Bullet style'),
      });
      bulletBtn.appendChild(N.icons.node('sliders', { size: 16 }));
      bulletBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      bulletBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (sub && sub.dataset.kind === 'bullets') { closeSub(); return; }
        openBulletStyles(bulletBtn);
      });
      tail.appendChild(bulletBtn);
    }
'''

_BLOCKS['tray.js'] = r'''
  /* ------------------------------------------------- the bullet style tray
   * v9.7: unlike every other row in this file, picking one of these does NOT
   * close the tray. The whole point is to browse - click Star, look at the
   * selection, click Diamond, look again - so on pick the tray is only
   * rebuilt (to move the checkmark to the new style) and left open, until
   * the trigger is clicked again, the tray is clicked outside of, or Escape
   * is pressed - same as every other tray here.
   *
   * Nothing here ever touches the note text: setBulletStyle() sets the same
   * app-wide rendering setting as Settings > Typography, so every list
   * everywhere - not just this selection - redraws together. The file on
   * disk still reads "- item" no matter which style is showing.
   * ------------------------------------------------------------------- */
  function buildBulletList() {
    const list = el('div.sel-tray-menu');
    if (!N.theme || !N.theme.bulletStyles) return list;
    const here = (N.store.state.settings.bulletStyle || 'disc');
    N.theme.bulletStyles().forEach(function (b) {
      const row = el('button.sel-row', { type: 'button', dataset: { bulletId: b.id } });
      if (b.id === here) row.classList.add('is-on');
      row.appendChild(el('span.sel-row-mark', null, b.mark));
      row.appendChild(el('span.sel-row-label', null, b.label));
      if (b.id === here) row.appendChild(N.icons.node('check-small', { size: 14 }));
      row.addEventListener('mousedown', function (e) { e.preventDefault(); });
      row.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        N.theme.setBulletStyle(b.id);
        N.toast.success(b.mark + '  ' + b.label, { ms: 1400, key: 'bullet' });
        refreshBulletList();
      });
      list.appendChild(row);
    });
    return list;
  }

  function refreshBulletList() {
    if (!sub || sub.dataset.kind !== 'bullets') return;
    const old = sub.querySelector('.sel-tray-menu');
    const fresh = buildBulletList();
    if (old) old.replaceWith(fresh); else sub.insertBefore(fresh, sub.firstChild);
    placeTray(sub);
  }

  function openBulletStyles(anchor) {
    const tray = trayAt(anchor, 'bullets');
    tray.appendChild(buildBulletList());
    const foot = el('div.sel-tray-foot');
    const note = el('div.sel-tray-note');
    note.appendChild(N.icons.node('info', { size: 13 }));
    note.appendChild(el('span', null, 'Your files are not changed — this only changes how bullets are drawn.'));
    foot.appendChild(note);
    const doneRow = el('button.sel-row.sel-row-done', { type: 'button' });
    doneRow.appendChild(N.icons.node('check', { size: 14 }));
    doneRow.appendChild(el('span', null, T('act.done', 'Done')));
    doneRow.addEventListener('mousedown', function (e) { e.preventDefault(); });
    doneRow.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeSub(); });
    foot.appendChild(doneRow);
    tray.appendChild(foot);
    placeTray(tray);
  }
'''

_BLOCKS['css.css'] = r'''
/* ---------------------------------------------- the bullet style tray --- */
.sel-row-mark {
  flex: none; width: 22px; text-align: center;
  font-size: 15px; line-height: 1; color: var(--text-2);
}
.sel-row-label { flex: 1 1 auto; }
.sel-row.is-on { color: var(--accent); background: var(--accent-soft); }
.sel-row.is-on .sel-row-mark { color: var(--accent); }
.sel-row.is-on .icon { color: var(--accent); }
.sel-row-done { color: var(--accent); font-weight: 600; }
.sel-tray-note {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 6px 8px 6px; margin-bottom: 2px;
  font-size: 11.5px; line-height: 1.4; color: var(--text-3);
}
.sel-tray-note .icon { flex: none; margin-top: 1px; color: var(--text-3); }
'''


def block(name):
    return _BLOCKS[name]


MARKER = 'function openBulletStyles(anchor)'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    path = args[0] if args else 'index.html'

    if not os.path.exists(path):
        print('ERROR: %s not found.' % path)
        return 1

    src = io.open(path, encoding='utf-8').read()
    if MARKER in src:
        print('ERROR: the selection-toolbar bullet picker is already installed in this file.')
        return 1
    if 'setBulletStyle' not in src or 'bulletStyles: bulletStyles' not in src:
        print('ERROR: this file does not have the v9.6 bullet-style feature yet.')
        print('       Run fix_v96_standalone.py on it first, then run this script.')
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

    print('=' * 74)
    print(' Nodalis v9.7 - bullet style in the selection toolbar')
    print('=' * 74)
    print(' file: %s  (%d bytes)\n' % (path, len(src)))

    # 1. stylesheet
    ok = once('\n</style>\n</head>', '\n' + block('css.css') + '\n</style>\n</head>', 'stylesheet')
    print('   stylesheet                        %s' % ('ok' if ok else 'FAILED'))

    # 2. the trigger button, in the tail, right after the read-aloud button
    #    and before the existing "more formatting" (...) button.
    old_trigger = (
        "    if (N.speak && N.speak.supported()) {\n"
        "      tail.appendChild(action('play', T('speak.readSelection', 'Read the selection aloud'), function () {\n"
        "        const s = N.format.selection();\n"
        "        N.speak.start(s && s.text);\n"
        "      }, { keepOpen: false }));\n"
        "    }\n"
        "\n"
        "    const moreBtn = el('button.sel-btn.is-more', { type: 'button', title: T('fmt.more', 'More'), 'aria-label': T('fmt.more', 'More formatting') });"
    )
    new_trigger = (
        "    if (N.speak && N.speak.supported()) {\n"
        "      tail.appendChild(action('play', T('speak.readSelection', 'Read the selection aloud'), function () {\n"
        "        const s = N.format.selection();\n"
        "        N.speak.start(s && s.text);\n"
        "      }, { keepOpen: false }));\n"
        "    }\n"
        + block('trigger.js') +
        "\n    const moreBtn = el('button.sel-btn.is-more', { type: 'button', title: T('fmt.more', 'More'), 'aria-label': T('fmt.more', 'More formatting') });"
    )
    ok = once(old_trigger, new_trigger, 'toolbar trigger button')
    print('   trigger button in the tail        %s' % ('ok' if ok else 'FAILED'))

    # 3. the tray itself: buildBulletList / refreshBulletList / openBulletStyles,
    #    dropped in right after openMore() ends and before "show and hide".
    old_tray = (
        "    row('highlight', 'Remove every highlight in this note', function () { F.clearHighlights(); });\n"
        "    row('eraser', 'Reset all formatting in this note', function () { F.resetNoteFormatting(); }, { danger: true });\n"
        "    placeTray(tray);\n"
        "  }\n"
        "\n"
        "  /* --------------------------------------------------------- show and hide */"
    )
    new_tray = (
        "    row('highlight', 'Remove every highlight in this note', function () { F.clearHighlights(); });\n"
        "    row('eraser', 'Reset all formatting in this note', function () { F.resetNoteFormatting(); }, { danger: true });\n"
        "    placeTray(tray);\n"
        "  }\n"
        + block('tray.js') +
        "\n  /* --------------------------------------------------------- show and hide */"
    )
    ok = once(old_tray, new_tray, 'bullet style tray functions')
    print('   bullet style tray                 %s' % ('ok' if ok else 'FAILED'))

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
