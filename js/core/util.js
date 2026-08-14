/* =========================================================================
 * Nodalis — core/util.js
 * Small, dependency-free helpers used across the whole app.
 * Loaded as a classic script so the app also works from file:// URLs.
 * ========================================================================= */
(function (N) {
  'use strict';

  /* ---------------------------------------------------------------- ids */

  /** Monotonic-ish, collision-resistant id. Prefix keeps stores readable. */
  function uid(prefix) {
    return (prefix || 'n') +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9);
  }

  /** Stable short hash of a string — used for block ids and cache keys. */
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* ---------------------------------------------------------------- dom */

  /**
   * Terse element factory.
   *   el('div.card', { onclick: fn }, [child, 'text'])
   * Tag string supports `tag.class1.class2#id`.
   */
  function el(spec, attrs, children) {
    const idMatch = /#([\w-]+)/.exec(spec);
    const id = idMatch ? idMatch[1] : null;
    const clean = spec.replace(/#[\w-]+/, '');
    const parts = clean.split('.');
    const tag = parts[0] || 'div';
    const node = document.createElement(tag);
    if (id) node.id = id;
    for (let i = 1; i < parts.length; i++) if (parts[i]) node.classList.add(parts[i]);

    if (attrs) {
      for (const key in attrs) {
        const val = attrs[key];
        if (val === null || val === undefined || val === false) continue;
        if (key === 'style' && typeof val === 'object') { Object.assign(node.style, val); }
        else if (key === 'dataset' && typeof val === 'object') { Object.assign(node.dataset, val); }
        else if (key === 'html') { node.innerHTML = val; }
        else if (key === 'text') { node.textContent = val; }
        else if (key.startsWith('on') && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (val === true) { node.setAttribute(key, ''); }
        else { node.setAttribute(key, val); }
      }
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) { children.forEach((c) => appendChildren(node, c)); return; }
    if (children instanceof Node) { node.appendChild(children); return; }
    if (children === false) return;
    node.appendChild(document.createTextNode(String(children)));
  }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  function on(target, event, handler, opts) {
    if (!target) return function () {};
    target.addEventListener(event, handler, opts);
    return function () { target.removeEventListener(event, handler, opts); };
  }

  /** Event delegation: fires handler when the event's target matches `sel`. */
  function delegate(root, event, sel, handler, opts) {
    return on(root, event, function (e) {
      const match = e.target && e.target.closest ? e.target.closest(sel) : null;
      if (match && root.contains(match)) handler(e, match);
    }, opts);
  }

  /* ------------------------------------------------------------- strings */

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(str) { return escapeHtml(str).replace(/`/g, '&#96;'); }

  function escapeRegExp(str) { return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /** Filesystem-safe name. Never returns an empty string. */
  function safeFileName(name, fallback) {
    let out = String(name === null || name === undefined ? '' : name)
      .replace(/[\u0000-\u001f\u007f]/g, '')      // control characters
      .replace(/[\\/:*?"<>|]/g, '-')             // path and shell separators
      .replace(/\.{2,}/g, '.')                   // no '..' segment can survive
      .replace(/\s+/g, ' ')
      .replace(/^[.\-\s]+/, '')                  // no leading dot, dash or space
      .replace(/[.\s]+$/, '')                    // no trailing dot or space
      .trim();
    // Windows reserved device names, guarded even on other platforms so vaults stay portable.
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(out)) out = '_' + out;
    if (out.length > 120) out = out.slice(0, 120).trim();
    return out || (fallback || 'Untitled');
  }

  function truncate(str, max) {
    const s = String(str || '');
    return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
  }

  function pluralize(count, singular, plural) {
    return count + ' ' + (count === 1 ? singular : (plural || singular + 's'));
  }

  function slugify(str) {
    return String(str || '').toLowerCase().trim()
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  }

  /* ---------------------------------------------------------------- time */

  function todayKey(date) {
    const d = date ? new Date(date) : new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function parseDayKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function daysBetween(aKey, bKey) {
    const a = parseDayKey(aKey), b = parseDayKey(bKey);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function formatDate(ts, opts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleDateString(undefined, opts || { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (err) { return new Date(ts).toDateString(); }
  }

  function formatTime(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
    catch (err) { return ''; }
  }

  function relativeTime(ts) {
    if (!ts) return 'never';
    const diff = Date.now() - ts;
    if (diff < 0) return 'just now';
    const sec = Math.floor(diff / 1000);
    if (sec < 45) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return pluralize(min, 'minute') + ' ago';
    const hr = Math.floor(min / 60);
    if (hr < 24) return pluralize(hr, 'hour') + ' ago';
    const day = Math.floor(hr / 24);
    if (day < 7) return pluralize(day, 'day') + ' ago';
    if (day < 31) return pluralize(Math.floor(day / 7), 'week') + ' ago';
    return formatDate(ts);
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return (i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)) + ' ' + units[i];
  }

  /* --------------------------------------------------------------- timing */

  function debounce(fn, wait) {
    let timer = null;
    const wrapped = function () {
      const args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { timer = null; fn.apply(ctx, args); }, wait);
    };
    wrapped.cancel = function () { clearTimeout(timer); timer = null; };
    wrapped.flush = function () { if (timer) { clearTimeout(timer); timer = null; fn(); } };
    wrapped.pending = function () { return timer !== null; };
    return wrapped;
  }

  function throttle(fn, wait) {
    let last = 0, timer = null, lastArgs = null;
    return function () {
      lastArgs = arguments;
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer); timer = null; last = now; fn.apply(this, lastArgs);
      } else if (!timer) {
        timer = setTimeout(() => { last = Date.now(); timer = null; fn.apply(this, lastArgs); }, remaining);
      }
    };
  }

  function raf(fn) { return requestAnimationFrame(fn); }

  function nextFrame() { return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); }

  function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  /** Runs work in chunks so a huge vault never freezes the UI thread. */
  async function chunked(items, size, worker, onProgress) {
    const list = Array.from(items);
    const results = [];
    for (let i = 0; i < list.length; i += size) {
      const slice = list.slice(i, i + size);
      for (const item of slice) results.push(await worker(item));
      if (onProgress) onProgress(Math.min(i + size, list.length), list.length);
      if (i + size < list.length) await new Promise((r) => setTimeout(r, 0));
    }
    return results;
  }

  /* ---------------------------------------------------------------- misc */

  function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(obj); } catch (err) { /* falls through */ }
    }
    try { return JSON.parse(JSON.stringify(obj)); } catch (err) { return obj; }
  }

  /** Deep merge that never lets a stored value replace an object with a scalar. */
  function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    for (const key in patch) {
      const pv = patch[key], bv = base[key];
      if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
        deepMerge(bv, pv);
      } else if (pv !== undefined) {
        base[key] = pv;
      }
    }
    return base;
  }

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /** Sort comparator that puts numbers before strings and handles null gracefully. */
  function compareValues(a, b) {
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const an = Number(a), bn = Number(b);
    if (!isNaN(an) && !isNaN(bn) && String(a).trim() !== '' && String(b).trim() !== '') return an - bn;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  /* ------------------------------------------------------------- matching */

  /**
   * Subsequence fuzzy match with a quality score.
   * Returns null when it doesn't match, otherwise { score, indices }.
   */
  function fuzzyMatch(needle, haystack) {
    const n = String(needle || '').toLowerCase();
    const h = String(haystack || '');
    const hl = h.toLowerCase();
    if (!n) return { score: 0, indices: [] };
    if (n.length > h.length) return null;

    const exact = hl.indexOf(n);
    if (exact !== -1) {
      const indices = [];
      for (let i = 0; i < n.length; i++) indices.push(exact + i);
      // Big bonus for contiguous matches, extra for prefix matches.
      return { score: 1000 - exact * 2 + (exact === 0 ? 200 : 0) - (h.length - n.length) * 0.2, indices: indices };
    }

    let hi = 0, score = 0, streak = 0;
    const indices = [];
    for (let ni = 0; ni < n.length; ni++) {
      const ch = n[ni];
      let found = -1;
      while (hi < h.length) {
        if (hl[hi] === ch) { found = hi; break; }
        hi++;
      }
      if (found === -1) return null;
      indices.push(found);
      const prev = indices.length > 1 ? indices[indices.length - 2] : -2;
      if (found === prev + 1) { streak++; score += 8 + streak * 3; }
      else { streak = 0; score += 2; }
      // Word-boundary bonus.
      const before = found > 0 ? h[found - 1] : ' ';
      if (/[\s/_\-.]/.test(before)) score += 10;
      if (found === 0) score += 12;
      hi = found + 1;
    }
    score -= (h.length - n.length) * 0.15;
    return { score: score, indices: indices };
  }

  /** Wrap matched characters in <mark> for palette/search results. */
  function highlightIndices(text, indices) {
    if (!indices || !indices.length) return escapeHtml(text);
    const set = new Set(indices);
    let out = '', open = false;
    for (let i = 0; i < text.length; i++) {
      const isMatch = set.has(i);
      if (isMatch && !open) { out += '<mark>'; open = true; }
      else if (!isMatch && open) { out += '</mark>'; open = false; }
      out += escapeHtml(text[i]);
    }
    if (open) out += '</mark>';
    return out;
  }

  /* -------------------------------------------------------------- colour */

  function hexToRgb(hex) {
    let m = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(m)) return { r: 108, g: 92, b: 231 };
    if (m.length === 3) m = m.split('').map((c) => c + c).join('');
    const int = parseInt(m, 16);
    return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
  }

  function rgbToHex(r, g, b) {
    const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  function mix(hex, targetHex, amount) {
    const a = hexToRgb(hex), b = hexToRgb(targetHex);
    return rgbToHex(a.r + (b.r - a.r) * amount, a.g + (b.g - a.g) * amount, a.b + (b.b - a.b) * amount);
  }

  /** Perceived luminance 0..1 — used to pick readable foreground colours. */
  function luminance(hex) {
    const c = hexToRgb(hex);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function readableOn(hex) { return luminance(hex) > 0.45 ? '#101014' : '#ffffff'; }

  function contrastRatio(a, b) {
    const la = luminance(a), lb = luminance(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /** Deterministic pleasant colour from any string — for tags and graph nodes. */
  function colorFromString(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return 'hsl(' + hue + ' 62% 52%)';
  }

  /* ------------------------------------------------------- feature detect */

  const supports = {
    fileSystemAccess: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    opfs: typeof navigator !== 'undefined' && !!(navigator.storage && navigator.storage.getDirectory),
    persistentStorage: typeof navigator !== 'undefined' && !!(navigator.storage && navigator.storage.persist),
    share: typeof navigator !== 'undefined' && !!navigator.share,
    shareFiles: typeof navigator !== 'undefined' && !!navigator.canShare,
    backdropFilter: (function () {
      if (typeof CSS === 'undefined' || !CSS.supports) return false;
      return CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)');
    })(),
    svgBackdropFilter: (function () {
      // Only Chromium supports SVG filters in backdrop-filter (needed for true refraction).
      if (typeof CSS === 'undefined' || !CSS.supports) return false;
      const ua = navigator.userAgent || '';
      const chromium = /Chrome|Chromium|Edg/.test(ua) && !/OPR|Firefox/.test(ua);
      return chromium && CSS.supports('backdrop-filter', 'blur(2px)');
    })(),
    touch: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    pointerEvents: typeof window !== 'undefined' && 'PointerEvent' in window,
    reducedMotion: typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
    clipboardWrite: typeof navigator !== 'undefined' && !!(navigator.clipboard && navigator.clipboard.write),
    wakeLock: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    isStandalone: (function () {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    })(),
    isIOS: typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)),
    isSafari: typeof navigator !== 'undefined' &&
      /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent),
  };

  /* ------------------------------------------------------------ downloads */

  function downloadBlob(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 4000);
      return true;
    } catch (err) {
      console.error('[nodalis] download failed', err);
      return false;
    }
  }

  function downloadText(text, filename, mime) {
    return downloadBlob(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename);
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) { /* falls through to the legacy path below */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  /* -------------------------------------------------------------- errors */

  /**
   * Turns any thrown value into an honest, human-readable sentence.
   * Used everywhere so failures never surface as "[object Object]".
   */
  function describeError(err, fallback) {
    if (!err) return fallback || 'Something went wrong.';
    const name = err.name || '';
    const msg = err.message || String(err);
    if (name === 'AbortError') return 'Cancelled.';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Permission was denied by the browser.';
    }
    if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
      return 'Storage is full. Free up space or export your vault to a folder.';
    }
    if (name === 'NotFoundError') return 'That file or folder could not be found — it may have been moved or deleted.';
    if (name === 'NoModificationAllowedError') return 'The file is locked by another app or tab.';
    if (name === 'InvalidStateError') return 'The storage connection was reset. Reload the page to reconnect.';
    if (name === 'TypeMismatchError') return 'That entry is not the kind of file or folder expected here.';
    if (/network|fetch|offline/i.test(msg)) return 'Network unavailable — this change is saved locally and will retry.';
    return msg || fallback || 'Something went wrong.';
  }

  /** Wrap an async fn so a rejection is logged and reported, never silent. */
  function guarded(label, fn) {
    return async function () {
      try { return await fn.apply(this, arguments); }
      catch (err) {
        console.error('[nodalis:' + label + ']', err);
        if (N.toast) N.toast.error(describeError(err));
        return undefined;
      }
    };
  }

  N.util = {
    uid: uid, hash: hash,
    el: el, $: $, $$: $$, clear: clear, on: on, delegate: delegate,
    escapeHtml: escapeHtml, escapeAttr: escapeAttr, escapeRegExp: escapeRegExp,
    safeFileName: safeFileName, truncate: truncate, pluralize: pluralize, slugify: slugify,
    todayKey: todayKey, parseDayKey: parseDayKey, daysBetween: daysBetween,
    formatDate: formatDate, formatTime: formatTime, relativeTime: relativeTime, formatBytes: formatBytes,
    debounce: debounce, throttle: throttle, raf: raf, nextFrame: nextFrame, sleep: sleep, chunked: chunked,
    clamp: clamp, deepClone: deepClone, deepMerge: deepMerge, isPlainObject: isPlainObject, compareValues: compareValues,
    fuzzyMatch: fuzzyMatch, highlightIndices: highlightIndices,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgba: rgba, mix: mix,
    luminance: luminance, readableOn: readableOn, contrastRatio: contrastRatio, colorFromString: colorFromString,
    supports: supports,
    downloadBlob: downloadBlob, downloadText: downloadText, copyToClipboard: copyToClipboard,
    describeError: describeError, guarded: guarded,
  };
})(window.NODALIS = window.NODALIS || {});
