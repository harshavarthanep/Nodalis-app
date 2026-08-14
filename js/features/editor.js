/* =========================================================================
 * Nodalis — features/editor.js
 * The writing surface: autosave, live preview, slash menu, [[ and # autocomplete,
 * smart lists, bracket pairing, markdown shortcuts, scroll sync, image paste,
 * task toggling from the preview, and an optional modal Vim mode.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;
  const bus = N.bus;

  let ta, preview, titleInput, splitEl, savePip, saveLabel, wordCount, emptyState;
  let currentId = null;
  let dirty = false;
  let saving = false;
  let suppressRender = false;
  let autocomplete = null;
  let scrollSyncLock = 0;

  /* ------------------------------------------------------------- lifecycle */

  function init() {
    ta = document.getElementById('note-editor');
    preview = document.getElementById('note-preview');
    titleInput = document.getElementById('note-title');
    splitEl = document.getElementById('editor-split');
    savePip = document.getElementById('save-pip');
    saveLabel = document.getElementById('save-label');
    wordCount = document.getElementById('word-count');
    emptyState = document.getElementById('editor-empty');
    if (!ta) return;

    ta.addEventListener('input', onInput);
    ta.addEventListener('keydown', onKeyDown);
    ta.addEventListener('paste', onPaste);
    ta.addEventListener('drop', onDrop);
    ta.addEventListener('dragover', function (e) { e.preventDefault(); });
    ta.addEventListener('scroll', U.throttle(syncScrollFromEditor, 60));
    ta.addEventListener('click', closeAutocomplete);
    ta.addEventListener('blur', function () { setTimeout(closeAutocomplete, 180); flushSave(); });

    titleInput.addEventListener('change', commitTitle);
    titleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitTitle(); ta.focus(); }
      if (e.key === 'Escape') { renderTitle(); ta.focus(); }
    });

    const modeGroup = document.getElementById('editor-mode');
    if (modeGroup) {
      U.delegate(modeGroup, 'click', 'button', function (e, btn) { setMode(btn.dataset.mode); });
    }
    const mobileToggle = document.getElementById('btn-editor-mode-mobile');
    if (mobileToggle) mobileToggle.addEventListener('click', function () {
      setMode(getMode() === 'preview' ? 'edit' : 'preview');
    });

    const previewPane = document.getElementById('split-preview');
    if (previewPane) previewPane.addEventListener('scroll', U.throttle(syncScrollFromPreview, 60));

    preview.addEventListener('click', onPreviewClick);
    preview.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        const link = e.target.closest('[data-wikilink],[data-tag]');
        if (link) { e.preventDefault(); onPreviewClick({ target: link, preventDefault: function () {} }); }
      }
    });

    document.getElementById('btn-pin').addEventListener('click', function () {
      if (currentId) N.commands.run('note.pin');
    });
    document.getElementById('btn-note-menu').addEventListener('click', function (e) {
      openNoteMenu(e.currentTarget);
    });
    const focusBtn = document.getElementById('btn-focus-mode');
    if (focusBtn) focusBtn.addEventListener('click', function () { N.commands.run('view.focusMode'); });

    bus.on('note:active', function (note) { loadNote(note); });
    bus.on('vault:changed', U.debounce(function () {
      if (currentId && !N.store.state.notes.has(currentId)) loadNote(null);
    }, 60));
    bus.on('note:updated', function (note) {
      // Re-render if the active note changed underneath us (disk pull, link rewrite).
      if (note && note.id === currentId && note.content !== ta.value && !dirty) {
        suppressRender = true;
        ta.value = note.content;
        suppressRender = false;
        renderPreview();
      }
    });
    bus.on('settings:changed', function () {
      applyEditorPrefs();
      renderPreview();
    });

    applyEditorPrefs();
    setMode(N.store.state.settings.editorMode || 'split');
    registerCommands();
    loadNote(null);
  }

  function applyEditorPrefs() {
    const s = N.store.state.settings;
    ta.spellcheck = !!s.spellcheck;
    ta.setAttribute('spellcheck', s.spellcheck ? 'true' : 'false');
  }

  /* ---------------------------------------------------------------- state */

  function loadNote(note) {
    flushSave();
    closeAutocomplete();
    currentId = note ? note.id : null;

    if (!note) {
      ta.value = '';
      titleInput.value = '';
      preview.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      splitEl.style.display = 'none';
      document.querySelector('.editor-head').style.display = 'none';
      document.querySelector('.editor-foot').style.display = 'none';
      setDirty(false);
      updateWordCount(null);
      bus.emit('editor:loaded', null);
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    splitEl.style.display = '';
    document.querySelector('.editor-head').style.display = '';
    document.querySelector('.editor-foot').style.display = '';

    suppressRender = true;
    ta.value = note.content || '';
    suppressRender = false;
    renderTitle();
    renderPreview();
    updateWordCount(note);
    updatePinButton(note);
    setDirty(false);
    ta.scrollTop = 0;
    bus.emit('editor:loaded', note);
  }

  function renderTitle() {
    const note = current();
    titleInput.value = note ? N.store.noteTitle(note) : '';
  }

  function current() { return currentId ? N.store.getNote(currentId) : null; }

  function updatePinButton(note) {
    const btn = document.getElementById('btn-pin');
    if (!btn) return;
    btn.classList.toggle('is-active', !!(note && note.pinned));
    btn.title = note && note.pinned ? 'Unpin note' : 'Pin note';
  }

  function setDirty(value) {
    dirty = value;
    if (!savePip) return;
    savePip.classList.toggle('is-dirty', value && !saving);
    savePip.classList.toggle('is-saved', !value && !saving);
    if (saveLabel) saveLabel.textContent = saving ? 'Saving…' : (value ? 'Unsaved' : 'Saved');
  }

  /* ---------------------------------------------------------------- saving */

  const scheduleSave = U.debounce(function () { doSave(); }, 400);

  async function doSave() {
    if (!currentId || !dirty) return;
    const note = current();
    if (!note) { setDirty(false); return; }
    saving = true;
    setDirty(true);
    try {
      await N.store.updateNoteContent(currentId, ta.value);
      saving = false;
      setDirty(false);
      updateWordCount(N.store.getNote(currentId));
    } catch (err) {
      saving = false;
      console.error('[editor] save failed', err);
      N.toast.error(U.describeError(err), { title: 'Could not save', key: 'save-fail' });
      setDirty(true);
    }
  }

  function flushSave() {
    scheduleSave.cancel();
    if (dirty) doSave();
  }

  function onInput() {
    if (suppressRender) return;
    setDirty(true);
    scheduleSave();
    renderPreviewDebounced();
    updateWordCountLive();
    maybeOpenAutocomplete();
  }

  const renderPreviewDebounced = U.debounce(function () { renderPreview(); }, 110);

  function renderPreview() {
    if (!preview) return;
    if (getMode() === 'edit') return;
    const html = N.markdown.render(ta.value, { noteId: currentId });
    preview.innerHTML = html;
    hydrateAttachments(preview);
    bus.emit('preview:rendered', preview);
  }

  const updateWordCountLive = U.throttle(function () {
    const stats = N.serialize.wordStats(ta.value);
    writeWordCount(stats);
  }, 400);

  function updateWordCount(note) {
    if (!wordCount) return;
    if (!note) { wordCount.textContent = ''; return; }
    writeWordCount({ words: note.words, chars: note.chars, readingMinutes: note.readingMinutes });
  }

  function writeWordCount(stats) {
    if (!wordCount) return;
    const parts = [U.pluralize(stats.words || 0, 'word')];
    if (stats.words > 60) parts.push((stats.readingMinutes || 1) + ' min read');
    const note = current();
    if (note && note.taskCounts && note.taskCounts.total) {
      parts.push(note.taskCounts.done + '/' + note.taskCounts.total + ' tasks');
    }
    wordCount.textContent = parts.join(' · ');
  }

  async function commitTitle() {
    const note = current();
    if (!note) return;
    const next = titleInput.value.trim();
    if (!next || next === N.store.noteTitle(note)) { renderTitle(); return; }
    await N.store.renameNote(note.id, next);
    renderTitle();
  }

  /* ------------------------------------------------------------------ mode */

  function getMode() { return splitEl ? splitEl.dataset.mode : 'split'; }

  function setMode(mode) {
    const valid = ['edit', 'split', 'preview'];
    const next = valid.indexOf(mode) !== -1 ? mode : 'split';
    splitEl.dataset.mode = next;
    const group = document.getElementById('editor-mode');
    if (group) {
      U.$$('button', group).forEach(function (b) { b.classList.toggle('is-active', b.dataset.mode === next); });
    }
    const mobileBtn = document.getElementById('btn-editor-mode-mobile');
    if (mobileBtn) {
      mobileBtn.innerHTML = '';
      mobileBtn.appendChild(N.icons.node(next === 'preview' ? 'edit' : 'eye', { size: 17 }));
      mobileBtn.title = next === 'preview' ? 'Back to writing' : 'Read view';
    }
    if (next !== 'edit') renderPreview();
    N.store.state.settings.editorMode = next;
    N.store.saveSettings();
  }

  function cycleMode() {
    const order = ['edit', 'split', 'preview'];
    setMode(order[(order.indexOf(getMode()) + 1) % order.length]);
  }

  /* ------------------------------------------------------------ scroll sync */

  function syncScrollFromEditor() {
    if (getMode() !== 'split') return;
    if (Date.now() < scrollSyncLock) return;
    const pane = document.getElementById('split-preview');
    const src = document.getElementById('split-editor');
    if (!pane || !src) return;
    const maxSrc = ta.scrollHeight - ta.clientHeight;
    const maxDst = pane.scrollHeight - pane.clientHeight;
    if (maxSrc <= 0 || maxDst <= 0) return;
    scrollSyncLock = Date.now() + 60;
    pane.scrollTop = (ta.scrollTop / maxSrc) * maxDst;
  }

  function syncScrollFromPreview() {
    if (getMode() !== 'split') return;
    if (Date.now() < scrollSyncLock) return;
    const pane = document.getElementById('split-preview');
    if (!pane) return;
    const maxSrc = pane.scrollHeight - pane.clientHeight;
    const maxDst = ta.scrollHeight - ta.clientHeight;
    if (maxSrc <= 0 || maxDst <= 0) return;
    scrollSyncLock = Date.now() + 60;
    ta.scrollTop = (pane.scrollTop / maxSrc) * maxDst;
  }

  /* --------------------------------------------------------- text helpers */

  function selection() { return { start: ta.selectionStart, end: ta.selectionEnd }; }

  function replaceRange(start, end, text, cursorOffset) {
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + text + after;
    const pos = start + (cursorOffset === undefined ? text.length : cursorOffset);
    ta.setSelectionRange(pos, pos);
    onInput();
  }

  function insertAtCursor(text, cursorOffset) {
    const s = selection();
    replaceRange(s.start, s.end, text, cursorOffset);
  }

  function wrapSelection(before, after, placeholder) {
    const s = selection();
    const selected = ta.value.slice(s.start, s.end);
    const suffix = after === undefined ? before : after;

    // Already wrapped? Unwrap instead — the shortcut should toggle.
    const outerStart = s.start - before.length;
    if (outerStart >= 0 &&
        ta.value.slice(outerStart, s.start) === before &&
        ta.value.slice(s.end, s.end + suffix.length) === suffix) {
      const value = ta.value.slice(0, outerStart) + selected + ta.value.slice(s.end + suffix.length);
      ta.value = value;
      ta.setSelectionRange(outerStart, outerStart + selected.length);
      onInput();
      return;
    }

    const body = selected || placeholder || '';
    const text = before + body + suffix;
    const before2 = ta.value.slice(0, s.start);
    const after2 = ta.value.slice(s.end);
    ta.value = before2 + text + after2;
    if (selected) ta.setSelectionRange(s.start + before.length, s.start + before.length + body.length);
    else ta.setSelectionRange(s.start + before.length, s.start + before.length + body.length);
    ta.focus();
    onInput();
  }

  function lineBoundsAt(pos) {
    const value = ta.value;
    let start = value.lastIndexOf('\n', pos - 1) + 1;
    let end = value.indexOf('\n', pos);
    if (end === -1) end = value.length;
    return { start: start, end: end, text: value.slice(start, end) };
  }

  /** Apply a prefix to every selected line, toggling it off when all have it. */
  function togglePrefix(prefix, options) {
    const o = options || {};
    const s = selection();
    const startLine = lineBoundsAt(s.start);
    const endLine = lineBoundsAt(s.end);
    const block = ta.value.slice(startLine.start, endLine.end);
    const lines = block.split('\n');
    const re = o.regex || new RegExp('^\\s*' + U.escapeRegExp(prefix));
    const allHave = lines.every(function (l) { return !l.trim() || re.test(l); });

    const next = lines.map(function (line) {
      if (!line.trim() && lines.length > 1) return line;
      if (allHave) return line.replace(re, '');
      return prefix + line;
    }).join('\n');

    ta.value = ta.value.slice(0, startLine.start) + next + ta.value.slice(endLine.end);
    ta.setSelectionRange(startLine.start, startLine.start + next.length);
    ta.focus();
    onInput();
  }

  /* ------------------------------------------------------------- key input */

  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`', '*': '*', '_': '_' };
  const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);

  function onKeyDown(e) {
    if (autocomplete && handleAutocompleteKey(e)) return;

    const s = selection();
    const settings = N.store.state.settings;

    /* --- Tab: indent / outdent, never lose focus inside the editor --- */
    if (e.key === 'Tab') {
      e.preventDefault();
      const size = settings.tabSize || 2;
      const pad = ' '.repeat(size);
      if (s.start !== s.end || e.shiftKey) {
        const startLine = lineBoundsAt(s.start);
        const endLine = lineBoundsAt(s.end);
        const block = ta.value.slice(startLine.start, endLine.end);
        const lines = block.split('\n').map(function (line) {
          if (e.shiftKey) return line.replace(new RegExp('^( {1,' + size + '}|\\t)'), '');
          return pad + line;
        });
        const next = lines.join('\n');
        ta.value = ta.value.slice(0, startLine.start) + next + ta.value.slice(endLine.end);
        ta.setSelectionRange(startLine.start, startLine.start + next.length);
        onInput();
      } else {
        insertAtCursor(pad);
      }
      return;
    }

    /* --- Enter: continue lists, split callouts, exit empty items --- */
    if (e.key === 'Enter' && !e.shiftKey && settings.smartLists !== false && s.start === s.end) {
      const line = lineBoundsAt(s.start);
      const m = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)(\[([ xX/-])\]\s*)?(.*)$/.exec(line.text);
      if (m) {
        const rest = m[6];
        const hadTask = !!m[4];
        if (!rest.trim()) {
          // Empty item: outdent one level, or end the list.
          e.preventDefault();
          const indent = m[1];
          if (indent.length >= 2) {
            const shorter = indent.slice(0, indent.length - 2);
            const replacement = shorter + m[2] + m[3] + (hadTask ? '[ ] ' : '');
            replaceRange(line.start, line.end, replacement);
          } else {
            replaceRange(line.start, line.end, '');
          }
          return;
        }
        e.preventDefault();
        let marker = m[2];
        if (/\d/.test(marker)) {
          const num = parseInt(marker, 10) + 1;
          marker = num + marker.replace(/\d+/, '');
        }
        const taskPart = hadTask ? '[ ] ' : '';
        insertAtCursor('\n' + m[1] + marker + m[3] + taskPart);
        return;
      }
      const quote = /^(\s*>\s?)/.exec(line.text);
      if (quote && line.text.trim() !== '>') {
        e.preventDefault();
        insertAtCursor('\n' + quote[1]);
        return;
      }
    }

    /* --- bracket pairing --- */
    if (settings.autoPairBrackets !== false && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (PAIRS[e.key] && (s.start !== s.end || shouldPair(e.key, s.start))) {
        e.preventDefault();
        const selected = ta.value.slice(s.start, s.end);
        const text = e.key + selected + PAIRS[e.key];
        ta.value = ta.value.slice(0, s.start) + text + ta.value.slice(s.end);
        if (selected) ta.setSelectionRange(s.start + 1, s.start + 1 + selected.length);
        else ta.setSelectionRange(s.start + 1, s.start + 1);
        onInput();
        // Typing "[" twice gives "[[]]" — open the note autocomplete.
        if (e.key === '[' && ta.value.slice(Math.max(0, s.start - 1), s.start) === '[') {
          setTimeout(maybeOpenAutocomplete, 0);
        }
        return;
      }
      // Typing a closer right before the same closer just steps over it.
      if (CLOSERS.has(e.key) && s.start === s.end && ta.value[s.start] === e.key) {
        e.preventDefault();
        ta.setSelectionRange(s.start + 1, s.start + 1);
        return;
      }
      // Backspace between an empty pair removes both.
      if (e.key === 'Backspace' && s.start === s.end && s.start > 0) {
        const prev = ta.value[s.start - 1];
        const next = ta.value[s.start];
        if (PAIRS[prev] && PAIRS[prev] === next) {
          e.preventDefault();
          replaceRange(s.start - 1, s.start + 1, '');
          return;
        }
      }
    }

    /* --- slash menu --- */
    if (e.key === '/' && s.start === s.end) {
      const line = lineBoundsAt(s.start);
      const beforeCursor = ta.value.slice(line.start, s.start);
      if (!beforeCursor.trim()) setTimeout(function () { openSlashMenu(); }, 0);
    }

    /* --- Escape closes helpers, then leaves the field --- */
    if (e.key === 'Escape') {
      if (autocomplete) { e.preventDefault(); closeAutocomplete(); return; }
    }
  }

  function shouldPair(ch, pos) {
    const next = ta.value[pos];
    // Don't auto-pair in the middle of a word — that fights the writer.
    if (next && /[\w]/.test(next)) return false;
    if (ch === "'" ) {
      const prev = ta.value[pos - 1];
      if (prev && /[\w]/.test(prev)) return false;   // apostrophes in "don't"
    }
    if (ch === '*' || ch === '_') {
      const prev = ta.value[pos - 1];
      if (prev && /[\w]/.test(prev)) return false;
    }
    return true;
  }

  /* --------------------------------------------------------- autocomplete */

  function textBeforeCursor(limit) {
    const s = selection();
    return ta.value.slice(Math.max(0, s.start - (limit || 120)), s.start);
  }

  function maybeOpenAutocomplete() {
    const before = textBeforeCursor(160);

    const wikiMatch = /\[\[([^\]\n[]*)$/.exec(before);
    if (wikiMatch) { openNoteAutocomplete(wikiMatch[1], wikiMatch[1].length); return; }

    const tagMatch = /(^|[\s(>])#([A-Za-z][\w/-]*)$/.exec(before);
    if (tagMatch) { openTagAutocomplete(tagMatch[2]); return; }

    const slashMatch = /(^|\n)\s*\/([A-Za-z]*)$/.exec(before);
    if (slashMatch) { openSlashMenu(slashMatch[2]); return; }

    closeAutocomplete();
  }

  function caretRect() {
    // Mirror the textarea into a hidden div to find the caret's screen position.
    const rect = ta.getBoundingClientRect();
    const style = getComputedStyle(ta);
    const mirror = document.createElement('div');
    const props = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderWidth',
      'whiteSpace', 'wordBreak', 'overflowWrap', 'textTransform'];
    props.forEach(function (p) { mirror.style[p] = style[p]; });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.width = ta.clientWidth + 'px';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-word';

    const pos = ta.selectionStart;
    mirror.textContent = ta.value.slice(0, pos);
    const marker = document.createElement('span');
    marker.textContent = '​';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const mRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const x = rect.left + (mRect.left - mirrorRect.left);
    const y = rect.top + (mRect.top - mirrorRect.top) - ta.scrollTop + parseFloat(style.lineHeight || '20');
    document.body.removeChild(mirror);
    return { x: x, y: y };
  }

  function openAutocompleteList(items, onPick, emptyText) {
    closeAutocomplete();
    if (!items.length && !emptyText) return;

    const node = el('div.autocomplete', { role: 'listbox' });
    autocomplete = { node: node, items: items, index: 0, onPick: onPick };

    if (!items.length) {
      node.appendChild(el('div.autocomplete-empty', null, emptyText));
    } else {
      items.forEach(function (item, i) {
        const row = el('button.autocomplete-item' + (i === 0 ? '.is-selected' : ''), {
          type: 'button', role: 'option',
          onmousedown: function (e) { e.preventDefault(); },
          onclick: function () { pickAutocomplete(i); },
        });
        if (item.icon) row.appendChild(N.icons.node(item.icon, { size: 16 }));
        const main = el('div.autocomplete-item-main');
        main.appendChild(el('div', { html: item.html || U.escapeHtml(item.label) }));
        if (item.sub) main.appendChild(el('div.autocomplete-item-sub', null, item.sub));
        row.appendChild(main);
        if (item.hint) row.appendChild(el('span.menu-item-hint', null, item.hint));
        node.appendChild(row);
      });
    }

    const caret = caretRect();
    node.style.visibility = 'hidden';
    document.body.appendChild(node);
    const r = node.getBoundingClientRect();
    let x = caret.x, y = caret.y + 4;
    if (x + r.width > window.innerWidth - 12) x = window.innerWidth - r.width - 12;
    if (y + r.height > window.innerHeight - 12) y = caret.y - r.height - 22;
    node.style.left = Math.max(8, x) + 'px';
    node.style.top = Math.max(8, y) + 'px';
    node.style.visibility = '';
  }

  function closeAutocomplete() {
    if (autocomplete && autocomplete.node.parentNode) autocomplete.node.parentNode.removeChild(autocomplete.node);
    autocomplete = null;
  }

  function handleAutocompleteKey(e) {
    if (!autocomplete) return false;
    const count = autocomplete.items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveAutocomplete(1); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveAutocomplete(-1); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (!count) { closeAutocomplete(); return false; }
      e.preventDefault();
      pickAutocomplete(autocomplete.index);
      return true;
    }
    if (e.key === 'Escape') { e.preventDefault(); closeAutocomplete(); return true; }
    return false;
  }

  function moveAutocomplete(delta) {
    if (!autocomplete || !autocomplete.items.length) return;
    const rows = U.$$('.autocomplete-item', autocomplete.node);
    rows[autocomplete.index] && rows[autocomplete.index].classList.remove('is-selected');
    autocomplete.index = (autocomplete.index + delta + autocomplete.items.length) % autocomplete.items.length;
    const next = rows[autocomplete.index];
    if (next) { next.classList.add('is-selected'); next.scrollIntoView({ block: 'nearest' }); }
  }

  function pickAutocomplete(index) {
    if (!autocomplete) return;
    const item = autocomplete.items[index];
    const handler = autocomplete.onPick;
    closeAutocomplete();
    if (item && handler) handler(item);
    ta.focus();
  }

  function openNoteAutocomplete(query) {
    const notes = N.store.allNotes();
    const scored = [];
    notes.forEach(function (note) {
      if (note.id === currentId) return;
      const title = N.store.noteTitle(note);
      const match = query ? U.fuzzyMatch(query, title) : { score: -(note.updatedAt || 0) / 1e10, indices: [] };
      if (!match) return;
      scored.push({
        label: title,
        html: query ? U.highlightIndices(title, match.indices) : U.escapeHtml(title),
        sub: note.folder || 'Vault root',
        icon: 'note',
        score: match.score,
        value: title,
      });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    const items = scored.slice(0, 12);

    if (query && query.trim() && !items.some(function (i) { return i.label.toLowerCase() === query.toLowerCase(); })) {
      items.unshift({ label: query, html: U.escapeHtml(query), sub: 'Create this note', icon: 'file-plus', value: query, isNew: true });
    }

    openAutocompleteList(items, function (item) {
      const s = selection();
      const before = ta.value.slice(0, s.start);
      const m = /\[\[([^\]\n[]*)$/.exec(before);
      if (!m) return;
      const start = s.start - m[1].length;
      const closing = ta.value.slice(s.start, s.start + 2) === ']]' ? 2 : 0;
      replaceRange(start, s.start + closing, item.value + ']]');
    }, query ? 'No matching note — keep typing to create "' + query + '"' : 'No other notes yet');
  }

  function openTagAutocomplete(query) {
    const tags = N.store.allTags();
    const items = tags
      .map(function (t) {
        const match = query ? U.fuzzyMatch(query, t.tag) : { score: t.count, indices: [] };
        if (!match) return null;
        return {
          label: t.tag,
          html: query ? U.highlightIndices(t.tag, match.indices) : U.escapeHtml(t.tag),
          sub: U.pluralize(t.count, 'note'),
          icon: 'tag', score: match.score, value: t.tag,
        };
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 10);

    if (!items.length) return closeAutocomplete();

    openAutocompleteList(items, function (item) {
      const s = selection();
      const before = ta.value.slice(0, s.start);
      const m = /#([A-Za-z][\w/-]*)$/.exec(before);
      if (!m) return;
      replaceRange(s.start - m[1].length, s.start, item.value + ' ');
    });
  }

  const SLASH_BLOCKS = [
    { label: 'Heading 1', icon: 'heading-1', keywords: 'h1 title', insert: '# ' },
    { label: 'Heading 2', icon: 'heading-2', keywords: 'h2', insert: '## ' },
    { label: 'Heading 3', icon: 'heading-3', keywords: 'h3', insert: '### ' },
    { label: 'Bulleted list', icon: 'list', keywords: 'ul bullet', insert: '- ' },
    { label: 'Numbered list', icon: 'list-ordered', keywords: 'ol number', insert: '1. ' },
    { label: 'Task list', icon: 'list-check', keywords: 'todo checkbox', insert: '- [ ] ' },
    { label: 'Quote', icon: 'quote', keywords: 'blockquote', insert: '> ' },
    { label: 'Divider', icon: 'divider', keywords: 'hr rule line', insert: '\n---\n' },
    { label: 'Code block', icon: 'code-block', keywords: 'pre fence', insert: '```\n\n```', offset: 4 },
    { label: 'Table', icon: 'table', keywords: 'grid', insert: '| Column | Column |\n| --- | --- |\n|  |  |\n', offset: 2 },
    { label: 'Callout — note', icon: 'note', keywords: 'admonition info', insert: '> [!note] \n> ', offset: 9 },
    { label: 'Callout — tip', icon: 'zap', keywords: 'admonition hint', insert: '> [!tip] \n> ', offset: 8 },
    { label: 'Callout — warning', icon: 'warning', keywords: 'admonition caution', insert: '> [!warning] \n> ', offset: 12 },
    { label: 'Link to note', icon: 'link', keywords: 'wikilink internal', insert: '[[]]', offset: 2 },
    { label: 'Embed a note', icon: 'file-text', keywords: 'transclude include', insert: '![[]]', offset: 3 },
    { label: 'Math block', icon: 'math', keywords: 'latex formula equation', insert: '$$\n\n$$', offset: 3 },
    { label: 'Footnote', icon: 'superscript', keywords: 'reference', insert: '[^1]', offset: 3 },
    { label: "Today's date", icon: 'calendar', keywords: 'now time', dynamic: function () { return U.todayKey(); } },
    { label: 'Current time', icon: 'clock', keywords: 'now', dynamic: function () { return U.formatTime(Date.now()); } },
    { label: 'Block reference id', icon: 'anchor', keywords: 'anchor permalink', dynamic: function () { return ' ^' + U.uid('').slice(0, 6); } },
    { label: 'Table of contents', icon: 'list-tree', keywords: 'toc outline', dynamic: buildToc },
  ];

  function buildToc() {
    const note = current();
    if (!note) return '';
    const heads = N.serialize.headings(ta.value);
    if (!heads.length) return '<!-- no headings yet -->';
    return heads.map(function (h) {
      return '  '.repeat(Math.max(0, h.level - 1)) + '- [[' + N.store.noteTitle(note) + '#' + h.text + '|' + h.text + ']]';
    }).join('\n');
  }

  function openSlashMenu(query) {
    const q = query || '';
    const items = SLASH_BLOCKS
      .map(function (b) {
        const match = q ? U.fuzzyMatch(q, b.label + ' ' + b.keywords) : { score: 0, indices: [] };
        if (!match) return null;
        return Object.assign({}, b, { score: match.score, html: U.escapeHtml(b.label) });
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.score - a.score; });

    openAutocompleteList(items, function (item) {
      const s = selection();
      const before = ta.value.slice(0, s.start);
      const m = /\/([A-Za-z]*)$/.exec(before);
      const start = m ? s.start - m[0].length : s.start;
      const text = item.dynamic ? item.dynamic() : item.insert;
      replaceRange(start, s.start, text, item.offset);
    }, 'No block matches "' + q + '"');
  }

  /* -------------------------------------------------------- preview clicks */

  function onPreviewClick(e) {
    const target = e.target;

    const check = target.closest ? target.closest('input[data-task-line]') : null;
    if (check) {
      e.preventDefault();
      toggleTaskAtLine(parseInt(check.dataset.taskLine, 10));
      return;
    }

    const copyBtn = target.closest ? target.closest('[data-copy-code]') : null;
    if (copyBtn) {
      const pre = copyBtn.closest('pre');
      const code = pre ? pre.querySelector('code') : null;
      if (code) {
        U.copyToClipboard(code.textContent).then(function (ok) {
          N.toast[ok ? 'success' : 'error'](ok ? 'Code copied' : 'Could not copy', { ms: 1500, key: 'copy-code' });
        });
      }
      return;
    }

    const fold = target.closest ? target.closest('.callout.is-collapsible .callout-head') : null;
    if (fold) { fold.parentNode.classList.toggle('is-collapsed'); return; }

    const link = target.closest ? target.closest('[data-wikilink]') : null;
    if (link) {
      e.preventDefault();
      openWikilink(link.dataset.wikilink, link.dataset.heading, link.dataset.block);
      return;
    }

    const tag = target.closest ? target.closest('[data-tag]') : null;
    if (tag) {
      e.preventDefault();
      N.search.openTag(tag.dataset.tag);
      return;
    }
  }

  async function openWikilink(title, heading, block) {
    let note = N.store.findNoteByTitle(title);
    if (!note) {
      const create = await N.modal.confirm({
        title: 'Create "' + title + '"?',
        message: 'That note does not exist yet. Create it now and open it?',
        confirmLabel: 'Create note',
      });
      if (!create) return;
      const active = current();
      note = await N.store.createNote({ title: title, folder: active ? active.folder : '' });
      N.toast.success('Created "' + N.store.noteTitle(note) + '"', { ms: 2000 });
    }
    N.app.openNote(note.id);
    if (heading || block) {
      setTimeout(function () { scrollToAnchor(heading, block); }, 220);
    }
  }

  function scrollToAnchor(heading, block) {
    if (heading) {
      const target = preview.querySelector('#' + CSS.escape(U.slugify(heading)));
      if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    if (block) {
      const anchor = preview.querySelector('[data-block-id="' + CSS.escape(block) + '"]');
      if (anchor) {
        const host = anchor.closest('p, li, blockquote, div') || anchor;
        host.scrollIntoView({ behavior: 'smooth', block: 'center' });
        host.classList.add('block-highlight');
        setTimeout(function () { host.classList.remove('block-highlight'); }, 1800);
      }
    }
  }

  function toggleTaskAtLine(lineNo) {
    const lines = ta.value.split('\n');
    if (lineNo < 0 || lineNo >= lines.length) return;
    const m = /^(\s*[-*+]\s+\[)([ xX/-])(\]\s*)([\s\S]*)$/.exec(lines[lineNo]);
    if (!m) return;
    const next = m[2].toLowerCase() === 'x' ? ' ' : 'x';
    lines[lineNo] = m[1] + next + m[3] + m[4];
    const pos = ta.selectionStart;
    ta.value = lines.join('\n');
    ta.setSelectionRange(Math.min(pos, ta.value.length), Math.min(pos, ta.value.length));
    onInput();
    flushSave();
    if (next === 'x') {
      bus.emit('task:completed', { noteId: currentId, line: lineNo });
    }
  }

  /* ------------------------------------------------------- paste and drop */

  async function onPaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        const file = items[i].getAsFile();
        if (file) { e.preventDefault(); await attachImage(file); return; }
      }
    }
    // Pasting a URL over selected text makes a markdown link.
    const text = e.clipboardData.getData('text/plain');
    const s = selection();
    if (text && /^https?:\/\/\S+$/.test(text.trim()) && s.start !== s.end) {
      e.preventDefault();
      const label = ta.value.slice(s.start, s.end);
      replaceRange(s.start, s.end, '[' + label + '](' + text.trim() + ')');
    }
  }

  async function onDrop(e) {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.indexOf('image/') === 0) await attachImage(file);
      else if (/\.(md|txt|markdown)$/i.test(file.name)) await importTextFile(file);
      else N.toast.warn('Skipped "' + file.name + '" — only images and markdown can be dropped into a note.');
    }
  }

  async function attachImage(file) {
    try {
      if (file.size > 12 * 1024 * 1024) {
        N.toast.warn('That image is over 12 MB. Compress it first so your vault stays quick to sync.');
        return;
      }
      const id = U.uid('att');
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      await N.db.put('attachments', { id: id, name: file.name || ('image.' + ext), type: file.type, ext: '.' + ext, blob: file, createdAt: Date.now() });
      if (N.vault.isFolderMode()) N.vault.saveAttachment(id, '.' + ext, file);
      insertAtCursor('![' + (file.name || 'image') + '](attachment:' + id + ')\n');
      renderPreview();
      N.toast.success('Image attached', { ms: 1600 });
    } catch (err) {
      N.toast.error(U.describeError(err), { title: 'Could not attach that image' });
    }
  }

  async function importTextFile(file) {
    try {
      const text = await file.text();
      insertAtCursor('\n' + text + '\n');
    } catch (err) {
      N.toast.error(U.describeError(err));
    }
  }

  /** Swap attachment: URLs for real object URLs after render. */
  async function hydrateAttachments(root) {
    const imgs = U.$$('img[src^="attachment:"]', root);
    for (const img of imgs) {
      const id = img.getAttribute('src').slice('attachment:'.length);
      try {
        const row = await N.db.get('attachments', id);
        if (row && row.blob) {
          img.src = URL.createObjectURL(row.blob);
          img.addEventListener('load', function () { setTimeout(function () { URL.revokeObjectURL(img.src); }, 30000); }, { once: true });
        } else {
          img.replaceWith(el('span.dim.small', null, '[missing image]'));
        }
      } catch (err) {
        img.replaceWith(el('span.dim.small', null, '[image unavailable]'));
      }
    }
  }

  /* ------------------------------------------------------------ note menu */

  function openNoteMenu(anchor) {
    const note = current();
    if (!note) return;
    N.menu.show([
      { label: note.pinned ? 'Unpin' : 'Pin to top', icon: note.pinned ? 'pin-off' : 'pin', onClick: function () { N.commands.run('note.pin'); } },
      { label: 'Duplicate', icon: 'duplicate', onClick: function () { N.commands.run('note.duplicate'); } },
      { label: 'Rename…', icon: 'edit', onClick: function () { titleInput.focus(); titleInput.select(); } },
      { label: 'Move to folder…', icon: 'folder', onClick: function () { N.commands.run('note.move'); } },
      { separator: true },
      { label: 'Copy link to note', icon: 'link', onClick: function () { N.commands.run('note.copyLink'); } },
      { label: 'Copy as markdown', icon: 'copy', onClick: function () { N.commands.run('note.copyMarkdown'); } },
      { label: 'Export…', icon: 'download', onClick: function () { N.exporter.exportNoteDialog(note.id); } },
      { label: 'Share…', icon: 'share', onClick: function () { N.commands.run('note.share'); } },
      { label: 'Print', icon: 'file-text', onClick: function () { N.commands.run('note.print'); } },
      { separator: true },
      { label: 'Insert table of contents', icon: 'list-tree', onClick: function () { insertAtCursor('\n' + buildToc() + '\n'); } },
      { label: 'Open in new window', icon: 'external', onClick: function () { N.commands.run('note.popout'); } },
      { separator: true },
      { label: 'Delete note', icon: 'trash', danger: true, onClick: function () { N.commands.run('note.delete'); } },
    ], { anchor: anchor, align: 'right', title: N.store.noteTitle(note) });
  }

  /* ------------------------------------------------------------- commands */

  function registerCommands() {
    const hasNote = function () { return !!currentId; };
    const inEditor = function () { return !!currentId && document.activeElement === ta; };

    N.commands.registerMany([
      { id: 'editor.bold', title: 'Bold', group: 'Format', icon: 'bold', accel: 'Mod+Alt+B', when: hasNote, allowInInput: true,
        run: function () { wrapSelection('**', '**', 'bold text'); } },
      { id: 'editor.italic', title: 'Italic', group: 'Format', icon: 'italic', accel: 'Mod+I', when: hasNote, allowInInput: true,
        run: function () { wrapSelection('*', '*', 'italic text'); } },
      { id: 'editor.strike', title: 'Strikethrough', group: 'Format', icon: 'strikethrough', accel: 'Mod+Shift+X', when: hasNote, allowInInput: true,
        run: function () { wrapSelection('~~', '~~', 'struck text'); } },
      { id: 'editor.highlight', title: 'Highlight', group: 'Format', icon: 'highlight', accel: 'Mod+Shift+H', when: hasNote, allowInInput: true,
        run: function () { wrapSelection('==', '==', 'highlighted'); } },
      { id: 'editor.code', title: 'Inline code', group: 'Format', icon: 'code', accel: 'Mod+E', when: hasNote, allowInInput: true,
        run: function () { wrapSelection('`', '`', 'code'); } },
      { id: 'editor.link', title: 'Insert link', group: 'Format', icon: 'link', accel: 'Mod+Alt+K', when: inEditor, allowInInput: true,
        run: async function () {
          const s = selection();
          const selected = ta.value.slice(s.start, s.end);
          const url = await N.modal.prompt({ title: 'Link URL', placeholder: 'https://…', value: '' });
          if (url === null) return;
          replaceRange(s.start, s.end, '[' + (selected || 'link') + '](' + url + ')');
        } },
      { id: 'editor.wikilink', title: 'Link to another note', group: 'Format', icon: 'note', accel: 'Mod+Shift+K', when: hasNote, allowInInput: true,
        run: function () { insertAtCursor('[[]]', 2); setTimeout(maybeOpenAutocomplete, 0); } },
      { id: 'editor.heading', title: 'Cycle heading level', group: 'Format', icon: 'heading', accel: 'Mod+Shift+1', when: hasNote, allowInInput: true,
        run: function () {
          const s = selection();
          const line = lineBoundsAt(s.start);
          const m = /^(#{0,6})\s?(.*)$/.exec(line.text);
          const level = (m[1].length + 1) % 4;
          const prefix = level ? '#'.repeat(level) + ' ' : '';
          replaceRange(line.start, line.end, prefix + m[2]);
        } },
      { id: 'editor.bulletList', title: 'Bulleted list', group: 'Format', icon: 'list', accel: 'Mod+Shift+8', when: hasNote, allowInInput: true,
        run: function () { togglePrefix('- ', { regex: /^\s*[-*+]\s+/ }); } },
      { id: 'editor.numberList', title: 'Numbered list', group: 'Format', icon: 'list-ordered', accel: 'Mod+Shift+7', when: hasNote, allowInInput: true,
        run: function () { togglePrefix('1. ', { regex: /^\s*\d+[.)]\s+/ }); } },
      { id: 'editor.taskList', title: 'Task list', group: 'Format', icon: 'list-check', accel: 'Mod+Shift+9', when: hasNote, allowInInput: true,
        run: function () { togglePrefix('- [ ] ', { regex: /^\s*[-*+]\s+\[[ xX/-]\]\s+/ }); } },
      { id: 'editor.quote', title: 'Blockquote', group: 'Format', icon: 'quote', accel: "Mod+Shift+.", when: hasNote, allowInInput: true,
        run: function () { togglePrefix('> ', { regex: /^\s*>\s?/ }); } },
      { id: 'editor.codeBlock', title: 'Code block', group: 'Format', icon: 'code-block', accel: 'Mod+Alt+C', when: hasNote, allowInInput: true,
        run: function () { insertAtCursor('```\n\n```', 4); } },
      { id: 'editor.table', title: 'Insert table', group: 'Format', icon: 'table', when: hasNote,
        run: function () { insertAtCursor('\n| Column | Column |\n| --- | --- |\n|  |  |\n'); } },
      { id: 'editor.divider', title: 'Insert divider', group: 'Format', icon: 'divider', when: hasNote,
        run: function () { insertAtCursor('\n---\n'); } },
      { id: 'editor.date', title: 'Insert today\'s date', group: 'Format', icon: 'calendar', accel: 'Mod+Shift+D', when: hasNote, allowInInput: true,
        run: function () { insertAtCursor(U.todayKey()); } },
      { id: 'editor.blockId', title: 'Add block reference id', group: 'Format', icon: 'anchor', when: hasNote,
        run: function () {
          const s = selection();
          const line = lineBoundsAt(s.start);
          if (/\s\^[A-Za-z0-9-]+\s*$/.test(line.text)) { N.toast.info('This block already has an id.'); return; }
          const id = U.uid('').slice(0, 6);
          replaceRange(line.end, line.end, ' ^' + id);
          U.copyToClipboard('[[' + N.store.noteTitle(current()) + '^' + id + ']]');
          N.toast.success('Block id added and link copied', { ms: 2400 });
        } },
      { id: 'editor.slash', title: 'Open block menu', group: 'Editor', icon: 'plus', accel: 'Mod+/', when: inEditor, allowInInput: true,
        run: function () { openSlashMenu(''); } },
      { id: 'editor.toggleMode', title: 'Cycle write / split / read', group: 'Editor', icon: 'eye', accel: 'Mod+Shift+V', when: hasNote,
        run: cycleMode },
      { id: 'editor.modeEdit', title: 'Write mode', group: 'Editor', icon: 'edit', when: hasNote, run: function () { setMode('edit'); } },
      { id: 'editor.modeSplit', title: 'Split mode', group: 'Editor', icon: 'columns', when: hasNote, run: function () { setMode('split'); } },
      { id: 'editor.modePreview', title: 'Read mode', group: 'Editor', icon: 'eye', when: hasNote, run: function () { setMode('preview'); } },
      { id: 'editor.save', title: 'Save now', group: 'Editor', icon: 'save', accel: 'Mod+S', allowInInput: true,
        run: async function () {
          flushSave();
          if (N.vault.isFolderMode()) { await N.vault.flushNow(); N.toast.success('Saved to your folder', { ms: 1600 }); }
          else N.toast.success('Saved on this device', { ms: 1600 });
        } },
      { id: 'editor.focusEditor', title: 'Focus the editor', group: 'Editor', icon: 'edit', accel: 'Mod+Alt+E', when: hasNote,
        run: function () { ta.focus(); } },
      { id: 'editor.selectAll', title: 'Select whole note', group: 'Editor', icon: 'file-text', when: inEditor, allowInInput: true,
        run: function () { ta.select(); } },
    ]);
  }

  /* ------------------------------------------------------------- exported */

  N.editor = {
    init: init,
    getTextarea: function () { return ta; },
    getPreview: function () { return preview; },
    currentNoteId: function () { return currentId; },
    setMode: setMode, getMode: getMode, cycleMode: cycleMode,
    insert: insertAtCursor, wrap: wrapSelection, replaceRange: replaceRange,
    renderPreview: renderPreview, flushSave: flushSave, isDirty: function () { return dirty; },
    scrollToAnchor: scrollToAnchor, openWikilink: openWikilink,
    hydrateAttachments: hydrateAttachments,
    focus: function () { if (ta) ta.focus(); },
  };
})(window.NODALIS = window.NODALIS || {});
