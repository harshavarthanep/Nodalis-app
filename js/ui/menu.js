/* =========================================================================
 * Nodalis — ui/menu.js
 * Context menus (right-click / long-press) and hover tooltips.
 * Menus flip when they would fall off-screen, are fully keyboard navigable,
 * and become bottom sheets on phones where a floating menu is unusable.
 * ========================================================================= */
(function (N) {
  'use strict';

  const U = N.util;
  const el = U.el;

  let current = null;
  let currentCleanup = null;

  function closeMenu() {
    if (currentCleanup) { currentCleanup(); currentCleanup = null; }
    if (current && current.parentNode) current.parentNode.removeChild(current);
    current = null;
  }

  /**
   * show(items, { x, y, anchor, title })
   * items: [{ label, icon, hint, danger, disabled, onClick, separator, header, checked }]
   */
  function show(items, options) {
    const o = options || {};
    closeMenu();

    const usable = (items || []).filter(Boolean);
    if (!usable.length) return null;

    // Phones get a sheet — a 190px floating menu next to a thumb is a bad target.
    if (window.innerWidth <= 760 && o.allowSheet !== false) {
      return N.modal.open({
        title: o.title || '',
        sheet: true,
        render: function (api) {
          const list = el('div');
          usable.forEach(function (item) {
            if (item.separator) { list.appendChild(el('div.menu-sep')); return; }
            if (item.header) { list.appendChild(el('div.menu-head', null, item.header)); return; }
            const btn = el('button.sheet-item' + (item.danger ? '.is-danger' : ''), {
              type: 'button',
              disabled: !!item.disabled,
              onclick: function () { api.close(); runItem(item); },
            });
            if (item.icon) btn.appendChild(N.icons.node(item.icon, { size: 18 }));
            btn.appendChild(el('span', { style: { flex: '1' } }, item.label));
            if (item.checked) btn.appendChild(N.icons.node('check-small', { size: 16 }));
            else if (item.hint) btn.appendChild(el('span.sheet-item-hint', null, item.hint));
            if (item.danger) btn.style.color = '#e0245e';
            list.appendChild(btn);
          });
          return list;
        },
      });
    }

    const menu = el('div.menu', { role: 'menu' });
    if (o.title) menu.appendChild(el('div.menu-head', null, o.title));

    const focusables = [];
    usable.forEach(function (item) {
      if (item.separator) { menu.appendChild(el('div.menu-sep')); return; }
      if (item.header) { menu.appendChild(el('div.menu-head', null, item.header)); return; }
      const btn = el('button.menu-item' + (item.danger ? '.is-danger' : ''), {
        type: 'button', role: 'menuitem', disabled: !!item.disabled,
        onclick: function (e) { e.stopPropagation(); closeMenu(); runItem(item); },
      });
      if (item.icon) btn.appendChild(N.icons.node(item.icon, { size: 16 }));
      else if (usable.some(function (i) { return i.icon; })) btn.appendChild(el('span', { style: { width: '16px', flex: 'none' } }));
      btn.appendChild(el('span.menu-item-label', null, item.label));
      if (item.checked) btn.appendChild(N.icons.node('check-small', { size: 14 }));
      else if (item.hint) btn.appendChild(el('span.menu-item-hint', null, item.hint));
      if (!item.disabled) focusables.push(btn);
      menu.appendChild(btn);
    });

    // Position off-screen first so we can measure before painting.
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';
    document.body.appendChild(menu);
    current = menu;

    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const pad = 8;
    let x = o.x, y = o.y;

    if (o.anchor && o.anchor.getBoundingClientRect) {
      const a = o.anchor.getBoundingClientRect();
      x = o.align === 'right' ? a.right - rect.width : a.left;
      y = a.bottom + 4;
      if (y + rect.height > vh - pad && a.top - rect.height - 4 > pad) y = a.top - rect.height - 4;
    }
    if (x === undefined) x = (vw - rect.width) / 2;
    if (y === undefined) y = (vh - rect.height) / 2;

    if (x + rect.width > vw - pad) x = vw - rect.width - pad;
    if (y + rect.height > vh - pad) y = Math.max(pad, vh - rect.height - pad);
    x = Math.max(pad, x);
    y = Math.max(pad, y);

    menu.style.left = Math.round(x) + 'px';
    menu.style.top = Math.round(y) + 'px';
    menu.style.setProperty('--menu-origin', (y < (o.y || y) ? 'bottom' : 'top') + ' left');
    menu.style.visibility = '';

    let focusIndex = -1;
    function move(delta) {
      if (!focusables.length) return;
      focusables.forEach(function (b) { b.classList.remove('is-focused'); });
      focusIndex = (focusIndex + delta + focusables.length) % focusables.length;
      const target = focusables[focusIndex];
      target.classList.add('is-focused');
      target.focus();
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Home') { e.preventDefault(); focusIndex = -1; move(1); }
      else if (e.key === 'End') { e.preventDefault(); focusIndex = 0; move(-1); }
      else if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
    }

    function onOutside(e) {
      if (current && !current.contains(e.target)) closeMenu();
    }

    // A microtask delay stops the opening click from immediately closing it.
    const t = setTimeout(function () {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('touchstart', onOutside, true);
    }, 0);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('blur', closeMenu);
    const scrollables = [window];
    scrollables.forEach(function (s) { s.addEventListener('scroll', closeMenu, true); });

    currentCleanup = function () {
      clearTimeout(t);
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('touchstart', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('blur', closeMenu);
      scrollables.forEach(function (s) { s.removeEventListener('scroll', closeMenu, true); });
    };

    return menu;
  }

  function runItem(item) {
    if (!item || item.disabled || typeof item.onClick !== 'function') return;
    try { item.onClick(); }
    catch (err) {
      console.error('[menu] action failed', err);
      N.toast.error(U.describeError(err));
    }
  }

  /**
   * Attach a context menu to a container via delegation.
   * `build(target, event)` returns the item list (or null to do nothing).
   * Handles right-click on desktop and long-press on touch.
   */
  function attach(root, selector, build, opts) {
    const o = opts || {};

    U.delegate(root, 'contextmenu', selector, function (e, target) {
      const items = build(target, e);
      if (!items || !items.length) return;
      e.preventDefault();
      e.stopPropagation();
      show(items, { x: e.clientX, y: e.clientY, title: o.title ? o.title(target) : undefined });
    });

    // Long-press for touch devices.
    let pressTimer = null, startX = 0, startY = 0, moved = false;
    U.delegate(root, 'touchstart', selector, function (e, target) {
      if (e.touches.length !== 1) return;
      moved = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        if (moved) return;
        const items = build(target, e);
        if (!items || !items.length) return;
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
        show(items, { x: startX, y: startY, title: o.title ? o.title(target) : undefined });
      }, 480);
    }, { passive: true });

    const cancel = function (e) {
      if (e && e.touches && e.touches[0]) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx < 8 && dy < 8) return;
        moved = true;
      }
      clearTimeout(pressTimer);
    };
    root.addEventListener('touchmove', cancel, { passive: true });
    root.addEventListener('touchend', function () { clearTimeout(pressTimer); }, { passive: true });
    root.addEventListener('touchcancel', function () { clearTimeout(pressTimer); }, { passive: true });
  }

  /* --------------------------------------------------------------- tooltip */

  let tipNode = null, tipTimer = null, tipTarget = null;

  function hideTip() {
    clearTimeout(tipTimer);
    if (tipNode && tipNode.parentNode) tipNode.parentNode.removeChild(tipNode);
    tipNode = null;
    tipTarget = null;
  }

  function showTip(target) {
    const text = target.getAttribute('data-tip') || target.getAttribute('title');
    if (!text) return;
    // Move `title` out of the way so the native tooltip doesn't double up.
    if (target.hasAttribute('title')) {
      target.setAttribute('data-tip', target.getAttribute('title'));
      target.removeAttribute('title');
    }
    hideTip();
    tipTarget = target;
    const kbd = target.getAttribute('data-tip-kbd');
    tipNode = el('div.tooltip', null, [
      text,
      kbd ? el('span.tooltip-kbd', null, kbd) : null,
    ]);
    tipNode.style.visibility = 'hidden';
    document.body.appendChild(tipNode);

    const r = target.getBoundingClientRect();
    const t = tipNode.getBoundingClientRect();
    const pad = 8;
    let x = r.left + r.width / 2 - t.width / 2;
    let y = r.bottom + 6;
    if (y + t.height > window.innerHeight - pad) y = r.top - t.height - 6;
    x = U.clamp(x, pad, window.innerWidth - t.width - pad);
    y = Math.max(pad, y);
    tipNode.style.left = Math.round(x) + 'px';
    tipNode.style.top = Math.round(y) + 'px';
    tipNode.style.visibility = '';
  }

  function initTooltips() {
    // Touch devices never hover; showing tooltips there just blocks content.
    if (U.supports.touch && !window.matchMedia('(hover: hover)').matches) return;

    document.addEventListener('mouseover', function (e) {
      const target = e.target.closest ? e.target.closest('[title],[data-tip]') : null;
      if (!target || target === tipTarget) return;
      if (target.closest('.tooltip')) return;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { showTip(target); }, 480);
    });
    document.addEventListener('mouseout', function (e) {
      const target = e.target.closest ? e.target.closest('[title],[data-tip]') : null;
      if (target && target === tipTarget) hideTip();
      else if (!target) hideTip();
    });
    document.addEventListener('mousedown', hideTip, true);
    document.addEventListener('keydown', hideTip, true);
    window.addEventListener('scroll', hideTip, true);
    window.addEventListener('blur', hideTip);
  }

  N.menu = { show: show, close: closeMenu, attach: attach, initTooltips: initTooltips, isOpen: function () { return !!current; } };
})(window.NODALIS = window.NODALIS || {});
