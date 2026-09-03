#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v10.4.0 - the menu, the matrix, and per-bullet bullets
=============================================================================

    python3 fix_v104_standalone.py index.html --dry-run
    python3 fix_v104_standalone.py index.html

Run this on the v10.3.0 file.

WHAT IS IN IT

 1. THE MENU GOT TALLER AND HID DELETE - AND THAT WAS MY 520px CEILING.
    Measured: the note menu's content is 629px and v10.1 capped the box at
    520px, so it scrolled and Delete sat below the fold. Before v10.1 the
    cap was 660px, the content fitted, and nothing scrolled - which is
    exactly what you meant by "before it was looking good". The ceiling is
    660px again, but measured against the VISIBLE viewport rather than vh,
    so the mobile bug that 520 was covering for stays fixed. The placement
    clamp was still using vh too; that is fixed as well.

 2. EVERY MATRIX CARD HAS ITS OWN ACTIONS. Edit the text, move it to another
    quadrant, take it off the board, delete it. Works for a typed task and
    for a checkbox living in a note - editing one rewrites that line in the
    note, and deleting one tells you which note it is about to change.

 3. THE PLUS ASKS WHAT YOU WANT. Type a task, or pick notes - several at
    once, searchable - and each becomes a card in that quadrant with its
    note's name on it. Click the name and the note opens.

 4. PER-BULLET BULLET STYLES, the way you chose: a map in the note's own
    frontmatter, so the file stays valid markdown and any other editor
    ignores it. Settings > Editor has the switch: with it on, choosing a
    bullet style changes the item your cursor is in (or every list line in
    the selection) instead of the whole app. Off by default, so nothing
    changes until you ask.

 5. VERSION 10.4.0, dated today.

 THE CALENDAR IS NEXT, on its own. Events on a date, recurrence, reminder
 lead time, holidays with a configurable weekend, edit and delete - that is
 a round's work by itself and squeezing it in beside four other things is
 how it would end up needing to be reported again.
=============================================================================
"""

import io
import os
import sys


# ---------------------------------------------------------------- the blocks

_BLOCKS = {}

_BLOCKS['css.css'] = r'''
/* ===== v10.4: matrix card actions, the note picker, per-item bullets ===== */

.matrix-card { position: relative; }
.matrix-card-more {
  flex: 0 0 auto;
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  margin: -2px -4px 0 0;
  border: 0; padding: 0;
  border-radius: var(--radius-2, 6px);
  background: transparent;
  /* Same reasoning as the sidebar's three dots: a quiet control still has to
     be findable in every theme, so it is a text colour rather than a tint. */
  color: var(--text-3);
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}
.matrix-card:hover .matrix-card-more,
.matrix-card:focus-within .matrix-card-more,
.matrix-card-more:focus-visible { opacity: 1; }
.matrix-card-more:hover { background: var(--surface-2); color: var(--text-1); }
.matrix-card-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
/*
 * A pointer can reveal a control on hover. A finger cannot, so on touch the
 * dots are simply always there - the same decision the note rows made.
 */
@media (hover: none) {
  .matrix-card-more { opacity: 1; }
}

/* the note picker */
.nd-pick { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.nd-pick-list {
  max-height: min(46vh, 340px);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-2, 8px);
}
.nd-pick-row {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: 0; background: transparent;
  color: var(--text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid var(--border-1);
}
.nd-pick-row:last-child { border-bottom: 0; }
.nd-pick-row:hover { background: var(--surface-2); }
.nd-pick-row.is-on { background: color-mix(in oklab, var(--accent) 12%, transparent); }
.nd-pick-box {
  flex: 0 0 auto; width: 16px; height: 16px;
  border: 1.5px solid var(--border-strong, var(--border-1));
  border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--accent-on, #fff);
}
.nd-pick-row.is-on .nd-pick-box { background: var(--accent); border-color: var(--accent); }
.nd-pick-main { flex: 1 1 auto; min-width: 0; }
.nd-pick-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nd-pick-sub { font-size: var(--text-xs); color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nd-pick-count { font-size: var(--text-xs); color: var(--text-3); }
.nd-pick-empty { padding: 18px 12px; text-align: center; color: var(--text-3); font-size: var(--text-xs); }

/* ---------------------------------------------------------------------------
 * PER-ITEM BULLETS.
 *
 * The app-wide rules are body[data-bullet-style='x'] .prose ul > li::marker,
 * which is (0,3,3) - one element MORE specific than any selector that hangs
 * off the li's own attribute. Rather than fight that with a padded selector
 * that nobody would understand later, these carry !important: an override
 * written into one note's frontmatter is meant to win, and saying so plainly
 * is better than winning by accident.
 *
 * data-nd-bullet, not data-bullet: v10.1 was lost to a class-name collision
 * in this file and once was enough.
 * ------------------------------------------------------------------------ */
.prose li[data-nd-bullet]::marker { color: var(--bullet-color, var(--text-3)); }
.prose li[data-nd-bullet='disc']::marker           { content: '\25CF' '\00A0' !important; font-size: 0.60em !important; }
.prose li[data-nd-bullet='circle']::marker         { content: '\25CB' '\00A0' !important; font-size: 0.64em !important; }
.prose li[data-nd-bullet='square']::marker         { content: '\25AA' '\00A0' !important; font-size: 1.00em !important; }
.prose li[data-nd-bullet='square-hollow']::marker  { content: '\25AB' '\00A0' !important; font-size: 1.00em !important; }
.prose li[data-nd-bullet='diamond']::marker        { content: '\25C6' '\00A0' !important; font-size: 0.70em !important; }
.prose li[data-nd-bullet='diamond-hollow']::marker { content: '\25C7' '\00A0' !important; font-size: 0.76em !important; }
.prose li[data-nd-bullet='star']::marker           { content: '\2605' '\00A0' !important; font-size: 0.78em !important; }
.prose li[data-nd-bullet='star-hollow']::marker    { content: '\2606' '\00A0' !important; font-size: 0.84em !important; }
.prose li[data-nd-bullet='dash']::marker           { content: '\2013' '\00A0' !important; font-size: 1.00em !important; }
.prose li[data-nd-bullet='chevron']::marker        { content: '\203A' '\00A0' !important; font-size: 1.05em !important; }
'''

_BLOCKS['clamp.js'] = r'''    /*
     * v10.4: CLAMP AGAINST WHAT IS ON SCREEN, NOT THE LAYOUT VIEWPORT.
     *
     * v10.1 taught the max-height to use visualViewport and then clamped the
     * POSITION against vh anyway, so on a mobile browser whose toolbar is
     * covering the bottom of the page a menu could still be placed with its
     * last row underneath that toolbar. Same measurement for both now.
     */
    if (y + mh > visH - pad) y = Math.max(pad, visH - mh - pad);
'''

_BLOCKS['tasksedit.js'] = r'''  /*
   * v10.4: EDIT AND DELETE, FOR EITHER KIND OF TASK.
   *
   * The matrix needed both and only had them for standalone tasks. A task
   * that lives in a note is a line of markdown, so editing rewrites that
   * line and deleting removes it - and because that is someone's note being
   * changed, the confirmation says which note by name.
   */
  async function editText(task) {
    if (!task) return false;
    const next = await N.modal.prompt({
      title: 'Edit task',
      value: task.text || '',
      message: task.source === 'note' && task.noteTitle
        ? 'This line lives in "' + task.noteTitle + '" and will be rewritten there.'
        : '',
    });
    if (next === null) return false;
    const clean = String(next).trim();
    if (!clean) return false;

    if (task.source === 'standalone') {
      const record = N.store.state.tasks.get(task.id);
      if (!record) return false;
      record.text = clean;
      await N.store.saveRecord('tasks', record);
      return true;
    }

    const note = N.store.getNote(task.noteId);
    if (!note) { N.toast.error('That note no longer exists.'); return false; }
    const lines = note.content.split('\n');
    const m = /^(\s*[-*+]\s+\[[ xX/-]\]\s*)([\s\S]*)$/.exec(lines[task.line] || '');
    if (!m) { N.toast.warn('That task has moved — reopen the board and try again.'); return false; }
    lines[task.line] = m[1] + clean;
    await N.store.updateNoteContent(note.id, lines.join('\n'));
    return true;
  }

  async function removeTask(task) {
    if (!task) return false;

    if (task.source === 'standalone') {
      const ok = await N.modal.confirm({
        title: 'Delete this task?',
        message: '"' + U.truncate(task.text || '', 70) + '" will be deleted.',
        confirmLabel: 'Delete', danger: true,
      });
      if (!ok) return false;
      await N.store.deleteRecord('tasks', task.id);
      return true;
    }

    const note = N.store.getNote(task.noteId);
    if (!note) { N.toast.error('That note no longer exists.'); return false; }
    const ok = await N.modal.confirm({
      title: 'Delete this line from the note?',
      message: 'This removes "' + U.truncate(task.text || '', 60) + '" from "' +
               (task.noteTitle || 'the note') + '". Use "Take off the board" if you only want it out of the matrix.',
      confirmLabel: 'Delete the line', danger: true,
    });
    if (!ok) return false;
    const lines = note.content.split('\n');
    if (!/^\s*[-*+]\s+\[[ xX/-]\]/.test(lines[task.line] || '')) {
      N.toast.warn('That task has moved — reopen the board and try again.');
      return false;
    }
    lines.splice(task.line, 1);
    await N.store.updateNoteContent(note.id, lines.join('\n'));
    return true;
  }

'''

_BLOCKS['cardmenu.js'] = r'''    /*
     * v10.4: the card's own actions. Edit, move, take off the board, delete -
     * reachable with a pointer on hover and always visible on touch, because
     * a finger cannot hover.
     */
    const more = el('button.matrix-card-more', {
      type: 'button',
      title: 'More for this card',
      'aria-label': 'More actions for ' + (task.text || 'this card'),
      onclick: function (e) { e.stopPropagation(); openCardMenu(task, e.currentTarget); },
    });
    more.appendChild(N.icons.node('more-horizontal', { size: 15 }));
    node.appendChild(more);

'''

_BLOCKS['cardmenufn.js'] = r'''  /** The per-card menu. Same shape and ceiling as every other menu. */
  function openCardMenu(task, anchor) {
    const items = [{ header: U.truncate(task.text || 'Card', 40) }];

    items.push({
      label: 'Edit text…', icon: 'edit',
      onClick: async function () { if (await N.tasks.editText(task)) render(); },
    });

    items.push({ separator: true }, { header: 'Move to' });
    QUADRANTS.forEach(function (q) {
      items.push({
        label: q.title, icon: q.icon,
        checked: (task.quadrant || inferQuadrant(task)) === q.id,
        onClick: async function () { await N.tasks.setQuadrant(task, q.id); render(); },
      });
    });

    if (task.quadrant) {
      items.push({
        label: 'Take off the board', icon: 'close',
        description: task.source === 'note'
          ? 'Keeps the line in your note'
          : 'Keeps the task in your list',
        onClick: async function () { await N.tasks.setQuadrant(task, null); render(); },
      });
    }

    items.push({ separator: true });
    items.push({
      label: task.source === 'note' ? 'Delete the line…' : 'Delete task…',
      icon: 'trash', danger: true,
      onClick: async function () { if (await N.tasks.removeTask(task)) render(); },
    });

    N.menu.show(items, { anchor: anchor, align: 'right' });
  }

'''

_BLOCKS['addflow.js'] = r'''  /*
   * v10.4: THE PLUS ASKS WHAT YOU WANT.
   *
   * A quadrant used to take a typed task and nothing else, so there was no
   * way to put a note on the board - and thinking about priorities means
   * thinking about notes as often as about single tasks. Now it offers both,
   * and the note route takes SEVERAL at once because that is how a board
   * actually gets filled in.
   *
   * Either way the card is a standalone record with an explicit quadrant, so
   * it is visible whatever the pull-from-notes automation is set to, and it
   * carries noteId - which collect() already turns into the note's name and
   * a click that opens it.
   */
  async function addToQuadrant(quad) {
    const what = await N.modal.choose({
      title: 'Add to "' + quadTitle(quad) + '"',
      options: [
        { value: 'task', label: 'Type a task', description: 'A line of your own', icon: 'list-check' },
        { value: 'notes', label: 'Add notes…', description: 'Pick one or several from your vault', icon: 'note' },
      ],
    });
    if (!what) return;
    if (what === 'task') {
      await N.tasks.newTask(quad);
      render();
      return;
    }
    const ids = await pickNotes(quad);
    if (!ids || !ids.length) return;
    for (const id of ids) {
      const note = N.store.getNote(id);
      if (!note) continue;
      await N.store.saveRecord('tasks', {
        id: U.uid('tk'),
        text: N.store.noteTitle(note),
        done: false,
        due: null,
        priority: null,
        quadrant: quad,
        noteId: id,
        folder: note.folder || '',
        tags: [],
        createdAt: Date.now(),
      });
    }
    render();
    N.toast.success(
      U.pluralize(ids.length, 'note') + ' added to ' + quadTitle(quad) + '.', { ms: 2400 });
  }

  function quadTitle(id) {
    const q = QUADRANTS.filter(function (x) { return x.id === id; })[0];
    return q ? q.title : 'this quadrant';
  }

  /** A searchable multi-select over the vault. Resolves to an array of ids. */
  function pickNotes(quad) {
    const chosen = new Set();
    /* Notes already on the board as a card - adding one twice is never meant. */
    const already = new Set();
    try {
      N.tasks.collect().forEach(function (t) {
        if (t.source === 'standalone' && t.noteId && t.quadrant) already.add(t.noteId);
      });
    } catch (err) { /* the filter is a courtesy */ }

    let listBox, count, search;
    const api = N.modal.open({
      title: 'Add notes to "' + quadTitle(quad) + '"',
      size: 'md',
      dismissValue: null,
      showClose: true,
      render: function () {
        const wrap = el('div.nd-pick');
        search = el('input.field', {
          type: 'search', placeholder: 'Search your notes…', 'data-autofocus': '',
        });
        search.addEventListener('input', function () { paint(search.value); });
        wrap.appendChild(search);
        listBox = el('div.nd-pick-list');
        wrap.appendChild(listBox);
        count = el('div.nd-pick-count', null, 'Nothing picked yet.');
        wrap.appendChild(count);
        paint('');
        return wrap;
      },
      footer: function (a) {
        return [
          el('button.btn', { type: 'button', onclick: function () { a.close(null); } }, 'Cancel'),
          el('button.btn.btn-primary', {
            type: 'button',
            onclick: function () { a.close(Array.from(chosen)); },
          }, 'Add'),
        ];
      },
    });

    function say() {
      if (!count) return;
      count.textContent = chosen.size
        ? U.pluralize(chosen.size, 'note') + ' picked.'
        : 'Nothing picked yet.';
    }

    function paint(query) {
      if (!listBox) return;
      U.clear(listBox);
      const q = String(query || '').trim().toLowerCase();
      const notes = N.store.allNotes()
        .filter(function (n) {
          if (already.has(n.id)) return false;
          if (!q) return true;
          return (N.store.noteTitle(n) + ' ' + (n.folder || '')).toLowerCase().indexOf(q) !== -1;
        })
        .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
        .slice(0, 200);

      if (!notes.length) {
        listBox.appendChild(el('div.nd-pick-empty', null,
          q ? 'No note matches that.' : 'Every note is already on the board.'));
        say();
        return;
      }

      notes.forEach(function (n) {
        const on = chosen.has(n.id);
        const row = el('button.nd-pick-row' + (on ? '.is-on' : ''), {
          type: 'button',
          role: 'checkbox',
          'aria-checked': String(on),
          onclick: function () {
            if (chosen.has(n.id)) chosen.delete(n.id); else chosen.add(n.id);
            paint(search ? search.value : '');
          },
        });
        const box = el('span.nd-pick-box');
        if (on) box.appendChild(N.icons.node('check-small', { size: 11 }));
        row.appendChild(box);
        const main = el('div.nd-pick-main');
        main.appendChild(el('div.nd-pick-title', null, N.store.noteTitle(n)));
        main.appendChild(el('div.nd-pick-sub', null, n.folder || 'All notes'));
        row.appendChild(main);
        listBox.appendChild(row);
      });
      say();
    }

    return api.promise;
  }

'''

_BLOCKS['itembullet.js'] = r'''  /*
   * v10.4: ONE BULLET, NOT THE WHOLE NOTE.
   *
   * Stored as a map in the note's own frontmatter - the option you picked -
   * so the file stays valid markdown and any other editor simply ignores the
   * key. The map is keyed by LINE NUMBER, which is the same convention the
   * priority-matrix overrides in this app already use (note.properties.matrix),
   * so there is one idea to understand rather than two. Insert a line above a
   * styled bullet and the override moves with the line number, not the text -
   * the honest trade for a format that stays plain markdown.
   *
   * Returns false when there is nothing to write to - no note open, or the
   * cursor is not in a bullet - so the caller can fall back to the app-wide
   * setting instead of appearing to do nothing.
   */
  async function setItemBulletStyle(id) {
    if (!N.editor || typeof N.editor.getTextarea !== 'function') return false;
    const ta = N.editor.getTextarea();
    const noteId = N.editor.currentNoteId ? N.editor.currentNoteId() : null;
    if (!ta || !noteId) return false;
    const note = N.store.getNote(noteId);
    if (!note) return false;

    const value = String(ta.value || '');
    const before = value.slice(0, ta.selectionStart || 0);
    const firstLine = before.split('\n').length - 1;
    const through = value.slice(0, ta.selectionEnd || ta.selectionStart || 0);
    const lastLine = through.split('\n').length - 1;

    const lines = value.split('\n');
    const touched = [];
    for (let i = firstLine; i <= lastLine && i < lines.length; i++) {
      /* Unordered list items only - an ordered list has no marker to change. */
      if (/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*[-*+]\s+\[[ xX/-]\]/.test(lines[i])) touched.push(i);
    }
    if (!touched.length) return false;

    const map = Object.assign({}, (note.properties && note.properties.bullets) || {});
    const fallback = (N.store.state.settings.bulletStyle || 'disc');
    touched.forEach(function (line) {
      /* Choosing the note's own default again is a way of clearing the
         override, which keeps the frontmatter from filling up with noise. */
      if (id === fallback) delete map[String(line)];
      else map[String(line)] = id;
    });

    const props = Object.assign({}, note.properties);
    if (Object.keys(map).length) props.bullets = map;
    else delete props.bullets;
    await N.store.updateNoteProperties(note.id, props, { replace: true });
    if (N.editor.renderPreview) N.editor.renderPreview();
    return touched.length;
  }

  /** Is the caret somewhere a per-item bullet could be written? */
  function canStyleThisItem() {
    try {
      if (!N.editor || typeof N.editor.getTextarea !== 'function') return false;
      const ta = N.editor.getTextarea();
      if (!ta || !N.editor.currentNoteId || !N.editor.currentNoteId()) return false;
      const value = String(ta.value || '');
      const line = value.split('\n')[value.slice(0, ta.selectionStart || 0).split('\n').length - 1] || '';
      return /^\s*[-*+]\s+/.test(line) && !/^\s*[-*+]\s+\[[ xX/-]\]/.test(line);
    } catch (err) { return false; }
  }

'''

_BLOCKS['setbullet.js'] = r'''  async function setBulletStyle(id, opts) {
    if (!bulletStyles().some(function (b) { return b.id === id; })) return false;
    /*
     * v10.4: the switch decides whose bullet this is. Both entry points - the
     * note menu and the selection toolbar's tray - come through here, so
     * there is one rule rather than two that can drift apart. opts.scope
     * overrides it for a caller that means one or the other explicitly.
     */
    const wantItem = opts && opts.scope
      ? opts.scope === 'item'
      : !!(N.store && N.store.state.settings && N.store.state.settings.bulletScopeItem);
    if (wantItem) {
      const n = await setItemBulletStyle(id);
      if (n) return true;   /* wrote the note's frontmatter */
      /* Nothing to write to - fall through rather than silently do nothing. */
    }
    await N.store.setSetting('bulletStyle', id);
    apply();
    return true;
  }
'''

_BLOCKS['bulletrender.js'] = r'''      } else {
        /*
         * v10.4: a per-item bullet override, read from the note's frontmatter
         * map. Looked up once per render rather than once per line.
         */
        let mark = '';
        if (ctx.__bullets === undefined) {
          ctx.__bullets = null;
          try {
            const host = ctx.noteId && N.store && N.store.getNote ? N.store.getNote(ctx.noteId) : null;
            if (host && host.properties && host.properties.bullets) ctx.__bullets = host.properties.bullets;
          } catch (err) { ctx.__bullets = null; }
        }
        if (ctx.__bullets && !ordered) {
          const want = ctx.__bullets[String(lineNo)];
          if (want && /^[a-z-]{3,20}$/.test(String(want))) mark = ' data-nd-bullet="' + want + '"';
        }
        html += '<li data-line="' + lineNo + '"' + mark + '>' + renderInline(content, ctx) + '</li>';
      }
'''

_BLOCKS['settingsrow.js'] = r'''    wrap.appendChild(row('Bullet style changes one item, not the whole note',
      'Off by default. With this on, choosing a bullet style changes the list item your cursor is in — or every list line you have selected — and stores it in that note’s frontmatter, so the file stays valid markdown. With it off, a bullet style is an app-wide preference as before.',
      toggle('bulletScopeItem')));

'''

_BLOCKS['sheetwhenshort.js'] = r'''    /*
     * Phones get a sheet - a 190px floating menu next to a thumb is a bad
     * target.
     *
     * v10.4: SO DOES A WINDOW THAT IS TOO SHORT FOR THE MENU.
     *
     * The note menu is 629px of rows. Restoring the 660px ceiling means it
     * fits, unscrolled, from about 650px of window height up - which is every
     * real device. Below that no ceiling can help: measured at 1024x480 the
     * box can only be 464px and the last row needs scrolling to reach. A
     * sheet is the component built for not having room, so a short window
     * gets one instead of a menu it cannot show. Measured against the VISIBLE
     * height, for the same reason the ceiling is.
     */
    const vv = window.visualViewport;
    const seenH = vv ? Math.max(220, Math.min(window.innerHeight, vv.height)) : window.innerHeight;
    if ((window.innerWidth <= 760 || seenH <= 620) && o.allowSheet !== false) {
'''

_BLOCKS['fmwrite.js'] = r'''  function stringifyFrontmatter(props) {
    const keys = Object.keys(props || {}).filter(function (k) { return k !== '__raw'; });
    if (!keys.length && !(props && props.__raw)) return '';
    const lines = ['---'];
    keys.forEach(function (key) {
      const value = props[key];
      /*
       * v10.4: A NESTED MAP HAS TO BE WRITTEN AS ONE.
       *
       * stringifyValue() fell through to String(value) for a plain object, so
       * a map was written to the file as the literal text
       *
       *     bullets: "[object Object]"
       *
       * and was gone the moment the note came back from disk. Measured on a
       * real save. TWO features store maps keyed by line number - the new
       * per-item bullet styles, and the priority-matrix quadrant overrides
       * that have been in the app since v8 - so this had been quietly losing
       * matrix placements for anyone syncing to a folder.
       *
       * A YAML block mapping is the plain, readable form, and any other
       * editor reads it as a map rather than as a broken string.
       */
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const sub = Object.keys(value).filter(function (k) {
          return value[k] !== undefined && value[k] !== null && value[k] !== '';
        });
        if (!sub.length) return;      /* an empty map is worth no line at all */
        lines.push(key + ':');
        sub.forEach(function (k) { lines.push('  ' + k + ': ' + stringifyScalar(value[k])); });
        return;
      }
      lines.push(key + ': ' + stringifyValue(value));
    });
    if (props && props.__raw) lines.push(props.__raw);
    lines.push('---', '');
    return lines.join('\n');
  }
'''

_BLOCKS['fmread.js'] = r'''      /*
       * v10.4: read a nested block map back. "bullets:" on its own line,
       * then indented "12: square" pairs under it. The check has to come
       * BEFORE the plain key/value one below, because that regex allows
       * spaces in a key and would otherwise swallow "  12" as a top-level
       * key called "12".
       */
      const nested = /^(\s+)([A-Za-z0-9_\-. ]+):\s*(.*)$/.exec(line);
      if (nested && currentKey && out[currentKey] &&
          typeof out[currentKey] === 'object' && !Array.isArray(out[currentKey])) {
        out[currentKey][nested[2].trim()] = coerce(nested[3].trim());
        continue;
      }

      const kv = /^([A-Za-z0-9_\-. ]+):\s*(.*)$/.exec(line);
      if (!kv) { unknown.push(line); continue; }

      const key = kv[1].trim();
      const rawVal = kv[2].trim();
      currentKey = key;
      if (rawVal === '') {
        /* A key with nothing after it is a block map if what follows is
           indented key/value pairs, and an empty string otherwise. */
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        out[key] = (j < lines.length && /^\s+[A-Za-z0-9_\-. ]+:\s*\S/.test(lines[j])) ? {} : '';
        continue;
      }
      out[key] = coerce(rawVal);
'''

MARKER = 'v10.4: CLAMP AGAINST WHAT IS ON SCREEN'
REQUIRES = 'v10.3: LIGHT THE SENTENCE, AND ONLY THE SENTENCE'


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
    print(' Nodalis v10.4.0 - the menu, the matrix, and per-bullet bullets')
    print('=' * 80)
    print(' file: %s  (%d bytes)' % (path, len(src)))
    print('')

    if MARKER in src:
        print('ERROR: v10.4.0 is already installed in this file.')
        return 1
    if REQUIRES not in src:
        print('ERROR: this file is not at v10.3.0. Run fix_v103_standalone.py first.')
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
            print('   %-52s ok' % label)
        else:
            print('   %-52s FAILED' % label)
            state['fail'] += 1

    # ------------------------------------------------------------- 1. the CSS
    report('stylesheet', once('\n</style>\n</head>',
                              '\n' + block('css.css') + '\n</style>\n</head>',
                              'stylesheet'))

    # ------------------------------------------ 2. the menu ceiling and clamp
    report('menu: a ceiling the note menu actually fits in', once(
        """.menu {
  max-height: min(var(--menu-max, 520px), 62vh, 520px) !important;""",
        """.menu {
  /*
   * v10.4: BACK UP TO 690px, BECAUSE 520px WAS HIDING DELETE.
   *
   * Measured: the note menu's content is 629px. v10.1 put a 520px ceiling on
   * every menu to make them one shape, and this is the menu that did not fit -
   * it scrolled, and the last row (Delete) sat below the fold. That is the
   * "it was looking good before" that got reported: before v10.1 the cap was
   * 660px and nothing scrolled.
   *
   * 690, not 660, because 660 was only right for Latin text. Measured across
   * all 27 languages: 629px of content in English, German, French, Russian,
   * Turkish and the rest - and 678px in Tamil, Malayalam, Urdu, Korean,
   * Japanese, Chinese and Hindi, whose scripts need taller rows. 660 left
   * those seven scrolling for the sake of 18 pixels.
   *
   * The rest of that unification was right and stays: one min-width, one row
   * height, labels that ellipsise. Only the ceiling moves - and --menu-max is
   * still the VISIBLE viewport measured in JS, so the mobile dynamic-toolbar
   * bug the 62vh term was covering for stays fixed by the thing that actually
   * fixes it.
   */
  max-height: min(var(--menu-max, 78vh), 690px) !important;""",
        'menu ceiling'))

    report('menu: place it inside the visible viewport too', once(
        """    if (y + mh > vh - pad) y = Math.max(pad, vh - mh - pad);""",
        block('clamp.js').rstrip('\n'), 'menu clamp'))

    report('menu: a short window gets a sheet, not a clipped menu', once(
        """    // Phones get a sheet \u2014 a 190px floating menu next to a thumb is a bad target.
    if (window.innerWidth <= 760 && o.allowSheet !== false) {""",
        block('sheetwhenshort.js').rstrip('\n'), 'sheet when short'))

    # ------------------------------------------- 3. tasks: edit and delete
    report('tasks: edit and delete either kind of task', once(
        """  async function promoteToNote(task) {""",
        block('tasksedit.js') + """  async function promoteToNote(task) {""",
        'tasks edit/delete'))

    report('tasks: exported for the matrix', once(
        """    setQuadrant: setTaskQuadrant, newTask: newTask,
  };""",
        """    setQuadrant: setTaskQuadrant, newTask: newTask,
    editText: editText, removeTask: removeTask, patch: patchTask,
  };""", 'tasks exports'))

    # ------------------------------------------------ 4. the matrix card menu
    report('matrix: the card menu', once(
        """    main.appendChild(meta);
    node.appendChild(main);

    node.addEventListener('dragstart', function (e) {""",
        """    main.appendChild(meta);
    node.appendChild(main);

""" + block('cardmenu.js') + """    node.addEventListener('dragstart', function (e) {""",
        'card menu button'))

    report('matrix: the menu it opens', once(
        """  /** Where a task belongs when nobody has said otherwise. */""",
        block('cardmenufn.js') + """  /** Where a task belongs when nobody has said otherwise. */""",
        'card menu fn'))

    report('matrix: a note card does not say its name twice', once(
        """    if (task.noteTitle) {
      const src = el('span.task-source', null, [N.icons.node('note', { size: 11 }), el('span', null, U.truncate(task.noteTitle, 22))]);""",
        """    if (task.noteTitle) {
      /*
       * v10.4: a card added FROM a note is titled with that note, so printing
       * the name again in the source chip read as "RecipesRecipes". When the
       * two are the same the chip keeps only the icon and says where the note
       * lives instead - which is the part you did not already know.
       */
      const sameName = String(task.text || '').trim() === String(task.noteTitle).trim();
      /* The record's own folder is empty for a card added from the picker, so
         ask the note where it actually lives. */
      let where = task.folder || '';
      if (sameName && !where && task.noteId) {
        const host = N.store.getNote(task.noteId);
        if (host) where = host.folder || '';
      }
      const chipText = sameName ? (where || 'All notes') : task.noteTitle;
      const src = el('span.task-source', {
        title: 'Open "' + task.noteTitle + '"',
      }, [N.icons.node('note', { size: 11 }), el('span', null, U.truncate(chipText, 22))]);""",
        'note card chip'))

    # --------------------------------------------------- 5. the add flow
    report('matrix: the plus asks what you want', once(
        """        onclick: async function (e) {
          e.stopPropagation();
          await N.tasks.newTask(quad.id);
          render();
        },""",
        """        onclick: async function (e) {
          e.stopPropagation();
          await addToQuadrant(quad.id);
        },""", 'plus onclick'))

    report('matrix: type a task or pick notes', once(
        """    N.bus.on('view:changed', function (v) { if (v === 'matrix') { refreshScopes(); render(); } });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'matrix') render();
    }, 500));

    registerCommands();
  }

  function refreshScopes() {""",
        """    N.bus.on('view:changed', function (v) { if (v === 'matrix') { refreshScopes(); render(); } });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'matrix') render();
    }, 500));

    registerCommands();
  }

""" + block('addflow.js') + """  function refreshScopes() {""", 'add flow'))

    # --------------------------------------------- 6. per-item bullet styles
    report('bullets: write one item into the note frontmatter', once(
        """  async function setBulletStyle(id) {
    if (!bulletStyles().some(function (b) { return b.id === id; })) return false;
    await N.store.setSetting('bulletStyle', id);
    apply();
    return true;
  }""",
        block('itembullet.js') + block('setbullet.js').rstrip('\n'), 'setBulletStyle'))

    report('bullets: the renderer marks the item', once(
        """      } else {
        html += '<li data-line="' + lineNo + '">' + renderInline(content, ctx) + '</li>';
      }""",
        block('bulletrender.js').rstrip('\n'), 'bullet render'))

    report('bullets: exported', once(
        """    setBulletStyle: setBulletStyle, pickBulletStyle: pickBulletStyle,""",
        """    setBulletStyle: setBulletStyle, pickBulletStyle: pickBulletStyle,
    setItemBulletStyle: setItemBulletStyle, canStyleThisItem: canStyleThisItem,""",
        'bullet exports'))

    report('bullets: the picker says which it will change', once(
        """  function pickBulletStyle(anchor) {
    const here = (N.store.state.settings.bulletStyle || 'disc');
    const items = [{ header: 'Bullet style' }];""",
        """  function pickBulletStyle(anchor) {
    const here = (N.store.state.settings.bulletStyle || 'disc');
    /*
     * v10.4: with the per-item switch on, the header says so - and says when
     * it cannot, because the caret is not in a bullet and the choice will
     * land app-wide instead.
     */
    const itemScope = !!(N.store.state.settings.bulletScopeItem);
    const canItem = itemScope && canStyleThisItem();
    const items = [{
      header: itemScope
        ? (canItem ? 'Bullet style — this item' : 'Bullet style — whole app (no bullet at the cursor)')
        : 'Bullet style',
    }];""", 'picker header'))

    report('settings: the per-item switch', once(
        """    if (s().focusMode) {
      wrap.appendChild(row('Keep in focus', 'How much stays bright around the caret.',
        select('focusScope', [
          { value: 'sentence', label: 'The sentence' },
          { value: 'line', label: 'The line' },
          { value: 'paragraph', label: 'The paragraph' },
        ])));
    }

    return wrap;""",
        """    if (s().focusMode) {
      wrap.appendChild(row('Keep in focus', 'How much stays bright around the caret.',
        select('focusScope', [
          { value: 'sentence', label: 'The sentence' },
          { value: 'line', label: 'The line' },
          { value: 'paragraph', label: 'The paragraph' },
        ])));
    }

""" + block('settingsrow.js') + """    return wrap;""", 'settings row'))

    # ------------------------- 7. frontmatter has to survive a round trip
    report('frontmatter: write a nested map as a map', once(
        """  function stringifyFrontmatter(props) {
    const keys = Object.keys(props || {}).filter(function (k) { return k !== '__raw'; });
    if (!keys.length && !(props && props.__raw)) return '';
    const lines = ['---'];
    keys.forEach(function (key) {
      lines.push(key + ': ' + stringifyValue(props[key]));
    });
    if (props && props.__raw) lines.push(props.__raw);
    lines.push('---', '');
    return lines.join('\\n');
  }""",
        block('fmwrite.js').rstrip('\n'), 'stringifyFrontmatter'))

    report('frontmatter: and read it back as one', once(
        """      const kv = /^([A-Za-z0-9_\\-. ]+):\\s*(.*)$/.exec(line);
      if (!kv) { unknown.push(line); continue; }

      const key = kv[1].trim();
      const rawVal = kv[2].trim();
      currentKey = key;
      if (rawVal === '') { out[key] = ''; continue; }
      out[key] = coerce(rawVal);""",
        block('fmread.js').rstrip('\n'), 'parseYaml'))

    # -------------------------------------------------------- 7. version
    report('version 10.4.0', once("""  N.version = '10.3.0';
  N.versionName = 'v10.3';""", """  N.version = '10.4.0';
  N.versionName = 'v10.4';""", 'version string'))

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
