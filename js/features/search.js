/* =========================================================================
 * Nodalis — features/search.js
 * Full-text search with operators, saved searches, and tag browsing.
 *
 * Operators:  tag:idea  path:Projects  folder:Work  title:report
 *             is:pinned  is:task  has:link  created:>2026-01-01
 *             "exact phrase"   -excluded   /regex/i
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let input, body, countLabel;
  let lastQuery = '';
  let lastResults = [];

  function init() {
    input = document.getElementById('search-input');
    body = document.getElementById('search-body');
    countLabel = document.getElementById('search-count');
    if (!input) return;

    input.addEventListener('input', U.debounce(function () { run(input.value); }, 160));
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; run(''); }
      if (e.key === 'Enter' && lastResults.length) {
        const first = body.querySelector('.search-hit');
        if (first) first.click();
      }
    });
    const saveBtn = document.getElementById('search-save');
    if (saveBtn) saveBtn.addEventListener('click', saveCurrent);

    N.bus.on('vault:changed', U.debounce(function () {
      if (N.store.state.activeView === 'search' && lastQuery) run(lastQuery);
    }, 300));

    registerCommands();
  }

  /* ------------------------------------------------------------- parsing */

  function parseQuery(raw) {
    const q = { terms: [], phrases: [], excluded: [], filters: {}, regex: null, raw: raw };
    let text = String(raw || '').trim();
    if (!text) return q;

    // /regex/flags
    const reMatch = /^\/(.+)\/([gimsu]*)$/.exec(text);
    if (reMatch) {
      try { q.regex = new RegExp(reMatch[1], reMatch[2].replace('g', '') + 'i'); return q; }
      catch (err) { q.invalidRegex = err.message; }
    }

    // "quoted phrases"
    text = text.replace(/"([^"]+)"/g, function (_, phrase) { q.phrases.push(phrase.toLowerCase()); return ' '; });

    text.split(/\s+/).filter(Boolean).forEach(function (token) {
      const opMatch = /^(tag|path|folder|title|is|has|created|modified|prop):(.*)$/i.exec(token);
      if (opMatch) {
        const key = opMatch[1].toLowerCase();
        const value = opMatch[2];
        if (!q.filters[key]) q.filters[key] = [];
        q.filters[key].push(value);
        return;
      }
      if (token.startsWith('-') && token.length > 1) { q.excluded.push(token.slice(1).toLowerCase()); return; }
      q.terms.push(token.toLowerCase());
    });
    return q;
  }

  function matches(note, q) {
    const title = N.store.noteTitle(note).toLowerCase();
    const content = (note.content || '').toLowerCase();
    const haystack = title + '\n' + content + '\n' + note.path.toLowerCase();

    for (const term of q.excluded) if (haystack.indexOf(term) !== -1) return false;

    if (q.filters.tag) {
      const ok = q.filters.tag.every(function (t) {
        const want = t.replace(/^#/, '').toLowerCase();
        return (note.tags || []).some(function (x) {
          const lx = x.toLowerCase();
          return lx === want || lx.startsWith(want + '/');
        });
      });
      if (!ok) return false;
    }
    if (q.filters.path) {
      if (!q.filters.path.every(function (p) { return note.path.toLowerCase().indexOf(p.toLowerCase()) !== -1; })) return false;
    }
    if (q.filters.folder) {
      if (!q.filters.folder.every(function (f) {
        const want = f.toLowerCase();
        return note.folder.toLowerCase() === want || note.folder.toLowerCase().startsWith(want + '/');
      })) return false;
    }
    if (q.filters.title) {
      if (!q.filters.title.every(function (t) { return title.indexOf(t.toLowerCase()) !== -1; })) return false;
    }
    if (q.filters.prop) {
      const ok = q.filters.prop.every(function (spec) {
        const parts = spec.split('=');
        const key = parts[0];
        const want = parts[1];
        const value = note.properties ? note.properties[key] : undefined;
        if (value === undefined) return false;
        if (want === undefined) return true;
        return String(value).toLowerCase().indexOf(want.toLowerCase()) !== -1;
      });
      if (!ok) return false;
    }
    if (q.filters.is) {
      for (const flag of q.filters.is) {
        const f = flag.toLowerCase();
        if (f === 'pinned' && !note.pinned) return false;
        if (f === 'task' && (!note.taskCounts || !note.taskCounts.total)) return false;
        if (f === 'orphan') {
          const links = N.store.backlinksFor(note.id);
          if (links.linked.length || (note.links || []).length) return false;
        }
        if (f === 'empty' && (note.content || '').trim()) return false;
        if (f === 'daily' && note.folder !== (N.store.state.settings.dailyNoteFolder || 'Daily')) return false;
      }
    }
    if (q.filters.has) {
      for (const flag of q.filters.has) {
        const f = flag.toLowerCase();
        if (f === 'link' && !(note.links || []).length) return false;
        if (f === 'tag' && !(note.tags || []).length) return false;
        if (f === 'image' && !/!\[[^\]]*\]\(/.test(note.content || '')) return false;
        if (f === 'code' && (note.content || '').indexOf('```') === -1) return false;
      }
    }
    if (q.filters.created) {
      if (!q.filters.created.every(function (spec) { return dateMatches(note.createdAt, spec); })) return false;
    }
    if (q.filters.modified) {
      if (!q.filters.modified.every(function (spec) { return dateMatches(note.updatedAt, spec); })) return false;
    }

    if (q.regex) return q.regex.test(note.content || '') || q.regex.test(title);
    for (const phrase of q.phrases) if (haystack.indexOf(phrase) === -1) return false;
    for (const term of q.terms) if (haystack.indexOf(term) === -1) return false;
    return true;
  }

  function dateMatches(ts, spec) {
    if (!ts) return false;
    const day = U.todayKey(ts);
    const m = /^([<>]=?)?(\d{4}-\d{2}-\d{2}|today|yesterday|week|month)$/.exec(spec);
    if (!m) return day.indexOf(spec) !== -1;
    const op = m[1] || '=';
    let target = m[2];
    const now = new Date();
    if (target === 'today') target = U.todayKey();
    else if (target === 'yesterday') target = U.todayKey(new Date(now.getTime() - 86400000));
    else if (target === 'week') target = U.todayKey(new Date(now.getTime() - 7 * 86400000));
    else if (target === 'month') target = U.todayKey(new Date(now.getTime() - 30 * 86400000));
    if (op === '>') return day > target;
    if (op === '>=') return day >= target;
    if (op === '<') return day < target;
    if (op === '<=') return day <= target;
    return day === target;
  }

  /* ------------------------------------------------------------ execution */

  function search(raw, limit) {
    const q = parseQuery(raw);
    if (q.invalidRegex) return { error: 'That regular expression is not valid: ' + q.invalidRegex, hits: [] };
    const empty = !q.terms.length && !q.phrases.length && !q.regex && !Object.keys(q.filters).length;
    if (empty) return { hits: [], empty: true };

    const hits = [];
    N.store.allNotes().forEach(function (note) {
      if (!matches(note, q)) return;
      hits.push({ note: note, lines: snippets(note, q), score: scoreOf(note, q) });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return { hits: limit ? hits.slice(0, limit) : hits, query: q };
  }

  function scoreOf(note, q) {
    const title = N.store.noteTitle(note).toLowerCase();
    let score = 0;
    q.terms.concat(q.phrases).forEach(function (t) {
      if (title.indexOf(t) !== -1) score += 60;
      const body = (note.content || '').toLowerCase();
      let idx = body.indexOf(t), count = 0;
      while (idx !== -1 && count < 30) { count++; idx = body.indexOf(t, idx + 1); }
      score += Math.min(count, 12) * 4;
    });
    if (note.pinned) score += 20;
    score += (note.updatedAt || 0) / 1e12;
    return score;
  }

  function snippets(note, q, max) {
    const needles = q.terms.concat(q.phrases).filter(Boolean);
    const lines = (note.content || '').split('\n');
    const out = [];
    const limit = max || 3;

    for (let i = 0; i < lines.length && out.length < limit; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const lower = line.toLowerCase();
      let hit = false;
      if (q.regex) hit = q.regex.test(line);
      else hit = needles.some(function (n) { return lower.indexOf(n) !== -1; });
      if (!hit) continue;
      out.push({ line: i, html: highlightLine(line, needles, q.regex) });
    }
    if (!out.length && !needles.length && !q.regex) {
      const first = lines.find(function (l) { return l.trim(); });
      if (first) out.push({ line: 0, html: U.escapeHtml(U.truncate(first, 180)) });
    }
    return out;
  }

  function highlightLine(line, needles, regex) {
    const trimmed = U.truncate(line.trim(), 260);
    let html = U.escapeHtml(trimmed);
    if (regex) {
      try {
        html = html.replace(new RegExp(regex.source, 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
        return html;
      } catch (err) { return html; }
    }
    needles.forEach(function (n) {
      if (!n) return;
      const re = new RegExp('(' + U.escapeRegExp(U.escapeHtml(n)) + ')', 'gi');
      html = html.replace(re, '<mark>$1</mark>');
    });
    return html;
  }

  /* ------------------------------------------------------------- rendering */

  function run(raw) {
    lastQuery = raw;
    if (input && input.value !== raw) input.value = raw;
    if (!body) return;
    U.clear(body);

    const result = search(raw);
    lastResults = result.hits || [];

    if (result.error) {
      if (countLabel) countLabel.textContent = '';
      body.appendChild(banner('warning', 'Invalid search', result.error));
      return;
    }

    if (result.empty) {
      if (countLabel) countLabel.textContent = '';
      body.appendChild(renderTips());
      return;
    }

    if (countLabel) countLabel.textContent = U.pluralize(lastResults.length, 'result');

    if (!lastResults.length) {
      const empty = el('div.empty-state');
      empty.appendChild(N.icons.node('search', { size: 40 }));
      empty.appendChild(el('div.empty-state-title', null, 'No matches'));
      empty.appendChild(el('p.empty-state-text', null, 'Nothing in your vault matches that. Try fewer words, or drop an operator.'));
      const actions = el('div.empty-state-actions');
      actions.appendChild(el('button.btn.btn-primary', {
        type: 'button',
        onclick: async function () {
          const note = await N.store.createNote({ title: raw.slice(0, 80) });
          N.app.openNote(note.id);
        },
      }, 'Create a note called "' + U.truncate(raw, 32) + '"'));
      empty.appendChild(actions);
      body.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    lastResults.forEach(function (hit, i) {
      const card = el('div.search-hit', { tabindex: '0', style: { '--i': i } });
      const title = el('div.search-hit-title');
      title.appendChild(N.icons.node(hit.note.pinned ? 'pin' : 'note', { size: 15 }));
      title.appendChild(el('span', null, N.store.noteTitle(hit.note)));
      card.appendChild(title);
      card.appendChild(el('div.search-hit-path', null, hit.note.path + ' · ' + U.relativeTime(hit.note.updatedAt)));
      hit.lines.forEach(function (line) {
        card.appendChild(el('div.search-hit-line', { html: line.html }));
      });
      const openIt = function () {
        N.app.openNote(hit.note.id);
        if (hit.lines.length) setTimeout(function () { jumpToLine(hit.lines[0].line); }, 200);
      };
      card.addEventListener('click', openIt);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter') openIt(); });
      frag.appendChild(card);
    });
    const wrap = el('div.stagger');
    wrap.appendChild(frag);
    body.appendChild(wrap);
  }

  function jumpToLine(lineNo) {
    const ta = N.editor.getTextarea();
    if (!ta) return;
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(lineNo, lines.length); i++) pos += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos + (lines[lineNo] || '').length);
    // Rough scroll: proportional position is close enough and never wrong-footed.
    const ratio = pos / Math.max(1, ta.value.length);
    ta.scrollTop = Math.max(0, ratio * ta.scrollHeight - ta.clientHeight / 3);
  }

  function banner(icon, title, text) {
    const b = el('div.banner.is-warn');
    b.appendChild(N.icons.node(icon, { size: 18 }));
    const main = el('div.banner-main');
    main.appendChild(el('div.banner-title', null, title));
    main.appendChild(el('div', null, text));
    b.appendChild(main);
    return b;
  }

  function renderTips() {
    const wrap = el('div');
    const saved = N.store.state.settings.savedSearches || [];
    if (saved.length) {
      wrap.appendChild(el('div.section-label', null, 'Saved searches'));
      const row = el('div.swatch-row', { style: { marginBottom: '24px' } });
      saved.forEach(function (s, i) {
        const chip = el('button.chip', { type: 'button', onclick: function () { run(s.query); } }, s.name);
        const x = el('button.icon-btn.icon-btn-sm', {
          type: 'button', title: 'Remove',
          onclick: async function (e) {
            e.stopPropagation();
            const list = (N.store.state.settings.savedSearches || []).slice();
            list.splice(i, 1);
            await N.store.setSetting('savedSearches', list);
            run('');
          },
        });
        x.appendChild(N.icons.node('close', { size: 12 }));
        const holder = el('span.row', { style: { gap: '2px' } }, [chip, x]);
        row.appendChild(holder);
      });
      wrap.appendChild(row);
    }

    const panel = el('div.panel');
    panel.appendChild(el('div.panel-head', null, el('div.panel-title', null, 'Search operators')));
    const b = el('div.panel-body');
    [
      ['tag:idea', 'notes tagged #idea (and #idea/anything)'],
      ['folder:Work', 'notes inside the Work folder'],
      ['path:2026', 'the file path contains 2026'],
      ['title:report', 'the title contains "report"'],
      ['prop:status=done', 'a frontmatter property equals a value'],
      ['is:pinned', 'pinned notes — also is:task, is:orphan, is:empty, is:daily'],
      ['has:link', 'notes that link out — also has:tag, has:image, has:code'],
      ['modified:>2026-01-01', 'changed after a date — also created:, today, week, month'],
      ['"exact phrase"', 'match the whole phrase'],
      ['-draft', 'exclude anything containing "draft"'],
      ['/^#\\s\\w+/i', 'a regular expression'],
    ].forEach(function (pair) {
      const row = el('div.row', { style: { gap: '12px', padding: '5px 0', alignItems: 'baseline', flexWrap: 'wrap' } });
      row.appendChild(el('code', { style: { flex: 'none' } }, pair[0]));
      row.appendChild(el('span.small.muted', null, pair[1]));
      b.appendChild(row);
    });
    panel.appendChild(b);
    wrap.appendChild(panel);
    return wrap;
  }

  async function saveCurrent() {
    if (!lastQuery.trim()) { N.toast.info('Type a search first.'); return; }
    const name = await N.modal.prompt({ title: 'Name this search', value: lastQuery.slice(0, 40), placeholder: 'e.g. Open project tasks' });
    if (!name) return;
    const list = (N.store.state.settings.savedSearches || []).slice();
    list.push({ name: name, query: lastQuery });
    await N.store.setSetting('savedSearches', list);
    N.toast.success('Search saved', { ms: 1800 });
  }

  function openTag(tag) {
    N.app.setView('search');
    run('tag:' + tag);
    if (input) input.focus();
  }

  function openQuery(query) {
    N.app.setView('search');
    run(query);
    if (input) { input.focus(); input.select(); }
  }

  function registerCommands() {
    N.commands.registerMany([
      { id: 'search.open', title: 'Search everything', group: 'Search', icon: 'search', accel: 'Mod+Shift+F',
        run: function () { N.app.setView('search'); if (input) { input.focus(); input.select(); } } },
      { id: 'search.clear', title: 'Clear search', group: 'Search', icon: 'close',
        when: function () { return N.store.state.activeView === 'search'; },
        run: function () { run(''); } },
      { id: 'search.save', title: 'Save current search', group: 'Search', icon: 'bookmark',
        when: function () { return N.store.state.activeView === 'search' && !!lastQuery; },
        run: saveCurrent },
      { id: 'search.orphans', title: 'Find orphan notes', group: 'Search', icon: 'unlink',
        run: function () { openQuery('is:orphan'); } },
      { id: 'search.empty', title: 'Find empty notes', group: 'Search', icon: 'file', run: function () { openQuery('is:empty'); } },
      { id: 'search.recent', title: 'Notes changed this week', group: 'Search', icon: 'history', run: function () { openQuery('modified:>week'); } },
    ]);
  }

  N.search = {
    init: init, run: run, search: search, openTag: openTag, openQuery: openQuery,
    parseQuery: parseQuery, matches: matches,
  };
})(window.NODALIS = window.NODALIS || {});
