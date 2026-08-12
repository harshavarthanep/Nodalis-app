// ZenDocs — 07-locked-notes-capture-stats.js
// V5.2-V5.4 locked notes (visual lock + cross-device sync + lock overlay), V5.5b/V5.6b idle saving + quick capture/tours/command palette, V5.7b writing stats, V5.8 small features, V5.5c saving rewrite, V5.8b duplicate-title handling.
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
   V5.2 — LOCKED NOTES: visual lock, live cross-device sync,
   password gate on shared links
============================================================ */
(function zd52() {
    if (window.__zd52) return; window.__zd52 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #lk-veil{position:absolute;inset:0;z-index:30;display:none;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:26px;
        background:rgba(18,18,22,.55);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}
    html:not(.dark) #lk-veil{background:rgba(244,239,230,.62);}
    #lk-veil.on{display:flex;animation:fadeIn .22s ease-out;}
    #lk-ring{width:74px;height:74px;border-radius:99px;display:flex;align-items:center;justify-content:center;background-image:var(--zd-grad);box-shadow:0 14px 36px rgba(0,0,0,.42);position:relative;margin-bottom:16px;}
    #lk-ring::after{content:'';position:absolute;inset:-9px;border-radius:99px;border:2px solid rgb(var(--accent-rgb) / .45);animation:lkPulse 2.1s ease-out infinite;}
    @keyframes lkPulse{0%{transform:scale(.9);opacity:.85}70%{transform:scale(1.22);opacity:0}100%{opacity:0}}
    #lk-ring svg{animation:lkWob 3.6s ease-in-out infinite;}
    @keyframes lkWob{0%,88%,100%{transform:rotate(0)}92%{transform:rotate(-7deg)}96%{transform:rotate(7deg)}}
    #lk-veil .lk-t{font-size:15px;font-weight:800;color:var(--text-color);}
    #lk-veil .lk-s{font-size:11.5px;color:#9ca3af;margin:4px 0 16px;max-width:280px;line-height:1.5;}
    #lk-veil .lk-b{padding:11px 24px;border-radius:14px;font-size:12.5px;font-weight:800;color:#fff;background-image:var(--zd-grad);box-shadow:0 10px 26px rgba(0,0,0,.35);display:inline-flex;align-items:center;gap:7px;}
    #lk-veil .lk-b:active{transform:scale(.97);}
    .doc-lk{flex-shrink:0;width:11px;height:11px;color:rgb(var(--accent-rgb));}
    </style>`);

    const wrap = document.getElementById('editor-wrapper');
    wrap.insertAdjacentHTML('beforeend', `<div id="lk-veil">
        <span id="lk-ring"><svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg></span>
        <div class="lk-t">This note is locked</div>
        <div class="lk-s" id="lk-sub">Enter its password to read and edit it.</div>
        <button class="lk-b" id="lk-btn"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg>Unlock note</button></div>`);

    const veil = document.getElementById('lk-veil');
    const isLocked = d => !!(d && d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id)));
    let veilId = null;

    function showVeil(d) {
        veilId = d.id;
        document.getElementById('lk-sub').textContent = 'Enter the password for “' + (d.title || 'Untitled') + '” to read and edit it.';
        veil.classList.add('on');
        try { quill.enable(false); } catch (e) {}
        els.title.readOnly = true;
    }
    function hideVeil() { veil.classList.remove('on'); veilId = null; try { if (!state.isGuest && !state.reading) quill.enable(true); els.title.readOnly = false; } catch (e) {} }
    document.getElementById('lk-btn').onclick = () => { if (veilId) { const d = state.docs.find(x => x.id === veilId); openDoc(veilId, d || { id: veilId, lockHash: 1 }); } };

    /* open a locked note → blank canvas + veil (instead of nothing happening) */
    const _od = window.openDoc;
    window.openDoc = function (id, data) {
        if (data && data.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(id))) {
            const r = _od(id, Object.assign({}, data, { content: '' , lockHash: null }));
            const d = state.docs.find(x => x.id === id) || data;
            state.docId = id;
            showVeil(d);
            try { lockOpenUI && lockOpenUI('unlock', id, 'Enter the password for <b>' + escapeHtml(data.title || 'this note') + '</b>.'); } catch (e) {}
            return r;
        }
        hideVeil();
        return _od(id, data);
    };

    /* live cross-device: someone locks it elsewhere → veil + toast here */
    const _rf = refreshOpenViews;
    refreshOpenViews = function () {
        _rf();
        if (!state.docId || state.isGuest) return;
        const d = state.docs.find(x => x.id === state.docId);
        if (!d) return;
        if (isLocked(d) && !veil.classList.contains('on')) {
            showToast('🔒 This note was locked on another device.', 4000);
            try { quill.setContents('', 'silent'); } catch (e) {}
            showVeil(d);
        } else if (!isLocked(d) && veil.classList.contains('on')) {
            hideVeil(); openDoc(d.id, d);
        }
    };

    /* sidebar rows show a lock icon */
    const LKSVG = '<svg class="doc-lk" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg>';
    const _rd = renderDocs;
    renderDocs = function () {
        _rd();
        state.docs.forEach(d => {
            if (!d.lockHash) return;
            const row = Array.from(els.docList.querySelectorAll('.doc-row')).find(r => {
                const t = r.querySelector('.font-medium span span');
                return t && t.textContent === (d.title || 'Untitled');
            });
            if (!row || row.querySelector('.doc-lk')) return;
            const holder = row.querySelector('.font-medium > span');
            if (holder) holder.insertAdjacentHTML('beforeend', LKSVG);
        });
    };
    setTimeout(renderDocs, 400);

    /* shared links of locked notes ask for the password */
    const _lg = window.loadGuestView;
    if (typeof _lg === 'function') {
        window.loadGuestView = async function (shareId) {
            const r = await _lg(shareId);
            setTimeout(async () => {
                try {
                    const s = await db.collection('shared_docs').doc(shareId).get();
                    if (!s.exists) return;
                    const sd = s.data();
                    if (!sd.lockHash) return;
                    quill.setContents('', 'silent');
                    els.title.value = '🔒 Protected note';
                    showVeil({ id: 'shared', title: 'this shared note' });
                    document.getElementById('lk-sub').textContent = 'The owner protected this note with a password.';
                    document.getElementById('lk-btn').onclick = async () => {
                        const p = prompt('Password for this shared note:');
                        if (!p) return;
                        const h = await zd46Hash(p, sd.lockSalt || '');
                        if (h !== sd.lockHash) { showToast('Wrong password.'); return; }
                        hideVeil(); els.title.value = sd.t; quill.setContents(sd.c, 'silent'); quill.disable();
                        showToast('🔓 Unlocked.');
                    };
                } catch (e) {}
            }, 900);
            return r;
        };
    }
    /* keep the shared copy's lock in sync when you lock/unlock */
    const _sv = saveToDb;
    saveToDb = async function () {
        const r = await _sv();
        try {
            const d = state.docs.find(x => x.id === state.docId);
            if (d && d.shareId) await db.collection('shared_docs').doc(d.shareId).set({ lockHash: d.lockHash || null, lockSalt: d.lockSalt || null }, { merge: true });
        } catch (e) {}
        return r;
    };
})();

    /* ============================================================
   V5.3 — PANEL POLISH · SIDEBAR LOGO · TABLET HEADER ·
   CALENDAR FILTER FOCUS
============================================================ */
(function zd53() {
    if (window.__zd53) return; window.__zd53 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ---- Notes & comments panel: consistent sections ---- */
    #comments-panel .zd-sec-h{display:flex;align-items:center;gap:6px;padding:9px 12px 5px;font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#9ca3af;}
    #comments-panel .zd-sec-h::after{content:'';flex:1;height:1px;background:var(--border-color);opacity:.75;}
    #comments-panel .zd-sec-h .zd-cnt{font-size:8.5px;font-weight:800;padding:1px 6px;border-radius:99px;background:rgb(var(--accent-rgb) / .13);color:rgb(var(--accent-rgb));}
    #backlinks-list,#unlinked-list{padding:2px 12px 10px!important;}
    #unlinked-list{margin:0!important;}
    #unlinked-list>div:first-child{margin-bottom:7px!important;}
    #outline-list{padding:2px 12px 10px!important;}
    #outline-search{margin-bottom:2px;}
    #comments-panel #add-note-btn-wrapper{padding:9px 12px!important;}
    #comments-list{padding:8px 12px!important;}
    #comments-panel .border-t,#comments-panel .border-b{border-color:var(--border-color)!important;}
    /* ---- sidebar logo ---- */
    #zd-sb-logo{width:26px;height:26px;border-radius:8px;flex-shrink:0;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,.28);}
    /* ---- tablet header ---- */
    @media (min-width:768px) and (max-width:1200px){
      .zd-header{padding-left:8px!important;padding-right:8px!important;}
      .zd-header #doc-title{font-size:15px!important;}
      #share-btn span:not(.sr-only){display:none;}
      #share-btn{padding:7px!important;border-radius:99px!important;margin-right:2px!important;}
      #folder-dd-btn{max-width:104px!important;padding-left:8px!important;padding-right:8px!important;}
      #folder-dd-label{font-size:10.5px;}
      #logged-in-controls .zd-hgrp>button{padding:6px!important;}
      #logged-in-controls .zd-hgrp>button svg{width:17px!important;height:17px!important;}
      #logged-in-controls .zd-hsep{margin:0 1px!important;height:17px!important;}
      .zd-header .flex.items-center.gap-1.pl-2{gap:0!important;padding-left:4px!important;}
    }
    </style>`);

    /* --- section headers, counts, alignment --- */
    const panel = document.getElementById('comments-panel');
    if (panel) {
        const hdr = (txt, ico) => `<div class="zd-sec-h"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${ico}</svg><span>${txt}</span><span class="zd-cnt" data-cnt="${txt}">0</span></div>`;
        const bl = document.getElementById('backlinks-list');
        const ul = document.getElementById('unlinked-list');
        if (bl && bl.previousElementSibling) bl.previousElementSibling.outerHTML = hdr('Linked mentions', '<path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7l1.5-1.5M10.2 13.8a4 4 0 010-5.7l3-3a4 4 0 115.6 5.7l-1.5 1.5"/>');
        if (ul && ul.previousElementSibling) ul.previousElementSibling.outerHTML = hdr('Unlinked mentions', '<circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>');
        const ol = document.getElementById('outline-list');
        if (ol) { const h = ol.parentElement.querySelector('.text-\\[10px\\]'); if (h) h.outerHTML = hdr('Outline', '<path stroke-linecap="round" d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'); }
        const upd = () => {
            const set = (n, v) => { const e = panel.querySelector('[data-cnt="' + n + '"]'); if (e) e.textContent = v; };
            set('Linked mentions', (bl ? bl.querySelectorAll('button').length : 0));
            set('Unlinked mentions', (ul ? ul.querySelectorAll('button').length : 0));
            set('Outline', (ol ? ol.querySelectorAll('.ol-item').length : 0));
        };
        const _rb = renderBacklinks; renderBacklinks = function () { const r = _rb(); setTimeout(upd, 40); return r; };
        const _ro2 = renderOutline; renderOutline = function () { const r = _ro2(); setTimeout(upd, 40); return r; };
        setTimeout(upd, 600);
    }

    /* --- sidebar logo before ZenDocs --- */
    (function () {
        const head = document.querySelector('#sidebar > div:first-child > span');
        if (!head || head.querySelector('#zd-sb-logo')) return;
        const img = document.createElement('img');
        img.id = 'zd-sb-logo'; img.src = './icon-192.png'; img.alt = '';
        img.onerror = () => img.remove();
        head.insertBefore(img, head.firstChild);
    })();

    /* --- calendar: keep the caret in the filter while scrolling --- */
    (function () {
        const s = document.getElementById('cm-search'), l = document.getElementById('cm-list');
        if (!s) return;
        let typing = false, t = null;
        s.addEventListener('input', () => { typing = true; clearTimeout(t); t = setTimeout(() => { typing = false; }, 9000); });
        ['touchstart', 'touchmove', 'pointerdown', 'wheel', 'scroll'].forEach(ev => {
            (l || s).addEventListener(ev, (e) => { e.stopPropagation(); if (typing) { try { zdArmProtect(s); } catch (x) {} } }, { passive: true });
        });
        const scroller = document.getElementById('cal-scroll');
        if (scroller) scroller.addEventListener('scroll', () => {
            if (typing && document.activeElement !== s) { try { s.focus({ preventScroll: true }); } catch (x) {} }
        }, { passive: true });
    })();
})();    

    // New Code

    /* ============================================================
   V5.4 — LOCK OVERLAY & INSTANT CROSS-DEVICE LOCKING
   • Veil covers the ENTIRE note area (paper + scroll region)
   • Softer blur (16px → 7px) so it reads as frosted, not opaque
   • Locking/unlocking reflects on every open device instantly
     (dedicated per-note snapshot listener, not the debounced list)
   • More aesthetic lock card: frosted panel, shield lines, hints
============================================================ */
(function zd54() {
    if (window.__zd54) return; window.__zd54 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* --- full-coverage veil: fills the whole editor region --- */
    #lk-veil{position:absolute!important;inset:0!important;z-index:60!important;
        display:none;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:22px;
        background:rgba(18,18,22,.34)!important;backdrop-filter:blur(7px) saturate(.9)!important;-webkit-backdrop-filter:blur(7px) saturate(.9)!important;}
    html:not(.dark) #lk-veil{background:rgba(244,239,230,.44)!important;}
    #lk-veil.on{display:flex!important;animation:fadeIn .2s ease-out;}
    /* the paper itself gets a gentle blur so text is unreadable but the layout still shows */
    body.zd-locked #paper-container .ql-editor{filter:blur(5px) opacity(.55);pointer-events:none;user-select:none;}
    body.zd-locked #toolbar,body.zd-locked #ruler-wrap,body.zd-locked #fold-gutter{display:none!important;}
    /* --- frosted lock card --- */
    #lk-card{max-width:330px;width:100%;padding:26px 22px 22px;border-radius:22px;
        background:var(--surface-color);border:1px solid var(--border-color);
        box-shadow:0 26px 64px rgba(0,0,0,.34);position:relative;overflow:hidden;}
    #lk-card::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background-image:var(--zd-grad);}
    #lk-ring{width:70px;height:70px;margin:0 auto 15px;border-radius:99px;display:flex;align-items:center;justify-content:center;
        background-image:var(--zd-grad);box-shadow:0 12px 32px rgba(0,0,0,.34);position:relative;}
    #lk-ring::after{content:'';position:absolute;inset:-8px;border-radius:99px;border:2px solid rgb(var(--accent-rgb) / .42);animation:lkPulse 2.2s ease-out infinite;}
    @keyframes lkPulse{0%{transform:scale(.92);opacity:.85}70%{transform:scale(1.2);opacity:0}100%{opacity:0}}
    #lk-ring svg{animation:lkWob 4s ease-in-out infinite;}
    @keyframes lkWob{0%,88%,100%{transform:rotate(0)}92%{transform:rotate(-8deg)}96%{transform:rotate(8deg)}}
    #lk-card .lk-t{font-size:15.5px;font-weight:800;color:var(--text-color);}
    #lk-card .lk-s{font-size:11.5px;color:#9ca3af;margin:5px 0 16px;line-height:1.55;}
    #lk-card .lk-b{width:100%;padding:11px 0;border-radius:14px;font-size:12.5px;font-weight:800;color:#fff;
        background-image:var(--zd-grad);box-shadow:0 9px 24px rgba(0,0,0,.3);display:inline-flex;align-items:center;justify-content:center;gap:7px;}
    #lk-card .lk-b:active{transform:scale(.975);}
    #lk-card .lk-hint{margin-top:12px;padding-top:11px;border-top:1px solid var(--border-color);font-size:9.5px;color:#9ca3af;display:flex;align-items:center;justify-content:center;gap:5px;line-height:1.45;}
    </style>`);

    /* rebuild the veil inside the editor wrapper so it covers everything */
    const wrap = document.getElementById('editor-wrapper');
    const old = document.getElementById('lk-veil');
    if (old) old.remove();
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    wrap.insertAdjacentHTML('beforeend', `<div id="lk-veil"><div id="lk-card">
        <span id="lk-ring"><svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg></span>
        <div class="lk-t">This note is locked</div>
        <div class="lk-s" id="lk-sub">Enter its password to read and edit it.</div>
        <button class="lk-b" id="lk-btn"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg>Unlock note</button>
        <div class="lk-hint"><svg class="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m0-9a4 4 0 014 4v1H8v-1a4 4 0 014-4z"/><circle cx="12" cy="12" r="9"/></svg><span>Stored safely in your account · syncs to every device</span></div>
    </div></div>`);

    const veil = document.getElementById('lk-veil');
    const isLk = d => !!(d && d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id)));
    let veilId = null, lkUnsub = null;

    window.zdShowVeil = function (d) {
        veilId = d.id;
        document.getElementById('lk-sub').innerHTML = 'Enter the password for <b>' + escapeHtml(d.title || 'this note') + '</b> to read and edit it.';
        document.body.classList.add('zd-locked');
        veil.classList.add('on');
        try { quill.enable(false); } catch (e) {}
        els.title.readOnly = true;
        [els.downBtn, els.dupBtn, els.shareBtn].forEach(b => { if (b) b.disabled = true; });
    };
    window.zdHideVeil = function () {
        veilId = null;
        document.body.classList.remove('zd-locked');
        veil.classList.remove('on');
        try { if (!state.isGuest && !state.reading) quill.enable(true); } catch (e) {}
        if (!state.isGuest) { els.title.readOnly = false; [els.downBtn, els.dupBtn, els.shareBtn].forEach(b => { if (b) b.disabled = false; }); }
    };
    document.getElementById('lk-btn').onclick = () => {
        if (!veilId) return;
        const d = state.docs.find(x => x.id === veilId) || { id: veilId, title: els.title.value };
        try { lockOpenUI('unlock', veilId, 'Enter the password for <b>' + escapeHtml(d.title || 'this note') + '</b>.'); } catch (e) {}
    };

    /* --- INSTANT cross-device lock: a dedicated listener on the open note --- */
    function watchLock(id) {
        if (lkUnsub) { lkUnsub(); lkUnsub = null; }
        if (!id || state.isGuest || !state.user) return;
        lkUnsub = db.collection('users').doc(state.user.uid).collection('docs').doc(id)
            .onSnapshot(snap => {
                if (!snap.exists) return;
                const s = snap.data();
                const d = state.docs.find(x => x.id === id);
                if (d) { d.lockHash = s.lockHash || null; d.lockSalt = s.lockSalt || null; }
                const lockedNow = !!(s.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(id)));
                if (lockedNow && !veil.classList.contains('on')) {
                    try { quill.setContents('', 'silent'); } catch (e) {}
                    zdShowVeil({ id: id, title: s.title });
                    showToast('🔒 Note locked — password required.', 4000);
                    try { if (navigator.vibrate) navigator.vibrate(24); } catch (e) {}
                    try { renderDocs(); } catch (e) {}
                } else if (!s.lockHash && veil.classList.contains('on')) {
                    zdHideVeil();
                    showToast('🔓 Lock removed on another device.', 3500);
                    if (d) openDoc(id, d);
                    try { renderDocs(); } catch (e) {}
                }
            }, () => {});
    }

    const _od = window.openDoc;
    window.openDoc = function (id, data) {
        if (data && data.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(id))) {
            const r = _od(id, Object.assign({}, data, { content: '', lockHash: null }));
            state.docId = id;
            zdShowVeil(data);
            watchLock(id);
            try { lockOpenUI('unlock', id, 'Enter the password for <b>' + escapeHtml(data.title || 'this note') + '</b>.'); } catch (e) {}
            return r;
        }
        zdHideVeil();
        const r = _od(id, data);
        watchLock(id);
        return r;
    };

    /* locking from THIS device applies immediately, before the round-trip */
    const _go = document.getElementById('lock-go');
    if (_go) {
        const prev = _go.onclick;
        _go.onclick = async function () {
            const wasSet = (typeof _lockMode !== 'undefined' && _lockMode === 'set');
            const id = (typeof _lockDocId !== 'undefined') ? _lockDocId : null;
            await prev.apply(this, arguments);
            if (wasSet && id) {
                try { renderDocs(); } catch (e) {}
                showToast('🔒 Locked everywhere — other devices are updating now.', 3800);
            }
        };
    }
})();

    /* ============================================================
   V5.5b — IDLE SAVING + BULLETPROOF UNDO / REDO
   Replaces V5.5. Fixes Ctrl+Z dying after a save by preventing
   the snapshot echo from calling setContents()/history.clear().
============================================================ */

    /* ============================================================
   V5.6b — QUICK CAPTURE ⚡ · PER-SECTION TOURS · CMD PALETTE
   · DAILY TEMPLATE (with confirmation) · ANIMATIONS
============================================================ */
(function zd56b() {
    if (window.__zd56b) return; window.__zd56b = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ---------- TOUR: dimmed surround, NO blur on the target ---------- */
    #tour-spot{position:fixed;z-index:201;border-radius:14px;pointer-events:none;display:none;
        box-shadow:0 0 0 9999px rgba(8,9,12,.66),0 0 0 3px rgb(var(--accent-rgb)),0 0 34px rgb(var(--accent-rgb) / .6);
        transition:all .34s cubic-bezier(.22,1,.36,1);}
    #tour-spot.on{display:block;animation:tourPop .4s cubic-bezier(.22,1,.36,1);}
    @keyframes tourPop{0%{box-shadow:0 0 0 9999px rgba(8,9,12,.66),0 0 0 12px rgb(var(--accent-rgb) / .5),0 0 40px rgb(var(--accent-rgb) / .6)}100%{box-shadow:0 0 0 9999px rgba(8,9,12,.66),0 0 0 3px rgb(var(--accent-rgb)),0 0 34px rgb(var(--accent-rgb) / .6)}}
    #tour-spot::after{content:'';position:absolute;inset:-3px;border-radius:15px;border:2px solid rgb(var(--accent-rgb) / .55);animation:tourRing 2s ease-out infinite;}
    @keyframes tourRing{0%{transform:scale(1);opacity:.8}70%{transform:scale(1.06);opacity:0}100%{opacity:0}}
    #tour-catch{position:fixed;inset:0;z-index:200;display:none;}
    #tour-catch.on{display:block;}
    #tour-card{position:fixed;z-index:202;width:min(322px,92vw);background:var(--surface-color);border:1px solid var(--border-color);
        border-radius:20px;padding:18px;box-shadow:0 26px 64px rgba(0,0,0,.5);display:none;overflow:hidden;
        transition:left .34s cubic-bezier(.22,1,.36,1),top .34s cubic-bezier(.22,1,.36,1);}
    #tour-card.on{display:block;animation:cardIn .36s cubic-bezier(.22,1,.36,1);}
    @keyframes cardIn{0%{opacity:0;transform:translateY(10px) scale(.97)}100%{opacity:1;transform:none}}
    #tour-card::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background-image:var(--zd-grad);}
    .tour-ico{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;background-image:var(--zd-grad);color:#fff;margin-bottom:10px;animation:icoIn .45s cubic-bezier(.22,1,.36,1);}
    @keyframes icoIn{0%{transform:scale(.5) rotate(-14deg);opacity:0}100%{transform:none;opacity:1}}
    .tour-dots{display:flex;gap:4px;align-items:center;}
    .tour-dots i{width:5px;height:5px;border-radius:99px;background:var(--border-color);transition:all .3s cubic-bezier(.22,1,.36,1);}
    .tour-dots i.on{background-image:var(--zd-grad);width:17px;}
    /* ---------- quick capture ---------- */
    #qc-modal{z-index:129;}
    .qc-bolt{animation:qcZap 2.4s ease-in-out infinite;}
    @keyframes qcZap{0%,90%,100%{transform:scale(1);filter:none}94%{transform:scale(1.18);filter:drop-shadow(0 0 6px rgb(var(--accent-rgb)))}}
    .doc-qc{flex-shrink:0;width:12px;height:12px;color:#f59e0b;}
    /* ---------- global lively touches ---------- */
    .zd-mi,.doc-row,.eis-tile,.cm-row,.zd44-row{transition:background .16s ease,transform .16s ease,border-color .16s ease;}
    .zd-mi:active{transform:scale(.985);}
    .zd-view-btn svg{transition:transform .2s cubic-bezier(.22,1,.36,1);}
    .zd-view-btn:hover svg{transform:translateY(-2px) scale(1.08);}
    .zd-cmodal-box{animation:boxIn .26s cubic-bezier(.22,1,.36,1);}
    @keyframes boxIn{0%{opacity:0;transform:translateY(12px) scale(.975)}100%{opacity:1;transform:none}}
    #toast{transition:opacity .25s ease,transform .32s cubic-bezier(.22,1,.36,1);}
    /* section-help buttons */
    .zd-help-b{width:26px;height:26px;border-radius:99px;color:#9ca3af;display:inline-flex;align-items:center;justify-content:center;transition:all .16s ease;flex-shrink:0;}
    .zd-help-b:hover{color:rgb(var(--accent-rgb));background:rgb(var(--accent-rgb) / .12);transform:scale(1.1);}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="tour-catch"></div><div id="tour-spot"></div>
    <div id="tour-card">
      <div class="tour-ico" id="tour-ico"></div>
      <div id="tour-t" class="text-sm font-bold text-text mb-1"></div>
      <div id="tour-b" class="text-[11.5px] text-muted leading-relaxed mb-4"></div>
      <div class="flex items-center justify-between">
        <span class="tour-dots" id="tour-dots"></span>
        <span class="flex items-center gap-1.5">
          <button id="tour-prev" class="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-muted hover:text-text transition">Back</button>
          <button id="tour-skip" class="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-muted hover:text-text transition">Skip</button>
          <button id="tour-next" class="px-3.5 py-1.5 text-[11px] font-bold rounded-lg text-white active:scale-95 transition" style="background-image:var(--zd-grad)">Next</button>
        </span>
      </div>
    </div>
    <div id="qc-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-sm">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent qc-bolt" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg> Quick capture</h3>
        <button onclick="closeQuickCapture()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
      </div>
      <textarea id="qc-text" rows="5" placeholder="Dump the thought — it lands in your ⚡ Quick Capture note…" class="zd44-in" style="resize:vertical"></textarea>
      <div class="flex items-center justify-between mt-3">
        <span class="text-[9.5px] text-muted">Alt+N anywhere · Ctrl+Enter saves</span>
        <button onclick="qcSave()" class="px-4 py-2 text-xs font-bold rounded-xl text-white active:scale-95 transition" style="background-image:var(--zd-grad)">Capture</button>
      </div>
    </div></div>`);

    const $ = id => document.getElementById(id);
    const IC = p => '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' + p + '</svg>';

    /* ================= TOUR ENGINE (multi-tour) ================= */
    const TOURS = {
        main: [
            { el: '#doc-title', t: 'Start with a title', b: 'Type here, then write below. Everything autosaves — the header shows <b>Saved</b> once it syncs.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11 15l-4 1 1-4 9.6-9.4z"/>' },
            { el: '#toolbar', t: 'Format anything', b: 'Fonts, colors, lists, checkboxes. In the note, type <b>/</b> for commands, <b>[[</b> to link a note, <b>#</b> for tags.', i: '<path stroke-linecap="round" d="M4 7h16M7 12h10M9 17h6"/>' },
            { el: '#views-row', t: 'Your workspaces', b: 'Home, daily note, calendar, board, canvas, templates and the Eisenhower matrix — each has its own mini-tour.', i: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>' },
            { el: '#folder-list', t: 'Folders & tags', b: 'Create folders here. Type <b>#tag</b> in any note and it appears in the sidebar automatically.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>' },
            { el: '#comments-btn', t: 'Outline & backlinks', b: 'This panel holds your heading outline, comments on selected text, and every note linking here.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z"/>' },
            { el: '#more-btn', t: 'Power tools', b: 'AI summary, flashcards, version history, reminders, focus timer, trash, backup and stats live here.', i: '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>' },
            { el: null, t: "You're set 🎉", b: 'Press <b>Ctrl+K</b> to search notes <i>or run any action</i>, and <b>Alt+N</b> to capture a thought instantly.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>' }
        ],
        home: [
            { el: '#home-body', t: 'Your daily cockpit', b: 'Pinned & starred notes, every open task, today\u2019s note, recent activity and your weekly review — all in one glance.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-8 9 8M5 10v10h14V10"/>' },
            { el: null, t: 'Tap anything', b: 'Every row jumps straight to that note. The <b>Weekly review</b> card tracks your streak and task completion.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19V9m6 10V5m6 14v-8"/>' }
        ],
        calendar: [
            { el: '#cal-grid', t: 'Your month at a glance', b: '☀️ marks a day with a daily note; the badge counts notes created that day. Tap any day to open it.', i: '<rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4m8-4v4M3 10h18"/>' },
            { el: '#cal-title', t: 'Jump to any month', b: 'Tap the month name for month &amp; year pickers (1950–2100), or use ‹ › and <b>Today</b>.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3M3 11h18"/>' },
            { el: '#cm-panel', t: 'Notes this month', b: 'Everything created this month, with search and sorting by date, title, words, folder or due date. Drag the grip to resize.', i: '<path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h10"/>' }
        ],
        eis: [
            { el: '#eis-grid', t: 'Urgent vs important', b: 'Four quadrants: <b>Do first</b>, <b>Schedule</b>, <b>Delegate</b>, <b>Eliminate</b>. Tiles preview their notes and due chips.', i: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>' },
            { el: null, t: 'Due dates that remind you', b: 'Open a quadrant to tick notes complete, set a <b>date &amp; time</b> that fires a snoozable notification, and 👁 preview any note.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4V11a6 6 0 10-12 0v4.6L5 17h10"/>' }
        ],
        canvas: [
            { el: '#canvas-viewport', t: 'Freeform thinking', b: '<b>Double-click</b> empty space (or the <b>+</b> bubble on mobile) to drop an idea card. Drag the background to pan, pinch or scroll to zoom.', i: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="6.5" width="7" height="7" rx="1.5"/><rect x="8" y="14" width="7" height="7" rx="1.5"/>' },
            { el: null, t: 'Connect &amp; group', b: 'Tap 🔗 on two cards to link them, <b>+ Frame</b> to group cards that move together, and <b>+ Note</b> to pin an existing note.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7"/>' }
        ],
        kanban: [
            { el: '#kanban-cols', t: 'Move work forward', b: 'Drag cards between <b>To do → In progress → Done</b> (◀▶ on mobile). <b>+</b> adds an existing note, <b>Aa</b> composes a new card.', i: '<rect x="3.5" y="4" width="4.6" height="16" rx="1"/><rect x="9.8" y="4" width="4.6" height="10" rx="1"/><rect x="16" y="4" width="4.6" height="13" rx="1"/>' }
        ],
        templates: [
            { el: '#tpl-builtin', t: 'Start faster', b: 'Built-in layouts for meetings, projects, Cornell notes and weekly reviews — one tap creates the note.', i: '<rect x="4" y="7" width="10" height="14" rx="2"/><path stroke-linecap="round" d="M9 7V5a2 2 0 012-2h5.6L20 6.4V15a2 2 0 01-2 2h-2"/>' },
            { el: '#tpl-user', t: 'Your own templates', b: 'Save any note as a template, use <b>{{date}} {{day}} {{time}} {{title}}</b> variables, and pick one as your daily-note default below.', i: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>' }
        ],
        graph: [
            { el: '#graph-canvas', t: 'See your thinking', b: 'Every note and #tag as a node. Hold or hover one to spotlight its links; bigger dots have more links in.', i: '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="8" r="2.4"/><circle cx="9" cy="18" r="2.4"/>' }
        ]
    };
    let tKey = 'main', ti = 0;
    function tSteps() { return TOURS[tKey] || TOURS.main; }
    function place() {
        const S = tSteps(), s = S[ti];
        $('tour-ico').innerHTML = IC(s.i);
        $('tour-t').innerHTML = s.t;
        $('tour-b').innerHTML = s.b;
        $('tour-next').textContent = ti === S.length - 1 ? 'Got it' : 'Next';
        $('tour-prev').style.visibility = ti ? 'visible' : 'hidden';
        $('tour-dots').innerHTML = S.map((_, i) => '<i class="' + (i === ti ? 'on' : '') + '"></i>').join('');
        const spot = $('tour-spot'), card = $('tour-card');
        const el = s.el ? document.querySelector(s.el) : null;
        const vis = el && el.offsetParent !== null && el.getBoundingClientRect().width > 8;
        card.style.transform = '';
        if (vis) {
            const r = el.getBoundingClientRect();
            spot.classList.add('on');
            spot.style.left = (r.left - 6) + 'px'; spot.style.top = (r.top - 6) + 'px';
            spot.style.width = (r.width + 12) + 'px'; spot.style.height = (r.height + 12) + 'px';
            const cw = Math.min(322, window.innerWidth * .92), below = r.bottom + 16;
            card.style.left = Math.max(10, Math.min(r.left, window.innerWidth - cw - 10)) + 'px';
            card.style.top = (below + 230 > window.innerHeight ? Math.max(10, r.top - 224) : below) + 'px';
        } else {
            spot.classList.remove('on');
            card.style.left = 'calc(50% - min(161px, 46vw))';
            card.style.top = '50%'; card.style.transform = 'translateY(-50%)';
        }
    }
    window.startTour = (key) => {
        tKey = key || 'main'; ti = 0;
        $('tour-catch').classList.add('on'); $('tour-card').classList.add('on');
        if (tKey === 'main' && window.innerWidth < 768) toggleSidebar(true);
        setTimeout(place, 140);
    };
    window.endTour = () => {
        ['tour-catch', 'tour-card', 'tour-spot'].forEach(i => $(i).classList.remove('on'));
        localStorage.setItem('zdTour_' + tKey, '1');
        if (tKey === 'main' && window.innerWidth < 768) toggleSidebar(false);
    };
    $('tour-skip').onclick = endTour;
    $('tour-prev').onclick = () => { if (ti) { ti--; place(); } };
    $('tour-next').onclick = () => { ti++; ti >= tSteps().length ? endTour() : place(); };
    $('tour-catch').onclick = endTour;
    window.addEventListener('resize', () => { if ($('tour-card').classList.contains('on')) place(); });
    document.addEventListener('keydown', (e) => {
        if (!$('tour-card').classList.contains('on')) return;
        if (e.key === 'Escape') { e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); endTour(); }
        if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); $('tour-next').click(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); $('tour-prev').click(); }
    }, true);

    /* first-run: main tour, then a mini-tour the first time each view opens */
    const _init = window.initData;
    if (typeof _init === 'function') window.initData = function () {
        const r = _init();
        if (!localStorage.getItem('zdTour_main')) setTimeout(() => { if (!state.isGuest) startTour('main'); }, 2600);
        return r;
    };
    function hookView(fn, key, sel, headSel) {
        const o = window[fn];
        if (typeof o !== 'function') return;
        window[fn] = function () {
            const r = o.apply(this, arguments);
            setTimeout(() => {
                /* inject the ? help button into this view's header */
                const head = document.querySelector(headSel);
                if (head && !head.querySelector('[data-vh="' + key + '"]')) {
                    const b = document.createElement('button');
                    b.dataset.vh = key; b.className = 'zd-help-b'; b.title = 'How this works';
                    b.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.2 9a3.9 3.9 0 013.8-2c2.2 0 4 1.3 4 3 0 1.4-1.3 2.6-3 2.9-.5.1-1 .5-1 1.1m0 3h.01"/><circle cx="12" cy="12" r="9"/></svg>';
                    b.onclick = (e) => { e.stopPropagation(); startTour(key); };
                    head.insertBefore(b, head.firstChild);
                }
                if (!localStorage.getItem('zdTour_' + key) && !state.isGuest) startTour(key);
            }, 700);
            return r;
        };
    }
    hookView('openHome', 'home', '#home-body', '#home-modal .zd-view-head > div, #home-modal .zd-view-head');
    hookView('openCalendar', 'calendar', '#cal-grid', '#calendar-modal .zd-view-head .flex.items-center.gap-1');
    hookView('openEisenhower', 'eis', '#eis-grid', '#eis-modal .zd-view-head');
    hookView('openCanvas', 'canvas', '#canvas-viewport', '#canvas-modal .zd-view-head .flex.items-center.gap-1\\.5');
    hookView('openKanban', 'kanban', '#kanban-cols', '#kanban-modal .zd-view-head');
    hookView('openTemplates', 'templates', '#tpl-builtin', '#templates-modal .zd-view-head .flex.items-center.gap-1\\.5');
    hookView('openGraph', 'graph', '#graph-canvas', '#graph-modal .flex.items-center.gap-1');

    /* replay menu in Help */
    setTimeout(() => {
        const foot = document.querySelector('#help-modal .p-4.border-t');
        if (foot && !foot.querySelector('[data-tourbtn]')) {
            const b = document.createElement('button');
            b.dataset.tourbtn = '1';
            b.className = 'mr-auto px-4 py-2 text-sm font-medium rounded-lg bg-bg border border-border text-text hover:border-accent transition';
            b.innerHTML = '▶ Replay tour';
            b.onclick = () => {
                const k = prompt('Replay which tour?\n1. Getting started\n2. Home\n3. Calendar\n4. Eisenhower matrix\n5. Canvas\n6. Kanban\n7. Templates\n8. Graph', '1');
                const map = { '1': 'main', '2': 'home', '3': 'calendar', '4': 'eis', '5': 'canvas', '6': 'kanban', '7': 'templates', '8': 'graph' };
                if (!map[k]) return;
                closeHelp();
                const opener = { main: null, home: 'openHome', calendar: 'openCalendar', eis: 'openEisenhower', canvas: 'openCanvas', kanban: 'openKanban', templates: 'openTemplates', graph: 'openGraph' }[map[k]];
                localStorage.removeItem('zdTour_' + map[k]);
                setTimeout(() => { opener ? window[opener]() : startTour('main'); }, 260);
            };
            foot.insertBefore(b, foot.firstChild);
        }
    }, 1000);

    /* ================= QUICK CAPTURE (⚡ note, Alt+N) ================= */
    const QC_TITLE = '⚡Quick Capture';
    window.openQuickCapture = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        $('qc-text').value = '';
        $('qc-modal').classList.add('open');
        setTimeout(() => { const t = $('qc-text'); try { t.focus({ preventScroll: true }); zdArmProtect(t); } catch (e) {} }, 90);
    };
    window.closeQuickCapture = () => $('qc-modal').classList.remove('open');
    window.qcSave = async () => {
        const v = $('qc-text').value.trim();
        if (!v) { showToast('Write something first.'); return; }
        const stamp = new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        try {
            const box = state.docs.find(d => (d.title || '').trim() === QC_TITLE);
            if (box) {
                const ops = ((box.content && box.content.ops) || [{ insert: '\n' }]).slice();
                ops.push({ insert: stamp }, { insert: '\n', attributes: { header: 3 } }, { insert: v + '\n\n' });
                await db.collection('users').doc(state.user.uid).collection('docs').doc(box.id)
                    .update({ content: { ops }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            } else {
                await db.collection('users').doc(state.user.uid).collection('docs').add({
                    title: QC_TITLE, isQuickCapture: true, pinned: true,
                    content: { ops: [{ insert: QC_TITLE }, { insert: '\n', attributes: { header: 1 } }, { insert: '#capture' }, { insert: '\n\n' }, { insert: stamp }, { insert: '\n', attributes: { header: 3 } }, { insert: v + '\n\n' }] },
                    isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            closeQuickCapture();
            showToast('⚡ Captured to your Quick Capture note.');
            try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
        } catch (e) { console.error(e); showToast('Capture failed.'); }
    };
    $('qc-text').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); qcSave(); } });
    $('qc-modal').addEventListener('click', e => { if (e.target.id === 'qc-modal') closeQuickCapture(); });
    /* Alt+N — Ctrl+Shift+N is reserved by the browser for incognito */
    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && ((e.key || '').toLowerCase() === 'n' || e.code === 'KeyN')) { e.preventDefault(); openQuickCapture(); }
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('qc-modal').classList.contains('open')) { e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); closeQuickCapture(); } }, true);
    /* ⚡ icon in the sidebar for the capture note */
    const QCSVG = '<svg class="doc-qc qc-bolt" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.3"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>';
    const _rd = renderDocs;
    renderDocs = function () {
        _rd();
        Array.from(els.docList.querySelectorAll('.doc-row')).forEach(row => {
            const t = row.querySelector('.font-medium span span');
            if (!t || t.textContent.indexOf('Quick Capture') === -1) return;
            const fi = row.querySelector('.doc-file-icon'); if (fi) fi.remove();
            const holder = row.querySelector('.font-medium > span');
            if (holder && !holder.querySelector('.doc-qc')) holder.insertAdjacentHTML('afterbegin', QCSVG);
        });
    };
    setTimeout(renderDocs, 500);
    try { zdMenuInject2('qc', 'openQuickCapture', 'Quick capture', '<path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/>'); ZD_FEATURES.push({ id: 'qc', label: 'Quick capture ⚡', fns: ['openQuickCapture'] }); } catch (e) {}

    /* ================= DAILY NOTE TEMPLATE (asks first) ================= */
    (function dailyTpl() {
        const _dn = window.openDailyNote;
        window.openDailyNote = async function (date) {
            const d = date || new Date();
            const t = dailyTitle(d);
            if (state.docs.some(x => (x.title || '').trim() === t)) return _dn(date);
            const id = localStorage.getItem('zdDailyTpl');
            if (!id) return _dn(date);
            let tpl;
            try {
                const snap = await db.collection('users').doc(state.user.uid).collection('templates').doc(id).get();
                if (!snap.exists) return _dn(date);
                tpl = snap.data();
            } catch (e) { return _dn(date); }
            const ok = await zdConfirm(dailyHuman(d) + ' · from your template “' + (tpl.name || 'Template') + '”.',
                { title: 'Create daily note ' + t + '?', okText: 'Create' });
            if (!ok) return;
            try {
                const ops = JSON.parse(JSON.stringify((tpl.content && tpl.content.ops) || []));
                const now = new Date();
                const vars = { '{{date}}': d.toLocaleDateString(), '{{day}}': d.toLocaleDateString(undefined, { weekday: 'long' }), '{{title}}': t, '{{time}}': now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), '{{datetime}}': now.toLocaleString(), '{{clipboard}}': '' };
                ops.forEach(o => { if (typeof o.insert === 'string') Object.keys(vars).forEach(k => { o.insert = o.insert.split(k).join(vars[k]); }); });
                const content = { ops: ops.length ? ops : [{ insert: '\n' }] };
                closeAllViews();
                const ref = await db.collection('users').doc(state.user.uid).collection('docs').add({
                    title: t, content: content, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                openDoc(ref.id, { title: t, content: content, comments: {}, marginL: 96, marginR: 96 });
                showToast('Daily note created from your template ☀️');
            } catch (e) { showToast('Could not create it.'); }
        };
        const _ot = window.openTemplates;
        window.openTemplates = function () {
            const r = _ot.apply(this, arguments);
            setTimeout(() => {
                const host = document.querySelector('#templates-modal .max-w-2xl');
                if (!host || host.querySelector('#zd-dtpl')) return;
                const box = document.createElement('section');
                box.id = 'zd-dtpl';
                box.innerHTML = `<h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-2">Daily note template</h4>
                    <div class="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface">
                        <select id="zd-dtpl-sel" class="flex-1 text-xs bg-bg text-text border border-border rounded-lg px-2 py-1.5 outline-none"><option value="">None — use the built-in layout</option></select>
                        <button id="zd-dtpl-save" class="px-3 py-1.5 text-[10px] font-bold rounded-lg text-white active:scale-95 transition" style="background-image:var(--zd-grad)">Save</button>
                    </div>
                    <p class="text-[10px] text-muted mt-1.5">New daily notes start from this template (you'll still be asked to confirm), with {{date}}, {{day}} and {{time}} filled in.</p>`;
                host.appendChild(box);
                db.collection('users').doc(state.user.uid).collection('templates').get().then(s => {
                    const sel = document.getElementById('zd-dtpl-sel');
                    s.docs.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = d.data().name || 'Template'; sel.appendChild(o); });
                    sel.value = localStorage.getItem('zdDailyTpl') || '';
                }).catch(() => {});
                document.getElementById('zd-dtpl-save').onclick = () => {
                    const v = document.getElementById('zd-dtpl-sel').value;
                    v ? localStorage.setItem('zdDailyTpl', v) : localStorage.removeItem('zdDailyTpl');
                    showToast(v ? 'Daily notes will use this template.' : 'Using the built-in daily layout.');
                };
            }, 220);
            return r;
        };
    })();

    /* ================= COMMAND PALETTE ACTIONS ================= */
    const CMDS = [
        { n: 'New note', k: 'create add', f: 'createNewDoc', i: 'M12 4v16m8-8H4' },
        { n: 'Quick capture ⚡', k: 'inbox thought capture', f: 'openQuickCapture', i: 'M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z' },
        { n: 'Home dashboard', k: 'home', f: 'openHome', i: 'M3 12l9-8 9 8M5 10v10h14V10' },
        { n: "Today's daily note", k: 'daily today', f: 'openDailyNote', i: 'M12 8v8m-4-4h8' },
        { n: 'Calendar', k: 'month', f: 'openCalendar', i: 'M3 5h18v16H3zM8 3v4m8-4v4' },
        { n: 'Kanban board', k: 'board tasks', f: 'openKanban', i: 'M4 4v16m8-16v10m8-10v13' },
        { n: 'Canvas', k: 'mindmap ideas', f: 'openCanvas', i: 'M3 3h7v7H3zM14 7h7v7h-7z' },
        { n: 'Eisenhower matrix', k: 'priority urgent', f: 'openEisenhower', i: 'M3 3h8v8H3zM13 3h8v8h-8z' },
        { n: 'Graph view', k: 'links map', f: 'openGraph', i: 'M6 6h.01M18 8h.01M9 18h.01' },
        { n: 'Templates', k: 'template', f: 'openTemplates', i: 'M4 7h10v14H4z' },
        { n: 'Lock this note', k: 'password protect', f: 'openLockNote', i: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4' },
        { n: 'Reading mode', k: 'read', f: 'toggleReadingMode', i: 'M12 6v13' },
        { n: 'Zen focus mode', k: 'focus distraction', f: 'toggleZenMode', i: 'M4 8V4h4M20 8V4h-4' },
        { n: 'Focus timer', k: 'pomodoro', f: 'openPomodoro', i: 'M12 9v4l2.5 2.5' },
        { n: 'Read aloud', k: 'speech tts', f: 'openReadAloud', i: 'M11 5L6 9H3v6h3l5 4V5z' },
        { n: 'Local AI summary', k: 'ai summarize tags', f: 'openAiPanel', i: 'M10 12l1.5 3.7 3.7 1.5-3.7 1.5L10 22.5' },
        { n: 'Study mode', k: 'flashcards revise', f: 'openStudy', i: 'M12 14l9-5-9-5-9 5 9 5z' },
        { n: 'Version history', k: 'time machine restore', f: 'openTimeMachine', i: 'M12 8v4l3 3' },
        { n: 'Reminders', k: 'remind alarm', f: 'openReminders', i: 'M15 17h5l-1.4-1.4V11a6 6 0 10-12 0v4.6L5 17h10' },
        { n: 'Reference panel', k: 'split side', f: 'openRefPanel', i: 'M3 4h8v16H3zM13 4h8v16h-8z' },
        { n: 'Writing stats & streak', k: 'stats streak', f: 'openStats', i: 'M9 19V9m6 10V5m6 14v-8' },
        { n: 'Trash', k: 'deleted restore', f: 'openTrash', i: 'M4 7h16M9 7V5h6v2' },
        { n: 'Backup & restore', k: 'export import json', f: 'openBackup', i: 'M4 7v10h16V9h-8L9.6 4.6H6z' },
        { n: 'Download / export', k: 'pdf word', f: 'openDownloadMenu', i: 'M12 4v12m0 0l-4-4m4 4l4-4' },
        { n: 'Publish as webpage', k: 'html share', f: 'publishWebpage', i: 'M12 3a9 9 0 100 18 9 9 0 000-18z' },
        { n: 'Import notes (md/csv)', k: 'obsidian notion', f: 'openImporter', i: 'M12 16V4m0 12l-4-4m4 4l4-4' },
        { n: 'Toggle light / dark', k: 'theme dark', f: 'toggleTheme', i: 'M20 15A9 9 0 118.6 3.6 9 9 0 0020 15z' },
        { n: 'Theme & accent colors', k: 'color gradient', run: () => { const b = document.getElementById('appearance-btn'); if (b) b.click(); }, i: 'M12 3a9 9 0 100 18' },
        { n: 'Features on this device', k: 'settings toggle', f: 'openFeatures', i: 'M4 6h16M4 12h16M4 18h16' },
        { n: 'Help & guide', k: 'help docs', f: 'openHelp', i: 'M8.2 9a3.9 3.9 0 013.8-2c2.2 0 4 1.3 4 3 0 2.8-4 2.2-4 5' },
        { n: 'Replay getting-started tour', k: 'tour intro onboarding', run: () => startTour('main'), i: 'M5 3l14 9-14 9V3z' }
    ];
    const _paint = window.paintPaletteResults;
    window.paintPaletteResults = function (results, snippets, query) {
        _paint(results, snippets, query);
        const q = (query || '').trim().toLowerCase();
        if (!q || state.isGuest) return;
        const hits = CMDS.filter(c => c.n.toLowerCase().includes(q) || (c.k || '').includes(q)).slice(0, 6);
        if (!hits.length) return;
        const box = els.paletteResults;
        if (!(results || []).length) box.innerHTML = '';
        const h = document.createElement('div');
        h.className = 'px-4 pt-2 pb-1 text-[8.5px] font-extrabold uppercase tracking-widest text-gray-400';
        h.textContent = 'Actions';
        box.insertBefore(h, box.firstChild);
        const ref = h.nextSibling;
        hits.forEach((c, i) => {
            const b = document.createElement('button');
            b.className = 'palette-item w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition';
            b.style.animation = 'fadeInUp .2s cubic-bezier(.16,1,.3,1) ' + (i * 22) + 'ms both';
            b.innerHTML = `<span class="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style="background-image:var(--zd-grad)"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="${c.i}"/></svg></span><span class="palette-title text-sm font-medium text-text truncate">${c.n}</span><span class="ml-auto text-[8.5px] text-gray-400 flex-shrink-0">ACTION</span>`;
            b.onclick = () => { closePalette(); setTimeout(() => { try { c.run ? c.run() : window[c.f](); } catch (e) { showToast('That action isn\u2019t available right now.'); } }, 60); };
            box.insertBefore(b, ref);
        });
    };
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 700);
})();

    /* ============================================================
   V5.7b — WRITING STATS · STREAK · WEEKLY DIGEST
   With count-up numbers, growing bars and a pulsing streak flame.
============================================================ */
(function zd57b() {
    if (window.__zd57b) return; window.__zd57b = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #stats-modal{z-index:128;}
    .zd-stat{background:var(--bg-color);border:1px solid var(--border-color);border-radius:14px;padding:11px;position:relative;overflow:hidden;
        animation:statIn .38s cubic-bezier(.22,1,.36,1) both;}
    @keyframes statIn{0%{opacity:0;transform:translateY(9px) scale(.97)}100%{opacity:1;transform:none}}
    .zd-stat::after{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background-image:var(--zd-grad);opacity:.75;}
    .zd-stat b{display:block;font-size:20px;font-weight:800;color:rgb(var(--accent-rgb));line-height:1.15;font-variant-numeric:tabular-nums;}
    .zd-stat span{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#9ca3af;font-weight:700;}
    .zd-bar{width:100%;border-radius:5px 5px 2px 2px;transform-origin:bottom;animation:barGrow .62s cubic-bezier(.22,1,.36,1) both;}
    @keyframes barGrow{0%{transform:scaleY(0)}100%{transform:scaleY(1)}}
    .zd-flame{display:inline-block;animation:flame 1.7s ease-in-out infinite;}
    @keyframes flame{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.16) rotate(3deg)}}
    .zd-ring-wrap{position:relative;width:96px;height:96px;margin:0 auto 4px;}
    .zd-ring-wrap svg{transform:rotate(-90deg);}
    #zd-ring-fg{transition:stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1);}
    .zd-ring-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="stats-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V9m6 10V5m6 14v-8M3 21h18"/></svg> Writing stats</h3>
        <button onclick="closeStats()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
      </div>
      <div id="stats-body"></div>
    </div></div>`);

    const wordsOf = d => { const t = docPlainText(d).trim(); return t ? t.split(/\s+/).length : 0; };
    function logDay() {
        try {
            const L = JSON.parse(localStorage.getItem('zdWrite') || '{}');
            const k = new Date().toISOString().slice(0, 10);
            let w = 0; state.docs.forEach(d => { w += wordsOf(d); });
            const prev = L[k] || {};
            L[k] = { w: w, n: state.docs.length, base: prev.base != null ? prev.base : w };
            const keys = Object.keys(L).sort(); while (keys.length > 180) delete L[keys.shift()];
            localStorage.setItem('zdWrite', JSON.stringify(L));
        } catch (e) {}
    }
    function readLog() { try { return JSON.parse(localStorage.getItem('zdWrite') || '{}'); } catch (e) { return {}; } }
    function dayWords(L, k) { const e = L[k]; return e ? Math.max(0, e.w - (e.base != null ? e.base : e.w)) : 0; }
    function streak() {
        const L = readLog(); let s = 0; const d = new Date();
        for (let i = 0; i < 180; i++) {
            const k = d.toISOString().slice(0, 10);
            const active = L[k] && (dayWords(L, k) > 0 || (i === 0 && L[k]));
            if (active) s++; else if (i > 0) break; else if (!L[k]) break;
            d.setDate(d.getDate() - 1);
        }
        return s;
    }
    function agg() {
        const wk = Date.now() - 7 * 864e5;
        const created = state.docs.filter(d => d.createdAt && d.createdAt.toDate().getTime() >= wk).length;
        const edited = state.docs.filter(d => d.updatedAt && d.updatedAt.toDate().getTime() >= wk).length;
        let done = 0, total = 0, words = 0;
        state.docs.forEach(d => {
            ((d.content && d.content.ops) || []).forEach(o => {
                if (o.attributes && o.attributes.list === 'checked') { done++; total++; }
                else if (o.attributes && o.attributes.list === 'unchecked') total++;
            });
            words += wordsOf(d);
        });
        return { created, edited, done, total, words, streak: streak() };
    }
    function countUp(el, to, ms, suffix) {
        const t0 = performance.now(), from = 0;
        const step = (t) => {
            const p = Math.min(1, (t - t0) / (ms || 850));
            const e = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(from + (to - from) * e).toLocaleString() + (suffix || '');
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
    window.openStats = () => { logDay(); render(); document.getElementById('stats-modal').classList.add('open'); };
    window.closeStats = () => document.getElementById('stats-modal').classList.remove('open');
    function render() {
        const a = agg(), L = readLog();
        const days = [];
        for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); days.push({ l: d.toLocaleDateString(undefined, { weekday: 'narrow' }), v: dayWords(L, k) }); }
        const max = Math.max.apply(null, days.map(x => x.v).concat([1]));
        const pct = a.total ? Math.round(a.done / a.total * 100) : 0;
        document.getElementById('stats-body').innerHTML = `
          <div class="zd-ring-wrap">
            <svg viewBox="0 0 100 100" class="w-24 h-24">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" stroke-width="8"/>
              <circle id="zd-ring-fg" cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--accent-rgb))" stroke-width="8" stroke-linecap="round" stroke-dasharray="263.9" stroke-dashoffset="263.9"/>
            </svg>
            <span class="zd-ring-mid"><b id="zd-streak-n" class="text-2xl font-extrabold text-text leading-none">0</b>
            <span class="text-[8.5px] font-bold uppercase tracking-widest text-muted mt-0.5">day streak <span class="zd-flame">🔥</span></span></span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 my-3">
            <div class="zd-stat" style="animation-delay:60ms"><b id="s-w">0</b><span>Total words</span></div>
            <div class="zd-stat" style="animation-delay:120ms"><b id="s-n">0</b><span>Notes</span></div>
          </div>
          <div class="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Words written · last 14 days</div>
          <div class="flex items-end gap-1 h-20 mb-3">${days.map((d, i) => `<div class="flex-1 flex flex-col items-center gap-0.5" title="${d.v} words"><div class="zd-bar" style="height:${Math.max(3, d.v / max * 66)}px;animation-delay:${i * 34}ms;background:${d.v ? 'rgb(var(--accent-rgb) / .88)' : 'rgba(140,140,150,.2)'}"></div><span class="text-[7.5px] text-muted">${d.l}</span></div>`).join('')}</div>
          <div class="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">This week</div>
          <div class="grid grid-cols-2 gap-1.5">
            <div class="zd-stat" style="animation-delay:180ms"><b id="s-c">0</b><span>Notes created</span></div>
            <div class="zd-stat" style="animation-delay:230ms"><b id="s-e">0</b><span>Notes edited</span></div>
            <div class="zd-stat" style="animation-delay:280ms"><b id="s-t">0</b><span>Tasks done</span></div>
            <div class="zd-stat" style="animation-delay:330ms"><b id="s-p">0</b><span>Completion</span></div>
          </div>`;
        setTimeout(() => {
            const ring = document.getElementById('zd-ring-fg');
            if (ring) ring.style.strokeDashoffset = (263.9 * (1 - Math.min(1, a.streak / 30))).toFixed(1);
            countUp(document.getElementById('zd-streak-n'), a.streak, 900);
            countUp(document.getElementById('s-w'), a.words, 1000);
            countUp(document.getElementById('s-n'), state.docs.length, 800);
            countUp(document.getElementById('s-c'), a.created, 700);
            countUp(document.getElementById('s-e'), a.edited, 700);
            const td = document.getElementById('s-t'); if (td) td.textContent = a.done + '/' + a.total;
            countUp(document.getElementById('s-p'), pct, 900, '%');
        }, 90);
    }
    /* weekly digest on Home */
    const _rh = window.renderHome;
    if (typeof _rh === 'function') window.renderHome = function () {
        const r = _rh.apply(this, arguments); logDay();
        const el = document.getElementById('home-body');
        if (!el || el.querySelector('#zd-digest')) return r;
        const a = agg(), pct = a.total ? Math.round(a.done / a.total * 100) : 0;
        const card = document.createElement('div');
        card.id = 'zd-digest';
        card.className = 'rounded-2xl border border-border bg-surface shadow-sm p-3.5 md:p-4 min-w-0';
        card.innerHTML = `<div class="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2.5"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V9m6 10V5m6 14v-8M3 21h18"/></svg> Weekly review</div>
          <div class="grid grid-cols-2 gap-1.5 mb-2">
            <div class="zd-stat"><b><span id="d-s">0</span> <span class="zd-flame">🔥</span></b><span>Day streak</span></div>
            <div class="zd-stat" style="animation-delay:70ms"><b id="d-c">0</b><span>New notes</span></div>
            <div class="zd-stat" style="animation-delay:140ms"><b id="d-e">0</b><span>Edited</span></div>
            <div class="zd-stat" style="animation-delay:210ms"><b id="d-p">0</b><span>Tasks done</span></div>
          </div>
          <button onclick="closeHome(); setTimeout(openStats,160)" class="w-full py-2 text-[11px] font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">See full stats</button>`;
        el.appendChild(card);
        setTimeout(() => {
            countUp(document.getElementById('d-s'), a.streak, 800);
            countUp(document.getElementById('d-c'), a.created, 700);
            countUp(document.getElementById('d-e'), a.edited, 700);
            countUp(document.getElementById('d-p'), pct, 850, '%');
        }, 120);
        return r;
    };
    document.getElementById('stats-modal').addEventListener('click', e => { if (e.target.id === 'stats-modal') closeStats(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('stats-modal').classList.contains('open')) { e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); closeStats(); } }, true);
    try { zdMenuInject2('stats', 'openStats', 'Writing stats & streak', '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19V9m6 10V5m6 14v-8M3 21h18"/>'); ZD_FEATURES.push({ id: 'stats', label: 'Writing stats & streak', fns: ['openStats'] }); } catch (e) {}
    setTimeout(logDay, 4000);
    setInterval(logDay, 600000);
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 800);
})();

    /* ============================================================
   V5.8 — SMALL FEATURES WITH BIG IMPACT
   A) Recently-viewed jump list (Alt+←)
   B) "Sort notes by" in the sidebar (recent / A–Z / created / words)
   C) Duplicate-title warning + auto "(2)" suggestion
   D) Pin the Quick Capture note to the top always
   E) Word-goal ring on the note footer (set per note)
   F) Save-state confidence: "All changes saved" tick + last-saved time
   G) Smooth page transitions between notes
============================================================ */
(function zd58() {
    if (window.__zd58) return; window.__zd58 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #recent-pop{position:fixed;z-index:130;width:250px;display:none;background:var(--surface-color);border:1px solid var(--border-color);border-radius:16px;box-shadow:0 20px 48px rgba(0,0,0,.34);overflow:hidden;}
    #recent-pop.on{display:block;animation:boxIn .2s cubic-bezier(.22,1,.36,1);}
    #zd-sort{background:transparent;border:none;color:#9ca3af;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;outline:none;cursor:pointer;}
    #zd-sort:hover{color:rgb(var(--accent-rgb));}
    .ql-editor{animation:noteIn .3s cubic-bezier(.22,1,.36,1);}
    @keyframes noteIn{0%{opacity:.4;transform:translateY(5px)}100%{opacity:1;transform:none}}
    #goal-ring{width:15px;height:15px;flex-shrink:0;}
    #goal-ring circle{transition:stroke-dashoffset .6s cubic-bezier(.22,1,.36,1);}
    #goal-wrap{display:none;align-items:center;gap:4px;cursor:pointer;}
    #goal-wrap.on{display:inline-flex;}
    #goal-wrap:hover #goal-txt{color:rgb(var(--accent-rgb));}
    </style>`);

    /* ---------- A) recently viewed ---------- */
    const RV = [];
    document.body.insertAdjacentHTML('beforeend', '<div id="recent-pop"><div class="px-3.5 py-2 text-[8.5px] font-extrabold uppercase tracking-widest text-gray-400 border-b border-border">Recently viewed</div><div id="recent-list" class="max-h-64 overflow-y-auto zd-scroll py-1"></div></div>');
    const _od = window.openDoc;
    window.openDoc = function (id, data) {
        const i = RV.indexOf(id); if (i >= 0) RV.splice(i, 1);
        RV.unshift(id); if (RV.length > 10) RV.pop();
        return _od(id, data);
    };
    window.openRecent = () => {
        const pop = document.getElementById('recent-pop'), list = document.getElementById('recent-list');
        const items = RV.map(i => state.docs.find(d => d.id === i)).filter(Boolean).filter(d => d.id !== state.docId);
        if (!items.length) { showToast('No other notes visited yet.'); return; }
        list.innerHTML = '';
        items.forEach((d, i) => {
            const b = document.createElement('button');
            b.className = 'w-full text-left px-3.5 py-2 text-xs text-text hover:bg-bg transition flex items-center gap-2 truncate';
            b.style.animation = 'fadeInUp .18s ease ' + (i * 24) + 'ms both';
            b.innerHTML = '<span class="text-gray-400 flex-shrink-0"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></span><span class="truncate">' + escapeHtml(d.title || 'Untitled') + '</span>';
            b.onclick = () => { pop.classList.remove('on'); openDoc(d.id, d); };
            list.appendChild(b);
        });
        const r = els.title.getBoundingClientRect();
        pop.style.left = Math.max(10, Math.min(r.left, window.innerWidth - 260)) + 'px';
        pop.style.top = (r.bottom + 12) + 'px';
        pop.classList.add('on');
    };
    document.addEventListener('click', (e) => { const p = document.getElementById('recent-pop'); if (p.classList.contains('on') && !e.target.closest('#recent-pop')) p.classList.remove('on'); });
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') && !state.isGuest) { e.preventDefault(); openRecent(); }
    }, true);

    /* ---------- B) sidebar sort ---------- */
    (function sorter() {
        const hdr = document.querySelector('[onclick*="doc-list"]');
        if (!hdr || !hdr.parentElement) return;
        const wrap = hdr.parentElement;
        wrap.classList.add('flex', 'justify-between', 'items-center');
        const sel = document.createElement('select');
        sel.id = 'zd-sort';
        sel.innerHTML = '<option value="recent">Recent</option><option value="title">A–Z</option><option value="created">Created</option><option value="words">Longest</option>';
        sel.value = localStorage.getItem('zdSortDocs') || 'recent';
        sel.onchange = () => { localStorage.setItem('zdSortDocs', sel.value); renderDocs(); showToast('Sorted by ' + sel.options[sel.selectedIndex].text + '.'); };
        sel.onclick = e => e.stopPropagation();
        wrap.appendChild(sel);
        const _rd = renderDocs;
        renderDocs = function () {
            const mode = localStorage.getItem('zdSortDocs') || 'recent';
            if (mode !== 'recent') {
                const w = d => { const t = docPlainText(d).trim(); return t ? t.split(/\s+/).length : 0; };
                const cmp = {
                    title: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }),
                    created: (a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0),
                    words: (a, b) => w(b) - w(a)
                }[mode];
                if (cmp) state.docs.sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || cmp(a, b));
            }
            return _rd();
        };
    })();

    /* ---------- C) duplicate title helper ---------- */
    els.title.addEventListener('input', () => {
        if (!state.docId || state.isGuest) return;
        const v = els.title.value.trim().toLowerCase();
        if (!v) return;
        const dup = state.docs.some(d => d.id !== state.docId && (d.title || '').trim().toLowerCase() === v);
        els.title.style.color = dup ? '#f59e0b' : '';
        els.title.title = dup ? 'Another note already has this name' : '';
    });

    /* ---------- D) keep Quick Capture pinned ---------- */
    setInterval(() => {
        if (state.isGuest || !state.user) return;
        const qc = state.docs.find(d => (d.title || '').indexOf('Quick Capture') === 0 && !d.pinned);
        if (qc) db.collection('users').doc(state.user.uid).collection('docs').doc(qc.id).update({ pinned: true }).catch(() => {});
    }, 30000);

    /* ---------- E) word goal ring ---------- */
    const st = document.getElementById('save-status');
    if (st && st.parentElement) {
        st.parentElement.insertAdjacentHTML('beforeend', `<span id="goal-wrap" title="Click to set a word goal for this note">
            <svg id="goal-ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="var(--border-color)" stroke-width="3.5"/><circle id="goal-fg" cx="12" cy="12" r="9" fill="none" stroke="rgb(var(--accent-rgb))" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="56.5" stroke-dashoffset="56.5" transform="rotate(-90 12 12)"/></svg>
            <span id="goal-txt" class="text-[9px] font-bold text-muted"></span></span>`);
        const goals = () => { try { return JSON.parse(localStorage.getItem('zdGoals') || '{}'); } catch (e) { return {}; } };
        window.zdSetGoal = () => {
            if (!state.docId) return;
            const g = goals();
            const v = prompt('Word goal for this note (blank to remove):', g[state.docId] || '500');
            if (v === null) return;
            const n = parseInt(v, 10);
            if (!n) { delete g[state.docId]; showToast('Goal removed.'); } else { g[state.docId] = n; showToast('Goal: ' + n + ' words.'); }
            localStorage.setItem('zdGoals', JSON.stringify(g));
            paintGoal();
        };
        document.getElementById('goal-wrap').onclick = zdSetGoal;
        function paintGoal() {
            const wrap = document.getElementById('goal-wrap');
            const g = goals()[state.docId];
            if (!g || !state.docId || state.isGuest) { wrap.classList.remove('on'); return; }
            const t = quill.getText().trim();
            const w = t ? t.split(/\s+/).length : 0;
            const p = Math.min(1, w / g);
            document.getElementById('goal-fg').style.strokeDashoffset = (56.5 * (1 - p)).toFixed(1);
            document.getElementById('goal-txt').textContent = w + '/' + g + (p >= 1 ? ' ✓' : '');
            wrap.classList.add('on');
        }
        window.zdPaintGoal = paintGoal;
        const _uw = updateWordCount;
        updateWordCount = function () { const r = _uw(); paintGoal(); return r; };
        setTimeout(paintGoal, 1200);
    }

    /* ---------- F) last-saved confidence ---------- */
    let lastSaved = 0;
    const _sd = window.saveToDb;
    window.saveToDb = async function () { const r = await _sd(); if (!state.dirty) lastSaved = Date.now(); return r; };
    setInterval(() => {
        if (!lastSaved || state.dirty || state.isGuest || !state.docId) return;
        const el = document.getElementById('save-status');
        if (!el || el.className !== 'saved') return;
        const m = Math.floor((Date.now() - lastSaved) / 60000);
        const txt = m < 1 ? 'All changes saved' : m === 1 ? 'Saved 1 min ago' : 'Saved ' + m + ' min ago';
        const s = el.querySelector('span');
        if (s && s.textContent !== txt) s.textContent = txt;
    }, 20000);

    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 900);
})();    

     // New Code

     /* ============================================================
   V5.5c — GOOGLE-DOCS SAVING + BULLETPROOF UNDO / REDO
   Root cause of the broken undo: the Firestore snapshot echo hit the
   `cur !== nw` branch in initData → setContents() + history.clear().
   Fix: (1) history.clear() is gated to real note switches only,
   (2) after every write we re-baseline the signature AND stamp
   lastTypeTime so the echo can never repaint, (3) the token
   highlighter no longer eats undo steps, (4) Ctrl+Z/Y bound at
   window capture so they work regardless of focus.
   Save states: idle → "Saving…" (amber spinner) → "Saved" (green
   tick). No status churn while typing. No write when nothing changed.
============================================================ */
(function zd55c() {
    if (window.__zd55c) return; window.__zd55c = true;

    const IDLE = 2000, MAX = 10000;
    let firstEdit = 0, lastSaved = 0, savingNow = false;

    /* ---------- status pills ---------- */
    document.head.insertAdjacentHTML('beforeend', `<style>
    #save-status{gap:5px;font-weight:700;font-size:10px;}
    #save-status.zd-typing{color:#9ca3af;}
    #save-status.zd-saving{color:#d97706;}
    html.dark #save-status.zd-saving{color:#fbbf24;}
    #save-status.zd-saved{color:#16a34a;}
    html.dark #save-status.zd-saved{color:#4ade80;}
    #save-status.zd-off{color:#f59e0b;}
    #save-status.zd-err{color:#d93025;}
    .zd-spin{width:10px;height:10px;flex-shrink:0;border-radius:99px;border:1.6px solid currentColor;border-top-color:transparent;animation:zdSpin .62s linear infinite;}
    @keyframes zdSpin{to{transform:rotate(360deg)}}
    .zd-tick{width:11px;height:11px;flex-shrink:0;animation:zdPop .32s cubic-bezier(.22,1,.36,1);}
    @keyframes zdPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.22)}100%{transform:scale(1);opacity:1}}
    .zd-dot{width:6px;height:6px;border-radius:99px;background:currentColor;flex-shrink:0;opacity:.75;}
    </style>`);

    const TICK = '<svg class="zd-tick" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.4"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
    const CLOUD = '<svg class="zd-tick" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-10 5 5 0 10-9.8 2A4 4 0 003 15z"/></svg>';
    const WARN = '<svg class="zd-tick" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.5m0 3.5h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z"/></svg>';

    function pill(kind, html) {
        const el = els.status; if (!el) return;
        el.className = 'zd-' + kind;
        el.innerHTML = html;
    }
    // function showSaved(force) {
    //     const m = lastSaved ? Math.floor((Date.now() - lastSaved) / 60000) : 0;
    //     pill('saved', TICK + '<span>' + (m < 1 ? 'Saved' : m === 1 ? 'Saved 1 min ago' : 'Saved ' + m + ' min ago') + '</span>');
    // }
    function zdAgo(ms) {
        const m = Math.floor(ms / 60000);
        if (m < 1) return 'Saved';
        if (m < 60) return 'Saved ' + m + ' min ago';
        const h = Math.floor(m / 60);
        if (h < 24) return 'Saved ' + h + (h === 1 ? ' hr ago' : ' hrs ago');
        const d = Math.floor(h / 24);
        if (d < 7) return 'Saved ' + d + (d === 1 ? ' day ago' : ' days ago');
        const w = Math.floor(d / 7);
        if (w < 5) return 'Saved ' + w + (w === 1 ? ' wk ago' : ' wks ago');
        const mo = Math.floor(d / 30);
        return 'Saved ' + mo + (mo === 1 ? ' mo ago' : ' mos ago');
    }
    function showSaved(force) {
        pill('saved', TICK + '<span>' + (lastSaved ? zdAgo(Date.now() - lastSaved) : 'Saved') + '</span>');
    }
    /* neutralise every legacy setStatus call so nothing overwrites our pills */
    window.setStatus = function (kind, text) {
        if (kind === 'offline') { pill('off', CLOUD + '<span>' + (text || 'Offline — unsaved edits') + '</span>'); return; }
        if (kind === 'error') { pill('err', WARN + '<span>' + (text || 'Error saving') + '</span>'); return; }
        if (kind === 'saving') { if (savingNow) pill('saving', '<span class="zd-spin"></span><span>Saving…</span>'); return; }
        if (kind === 'saved') { showSaved(); return; }
        pill('typing', '<span class="zd-dot"></span><span>' + (text || '') + '</span>');
    };

    /* ---------- 1. protect the undo stack ---------- */
    let allowClear = false;
    const _clear = quill.history.clear.bind(quill.history);
    quill.history.clear = function () { if (allowClear) return _clear(); };

    /* ---------- 2. saving that can never trigger a repaint ---------- */
    async function doSave() {
        if (!state.docId || state.isGuest || state.offlineMode) return;
        if (computeSaveSig() === state.lastSavedSig) { state.dirty = false; showSaved(); return; }
        savingNow = true;
        pill('saving', '<span class="zd-spin"></span><span>Saving…</span>');
        state.lastTypeTime = Date.now();          /* blocks initData's isTyping branch */
        try {
            await saveToDb();
            state.lastSavedSig = computeSaveSig(); /* echo now compares equal → no setContents */
            state.dirty = false;
            lastSaved = Date.now();
            savingNow = false;
            showSaved();
        } catch (e) {
            savingNow = false;
            pill('err', WARN + '<span>Couldn\u2019t save — retrying…</span>');
            setTimeout(() => { if (state.dirty) doSave(); }, 4000);
        }
    }

    window.triggerSave = function () {
        if (!state.docId || state.isGuest) return;
        if (document.body.classList.contains('zd-locked')) return;
        /* no real change → leave the existing Saved/Synced pill untouched */
        if (computeSaveSig() === state.lastSavedSig) {
            state.dirty = false;
            if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
            firstEdit = 0;
            if (!savingNow) { state.offlineMode ? setStatus('offline') : showSaved(); }
            return;
        }
        state.dirty = true;
        if (state.offlineMode) { setStatus('offline', 'Offline — unsaved edits (Ctrl+S to sync)'); return; }
        if (!firstEdit) firstEdit = Date.now();
        if (state.saveTimer) clearTimeout(state.saveTimer);
        const waited = Date.now() - firstEdit;
        state.saveTimer = setTimeout(() => { firstEdit = 0; state.saveTimer = null; doSave(); },
            waited >= MAX ? 0 : Math.min(IDLE, MAX - waited));
    };

    function flush() {
        if (!state.dirty || !state.docId || state.isGuest || state.offlineMode) return;
        if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
        firstEdit = 0; doSave();
    }
    window.zdFlushSave = flush;

    /* ---------- 3. openDoc: flush, then allow ONE history clear ---------- */
    const _od = window.openDoc;
    window.openDoc = function (id, data) {
        flush();
        allowClear = (state.docId !== id);
        const r = _od(id, data);
        setTimeout(() => { allowClear = false; }, 500);
        // lastSaved = Date.now();
        lastSaved = (data && data.updatedAt && data.updatedAt.toDate) ? data.updatedAt.toDate().getTime() : Date.now();
        setTimeout(() => { if (!state.dirty && !savingNow) showSaved(); }, 120);
        return r;
    };

    /* ---------- 4. guaranteed flush points ---------- */
    quill.root.addEventListener('blur', () => setTimeout(flush, 80));
    els.title.addEventListener('blur', () => setTimeout(flush, 80));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', (e) => { if (state.dirty && !state.offlineMode) { flush(); e.preventDefault(); e.returnValue = ''; } });

    /* ---------- 5. undo / redo that always works ---------- */
    function undo() { try { if (!quill.hasFocus()) quill.focus(); } catch (e) {} quill.history.undo(); updateWordCount(); triggerSave(); }
    function redo() { try { if (!quill.hasFocus()) quill.focus(); } catch (e) {} quill.history.redo(); updateWordCount(); triggerSave(); }
    window.zdUndo = undo; window.zdRedo = redo;
    const ub = document.getElementById('undo-btn'), rb = document.getElementById('redo-btn');
    if (ub) { ub.onclick = null; ub.addEventListener('click', (e) => { e.preventDefault(); undo(); }); }
    if (rb) { rb.onclick = null; rb.addEventListener('click', (e) => { e.preventDefault(); redo(); }); }
    window.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || state.isGuest || !state.docId) return;
        const ae = document.activeElement;
        if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
        const k = (e.key || '').toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); undo(); }
        else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); redo(); }
        else if (k === 's') { e.preventDefault(); flush(); }
    }, true);

    /* ---------- 6. token highlighter must not consume undo steps ---------- */
    const _scan = window.scanInlineTokens;
    if (typeof _scan === 'function') {
        window.scanInlineTokens = function (save) {
            const st = quill.history.stack;
            const len = (st && st.undo) ? st.undo.length : -1;
            const r = _scan(save);
            if (len >= 0 && st.undo.length > len) st.undo.length = len; /* formatting-only pass */
            return r;
        };
    }

    /* ---------- 7. keep the "Saved N min ago" text fresh ---------- */
    setInterval(() => { if (!state.dirty && !savingNow && !state.offlineMode && state.docId && !state.isGuest && els.status.className === 'zd-saved') showSaved(); }, 30000);
    setTimeout(() => { if (state.docId && !state.isGuest) { lastSaved = Date.now(); showSaved(); } }, 1500);
})();

// New Code

   /* ============================================================
   V5.8b — DUPLICATE TITLE HANDLING + LIVE SIDEBAR SORT
   • Duplicate name → toast warning + auto "(2)" on blur/save
   • Warning clears on note switch, on fix, and on blur
   • "Recent" sort re-sorts live on every edit (was only on reload)
============================================================ */
(function zd58b() {
    if (window.__zd58b) return; window.__zd58b = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #doc-title.zd-dup{color:#d97706!important;}
    html.dark #doc-title.zd-dup{color:#fbbf24!important;}
    #dup-hint{position:fixed;bottom:22px;left:50%;transform:translateX(-50%) translateY(14px);z-index:119;display:none;
        max-width:min(420px,92vw);background:var(--surface-color);border:1px solid #f59e0b;border-left:4px solid #f59e0b;
        border-radius:14px;padding:11px 13px;box-shadow:0 16px 40px rgba(0,0,0,.3);opacity:0;transition:opacity .25s ease,transform .3s cubic-bezier(.22,1,.36,1);}
    #dup-hint.on{display:block;opacity:1;transform:translateX(-50%) translateY(0);}
    @media (max-width:850px){#dup-hint{bottom:auto;top:74px;}}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="dup-hint"><div class="flex items-start gap-2.5">
      <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.5m0 3.5h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z"/></svg>
      <div class="flex-1 min-w-0">
        <div class="text-[11.5px] font-bold text-text">Another note already has this name</div>
        <div id="dup-msg" class="text-[10.5px] text-muted leading-snug">Rename it, or ZenDocs will save it as a numbered copy.</div>
        <div class="flex gap-1.5 mt-2">
          <button id="dup-fix" class="px-3 py-1.5 text-[10.5px] font-bold rounded-lg text-white active:scale-95 transition" style="background-image:var(--zd-grad)">Use suggested name</button>
          <button id="dup-edit" class="px-2.5 py-1.5 text-[10.5px] font-semibold rounded-lg text-muted hover:text-text transition">Let me rename</button>
        </div>
      </div>
      <button id="dup-x" class="text-muted hover:text-danger text-base leading-none flex-shrink-0 active:scale-90">×</button>
    </div></div>`);

    const $ = id => document.getElementById(id);
    const norm = s => (s || '').trim().toLowerCase();
    let suggested = '';

    function uniqueName(base) {
        let b = (base || 'Untitled Document').trim().replace(/\s*\((\d+)\)$/, '');
        let n = 2, t = b + ' (' + n + ')';
        while (state.docs.some(d => d.id !== state.docId && norm(d.title) === norm(t))) { n++; t = b + ' (' + n + ')'; }
        return t;
    }
    function isDup() {
        if (!state.docId || state.isGuest) return false;
        const v = norm(els.title.value);
        if (!v) return false;
        return state.docs.some(d => d.id !== state.docId && norm(d.title) === v);
    }
    function hideHint() { $('dup-hint').classList.remove('on'); }
    window.zdClearDup = function () {
        hideHint();
        els.title.classList.remove('zd-dup');
        els.title.title = '';
        els.title.style.color = '';
        suggested = '';
    };
    function showHint() {
        suggested = uniqueName(els.title.value);
        $('dup-msg').innerHTML = 'Rename it, or it will be saved as <b>' + escapeHtml(suggested) + '</b>.';
        $('dup-hint').classList.add('on');
        els.title.classList.add('zd-dup');
        els.title.title = 'Another note already has this name';
    }
    function check() {
        if (isDup()) showHint(); else zdClearDup();
    }
    $('dup-x').onclick = hideHint;
    $('dup-edit').onclick = () => { hideHint(); try { els.title.focus(); els.title.select(); } catch (e) {} };
    $('dup-fix').onclick = () => {
        if (!suggested) suggested = uniqueName(els.title.value);
        els.title.value = suggested;
        zdClearDup();
        triggerSave();
        showToast('Renamed to “' + suggested + '”.');
    };

    /* live check while typing (debounced) */
    let t = null;
    els.title.addEventListener('input', () => { clearTimeout(t); t = setTimeout(check, 260); });

    /* on blur: auto-number so the note ALWAYS saves */
    els.title.addEventListener('blur', () => {
        setTimeout(() => {
            if (!state.docId || state.isGuest) { zdClearDup(); return; }
            if (!els.title.value.trim()) els.title.value = 'Untitled Document';
            if (isDup()) {
                const auto = uniqueName(els.title.value);
                els.title.value = auto;
                zdClearDup();
                triggerSave();
                showToast('Name taken — saved as “' + auto + '”. Rename it anytime.', 4200);
            } else { zdClearDup(); }
        }, 40);
    }, true);

    /* clear the warning whenever the open note changes */
    const _od = window.openDoc;
    window.openDoc = function (id, data) { zdClearDup(); const r = _od(id, data); setTimeout(zdClearDup, 80); return r; };
    els.docList.addEventListener('click', () => setTimeout(zdClearDup, 60), true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('dup-hint').classList.contains('on')) { e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); hideHint(); } }, true);

    /* ---------- LIVE "Recent" SORT ---------- */
    const wc = d => { const x = docPlainText(d).trim(); return x ? x.split(/\s+/).length : 0; };
    const ts = v => (v && v.toDate) ? v.toDate().getTime() : ((v && v.seconds) ? v.seconds * 1000 : 0);
    const _rd = renderDocs;
    renderDocs = function () {
        const mode = localStorage.getItem('zdSortDocs') || 'recent';
        const cmp = {
            recent: (a, b) => ts(b.updatedAt) - ts(a.updatedAt),
            title: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }),
            created: (a, b) => ts(b.createdAt) - ts(a.createdAt),
            words: (a, b) => wc(b) - wc(a)
        }[mode];
        if (cmp) state.docs.sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || cmp(a, b));
        return _rd();
    };
    /* re-render the list shortly after each save so "Recent" reorders live */
    const _sd = window.saveToDb;
    window.saveToDb = async function () {
        const r = await _sd.apply(this, arguments);
        const d = state.docs.find(x => x.id === state.docId);
        if (d) d.updatedAt = { toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000) };
        setTimeout(() => { try { renderDocs(); } catch (e) {} }, 60);
        return r;
    };
    const sel = document.getElementById('zd-sort');
    if (sel) sel.onchange = () => {
        localStorage.setItem('zdSortDocs', sel.value);
        renderDocs();
        showToast('Sorted by ' + sel.options[sel.selectedIndex].text + '.');
    };
    setTimeout(renderDocs, 400);
})();

