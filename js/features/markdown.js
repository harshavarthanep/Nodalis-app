/* =========================================================================
 * Nodalis — features/markdown.js
 * A complete markdown renderer with the extensions people actually use in a
 * knowledge base: wikilinks, embeds, tags, callouts, footnotes, task lists,
 * tables, block references, math, and syntax-highlighted code.
 *
 * Everything is escaped at the source. No user text is ever injected raw.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const esc = U.escapeHtml;

  /* Placeholder used to park already-rendered fragments while the rest of a
     line is escaped. NUL can never appear in a note, so it cannot collide. */
  const SENTINEL = String.fromCharCode(0);
  const SENTINEL_RE = new RegExp(SENTINEL + '(\\d+)' + SENTINEL, 'g');

  /* ------------------------------------------------------ syntax highlight */

  const KEYWORDS = {
    js: 'const let var function return if else for while do break continue class extends new this typeof instanceof await async import export from default try catch finally throw switch case null undefined true false delete in of yield static get set',
    ts: 'const let var function return if else for while class extends implements interface type enum new this await async import export from default try catch finally throw public private protected readonly as satisfies null undefined true false',
    py: 'def class return if elif else for while import from as try except finally raise with lambda None True False and or not in is pass break continue yield global nonlocal assert async await',
    css: 'important media supports keyframes import from to and not only',
    html: '',
    json: 'true false null',
    sh: 'if then else fi for while do done case esac function return export local echo cd ls rm mkdir sudo apt npm git',
    sql: 'select from where insert update delete create table drop alter join left right inner outer on group by order having limit as and or not null distinct',
    go: 'func package import return if else for range var const type struct interface go defer chan map nil true false switch case break continue',
    rust: 'fn let mut const struct enum impl trait pub use mod match if else for while loop return self Some None Ok Err true false async await',
  };
  const ALIASES = {
    javascript: 'js', jsx: 'js', mjs: 'js', node: 'js',
    typescript: 'ts', tsx: 'ts',
    python: 'py', py3: 'py',
    bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh',
    golang: 'go', rs: 'rust', yml: 'yaml',
  };

  function highlight(code, lang) {
    const key = ALIASES[String(lang || '').toLowerCase()] || String(lang || '').toLowerCase();
    const words = KEYWORDS[key];
    if (words === undefined) return esc(code);

    const kwSet = new Set(words.split(/\s+/).filter(Boolean));
    const out = [];
    let i = 0;
    const src = String(code);

    const push = function (cls, text) {
      out.push(cls ? '<span class="tok-' + cls + '">' + esc(text) + '</span>' : esc(text));
    };

    while (i < src.length) {
      const ch = src[i];
      const rest = src.slice(i);

      // comments
      let m;
      if ((key === 'js' || key === 'ts' || key === 'go' || key === 'rust' || key === 'css') && (m = /^\/\*[\s\S]*?(\*\/|$)/.exec(rest))) {
        push('comment', m[0]); i += m[0].length; continue;
      }
      if ((key === 'js' || key === 'ts' || key === 'go' || key === 'rust') && (m = /^\/\/[^\n]*/.exec(rest))) {
        push('comment', m[0]); i += m[0].length; continue;
      }
      if ((key === 'py' || key === 'sh' || key === 'yaml') && (m = /^#[^\n]*/.exec(rest))) {
        push('comment', m[0]); i += m[0].length; continue;
      }
      if (key === 'sql' && (m = /^--[^\n]*/.exec(rest))) { push('comment', m[0]); i += m[0].length; continue; }

      // strings (single, double, template, triple)
      if ((m = /^("""[\s\S]*?"""|'''[\s\S]*?'''|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/.exec(rest))) {
        push('string', m[0]); i += m[0].length; continue;
      }

      // numbers
      if ((m = /^(0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?)/.exec(rest))) {
        push('number', m[0]); i += m[0].length; continue;
      }

      // identifiers / keywords / functions
      if ((m = /^[A-Za-z_$][\w$]*/.exec(rest))) {
        const word = m[0];
        const after = src.slice(i + word.length).match(/^\s*\(/);
        if (kwSet.has(word)) push('keyword', word);
        else if (after) push('function', word);
        else push(null, word);
        i += word.length; continue;
      }

      // css properties and html tags
      if (key === 'css' && (m = /^[-a-z]+(?=\s*:)/.exec(rest))) { push('property', m[0]); i += m[0].length; continue; }
      if (key === 'html' && (m = /^<\/?[a-zA-Z][\w-]*/.exec(rest))) { push('tag', m[0]); i += m[0].length; continue; }

      if (/[+\-*/%=<>!&|^~?:]/.test(ch)) { push('operator', ch); i++; continue; }
      if (/[{}()[\];,.]/.test(ch)) { push('punct', ch); i++; continue; }

      push(null, ch);
      i++;
    }
    return out.join('');
  }

  /* --------------------------------------------------------------- inline */

  const CALLOUT_ICONS = {
    note: 'note', tip: 'zap', hint: 'zap', success: 'success', check: 'success',
    done: 'success', question: 'help', faq: 'help', help: 'help',
    warning: 'warning', caution: 'warning', attention: 'warning',
    danger: 'error', error: 'error', bug: 'error',
    example: 'sparkle', quote: 'quote', cite: 'quote',
    info: 'info', todo: 'list-check', abstract: 'file-text', summary: 'file-text', tldr: 'file-text',
    important: 'star', failure: 'error', fail: 'error', missing: 'error',
  };

  function renderInline(text, ctx) {
    const options = ctx || {};
    let src = String(text || '');
    const stash = [];

    // Protect inline code first — nothing inside it should be parsed.
    src = src.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, function (_, ticks, code) {
      stash.push('<code>' + esc(code.replace(/^ | $/g, '')) + '</code>');
      return SENTINEL + (stash.length - 1) + SENTINEL;
    });

    // Inline math $...$ (avoiding $$ blocks and currency like $5)
    src = src.replace(/\$([^\s$][^$\n]*?[^\s$]|\S)\$/g, function (full, expr) {
      if (/^\d+([.,]\d+)?$/.test(expr)) return full;   // that's money, not maths
      stash.push('<span class="math-inline">' + esc(expr) + '</span>');
      return SENTINEL + (stash.length - 1) + SENTINEL;
    });

    // Embeds: ![[Note]] / ![[Note#Heading]]
    src = src.replace(/!\[\[([^\]|#^]+)(#[^\]|^]*)?(\^[^\]|]*)?(\|[^\]]*)?\]\]/g, function (_, target) {
      stash.push(renderEmbedPlaceholder(target.trim(), options));
      return SENTINEL + (stash.length - 1) + SENTINEL;
    });

    // Wikilinks: [[Note]] / [[Note|alias]] / [[Note#Heading]] / [[Note^block]]
    src = src.replace(/\[\[([^\]|#^]+)(#[^\]|^]*)?(\^[^\]|]*)?(?:\|([^\]]*))?\]\]/g,
      function (_, target, heading, block, alias) {
        const clean = target.trim();
        const label = (alias || '').trim() || clean + (heading ? ' › ' + heading.slice(1) : '');
        const exists = N.store && N.store.findNoteByTitle(clean);
        const cls = 'wikilink' + (exists ? '' : ' is-unresolved');
        const attrs = ' data-wikilink="' + U.escapeAttr(clean) + '"' +
          (heading ? ' data-heading="' + U.escapeAttr(heading.slice(1)) + '"' : '') +
          (block ? ' data-block="' + U.escapeAttr(block.slice(1)) + '"' : '');
        const title = exists ? 'Open ' + clean : clean + ' — click to create';
        stash.push('<a class="' + cls + '"' + attrs + ' title="' + U.escapeAttr(title) + '" role="link" tabindex="0">' + esc(label) + '</a>');
        return SENTINEL + (stash.length - 1) + SENTINEL;
      });

    // Images: ![alt](src)
    src = src.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (_, alt, url, title) {
      const safe = sanitizeUrl(url);
      if (!safe) return esc(alt);
      const attr = ' src="' + U.escapeAttr(safe) + '" alt="' + U.escapeAttr(alt) + '"' +
        (title ? ' title="' + U.escapeAttr(title) + '"' : '') + ' loading="lazy" decoding="async"';
      stash.push('<img' + attr + '>');
      return SENTINEL + (stash.length - 1) + SENTINEL;
    });

    // Links: [text](url)
    src = src.replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (full, label, url, title) {
      const safe = sanitizeUrl(url);
      if (!safe) return esc(full);
      const external = /^https?:/i.test(safe);
      const attrs = ' href="' + U.escapeAttr(safe) + '"' +
        (title ? ' title="' + U.escapeAttr(title) + '"' : '') +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '');
      stash.push('<a' + attrs + '>' + renderInline(label, options) + '</a>');
      return SENTINEL + (stash.length - 1) + SENTINEL;
    });

    // Bare URLs
    src = src.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<>()"']+[^\s<>()"'.,;:!?])/g, function (_, pre, url) {
      const href = /^www\./i.test(url) ? 'https://' + url : url;
      stash.push('<a href="' + U.escapeAttr(href) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>');
      return pre + '\u0000' + (stash.length - 1) + '\u0000';
    });

    // Footnote references
    src = src.replace(/\[\^([^\]]+)\]/g, function (_, id) {
      const key = U.slugify(id);
      stash.push('<sup class="footnote-ref"><a href="#fn-' + key + '" id="fnref-' + key + '">' + esc(id) + '</a></sup>');
      return SENTINEL + (stash.length - 1) + SENTINEL;
    });

    // Tags — must not fire inside URLs, which are already stashed by now.
    src = src.replace(/(^|[\s(>])#([A-Za-z][\w/-]{0,48})/g, function (_, pre, tag) {
      const clean = tag.replace(/[-/]+$/, '');
      if (!clean || /^\d+$/.test(clean)) return _;
      stash.push('<a class="tag-inline" data-tag="' + U.escapeAttr(clean) + '" role="button" tabindex="0">#' + esc(clean) + '</a>');
      return pre + '\u0000' + (stash.length - 1) + '\u0000';
    });

    // Escape everything that is left, then apply emphasis.
    src = esc(src);

    src = src.replace(/(\*\*\*|___)(?=\S)([\s\S]*?\S)\1/g, '<strong><em>$2</em></strong>');
    src = src.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
    src = src.replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, '$1<em>$2</em>');
    src = src.replace(/(^|[^\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/g, '$1<em>$2</em>');
    src = src.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    src = src.replace(/==(?=\S)([\s\S]*?\S)==/g, '<mark>$1</mark>');
    src = src.replace(/\^([\w+-]+)\^/g, '<sup>$1</sup>');
    src = src.replace(/(?:^|[^~])~([\w+-]+)~(?!~)/g, '<sub>$1</sub>');

    // Block anchors (^abc123 at end of line)
    src = src.replace(/\s\^([A-Za-z0-9-]{2,32})\s*$/, function (_, id) {
      return ' <span class="block-id" data-block-id="' + U.escapeAttr(id) + '">^' + esc(id) + '</span>';
    });

    // Manual line breaks
    src = src.replace(/ {2,}\n/g, '<br>\n');
    src = src.replace(/\\\n/g, '<br>\n');

    // Put the protected pieces back.
    src = src.replace(SENTINEL_RE, function (_, idx) { return stash[Number(idx)] || ''; });
    return src;
  }

  function sanitizeUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;
    // Block anything that could execute. Everything else is fine.
    if (/^\s*(javascript|vbscript|file|about):/i.test(raw)) return null;
    if (/^data:/i.test(raw) && !/^data:image\//i.test(raw)) return null;
    return raw;
  }

  function renderEmbedPlaceholder(target, options) {
    const note = N.store && N.store.findNoteByTitle(target);
    if (!note) {
      return '<div class="embed"><div class="embed-head">' + N.icons.svg('note', { size: 14 }) +
        '<span class="embed-missing">' + esc(target) + ' — not created yet</span></div></div>';
    }
    if (options.depth >= 3) {
      return '<div class="embed"><div class="embed-head">' + N.icons.svg('note', { size: 14 }) +
        '<span class="embed-missing">' + esc(target) + ' — nested too deeply to expand</span></div></div>';
    }
    const inner = render(note.content || '', { depth: (options.depth || 0) + 1, noteId: note.id });
    return '<div class="embed" data-embed="' + U.escapeAttr(target) + '">' +
      '<div class="embed-head">' + N.icons.svg('note', { size: 14 }) +
      '<a class="wikilink" data-wikilink="' + U.escapeAttr(target) + '">' + esc(N.store.noteTitle(note)) + '</a></div>' +
      '<div class="embed-body">' + inner + '</div></div>';
  }

  /* ---------------------------------------------------------------- block */

  /**
   * render(markdown, options) -> HTML string
   * options: { depth, noteId, headingAnchors }
   */
  function render(markdown, options) {
    const ctx = options || {};
    const src = String(markdown === null || markdown === undefined ? '' : markdown).replace(/\r\n?/g, '\n');
    const lines = src.split('\n');
    const out = [];
    const footnotes = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      /* ---- fenced code ---- */
      const fence = /^(\s*)(```+|~~~+)\s*([\w+#-]*)\s*$/.exec(line);
      if (fence) {
        const marker = fence[2][0];
        const minLen = fence[2].length;
        const lang = fence[3] || '';
        const body = [];
        i++;
        while (i < lines.length) {
          const closeRe = new RegExp('^\\s*' + (marker === '`' ? '`' : '~') + '{' + minLen + ',}\\s*$');
          if (closeRe.test(lines[i])) { i++; break; }
          body.push(lines[i]);
          i++;
        }
        const code = body.join('\n');
        out.push(
          '<pre data-lang="' + U.escapeAttr(lang) + '">' +
          (lang ? '<span class="code-lang">' + esc(lang) + '</span>' : '') +
          '<button class="code-copy" type="button" data-copy-code title="Copy code">' + N.icons.svg('copy', { size: 13 }) + '</button>' +
          '<code>' + highlight(code, lang) + '</code></pre>');
        continue;
      }

      /* ---- math block ---- */
      if (/^\s*\$\$\s*$/.test(line)) {
        const body = [];
        i++;
        while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
        i++;
        out.push('<div class="math-block">' + esc(body.join('\n')) + '</div>');
        continue;
      }

      /* ---- horizontal rule ---- */
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      /* ---- heading ---- */
      const heading = /^(\s*)(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (heading) {
        const level = heading[2].length;
        const text = heading[3];
        const slug = U.slugify(text);
        const anchor = ctx.headingAnchors === false ? '' :
          '<a class="heading-anchor" href="#' + U.escapeAttr(slug) + '" aria-hidden="true">#</a>';
        out.push('<h' + level + ' id="' + U.escapeAttr(slug) + '" data-line="' + i + '">' + anchor + renderInline(text, ctx) + '</h' + level + '>');
        i++;
        continue;
      }

      /* ---- setext heading ---- */
      if (i + 1 < lines.length && line.trim() && /^\s*(=+|-{2,})\s*$/.test(lines[i + 1]) && !/^\s*[-*+]\s/.test(line)) {
        const level = lines[i + 1].trim()[0] === '=' ? 1 : 2;
        const slug = U.slugify(line.trim());
        out.push('<h' + level + ' id="' + U.escapeAttr(slug) + '">' + renderInline(line.trim(), ctx) + '</h' + level + '>');
        i += 2;
        continue;
      }

      /* ---- footnote definition ---- */
      const fnDef = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line);
      if (fnDef) {
        const key = U.slugify(fnDef[1]);
        const body = [fnDef[2]];
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) { body.push(lines[i].trim()); i++; }
        footnotes.push({ key: key, label: fnDef[1], html: renderInline(body.join(' '), ctx) });
        continue;
      }

      /* ---- blockquote / callout ---- */
      if (/^\s*>/.test(line)) {
        const quoteLines = [];
        while (i < lines.length && (/^\s*>/.test(lines[i]) || (quoteLines.length && lines[i].trim() && !/^\s*$/.test(lines[i])))) {
          if (!/^\s*>/.test(lines[i])) break;
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        const first = quoteLines[0] || '';
        const callout = /^\s*\[!([A-Za-z]+)\]([+-]?)\s*(.*)$/.exec(first);
        if (callout) {
          const kind = callout[1].toLowerCase();
          const fold = callout[2];
          const title = callout[3].trim() || kind.charAt(0).toUpperCase() + kind.slice(1);
          const bodyHtml = render(quoteLines.slice(1).join('\n'), { depth: (ctx.depth || 0) + 1, headingAnchors: false });
          const collapsible = fold === '+' || fold === '-';
          out.push(
            '<div class="callout' + (collapsible ? ' is-collapsible' : '') + (fold === '-' ? ' is-collapsed' : '') +
            '" data-kind="' + U.escapeAttr(CALLOUT_ICONS[kind] ? kind : 'note') + '">' +
            '<div class="callout-head">' + N.icons.svg(CALLOUT_ICONS[kind] || 'note', { size: 17 }) +
            '<span>' + renderInline(title, ctx) + '</span>' +
            (collapsible ? '<span class="callout-fold">' + N.icons.svg('chevron-down', { size: 15 }) + '</span>' : '') +
            '</div>' +
            (bodyHtml ? '<div class="callout-body">' + bodyHtml + '</div>' : '') +
            '</div>');
        } else {
          out.push('<blockquote>' + render(quoteLines.join('\n'), { depth: (ctx.depth || 0) + 1, headingAnchors: false }) + '</blockquote>');
        }
        continue;
      }

      /* ---- table ---- */
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
        const header = splitRow(line);
        const aligns = splitRow(lines[i + 1]).map(function (c) {
          const t = c.trim();
          if (/^:.*:$/.test(t)) return 'center';
          if (/:$/.test(t)) return 'right';
          if (/^:/.test(t)) return 'left';
          return '';
        });
        i += 2;
        const rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
        let html = '<table><thead><tr>';
        header.forEach(function (cell, idx) {
          html += '<th' + (aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : '') + '>' + renderInline(cell.trim(), ctx) + '</th>';
        });
        html += '</tr></thead><tbody>';
        rows.forEach(function (row) {
          html += '<tr>';
          for (let c = 0; c < header.length; c++) {
            const cell = row[c] === undefined ? '' : row[c];
            html += '<td' + (aligns[c] ? ' style="text-align:' + aligns[c] + '"' : '') + '>' + renderInline(cell.trim(), ctx) + '</td>';
          }
          html += '</tr>';
        });
        html += '</tbody></table>';
        out.push(html);
        continue;
      }

      /* ---- lists ---- */
      if (/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(line)) {
        const consumed = renderList(lines, i, ctx);
        out.push(consumed.html);
        i = consumed.next;
        continue;
      }

      /* ---- blank ---- */
      if (!line.trim()) { i++; continue; }

      /* ---- paragraph ---- */
      const para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^\s*(#{1,6}\s|>|```|~~~|\$\$)/.test(lines[i]) &&
             !/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(lines[i]) &&
             !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i]) &&
             !/^\[\^([^\]]+)\]:/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      if (para.length) out.push('<p data-line="' + (i - para.length) + '">' + renderInline(para.join('\n'), ctx) + '</p>');
      else i++;
    }

    if (footnotes.length) {
      let fn = '<section class="footnotes"><hr><ol>';
      footnotes.forEach(function (f) {
        fn += '<li id="fn-' + f.key + '">' + f.html +
          ' <a class="footnote-back" href="#fnref-' + f.key + '" aria-label="Back to text">↩</a></li>';
      });
      fn += '</ol></section>';
      out.push(fn);
    }

    return out.join('\n');
  }

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const cells = [];
    let buf = '';
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\\' && s[i + 1] === '|') { buf += '|'; i++; continue; }
      if (s[i] === '|') { cells.push(buf); buf = ''; continue; }
      buf += s[i];
    }
    cells.push(buf);
    return cells;
  }

  /** Recursive list renderer that keeps nesting, task state and line numbers. */
  function renderList(lines, start, ctx) {
    const firstMatch = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(lines[start]);
    const baseIndent = firstMatch[1].replace(/\t/g, '  ').length;
    const ordered = /\d/.test(firstMatch[2]);
    const startNum = ordered ? parseInt(firstMatch[2], 10) : 1;

    let html = ordered
      ? '<ol' + (startNum !== 1 ? ' start="' + startNum + '"' : '') + '>'
      : '<ul>';
    let i = start;

    while (i < lines.length) {
      const m = /^(\s*)([-*+]|\d{1,9}[.)])\s+([\s\S]*)$/.exec(lines[i]);
      if (!m) {
        // A blank line may just be spacing inside the list.
        if (!lines[i].trim() && i + 1 < lines.length && /^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(lines[i + 1])) { i++; continue; }
        break;
      }
      const indent = m[1].replace(/\t/g, '  ').length;
      if (indent < baseIndent) break;
      if (indent > baseIndent) {
        const nested = renderList(lines, i, ctx);
        // Attach the nested list to the previous <li>.
        html = html.replace(/<\/li>$/, nested.html + '</li>');
        i = nested.next;
        continue;
      }

      const isOrdered = /\d/.test(m[2]);
      if (isOrdered !== ordered) break;

      let content = m[3];
      const lineNo = i;
      i++;

      // Continuation lines (lazy paragraph inside a list item).
      while (i < lines.length && lines[i].trim() &&
             !/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(lines[i]) &&
             lines[i].replace(/\t/g, '  ').search(/\S/) > baseIndent) {
        content += '\n' + lines[i].trim();
        i++;
      }

      const task = /^\[([ xX/\-])\]\s*([\s\S]*)$/.exec(content);
      if (task) {
        const state = task[1].toLowerCase();
        const done = state === 'x';
        const cancelled = task[1] === '-';
        const cls = 'task-item' + (done ? ' is-done' : '') + (cancelled ? ' is-cancelled' : '');
        html += '<li class="' + cls + '" data-line="' + lineNo + '">' +
          '<input type="checkbox" ' + (done ? 'checked' : '') + ' data-task-line="' + lineNo + '" aria-label="Toggle task">' +
          '<span>' + renderInline(task[2], ctx) + '</span></li>';
      } else {
        html += '<li data-line="' + lineNo + '">' + renderInline(content, ctx) + '</li>';
      }
    }

    html += ordered ? '</ol>' : '</ul>';
    return { html: html, next: i };
  }

  /* ------------------------------------------------------------- plain text */

  /** Strip markup for previews, search snippets and exports. */
  function toPlainText(markdown, maxLength) {
    let s = String(markdown || '')
      .replace(/^---\n[\s\S]*?\n---\n?/, '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1')
      .replace(/\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|([^\]]*))?\]\]/g, function (_, t, a) { return a || t; })
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s*>\s?\[![A-Za-z]+\][+-]?\s*/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+\[[ xX/-]\]\s*/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/[*_~=]{1,3}/g, '')
      .replace(/^\s*\|.*\|\s*$/gm, function (row) { return row.replace(/\|/g, ' ').trim(); })
      .replace(/\n{2,}/g, '\n')
      .trim();
    if (maxLength && s.length > maxLength) s = s.slice(0, maxLength - 1).trimEnd() + '…';
    return s;
  }

  function excerpt(markdown, maxLength) {
    const text = toPlainText(markdown, undefined);
    const firstPara = text.split('\n').find(function (l) { return l.trim().length > 0; }) || '';
    return U.truncate(firstPara, maxLength || 160);
  }

  N.markdown = {
    render: render,
    renderInline: renderInline,
    highlight: highlight,
    toPlainText: toPlainText,
    excerpt: excerpt,
    sanitizeUrl: sanitizeUrl,
  };
})(window.NODALIS = window.NODALIS || {});
