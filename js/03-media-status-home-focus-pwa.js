// ZenDocs — 03-media-status-home-focus-pwa.js
// V3.7 smart image insert, V3.6 status bar / home dashboard / offline-save reminder, V3.5 pinned notes & selection stats, V3.4 collapsible sidebar sections & accent themes, V3.8 focus shield / viewers / study mode, V3.9 PWA install & feature switches, V4.0 app downloads.
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
       V3.7 — SMART IMAGE INSERT
       The toolbar image button now compresses photos client-side
       (max 1000px, JPEG) before embedding, so notes stay small and
       safely inside Firestore's 1 MB document limit.
    ============================================================ */
    (function () {
        const tb = quill.getModule('toolbar');
        if (!tb) return;
        tb.addHandler('image', () => {
            if (state.reading) return;
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = () => {
                const file = inp.files && inp.files[0];
                if (!file) return;
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    const MAX = 1000;
                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                    const c = document.createElement('canvas');
                    c.width = Math.round(img.width * scale);
                    c.height = Math.round(img.height * scale);
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    let data = c.toDataURL('image/jpeg', 0.85);
                    if (data.length > 400000) data = c.toDataURL('image/jpeg', 0.6);
                    if (data.length > 700000) { showToast('Image too large even after compression — please use a smaller one.'); return; }
                    const range = quill.getSelection(true);
                    quill.insertEmbed(range ? range.index : quill.getLength(), 'image', data, 'user');
                    showToast('Image inserted (compressed for fast sync).');
                };
                img.onerror = () => { URL.revokeObjectURL(url); showToast('Could not read that image.'); };
                img.src = url;
            };
            inp.click();
        });
    })();

    /* ============================================================
       V3.6 — CONTEXTUAL STATUS BAR & NOTION-STYLE BLOCK MOVER
    ============================================================ */
    /* status: typing speed, flow time, checklist completion */
    var flow = { chars: [], flowStart: null, lastKey: 0 };
    quill.on('text-change', (delta, oldD, source) => {
        if (source !== 'user') return;
        const now = Date.now();
        let added = 0;
        (delta.ops || []).forEach(op => { if (typeof op.insert === 'string') added += op.insert.length; });
        if (added > 0) flow.chars.push({ t: now, n: added });
        if (now - flow.lastKey > 25000) flow.flowStart = now; /* gap breaks the flow */
        if (!flow.flowStart) flow.flowStart = now;
        flow.lastKey = now;
    });
    setInterval(() => {
        const el = document.getElementById('flow-stats');
        if (!el || !state.docId || state.isGuest) { if (el) el.textContent = ''; return; }
        const now = Date.now();
        flow.chars = flow.chars.filter(c => now - c.t < 60000);
        const wpm = Math.round(flow.chars.reduce((s, c) => s + c.n, 0) / 5);
        const inFlow = flow.flowStart && (now - flow.lastKey < 25000);
        const flowMin = inFlow ? Math.floor((now - flow.flowStart) / 60000) : 0;
        let checked = 0, unchecked = 0;
        (quill.getContents().ops || []).forEach(op => {
            if (op.attributes && op.attributes.list === 'checked') checked++;
            if (op.attributes && op.attributes.list === 'unchecked') unchecked++;
        });
        const bits = [];
        if (wpm > 0) bits.push(wpm + ' wpm');
        if (flowMin > 0) bits.push(flowMin + 'm flow');
        if (checked + unchecked > 0) bits.push(Math.round(checked / (checked + unchecked) * 100) + '% tasks done');
        el.textContent = bits.length ? '· ' + bits.join(' · ') : '';
    }, 5000);

    /* Notion-style block handle (desktop): hover a paragraph/heading/list item,
       use the ↕ handle to move that block up or down. Uses source 'user',
       so undo, autosave and the token scan all behave normally. */
    let _bhBlot = null, _bhEl = null;
    const blockHandle = document.createElement('div');
    blockHandle.id = 'block-handle';
    blockHandle.className = 'hidden fixed z-40 flex-col rounded-lg border border-border bg-surface shadow-md overflow-hidden';
    blockHandle.innerHTML = `
        <button data-bh="-1" title="Move block up" class="w-5 h-5 flex items-center justify-center text-muted hover:text-accent hover:bg-bg transition text-[9px] leading-none">▲</button>
        <button data-bh="1" title="Move block down" class="w-5 h-5 flex items-center justify-center text-muted hover:text-accent hover:bg-bg transition text-[9px] leading-none">▼</button>`;
    document.body.appendChild(blockHandle);
    function moveBlock(dir) {
        if (!_bhBlot || state.reading || state.isGuest) return;
        const lines = quill.getLines(0, quill.getLength());
        const li = lines.indexOf(_bhBlot);
        if (li < 0) return;
        const ti = li + dir;
        if (ti < 0 || ti >= lines.length) return;
        const first = lines[Math.min(li, ti)], second = lines[Math.max(li, ti)];
        const aIdx = quill.getIndex(first), aLen = first.length();
        const bLen = second.length();
        const dA = quill.getContents(aIdx, aLen);
        const dB = quill.getContents(aIdx + aLen, bLen);
        const Delta = Quill.import('delta');
        const d = new Delta().retain(aIdx);
        (dB.ops || []).forEach(op => d.push(op));
        (dA.ops || []).forEach(op => d.push(op));
        d.delete(aLen + bLen);
        quill.updateContents(d, 'user');
        blockHandle.classList.add('hidden');
        _bhBlot = null;
    }
    blockHandle.querySelectorAll('[data-bh]').forEach(b => {
        b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); moveBlock(Number(b.dataset.bh)); });
    });
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        els.editorWrapper.addEventListener('mousemove', (e) => {
            if (state.reading || state.isGuest) { blockHandle.classList.add('hidden'); return; }
            const blockEl = e.target.closest && e.target.closest('.ql-editor > p, .ql-editor > h1, .ql-editor > h2, .ql-editor > h3, .ql-editor > blockquote, .ql-editor > pre, .ql-editor li');
            if (!blockEl) return; /* keep the handle while over it */
            try {
                const blot = Quill.find(blockEl);
                if (!blot || typeof blot.length !== 'function') return;
                _bhBlot = blot; _bhEl = blockEl;
                const r = blockEl.getBoundingClientRect();
                blockHandle.style.left = Math.max(4, r.left - 26) + 'px';
                blockHandle.style.top = (r.top + Math.min(14, r.height / 2) - 20) + 'px';
                blockHandle.classList.remove('hidden');
                blockHandle.classList.add('flex');
            } catch (err) {}
        });
        els.editorWrapper.addEventListener('mouseleave', (e) => {
            if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#block-handle')) return;
            blockHandle.classList.add('hidden');
        });
        els.editorWrapper.addEventListener('scroll', () => blockHandle.classList.add('hidden'));
    }

    /* ============================================================
       V3.6 — HOME DASHBOARD
       Aggregates everything from the notes already in memory:
       pinned & starred, open tasks (kanban + unchecked [] items),
       today's daily note, and recent activity. Zero extra reads.
    ============================================================ */
    window.openHome = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        closeAllViews();
        document.getElementById('home-modal').classList.add('open');
        logTaskDay(); /* V3.8 */
        renderHome();
    };
    window.closeHome = () => document.getElementById('home-modal').classList.remove('open');
    function homeCard(title, icon, bodyHtml) {
        /* V3.7: each section scrolls independently so it can hold lots of data */
        return `<div class="rounded-2xl border border-border bg-surface shadow-sm p-3.5 md:p-4 min-w-0">
            <div class="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2.5">${icon} ${title}</div>
            <div class="max-h-52 overflow-y-auto zd-scroll pr-1">${bodyHtml}</div></div>`;
    }
    function homeRow(d, extra) {
        return `<button data-open="${d.id}" class="w-full text-left text-xs p-2 rounded-lg hover:bg-bg border border-transparent hover:border-border transition flex items-center gap-2 active:scale-[.99]">
            <span class="truncate text-text flex-1">${escapeHtml(d.title || 'Untitled')}</span>${extra || ''}</button>`;
    }
    function renderHome() {
        const el = document.getElementById('home-body'); if (!el) return;
        const IC = (p) => `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${p}</svg>`;
        /* pinned + starred */
        const pinned = state.docs.filter(d => d.pinned);
        const starred = state.docs.filter(d => d.isFavorite && !d.pinned);
        const favHtml = (pinned.length + starred.length)
            ? pinned.map(d => homeRow(d, '<span class="text-accent text-[9px] font-bold">PINNED</span>')).join('') +
              starred.map(d => homeRow(d, '<span class="text-gold text-[10px]">★</span>')).join('')
            : '<div class="text-[10px] text-muted">Pin or star notes to see them here.</div>';
        /* open tasks: kanban todo/doing + unchecked checklist items across notes */
        const kbTodo = state.docs.filter(d => d.kanban === 'todo');
        const kbDoing = state.docs.filter(d => d.kanban === 'doing');
        let taskItems = [];
        state.docs.forEach(d => {
            const ops = (d.content && d.content.ops) || [];
            let lineText = '';
            ops.forEach(op => {
                if (typeof op.insert !== 'string') return;
                const parts = op.insert.split('\n');
                for (let i = 0; i < parts.length; i++) {
                    lineText += parts[i];
                    if (i < parts.length - 1) {
                        if (op.attributes && op.attributes.list === 'unchecked' && lineText.trim())
                            taskItems.push({ d: d, text: lineText.trim() });
                        lineText = '';
                    }
                }
            });
        });
        taskItems = taskItems.slice(0, 12);
        const tasksHtml =
            `<div class="flex gap-2 mb-2">
                <span class="text-[10px] px-2 py-1 rounded-full font-bold" style="background:#1a73e81a;color:#1a73e8">${kbTodo.length} to do</span>
                <span class="text-[10px] px-2 py-1 rounded-full font-bold" style="background:#f59e0b1a;color:#f59e0b">${kbDoing.length} in progress</span>
            </div>` +
            (taskItems.length
                ? taskItems.map(t => `<button data-open="${t.d.id}" class="w-full text-left text-[11px] py-1 px-2 rounded-lg hover:bg-bg transition flex items-center gap-2"><span class="w-3 h-3 rounded border border-muted flex-shrink-0 inline-block"></span><span class="truncate text-text">${escapeHtml(t.text.slice(0, 70))}</span></button>`).join('')
                : '<div class="text-[10px] text-muted">No open checklist items — type /checklist in a note to add tasks.</div>');
        /* daily */
        const t = dailyTitle(new Date());
        const daily = state.docs.find(d => (d.title || '').trim() === t);
        const dailyHtml = `<div class="text-xs text-text mb-2">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <button onclick="closeHome(); openDailyNote();" class="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold hover:brightness-110 transition active:scale-95">${daily ? 'Open today\u2019s note' : 'Create today\u2019s note'}</button>`;
        /* recent */
        const recent = state.docs.slice(0, 6);
        const recentHtml = recent.length ? recent.map(d => homeRow(d, `<span class="text-[9px] text-muted flex-shrink-0">${d.updatedAt ? new Date(d.updatedAt.toDate()).toLocaleDateString() : ''}</span>`)).join('') : '<div class="text-[10px] text-muted">—</div>';
        el.innerHTML =
            homeCard('Pinned & starred', IC('<path stroke-linejoin="round" d="M6 4h12v16l-6-4-6 4z"/>'), favHtml) +
            homeCard('Open tasks', IC('<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>'), tasksHtml) +
            homeCard('Today', IC('<circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/>'), dailyHtml) +
            homeCard('Recent notes', IC('<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>'), recentHtml) +
            homeCard('Task analytics', IC('<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'), taskChartHtml());
        el.querySelectorAll('[data-open]').forEach(b => {
            b.onclick = () => {
                const d = state.docs.find(x => x.id === b.dataset.open);
                if (d) { closeHome(); openDoc(d.id, d); }
            };
        });
    }

    /* ============================================================
       V3.6 — OFFLINE SAVE REMINDER
       A gentle floating nudge after 1 minute offline; dismiss snoozes
       it for 5 minutes. Never covers the writing area or blocks input.
    ============================================================ */
    let _offRemT = null;
    function armOfflineReminder(delay) {
        clearTimeout(_offRemT);
        _offRemT = setTimeout(() => {
            if (state.offlineMode) document.getElementById('offline-reminder').classList.remove('hidden');
        }, delay);
    }
    window.dismissOfflineReminder = () => {
        document.getElementById('offline-reminder').classList.add('hidden');
        if (state.offlineMode) armOfflineReminder(5 * 60 * 1000); /* snooze 5 min */
    };
    function hideOfflineReminder() {
        clearTimeout(_offRemT); _offRemT = null;
        document.getElementById('offline-reminder').classList.add('hidden');
    }

    /* ============================================================
       V3.5 — PINNED NOTES, SELECTION STATS, COPY MARKDOWN,
       READING MODE, FOCUS NUDGES
    ============================================================ */
    /* Pinned notes — keep key notes at the top of the list (Obsidian-style) */
    window.togglePin = async (docId) => {
        const d = state.docs.find(x => x.id === docId); if (!d) return;
        const next = !d.pinned;
        d.pinned = next; renderDocs(); /* optimistic */
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').doc(docId).update({ pinned: next });
            showToast(next ? 'Pinned to top.' : 'Unpinned.');
        } catch (e) { console.error(e); showToast('Could not update pin.'); }
    };

    /* Selection statistics — live word/char count of the highlighted text */
    quill.on('selection-change', (range) => {
        if (range && range.length > 0) {
            const t = quill.getText(range.index, range.length);
            const w = t.trim() ? t.trim().split(/\s+/).length : 0;
            els.wordCount.textContent = '\u00b7 ' + w + (w === 1 ? ' word' : ' words') + ', ' + t.length + ' chars selected';
        } else {
            updateWordCount();
        }
    });

    /* Copy note as Markdown (Obsidian-ready) straight to the clipboard */
    window.copyMarkdown = async () => {
        if (!state.docId) { showToast('Open a note first.'); return; }
        try {
            await navigator.clipboard.writeText('# ' + (els.title.value || 'Document') + '\n\n' + deltaToMarkdown());
            showToast('Markdown copied to clipboard.');
        } catch (e) { showToast('Copy failed \u2014 your browser blocked clipboard access.'); }
    };

    /* Reading mode (Ctrl+E) — distraction-free, edit-locked view */
    window.toggleReadingMode = () => {
        if (state.isGuest || !state.docId) return;
        state.reading = !state.reading;
        quill.enable(!state.reading);
        els.toolbar.classList.toggle('hidden', state.reading);
        const rw = document.getElementById('ruler-wrap'); if (rw) rw.classList.toggle('hidden', state.reading);
        setStatus('saved', state.reading ? 'Reading mode \u2014 Ctrl+E to edit' : (state.offlineMode ? 'Offline mode' : 'Synced'));
        showToast(state.reading ? 'Reading mode \u2014 press Ctrl+E to edit again' : 'Editing enabled.');
    };

    /* Focus nudge for the outline search (mobile caret) */
    (function () {
        const osInp = document.getElementById('outline-search');
        if (!osInp) return;
        osInp.addEventListener('pointerup', () => {
            setTimeout(() => { if (document.activeElement !== osInp) { try { osInp.focus({ preventScroll: true }); } catch (e) { osInp.focus(); } } }, 40);
        });
    })();

    /* ============================================================
       V3.4 — COLLAPSIBLE SIDEBAR SECTIONS & ACCENT THEMES
    ============================================================ */
    window.toggleSection = (listId, chId) => {
        const el = document.getElementById(listId);
        const ch = document.getElementById(chId);
        const hidden = el.classList.toggle('hidden');
        if (ch) ch.style.transform = hidden ? 'rotate(-90deg)' : '';
        localStorage.setItem('zdSec_' + listId, hidden ? '0' : '1');
    };
    function initSections() {
        [['folder-list', 'sec-folders-ch'], ['tag-list', 'sec-tags-ch'], ['doc-list', 'sec-recent-ch']].forEach(([id, chId]) => {
            if (localStorage.getItem('zdSec_' + id) === '0') {
                const el = document.getElementById(id); if (el) el.classList.add('hidden');
                const ch = document.getElementById(chId); if (ch) ch.style.transform = 'rotate(-90deg)';
            }
        });
    }

    const ACCENTS = [
        { n: 'Blue', v: '26 115 232' },
        { n: 'Purple', v: '124 58 237' },
        { n: 'Teal', v: '13 148 136' },
        { n: 'Green', v: '22 163 74' },
        { n: 'Rose', v: '225 29 72' },
        { n: 'Amber', v: '217 119 6' }
    ];
    /* V3.5: gradient themes — blend 2–3 colors across the brand areas */
    const GRADS = [
        { n: 'Ocean', v: '26 115 232', g: 'linear-gradient(135deg,#1a73e8,#0d9488)' },
        { n: 'Sunset', v: '225 29 72', g: 'linear-gradient(135deg,#e11d48,#d97706)' },
        { n: 'Aurora', v: '124 58 237', g: 'linear-gradient(135deg,#7c3aed,#0d9488 55%,#16a34a)' },
        { n: 'Candy', v: '219 39 119', g: 'linear-gradient(135deg,#db2777,#7c3aed)' },
        { n: 'Ember', v: '217 119 6', g: 'linear-gradient(135deg,#d97706,#e11d48 60%,#7c3aed)' }
    ];
    function applyAccent(v, grad, name) {
        document.documentElement.style.setProperty('--accent-rgb', v);
        const g = grad || ('linear-gradient(135deg, rgb(' + v.split(' ').join(',') + '), rgb(' + v.split(' ').join(',') + '))');
        document.documentElement.style.setProperty('--zd-grad', g);
        localStorage.setItem('zdAccent', v);
        localStorage.setItem('zdGrad', grad || '');
        renderAccentSwatches();
        if (name) showToast('Theme: ' + name);
    }
    function renderAccentSwatches() {
        const el = document.getElementById('accent-swatches'); if (!el) return;
        const curV = localStorage.getItem('zdAccent') || '26 115 232';
        const curG = localStorage.getItem('zdGrad') || '';
        el.innerHTML = '';
        ACCENTS.forEach(a => {
            const b = document.createElement('button');
            b.className = 'accent-swatch' + ((a.v === curV && !curG) ? ' active' : '');
            b.style.background = 'rgb(' + a.v.split(' ').join(',') + ')';
            b.title = a.n;
            b.onclick = () => applyAccent(a.v, null, a.n);
            el.appendChild(b);
        });
        const lab = document.createElement('div');
        lab.className = 'w-full text-[10px] font-bold uppercase tracking-wider text-muted mt-1';
        lab.textContent = 'Gradients';
        el.appendChild(lab);
        GRADS.forEach(a => {
            const b = document.createElement('button');
            b.className = 'accent-swatch' + (a.g === curG ? ' active' : '');
            b.style.background = a.g;
            b.title = a.n;
            b.onclick = () => applyAccent(a.v, a.g, a.n);
            el.appendChild(b);
        });
        /* V3.6: pick ANY color */
        const pick = document.createElement('input');
        pick.type = 'color';
        pick.title = 'Custom color…';
        pick.className = 'accent-swatch p-0 bg-transparent';
        pick.style.border = '2px dashed #9ca3af';
        try { pick.value = '#' + curV.split(' ').map(x => (+x).toString(16).padStart(2, '0')).join(''); } catch (e) {}
        pick.addEventListener('input', () => {
            const h = pick.value.replace('#', '');
            const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(' ');
            applyAccent(v, null, null);
        });
        pick.addEventListener('change', () => showToast('Theme: custom color'));
        el.appendChild(pick);
    }
    window.toggleAppearance = (e) => {
        const pop = document.getElementById('appearance-pop');
        if (!pop.classList.contains('hidden')) { pop.classList.add('hidden'); return; }
        renderAccentSwatches();
        pop.classList.remove('hidden');
        const r = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : { left: 20, top: window.innerHeight - 120 };
        const left = Math.max(8, Math.min(r.left, window.innerWidth - 236));
        pop.style.left = left + 'px';
        pop.style.top = Math.max(8, r.top - pop.offsetHeight - 8) + 'px';
    };
    window.closeAppearance = () => document.getElementById('appearance-pop').classList.add('hidden');
    function initAccent() {
        const v = localStorage.getItem('zdAccent');
        const g = localStorage.getItem('zdGrad');
        if (v) document.documentElement.style.setProperty('--accent-rgb', v);
        if (g) document.documentElement.style.setProperty('--zd-grad', g);
        else if (v) document.documentElement.style.setProperty('--zd-grad', 'linear-gradient(135deg, rgb(' + v.split(' ').join(',') + '), rgb(' + v.split(' ').join(',') + '))');
    }

    /* ============================================================
       V3.8 — FOCUS SHIELD, VIEWERS, ZOOM, FOLD, LOCAL AI, STUDY,
       FRAMES, DEEP THINK, TASK ANALYTICS, TIME MACHINE
    ============================================================ */

    /* ---------- FOCUS SHIELD: the inverse trap. For 1.6s after you focus a
       protected input, anything that yanks focus back to the editor loses —
       the input reclaims it. Ends the cursor war for good. ---------- */
    /* V3.8.2 - FOCUS PROTECTION AT THE SOURCE.
       While a protected input is engaged, Quill's own focus() and
       setSelection() are no-ops and any DOM-level focus grab by the editor
       bounces back. Clicking the editor yourself disarms instantly. */
    const PROT_SEL = '.folder-rename-input, #outline-search, #kb-card-title, #kb-card-text, #picker-search, #link-url, .cv-card textarea';
    let zdProtUntil = 0, zdProtEl = null;
    function zdArmProtect(el) { zdProtEl = el; zdProtUntil = Date.now() + 4000; }
    function zdProtActive() {
        const ae = document.activeElement;
        if (ae && ae.matches && ae.matches(PROT_SEL)) { zdProtUntil = Date.now() + 4000; return true; }
        return Date.now() < zdProtUntil && zdProtEl && document.body.contains(zdProtEl);
    }
    document.addEventListener('focusin', (e) => {
        if (e.target && e.target.matches && e.target.matches(PROT_SEL)) zdArmProtect(e.target);
    });
    document.addEventListener('input', (e) => {
        if (e.target && e.target.matches && e.target.matches(PROT_SEL)) zdArmProtect(e.target);
    }, true);
    document.addEventListener('pointerdown', (e) => {
        if (e.target.closest && e.target.closest('.ql-editor')) { zdProtUntil = 0; zdProtEl = null; }
    }, true);
    (function () {
        const _qF = quill.focus.bind(quill);
        const _qS = quill.setSelection.bind(quill);
        quill.focus = function () { if (zdProtActive()) return; return _qF(); };
        quill.setSelection = function (a, b, c) {
            if (zdProtActive() && !quill.hasFocus()) return null;
            return _qS(a, b, c);
        };
        const edRoot = document.querySelector('.ql-editor');
        if (edRoot) edRoot.addEventListener('focus', () => {
            if (zdProtActive() && zdProtEl && document.body.contains(zdProtEl)) {
                setTimeout(() => { try { zdProtEl.focus({ preventScroll: true }); } catch (e) {} }, 0);
            }
        }, true);
    })();
    ['pointerdown', 'mousedown', 'touchstart'].forEach(ev => {
        document.addEventListener(ev, (e) => {
            const t = e.target;
            if (t && t.matches && t.matches(PROT_SEL)) {
                e.stopPropagation();
                zdArmProtect(t);
                if (document.activeElement !== t) { try { t.focus({ preventScroll: true }); } catch (err) {} }
            }
        }, true);
    });

    /* ---------- FOLDER ⋮ MENU ---------- */
    let _fmTarget = null;
    window.openFolderMenu = (e, id, name, emoji, nameSpan) => {
        e.stopPropagation();
        _fmTarget = { id, name, emoji, nameSpan };
        const m = document.getElementById('folder-menu');
        m.classList.remove('hidden');
        const r = e.currentTarget.getBoundingClientRect();
        m.style.left = Math.min(r.left, window.innerWidth - 150) + 'px';
        m.style.top = Math.min(r.bottom + 4, window.innerHeight - 90) + 'px';
    };
    window.closeFolderMenu = () => { document.getElementById('folder-menu').classList.add('hidden'); };
    window.fmRename = () => {
        if (_fmTarget) {
            /* V3.8.1: re-find the LIVE span — a sync echo may have re-rendered
               the tile since the menu opened, detaching the stored node */
            const tile = document.querySelector(`[data-fid="${_fmTarget.id}"]`);
            const span = (tile && tile.querySelector('.folder-name')) || _fmTarget.nameSpan;
            startFolderRename(_fmTarget.id, _fmTarget.name, _fmTarget.emoji, span);
        }
        closeFolderMenu();
    };
    window.fmDelete = () => { if (_fmTarget) deleteFolder(_fmTarget.id); closeFolderMenu(); };

    /* ---------- IMAGE VIEWER (Slack-style lightbox: zoom, pinch, download) ---------- */
    var iv = { scale: 1, x: 0, y: 0, drag: null, pointers: new Map(), pinch: null, src: '' };
    function openImgViewer(src) {
        iv.scale = 1; iv.x = 0; iv.y = 0; iv.src = src;
        const im = document.getElementById('iv-img');
        im.src = src; ivApply();
        document.getElementById('img-viewer').classList.remove('hidden');
    }
    window.closeImgViewer = () => document.getElementById('img-viewer').classList.add('hidden');
    function ivApply() {
        document.getElementById('iv-img').style.transform = `translate(${iv.x}px,${iv.y}px) scale(${iv.scale})`;
        document.getElementById('iv-zoom').textContent = Math.round(iv.scale * 100) + '%';
    }
    window.ivZoom = (f) => { iv.scale = Math.max(0.3, Math.min(6, iv.scale * f)); ivApply(); };
    window.ivDownload = () => {
        const a = document.createElement('a');
        a.href = iv.src; a.download = (els.title.value || 'image') + '.jpg'; a.click();
    };
    function bindImgViewer() {
        const box = document.getElementById('img-viewer');
        box.addEventListener('click', (e) => { if (e.target === box) closeImgViewer(); });
        box.addEventListener('wheel', (e) => { e.preventDefault(); ivZoom(e.deltaY < 0 ? 1.15 : 0.87); }, { passive: false });
        box.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            iv.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (iv.pointers.size === 2) {
                const p = Array.from(iv.pointers.values());
                iv.pinch = { d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, s0: iv.scale };
                iv.drag = null;
            } else {
                iv.drag = { sx: e.clientX, sy: e.clientY, ox: iv.x, oy: iv.y };
            }
            try { box.setPointerCapture(e.pointerId); } catch (err) {}
        });
        box.addEventListener('pointermove', (e) => {
            if (iv.pointers.has(e.pointerId)) iv.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (iv.pinch && iv.pointers.size >= 2) {
                const p = Array.from(iv.pointers.values());
                const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
                iv.scale = Math.max(0.3, Math.min(6, iv.pinch.s0 * (d / iv.pinch.d0)));
                ivApply();
            } else if (iv.drag) {
                iv.x = iv.drag.ox + (e.clientX - iv.drag.sx);
                iv.y = iv.drag.oy + (e.clientY - iv.drag.sy);
                ivApply();
            }
        });
        const ivUp = (e) => { iv.pointers.delete(e.pointerId); if (iv.pointers.size < 2) iv.pinch = null; if (!iv.pointers.size) iv.drag = null; };
        box.addEventListener('pointerup', ivUp);
        box.addEventListener('pointercancel', ivUp);
        /* open from editor: tap on mobile, double-click on desktop */
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        els.editorWrapper.addEventListener('click', (e) => {
            if (coarse && e.target.tagName === 'IMG' && e.target.closest('.ql-editor')) { e.preventDefault(); openImgViewer(e.target.src); }
        });
        els.editorWrapper.addEventListener('dblclick', (e) => {
            if (e.target.tagName === 'IMG' && e.target.closest('.ql-editor')) { e.preventDefault(); openImgViewer(e.target.src); }
        });
    }
    bindImgViewer();

    /* ---------- EDITOR ZOOM ---------- */
    window.toggleMoreMenu = () => document.getElementById('more-menu').classList.toggle('hidden');
    window.zoomEditor = (dir) => {
        let z = parseFloat(localStorage.getItem('zdEdZoom') || '1');
        z = dir === 0 ? 1 : Math.max(0.75, Math.min(1.6, z + dir * 0.1));
        z = Math.round(z * 100) / 100;
        localStorage.setItem('zdEdZoom', z);
        document.getElementById('editor-container').style.zoom = z;
        showToast('Editor zoom: ' + Math.round(z * 100) + '%');
    };
    (function () {
        const z = parseFloat(localStorage.getItem('zdEdZoom') || '1');
        if (z !== 1) { const c = document.getElementById('editor-container'); if (c) c.style.zoom = z; }
    })();

    /* ---------- MOBILE STATS POPOVER (info icon replaces crowded footer text) ---------- */
    window.toggleStatsPop = () => {
        const p = document.getElementById('stats-pop');
        if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
        const text = quill.getText();
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const mins = Math.max(1, Math.round(words / 200));
        let checked = 0, unchecked = 0;
        (quill.getContents().ops || []).forEach(op => {
            if (op.attributes && op.attributes.list === 'checked') checked++;
            if (op.attributes && op.attributes.list === 'unchecked') unchecked++;
        });
        document.getElementById('stats-pop-body').innerHTML =
            `<div class="flex justify-between"><span>Words</span><b>${words}</b></div>
             <div class="flex justify-between"><span>Characters</span><b>${text.length - 1}</b></div>
             <div class="flex justify-between"><span>Reading time</span><b>~${mins} min</b></div>` +
            (checked + unchecked ? `<div class="flex justify-between"><span>Tasks done</span><b>${checked}/${checked + unchecked}</b></div>` : '');
        p.classList.remove('hidden');
    };

    /* ---------- COLLAPSIBLE SECTIONS IN NOTES (Notion toggle, view-layer:
       chevrons live OUTSIDE the editor DOM so Quill deltas stay untouched) ---------- */
    const foldState = {}; /* docId -> Set(headingKey) */
    function headingKeyOf(node, idx) { return (node.tagName || 'H') + ':' + (node.textContent || '').trim() + ':' + idx; }
    function applyHeadingFolds() {
        /* V3.8.1: never mutate editor blocks while the user is typing in a
           protected input — removes the last possible focus disturbance */
        const af = document.activeElement;
        if (af && af.matches && af.matches('.folder-rename-input, #outline-search, #kb-card-title, #kb-card-text, #picker-search, #link-url, .cv-card textarea')) return;
        const ed = document.querySelector('.ql-editor'); if (!ed) return;
        const gut = document.getElementById('fold-gutter'); if (!gut) return;
        gut.innerHTML = '';
        const folds = foldState[state.docId] || new Set();
        const blocks = Array.from(ed.children);
        const heads = [];
        blocks.forEach((b, i) => { if (/^H[1-3]$/.test(b.tagName)) heads.push({ node: b, i: i, lvl: +b.tagName[1] }); });
        /* visibility pass */
        let hideUntilLvl = null;
        blocks.forEach((b, i) => {
            const isHead = /^H[1-3]$/.test(b.tagName);
            const lvl = isHead ? +b.tagName[1] : 99;
            if (hideUntilLvl !== null && isHead && lvl <= hideUntilLvl) hideUntilLvl = null;
            const hidden = hideUntilLvl !== null && !(isHead && lvl <= hideUntilLvl);
            b.style.display = hidden ? 'none' : '';
            if (isHead && !hidden) {
                const hIdx = heads.findIndex(h => h.node === b);
                const key = headingKeyOf(b, heads.slice(0, hIdx).filter(h => (h.node.textContent || '').trim() === (b.textContent || '').trim()).length);
                if (folds.has(key)) hideUntilLvl = lvl;
            }
        });
        /* chevrons in the gutter for visible headings */
        const wrapR = els.editorWrapper.getBoundingClientRect();
        heads.forEach((h, hIdx) => {
            if (h.node.style.display === 'none') return;
            const key = headingKeyOf(h.node, heads.slice(0, hIdx).filter(x => (x.node.textContent || '').trim() === (h.node.textContent || '').trim()).length);
            const r = h.node.getBoundingClientRect();
            if (r.bottom < wrapR.top || r.top > wrapR.bottom) return;
            const btn = document.createElement('button');
            const folded = folds.has(key);
            btn.className = 'zd-fold ' + (folded ? 'folded' : '');
            btn.style.top = (r.top - wrapR.top + els.editorWrapper.scrollTop + (r.height / 2) - 9) + 'px';
            btn.innerHTML = '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';
            btn.title = folded ? 'Expand section' : 'Collapse section';
            btn.onmousedown = (e) => e.preventDefault(); /* keep editor caret */
            btn.onclick = (e) => {
                e.stopPropagation();
                if (!foldState[state.docId]) foldState[state.docId] = new Set();
                const s = foldState[state.docId];
                if (s.has(key)) s.delete(key); else s.add(key);
                applyHeadingFolds();
            };
            gut.appendChild(btn);
        });
    }
    let _foldT = null;
    function scheduleFolds() { clearTimeout(_foldT); _foldT = setTimeout(applyHeadingFolds, 250); }
    els.editorWrapper.addEventListener('scroll', scheduleFolds);
    quill.on('text-change', scheduleFolds);

    /* ---------- TASK PROGRESS HEADER ---------- */
    function updateTaskProgress() {
        const bar = document.getElementById('task-progress'); if (!bar) return;
        let done = 0, total = 0;
        (quill.getContents().ops || []).forEach(op => {
            if (op.attributes && op.attributes.list === 'checked') { done++; total++; }
            else if (op.attributes && op.attributes.list === 'unchecked') total++;
        });
        if (!total || !state.docId) { bar.classList.add('hidden'); return; }
        const pct = Math.round(done / total * 100);
        bar.classList.remove('hidden');
        bar.querySelector('.tp-label').textContent = `Tasks ${done}/${total} · ${pct}%`;
        bar.querySelector('.tp-fill').style.width = pct + '%';
    }
    let _tpT = null;
    quill.on('text-change', () => { clearTimeout(_tpT); _tpT = setTimeout(updateTaskProgress, 400); });

    /* ---------- LOCAL AI: on-device extractive summary + tag suggestions.
       Pure JS (TextRank-style scoring) — instant, private, zero downloads. ---------- */
    const ZD_STOP = new Set(('the a an and or but if then else of to in on for with at by from as is are was were be been being it its this that these those i you he she we they them his her our your my me not no yes do does did done can could will would shall should may might must have has had having about into over under again more most some such only own same so than too very just also there here when where why how what which who whom while during before after above below up down out off all any both each few other'
        ).split(' '));
    function zdTokens(t) { return (t.toLowerCase().match(/[a-z][a-z0-9'-]{1,}/g) || []).filter(w => !ZD_STOP.has(w)); }
    function zdSummarize(text) {
        const sents = text.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+/g) || [text];
        if (sents.length <= 2) return sents.map(s => s.trim());
        const freq = {};
        zdTokens(text).forEach(w => freq[w] = (freq[w] || 0) + 1);
        const scored = sents.map((s, i) => {
            const toks = zdTokens(s);
            const score = toks.reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(toks.length + 1)
                + (i === 0 ? 2.2 : 0) + (i === sents.length - 1 ? 0.8 : 0);
            return { s: s.trim(), i, score };
        });
        const words = zdTokens(text).length;
        const n = words < 120 ? 2 : words < 600 ? 3 : words < 1500 ? 4 : 5;
        return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map(x => x.s);
    }
    function zdSuggestTags(text, existing) {
        const freq = {};
        zdTokens(text).forEach(w => { if (w.length >= 4) freq[w] = (freq[w] || 0) + 1; });
        return Object.keys(freq)
            .filter(w => freq[w] >= 2 && !existing.includes(w))
            .sort((a, b) => freq[b] - freq[a]).slice(0, 6);
    }
    window.openAiPanel = () => {
        if (!state.docId) { showToast('Open a note first.'); return; }
        const text = quill.getText();
        if (zdTokens(text).length < 25) { showToast('Write a little more first — the summarizer needs ~25 words.'); return; }
        const sum = zdSummarize(text);
        const cur = state.docs.find(d => d.id === state.docId);
        const tags = zdSuggestTags(text, cur ? docTags(cur) : []);
        document.getElementById('ai-summary').innerHTML = sum.map(s => `<li>${escapeHtml(s)}</li>`).join('');
        const tw = document.getElementById('ai-tags');
        tw.innerHTML = tags.length ? '' : '<span class="text-[10px] text-muted">No strong tag candidates yet.</span>';
        tags.forEach(t => {
            const b = document.createElement('button');
            b.className = 'px-2.5 py-1 rounded-full text-[11px] font-semibold bg-accent/10 text-accent hover:bg-accent/25 transition active:scale-95';
            b.textContent = '+ #' + t;
            b.onclick = () => {
                const len = quill.getLength();
                quill.insertText(len - 1, (quill.getText(len - 2, 1) === '\n' ? '' : '\n') + '#' + t + ' ', 'user');
                b.disabled = true; b.classList.add('opacity-40');
                showToast('#' + t + ' added.');
            };
            tw.appendChild(b);
        });
        document.getElementById('ai-modal').classList.add('open');
    };
    window.closeAiPanel = () => document.getElementById('ai-modal').classList.remove('open');
    window.aiInsertSummary = () => {
        const items = Array.from(document.querySelectorAll('#ai-summary li')).map(li => li.textContent);
        if (!items.length) return;
        quill.insertText(0, 'Summary\n', { header: 3 }, 'user');
        let at = 8;
        items.forEach(s => { quill.insertText(at, s + '\n', { list: 'bullet' }, 'user'); at += s.length + 1; });
        closeAiPanel(); showToast('Summary inserted at the top.');
    };
    window.aiCopySummary = async () => {
        const items = Array.from(document.querySelectorAll('#ai-summary li')).map(li => '\u2022 ' + li.textContent);
        try { await navigator.clipboard.writeText(items.join('\n')); showToast('Summary copied.'); } catch (e) { showToast('Copy failed.'); }
    };

    /* ---------- GUIDED LEARNING & FLASHCARDS ---------- */
    let _cards = [], _cardIdx = 0, _cardFlip = false, _sections = [], _guideIdx = 0, _studyTab = 'cards';
    function buildStudyData() {
        _cards = []; _sections = [];
        const ops = quill.getContents().ops || [];
        let line = '', lineBold = [], secs = [];
        let curSec = null;
        ops.forEach(op => {
            if (typeof op.insert !== 'string') return;
            const parts = op.insert.split('\n');
            for (let i = 0; i < parts.length; i++) {
                if (parts[i]) { line += parts[i]; if (op.attributes && op.attributes.bold) lineBold.push(parts[i].trim()); }
                if (i < parts.length - 1) {
                    const attrs = op.attributes || {};
                    if (attrs.header && attrs.header <= 3) {
                        curSec = { title: line.trim() || 'Untitled section', lvl: attrs.header, body: [], bolds: [], lists: [] };
                        secs.push(curSec);
                    } else if (curSec && line.trim()) {
                        if (attrs.list) curSec.lists.push(line.trim());
                        else curSec.body.push(line.trim());
                        lineBold.forEach(b => { if (b.length > 2) curSec.bolds.push({ term: b, ctx: line.trim() }); });
                    }
                    line = ''; lineBold = [];
                }
            }
        });
        _sections = secs.filter(s => s.body.length || s.lists.length);
        _sections.forEach(s => {
            const bodyText = s.body.join(' ');
            if (bodyText) {
                const first = (bodyText.match(/[^.!?]+[.!?]+/g) || [bodyText]).slice(0, 2).join(' ');
                _cards.push({ q: s.title, a: first.trim() });
            }
            s.lists.slice(0, 6).forEach(li => _cards.push({ q: s.title + ' \u2014 key point?', a: li.replace(/^\[.?\]\s*/, '') }));
            s.bolds.slice(0, 6).forEach(b => _cards.push({ q: 'Define: ' + b.term, a: b.ctx }));
        });
        const seen = new Set();
        _cards = _cards.filter(c => { const k = c.q + '|' + c.a; if (seen.has(k) || c.a.length < 3) return false; seen.add(k); return true; }).slice(0, 40);
    }
    window.openStudy = () => {
        if (!state.docId) { showToast('Open a note first.'); return; }
        buildStudyData();
        if (!_cards.length && !_sections.length) { showToast('Add headings (H1\u2013H3) with content, bold terms or lists \u2014 the study engine builds from structure.'); return; }
        _cardIdx = 0; _cardFlip = false; _guideIdx = 0; _studyTab = _cards.length ? 'cards' : 'guide';
        renderStudy();
        document.getElementById('study-modal').classList.add('open');
    };
    window.closeStudy = () => document.getElementById('study-modal').classList.remove('open');
    window.studyTab = (t) => { _studyTab = t; renderStudy(); };
    window.cardNav = (d) => { _cardIdx = Math.max(0, Math.min(_cards.length - 1, _cardIdx + d)); _cardFlip = false; renderStudy(); };
    window.cardFlip = () => { _cardFlip = !_cardFlip; renderStudy(); };
    window.cardShuffle = () => { _cards.sort(() => Math.random() - 0.5); _cardIdx = 0; _cardFlip = false; renderStudy(); showToast('Shuffled.'); };
    window.guideNav = (d) => { _guideIdx = Math.max(0, Math.min(_sections.length - 1, _guideIdx + d)); renderStudy(); };
    function renderStudy() {
        const tabC = document.getElementById('study-tab-cards'), tabG = document.getElementById('study-tab-guide');
        tabC.className = 'px-3 py-1.5 text-xs font-semibold rounded-full transition ' + (_studyTab === 'cards' ? 'bg-accent text-white' : 'text-muted hover:text-text');
        tabG.className = 'px-3 py-1.5 text-xs font-semibold rounded-full transition ' + (_studyTab === 'guide' ? 'bg-accent text-white' : 'text-muted hover:text-text');
        const body = document.getElementById('study-body');
        if (_studyTab === 'cards') {
            if (!_cards.length) { body.innerHTML = '<div class="text-xs text-muted text-center py-10">No flashcards \u2014 add bold terms or lists under headings.</div>'; return; }
            const c = _cards[_cardIdx];
            body.innerHTML = `
                <div class="text-[10px] text-muted text-center mb-2">${_cardIdx + 1} / ${_cards.length}</div>
                <button onclick="cardFlip()" class="w-full min-h-[150px] rounded-2xl border-2 ${_cardFlip ? 'border-accent bg-accent/5' : 'border-border bg-bg'} p-5 flex items-center justify-center text-center transition active:scale-[.99]">
                    <div>
                        <div class="text-[9px] font-bold uppercase tracking-wider ${_cardFlip ? 'text-accent' : 'text-muted'} mb-2">${_cardFlip ? 'Answer' : 'Question \u2014 tap to flip'}</div>
                        <div class="text-sm text-text leading-relaxed">${escapeHtml(_cardFlip ? c.a : c.q)}</div>
                    </div>
                </button>
                <div class="flex items-center justify-between mt-3">
                    <button onclick="cardNav(-1)" class="px-3 py-1.5 text-xs rounded-lg bg-bg border border-border text-text hover:border-accent transition ${_cardIdx === 0 ? 'opacity-30 pointer-events-none' : ''}">\u2190 Prev</button>
                    <button onclick="cardShuffle()" class="px-3 py-1.5 text-xs rounded-lg text-muted hover:text-accent transition">Shuffle</button>
                    <button onclick="cardNav(1)" class="px-3 py-1.5 text-xs rounded-lg bg-bg border border-border text-text hover:border-accent transition ${_cardIdx >= _cards.length - 1 ? 'opacity-30 pointer-events-none' : ''}">Next \u2192</button>
                </div>`;
        } else {
            if (!_sections.length) { body.innerHTML = '<div class="text-xs text-muted text-center py-10">No sections \u2014 structure the note with headings first.</div>'; return; }
            const s = _sections[_guideIdx];
            const why = 'This section matters because it groups ' + (s.lists.length ? s.lists.length + ' key points' : 'the core explanation') + ' under \u201c' + s.title + '\u201d.';
            body.innerHTML = `
                <div class="text-[10px] text-muted text-center mb-2">Step ${_guideIdx + 1} / ${_sections.length}</div>
                <div class="rounded-2xl border border-border bg-bg p-4">
                    <div class="text-sm font-bold text-text mb-1.5">${escapeHtml(s.title)}</div>
                    <div class="text-[10px] text-accent font-semibold mb-2">${escapeHtml(why)}</div>
                    ${s.body.slice(0, 3).map(p => `<p class="text-xs text-text leading-relaxed mb-1.5">${escapeHtml(p)}</p>`).join('')}
                    ${s.lists.length ? '<ul class="list-disc pl-4 space-y-1">' + s.lists.slice(0, 8).map(li => `<li class="text-xs text-text">${escapeHtml(li)}</li>`).join('') + '</ul>' : ''}
                </div>
                <div class="flex items-center justify-between mt-3">
                    <button onclick="guideNav(-1)" class="px-3 py-1.5 text-xs rounded-lg bg-bg border border-border text-text hover:border-accent transition ${_guideIdx === 0 ? 'opacity-30 pointer-events-none' : ''}">\u2190 Back</button>
                    <button onclick="guideNav(1)" class="px-3 py-1.5 text-xs rounded-lg bg-accent text-white transition ${_guideIdx >= _sections.length - 1 ? 'opacity-30 pointer-events-none' : ''}">Understood \u2192</button>
                </div>`;
        }
    }

    /* ---------- DEEP THINK: live structural map of the note (split pane) ---------- */
    let _dtT = null;
    window.toggleDeepThink = () => {
        const p = document.getElementById('dt-pane');
        const on = p.classList.toggle('open');
        if (on) renderDeepThink();
    };
    function renderDeepThink() {
        const p = document.getElementById('dt-pane');
        if (!p.classList.contains('open')) return;
        const body = document.getElementById('dt-body');
        const ops = quill.getContents().ops || [];
        const secs = [];
        let cur = { title: 'Intro', lvl: 0, words: 0, links: [], tasks: 0, done: 0 };
        let line = '';
        ops.forEach(op => {
            if (typeof op.insert !== 'string') { cur.words += 2; return; }
            const parts = op.insert.split('\n');
            for (let i = 0; i < parts.length; i++) {
                line += parts[i];
                if (i < parts.length - 1) {
                    const attrs = op.attributes || {};
                    if (attrs.header && attrs.header <= 3) {
                        if (cur.words > 0 || secs.length === 0) secs.push(cur);
                        cur = { title: line.trim() || 'Untitled', lvl: attrs.header, words: 0, links: [], tasks: 0, done: 0 };
                    } else {
                        cur.words += line.trim() ? line.trim().split(/\s+/).length : 0;
                        (line.match(/\[\[([^\]]+)\]\]/g) || []).forEach(l => cur.links.push(l.slice(2, -2)));
                        if (attrs.list === 'unchecked') cur.tasks++;
                        if (attrs.list === 'checked') { cur.tasks++; cur.done++; }
                    }
                    line = '';
                }
            }
        });
        if (cur.words > 0) secs.push(cur);
        if (!secs.length) { body.innerHTML = '<div class="text-[10px] text-muted p-3">Start writing \u2014 the map builds itself as your note grows.</div>'; return; }
        const maxW = Math.max(...secs.map(s => s.words), 1);
        body.innerHTML = secs.map((s, i) => {
            const h = 30 + Math.round((s.words / maxW) * 60);
            const hue = s.lvl === 0 ? '210' : s.lvl === 1 ? 'var(--dt1,220)' : s.lvl === 2 ? '260' : '300';
            return `${i > 0 ? '<div class="dt-arrow"></div>' : ''}
            <button data-dt="${i}" class="dt-node" style="margin-left:${(s.lvl ? s.lvl - 1 : 0) * 14}px;min-height:${h}px;border-left-color:rgb(var(--accent-rgb))">
                <div class="text-[10px] font-bold text-text truncate">${escapeHtml(s.title)}</div>
                <div class="text-[9px] text-muted">${s.words}w${s.links.length ? ' \u00b7 ' + s.links.length + ' link' + (s.links.length > 1 ? 's' : '') : ''}${s.tasks ? ' \u00b7 \u2611 ' + s.done + '/' + s.tasks : ''}</div>
                ${s.links.length ? `<div class="flex flex-wrap gap-1 mt-1">${s.links.slice(0, 3).map(l => `<span class="text-[8px] px-1.5 rounded-full bg-accent/10 text-accent truncate max-w-[90px]">${escapeHtml(l)}</span>`).join('')}</div>` : ''}
            </button>`;
        }).join('');
        body.querySelectorAll('[data-dt]').forEach(b => {
                    b.onclick = () => { zdScrollToNode(line.domNode); };
            // };
        });
    }
    quill.on('text-change', () => { clearTimeout(_dtT); _dtT = setTimeout(renderDeepThink, 800); });

    /* ---------- TASK ANALYTICS LOG (local, per-day vault snapshot) ---------- */
    function logTaskDay() {
        try {
            let done = 0, total = 0;
            state.docs.forEach(d => {
                ((d.content && d.content.ops) || []).forEach(op => {
                    if (op.attributes && op.attributes.list === 'checked') { done++; total++; }
                    else if (op.attributes && op.attributes.list === 'unchecked') total++;
                });
            });
            const log = JSON.parse(localStorage.getItem('zdTaskLog') || '{}');
            const key = new Date().toISOString().slice(0, 10);
            log[key] = { d: done, t: total };
            const keys = Object.keys(log).sort();
            while (keys.length > 30) delete log[keys.shift()];
            localStorage.setItem('zdTaskLog', JSON.stringify(log));
        } catch (e) {}
    }
    function taskChartHtml() {
        let log = {};
        try { log = JSON.parse(localStorage.getItem('zdTaskLog') || '{}'); } catch (e) {}
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const k = d.toISOString().slice(0, 10);
            days.push({ label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), v: log[k] || null });
        }
        return `<div class="flex items-end gap-1.5 h-16 mb-2 mt-1">` + days.map(x => {
            const pct = x.v && x.v.t ? Math.round(x.v.d / x.v.t * 100) : 0;
            return `<div class="flex-1 flex flex-col items-center gap-0.5" title="${x.v ? x.v.d + '/' + x.v.t + ' tasks' : 'no data'}">
                <div class="w-full rounded-t-md transition-all" style="height:${Math.max(4, pct * 0.55)}px;background:${x.v ? 'rgb(var(--accent-rgb) / 0.85)' : 'rgba(140,140,150,0.2)'}"></div>
                <span class="text-[8px] text-muted">${x.label}</span>
            </div>`;
        }).join('') + `</div><div class="text-[9px] text-muted">7-day completion rate \u00b7 logged locally on this device</div>`;
    }

    /* ---------- TIME MACHINE: local version snapshots (localStorage) ---------- */
    function pushDocSnapshot() {
        if (!state.docId || state.isGuest) return;
        try {
            const key = 'zdVer_' + state.docId;
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            const ops = quill.getContents().ops;
            const cur = JSON.stringify(ops);
            if (arr.length) {
                const last = arr[arr.length - 1];
                if (Math.abs(cur.length - last.o.length) < 60 && Date.now() - last.t < 120000) return;
                if (cur === last.o) return;
            }
            arr.push({ t: Date.now(), o: cur });
            while (arr.length > 12) arr.shift();
            localStorage.setItem(key, JSON.stringify(arr));
        } catch (e) { /* quota — silently skip */ }
    }
    window.openTimeMachine = () => {
        if (!state.docId) { showToast('Open a note first.'); return; }
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem('zdVer_' + state.docId) || '[]'); } catch (e) {}
        if (!arr.length) { showToast('No local snapshots yet \u2014 they\u2019re taken automatically as you write.'); return; }
        window._tmArr = arr;
        const slider = document.getElementById('tm-slider');
        slider.max = arr.length - 1; slider.value = arr.length - 1;
        renderTmPreview(arr.length - 1);
        document.getElementById('tm-modal').classList.add('open');
    };
    window.closeTimeMachine = () => document.getElementById('tm-modal').classList.remove('open');
    /* V3.8.1: word-level LCS diff — snapshot words that differ from the
       current note are highlighted, Google-Docs style. Full document shown. */
    function tmDiffHtml(snapText, curText) {
        const A = snapText.split(/(\s+)/);
        const a = A.filter(x => x.trim()), b = curText.split(/\s+/).filter(x => x);
        if (a.length > 1400 || b.length > 1400) return escapeHtml(snapText);
        const n = a.length, m2 = b.length;
        const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m2 + 1));
        for (let i = n - 1; i >= 0; i--) for (let j = m2 - 1; j >= 0; j--)
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        const common = new Set();
        let i = 0, j = 0;
        while (i < n && j < m2) {
            if (a[i] === b[j]) { common.add(i); i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
            else j++;
        }
        let out = '', wi = 0;
        A.forEach(tok => {
            if (!tok.trim()) { out += escapeHtml(tok); return; }
            out += common.has(wi) ? escapeHtml(tok) : '<span class="tm-mark">' + escapeHtml(tok) + '</span>';
            wi++;
        });
        return out;
    }
    window.renderTmPreview = (i) => {
        const snap = window._tmArr[+i]; if (!snap) return;
        const d = new Date(snap.t);
        document.getElementById('tm-time').textContent =
            (+i + 1) + ' / ' + window._tmArr.length + ' · ' + d.toLocaleString();
        let text = '';
        try { JSON.parse(snap.o).forEach(op => { if (typeof op.insert === 'string') text += op.insert; }); } catch (e) {}
        document.getElementById('tm-preview').innerHTML = tmDiffHtml(text, quill.getText());
    };
    window.tmRestore = () => {
        const i = +document.getElementById('tm-slider').value;
        const snap = window._tmArr[i]; if (!snap) return;
        try {
            quill.setContents({ ops: JSON.parse(snap.o) }, 'user'); /* undo-able + autosaves */
            scanInlineTokens(false);
            closeTimeMachine();
            showToast('Restored snapshot from ' + new Date(snap.t).toLocaleTimeString() + ' \u2014 Ctrl+Z to undo.');
        } catch (e) { showToast('Could not restore this snapshot.'); }
    };

    /* ============================================================
       V3.9 — PWA INSTALL, FEATURE SWITCHES, REMINDERS, HAPTICS
    ============================================================ */

    /* ---------- haptics ---------- */
    function zdBuzz(p) { try { if (navigator.vibrate) navigator.vibrate(p || 18); } catch (e) {} }

    /* ---------- PWA: service worker + custom install popup ---------- */
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
    }
    var zdDeferredPrompt = null;
    function zdStandalone() {
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    }
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        zdDeferredPrompt = e;
        maybeShowInstall();
    });
    window.addEventListener('appinstalled', () => {
        localStorage.setItem('zdInstalled', '1');
        hideInstallPop();
        zdBuzz([30, 40, 30]);
        showToast('ZenDocs installed. Find it with your apps!');
    });
    function maybeShowInstall() {
        if (zdStandalone() || localStorage.getItem('zdInstalled')) return;
        const dis = +localStorage.getItem('zdInstDis') || 0;
        // if (Date.now() - dis < 7 * 864e5) return; /* respect "Not now" for a week */
        if (window._zdInstDismissed) return; /* dismissed — until the next page load */
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (!zdDeferredPrompt && !isIOS) return; /* browser can't install (or already installed) */
        document.getElementById('pwa-ios-steps').classList.toggle('hidden', !isIOS || !!zdDeferredPrompt);
        document.getElementById('pwa-install-btn').classList.remove('hidden');
        document.getElementById('pwa-pop').classList.remove('translate-y-full');
    }
    window.hideInstallPop = (dismiss) => {
        document.getElementById('pwa-pop').classList.add('translate-y-full');
        // if (dismiss) localStorage.setItem('zdInstDis', Date.now());
        if (dismiss) window._zdInstDismissed = true;
    };
    window.pwaInstall = async () => {
        if (!zdDeferredPrompt) return;
        zdDeferredPrompt.prompt();
        const { outcome } = await zdDeferredPrompt.userChoice;
        zdDeferredPrompt = null;
        // if (outcome !== 'accepted') localStorage.setItem('zdInstDis', Date.now());
        if (outcome !== 'accepted') window._zdInstDismissed = true;
        hideInstallPop();
    };

    /* ---------- FEATURE SWITCHES (device-local, never synced) ---------- */
    var ZD_FEATURES = [
        { id: 'home', label: 'Home dashboard', fns: ['openHome'] },
        { id: 'daily', label: 'Daily note (Today)', fns: ['openDailyNote'] },
        { id: 'calendar', label: 'Month calendar', fns: ['openCalendar'] },
        { id: 'board', label: 'Kanban board', fns: ['openKanban'] },
        { id: 'canvas', label: 'Canvas', fns: ['openCanvas'] },
        { id: 'templates', label: 'Templates', fns: ['openTemplates'] },
        { id: 'graph', label: 'Graph view', fns: ['openGraph'] },
        { id: 'ai', label: 'Local AI (summary & tags)', fns: ['openAiPanel'] },
        { id: 'study', label: 'Study mode', fns: ['openStudy'] },
        { id: 'tm', label: 'Time machine', fns: ['openTimeMachine'] },
        { id: 'dt', label: 'Deep Think map', fns: ['toggleDeepThink'] },
        { id: 'folds', label: 'Collapsible headings', fns: [] },
        // { id: 'taskbar', label: 'Task progress bar', fns: [] },
        { id: 'rem', label: 'Reminders', fns: ['openReminders'] }
    ];
    function zdFlags() {
        try { return JSON.parse(localStorage.getItem('zdFeat') || '{}'); } catch (e) { return {}; }
    }
    window.zdFeatOn = (id) => zdFlags()[id] !== false;
    const zdOrigFns = {};
    function applyFeatureFlags() {
        const flags = zdFlags();
        let offCount = 0;
        ZD_FEATURES.forEach(f => {
            const on = flags[f.id] !== false;
            if (!on) offCount++;
            f.fns.forEach(fn => {
                if (!zdOrigFns[fn] && typeof window[fn] === 'function') zdOrigFns[fn] = window[fn];
                if (!zdOrigFns[fn]) return;
                window[fn] = on ? zdOrigFns[fn] : function () {
                    showToast(f.label + ' is turned off on this device.');
                    openFeatures();
                };
                document.querySelectorAll('[onclick^="' + fn + '"]').forEach(el => {
                    el.classList.toggle('zd-feat-off', !on);
                });
            });
        });
        // if (!zdFeatOn('taskbar')) document.getElementById('task-progress').classList.add('hidden');
        // else updateTaskProgress();
        if (!zdFeatOn('folds')) { const g = document.getElementById('fold-gutter'); if (g) g.innerHTML = ''; }
        else scheduleFolds();
        if (!zdFeatOn('dt')) document.getElementById('dt-pane').classList.remove('open');
        /* the unobtrusive "not full features" hint */
        document.querySelectorAll('.feat-dot').forEach(d => d.classList.toggle('hidden', offCount === 0));
        const fc = document.getElementById('feat-count');
        if (fc) fc.textContent = offCount ? offCount + ' of ' + ZD_FEATURES.length + ' features are hidden on this device — they still exist in your account and on other devices.' : 'All features are on — you\u2019re using the full ZenDocs.';
        return offCount;
    }
    window.openFeatures = () => { renderFeatures(); document.getElementById('feat-modal').classList.add('open'); };
    window.closeFeatures = () => document.getElementById('feat-modal').classList.remove('open');
    window.featToggle = (id) => {
        const flags = zdFlags();
        flags[id] = flags[id] === false ? true : false;
        localStorage.setItem('zdFeat', JSON.stringify(flags));
        zdBuzz(12);
        applyFeatureFlags(); renderFeatures();
    };
    window.featReset = () => {
        localStorage.removeItem('zdFeat');
        zdBuzz([15, 30, 15]);
        applyFeatureFlags(); renderFeatures();
        showToast('All features restored — full ZenDocs.');
    };
    function renderFeatures() {
        const flags = zdFlags();
        document.getElementById('feat-list').innerHTML = ZD_FEATURES.map(f => {
            const on = flags[f.id] !== false;
            return `<div class="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                <span class="text-xs text-text">${f.label}</span>
                <button onclick="featToggle('${f.id}')" class="zd-sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}"><span class="zd-sw-knob"></span></button>
            </div>`;
        }).join('');
        applyFeatureFlags();
    }

    /* ---------- REMINDERS (device-local; fire while ZenDocs is open/installed) ---------- */
    function zdRems() { try { return JSON.parse(localStorage.getItem('zdRems') || '{}'); } catch (e) { return {}; } }
    function zdSaveRems(r) { try { localStorage.setItem('zdRems', JSON.stringify(r)); } catch (e) {} }
    window.openReminders = () => {
        const box = document.getElementById('rem-set-box');
        if (state.docId && !state.isGuest) {
            box.classList.remove('hidden');
            const cur = zdRems()[state.docId];
            const inp = document.getElementById('rem-when');
            const d = cur ? new Date(cur.t) : new Date(Date.now() + 3600e3);
            const pad = (n) => String(n).padStart(2, '0');
            inp.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
            document.getElementById('rem-cur-title').textContent = els.title.value || 'Untitled';
        } else box.classList.add('hidden');
        renderRemList();
        document.getElementById('rem-modal').classList.add('open');
    };
    window.closeReminders = () => document.getElementById('rem-modal').classList.remove('open');

    window.setReminder = async () => {
        if (!state.docId) return;
        const v = document.getElementById('rem-when').value;
        if (!v) { showToast('Pick a date & time first.'); return; }
        const t = new Date(v).getTime();
        if (!(t > Date.now())) { showToast('That time is in the past.'); return; }

        if ('Notification' in window && Notification.permission === 'default') {
            try { await Notification.requestPermission(); } catch (e) {}
        }

        const r = zdRems();
        r[state.docId] = { t: t, title: els.title.value || 'Untitled', fired: false };
        zdSaveRems(r); 
        zdBuzz(20);
        renderRemList();

        // EXPERIMENTAL: Schedule true background notification if supported (Android Chrome)
        if ('showTrigger' in Notification.prototype && navigator.serviceWorker) {
            try {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification('⏰ ZenDocs Reminder', {
                    body: els.title.value || 'Untitled Document',
                    icon: './icon-192.png',
                    badge: './icon-192.png',
                    tag: 'zd-' + state.docId,
                    showTrigger: new TimestampTrigger(t) // Tells the OS to fire this even if closed
                });
            } catch (err) {
                console.warn('Offline notification trigger failed or unsupported:', err);
            }
        }

        showToast('Reminder set for ' + new Date(t).toLocaleString() + '.');

        // Trigger the background warning modal reliably
        if (!sessionStorage.getItem('zdBgShown')) {
            sessionStorage.setItem('zdBgShown', '1');
            document.getElementById('rem-bg-modal').classList.add('open');
        }
    };
        
    window.clearReminder = (docId) => {
        const r = zdRems(); delete r[docId]; zdSaveRems(r);
        renderRemList(); zdBuzz(12);
    };
    function renderRemList() {
        const r = zdRems();
        const ids = Object.keys(r).sort((a, b) => r[a].t - r[b].t);
        document.getElementById('rem-list').innerHTML = ids.length ? ids.map(id => `
            <div class="flex items-center gap-2 py-1.5 border-b border-border/60 last:border-0">
                <svg class="w-3.5 h-3.5 ${r[id].t < Date.now() ? 'text-amber-500' : 'text-accent'} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                <button onclick="openDocById('${id}'); closeReminders()" class="flex-1 text-left min-w-0">
                    <div class="text-xs text-text truncate">${escapeHtml(r[id].title)}</div>
                    <div class="text-[9px] ${r[id].t < Date.now() ? 'text-amber-500 font-semibold' : 'text-muted'}">${r[id].t < Date.now() ? 'overdue \u00b7 ' : ''}${new Date(r[id].t).toLocaleString()}</div>
                </button>
                <button onclick="clearReminder('${id}')" class="text-muted hover:text-danger text-base leading-none px-1 active:scale-90">\u00d7</button>
            </div>`).join('') : '<div class="text-[10px] text-muted py-3 text-center">No reminders yet. Open a note and set one above.</div>';
    }
    window.openDocById = (id) => {
        const d = state.docs.find(x => x.id === id);
        if (d) openDoc(d); else showToast('That note is no longer available.');
    };
    function fireReminder(id, rem) {
        zdBuzz([200, 100, 200]);
        showToast('\u23F0 Reminder: ' + rem.title);
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const n = new Notification('ZenDocs reminder', { body: rem.title, icon: './icon-192.png', badge: './icon-192.png', tag: 'zd-' + id });
                n.onclick = () => { window.focus(); openDocById(id); n.close(); };
            } catch (e) {
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                    navigator.serviceWorker.ready.then(reg => reg.showNotification('ZenDocs reminder', { body: rem.title, icon: './icon-192.png', tag: 'zd-' + id })).catch(() => {});
                }
            }
        }
    }
    setInterval(() => {
        if (!zdFeatOn('rem')) return;
        const r = zdRems(); let dirty = false;
        Object.keys(r).forEach(id => {
            if (!r[id].fired && r[id].t <= Date.now()) { r[id].fired = true; dirty = true; fireReminder(id, r[id]); }
        });
        if (dirty) zdSaveRems(r);
    }, 20000);


