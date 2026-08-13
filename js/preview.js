/**
 * preview.js — renders markdown into the live preview pane, then resolves any
 * attachment:// image references (pasted/dropped images) to real object URLs.
 */
import { findNoteByTitle, getAttachmentUrl } from './state.js';
import { renderMarkdown } from './markdown.js';

export function renderPreview(note) {
  const el = document.getElementById('note-preview');
  el.innerHTML = renderMarkdown(note.content || '', {
    noteExists: (title) => !!findNoteByTitle(title),
  });
  el.querySelectorAll('img[src^="attachment://"]').forEach(async (img) => {
    const id = img.getAttribute('src').replace('attachment://', '');
    const url = await getAttachmentUrl(id);
    if (url) img.src = url;
  });
}
