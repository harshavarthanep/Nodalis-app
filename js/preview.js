/**
 * preview.js — renders markdown into the live preview pane.
 */
import { state, findNoteByTitle } from './state.js';
import { renderMarkdown } from './markdown.js';

export function renderPreview(note) {
  const el = document.getElementById('note-preview');
  el.innerHTML = renderMarkdown(note.content || '', {
    noteExists: (title) => !!findNoteByTitle(title),
  });
}
