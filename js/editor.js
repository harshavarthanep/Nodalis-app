/**
 * editor.js — markdown editor pane: title input, textarea, autosave,
 * split/edit/preview modes, [[wikilink]] autocomplete, image paste/drop,
 * word count, and per-note actions (pin, duplicate, share, delete).
 */
import {
  state, bus, noteTitle, updateNoteContent, renameNote, createNote, findNoteByTitle,
  deleteNote, touchNoteOpened, togglePin, duplicateNote, addAttachment,
} from './state.js';
import { renderPreview } from './preview.js';
import { showToast } from './layout-manager.js';

let saveTimer = null;
let suggestBox = null;

export function initEditor() {
  const titleInput = document.getElementById('note-title-input');
  const textarea = document.getElementById('note-editor');
  const split = document.getElementById('editor-split');
  const emptyState = document.getElementById('empty-state');
  const pinBtn = document.getElementById('btn-pin-note');
  const wordCountEl = document.getElementById('word-count');

  bus.on('note:open', (id) => openNote(id));
  bus.on('note:updated', (note) => { if (note.id === state.activeNoteId) { renderPreview(note); updatePinButton(note); } });

  async function openNote(id) {
    const note = state.notes.get(id);
    if (!note) return;
    state.activeNoteId = id;
    titleInput.value = noteTitle(note);
    textarea.value = note.content;
    emptyState.classList.add('hidden');
    split.classList.remove('hidden');
    renderPreview(note);
    updatePinButton(note);
    updateWordCount(note.content);
    await touchNoteOpened(id);
    bus.emit('note:opened', note);
  }

  function updatePinButton(note) {
    if (!pinBtn) return;
    pinBtn.classList.toggle('active', !!note.pinned);
    pinBtn.title = note.pinned ? 'Unpin note' : 'Pin note to top of sidebar';
  }

  function updateWordCount(content) {
    if (!wordCountEl) return;
    const text = content.replace(/^---[\s\S]*?---\n?/, '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const minutes = Math.max(1, Math.round(words / 200));
    wordCountEl.textContent = words ? `${words} words · ${minutes} min read` : '';
  }

  if (!state.notes.size) {
    emptyState.classList.remove('hidden');
    split.classList.add('hidden');
  }

  titleInput.addEventListener('change', async () => {
    if (!state.activeNoteId) return;
    const v = titleInput.value.trim() || 'Untitled';
    await renameNote(state.activeNoteId, v);
    showToast('Renamed');
  });

  textarea.addEventListener('input', () => {
    if (!state.activeNoteId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await updateNoteContent(state.activeNoteId, textarea.value);
    }, 250);
    const note = state.notes.get(state.activeNoteId);
    if (note) renderPreview({ ...note, content: textarea.value });
    updateWordCount(textarea.value);
    handleAutocomplete();
  });

  textarea.addEventListener('keydown', (e) => {
    if (suggestBox && !suggestBox.classList.contains('hidden')) {
      if (e.key === 'Escape') { hideSuggest(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        navigateSuggest(e.key);
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSelection('**', '**'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSelection('*', '*'); }
  });

  // Paste or drop an image directly into the editor -> stored as an attachment
  textarea.addEventListener('paste', async (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const blob = item.getAsFile();
    await insertImageAttachment(blob);
  });
  textarea.addEventListener('dragover', (e) => e.preventDefault());
  textarea.addEventListener('drop', async (e) => {
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    await insertImageAttachment(file);
  });
  async function insertImageAttachment(blob) {
    if (!state.activeNoteId) return showToast('Open a note first', 'error');
    const id = await addAttachment(blob, blob.name || 'image');
    const pos = textarea.selectionStart;
    const val = textarea.value;
    const insert = `![${blob.name || 'image'}](attachment://${id})`;
    textarea.value = val.slice(0, pos) + insert + val.slice(pos);
    textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
    textarea.dispatchEvent(new Event('input'));
    showToast('Image attached');
  }

  function wrapSelection(pre, post) {
    const start = textarea.selectionStart, end = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.slice(0, start) + pre + val.slice(start, end) + post + val.slice(end);
    textarea.selectionStart = start + pre.length;
    textarea.selectionEnd = end + pre.length;
    textarea.dispatchEvent(new Event('input'));
  }

  document.getElementById('btn-toggle-preview').addEventListener('click', () => {
    split.classList.toggle('mode-preview');
    split.classList.remove('mode-edit');
    if (!split.classList.contains('mode-split') && !split.classList.contains('mode-preview')) split.classList.add('mode-split');
  });
  document.getElementById('btn-toggle-split').addEventListener('click', () => {
    split.className = 'editor-split ' + (split.classList.contains('mode-split') ? 'mode-edit' : 'mode-split');
  });

  if (pinBtn) pinBtn.addEventListener('click', async () => {
    if (!state.activeNoteId) return;
    const pinned = await togglePin(state.activeNoteId);
    showToast(pinned ? 'Pinned to top' : 'Unpinned');
  });

  const dupBtn = document.getElementById('btn-duplicate-note');
  if (dupBtn) dupBtn.addEventListener('click', async () => {
    if (!state.activeNoteId) return;
    const dup = await duplicateNote(state.activeNoteId);
    showToast('Duplicated');
    bus.emit('note:open', dup.id);
  });

  const shareBtn = document.getElementById('btn-share-note');
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    if (!state.activeNoteId) return;
    const note = state.notes.get(state.activeNoteId);
    const text = `${noteTitle(note)}\n\n${note.content}`;
    if (navigator.share) {
      try { await navigator.share({ title: noteTitle(note), text }); }
      catch { /* user cancelled */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showToast('Note copied to clipboard');
    } else {
      showToast('Sharing is not supported in this browser', 'error');
    }
  });

  document.getElementById('btn-delete-note').addEventListener('click', async () => {
    if (!state.activeNoteId) return;
    const note = state.notes.get(state.activeNoteId);
    if (confirm(`Delete "${noteTitle(note)}"? This cannot be undone.`)) {
      await deleteNote(state.activeNoteId);
      state.activeNoteId = null;
      titleInput.value = '';
      textarea.value = '';
      emptyState.classList.remove('hidden');
      split.classList.add('hidden');
      showToast('Note deleted');
    }
  });

  // click handling for wikilinks / tags inside preview
  document.getElementById('note-preview').addEventListener('click', async (e) => {
    const wl = e.target.closest('[data-wikilink]');
    if (wl) {
      const target = wl.dataset.wikilink;
      let note = findNoteByTitle(target);
      if (!note) { note = await createNote({ title: target }); showToast(`Created "${target}"`); }
      bus.emit('note:open', note.id);
      return;
    }
    const tag = e.target.closest('[data-tag]');
    if (tag) bus.emit('tag:filter', tag.dataset.tag);
  });

  function handleAutocomplete() {
    const val = textarea.value;
    const pos = textarea.selectionStart;
    const uptoCursor = val.slice(0, pos);
    const match = uptoCursor.match(/\[\[([^\]]*)$/);
    if (!match) { hideSuggest(); return; }
    const query = match[1].toLowerCase();
    const matches = [...state.notes.values()]
      .filter((n) => noteTitle(n).toLowerCase().includes(query))
      .slice(0, 8);
    showSuggest(matches, query);
  }

  function showSuggest(matches, query) {
    if (!suggestBox) {
      suggestBox = document.createElement('div');
      suggestBox.className = 'palette-results';
      suggestBox.style.cssText = `
        position:absolute; bottom:12px; left:12px; right:12px; max-width:360px;
        background:var(--bg-0); border:1px solid var(--border); border-radius:10px;
        box-shadow:var(--shadow-md); z-index:15; max-height:220px; overflow-y:auto; padding:4px;`;
      document.querySelector('.note-editor').parentElement.appendChild(suggestBox);
    }
    suggestBox.classList.remove('hidden');
    suggestBox.innerHTML = '';
    if (!matches.length) {
      suggestBox.innerHTML = `<div class="palette-item">Create note "${query}" ↵</div>`;
      suggestBox.firstChild.addEventListener('click', () => insertWikilink(query));
      return;
    }
    matches.forEach((n, i) => {
      const row = document.createElement('div');
      row.className = 'palette-item' + (i === 0 ? ' active' : '');
      row.textContent = noteTitle(n);
      row.addEventListener('click', () => insertWikilink(noteTitle(n)));
      suggestBox.appendChild(row);
    });
  }
  function navigateSuggest(key) {
    const items = [...suggestBox.querySelectorAll('.palette-item')];
    const activeIdx = items.findIndex((i) => i.classList.contains('active'));
    if (key === 'Enter') { (items[activeIdx] || items[0])?.click(); return; }
    let next = key === 'ArrowDown' ? activeIdx + 1 : activeIdx - 1;
    next = Math.max(0, Math.min(items.length - 1, next));
    items.forEach((i) => i.classList.remove('active'));
    if (items[next]) items[next].classList.add('active');
  }
  function insertWikilink(title) {
    const val = textarea.value;
    const pos = textarea.selectionStart;
    const uptoCursor = val.slice(0, pos);
    const match = uptoCursor.match(/\[\[([^\]]*)$/);
    if (!match) return;
    const startIdx = match.index + 2;
    textarea.value = val.slice(0, startIdx) + title + ']]' + val.slice(pos);
    const newPos = startIdx + title.length + 2;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = newPos;
    hideSuggest();
    textarea.dispatchEvent(new Event('input'));
  }
  function hideSuggest() { if (suggestBox) suggestBox.classList.add('hidden'); }
}
