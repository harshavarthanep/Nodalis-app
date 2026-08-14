/* =========================================================================
 * Nodalis — core/serialize.js
 * YAML-ish frontmatter <-> note property conversion, and the on-disk file
 * format. Deliberately conservative: anything Nodalis cannot model is passed
 * through untouched so hand-edited files never lose data.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;

  const FM_RE = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

  /* The Obsidian Tasks plugin marks due dates with a calendar pictograph.
     Nodalis reads that for compatibility but only ever writes plain `due:`. */
  const DUE_CAPTURE_RE = new RegExp(
    '(?:due:|' + String.fromCodePoint(0x1F4C5) + ')\\s*(\\d{4}-\\d{2}-\\d{2})', 'i');
  const DATE_MARKER_RE = new RegExp(
    '\\s*(?:' + String.fromCodePoint(0x1F4C5) + '|due:)\\s*\\d{4}-\\d{2}-\\d{2}', 'gi');

  /** Split a raw file into { properties, body, raw }. */
  function parseFrontmatter(raw) {
    const text = String(raw || '');
    const match = FM_RE.exec(text);
    if (!match) return { properties: {}, body: text.replace(/^﻿/, ''), hadFrontmatter: false };
    const yaml = match[1];
    const body = text.slice(match[0].length);
    return { properties: parseYaml(yaml), body: body, hadFrontmatter: true };
  }

  /**
   * Minimal YAML subset: scalars, quoted strings, inline [a, b] lists,
   * block "- item" lists, booleans, numbers, ISO dates and nested one level.
   * Unparseable lines are preserved verbatim under a `__raw` key.
   */
  function parseYaml(yaml) {
    const out = {};
    const lines = String(yaml || '').split(/\r?\n/);
    let currentKey = null;
    const unknown = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || /^\s*#/.test(line)) continue;

      const listItem = /^\s*-\s+(.*)$/.exec(line);
      if (listItem && currentKey) {
        if (!Array.isArray(out[currentKey])) out[currentKey] = out[currentKey] ? [out[currentKey]] : [];
        out[currentKey].push(coerce(listItem[1]));
        continue;
      }

      const kv = /^([A-Za-z0-9_\-. ]+):\s*(.*)$/.exec(line);
      if (!kv) { unknown.push(line); continue; }

      const key = kv[1].trim();
      const rawVal = kv[2].trim();
      currentKey = key;
      if (rawVal === '') { out[key] = ''; continue; }
      out[key] = coerce(rawVal);
    }
    if (unknown.length) out.__raw = unknown.join('\n');
    return out;
  }

  function coerce(value) {
    const v = String(value).trim();
    if (v === '') return '';
    if (/^\[.*\]$/.test(v)) {
      const inner = v.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map(function (s) { return coerce(s.trim()); });
    }
    if (/^"(.*)"$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"');
    if (/^'(.*)'$/.test(v)) return v.slice(1, -1);
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null' || v === '~') return null;
    if (/^-?\d+$/.test(v)) { const n = parseInt(v, 10); return Number.isSafeInteger(n) ? n : v; }
    if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
    return v;
  }

  function stringifyValue(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      if (!value.length) return '[]';
      return '[' + value.map(function (v) { return stringifyScalar(v); }).join(', ') + ']';
    }
    return stringifyScalar(value);
  }

  function stringifyScalar(v) {
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    const s = String(v === null || v === undefined ? '' : v);
    // Quote when the value could be misread as YAML structure.
    if (s === '' ) return '""';
    if (/^[\s]|[\s]$|[:#\[\]{},&*!|>%@`"']|^-\s|^(true|false|null|~)$|^-?\d+(\.\d+)?$/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) {
      return '"' + s.replace(/"/g, '\\"') + '"';
    }
    return s;
  }

  function stringifyFrontmatter(props) {
    const keys = Object.keys(props || {}).filter(function (k) { return k !== '__raw'; });
    if (!keys.length && !(props && props.__raw)) return '';
    const lines = ['---'];
    keys.forEach(function (key) {
      lines.push(key + ': ' + stringifyValue(props[key]));
    });
    if (props && props.__raw) lines.push(props.__raw);
    lines.push('---', '');
    return lines.join('\n');
  }

  /** Full file text for a note: frontmatter + body. */
  function noteToFile(note) {
    if (!note) return '';
    const props = Object.assign({}, note.properties || {});
    // Timestamps are useful in the file itself for anyone reading it elsewhere.
    if (note.createdAt && !props.created) props.created = new Date(note.createdAt).toISOString().slice(0, 10);
    if (note.pinned) props.pinned = true; else delete props.pinned;
    if (note.aliases && note.aliases.length) props.aliases = note.aliases; else delete props.aliases;
    const fm = stringifyFrontmatter(props);
    return fm + (note.content || '');
  }

  /** Inverse of noteToFile — used when reading a file from disk. */
  function fileToNote(path, raw) {
    const parsed = parseFrontmatter(raw);
    const parts = String(path).split('/');
    const filename = parts.pop() || 'Untitled.md';
    const folder = parts.join('/');
    const title = filename.replace(/\.md$/i, '');
    const props = parsed.properties;
    const aliases = normalizeList(props.aliases || props.alias);
    return {
      path: path,
      folder: folder,
      title: title,
      content: parsed.body,
      properties: props,
      aliases: aliases,
      pinned: props.pinned === true,
    };
  }

  function normalizeList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    return String(value).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** #tags found in body text, ignoring code fences, inline code and URLs. */
  function extractTags(body) {
    const tags = new Set();
    const stripped = String(body || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/~~~[\s\S]*?~~~/g, ' ')
      .replace(/`[^`\n]*`/g, ' ')
      .replace(/\]\([^)]*\)/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ');
    const re = /(^|[\s(>\[])#([A-Za-z][\w/-]{0,48})/g;
    let m;
    while ((m = re.exec(stripped))) {
      const tag = m[2].replace(/[-/]+$/, '');
      if (tag && !/^\d+$/.test(tag)) tags.add(tag);
    }
    return Array.from(tags);
  }

  /** [[Wikilinks]] with optional #heading, ^block and |alias parts. */
  function extractLinks(body) {
    const links = [];
    const seen = new Set();
    const stripped = String(body || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
    const re = /!?\[\[([^\]|#^]+)(?:(#[^\]|^]+))?(?:(\^[^\]|]+))?(?:\|([^\]]+))?\]\]/g;
    let m;
    while ((m = re.exec(stripped))) {
      const target = m[1].trim();
      if (!target) continue;
      const key = target.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ target: target, heading: m[2] ? m[2].slice(1) : null, block: m[3] ? m[3].slice(1) : null, alias: m[4] || null });
    }
    return links;
  }

  /** Markdown task lines, with indentation depth and optional metadata. */
  function extractTasks(body) {
    const tasks = [];
    const lines = String(body || '').split(/\r?\n/);
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = /^(\s*)[-*+]\s+\[([ xX/\-])\]\s+(.*)$/.exec(line);
      if (!m) continue;
      const text = m[3];
      tasks.push({
        line: i,
        indent: Math.floor(m[1].replace(/\t/g, '    ').length / 2),
        state: m[2].toLowerCase(),
        done: m[2].toLowerCase() === 'x',
        cancelled: m[2] === '-',
        inProgress: m[2] === '/',
        // \u{1F4C5} is the date marker the Obsidian Tasks plugin writes. We read it
        // for compatibility but never emit it — Nodalis writes plain `due:`.
        text: text.replace(DATE_MARKER_RE, '').replace(/\s*![1-4]\b/g, '').trim(),
        due: (DUE_CAPTURE_RE.exec(text) || [])[1] || null,
        priority: (/(?:^|\s)!([1-4])(?:\s|$)/.exec(text) || [])[1] || null,
        raw: line,
      });
    }
    return tasks;
  }

  /** ^block-id anchors, so [[Note^id]] can resolve to an exact paragraph. */
  function extractBlockIds(body) {
    const out = {};
    const lines = String(body || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = /\s\^([A-Za-z0-9-]{2,32})\s*$/.exec(lines[i]);
      if (m) out[m[1]] = i;
    }
    return out;
  }

  function headings(body) {
    const out = [];
    const lines = String(body || '').split(/\r?\n/);
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(lines[i]);
      if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i, slug: U.slugify(m[2]) });
    }
    return out;
  }

  function wordStats(body) {
    const text = String(body || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!?\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
      .replace(/[#*_>`~\-]/g, ' ');
    const words = text.split(/\s+/).filter(function (w) { return /[\wÀ-ɏЀ-ӿ]/.test(w); });
    const chars = String(body || '').length;
    const minutes = Math.max(1, Math.round(words.length / 225));
    return { words: words.length, chars: chars, readingMinutes: minutes };
  }

  N.serialize = {
    parseFrontmatter: parseFrontmatter,
    stringifyFrontmatter: stringifyFrontmatter,
    parseYaml: parseYaml,
    noteToFile: noteToFile,
    fileToNote: fileToNote,
    extractTags: extractTags,
    extractLinks: extractLinks,
    extractTasks: extractTasks,
    extractBlockIds: extractBlockIds,
    headings: headings,
    wordStats: wordStats,
    normalizeList: normalizeList,
  };
})(window.NODALIS = window.NODALIS || {});
