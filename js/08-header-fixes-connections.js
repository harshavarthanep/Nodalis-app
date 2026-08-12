// ZenDocs — 08-header-fixes-connections.js
// V6.0 header unification & mentions panel, V6.1/V6.2 fixes, V6.3a-d read-first edit mode / quick capture / sidebar spacing / help guide, V7.1 automatic connections & tags.
// (part of a mechanical split of the original single-file app; see README)

   /* ============================================================
   V6.0 — HEADER UNIFICATION · MENTIONS PANEL · FIXES · POLISH
   A) Canvas + Templates headers match Home/Kanban/Eisenhower
      (help left · centred title · single close right)
   B) "Select text, then add a note" works again
   C) Linked / Unlinked mentions move to their own panel (⋯ menu)
   D) Ruler margins + Reset margins fixed
   E) Global rounded-corner polish (nothing sharp)
   F) Correct icons for Quick capture ⚡ and Writing stats
============================================================ */
(function zd60() {
    if (window.__zd60) return; window.__zd60 = true;

    /* clear any leftovers from the removed V5.9 attempts */
    document.querySelectorAll('[data-zdx],.zdvh-row2').forEach(n => n.remove());
    ['canvas-modal', 'templates-modal'].forEach(id => { const m = document.getElementById(id); if (m) { delete m.dataset.zd59b; delete m.dataset.zd60; } });

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ================= A) UNIFIED VIEW HEADER ================= */
    .zd-view-head{display:grid!important;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;
        min-height:54px;padding:8px 10px!important;flex-wrap:nowrap!important;}
    .zdvh-l,.zdvh-r{display:flex;align-items:center;gap:4px;flex-shrink:0;}
    .zdvh-r{justify-content:flex-end;}
    .zdvh-mid{min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;text-align:center;}
    .zdvh-mid > span{min-width:0;}
    .zdvh-title{font-size:13px;font-weight:800;color:var(--text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .zdvh-sub{display:none;font-size:9.5px;color:#9ca3af;font-weight:600;}
    @media (min-width:1000px){.zdvh-sub{display:block;}}
    .zdvh-b{width:30px;height:30px;flex-shrink:0;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;
        color:#9ca3af;transition:all .16s ease;}
    .zdvh-b svg{width:16px;height:16px;}
    .zdvh-b:hover{color:rgb(var(--accent-rgb));background:rgb(var(--accent-rgb) / .13);transform:scale(1.07);}
    .zdvh-b:active{transform:scale(.9);}
    .zdvh-x{width:32px;height:32px;flex-shrink:0;border-radius:99px;display:flex;align-items:center;justify-content:center;
        font-size:21px;line-height:1;color:#9ca3af;transition:all .16s ease;}
    .zdvh-x:hover{color:#d93025;background:rgba(217,48,37,.11);}
    .zdvh-x:active{transform:scale(.88);}
    /* tool row under the header (canvas / templates) */
    .zdvh-tools{display:flex;flex-wrap:wrap;gap:6px;width:100%;padding:0 12px 9px;background:var(--surface-color);
        border-bottom:1px solid var(--border-color);}
    .zdvh-tools button{flex:0 0 auto;padding:6px 12px;font-size:10.5px;font-weight:700;border-radius:12px;
        background:var(--bg-color);border:1px solid var(--border-color);color:var(--text-color);transition:all .15s ease;}
    .zdvh-tools button:hover{border-color:rgb(var(--accent-rgb));color:rgb(var(--accent-rgb));}
    .zdvh-tools button:active{transform:scale(.96);}
    .zdvh-zoom{display:flex;align-items:center;gap:3px;padding:2px;border-radius:12px;background:var(--bg-color);border:1px solid var(--border-color);}
    .zdvh-zoom button{border:none!important;background:transparent!important;width:30px;padding:5px 0!important;border-radius:9px!important;}
    .zdvh-lbl{font-size:10px;color:#9ca3af;min-width:38px;text-align:center;font-variant-numeric:tabular-nums;}
    @media (max-width:900px){
      .zd-view-head{min-height:50px;padding:7px 8px!important;}
      .zdvh-title{font-size:12.5px;}
      .zdvh-tools{padding:0 10px 8px;gap:5px;}
      .zdvh-tools button{padding:6px 10px;font-size:10px;}
      #tpl-builtin{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
      #tpl-builtin button{padding:14px 8px!important;}
      #tpl-user > div{flex-wrap:wrap;row-gap:7px;}
      #tpl-user > div > span:first-child{width:100%;}
      #zd-dtpl .flex{flex-wrap:wrap;gap:7px!important;}
      #zd-dtpl-sel,#zd-dtpl-save{flex:1 1 100%;font-size:12.5px;padding:8px 10px;}
      #canvas-fab{bottom:calc(18px + env(safe-area-inset-bottom,0px));right:16px;width:52px;height:52px;font-size:26px;}
      .cv-card{width:174px;}
    }
    @media (min-width:901px) and (max-width:1180px){ #tpl-builtin{grid-template-columns:repeat(3,minmax(0,1fr))!important;} }

    /* ================= C) MENTIONS PANEL ================= */
    #ment-modal{z-index:128;}
    .zd-mtab{padding:7px 14px;font-size:11px;font-weight:800;border-radius:99px;color:#9ca3af;transition:all .16s ease;}
    .zd-mtab.on{background-image:var(--zd-grad);color:#fff;}
    .zd-mrow{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px 10px;border-radius:13px;
        border:1px solid var(--border-color);background:var(--bg-color);margin-bottom:6px;transition:all .16s ease;}
    .zd-mrow:hover{border-color:rgb(var(--accent-rgb) / .6);transform:translateX(3px);}
    .zd-mrow.dashed{border-style:dashed;}
    /* tidy the sidebar panel (mentions now live elsewhere) */
    #comments-panel .zd-mentions-old{display:none!important;}
    #comments-list{padding:9px 12px!important;}
    #add-note-btn-wrapper{padding:10px 12px!important;}
    #add-note-btn-wrapper button{border-radius:13px!important;}

    /* ================= E) ROUNDED POLISH ================= */
    #ruler{border-radius:10px!important;}
    #toolbar.ql-toolbar{border-radius:32px;}
    .zd-tool,#toolbar .ql-formats button{border-radius:9px!important;}
    .zd-size input{border-radius:9px!important;}
    .ql-editor pre.ql-syntax{border-radius:12px;}
    .ql-editor blockquote{border-radius:0 10px 10px 0;padding-top:2px;padding-bottom:2px;}
    .ql-editor img{border-radius:10px;}
    #paper-container{border-radius:10px!important;}
    @media (max-width:850px){#paper-container{border-radius:0!important;}}
    .ql-picker-options{border-radius:14px!important;}
    .ql-picker-label{border-radius:9px!important;}
    select,input[type=text],input[type=email],input[type=password],input[type=date],input[type=datetime-local],input[type=number],textarea{border-radius:11px;}
    .zd-stat,.cm-row,.eis-row,.zd44-row,.kb-card,.cv-card{border-radius:14px;}
    .doc-row{border-radius:11px!important;}
    #cm-dir,#cm-sort,#cm-search{border-radius:12px!important;}
    .zd-view-btn{border-radius:12px!important;}
    #save-status,#word-count{border-radius:8px;}
    .zd-mi{border-radius:9px;margin:0 4px;}
    .ql-editor table td,.ql-editor table th{border-radius:4px;}
    #graph-canvas{border-radius:0;}
    button,.gv-cta,.zda-btn{border-radius:12px;}
    .zdvh-b,.zdvh-x,.eis-check,.cm-ib,.zd44-ib{border-radius:99px!important;}
    </style>`);

    const HELP_SVG = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.2 9.4A3 3 0 0112 7.6c1.7 0 3 1 3 2.3 0 1.1-1 2-2.3 2.2-.4.1-.7.4-.7.9m0 3h.01"/></svg>';

    /* ---------- A) rebuild every view header into one grid ---------- */
    function buildHeader(cfg) {
        const m = document.getElementById(cfg.modal); if (!m || m.dataset.zd60) return;
        const head = m.querySelector('.zd-view-head'); if (!head) return;
        m.dataset.zd60 = '1';

        const titleSpan = head.querySelector('span');
        const iconSvg = titleSpan ? (titleSpan.querySelector('svg') || {}).outerHTML || '' : '';
        const actsWrap = head.querySelector('div');
        const allBtns = Array.from(head.querySelectorAll('button'));
        const closeBtn = allBtns.find(b => (b.getAttribute('onclick') || '').indexOf(cfg.close) === 0);
        const tools = allBtns.filter(b => b !== closeBtn);

        /* keep every tool node (handlers intact) for the second row */
        const keepNodes = tools.slice();
        const extraNodes = cfg.extraIds ? cfg.extraIds.map(i => document.getElementById(i)).filter(Boolean) : [];

        head.innerHTML = '';
        const L = document.createElement('span'); L.className = 'zdvh-l';
        const M = document.createElement('span'); M.className = 'zdvh-mid';
        const R = document.createElement('span'); R.className = 'zdvh-r';

        const help = document.createElement('button');
        help.className = 'zdvh-b'; help.dataset.vh = cfg.tour; help.title = 'How this works';
        help.innerHTML = HELP_SVG;
        help.onclick = (e) => { e.stopPropagation(); if (window.startTour) startTour(cfg.tour); };
        L.appendChild(help);

        M.innerHTML = `<span class="flex items-center gap-2 min-w-0"><span class="text-accent flex-shrink-0" style="display:inline-flex">${iconSvg}</span><span class="zdvh-title">${cfg.title}</span></span><span class="zdvh-sub">${cfg.sub || ''}</span>`;

        const x = document.createElement('button');
        x.className = 'zdvh-x'; x.title = 'Close (Esc)'; x.textContent = '×';
        x.onclick = (e) => { e.stopPropagation(); try { window[cfg.close](); } catch (err) {} };
        R.appendChild(x);

        head.appendChild(L); head.appendChild(M); head.appendChild(R);
        if (actsWrap && actsWrap.parentElement) actsWrap.remove();
        if (closeBtn) closeBtn.remove();

        if (keepNodes.length || extraNodes.length) {
            const row = document.createElement('div');
            row.className = 'zdvh-tools';
            if (cfg.zoom) {
                const z = document.createElement('span'); z.className = 'zdvh-zoom';
                cfg.zoom.forEach(sel => {
                    const b = keepNodes.find(n => (n.getAttribute('onclick') || '').indexOf(sel) === 0);
                    if (b) { b.className = ''; z.appendChild(b); }
                    if (sel === cfg.zoom[0] && cfg.zoomLbl) {
                        const l = document.getElementById(cfg.zoomLbl);
                        if (l) { l.className = 'zdvh-lbl'; z.appendChild(l); }
                    }
                });
                if (z.children.length) row.appendChild(z);
            }
            keepNodes.forEach(b => { if (b.parentElement !== row.querySelector('.zdvh-zoom')) { b.className = ''; row.appendChild(b); } });
            extraNodes.forEach(n => { n.style.fontSize = '9.5px'; n.style.alignSelf = 'center'; row.appendChild(n); });
            head.insertAdjacentElement('afterend', row);
        }
    }

    function runHeaders() {
        buildHeader({ modal: 'canvas-modal', close: 'closeCanvas', tour: 'canvas', title: 'Canvas', sub: 'Freeform idea board', zoom: ['canvasZoom(0.85', 'canvasZoom(1.18'], zoomLbl: 'canvas-zoom-label', extraIds: ['canvas-status'] });
        buildHeader({ modal: 'templates-modal', close: 'closeTemplates', tour: 'templates', title: 'Templates', sub: 'Reusable note layouts' });
        /* dedupe stray close buttons in the other views */
        [['calendar-modal', 'closeCalendar'], ['kanban-modal', 'closeKanban'], ['eis-modal', 'closeEisenhower'], ['home-modal', 'closeHome']].forEach(([id, fn]) => {
            const m = document.getElementById(id); if (!m) return;
            const head = m.querySelector('.zd-view-head'); if (!head) return;
            const xs = Array.from(head.querySelectorAll('button')).filter(b => b.textContent.trim() === '×' || (b.getAttribute('onclick') || '').indexOf(fn) === 0);
            xs.forEach((b, i) => { if (i < xs.length - 1) b.remove(); else { b.className = 'zdvh-x'; b.textContent = '×'; } });
        });
    }
    ['openCanvas', 'openTemplates', 'openCalendar', 'openKanban', 'openEisenhower', 'openHome'].forEach(fn => {
        const o = window[fn]; if (typeof o !== 'function') return;
        window[fn] = function () { const r = o.apply(this, arguments); setTimeout(runHeaders, 200); return r; };
    });
    setTimeout(runHeaders, 900);
    const _oc = window.openCanvas;
    if (typeof _oc === 'function') window.openCanvas = async function () {
        const r = await _oc.apply(this, arguments);
        [340, 780].forEach(t => setTimeout(() => { try { if (Object.keys(cv.items).length) canvasFit(); applyStageTransform(); } catch (e) {} }, t));
        return r;
    };

    /* ---------- B) "Select text, then add a note" works again ---------- */
    let lastSel = null;
    quill.on('selection-change', (r) => { if (r && r.length > 0) lastSel = { index: r.index, length: r.length }; });
    window.startComment = function () {
        if (state.isGuest) { showToast('Sign in to add notes.'); return; }
        if (!state.docId) { showToast('Open a note first.'); return; }
        let r = quill.getSelection();
        if (!r || r.length === 0) r = lastSel;
        if (!r || r.length === 0) { showToast('Select some text in the note first, then tap “add a note”.', 3600); return; }
        window._pendingCommentRange = { index: r.index, length: r.length };
        try { window.eval; } catch (e) {}
        const quote = quill.getText(r.index, r.length);
        els.commentQuote.textContent = '"' + quote.slice(0, 120) + '"';
        els.commentModal.dataset.quote = quote.slice(0, 200);
        els.commentText.value = '';
        els.commentModal.style.display = 'flex';
        setTimeout(() => { try { els.commentText.focus({ preventScroll: true }); zdArmProtect(els.commentText); } catch (e) {} }, 110);
    };
    window.submitComment = async function () {
        const text = els.commentText.value.trim();
        if (!text) { showToast('Please write your note first.'); return; }
        const rg = window._pendingCommentRange;
        if (!rg) { showToast('Selection lost — select the text again.'); closeCommentModal(); return; }
        const cid = 'c' + Date.now() + Math.floor(Math.random() * 9999);
        const comment = { quote: els.commentModal.dataset.quote || '', text: text, author: state.user.email, authorUid: state.user.uid, ts: Date.now() };
        const active = state.docs.find(d => d.id === state.docId);
        try {
            if (active && active.importedFromShareId) {
                await db.collection('shared_docs').doc(active.importedFromShareId).set({ comments: { [cid]: comment } }, { merge: true });
            } else {
                quill.formatText(rg.index, rg.length, 'comment', cid, 'user');
            }
            state.comments[cid] = comment;
            triggerSave(); renderComments(); closeCommentModal();
            if (els.commentsPanel.classList.contains('hidden')) toggleCommentsPanel();
            showToast('Note added.');
        } catch (e) { console.error(e); showToast('Could not add the note.'); }
    };
    const addBtn = document.querySelector('#add-note-btn-wrapper button');
    if (addBtn) { addBtn.onclick = null; addBtn.addEventListener('click', (e) => { e.preventDefault(); startComment(); }); }
    const cbtn = document.getElementById('comment-btn');
    if (cbtn) { cbtn.onclick = null; cbtn.addEventListener('click', (e) => { e.preventDefault(); startComment(); }); }

    /* ---------- C) Mentions in their own panel ---------- */
    document.querySelectorAll('#backlinks-list, #unlinked-list').forEach(el => {
        const sec = el.closest('.border-t') || el.parentElement;
        if (sec) sec.classList.add('zd-mentions-old');
    });
    document.body.insertAdjacentHTML('beforeend', `
    <div id="ment-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-md flex flex-col" style="max-height:82vh">
      <div class="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7l1.5-1.5M10.2 13.8a4 4 0 010-5.7l3-3a4 4 0 115.6 5.7l-1.5 1.5"/></svg> Mentions</h3>
        <button onclick="closeMentions()" class="zdvh-x">×</button>
      </div>
      <div id="ment-note" class="text-[10.5px] text-muted truncate mb-2 flex-shrink-0"></div>
      <div class="flex gap-1 mb-3 bg-bg border border-border rounded-full p-0.5 w-fit flex-shrink-0">
        <button id="ment-t1" class="zd-mtab on" onclick="mentTab('linked')">Linked</button>
        <button id="ment-t2" class="zd-mtab" onclick="mentTab('unlinked')">Unlinked</button>
      </div>
      <div id="ment-body" class="flex-1 min-h-0 overflow-y-auto zd-scroll pr-1"></div>
    </div></div>`);
    let mTab = 'linked';
    window.openMentions = () => {
        if (state.isGuest || !state.docId) { showToast('Open a note first.'); return; }
        document.getElementById('ment-modal').classList.add('open');
        renderMentions();
    };
    window.closeMentions = () => document.getElementById('ment-modal').classList.remove('open');
    window.mentTab = (t) => { mTab = t; renderMentions(); };
    function renderMentions() {
        const cur = state.docs.find(d => d.id === state.docId);
        const title = ((cur && cur.title) || els.title.value || '').trim();
        document.getElementById('ment-note').textContent = 'For “' + title + '”';
        document.getElementById('ment-t1').className = 'zd-mtab' + (mTab === 'linked' ? ' on' : '');
        document.getElementById('ment-t2').className = 'zd-mtab' + (mTab === 'unlinked' ? ' on' : '');
        const body = document.getElementById('ment-body');
        body.innerHTML = '';
        if (!title) { body.innerHTML = '<div class="text-center text-muted text-xs py-8">Give this note a title first.</div>'; return; }
        const re = new RegExp('\\[\\[\\s*' + escapeRegExp(title) + '\\s*\\]\\]', 'i');
        const linked = state.docs.filter(d => d.id !== state.docId && re.test(docPlainText(d)));
        if (mTab === 'linked') {
            if (!linked.length) { body.innerHTML = '<div class="text-center text-muted text-[11px] py-8 leading-relaxed">No notes link here yet.<br>Type <b>[[' + escapeHtml(title) + ']]</b> in another note to create a backlink.</div>'; return; }
            linked.forEach(d => body.appendChild(row(d, false)));
        } else {
            const ids = new Set(linked.map(d => d.id));
            const t = title.toLowerCase();
            const hits = state.docs.filter(d => d.id !== state.docId && !ids.has(d.id) && !(d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id))) && docPlainText(d).toLowerCase().includes(t));
            if (!hits.length) { body.innerHTML = '<div class="text-center text-muted text-[11px] py-8">No unlinked mentions of “' + escapeHtml(title) + '”.</div>'; return; }
            body.insertAdjacentHTML('beforeend', '<div class="text-[10px] text-muted mb-2.5 leading-snug">These notes mention “' + escapeHtml(title) + '” without linking. Open one and wrap the mention in [[…]] to connect it.</div>');
            hits.forEach(d => body.appendChild(row(d, true)));
        }
    }
    function row(d, dashed) {
        const b = document.createElement('button');
        b.className = 'zd-mrow' + (dashed ? ' dashed' : '');
        b.innerHTML = `<span class="${dashed ? 'text-muted' : 'text-accent'} flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${dashed ? '<circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>' : '<path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7"/>'}</svg></span>
            <span class="min-w-0 flex-1"><span class="block text-xs font-medium text-text truncate">${escapeHtml(d.title || 'Untitled')}</span>
            <span class="block text-[9px] text-muted">${d.updatedAt ? 'Edited ' + new Date(d.updatedAt.toDate()).toLocaleDateString() : ''}</span></span>`;
        b.onclick = () => { closeMentions(); openDoc(d.id, d); };
        return b;
    }
    document.getElementById('ment-modal').addEventListener('click', e => { if (e.target.id === 'ment-modal') closeMentions(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('ment-modal').classList.contains('open')) { e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); closeMentions(); } }, true);
    try {
        zdMenuInject2('mentions', 'openMentions', 'Linked & unlinked mentions', '<path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7l1.5-1.5M10.2 13.8a4 4 0 010-5.7l3-3a4 4 0 115.6 5.7l-1.5 1.5"/>');
        ZD_FEATURES.push({ id: 'mentions', label: 'Linked & unlinked mentions', fns: ['openMentions'] });
    } catch (e) {}

    /* ---------- D) margins + reset margins ---------- */
    window.applyMargins = function () {
        const ed = document.querySelector('.ql-editor');
        if (ed) {
            ed.style.setProperty('padding-left', state.marginL + 'px', 'important');
            ed.style.setProperty('padding-right', state.marginR + 'px', 'important');
        }
        try { buildRuler(); } catch (e) {}
    };
    window.resetMargins = function () {
        state.marginL = 96; state.marginR = 96;
        applyMargins();
        if (state.docId && !state.isGuest) triggerSave();
        showToast('Margins reset to default.');
    };
    const rr = document.getElementById('ruler-reset');
    if (rr) { rr.onclick = null; rr.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); resetMargins(); }); rr.style.cursor = 'pointer'; }
    const _od2 = window.openDoc;
    window.openDoc = function (id, data) { const r = _od2(id, data); setTimeout(() => { try { applyMargins(); } catch (e) {} }, 140); return r; };
    setTimeout(() => { try { applyMargins(); } catch (e) {} }, 1400);

    /* ---------- F) correct feature icons ---------- */
    try {
        ZD_FEAT_ICONS.qc = '<path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/>';
        ZD_FEAT_ICONS.stats = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19V9m6 10V5m6 14v-8M3 21h18"/>';
        ZD_FEAT_ICONS.mentions = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7l1.5-1.5M10.2 13.8a4 4 0 010-5.7l3-3a4 4 0 115.6 5.7l-1.5 1.5"/>';
        ZD_FEAT_ICONS.replace = '<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>';
        ZD_FEAT_ICONS.lock = '<rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/>';
    } catch (e) {}
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 700);
})();     

    // New Code

    /* ============================================================
   V6.1 — CORRECTIONS
   1 Undo V6.0's global grid header → Home/Kanban/Eisenhower
     look exactly as before; Canvas + Templates now match them
   2 Ruler margins + Reset margins actually work (pointer events,
     no inline !important, mobile padding untouched)
   3 "More tools" horizontal scroll removed
   4 Linked/Unlinked mentions grouped inside the menu sections
   5 Rounding toned down (ruler, paper, toolbar, inputs, rows)
   6 Sidebar views-row: no gap, nothing shows behind, 2 tidy rows
============================================================ */
(function zd61() {
    if (window.__zd61) return; window.__zd61 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ============ 1) VIEW HEADERS — back to the original flex ============ */
    .zd-view-head{display:flex!important;grid-template-columns:none!important;
        align-items:center!important;justify-content:space-between!important;
        gap:8px;min-height:52px;height:auto;padding:0 12px!important;flex-wrap:nowrap;}
    #calendar-modal .zd-view-head{flex-wrap:wrap!important;padding:6px 10px!important;}
    #canvas-modal .zd-view-head,#templates-modal .zd-view-head{padding:0 12px!important;}
    .zd-view-head > span{min-width:0;}
    .zdvh-l,.zdvh-r{display:flex;align-items:center;gap:4px;flex-shrink:0;}
    .zdvh-mid{flex:0 1 auto;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;}
    .zdvh-title{font-size:14px;font-weight:600;color:var(--text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .zdvh-sub{display:none;font-size:10px;color:#9ca3af;font-weight:500;}
    @media (min-width:1024px){.zdvh-sub{display:block;}}
    .zdvh-b,.zd-help-b{width:28px!important;height:28px!important;border-radius:99px!important;
        display:inline-flex!important;align-items:center;justify-content:center;flex-shrink:0;
        color:#9ca3af;transition:color .15s ease,background .15s ease;}
    .zdvh-b svg,.zd-help-b svg{width:16px!important;height:16px!important;}
    .zdvh-b:hover,.zd-help-b:hover{color:rgb(var(--accent-rgb));background:rgb(var(--accent-rgb) / .12);}
    .zdvh-x{width:32px!important;height:32px!important;border-radius:99px!important;
        display:flex!important;align-items:center;justify-content:center;flex-shrink:0;
        font-size:20px;line-height:1;color:#9ca3af;transition:color .15s ease,background .15s ease;}
    .zdvh-x:hover{color:#d93025;background:rgba(217,48,37,.1);}
    .zdvh-x:active{transform:scale(.9);}
    /* tool row under Canvas / Templates */
    .zdvh-tools{display:flex!important;flex-wrap:wrap;align-items:center;gap:6px;width:100%;
        padding:8px 12px!important;background:var(--surface-color);border-bottom:1px solid var(--border-color);}
    .zdvh-tb,.zdvh-tools > button{flex:0 0 auto;padding:6px 12px;font-size:11px;font-weight:600;
        border-radius:8px;background:var(--bg-color);border:1px solid var(--border-color);
        color:var(--text-color);transition:border-color .15s ease,color .15s ease;white-space:nowrap;}
    .zdvh-tb:hover,.zdvh-tools > button:hover{border-color:rgb(var(--accent-rgb));color:rgb(var(--accent-rgb));}
    .zdvh-tb:active,.zdvh-tools > button:active{transform:scale(.97);}
    .zdvh-zoom{display:flex;align-items:center;gap:2px;padding:2px;border-radius:8px;
        background:var(--bg-color);border:1px solid var(--border-color);flex:0 0 auto;}
    .zdvh-zoom button{border:none!important;background:transparent!important;width:28px;height:24px;
        padding:0!important;border-radius:6px!important;font-size:13px;font-weight:700;color:var(--text-color);}
    .zdvh-zoom button:hover{color:rgb(var(--accent-rgb));background:rgba(127,127,127,.12)!important;}
    .zdvh-lbl{font-size:10px;color:#9ca3af;min-width:38px;text-align:center;font-variant-numeric:tabular-nums;}
    #canvas-status{font-size:10px!important;color:#9ca3af;margin-left:2px;}
    @media (max-width:900px){
      .zdvh-tools{padding:7px 10px!important;gap:5px;}
      .zdvh-tb,.zdvh-tools > button{padding:6px 10px;font-size:10.5px;}
      .zdvh-title{font-size:13px;}
    }

    /* ============ 3) MORE-TOOLS MENU — no horizontal scroll ============ */
    #more-menu{width:248px!important;overflow:hidden!important;padding:0!important;border-radius:12px!important;}
    #more-menu-scroll{max-height:min(64vh,470px);overflow-y:auto!important;overflow-x:hidden!important;
        padding:6px 0;overscroll-behavior:contain;}
    #more-menu .zd-mi{width:auto!important;margin:0 5px!important;border-radius:7px!important;
        padding:7px 10px!important;font-size:12.5px;box-sizing:border-box;}
    #more-menu .zd-mzoom{margin:0 5px;padding:6px 10px;}
    #more-menu .zd-mgroup{padding:8px 15px 3px;}

    /* ============ 5) ROUNDING — dialled back ============ */
    #ruler{border-radius:4px!important;}
    #ruler-wrap{border-radius:0!important;}
    #paper-container{border-radius:3px!important;}
    @media (max-width:850px){#paper-container{border-radius:0!important;}}
    @media (min-width:851px){ #toolbar.ql-toolbar{border-radius:24px!important;} }
    .zd-tool,#toolbar .ql-formats button{border-radius:5px!important;}
    .zd-size input{border-radius:5px!important;}
    .ql-editor img{border-radius:5px!important;}
    .ql-editor pre.ql-syntax{border-radius:6px!important;}
    .ql-editor blockquote{border-radius:0 3px 3px 0!important;}
    .ql-picker-options{border-radius:10px!important;}
    .ql-picker-label{border-radius:5px!important;}
    select,input[type=text],input[type=email],input[type=password],input[type=date],
    input[type=datetime-local],input[type=number],input[type=url],textarea{border-radius:8px;}
    button{border-radius:8px;}
    .gv-cta,.eis-chip,.zd-mtab,.accent-swatch{border-radius:99px!important;}
    .eis-check{border-radius:5px!important;}
    .doc-row{border-radius:7px!important;}
    .zd-view-btn{border-radius:9px!important;}
    .zd-stat,.cm-row,.eis-row,.zd44-row,.kb-card,.cv-card,.zd-mrow{border-radius:10px!important;}
    #cm-dir,#cm-sort,#cm-search{border-radius:8px!important;}
    .zd-cmodal-box{border-radius:14px!important;}
    #cm-box{border-radius:12px!important;}

    /* ============ 6) SIDEBAR VIEWS ROW — flush, opaque, 2 rows ============ */
    #views-row{position:sticky!important;top:0!important;z-index:35!important;
        margin:-0.75rem -0.75rem 10px!important;padding:0.75rem 0.75rem 9px!important;
        background:#1e1e1e;box-shadow:0 8px 10px -8px rgba(0,0,0,.55);}
    html:not(.dark) #views-row{background:#f7f2e7;box-shadow:0 8px 10px -8px rgba(120,100,60,.3);}
    #views-row > div{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;}
    #views-row .zd-view-btn{flex:none!important;min-width:0;padding:8px 2px;overflow:hidden;}
    #views-row .zd-view-btn svg{flex-shrink:0;}
    #views-row .zd-view-btn span{font-size:8.5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    </style>`);

    /* ============================================================
       1b) CANVAS + TEMPLATES — same three-part header as Home
    ============================================================ */
    const HELP_SVG = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.2 9.4A3 3 0 0112 7.6c1.7 0 3 1 3 2.3 0 1.1-1 2-2.3 2.2-.4.1-.7.4-.7.9m0 3h.01"/></svg>';

    function tidyToolView(cfg) {
        const m = document.getElementById(cfg.modal); if (!m) return;
        const head = m.querySelector('.zd-view-head'); if (!head) return;
        head.removeAttribute('style');                       /* drop V3.1 inline flex-wrap/padding */
        let row = head.nextElementSibling;
        row = (row && row.classList && row.classList.contains('zdvh-tools')) ? row : null;
        if (!row) return;                                    /* V6.0 didn't build it — nothing to tidy */
        if (row.dataset.zd61) { ensureTplShare(cfg, row); return; }
        row.dataset.zd61 = '1';

        /* rebuild the tool row cleanly, keeping the original nodes (handlers intact) */
        const find = (name) => Array.from(row.querySelectorAll('button'))
            .find(b => (b.getAttribute('onclick') || '').indexOf(name) === 0);
        const zo = cfg.zoom ? find(cfg.zoom[0]) : null;
        const zi = cfg.zoom ? find(cfg.zoom[1]) : null;
        const lbl = cfg.zoomLbl ? document.getElementById(cfg.zoomLbl) : null;
        const status = cfg.statusId ? document.getElementById(cfg.statusId) : null;
        const rest = (cfg.tools || []).map(find).filter(Boolean);
        const extras = Array.from(row.querySelectorAll('[data-tplshare]'));

        row.innerHTML = '';
        if (zo && zi) {
            const z = document.createElement('span'); z.className = 'zdvh-zoom';
            zo.className = ''; zi.className = '';
            z.appendChild(zo); if (lbl) { lbl.className = 'zdvh-lbl'; z.appendChild(lbl); } z.appendChild(zi);
            row.appendChild(z);
        }
        rest.forEach(b => { b.className = 'zdvh-tb'; row.appendChild(b); });
        extras.forEach(b => { b.className = 'zdvh-tb'; row.appendChild(b); });
        if (status) { status.className = ''; row.appendChild(status); }
        ensureTplShare(cfg, row);
    }

    /* V4.4's Share/Import injector can no longer find its old container — provide them here */
    function ensureTplShare(cfg, row) {
        if (cfg.modal !== 'templates-modal') return;
        if (row.querySelector('[data-tplshare]')) return;
        const mk = (label, title, fn) => {
            const b = document.createElement('button');
            b.className = 'zdvh-tb'; b.dataset.tplshare = '1';
            b.textContent = label; b.title = title; b.onclick = fn;
            return b;
        };
        row.appendChild(mk('Share ⬇', 'Export your templates as a file', async () => {
            try {
                const snap = await db.collection('users').doc(state.user.uid).collection('templates').get();
                const t = snap.docs.map(d => ({ name: d.data().name, content: d.data().content }));
                if (!t.length) { showToast('No templates to share yet.'); return; }
                downloadBlob(new Blob([JSON.stringify({ app: 'ZenDocs', templates: t })], { type: 'application/json' }), 'zendocs-templates.json');
                showToast('Template file downloaded.');
            } catch (e) { showToast('Export failed.'); }
        }));
        row.appendChild(mk('Import ⬆', 'Import a shared template file', () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.json';
            inp.onchange = async () => {
                try {
                    const data = JSON.parse(await inp.files[0].text());
                    if (!data || !Array.isArray(data.templates)) { showToast('Not a valid template file.'); return; }
                    for (const t of data.templates) {
                        await db.collection('users').doc(state.user.uid).collection('templates').add({
                            name: String(t.name || 'Shared template').slice(0, 100),
                            content: t.content || { ops: [] },
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    loadUserTemplates();
                    showToast('✓ Imported ' + data.templates.length + ' template(s).');
                } catch (e) { showToast('Import failed.'); }
            };
            inp.click();
        }));
    }

    const CANVAS_CFG = { modal: 'canvas-modal', statusId: 'canvas-status', zoomLbl: 'canvas-zoom-label',
        zoom: ['canvasZoom(0.85', 'canvasZoom(1.18'], tools: ['canvasFit', 'canvasAddText', 'canvasAddFrame', 'canvasAddNote'] };
    const TPL_CFG = { modal: 'templates-modal', tools: ['saveCurrentAsTemplate'] };

    function runTidy() { tidyToolView(CANVAS_CFG); tidyToolView(TPL_CFG); }
    ['openCanvas', 'openTemplates'].forEach(fn => {
        const o = window[fn]; if (typeof o !== 'function') return;
        window[fn] = function () { const r = o.apply(this, arguments); setTimeout(runTidy, 260); return r; };
    });
    setTimeout(runTidy, 1000);

    /* ============================================================
       2) RULER MARGINS — pointer-based, mobile-safe
    ============================================================ */
    function zd61Pad() {
        const ed = document.querySelector('.ql-editor'); if (!ed) return;
        ed.style.removeProperty('padding-left');
        ed.style.removeProperty('padding-right');
        if (window.innerWidth > 850) {                        /* mobile keeps its own 20px padding */
            ed.style.paddingLeft = state.marginL + 'px';
            ed.style.paddingRight = state.marginR + 'px';
        }
    }
    function zd61Handles() {
        const l = document.getElementById('hL'), r = document.getElementById('hR');
        const ml = document.getElementById('zd-mzL'), mr = document.getElementById('zd-mzR');
        if (l) l.style.left = (state.marginL - 7) + 'px';
        if (r) r.style.left = (794 - state.marginR - 7) + 'px';
        if (ml) ml.style.width = state.marginL + 'px';
        if (mr) mr.style.width = state.marginR + 'px';
    }
    window.buildRuler = function () {
        const el = document.getElementById('ruler'); if (!el) return;
        const W = 794, CM = 96 / 2.54;
        const dark = document.documentElement.classList.contains('dark');
        const tk = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)';
        const lc = dark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.45)';
        let h = '<div class="margin-zone" id="zd-mzL" style="left:0;width:' + state.marginL + 'px"></div>' +
                '<div class="margin-zone" id="zd-mzR" style="right:0;width:' + state.marginR + 'px"></div>';
        for (let cm = 0; cm <= W / CM; cm += 0.5) {
            const x = Math.round(cm * CM), maj = (cm % 1 === 0);
            h += '<div style="position:absolute;left:' + x + 'px;bottom:0;width:1px;height:' + (maj ? 10 : 6) + 'px;background:' + tk + ';pointer-events:none"></div>';
            if (maj && cm > 0 && x < W - 10)
                h += '<div style="position:absolute;left:' + (x + 2) + 'px;bottom:10px;font-size:8px;color:' + lc + ';pointer-events:none;line-height:1">' + cm + '</div>';
        }
        h += '<div class="handle" id="hL" style="left:' + (state.marginL - 7) + 'px;width:14px;touch-action:none" title="Drag to set the left margin"></div>';
        h += '<div class="handle" id="hR" style="left:' + (W - state.marginR - 7) + 'px;width:14px;touch-action:none" title="Drag to set the right margin"></div>';
        el.innerHTML = h;
        bind('hL', true); bind('hR', false);

        function bind(id, isLeft) {
            const g = document.getElementById(id); if (!g) return;
            g.addEventListener('pointerdown', (e) => {
                if (state.isGuest || !state.docId) return;
                e.preventDefault(); e.stopPropagation();
                const rect = el.getBoundingClientRect();
                const scale = (rect.width / 794) || 1;
                try { g.setPointerCapture(e.pointerId); } catch (err) {}
                const move = (ev) => {
                    const px = Math.round((ev.clientX - rect.left) / scale);
                    if (isLeft) state.marginL = Math.max(24, Math.min(400, px));
                    else state.marginR = Math.max(24, Math.min(400, 794 - px));
                    zd61Pad(); zd61Handles();          /* live — the ruler is NOT rebuilt mid-drag */
                };
                const up = () => {
                    g.removeEventListener('pointermove', move);
                    g.removeEventListener('pointerup', up);
                    g.removeEventListener('pointercancel', up);
                    if (state.docId && !state.isGuest) triggerSave();
                    showToast('Margins ' + Math.round(state.marginL) + ' / ' + Math.round(state.marginR) + ' px');
                };
                g.addEventListener('pointermove', move);
                g.addEventListener('pointerup', up);
                g.addEventListener('pointercancel', up);
            });
        }
    };
    window.applyMargins = function () { zd61Pad(); try { buildRuler(); } catch (e) {} };
    window.resetMargins = function () {
        state.marginL = 96; state.marginR = 96;
        applyMargins();
        if (state.docId && !state.isGuest) triggerSave();
        showToast('Margins reset to default.');
    };
    (function () {
        const rr = document.getElementById('ruler-reset');
        if (!rr) return;
        rr.removeAttribute('onclick');
        rr.style.cursor = 'pointer';
        rr.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); resetMargins(); });
    })();
    const _zd61Open = window.openDoc;
    window.openDoc = function (id, data) { const r = _zd61Open(id, data); setTimeout(() => { try { applyMargins(); } catch (e) {} }, 160); return r; };
    window.addEventListener('resize', () => { try { zd61Pad(); } catch (e) {} });
    setTimeout(() => { try { applyMargins(); } catch (e) {} }, 1500);

    /* ============================================================
       3+4) MORE-TOOLS: everything inside the scroll area, grouped
    ============================================================ */
    const MGROUPS = [
        ['Note tools', ['Local AI summary', 'Study mode', 'Read aloud', 'Quick capture', 'Linked & unlinked mentions', 'Reference panel']],
        ['History & safety', ['Version history', 'Trash', 'Lock this note', 'Backup & restore']],
        ['Organize & time', ['Deep Think map', 'Remind me…', 'Remind me\u2026', 'Focus timer', 'Writing stats & streak']],
        ['Share & import', ['Publish as webpage', 'Import notes (md/csv)']]
    ];
    function zd61Regroup() {
        const menu = document.getElementById('more-menu'); if (!menu) return;
        let scroll = document.getElementById('more-menu-scroll');
        if (!scroll) {
            scroll = document.createElement('div'); scroll.id = 'more-menu-scroll';
            while (menu.firstChild) scroll.appendChild(menu.firstChild);
            menu.appendChild(scroll);
        }
        /* anything injected straight into #more-menu goes back inside the scroller */
        Array.from(menu.children).forEach(el => { if (el !== scroll) scroll.appendChild(el); });

        const norm = s => (s || '').replace(/\s+/g, ' ').trim();
        const keep = ['zd50-file-group', 'zd50-mi-duplicateCurrentDoc', 'zd50-mi-openDownloadMenu']
            .map(i => document.getElementById(i)).filter(Boolean);
        const zoomRow = scroll.querySelector('.zd-mzoom');
        const pool = Array.from(scroll.children).filter(el => el.tagName === 'BUTTON' && keep.indexOf(el) < 0);

        scroll.innerHTML = '';
        const used = new Set();
        const add = (name, nodes) => {
            nodes = nodes.filter(Boolean); if (!nodes.length) return;
            const h = document.createElement('div'); h.className = 'zd-mgroup'; h.textContent = name;
            scroll.appendChild(h); nodes.forEach(n => scroll.appendChild(n));
        };
        if (zoomRow) add('View', [zoomRow]);
        MGROUPS.forEach(([name, labels]) => {
            const out = [];
            labels.forEach(l => pool.forEach(b => { if (!used.has(b) && norm(b.textContent) === norm(l)) { used.add(b); out.push(b); } }));
            add(name, out);
        });
        add('More', pool.filter(b => !used.has(b)));
        keep.forEach(n => scroll.appendChild(n));      /* V5.0's tablet File group stays intact */
        try { zd46TidyGroups(); } catch (e) {}
    }
    const _zd61Toggle = window.toggleMoreMenu;
    window.toggleMoreMenu = function () { try { zd61Regroup(); } catch (e) {} return _zd61Toggle.apply(this, arguments); };
    setTimeout(zd61Regroup, 1200);
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 1400);
})();    

    // New Code

    /* ============================================================
   V6.2 — THREE TARGETED FIXES
   1 Sidebar views row → exactly as it was before V6.1
   2 Templates "Your templates": name + ✏ / Use / 🗑 on ONE line
     (V6.0 forced the title to width:100%, pushing them below)
   3 Ruler margins actually work — CSS-variable driven, so nothing
     can override the padding, with document-level drag, a live
     px badge, and a numeric fallback popover
============================================================ */
(function zd62() {
    if (window.__zd62) return; window.__zd62 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ============ 1) VIEWS ROW — sticky, no bubble, full labels ============ */
    #views-row{position:sticky!important;top:0!important;z-index:20!important;
        margin:0 0 10px 0!important;padding:6px 0 8px 0!important;
        background:var(--sidebar-bg,#1e1e1e)!important;
        box-shadow:none!important;border-bottom:1px solid rgba(127,127,127,0.18)!important;}
    html:not(.dark) #views-row{background:var(--sidebar-bg,#f7f2e7)!important;}
    #views-row > div{display:flex!important;grid-template-columns:none!important;
        gap:0!important;align-items:stretch;}
    #views-row .zd-view-btn{flex:1 1 0!important;min-width:0;padding:6px 2px 5px!important;
        background:transparent!important;border:none!important;border-radius:0!important;
        box-shadow:none!important;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:3px;position:relative;}
    /* thin divider between each button */
    #views-row .zd-view-btn + .zd-view-btn::before{content:'';position:absolute;left:0;top:18%;
        height:64%;width:1px;background:rgba(127,127,127,0.22);border-radius:1px;}
    #views-row .zd-view-btn svg{width:18px!important;height:18px!important;flex-shrink:0;}
    #views-row .zd-view-btn span{font-size:8px!important;line-height:1.2;
        overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important;
        max-width:none!important;width:auto!important;}
    #views-row .zd-view-btn:hover{background:rgba(127,127,127,0.10)!important;border-radius:6px!important;}
    #views-row .zd-view-btn.active,#views-row .zd-view-btn[class*="bg-white"]{
        background:rgba(127,127,127,0.13)!important;border-radius:6px!important;}

    /* ============ 2) TEMPLATES — one row, never wrapping ============ */
    #tpl-user > div{display:flex!important;flex-wrap:nowrap!important;row-gap:0!important;
        align-items:center;gap:8px;}
    #tpl-user > div > span:first-child{width:auto!important;flex:1 1 auto;min-width:0;overflow:hidden;}
    #tpl-user > div > span:last-child{flex:0 0 auto!important;flex-wrap:nowrap;}
    @media (max-width:900px){
        #tpl-user > div{padding:8px 9px!important;gap:6px;}
        #tpl-user > div > span:first-child{font-size:11px;}
        #tpl-user .tpl-use{padding:4px 9px!important;font-size:9.5px!important;}
        #tpl-user .tpl-ren,#tpl-user .tpl-del{width:24px!important;height:24px!important;}
        #tpl-user .tpl-ren svg,#tpl-user .tpl-del svg{width:11px!important;height:11px!important;}
    }
    @media (max-width:380px){ #tpl-user > div > span:first-child svg{display:none;} }

    /* ============ 3) RULER MARGINS ============ */
    /* Variables win over every stylesheet rule, desktop only —
       mobile keeps its own 20px padding untouched. */
    @media (min-width:851px){
        #paper-container .ql-editor{
            padding-left:var(--zd-ml,96px)!important;
            padding-right:var(--zd-mr,96px)!important;}
    }
    #ruler{overflow:visible!important;cursor:default;}
    #ruler .handle{width:20px!important;margin-left:-3px;touch-action:none;z-index:9!important;
        display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;}
    #ruler .handle::after{width:3px!important;height:17px!important;border-radius:2px;
        background:rgb(var(--accent-rgb))!important;transition:height .12s ease;}
    #ruler .handle:hover::after,#ruler .handle.zd-drag::after{height:24px!important;filter:brightness(1.15);}
    #ruler .handle.zd-drag{cursor:ew-resize;}
    #zd-mbadge{position:fixed;z-index:150;display:none;padding:3px 8px;border-radius:6px;
        background:#111827;color:#fff;font-size:10px;font-weight:800;pointer-events:none;
        font-variant-numeric:tabular-nums;box-shadow:0 4px 12px rgba(0,0,0,.35);}
    #zd-mbadge.on{display:block;}
    #ruler-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;
        padding:2px 0 3px;font-size:9px;line-height:1;}
    #ruler-foot button{color:var(--text-color);opacity:.45;transition:opacity .15s ease,color .15s ease;
        background:transparent;border:none;padding:0;font-size:9px;cursor:pointer;}
    #ruler-foot button:hover{opacity:.9;color:rgb(var(--accent-rgb));}
    #zd-mpop{position:fixed;z-index:151;display:none;width:196px;padding:12px;
        background:var(--surface-color);border:1px solid var(--border-color);border-radius:12px;
        box-shadow:0 18px 44px rgba(0,0,0,.3);}
    #zd-mpop.on{display:block;animation:fadeIn .14s ease-out;}
    #zd-mpop input{width:100%;background:var(--bg-color);border:1px solid var(--border-color);
        border-radius:7px;padding:5px 8px;font-size:12px;color:var(--text-color);outline:none;
        caret-color:rgb(var(--accent-rgb));}
    #zd-mpop input:focus{border-color:rgb(var(--accent-rgb));}
    #zd-mpop .zd-mp-l{font-size:8.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
        color:#9ca3af;margin-bottom:3px;display:block;}
    .zd-mp-pre{padding:4px 0;font-size:10px;font-weight:700;border-radius:6px;
        background:var(--bg-color);border:1px solid var(--border-color);color:var(--text-color);}
    .zd-mp-pre:hover{border-color:rgb(var(--accent-rgb));color:rgb(var(--accent-rgb));}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="zd-mbadge"></div>
    <div id="zd-mpop">
        <div class="grid grid-cols-2 gap-2 mb-2.5">
            <span><span class="zd-mp-l">Left</span><input id="zd-mp-l" type="number" min="24" max="400" step="4"></span>
            <span><span class="zd-mp-l">Right</span><input id="zd-mp-r" type="number" min="24" max="400" step="4"></span>
        </div>
        <div class="grid grid-cols-3 gap-1.5 mb-2.5">
            <button class="zd-mp-pre" data-m="48">Narrow</button>
            <button class="zd-mp-pre" data-m="96">Normal</button>
            <button class="zd-mp-pre" data-m="144">Wide</button>
        </div>
        <button id="zd-mp-ok" class="w-full py-2 text-[11px] font-bold rounded-lg text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">Apply margins</button>
    </div>`);

    const W = 794, MIN = 24, MAXPAD = 400, MINTEXT = 120;
    const $ = id => document.getElementById(id);

    /* ---------- the single source of truth: CSS variables ---------- */
    function paintVars() {
        const r = document.documentElement.style;
        r.setProperty('--zd-ml', state.marginL + 'px');
        r.setProperty('--zd-mr', state.marginR + 'px');
        /* strip any leftover inline padding from earlier patches */
        const ed = document.querySelector('#paper-container .ql-editor');
        if (ed) { ed.style.removeProperty('padding-left'); ed.style.removeProperty('padding-right'); }
    }
    function clampPair(changedLeft) {
        state.marginL = Math.max(MIN, Math.min(MAXPAD, Math.round(state.marginL)));
        state.marginR = Math.max(MIN, Math.min(MAXPAD, Math.round(state.marginR)));
        if (W - state.marginL - state.marginR < MINTEXT) {
            if (changedLeft) state.marginL = W - state.marginR - MINTEXT;
            else state.marginR = W - state.marginL - MINTEXT;
        }
    }
    function paintHandles() {
        const l = $('hL'), r = $('hR'), zl = $('zd-mzL'), zr = $('zd-mzR');
        if (l) l.style.left = state.marginL + 'px';
        if (r) r.style.left = (W - state.marginR) + 'px';
        if (zl) zl.style.width = state.marginL + 'px';
        if (zr) zr.style.width = state.marginR + 'px';
    }
    function badge(show, x, y, txt) {
        const b = $('zd-mbadge');
        if (!show) { b.classList.remove('on'); return; }
        b.textContent = txt;
        b.style.left = Math.max(8, Math.min(x - 22, window.innerWidth - 70)) + 'px';
        b.style.top = Math.max(8, y - 34) + 'px';
        b.classList.add('on');
    }

    /* ---------- ruler markup + drag ---------- */
    window.buildRuler = function () {
        const el = $('ruler'); if (!el) return;
        const CM = 96 / 2.54;
        const dark = document.documentElement.classList.contains('dark');
        const tick = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)';
        const lab = dark ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.45)';
        let h = '<div class="margin-zone" id="zd-mzL" style="left:0;width:' + state.marginL + 'px"></div>'
              + '<div class="margin-zone" id="zd-mzR" style="right:0;width:' + state.marginR + 'px"></div>';
        for (let cm = 0; cm <= W / CM; cm += 0.5) {
            const x = Math.round(cm * CM), maj = (cm % 1 === 0);
            h += '<div style="position:absolute;left:' + x + 'px;bottom:0;width:1px;height:' + (maj ? 10 : 6) + 'px;background:' + tick + ';pointer-events:none"></div>';
            if (maj && cm > 0 && x < W - 10)
                h += '<div style="position:absolute;left:' + (x + 2) + 'px;bottom:10px;font-size:8px;color:' + lab + ';pointer-events:none;line-height:1">' + cm + '</div>';
        }
        h += '<div class="handle" id="hL" style="left:' + state.marginL + 'px" title="Drag to set the left margin"></div>'
           + '<div class="handle" id="hR" style="left:' + (W - state.marginR) + 'px" title="Drag to set the right margin"></div>';
        el.innerHTML = h;
        arm('hL', true); arm('hR', false);
    };

    function arm(id, isLeft) {
        const g = $(id); if (!g) return;
        const begin = (clientX, clientY, ev) => {
            if (state.isGuest || !state.docId) return;
            if (ev && ev.cancelable) ev.preventDefault();
            const el = $('ruler'); if (!el) return;
            const rect = el.getBoundingClientRect();
            const scale = (rect.width / W) || 1;
            g.classList.add('zd-drag');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ew-resize';

            const step = (cx, cy) => {
                const px = (cx - rect.left) / scale;
                if (isLeft) state.marginL = px; else state.marginR = W - px;
                clampPair(isLeft);
                paintVars(); paintHandles();
                badge(true, cx, cy, (isLeft ? 'L ' : 'R ') + Math.round(isLeft ? state.marginL : state.marginR) + 'px');
            };
            const pm = (e) => { if (e.cancelable) e.preventDefault(); step(e.clientX, e.clientY); };
            const tm = (e) => { const t = e.touches[0]; if (!t) return; if (e.cancelable) e.preventDefault(); step(t.clientX, t.clientY); };
            const end = () => {
                document.removeEventListener('pointermove', pm, true);
                document.removeEventListener('pointerup', end, true);
                document.removeEventListener('pointercancel', end, true);
                document.removeEventListener('mousemove', pm, true);
                document.removeEventListener('mouseup', end, true);
                document.removeEventListener('touchmove', tm, { capture: true });
                document.removeEventListener('touchend', end, true);
                g.classList.remove('zd-drag');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                badge(false);
                buildRuler();                                   /* redraw ticks once, at the end */
                if (state.docId && !state.isGuest) triggerSave();
                showToast('Margins · left ' + Math.round(state.marginL) + 'px · right ' + Math.round(state.marginR) + 'px');
            };
            if (window.PointerEvent) {
                document.addEventListener('pointermove', pm, true);
                document.addEventListener('pointerup', end, true);
                document.addEventListener('pointercancel', end, true);
            } else {
                document.addEventListener('mousemove', pm, true);
                document.addEventListener('mouseup', end, true);
                document.addEventListener('touchmove', tm, { capture: true, passive: false });
                document.addEventListener('touchend', end, true);
            }
            step(clientX, clientY);
        };
        g.addEventListener('pointerdown', (e) => begin(e.clientX, e.clientY, e));
        g.addEventListener('mousedown', (e) => { if (!window.PointerEvent) begin(e.clientX, e.clientY, e); });
        g.addEventListener('touchstart', (e) => {
            if (window.PointerEvent) return;
            const t = e.touches[0]; if (t) begin(t.clientX, t.clientY, e);
        }, { passive: false });
    }

    /* ---------- public API used by the rest of the app ---------- */
    window.applyMargins = function () { clampPair(true); paintVars(); try { buildRuler(); } catch (e) {} };
    window.resetMargins = function () {
        state.marginL = 96; state.marginR = 96;
        applyMargins();
        if (state.docId && !state.isGuest) triggerSave();
        showToast('Margins reset to default.');
    };

    /* ---------- footer: Set margins… + Reset margins ---------- */
    (function foot() {
        const rr = $('ruler-reset'); if (!rr) return;
        rr.removeAttribute('onclick');
        rr.id = 'ruler-foot';
        rr.className = '';
        rr.innerHTML = '<button id="zd-mset" title="Type exact margins">⇔ Set margins…</button>' +
                       '<button id="zd-mreset" title="Back to 96px on both sides">↺ Reset margins</button>';
        $('zd-mreset').onclick = (e) => { e.stopPropagation(); resetMargins(); };
        $('zd-mset').onclick = (e) => {
            e.stopPropagation();
            const pop = $('zd-mpop');
            if (pop.classList.contains('on')) { pop.classList.remove('on'); return; }
            $('zd-mp-l').value = Math.round(state.marginL);
            $('zd-mp-r').value = Math.round(state.marginR);
            const r = e.currentTarget.getBoundingClientRect();
            pop.style.left = Math.max(8, Math.min(r.right - 196, window.innerWidth - 204)) + 'px';
            pop.style.top = (r.bottom + 6) + 'px';
            pop.classList.add('on');
            setTimeout(() => { try { $('zd-mp-l').focus(); $('zd-mp-l').select(); zdArmProtect($('zd-mp-l')); } catch (x) {} }, 70);
        };
    })();
    $('zd-mp-ok').onclick = () => {
        const l = parseInt($('zd-mp-l').value, 10), r = parseInt($('zd-mp-r').value, 10);
        if (isNaN(l) || isNaN(r)) { showToast('Enter both margins in pixels.'); return; }
        state.marginL = l; state.marginR = r;
        applyMargins();
        if (state.docId && !state.isGuest) triggerSave();
        $('zd-mpop').classList.remove('on');
        showToast('Margins · left ' + Math.round(state.marginL) + 'px · right ' + Math.round(state.marginR) + 'px');
    };
    document.querySelectorAll('#zd-mpop .zd-mp-pre').forEach(b => {
        b.onclick = () => { $('zd-mp-l').value = b.dataset.m; $('zd-mp-r').value = b.dataset.m; };
    });
    ['zd-mp-l', 'zd-mp-r'].forEach(id => {
        const i = $(id);
        i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('zd-mp-ok').click(); } });
        ['focusin', 'input', 'pointerup'].forEach(ev => i.addEventListener(ev, () => { try { zdArmProtect(i); } catch (x) {} }));
    });
    document.addEventListener('click', (e) => {
        const p = $('zd-mpop');
        if (p.classList.contains('on') && !e.target.closest('#zd-mpop') && !e.target.closest('#zd-mset')) p.classList.remove('on');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && $('zd-mpop').classList.contains('on')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            $('zd-mpop').classList.remove('on');
        }
    }, true);

    /* ---------- keep the variables in sync on every note open ---------- */
    const _od = window.openDoc;
    window.openDoc = function (id, data) {
        const r = _od(id, data);
        setTimeout(() => { try { applyMargins(); } catch (e) {} }, 170);
        return r;
    };
    setTimeout(() => { try { applyMargins(); } catch (e) {} }, 1600);
})();    

    // New Code

    /* ============================================================
   V6.3a — READ-FIRST EDIT MODE (mobile + tablet)
   Notes open behind a soft accent-tinted veil with a floating
   ✎ pill. Tapping it plays a short unseal animation and enables
   editing. Re-arms after idle, note switch, reload or tab return.
============================================================ */
(function zd63a() {
    if (window.__zd63a) return; window.__zd63a = true;

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    // const ZD_IDLE_MS   = 5 * 60 * 1000;  // ⚙ IDLE TIMEOUT before the veil returns (5 min)
    const ZD_IDLE_MS   = 5 * 60 * 1000;  // ⚙ IDLE TIMEOUT — 5 minutes of NO interaction
                                         //    anywhere in the app before the veil returns.
                                         //    Switching notes, opening views, backgrounding
                                         //    the tab and returning all COUNT as activity.
    const ZD_ANIM_MS   = 620;            // ⚙ UNSEAL ANIMATION length in ms
    const ZD_MAX_WIDTH = 1180;           // ⚙ MAX SCREEN WIDTH where this applies (850 = phones only)
    const ZD_PILL_UP   = 132;            // ⚙ PILL HEIGHT above the bottom edge, in px.
                                         //    Fixed — it never moves when the toolbar switches
                                         //    position or when the focus timer appears.
    /* ─────────────────────────────────────────────────────────── */

    document.head.insertAdjacentHTML('beforeend', `<style>
    @media (max-width:${ZD_MAX_WIDTH}px){

      /* ---------- the read veil ---------- */
      body.zd-read #paper-container .ql-editor{
          filter:blur(1px) saturate(.97);opacity:.94;
          transition:filter ${ZD_ANIM_MS}ms cubic-bezier(.22,1,.36,1),opacity ${ZD_ANIM_MS}ms ease;}
      body.zd-read #paper-container{position:relative;}

      /* ⚙ ACCENT TINT — delete this whole rule for a plain, colourless veil */
      body.zd-read #paper-container::after{
          content:'';position:absolute;inset:0;z-index:8;pointer-events:none;
          background:linear-gradient(165deg,
              rgb(var(--accent-rgb) / .07) 0%,
              rgb(var(--accent-rgb) / .028) 38%,
              rgb(var(--accent-rgb) / .015) 62%,
              rgb(var(--accent-rgb) / .075) 100%);
          transition:opacity ${ZD_ANIM_MS}ms ease;}
      body.zd-unsealing #paper-container::after{opacity:0;}
      /* ⚙ END ACCENT TINT */

      body.zd-read #doc-title{filter:blur(1.1px) saturate(.97);opacity:.92;pointer-events:none;
          transition:filter ${ZD_ANIM_MS}ms cubic-bezier(.22,1,.36,1),opacity ${ZD_ANIM_MS}ms ease;}
      body.zd-read #save-status,body.zd-read #word-count{opacity:.5;
          transition:opacity ${ZD_ANIM_MS}ms ease;}

      /* ---------- sweep of light on unlock ---------- */
      #zd-sweep{position:absolute;left:0;right:0;top:0;height:150px;z-index:9;display:none;pointer-events:none;
          background:linear-gradient(180deg,transparent,rgb(var(--accent-rgb) / .16) 45%,rgb(var(--accent-rgb) / .32) 52%,rgb(var(--accent-rgb) / .16) 60%,transparent);
          filter:blur(1px);}
      #zd-sweep.go{display:block;animation:zdSweep ${ZD_ANIM_MS}ms cubic-bezier(.4,0,.2,1) forwards;}
      @keyframes zdSweep{0%{top:-150px;opacity:0}18%{opacity:1}100%{top:105%;opacity:0}}

      /* ---------- the edit pill: ONE fixed position, always ---------- */
      #zd-editpill{position:fixed;right:16px;z-index:36;display:none;align-items:center;gap:9px;
          bottom:calc(${ZD_PILL_UP}px + env(safe-area-inset-bottom,0px))!important;
          padding:0 6px 0 15px;height:44px;border-radius:99px;border:none;color:#fff;
          font-size:12.5px;font-weight:700;letter-spacing:.005em;
          background:linear-gradient(135deg,rgb(var(--accent-rgb)),rgb(var(--accent-rgb) / .82));
          box-shadow:0 8px 22px rgba(0,0,0,.3),0 2px 6px rgba(0,0,0,.18),
                     inset 0 1px 0 rgba(255,255,255,.24);
          transition:opacity .2s ease,filter .2s ease;}
      #zd-editpill.on{display:flex;animation:zdPillIn .5s cubic-bezier(.34,1.4,.5,1),
          zdPillHalo 3.4s cubic-bezier(.4,0,.6,1) 1s infinite;}
      @keyframes zdPillIn{0%{opacity:0;transform:translateY(22px) scale(.8)}
          60%{transform:translateY(-2px) scale(1.02)}100%{opacity:1;transform:none}}
      @keyframes zdPillHalo{0%,100%{box-shadow:0 8px 22px rgba(0,0,0,.3),0 2px 6px rgba(0,0,0,.18),
              inset 0 1px 0 rgba(255,255,255,.24),0 0 0 0 rgb(var(--accent-rgb) / .38)}
          55%{box-shadow:0 8px 22px rgba(0,0,0,.3),0 2px 6px rgba(0,0,0,.18),
              inset 0 1px 0 rgba(255,255,255,.24),0 0 0 13px rgb(var(--accent-rgb) / 0)}}
      #zd-editpill.go{animation:zdPillBurst ${ZD_ANIM_MS}ms cubic-bezier(.3,1.4,.5,1) forwards;}
      @keyframes zdPillBurst{
          0%{transform:none;opacity:1}
          22%{transform:scale(.84) rotate(-8deg)}
          48%{transform:scale(1.5) rotate(10deg);opacity:.92;box-shadow:0 0 0 26px rgb(var(--accent-rgb) / 0),0 12px 30px rgba(0,0,0,.3)}
          100%{transform:scale(.3) rotate(20deg) translateY(-14px);opacity:0}}
      #zd-editpill svg{width:16px;height:16px;flex-shrink:0;order:2;
          padding:7px;box-sizing:content-box;border-radius:99px;
          background:rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.22);}
      #zd-editpill span{order:1;}
      #zd-editpill:active{filter:brightness(1.08);}
      #zd-editpill.go svg{animation:zdQuill ${ZD_ANIM_MS}ms cubic-bezier(.22,1,.36,1);}
      @keyframes zdQuill{0%{transform:none}40%{transform:rotate(-28deg) translate(-3px,3px)}100%{transform:rotate(0)}}

      /* the pill blurs away with the note when the sidebar opens */
      body.zd-sb-open #zd-editpill,
      body.zd-sb-open #pomo-pill{opacity:.16;filter:blur(3px);pointer-events:none;}
      body.zd-sb-open #zd-readhint{display:none!important;}
      #more-menu{z-index:42!important;}
      #mobile-menu-dropdown{z-index:42!important;}

      .zd-ring{position:fixed;z-index:43;border-radius:99px;pointer-events:none;
          border:2px solid rgb(var(--accent-rgb) / .55);animation:zdRing ${ZD_ANIM_MS}ms cubic-bezier(.2,.8,.3,1) forwards;}
      @keyframes zdRing{0%{width:12px;height:12px;opacity:.9;transform:translate(-50%,-50%)}
                        100%{width:340px;height:340px;opacity:0;transform:translate(-50%,-50%)}}

      #zd-readhint{position:fixed;left:50%;transform:translateX(-50%) translateY(10px);z-index:45;
          bottom:calc(${ZD_PILL_UP + 52}px + env(safe-area-inset-bottom,0px));display:none;opacity:0;
          padding:7px 14px;border-radius:99px;background:rgba(17,24,39,.92);color:#fff;
          font-size:11px;font-weight:600;white-space:nowrap;pointer-events:none;
          transition:opacity .22s ease,transform .28s cubic-bezier(.22,1,.36,1);}
      #zd-readhint.on{display:block;opacity:1;transform:translateX(-50%) translateY(0);}
    }
    @media (min-width:${ZD_MAX_WIDTH + 1}px){ #zd-editpill,#zd-readhint,#zd-sweep{display:none!important;} }
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <button id="zd-editpill" title="Tap to start editing">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.3"><path stroke-linecap="round" stroke-linejoin="round" d="M16.9 4.4l2.7 2.7-11 11L5 19l.9-3.6 11-11z"/></svg>
        <span>Tap to edit</span>
    </button>
    <div id="zd-readhint">Reading mode — tap the pencil to edit</div>`);

    const paper = document.getElementById('paper-container');
    if (paper) paper.insertAdjacentHTML('beforeend', '<div id="zd-sweep"></div>');

    const pill = document.getElementById('zd-editpill');
    const hint = document.getElementById('zd-readhint');
    const isSmall = () => window.innerWidth <= ZD_MAX_WIDTH;
    let idleT = null, hintT = null, unsealing = false;

    function seal(reason) {
        if (!isSmall() || state.isGuest || !state.docId) return;
        if (unsealed && reason !== 'idle') return;   /* an active editing session is never re-veiled */
        if (document.body.classList.contains('zd-locked')) return;
        if (document.body.classList.contains('zen') || state.reading) return;
        if (document.body.classList.contains('zd-read')) return;
        document.body.classList.add('zd-read');
        try { quill.enable(false); } catch (e) {}
        try { quill.blur(); } catch (e) {}
        pill.classList.remove('go');
        pill.classList.add('on');
        // clearTimeout(idleT);
        // if (reason === 'idle') showToast('Paused editing after 5 minutes — tap the pencil to continue.', 3200);
        clearTimeout(idleT);
        unsealed = false;
        if (reason === 'idle') showToast('Paused after 5 quiet minutes — tap the pencil to carry on.', 3400);
    }
    function unseal() {
        if (unsealing || !document.body.classList.contains('zd-read')) return;
        unsealing = true;
        document.body.classList.add('zd-unsealing');
        const r = pill.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        [0, 110].forEach(d => setTimeout(() => {
            const ring = document.createElement('span');
            ring.className = 'zd-ring';
            ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
            document.body.appendChild(ring);
            setTimeout(() => ring.remove(), ZD_ANIM_MS + 60);
        }, d));
        pill.classList.add('go');
        const sw = document.getElementById('zd-sweep');
        if (sw) { sw.classList.remove('go'); void sw.offsetWidth; sw.classList.add('go'); }
        try { if (navigator.vibrate) navigator.vibrate([9, 40, 16]); } catch (e) {}
        setTimeout(() => {
            document.body.classList.remove('zd-read', 'zd-unsealing');
            pill.classList.remove('on', 'go');
            if (sw) sw.classList.remove('go');
            unsealing = false;
            // try { if (!state.reading) quill.enable(true); } catch (e) {}
            // try { quill.focus(); } catch (e) {}
            // armIdle();
            unsealed = true;
            try { if (!state.reading) quill.enable(true); } catch (e) {}
            try { quill.focus(); } catch (e) {}
            armIdle();
        }, ZD_ANIM_MS);
    }
    window.zdSealNote = seal; window.zdUnsealNote = unseal;
    // pill.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); unseal(); });

    // New Code
    
    pill.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); unseal(); });

    /* hide both pills whenever any dropdown/menu is open */
    function pillsOff() {
        pill.style.opacity = '0';
        pill.style.pointerEvents = 'none';
        const pp = document.getElementById('pomo-pill');
        if (pp) { pp.style.opacity = '0'; pp.style.pointerEvents = 'none'; }
    }
    function pillsOn() {
        pill.style.opacity = '';
        pill.style.pointerEvents = '';
        const pp = document.getElementById('pomo-pill');
        if (pp) { pp.style.opacity = ''; pp.style.pointerEvents = ''; }
    }
    /* watch every dropdown that can appear over the editor */
    const MENUS = ['more-menu', 'mobile-menu-dropdown', 'folder-menu', 'font-picker', 'color-picker'];
    MENUS.forEach(id => {
        const m = document.getElementById(id); if (!m) return;
        new MutationObserver(() => {
            const anyOpen = MENUS.some(mid => {
                const el = document.getElementById(mid);
                if (!el) return false;
                const s = el.style.display || getComputedStyle(el).display;
                const vis = el.style.visibility || getComputedStyle(el).visibility;
                return s !== 'none' && vis !== 'hidden' && el.classList.contains('open');
            });
            /* also check block-level visibility for menus that use display:block not .open */
            const moreVisible = (() => {
                const mm = document.getElementById('more-menu');
                if (!mm) return false;
                const r = mm.getBoundingClientRect();
                return r.width > 10 && r.height > 10;
            })();
            const mobVisible = (() => {
                const mm = document.getElementById('mobile-menu-dropdown');
                if (!mm) return false;
                const r = mm.getBoundingClientRect();
                return r.width > 10 && r.height > 10;
            })();
            if (anyOpen || moreVisible || mobVisible) pillsOff(); else pillsOn();
        }, { attributes: true, attributeFilter: ['class', 'style'], childList: true });
    });
    /* polling fallback — checks every 180ms, costs almost nothing */
    setInterval(() => {
        const mm = document.getElementById('more-menu');
        const mob = document.getElementById('mobile-menu-dropdown');
        const mmOpen = mm && mm.getBoundingClientRect().height > 10;
        const mobOpen = mob && mob.getBoundingClientRect().height > 10;
        if (mmOpen || mobOpen) pillsOff(); else pillsOn();
    }, 180);

    document.getElementById('editor-wrapper').addEventListener('pointerdown', (e) => {
        if (!document.body.classList.contains('zd-read')) return;
        if (document.body.classList.contains('zd-sb-open')) return;
        if (e.target.closest('#zd-editpill')) return;
        hint.classList.add('on');
        clearTimeout(hintT);
        hintT = setTimeout(() => hint.classList.remove('on'), 1900);
    }, true);


    /* Once you tap to edit, editing stays unlocked for the whole session.
       Only genuine inactivity re-arms the veil — not note switches, not
       opening a view, not backgrounding the app. */
    let unsealed = false;
    function armIdle() {
        clearTimeout(idleT);
        if (!isSmall() || state.isGuest || !unsealed) return;
        idleT = setTimeout(() => seal('idle'), ZD_IDLE_MS);
    }
    window.zdEditTouch = armIdle;
    /* any interaction anywhere in the app counts as being present */
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
        window.addEventListener(ev, () => { if (unsealed && !document.body.classList.contains('zd-read')) armIdle(); },
            { capture: true, passive: true }));
    quill.on('text-change', (d, o, src) => { if (src === 'user') armIdle(); });
    els.title.addEventListener('input', armIdle);

    /* ---------- creating a note is an intent to write: no veil, no pill ---------- */
    function startFresh() {
        if (!isSmall() || state.isGuest) return;
        unsealed = true;
        clearTimeout(idleT);
        document.body.classList.remove('zd-read', 'zd-unsealing');
        pill.classList.remove('on', 'go');
        try { if (!state.reading) quill.enable(true); } catch (e) {}
        try { els.title.readOnly = false; } catch (e) {}
        armIdle();
    }
    window.zdStartFresh = startFresh;
    /* ⚙ remove 'openDailyNote' from this list if you want the daily note veiled like any other */
    ['createNewDoc', 'openDailyNote', 'duplicateCurrentDoc', 'duplicateDocFromSidebar',
     'createFromTemplate', 'useTemplate', 'applyTemplate', 'newNoteFromTemplate'].forEach(fn => {
        const o = window[fn];
        if (typeof o !== 'function') return;
        window[fn] = function () {
            startFresh();
            const r = o.apply(this, arguments);
            [80, 320, 800].forEach(t => setTimeout(startFresh, t));   /* covers the async write + openDoc */
            return r;
        };
    }); 

    /* ---------- sidebar open state (so the pill blurs with the note) ---------- */
    (function watchSidebar() {
        const sb = document.getElementById('sidebar'); if (!sb) return;
        const sync = () => document.body.classList.toggle('zd-sb-open',
            isSmall() && sb.classList.contains('sidebar-open'));
        new MutationObserver(sync).observe(sb, { attributes: true, attributeFilter: ['class'] });
        sync();
    })();

    /* switching notes keeps your editing session — it does NOT re-lock */
    const _od = window.openDoc;
    window.openDoc = function (id, data) {
        const r = _od(id, data);
        if (unsealed) {
            document.body.classList.remove('zd-read', 'zd-unsealing');
            pill.classList.remove('on', 'go');
            try { if (!state.reading && !state.isGuest) quill.enable(true); } catch (e) {}
            armIdle();
        } else {
            clearTimeout(idleT);
            document.body.classList.remove('zd-read', 'zd-unsealing');
            pill.classList.remove('on', 'go');
            setTimeout(() => seal('open'), 220);
        }
        return r;
    };
    /* coming back to the tab counts as activity, never as a reason to lock */
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !isSmall()) return;
        if (unsealed) armIdle();
        else if (!state.docId) return;
    });
    window.addEventListener('resize', () => {
        if (!isSmall()) {
            clearTimeout(idleT);
            document.body.classList.remove('zd-read', 'zd-unsealing', 'zd-sb-open');
            pill.classList.remove('on', 'go');
            try { if (!state.reading && state.docId && !state.isGuest) quill.enable(true); } catch (e) {}
        }
    });
    ['toggleZenMode', 'toggleReadingMode'].forEach(fn => {
        const o = window[fn]; if (typeof o !== 'function') return;
        window[fn] = function () {
            document.body.classList.remove('zd-read', 'zd-unsealing');
            pill.classList.remove('on', 'go');
            clearTimeout(idleT);
            return o.apply(this, arguments);
        };
    });
    setTimeout(() => seal('boot'), 1800);
})();

     // New Code

     /* scroll a heading into view WITHOUT moving the page/header:
   only the editor's own scroll container is scrolled */
window.zdScrollToNode = function (node) {
    try {
        const scroller = document.getElementById('editor-wrapper');
        if (!scroller || !node) return;
        const sr = scroller.getBoundingClientRect();
        const nr = node.getBoundingClientRect();
        scroller.scrollTo({ top: scroller.scrollTop + (nr.top - sr.top) - 24, behavior: 'smooth' });
    } catch (e) {}
};   

     /* ============================================================
   V6.3b — QUICK CAPTURE: SVG only, no ⚡ emoji anywhere
============================================================ */
(function zd63b() {
    if (window.__zd63b) return; window.__zd63b = true;
    const QC_OLD = '⚡ Quick Capture', QC_NEW = 'Quick Capture';

    const _qc = window.qcSave;
    if (typeof _qc === 'function') {
        window.qcSave = async function () {
            const v = document.getElementById('qc-text').value.trim();
            if (!v) { showToast('Write something first.'); return; }
            const stamp = new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            try {
                const box = state.docs.find(d => {
                    const t = (d.title || '').trim();
                    return t === QC_NEW || t === QC_OLD || d.isQuickCapture;
                });
                if (box) {
                    const ops = ((box.content && box.content.ops) || [{ insert: '\n' }]).slice();
                    ops.push({ insert: stamp }, { insert: '\n', attributes: { header: 3 } }, { insert: v + '\n\n' });
                    const upd = { content: { ops }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                    if ((box.title || '').trim() !== QC_NEW) upd.title = QC_NEW;  /* migrate off the emoji title */
                    await db.collection('users').doc(state.user.uid).collection('docs').doc(box.id).update(upd);
                } else {
                    await db.collection('users').doc(state.user.uid).collection('docs').add({
                        title: QC_NEW, isQuickCapture: true, pinned: true,
                        content: { ops: [{ insert: QC_NEW }, { insert: '\n', attributes: { header: 1 } }, { insert: '#capture' }, { insert: '\n\n' }, { insert: stamp }, { insert: '\n', attributes: { header: 3 } }, { insert: v + '\n\n' }] },
                        isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                closeQuickCapture();
                showToast('Captured to your Quick Capture note.');
                try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
            } catch (e) { console.error(e); showToast('Capture failed.'); }
        };
    }

    function deEmoji() {
        document.querySelectorAll('#more-menu button, #mobile-menu-dropdown button, #feat-list .zd-frow span, #palette-results .palette-title').forEach(el => {
            el.childNodes.forEach(n => {
                if (n.nodeType === 3 && n.nodeValue.indexOf('⚡') >= 0)
                    n.nodeValue = n.nodeValue.replace(/⚡/g, '').replace(/\s{2,}/g, ' ').trimEnd();
            });
        });
        try { const f = ZD_FEATURES.find(x => x.id === 'qc'); if (f) f.label = 'Quick capture'; } catch (e) {}
        const ph = document.getElementById('qc-text');
        if (ph) ph.placeholder = 'Dump the thought — it lands in your Quick Capture note…';
        document.querySelectorAll('#doc-list .doc-row span span').forEach(s => {
            if (s.textContent.indexOf('⚡') >= 0) s.textContent = s.textContent.replace(/⚡\s*/g, '');
        });
    }
    const _rd = renderDocs;
    renderDocs = function () { const r = _rd.apply(this, arguments); setTimeout(deEmoji, 20); return r; };
    const _rf = window.renderFeatures;
    if (typeof _rf === 'function') window.renderFeatures = function () { const r = _rf.apply(this, arguments); setTimeout(deEmoji, 20); return r; };
    const _pp = window.paintPaletteResults;
    if (typeof _pp === 'function') window.paintPaletteResults = function () { const r = _pp.apply(this, arguments); setTimeout(deEmoji, 10); return r; };
    setTimeout(deEmoji, 1200);
})();

    /* ============================================================
   V6.3c — SIDEBAR HEADER SPACING
   Keeps the wordmark, the offline indicator and the three action
   buttons evenly spaced whether offline mode is on or off, and
   stops the new-note button touching the sidebar edge.
============================================================ */
(function zd63c() {
    if (window.__zd63c) return; window.__zd63c = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* the header row itself */
    #sidebar > div:first-child{
        padding:0 12px 0 14px!important;height:64px!important;gap:10px!important;
        display:flex!important;align-items:center!important;justify-content:space-between!important;}

    /* wordmark + offline indicator: shrink first, never push the buttons out */
    #sidebar > div:first-child > span:first-child{
        min-width:0;flex:1 1 auto;overflow:hidden;gap:6px!important;
        font-size:17px!important;letter-spacing:.01em;padding-left:0!important;}
    #offline-indicator{flex-shrink:0;width:14px!important;height:14px!important;}

    /* the three action buttons — fixed size, never squashed, clear of the edge */
    #sidebar > div:first-child > div{
        flex:0 0 auto!important;display:flex!important;align-items:center!important;
        gap:2px!important;margin-right:0!important;margin-left:auto!important;}
    #sidebar > div:first-child > div > button{
        width:31px!important;height:31px!important;flex-shrink:0!important;padding:0!important;}
    #sidebar > div:first-child > div > button svg{width:15px!important;height:15px!important;}
    #sidebar > div:first-child > div > button:last-child{width:32px!important;height:32px!important;}

    /* when offline mode is on the indicator appears — tighten the wordmark to compensate */
    

    /* very narrow sidebars (small phones) */
    @media (max-width:360px){
        #sidebar > div:first-child{padding:0 10px 0 12px!important;gap:6px!important;}
        #sidebar > div:first-child > span:first-child{font-size:15px!important;}
        #sidebar > div:first-child > div > button{width:29px!important;height:29px!important;}
    }
    </style>`);

    /* mirror offline state onto <body> so the CSS above can react */
    function syncOffline() {
        document.body.classList.toggle('zd-offline', !!state.offlineMode);
    }
    const _to = window.toggleOfflineMode;
    if (typeof _to === 'function') {
        window.toggleOfflineMode = async function () {
            const r = await _to.apply(this, arguments);
            setTimeout(syncOffline, 30);
            return r;
        };
    }
    const _uo = window.updateOfflineUI;
    if (typeof _uo === 'function') {
        window.updateOfflineUI = function () { const r = _uo.apply(this, arguments); syncOffline(); return r; };
    }
    /* safety net: the indicator's own visibility is the source of truth */
    (function watchIndicator() {
        const ind = document.getElementById('offline-indicator'); if (!ind) return;
        const sync = () => document.body.classList.toggle('zd-offline', !ind.classList.contains('hidden'));
        new MutationObserver(sync).observe(ind, { attributes: true, attributeFilter: ['class'] });
        sync();
    })();
    setTimeout(syncOffline, 800);
})();

     /* ============================================================
   V6.3d — HELP & GUIDE: full, accurate keyboard shortcuts
============================================================ */
(function zd63d() {
    if (window.__zd63d) return; window.__zd63d = true;
    setTimeout(() => {
        const scroll = document.querySelector('#help-modal .overflow-y-auto');
        if (!scroll || scroll.dataset.zd63d) return;
        scroll.dataset.zd63d = '1';
        Array.from(scroll.querySelectorAll('section')).forEach(s => {
            const h = s.querySelector('h4');
            if (h && /shortcut/i.test(h.textContent)) s.remove();
        });
        const K = k => '<kbd style="display:inline-block;padding:1px 6px;border-radius:5px;border:1px solid var(--border-color);background:var(--bg-color);font:700 10.5px ui-monospace,monospace;color:var(--text-color);white-space:nowrap">' + k + '</kbd>';
        const rows = [
            ['Notes & navigation', [
                [K('Ctrl') + ' + ' + K('K'), 'Search notes <b>and run actions</b> — type “lock”, “matrix”, “stats”, “trash”…'],
                [K('Alt') + ' + ' + K('N'), 'Quick capture — dump a thought into your Quick Capture note'],
                [K('Alt') + ' + ' + K('←'), 'Recently-viewed notes jump list'],
                [K('Ctrl') + ' + ' + K('G'), 'Graph view'],
                [K('Alt') + ' + ' + K('R'), 'Reference panel — a second note beside the editor']
            ]],
            ['Writing', [
                [K('Ctrl') + ' + ' + K('Z'), 'Undo'],
                [K('Ctrl') + ' + ' + K('Y') + ' / ' + K('Ctrl') + '+' + K('⇧') + '+' + K('Z'), 'Redo'],
                [K('Ctrl') + ' + ' + K('B') + ' · ' + K('I') + ' · ' + K('U'), 'Bold · italic · underline'],
                [K('Ctrl') + ' + ' + K('S'), 'Save now (or reconnect when offline)'],
                [K('/'), 'Slash menu — headings, lists, checklist, quote, code, date, time'],
                [K('[[') + ' · ' + K('#'), 'Link another note · tag autocomplete'],
                [K('↑') + ' ' + K('↓') + ' · ' + K('↵') + '/' + K('Tab'), 'Move through any popup · insert the highlighted item']
            ]],
            ['Reading & focus', [
                [K('Ctrl') + ' + ' + K('E'), 'Reading mode'],
                [K('Ctrl') + ' + ' + K('.'), 'Zen focus mode'],
                ['<b>Tap ✎</b>', 'On phones &amp; tablets notes open protected — tap the pencil pill to edit. It returns after 5 idle minutes or a reload.']
            ]],
            ['Everywhere', [
                [K('Esc'), 'Closes the topmost layer — dialog, then panel, then view'],
                [K('Ctrl') + ' + ' + K('Click'), 'Open a [[link]] or #tag directly'],
                ['<b>Double-click</b>', 'Canvas: new card · folder tile: rename · image: full-screen viewer']
            ]]
        ];
        const sec = document.createElement('section');
        sec.innerHTML = '<h4 class="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><path stroke-linecap="round" d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg> Keyboard shortcuts</h4>' +
            rows.map(([g, items]) =>
                '<div class="text-[10px] font-bold uppercase tracking-wider text-muted mt-3 mb-1.5">' + g + '</div>' +
                '<table style="width:100%;border-collapse:collapse"><tbody>' +
                items.map(([k, d]) => '<tr><td style="padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top">' + k + '</td><td style="padding:3px 0;font-size:12px;line-height:1.5">' + d + '</td></tr>').join('') +
                '</tbody></table>').join('') +
            '<p class="text-[10.5px] text-muted mt-3 leading-snug">On macOS use <b>⌘</b> wherever <b>Ctrl</b> is shown. Any feature switched off in <b>Features on this device</b> keeps its shortcut disabled too.</p>';
        scroll.appendChild(sec);
    }, 1400);
})();   

    // New Code

    /* ============================================================
   V7.1 — CONNECTIONS: automatic linking + automatic tags
   Replaces the Linked/Unlinked mentions panel. Detects every note
   whose title appears in the open note and links them in one tap
   (or automatically, if you switch that on). Suggests tags from
   term frequency + co-occurrence across your vault.
============================================================ */
(function zd71() {
    if (window.__zd71) return; window.__zd71 = true;

    /* ⚙ AUTO-LINK defaults OFF: silently rewriting note text is risky, so
       the toggle inside the panel opts you in. Change to true to default on. */
    const AUTO_DEFAULT = false;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #conn-modal{z-index:128;}
    .cn-row{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px 10px;
        border-radius:10px;border:1px solid var(--border-color);background:var(--bg-color);
        margin-bottom:6px;transition:border-color .15s ease,transform .15s ease;}
    .cn-row:hover{border-color:rgb(var(--accent-rgb) / .55);transform:translateX(2px);}
    .cn-ctx{font-size:9.5px;color:#9ca3af;line-height:1.45;}
    .cn-ctx mark{background:rgb(var(--accent-rgb) / .2);color:rgb(var(--accent-rgb));
        border-radius:3px;padding:0 2px;font-weight:700;}
    .cn-go{flex-shrink:0;padding:5px 11px;border-radius:8px;font-size:10px;font-weight:800;
        color:#fff;background-image:var(--zd-grad);}
    .cn-go:active{transform:scale(.95);}
    .cn-tag{padding:5px 11px;border-radius:99px;font-size:11px;font-weight:700;
        background:rgb(var(--accent-rgb) / .11);color:rgb(var(--accent-rgb));
        border:1px solid rgb(var(--accent-rgb) / .22);transition:all .15s ease;}
    .cn-tag:hover{background:rgb(var(--accent-rgb) / .2);}
    .cn-tag.used{opacity:.35;pointer-events:none;}
    .cn-hd{font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
        color:#9ca3af;display:flex;align-items:center;gap:7px;margin:14px 0 8px;}
    .cn-hd::after{content:'';flex:1;height:1px;background:var(--border-color);opacity:.7;}
    .cn-hd:first-child{margin-top:0;}
    .cn-sw{width:36px;height:20px;border-radius:99px;background:rgba(127,127,127,.34);
        position:relative;flex-shrink:0;transition:background .2s ease;}
    .cn-sw.on{background-image:var(--zd-grad);}
    .cn-sw i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:99px;
        background:#fff;transition:transform .2s ease;box-shadow:0 1px 3px rgba(0,0,0,.35);}
    .cn-sw.on i{transform:translateX(16px);}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="conn-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-md flex flex-col" style="max-height:84vh">
      <div class="flex items-center justify-between mb-1 flex-shrink-0">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7l1.5-1.5M10.2 13.8a4 4 0 010-5.7l3-3a4 4 0 115.6 5.7l-1.5 1.5"/></svg> Connections</h3>
        <button onclick="closeConnections()" class="zdvh-x">×</button>
      </div>
      <div id="cn-note" class="text-[10.5px] text-muted truncate mb-3 flex-shrink-0"></div>
      <div id="cn-body" class="flex-1 min-h-0 overflow-y-auto zd-scroll pr-1"></div>
      <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border flex-shrink-0">
        <span class="text-[10.5px] text-text leading-snug">Link &amp; tag automatically<br><span class="text-[9px] text-muted">Applies on save, in every note · syncs to all your devices</span></span>
        <button id="cn-auto" class="cn-sw"><i></i></button>
      </div>
    </div></div>`);

    const $ = id => document.getElementById(id);
    // New Code
    let _autoCache = null;
    const autoOn = () => {
        if (_autoCache !== null) return _autoCache;
        return (localStorage.getItem('zdAutoLink') ?? (AUTO_DEFAULT ? '1' : '0')) === '1';
    };
    /* cloud sync: the setting lives in users/{uid}/settings/prefs and a
       realtime listener mirrors changes to every logged-in device */
    function prefsRef() { return db.collection('users').doc(state.user.uid).collection('settings').doc('prefs'); }
    let _prefsArmed = false;
    function armPrefs() {
        if (_prefsArmed || state.isGuest || !state.user) return;
        _prefsArmed = true;
        prefsRef().onSnapshot(snap => {
            if (!snap.exists) return;
            const v = !!snap.data().autoLink;
            const was = _autoCache;
            _autoCache = v;
            localStorage.setItem('zdAutoLink', v ? '1' : '0');
            const sw = document.getElementById('cn-auto');
            if (sw) sw.classList.toggle('on', v);
            if (was !== null && was !== v) showToast(v ? 'Auto-connect turned on from another device.' : 'Auto-connect turned off from another device.');
        }, () => {});
    }
    setTimeout(armPrefs, 2500);
    setInterval(() => { if (!_prefsArmed) armPrefs(); }, 4000);
    const STOP = new Set('the a an and or but if of to in on for with at by from as is are was were be been it its this that these those i you he she we they not no do does did can could will would should may might must have has had about into over under again more most some such only own same so than too very just also there here when where why how what which who while during before after above below up down out off all any both each few other new note notes untitled document'.split(' '));

    /* ---------- candidate links: other note titles appearing in this note ---------- */
    function findLinks(doc) {
        const text = docPlainText(doc);
        const low = text.toLowerCase();
        const out = [];
        state.docs.forEach(d => {
            if (d.id === doc.id) return;
            const t = (d.title || '').trim();
            if (t.length < 4) return;                       /* too short = false positives */
            if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return;      /* skip daily-note titles */
            if (d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id))) return;
            const tl = t.toLowerCase();
            const at = low.indexOf(tl);
            if (at < 0) return;
            /* already wrapped as [[Title]]? then it's connected, skip */
            if (new RegExp('\\[\\[\\s*' + escapeRegExp(t) + '\\s*\\]\\]', 'i').test(text)) return;
            /* must be a whole-word match */
            const before = at > 0 ? low[at - 1] : ' ';
            const after = low[at + tl.length] || ' ';
            if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) return;
            const s = Math.max(0, at - 34);
            const ctx = (s > 0 ? '…' : '') + text.slice(s, at) +
                        '\u0001' + text.slice(at, at + t.length) + '\u0002' +
                        text.slice(at + t.length, at + t.length + 42).replace(/\n/g, ' ') + '…';
            out.push({ doc: d, title: t, index: at, ctx: ctx });
        });
        return out.sort((a, b) => a.index - b.index).slice(0, 25);
    }

    /* ---------- tag suggestions: frequency + co-occurrence with your vault ---------- */
    function findTags(doc) {
        const text = docPlainText(doc);
        const words = (text.toLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) || []).filter(w => !STOP.has(w));
        if (words.length < 12) return [];
        const tf = {};
        words.forEach(w => tf[w] = (tf[w] || 0) + 1);
        /* how many other notes use each word — a word used in a few notes makes a better tag
           than one used in every note or only here */
        const df = {};
        Object.keys(tf).forEach(w => {
            let n = 0;
            state.docs.forEach(d => { if (d.id !== doc.id && docPlainText(d).toLowerCase().indexOf(w) >= 0) n++; });
            df[w] = n;
        });
        const have = docTags(doc);
        const existing = new Set();
        state.docs.forEach(d => docTags(d).forEach(t => existing.add(t)));
        return Object.keys(tf)
            .filter(w => tf[w] >= 2 && have.indexOf(w) < 0)
            .map(w => ({ w: w, s: tf[w] * (existing.has(w) ? 2.4 : 1) * (1 + Math.min(df[w], 6) * 0.28) }))
            .sort((a, b) => b.s - a.s).slice(0, 7).map(x => x.w);
    }

    /* ---------- apply ---------- */
    function linkOne(title) {
        const text = quill.getText();
        const at = text.toLowerCase().indexOf(title.toLowerCase());
        if (at < 0) { showToast('That mention is no longer in this note.'); return false; }
        quill.insertText(at + title.length, ']]', 'user');
        quill.insertText(at, '[[', 'user');
        return true;
    }
    window.cnLinkOne = (title) => {
        if (linkOne(title)) {
            try { scanInlineTokens(true); } catch (e) {}
            showToast('Linked to “' + title + '”.');
            setTimeout(renderConn, 260);
        }
    };
    window.cnLinkAll = () => {
        const doc = state.docs.find(d => d.id === state.docId); if (!doc) return;
        const hits = findLinks(doc);
        if (!hits.length) return;
        /* apply from the END backwards so earlier indexes stay valid */
        let n = 0;
        hits.slice().sort((a, b) => b.index - a.index).forEach(h => { if (linkOne(h.title)) n++; });
        try { scanInlineTokens(true); } catch (e) {}
        showToast('Connected ' + n + ' note' + (n === 1 ? '' : 's') + '.');
        setTimeout(renderConn, 300);
    };
    window.cnAddTag = (t) => {
        const len = quill.getLength();
        const tail = quill.getText(Math.max(0, len - 2), 2);
        quill.insertText(len - 1, (tail.indexOf('\n') >= 0 ? '' : '\n') + '#' + t + ' ', 'user');
        try { scanInlineTokens(true); } catch (e) {}
        showToast('#' + t + ' added.');
        setTimeout(renderConn, 240);
    };

    /* ---------- panel ---------- */
    window.openConnections = () => {
        if (state.isGuest || !state.docId) { showToast('Open a note first.'); return; }
        $('conn-modal').classList.add('open');
        renderConn();
    };
    window.closeConnections = () => $('conn-modal').classList.remove('open');
    function renderConn() {
        const doc = state.docs.find(d => d.id === state.docId); if (!doc) return;
        $('cn-note').textContent = 'For “' + (doc.title || 'Untitled') + '”';
        $('cn-auto').classList.toggle('on', autoOn());
        const body = $('cn-body');
        const links = findLinks(doc);
        const tags = findTags(doc);
        const title = (doc.title || '').trim();
        const back = title ? state.docs.filter(d => d.id !== doc.id &&
            new RegExp('\\[\\[\\s*' + escapeRegExp(title) + '\\s*\\]\\]', 'i').test(docPlainText(d))) : [];

        let h = '';
        h += '<div class="cn-hd">Ready to connect' + (links.length ? ' <span style="color:rgb(var(--accent-rgb));font-size:9px">' + links.length + '</span>' : '') + '</div>';
        if (!links.length) {
            h += '<div class="text-center text-muted text-[11px] py-4 leading-relaxed">Nothing new to connect.<br>Mention another note’s title and it appears here.</div>';
        } else {
            h += '<button onclick="cnLinkAll()" class="w-full py-2.5 mb-2.5 text-[11.5px] font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">Connect all ' + links.length + ' automatically</button>';
            links.forEach(l => {
                const ctx = escapeHtml(l.ctx).replace('\u0001', '<mark>').replace('\u0002', '</mark>');
                h += '<div class="cn-row"><span class="min-w-0 flex-1">' +
                     '<span class="block text-xs font-semibold text-text truncate">' + escapeHtml(l.title) + '</span>' +
                     '<span class="cn-ctx block truncate">' + ctx + '</span></span>' +
                     '<button class="cn-go" onclick="cnLinkOne(' + JSON.stringify(l.title).replace(/"/g, '&quot;') + ')">Link</button></div>';
            });
        }

        h += '<div class="cn-hd">Suggested tags</div>';
        h += tags.length
            ? '<div class="flex flex-wrap gap-1.5">' + tags.map(t =>
                '<button class="cn-tag" onclick="cnAddTag(\'' + t + '\')">+ #' + escapeHtml(t) + '</button>').join('') + '</div>'
            : '<div class="text-muted text-[11px] py-2">Write a little more — tags are drawn from repeated terms.</div>';

        h += '<div class="cn-hd">Notes linking here' + (back.length ? ' <span style="color:rgb(var(--accent-rgb));font-size:9px">' + back.length + '</span>' : '') + '</div>';
        h += back.length
            ? back.map(d => '<button class="cn-row" onclick="closeConnections();openDoc(\'' + d.id + '\',state.docs.find(x=>x.id===\'' + d.id + '\'))">' +
                '<span class="text-accent flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7"/></svg></span>' +
                '<span class="text-xs font-medium text-text truncate flex-1">' + escapeHtml(d.title || 'Untitled') + '</span></button>').join('')
            : '<div class="text-muted text-[11px] py-2">Nothing links here yet — it will appear the moment another note mentions this title.</div>';

        body.innerHTML = h;
    }
    $('cn-auto').onclick = () => {
        const next = !autoOn();
        _autoCache = next;
        localStorage.setItem('zdAutoLink', next ? '1' : '0');
        $('cn-auto').classList.toggle('on', next);
        try { prefsRef().set({ autoLink: next }, { merge: true }); } catch (e) {}
        showToast(next ? 'Auto-connect on — synced to all your devices.' : 'Auto-connect off — synced to all your devices.');
    };
    $('conn-modal').addEventListener('click', e => { if (e.target.id === 'conn-modal') closeConnections(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && $('conn-modal').classList.contains('open')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            closeConnections();
        }
    }, true);

    /* ---------- automatic mode: applied quietly after each save ---------- */
    let autoBusy = false;
    const _sd = window.saveToDb;
    window.saveToDb = async function () {
        const r = await _sd.apply(this, arguments);
        if (!autoOn() || autoBusy || state.isGuest || !state.docId) return r;
        if (document.body.classList.contains('zd-read') || document.body.classList.contains('zd-locked')) return r;
        autoBusy = true;
        setTimeout(() => {
            try {
                const doc = state.docs.find(d => d.id === state.docId);
                if (doc) {
                    const hits = findLinks(doc);
                    if (hits.length) {
                        let n = 0;
                        hits.slice().sort((a, b) => b.index - a.index).forEach(h => { if (linkOne(h.title)) n++; });
                        if (n) { scanInlineTokens(true); showToast('Auto-connected ' + n + ' note' + (n === 1 ? '' : 's') + '.'); }
                    }
                }
            } catch (e) {}
            autoBusy = false;
        }, 700);
        return r;
    };

    /* ---------- retire the old mentions entry ---------- */
    document.querySelectorAll('[data-zdfn="mentions"]').forEach(el => el.remove());
    const mm = $('ment-modal'); if (mm) mm.remove();
    try { const i = ZD_FEATURES.findIndex(f => f.id === 'mentions'); if (i >= 0) ZD_FEATURES.splice(i, 1); } catch (e) {}
    document.querySelectorAll('#comments-panel .zd-mentions-old').forEach(el => el.remove());

    try {
        zdMenuInject2('conn', 'openConnections', 'Connections', '<path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7l1.5-1.5M10.2 13.8a4 4 0 010-5.7l3-3a4 4 0 115.6 5.7l-1.5 1.5"/>');
        ZD_FEATURES.push({ id: 'conn', label: 'Connections (auto-link & tags)', fns: ['openConnections'] });
        ZD_FEAT_ICONS.conn = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7l1.5-1.5M10.2 13.8a4 4 0 010-5.7l3-3a4 4 0 115.6 5.7l-1.5 1.5"/>';
    } catch (e) {}
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 600);
})();

    // New Code

