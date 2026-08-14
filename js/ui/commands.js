/* =========================================================================
 * Nodalis — ui/commands.js
 * The command registry. Everything the app can do is a command with an id,
 * a title, a group, an icon and a default accelerator. The palette, the
 * shortcut editor, context menus and the mobile "More" sheet are all just
 * different views onto this one list.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const registry = new Map();
  const recent = [];
  const RECENT_LIMIT = 12;

  /**
   * register({ id, title, group, icon, accel, run, when, keywords, allowInInput })
   * Registering the same id twice replaces the earlier definition, so feature
   * modules can refine a command without leaving a duplicate behind.
   */
  function register(cmd) {
    if (!cmd || !cmd.id || typeof cmd.run !== 'function') {
      console.warn('[commands] ignoring malformed command', cmd);
      return;
    }
    registry.set(cmd.id, {
      id: cmd.id,
      title: cmd.title || cmd.id,
      subtitle: cmd.subtitle || '',
      group: cmd.group || 'General',
      icon: cmd.icon || 'command',
      accel: cmd.accel || null,
      run: cmd.run,
      when: cmd.when || null,
      keywords: cmd.keywords || '',
      allowInInput: cmd.allowInInput,
      hidden: !!cmd.hidden,
      danger: !!cmd.danger,
    });
  }

  function registerMany(list) {
    (list || []).forEach(register);
    if (N.bus) N.bus.emit('commands:changed');
  }

  function get(id) { return registry.get(id) || null; }
  function all() { return Array.from(registry.values()); }
  function has(id) { return registry.has(id); }

  /** Commands currently runnable, for the palette. */
  function available() {
    return all().filter(function (c) {
      if (c.hidden) return false;
      if (!c.when) return true;
      try { return c.when(); } catch (err) { return false; }
    });
  }

  async function run(id, context) {
    const cmd = registry.get(id);
    if (!cmd) {
      console.warn('[commands] unknown command "' + id + '"');
      return false;
    }
    if (cmd.when) {
      let ok = false;
      try { ok = cmd.when(); } catch (err) { ok = false; }
      if (!ok) {
        N.toast.info('That is not available right now.', { ms: 2200, key: 'cmd-unavailable' });
        return false;
      }
    }
    trackRecent(id);
    try {
      await cmd.run(context || {});
      if (N.bus) N.bus.emit('command:ran', id);
      return true;
    } catch (err) {
      console.error('[commands] "' + id + '" failed', err);
      N.toast.error(U.describeError(err), { title: cmd.title });
      return false;
    }
  }

  function trackRecent(id) {
    const idx = recent.indexOf(id);
    if (idx !== -1) recent.splice(idx, 1);
    recent.unshift(id);
    if (recent.length > RECENT_LIMIT) recent.pop();
  }

  function recentIds() { return recent.slice(); }

  /** Fuzzy search across title, group and keywords. */
  function search(query) {
    const list = available();
    const q = String(query || '').trim();
    if (!q) {
      const recentSet = new Set(recent);
      return list
        .slice()
        .sort(function (a, b) {
          const ar = recentSet.has(a.id) ? recent.indexOf(a.id) : 999;
          const br = recentSet.has(b.id) ? recent.indexOf(b.id) : 999;
          if (ar !== br) return ar - br;
          return a.group.localeCompare(b.group) || a.title.localeCompare(b.title);
        })
        .map(function (c) { return { cmd: c, score: 0, indices: [] }; });
    }
    const results = [];
    list.forEach(function (cmd) {
      const titleMatch = U.fuzzyMatch(q, cmd.title);
      const haystack = cmd.title + ' ' + cmd.group + ' ' + cmd.keywords;
      const anyMatch = titleMatch || U.fuzzyMatch(q, haystack);
      if (!anyMatch) return;
      let score = titleMatch ? titleMatch.score + 40 : anyMatch.score;
      if (recent.indexOf(cmd.id) !== -1) score += 25;
      results.push({ cmd: cmd, score: score, indices: titleMatch ? titleMatch.indices : [] });
    });
    return results.sort(function (a, b) { return b.score - a.score; });
  }

  function groups() {
    const map = new Map();
    available().forEach(function (c) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group).push(c);
    });
    map.forEach(function (list) { list.sort(function (a, b) { return a.title.localeCompare(b.title); }); });
    return map;
  }

  N.commands = {
    register: register, registerMany: registerMany, get: get, all: all, has: has,
    available: available, run: run, search: search, groups: groups, recentIds: recentIds,
  };
})(window.NODALIS = window.NODALIS || {});
