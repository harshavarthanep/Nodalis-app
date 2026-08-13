/**
 * sync/export-import.js — manual backup: exports the whole vault (notes as real
 * .md files in their folder structure, plus canvases/settings as JSON) to a .zip
 * you can store anywhere, and imports it back on any device. Uses vendored JSZip
 * (no CDN) so this works fully offline.
 */
import { state, createNote, createFolder, updateNoteContent, noteTitle } from '../state.js';

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/jszip.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.JSZip;
}

export async function exportZip() {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  for (const note of state.notes.values()) {
    zip.file(note.path, note.content);
  }
  zip.file('_nodalis/canvases.json', JSON.stringify([...state.canvases.values()], null, 2));
  zip.file('_nodalis/folders.json', JSON.stringify([...state.folders.values()], null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nodalis-vault-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importZip(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  let imported = 0;

  const canvasesEntry = zip.file('_nodalis/canvases.json');
  if (canvasesEntry) {
    const canvases = JSON.parse(await canvasesEntry.async('string'));
    const { saveCanvas } = await import('../state.js');
    for (const c of canvases) await saveCanvas(c);
  }

  const entries = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith('.md'));
  for (const entry of entries) {
    const content = await entry.async('string');
    const parts = entry.name.split('/');
    const filename = parts.pop().replace(/\.md$/, '');
    const folder = parts.join('/');
    if (folder && ![...state.folders.values()].some((f) => f.path === folder)) await createFolder(folder);

    const existing = [...state.notes.values()].find((n) => n.path === entry.name);
    if (existing) await updateNoteContent(existing.id, content);
    else await createNote({ title: filename, folder, content, path: entry.name });
    imported++;
  }
  return { imported };
}
