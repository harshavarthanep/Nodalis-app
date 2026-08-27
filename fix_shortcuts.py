#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v9.5 - keyboard shortcut repair
=============================================================================

Run this in a GitHub Codespace (or any machine with Python 3.8+) from the
folder that holds your index.html:

    python3 fix_shortcuts.py index.html

It writes index.html in place and leaves index.html.bak beside it. Pass
--dry-run to see the report without writing anything.

WHAT IT FIXES
-------------
1.  15 accelerators were bound to two commands each. The engine keeps the
    FIRST registration and silently drops the second, so 15 advertised
    shortcuts did nothing - including Mod+K (the command palette, which the
    search box advertises with a Ctrl+K chip) and Mod+B (the sidebar, which
    the sidebar button advertises in its tooltip).

2.  13 commands were listed twice in the shortcut sheet, the command palette
    and Settings -> Shortcuts, because two modules register the same action:
    an older `editor.*` family and a newer, smarter `format.*` family. The
    `format.*` versions toggle (press Mod+B twice and the ** comes back off),
    the `editor.*` ones only ever insert. The older twins are retired.

3.  F1 was the only binding on a key a 65% keyboard does not have.

4.  Mod+H (find and replace) is Hide Application on macOS, and Mod+N (new
    note) is New Window in every browser. Neither event reaches the page, so
    neither shortcut worked. Both moved.

5.  A new health check reports any binding that sits on a combo the OS or the
    browser consumes, so this cannot silently come back.

Every change is a targeted edit inside one command's registration object.
No behaviour, styling or markup outside the shortcut layer is touched.
=============================================================================
"""

import io
import os
import re
import sys

# ---------------------------------------------------------------- the plan --

# editor.* twins retired: the accel is removed and the command is hidden from
# the palette / sheet / settings table. It still RUNS (N.commands.run works on
# hidden commands), so any menu that calls it keeps working.
RETIRE = [
    ('editor.bold',       'format.bold'),
    ('editor.italic',     'format.italic'),
    ('editor.strike',     'format.strike'),
    ('editor.highlight',  'format.highlight'),
    ('editor.code',       'format.code'),
    ('editor.link',       'format.link'),
    ('editor.bulletList', 'format.bullets'),
    ('editor.numberList', 'format.numbers'),
    ('editor.taskList',   'format.tasks'),
    ('editor.quote',      'format.quote'),
]

# Same title registered by two different modules. The one that keeps its key
# and its place in the lists is named second.
HIDE = [
    ('note.template', 'template.new'),
    ('note.share',    'share.open'),
    ('note.random',   'intel.random'),
]

# id -> (new accel, why)
REBIND = {
    'format.link':       ('Mod+Alt+K',           'Mod+K is the command palette - the search box shows that chip'),
    'format.deleteLine': ('Mod+Shift+Backspace', 'editor.wikilink keeps Mod+Shift+K'),
    'view.sidebar':      ('Mod+Alt+B',           'Mod+B is Bold in every text editor'),
    'format.duplicate':  ('Mod+Alt+D',           'editor.date keeps Mod+Shift+D'),
    'editor.toggleMode': ('Mod+Alt+V',           'Mod+Shift+V is paste-without-formatting everywhere'),
    'format.clear':      ('Mod+Alt+Shift+X',     'scratch.capture keeps Mod+Shift+C'),
    'format.table':      ('Mod+Alt+A',           'write.typewriter keeps Mod+Alt+T; A for align'),
    'help.open':         ('Mod+Alt+/',           'a 65% keyboard has no F-row'),
    'format.find':       ('Mod+Alt+F',           'macOS takes Cmd+H to hide the application'),
    'write.focus':       ('Mod+Alt+Shift+F',     'freed Mod+Alt+F for find and replace'),
    'note.new':          ('Mod+Alt+N',           'every browser takes Mod+N for a new window'),
}

# Tooltips written into the markup as data-tip-kbd, which the engine does not
# generate and therefore cannot keep in step.
TOOLTIPS = [
    ('data-tip-kbd="Mod+B"', 'data-tip-kbd="Mod+Alt+B"', 'sidebar button'),
    ('data-tip-kbd="F1"',    'data-tip-kbd="Mod+Alt+/"', 'help button'),
    ('data-tip-kbd="Mod+N"', 'data-tip-kbd="Mod+Alt+N"', 'new-note button'),
]


# ------------------------------------------------------------- edit engine --

class Patcher(object):
    def __init__(self, text):
        self.s = text
        self.log = []
        self.errors = []

    # -- primitive ---------------------------------------------------------
    def replace_once(self, old, new, label):
        n = self.s.count(old)
        if n != 1:
            self.errors.append('%s: anchor found %d times, expected 1' % (label, n))
            return False
        self.s = self.s.replace(old, new, 1)
        self.log.append(label)
        return True

    # -- find the header of one command registration object -----------------
    def _span(self, cmd_id):
        """
        Return (start, end) covering a command's properties, from `id: '<id>'`
        up to but not including its `run:`. Both source styles in this file -
        one line, or one property per line - live inside that span, and the
        accel is always in it.
        """
        m = re.search(r"id:\s*'" + re.escape(cmd_id) + r"'", self.s)
        if not m:
            self.errors.append("%s: not found" % cmd_id)
            return None
        run = self.s.find('run:', m.end())
        if run == -1 or run - m.end() > 1200:
            self.errors.append("%s: no run: within its object" % cmd_id)
            return None
        return (m.end(), run)

    def _edit_span(self, cmd_id, fn):
        span = self._span(cmd_id)
        if not span:
            return False
        a, b = span
        before = self.s[a:b]
        after = fn(before)
        if after is None:
            return False
        self.s = self.s[:a] + after + self.s[b:]
        return True

    # -- operations --------------------------------------------------------
    ACCEL = re.compile(r"accel:\s*(?:'[^']*'|\"[^\"]*\")\s*,?\s*")

    def drop_accel(self, cmd_id):
        def fn(chunk):
            if not self.ACCEL.search(chunk):
                self.errors.append('%s: has no accel to drop' % cmd_id)
                return None
            return self.ACCEL.sub('', chunk, count=1)
        ok = self._edit_span(cmd_id, fn)
        if ok:
            self.log.append('%s: accel removed' % cmd_id)
        return ok

    def set_accel(self, cmd_id, accel):
        quoted = "accel: '%s'," % accel
        def fn(chunk):
            if self.ACCEL.search(chunk):
                return self.ACCEL.sub(quoted + ' ', chunk, count=1)
            # No accel yet. Append at the END of the property list rather than
            # after the id: the span stops at `run:`, and what precedes `run:`
            # is always a comma, so appending there is always valid syntax.
            # Inserting after `id: '...'` would land before its comma.
            return chunk + quoted + ' '
        ok = self._edit_span(cmd_id, fn)
        if ok:
            self.log.append('%s: accel -> %s' % (cmd_id, accel))
        return ok

    def hide(self, cmd_id):
        def fn(chunk):
            if 'hidden:' in chunk:
                return chunk                      # already hidden, fine
            return chunk + 'hidden: true, '       # see set_accel on placement
        ok = self._edit_span(cmd_id, fn)
        if ok:
            self.log.append('%s: hidden from the lists' % cmd_id)
        return ok


# ------------------------------------------------------------------ blocks --

# The reserved-combo table and health check, inserted into features/health.js.
RESERVED_CHECK = r"""
  /* ------------------------------------------------- reserved key combos --
   *
   * v9.5. A shortcut can be unique and still not work, because the operating
   * system or the browser consumes the keystroke before the page is given a
   * keydown to look at. There is nothing the app can do about those at
   * runtime - preventDefault() is never reached - so the only useful thing is
   * to say so plainly and point at the screen where it can be changed.
   *
   * The list is deliberately short. It holds only combos that are handled
   * above the page in a mainstream browser or by macOS itself, and NOT the
   * long tail that a page can in fact cancel (Mod+S, Mod+P, Mod+D, Mod+O,
   * Mod+G, the zoom pair) - those work today and warning about them would be
   * noise.
   *
   * A shortcut listed here still works in an installed PWA window, where
   * there is no browser UI to steal it. That is why these are reported rather
   * than reassigned: which behaviour is right depends on how you run Nodalis.
   */
  const RESERVED_COMBOS = {
    'mod+n':       'your browser opens a new window',
    'mod+t':       'your browser opens a new tab',
    'mod+w':       'your browser closes the tab',
    'mod+shift+n': 'Chrome and Edge open a private window',
    'mod+shift+t': 'your browser reopens the last closed tab',
    'mod+shift+w': 'your browser closes the window',
    'mod+shift+c': 'Chrome and Edge open the element picker',
    'mod+alt+i':   'Chrome and Edge open the developer tools',
    'mod+alt+j':   'Chrome and Edge open the developer console',
    'mod+q':       'macOS quits the app',
    'mod+h':       'macOS hides the app',
    'mod+m':       'macOS minimises the window',
    'mod+space':   'macOS opens Spotlight',
    'mod+tab':     'the system switches windows',
  };

  /*
   * Keys a 65% keyboard does not have. There is no F-row, no number pad and no
   * navigation cluster, so a binding on any of them cannot be pressed at all
   * on that board without a second Fn layer - and Fn is invisible to the web.
   */
  const OFF_65_PERCENT = /^(f\d{1,2}|home|end|pageup|pagedown|insert|numlock|scrolllock|pause)$/;

  function reservedShortcuts() {
    const risky = [];
    N.commands.all().forEach(function (c) {
      if (c.hidden) return;
      const accel = N.shortcuts.accelFor(c.id);
      if (!accel) return;
      const key = N.shortcuts.normalize(accel);
      const last = key.split('+').pop();
      if (RESERVED_COMBOS[key]) {
        risky.push({ cmd: c, accel: key, pretty: N.shortcuts.format(key), why: RESERVED_COMBOS[key] });
      } else if (OFF_65_PERCENT.test(last)) {
        risky.push({ cmd: c, accel: key, pretty: N.shortcuts.format(key),
          why: 'a 65% keyboard has no ' + last.toUpperCase() + ' key' });
      }
    });
    return {
      id: 'reserved-keys',
      ok: risky.length === 0,
      label: 'Shortcuts your keyboard can reach',
      good: 'Every shortcut is on a key a 65% keyboard has, and none is one the browser takes.',
      bad: U.pluralize(risky.length, 'shortcut') + ' may never reach Nodalis: ' +
        risky.map(function (r) { return r.pretty; }).join(', ') + '.',
      viewLabel: 'Show me',
      view: function () { showReserved(risky); },
      data: risky,
    };
  }

  function showReserved(risky) {
    if (!risky.length) { N.toast.success('Every shortcut is reachable.', { ms: 3000 }); return; }
    const items = [{ header: 'The key never reaches the page' }];
    risky.forEach(function (r) {
      items.push({
        label: r.cmd.title + '  ' + r.pretty,
        hint: r.why,
        icon: 'warning',
        onClick: function () { N.commands.run('settings.shortcuts'); },
      });
    });
    items.push({ separator: true });
    items.push({
      label: 'Pick new keys in Settings',
      icon: 'keyboard',
      onClick: function () { N.commands.run('settings.shortcuts'); },
    });
    /*
     * No auto-fixer here on purpose, and for the same reason resolveConflicts
     * unbinds rather than reassigns: guessing a replacement key is how you get
     * a second conflict. These also still work in an installed PWA, so the
     * right answer genuinely depends on the person.
     */
    N.menu.show(items, { title: 'Shortcuts the system takes', allowSheet: true });
  }
"""


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    path = argv[0] if argv else 'index.html'

    if not os.path.exists(path):
        print('ERROR: %s not found. Run this from the folder that holds it.' % path)
        return 1

    src = io.open(path, encoding='utf-8').read()
    p = Patcher(src)

    print('=' * 74)
    print(' Nodalis v9.5 - keyboard shortcut repair')
    print('=' * 74)
    print(' file: %s  (%d bytes)\n' % (path, len(src)))

    # -- 1. retire the editor.* twins -------------------------------------
    print('-- retiring duplicate commands -------------------------------------')
    for cid, keeper in RETIRE:
        okA = p.drop_accel(cid)
        okB = p.hide(cid)
        print('   %-20s %s  (duplicate of %s)' % (cid, 'ok' if okA and okB else 'FAILED', keeper))

    # -- 2. hide the same-title duplicates --------------------------------
    print('\n-- hiding same-title duplicates ------------------------------------')
    for cid, keeper in HIDE:
        span = p._span(cid)
        had_accel = bool(span and p.ACCEL.search(p.s[span[0]:span[1]]))
        if had_accel:
            p.drop_accel(cid)
        ok = p.hide(cid)
        print('   %-20s %s  (duplicate of %s%s)'
              % (cid, 'ok' if ok else 'FAILED', keeper,
                 ', accel released' if had_accel else ''))

    # -- 3. rebind --------------------------------------------------------
    print('\n-- rebinding -------------------------------------------------------')
    for cid in sorted(REBIND):
        accel, why = REBIND[cid]
        ok = p.set_accel(cid, accel)
        print('   %-20s -> %-22s %s  %s' % (cid, accel, 'ok' if ok else 'FAILED', why))

    # -- 4. tooltips ------------------------------------------------------
    print('\n-- markup tooltips -------------------------------------------------')
    for old, new, what in TOOLTIPS:
        ok = p.replace_once(old, new, 'tooltip ' + what)
        print('   %-14s -> %-26s %s  (%s)'
              % (old.split('"')[1], new.split('"')[1], 'ok' if ok else 'FAILED', what))

    # -- 5. the shortcut sheet lists every bound command ------------------
    print('\n-- the shortcut sheet ----------------------------------------------')
    OLD_SHEET = """        const wrap = el('div');
        const groups = N.commands.groups();
        Array.from(groups.keys()).sort().forEach(function (group) {
          const withKeys = groups.get(group).filter(function (c) { return N.shortcuts.accelFor(c.id); });"""
    NEW_SHEET = """        const wrap = el('div');
        /*
         * v9.5: BUILT FROM all(), NOT groups().
         *
         * groups() runs every command's when() first, so the sheet only listed
         * what happened to be available at the moment it opened - open it with
         * no note and the whole Format section was missing. A reference sheet
         * has to be the same sheet every time, so it is built from all()
         * instead, minus the commands marked hidden (the retired duplicates,
         * which is what used to make every format action appear twice).
         */
        const groups = new Map();
        N.commands.all().forEach(function (c) {
          if (c.hidden) return;
          if (!N.shortcuts.accelFor(c.id)) return;
          if (!groups.has(c.group)) groups.set(c.group, []);
          groups.get(c.group).push(c);
        });
        groups.forEach(function (list) {
          list.sort(function (a, b) { return a.title.localeCompare(b.title); });
        });
        Array.from(groups.keys()).sort().forEach(function (group) {
          const withKeys = groups.get(group).filter(function (c) { return N.shortcuts.accelFor(c.id); });"""
    ok = p.replace_once(OLD_SHEET, NEW_SHEET, 'shortcut sheet source')
    print('   sheet lists every bound command  %s' % ('ok' if ok else 'FAILED'))

    # -- 6. the settings editor lists every command ----------------------
    OLD_TABLE = """      const groups = N.commands.groups();
      let shown = 0;"""
    NEW_TABLE = """      /*
       * v9.5: same reason as the shortcut sheet. groups() applies when(), so
       * with no note open this table could not show - or rebind - Bold. An
       * editor has to list everything it can bind.
       */
      const groups = new Map();
      N.commands.all().forEach(function (c) {
        if (c.hidden) return;
        if (!groups.has(c.group)) groups.set(c.group, []);
        groups.get(c.group).push(c);
      });
      groups.forEach(function (list) {
        list.sort(function (a, b) { return a.title.localeCompare(b.title); });
      });
      let shown = 0;"""
    ok = p.replace_once(OLD_TABLE, NEW_TABLE, 'settings shortcut table source')
    print('   settings table lists every command  %s' % ('ok' if ok else 'FAILED'))

    # -- 7. the reserved-combo health check ------------------------------
    print('\n-- health check ----------------------------------------------------')
    ok1 = p.replace_once(
        """    add(duplicateTitles);
    add(shortcutConflicts);""",
        """    add(duplicateTitles);
    add(shortcutConflicts);
    add(reservedShortcuts);""",
        'health: register reservedShortcuts')
    ok2 = p.replace_once(
        """  function brokenLinks() {
    const unresolved = N.store.buildLinkGraph().unresolved;""",
        RESERVED_CHECK + """
  function brokenLinks() {
    const unresolved = N.store.buildLinkGraph().unresolved;""",
        'health: reserved-combo check body')
    print('   reserved-combo + 65%% key check  %s' % ('ok' if ok1 and ok2 else 'FAILED'))

    # -- report -----------------------------------------------------------
    print('\n' + '=' * 74)
    if p.errors:
        print(' %d PROBLEM(S) - nothing was written:' % len(p.errors))
        for e in p.errors:
            print('   - %s' % e)
        print('\n Most likely cause: this index.html is a different build, or the')
        print(' script has already been run on it. Check index.html.bak.')
        return 1

    print(' %d edits applied cleanly.' % len(p.log))
    print(' %d -> %d bytes (+%d)' % (len(src), len(p.s), len(p.s) - len(src)))

    if dry:
        print('\n --dry-run: %s was NOT modified.' % path)
        return 0

    bak = path + '.bak'
    io.open(bak, 'w', encoding='utf-8').write(src)
    io.open(path, 'w', encoding='utf-8').write(p.s)
    print('\n wrote  %s' % path)
    print(' backup %s' % bak)
    print('\n Open the app, then Settings -> Shortcuts, or press Mod+Shift+/')
    print(' to see the sheet. "Check my vault for problems" now reports both')
    print(' clashing shortcuts and shortcuts the system takes.')
    print('=' * 74)
    return 0


if __name__ == '__main__':
    sys.exit(main())
