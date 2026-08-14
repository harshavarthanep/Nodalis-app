/* =========================================================================
 * Nodalis — ui/modal.js
 * Modals, bottom sheets, confirm/prompt/select dialogs.
 * Focus is trapped, Escape always closes, and every dialog resolves a
 * promise exactly once — including when dismissed by scrim or Escape.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  const openStack = [];
  let scrim = null;

  function ensureScrim() {
    if (!scrim || !document.body.contains(scrim)) {
      scrim = document.getElementById('scrim');
      if (!scrim) {
        scrim = el('div.scrim#scrim');
        document.body.appendChild(scrim);
      }
      scrim.addEventListener('click', function () {
        const top = openStack[openStack.length - 1];
        if (top && top.dismissible !== false) top.close(top.dismissValue);
      });
    }
    return scrim;
  }

  function updateScrim() {
    ensureScrim();
    if (openStack.length) scrim.classList.add('is-open');
    else scrim.classList.remove('is-open');
  }

  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function trapFocus(container, e) {
    const items = Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /**
   * Low-level opener. Returns { node, close(value), promise }.
   * `render(api)` receives { close } and returns the modal's inner nodes.
   */
  function open(options) {
    const o = options || {};
    const isSheet = o.sheet === true || (o.autoSheet !== false && window.innerWidth <= 760 && o.preferSheet);
    const previousFocus = document.activeElement;

    let resolveFn;
    const promise = new Promise(function (res) { resolveFn = res; });
    let settled = false;

    const node = el(isSheet ? 'div.sheet' : ('div.modal' + (o.size ? '.modal-' + o.size : '')), {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': o.title || o.ariaLabel || 'Dialog',
      tabindex: '-1',
    });

    const api = {
      node: node,
      close: function (value) { close(value); },
      promise: promise,
      dismissible: o.dismissible !== false,
      dismissValue: o.dismissValue === undefined ? null : o.dismissValue,
    };

    function close(value) {
      if (settled) return;
      settled = true;
      const idx = openStack.indexOf(api);
      if (idx !== -1) openStack.splice(idx, 1);
      document.removeEventListener('keydown', onKey, true);
      node.style.pointerEvents = 'none';
      if (isSheet) node.style.animation = 'sheet-out 200ms var(--ease-in-out) forwards';
      else node.style.animation = 'fade-out 160ms var(--ease-in-out) forwards';
      const remove = function () { if (node.parentNode) node.parentNode.removeChild(node); };
      node.addEventListener('animationend', remove, { once: true });
      setTimeout(remove, 400);
      updateScrim();
      try { if (previousFocus && previousFocus.focus) previousFocus.focus(); } catch (err) { /* element gone */ }
      if (o.onClose) { try { o.onClose(value); } catch (err) { console.error('[modal] onClose', err); } }
      resolveFn(value);
    }
    api.close = close;

    function onKey(e) {
      if (openStack[openStack.length - 1] !== api) return;
      if (e.key === 'Escape') {
        if (api.dismissible === false) return;
        e.preventDefault(); e.stopPropagation();
        close(api.dismissValue);
      } else if (e.key === 'Tab') {
        trapFocus(node, e);
      } else if (e.key === 'Enter' && o.onEnter && !e.shiftKey) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag !== 'TEXTAREA') { e.preventDefault(); o.onEnter(api); }
      }
    }

    if (isSheet) {
      node.appendChild(el('div.sheet-grip'));
      if (o.title) node.appendChild(el('div.sheet-title', null, o.title));
      const body = el('div.sheet-body');
      appendContent(body, o.render ? o.render(api) : o.content);
      node.appendChild(body);
    } else {
      if (o.title || o.showClose !== false) {
        const head = el('div.modal-head');
        head.appendChild(el('div.modal-title', null, o.title || ''));
        if (o.showClose !== false) {
          const x = el('button.icon-btn', { type: 'button', 'aria-label': 'Close', onclick: function () { close(api.dismissValue); } });
          x.appendChild(N.icons.node('close', { size: 18 }));
          head.appendChild(x);
        }
        node.appendChild(head);
      }
      const body = el('div.modal-body');
      appendContent(body, o.render ? o.render(api) : o.content);
      node.appendChild(body);
      if (o.footer) {
        const foot = el('div.modal-foot');
        appendContent(foot, typeof o.footer === 'function' ? o.footer(api) : o.footer);
        node.appendChild(foot);
      }
    }

    document.body.appendChild(node);
    openStack.push(api);
    updateScrim();
    document.addEventListener('keydown', onKey, true);

    // Focus the first sensible control, or the dialog itself.
    requestAnimationFrame(function () {
      const target = node.querySelector('[data-autofocus]') || node.querySelector(FOCUSABLE);
      if (target && target.focus) { try { target.focus(); if (target.select) target.select(); } catch (err) {} }
      else node.focus();
    });

    return api;
  }

  function appendContent(host, content) {
    if (!content) return;
    if (Array.isArray(content)) { content.forEach(function (c) { appendContent(host, c); }); return; }
    if (content instanceof Node) { host.appendChild(content); return; }
    host.appendChild(document.createTextNode(String(content)));
  }

  /* ------------------------------------------------------------- dialogs */

  /** confirm(...) -> Promise<boolean> */
  function confirm(options) {
    const o = typeof options === 'string' ? { message: options } : (options || {});
    const api = open({
      title: o.title || 'Are you sure?',
      size: 'sm',
      preferSheet: false,
      dismissValue: false,
      render: function () {
        const wrap = el('div');
        if (o.message) wrap.appendChild(el('p', { style: { lineHeight: '1.6', color: 'var(--text-1)' } }, o.message));
        if (o.detail) wrap.appendChild(el('p.small.muted', { style: { marginTop: '10px', lineHeight: '1.55' } }, o.detail));
        return wrap;
      },
      footer: function (a) {
        return [
          el('button.btn', { type: 'button', onclick: function () { a.close(false); } }, o.cancelLabel || 'Cancel'),
          el('button.btn.' + (o.danger ? 'btn-danger-solid' : 'btn-primary'), {
            type: 'button', 'data-autofocus': '', onclick: function () { a.close(true); },
          }, o.confirmLabel || 'Confirm'),
        ];
      },
      onEnter: function (a) { a.close(true); },
    });
    return api.promise;
  }

  /** prompt(...) -> Promise<string|null> */
  function prompt(options) {
    const o = typeof options === 'string' ? { title: options } : (options || {});
    let input;
    const api = open({
      title: o.title || 'Enter a value',
      size: 'sm',
      dismissValue: null,
      render: function (a) {
        const wrap = el('div');
        if (o.message) wrap.appendChild(el('p.small.muted', { style: { marginBottom: '10px', lineHeight: '1.55' } }, o.message));
        input = el(o.multiline ? 'textarea.field' : 'input.field', {
          type: 'text',
          placeholder: o.placeholder || '',
          'data-autofocus': '',
          value: o.value || '',
        });
        if (o.multiline) input.style.minHeight = '110px';
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && (!o.multiline || (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            submit(a);
          }
        });
        wrap.appendChild(input);
        const err = el('div.field-error.hidden');
        wrap.appendChild(err);
        wrap._err = err;
        return wrap;
      },
      footer: function (a) {
        return [
          el('button.btn', { type: 'button', onclick: function () { a.close(null); } }, o.cancelLabel || 'Cancel'),
          el('button.btn.btn-primary', { type: 'button', onclick: function () { submit(a); } }, o.confirmLabel || 'Save'),
        ];
      },
    });

    function submit(a) {
      const value = input ? input.value : '';
      if (o.validate) {
        const problem = o.validate(value);
        if (problem) {
          input.classList.add('has-error');
          const err = api.node.querySelector('.field-error');
          if (err) { err.textContent = problem; err.classList.remove('hidden'); }
          input.focus();
          return;
        }
      }
      if (o.required !== false && !String(value).trim()) {
        input.classList.add('has-error');
        input.focus();
        input.classList.add('is-shaking');
        setTimeout(function () { input.classList.remove('is-shaking'); }, 500);
        return;
      }
      a.close(value);
    }

    return api.promise;
  }

  /**
   * choose({ title, options: [{ value, label, description, icon, danger }] })
   *   -> Promise<value|null>. Renders as a sheet on phones, a list on desktop.
   */
  function choose(options) {
    const o = options || {};
    const api = open({
      title: o.title || 'Choose',
      size: 'sm',
      preferSheet: true,
      dismissValue: null,
      showClose: true,
      render: function (a) {
        const list = el('div.stack', { style: { gap: '4px' } });
        if (o.message) list.appendChild(el('p.small.muted', { style: { marginBottom: '8px', lineHeight: '1.55' } }, o.message));
        (o.options || []).forEach(function (opt, i) {
          const btn = el('button.sheet-item' + (opt.danger ? '.is-danger' : ''), {
            type: 'button',
            onclick: function () { a.close(opt.value); },
          });
          if (opt.icon) btn.appendChild(N.icons.node(opt.icon, { size: 18 }));
          const main = el('div', { style: { flex: '1', minWidth: '0' } });
          main.appendChild(el('div', null, opt.label));
          if (opt.description) main.appendChild(el('div.small.muted', { style: { lineHeight: '1.4' } }, opt.description));
          btn.appendChild(main);
          if (opt.hint) btn.appendChild(el('span.sheet-item-hint', null, opt.hint));
          if (i === 0) btn.setAttribute('data-autofocus', '');
          list.appendChild(btn);
        });
        return list;
      },
    });
    return api.promise;
  }

  /** A simple message box with one OK button. */
  function alert(options) {
    const o = typeof options === 'string' ? { message: options } : (options || {});
    return open({
      title: o.title || 'Heads up',
      size: 'sm',
      render: function () {
        const wrap = el('div');
        wrap.appendChild(el('p', { style: { lineHeight: '1.6', color: 'var(--text-1)' } }, o.message || ''));
        if (o.detail) wrap.appendChild(el('p.small.muted', { style: { marginTop: '10px', lineHeight: '1.55' } }, o.detail));
        return wrap;
      },
      footer: function (a) {
        return el('button.btn.btn-primary', { type: 'button', 'data-autofocus': '', onclick: function () { a.close(true); } }, o.okLabel || 'Got it');
      },
      onEnter: function (a) { a.close(true); },
    }).promise;
  }

  function closeTop() {
    const top = openStack[openStack.length - 1];
    if (top) top.close(top.dismissValue);
    return !!top;
  }

  function anyOpen() { return openStack.length > 0; }

  N.modal = {
    open: open, confirm: confirm, prompt: prompt, choose: choose, alert: alert,
    closeTop: closeTop, anyOpen: anyOpen,
  };
})(window.NODALIS = window.NODALIS || {});
