/**
 * sync/github-sync.js — syncs the vault's markdown files with a GitHub repository
 * using a fine-grained personal access token. No backend required — talks to the
 * GitHub REST API directly from the browser. Works great with GitHub Pages hosting.
 *
 * SECURITY NOTE: the token is stored only in this browser's localStorage, never
 * transmitted anywhere except api.github.com. Treat it like a password — use a
 * fine-grained token scoped to just this one repository's Contents permission.
 */
import { DB } from '../db.js';
import { state, createNote, createFolder, updateNoteContent, noteTitle } from '../state.js';

const API = 'https://api.github.com';

function getConfig() {
  try { return JSON.parse(localStorage.getItem('nodalis-github-config') || 'null'); }
  catch { return null; }
}
export function saveConfig(cfg) { localStorage.setItem('nodalis-github-config', JSON.stringify(cfg)); }
export function clearConfig() { localStorage.removeItem('nodalis-github-config'); }
export function isConfigured() { const c = getConfig(); return !!(c && c.token && c.owner && c.repo); }

async function gh(path, opts = {}) {
  const cfg = getConfig();
  if (!cfg) throw new Error('GitHub sync is not configured.');
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
}

export async function testConnection() {
  const cfg = getConfig();
  await gh(`/repos/${cfg.owner}/${cfg.repo}`);
  return true;
}

/** Pull: fetch all .md files under the configured folder and merge into the local vault. */
export async function pull(onProgress = () => {}) {
  const cfg = getConfig();
  const branch = cfg.branch || 'main';
  const basePath = (cfg.folder || 'vault').replace(/^\/|\/$/g, '');

  const ref = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${branch}`);
  const commitSha = ref.object.sha;
  const commit = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/commits/${commitSha}`);
  const tree = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees/${commit.tree.sha}?recursive=1`);

  const mdFiles = tree.tree.filter((t) => t.type === 'blob' && t.path.startsWith(basePath) && t.path.endsWith('.md'));
  let done = 0;
  for (const file of mdFiles) {
    const blob = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/blobs/${file.sha}`);
    const content = b64DecodeUnicode(blob.content);
    const relPath = file.path.slice(basePath.length).replace(/^\//, '');
    const parts = relPath.split('/');
    const filename = parts.pop().replace(/\.md$/, '');
    const folder = parts.join('/');

    let existing = [...state.notes.values()].find((n) => n.path === relPath.replace(/\.md$/, '.md'));
    if (!existing) existing = [...state.notes.values()].find((n) => n.folder === folder && noteTitle(n) === filename);

    if (existing) {
      if (existing.content !== content) await updateNoteContent(existing.id, content);
    } else {
      if (folder && ![...state.folders.values()].some((f) => f.path === folder)) await createFolder(folder);
      await createNote({ title: filename, folder, content, path: relPath });
    }
    done++; onProgress(done, mdFiles.length);
  }
  await DB.setSetting('github-last-sync', Date.now());
  return { pulled: mdFiles.length };
}

/** Push: write every local note as a .md file to the configured repo/branch/folder. */
export async function push(onProgress = () => {}) {
  const cfg = getConfig();
  const branch = cfg.branch || 'main';
  const basePath = (cfg.folder || 'vault').replace(/^\/|\/$/g, '');
  const notes = [...state.notes.values()];
  let done = 0;
  for (const note of notes) {
    const path = `${basePath}/${note.path}`;
    let sha = null;
    try {
      const existing = await gh(`/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}?ref=${branch}`);
      sha = existing.sha;
    } catch { /* file doesn't exist yet */ }
    await gh(`/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Update ${note.path} via Nodalis`,
        content: b64EncodeUnicode(note.content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    done++; onProgress(done, notes.length);
  }
  await DB.setSetting('github-last-sync', Date.now());
  return { pushed: notes.length };
}

export async function lastSyncTime() {
  return DB.getSetting('github-last-sync', null);
}
