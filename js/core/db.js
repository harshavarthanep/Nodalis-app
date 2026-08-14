/* =========================================================================
 * Nodalis — core/db.js
 * IndexedDB wrapper with versioned migrations, safe transaction handling,
 * quota awareness and an in-memory fallback so the app still *runs* (in a
 * clearly-degraded, honestly-labelled mode) when IndexedDB is unavailable —
 * private windows, blocked storage, corrupted profiles.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;

  const DB_NAME = 'nodalis-db';
  const DB_VERSION = 3;

  const STORES = {
    notes:       { keyPath: 'id', indexes: [['path', 'path', true], ['folder', 'folder', false], ['updatedAt', 'updatedAt', false]] },
    folders:     { keyPath: 'id', indexes: [['path', 'path', false], ['parent', 'parent', false]] },
    canvases:    { keyPath: 'id', indexes: [['updatedAt', 'updatedAt', false]] },
    stickies:    { keyPath: 'id', indexes: [['stack', 'stack', false], ['updatedAt', 'updatedAt', false]] },
    tasks:       { keyPath: 'id', indexes: [['done', 'doneFlag', false], ['due', 'due', false], ['sourceId', 'sourceId', false]] },
    scratch:     { keyPath: 'id', indexes: [['createdAt', 'createdAt', false]] },
    journal:     { keyPath: 'day' },
    attachments: { keyPath: 'id', indexes: [['createdAt', 'createdAt', false]] },
    settings:    { keyPath: 'key' },
    meta:        { keyPath: 'key' },
  };

  let dbPromise = null;
  let degraded = false;            // true => running on the in-memory shim
  let degradedReason = '';
  const memory = new Map();        // store -> Map(key -> value)

  function memStore(name) {
    if (!memory.has(name)) memory.set(name, new Map());
    return memory.get(name);
  }

  function keyOf(store, value) {
    const kp = (STORES[store] && STORES[store].keyPath) || 'id';
    return value[kp];
  }

  /* ------------------------------------------------------------ open/init */

  const OPEN_TIMEOUT = 6000;   // per attempt
  const OPEN_ATTEMPTS = 2;

  /**
   * Open the database, but never hang.
   *
   * `indexedDB.open()` can return a request whose callbacks never fire at all:
   * WebKit is known to drop requests made very early in page load, a blocked
   * upgrade from another tab fires `onblocked` and then nothing, and hardened
   * or private browsing modes sometimes stall instead of erroring. A promise
   * awaiting that request waits forever, which froze the whole boot sequence.
   *
   * So every attempt races a timeout, we retry once, and if it still will not
   * open we fall back to the in-memory shim and say so loudly.
   */
  function openOnce() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        return reject(new Error('IndexedDB is not available in this browser context.'));
      }

      let settled = false;
      const done = function (fn, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(function () {
        const err = new Error('The browser did not respond when opening local storage.');
        err.name = 'TimeoutError';
        done(reject, err);
      }, OPEN_TIMEOUT);

      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (err) { return done(reject, err); }

      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        const tx = e.target.transaction;
        for (const name in STORES) {
          const spec = STORES[name];
          let store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, { keyPath: spec.keyPath });
          } else {
            store = tx.objectStore(name);
          }
          (spec.indexes || []).forEach(function (idx) {
            const idxName = idx[0];
            if (!store.indexNames.contains(idxName)) {
              try { store.createIndex(idxName, idx[1], { unique: !!idx[2] }); }
              catch (err) { console.warn('[db] could not create index ' + name + '.' + idxName, err); }
            }
          });
        }
        // v1 shipped a unique index on notes.path; duplicates from older imports
        // could make writes fail forever, so drop uniqueness on upgrade.
        if (e.oldVersion > 0 && e.oldVersion < 3 && db.objectStoreNames.contains('notes')) {
          try {
            const notes = tx.objectStore('notes');
            if (notes.indexNames.contains('path')) notes.deleteIndex('path');
            notes.createIndex('path', 'path', { unique: false });
          } catch (err) { console.warn('[db] path index migration skipped', err); }
        }
      };

      req.onsuccess = function (e) {
        const db = e.target.result;
        db.onversionchange = function () {
          // Another tab is upgrading — close so it isn't blocked, then reload.
          try { db.close(); } catch (err) { /* already closed */ }
          dbPromise = null;
          N.bus.emit('db:versionchange');
        };
        db.onclose = function () { dbPromise = null; N.bus.emit('db:closed'); };
        done(resolve, db);
      };
      req.onerror = function () {
        done(reject, req.error || new Error('Could not open the local database.'));
      };
      req.onblocked = function () {
        // Another tab holds an older version open. Tell the app so it can ask
        // the user to close it; the timeout above stops us waiting forever.
        N.bus.emit('db:blocked');
      };
    });
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = (async function () {
      let lastError = null;
      for (let attempt = 1; attempt <= OPEN_ATTEMPTS; attempt++) {
        try {
          return await openOnce();
        } catch (err) {
          lastError = err;
          console.warn('[db] open attempt ' + attempt + ' of ' + OPEN_ATTEMPTS + ' failed:', err && err.message);
          if (attempt < OPEN_ATTEMPTS) {
            N.bus.emit('db:retrying', attempt);
            await new Promise(function (r) { setTimeout(r, 350); });
          }
        }
      }
      degraded = true;
      degradedReason = U.describeError(lastError, 'Local database unavailable.');
      console.error('[db] falling back to in-memory storage:', lastError);
      N.bus.emit('db:degraded', degradedReason);
      return null;
    })();
    return dbPromise;
  }

  /**
   * Try once more to reach a real database after a degraded start — used by the
   * recovery banner, so a transient stall does not doom the whole session.
   */
  async function retryOpen() {
    dbPromise = null;
    degraded = false;
    degradedReason = '';
    const db = await open();
    if (db) {
      // Flush anything written while we were running from memory.
      for (const store in STORES) {
        const rows = Array.from(memStore(store).values());
        if (rows.length) { try { await bulkPut(store, rows); } catch (err) { /* reported by bulkPut */ } }
      }
      N.bus.emit('db:recovered');
    }
    return !!db;
  }

  /** Run `fn(store)` inside a fresh transaction. Never await between get and use. */
  const TX_TIMEOUT = 8000;

  function withStore(name, mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        let tx;
        try { tx = db.transaction(name, mode); }
        catch (err) { return reject(err); }
        let result;
        // A transaction that never completes would strand every caller awaiting
        // it — including the boot sequence. Bound it like the open call.
        let settled = false;
        const guard = setTimeout(function () {
          if (settled) return;
          settled = true;
          try { tx.abort(); } catch (err) { /* already finished */ }
          reject(Object.assign(
            new Error('Local storage stopped responding while reading "' + name + '".'),
            { name: 'TimeoutError' }));
        }, TX_TIMEOUT);
        const finish = function (fn2, value) {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          fn2(value);
        };
        resolve = (function (original) { return function (v) { finish(original, v); }; })(resolve);
        reject = (function (original) { return function (v) { finish(original, v); }; })(reject);
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error('Transaction failed on "' + name + '".')); };
        tx.onabort = function () { reject(tx.error || new Error('Transaction aborted on "' + name + '".')); };
        try {
          const store = tx.objectStore(name);
          const maybe = fn(store);
          if (maybe && typeof maybe.then === 'function') maybe.then(function (r) { result = r; }, reject);
          else result = maybe;
        } catch (err) { try { tx.abort(); } catch (e2) {} reject(err); }
      });
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /* ------------------------------------------------------------- read/write */

  async function getAll(store) {
    if (degraded) return Array.from(memStore(store).values());
    try {
      return await withStore(store, 'readonly', function (s) {
        if (!s) return Array.from(memStore(store).values());
        return reqToPromise(s.getAll());
      }) || [];
    } catch (err) {
      console.error('[db] getAll(' + store + ')', err);
      return Array.from(memStore(store).values());
    }
  }

  async function get(store, id) {
    if (degraded) return memStore(store).get(id) || undefined;
    try {
      return await withStore(store, 'readonly', function (s) {
        if (!s) return memStore(store).get(id);
        return reqToPromise(s.get(id));
      });
    } catch (err) {
      console.error('[db] get(' + store + ')', err);
      return memStore(store).get(id);
    }
  }

  async function put(store, value) {
    // Mirror into memory first so a failed write never loses the running session.
    memStore(store).set(keyOf(store, value), value);
    if (degraded) return value;
    try {
      await withStore(store, 'readwrite', function (s) {
        if (!s) return null;
        return reqToPromise(s.put(sanitize(value)));
      });
      return value;
    } catch (err) {
      handleWriteError(err, store);
      return value;
    }
  }

  async function bulkPut(store, values) {
    if (!values || !values.length) return;
    values.forEach(function (v) { memStore(store).set(keyOf(store, v), v); });
    if (degraded) return;
    try {
      await withStore(store, 'readwrite', function (s) {
        if (!s) return null;
        // All requests share one transaction — far faster than one tx per row.
        const last = values.map(function (v) { return s.put(sanitize(v)); }).pop();
        return last ? reqToPromise(last) : null;
      });
    } catch (err) {
      handleWriteError(err, store);
    }
  }

  async function del(store, id) {
    memStore(store).delete(id);
    if (degraded) return;
    try {
      await withStore(store, 'readwrite', function (s) {
        if (!s) return null;
        return reqToPromise(s.delete(id));
      });
    } catch (err) {
      handleWriteError(err, store);
    }
  }

  async function bulkDelete(store, ids) {
    if (!ids || !ids.length) return;
    ids.forEach(function (id) { memStore(store).delete(id); });
    if (degraded) return;
    try {
      await withStore(store, 'readwrite', function (s) {
        if (!s) return null;
        const last = ids.map(function (id) { return s.delete(id); }).pop();
        return last ? reqToPromise(last) : null;
      });
    } catch (err) { handleWriteError(err, store); }
  }

  async function clear(store) {
    memStore(store).clear();
    if (degraded) return;
    try {
      await withStore(store, 'readwrite', function (s) { return s ? reqToPromise(s.clear()) : null; });
    } catch (err) { handleWriteError(err, store); }
  }

  async function count(store) {
    if (degraded) return memStore(store).size;
    try {
      return await withStore(store, 'readonly', function (s) {
        return s ? reqToPromise(s.count()) : memStore(store).size;
      }) || 0;
    } catch (err) { return memStore(store).size; }
  }

  /**
   * Strips values IndexedDB's structured clone cannot handle (functions, DOM
   * nodes, class instances with methods). Blobs and Files pass through intact.
   */
  function sanitize(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Blob || value instanceof File || value instanceof ArrayBuffer ||
        value instanceof Date || ArrayBuffer.isView(value)) return value;
    if (Array.isArray(value)) return value.map(sanitize);
    // FileSystemHandle objects are cloneable and must be preserved verbatim.
    if (typeof FileSystemHandle !== 'undefined' && value instanceof FileSystemHandle) return value;
    const out = {};
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const v = value[key];
      if (typeof v === 'function' || typeof v === 'symbol' || v === undefined) continue;
      if (v instanceof Node) continue;
      out[key] = sanitize(v);
    }
    return out;
  }

  function handleWriteError(err, store) {
    console.error('[db] write failed on "' + store + '"', err);
    const name = err && err.name;
    if (name === 'QuotaExceededError' || /quota/i.test((err && err.message) || '')) {
      N.bus.emit('db:quota-exceeded', { store: store, error: err });
    } else {
      N.bus.emit('db:write-error', { store: store, error: err });
    }
  }

  /* -------------------------------------------------------------- settings */

  async function getSetting(key, fallback) {
    const row = await get('settings', key);
    return row && 'value' in row ? row.value : (fallback === undefined ? null : fallback);
  }

  function setSetting(key, value) { return put('settings', { key: key, value: value }); }

  async function getMeta(key, fallback) {
    const row = await get('meta', key);
    return row && 'value' in row ? row.value : (fallback === undefined ? null : fallback);
  }

  function setMeta(key, value) { return put('meta', { key: key, value: value }); }

  /* ------------------------------------------------------------- lifecycle */

  /** Ask the browser to make storage persistent (survives cache eviction). */
  async function requestPersistence() {
    if (!U.supports.persistentStorage) return { supported: false, granted: false };
    try {
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (already) return { supported: true, granted: true, alreadyGranted: true };
      const granted = await navigator.storage.persist();
      return { supported: true, granted: granted };
    } catch (err) {
      return { supported: true, granted: false, error: U.describeError(err) };
    }
  }

  async function estimate() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        return { usage: e.usage || 0, quota: e.quota || 0, ratio: e.quota ? (e.usage / e.quota) : 0 };
      }
    } catch (err) { /* not fatal */ }
    return { usage: 0, quota: 0, ratio: 0, unknown: true };
  }

  /** Nuke everything (used by "reset app"), then reopen a clean database. */
  async function destroy() {
    memory.clear();
    try {
      const db = await open();
      if (db) db.close();
    } catch (err) { /* already closed */ }
    dbPromise = null;
    return new Promise(function (resolve) {
      let settled = false;
      const done = function (ok) { if (!settled) { settled = true; resolve(ok); } };
      try {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = function () { done(true); };
        req.onerror = function () { done(false); };
        req.onblocked = function () { done(false); };
        setTimeout(function () { done(false); }, 4000);
      } catch (err) { done(false); }
    });
  }

  /** Export every store as one plain object — the basis of zip/JSON backups. */
  async function exportAll() {
    const out = { version: DB_VERSION, exportedAt: Date.now(), stores: {} };
    for (const name in STORES) {
      if (name === 'settings') {
        // Directory handles are not portable across devices — strip them out.
        const rows = await getAll(name);
        out.stores[name] = rows.filter(function (r) { return r.key !== 'fs-dir-handle'; });
      } else {
        out.stores[name] = await getAll(name);
      }
    }
    return out;
  }

  async function importAll(dump, opts) {
    const options = opts || {};
    if (!dump || !dump.stores) throw new Error('That backup file is not in a format Nodalis recognises.');
    for (const name in dump.stores) {
      if (!STORES[name]) continue;             // ignore unknown stores from newer builds
      if (name === 'attachments' && options.skipAttachments) continue;
      const rows = dump.stores[name];
      if (!Array.isArray(rows)) continue;
      if (options.replace) await clear(name);
      const valid = rows.filter(function (r) { return r && keyOf(name, r) !== undefined; });
      await bulkPut(name, valid);
    }
    return true;
  }

  N.db = {
    DB_NAME: DB_NAME, DB_VERSION: DB_VERSION, STORES: STORES,
    open: open, getAll: getAll, get: get, put: put, bulkPut: bulkPut,
    delete: del, bulkDelete: bulkDelete, clear: clear, count: count,
    getSetting: getSetting, setSetting: setSetting, getMeta: getMeta, setMeta: setMeta,
    requestPersistence: requestPersistence, estimate: estimate,
    destroy: destroy, exportAll: exportAll, importAll: importAll, retryOpen: retryOpen,
    isDegraded: function () { return degraded; },
    degradedReason: function () { return degradedReason; },
  };
})(window.NODALIS = window.NODALIS || {});
