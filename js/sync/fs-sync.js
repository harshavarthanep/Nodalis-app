/**
 * sync/fs-sync.js — syncs the vault to a real folder on disk via the File System
 * Access API (Chrome/Edge desktop only). The chosen directory handle is persisted
 * in IndexedDB so permission only needs to be re-granted, not re-picked, next visit.
 */
import { DB } from '../db.js';
import { state, createNote, createFolder, updateNoteContent, noteTitle } from '../state.js';

export function isSupported() {
  return 'showDirectoryPicker' in window;
}

export async function pickDirectory() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await DB.put('settings', { key: 'fs-dir-handle', value: handle });
  return handle;
}

export async function getSavedDirectory() {
  const row = await DB.get('settings', 'fs-dir-handle');
  return row ? row.value : null;
}

export async function ensurePermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function walk(dirHandle, path = '') {
  const files = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && name.endsWith('.md')) {
      files.push({ name, handle, path: path ? `${path}/${name}` : name });
    } else if (handle.kind === 'directory') {
      files.push(...await walk(handle, path ? `${path}/${name}` : name));
    }
  }
  return files;
}

export async function pull(dirHandle, onProgress = () => {}) {
  const files = await walk(dirHandle);
  let done = 0;
  for (const f of files) {
    const file = await f.handle.getFile();
    const content = await file.text();
    const relPath = f.path;
    const parts = relPath.split('/');
    const filename = parts.pop().replace(/\.md$/, '');
    const folder = parts.join('/');

    let existing = [...state.notes.values()].find((n) => n.path === relPath);
    if (!existing) existing = [...state.notes.values()].find((n) => n.folder === folder && noteTitle(n) === filename);

    if (existing) {
      if (existing.content !== content) await updateNoteContent(existing.id, content);
    } else {
      if (folder && ![...state.folders.values()].some((fd) => fd.path === folder)) await createFolder(folder);
      await createNote({ title: filename, folder, content, path: relPath });
    }
    done++; onProgress(done, files.length);
  }
  return { pulled: files.length };
}

async function getOrCreateSubdir(root, path) {
  if (!path) return root;
  let dir = root;
  for (const part of path.split('/')) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  return dir;
}

export async function push(dirHandle, onProgress = () => {}) {
  const notes = [...state.notes.values()];
  let done = 0;
  for (const note of notes) {
    const parts = note.path.split('/');
    const filename = parts.pop();
    const folderPath = parts.join('/');
    const dir = await getOrCreateSubdir(dirHandle, folderPath);
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(note.content);
    await writable.close();
    done++; onProgress(done, notes.length);
  }
  return { pushed: notes.length };
}
