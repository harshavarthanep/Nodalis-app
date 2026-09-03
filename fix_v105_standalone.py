#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Nodalis v10.5.0 - focus mode, the bullet preview, and a real calendar
=============================================================================

    python3 fix_v105_standalone.py index.html --dry-run
    python3 fix_v105_standalone.py index.html

Run this on the v10.4.0 file.

WHAT IS IN IT

 1. FOCUS MODE ONLY WORKED WHEN TYPEWRITER SCROLLING WAS ON - and you spotted
    exactly that. The reason is one missing call. Focus mode measures where
    the caret's paragraph sits using a hidden mirror of the textarea, and the
    code that COPIES THE TEXTAREA'S FONT ONTO THAT MIRROR lived inside the
    typewriter function. With typewriter off it never ran, so the mirror
    measured 14px text in a 649px column with no padding against a real
    editor of 16px text in a 760px column with 24px of padding. Measured: the
    clear band landed at 800px in a 770px pane - entirely off screen, so
    every word was dimmed and nothing was in focus.

 2. AND IT NOW MOVES LIKE IT SHOULD. Feathered edges instead of two hard
    cuts, and the band glides to the new paragraph instead of jumping. If the
    focused block is off screen or jammed against an edge, the editor brings
    it into view - once, gently, not on every keystroke the way typewriter
    does.

 3. THE BULLET PREVIEW IGNORED THE PER-ITEM SWITCH. With "one item, not the
    whole note" on, hovering a style in the tray still previewed the WHOLE
    page - your screenshot with every bullet turning into a diamond - and
    the tick showed the app's style rather than the style of the item your
    cursor was in. Preview, tick and commit all follow the switch now.

 4. THE CALENDAR IS A CALENDAR. Events with a time, all-day events,
    repetition (daily, weekly, every weekday, monthly, yearly), a reminder
    a chosen amount of time before, six colours, an optional linked note -
    edit and delete any of them. Holidays: mark any date, and pick which
    days are your weekend (Sunday by default, as you asked). Events live in
    their own store, so they back up, export and sync with everything else.

 5. A MOTION PASS. Views cross-fade instead of cutting, lists arrive with a
    short stagger, the month slides in the direction you navigated, buttons
    answer a press, and the day panel changes without a flash. Every one of
    them is off when animations are set to none or the system asks for
    reduced motion.

 6. VERSION 10.5.0, dated today.
=============================================================================
"""

import io
import os
import sys


# --------------------------------------------------------- the calendar blocks
#
# Inlined rather than imported: this file has to be the only thing you copy
# into the repo and run.
CAL = {}


# --------------------------------------------------------------- the store

CAL['dbstore.js'] = r"""    events:      { keyPath: 'id', indexes: [['date', 'date', false], ['updatedAt', 'updatedAt', false]] },
"""

CAL['events.js'] = r'''
/* ===== js/features/calevents.js ===== */
/* =========================================================================
 * Nodalis — features/calevents.js
 *
 * v10.5: THE CALENDAR GETS THINGS OF ITS OWN.
 *
 * Until now the calendar was a rear-view mirror: it showed notes you had
 * written, tasks that were due, reminders you had set. Everything on it was a
 * side effect of something else. You could not put "dentist, Thursday, 3pm"
 * anywhere.
 *
 * An event is its own record in its own store, so it is backed up, exported
 * and synced with everything else rather than living in a settings blob.
 *
 * Recurrence is EXPANDED ON READ rather than stored as copies. One record
 * says "every Tuesday"; the month grid asks what falls between two dates and
 * gets the occurrences. Editing the record therefore edits every occurrence,
 * which is what people mean by "move my weekly stand-up", and deleting it
 * deletes the series - the alternative (storing hundreds of rows) makes both
 * of those questions ambiguous.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N && N.util;
  if (!U || typeof U.el !== 'function') return;
  const el = U.el;

  const COLOURS = [
    { id: 'blue',   label: 'Blue' },
    { id: 'green',  label: 'Green' },
    { id: 'amber',  label: 'Amber' },
    { id: 'red',    label: 'Red' },
    { id: 'violet', label: 'Violet' },
    { id: 'grey',   label: 'Grey' },
  ];

  const REPEATS = [
    { id: 'none',     label: 'Does not repeat' },
    { id: 'daily',    label: 'Every day' },
    { id: 'weekdays', label: 'Every weekday' },
    { id: 'weekly',   label: 'Every week' },
    { id: 'monthly',  label: 'Every month' },
    { id: 'yearly',   label: 'Every year' },
  ];

  /* Minutes before. null means "no reminder". */
  const LEADS = [
    { id: '', label: 'No reminder' },
    { id: '0', label: 'At the time' },
    { id: '5', label: '5 minutes before' },
    { id: '15', label: '15 minutes before' },
    { id: '30', label: '30 minutes before' },
    { id: '60', label: '1 hour before' },
    { id: '120', label: '2 hours before' },
    { id: '1440', label: '1 day before' },
    { id: '2880', label: '2 days before' },
    { id: '10080', label: '1 week before' },
  ];

  function all() {
    try { return Array.from(N.store.state.events.values()); }
    catch (err) { return []; }
  }

  function get(id) {
    try { return N.store.state.events.get(id) || null; }
    catch (err) { return null; }
  }

  /* ------------------------------------------------------------ recurrence */

  function toDate(key) { return U.parseDayKey(key); }
  function keyOf(d) { return U.todayKey(d); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  /**
   * Every date this event falls on between two day keys, inclusive.
   *
   * Walks forward from the event's own date rather than from the range start,
   * because "every month on the 31st" is only answerable from the original
   * day-of-month - and a February that has no 31st simply has no occurrence,
   * which is the behaviour every calendar people already use has settled on.
   */
  function occurrencesIn(ev, fromKey, toKey) {
    const out = [];
    if (!ev || !ev.date) return out;
    const start = toDate(ev.date);
    const from = toDate(fromKey);
    const to = toDate(toKey);
    if (!start || !from || !to) return out;
    const until = ev.repeatUntil ? toDate(ev.repeatUntil) : null;
    const repeat = ev.repeat || 'none';

    if (repeat === 'none') {
      if (start >= from && start <= to) out.push(keyOf(start));
      return out;
    }

    /* A hard ceiling: a runaway rule must never be able to hang the grid. */
    const MAX = 800;
    let guard = 0;

    if (repeat === 'monthly' || repeat === 'yearly') {
      const dom = start.getDate();
      let y = from.getFullYear();
      let m = repeat === 'yearly' ? start.getMonth() : from.getMonth();
      if (repeat === 'yearly' && new Date(y, m, dom) < from) y += 1;
      while (guard++ < MAX) {
        const d = new Date(y, m, dom);
        /* new Date(2026, 1, 31) rolls into March - that month has no 31st. */
        if (d.getDate() === dom && d.getMonth() === m % 12) {
          if (d > to) break;
          if (d >= from && d >= start && (!until || d <= until)) out.push(keyOf(d));
        } else if (new Date(y, m, 1) > to) break;
        if (repeat === 'yearly') y += 1;
        else { m += 1; if (m > 11) { m = 0; y += 1; } }
      }
      return out;
    }

    let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    /* Skip cheaply to the range rather than stepping a day at a time from an
       event set years ago. */
    if (d < from) {
      const step = repeat === 'weekly' ? 7 : 1;
      const gap = Math.floor((from - d) / 86400000);
      d = addDays(d, Math.max(0, Math.floor(gap / step) * step));
    }
    while (d <= to && guard++ < MAX) {
      if (d >= from && d >= start && (!until || d <= until)) {
        const dow = d.getDay();
        if (repeat !== 'weekdays' || (dow !== 0 && dow !== 6)) out.push(keyOf(d));
      }
      d = addDays(d, repeat === 'weekly' ? 7 : 1);
    }
    return out;
  }

  /** Everything that falls in a range, as {key -> [event, …]}. */
  function byDay(fromKey, toKey) {
    const map = new Map();
    all().forEach(function (ev) {
      occurrencesIn(ev, fromKey, toKey).forEach(function (k) {
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(ev);
      });
    });
    map.forEach(function (list) {
      list.sort(function (a, b) {
        if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
        return String(a.time || '').localeCompare(String(b.time || '')) ||
               String(a.title || '').localeCompare(String(b.title || ''));
      });
    });
    return map;
  }

  function describe(ev) {
    const bits = [];
    /* The row's own time column already says "All day", so saying it here
       too printed it twice. The times are only here for the agenda, which
       has no separate column. */
    if (!ev.allDay && ev.time) bits.push(ev.endTime ? ev.time + ' – ' + ev.endTime : ev.time);
    const rep = REPEATS.filter(function (r) { return r.id === (ev.repeat || 'none'); })[0];
    if (rep && rep.id !== 'none') bits.push(rep.label.toLowerCase());
    if (ev.remindLead !== null && ev.remindLead !== undefined && ev.remindLead !== '') {
      const lead = LEADS.filter(function (l) { return l.id === String(ev.remindLead); })[0];
      if (lead && lead.id) bits.push(lead.label.toLowerCase());
    }
    return bits.join(' · ');
  }

  /* ------------------------------------------------------------- holidays */

  function weekendDays() {
    const raw = N.store.state.settings.weekendDays;
    if (Array.isArray(raw)) return raw.map(Number).filter(function (n) { return n >= 0 && n <= 6; });
    /* Sunday, as asked for, and the honest default for most of the world. */
    return [0];
  }

  function holidayMap() {
    const raw = N.store.state.settings.holidays;
    return (raw && typeof raw === 'object') ? raw : {};
  }

  function holidayFor(key) {
    const map = holidayMap();
    if (map[key]) return String(map[key]);
    /* A bare "YYYY" prefix is not supported on purpose: a holiday that
       repeats every year is an event with repeat: yearly, and having one
       idea for "this day is off" rather than two is worth more than the
       shortcut. */
    return null;
  }

  function isWeekend(key) {
    const d = toDate(key);
    if (!d) return false;
    return weekendDays().indexOf(d.getDay()) !== -1;
  }

  async function setHoliday(key, label) {
    const map = Object.assign({}, holidayMap());
    if (label) map[key] = String(label);
    else delete map[key];
    await N.store.setSetting('holidays', map);
  }

  /* ----------------------------------------------------------- write path */

  function blank(dayKey) {
    return {
      id: '', title: '', date: dayKey || U.todayKey(),
      allDay: true, time: '', endTime: '', notes: '',
      colour: 'blue', repeat: 'none', repeatUntil: '',
      remindLead: String(N.store.state.settings.eventReminderLead || ''),
      noteId: null,
    };
  }

  async function save(draft) {
    const rec = Object.assign({}, draft);
    rec.id = rec.id || U.uid('ev');
    rec.title = String(rec.title || '').trim() || 'Untitled event';
    rec.allDay = !!rec.allDay;
    if (rec.allDay) { rec.time = ''; rec.endTime = ''; }
    rec.createdAt = rec.createdAt || Date.now();
    await N.store.saveRecord('events', rec);
    await scheduleReminder(rec);
    N.bus.emit('events:changed', rec);
    return rec;
  }

  async function remove(id) {
    const rec = get(id);
    if (!rec) return false;
    await N.store.deleteRecord('events', id);
    /* Take its reminder with it, or the notification outlives the event. */
    try {
      (N.remind && N.remind.all ? N.remind.all() : []).forEach(function (r) {
        if (r.kind === 'event' && r.refId === id && N.remind.remove) N.remind.remove(r.id);
      });
    } catch (err) { /* the reminder module is optional */ }
    N.bus.emit('events:changed', null);
    return true;
  }

  /**
   * One reminder, for the next occurrence that is still ahead.
   *
   * Not one per occurrence: a daily event would otherwise schedule hundreds
   * of notifications, and the reminder module already re-checks on every
   * boot, so the next one is enough to keep the chain going.
   */
  async function scheduleReminder(rec) {
    try {
      if (!N.remind || !N.remind.create) return;
      const lead = rec.remindLead === '' || rec.remindLead === null || rec.remindLead === undefined
        ? null : Number(rec.remindLead);
      /* Clear any reminder this event already had - the time may have moved. */
      (N.remind.all ? N.remind.all() : []).forEach(function (r) {
        if (r.kind === 'event' && r.refId === rec.id && N.remind.remove) N.remind.remove(r.id);
      });
      if (lead === null || !isFinite(lead)) return;
      const todayK = U.todayKey();
      const horizon = keyOf(addDays(new Date(), 400));
      const keys = occurrencesIn(rec, todayK, horizon);
      for (let i = 0; i < keys.length; i++) {
        const at = whenOf(rec, keys[i]) - lead * 60000;
        if (at > Date.now() + 1000) {
          await N.remind.create('event', rec.id, rec.title, 'Calendar', at, 'none');
          return;
        }
      }
    } catch (err) { console.warn('[events] reminder not scheduled', err); }
  }

  /** The moment an occurrence starts, as a timestamp. */
  function whenOf(ev, key) {
    const d = toDate(key) || new Date();
    if (ev.allDay || !ev.time) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0).getTime();
    const bits = String(ev.time).split(':');
    const hh = Math.min(23, Math.max(0, Number(bits[0]) || 0));
    const mm = Math.min(59, Math.max(0, Number(bits[1]) || 0));
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0).getTime();
  }

  /* ---------------------------------------------------------- the editor */

  function openEditor(opts) {
    const o = opts || {};
    const existing = o.id ? get(o.id) : null;
    const draft = Object.assign(blank(o.date), existing || {});
    if (existing) draft.remindLead = existing.remindLead === null || existing.remindLead === undefined
      ? '' : String(existing.remindLead);

    let title, date, allDay, time, endTime, repeat, until, lead, notes, colour, timeRow, untilRow;

    const api = N.modal.open({
      title: existing ? 'Edit event' : 'New event',
      size: 'md',
      dismissValue: null,
      showClose: true,
      render: function () {
        const wrap = el('div.ev-form');

        title = field('Title', el('input.field', {
          type: 'text', value: draft.title, placeholder: 'Dentist', 'data-autofocus': '',
        }));
        wrap.appendChild(title.row);

        date = field('Date', el('input.field', { type: 'date', value: draft.date }));
        colour = el('div.ev-colours');
        COLOURS.forEach(function (c) {
          const dot = el('button.ev-colour' + (c.id === draft.colour ? '.is-on' : ''), {
            type: 'button', dataset: { colour: c.id }, title: c.label, 'aria-label': c.label,
          });
          dot.addEventListener('click', function () {
            draft.colour = c.id;
            U.$$('.ev-colour', colour).forEach(function (b) {
              b.classList.toggle('is-on', b.dataset.colour === c.id);
            });
          });
          colour.appendChild(dot);
        });
        const dc = el('div.ev-two');
        dc.appendChild(date.row);
        dc.appendChild(field('Colour', colour).row);
        wrap.appendChild(dc);

        allDay = el('input', { type: 'checkbox' });
        allDay.checked = !!draft.allDay;
        const adLabel = el('label.ev-check', null, [allDay, el('span', null, 'All day')]);
        wrap.appendChild(adLabel);

        time = el('input.field', { type: 'time', value: draft.time || '09:00' });
        endTime = el('input.field', { type: 'time', value: draft.endTime || '' });
        timeRow = el('div.ev-two');
        timeRow.appendChild(field('Starts', time).row);
        timeRow.appendChild(field('Ends (optional)', endTime).row);
        wrap.appendChild(timeRow);
        const syncAllDay = function () { timeRow.hidden = allDay.checked; };
        allDay.addEventListener('change', syncAllDay);
        syncAllDay();

        repeat = el('select.field');
        REPEATS.forEach(function (r) {
          repeat.appendChild(el('option', { value: r.id, selected: r.id === (draft.repeat || 'none') }, r.label));
        });
        until = el('input.field', { type: 'date', value: draft.repeatUntil || '' });
        untilRow = field('Until (optional)', until);
        const rr = el('div.ev-two');
        rr.appendChild(field('Repeats', repeat).row);
        rr.appendChild(untilRow.row);
        wrap.appendChild(rr);
        const syncRepeat = function () { untilRow.row.hidden = repeat.value === 'none'; };
        repeat.addEventListener('change', syncRepeat);
        syncRepeat();

        lead = el('select.field');
        LEADS.forEach(function (l) {
          lead.appendChild(el('option', { value: l.id, selected: l.id === String(draft.remindLead || '') }, l.label));
        });
        wrap.appendChild(field('Remind me', lead).row);

        notes = el('textarea.field', { placeholder: 'Anything worth remembering', style: { minHeight: '76px' } });
        notes.value = draft.notes || '';
        wrap.appendChild(field('Notes', notes).row);

        return wrap;
      },
      footer: function (a) {
        const out = [];
        if (existing) {
          const del = el('button.btn.btn-danger', { type: 'button' }, 'Delete');
          del.addEventListener('click', async function () {
            const yes = await N.modal.confirm({
              title: 'Delete this event?',
              message: (existing.repeat && existing.repeat !== 'none')
                ? '"' + existing.title + '" repeats, so every occurrence goes with it.'
                : '"' + existing.title + '" will be deleted.',
              confirmLabel: 'Delete', danger: true,
            });
            if (!yes) return;
            await remove(existing.id);
            a.close('deleted');
            N.toast.success('Event deleted', { ms: 2200 });
          });
          out.push(del);
        }
        out.push(el('button.btn', { type: 'button', onclick: function () { a.close(null); } }, 'Cancel'));
        out.push(el('button.btn.btn-primary', {
          type: 'button',
          onclick: async function () {
            const next = Object.assign({}, draft, {
              title: title.input.value,
              date: date.input.value || draft.date,
              allDay: allDay.checked,
              time: allDay.checked ? '' : time.value,
              endTime: allDay.checked ? '' : endTime.value,
              repeat: repeat.value,
              repeatUntil: repeat.value === 'none' ? '' : until.value,
              remindLead: lead.value,
              notes: notes.value,
            });
            if (!String(next.title).trim()) { title.input.focus(); return; }
            const saved = await save(next);
            a.close(saved);
            N.toast.success(existing ? 'Event updated' : 'Event added', { ms: 2000 });
          },
        }, existing ? 'Save' : 'Add event'));
        return out;
      },
    });

    function field(label, input) {
      const row = el('div.ev-field');
      row.appendChild(el('label.ev-label', null, label));
      row.appendChild(input);
      return { row: row, input: input };
    }

    return api.promise;
  }

  /** The little menu on an event row: edit, duplicate, delete. */
  function openRowMenu(id, anchor, onDone) {
    const ev = get(id);
    if (!ev) return;
    N.menu.show([
      { header: U.truncate(ev.title, 40) },
      { label: 'Edit…', icon: 'edit', onClick: async function () {
          await openEditor({ id: id }); if (onDone) onDone(); } },
      { label: 'Duplicate', icon: 'duplicate', onClick: async function () {
          const copy = Object.assign({}, ev, { id: '', title: ev.title + ' (copy)' });
          await save(copy); if (onDone) onDone(); } },
      { separator: true },
      { label: 'Delete…', icon: 'trash', danger: true, onClick: async function () {
          const yes = await N.modal.confirm({
            title: 'Delete this event?',
            message: (ev.repeat && ev.repeat !== 'none')
              ? '"' + ev.title + '" repeats, so every occurrence goes with it.'
              : '"' + ev.title + '" will be deleted.',
            confirmLabel: 'Delete', danger: true,
          });
          if (!yes) return;
          await remove(id);
          if (onDone) onDone();
        } },
    ], { anchor: anchor, align: 'right' });
  }

  N.calevents = {
    all: all, get: get, save: save, remove: remove,
    byDay: byDay, occurrencesIn: occurrencesIn, describe: describe, whenOf: whenOf,
    openEditor: openEditor, openRowMenu: openRowMenu,
    weekendDays: weekendDays, holidayFor: holidayFor, isWeekend: isWeekend,
    setHoliday: setHoliday, holidayMap: holidayMap,
    COLOURS: COLOURS, REPEATS: REPEATS, LEADS: LEADS,
  };
})(window.NODALIS = window.NODALIS || {});

'''

# ------------------------------------------------------- calendar wiring

CAL['types.js'] = r"""  const TYPES = [
    /* v10.5: events come first because they are the only things on this
       calendar that someone put there deliberately. */
    { id: 'event',    label: 'Events',         icon: 'calendar' },
    { id: 'holiday',  label: 'Holidays',       icon: 'sun' },
    { id: 'created',  label: 'Notes created',  icon: 'file-plus' },
    { id: 'edited',   label: 'Notes edited',   icon: 'edit' },
    { id: 'task',     label: 'Tasks due',      icon: 'list-check' },
    { id: 'sticky',   label: 'Stickies',       icon: 'sticky' },
    { id: 'reminder', label: 'Reminders',      icon: 'clock' },
    { id: 'daily',    label: 'Daily notes',    icon: 'flame' },
  ];
"""

CAL['gather.js'] = r"""    /*
     * v10.5: the events and holidays this calendar owns.
     *
     * Gathered over a window rather than "all time" because a repeating event
     * has no end: expanding one takes a range, and the grid plus the agenda
     * is at most a few months wide.
     */
    try {
      if (N.calevents) {
        const anchor = cursor || new Date();
        const from = U.todayKey(new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1));
        const to = U.todayKey(new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0));
        N.calevents.byDay(from, to).forEach(function (list, key) {
          list.forEach(function (ev) {
            push(key, {
              type: 'event', label: ev.label || ev.title, sub: N.calevents.describe(ev),
              eventId: ev.id, colour: ev.colour || 'blue',
              at: ev.allDay ? null : N.calevents.whenOf(ev, key),
              allDay: !!ev.allDay,
            });
          });
        });
        const map = N.calevents.holidayMap();
        Object.keys(map).forEach(function (key) {
          push(key, { type: 'holiday', label: String(map[key]) || 'Holiday', sub: 'Holiday', at: null, holiday: key });
        });
      }
    } catch (err) { console.warn('[calendar] events unavailable', err); }

    return days;
"""

CAL['cellstate.js'] = r"""      if (d.getMonth() !== month) cell.classList.add('is-other');
      if (key === todayK) cell.classList.add('is-today');
      if (key === selected) cell.classList.add('is-selected');
      /*
       * v10.5: a weekend and a holiday are properties of the DAY, not items
       * on it, so they tint the cell instead of adding another dot to count.
       */
      try {
        if (N.calevents) {
          if (N.calevents.isWeekend(key)) cell.classList.add('is-weekend');
          const hol = N.calevents.holidayFor(key);
          if (hol) {
            cell.classList.add('is-holiday');
            cell.title = hol;
          }
        }
      } catch (err) { /* tinting is a courtesy */ }
"""

CAL['dayadd.js'] = r"""    /* v10.5: the button this calendar was missing. */
    const addEv = el('button.btn.btn-sm.btn-primary', { type: 'button' });
    addEv.appendChild(N.icons.node('calendar', { size: 14 }));
    addEv.appendChild(el('span', null, 'Add event'));
    addEv.addEventListener('click', async function () {
      if (!N.calevents) return;
      const made = await N.calevents.openEditor({ date: key });
      if (made) render();
    });
    actions.appendChild(addEv);

    const mk = el('button.btn.btn-sm', { type: 'button' });
"""

CAL['dayrow.js'] = r"""      /* v10.5: an event row is editable - that is the whole point of it. */
      if (e.type === 'event' && e.eventId && N.calevents) {
        row.classList.add('is-event');
        row.dataset.colour = e.colour || 'blue';
        const more = el('button.cal-row-more', {
          type: 'button', title: 'More for this event',
          'aria-label': 'More actions for ' + e.label,
        });
        more.appendChild(N.icons.node('more-horizontal', { size: 15 }));
        more.addEventListener('click', function (ev2) {
          ev2.stopPropagation();
          N.calevents.openRowMenu(e.eventId, ev2.currentTarget, function () { render(); });
        });
        row.appendChild(more);
      }
      if (e.type === 'holiday') row.classList.add('is-holiday-row');
"""

CAL['openentry.js'] = r"""    /* v10.5: opening an event means editing it. */
    if (entry.eventId && N.calevents) {
      N.calevents.openEditor({ id: entry.eventId }).then(function (r) { if (r) render(); });
      return;
    }
    if (entry.holiday && N.calevents) {
      editHoliday(entry.holiday);
      return;
    }
"""

CAL['holidayfns.js'] = r"""  /** Name, rename or clear the holiday on a day. */
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

"""

CAL['dayholiday.js'] = r"""    /* v10.5: mark the day itself, from the day it is about. */
    if (N.calevents) {
      const hol = N.calevents.holidayFor(key);
      const hb = el('button.btn.btn-sm' + (hol ? '.is-on' : ''), {
        type: 'button', title: hol ? 'Holiday: ' + hol : 'Mark this day as a holiday',
      });
      hb.appendChild(N.icons.node('sun', { size: 14 }));
      hb.appendChild(el('span', null, hol ? 'Holiday' : 'Mark holiday'));
      hb.addEventListener('click', function () { editHoliday(key); });
      actions.appendChild(hb);
    }
"""

# --------------------------------------------------------------- the CSS

CAL['calcss.css'] = r'''
/* ===== v10.5: events, holidays and the event editor ===== */

/*
 * Event colours are fixed hues rather than theme variables for the same
 * reason the calendar's category dots are: six of them have to stay apart
 * from each other AND from the accent, in six themes and two modes. They are
 * mixed with the surface so they sit in the page rather than on top of it.
 */
.cal-day.is-weekend { background: color-mix(in oklab, var(--text-1) 3%, transparent); }
.cal-day.is-holiday { background: color-mix(in oklab, #e0245e 9%, transparent); }
.cal-day.is-holiday .cal-daynum { color: #c31c4d; font-weight: 650; }
.cal-day.is-holiday.is-selected .cal-daynum { color: inherit; }

.cal-dot[data-type='event']   { background: #2f6fed; }
.cal-dot[data-type='holiday'] { background: #e0245e; }

.cal-row.is-event { position: relative; }
.cal-row.is-event .cal-dot { background: #2f6fed; }
.cal-row.is-event[data-colour='green']  .cal-dot { background: #1f9d55; }
.cal-row.is-event[data-colour='amber']  .cal-dot { background: #c67c06; }
.cal-row.is-event[data-colour='red']    .cal-dot { background: #d93636; }
.cal-row.is-event[data-colour='violet'] .cal-dot { background: #7b5cf0; }
.cal-row.is-event[data-colour='grey']   .cal-dot { background: var(--text-3); }
.cal-row.is-holiday-row .cal-dot { background: #e0245e; }

.cal-row-more {
  flex: 0 0 auto;
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  margin-left: auto;
  border: 0; padding: 0; border-radius: var(--radius-2, 6px);
  background: transparent; color: var(--text-3);
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}
.cal-row:hover .cal-row-more,
.cal-row:focus-within .cal-row-more,
.cal-row-more:focus-visible { opacity: 1; }
.cal-row-more:hover { background: var(--bg-2); color: var(--text-1); }
/* A finger cannot hover, so on touch it is simply always there. */
@media (hover: none) { .cal-row-more { opacity: 1; } }

/* the event editor */
.ev-form { display: flex; flex-direction: column; gap: 12px; }
.ev-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.ev-label { font-size: var(--text-xs); color: var(--text-2); font-weight: 600; }
.ev-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .ev-two { grid-template-columns: 1fr; } }
.ev-check { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); cursor: pointer; }
.ev-colours { display: flex; align-items: center; gap: 8px; padding-top: 4px; flex-wrap: wrap; }
.ev-colour {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer; padding: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  transition: transform 120ms var(--ease-out), border-color 120ms ease;
}
.ev-colour:hover { transform: scale(1.12); }
.ev-colour.is-on { border-color: var(--text-1); }
.ev-colour:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ev-colour[data-colour='blue']   { background: #2f6fed; }
.ev-colour[data-colour='green']  { background: #1f9d55; }
.ev-colour[data-colour='amber']  { background: #c67c06; }
.ev-colour[data-colour='red']    { background: #d93636; }
.ev-colour[data-colour='violet'] { background: #7b5cf0; }
.ev-colour[data-colour='grey']   { background: #8a8f98; }

/* the holidays editor in settings */
.hol-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.hol-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-2, 8px);
  font-size: var(--text-sm);
}
.hol-row-date { color: var(--text-2); font-variant-numeric: tabular-nums; flex: 0 0 auto; }
.hol-row-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hol-empty { color: var(--text-3); font-size: var(--text-xs); margin-top: 10px; }
.wk-days { display: flex; gap: 6px; flex-wrap: wrap; }
.wk-day {
  min-width: 42px; padding: 6px 8px;
  border: 1px solid var(--border); border-radius: var(--radius-2, 7px);
  background: transparent; color: var(--text-2);
  font-size: var(--text-xs); cursor: pointer;
}
.wk-day.is-on { background: var(--accent); border-color: var(--accent); color: var(--accent-on, #fff); }
.wk-day:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
'''

# ------------------------------------------------------------- the settings

CAL['calsettings.js'] = r"""  function renderCalendar() {
    const wrap = section('Calendar',
      'Events you put on the calendar yourself, and which days count as time off.');

    wrap.appendChild(row('Week starts on', 'Affects the calendar view and the heat-map.',
      select('weekStartsOn', [{ value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }])));

    /* Weekend days, as buttons - a multi-select is the one thing a <select>
       is genuinely bad at, and there are only seven. */
    const days = el('div.wk-days');
    const sunday = new Date(2023, 0, 1);   /* 1 Jan 2023 was a Sunday */
    const chosen = function () {
      const raw = s().weekendDays;
      return Array.isArray(raw) ? raw.map(Number) : [0];
    };
    for (let i = 0; i < 7; i++) {
      const d = new Date(2023, 0, 1 + i);
      const num = d.getDay();
      const btn = el('button.wk-day' + (chosen().indexOf(num) !== -1 ? '.is-on' : ''), {
        type: 'button', dataset: { day: String(num) },
        'aria-pressed': String(chosen().indexOf(num) !== -1),
      }, d.toLocaleDateString(undefined, { weekday: 'short' }));
      btn.addEventListener('click', async function () {
        const now = chosen();
        const at = now.indexOf(num);
        if (at === -1) now.push(num); else now.splice(at, 1);
        await N.store.setSetting('weekendDays', now.sort());
        btn.classList.toggle('is-on', now.indexOf(num) !== -1);
        btn.setAttribute('aria-pressed', String(now.indexOf(num) !== -1));
        try { if (N.calendar && N.calendar.render) N.calendar.render(); } catch (err) {}
      });
      days.appendChild(btn);
    }
    wrap.appendChild(row('Weekend', 'Tinted on the calendar. Sunday to begin with.', days));

    wrap.appendChild(row('Remind me by default',
      'What a new event starts with. You can change it per event.',
      select('eventReminderLead', (N.calevents ? N.calevents.LEADS : [{ id: '', label: 'No reminder' }])
        .map(function (l) { return { value: l.id, label: l.label }; }))));

    /* holidays */
    const holWrap = el('div.settings-section');
    holWrap.appendChild(el('div.setting-name', { style: { marginBottom: '6px' } }, 'Holidays'));
    holWrap.appendChild(el('div.setting-desc', { style: { marginBottom: '10px' } },
      'Days marked as time off. You can also mark one from the calendar itself — pick a day and press “Mark holiday”.'));

    const addRow = el('div.row', { style: { gap: '8px', flexWrap: 'wrap' } });
    const hDate = el('input.field', { type: 'date', style: { maxWidth: '190px' } });
    const hName = el('input.field', { type: 'text', placeholder: 'Name', style: { flex: '1 1 160px', minWidth: '0' } });
    const hAdd = el('button.btn.btn-primary', { type: 'button' }, 'Add');
    addRow.appendChild(hDate); addRow.appendChild(hName); addRow.appendChild(hAdd);
    holWrap.appendChild(addRow);

    const list = el('div.hol-list');
    const paint = function () {
      U.clear(list);
      const map = N.calevents ? N.calevents.holidayMap() : {};
      const keys = Object.keys(map).sort();
      if (!keys.length) {
        list.appendChild(el('div.hol-empty', null, 'No holidays marked yet.'));
        return;
      }
      keys.forEach(function (k) {
        const r = el('div.hol-row');
        r.appendChild(el('span.hol-row-date', null, k));
        r.appendChild(el('span.hol-row-name', null, String(map[k])));
        const del = el('button.btn.btn-sm', { type: 'button', title: 'Remove' });
        del.appendChild(N.icons.node('close', { size: 13 }));
        del.addEventListener('click', async function () {
          await N.calevents.setHoliday(k, '');
          paint();
          try { if (N.calendar && N.calendar.render) N.calendar.render(); } catch (err) {}
        });
        r.appendChild(del);
        list.appendChild(r);
      });
    };
    hAdd.addEventListener('click', async function () {
      const key = hDate.value;
      if (!key || !N.calevents) return;
      await N.calevents.setHoliday(key, hName.value.trim() || 'Holiday');
      hName.value = '';
      paint();
      try { if (N.calendar && N.calendar.render) N.calendar.render(); } catch (err) {}
    });
    paint();
    holWrap.appendChild(list);
    wrap.appendChild(holWrap);

    return wrap;
  }

"""


# ---------------------------------------------------------------- the blocks

_BLOCKS = {}

# ------------------------------------------------------------------ focus mode

_BLOCKS['syncmirror.js'] = r'''  /*
   * v10.5: THE MIRROR HAS TO LOOK LIKE THE TEXTAREA, WHOEVER IS ASKING.
   *
   * This copying used to live inside caretTop(), which only typewriter
   * scrolling calls. So with typewriter off, focus mode measured paragraph
   * positions against an UNSTYLED mirror. Measured on a real note:
   *
   *              mirror        textarea
   *   width      648.9px       760px
   *   font-size  14px          16px
   *   line-height 21px         27.2px
   *   padding-top 0px          24px
   *
   * Every offset was therefore wrong, and the clear band landed at 800px in
   * a 770px pane - off the bottom, so the whole page read as dimmed and
   * nothing was in focus. Turning typewriter on styled the mirror as a side
   * effect, which is exactly why focus mode "only worked with typewriter
   * scrolling on".
   *
   * One function, called by both. There is no third way to measure this.
   */
  function syncMirror() {
    const m = ensureMirror();
    if (!ta) return m;
    const cs = getComputedStyle(ta);
    [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderLeftWidth', 'textTransform', 'wordSpacing',
    ].forEach(function (prop) { m.style[prop] = cs[prop]; });
    m.style.width = ta.clientWidth + 'px';
    m.style.whiteSpace = 'pre-wrap';
    m.style.wordBreak = cs.wordBreak;
    m.style.overflowWrap = cs.overflowWrap;
    return m;
  }

'''

_BLOCKS['paintfocus.js'] = r'''    const topPx = offsetOf(start);
    const bottomPx = offsetOf(end);
    if (topPx === null || bottomPx === null) return;
    const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 24;
    const height = Math.max(lineH, bottomPx - topPx + lineH);

    /*
     * v10.5: OFFSET BY WHATEVER ACTUALLY SCROLLS.
     *
     * The band is drawn inside the pane, so it has to be moved by however far
     * the text has scrolled - and the text does not always scroll inside the
     * textarea. When the pane is the scroller, the old code subtracted
     * nothing at all and the band drifted away from the paragraph as you
     * moved down the note.
     */
    const box = scroller();
    const shift = box ? box.scrollTop : 0;
    band.style.setProperty('--band-top', (topPx - shift) + 'px');
    band.style.setProperty('--band-height', height + 'px');

    /*
     * And if the focused block is off screen, or pressed right up against an
     * edge, bring it into view. Not on every keystroke - that is typewriter
     * scrolling, which is a separate preference - only when the thing you are
     * meant to be looking at is somewhere you cannot comfortably look.
     */
    keepBandInView(box, topPx, height);
  }

  function keepBandInView(box, topPx, height) {
    if (!box) return;
    const view = box.clientHeight;
    if (view < 120) return;
    const margin = Math.max(48, Math.round(view * 0.12));
    const top = topPx - box.scrollTop;
    const bottom = top + height;
    let want = null;
    if (top < margin) want = Math.max(0, topPx - margin);
    else if (bottom > view - margin) want = topPx + height - view + margin;
    if (want === null) return;
    const max = Math.max(0, box.scrollHeight - box.clientHeight);
    const target = Math.max(0, Math.min(max, Math.round(want)));
    if (Math.abs(box.scrollTop - target) < 4) return;
    const smooth = N.store.state.settings.animations !== 'none' &&
      !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    try {
      if (smooth && box.scrollTo) box.scrollTo({ top: target, behavior: 'smooth' });
      else box.scrollTop = target;
    } catch (err) { box.scrollTop = target; }
  }
'''

_BLOCKS['focuscss.css'] = r'''
/* ===== v10.5: focus mode that moves, and does not cut ===== */

/*
 * A custom property has to be registered before it can be transitioned -
 * without @property the browser treats --band-top as an opaque string and
 * jumps straight to the new value. Where @property is unsupported the band
 * simply snaps, which is what it did before, so nothing is lost.
 */
@property --band-top {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}
@property --band-height {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

.focus-band {
  /*
   * Two hard cuts read as a rectangle sitting on the text. A short ramp at
   * each edge reads as attention instead - the same idea as a vignette, and
   * the reason Apple's own focus treatments never show a seam.
   */
  --band-feather: 26px;
  background: linear-gradient(
    to bottom,
    var(--bg-editor) 0,
    var(--bg-editor) max(0px, calc(var(--band-top) - var(--band-feather))),
    transparent var(--band-top),
    transparent calc(var(--band-top) + var(--band-height)),
    var(--bg-editor) calc(var(--band-top) + var(--band-height) + var(--band-feather)),
    var(--bg-editor) 100%
  ) !important;
  transition:
    opacity var(--dur-fast) var(--ease-out),
    --band-top 220ms cubic-bezier(0.32, 0.72, 0, 1),
    --band-height 220ms cubic-bezier(0.32, 0.72, 0, 1);
}
[data-animations='none'] .focus-band { transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .focus-band { transition: none !important; }
}
'''

# --------------------------------------------------------------- bullet preview

_BLOCKS['bulletscope.js'] = r'''  /*
   * v10.5: THE PREVIEW HAS TO OBEY THE SWITCH.
   *
   * previewBulletStyle() wrote body[data-bullet-style], which repaints every
   * bullet in the document. With "one item, not the whole note" switched on
   * that is the wrong thing twice over: hovering a style redrew the entire
   * page (every bullet turning into a diamond at once), and the tick in the
   * tray showed the app's style rather than the style of the item the cursor
   * was actually in.
   *
   * When the switch is on and the caret is in a bullet, the preview is
   * written onto that ONE rendered <li> - the same data-nd-bullet attribute a
   * committed style uses, so what you see while hovering is exactly what you
   * get on click. Otherwise nothing changes and the old app-wide preview
   * stands.
   */
  function itemBulletScope() {
    try {
      if (!N.store.state.settings.bulletScopeItem) return null;
      if (!N.theme || typeof N.theme.canStyleThisItem !== 'function') return null;
      if (!N.theme.canStyleThisItem()) return null;
      const ta = N.editor && N.editor.getTextarea ? N.editor.getTextarea() : null;
      const noteId = N.editor && N.editor.currentNoteId ? N.editor.currentNoteId() : null;
      if (!ta || !noteId) return null;
      const value = String(ta.value || '');
      const line = value.slice(0, ta.selectionStart || 0).split('\n').length - 1;
      const note = N.store.getNote(noteId);
      const map = (note && note.properties && note.properties.bullets) || {};
      return {
        line: line,
        current: map[String(line)] || (N.store.state.settings.bulletStyle || 'disc'),
      };
    } catch (err) { return null; }
  }

  /** The rendered <li> for a source line, if the preview is on screen. */
  function itemNodeFor(line) {
    try {
      const pane = N.editor && N.editor.getPreview ? N.editor.getPreview() : null;
      const host = pane || document;
      return host.querySelector('li[data-line="' + line + '"]');
    } catch (err) { return null; }
  }

  let itemPreview = null;   /* {node, had} while a per-item preview is showing */

  function savedBulletStyle() {
    return (N.store && N.store.state.settings.bulletStyle) || 'disc';
  }

  function previewBulletStyle(id) {
    if (!CAN_HOVER) return;
    const scope = itemBulletScope();
    if (scope) {
      const node = itemNodeFor(scope.line);
      if (!node) return;
      if (!itemPreview || itemPreview.node !== node) {
        itemPreview = { node: node, had: node.getAttribute('data-nd-bullet') };
      }
      if (id) node.setAttribute('data-nd-bullet', id);
      else if (itemPreview.had) node.setAttribute('data-nd-bullet', itemPreview.had);
      else node.removeAttribute('data-nd-bullet');
      return;
    }
    document.body.dataset.bulletStyle = id || savedBulletStyle();
  }

  /** Whatever was being previewed, what was really there comes back. */
  function endBulletPreview() {
    if (itemPreview) {
      const p = itemPreview;
      itemPreview = null;
      try {
        if (p.had) p.node.setAttribute('data-nd-bullet', p.had);
        else p.node.removeAttribute('data-nd-bullet');
      } catch (err) { /* the node went away with the render */ }
      return;
    }
    document.body.dataset.bulletStyle = savedBulletStyle();
  }
'''

_BLOCKS['bullettray.js'] = r'''  function openBulletStyles(anchor) {
    if (!N.theme || !N.theme.bulletStyles) return;
    const tray = trayAt(anchor, 'bullets');
    const scope = itemBulletScope();
    /* The tick marks what is true for what is about to change. */
    const here = scope ? scope.current : savedBulletStyle();
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
        /*
         * Painting the body attribute is only right when the choice IS
         * app-wide. Doing it while the per-item switch is on left every
         * bullet on the page repainted and the note's own override buried
         * underneath it.
         */
        itemPreview = null;
        if (!scope) document.body.dataset.bulletStyle = b.id;
        N.theme.setBulletStyle(b.id);
        N.toast.success(b.mark + '  ' + b.label +
          (scope ? '  ·  this item' : ''), { ms: 1500, key: 'bullet' });
        closeSub();
        refresh();
      });
      list.appendChild(row);
    });
    list.addEventListener('mouseleave', endBulletPreview);
    tray.appendChild(list);

    const note = el('div.sel-tray-note');
    note.appendChild(N.icons.node('info', { size: 13 }));
    note.appendChild(el('span', null, scope
      ? 'Changes this one item. On disk every bullet is still "- ".'
      : 'Only how bullets are drawn. On disk every bullet is still "- ".'));
    tray.appendChild(note);

    placeTray(tray);
  }
'''

_BLOCKS['motion.css'] = r'''
/* ===== v10.5: the motion pass =====================================
 *
 * This app already had a motion SYSTEM - --motion-scale (1 / 0.5 / 0 from
 * the animations setting, and 0 under prefers-reduced-motion), three
 * durations and named easings. So the right way to make it feel smoother
 * was to use that system in the places that were still cutting, not to
 * invent a second one. Everything below is written as
 *
 *     calc(var(--dur-x) * var(--motion-scale))
 *
 * which means every one of these is already correct at "reduced", at
 * "none", and for anyone whose system asks for less movement. No new
 * switches, nothing to remember.
 *
 * What is deliberately NOT animated: the big lists that re-render on a
 * debounce - tasks, search hits, the note tree. An entrance animation
 * there replays every time the vault changes underneath you, which reads
 * as twitching rather than as polish. The calendar's day list is the one
 * list that only re-renders when you actually ask it to, so that is the
 * one that gets a stagger.
 * ================================================================== */

@keyframes nd-month-in-next {
  from { opacity: 0; transform: translateX(14px); }
  to   { opacity: 1; transform: none; }
}
@keyframes nd-month-in-prev {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: none; }
}
@keyframes nd-rise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}

/* The month moves in the direction you asked for - the single cheapest way
   to stop "next month" feeling like a page reload. */
.cal-grid.cal-month { animation: nd-month-in-next calc(var(--dur-base) * var(--motion-scale)) var(--ease-out); }
.cal-view[data-dir='prev'] .cal-grid.cal-month { animation-name: nd-month-in-prev; }
.cal-view[data-dir='none'] .cal-grid.cal-month { animation: none; }

/* The day panel changes without a flash. */
.cal-detail { animation: nd-rise calc(var(--dur-fast) * var(--motion-scale)) var(--ease-out); }

/* And its rows arrive one after another rather than all at once. Ten is
   enough: past that the delay would be longer than anyone waits, and the
   rest simply appear. */
.cal-list > .cal-row { animation: nd-rise calc(var(--dur-base) * var(--motion-scale)) var(--ease-out) both; }
.cal-list > .cal-row:nth-child(1) { animation-delay: calc(0ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(2) { animation-delay: calc(24ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(3) { animation-delay: calc(48ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(4) { animation-delay: calc(72ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(5) { animation-delay: calc(96ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(6) { animation-delay: calc(120ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(7) { animation-delay: calc(144ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(8) { animation-delay: calc(168ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(9) { animation-delay: calc(192ms * var(--motion-scale)); }
.cal-list > .cal-row:nth-child(n+10) { animation-delay: calc(210ms * var(--motion-scale)); }

/*
 * A press should answer. The app already has a ripple on .btn; what it did
 * not have is the tiny give that makes a control feel like a physical
 * thing. 0.985 is deliberately almost nothing - enough to feel, not enough
 * to see as movement.
 */
.btn:active:not(:disabled),
.matrix-add:active,
.wk-day:active,
.nd-pick-row:active { transform: scale(0.985); }
.btn, .matrix-add, .wk-day, .nd-pick-row {
  transition: transform calc(var(--dur-instant) * var(--motion-scale)) var(--ease-out),
              background calc(var(--dur-fast) * var(--motion-scale)) ease,
              color calc(var(--dur-fast) * var(--motion-scale)) ease,
              border-color calc(var(--dur-fast) * var(--motion-scale)) ease;
}

/* A calendar day answers the pointer, and the selected ring settles rather
   than snapping. */
.cal-day {
  transition: background calc(var(--dur-fast) * var(--motion-scale)) ease,
              box-shadow calc(var(--dur-fast) * var(--motion-scale)) ease,
              transform calc(var(--dur-instant) * var(--motion-scale)) var(--ease-out);
}
.cal-day:hover:not(.is-selected) { transform: translateY(-1px); }
.cal-day:active { transform: scale(0.98); }

/* The event editor's fields settle in together with the dialog. */
.ev-form > * { animation: nd-rise calc(var(--dur-fast) * var(--motion-scale)) var(--ease-out) both; }
.ev-form > *:nth-child(2) { animation-delay: calc(18ms * var(--motion-scale)); }
.ev-form > *:nth-child(3) { animation-delay: calc(36ms * var(--motion-scale)); }
.ev-form > *:nth-child(4) { animation-delay: calc(54ms * var(--motion-scale)); }
.ev-form > *:nth-child(n+5) { animation-delay: calc(66ms * var(--motion-scale)); }

/*
 * Belt and braces. --motion-scale already makes every duration above zero,
 * but an animation with a zero duration still fires a pair of events and
 * still forces a compositor layer for a frame. On "none" there is no reason
 * to do either.
 */
[data-animations='none'] .cal-grid.cal-month,
[data-animations='none'] .cal-detail,
[data-animations='none'] .cal-list > .cal-row,
[data-animations='none'] .ev-form > * { animation: none !important; }
[data-animations='none'] .btn:active:not(:disabled),
[data-animations='none'] .cal-day:hover,
[data-animations='none'] .cal-day:active { transform: none !important; }
@media (prefers-reduced-motion: reduce) {
  .cal-grid.cal-month, .cal-detail, .cal-list > .cal-row, .ev-form > * { animation: none !important; }
  .cal-day:hover, .cal-day:active, .btn:active:not(:disabled) { transform: none !important; }
}
'''

MARKER = 'v10.5: THE MIRROR HAS TO LOOK LIKE THE TEXTAREA'
REQUIRES = 'v10.4: CLAMP AGAINST WHAT IS ON SCREEN'


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
    print(' Nodalis v10.5.0 - focus mode, the bullet preview, and a real calendar')
    print('=' * 80)
    print(' file: %s  (%d bytes)' % (path, len(src)))
    print('')

    if MARKER in src:
        print('ERROR: v10.5.0 is already installed in this file.')
        return 1
    if REQUIRES not in src:
        print('ERROR: this file is not at v10.4.0. Run fix_v104_standalone.py first.')
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
            print('   %-54s ok' % label)
        else:
            print('   %-54s FAILED' % label)
            state['fail'] += 1

    # --------------------------------------------------------- 1. focus mode
    report('focus: one mirror, styled for whoever measures it', once(
        """  function caretTop() {
    if (!ta) return null;
    const m = ensureMirror();
    const cs = getComputedStyle(ta);
    [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderLeftWidth', 'textTransform', 'wordSpacing',
    ].forEach(function (prop) { m.style[prop] = cs[prop]; });
    m.style.width = ta.clientWidth + 'px';
    m.style.whiteSpace = 'pre-wrap';
    m.style.wordBreak = cs.wordBreak;
    m.style.overflowWrap = cs.overflowWrap;
""",
        block('syncmirror.js') + """  function caretTop() {
    if (!ta) return null;
    const m = syncMirror();
""", 'syncMirror'))

    report('focus: and the band measures against it too', once(
        """  function offsetOf(index) {
    if (!ta) return null;
    const m = ensureMirror();""",
        """  function offsetOf(index) {
    if (!ta) return null;
    /* v10.5: styled first. This is the line whose absence made focus mode
       depend on typewriter scrolling being switched on. */
    const m = syncMirror();""", 'offsetOf mirror'))

    report('focus: offset by whatever scrolls, and keep it in view', once(
        """    const topPx = offsetOf(start);
    const bottomPx = offsetOf(end);
    if (topPx === null || bottomPx === null) return;
    const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 24;

    // The band is positioned inside the pane, so it has to be offset by
    // however far the text itself has scrolled.
    const box = scroller();
    const shift = box === ta ? ta.scrollTop : 0;
    band.style.setProperty('--band-top', (topPx - shift) + 'px');
    band.style.setProperty('--band-height', Math.max(lineH, bottomPx - topPx + lineH) + 'px');
  }""",
        block('paintfocus.js').rstrip('\n'), 'paintFocus'))

    report('focus: follow the pane\'s scrolling as well', once(
        """    ta.addEventListener('scroll', U.throttle(function () {
      if (enabled('focusMode')) paintFocus();
    }, 40), { passive: true });""",
        """    const onScroll = U.throttle(function () {
      if (enabled('focusMode')) paintFocus();
    }, 40);
    ta.addEventListener('scroll', onScroll, { passive: true });
    /* v10.5: the text does not always scroll inside the textarea - in split
       mode the pane around it does, and that scroll used to go unnoticed. */
    if (ta.parentElement) ta.parentElement.addEventListener('scroll', onScroll, { passive: true });""",
        'scroll listener'))

    report('focus: feathered edges and a glide', once(
        '\n</style>\n</head>',
        '\n' + block('focuscss.css') + '\n</style>\n</head>', 'focus css'))

    # ----------------------------------------------------- 2. bullet preview
    report('bullets: preview the item the switch points at', once(
        """  function savedBulletStyle() {
    return (N.store && N.store.state.settings.bulletStyle) || 'disc';
  }
  function previewBulletStyle(id) {
    if (!CAN_HOVER) return;
    document.body.dataset.bulletStyle = id || savedBulletStyle();
  }
  /** Whatever was being previewed, the saved value comes back. */
  function endBulletPreview() {
    document.body.dataset.bulletStyle = savedBulletStyle();
  }""",
        block('bulletscope.js').rstrip('\n'), 'preview scope'))

    report('bullets: the tick and the commit follow it too', once(
        """  function openBulletStyles(anchor) {
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
  }""",
        block('bullettray.js').rstrip('\n'), 'bullet tray'))

    # ------------------------------------------------ 3. the events store
    report('store: an events collection', once(
        """    settings:    { keyPath: 'key' },
    meta:        { keyPath: 'key' },
  };""",
        CAL['dbstore.js'] + """    settings:    { keyPath: 'key' },
    meta:        { keyPath: 'key' },
  };""", 'db store'))

    report('store: a version bump so it gets created', once(
        "  const DB_VERSION = 4;",
        """  /* v10.5: 5, for the events store the calendar keeps its own entries in.
     onupgradeneeded creates any store in STORES that is missing, so an
     existing vault gains it without touching a single note. */
  const DB_VERSION = 5;""", 'db version'))

    report('store: held in memory like the rest', once(
        """    scratch: new Map(),
    journal: new Map(),          // dayKey -> { day, notes, streakCounted, ... }""",
        """    scratch: new Map(),
    events: new Map(),           // v10.5: calendar events
    journal: new Map(),          // dayKey -> { day, notes, streakCounted, ... }""",
        'state map'))

    report('store: loaded at boot', once(
        """    const [notes, folders, canvases, stickies, tasks, scratch, journal] = await Promise.all([
      db.getAll('notes'), db.getAll('folders'), db.getAll('canvases'),
      db.getAll('stickies'), db.getAll('tasks'), db.getAll('scratch'), db.getAll('journal'),
    ]);""",
        """    const [notes, folders, canvases, stickies, tasks, scratch, journal, events] = await Promise.all([
      db.getAll('notes'), db.getAll('folders'), db.getAll('canvases'),
      db.getAll('stickies'), db.getAll('tasks'), db.getAll('scratch'), db.getAll('journal'),
      /* v10.5: an older database has no events store until the upgrade runs,
         so this must never be the reason the app fails to open. */
      db.getAll('events').catch(function () { return []; }),
    ]);""", 'load all'))

    report('store: filled from disk', once(
        """    fill(state.scratch, scratch, 'id');
    fill(state.journal, journal, 'day');""",
        """    fill(state.scratch, scratch, 'id');
    fill(state.events, events || [], 'id');
    fill(state.journal, journal, 'day');""", 'fill events'))

    report('store: saveable and deletable', once(
        """    return { canvases: state.canvases, stickies: state.stickies, tasks: state.tasks, scratch: state.scratch, journal: state.journal }[name];""",
        """    return { canvases: state.canvases, stickies: state.stickies, tasks: state.tasks,
      scratch: state.scratch, journal: state.journal, events: state.events }[name];""",
        'collection map'))

    # ------------------------------------------------ 4. the events module
    report('calendar: the events module', once(
        """/* ===== js/features/linkcare.js ===== */""",
        CAL['events.js'] + """/* ===== js/features/linkcare.js ===== */""", 'events module'))

    # ------------------------------------------------ 5. wire the calendar
    report('calendar: events and holidays are types too', once(
        """  const TYPES = [
    { id: 'created',  label: 'Notes created',  icon: 'file-plus' },
    { id: 'edited',   label: 'Notes edited',   icon: 'edit' },
    { id: 'task',     label: 'Tasks due',      icon: 'list-check' },
    { id: 'sticky',   label: 'Stickies',       icon: 'sticky' },
    { id: 'reminder', label: 'Reminders',      icon: 'clock' },
    { id: 'daily',    label: 'Daily notes',    icon: 'flame' },
  ];""",
        CAL['types.js'].rstrip('\n'), 'calendar types'))

    report('calendar: gather them over the visible window', once(
        """    N.store.state.journal.forEach(function (row, key) {
      if (!row || (!row.edits && !row.notesCreated && !row.tasksDone && !row.words)) return;
      const bits = [];
      if (row.notesCreated) bits.push(U.pluralize(row.notesCreated, 'note') + ' created');
      if (row.tasksDone) bits.push(U.pluralize(row.tasksDone, 'task') + ' done');
      if (row.words) bits.push(row.words + ' words');
      push(key, { type: 'daily', label: 'Daily note', sub: bits.join(' · ') || 'Activity', dayKey: key, at: null });
    });

    return days;""",
        """    N.store.state.journal.forEach(function (row, key) {
      if (!row || (!row.edits && !row.notesCreated && !row.tasksDone && !row.words)) return;
      const bits = [];
      if (row.notesCreated) bits.push(U.pluralize(row.notesCreated, 'note') + ' created');
      if (row.tasksDone) bits.push(U.pluralize(row.tasksDone, 'task') + ' done');
      if (row.words) bits.push(row.words + ' words');
      push(key, { type: 'daily', label: 'Daily note', sub: bits.join(' · ') || 'Activity', dayKey: key, at: null });
    });

""" + CAL['gather.js'].rstrip('\n'), 'calendar gather'))

    report('calendar: weekends and holidays tint the day', once(
        """      if (d.getMonth() !== month) cell.classList.add('is-other');
      if (key === todayK) cell.classList.add('is-today');
      if (key === selected) cell.classList.add('is-selected');""",
        CAL['cellstate.js'].rstrip('\n'), 'cell state'))

    report('calendar: Add event, on the day panel', once(
        """    const mk = el('button.btn.btn-sm.btn-primary', { type: 'button' });
    mk.appendChild(N.icons.node('file-plus', { size: 14 }));""",
        CAL['dayadd.js'].rstrip('\n') + """
    mk.appendChild(N.icons.node('file-plus', { size: 14 }));""", 'day add'))

    report('calendar: and Mark holiday next to it', once(
        """    head.appendChild(actions);
    host.appendChild(head);

    if (!entries.length) {""",
        CAL['dayholiday.js'].rstrip('\n') + """
    head.appendChild(actions);
    host.appendChild(head);

    if (!entries.length) {""", 'day holiday button'))

    report('calendar: an event row can be edited', once(
        """      row.appendChild(main);
      if (e.at) row.appendChild(el('span.cal-row-time', null, U.formatTime(e.at)));
      row.addEventListener('click', function () { openEntry(e, key); });""",
        """      row.appendChild(main);
      if (e.at) row.appendChild(el('span.cal-row-time', null, U.formatTime(e.at)));
      else if (e.allDay) row.appendChild(el('span.cal-row-time', null, 'All day'));
""" + CAL['dayrow.js'].rstrip('\n') + """
      row.addEventListener('click', function () { openEntry(e, key); });""",
        'day row'))

    report('calendar: opening one means editing it', once(
        """  function openEntry(entry, key) {""",
        CAL['holidayfns.js'] + """  function openEntry(entry, key) {
""" + CAL['openentry.js'].rstrip('\n'), 'open entry'))

    report('calendar: redraw when an event changes', once(
        """    N.bus.on('view:changed', function (v) { if (v === 'calendar') render(); });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'calendar') render();
    }, 500));""",
        """    N.bus.on('view:changed', function (v) { if (v === 'calendar') render(); });
    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'calendar') render();
    }, 500));
    /* v10.5 */
    N.bus.on('events:changed', function () {
      if (N.store.state.activeView === 'calendar') render();
    });""", 'events changed'))

    # ---------------------------------------------- 6. the settings section
    report('settings: a Calendar section', once(
        """    { id: 'daily', label: 'Daily notes', icon: 'calendar' },""",
        """    /* v10.5: the calendar has preferences of its own now. */
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'daily', label: 'Daily notes', icon: 'flame' },""", 'settings section'))

    report('settings: built and reachable', once(
        """      editor: renderEditor, features: renderFeatures, automation: renderAutomation,
      shortcuts: renderShortcuts,""",
        """      editor: renderEditor, features: renderFeatures, automation: renderAutomation,
      shortcuts: renderShortcuts, calendar: renderCalendar,""", 'settings builder'))

    report('settings: the calendar preferences', once(
        """  function renderDaily() {
    const wrap = section('Daily notes', 'One note per day, created automatically the first time you open it.');""",
        CAL['calsettings.js'] + """  function renderDaily() {
    const wrap = section('Daily notes', 'One note per day, created automatically the first time you open it.');""",
        'calendar settings'))

    report('settings: week start moved to Calendar', once(
        """    wrap.appendChild(row('Week starts on', 'Affects the calendar view and the heat-map.',
      select('weekStartsOn', [{ value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }])));

    const template = el('textarea.field', {""",
        """    const template = el('textarea.field', {""", 'week start move'))

    report('calendar: the stylesheet', once(
        '\n</style>\n</head>',
        '\n' + CAL['calcss.css'] + '\n</style>\n</head>', 'calendar css'))

    report('calendar: a command to add an event', once(
        """      { id: 'tasks.open', title: 'Open tasks', group: 'View', icon: 'list-check', accel: 'Mod+Alt+O', run: function () { N.app.setView('tasks'); } },""",
        """      { id: 'tasks.open', title: 'Open tasks', group: 'View', icon: 'list-check', accel: 'Mod+Alt+O', run: function () { N.app.setView('tasks'); } },
      { id: 'calendar.newEvent', title: 'New calendar event', group: 'Create', icon: 'calendar',
        run: function () {
          if (!N.calevents) return;
          N.calevents.openEditor({}).then(function (made) {
            if (made) { N.app.setView('calendar'); }
          });
        } },""", 'new event command'))

    # --------------------------------------------------- 7. the motion pass
    report('motion: the stylesheet', once(
        '\n</style>\n</head>',
        '\n' + block('motion.css') + '\n</style>\n</head>', 'motion css'))

    report('motion: the month slides the way you went', once(
        """  function shift(months) {
    if (!cursor) cursor = firstOfMonth(new Date());
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, 1);
    // Stepping months only means something on the grid, so go there.
    if (mode !== 'month') { setMode('month'); return; }
    render();
  }""",
        """  /* v10.5: which way the last navigation went, so the grid can move that
     way rather than blinking. Reset to 'none' for a render nobody asked
     for - a vault change must not slide the month sideways. */
  let dir = 'none';

  function shift(months) {
    if (!cursor) cursor = firstOfMonth(new Date());
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, 1);
    dir = months < 0 ? 'prev' : 'next';
    // Stepping months only means something on the grid, so go there.
    if (mode !== 'month') { setMode('month'); return; }
    render();
  }""", 'shift dir'))

    report('motion: and the grid is told which way', once(
        """    const pad = el('div.cal-view');""",
        """    const pad = el('div.cal-view', { dataset: { dir: dir } });
    /* One slide per navigation: the next render is not a navigation. */
    dir = 'none';""", 'cal-view dir'))

    # ------------------------------------------------------------ 8. version
    report('version 10.5.0', once("""  N.version = '10.4.0';
  N.versionName = 'v10.4';""", """  N.version = '10.5.0';
  N.versionName = 'v10.5';""", 'version string'))

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
