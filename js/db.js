/**
 * db.js — IndexedDB persistence layer for Nodalis.
 * Zero external dependencies. Stores: notes, folders, canvases, settings, attachments.
 */

const DB_NAME = 'nodalis-db';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('notes')) {
        const notes = db.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('path', 'path', { unique: true });
        notes.createIndex('folder', 'folder', { unique: false });
        notes.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('canvases')) {
        db.createObjectStore('canvases', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('attachments')) {
        db.createObjectStore('attachments', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const DB = {
  async getAll(store) {
    const s = await tx(store);
    return reqToPromise(s.getAll());
  },
  async get(store, id) {
    const s = await tx(store);
    return reqToPromise(s.get(id));
  },
  async put(store, value) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.put(value));
  },
  async bulkPut(store, values) {
    const s = await tx(store, 'readwrite');
    await Promise.all(values.map((v) => reqToPromise(s.put(v))));
  },
  async delete(store, id) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.delete(id));
  },
  async clear(store) {
    const s = await tx(store, 'readwrite');
    return reqToPromise(s.clear());
  },
  async getSetting(key, fallback = null) {
    const row = await this.get('settings', key);
    return row ? row.value : fallback;
  },
  async setSetting(key, value) {
    return this.put('settings', { key, value });
  },
};

export function uid() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
