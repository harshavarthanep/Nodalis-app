/* =========================================================================
 * Nodalis — ui/toast.js
 * Transient messages. Deliberately quiet: errors persist until dismissed,
 * successes fade, and identical messages collapse instead of stacking up.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let stack = null;
  const active = new Map();      // key -> { node, timer, count }
  const MAX_VISIBLE = 4;

  function ensureStack() {
    if (stack && document.body.contains(stack)) return stack;
    stack = document.getElementById('toast-stack');
    if (!stack) {
      stack = el('div.toast-stack#toast-stack', { role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(stack);
    }
    return stack;
  }

  const ICON_FOR = { success: 'success', error: 'error', warn: 'warning', info: 'info' };
  const DEFAULT_MS = { success: 3200, error: 0, warn: 6000, info: 4200 };

  /**
   * show(message, options)
   *   kind    'info' | 'success' | 'error' | 'warn'
   *   title   optional bold first line
   *   ms      0 keeps it until dismissed
   *   action  { label, onClick }
   *   key     dedupe key (defaults to the message text)
   */
  function show(message, options) {
    const o = options || {};
    const kind = o.kind || 'info';
    const key = o.key || (kind + ':' + message);
    const text = String(message === null || message === undefined ? '' : message);
    if (!text && !o.title) return function () {};

    ensureStack();

    // Same message already on screen: bump its counter and restart the timer.
    const existing = active.get(key);
    if (existing) {
      existing.count++;
      const badge = existing.node.querySelector('.toast-count');
      if (badge) badge.textContent = '×' + existing.count;
      else if (existing.count > 1) {
        existing.node.querySelector('.toast-main').appendChild(
          el('span.toast-count.dim.small', { style: { marginLeft: '6px' } }, '×' + existing.count));
      }
      restartTimer(key, o.ms === undefined ? DEFAULT_MS[kind] : o.ms);
      return function () { dismiss(key); };
    }

    const node = el('div.toast.is-' + kind, { role: kind === 'error' ? 'alert' : 'status' });
    node.appendChild(N.icons.node(ICON_FOR[kind] || 'info', { size: 18 }));

    const main = el('div.toast-main');
    if (o.title) main.appendChild(el('div.toast-title', null, o.title));
    if (text) main.appendChild(el('div.toast-text', null, text));
    node.appendChild(main);

    if (o.action && o.action.label) {
      node.appendChild(el('button.toast-action', {
        type: 'button',
        onclick: function () {
          try { o.action.onClick && o.action.onClick(); }
          catch (err) { console.error('[toast] action failed', err); }
          dismiss(key);
        },
      }, o.action.label));
    }

    const closeBtn = el('button.icon-btn.icon-btn-sm', {
      type: 'button', title: 'Dismiss', 'aria-label': 'Dismiss',
      onclick: function () { dismiss(key); },
    });
    closeBtn.appendChild(N.icons.node('close', { size: 14 }));
    node.appendChild(closeBtn);

    const ms = o.ms === undefined ? DEFAULT_MS[kind] : o.ms;
    if (ms > 0) {
      const bar = el('div.toast-progress', { style: { width: '100%', transition: 'width ' + ms + 'ms linear' } });
      node.appendChild(bar);
      requestAnimationFrame(function () { bar.style.width = '0%'; });
    }

    // Pause the countdown while the pointer rests on the toast.
    node.addEventListener('mouseenter', function () { pauseTimer(key); });
    node.addEventListener('mouseleave', function () { restartTimer(key, ms); });

    stack.appendChild(node);
    active.set(key, { node: node, timer: null, count: 1, ms: ms });
    if (ms > 0) restartTimer(key, ms);

    trimOverflow();
    return function () { dismiss(key); };
  }

  function trimOverflow() {
    const keys = Array.from(active.keys());
    while (keys.length > MAX_VISIBLE) {
      const oldest = keys.shift();
      dismiss(oldest);
    }
  }

  function pauseTimer(key) {
    const entry = active.get(key);
    if (entry && entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
    if (entry) {
      const bar = entry.node.querySelector('.toast-progress');
      if (bar) {
        const w = bar.getBoundingClientRect().width;
        bar.style.transition = 'none';
        bar.style.width = w + 'px';
      }
    }
  }

  function restartTimer(key, ms) {
    const entry = active.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    if (!ms || ms <= 0) return;
    entry.timer = setTimeout(function () { dismiss(key); }, ms);
    const bar = entry.node.querySelector('.toast-progress');
    if (bar) {
      bar.style.transition = 'width ' + ms + 'ms linear';
      requestAnimationFrame(function () { bar.style.width = '0%'; });
    }
  }

  function dismiss(key) {
    const entry = active.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    active.delete(key);
    entry.node.classList.add('is-leaving');
    const remove = function () { if (entry.node.parentNode) entry.node.parentNode.removeChild(entry.node); };
    entry.node.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 600);   // belt-and-braces if the animation never fires
  }

  function dismissAll() { Array.from(active.keys()).forEach(dismiss); }

  N.toast = {
    show: show,
    info: function (m, o) { return show(m, Object.assign({ kind: 'info' }, o)); },
    success: function (m, o) { return show(m, Object.assign({ kind: 'success' }, o)); },
    error: function (m, o) { return show(m, Object.assign({ kind: 'error' }, o)); },
    warn: function (m, o) { return show(m, Object.assign({ kind: 'warn' }, o)); },
    dismiss: dismiss,
    dismissAll: dismissAll,
  };
})(window.NODALIS = window.NODALIS || {});
