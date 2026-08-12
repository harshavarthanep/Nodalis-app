// ZenDocs — 01-core-firebase-editor.js
// Core setup: Firebase init, app state/DOM refs, toasts & confirm dialogs, theme, sidebar toggle, Quill editor + custom blots (comment/hashtag/wikilink), toolbar (font/size/link modal), focus traps, touch gestures, routing, initial data load, folders, note rendering, doc-info modal, margins/ruler, word count, autosave, comments, guest login, Word/PDF/Text/Markdown export, search worker & command-palette results.
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
       FIREBASE INIT
    ============================================================ */
    const firebaseConfig = {
        apiKey: "AIzaSyCFmwO9aa5RZgOwQ5b3tN8NPha_1UfrCjA",
          authDomain: "notes-b4daa.firebaseapp.com",
          projectId: "notes-b4daa",
          storageBucket: "notes-b4daa.firebasestorage.app",
          messagingSenderId: "372433592521",
          appId: "1:372433592521:web:348b2558084299be1a6d18"
    };
    try { firebase.initializeApp(firebaseConfig); } catch(e) { console.error(e); }
    var auth = firebase.auth();
    var db = firebase.firestore();
    /* QUOTA SAVER: local cache — repeat visits re-read only changed docs
       instead of the whole collection, and the app works during network blips. */
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}

    /* ============================================================
       STATE
    ============================================================ */
    var state = {
        user: null, docId: null, activeFilter: 'all', folders: [], docs: [],
        isFav: false, saveTimer: null, firstLoad: true,
        pendingShareId: null, guestUnsubscribe: null, importedUnsubscribe: null, isGuest: false,
        lastTypeTime: 0,
        comments: {}, painter: null, painterArmed: false,
        marginL: 96, marginR: 96, suppressClickUntil: 0, lastToggle: 0,
        sidebarOpen: true,
        folderTapTimers: {},
        folderTapCounts: {},
        offlineMode: false, dirty: false, lastSavedSig: null,
        paletteIndex: 0,
        linkHintShown: false
    };

    /* ============================================================
       ELEMENT REFS
    ============================================================ */
    var els = {
        loadingScreen: document.getElementById('loading-screen'),
        authScreen: document.getElementById('auth-screen'), authBox: document.getElementById('auth-box'),
        dashboard: document.getElementById('dashboard-screen'), sidebar: document.getElementById('sidebar'),
        email: document.getElementById('email'), pass: document.getElementById('password'),
        authError: document.getElementById('auth-error'), docList: document.getElementById('doc-list'),
        folderList: document.getElementById('folder-list'), folderSelect: document.getElementById('folder-select'),
        title: document.getElementById('doc-title'), editorWrapper: document.getElementById('editor-wrapper'),
        status: document.getElementById('save-status'), favBtn: document.getElementById('fav-btn'),
        mFavBtn: document.getElementById('m-fav-btn'),
        headerFavBtn: document.getElementById('header-fav-btn'),
        headerInfoBtn: document.getElementById('header-info-btn'),
        delBtn: document.getElementById('delete-btn'), downBtn: document.getElementById('download-btn'),
        dupBtn: document.getElementById('duplicate-btn'), commentsBtn: document.getElementById('comments-btn'),
        wordCount: document.getElementById('word-count'), toolbar: document.getElementById('toolbar'),
        ruler: document.getElementById('ruler'), commentsPanel: document.getElementById('comments-panel'),
        commentsList: document.getElementById('comments-list'),
        userEmail: document.getElementById('user-email'),
        mobileFolderMenu: document.getElementById('mobile-folder-menu'), mobileFolderListItems: document.getElementById('mobile-folder-list-items'),
        sunIcon: document.getElementById('sun-icon'), moonIcon: document.getElementById('moon-icon'),
        previewBanner: document.getElementById('preview-banner'), syncBanner: document.getElementById('sync-banner'),
        mobileMenuDropdown: document.getElementById('mobile-menu-dropdown'),
        loggedInControls: document.getElementById('logged-in-controls'),
        guestDownloadBtn: document.getElementById('guest-download-btn'), guestCommentsBtn: document.getElementById('guest-comments-btn'),
        hamburgerBtn: document.getElementById('hamburger-btn'), authCancelContainer: document.getElementById('auth-cancel-container'),
        shareBtn: document.getElementById('share-btn'), helpModal: document.getElementById('help-modal'),
        downloadModal: document.getElementById('download-modal'), commentModal: document.getElementById('comment-modal'),
        commentQuote: document.getElementById('comment-quote'), commentText: document.getElementById('comment-text'),
        lsMenu: document.getElementById('ls-menu'),
        mFolderBtn: document.getElementById('m-folder-btn'),
        infoModal: document.getElementById('info-modal'),
        infoModalBody: document.getElementById('info-modal-body'),
        addNoteBtnWrapper: document.getElementById('add-note-btn-wrapper'),
        toast: document.getElementById('toast'),
        folderDdBtn: document.getElementById('folder-dd-btn'),
        folderDdMenu: document.getElementById('folder-dd-menu'),
        folderDdItems: document.getElementById('folder-dd-items'),
        folderDdLabel: document.getElementById('folder-dd-label'),
        offlineIndicator: document.getElementById('offline-indicator'),
        offlineToggleBtn: document.getElementById('offline-toggle-btn'),
        offlineBtnLabel: document.getElementById('offline-btn-label'),
        mOfflineLabel: document.getElementById('m-offline-label'),
        paletteModal: document.getElementById('palette-modal'),
        paletteInput: document.getElementById('palette-input'),
        paletteResults: document.getElementById('palette-results'),
        confirmModal: document.getElementById('confirm-modal'),
        shareBtnLabel: document.getElementById('share-btn-label'),
        tagList: document.getElementById('tag-list'),
        backlinksList: document.getElementById('backlinks-list'),
        graphModal: document.getElementById('graph-modal'),
        graphCanvas: document.getElementById('graph-canvas')
    };

    /* ============================================================
       TOAST
    ============================================================ */
    let toastTimer = null;
    function showToast(msg, dur = 2500) {
        els.toast.textContent = msg;
        els.toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast.classList.remove('show'), dur);
    }

    /* ============================================================
       CONFIRM MODAL (polished replacement for window.confirm)
    ============================================================ */
    function zdConfirm(msg, opts = {}) {
        return new Promise(resolve => {
            const modal = els.confirmModal;
            document.getElementById('confirm-title').textContent = opts.title || 'Are you sure?';
            document.getElementById('confirm-msg').textContent = msg || '';
            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');
            const icon = document.getElementById('confirm-icon');
            okBtn.textContent = opts.okText || 'Confirm';
            if (opts.danger) {
                okBtn.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-danger text-white hover:bg-red-700 shadow-sm transition active:scale-95';
                icon.className = 'w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 text-danger flex items-center justify-center flex-shrink-0 text-lg';
                icon.textContent = '!';
            } else {
                okBtn.className = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-blue-600 shadow-sm transition active:scale-95';
                icon.className = 'w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-accent flex items-center justify-center flex-shrink-0 text-lg';
                icon.textContent = opts.icon || '?';
            }
            const close = (val) => {
                modal.classList.remove('open');
                okBtn.onclick = null; cancelBtn.onclick = null; modal.onclick = null;
                document.removeEventListener('keydown', escHandler, true);
                resolve(val);
            };
            const escHandler = (e) => {
                if (e.key === 'Escape') { e.stopPropagation(); close(false); }
                if (e.key === 'Enter') { e.stopPropagation(); close(true); }
            };
            okBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            modal.onclick = (e) => { if (e.target === modal) close(false); };
            document.addEventListener('keydown', escHandler, true);
            modal.classList.add('open');
            setTimeout(() => okBtn.focus(), 60);
        });
    }

        /* Loading screen follows the saved theme + accent */
        (function () {
            try {
                const theme = localStorage.getItem('zdTheme') || 'dark';
                const accent = localStorage.getItem('zdAccent') || '#1a73e8';
                const dark = theme !== 'light';
                const bg = dark ? '#0e1014' : '#f7f2e7';
                const text = dark ? '#ffffff' : '#1a1a1a';
                const spinFaint = dark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.12)';
                const s = document.getElementById('zd-load-style');
                if (s) s.textContent = [
                    '#loading-screen{background:' + bg + '}',
                    '#loading-screen .zd-load-word{color:' + text + '}',
                    '#loading-screen .zd-load-spin{border-color:' + spinFaint + ';border-top-color:' + accent + '}'
                ].join('');
            } catch (e) {}
        })();

    /* ============================================================
       SAVE STATUS UI (with icon states)
    ============================================================ */
    const STATUS_ICONS = {
        saved: '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
        saving: '<svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M12 3a9 9 0 019 9"/></svg>',
        offline: '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>',
        error: '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    };
    function setStatus(kind, text) {
        els.status.className = kind || '';
        els.status.innerHTML = (STATUS_ICONS[kind] || '') + '<span>' + (text || '') + '</span>';
    }

    /* ============================================================
       THEME
    ============================================================ */
    function initTheme() { applyTheme(localStorage.getItem('theme') === 'dark'); }
    function applyTheme(isDark) {
        if (isDark) { document.documentElement.classList.add('dark'); els.sunIcon.classList.remove('hidden'); els.moonIcon.classList.add('hidden'); }
        else { document.documentElement.classList.remove('dark'); els.sunIcon.classList.add('hidden'); els.moonIcon.classList.remove('hidden'); }
    }
    function toggleTheme() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);
        if (state.user) db.collection('users').doc(state.user.uid).set({ settings: { theme: isDark ? 'dark' : 'light' } }, { merge: true });
        if (state.docId && !state.isGuest) {
            const active = state.docs.find(d => d.id === state.docId);
            if (active && active.shareId) {
                db.collection('shared_docs').doc(active.shareId).set({ theme: isDark ? 'dark' : 'light' }, { merge: true }).catch(e => console.warn(e));
            }
        }
        if (state.docId) buildRuler();
    }

    /* ============================================================
       DESKTOP SIDEBAR TOGGLE
    ============================================================ */
    function toggleDesktopSidebar() {
        const sb = document.getElementById('sidebar');
        state.sidebarOpen = !state.sidebarOpen;
        if (state.sidebarOpen) { sb.classList.remove('collapsed'); }
        else { sb.classList.add('collapsed'); }
        localStorage.setItem('sidebarOpen', state.sidebarOpen ? '1' : '0');
    }
    function initDesktopSidebar() {
        const saved = localStorage.getItem('sidebarOpen');
        if (saved === '0') { state.sidebarOpen = false; document.getElementById('sidebar').classList.add('collapsed'); }
    }

    /* ============================================================
       QUILL FORMATS REGISTRATION
    ============================================================ */
    const Font = Quill.import('formats/font');
    Font.whitelist = ['arial','times','georgia','garamond','courier','verdana','trebuchet','tahoma','monospace'];
    Quill.register(Font, true);

    const AlignStyle = Quill.import('attributors/style/align');
    Quill.register(AlignStyle, true);

    const SizeStyle = Quill.import('attributors/style/size');
    const SIZE_STEPS = ['8px','9px','10px','11px','12px','13px','14px','16px','18px','20px','24px','28px','32px','36px','48px','60px','72px'];
    SizeStyle.whitelist = SIZE_STEPS;
    Quill.register(SizeStyle, true);

    const Parchment = Quill.import('parchment');
    const LineHeight = new Parchment.Attributor.Style('lineheight','line-height',{
        scope: Parchment.Scope.BLOCK, whitelist: ['1','1.15','1.5','2','2.5','3']
    });
    Quill.register({ 'formats/lineheight': LineHeight }, true);

    /* COMMENT BLOT */
    const Inline = Quill.import('blots/inline');
    class CommentBlot extends Inline {
        static create(value) {
            const node = super.create();
            node.setAttribute('data-cid', value);
            node.setAttribute('spellcheck', 'false');
            return node;
        }
        static formats(node) { return node.getAttribute('data-cid'); }
    }
    CommentBlot.blotName = 'comment';
    CommentBlot.tagName = 'span';
    CommentBlot.className = 'ql-comment';
    Quill.register(CommentBlot, true);

    /* V3: HASHTAG BLOT — renders #tags as clickable pills */
    class HashtagBlot extends Inline {
        static create(value) {
            const node = super.create();
            node.setAttribute('data-tag', value);
            node.setAttribute('spellcheck', 'false');
            return node;
        }
        static formats(node) { return node.getAttribute('data-tag'); }
    }
    HashtagBlot.blotName = 'hashtag';
    HashtagBlot.tagName = 'span';
    HashtagBlot.className = 'ql-hashtag';
    Quill.register(HashtagBlot, true);

    /* V3: WIKI-LINK BLOT — renders [[Note Title]] as a link to another note */
    class WikiLinkBlot extends Inline {
        static create(value) {
            const node = super.create();
            node.setAttribute('data-target', value);
            node.setAttribute('spellcheck', 'false');
            return node;
        }
        static formats(node) { return node.getAttribute('data-target'); }
    }
    WikiLinkBlot.blotName = 'wikilink';
    WikiLinkBlot.tagName = 'span';
    WikiLinkBlot.className = 'ql-wikilink';
    Quill.register(WikiLinkBlot, true);

    /* ============================================================
       QUILL INIT
    ============================================================ */
    var quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Start writing… (try #tags and [[links]])',
        /* FIX (V3.6): scrollingContainer stops Quill 1.x from jumping the page
           to the top on paste / large edits — the classic Google-Docs feel. */
        scrollingContainer: '#editor-wrapper',
        modules: { toolbar: '#toolbar', history: { delay: 800, maxStack: 200, userOnly: true } }
    });

    quill.on('text-change', function(delta, oldDelta, source) {
        updateWordCount();
        if (source === 'user') {
            state.lastTypeTime = Date.now();
            const sel = quill.getSelection();
            if (sel && sel.length === 0) {
                const format = quill.getFormat(sel.index, 1);
                if (format.comment) {
                    const charBefore = sel.index > 0 ? quill.getFormat(sel.index - 1, 1) : {};
                    const charAfter = quill.getFormat(sel.index, 1);
                    if (charBefore.comment && !charAfter.comment) {
                        // boundary, fine
                    } else if (charBefore.comment && charAfter.comment && charBefore.comment !== charAfter.comment) {
                        quill.format('comment', false, 'silent');
                    }
                }
            }
            triggerSave();
            scheduleTokenScan(); /* V3: re-detect #tags and [[links]] after typing pauses */
            updateSuggester(); /* V3.1: [[ and # autocomplete popup */
        }
    });

    quill.on('selection-change', function(range, oldRange, source) {
        const commentModalOpen = els.commentModal.style.display !== 'none';
        const titleFocused = document.activeElement === els.title;
        if (commentModalOpen || titleFocused) return;

        if (range && range.length === 0) {
            const fmtAtCursor = quill.getFormat(range.index, 0);
            if (fmtAtCursor.comment) {
                quill.format('comment', false, 'silent');
            }
        }
        updateSizeInput(range);
        if (range && range.length > 0 && state.painter && state.painterArmed) {
            const fmt = state.painter;
            state.painter = null; state.painterArmed = false;
            document.getElementById('paint-btn').classList.remove('active');
            Object.keys(fmt).forEach(k => quill.formatText(range.index, range.length, k, fmt[k]));
        }
    });

    /* ============================================================
       TOOLBAR EXTRAS
    ============================================================ */
    document.getElementById('undo-btn').addEventListener('click', () => quill.history.undo());
    document.getElementById('redo-btn').addEventListener('click', () => quill.history.redo());

    const paintBtn = document.getElementById('paint-btn');
    paintBtn.addEventListener('click', () => {
        const range = quill.getSelection();
        if (state.painter) { state.painter = null; state.painterArmed = false; paintBtn.classList.remove('active'); return; }
        if (!range) { showToast('Select formatted text first.'); return; }
        state.painter = quill.getFormat(range);
        state.painterArmed = false;
        paintBtn.classList.add('active');
        setTimeout(() => { state.painterArmed = true; }, 50);
    });

    const sizeInput = document.getElementById('size-input');
    function currentSizePx(range) { const f = quill.getFormat(range || undefined); return f.size || '11px'; }
    function updateSizeInput(range) { const s = currentSizePx(range); sizeInput.value = parseInt(s, 10) || 11; }
    function applySize(px) { const r = quill.getSelection(); if (!r) { quill.focus(); } quill.format('size', px); sizeInput.value = parseInt(px, 10); }
    document.getElementById('size-inc').addEventListener('click', () => { const cur = currentSizePx(); let i = SIZE_STEPS.indexOf(cur); if (i < 0) { i = SIZE_STEPS.indexOf('11px'); } if (i < SIZE_STEPS.length - 1) applySize(SIZE_STEPS[i + 1]); });
    document.getElementById('size-dec').addEventListener('click', () => { const cur = currentSizePx(); let i = SIZE_STEPS.indexOf(cur); if (i < 0) { i = SIZE_STEPS.indexOf('11px'); } if (i > 0) applySize(SIZE_STEPS[i - 1]); });
    sizeInput.addEventListener('change', () => { let v = parseInt(sizeInput.value, 10); if (isNaN(v)) return; v = Math.max(8, Math.min(72, v)); applySize(v + 'px'); });
    sizeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sizeInput.blur(); } });

    const lsBtn = document.getElementById('ls-btn');
    lsBtn.addEventListener('click', () => {
        if (!els.lsMenu.classList.contains('hidden')) { els.lsMenu.classList.add('hidden'); return; }
        els.lsMenu.innerHTML = '';
        ['1', '1.15', '1.5', '2', '2.5', '3'].forEach(v => {
            const b = document.createElement('button');
            b.className = 'w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-text';
            b.textContent = v === '1' ? 'Single (1.0)' : v;
            b.onclick = () => { quill.focus(); quill.format('lineheight', v); els.lsMenu.classList.add('hidden'); };
            els.lsMenu.appendChild(b);
        });
        const r = lsBtn.getBoundingClientRect();
        els.lsMenu.style.top = (r.bottom + 6) + 'px';
        els.lsMenu.style.left = Math.max(8, r.left - 40) + 'px';
        els.lsMenu.classList.remove('hidden');
    });

    document.getElementById('comment-btn').addEventListener('click', startComment);

    /* ============================================================
       V3.2 — LINKS: custom insert/edit modal (replaces Quill's
       tooltip, which was rendered inside the paper container and
       got clipped out of view). Highlight text \u2192 toolbar link
       button (or Ctrl+K link icon) applies the URL to that text.
    ============================================================ */
    let _linkCtx = null; /* { index, length, href } */
    state.noAutoLink = {}; /* V3.3: per-note memory of URLs the user un-linked, so the auto-linker doesn't re-add them */
    function normalizeUrl(u) {
        u = String(u || '').trim();
        if (!u) return '';
        if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
        return 'https://' + u;
    }
    function openLinkModal(ctx) {
        if (state.isGuest) { showToast('Sign in to add links.'); return; }
        _linkCtx = ctx;
        const modal = document.getElementById('link-modal');
        const input = document.getElementById('link-url');
        const preview = document.getElementById('link-text-preview');
        const openBtn = document.getElementById('link-open-btn');
        const removeBtn = document.getElementById('link-remove-btn');
        document.getElementById('link-modal-title').textContent = ctx.href ? 'Edit link' : 'Insert link';
        if (ctx.length > 0) {
            const q = quill.getText(ctx.index, Math.min(ctx.length, 120));
            preview.textContent = '"' + q + '"';
            preview.classList.remove('hidden');
        } else { preview.classList.add('hidden'); }
        input.value = ctx.href || '';
        openBtn.classList.toggle('hidden', !ctx.href);
        removeBtn.classList.toggle('hidden', !ctx.href);
        modal.classList.add('open');
        /* FIX v3 (link box caret): Quill's toolbar re-focuses the editor
           AFTER our handler returns, which stole the caret back from the
           input. We (a) blur the editor first, (b) focus synchronously,
           (c) keep retrying for ~1.5s, and (d) a focusin trap below keeps
           snapping focus back for as long as the modal is open. */
        try { quill.blur(); } catch (e) {}
        const focusIt = () => { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } };
        focusIt();
        let tries = 0;
        const iv = setInterval(() => {
            if (!modal.classList.contains('open') || tries++ > 25) { clearInterval(iv); return; }
            if (document.activeElement !== input) focusIt();
        }, 60);
        setTimeout(() => { focusIt(); input.select(); }, 150);
    }
    /* FIX (V3.7): ONE visibility-aware focus guard for every trap-modal.
       It only redirects focus when the modal is REALLY visible on screen
       (computed style checked), so a stale 'open' class can never silently
       hijack the cursor from other inputs — the definitive fix. */
    const FOCUS_TRAPS = [
        { modal: 'palette-modal', input: 'palette-input' },
        { modal: 'link-modal', input: 'link-url' },
        { modal: 'note-picker-modal', input: 'picker-search' },
        { modal: 'kb-card-modal', input: 'kb-card-title' }
    ];
    document.addEventListener('focusin', (e) => {
        for (const t of FOCUS_TRAPS) {
            const m = document.getElementById(t.modal);
            if (!m || !m.classList.contains('open')) continue;
            const cs = getComputedStyle(m);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
            if (e.target.closest('#' + t.modal)) return;   /* focus is inside — fine */
            if (e.target.closest('#kb-card-modal')) return;
            try { document.getElementById(t.input).focus({ preventScroll: true }); } catch (err) {}
            return; /* only the topmost visible trap acts */
        }
    });
    window.closeLinkModal = () => { document.getElementById('link-modal').classList.remove('open'); _linkCtx = null; };
    window.applyLink = () => {
        if (!_linkCtx) return closeLinkModal();
        const url = normalizeUrl(document.getElementById('link-url').value);
        if (!url) { showToast('Please enter a URL.'); return; }
        const { index, length } = _linkCtx;
        if (length > 0) {
            quill.formatText(index, length, 'link', url, 'user');
            quill.setSelection(index + length, 0, 'silent');
        } else {
            /* no selection: insert the URL itself as linked text (Google-Docs style) */
            quill.insertText(index, url, { link: url }, 'user');
            quill.setSelection(index + url.length, 0, 'silent');
        }
        closeLinkModal();
        showToast('Link added.');
    };
    window.removeLinkFmt = () => {
        if (!_linkCtx) return closeLinkModal();
        /* FIX (V3.3): expand to the FULL linked range — the cursor may sit
           inside the link, or the click may have caught only part of it —
           then remove the format so plain text remains. */
        let { index, length } = _linkCtx;
        const val = _linkCtx.href
            || (quill.getFormat(index, 1).link)
            || (index > 0 ? quill.getFormat(index - 1, 1).link : null);
        const total = quill.getLength();
        let start = index, end = Math.min(total, index + Math.max(1, length));
        if (val) {
            while (start > 0 && quill.getFormat(start - 1, 1).link === val) start--;
            while (end < total && quill.getFormat(end, 1).link === val) end++;
        }
        if (end <= start) end = start + 1;
        quill.formatText(start, end - start, 'link', false, 'user');
        /* remember this exact text so the URL auto-linker leaves it alone */
        const plain = quill.getText(start, end - start).trim();
        if (plain) {
            if (!state.noAutoLink[state.docId]) state.noAutoLink[state.docId] = new Set();
            state.noAutoLink[state.docId].add(plain);
        }
        closeLinkModal();
        showToast('Link removed — plain text kept.');
    };
    window.openLinkHref = () => {
        if (_linkCtx && _linkCtx.href) window.open(_linkCtx.href, '_blank', 'noopener');
    };
    document.getElementById('link-url').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLinkModal(); }
    });
    document.getElementById('link-modal').addEventListener('click', (e) => { if (e.target.id === 'link-modal') closeLinkModal(); });
    /* Re-route the toolbar link button through our modal */
    (function hookLinkButton() {
        const tb = quill.getModule('toolbar');
        tb.addHandler('link', function() {
            const r = quill.getSelection(true) || { index: quill.getLength() - 1, length: 0 };
            const fmt = r.length === 0 ? quill.getFormat(r.index, 1) : quill.getFormat(r);
            openLinkModal({ index: r.index, length: r.length, href: fmt.link || '' });
        });
    })();

    setTimeout(() => {
        const map = {
            '.ql-bold': 'Bold (Ctrl+B)', '.ql-italic': 'Italic (Ctrl+I)', '.ql-underline': 'Underline (Ctrl+U)',
            '.ql-strike': 'Strikethrough', '.ql-blockquote': 'Quote', '.ql-code-block': 'Code block',
            '.ql-link': 'Insert link', '.ql-image': 'Insert image', '.ql-clean': 'Clear formatting',
            '.ql-color': 'Text color', '.ql-background': 'Highlight color', '.ql-align': 'Alignment',
            '.ql-header': 'Text style', '.ql-font': 'Font'
        };
        for (const sel in map) {
            document.querySelectorAll('#toolbar ' + sel).forEach(el => {
                const lbl = el.querySelector('.ql-picker-label') || el;
                lbl.setAttribute('title', map[sel]);
            });
        }
        document.querySelector('#toolbar .ql-list[value="bullet"]')?.setAttribute('title', 'Bulleted list');
        document.querySelector('#toolbar .ql-list[value="ordered"]')?.setAttribute('title', 'Numbered list');
        document.querySelector('#toolbar .ql-list[value="check"]')?.setAttribute('title', 'Checklist');
        document.querySelector('#toolbar .ql-indent[value="-1"]')?.setAttribute('title', 'Decrease indent');
        document.querySelector('#toolbar .ql-indent[value="+1"]')?.setAttribute('title', 'Increase indent');
    }, 300);

    setTimeout(() => {
        document.querySelectorAll('#toolbar button, #toolbar .ql-picker-label').forEach(b => {
            b.addEventListener('click', () => { b.classList.remove('tap-anim'); void b.offsetWidth; b.classList.add('tap-anim'); });
        });
        document.querySelectorAll('.ql-picker-label').forEach(label => {
            label.addEventListener('click', () => {
                if (window.innerWidth < 850) { setTimeout(() => { if (document.activeElement) document.activeElement.blur(); }, 0); }
            });
        });
    }, 500);

    /* ============================================================
       MOBILE CHECKBOX TOGGLE
    ============================================================ */
    const editorEl = document.querySelector('.ql-editor');
    let tStartX = 0, tStartY = 0;
    editorEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) { tStartX = e.touches[0].clientX; tStartY = e.touches[0].clientY; }
    }, { passive: true });
    editorEl.addEventListener('touchend', (e) => {
        if (e.changedTouches.length !== 1) return;
        const x = e.changedTouches[0].clientX, y = e.changedTouches[0].clientY;
        if (Math.abs(x - tStartX) > 14 || Math.abs(y - tStartY) > 14) return;
        const target = document.elementFromPoint(x, y); if (!target) return;
        const li = target.closest('li[data-list="checked"], li[data-list="unchecked"]'); if (!li) return;
        const rect = li.getBoundingClientRect();
        const inZone = (x >= rect.left - 8 && x <= rect.left + 58 && y <= rect.top + 46);
        if (!inZone) return;
        if (Date.now() - state.lastToggle < 350) { e.preventDefault(); return; }
        const blot = Quill.find(li);
        if (blot) {
            const index = quill.getIndex(blot);
            const isChecked = li.dataset.list === 'checked';
            quill.formatLine(index, 1, 'list', isChecked ? 'unchecked' : 'checked');
            state.lastToggle = Date.now();
            state.suppressClickUntil = Date.now() + 550;
            e.preventDefault();
        }
    }, { passive: false });

    editorEl.addEventListener('click', (e) => {
        if (Date.now() < state.suppressClickUntil) {
            const li = e.target.closest('li[data-list]');
            if (li) { e.preventDefault(); e.stopPropagation(); }
        }
        /* V3.2: links — plain click opens the edit modal (Open/Remove inside),
           Ctrl/Cmd+Click opens the URL directly; guests always open the URL */
        const anch = e.target.closest('.ql-editor a');
        if (anch) {
            e.preventDefault(); e.stopPropagation();
            const href = anch.getAttribute('href') || '';
            if (state.isGuest || e.ctrlKey || e.metaKey) {
                if (href) window.open(href, '_blank', 'noopener');
                return;
            }
            const blot = Quill.find(anch);
            if (blot) {
                const index = quill.getIndex(blot);
                const length = blot.length ? blot.length() : (anch.textContent.length || 1);
                openLinkModal({ index: index, length: length, href: href });
            }
            return;
        }
        const c = e.target.closest('.ql-comment');
        if (c) { openCommentFromBlot(c.getAttribute('data-cid')); }

        /* V3: follow [[wiki-links]] — Ctrl/Cmd+Click on desktop, plain tap on touch */
        const wl = e.target.closest('.ql-wikilink');
        if (wl) {
            const coarse = window.matchMedia('(pointer: coarse)').matches;
            if (e.ctrlKey || e.metaKey || coarse) {
                e.preventDefault(); e.stopPropagation();
                openNoteByTitle(wl.getAttribute('data-target'));
                return;
            } else if (!state.linkHintShown) {
                state.linkHintShown = true;
                showToast('Tip: Ctrl+Click a [[link]] to open it');
            }
        }
        /* V3: Ctrl+Click a #tag (or tap on mobile) to filter the sidebar by it */
        const ht = e.target.closest('.ql-hashtag');
        if (ht) {
            const coarse = window.matchMedia('(pointer: coarse)').matches;
            if (e.ctrlKey || e.metaKey || coarse) {
                e.preventDefault(); e.stopPropagation();
                jumpToTag(ht.getAttribute('data-tag'));
                return;
            } else if (!state.linkHintShown) {
                state.linkHintShown = true;
                showToast('Tip: Ctrl+Click a #tag to filter by it');
            }
        }
    }, true);

    /* ============================================================
       TITLE HANDLING
    ============================================================ */
    (function setupTitleHandlers() {
        const titleEl = els.title;
        titleEl.addEventListener('focus', () => { setTimeout(() => titleEl.select(), 10); });
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
        });
        titleEl.addEventListener('blur', () => {
            if (!state.docId || state.isGuest) return;
            const newTitle = titleEl.value.trim() || 'Untitled Document';
            if (titleEl.value.trim() === '') titleEl.value = 'Untitled Document';
            const current = state.docs.find(d => d.id === state.docId);
            /* FIX: if nothing actually changed, do NOT touch the database. */
            if (current && (current.title || 'Untitled Document') === newTitle) return;
            const isDuplicate = state.docs.some(d =>
                d.id !== state.docId &&
                (d.title || '').trim().toLowerCase() === newTitle.toLowerCase()
            );
            if (isDuplicate) {
                showToast('A document with this name already exists.');
                if (current) titleEl.value = current.title || 'Untitled Document';
                return;
            }
            triggerSave();
        });
        titleEl.addEventListener('input', () => {
            if (!state.docId || state.isGuest) return;
            /* FIX: only mark dirty when the title truly differs */
            const current = state.docs.find(d => d.id === state.docId);
            if (current && (current.title || '') === titleEl.value) return;
            triggerSave();
        });
    })();

    /* ============================================================
       ROUTING / AUTH
    ============================================================ */
    function getShareIdFromUrl() { return new URLSearchParams(window.location.search).get('shareId'); }

    async function handleRoute() {
        const shareId = getShareIdFromUrl();
        if (auth.currentUser) { if (shareId) state.pendingShareId = shareId; }
        else {
            if (shareId) { await loadGuestView(shareId); }
            else { els.loadingScreen.classList.add('hidden'); els.authScreen.classList.remove('hidden'); els.authBox.classList.add('animate-fade-in-up'); }
        }
    }

    async function loadGuestView(shareId) {
        state.isGuest = true; state.pendingShareId = shareId; els.loadingScreen.classList.remove('hidden');
        if (state.guestUnsubscribe) state.guestUnsubscribe();
        const safety = setTimeout(() => {
            if (!els.loadingScreen.classList.contains('hidden')) {
                showToast('Loading timed out. The note may be deleted.');
                els.loadingScreen.classList.add('hidden');
            }
        }, 8000);
        state.guestUnsubscribe = db.collection('shared_docs').doc(shareId).onSnapshot(doc => {
            clearTimeout(safety);
            if (doc.exists) {
                const data = doc.data();
                if (data.theme) applyTheme(data.theme === 'dark');
                els.loadingScreen.classList.add('hidden'); els.authScreen.classList.add('hidden');
                els.dashboard.classList.remove('hidden', 'opacity-0'); els.dashboard.classList.add('animate-fade-in');
                els.loggedInControls.classList.add('hidden'); els.sidebar.classList.add('hidden');
                els.hamburgerBtn.classList.add('hidden');
                els.guestDownloadBtn.classList.remove('hidden'); els.guestCommentsBtn.classList.remove('hidden');
                els.previewBanner.classList.remove('hidden'); els.toolbar.classList.add('hidden');
                const rw = document.getElementById('ruler-wrap'); if (rw) rw.classList.add('hidden');
                els.title.value = data.t;
                const range = quill.getSelection(); quill.setContents(data.c); if (range) quill.setSelection(range);
                quill.disable(); els.title.disabled = true;
                els.editorWrapper.classList.remove('opacity-50', 'pointer-events-none');
                setStatus('saved', 'Live View');
                state.comments = data.comments || {}; renderComments();
                updateWordCount();
                if (els.addNoteBtnWrapper) els.addNoteBtnWrapper.style.display = 'none';
            } else {
                showToast('Shared note not found.');
                window.history.replaceState({}, document.title, window.location.pathname);
                window.location.reload();
            }
        }, err => { clearTimeout(safety); console.error(err); showToast('Error loading.'); els.loadingScreen.classList.add('hidden'); });
    }

    auth.onAuthStateChanged((u) => {
        setTimeout(() => { try { maybeShowInstall(); } catch (e) {} }, 2500); /* V3.9 */
        state.user = u;
        if (u) {
            state.isGuest = false; if (state.guestUnsubscribe) state.guestUnsubscribe();
            els.userEmail.textContent = u.email;
            els.userEmail.title = u.email;
            els.authScreen.classList.add('hidden'); els.previewBanner.classList.add('hidden');
            els.dashboard.classList.remove('hidden', 'opacity-0'); els.loggedInControls.classList.remove('hidden');
            els.sidebar.classList.remove('hidden'); els.hamburgerBtn.classList.remove('hidden');
            els.guestDownloadBtn.classList.add('hidden'); els.guestCommentsBtn.classList.add('hidden');
            els.dashboard.classList.add('animate-fade-in');
            if (els.addNoteBtnWrapper) els.addNoteBtnWrapper.style.display = '';
            db.collection('users').doc(u.uid).onSnapshot(doc => {
                if (doc.exists && doc.data().settings?.theme) { applyTheme(doc.data().settings.theme === 'dark'); }
            });
            initData();
        } else { handleRoute(); }
    });

    function initData() {
        if (!state.user) return;
        const uid = state.user.uid;
        db.collection('users').doc(uid).collection('folders').orderBy('createdAt').onSnapshot(snap => {
            state.folders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderFolders(); updateFolderSelect();
            if (state.docs.length > 0) renderDocs();
        });
        db.collection('users').doc(uid).collection('docs').orderBy('updatedAt', 'desc').onSnapshot(async (snap) => {
            state.docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderDocs();
            renderTags(); /* V3: refresh sidebar tag list */
            renderFolders(); /* V3.8: keep tile note-counts fresh (rename-guarded) */
            renderBacklinks(); /* V3: refresh linked mentions */
            refreshOpenViews(); /* V3.1: live-update kanban / calendar / canvas */
            if (state.docId && !state.isGuest) {
                const stillExists = state.docs.some(d => d.id === state.docId);
                if (!stillExists) { state.docs.length > 0 ? openDoc(state.docs[0].id, state.docs[0]) : createNewDoc(); return; }
                const active = state.docs.find(d => d.id === state.docId);
                if (active) {
                    if (els.title.value !== active.title && document.activeElement !== els.title) els.title.value = active.title;
                    const isTyping = (Date.now() - state.lastTypeTime) < 2000;
                    if (!isTyping) {
                        const cur = JSON.stringify(quill.getContents()); const nw = JSON.stringify(active.content);
                        if (cur !== nw) {
                            const r = quill.getSelection(); quill.setContents(active.content, 'silent');
                            quill.history.clear(); /* V3.6: remote replace invalidates old undo steps */
                            if (r && quill.hasFocus()) quill.setSelection(r);
                            updateWordCount();
                            scanInlineTokens(false); /* V3.3: keep #tags/[[links]]/URLs highlighted after every sync — no write */
                            renderOutline();
                        }
                        if (active.comments) { state.comments = active.comments; renderComments(); }
                        /* Re-baseline after applying a remote update so the
                           realtime sync itself never triggers an echo write */
                        if (!state.dirty) state.lastSavedSig = computeSaveSig();
                    }
                    if (active.folderId === null && els.folderSelect.value !== '') { els.folderSelect.value = ''; updateFolderDdLabel(); }
                }
            }
            const shareId = getShareIdFromUrl();
            if (shareId && state.firstLoad) {
                state.firstLoad = false;
                const owned = state.docs.find(d => d.shareId === shareId);
                const imported = state.docs.find(d => d.importedFromShareId === shareId);
                try {
                    if (owned) { openDoc(owned.id, owned); window.history.replaceState({}, document.title, window.location.pathname); }
                    else if (imported) { openDoc(imported.id, imported); window.history.replaceState({}, document.title, window.location.pathname); }
                    else { await checkAndHandleDeletedOwner(shareId); }
                } catch (e) { console.error(e); els.loadingScreen.classList.add('hidden'); }
            } else if (state.firstLoad && !state.docId) {
                state.firstLoad = false; els.loadingScreen.classList.add('hidden');
                state.docs.length > 0 ? openDoc(state.docs[0].id, state.docs[0]) : createNewDoc();
            }
        });
    }

    async function checkAndHandleDeletedOwner(shareId) {
        els.loadingScreen.classList.remove('hidden');
        try {
            const snap = await db.collection('shared_docs').doc(shareId).get();
            if (snap.exists) {
                const data = snap.data();
                if (data.ownerId === state.user.uid) { showToast('Restoring your shared note...'); restoreDeletedFile(shareId, data); }
                else { importSharedNote(shareId); }
            } else { showToast('Note not found or deleted.'); els.loadingScreen.classList.add('hidden'); window.history.replaceState({}, document.title, window.location.pathname); }
        } catch (e) { console.error(e); els.loadingScreen.classList.add('hidden'); }
    }

    async function restoreDeletedFile(shareId, data) {
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: data.t, content: data.c, isFavorite: false, folderId: null, shareId: shareId,
                comments: data.comments || {}, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            window.history.replaceState({}, document.title, window.location.pathname); els.loadingScreen.classList.add('hidden');
        } catch (e) { showToast('Restore failed'); els.loadingScreen.classList.add('hidden'); }
    }

    async function importSharedNote(shareId) {
        els.loadingScreen.classList.remove('hidden');
        try {
            const snap = await db.collection('shared_docs').doc(shareId).get();
            if (!snap.exists) { showToast('Shared note not found.'); els.loadingScreen.classList.add('hidden'); return; }
            const data = snap.data();
            const receiverInfo = { uid: state.user.uid, email: state.user.email, receivedAt: Date.now() };
            try {
                await db.collection('shared_docs').doc(shareId).set({
                    receivers: firebase.firestore.FieldValue.arrayUnion(receiverInfo)
                }, { merge: true });
            } catch (e) { console.warn('Could not update receivers list', e); }
            await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: data.t, content: data.c, isFavorite: false, folderId: null,
                importedFromShareId: shareId, comments: data.comments || {},
                sharedBy: data.email || 'Anonymous', sharedByUid: data.ownerId || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            window.history.replaceState({}, document.title, window.location.pathname);
            els.loadingScreen.classList.add('hidden');
        } catch (e) { console.error(e); showToast('Error importing note.'); els.loadingScreen.classList.add('hidden'); }
    }

    /* ============================================================
       SIDEBAR RENDER — FOLDERS
    ============================================================ */
    function renderFolders() {
        /* FIX (V3.8): a realtime echo mid-rename was destroying the input */
        if (document.querySelector('.folder-rename-input')) return;
        els.folderList.innerHTML = '';
        state.folders.forEach(f => {
            /* V3.6: Windows-style tile — icon on top, name below */
            const div = document.createElement('div');
            const isActive = state.activeFilter === f.id;
            const count = state.docs.filter(d => d.folderId === f.id).length;
            div.className = `relative group flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl cursor-pointer transition text-center select-none ${isActive ? 'bg-white/10 text-white ring-1 ring-accent/60' : 'hover:bg-white/5 text-gray-400'}`;
            div.dataset.folderId = f.id;

            const iconWrap = document.createElement('div');
            iconWrap.className = 'relative ' + (isActive ? 'text-accent' : 'text-gray-400 group-hover:text-gray-300');
            iconWrap.innerHTML = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>${count ? `<span class="absolute -top-1.5 -right-2.5 text-[8px] font-bold px-1 rounded-full bg-accent/20 text-accent">${count}</span>` : ''}`;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-[10px] leading-tight w-full truncate px-0.5';
            nameSpan.textContent = f.name;

            /* V3.8: one ⋮ menu (rename / delete) keeps tiles clean */
            const menuBtn = document.createElement('button');
            menuBtn.onclick = (e) => openFolderMenu(e, f.id, f.name, f.emoji, nameSpan);
            menuBtn.title = 'Folder options';
            menuBtn.className = 'folder-actions absolute top-0.5 right-0.5 w-4 h-5 flex items-center justify-center rounded text-gray-500 hover:text-accent opacity-0 group-hover:opacity-100 transition text-xs font-bold leading-none';
            menuBtn.textContent = '⋮';

            div.dataset.fid = f.id;
            nameSpan.classList.add('folder-name');
            div.appendChild(iconWrap);
            div.appendChild(nameSpan);
            div.appendChild(menuBtn);

            /* FIX (V3.7): the old code still referenced a removed element and
               threw, which is why folders vanished. Single tap filters,
               double tap renames — bound to the tile itself. */
            let tapCount = 0;
            let tapTimer = null;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                tapCount++;
                if (tapCount === 1) {
                    tapTimer = setTimeout(() => { tapCount = 0; filterDocs(f.id); }, 300);
                } else if (tapCount >= 2) {
                    clearTimeout(tapTimer); tapCount = 0;
                    startFolderRename(f.id, f.name, f.emoji, nameSpan);
                }
            });

            els.folderList.appendChild(div);
        });
    }

    function startFolderRename(folderId, currentName, emoji, nameSpan) {
        if (document.querySelector('.folder-rename-input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'folder-rename-input';
        input.value = currentName;
        nameSpan.replaceWith(input);
        /* FIX (V3.5): same caret pattern as the palette — focus synchronously,
           then retry until the browser actually hands over the cursor */
        const focusIt = () => { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } };
        focusIt(); input.select();
        let _frTries = 0;
        const _frIv = setInterval(() => {
            if (!document.body.contains(input) || document.activeElement === input || _frTries++ > 15) { clearInterval(_frIv); return; }
            focusIt();
        }, 60);

        let committed = false;
        const doCancel = () => { if (committed) return; committed = true; try { input.replaceWith(nameSpan); } catch (e) {} };
        const doCommit = () => {
            if (committed) return;
            committed = true;
            const newName = input.value.trim();
            /* FIX: always restore the label first */
            try { input.replaceWith(nameSpan); } catch (e) {}
            if (!newName || newName === currentName) return;
            setTimeout(async () => {
                const confirmed = await zdConfirm(
                    `"${currentName}" will become "${newName}".`,
                    { title: 'Rename folder?', okText: 'Rename' }
                );
                if (!confirmed) return;
                try {
                    await db.collection('users').doc(state.user.uid).collection('folders').doc(folderId).update({ name: newName });
                    showToast(`Renamed to "${newName}"`);
                } catch (e) { console.error(e); showToast('Rename failed.'); }
            }, 0);
        };
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); doCommit(); }
            if (e.key === 'Escape') { e.preventDefault(); doCancel(); }
        });
        input.addEventListener('blur', doCommit);
    }

    function updateFolderSelect() {
        els.folderSelect.innerHTML = '<option value="">No Folder</option>';
        state.folders.forEach(f => {
            const o = document.createElement('option');
            o.value = f.id; o.textContent = `${f.emoji} ${f.name}`;
            els.folderSelect.appendChild(o);
        });
        const n = document.createElement('option');
        n.value = 'create_new'; n.textContent = '➕ Create New...'; n.style.color = '#1a73e8';
        els.folderSelect.appendChild(n);
        updateFolderDdLabel();
    }

    /* ============================================================
       CUSTOM FOLDER DROPDOWN (desktop) — replaces the bare <select>
    ============================================================ */
    function updateFolderDdLabel() {
        if (!els.folderDdLabel) return;
        const f = state.folders.find(x => x.id === els.folderSelect.value);
        els.folderDdLabel.textContent = f ? `${f.emoji} ${f.name}` : 'No Folder';
    }
    function closeFolderDd() {
        if (!els.folderDdMenu) return;
        els.folderDdMenu.classList.add('hidden');
        els.folderDdMenu.classList.remove('open');
        if (els.folderDdBtn) els.folderDdBtn.classList.remove('open');
    }
    function renderFolderDdItems() {
        els.folderDdItems.innerHTML = '';
        const mk = (id, label, emojiHtml) => {
            const b = document.createElement('button');
            const sel = (els.folderSelect.value || '') === id;
            b.className = `w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition ${sel ? 'text-accent font-bold bg-blue-50 dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`;
            b.innerHTML = `${emojiHtml}<span class="truncate">${escapeHtml(label)}</span>${sel ? '<svg class="w-3 h-3 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}`;
            b.onclick = () => { setDocFolder(id); closeFolderDd(); };
            els.folderDdItems.appendChild(b);
        };
        mk('', 'No Folder', '<span>🏠</span>');
        state.folders.forEach(f => mk(f.id, f.name, `<span>${f.emoji}</span>`));
    }
    if (els.folderDdBtn) {
        els.folderDdBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (els.folderDdMenu.classList.contains('hidden')) {
                renderFolderDdItems();
                els.folderDdMenu.classList.remove('hidden');
                els.folderDdMenu.classList.add('open');
                els.folderDdBtn.classList.add('open');
            } else { closeFolderDd(); }
        });
    }

    /* ============================================================
       DOC LIST RENDER
    ============================================================ */
    var DUP_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>';
    var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

    function renderDocs() {
        els.docList.innerHTML = '';
        let filtered = state.docs;
        if (state.activeFilter === 'fav') filtered = state.docs.filter(d => d.isFavorite);
        else if (String(state.activeFilter).startsWith('tag:')) {
            /* V3: filter by #tag */
            const t = String(state.activeFilter).slice(4);
            filtered = state.docs.filter(d => docTags(d).includes(t));
        }
        else if (state.activeFilter !== 'all') filtered = state.docs.filter(d => d.folderId === state.activeFilter);

        /* V3.5: pinned notes float to the top (stable within groups) */
        filtered = filtered.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

        if (filtered.length === 0) {
            const e = document.createElement('div');
            e.className = 'text-center text-gray-600 text-xs py-8 px-3';
            e.innerHTML = `<div class="flex justify-center mb-2 opacity-50"><svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11 15l-4 1 1-4 9.6-9.4z"/></svg></div>No notes here yet.<br><button onclick="createNewDoc()" class="text-accent hover:underline mt-2">Create one</button>`;
            els.docList.appendChild(e); return;
        }

        filtered.forEach((d, index) => {
            const div = document.createElement('div');
            const isActive = d.id === state.docId;
            const folderObj = state.folders.find(f => f.id === d.folderId);
            const folderBadge = folderObj ? `<span class="px-1.5 py-0.5 rounded text-[9px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">${folderObj.emoji} ${folderObj.name}</span>` : '';
            /* FIX: icon-only badges instead of text labels — tooltips carry the words */
            let badges = '';
            if (d.sharedBy) badges += `<span title="Received from ${escapeHtml(d.sharedBy)}" class="badge-icon inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300"><svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg></span>`;
            if (d.shareId) badges += `<span title="Shared publicly — anyone with the link can view" class="badge-icon inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"><svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5"/></svg></span>`;
            if (Object.keys(d.comments || {}).length > 0) badges += `<span title="${Object.keys(d.comments).length} note(s)" class="badge-icon inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"><svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z"/></svg></span>`;

            /* File icon before the name */
            const FILE_SVG = `<svg class="doc-file-icon w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-accent' : 'text-gray-600'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;

            div.className = `doc-row doc-enter p-2 rounded mb-1 cursor-pointer transition flex flex-col border-l-2 group relative ${isActive ? 'bg-[#252525] border-accent text-white' : 'border-transparent hover:bg-[#252525] text-gray-400'}`;
            div.style.animationDelay = Math.min(index * 18, 220) + 'ms';

            div.innerHTML = `
                <div class="font-medium text-xs flex items-center justify-between min-h-[20px]">
                    <span class="truncate pr-1 select-none flex items-center gap-1.5 min-w-0">${FILE_SVG}<span class="truncate">${escapeHtml(d.title || 'Untitled')}</span></span>
                    <div class="doc-actions flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button data-pin="${d.id}" title="${d.pinned ? 'Unpin' : 'Pin to top'}" class="w-6 h-6 flex items-center justify-center rounded-full ${d.pinned ? 'text-accent' : 'text-gray-500'} hover:text-white hover:bg-white/20 transition active:scale-90"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linejoin="round" d="M6 4h12v16l-6-4-6 4z"/></svg></button>
                        <button data-info="${d.id}" title="File info" class="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/20 transition active:scale-90">${INFO_SVG}</button>
                        <button data-dup="${d.id}" title="Duplicate" class="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/20 transition active:scale-90">${DUP_SVG}</button>
                    </div>
                </div>
                <div class="text-[9px] opacity-60 flex justify-between mt-1 items-center flex-wrap gap-1 select-none">
                    <div class="flex items-center flex-wrap gap-1">
                        <span>${d.updatedAt ? new Date(d.updatedAt.toDate()).toLocaleDateString() : 'Just now'}</span>
                        ${folderBadge} ${badges}
                    </div>
                    <span class="flex items-center gap-1">${d.pinned ? '<span class="text-accent" title="Pinned"><svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linejoin="round" d="M6 4h12v16l-6-4-6 4z"/></svg></span>' : ''}${d.isFavorite ? '<span class="text-gold text-[10px]">★</span>' : ''}</span>
                </div>`;

            div.querySelector('[data-pin]').addEventListener('click', (e) => { e.stopPropagation(); togglePin(d.id); });
            div.querySelector('[data-info]').addEventListener('click', (e) => { e.stopPropagation(); showDocInfo(d.id); });
            div.querySelector('[data-dup]').addEventListener('click', (e) => { e.stopPropagation(); duplicateDocFromSidebar(e, d.id); });
            div.onclick = (e) => { if (!e.target.closest('button')) openDoc(d.id, d); };
            els.docList.appendChild(div);
        });
    }

    /* ============================================================
       FILE INFO MODAL
    ============================================================ */
    // FIX: showCurrentDocInfo() for header button — shows info for currently open doc
    window.showCurrentDocInfo = function() {
        if (!state.docId) return;
        showDocInfo(state.docId);
    };

    async function showDocInfo(docId) {
        const doc = state.docs.find(d => d.id === docId);
        if (!doc) return;

        let html = `<div class="space-y-2">`;
        html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Title</span><p class="mt-0.5 font-medium text-text">${escapeHtml(doc.title || 'Untitled')}</p></div>`;

        const created = doc.createdAt ? new Date(doc.createdAt.toDate()).toLocaleString() : 'Unknown';
        const updated = doc.updatedAt ? new Date(doc.updatedAt.toDate()).toLocaleString() : 'Unknown';
        html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Created</span><p class="mt-0.5">${created}</p></div>`;
        html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Last Updated</span><p class="mt-0.5">${updated}</p></div>`;

        /* V3.3: note statistics */
        const plain = docPlainText(doc).trim();
        const wc = plain ? plain.split(/\s+/).length : 0;
        html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Statistics</span><p class="mt-0.5">${wc} words · ${plain.length} characters · ~${wc ? Math.max(1, Math.round(wc / 200)) : 0} min read</p></div>`;

        /* V3: show this note's tags and outgoing links in File Details */
        const tags = docTags(doc);
        if (tags.length > 0) {
            html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Tags</span><p class="mt-0.5 flex flex-wrap gap-1">${tags.map(t => `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-accent dark:text-blue-300">#${escapeHtml(t)}</span>`).join('')}</p></div>`;
        }
        const links = docLinks(doc);
        if (links.length > 0) {
            html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Links to</span><p class="mt-0.5 flex flex-wrap gap-1">${links.map(l => `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">[[${escapeHtml(l)}]]</span>`).join('')}</p></div>`;
        }

        if (doc.sharedBy) {
            html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Shared by</span><p class="mt-0.5 text-accent">${escapeHtml(doc.sharedBy)}</p></div>`;
        }

        if (doc.shareId) {
            html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Share Status</span><p class="mt-0.5 text-green-600 dark:text-green-400">🔗 Shared publicly</p></div>`;
            try {
                const sharedSnap = await db.collection('shared_docs').doc(doc.shareId).get();
                if (sharedSnap.exists) {
                    const data = sharedSnap.data();
                    const receivers = data.receivers || [];
                    if (receivers.length > 0) {
                        html += `<div><span class="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Received by (${receivers.length})</span><ul class="mt-1 space-y-1">`;
                        receivers.forEach(r => {
                            const date = r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : '';
                            html += `<li class="text-xs flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-accent inline-block flex-shrink-0"></span><span class="truncate">${escapeHtml(r.email || r.uid)}</span>${date ? `<span class="text-muted flex-shrink-0">${date}</span>` : ''}</li>`;
                        });
                        html += `</ul></div>`;
                    } else {
                        html += `<div class="text-xs text-muted">No one has received this shared file yet.</div>`;
                    }
                }
            } catch (e) { console.warn('Could not fetch receivers', e); }
        }

        html += `</div>`;
        els.infoModalBody.innerHTML = html;
        els.infoModal.style.display = 'flex';
    }

    function closeInfoModal() { els.infoModal.style.display = 'none'; }
    window.closeInfoModal = closeInfoModal;
    els.infoModal.addEventListener('click', (e) => { if (e.target === els.infoModal) closeInfoModal(); });

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ============================================================
       MARGINS / RULER — FIX: proper alignment
    ============================================================ */
    function applyMargins() {
        const ed = document.querySelector('.ql-editor');
        if (ed) { ed.style.paddingLeft = state.marginL + 'px'; ed.style.paddingRight = state.marginR + 'px'; }
        buildRuler();
    }

    function resetMargins() {
        state.marginL = 96; state.marginR = 96;
        applyMargins();
        if (state.docId && !state.isGuest) triggerSave();
        showToast('Margins reset to default');
    }
    window.resetMargins = resetMargins;

    function buildRuler() {
        const rulerEl = document.getElementById('ruler');
        if (!rulerEl) return;
        const W = 794;
        const DPI = 96;
        const CM_TO_PX = DPI / 2.54;

        let html = '';
        html += `<div class="margin-zone" style="left:0;width:${state.marginL}px;"></div>`;
        html += `<div class="margin-zone" style="right:0;width:${state.marginR}px;"></div>`;

        const totalCm = W / CM_TO_PX;
        for (let cm = 0; cm <= totalCm; cm += 0.5) {
            const x = Math.round(cm * CM_TO_PX);
            const isMajor = (cm % 1 === 0);
            const tickH = isMajor ? 10 : 6;
            const col = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
            html += `<div style="position:absolute;left:${x}px;bottom:0;width:1px;height:${tickH}px;background:${col};pointer-events:none;"></div>`;
            if (isMajor && cm > 0 && x < W - 10) {
                const labelCol = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)';
                html += `<div style="position:absolute;left:${x + 2}px;bottom:10px;font-size:8px;color:${labelCol};pointer-events:none;line-height:1;">${cm}</div>`;
            }
        }

        html += `<div class="handle" id="hL" style="left:${state.marginL - 5}px;" title="Drag to set left margin"></div>`;
        html += `<div class="handle" id="hR" style="left:${W - state.marginR - 5}px;" title="Drag to set right margin"></div>`;

        rulerEl.innerHTML = html;
        initRulerDrag('hL', true);
        initRulerDrag('hR', false);
    }

    function initRulerDrag(id, isLeft) {
        const h = document.getElementById(id); if (!h) return;
        const start = (e) => {
            e.preventDefault();
            const rulerEl = document.getElementById('ruler');
            const rulerRect = rulerEl.getBoundingClientRect();
            const move = (ev) => {
                const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rulerRect.left;
                let px = Math.round(cx);
                if (isLeft) { state.marginL = Math.max(24, Math.min(350, px)); }
                else { state.marginR = Math.max(24, Math.min(350, 794 - px)); }
                applyMargins();
            };
            const up = () => {
                document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
                document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
                if (state.docId && !state.isGuest) triggerSave();
            };
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
            document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
        };
        h.addEventListener('mousedown', start); h.addEventListener('touchstart', start, { passive: false });
    }

    /* ============================================================
       OPEN DOC
    ============================================================ */
    window.openDoc = (id, data) => {
        state.docId = id; state.isFav = data.isFavorite || false;
        if (state.importedUnsubscribe) { state.importedUnsubscribe(); state.importedUnsubscribe = null; }

        els.title.value = data.title || '';
        els.title.disabled = false;
        els.editorWrapper.classList.remove('opacity-50', 'pointer-events-none');
        els.toolbar.classList.remove('hidden');
        const rw = document.getElementById('ruler-wrap');
        if (rw) rw.classList.remove('hidden');
        els.favBtn.disabled = false; els.delBtn.disabled = false; els.downBtn.disabled = false;
        els.dupBtn.disabled = false; els.commentsBtn.disabled = false;
        els.shareBtn.disabled = false; els.folderSelect.disabled = false;
        if (els.folderDdBtn) els.folderDdBtn.disabled = false;
        // FIX: enable header star and info buttons
        if (els.headerFavBtn) els.headerFavBtn.disabled = false;
        if (els.headerInfoBtn) els.headerInfoBtn.disabled = false;
        els.folderSelect.value = data.folderId || '';
        els.syncBanner.classList.add('hidden');
        state.marginL = data.marginL || 96; state.marginR = data.marginR || 96;
        state.comments = data.comments || {};
        updateFavIcon();
        state.reading = false; /* V3.5: switching notes always returns to edit mode */
        quill.setContents(data.content || '', 'api'); quill.enable();
        quill.history.clear(); /* V3.6: every note gets its own clean undo stack */
        setTimeout(() => { updateTaskProgress(); applyHeadingFolds(); renderDeepThink(); }, 80); /* V3.8 */
        applyMargins(); renderComments();
        updateFolderDdLabel();
        /* V3: highlight #tags and [[links]] BEFORE baselining, so opening a
           note never causes a phantom save */
        scanInlineTokens(false);
        renderBacklinks();
        renderOutline(); /* V3.2 */
        /* FIX: baseline fingerprint so untouched documents never re-save */
        state.lastSavedSig = computeSaveSig();
        state.dirty = false;
        /* FIX (V3.3): opening a note NEVER writes to the database anymore.
           Highlights for #tags / [[links]] / URLs are applied locally on
           every open AND after every realtime snapshot (see initData), so
           they always show without a single "phantom" save. The formatted
           content is persisted naturally the next time you actually edit. */
        setStatus(state.offlineMode ? 'offline' : 'saved', state.offlineMode ? 'Offline mode' : 'Synced');
        updateWordCount();

        if (data.importedFromShareId) {
            els.syncBanner.classList.remove('hidden');
            state.importedUnsubscribe = db.collection('shared_docs').doc(data.importedFromShareId).onSnapshot(doc => {
                if (doc.exists) {
                    const p = doc.data();
                    const cur = JSON.stringify(quill.getContents()); const inc = JSON.stringify(p.c);
                    if (cur !== inc) {
                        const r = quill.getSelection(); quill.setContents(p.c, 'silent');
                        if (document.activeElement !== els.title) els.title.value = p.t;
                        if (r && quill.hasFocus()) quill.setSelection(r); updateWordCount();
                        state.comments = p.comments || {}; renderComments();
                        db.collection('users').doc(state.user.uid).collection('docs').doc(id).update({
                            title: p.t, content: p.c, comments: p.comments || {},
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            });
        }
        if (window.innerWidth < 850 && !state.isGuest) toggleSidebar(false);
    };

    window.createNewDoc = async () => {
        if (!state.user) return;
        const folderId = (state.activeFilter !== 'all' && state.activeFilter !== 'fav' && !String(state.activeFilter).startsWith('tag:')) ? state.activeFilter : null;
        try {
            const ref = await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: 'Untitled Document', content: '', isFavorite: false, folderId: folderId,
                comments: {}, marginL: 96, marginR: 96,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            openDoc(ref.id, { title: 'Untitled Document', content: '', isFavorite: false, folderId: folderId, comments: {}, marginL: 96, marginR: 96 });
            if (window.innerWidth < 850) toggleSidebar(false);
            setTimeout(() => { els.title.focus(); els.title.select(); }, 150);
        } catch (e) { console.error(e); showToast('Error creating note: ' + e.message); }
    };

    window.duplicateCurrentDoc = () => duplicateDocFromSidebar(null, state.docId);
    window.duplicateDocFromSidebar = async (e, docId) => {
        if (e) e.stopPropagation();
        const original = state.docs.find(d => d.id === docId); if (!original) return;
        const ok = await zdConfirm(`A copy of "${original.title}" will be created.`, { title: 'Duplicate document?', okText: 'Duplicate' });
        if (ok) {
            try {
                const contentCopy = original.content ? JSON.parse(JSON.stringify(original.content)) : '';
                await db.collection('users').doc(state.user.uid).collection('docs').add({
                    title: original.title + ' (Copy)', content: contentCopy, isFavorite: false,
                    folderId: original.folderId, comments: original.comments || {},
                    marginL: original.marginL || 96, marginR: original.marginR || 96,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('Document duplicated.');
            } catch (err) { console.error(err); showToast('Error duplicating'); }
        }
    };

    /* ============================================================
       SAVE
    ============================================================ */
    function updateWordCount() {
        const t = quill.getText().trim();
        const w = t.length ? t.split(/\s+/).length : 0;
        const mins = w ? Math.max(1, Math.round(w / 200)) : 0;
        els.wordCount.textContent = `· ${w} ${w === 1 ? 'word' : 'words'}, ${t.length} chars` + (w ? ` · ~${mins} min read` : '');
    }
    /* QUOTA SAVER: fingerprint of everything that gets written to Firestore.
       If the fingerprint hasn't changed since the last successful save,
       we skip the write entirely — no reads, no writes, no quota burn. */
    function computeSaveSig() {
        try {
            return JSON.stringify({
                t: els.title.value.trim() || 'Untitled',
                c: quill.getContents().ops,
                f: state.isFav,
                fo: els.folderSelect.value || null,
                ml: state.marginL, mr: state.marginR,
                cm: state.comments || {}
            });
        } catch (e) { return String(Date.now()); }
    }

    function triggerSave() {
        if (!state.docId || state.isGuest) return;
        /* FIX: no-op guard — cursor moves / focus changes with zero edits
           never reach Firestore anymore. */
        if (computeSaveSig() === state.lastSavedSig) return;
        state.dirty = true;
        if (state.offlineMode) {
            setStatus('offline', 'Offline — unsaved edits (Ctrl+S to sync)');
            return;
        }
        setStatus('saving', 'Saving…');
        if (state.saveTimer) clearTimeout(state.saveTimer);
        state.saveTimer = setTimeout(saveToDb, 1000);
    }
    async function saveToDb() {
        if (!state.docId) return;
        const sig = computeSaveSig();
        /* QUOTA SAVER: double-check right before the network write */
        if (sig === state.lastSavedSig) { state.dirty = false; pushDocSnapshot(); /* V3.8: local time-machine snapshot */
            setStatus('saved', 'Saved'); return; }
        try {
            const currentContent = JSON.parse(JSON.stringify(quill.getContents()));
            const titleVal = els.title.value.trim() || 'Untitled';

            const userDocUpdate = {
                title: titleVal,
                content: currentContent,
                isFavorite: state.isFav,
                folderId: els.folderSelect.value || null,
                marginL: state.marginL,
                marginR: state.marginR,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const comments = state.comments || {};
            Object.keys(comments).forEach(cid => { userDocUpdate['comments.' + cid] = comments[cid]; });

            const userRef = db.collection('users').doc(state.user.uid).collection('docs').doc(state.docId);
            try {
                await userRef.update(userDocUpdate);
            } catch (e) {
                if (e.code === 'not-found') {
                    await userRef.set({ ...userDocUpdate, comments: comments, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                } else { throw e; }
            }

            const active = state.docs.find(d => d.id === state.docId);
            if (active && active.shareId) {
                const sharedUpdate = {
                    t: titleVal, c: currentContent,
                    theme: localStorage.getItem('theme') || 'light'
                };
                Object.keys(comments).forEach(cid => { sharedUpdate['comments.' + cid] = comments[cid]; });
                await db.collection('shared_docs').doc(active.shareId).update(sharedUpdate);
            }

            state.lastSavedSig = sig;
            state.dirty = false;
            setStatus('saved', 'Saved');
        } catch (e) { console.error(e); setStatus('error', 'Error saving'); }
    }

    window.shareCurrentNote = async () => {
        if (!state.docId) return;
        const btn = els.shareBtn; const orig = btn.innerHTML;
        btn.innerHTML = '<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M12 3a9 9 0 019 9"/></svg><span>Sharing…</span>';
        btn.disabled = true;
        try {
            const active = state.docs.find(d => d.id === state.docId); let shareId = active.shareId;
            if (!shareId) {
                const noteData = {
                    t: els.title.value, c: JSON.parse(JSON.stringify(quill.getContents())),
                    comments: state.comments || {}, email: state.user.email, ownerId: state.user.uid,
                    theme: localStorage.getItem('theme') || 'light',
                    receivers: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                const ref = await db.collection('shared_docs').add(noteData);
                shareId = ref.id;
                await db.collection('users').doc(state.user.uid).collection('docs').doc(state.docId).update({ shareId: shareId });
            }
            const url = new URL(window.location.href);
            url.search = `?shareId=${shareId}`;
            const urlStr = url.toString();
            if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
                await navigator.share({ title: els.title.value, text: 'Check out this note on ZenDocs', url: urlStr });
            } else {
                await navigator.clipboard.writeText(urlStr);
                showToast('Link copied to clipboard!');
                btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Copied!</span>';
                btn.disabled = false;
                setTimeout(() => { btn.innerHTML = orig; }, 1600);
                return;
            }
        } catch (error) {
            if (error.name !== 'AbortError') { console.error(error); showToast('Could not generate link.'); }
        } finally { if (btn.disabled) { btn.innerHTML = orig; btn.disabled = false; } }
    };

    /* ============================================================
       COMMENTS / NOTES
    ============================================================ */
    var _pendingCommentRange = null;

    function startComment() {
        if (state.isGuest) { showToast('Sign in to add notes.'); return; }
        const range = quill.getSelection();
        if (!range || range.length === 0) {
            showToast('Select some text in the document first, then tap the note button.');
            return;
        }
        _pendingCommentRange = { index: range.index, length: range.length };
        const quote = quill.getText(range.index, range.length).slice(0, 120);
        els.commentQuote.textContent = '"' + quote + '"';
        els.commentModal.dataset.quote = quill.getText(range.index, range.length).slice(0, 200);
        els.commentText.value = '';
        els.commentModal.style.display = 'flex';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    els.commentText.focus();
                    if (document.activeElement !== els.commentText) els.commentText.focus();
                }, 80);
            });
        });
    }

    window.closeCommentModal = () => {
        els.commentModal.style.display = 'none';
        els.commentText.value = '';
        _pendingCommentRange = null;
    };

    window.submitComment = async () => {
        const text = els.commentText.value.trim();
        if (!text) { showToast('Please write a note first.'); els.commentText.focus(); return; }
        if (state.isGuest) { showToast('Sign in to add notes.'); return; }
        if (!_pendingCommentRange) { showToast('Lost text selection — please select text again and retry.'); closeCommentModal(); return; }
        const { index: idx, length: len } = _pendingCommentRange;
        const quote = els.commentModal.dataset.quote || '';
        const cid = 'c' + Date.now() + Math.floor(Math.random() * 9999);
        const author = state.user.email;
        const authorUid = state.user.uid;

        const activeDoc = state.docs.find(d => d.id === state.docId);
        const isSharedReceiver = activeDoc && activeDoc.importedFromShareId;
        const comment = { quote, text, author, authorUid, ts: Date.now() };

        if (isSharedReceiver) {
            try {
                await db.collection('shared_docs').doc(activeDoc.importedFromShareId).set(
                    { comments: { [cid]: comment } }, { merge: true }
                );
            } catch (e) { console.warn('Could not save to shared doc', e); }
        } else {
            quill.formatText(idx, len, 'comment', cid);
        }

        state.comments[cid] = comment;
        triggerSave();
        renderComments();
        closeCommentModal();
        if (els.commentsPanel.classList.contains('hidden')) toggleCommentsPanel();
        showToast('Note added.');
    };

    function renderComments() {
        const keys = Object.keys(state.comments || {});
        const activeDoc = state.docs.find(d => d.id === state.docId);
        const isOwner = !state.isGuest && activeDoc && !activeDoc.importedFromShareId;
        const currentUserEmail = state.user ? state.user.email : null;

        if (keys.length === 0) {
            els.commentsList.innerHTML = '<div class="text-center text-muted text-xs py-8">No notes yet.<br>' +
                (state.isGuest ? 'Sign in to add notes.' : 'Select text and add one.') + '</div>';
            return;
        }
        els.commentsList.innerHTML = '';
        keys.sort((a, b) => (state.comments[a].ts || 0) - (state.comments[b].ts || 0)).forEach(cid => {
            const c = state.comments[cid];
            const canDelete = !state.isGuest && (isOwner || (c.author === currentUserEmail));

            const card = document.createElement('div');
            card.className = 'border border-border rounded-lg p-3 bg-bg hover:border-accent/50 transition cursor-pointer animate-slide-in-right';
            card.innerHTML = `
                <div class="text-[11px] italic text-muted border-l-2 border-gold pl-2 mb-2 line-clamp-2">"${escapeHtml(c.quote || '')}"</div>
                <div class="text-sm text-text whitespace-pre-wrap break-words">${escapeHtml(c.text || '')}</div>
                <div class="flex items-center justify-between mt-2">
                    <span class="text-[10px] text-muted truncate max-w-[150px]">${escapeHtml(c.author || '')} · ${c.ts ? new Date(c.ts).toLocaleDateString() : ''}</span>
                    ${canDelete ? `<button data-resolve="${cid}" title="Resolve this note" class="flex-shrink-0 inline-flex items-center gap-1 text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-2 py-0.5 rounded-full transition-colors active:scale-95"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Resolve</button>` : ''}
                </div>`;
            card.querySelector('[data-resolve]')?.addEventListener('click', (e) => { e.stopPropagation(); deleteComment(cid); });
            card.onclick = (e) => { if (!e.target.closest('button')) jumpToComment(cid); };
            els.commentsList.appendChild(card);
        });
    }

    function jumpToComment(cid) {
        document.querySelectorAll('.ql-comment.active-comment').forEach(e => e.classList.remove('active-comment'));
        const span = document.querySelector(`.ql-comment[data-cid="${cid}"]`);
        if (span) {
            span.classList.add('active-comment');
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const blot = Quill.find(span);
            if (blot) {
                const index = quill.getIndex(blot);
                const length = span.textContent.length;
                quill.setSelection(index, length, 'silent');
                quill.focus();
            }
        } else {
            showToast('Note highlighted in panel.');
        }
    }

    function openCommentFromBlot(cid) {
        if (els.commentsPanel.classList.contains('hidden')) toggleCommentsPanel();
        setTimeout(() => jumpToComment(cid), 100);
    }

    /* ============================================================
       FIX: deleteComment — robust yellow highlight removal
    ============================================================ */
    async function deleteComment(cid) {
        const ok = await zdConfirm('The highlight and note will be removed.', { title: 'Resolve this note?', okText: 'Resolve', icon: '\u2713' });
        if (!ok) return;

        const activeDoc = state.docs.find(d => d.id === state.docId);
        const isSharedReceiver = !!(activeDoc && activeDoc.importedFromShareId);

        /* FIX v2 (yellow highlight): block the realtime snapshot from echoing
           the OLD server content (which still carries the highlight) back into
           the editor while we strip the format and write the clean version. */
        state.lastTypeTime = Date.now();
        if (state.saveTimer) clearTimeout(state.saveTimer);

        if (!isSharedReceiver) {
            removeCommentFormat(cid);
        }

        // Optimistic UI update
        delete state.comments[cid];
        renderComments();

        const fieldPath = 'comments.' + cid;
        const cleanContent = JSON.parse(JSON.stringify(quill.getContents()));

        try {
            if (isSharedReceiver) {
                const atomicDelete = { [fieldPath]: firebase.firestore.FieldValue.delete() };
                await db.collection('shared_docs')
                    .doc(activeDoc.importedFromShareId)
                    .update(atomicDelete);
                await db.collection('users').doc(state.user.uid)
                    .collection('docs').doc(state.docId)
                    .update(atomicDelete);
            } else {
                /* FIX v2: write the cleaned content in the SAME update as the
                   comment delete. Previously the field delete landed first,
                   the snapshot listener saw server content that still had the
                   highlight, and repainted it before the debounced save ran. */
                await db.collection('users').doc(state.user.uid)
                    .collection('docs').doc(state.docId)
                    .update({
                        [fieldPath]: firebase.firestore.FieldValue.delete(),
                        content: cleanContent,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                if (activeDoc && activeDoc.shareId) {
                    await db.collection('shared_docs')
                        .doc(activeDoc.shareId)
                        .update({ [fieldPath]: firebase.firestore.FieldValue.delete(), c: cleanContent });
                }
                /* Re-baseline: the editor now exactly matches what's saved,
                   so no follow-up write (and no echo) can happen. */
                state.lastSavedSig = computeSaveSig();
                state.dirty = false;
                setStatus(state.offlineMode ? 'offline' : 'saved', state.offlineMode ? 'Offline mode' : 'Saved');
            }
            showToast('Note resolved.');
        } catch (e) {
            console.error('Resolve failed:', e);
            showToast('Could not resolve \u2014 permission denied or network error.');
            const fresh = state.docs.find(d => d.id === state.docId);
            if (fresh && fresh.comments) { state.comments = Object.assign({}, fresh.comments); renderComments(); }
        }
    }

    /* FIX v2 (yellow highlight): remove every trace of a comment's format from
       BOTH Quill's document model and the DOM, synchronously. The old
       delta-based pass could miss spans that Quill had split, and Quill then
       re-rendered the highlight from its model. */
    function removeCommentFormat(cid) {
        /* Pass 1: walk the DOM spans one by one, un-formatting each exact range */
        let guard = 0;
        while (guard++ < 25) {
            const span = document.querySelector(`.ql-comment[data-cid="${cid}"]`);
            if (!span) break;
            const blot = Quill.find(span);
            if (!blot) break;
            const index = quill.getIndex(blot);
            const length = Math.max(1, (blot.length ? blot.length() : span.textContent.length) || 1);
            quill.formatText(index, length, 'comment', false, 'api');
            quill.update('api'); /* flush the render so the next query sees fresh DOM */
        }
        /* Pass 2: sweep the document model for any leftover ops with this cid */
        const contents = quill.getContents();
        let idx = 0; const ranges = [];
        contents.ops.forEach(op => {
            const len = typeof op.insert === 'string' ? op.insert.length : 1;
            if (op.attributes && op.attributes.comment === cid) ranges.push({ i: idx, l: len });
            idx += len;
        });
        ranges.forEach(r => quill.formatText(r.i, r.l, 'comment', false, 'api'));
        if (ranges.length) quill.update('api');
        /* Pass 3: last-resort DOM unwrap for anything Quill didn't own */
        document.querySelectorAll(`.ql-comment[data-cid="${cid}"]`).forEach(span => {
            const parent = span.parentNode;
            if (parent) { while (span.firstChild) parent.insertBefore(span.firstChild, span); parent.removeChild(span); }
        });
        document.querySelectorAll('.ql-comment.active-comment').forEach(el => el.classList.remove('active-comment'));
    }

    window.toggleCommentsPanel = () => {
        els.commentsPanel.classList.toggle('hidden');
        els.commentsBtn.classList.toggle('text-accent');
        renderBacklinks(); /* V3: refresh linked mentions when panel opens */
        renderOutline(); /* V3.2 */
    };

    /* ============================================================
       AUTH UI
    ============================================================ */
    function openLoginForGuest() {
        els.authScreen.classList.remove('hidden');
        els.authBox.classList.remove('opacity-0');
        els.authBox.classList.add('animate-fade-in-up');
        els.authCancelContainer.classList.remove('hidden');
    }
    function closeLoginForGuest() {
        els.authScreen.classList.add('hidden');
        els.authBox.classList.remove('animate-fade-in-up');
        els.authBox.classList.add('opacity-0');
    }
    document.getElementById('auth-form').onsubmit = (e) => {
        e.preventDefault();
        document.getElementById('auth-error').textContent = '';
        auth.signInWithEmailAndPassword(els.email.value, els.pass.value)
            .catch(() => document.getElementById('auth-error').textContent = 'Check email or password.');
    };
    document.getElementById('signup-btn').onclick = () => {
        document.getElementById('auth-error').textContent = '';
        auth.createUserWithEmailAndPassword(els.email.value, els.pass.value)
            .catch(err => document.getElementById('auth-error').textContent = err.message);
    };
    document.getElementById('logout-btn').onclick = () => { auth.signOut(); window.location.reload(); };
    window.showResetModal = () => {
        document.getElementById('reset-modal').classList.remove('hidden');
        if (els.email.value) document.getElementById('reset-email').value = els.email.value;
    };
    window.sendResetLink = () => {
        const email = document.getElementById('reset-email').value;
        if (!email) return showToast('Please enter email');
        auth.sendPasswordResetEmail(email)
            .then(() => { showToast('Reset link sent!'); document.getElementById('reset-modal').classList.add('hidden'); })
            .catch(e => showToast(e.message));
    };

    /* ============================================================
       HELP / DOWNLOAD MODALS
    ============================================================ */
    window.openHelp = () => { els.helpModal.style.display = 'flex'; };
    window.closeHelp = () => { els.helpModal.style.display = 'none'; };
    els.helpModal.addEventListener('click', (e) => { if (e.target === els.helpModal) closeHelp(); });
    window.openDownloadMenu = () => els.downloadModal.classList.remove('hidden');
    window.closeDownloadMenu = () => els.downloadModal.classList.add('hidden');
    els.downloadModal.addEventListener('click', (e) => { if (e.target === els.downloadModal) closeDownloadMenu(); });
    els.commentModal.addEventListener('click', (e) => { if (e.target === els.commentModal) closeCommentModal(); });

    /* ============================================================
       FOLDERS
    ============================================================ */
    window.createNewFolder = async () => {
        const emojis = ['📁','📂','📑','📘','💡','🚀','🗂️','📋','📌','🎯'];
        const e = emojis[Math.floor(Math.random() * emojis.length)];
        let name = prompt('Folder Name:');
        if (!name || !name.trim()) return null;
        name = name.trim();
        try {
            const ref = await db.collection('users').doc(state.user.uid).collection('folders').add({
                name: name, emoji: e, createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return ref.id;
        } catch (err) { showToast('Error creating folder'); return null; }
    };

    window.handleCreateFolderAction = async () => {
        els.mobileFolderMenu.classList.add('hidden');

        // 1. Capture the previous folder ID to revert to if the user cancels
        const activeDoc = state.docs.find(d => d.id === state.docId);
        const previousFolderId = activeDoc && activeDoc.folderId ? activeDoc.folderId : '';

        const id = await createNewFolder();

        if (id && state.docId) {
            // Success: update the database and UI
            await db.collection('users').doc(state.user.uid).collection('docs').doc(state.docId).update({ folderId: id });
            els.folderSelect.value = id;
            updateFolderDdLabel();
            showToast('Moved to new folder.');
        } else {
            // Cancelled: reset the dropdown back to the document's current folder
            els.folderSelect.value = previousFolderId;
            updateFolderDdLabel();
        }
    };

    window.deleteFolder = async (id) => {
        const folder = state.folders.find(f => f.id === id);
        const ok = await zdConfirm(`Notes inside "${folder?.name || ''}" will move back to All Files.`, { title: 'Delete folder?', okText: 'Delete', danger: true });
        if (!ok) return;
        try {
            const batch = db.batch();
            batch.delete(db.collection('users').doc(state.user.uid).collection('folders').doc(id));
            const snap = await db.collection('users').doc(state.user.uid).collection('docs').where('folderId', '==', id).get();
            snap.forEach(doc => batch.update(
                db.collection('users').doc(state.user.uid).collection('docs').doc(doc.id),
                { folderId: null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }
            ));
            await batch.commit();
            if (state.docId && els.folderSelect.value === id) { els.folderSelect.value = ''; }
            showToast('Folder deleted.');
        } catch (e) { console.error(e); showToast('Error deleting folder'); }
    };

    window.deleteCurrentDoc = async () => {
        if (!state.docId) return;
        const doc = state.docs.find(d => d.id === state.docId);
        const ok = await zdConfirm(`"${doc?.title || 'This note'}" will be permanently deleted.`, { title: 'Delete document?', okText: 'Delete', danger: true });
        if (ok) {
            const del = state.docId;
            try {
                await db.collection('users').doc(state.user.uid).collection('docs').doc(del).delete();
                const rem = state.docs.filter(d => d.id !== del);
                if (rem.length > 0) { openDoc(rem[0].id, rem[0]); } else { createNewDoc(); }
                showToast('Document deleted.');
            } catch (e) { console.error(e); showToast('Error deleting file.'); }
        }
    };

    /* ============================================================
       EXPORTS
    ============================================================ */
    /* V3.4: shared print-quality HTML used by the Word exporter */
    function buildWordHtml() {
        const title = els.title.value || 'Document';
        const css = `<style>@page{size:A4;margin:1in;}body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.5;}h1{font-size:22pt;}h2{font-size:17pt;}h3{font-size:14pt;}p{margin:0 0 8pt 0;}
            .ql-align-center{text-align:center;}.ql-align-right{text-align:right;}.ql-align-justify{text-align:justify;}.ql-align-left{text-align:left;}
            .ql-indent-1{padding-left:3em;}.ql-indent-2{padding-left:6em;}.ql-indent-3{padding-left:9em;}.ql-indent-4{padding-left:12em;}.ql-indent-5{padding-left:15em;}.ql-indent-6{padding-left:18em;}
            .ql-font-arial{font-family:Arial,sans-serif;}.ql-font-times{font-family:'Times New Roman',serif;}.ql-font-georgia{font-family:Georgia,serif;}.ql-font-garamond{font-family:Garamond,serif;}.ql-font-courier{font-family:'Courier New',monospace;}.ql-font-verdana{font-family:Verdana,sans-serif;}.ql-font-trebuchet{font-family:'Trebuchet MS',sans-serif;}.ql-font-tahoma{font-family:Tahoma,sans-serif;}.ql-font-monospace{font-family:monospace;}
            blockquote{border-left:3px solid #888;margin-left:0;padding-left:14px;color:#444;font-style:italic;}pre.ql-syntax{background:#f4f4f4;border:1px solid #ddd;padding:10px;font-family:'Courier New',monospace;white-space:pre-wrap;}
            .ql-comment{background:#fff3cd;}.ql-hashtag{color:#1a73e8;}.ql-wikilink{color:#7c3aed;}a{color:#1a73e8;}ul,ol{margin:0 0 8pt 0;}img{max-width:100%;}</style>`;
        const htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>${title}</title>${css}</head><body><h1 style="margin-bottom:16pt;">${title}</h1>${quill.root.innerHTML}</body></html>`;
        return { title: title, html: htmlDoc };
    }
    /* lazy script loader — export engines are fetched only when first used,
       keeping the app itself lightweight on mobile and desktop */
    const _libCache = {};
    function loadLib(src) {
        if (!_libCache[src]) {
            _libCache[src] = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = () => { delete _libCache[src]; reject(new Error('Could not load ' + src)); };
                document.head.appendChild(s);
            });
        }
        return _libCache[src];
    }
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    /* V3.4: REAL .docx download (Word container with full formatting).
       Falls back to the classic .doc if the engine can't load (e.g. offline). */
    async function exportWord() {
        const { title, html } = buildWordHtml();
        showToast('Preparing Word document…');
        try {
            /* FIX (V3.5): cdnjs does not host html-docx-js — that's why the
               .docx download was failing. jsDelivr and unpkg both do. */
            const DOCX_SRCS = [
                'https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.min.js',
                'https://unpkg.com/html-docx-js@0.3.1/dist/html-docx.min.js',
                'https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1'
            ];
            for (const src of DOCX_SRCS) {
                if (window.htmlDocx) break;
                try { await loadLib(src); } catch (err) { /* try the next CDN */ }
            }
            if (!window.htmlDocx) throw new Error('docx engine unavailable');
            const blob = window.htmlDocx.asBlob(html, { orientation: 'portrait' });
            downloadBlob(blob, title + '.docx');
            showToast('Word document (.docx) downloaded.');
        } catch (e) {
            console.warn('docx engine unavailable — falling back to .doc', e);
            const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
            downloadBlob(blob, title + '.doc');
            showToast('Downloaded as .doc (offline fallback).');
        }
    }
    /* V3.4: REAL .pdf download — renders the page to a paginated A4 PDF.
       Falls back to the print dialog if the engines can't load. */
    async function exportPDF() {
        const title = els.title.value || 'Document';
        showToast('Preparing PDF… (a few seconds for long notes)');
        try {
            await loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
            await loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            const src = document.querySelector('.ql-editor');
            const canvas = await window.html2canvas(src, {
                scale: 2, useCORS: true, logging: false,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#1e1e1e' : '#ffffff'
            });
            const jsPDF = window.jspdf.jsPDF;
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
            const margin = 28;
            const imgW = pw - margin * 2;
            const ratio = imgW / canvas.width;
            const pageSliceH = Math.floor((ph - margin * 2) / ratio);
            let y = 0, page = 0;
            while (y < canvas.height) {
                const slice = document.createElement('canvas');
                slice.width = canvas.width;
                slice.height = Math.min(pageSliceH, canvas.height - y);
                slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
                if (page > 0) pdf.addPage();
                pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, slice.height * ratio);
                y += slice.height; page++;
            }
            pdf.save(title + '.pdf');
            showToast('PDF downloaded.');
        } catch (e) {
            console.warn('PDF engine unavailable — using print view', e);
            showToast('PDF engine unavailable — opening print view instead.');
            window.print();
        }
    }
    function exportText() {
        const title = els.title.value || 'Document';
        const txt = title + '\n\n' + quill.getText();
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = title + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    /* V3.3: Markdown export — Obsidian-compatible (#tags and [[links]] pass through as-is) */
    function deltaToMarkdown() {
        const ops = quill.getContents().ops;
        let md = '', line = '', inCode = false;
        ops.forEach(op => {
            if (typeof op.insert !== 'string') { line += '![image](embedded)'; return; }
            const a = op.attributes || {};
            const parts = op.insert.split('\n');
            parts.forEach((seg, i) => {
                if (seg) {
                    let t = seg;
                    if (a.code) t = '`' + t + '`';
                    if (a.bold) t = '**' + t + '**';
                    if (a.italic) t = '*' + t + '*';
                    if (a.strike) t = '~~' + t + '~~';
                    if (a.link) t = '[' + t + '](' + a.link + ')';
                    line += t;
                }
                if (i < parts.length - 1) {
                    /* the newline op carries the LINE's block format */
                    if (a['code-block']) {
                        if (!inCode) { md += '```\n'; inCode = true; }
                        md += line + '\n';
                    } else {
                        if (inCode) { md += '```\n'; inCode = false; }
                        let prefix = '';
                        if (a.header) prefix = '#'.repeat(Math.min(a.header, 6)) + ' ';
                        else if (a.list === 'bullet') prefix = '- ';
                        else if (a.list === 'ordered') prefix = '1. ';
                        else if (a.list === 'checked') prefix = '- [x] ';
                        else if (a.list === 'unchecked') prefix = '- [ ] ';
                        else if (a.blockquote) prefix = '> ';
                        const indent = a.indent ? '    '.repeat(a.indent) : '';
                        md += indent + prefix + line + '\n';
                    }
                    line = '';
                }
            });
        });
        if (inCode) md += '```\n';
        if (line) md += line + '\n';
        return md;
    }
    function exportMarkdown() {
        const title = els.title.value || 'Document';
        const md = '# ' + title + '\n\n' + deltaToMarkdown();
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = title + '.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    window.exportMarkdown = exportMarkdown;
    window.downloadAsWord = exportWord; window.printDoc = exportPDF;

    /* ============================================================
       SIDEBAR / MENUS
    ============================================================ */
    window.toggleSidebar = (f) => {
        const sb = document.getElementById('sidebar'), ov = document.getElementById('mobile-overlay');
        if (f === false || !sb.classList.contains('sidebar-closed')) {
            sb.classList.add('sidebar-closed'); sb.classList.remove('sidebar-open'); ov.classList.add('hidden');
        } else {
            sb.classList.remove('sidebar-closed'); sb.classList.add('sidebar-open'); ov.classList.remove('hidden');
        }
    };
    window.toggleMobileMenu = () => els.mobileMenuDropdown.classList.toggle('hidden');
    els.folderSelect.onchange = () => {
        if (els.folderSelect.value === 'create_new') handleCreateFolderAction();
        else triggerSave();
    };
    window.toggleMobileFolderMenu = () => {
        if (els.mobileFolderMenu.classList.contains('hidden')) { renderMobileFolderList(); els.mobileFolderMenu.classList.remove('hidden'); }
        else { els.mobileFolderMenu.classList.add('hidden'); }
    };
    function renderMobileFolderList() {
        els.mobileFolderListItems.innerHTML = '';
        const root = document.createElement('button');
        const isRoot = !els.folderSelect.value;
        root.className = `w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${isRoot ? 'text-accent font-bold bg-blue-50 dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`;
        root.innerHTML = '<span>🏠</span> No Folder'; root.onclick = () => setDocFolder('');
        els.mobileFolderListItems.appendChild(root);
        state.folders.forEach(f => {
            const b = document.createElement('button');
            const sel = els.folderSelect.value === f.id;
            b.className = `w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${sel ? 'text-accent font-bold bg-blue-50 dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'}`;
            b.innerHTML = `<span>${f.emoji}</span> ${f.name}`; b.onclick = () => setDocFolder(f.id);
            els.mobileFolderListItems.appendChild(b);
        });
    }
    window.setDocFolder = (id) => { els.folderSelect.value = id; updateFolderDdLabel(); triggerSave(); els.mobileFolderMenu.classList.add('hidden'); };

    /* FIX: updateFavIcon also updates the new header-fav-btn */
    window.toggleFavorite = () => {
        state.isFav = !state.isFav; updateFavIcon(); triggerSave(); renderDocs();
        [els.favBtn, els.mFavBtn, els.headerFavBtn].forEach(btn => {
            if (!btn) return;
            btn.classList.add('pop');
            setTimeout(() => btn.classList.remove('pop'), 280);
        });
        showToast(state.isFav ? '⭐ Marked as Important' : 'Removed from Important');
    };

    function updateFavIcon() {
        // Hidden original fav-btn (kept for compatibility)
        els.favBtn.className = `hidden p-2 rounded-full transition active:scale-90 ${state.isFav ? 'text-gold' : 'text-muted hover:text-gold'}`;
        els.favBtn.title = state.isFav ? 'Unmark important' : 'Mark important';
        // Mobile fav btn
        els.mFavBtn.className = `md:hidden p-2 rounded-full transition active:scale-90 text-xl leading-none ${state.isFav ? 'text-gold' : 'text-muted'}`;
        els.mFavBtn.title = state.isFav ? 'Unmark important' : 'Mark important';
        // FIX: Header inline star button
        if (els.headerFavBtn) {
            if (state.isFav) {
                els.headerFavBtn.classList.add('is-fav');
                els.headerFavBtn.title = 'Unmark important';
            } else {
                els.headerFavBtn.classList.remove('is-fav');
                els.headerFavBtn.title = 'Mark as important';
            }
        }
    }

    window.filterDocs = (f) => {
        state.activeFilter = f;
        document.querySelectorAll('#sidebar .bg-white\\/10').forEach(e => e.classList.remove('bg-white/10', 'text-white'));
        if (f === 'all') document.getElementById('filter-all').classList.add('bg-white/10', 'text-white');
        else if (f === 'fav') document.getElementById('filter-fav').classList.add('bg-white/10', 'text-white');
        renderFolders(); renderDocs();
        renderTags(); /* V3: keep the active tag highlighted in the sidebar */
        if (window.innerWidth < 768) toggleSidebar(false);
    };
    window.focusEditor = () => { if (state.docId) quill.focus(); };

    /* ============================================================
       OFFLINE MODE
    ============================================================ */
    window.toggleOfflineMode = async () => {
        if (state.isGuest) { showToast('Sign in to use offline mode.'); return; }
        state.offlineMode = !state.offlineMode;
        if (state.offlineMode) armOfflineReminder(60 * 1000); else hideOfflineReminder(); /* V3.6 */
        const obtn = document.getElementById('offline-toggle-btn');
        if (obtn) obtn.classList.toggle('offline-on', state.offlineMode); /* V3.8 */
        updateOfflineUI();
        if (state.offlineMode) {
            if (state.saveTimer) clearTimeout(state.saveTimer);
            try { await db.disableNetwork(); } catch (e) { console.warn(e); }
            setStatus('offline', 'Offline mode');
            showToast('📴 Offline mode ON — press Ctrl+S to go back online');
        } else {
            try { await db.enableNetwork(); } catch (e) { console.warn(e); }
            showToast('☁️ Back online — syncing…');
            if (state.dirty && state.docId) { saveToDb(); }
            else { setStatus('saved', 'Synced'); }
        }
    };
    function updateOfflineUI() {
        const on = state.offlineMode;
        if (els.offlineIndicator) els.offlineIndicator.classList.toggle('hidden', !on);
        if (els.offlineBtnLabel) els.offlineBtnLabel.textContent = on ? 'Online' : 'Offline';
        if (els.mOfflineLabel) els.mOfflineLabel.textContent = on ? 'Go online' : 'Go offline';
        if (els.offlineToggleBtn) {
            els.offlineToggleBtn.classList.toggle('text-amber-400', on);
            els.offlineToggleBtn.classList.toggle('bg-amber-500/20', on);
            els.offlineToggleBtn.title = on ? 'Reconnect and sync (Ctrl+S)' : 'Work offline — pause cloud sync (Ctrl+S returns online)';
        }
    }

    /* ============================================================
       ZEN FOCUS MODE (Ctrl+.) — distraction-free writing
    ============================================================ */
    window.toggleZenMode = () => {
        const on = document.body.classList.toggle('zen');
        if (on) {
            toggleSidebar(false);
            showToast('Zen mode — press Esc to exit');
        }
        setTimeout(() => { if (state.docId) quill.focus(); }, 350);
    };

    /* ============================================================
       COMMAND PALETTE (Ctrl+K) — instant local search across all
       notes (titles + content). Zero Firebase reads: it searches the
       docs already living in memory from the realtime listener.
    ============================================================ */
    function docPlainText(d) {
        try {
            const ops = (d.content && d.content.ops) ? d.content.ops : [];
            return ops.map(o => typeof o.insert === 'string' ? o.insert : '').join('');
        } catch (e) { return ''; }
    }
    window.openPalette = () => {
        els.paletteModal.classList.add('open');
        /* FIX v2 (search focus): grab focus SYNCHRONOUSLY inside the user's
           tap/keypress (this is what lets mobile keyboards open), then keep
           retrying every 60ms for ~1.2s until the browser actually hands the
           caret to the input. A focusin trap below also snaps focus back if
           anything steals it while the palette is open. */
        try { quill.blur(); } catch (e) {}
        if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
        const focusIt = () => { try { els.paletteInput.focus({ preventScroll: true }); } catch (e) { els.paletteInput.focus(); } };
        focusIt(); /* synchronous — still inside the user gesture */
        els.paletteInput.value = '';
        state.paletteIndex = 0;
        renderPaletteResults('');
        if (state._palFocusInt) clearInterval(state._palFocusInt);
        let tries = 0;
        state._palFocusInt = setInterval(() => {
            if (!els.paletteModal.classList.contains('open') || document.activeElement === els.paletteInput || tries++ > 20) {
                clearInterval(state._palFocusInt); state._palFocusInt = null; return;
            }
            focusIt();
        }, 60);
    };
    window.closePalette = () => {
        els.paletteModal.classList.remove('open');
        if (state._palFocusInt) { clearInterval(state._palFocusInt); state._palFocusInt = null; }
    };
    /* (V3.7) palette focus-escape is handled by the unified FOCUS_TRAPS guard */
    els.paletteModal.addEventListener('click', (e) => { if (e.target === els.paletteModal) closePalette(); });
    /* FIX: clicking anywhere inside the search box area re-focuses the input */
    document.getElementById('palette-box').addEventListener('click', (e) => {
        if (!e.target.closest('.palette-item') && document.activeElement !== els.paletteInput) {
            els.paletteInput.focus({ preventScroll: true });
        }
    });

    /* V3.6: search runs in a Web Worker so the UI thread never blocks,
       keeping the palette instant even with 1,000+ notes. Falls back to
       the classic synchronous path automatically. */
    let _searchWorker = null, _searchSeq = 0, _workerIndexT = null;
    function initSearchWorker() {
        if (_searchWorker || !window.Worker) return;
        try {
            const code = `
                let docs = [];
                onmessage = (e) => {
                    const m = e.data;
                    if (m.type === 'index') { docs = m.docs; return; }
                    if (m.type === 'query') {
                        const q = m.q;
                        const out = [];
                        for (const d of docs) {
                            const inTitle = d.title.includes(q);
                            const idx = d.text.indexOf(q);
                            const inTags = q.startsWith('#') && d.tags.indexOf(q.slice(1)) >= 0;
                            if (inTitle || inTags || idx >= 0) {
                                let snip = null;
                                if (idx >= 0) {
                                    const s = Math.max(0, idx - 30);
                                    snip = (s > 0 ? '\u2026' : '') + d.raw.slice(s, idx + q.length + 40).replace(/\n/g, ' ') + '\u2026';
                                }
                                out.push({ id: d.id, snip: snip });
                            }
                        }
                        postMessage({ type: 'results', seq: m.seq, out: out });
                    }
                };`;
            _searchWorker = new Worker(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })));
            _searchWorker.onmessage = (e) => {
                const m = e.data;
                if (m.type !== 'results' || m.seq !== _searchSeq) return; /* stale */
                const ids = new Map(m.out.map(r => [r.id, r.snip]));
                const results = state.docs.filter(d => ids.has(d.id));
                const snippets = {};
                results.forEach(d => { const s = ids.get(d.id); if (s) snippets[d.id] = s; });
                paintPaletteResults(results, snippets, _lastPaletteQuery);
            };
        } catch (e) { _searchWorker = null; }
    }
    function pushSearchIndex() {
        if (!_searchWorker) return;
        clearTimeout(_workerIndexT);
        _workerIndexT = setTimeout(() => {
            try {
                _searchWorker.postMessage({
                    type: 'index',
                    docs: state.docs.map(d => {
                        const raw = docPlainText(d).slice(0, 6000);
                        return { id: d.id, title: (d.title || '').toLowerCase(), raw: raw, text: raw.toLowerCase(), tags: docTags(d) };
                    })
                });
            } catch (e) {}
        }, 400);
    }
    let _lastPaletteQuery = '';
    function renderPaletteResults(q) {
        const query = q.trim().toLowerCase();
        _lastPaletteQuery = query;
        /* big vault + worker available -> off-thread search */
        if (query && state.docs.length > 80 && (_searchWorker || (initSearchWorker(), pushSearchIndex(), _searchWorker))) {
            _searchSeq++;
            try { _searchWorker.postMessage({ type: 'query', q: query, seq: _searchSeq }); return; } catch (e) {}
        }
        let results = state.docs;
        let snippets = {};
        if (query) {
            results = state.docs.filter(d => {
                const inTitle = (d.title || '').toLowerCase().includes(query);
                /* V3: "#tag" queries match notes carrying that tag */
                const inTags = query.startsWith('#') && docTags(d).includes(query.slice(1));
                const text = docPlainText(d);
                const idx = text.toLowerCase().indexOf(query);
                if (idx >= 0) {
                    const start = Math.max(0, idx - 30);
                    snippets[d.id] = (start > 0 ? '…' : '') + text.slice(start, idx + query.length + 40).replace(/\n/g, ' ') + '…';
                }
                return inTitle || inTags || idx >= 0;
            });
        }
        paintPaletteResults(results, snippets, query);
    }
    function paintPaletteResults(results, snippets, query) {
        results = results.slice(0, 12);
        state.paletteIndex = Math.min(state.paletteIndex, Math.max(0, results.length - 1));
        els.paletteResults.innerHTML = '';
        if (results.length === 0) {
            els.paletteResults.innerHTML = '<div class="text-center text-muted text-xs py-8">No matching notes.</div>';
            els.paletteResults._results = [];
            return;
        }
        results.forEach((d, i) => {
            const folderObj = state.folders.find(f => f.id === d.folderId);
            const item = document.createElement('button');
            item.className = `palette-item w-full text-left px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition ${i === state.paletteIndex ? 'selected' : ''}`;
            item.innerHTML = `
                <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <div class="min-w-0 flex-1">
                    <div class="palette-title text-sm font-medium text-text truncate">${escapeHtml(d.title || 'Untitled')} ${d.isFavorite ? '<span class="text-gold text-xs">★</span>' : ''}</div>
                    ${snippets[d.id] ? `<div class="text-[10px] text-muted truncate mt-0.5">${escapeHtml(snippets[d.id])}</div>` : ''}
                    ${folderObj ? `<div class="text-[9px] text-muted mt-0.5 flex items-center gap-1"><svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>${escapeHtml(folderObj.name)}</div>` : ''}
                </div>`;
            item.onclick = () => { closePalette(); openDoc(d.id, d); };
            els.paletteResults.appendChild(item);
        });
        els.paletteResults._results = results;
    }
    els.paletteInput.addEventListener('input', () => { state.paletteIndex = 0; renderPaletteResults(els.paletteInput.value); });
    els.paletteInput.addEventListener('keydown', (e) => {
        const results = els.paletteResults._results || [];
        if (e.key === 'ArrowDown') { e.preventDefault(); state.paletteIndex = Math.min(state.paletteIndex + 1, results.length - 1); renderPaletteResults(els.paletteInput.value); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); state.paletteIndex = Math.max(state.paletteIndex - 1, 0); renderPaletteResults(els.paletteInput.value); }
        else if (e.key === 'Enter') { e.preventDefault(); const d = results[state.paletteIndex]; if (d) { closePalette(); openDoc(d.id, d); } }
        else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });

