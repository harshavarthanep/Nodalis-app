/* =========================================================================
 * Nodalis — core/bus.js
 * Pub/sub event bus. Every listener is isolated: one throwing handler can
 * never stop the others from running, and never breaks the emitting caller.
 * ========================================================================= */
(function (N) {
  'use strict';

  const listeners = new Map();   // event -> Set<fn>
  const onceWrappers = new WeakMap();
  let depth = 0;
  const MAX_DEPTH = 24;          // guards against accidental emit loops

  function on(event, fn) {
    if (typeof fn !== 'function') return function () {};
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return function off() {
      const set = listeners.get(event);
      if (set) {
        set.delete(fn);
        if (!set.size) listeners.delete(event);
      }
    };
  }

  function once(event, fn) {
    const wrapper = function (payload) { off(event, wrapper); fn(payload); };
    onceWrappers.set(fn, wrapper);
    return on(event, wrapper);
  }

  function off(event, fn) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(fn);
    const wrapper = onceWrappers.get(fn);
    if (wrapper) set.delete(wrapper);
    if (!set.size) listeners.delete(event);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set || !set.size) return;
    if (depth > MAX_DEPTH) {
      console.warn('[bus] emit depth exceeded, dropping "' + event + '" to break a feedback loop');
      return;
    }
    depth++;
    // Copy first: handlers are allowed to subscribe/unsubscribe while running.
    const snapshot = Array.from(set);
    for (let i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (err) {
        console.error('[bus:' + event + ']', err);
      }
    }
    depth--;
  }

  /** Fire-and-forget async emit — handlers may return promises we await together. */
  async function emitAsync(event, payload) {
    const set = listeners.get(event);
    if (!set || !set.size) return [];
    const snapshot = Array.from(set);
    const results = [];
    for (let i = 0; i < snapshot.length; i++) {
      try { results.push(await snapshot[i](payload)); }
      catch (err) { console.error('[bus:' + event + ':async]', err); results.push(undefined); }
    }
    return results;
  }

  function clearAll() { listeners.clear(); }

  function counts() {
    const out = {};
    listeners.forEach((set, key) => { out[key] = set.size; });
    return out;
  }

  N.bus = { on: on, once: once, off: off, emit: emit, emitAsync: emitAsync, clearAll: clearAll, counts: counts };
})(window.NODALIS = window.NODALIS || {});
