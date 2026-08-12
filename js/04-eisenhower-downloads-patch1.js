// ZenDocs — 04-eisenhower-downloads-patch1.js
// V4.1/V4.2 Eisenhower matrix, V4.3 production patch (calendar quick-view, Eisenhower due-time notifications, Pomodoro, read-aloud, full backup).
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
       V4.0 — APP DOWNLOADS, SNOOZABLE REMINDERS, SW MESSAGING
    ============================================================ */

    /* Paste your package links here after building them with PWABuilder
       (see README steps). Empty = the row shows "Coming soon". */
    const ZD_APP_LINKS = {
        // android: 'https://github.com/harshavarthanep/NotesV2/releases/download/App/ZenDocs.apk',   // e.g. https://github.com/YOU/REPO/releases/download/v1/ZenDocs.apk
        android: 'https://release-assets.githubusercontent.com/github-production-release-asset/1268626700/c36348ed-71cc-4ac7-a243-7f50204c07b3?sp=r&sv=2018-11-09&sr=b&spr=https&se=2026-07-23T01%3A14%3A14Z&rscd=attachment%3B+filename%3DZenDocs.apk&rsct=application%2Fvnd.android.package-archive&skoid=96c2d410-5711-43a1-aedd-ab1947aa7ab0&sktid=398a6654-997b-47e9-b12b-9515b896b4de&skt=2026-07-23T00%3A13%3A45Z&ske=2026-07-23T01%3A14%3A14Z&sks=b&skv=2018-11-09&sig=fRammUHnDee01l3X2nFIK1eBoWjxZWWjxJ4KuUFALMc%3D&jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmVsZWFzZS1hc3NldHMuZ2l0aHVidXNlcmNvbnRlbnQuY29tIiwia2V5Ijoia2V5MSIsImV4cCI6MTc4NDc2NTkyNSwibmJmIjoxNzg0NzY1NjI1LCJwYXRoIjoicmVsZWFzZWFzc2V0cHJvZHVjdGlvbi5ibG9iLmNvcmUud2luZG93cy5uZXQifQ.vb6L7tfIy7dR1W_dObYXRr6XRwZKuOIYckHLXcmA8TM&response-content-disposition=attachment%3B%20filename%3DZenDocs.apk&response-content-type=application%2Fvnd.android.package-archive',
        windows: 'https://github.com/harshavarthanep/NotesV2/releases/download/App/ZenDocs.sideload.msix',   // .msix from PWABuilder
        linux: '',     // e.g. Nativefier build
        mac: ''        // e.g. Nativefier .app zip
    };

    window.openGetApp = () => {
        hideInstallPop(true);
        const list = document.getElementById('getapp-list');
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const ICONS = {
            android: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-muted"><path d="M6 18a1 1 0 001 1h1v3.5a1.5 1.5 0 003 0V19h2v3.5a1.5 1.5 0 003 0V19h1a1 1 0 001-1V8H6v10zM3.5 8A1.5 1.5 0 002 9.5v6a1.5 1.5 0 003 0v-6A1.5 1.5 0 003.5 8zm17 0A1.5 1.5 0 0019 9.5v6a1.5 1.5 0 003 0v-6A1.5 1.5 0 0020.5 8zM15.5 3.9l1-1.8a.3.3 0 00-.5-.3l-1.1 1.9a6.3 6.3 0 00-5.8 0L8 1.8a.3.3 0 00-.5.3l1 1.8A5.6 5.6 0 006 7h12a5.6 5.6 0 00-2.5-3.1zM9.5 5.5a.6.6 0 110-1.2.6.6 0 010 1.2zm5 0a.6.6 0 110-1.2.6.6 0 010 1.2z"/></svg>',
            win: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-muted"><path d="M3 5.6l8-1.1v7.3H3V5.6zm0 12.8l8 1.1v-7.2H3v6.1zM12 4.3L22 3v8.8H12V4.3zm0 15.4L22 21v-8.8H12v7.5z"/></svg>',
            linux: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 text-muted"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3a3 3 0 016 0c0 1.5-1 3-1 5 0 3 3 5 3 9a4 4 0 01-4 3H8a4 4 0 01-4-3c0-4 3-6 3-9 0-2-1-3.5-1-5"/></svg>',
            apple: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-muted"><path d="M16.4 12.9c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.5 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6 1.7-1 2.4-2c.7-1.1 1-2.1 1-2.2 0 0-1.9-.7-2.3-2.4zM14.7 6.6c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1z"/></svg>',
            // phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 text-muted"><rect x="7" y="2" width="10" height="20" rx="2"/><path stroke-linecap="round" d="M11 18h2"/></svg>'
            phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6 text-muted -ml-0.5"><rect x="5" y="2" width="14" height="20" rx="2.5"/><path stroke-linecap="round" d="M12 18h.01"/></svg>'
        };
        // const row = (icon, label, desc, url) => url
        //     ? `<a class="ga-row" href="${url}" target="_blank" rel="noopener">${icon}<span class="min-w-0"><span class="block text-xs font-semibold text-text">${label}</span><span class="block text-[10px] text-muted">${desc}</span></span></a>`
        //     : `<button class="ga-row" disabled>${icon}<span class="min-w-0"><span class="block text-xs font-semibold text-text">${label}</span><span class="block text-[10px] text-muted">Coming soon</span></span></button>`;
        // Helper: isBinary triggers direct download in the same tab instead of opening a blank tab
        const row = (icon, label, desc, url, isBinary = false) => url
            ? `<a class="ga-row" href="${url}" ${isBinary ? 'download' : 'target="_blank" rel="noopener"'}>${icon}<span class="min-w-0"><span class="block text-xs font-semibold text-text">${label}</span><span class="block text-[10px] text-muted">${desc}</span></span></a>`
            : `<button class="ga-row" disabled>${icon}<span class="min-w-0"><span class="block text-xs font-semibold text-text">${label}</span><span class="block text-[10px] text-muted">Coming soon</span></span></button>`;
            
        list.innerHTML =
            row(ICONS.android, 'Android (.apk)', 'Real app — clean native-style notifications', ZD_APP_LINKS.android, true) +
            row(ICONS.win, 'Windows', 'Installable package (.msix)', ZD_APP_LINKS.windows, true) +
            row(ICONS.linux, 'Linux', 'Desktop package', ZD_APP_LINKS.linux) +
            row(ICONS.apple, 'macOS', 'Desktop package', ZD_APP_LINKS.mac) +
            `<div class="ga-row" style="pointer-events:none">${ICONS.phone}<span class="min-w-0"><span class="block text-xs font-semibold text-text">iPhone / iPad</span><span class="block text-[10px] text-muted">Apple only allows installs via the App Store. Use Safari → Share → <b>Add to Home Screen</b> instead.</span></span></div>`;
        document.getElementById('ga-pwa-btn').onclick = () => {
            if (zdDeferredPrompt) { pwaInstall(); closeGetApp(); }
            else if (isIOS) { showToast('Safari → Share → Add to Home Screen'); }
            else { showToast('Browser menu (⋮) → "Install app" / "Add to Home screen".'); }
        };
        document.getElementById('getapp-modal').classList.add('open');
    };
    window.closeGetApp = () => document.getElementById('getapp-modal').classList.remove('open'); 

    /* --- snoozable reminders (overrides the V3.9 fireReminder) --- */
    var _rfId = null;
    fireReminder = function (id, rem) {
        zdBuzz([200, 100, 200]);
        _rfId = id;
        document.getElementById('rf-title').textContent = rem.title;
        document.getElementById('rem-fire-modal').classList.add('open');
        const opts = { body: rem.title, icon: './icon-192.png', badge: './icon-192.png', tag: 'zd-' + id, renotify: true };
        const fallbackNotif = () => {
            try {
                const n = new Notification('ZenDocs reminder', opts);
                n.onclick = () => { window.focus(); openDocById(id); n.close(); };
            } catch (e) {}
        };
        if ('Notification' in window && Notification.permission === 'granted') {
            if (navigator.serviceWorker) {
                navigator.serviceWorker.ready.then(reg =>
                    reg.showNotification('ZenDocs reminder', Object.assign({}, opts, {
                        actions: [{ action: 'snooze', title: 'Snooze 10 min' }, { action: 'open', title: 'Open note' }]
                    }))
                ).catch(fallbackNotif);
            } else { fallbackNotif(); }
        }
    };
    window.snoozeReminder = (id, mins) => {
        const r = zdRems(); if (!r[id]) return;
        r[id].t = Date.now() + mins * 60000; r[id].fired = false;
        zdSaveRems(r); renderRemList(); zdBuzz(15);
        showToast('Snoozed until ' + new Date(r[id].t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    window.rfSnooze = (m) => { if (_rfId) snoozeReminder(_rfId, m); closeRemFire(); };
    window.rfOpen = () => { if (_rfId) openDocById(_rfId); closeRemFire(); };
    window.rfDismiss = () => closeRemFire();
    window.closeRemFire = () => { document.getElementById('rem-fire-modal').classList.remove('open'); _rfId = null; };
    window.closeRemBg = () => document.getElementById('rem-bg-modal').classList.remove('open');

    /* --- setting a reminder shows the keep-in-background notice once per session --- */

    /* --- notification button clicks arrive from the service worker --- */
    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', (e) => {
            const d = e.data || {};
            const id = String(d.tag || '').replace('zd-', '');
            if (d.type === 'zd-snooze' && id) snoozeReminder(id, 10);
            if (d.type === 'zd-open' && id) openDocById(id);
        });
    }    

    /* boot: apply flags + offer install shortly after load */
    setTimeout(applyFeatureFlags, 400);
    setTimeout(() => { try { maybeShowInstall(); } catch (e) {} }, 3000);

    /* ============================================================
       KEYBOARD SHORTCUTS
    ============================================================ */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (state.offlineMode) { toggleOfflineMode(); return; }
            if (state.docId && !state.isGuest) saveToDb();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (!state.isGuest) openPalette();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
            e.preventDefault();
            if (!state.isGuest) {
                els.graphModal.classList.contains('open') ? closeGraph() : openGraph();
            }
        }
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'y' && quill.hasFocus()) {
            e.preventDefault(); quill.history.redo(); return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
            e.preventDefault();
            if (!state.isGuest) toggleReadingMode();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '.') {
            e.preventDefault();
            if (!state.isGuest) toggleZenMode();
        }
        if (e.key === 'Escape') {
            if (document.body.classList.contains('zen')) { toggleZenMode(); return; }
            closeHelp(); closeDownloadMenu(); closeCommentModal(); closeInfoModal(); closePalette();
            closeGraph();
            hideSuggester(); closeNotePicker(); /* V3.1 */
            closeLinkModal(); closeDayDetail(); closeCalPicker(); /* V3.2 */
            closeAppearance(); /* V3.4 */
            closeKbCardModal(); /* V3.5 */
            if (window.closeHome) closeHome(); /* V3.6 */
            closeImgViewer(); closeFolderMenu(); closeAiPanel(); closeStudy(); closeTimeMachine(); /* V3.8 */
            document.getElementById('more-menu').classList.add('hidden');
            closeFeatures(); closeReminders(); hideInstallPop(); /* V3.9 */
            closeGetApp(); closeRemFire(); closeRemBg(); /* V4.0 */
            document.getElementById('stats-pop').classList.add('hidden');
            document.getElementById('dt-pane').classList.remove('open');
            closeCalendar(); closeKanban(); closeCanvas(); closeTemplates(); /* V3.1 */
            els.lsMenu.classList.add('hidden');
            closeFolderDd();
        }
    });

    document.addEventListener('click', (e) => {
        const menu = els.mobileMenuDropdown;
        if (!menu.classList.contains('hidden') && !e.target.closest('.mobile-menu-container') && !menu.contains(e.target))
            menu.classList.add('hidden');
        const fm = els.mobileFolderMenu;
        if (!fm.classList.contains('hidden') && !e.target.closest('.folder-menu-container') && !e.target.closest('#m-folder-btn'))
            fm.classList.add('hidden');
        if (!els.lsMenu.classList.contains('hidden') && !e.target.closest('#ls-menu') && !e.target.closest('#ls-btn'))
            els.lsMenu.classList.add('hidden');
        if (els.folderDdMenu && !els.folderDdMenu.classList.contains('hidden') && !e.target.closest('#folder-dd-wrap'))
            closeFolderDd();
        const cp = document.getElementById('cal-picker'); /* V3.2 */
        if (cp && !cp.classList.contains('hidden') && !e.target.closest('#cal-picker') && e.target.id !== 'cal-title')
            cp.classList.add('hidden');
        const ap = document.getElementById('appearance-pop'); /* V3.4 */
        if (ap && !ap.classList.contains('hidden') && !e.target.closest('#appearance-pop') && !e.target.closest('#appearance-btn'))
            ap.classList.add('hidden');
        const zfm = document.getElementById('folder-menu'); /* V3.8 */
        if (zfm && !zfm.classList.contains('hidden') && !e.target.closest('#folder-menu')) zfm.classList.add('hidden');
        const zmm = document.getElementById('more-menu');
        if (zmm && !zmm.classList.contains('hidden') && !e.target.closest('#more-menu') && !e.target.closest('#more-btn')) zmm.classList.add('hidden');
        const zsp = document.getElementById('stats-pop');
        if (zsp && !zsp.classList.contains('hidden') && !e.target.closest('#stats-pop') && !e.target.closest('[onclick^="toggleStatsPop"]')) zsp.classList.add('hidden');
    });

    /* ============================================================
       MOBILE TOOLBAR POSITION TOGGLE
    ============================================================ */
    window.toggleToolbarPosition = function() {
        const isBottom = document.body.classList.toggle('toolbar-bottom');
        localStorage.setItem('zdToolbarPos', isBottom ? 'bottom' : 'top');
        const icon = document.getElementById('toolbar-pos-icon');
        if (icon) { icon.style.transform = isBottom ? 'rotate(180deg)' : 'rotate(0deg)'; }
        showToast(isBottom ? '⬇ Toolbar moved to bottom' : '⬆ Toolbar moved to top');
    };

    function initToolbarPosition() {
        if (window.innerWidth > 850) return;
        if (localStorage.getItem('zdToolbarPos') === 'bottom') {
            document.body.classList.add('toolbar-bottom');
            const icon = document.getElementById('toolbar-pos-icon');
            if (icon) icon.style.transform = 'rotate(180deg)';
        }
    }

    /* ============================================================
       MOBILE KEYBOARD TOOLBAR DOCKING FIX
    ============================================================ */
    if (window.visualViewport) {
        const updateKeyboardOffset = () => {
            const offset = window.innerHeight - window.visualViewport.height;
            document.documentElement.style.setProperty('--keyboard-offset', `${Math.max(0, offset)}px`);
        };
        window.visualViewport.addEventListener('resize', updateKeyboardOffset);
        window.visualViewport.addEventListener('scroll', updateKeyboardOffset);
        updateKeyboardOffset();
    }

     // New Code
     /* ============================================================
       V4.1 — EISENHOWER MATRIX
       Fields on each note doc: eis ('do'|'schedule'|'delegate'|'eliminate'|null),
       eisDue (ms timestamp | null), eisDone (bool). Same pattern as `kanban`,
       so no Firestore rules changes are needed. All rendering is local-first.
    ============================================================ */
    const EIS_QUADS = [
        { id: 'do',        label: 'Do first',  sub: 'Urgent · Important',         color: '#e11d48' },
        { id: 'schedule',  label: 'Schedule',  sub: 'Not urgent · Important',     color: '#1a73e8' },
        { id: 'delegate',  label: 'Delegate',  sub: 'Urgent · Not important',     color: '#f59e0b' },
        { id: 'eliminate', label: 'Eliminate', sub: 'Not urgent · Not important', color: '#6b7280' }
    ];
    let _eisSec = null, _eisDueTarget = null;
    let _eisView = localStorage.getItem('zdEisView') || 'list';
    
    function eisDocs(q) { return state.docs.filter(d => d.eis === q); }
    function eisDayDiff(ts) {
        const a = new Date(); a.setHours(0, 0, 0, 0);
        const b = new Date(ts); b.setHours(0, 0, 0, 0);
        return Math.round((b - a) / 864e5);
    }
    function eisChipHtml(d, clickable) {
        if (!d.eisDue) return clickable
            ? `<button onclick="event.stopPropagation(); openEisDue('${d.id}')" title="Set due date" class="eis-chip eis-chip-add">+ due</button>` : '';
        const diff = eisDayDiff(d.eisDue);
        let cls = 'eis-chip-ok';
        let txt = new Date(d.eisDue).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        if (d.eisDone) cls = 'eis-chip-done';
        else if (diff < 0) { cls = 'eis-chip-over'; txt = 'Overdue · ' + txt; }
        else if (diff === 0) { cls = 'eis-chip-soon'; txt = 'Today'; }
        else if (diff === 1) { cls = 'eis-chip-soon'; txt = 'Tomorrow'; }
        else if (diff <= 3) { cls = 'eis-chip-soon'; }
        return clickable
            ? `<button onclick="event.stopPropagation(); openEisDue('${d.id}')" title="Change due date" class="eis-chip ${cls}">${txt}</button>`
            : `<span class="eis-chip ${cls}">${txt}</span>`;
    }
    function eisSort(arr) {
        return arr.slice().sort((a, b) => {
            if (!!a.eisDone !== !!b.eisDone) return a.eisDone ? 1 : -1; /* done sinks */
            const ad = a.eisDue || Infinity, bd = b.eisDue || Infinity;
            if (ad !== bd) return ad - bd; /* earliest due first */
            return (((b.updatedAt && b.updatedAt.seconds) || 0) - ((a.updatedAt && a.updatedAt.seconds) || 0));
        });
    }
    
    /* ---------- matrix view ---------- */
    window.openEisenhower = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        closeAllViews();
        document.getElementById('eis-modal').classList.add('open');
        renderEisenhower();
    };
    window.closeEisenhower = () => {
        const m = document.getElementById('eis-modal');
        if (m) m.classList.remove('open');
        closeEisSection(); closeEisDue();
    };
    function renderEisenhower() {
        const grid = document.getElementById('eis-grid'); if (!grid) return;
        grid.innerHTML = '';
        EIS_QUADS.forEach(q => {
            const docs = eisDocs(q.id);
            const open = docs.filter(d => !d.eisDone);
            const done = docs.length - open.length;
            const preview = eisSort(open).slice(0, 2);
            const tile = document.createElement('div');
            tile.className = 'eis-tile';
            tile.style.setProperty('--eis-c', q.color);
            tile.innerHTML = `
                <div class="flex items-center justify-between mb-0.5">
                    <span class="flex items-center gap-2 min-w-0">
                        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${q.color}"></span>
                        <span class="text-sm font-bold text-text truncate">${q.label}</span>
                    </span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style="background:${q.color}1a;color:${q.color}">${open.length}${done ? ' · ' + done + ' ✓' : ''}</span>
                </div>
                <div class="text-[10px] text-muted mb-2">${q.sub}</div>
                <div class="space-y-1 min-h-[38px]">
                    ${preview.length ? preview.map(d => `
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="text-[11px] text-text truncate flex-1">${escapeHtml(d.title || 'Untitled')}</span>
                            ${eisChipHtml(d, false)}
                        </div>`).join('') : '<div class="text-[10px] text-muted italic">No notes yet</div>'}
                </div>
                <div class="flex items-center justify-between mt-2.5 pt-2 border-t" style="border-color:var(--border-color)">
                    <span class="text-[10px] text-muted">Tap to open</span>
                    <span class="eis-add text-[10px] font-semibold px-2.5 py-1 rounded-full transition active:scale-95" style="background:${q.color}1a;color:${q.color}">+ Add note</span>
                </div>`;
            tile.onclick = (e) => {
                if (e.target.closest('.eis-add')) {
                    openNotePicker(d => setEis(d.id, q.id), 'Add to \u201c' + q.label + '\u201d');
                    return;
                }
                openEisSection(q.id);
            };
            grid.appendChild(tile);
        });
    }   
    /* ---------- data ops (optimistic, snapshot confirms) ---------- */
    window.setEis = async (docId, quad) => {
        const d = state.docs.find(x => x.id === docId); if (!d) return;
        d.eis = quad;
        const upd = { eis: quad };
        if (!quad) { d.eisDone = false; d.eisDue = null; upd.eisDone = false; upd.eisDue = null; }
        renderEisenhower(); if (_eisSec) renderEisSection();
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').doc(docId).update(upd);
            const ql = EIS_QUADS.find(x => x.id === quad);
            showToast(quad ? 'Added to \u201c' + ql.label + '\u201d.' : 'Removed from the matrix.');
        } catch (e) { console.error(e); showToast('Could not update — check your connection.'); }
    };
    window.eisToggleDone = async (docId) => {
        const d = state.docs.find(x => x.id === docId); if (!d) return;
        d.eisDone = !d.eisDone;
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
        renderEisenhower(); if (_eisSec) renderEisSection();
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').doc(docId).update({ eisDone: !!d.eisDone });
            if (d.eisDone) showToast('✓ Marked complete.');
        } catch (e) { console.error(e); showToast('Could not update.'); }
    };
    window.eisRemove = async (docId) => {
        const d = state.docs.find(x => x.id === docId); if (!d) return;
        const ok = await zdConfirm(`"${d.title || 'Untitled'}" leaves the matrix. The note itself is kept.`, { title: 'Remove from matrix?', okText: 'Remove', danger: true });
        if (ok) setEis(docId, null);
    };
    
    /* ---------- quadrant detail modal ---------- */
    window.openEisSection = (qid) => {
        _eisSec = qid;
        renderEisSection();
        document.getElementById('eis-sec-modal').classList.add('open');
    };
    window.closeEisSection = () => {
        const m = document.getElementById('eis-sec-modal');
        if (m) m.classList.remove('open');
        _eisSec = null;
    };
    window.setEisView = (v) => { _eisView = v; localStorage.setItem('zdEisView', v); renderEisSection(); };
    window.eisSectionAdd = () => {
        const q = _eisSec; if (!q) return;
        const ql = EIS_QUADS.find(x => x.id === q);
        openNotePicker(d => setEis(d.id, q), 'Add to \u201c' + ql.label + '\u201d');
    };
    function renderEisSection() {
        if (!_eisSec) return;
        const q = EIS_QUADS.find(x => x.id === _eisSec);
        const docs = eisSort(eisDocs(_eisSec));
        document.getElementById('eis-sec-dot').style.background = q.color;
        document.getElementById('eis-sec-title').textContent = q.label;
        document.getElementById('eis-sec-sub').textContent = q.sub + ' · ' + docs.filter(d => !d.eisDone).length + ' open · ' + docs.filter(d => d.eisDone).length + ' done';
        const on = 'px-3 py-1 text-[10px] font-semibold rounded-full bg-accent text-white transition';
        const off = 'px-3 py-1 text-[10px] font-semibold rounded-full text-muted hover:text-text transition';
        document.getElementById('eis-view-list').className = _eisView === 'list' ? on : off;
        document.getElementById('eis-view-folder').className = _eisView === 'folder' ? on : off;
        const list = document.getElementById('eis-sec-list');
        list.innerHTML = '';
        if (!docs.length) {
            list.innerHTML = '<div class="text-center text-muted text-xs py-8">No notes here yet.<br>Use \u201c+ Add note\u201d below.</div>';
            return;
        }
        const addRow = (d) => {
            const row = document.createElement('div');
            row.className = 'eis-row' + (d.eisDone ? ' eis-done' : '');
            row.innerHTML = `
                <button class="eis-check ${d.eisDone ? 'on' : ''}" title="${d.eisDone ? 'Mark as not done' : 'Mark complete'}">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </button>
                <button class="eis-open flex-1 min-w-0 text-left">
                    <span class="block text-xs font-medium text-text truncate eis-title">${escapeHtml(d.title || 'Untitled')} ${d.isFavorite ? '<span class="text-gold">★</span>' : ''}</span>
                    <span class="block text-[9px] text-muted">${d.updatedAt ? 'Edited ' + new Date(d.updatedAt.toDate()).toLocaleDateString() : 'Just now'}</span>
                </button>
                <span class="eis-chipwrap flex-shrink-0"></span>
                <button class="eis-x" title="Remove from matrix">×</button>`;
            row.querySelector('.eis-chipwrap').innerHTML = eisChipHtml(d, true);
            row.querySelector('.eis-check').onclick = () => eisToggleDone(d.id);
            row.querySelector('.eis-open').onclick = () => { closeEisSection(); closeEisenhower(); openDoc(d.id, d); };
            row.querySelector('.eis-x').onclick = () => eisRemove(d.id);
            list.appendChild(row);
        };
        if (_eisView === 'folder') {
            const groups = {};
            docs.forEach(d => { const k = d.folderId || ''; (groups[k] = groups[k] || []).push(d); });
            Object.keys(groups).sort((a, b) => (a === '') - (b === '')).forEach(k => {
                const f = state.folders.find(x => x.id === k);
                const h = document.createElement('div');
                h.className = 'text-[9px] font-bold uppercase tracking-wider text-muted px-1 pt-2.5 pb-1 flex items-center gap-1.5';
                h.innerHTML = `<span>${f ? escapeHtml(f.emoji + ' ' + f.name) : '🏠 No folder'}</span><span class="opacity-60">(${groups[k].length})</span>`;
                list.appendChild(h);
                groups[k].forEach(addRow);
            });
        } else {
            docs.forEach(addRow);
        }
    }
    
    /* ---------- due date modal ---------- */
    window.openEisDue = (docId) => {
        const d = state.docs.find(x => x.id === docId); if (!d) return;
        _eisDueTarget = docId;
        document.getElementById('eis-due-title').textContent = d.title || 'Untitled';
        const inp = document.getElementById('eis-due-input');
        const dt = d.eisDue ? new Date(d.eisDue) : new Date(Date.now() + 864e5);
        const pad = n => String(n).padStart(2, '0');
        inp.value = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
        document.getElementById('eis-due-clear').classList.toggle('hidden', !d.eisDue);
        document.getElementById('eis-due-modal').classList.add('open');
    };
    window.closeEisDue = () => {
        const m = document.getElementById('eis-due-modal');
        if (m) m.classList.remove('open');
        _eisDueTarget = null;
    };
    window.eisApplyDue = async () => {
        const id = _eisDueTarget; if (!id) return;
        const v = document.getElementById('eis-due-input').value;
        if (!v) { showToast('Pick a date first.'); return; }
        const ts = new Date(v + 'T23:59:59').getTime();
        if (isNaN(ts)) { showToast('That date is invalid.'); return; }
        const d = state.docs.find(x => x.id === id);
        if (d) d.eisDue = ts;
        closeEisDue();
        renderEisenhower(); if (_eisSec) renderEisSection();
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').doc(id).update({ eisDue: ts });
            showToast('Due ' + new Date(ts).toLocaleDateString() + '.');
        } catch (e) { console.error(e); showToast('Could not save due date.'); }
    };
    window.eisClearDue = async () => {
        const id = _eisDueTarget; if (!id) return;
        const d = state.docs.find(x => x.id === id);
        if (d) d.eisDue = null;
        closeEisDue();
        renderEisenhower(); if (_eisSec) renderEisSection();
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').doc(id).update({ eisDue: null });
            showToast('Due date removed.');
        } catch (e) { console.error(e); showToast('Could not update.'); }
    };
    
    /* ---------- integration hooks (no edits to existing functions needed) ---------- */
    const _eisPrevCloseAll = closeAllViews;
    closeAllViews = function () { _eisPrevCloseAll(); closeEisenhower(); };
    const _eisPrevRefresh = refreshOpenViews;
    refreshOpenViews = function () {
        _eisPrevRefresh();
        const m = document.getElementById('eis-modal');
        if (m && m.classList.contains('open')) { renderEisenhower(); if (_eisSec) renderEisSection(); }
    };
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('eis-due-modal').classList.contains('open')) { closeEisDue(); return; }
        if (document.getElementById('eis-sec-modal').classList.contains('open')) { closeEisSection(); return; }
        closeEisenhower();
    });
    document.getElementById('eis-sec-modal').addEventListener('click', (e) => { if (e.target.id === 'eis-sec-modal') closeEisSection(); });
    document.getElementById('eis-due-modal').addEventListener('click', (e) => { if (e.target.id === 'eis-due-modal') closeEisDue(); });
    try { ZD_FEATURES.push({ id: 'eis', label: 'Eisenhower matrix', fns: ['openEisenhower'] }); } catch (e) {}    

    // New code
    /* ============================================================
   V4.2 — EISENHOWER POLISH
   Note icons everywhere · drag-to-expand tiles · glance viewer.
   Redefines renderEisenhower/renderEisSection from V4.1 — all
   existing callers pick up the new versions automatically.
    ============================================================ */
    const EIS_NOTE_ICO = '<svg class="eis-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>';
    const EIS_QICONS = {
        do:        '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>',
        schedule:  '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4m8-4v4M3 10h18"/></svg>',
        delegate:  '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.4-1.9M17 20H7m10 0v-2a4.4 4.4 0 00-.4-1.9M7 20H2v-2a3 3 0 015.4-1.9M7 20v-2c0-.7.1-1.3.4-1.9a5 5 0 019.2 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
        eliminate: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13"/></svg>'
    };
    function eisTileH(qid) { return Math.max(48, Math.min(340, +localStorage.getItem('zdEisH_' + qid) || 62)); }
    
    /* --- Delta → exact HTML via one hidden Quill (all custom blots included) --- */
    let _eisRenderQ = null;
    function eisRenderHtml(d) {
        try {
            if (!_eisRenderQ) {
                const host = document.createElement('div');
                host.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px;height:0;overflow:hidden;';
                document.body.appendChild(host);
                const inner = document.createElement('div');
                host.appendChild(inner);
                _eisRenderQ = new Quill(inner);
            }
            _eisRenderQ.setContents(d.content || '', 'silent');
            return _eisRenderQ.root.innerHTML;
        } catch (e) { return '<p>' + escapeHtml(docPlainText(d)) + '</p>'; }
    }
    
    /* --- MATRIX TILES v2: quadrant icon, note icons, scrollable + resizable preview --- */
    renderEisenhower = function () {
        const grid = document.getElementById('eis-grid'); if (!grid) return;
        grid.innerHTML = '';
        EIS_QUADS.forEach(q => {
            const docs = eisSort(eisDocs(q.id));
            const open = docs.filter(d => !d.eisDone);
            const done = docs.length - open.length;
            const rows = open.concat(docs.filter(d => d.eisDone)).slice(0, 40);
            const tile = document.createElement('div');
            tile.className = 'eis-tile';
            tile.style.setProperty('--eis-c', q.color);
            tile.innerHTML = `
                <div class="eis-head">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="flex items-center gap-2.5 min-w-0">
                            <span class="eis-qico" style="color:${q.color}">${EIS_QICONS[q.id]}</span>
                            <span class="min-w-0">
                                <span class="block text-sm font-bold text-text truncate leading-tight">${q.label}</span>
                                <span class="block text-[9px] text-muted leading-tight">${q.sub}</span>
                            </span>
                        </span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style="background:${q.color}1a;color:${q.color}">${open.length}${done ? ' · ' + done + ' ✓' : ''}</span>
                    </div>
                </div>
                <div class="eis-body zd-scroll" style="height:${eisTileH(q.id)}px">
                    ${rows.length ? rows.map(d => `
                        <div class="eis-prev-row${d.eisDone ? ' eis-prev-done' : ''}">
                            ${EIS_NOTE_ICO}
                            <span class="eis-prev-title text-[11px] text-text truncate flex-1 min-w-0">${escapeHtml(d.title || 'Untitled')}</span>
                            ${eisChipHtml(d, false)}
                        </div>`).join('') : '<div class="text-[10px] text-muted italic px-1.5 py-2.5">No notes yet — tap "+ Add note".</div>'}
                </div>
                <div class="eis-rs" title="Drag to show more notes"></div>
                <div class="eis-foot">
                    <span class="text-[10px] text-muted">Tap to open</span>
                    <span class="eis-add text-[10px] font-semibold px-2.5 py-1 rounded-full transition active:scale-95" style="background:${q.color}1a;color:${q.color}">+ Add note</span>
                </div>`;
            /* drag-to-expand: pointer drag on the grip; height remembered per quadrant */
            tile.querySelector('.eis-rs').addEventListener('pointerdown', (e) => {
                e.stopPropagation(); e.preventDefault();
                const body = tile.querySelector('.eis-body');
                const sy = e.clientY, sh = body.getBoundingClientRect().height;
                const move = (ev) => { body.style.height = Math.max(48, Math.min(340, sh + (ev.clientY - sy))) + 'px'; };
                const up = (ev) => {
                    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
                    localStorage.setItem('zdEisH_' + q.id, Math.round(Math.max(48, Math.min(340, sh + (ev.clientY - sy)))));
                };
                document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
            });
            tile.onclick = (e) => {
                if (e.target.closest('.eis-rs')) return;
                if (e.target.closest('.eis-add')) {
                    openNotePicker(d => setEis(d.id, q.id), 'Add to \u201c' + q.label + '\u201d');
                    return;
                }
                openEisSection(q.id);
            };
            grid.appendChild(tile);
        });
    };
    
    /* --- QUADRANT LIST v2: note icon + eye (glance) button on every row --- */
    renderEisSection = function () {
        if (!_eisSec) return;
        const q = EIS_QUADS.find(x => x.id === _eisSec);
        const docs = eisSort(eisDocs(_eisSec));
        document.getElementById('eis-sec-dot').style.background = q.color;
        document.getElementById('eis-sec-title').textContent = q.label;
        document.getElementById('eis-sec-sub').textContent = q.sub + ' · ' + docs.filter(d => !d.eisDone).length + ' open · ' + docs.filter(d => d.eisDone).length + ' done';
        const on = 'px-3 py-1 text-[10px] font-semibold rounded-full bg-accent text-white transition';
        const off = 'px-3 py-1 text-[10px] font-semibold rounded-full text-muted hover:text-text transition';
        document.getElementById('eis-view-list').className = _eisView === 'list' ? on : off;
        document.getElementById('eis-view-folder').className = _eisView === 'folder' ? on : off;
        const list = document.getElementById('eis-sec-list');
        list.innerHTML = '';
        if (!docs.length) {
            list.innerHTML = '<div class="text-center text-muted text-xs py-8">No notes here yet.<br>Use \u201c+ Add note\u201d below.</div>';
            return;
        }
        const addRow = (d) => {
            const row = document.createElement('div');
            row.className = 'eis-row' + (d.eisDone ? ' eis-done' : '');
            row.innerHTML = `
                <button class="eis-check ${d.eisDone ? 'on' : ''}" title="${d.eisDone ? 'Mark as not done' : 'Mark complete'}">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </button>
                <button class="eis-open flex-1 min-w-0 text-left flex items-center gap-2">
                    ${EIS_NOTE_ICO}
                    <span class="min-w-0">
                        <span class="block text-xs font-medium text-text truncate eis-title">${escapeHtml(d.title || 'Untitled')} ${d.isFavorite ? '<span class="text-gold">★</span>' : ''}</span>
                        <span class="block text-[9px] text-muted">${d.updatedAt ? 'Edited ' + new Date(d.updatedAt.toDate()).toLocaleDateString() : 'Just now'}</span>
                    </span>
                </button>
                <span class="eis-chipwrap flex-shrink-0"></span>
                <button class="eis-eye" title="Quick view"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.4 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.6 7c-1.3 4.1-5.1 7-9.6 7s-8.3-2.9-9.6-7z"/></svg></button>
                <button class="eis-x" title="Remove from matrix">×</button>`;
            row.querySelector('.eis-chipwrap').innerHTML = eisChipHtml(d, true);
            row.querySelector('.eis-check').onclick = () => eisToggleDone(d.id);
            row.querySelector('.eis-open').onclick = () => { closeEisSection(); closeEisenhower(); openDoc(d.id, d); };
            row.querySelector('.eis-eye').onclick = (e) => { e.stopPropagation(); openEisGlance(d.id); };
            row.querySelector('.eis-x').onclick = () => eisRemove(d.id);
            list.appendChild(row);
        };
        if (_eisView === 'folder') {
            const groups = {};
            docs.forEach(d => { const k = d.folderId || ''; (groups[k] = groups[k] || []).push(d); });
            Object.keys(groups).sort((a, b) => (a === '') - (b === '')).forEach(k => {
                const f = state.folders.find(x => x.id === k);
                const h = document.createElement('div');
                h.className = 'text-[9px] font-bold uppercase tracking-wider text-muted px-1 pt-2.5 pb-1 flex items-center gap-1.5';
                h.innerHTML = `<span>${f ? escapeHtml(f.emoji + ' ' + f.name) : '🏠 No folder'}</span><span class="opacity-60">(${groups[k].length})</span>`;
                list.appendChild(h);
                groups[k].forEach(addRow);
            });
        } else {
            docs.forEach(addRow);
        }
    };    
    /* --- GLANCE VIEWER: exact rendered note, read-only, layered on top --- */
    var _eisGlanceId = null;
    window.openEisGlance = (docId) => {
        const d = state.docs.find(x => x.id === docId); if (!d) return;
        _eisGlanceId = docId;
        document.getElementById('eis-glance-title').textContent = d.title || 'Untitled';
        document.getElementById('eis-glance-body').innerHTML = eisRenderHtml(d);
        const plain = docPlainText(d).trim();
        const wc = plain ? plain.split(/\s+/).length : 0;
        document.getElementById('eis-glance-meta').textContent =
            wc + ' words · ~' + (wc ? Math.max(1, Math.round(wc / 200)) : 0) + ' min read';
        document.getElementById('eis-glance-modal').classList.add('open');
        document.getElementById('eis-glance-scroll').scrollTop = 0;
    };
    window.closeEisGlance = () => {
        document.getElementById('eis-glance-modal').classList.remove('open');
        _eisGlanceId = null;
    };
    window.eisGlanceOpenFull = () => {
        const id = _eisGlanceId; if (!id) return;
        const d = state.docs.find(x => x.id === id);
        closeEisGlance(); closeEisSection(); closeEisenhower();
        if (d) openDoc(d.id, d); else showToast('That note is no longer available.');
    };
    /* backdrop click closes ONLY the glance (the quadrant modal beneath stays) */
    document.getElementById('eis-glance-modal').addEventListener('click', (e) => {
        if (e.target.id === 'eis-glance-modal') closeEisGlance();
    });
    /* links inside the glance open in a new tab; nothing is editable */
    document.getElementById('eis-glance-body').addEventListener('click', (e) => {
        const a = e.target.closest('a');
        e.preventDefault();
        if (a && a.getAttribute('href')) window.open(a.getAttribute('href'), '_blank', 'noopener');
    });
    /* Esc priority: glance first, then the V4.1 handler takes over
       (due → section → matrix). Capture phase + stopImmediatePropagation
       guarantees only ONE layer closes per keypress. */
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const g = document.getElementById('eis-glance-modal');
        if (g && g.classList.contains('open')) {
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            closeEisGlance();
        }
    }, true);    

    // New code

    /* ============================================================
   V4.3 — PRODUCTION PATCH
   A) Calendar day-detail: quick-view (eye) before info, layered Esc
   B) Eisenhower due dates get a TIME + fire notifications (snoozable)
   C) Pomodoro focus timer
   D) Read aloud (text-to-speech)
   E) Full backup — export & import all notes as JSON
   Pure JS, additive only. Requires V4.1 + V4.2.
   
============================================================ */

/* ---------- shared: injected styles ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
.dd-eye { width:28px; height:28px; flex-shrink:0; border-radius:99px; color:#9ca3af; display:flex; align-items:center; justify-content:center; transition:color .15s ease, background .15s ease; }
.dd-eye:hover { color:rgb(var(--accent-rgb)); background:rgb(var(--accent-rgb) / 0.1); }
.dd-eye:active { transform:scale(.85); }
#pomo-time { font-variant-numeric:tabular-nums; letter-spacing:.02em; }
.pomo-preset { padding:5px 0; font-size:11px; font-weight:600; border-radius:10px; background:var(--bg-color); border:1px solid var(--border-color); color:var(--text-color); transition:border-color .15s ease; }
.pomo-preset:hover { border-color:rgb(var(--accent-rgb)); }
.pomo-preset.on { background-image:var(--zd-grad); color:#fff; border-color:transparent; }
#pomo-ring { transition:stroke-dashoffset 1s linear; }
#pomo-modal, #tts-modal, #backup-modal { z-index:127; }
</style>`);

/* ============================================================
   A) CALENDAR — QUICK VIEW EYE IN DAY DETAIL
   Redefines openDayDetail (V3.2). Same markup + a dd-eye button
   before info; opens the V4.2 glance viewer (z-133, above the
   day-detail modal at z-123). Esc closes glance → day detail →
   calendar, one layer per keypress.
============================================================ */
window.openDayDetail = (d) => {
    _dayDetailDate = d;
    const t = dailyTitle(d);
    document.getElementById('day-detail-title').textContent = dailyHuman(d);
    const list = document.getElementById('day-list');
    const notes = notesOnDay(d);
    list.innerHTML = '';
    if (notes.length === 0) {
        list.innerHTML = '<div class="text-center text-muted text-xs py-6">No notes on this day yet.</div>';
    }
    notes.forEach(doc => {
        const isDaily = (doc.title || '').trim() === t;
        const row = document.createElement('div');
        row.className = 'flex items-center gap-1.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition group';
        row.innerHTML = `
            <button class="dd-open flex-1 min-w-0 text-left flex items-center gap-2">
                <span class="flex-shrink-0 ${isDaily ? 'text-amber-500' : 'text-gray-400'}">${isDaily ? `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/></svg>` : `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`}</span>
                <span class="min-w-0">
                    <span class="block text-xs font-medium text-text truncate">${escapeHtml(doc.title || 'Untitled')} ${doc.isFavorite ? '<span class="text-gold">★</span>' : ''}</span>
                    <span class="block text-[9px] text-muted">${doc.updatedAt ? 'Edited ' + new Date(doc.updatedAt.toDate()).toLocaleDateString() : 'Just now'}</span>
                </span>
            </button>
            <button class="dd-eye" title="Quick view"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.4 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.6 7c-1.3 4.1-5.1 7-9.6 7s-8.3-2.9-9.6-7z"/></svg></button>
            <button class="dd-info w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition active:scale-90 flex-shrink-0" title="File info">${INFO_SVG}</button>
            <button class="dd-dup w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition active:scale-90 flex-shrink-0" title="Duplicate">${DUP_SVG}</button>`;
        row.querySelector('.dd-open').onclick = () => { closeDayDetail(); closeCalendar(); openDoc(doc.id, doc); };
        row.querySelector('.dd-eye').onclick = (e) => { e.stopPropagation(); openEisGlance(doc.id); };
        row.querySelector('.dd-info').onclick = (e) => { e.stopPropagation(); showDocInfo(doc.id); };
        row.querySelector('.dd-dup').onclick = (e) => { e.stopPropagation(); duplicateDocFromSidebar(e, doc.id); };
        list.appendChild(row);
    });
    const hasDaily = state.docs.some(x => (x.title || '').trim() === t);
    const btn = document.getElementById('day-daily-btn');
    btn.innerHTML = `<span class="inline-flex items-center justify-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/></svg>${hasDaily ? 'Open daily note' : 'Create daily note'}</span>`;
    btn.onclick = () => { closeDayDetail(); openDailyNote(d); };
    document.getElementById('day-detail-modal').classList.add('open');
};
/* Esc layering: if day detail is open (and glance isn't — the V4.2
   capture handler ran first for that), close ONLY the day detail. */
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const dd = document.getElementById('day-detail-modal');
    if (dd && dd.classList.contains('open')) {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        closeDayDetail();
    }
}, true);

/* ============================================================
   B) EISENHOWER DUE — DATE *AND* TIME + NOTIFICATIONS
   The due input becomes datetime-local; chips show the time;
   when a due moment passes, the standard reminder popup fires
   (snooze 10 min / 1 hr / open note) plus a system notification.
============================================================ */
(function () { const i = document.getElementById('eis-due-input'); if (i) i.type = 'datetime-local'; })();

/* chips now include the time (old V4.1 dues saved at 23:59 show date only) */
eisChipHtml = function (d, clickable) {
    if (!d.eisDue) return clickable
        ? `<button onclick="event.stopPropagation(); openEisDue('${d.id}')" title="Set due date & time" class="eis-chip eis-chip-add">+ due</button>` : '';
    const diff = eisDayDiff(d.eisDue);
    const dt = new Date(d.eisDue);
    const hasTime = !(dt.getHours() === 23 && dt.getMinutes() === 59);
    const tStr = hasTime ? ' · ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    let cls = 'eis-chip-ok';
    let txt = dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + tStr;
    if (d.eisDone) cls = 'eis-chip-done';
    else if (d.eisDue < Date.now()) { cls = 'eis-chip-over'; txt = 'Overdue · ' + txt; }
    else if (diff === 0) { cls = 'eis-chip-soon'; txt = 'Today' + tStr; }
    else if (diff === 1) { cls = 'eis-chip-soon'; txt = 'Tomorrow' + tStr; }
    else if (diff <= 3) { cls = 'eis-chip-soon'; }
    return clickable
        ? `<button onclick="event.stopPropagation(); openEisDue('${d.id}')" title="Change due date & time" class="eis-chip ${cls}">${txt}</button>`
        : `<span class="eis-chip ${cls}">${txt}</span>`;
};
window.openEisDue = (docId) => {
    const d = state.docs.find(x => x.id === docId); if (!d) return;
    _eisDueTarget = docId;
    document.getElementById('eis-due-title').textContent = d.title || 'Untitled';
    const inp = document.getElementById('eis-due-input');
    const dt = d.eisDue ? new Date(d.eisDue) : new Date(Date.now() + 864e5);
    if (!d.eisDue) dt.setHours(9, 0, 0, 0); /* default: tomorrow 09:00 */
    const pad = n => String(n).padStart(2, '0');
    inp.value = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) + 'T' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
    document.getElementById('eis-due-clear').classList.toggle('hidden', !d.eisDue);
    document.getElementById('eis-due-modal').classList.add('open');
};
window.eisApplyDue = async () => {
    const id = _eisDueTarget; if (!id) return;
    const v = document.getElementById('eis-due-input').value;
    if (!v) { showToast('Pick a date & time first.'); return; }
    const ts = new Date(v).getTime();
    if (isNaN(ts)) { showToast('That date is invalid.'); return; }
    if (ts > Date.now() && 'Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) {}
    }
    const d = state.docs.find(x => x.id === id);
    if (d) d.eisDue = ts;
    /* changing the due re-arms its notification */
    try {
        const f = JSON.parse(localStorage.getItem('zdEisFired') || '{}');
        delete f[id];
        localStorage.setItem('zdEisFired', JSON.stringify(f));
    } catch (e) {}
    closeEisDue();
    renderEisenhower(); if (_eisSec) renderEisSection();
    try {
        await db.collection('users').doc(state.user.uid).collection('docs').doc(id).update({ eisDue: ts });
        showToast('Due ' + new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '.');
    } catch (e) { console.error(e); showToast('Could not save due date.'); }
};
/* fire loop: when a due moment passes (open note, not done, not yet
   fired for THIS timestamp), reuse the snoozable reminder popup +
   system notification. Snooze works because we register the item
   into zdRems before firing. */
function zdEisCheckDue() {
    if (state.isGuest || !state.docs.length) return;
    if (typeof zdFeatOn === 'function' && !zdFeatOn('eis')) return;
    let fired = {};
    try { fired = JSON.parse(localStorage.getItem('zdEisFired') || '{}'); } catch (e) {}
    let dirty = false;
    state.docs.forEach(d => {
        if (!d.eis || !d.eisDue || d.eisDone) return;
        if (d.eisDue > Date.now() || fired[d.id] === d.eisDue) return;
        fired[d.id] = d.eisDue; dirty = true;
        const r = zdRems();
        r[d.id] = { t: d.eisDue, title: (d.title || 'Untitled') + ' — due now', fired: true };
        zdSaveRems(r);
        fireReminder(d.id, { title: (d.title || 'Untitled') + ' · matrix due' });
    });
    if (dirty) { try { localStorage.setItem('zdEisFired', JSON.stringify(fired)); } catch (e) {} }
}
setInterval(zdEisCheckDue, 30000);
setTimeout(zdEisCheckDue, 4000);

/* ============================================================
   C) POMODORO FOCUS TIMER
   Circular progress, 25/45/5/15 presets, keeps running with the
   modal closed, tab-title countdown, buzz + notification on finish.
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="pomo-modal" class="zd-cmodal">
  <div class="zd-cmodal-box max-w-xs text-center">
    <div class="flex items-center justify-between mb-2">
      <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path stroke-linecap="round" d="M12 9v4l2.5 2.5M9 2h6"/></svg> Focus timer</h3>
      <button onclick="closePomodoro()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
    </div>
    <div class="relative w-40 h-40 mx-auto my-3">
      <svg class="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" stroke-width="7"/>
        <circle id="pomo-ring" cx="60" cy="60" r="52" fill="none" stroke="rgb(var(--accent-rgb))" stroke-width="7" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="0"/>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <div id="pomo-time" class="text-3xl font-bold text-text">25:00</div>
        <div id="pomo-label" class="text-[10px] text-muted font-semibold uppercase tracking-wider">Focus</div>
      </div>
    </div>
    <div class="grid grid-cols-4 gap-1.5 mb-3">
      <button class="pomo-preset" data-m="25" data-l="Focus">25m</button>
      <button class="pomo-preset" data-m="45" data-l="Deep">45m</button>
      <button class="pomo-preset" data-m="5" data-l="Break">5m</button>
      <button class="pomo-preset" data-m="15" data-l="Break">15m</button>
    </div>
    <div class="grid grid-cols-2 gap-1.5">
      <button id="pomo-start" onclick="pomoToggle()" class="py-2 text-xs font-bold rounded-xl text-white active:scale-95 transition" style="background-image:var(--zd-grad)">Start</button>
      <button onclick="pomoReset()" class="py-2 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-95">Reset</button>
    </div>
    <p class="text-[9px] text-muted mt-2">The timer keeps running if you close this — reopen anytime.</p>
  </div>
</div>`);
var pomo = { total: 25 * 60, left: 25 * 60, t: null, running: false, label: 'Focus' };
function pomoPaint() {
    const m = Math.floor(pomo.left / 60), s = pomo.left % 60;
    const txt = m + ':' + String(s).padStart(2, '0');
    const te = document.getElementById('pomo-time'); if (te) te.textContent = txt;
    const le = document.getElementById('pomo-label'); if (le) le.textContent = pomo.label;
    const ring = document.getElementById('pomo-ring');
    if (ring) ring.style.strokeDashoffset = (326.7 * (1 - pomo.left / pomo.total)).toFixed(1);
    const se = document.getElementById('pomo-start'); if (se) se.textContent = pomo.running ? 'Pause' : (pomo.left < pomo.total ? 'Resume' : 'Start');
    if (pomo.running) document.title = '⏳ ' + txt + ' · ZenDocs';
}
function pomoStop(restoreTitle) {
    if (pomo.t) clearInterval(pomo.t);
    pomo.t = null; pomo.running = false;
    if (restoreTitle) document.title = 'ZenDocs | Pro V3.0';
}
window.pomoToggle = () => {
    if (pomo.running) { pomoStop(true); pomoPaint(); return; }
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    pomo.running = true;
    pomo.t = setInterval(() => {
        pomo.left--;
        if (pomo.left <= 0) {
            pomo.left = 0; pomoStop(true); pomoPaint();
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]); } catch (e) {}
            showToast('⏰ ' + pomo.label + ' session complete!', 5000);
            if ('Notification' in window && Notification.permission === 'granted') {
                try { new Notification('ZenDocs — ' + pomo.label + ' complete', { body: 'Great work. Time for the next step!', icon: './icon-192.png' }); } catch (e) {}
            }
            document.getElementById('pomo-modal').classList.add('open');
            return;
        }
        pomoPaint();
    }, 1000);
    pomoPaint();
};
window.pomoReset = () => { pomoStop(true); pomo.left = pomo.total; pomoPaint(); };
window.openPomodoro = () => { document.getElementById('pomo-modal').classList.add('open'); pomoPaint(); };
window.closePomodoro = () => {
    document.getElementById('pomo-modal').classList.remove('open');
    if (pomo.running) showToast('Timer keeps running in the background.');
};
document.querySelectorAll('#pomo-modal .pomo-preset').forEach(b => {
    b.onclick = () => {
        pomoStop(true);
        pomo.total = pomo.left = (+b.dataset.m) * 60;
        pomo.label = b.dataset.l;
        document.querySelectorAll('#pomo-modal .pomo-preset').forEach(x => x.classList.toggle('on', x === b));
        pomoPaint();
    };
});
document.getElementById('pomo-modal').addEventListener('click', (e) => { if (e.target.id === 'pomo-modal') closePomodoro(); });

/* ============================================================
   D) READ ALOUD — on-device text-to-speech for the open note
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="tts-modal" class="zd-cmodal">
  <div class="zd-cmodal-box max-w-xs">
    <div class="flex items-center justify-between mb-2">
      <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg> Read aloud <span class="text-[9px] font-normal text-muted">on-device · private</span></h3>
      <button onclick="closeReadAloud()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
    </div>
    <div id="tts-note" class="text-[11px] text-muted truncate mb-3"></div>
    <div class="flex items-center gap-1.5 mb-3">
      <span class="text-[10px] font-bold uppercase tracking-wider text-muted">Speed</span>
      <select id="tts-rate" class="flex-1 text-xs bg-bg text-text border border-border rounded-lg px-2 py-1.5 outline-none">
        <option value="0.8">0.8× slow</option><option value="1" selected>1× normal</option>
        <option value="1.2">1.2×</option><option value="1.5">1.5× fast</option>
      </select>
    </div>
    <div class="grid grid-cols-2 gap-1.5">
      <button id="tts-play" onclick="ttsToggle()" class="py-2 text-xs font-bold rounded-xl text-white active:scale-95 transition" style="background-image:var(--zd-grad)">▶ Play</button>
      <button onclick="ttsStop(); closeReadAloud()" class="py-2 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-95">■ Stop</button>
    </div>
  </div>
</div>`);
var tts = { speaking: false, paused: false };
window.openReadAloud = () => {
    if (!state.docId) { showToast('Open a note first.'); return; }
    if (!('speechSynthesis' in window)) { showToast('Read aloud isn\u2019t supported in this browser.'); return; }
    document.getElementById('tts-note').textContent = els.title.value || 'Untitled';
    try { document.getElementById('tts-rate').value = localStorage.getItem('zdTtsRate') || '1'; } catch (e) {}
    document.getElementById('tts-modal').classList.add('open');
};
window.closeReadAloud = () => document.getElementById('tts-modal').classList.remove('open');
window.ttsStop = () => {
    try { speechSynthesis.cancel(); } catch (e) {}
    tts.speaking = false; tts.paused = false;
    const b = document.getElementById('tts-play'); if (b) b.textContent = '▶ Play';
};
window.ttsToggle = () => {
    const b = document.getElementById('tts-play');
    if (tts.speaking && !tts.paused) { speechSynthesis.pause(); tts.paused = true; b.textContent = '▶ Resume'; return; }
    if (tts.speaking && tts.paused) { speechSynthesis.resume(); tts.paused = false; b.textContent = '⏸ Pause'; return; }
    const text = (els.title.value || '') + '. ' + quill.getText();
    if (text.trim().length < 3) { showToast('Nothing to read yet.'); return; }
    const u = new SpeechSynthesisUtterance(text);
    const rate = parseFloat(document.getElementById('tts-rate').value) || 1;
    localStorage.setItem('zdTtsRate', String(rate));
    u.rate = rate;
    u.onend = () => { tts.speaking = false; tts.paused = false; b.textContent = '▶ Play'; };
    u.onerror = () => { tts.speaking = false; tts.paused = false; b.textContent = '▶ Play'; };
    tts.speaking = true; tts.paused = false; b.textContent = '⏸ Pause';
    speechSynthesis.speak(u);
};
document.getElementById('tts-modal').addEventListener('click', (e) => { if (e.target.id === 'tts-modal') { ttsStop(); closeReadAloud(); } });

/* ============================================================
   E) FULL BACKUP — EXPORT / IMPORT EVERYTHING AS JSON
   Export reads only what's already in memory (zero extra reads).
   Import recreates folders by name and writes notes in chunked
   batches, with a confirmation first.
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="backup-modal" class="zd-cmodal">
  <div class="zd-cmodal-box max-w-xs">
    <div class="flex items-center justify-between mb-2">
      <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-6L9.6 4.6A2 2 0 008.2 4H6a2 2 0 00-2 2v1z"/></svg> Backup &amp; restore</h3>
      <button onclick="closeBackup()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
    </div>
    <button onclick="zdExportAll()" class="w-full py-2.5 mb-1.5 text-xs font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">⬇ Export all notes (.json)</button>
    <div id="backup-count" class="text-[9px] text-muted text-center mb-3"></div>
    <button onclick="zdImportBackup()" class="w-full py-2.5 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-[.98]">⬆ Import from backup file</button>
    <p class="text-[9px] text-muted mt-2 leading-snug">Import adds notes from the file — it never deletes or overwrites existing notes. Folders are matched by name.</p>
  </div>
</div>`);
window.openBackup = () => {
    if (state.isGuest) { showToast('Sign in first.'); return; }
    document.getElementById('backup-count').textContent = state.docs.length + ' notes · ' + state.folders.length + ' folders in your vault';
    document.getElementById('backup-modal').classList.add('open');
};
window.closeBackup = () => document.getElementById('backup-modal').classList.remove('open');
window.zdExportAll = () => {
    try {
        const data = {
            app: 'ZenDocs', version: 1, exportedAt: new Date().toISOString(),
            folders: state.folders.map(f => ({ name: f.name, emoji: f.emoji || '📁' })),
            docs: state.docs.map(d => ({
                title: d.title || 'Untitled',
                content: d.content || '',
                folderName: (state.folders.find(f => f.id === d.folderId) || {}).name || null,
                isFavorite: !!d.isFavorite, pinned: !!d.pinned,
                kanban: d.kanban || null, eis: d.eis || null,
                eisDue: d.eisDue || null, eisDone: !!d.eisDone,
                comments: d.comments || {}
            }))
        };
        const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
        downloadBlob(blob, 'zendocs-backup-' + new Date().toISOString().slice(0, 10) + '.json');
        showToast('Backup downloaded — keep it somewhere safe.');
    } catch (e) { console.error(e); showToast('Export failed.'); }
};
window.zdImportBackup = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
        const file = inp.files && inp.files[0]; if (!file) return;
        let data;
        try { data = JSON.parse(await file.text()); } catch (e) { showToast('That file isn\u2019t a valid ZenDocs backup.'); return; }
        if (!data || !Array.isArray(data.docs)) { showToast('That file isn\u2019t a valid ZenDocs backup.'); return; }
        const ok = await zdConfirm(data.docs.length + ' notes will be added to your account (nothing is deleted).', { title: 'Import backup?', okText: 'Import' });
        if (!ok) return;
        showToast('Importing ' + data.docs.length + ' notes\u2026', 6000);
        try {
            /* folders: match by name, create the missing ones */
            const folderIds = {};
            for (const f of (data.folders || [])) {
                if (!f || !f.name) continue;
                const existing = state.folders.find(x => (x.name || '').toLowerCase() === f.name.toLowerCase());
                if (existing) { folderIds[f.name] = existing.id; continue; }
                const ref = await db.collection('users').doc(state.user.uid).collection('folders').add({
                    name: f.name, emoji: f.emoji || '📁',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                folderIds[f.name] = ref.id;
            }
            /* notes: chunked batches (Firestore limit is 500 ops per batch) */
            const col = db.collection('users').doc(state.user.uid).collection('docs');
            for (let i = 0; i < data.docs.length; i += 300) {
                const batch = db.batch();
                data.docs.slice(i, i + 300).forEach(d => {
                    if (!d) return;
                    batch.set(col.doc(), {
                        title: String(d.title || 'Untitled').slice(0, 300),
                        content: (d.content && typeof d.content === 'object') ? d.content : String(d.content || ''),
                        isFavorite: !!d.isFavorite, pinned: !!d.pinned,
                        folderId: (d.folderName && folderIds[d.folderName]) || null,
                        kanban: d.kanban || null, eis: d.eis || null,
                        eisDue: typeof d.eisDue === 'number' ? d.eisDue : null, eisDone: !!d.eisDone,
                        comments: (d.comments && typeof d.comments === 'object') ? d.comments : {},
                        marginL: 96, marginR: 96,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
            }
            closeBackup();
            showToast('✓ Imported ' + data.docs.length + ' notes.');
        } catch (e) { console.error(e); showToast('Import failed partway — already-imported notes are kept.'); }
    };
    inp.click();
};
document.getElementById('backup-modal').addEventListener('click', (e) => { if (e.target.id === 'backup-modal') closeBackup(); });

/* ---------- menu entries (injected — no HTML edits) ---------- */
function zdAddMenuEntry(label, svgPath, fnName) {
    const svg = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' + svgPath + '</svg>';
    const more = document.getElementById('more-menu');
    if (more) {
        const b = document.createElement('button');
        b.className = 'zd-mi';
        b.innerHTML = svg + ' ' + label;
        b.onclick = () => { window[fnName](); toggleMoreMenu(); };
        more.appendChild(b);
    }
    const mob = document.getElementById('mobile-menu-dropdown');
    if (mob) {
        const b = document.createElement('button');
        b.className = 'w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-3';
        b.innerHTML = '<span class="w-4 text-gray-500">' + svg + '</span> ' + label;
        b.onclick = () => { window[fnName](); toggleMobileMenu(); };
        const divider = mob.querySelector('.border-t');
        if (divider) mob.insertBefore(b, divider); else mob.appendChild(b);
    }
}
zdAddMenuEntry('Focus timer', '<circle cx="12" cy="13" r="8"/><path stroke-linecap="round" d="M12 9v4l2.5 2.5M9 2h6"/>', 'openPomodoro');
zdAddMenuEntry('Read aloud', '<path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>', 'openReadAloud');
zdAddMenuEntry('Backup & restore', '<path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-6L9.6 4.6A2 2 0 008.2 4H6a2 2 0 00-2 2v1z"/>', 'openBackup');

/* ---------- feature switches + Esc for the new modals ---------- */
try {
    ZD_FEATURES.push(
        { id: 'pomo', label: 'Focus timer (Pomodoro)', fns: ['openPomodoro'] },
        { id: 'tts', label: 'Read aloud', fns: ['openReadAloud'] },
        { id: 'backup', label: 'Backup & restore', fns: ['openBackup'] }
    );
} catch (e) {}
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const [id, fn] of [['tts-modal', () => { ttsStop(); closeReadAloud(); }], ['pomo-modal', closePomodoro], ['backup-modal', closeBackup]]) {
        const m = document.getElementById(id);
        if (m && m.classList.contains('open')) {
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            fn();
            return;
        }
    }
}, true);    


// New Code

