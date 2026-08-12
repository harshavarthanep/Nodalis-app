// ZenDocs — 02-tags-graph-daily-planner.js
// V3 tags/wiki-links/backlinks/graph view, plus V3.1 autocomplete, daily notes, calendar, kanban and canvas.
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
       V3 — #TAGS, [[WIKI-LINKS]], BACKLINKS & GRAPH (Obsidian-style)
       Everything below is local-first: it works on the docs already
       in memory, so it costs zero extra Firestore reads.
    ============================================================ */
    function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    const TAG_RE = /(^|[\s\u00A0([{])#([A-Za-z0-9_\-\/]+)/g;
    const WIKI_RE = /\[\[([^\[\]\n]{1,100})\]\]/g;
    const URL_RE = /(https?:\/\/[^\s<>"')\]}]+|www\.[a-z0-9-]+\.[^\s<>"')\]}]+)/gi; /* V3.2 */

    /* All #tags used in a note (lowercased, deduped) */
    function docTags(d) {
        const out = new Set(); const text = docPlainText(d); let m;
        TAG_RE.lastIndex = 0;
        while ((m = TAG_RE.exec(text))) out.add(m[2].toLowerCase());
        return Array.from(out);
    }
    /* All [[link targets]] written inside a note */
    function docLinks(d) {
        const out = []; const text = docPlainText(d); let m;
        WIKI_RE.lastIndex = 0;
        while ((m = WIKI_RE.exec(text))) out.push(m[1].trim());
        return out;
    }

    /* --- live highlighting: scan the open document and (re)apply the
       hashtag / wikilink inline formats. Runs debounced after typing. --- */
    let scanTimer = null;
    function scheduleTokenScan() {
        if (state.isGuest) return;
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => { scanInlineTokens(true); renderOutline(); }, 600);
    }
    function scanInlineTokens(save = true) {
        if (state.isGuest || !state.docId) return;
        const text = quill.getText();
        const hasUrl = /https?:\/\/|www\./i.test(text);
        const hasTokens = text.indexOf('#') !== -1 || text.indexOf('[[') !== -1 || hasUrl;
        const hasFormats = !!document.querySelector('.ql-editor .ql-hashtag, .ql-editor .ql-wikilink');
        if (!hasTokens && !hasFormats) return; /* nothing to do — skip the work */

        const len = text.length;
        const tags = []; const links = []; let m;
        TAG_RE.lastIndex = 0;
        while ((m = TAG_RE.exec(text))) tags.push({ i: m.index + m[1].length, l: m[2].length + 1, v: m[2].toLowerCase() });
        WIKI_RE.lastIndex = 0;
        while ((m = WIKI_RE.exec(text))) links.push({ i: m.index, l: m[0].length, v: m[1].trim() });

        const sel = quill.getSelection();
        /* FIX (V3.6): 'api' (not 'silent') so Quill's history module transforms
           the undo stack against these edits — Ctrl+Z / Ctrl+Y stay correct. */
        quill.formatText(0, len, { hashtag: false, wikilink: false }, 'api');
        tags.forEach(t => quill.formatText(t.i, t.l, 'hashtag', t.v, 'api'));
        links.forEach(t => quill.formatText(t.i, t.l, 'wikilink', t.v, 'api'));
        /* V3.2: auto-link bare URLs (Google-Docs style) — additive only,
           never removes links the user added manually */
        if (hasUrl) {
            URL_RE.lastIndex = 0;
            let um;
            while ((um = URL_RE.exec(text))) {
                let v = um[0], l = v.length;
                while (l > 0 && /[.,;:!?)\]}]$/.test(v)) { v = v.slice(0, -1); l--; } /* trim trailing punctuation */
                if (l < 5) continue;
                const skipSet = state.noAutoLink && state.noAutoLink[state.docId];
                if (skipSet && skipSet.has(v)) continue; /* V3.3: user removed this link on purpose */
                const fmt = quill.getFormat(um.index, 1);
                if (!fmt.link && !fmt.wikilink) {
                    quill.formatText(um.index, l, 'link', /^www\./i.test(v) ? 'https://' + v : v, 'api');
                }
            }
        }
        /* FIX (V3.6): only restore the caret if the editor still owns focus —
           never steal the cursor from another input. Permanent fix for every
           "cursor not coming" issue, now and in future features. */
        if (sel && quill.hasFocus()) quill.setSelection(sel.index, sel.length, 'silent');
        scheduleFolds(); /* V3.8: folded sections survive re-highlighting */

        if (save) triggerSave(); /* fingerprint-guarded: only writes if something changed */
        renderBacklinks();
    }

    /* --- sidebar tag list --- */
    function renderTags() {
        const el = els.tagList; if (!el) return;
        if (state.isGuest) { el.innerHTML = ''; return; }
        const counts = {};
        state.docs.forEach(d => docTags(d).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
        const tags = Object.keys(counts).sort();
        el.innerHTML = '';
        if (tags.length === 0) {
            el.innerHTML = '<div class="text-[10px] text-gray-600 px-2 py-1">Type <span class="text-accent">#tag</span> in any note to create a tag</div>';
            return;
        }
        tags.forEach(t => {
            const active = state.activeFilter === 'tag:' + t;
            const row = document.createElement('div');
            row.className = `tag-row cursor-pointer p-2 rounded-lg flex items-center justify-between transition hover:translate-x-1 duration-200 ${active ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`;
            row.innerHTML = `<span class="text-sm flex items-center gap-2 min-w-0"><span class="text-accent font-bold">#</span><span class="truncate">${escapeHtml(t)}</span></span><span class="text-[9px] bg-white/10 rounded-full px-1.5 py-0.5 flex-shrink-0">${counts[t]}</span>`;
            row.onclick = () => filterDocs(active ? 'all' : 'tag:' + t);
            el.appendChild(row);
        });
    }
    /* Jump to a tag from inside the editor: filter + show the sidebar */
    window.jumpToTag = (tag) => {
        if (!tag) return;
        filterDocs('tag:' + String(tag).toLowerCase());
        if (window.innerWidth < 768) toggleSidebar(true);
        showToast('Filtering by #' + tag);
    };

    /* --- follow / create [[wiki-links]] --- */
    window.openNoteByTitle = async (title) => {
        if (state.isGuest) { showToast('Sign in to follow links.'); return; }
        const t = String(title || '').trim();
        if (!t) return;
        const found = state.docs.find(d => (d.title || '').trim().toLowerCase() === t.toLowerCase());
        if (found) { openDoc(found.id, found); return; }
        const ok = await zdConfirm(`"${t}" doesn't exist yet. Create it as a new note?`, { title: 'Create linked note?', okText: 'Create' });
        if (!ok) return;
        try {
            const ref = await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: t, content: '', isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            openDoc(ref.id, { title: t, content: '', isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96 });
            showToast('Linked note created.');
        } catch (e) { console.error(e); showToast('Could not create note.'); }
    };

    /* --- backlinks / linked mentions --- */
    function renderBacklinks() {
        const el = els.backlinksList; if (!el) return;
        if (!state.docId || state.isGuest) { el.innerHTML = '<div class="text-[10px] text-muted">—</div>'; return; }
        const cur = state.docs.find(d => d.id === state.docId);
        const title = ((cur && cur.title) || els.title.value || '').trim();
        if (!title) { el.innerHTML = ''; return; }
        const re = new RegExp('\\[\\[\\s*' + escapeRegExp(title) + '\\s*\\]\\]', 'i');
        const refs = state.docs.filter(d => d.id !== state.docId && re.test(docPlainText(d)));
        if (refs.length === 0) {
            el.innerHTML = '<div class="text-[10px] text-muted">No notes link here yet. Type [[' + escapeHtml(title) + ']] in another note to create a backlink.</div>';
            return;
        }
        el.innerHTML = '';
        refs.forEach(d => {
            const b = document.createElement('button');
            b.className = 'w-full text-left text-xs p-2 rounded-lg border border-border hover:border-accent/50 bg-bg transition flex items-center gap-2 active:scale-[.98]';
            b.innerHTML = `<span class="text-accent flex-shrink-0"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5"/></svg></span><span class="bl-title truncate text-text transition-colors">${escapeHtml(d.title || 'Untitled')}</span>`;
            b.onclick = () => openDoc(d.id, d);
            el.appendChild(b);
        });
        renderUnlinkedMentions(title, refs);
    }

    /* V3.6: UNLINKED MENTIONS — Obsidian's discovery engine.
       Scans the notes already cached in memory (state.docs) for the current
       title appearing as plain text without a [[link]]. No extra Firestore
       reads — completely free. */
    function renderUnlinkedMentions(title, linkedRefs) {
        const el = document.getElementById('unlinked-list'); if (!el) return;
        if (!title || title.length < 3) { el.innerHTML = '<div class="text-[10px] text-muted">—</div>'; return; }
        const linkedIds = new Set(linkedRefs.map(d => d.id));
        const t = title.toLowerCase();
        const hits = state.docs.filter(d =>
            d.id !== state.docId && !linkedIds.has(d.id) &&
            docPlainText(d).toLowerCase().includes(t)
        ).slice(0, 8);
        if (!hits.length) { el.innerHTML = '<div class="text-[10px] text-muted">No unlinked mentions of “' + escapeHtml(title) + '”.</div>'; return; }
        el.innerHTML = '<div class="text-[10px] text-muted mb-1.5">These notes mention “' + escapeHtml(title) + '” but don’t link to it yet — open one and wrap the mention in [[…]] to connect it:</div>';
        hits.forEach(d => {
            const b = document.createElement('button');
            b.className = 'w-full text-left text-xs p-2 rounded-lg border border-dashed border-border hover:border-accent/60 bg-bg transition flex items-center gap-2 active:scale-[.98] mb-1';
            b.innerHTML = `<span class="text-muted flex-shrink-0"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/></svg></span><span class="truncate text-text">${escapeHtml(d.title || 'Untitled')}</span>`;
            b.onclick = () => openDoc(d.id, d);
            el.appendChild(b);
        });
    }

    /* --- GRAPH VIEW: force-directed map of notes, tags and links --- */
    /* V3.5: pinch-to-zoom, hold-to-focus (connected nodes highlighted, rest
       dimmed \u2014 the Obsidian effect), monochrome professional palette with
       the accent color only where it matters, and auto-fit on open so every
       node is visible on mobile. */
    let graphNodes = [], graphEdges = [], graphAnim = null, graphDrag = null, graphDownAt = null, graphPan = null, graphEventsBound = false;
    let graphFocus = null, graphNbrs = null, graphPinch = null, graphInteracted = false;
    const graphPointers = new Map();
    const gView = { x: 0, y: 0, s: 1 };

    function accentRGB() {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
        return v ? v.split(/\s+/).join(',') : '26,115,232';
    }

    window.openGraph = () => {
        if (state.isGuest) { showToast('Sign in to see your graph.'); return; }
        gView.x = 0; gView.y = 0; gView.s = 1;
        graphInteracted = false; graphFocus = null; graphNbrs = null;
        updateGraphZoomLabel();
        els.graphModal.classList.add('open');
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); /* V3.8.1: full-height canvas on mobile */
        buildGraph();
        bindGraphEvents();
        startGraphLoop();
        /* auto-fit once the layout settles, unless the user already interacted */
        setTimeout(() => {
            if (!graphInteracted && els.graphModal.classList.contains('open')) graphAutoFit();
        }, 800);
    };
    window.closeGraph = () => {
        if (!els.graphModal.classList.contains('open')) return;
        els.graphModal.classList.remove('open');
        if (graphAnim) cancelAnimationFrame(graphAnim);
        graphAnim = null; graphDrag = null; graphPan = null; graphPinch = null;
        graphPointers.clear();
    };
    function updateGraphZoomLabel() {
        const el = document.getElementById('graph-zoom-label');
        if (el) el.textContent = Math.round(gView.s * 100) + '%';
    }
    window.graphZoom = (f, cx, cy) => {
        const cv = els.graphCanvas;
        const px = typeof cx === 'number' ? cx : cv.clientWidth / 2;
        const py = typeof cy === 'number' ? cy : cv.clientHeight / 2;
        const old = gView.s;
        gView.s = Math.max(0.3, Math.min(2.5, gView.s * f));
        gView.x = px - ((px - gView.x) / old) * gView.s;
        gView.y = py - ((py - gView.y) / old) * gView.s;
        updateGraphZoomLabel();
    };
    window.graphZoomReset = () => { graphAutoFit(); };
    function graphAutoFit() {
        const cv = els.graphCanvas;
        if (!graphNodes.length) { gView.x = 0; gView.y = 0; gView.s = 1; updateGraphZoomLabel(); return; }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        graphNodes.forEach(n => {
            minX = Math.min(minX, n.x - 60); maxX = Math.max(maxX, n.x + 60);
            minY = Math.min(minY, n.y - 30); maxY = Math.max(maxY, n.y + 40);
        });
        const W = cv.clientWidth, H = cv.clientHeight;
        const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
        gView.s = Math.max(0.3, Math.min(1.15, Math.min(W / w, H / h)));
        gView.x = (W - w * gView.s) / 2 - minX * gView.s;
        gView.y = (H - h * gView.s) / 2 - minY * gView.s;
        updateGraphZoomLabel();
    }

    function buildGraph() {
        const W = els.graphCanvas.clientWidth || window.innerWidth;
        const H = els.graphCanvas.clientHeight || (window.innerHeight - 100);
        graphNodes = []; graphEdges = [];
        const byTitle = {}; const nodeById = {};
        state.docs.forEach(d => {
            const n = {
                id: 'doc:' + d.id, type: 'doc', label: d.title || 'Untitled', ref: d,
                x: W / 2 + (Math.random() - 0.5) * W * 0.55,
                y: H / 2 + (Math.random() - 0.5) * H * 0.55,
                vx: 0, vy: 0, r: 7
            };
            graphNodes.push(n); nodeById[n.id] = n;
            byTitle[(d.title || '').trim().toLowerCase()] = n;
        });
        /* V3.6: cluster coloring — notes take a soft hue from their folder */
        const folderHue = (fid) => {
            let h = 0; const s = String(fid || '');
            for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
            return h;
        };
        graphNodes.forEach(n => {
            if (n.type === 'doc') {
                n.fill = n.ref.folderId ? ('hsl(' + folderHue(n.ref.folderId) + ',42%,64%)') : '#c6cbd4';
            }
        });
        const tagNodes = {};
        state.docs.forEach(d => {
            const src = nodeById['doc:' + d.id];
            docLinks(d).forEach(t => {
                const dst = byTitle[t.toLowerCase()];
                if (dst && dst !== src) graphEdges.push({ a: src, b: dst, kind: 'link' });
            });
            docTags(d).forEach(t => {
                if (!tagNodes[t]) {
                    tagNodes[t] = {
                        id: 'tag:' + t, type: 'tag', label: '#' + t,
                        x: W / 2 + (Math.random() - 0.5) * W * 0.55,
                        y: H / 2 + (Math.random() - 0.5) * H * 0.55,
                        vx: 0, vy: 0, r: 4.5
                    };
                    graphNodes.push(tagNodes[t]);
                }
                graphEdges.push({ a: src, b: tagNodes[t], kind: 'tag' });
            });
        });
        /* V3.6: node size follows in-degree — well-referenced notes grow */
        const indeg = new Map();
        graphEdges.forEach(ed => {
            if (ed.kind === 'link') indeg.set(ed.b, (indeg.get(ed.b) || 0) + 1);
            if (ed.kind === 'tag') indeg.set(ed.b, (indeg.get(ed.b) || 0) + 0.5);
        });
        graphNodes.forEach(n => {
            const k = indeg.get(n) || 0;
            n.r = (n.type === 'tag' ? 4.5 : 6) + Math.min(9, k * 1.25);
        });
    }

    function graphDisplayLabel(n) { return n.label.length > 22 ? n.label.slice(0, 21) + '\u2026' : n.label; }

    function graphHitTest(x, y) {
        for (let i = graphNodes.length - 1; i >= 0; i--) {
            const n = graphNodes[i];
            const dx = x - n.x, dy = y - n.y;
            if (dx * dx + dy * dy <= (n.r + 9) * (n.r + 9)) return n;
            const lw = Math.max(30, graphDisplayLabel(n).length * 6.4);
            if (x >= n.x - lw / 2 - 4 && x <= n.x + lw / 2 + 4 &&
                y >= n.y + n.r + 1 && y <= n.y + n.r + 19) return n;
        }
        return null;
    }

    function setGraphFocus(n) {
        graphFocus = n;
        if (!n) { graphNbrs = null; return; }
        graphNbrs = new Set([n]);
        graphEdges.forEach(ed => {
            if (ed.a === n) graphNbrs.add(ed.b);
            if (ed.b === n) graphNbrs.add(ed.a);
        });
    }

    function bindGraphEvents() {
        if (graphEventsBound) return;
        graphEventsBound = true;
        const cv = els.graphCanvas;
        const screenPos = (e) => {
            const r = cv.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        const worldPos = (e) => {
            const p = screenPos(e);
            return { x: (p.x - gView.x) / gView.s, y: (p.y - gView.y) / gView.s };
        };
        cv.addEventListener('pointerdown', (e) => {
            graphInteracted = true;
            const sp = screenPos(e);
            graphPointers.set(e.pointerId, sp);
            if (graphPointers.size === 2) {
                /* two fingers: pinch-to-zoom takes over */
                const pts = Array.from(graphPointers.values());
                graphPinch = {
                    d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
                    s0: gView.s,
                    mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
                };
                graphDrag = null; graphPan = null; graphDownAt = null;
                setGraphFocus(null);
                return;
            }
            const wp = worldPos(e);
            const n = graphHitTest(wp.x, wp.y);
            graphDownAt = { sx: sp.x, sy: sp.y, node: n };
            if (n) { graphDrag = n; setGraphFocus(n); /* Obsidian hold-highlight */ }
            else { graphPan = { sx: sp.x, sy: sp.y, ox: gView.x, oy: gView.y }; }
            try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        });
        cv.addEventListener('pointermove', (e) => {
            if (graphPointers.has(e.pointerId)) graphPointers.set(e.pointerId, screenPos(e));
            if (graphPinch && graphPointers.size >= 2) {
                const pts = Array.from(graphPointers.values());
                const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
                const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
                const old = gView.s;
                gView.s = Math.max(0.3, Math.min(2.5, graphPinch.s0 * (d / graphPinch.d0)));
                gView.x = mid.x - ((graphPinch.mid.x - gView.x) / old) * gView.s;
                gView.y = mid.y - ((graphPinch.mid.y - gView.y) / old) * gView.s;
                graphPinch.mid = mid;
                updateGraphZoomLabel();
                return;
            }
            if (graphDrag) {
                const wp = worldPos(e);
                graphDrag.x = wp.x; graphDrag.y = wp.y;
                graphDrag.vx = 0; graphDrag.vy = 0;
            } else if (graphPan) {
                const sp = screenPos(e);
                gView.x = graphPan.ox + (sp.x - graphPan.sx);
                gView.y = graphPan.oy + (sp.y - graphPan.sy);
            } else if (e.pointerType === 'mouse') {
                /* desktop hover = same highlight effect */
                const wp = worldPos(e);
                const hov = graphHitTest(wp.x, wp.y);
                if (hov !== graphFocus) setGraphFocus(hov);
                cv.style.cursor = hov ? 'pointer' : 'default';
            }
        });
        const up = (e) => {
            graphPointers.delete(e.pointerId);
            if (graphPointers.size < 2) graphPinch = null;
            const sp = screenPos(e);
            const moved = graphDownAt ? Math.hypot(sp.x - graphDownAt.sx, sp.y - graphDownAt.sy) : 99;
            const n = graphDownAt ? graphDownAt.node : null;
            graphDrag = null; graphPan = null;
            if (e.pointerType !== 'mouse') setGraphFocus(null);
            if (n && moved < 7) {
                if (n.type === 'doc') { closeGraph(); openDoc(n.ref.id, n.ref); }
                else if (n.type === 'tag') { closeGraph(); jumpToTag(n.label.slice(1)); }
            }
            graphDownAt = null;
        };
        cv.addEventListener('pointerup', up);
        cv.addEventListener('pointercancel', (e) => {
            graphPointers.delete(e.pointerId);
            if (graphPointers.size < 2) graphPinch = null;
            graphDrag = null; graphPan = null; graphDownAt = null;
            if (e.pointerType !== 'mouse') setGraphFocus(null);
        });
        cv.addEventListener('wheel', (e) => {
            e.preventDefault();
            graphInteracted = true;
            const sp = screenPos(e);
            graphZoom(e.deltaY < 0 ? 1.12 : 0.89, sp.x, sp.y);
        }, { passive: false });
    }

    function startGraphLoop() {
        const cv = els.graphCanvas;
        const ctx = cv.getContext('2d');
        const step = () => {
            if (!els.graphModal.classList.contains('open')) return;
            const W = cv.clientWidth, H = cv.clientHeight;
            const dpr = window.devicePixelRatio || 1;
            if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
                cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.save();
            ctx.translate(gView.x, gView.y);
            ctx.scale(gView.s, gView.s);
            const AC = accentRGB();

            for (let i = 0; i < graphNodes.length; i++) {
                const a = graphNodes[i];
                for (let j = i + 1; j < graphNodes.length; j++) {
                    const b = graphNodes[j];
                    let dx = a.x - b.x, dy = a.y - b.y;
                    let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
                    const d = Math.sqrt(d2);
                    const f = Math.min(2600 / d2, 6);
                    dx /= d; dy /= d;
                    a.vx += dx * f; a.vy += dy * f;
                    b.vx -= dx * f; b.vy -= dy * f;
                }
            }
            graphEdges.forEach(ed => {
                let dx = ed.b.x - ed.a.x, dy = ed.b.y - ed.a.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                const rest = ed.kind === 'tag' ? 90 : 120;
                const f = (d - rest) * 0.02;
                dx /= d; dy /= d;
                ed.a.vx += dx * f; ed.a.vy += dy * f;
                ed.b.vx -= dx * f; ed.b.vy -= dy * f;
            });
            graphNodes.forEach(n => {
                if (n === graphDrag) return;
                n.vx += (W / 2 - n.x) * 0.0015;
                n.vy += (H / 2 - n.y) * 0.0015;
                n.vx *= 0.85; n.vy *= 0.85;
                n.x += n.vx; n.y += n.vy;
                n.x = Math.max(-W, Math.min(W * 2, n.x));
                n.y = Math.max(-H, Math.min(H * 2, n.y));
            });

            const dimmed = !!graphFocus;
            /* edges \u2014 quiet monochrome, accent only for the focused node's links */
            graphEdges.forEach(ed => {
                const hot = dimmed && (ed.a === graphFocus || ed.b === graphFocus);
                ctx.beginPath();
                ctx.moveTo(ed.a.x, ed.a.y);
                ctx.lineTo(ed.b.x, ed.b.y);
                if (hot) { ctx.strokeStyle = 'rgba(' + AC + ',0.95)'; ctx.lineWidth = 2.6 / gView.s; }
                else {
                    /* V3.7: bolder Obsidian-style edges — clearly visible links */
                    ctx.strokeStyle = dimmed ? 'rgba(158,165,180,0.08)' : (ed.kind === 'tag' ? 'rgba(158,165,180,0.34)' : 'rgba(163,170,186,0.55)');
                    ctx.lineWidth = (ed.kind === 'tag' ? 1.2 : 1.9) / gView.s;
                }
                ctx.stroke();
            });
            /* nodes \u2014 soft gray dots, accent for tags & the current note */
            graphNodes.forEach(n => {
                const inFocus = !dimmed || (graphNbrs && graphNbrs.has(n));
                ctx.globalAlpha = inFocus ? 1 : 0.13;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = n.type === 'tag' ? 'rgba(' + AC + ',0.9)' : (n.fill || '#c6cbd4');
                ctx.fill();
                if (n === graphFocus || (n.type === 'doc' && n.ref && n.ref.id === state.docId)) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.r + 3.5, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(' + AC + ',1)';
                    ctx.lineWidth = 2 / gView.s;
                    ctx.stroke();
                }
                const label = graphDisplayLabel(n);
                ctx.font = (n.type === 'tag' ? '10px' : '11px') + ' Inter, sans-serif';
                ctx.fillStyle = n.type === 'tag' ? 'rgba(' + AC + ',0.95)' : 'rgba(235,238,244,0.88)';
                ctx.textAlign = 'center';
                ctx.fillText(label, n.x, n.y + n.r + 13);
                ctx.globalAlpha = 1;
            });
            ctx.restore();

            if (graphNodes.length === 0) {
                ctx.font = '13px Inter, sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.textAlign = 'center';
                ctx.fillText('No notes yet \u2014 create a few notes, add #tags and [[links]] to see your graph.', W / 2, H / 2);
            }
            graphAnim = requestAnimationFrame(step);
        };
        if (graphAnim) cancelAnimationFrame(graphAnim);
        graphAnim = requestAnimationFrame(step);
    }

    /* ============================================================
       V3.1 — AUTOCOMPLETE, DAILY NOTES, CALENDAR, KANBAN, CANVAS,
       TEMPLATES. Everything here is additive and local-first:
       existing behaviour above this block is unchanged.
    ============================================================ */

    /* ---------- shared helpers ---------- */
    function closeAllViews() { closeCalendar(); closeKanban(); closeCanvas(); closeTemplates(); closeGraph(); if (window.closeHome) closeHome(); }
    function refreshOpenViews() {
        pushSearchIndex(); /* V3.6: keep the worker's search index in sync */
        const kb = document.getElementById('kanban-modal');
        const cal = document.getElementById('calendar-modal');
        const cvm = document.getElementById('canvas-modal');
        if (kb && kb.classList.contains('open')) renderKanban();
        const hm = document.getElementById('home-modal');
        if (hm && hm.classList.contains('open')) renderHome();
        if (cal && cal.classList.contains('open')) renderCalendar();
        if (cvm && cvm.classList.contains('open') && !cv.drag && !cv.panDrag) renderCanvas();
    }

    /* ---------- NOTE PICKER (shared by kanban + canvas) ---------- */
    let _pickerCb = null;
    window.openNotePicker = (cb, title) => {
        _pickerCb = cb;
        document.getElementById('picker-title').textContent = title || 'Pick a note';
        const inp = document.getElementById('picker-search');
        const modal = document.getElementById('note-picker-modal');
        inp.value = '';
        renderPickerList('');
        modal.classList.add('open');
        /* FIX (V3.2): same caret fix as the search palette — focus
           synchronously inside the tap, then retry until it lands */
        const focusIt = () => { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } };
        focusIt();
        let tries = 0;
        const iv = setInterval(() => {
            if (!modal.classList.contains('open') || document.activeElement === inp || tries++ > 15) { clearInterval(iv); return; }
            focusIt();
        }, 60);
    };
    window.closeNotePicker = () => { document.getElementById('note-picker-modal').classList.remove('open'); _pickerCb = null; };
    function renderPickerList(q) {
        const list = document.getElementById('picker-list');
        const query = q.trim().toLowerCase();
        let docs = state.docs;
        if (query) docs = docs.filter(d => (d.title || '').toLowerCase().includes(query));
        docs = docs.slice(0, 30);
        list.innerHTML = docs.length ? '' : '<div class="text-center text-muted text-xs py-6">No matching notes.</div>';
        docs.forEach(d => {
            const b = document.createElement('button');
            b.className = 'w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-text transition';
            b.innerHTML = `<span class="text-gray-400 flex-shrink-0"><svg class="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></span><span class="truncate">${escapeHtml(d.title || 'Untitled')}</span>`;
            b.onclick = () => { const cb = _pickerCb; closeNotePicker(); if (cb) cb(d); };
            list.appendChild(b);
        });
    }
    document.getElementById('picker-search').addEventListener('input', (e) => renderPickerList(e.target.value));
    document.getElementById('note-picker-modal').addEventListener('click', (e) => { if (e.target.id === 'note-picker-modal') closeNotePicker(); });

    /* ---------- DAILY NOTES ---------- */
    function pad2(n) { return String(n).padStart(2, '0'); }
    function dailyTitle(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function dailyHuman(d) { return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    window.openDailyNote = async (date) => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        const d = date || new Date();
        const t = dailyTitle(d);
        const found = state.docs.find(x => (x.title || '').trim() === t);
        closeAllViews();
        if (found) { openDoc(found.id, found); return; }
        const ok = await zdConfirm(dailyHuman(d), { title: 'Create daily note ' + t + '?', okText: 'Create', icon: '' });
        if (!ok) return;
        const content = { ops: [
            { insert: dailyHuman(d) }, { insert: '\n', attributes: { header: 1 } },
            { insert: '#daily' }, { insert: '\n\n' },
            { insert: '\ud83c\udfaf Top priorities' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'unchecked' } },
            { insert: '\n', attributes: { list: 'unchecked' } },
            { insert: '\n', attributes: { list: 'unchecked' } },
            { insert: '\ud83d\udcdd Notes' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n' },
            { insert: '\ud83c\udf19 Reflection' }, { insert: '\n', attributes: { header: 3 } },
            { insert: 'What went well \u00b7 what to improve \u00b7 gratitude' }, { insert: '\n', attributes: { blockquote: true } },
            { insert: '\n' }
        ]};
        try {
            const ref = await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: t, content: content, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            openDoc(ref.id, { title: t, content: content, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96 });
            showToast('Daily note created ☀️');
        } catch (e) { console.error(e); showToast('Could not create daily note.'); }
    };

    /* ---------- CALENDAR VIEW (V3.2: day details, month/year picker, mobile layout) ---------- */
    var calMonth = new Date();
    window.openCalendar = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        closeAllViews();
        document.getElementById('calendar-modal').classList.add('open');
        renderCalendar();
    };
    window.closeCalendar = () => { document.getElementById('calendar-modal').classList.remove('open'); closeCalPicker(); closeDayDetail(); };
    window.calShift = (n) => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1); renderCalendar(); };
    window.calToday = () => { calMonth = new Date(); renderCalendar(); };
    function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

    /* month/year dropdown picker */
    window.toggleCalPicker = () => {
        const p = document.getElementById('cal-picker');
        if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
        const ms = document.getElementById('cal-month-sel');
        const ys = document.getElementById('cal-year-sel');
        ms.innerHTML = ''; ys.innerHTML = '';
        for (let m = 0; m < 12; m++) {
            const o = document.createElement('option');
            o.value = m;
            o.textContent = new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'long' });
            ms.appendChild(o);
        }
        const thisYear = new Date().getFullYear();
        for (let y = 1950; y <= 2100; y++) { /* V3.3: scroll through any year */
            const o = document.createElement('option');
            o.value = y; o.textContent = y;
            ys.appendChild(o);
        }
        ms.value = calMonth.getMonth();
        ys.value = calMonth.getFullYear();
        p.classList.remove('hidden');
        try { ys.selectedIndex = calMonth.getFullYear() - 1950; } catch (e) {}
    };
    window.closeCalPicker = () => { const p = document.getElementById('cal-picker'); if (p) p.classList.add('hidden'); };
    ['cal-month-sel', 'cal-year-sel'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const m = parseInt(document.getElementById('cal-month-sel').value, 10);
            const y = parseInt(document.getElementById('cal-year-sel').value, 10);
            calMonth = new Date(y, m, 1);
            renderCalendar();
        });
    });

    function notesOnDay(d) {
        return state.docs.filter(x =>
            (x.createdAt && sameDay(new Date(x.createdAt.toDate()), d)) ||
            (x.title || '').trim() === dailyTitle(d)
        );
    }

    function renderCalendar() {
        const grid = document.getElementById('cal-grid'); if (!grid) return;
        const y = calMonth.getFullYear(), m = calMonth.getMonth();
        document.getElementById('cal-title').textContent = calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        const startDow = new Date(y, m, 1).getDay();
        const daysIn = new Date(y, m + 1, 0).getDate();
        const today = new Date();
        grid.innerHTML = '';
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((w, i) => {
            const full = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
            const h = document.createElement('div');
            h.className = 'text-center text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-muted py-1 select-none';
            h.innerHTML = `<span class="md:hidden">${w}</span><span class="hidden md:inline">${full}</span>`;
            grid.appendChild(h);
        });
        for (let i = 0; i < startDow; i++) grid.appendChild(document.createElement('div'));
        for (let day = 1; day <= daysIn; day++) {
            const d = new Date(y, m, day);
            const t = dailyTitle(d);
            const hasDaily = state.docs.some(x => (x.title || '').trim() === t);
            const count = notesOnDay(d).length;
            const isToday = sameDay(d, today);
            const cell = document.createElement('button');
            cell.className = `relative min-h-[48px] md:min-h-[84px] rounded-lg md:rounded-xl border text-left p-1 md:p-2 transition active:scale-[.96] overflow-hidden ${isToday ? 'border-accent bg-accent/10' : count > 0 ? 'border-border bg-surface hover:border-accent/60' : 'border-border/60 bg-surface/50 hover:border-accent/40'}`;
            cell.innerHTML = `<span class="text-[10px] md:text-xs font-semibold ${isToday ? 'text-accent' : 'text-text'}">${day}</span>
                ${hasDaily ? '<span class="absolute top-0.5 right-1 md:top-1.5 md:right-2 text-[8px] md:text-[10px]" title="Daily note exists">☀️</span>' : ''}
                ${count > 0 ? `<span class="absolute bottom-0.5 left-1 md:bottom-1.5 md:left-2 inline-flex items-center gap-0.5 text-[8px] md:text-[9px] px-1 md:px-1.5 py-px md:py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-accent dark:text-blue-300 font-semibold">${count}<span class="hidden md:inline">&nbsp;note${count > 1 ? 's' : ''}</span></span>` : ''}`;
            cell.title = t;
            cell.onclick = () => openDayDetail(d);
            grid.appendChild(cell);
        }
    }

    /* Day-detail: notes for that day, each with info + duplicate (like the sidebar) */
    var _dayDetailDate = null;
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
                <button class="dd-info w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition active:scale-90 flex-shrink-0" title="File info">${INFO_SVG}</button>
                <button class="dd-dup w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition active:scale-90 flex-shrink-0" title="Duplicate">${DUP_SVG}</button>`;
            row.querySelector('.dd-open').onclick = () => { closeDayDetail(); closeCalendar(); openDoc(doc.id, doc); };
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
    window.closeDayDetail = () => document.getElementById('day-detail-modal').classList.remove('open');
    document.getElementById('day-detail-modal').addEventListener('click', (e) => { if (e.target.id === 'day-detail-modal') closeDayDetail(); });

    /* ---------- KANBAN BOARD (V3.5: structured cards, resize handles,
         remove-confirmation, full-width desktop layout) ---------- */
    const KANBAN_COLS = [
        { id: 'todo', label: 'To do', color: '#1a73e8' },
        { id: 'doing', label: 'In progress', color: '#f59e0b' },
        { id: 'done', label: 'Done', color: '#22c55e' }
    ];
    window.openKanban = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        closeAllViews();
        document.getElementById('kanban-modal').classList.add('open');
        renderKanban();
    };
    window.closeKanban = () => document.getElementById('kanban-modal').classList.remove('open');
    async function setKanban(docId, col) {
        const d = state.docs.find(x => x.id === docId);
        if (d) d.kanban = col; /* optimistic — snapshot confirms */
        renderKanban();
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').doc(docId).update({ kanban: col });
        } catch (e) { console.error(e); showToast('Could not move card.'); }
    }
    /* V3.5: removing a card asks first */
    async function removeFromBoard(d) {
        const ok = await zdConfirm(`"${(d.title || 'Untitled')}" will leave the board. The note itself is kept.`, { title: 'Remove from board?', okText: 'Remove', danger: true });
        if (ok) setKanban(d.id, null);
    }
    /* V3.5: structured quick cards via modal (heading + multi-line content) */
    let _kbCol = null;
    function kbQuickCard(colId) {
        _kbCol = colId;
        const t = document.getElementById('kb-card-title');
        const x = document.getElementById('kb-card-text');
        t.value = ''; x.value = '';
        const modal = document.getElementById('kb-card-modal');
        modal.classList.add('open');
        const focusIt = () => { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } };
        focusIt();
        let tries = 0;
        const iv = setInterval(() => {
            if (!modal.classList.contains('open') || document.activeElement === t || tries++ > 15) { clearInterval(iv); return; }
            focusIt();
        }, 60);
    }
    window.closeKbCardModal = () => { document.getElementById('kb-card-modal').classList.remove('open'); _kbCol = null; };
    /* tiny markdown-ish parser: # ## headings, - bullets, [] / [x] tasks */
    function linesToOps(text) {
        const ops = [];
        String(text || '').split('\n').forEach(line => {
            let attrs = null, body = line;
            if (/^##\s+/.test(line)) { attrs = { header: 2 }; body = line.replace(/^##\s+/, ''); }
            else if (/^#\s+/.test(line)) { attrs = { header: 3 }; body = line.replace(/^#\s+/, ''); }
            else if (/^-\s*\[x\]\s*/i.test(line)) { attrs = { list: 'checked' }; body = line.replace(/^-\s*\[x\]\s*/i, ''); }
            else if (/^(\[\]|\[ \]|-\s*\[\s*\])\s*/.test(line)) { attrs = { list: 'unchecked' }; body = line.replace(/^(\[\]|\[ \]|-\s*\[\s*\])\s*/, ''); }
            else if (/^[-*]\s+/.test(line)) { attrs = { list: 'bullet' }; body = line.replace(/^[-*]\s+/, ''); }
            if (body) ops.push({ insert: body });
            ops.push(attrs ? { insert: '\n', attributes: attrs } : { insert: '\n' });
        });
        return ops;
    }
    window.submitKbCard = async () => {
        const colId = _kbCol;
        const titleV = document.getElementById('kb-card-title').value.trim();
        const textV = document.getElementById('kb-card-text').value;
        if (!titleV && !textV.trim()) { showToast('Write a heading or some content first.'); return; }
        const title = titleV || textV.trim().split('\n')[0].replace(/^[#\-\[\]x ]+/i, '').slice(0, 60) || 'Card';
        try {
            await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: title, content: { ops: linesToOps(textV) },
                isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96, kanban: colId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            closeKbCardModal();
            showToast('Card added \u2014 it\u2019s a real note you can open anytime.');
        } catch (e) { console.error(e); showToast('Could not add card.'); }
    };
    /* V3.5: persist a card's snippet height set by the resize handle */
    async function saveKanbanH(docId, h) {
        try { await db.collection('users').doc(state.user.uid).collection('docs').doc(docId).update({ kanbanH: h }); }
        catch (e) { console.warn(e); }
    }
    const KB_ICO = {
        open: '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>',
        grip: '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M9 19l10-10M14 20l6-6"/></svg>'
    };
    function renderKanban() {
        const wrap = document.getElementById('kanban-cols'); if (!wrap) return;
        wrap.innerHTML = '';
        KANBAN_COLS.forEach((col, ci) => {
            const docs = state.docs.filter(d => d.kanban === col.id);
            const colEl = document.createElement('div');
            colEl.className = 'kb-col';
            colEl.style.borderTopColor = col.color;
            colEl.innerHTML = `
                <div class="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
                    <span class="text-sm font-semibold text-text flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full inline-block" style="background:${col.color}"></span>
                        ${col.label}
                        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-0.5" style="background:${col.color}1a;color:${col.color}">${docs.length}</span>
                    </span>
                    <span class="flex items-center gap-0.5">
                        <button title="Quick text card \u2014 heading + content" class="kb-quick w-6 h-6 rounded-full text-muted hover:text-accent hover:bg-accent/10 text-[10px] font-bold transition active:scale-90">Aa</button>
                        <button title="Add an existing note to this column" class="kb-add w-6 h-6 rounded-full text-accent hover:bg-accent/10 text-lg leading-none transition active:scale-90">+</button>
                    </span>
                </div>
                <div class="kb-body flex-1 overflow-y-auto p-2 space-y-2 min-h-[90px]"></div>`;
            const body = colEl.querySelector('.kb-body');
            colEl.querySelector('.kb-add').onclick = () => openNotePicker(d => setKanban(d.id, col.id), 'Add to ' + col.label);
            colEl.querySelector('.kb-quick').onclick = () => kbQuickCard(col.id);
            body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('drag-over'); });
            body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
            body.addEventListener('drop', (e) => {
                e.preventDefault(); body.classList.remove('drag-over');
                const id = e.dataTransfer.getData('text/plain');
                if (id) setKanban(id, col.id);
            });
            if (docs.length === 0) {
                body.innerHTML = `<div class="text-center text-[10px] text-muted py-6 border-2 border-dashed border-border rounded-xl m-1">Drop a card here<br>or tap + / Aa to add</div>`;
            }
            docs.forEach(d => {
                const fullText = docPlainText(d).replace(/[ \t]+/g, ' ').trim();
                const custom = d.kanbanH && d.kanbanH >= 34;
                const snippet = custom ? fullText.slice(0, 1200) : fullText.slice(0, 90);
                const tags = docTags(d).slice(0, 3);
                const card = document.createElement('div');
                card.className = 'kb-card bg-bg border border-border rounded-xl p-2.5 shadow-sm hover:shadow-md hover:border-accent/50 transition group relative';
                card.draggable = true;
                card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', d.id));
                card.innerHTML = `
                    <div class="text-xs font-semibold text-text truncate cursor-pointer kb-open flex items-center gap-1" title="Open note">${escapeHtml(d.title || 'Untitled')}${d.isFavorite ? ' <span class="text-gold text-[10px]">\u2605</span>' : ''}</div>
                    ${snippet ? `<div class="kb-snippet-wrap mt-1 ${custom ? '' : ''}" style="${custom ? 'height:' + d.kanbanH + 'px;' : ''}"><div class="kb-snippet text-[10px] text-muted leading-snug whitespace-pre-line" style="${custom ? '-webkit-line-clamp:unset;display:block;' : ''}">${escapeHtml(snippet)}</div></div>` : ''}
                    ${tags.length ? `<div class="flex flex-wrap gap-1 mt-1.5">${tags.map(t => `<span class="text-[8px] px-1.5 py-px rounded-full bg-blue-100 dark:bg-blue-900/40 text-accent dark:text-blue-300 font-semibold">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                    <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-border/60">
                        <span class="text-[9px] text-muted">${d.updatedAt ? new Date(d.updatedAt.toDate()).toLocaleDateString() : ''}</span>
                        <span class="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                            <button title="File info" class="kb-info w-5 h-5 rounded flex items-center justify-center text-muted hover:text-accent transition">${INFO_SVG}</button>
                            <button title="Open note" class="kb-go w-5 h-5 rounded flex items-center justify-center text-muted hover:text-accent transition">${KB_ICO.open}</button>
                            <button title="Move left" class="kb-l w-5 h-5 rounded text-muted hover:text-accent text-[10px] transition ${ci === 0 ? 'opacity-25 pointer-events-none' : ''}">\u25c0</button>
                            <button title="Move right" class="kb-r w-5 h-5 rounded text-muted hover:text-accent text-[10px] transition ${ci === KANBAN_COLS.length - 1 ? 'opacity-25 pointer-events-none' : ''}">\u25b6</button>
                            <button title="Remove from board (keeps the note)" class="kb-x w-5 h-5 rounded text-muted hover:text-danger text-[10px] transition">\u2715</button>
                        </span>
                    </div>
                    ${snippet ? `<button title="Drag to resize the content area" class="kb-rs absolute bottom-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-muted">${KB_ICO.grip}</button>` : ''}`;
                card.querySelector('.kb-open').onclick = () => { closeKanban(); openDoc(d.id, d); };
                card.querySelector('.kb-go').onclick = () => { closeKanban(); openDoc(d.id, d); };
                card.querySelector('.kb-info').onclick = (e) => { e.stopPropagation(); showDocInfo(d.id); };
                if (ci > 0) card.querySelector('.kb-l').onclick = () => setKanban(d.id, KANBAN_COLS[ci - 1].id);
                if (ci < KANBAN_COLS.length - 1) card.querySelector('.kb-r').onclick = () => setKanban(d.id, KANBAN_COLS[ci + 1].id);
                card.querySelector('.kb-x').onclick = () => removeFromBoard(d);
                /* V3.5: resize handle — drag vertically to grow/shrink the content area */
                const rs = card.querySelector('.kb-rs');
                if (rs) {
                    rs.addEventListener('pointerdown', (e) => {
                        e.stopPropagation(); e.preventDefault();
                        card.draggable = false;
                        const wrapEl = card.querySelector('.kb-snippet-wrap');
                        const startY = e.clientY;
                        const startH = wrapEl ? wrapEl.getBoundingClientRect().height : 34;
                        const snipEl = card.querySelector('.kb-snippet');
                        if (snipEl) { snipEl.style.webkitLineClamp = 'unset'; snipEl.style.display = 'block'; snipEl.textContent = fullText.slice(0, 1200); }
                        const move = (ev) => {
                            const h = Math.max(34, Math.min(320, Math.round(startH + (ev.clientY - startY))));
                            if (wrapEl) wrapEl.style.height = h + 'px';
                        };
                        const finish = (ev) => {
                            document.removeEventListener('pointermove', move);
                            document.removeEventListener('pointerup', finish);
                            card.draggable = true;
                            const h = Math.max(34, Math.min(320, Math.round(startH + (ev.clientY - startY))));
                            d.kanbanH = h; /* optimistic */
                            saveKanbanH(d.id, h);
                        };
                        document.addEventListener('pointermove', move);
                        document.addEventListener('pointerup', finish);
                    });
                }
                body.appendChild(card);
            });
            wrap.appendChild(colEl);
        });
    }

    /* ---------- TEMPLATES ---------- */
    const BUILTIN_TEMPLATES = [
        { name: 'Meeting notes', emoji: '🤝', ops: [
            { insert: 'Meeting notes' }, { insert: '\n', attributes: { header: 1 } },
            { insert: 'Date: \nAttendees: \n#meeting' }, { insert: '\n\n' },
            { insert: 'Agenda' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'bullet' } },
            { insert: 'Decisions' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'bullet' } },
            { insert: 'Action items' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'unchecked' } }
        ]},
        { name: 'Project plan', emoji: '🚀', ops: [
            { insert: 'Project plan' }, { insert: '\n', attributes: { header: 1 } },
            { insert: '#project' }, { insert: '\n\n' },
            { insert: 'Goal' }, { insert: '\n', attributes: { header: 3 } }, { insert: '\n' },
            { insert: 'Milestones' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'ordered' } },
            { insert: 'Tasks' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'unchecked' } },
            { insert: 'Risks' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'bullet' } }
        ]},
        { name: 'Cornell notes', emoji: '🎓', ops: [
            { insert: 'Cornell notes' }, { insert: '\n', attributes: { header: 1 } },
            { insert: 'Topic: \n#study' }, { insert: '\n\n' },
            { insert: 'Cues / questions' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'bullet' } },
            { insert: 'Notes' }, { insert: '\n', attributes: { header: 3 } }, { insert: '\n' },
            { insert: 'Summary' }, { insert: '\n', attributes: { header: 3 } }, { insert: '\n' }
        ]},
        { name: 'Weekly review', emoji: '🔄', ops: [
            { insert: 'Weekly review' }, { insert: '\n', attributes: { header: 1 } },
            { insert: '#review' }, { insert: '\n\n' },
            { insert: 'Wins' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'bullet' } },
            { insert: 'Challenges' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'bullet' } },
            { insert: 'Next week' }, { insert: '\n', attributes: { header: 3 } },
            { insert: '\n', attributes: { list: 'unchecked' } }
        ]}
    ];
    window.openTemplates = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        closeAllViews();
        document.getElementById('templates-modal').classList.add('open');
        renderBuiltinTemplates();
        loadUserTemplates();
    };
    window.closeTemplates = () => document.getElementById('templates-modal').classList.remove('open');
    function renderBuiltinTemplates() {
        const el = document.getElementById('tpl-builtin');
        el.innerHTML = '';
        BUILTIN_TEMPLATES.forEach(t => {
            const b = document.createElement('button');
            b.className = 'p-3 rounded-xl border border-border bg-surface hover:border-accent/60 hover:shadow-md transition text-center active:scale-95';
            const TPL_ICO = {
                'Meeting notes': '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>',
                'Project plan': '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>',
                'Cornell notes': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-6.16-3.42L12 20l6.16-3.42"/>',
                'Weekly review': '<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>'
            };
            b.innerHTML = `<div class="flex justify-center text-accent mb-1.5"><svg class="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">${TPL_ICO[t.name] || TPL_ICO['Project plan']}</svg></div><div class="text-xs font-medium text-text">${escapeHtml(t.name)}</div>`;
            b.onclick = () => useTemplate(t.name, t.ops);
            el.appendChild(b);
        });
    }
    async function loadUserTemplates() {
        const el = document.getElementById('tpl-user');
        el.innerHTML = '<div class="text-[10px] text-muted">Loading…</div>';
        try {
            const snap = await db.collection('users').doc(state.user.uid).collection('templates').orderBy('createdAt', 'desc').get();
            if (snap.empty) {
                el.innerHTML = '<div class="text-[10px] text-muted">No saved templates yet. Open any note and tap "Save current note as template".</div>';
                return;
            }
            el.innerHTML = '';
            snap.docs.forEach(docSnap => {
                const t = docSnap.data();
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface';
                row.innerHTML = `
                    <span class="text-xs font-medium text-text truncate flex items-center gap-2"><span class="text-accent"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></span>${escapeHtml(t.name || 'Template')}</span>
                    <span class="flex items-center gap-1 flex-shrink-0">
                        <button class="tpl-ren w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-accent transition active:scale-90" title="Rename template"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.9 4.4l2.7 2.7-11 11L5 19l.9-3.6 11-11zM14.5 6.8l2.7 2.7"/></svg></button>
                        <button class="tpl-use px-2.5 py-1 rounded-full text-[10px] font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition active:scale-95">Use</button>
                        <button class="tpl-del w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-danger transition active:scale-90" title="Delete template"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13"/></svg></button>
                    </span>`;
                row.querySelector('.tpl-use').onclick = () => useTemplate(t.name || 'Template', (t.content && t.content.ops) ? t.content.ops : []);
                row.querySelector('.tpl-ren').onclick = async () => {
                    const nn = prompt('Template name:', t.name || '');
                    if (!nn || !nn.trim() || nn.trim() === t.name) return;
                    try {
                        await db.collection('users').doc(state.user.uid).collection('templates').doc(docSnap.id).update({ name: nn.trim() });
                        loadUserTemplates(); showToast('Template renamed.');
                    } catch (e) { showToast('Could not rename.'); }
                };
                row.querySelector('.tpl-del').onclick = async () => {
                    const ok = await zdConfirm(`Template "${t.name}" will be deleted.`, { title: 'Delete template?', okText: 'Delete', danger: true });
                    if (!ok) return;
                    try { await db.collection('users').doc(state.user.uid).collection('templates').doc(docSnap.id).delete(); loadUserTemplates(); showToast('Template deleted.'); }
                    catch (e) { showToast('Could not delete.'); }
                };
                el.appendChild(row);
            });
        } catch (e) { console.error(e); el.innerHTML = '<div class="text-[10px] text-muted">Could not load templates.</div>'; }
    }
    async function useTemplate(name, ops) {
        /* pick a unique title so the duplicate-name guard never trips */
        let title = name, n = 2;
        while (state.docs.some(d => (d.title || '').trim().toLowerCase() === title.toLowerCase())) { title = name + ' ' + n++; }
        const content = { ops: JSON.parse(JSON.stringify(ops)) };
        /* V3.6: dynamic template variables — {{date}} {{time}} {{datetime}}
           {{day}} {{title}} {{clipboard}} are filled in at insert time */
        const hasVar = content.ops.some(op => typeof op.insert === 'string' && op.insert.includes('{{'));
        if (hasVar) {
            const now = new Date();
            let clip = '';
            const wantsClip = content.ops.some(op => typeof op.insert === 'string' && op.insert.includes('{{clipboard}}'));
            if (wantsClip) { try { clip = await navigator.clipboard.readText(); } catch (e) { clip = ''; } }
            const vars = {
                '{{date}}': now.toLocaleDateString(),
                '{{time}}': now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                '{{datetime}}': now.toLocaleString(),
                '{{day}}': now.toLocaleDateString(undefined, { weekday: 'long' }),
                '{{title}}': title,
                '{{clipboard}}': clip
            };
            content.ops.forEach(op => {
                if (typeof op.insert === 'string') {
                    Object.keys(vars).forEach(k => { op.insert = op.insert.split(k).join(vars[k]); });
                }
            });
        }
        try {
            const ref = await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: title, content: content, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            closeTemplates();
            openDoc(ref.id, { title: title, content: content, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96 });
            showToast('Created from template.');
        } catch (e) { console.error(e); showToast('Could not create note.'); }
    }
    window.saveCurrentAsTemplate = async () => {
        if (!state.docId || state.isGuest) { showToast('Open a note first.'); return; }
        const name = prompt('Template name:', els.title.value || 'My template');
        if (!name || !name.trim()) return;
        try {
            await db.collection('users').doc(state.user.uid).collection('templates').add({
                name: name.trim(),
                content: JSON.parse(JSON.stringify(quill.getContents())),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Template saved.');
            loadUserTemplates();
        } catch (e) { console.error(e); showToast('Could not save template.'); }
    };

    /* ---------- CANVAS (V3.2: zoom, fit, double-click add, colors,
         duplicate, fresh reload, unload-safe saving) ---------- */
    var cv = { items: {}, links: [], pan: { x: 0, y: 0 }, scale: 1, loaded: false, dirty: false, saveT: null, connectFrom: null, drag: null, panDrag: null };
    function cvRef() { return db.collection('users').doc(state.user.uid).collection('canvases').doc('default'); }
    window.openCanvas = async () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        closeAllViews();
        document.getElementById('canvas-modal').classList.add('open');
        bindCanvasEvents();
        /* V3.2: if edits are still pending, flush them first, then ALWAYS
           reload fresh from the server so the board is never stale */
        if (cv.dirty) { await flushCanvasSave(); }
        document.getElementById('canvas-status').textContent = 'Loading…';
        try {
            const snap = await cvRef().get();
            if (snap.exists) {
                const d = snap.data();
                cv.items = d.items || {};
                cv.links = d.links || [];
            }
            document.getElementById('canvas-status').textContent = '';
        } catch (e) {
            console.error('Canvas load failed', e);
            document.getElementById('canvas-status').textContent = 'Load failed';
            showToast('Canvas load failed' + (e.code ? ' (' + e.code + ')' : '') + ' — check your connection or Firestore rules.');
        }
        cv.loaded = true;
        renderCanvas();
    };
    window.closeCanvas = () => {
        const m = document.getElementById('canvas-modal');
        if (!m.classList.contains('open')) return;
        m.classList.remove('open');
        flushCanvasSave();
    };
    function markCanvasDirty() {
        cv.dirty = true; /* V3.3: only real changes are ever written */
        if (cv.saveT) clearTimeout(cv.saveT);
        cv.saveT = setTimeout(flushCanvasSave, 600);
        const s = document.getElementById('canvas-status'); if (s) s.textContent = 'Saving…';
    }
    async function flushCanvasSave() {
        if (cv.saveT) { clearTimeout(cv.saveT); cv.saveT = null; }
        if (!state.user || !cv.loaded || !cv.dirty) return; /* V3.3: open+close without edits = zero writes */
        try {
            await cvRef().set({ items: cv.items, links: cv.links, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            cv.dirty = false;
            const s = document.getElementById('canvas-status'); if (s) s.textContent = 'Saved';
        } catch (e) {
            console.error('Canvas save failed', e);
            const s = document.getElementById('canvas-status'); if (s) s.textContent = 'Save failed';
            showToast('Canvas save failed' + (e.code ? ' (' + e.code + ')' : '') + ' — your last change may not be stored.');
        }
    }
    /* Never lose canvas work: flush pending edits when leaving the page */
    window.addEventListener('pagehide', () => { if (cv.dirty) flushCanvasSave(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cv.dirty) flushCanvasSave(); });

    const CV_COLORS = ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#ede9fe'];
    const CV_COLORS_DARK = ['#4a3f19', '#1e3a5f', '#14432a', '#4a1d35', '#312360'];
    function cvNewId() { return 'i' + Date.now() + Math.floor(Math.random() * 999); }
    function applyStageTransform() {
        const stage = document.getElementById('canvas-stage');
        stage.style.transformOrigin = '0 0';
        stage.style.transform = `translate(${cv.pan.x}px, ${cv.pan.y}px) scale(${cv.scale})`;
        const zl = document.getElementById('canvas-zoom-label');
        if (zl) zl.textContent = Math.round(cv.scale * 100) + '%';
    }
    window.canvasZoom = (f) => {
        const vp = document.getElementById('canvas-viewport');
        const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
        const old = cv.scale;
        cv.scale = Math.max(0.4, Math.min(2, cv.scale * f));
        /* zoom around the viewport center so the board doesn't jump */
        cv.pan.x = cx - ((cx - cv.pan.x) / old) * cv.scale;
        cv.pan.y = cy - ((cy - cv.pan.y) / old) * cv.scale;
        applyStageTransform();
    };
    window.canvasFit = () => {
        const ids = Object.keys(cv.items);
        const vp = document.getElementById('canvas-viewport');
        if (ids.length === 0) { cv.scale = 1; cv.pan = { x: 0, y: 0 }; applyStageTransform(); return; }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ids.forEach(id => {
            const it = cv.items[id];
            minX = Math.min(minX, it.x); minY = Math.min(minY, it.y);
            maxX = Math.max(maxX, it.x + 210); maxY = Math.max(maxY, it.y + 110);
        });
        const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
        cv.scale = Math.max(0.4, Math.min(1.25, Math.min((vp.clientWidth - 60) / w, (vp.clientHeight - 60) / h)));
        cv.pan.x = (vp.clientWidth - w * cv.scale) / 2 - minX * cv.scale;
        cv.pan.y = (vp.clientHeight - h * cv.scale) / 2 - minY * cv.scale;
        applyStageTransform();
    };
    function cvStagePoint(clientX, clientY) {
        const rect = document.getElementById('canvas-viewport').getBoundingClientRect();
        return {
            x: (clientX - rect.left - cv.pan.x) / cv.scale,
            y: (clientY - rect.top - cv.pan.y) / cv.scale
        };
    }
    window.canvasAddText = (atX, atY) => {
        const vp = document.getElementById('canvas-viewport');
        const id = cvNewId();
        const cx = typeof atX === 'number' ? atX : (vp.clientWidth / 2 - cv.pan.x) / cv.scale - 105 + (Math.random() * 60 - 30);
        const cy = typeof atY === 'number' ? atY : (vp.clientHeight / 2 - cv.pan.y) / cv.scale - 44 + (Math.random() * 60 - 30);
        cv.items[id] = { type: 'text', text: 'Idea', x: Math.round(cx), y: Math.round(cy), color: Math.floor(Math.random() * CV_COLORS.length) };
        markCanvasDirty(); renderCanvas();
        /* V3.3: start typing right away — the new card opens in edit mode */
        const el = document.querySelector(`.cv-card[data-id="${id}"]`);
        if (el) cvEditText(id, el);
    };
    /* V3.8: FRAMES — translucent regions that move their cards together */
    window.canvasAddFrame = () => {
        const vp = document.getElementById('canvas-viewport');
        const id = cvNewId();
        cv.items[id] = {
            type: 'frame', label: 'Frame', w: 420, h: 300,
            x: Math.round((vp.clientWidth / 2 - cv.pan.x) / cv.scale - 210),
            y: Math.round((vp.clientHeight / 2 - cv.pan.y) / cv.scale - 150)
        };
        markCanvasDirty(); renderCanvas();
    };
    function frameMembers(fid) {
        const f = cv.items[fid]; if (!f) return [];
        return Object.keys(cv.items).filter(k => {
            const it = cv.items[k];
            if (k === fid || it.type === 'frame') return false;
            const cx = it.x + 105, cy = it.y + 44;
            return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
        });
    }
    window.canvasAddNote = () => openNotePicker(d => {
        const vp = document.getElementById('canvas-viewport');
        const id = cvNewId();
        cv.items[id] = {
            type: 'note', noteId: d.id,
            x: Math.round((vp.clientWidth / 2 - cv.pan.x) / cv.scale - 105 + (Math.random() * 60 - 30)),
            y: Math.round((vp.clientHeight / 2 - cv.pan.y) / cv.scale - 44 + (Math.random() * 60 - 30))
        };
        markCanvasDirty(); renderCanvas();
    }, 'Add a note to the canvas');
    function cvDeleteItem(id) {
        delete cv.items[id];
        cv.links = cv.links.filter(l => l.a !== id && l.b !== id);
        if (cv.connectFrom === id) cv.connectFrom = null;
        markCanvasDirty(); renderCanvas();
    }
    function cvDuplicateItem(id) {
        const it = cv.items[id]; if (!it) return;
        const nid = cvNewId();
        cv.items[nid] = JSON.parse(JSON.stringify(it));
        cv.items[nid].x += 26; cv.items[nid].y += 26;
        markCanvasDirty(); renderCanvas();
    }
    function cvCycleColor(id) {
        const it = cv.items[id]; if (!it || it.type !== 'text') return;
        it.color = ((it.color || 0) + 1) % CV_COLORS.length;
        markCanvasDirty(); renderCanvas();
    }
    function cvToggleConnect(id) {
        if (!cv.connectFrom) { cv.connectFrom = id; renderCanvas(); showToast('Now tap the link icon on another card to connect.'); return; }
        if (cv.connectFrom === id) { cv.connectFrom = null; renderCanvas(); return; }
        const a = cv.connectFrom, b = id;
        const existing = cv.links.findIndex(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
        if (existing >= 0) { cv.links.splice(existing, 1); showToast('Connection removed.'); }
        else { cv.links.push({ a: a, b: b }); showToast('Connected.'); }
        cv.connectFrom = null;
        markCanvasDirty(); renderCanvas();
    }
    function cvCardCenter(id) {
        const it = cv.items[id]; if (!it) return { x: 0, y: 0 };
        const el = document.querySelector(`.cv-card[data-id="${id}"]`);
        const h = el ? el.offsetHeight : 84;
        return { x: it.x + 105, y: it.y + h / 2 };
    }
    function renderCanvasLinks() {
        const svg = document.getElementById('canvas-links'); if (!svg) return;
        const OFF = 5000;
        let out = '';
        const AC = 'rgb(' + (getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim().split(/\s+/).join(',') || '26,115,232') + ')';
        cv.links.forEach(l => {
            const A = cvCardCenter(l.a), B = cvCardCenter(l.b);
            /* V3.7: gentle curve + heavier stroke, Obsidian-canvas style */
            const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
            const dx = B.x - A.x, dy = B.y - A.y;
            const len = Math.hypot(dx, dy) || 1;
            const cxp = mx + (-dy / len) * Math.min(46, len * 0.18);
            const cyp = my + (dx / len) * Math.min(46, len * 0.18);
            out += `<path d="M ${A.x + OFF} ${A.y + OFF} Q ${cxp + OFF} ${cyp + OFF} ${B.x + OFF} ${B.y + OFF}" fill="none" stroke="${AC}" stroke-width="3" stroke-opacity="0.6" stroke-linecap="round"/>`;
        });
        svg.innerHTML = out;
    }
    function renderCanvas() {
        const stage = document.getElementById('canvas-stage'); if (!stage) return;
        applyStageTransform();
        stage.querySelectorAll('.cv-card, .cv-frame').forEach(n => n.remove()); /* V3.8.1: clear frames too */
        const dark = document.documentElement.classList.contains('dark');
        /* V3.8: frames render first (behind cards) */
        Object.keys(cv.items).filter(k => cv.items[k].type === 'frame').forEach(k => {
            const f = cv.items[k];
            const fe = document.createElement('div');
            fe.className = 'cv-frame';
            fe.dataset.fid = k;
            fe.style.left = f.x + 'px'; fe.style.top = f.y + 'px';
            fe.style.width = f.w + 'px'; fe.style.height = f.h + 'px';
            fe.innerHTML = `<span class="cv-frame-label" title="Double-tap to rename">${escapeHtml(f.label || 'Frame')}</span>
                <button class="cv-frame-del" title="Remove frame (cards stay)">×</button>
                <span class="cv-frame-rs" title="Drag to resize"></span>`;
            fe.querySelector('.cv-frame-del').onclick = (e) => { e.stopPropagation(); delete cv.items[k]; markCanvasDirty(); renderCanvas(); };
            fe.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const nn = prompt('Frame label:', f.label || 'Frame');
                if (nn !== null) { f.label = nn.trim() || 'Frame'; markCanvasDirty(); renderCanvas(); }
            });
            stage.appendChild(fe);
        });
        Object.keys(cv.items).forEach(id => {
            if (cv.items[id].type === 'frame') return; /* frames already rendered */
            const it = cv.items[id];
            const card = document.createElement('div');
            card.className = 'cv-card' + (cv.connectFrom === id ? ' connect-from' : '');
            card.dataset.id = id;
            card.style.left = it.x + 'px';
            card.style.top = it.y + 'px';
            if (it.type === 'text') {
                const ci = Math.min(it.color || 0, CV_COLORS.length - 1);
                card.style.background = dark ? CV_COLORS_DARK[ci] : CV_COLORS[ci];
                card.innerHTML = `
                    <div class="p-2.5 pb-1 text-xs whitespace-pre-wrap break-words cv-text" style="color:${dark ? '#e5e7eb' : '#1f2937'}">${escapeHtml(it.text || '')}</div>
                    <div class="flex justify-end gap-0.5 px-1.5 pb-1.5">
                        <button title="Edit text" class="cv-edit w-6 h-6 rounded flex items-center justify-center text-text opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.9 4.4l2.7 2.7-11 11L5 19l.9-3.6 11-11zM14.5 6.8l2.7 2.7"/></svg></button>
                        <button title="Change color" class="cv-color w-6 h-6 rounded flex items-center justify-center text-text opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 100 18c1.5 0 2.2-.9 2.2-2 0-.8-.5-1.3-.9-1.7-.4-.4-.7-.8-.7-1.3 0-1.1.9-2 2-2h1.6A3.8 3.8 0 0020 10.2C20 6.1 16.4 3 12 3z"/><circle cx="7.6" cy="11.5" r="1" fill="currentColor" stroke="none"/><circle cx="9.8" cy="7.6" r="1" fill="currentColor" stroke="none"/><circle cx="14.3" cy="6.9" r="1" fill="currentColor" stroke="none"/></svg></button>
                        <button title="Duplicate card" class="cv-dup w-6 h-6 rounded flex items-center justify-center text-text opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg></button>
                        <button title="Connect to another card" class="cv-link w-6 h-6 rounded flex items-center justify-center text-text opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5"/></svg></button>
                        <button title="Delete card" class="cv-del w-6 h-6 rounded flex items-center justify-center text-danger opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13"/></svg></button>
                    </div>`;
                card.querySelector('.cv-edit').addEventListener('click', (e) => { e.stopPropagation(); cvEditText(id, card); });
                card.querySelector('.cv-color').addEventListener('click', (e) => { e.stopPropagation(); cvCycleColor(id); });
                card.querySelector('.cv-dup').addEventListener('click', (e) => { e.stopPropagation(); cvDuplicateItem(id); });
            } else {
                const note = state.docs.find(d => d.id === it.noteId);
                const tags = note ? docTags(note).slice(0, 2) : [];
                card.innerHTML = `
                    <div class="p-2.5 pb-1">
                        <div class="text-[9px] font-bold uppercase tracking-wider text-accent mb-0.5">Note</div>
                        <div class="text-xs font-medium text-text truncate">${escapeHtml(note ? (note.title || 'Untitled') : '(deleted note)')}</div>
                        ${tags.length ? `<div class="flex flex-wrap gap-1 mt-1">${tags.map(t => `<span class="text-[8px] px-1.5 py-px rounded-full bg-blue-100 dark:bg-blue-900/40 text-accent dark:text-blue-300 font-semibold">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="flex justify-end gap-0.5 px-1.5 pb-1.5">
                        ${note ? '<button title="Open note" class="cv-open w-6 h-6 rounded flex items-center justify-center text-accent opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg></button>' : ''}
                        <button title="Duplicate card" class="cv-dup w-6 h-6 rounded flex items-center justify-center text-text opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg></button>
                        <button title="Connect to another card" class="cv-link w-6 h-6 rounded flex items-center justify-center text-text opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5"/></svg></button>
                        <button title="Delete card" class="cv-del w-6 h-6 rounded flex items-center justify-center text-danger opacity-60 hover:opacity-100 transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13"/></svg></button>
                    </div>`;
                const openBtn = card.querySelector('.cv-open');
                if (openBtn) openBtn.addEventListener('click', (e) => { e.stopPropagation(); closeCanvas(); openDoc(note.id, note); });
                card.querySelector('.cv-dup').addEventListener('click', (e) => { e.stopPropagation(); cvDuplicateItem(id); });
            }
            card.querySelector('.cv-link').addEventListener('click', (e) => { e.stopPropagation(); cvToggleConnect(id); });
            card.querySelector('.cv-del').addEventListener('click', (e) => { e.stopPropagation(); cvDeleteItem(id); });
            stage.appendChild(card);
        });
        renderCanvasLinks();
        const empty = document.getElementById('canvas-empty');
        if (empty) empty.style.display = Object.keys(cv.items).length ? 'none' : 'flex';
    }
    function cvEditText(id, card) {
        const it = cv.items[id]; if (!it) return;
        const textDiv = card.querySelector('.cv-text'); if (!textDiv) return;
        const ta = document.createElement('textarea');
        ta.value = it.text || '';
        ta.rows = 3;
        ta.className = 'p-2 m-1 text-xs';
        textDiv.replaceWith(ta);
        ta.style.fontSize = '16px'; /* stops iOS zoom + easier mobile editing */
        const _cf = () => { try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } };
        _cf(); ta.select();
        let _ct = 0;
        const _ci = setInterval(() => {
            if (!document.body.contains(ta) || document.activeElement === ta || _ct++ > 15) { clearInterval(_ci); return; }
            _cf();
        }, 60);
        ta.addEventListener('pointerdown', (e) => e.stopPropagation());
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ta.blur(); }
            e.stopPropagation();
        });
        ta.addEventListener('blur', () => { it.text = ta.value.trim() ? ta.value : 'Idea'; markCanvasDirty(); renderCanvas(); });
    }
    let cvEventsBound = false;
    const cvPointers = new Map(); let cvPinch = null;
    function bindCanvasEvents() {
        if (cvEventsBound) return;
        cvEventsBound = true;
        const vp = document.getElementById('canvas-viewport');
        /* double-click / double-tap an empty spot = new idea card right there */
        vp.addEventListener('dblclick', (e) => {
            if (e.target.closest('.cv-card') || e.target.closest('button')) return;
            const p = cvStagePoint(e.clientX, e.clientY);
            canvasAddText(p.x - 105, p.y - 30);
        });
        vp.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button') || e.target.tagName === 'TEXTAREA') return;
            cvPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (cvPointers.size === 2) { /* V3.8: two fingers = pinch zoom */
                const p = Array.from(cvPointers.values());
                cvPinch = { d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, s0: cv.scale,
                            mid: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } };
                cv.drag = null; cv.panDrag = null;
                return;
            }
            const rsEl = e.target.closest('.cv-frame-rs');
            const frameEl = e.target.closest('.cv-frame');
            if (rsEl && frameEl) { /* V3.8: frame resize */
                const fid = frameEl.dataset.fid, f = cv.items[fid];
                cv.drag = { frameResize: true, id: fid, sx: e.clientX, sy: e.clientY, ow: f.w, oh: f.h, el: frameEl, moved: false };
                try { vp.setPointerCapture(e.pointerId); } catch (err) {}
                return;
            }
            if (frameEl && !e.target.closest('.cv-card')) { /* V3.8: frame drag moves members */
                const fid = frameEl.dataset.fid, f = cv.items[fid];
                cv.drag = {
                    frame: true, id: fid, sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, el: frameEl, moved: false,
                    members: frameMembers(fid).map(k => ({ k: k, x: cv.items[k].x, y: cv.items[k].y }))
                };
                try { vp.setPointerCapture(e.pointerId); } catch (err) {}
                return;
            }
            const cardEl = e.target.closest('.cv-card');
            if (cardEl) {
                const id = cardEl.dataset.id; const it = cv.items[id]; if (!it) return;
                cv.drag = { id: id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, el: cardEl,
                            moved: false, textTap: !!e.target.closest('.cv-text') };
            } else {
                cv.panDrag = { sx: e.clientX, sy: e.clientY, ox: cv.pan.x, oy: cv.pan.y };
                vp.classList.add('panning');
            }
            try { vp.setPointerCapture(e.pointerId); } catch (err) {}
        });
        vp.addEventListener('pointermove', (e) => {
            if (cvPointers.has(e.pointerId)) cvPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (cvPinch && cvPointers.size >= 2) {
                const rect = vp.getBoundingClientRect();
                const p = Array.from(cvPointers.values());
                const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
                const mid = { x: (p[0].x + p[1].x) / 2 - rect.left, y: (p[0].y + p[1].y) / 2 - rect.top };
                const old = cv.scale;
                cv.scale = Math.max(0.4, Math.min(2, cvPinch.s0 * (d / cvPinch.d0)));
                cv.pan.x = mid.x - ((mid.x - cv.pan.x) / old) * cv.scale;
                cv.pan.y = mid.y - ((mid.y - cv.pan.y) / old) * cv.scale;
                applyStageTransform();
                return;
            }
            if (cv.drag && cv.drag.frameResize) {
                const f = cv.items[cv.drag.id]; if (!f) return;
                cv.drag.moved = true;
                f.w = Math.max(160, cv.drag.ow + (e.clientX - cv.drag.sx) / cv.scale);
                f.h = Math.max(120, cv.drag.oh + (e.clientY - cv.drag.sy) / cv.scale);
                cv.drag.el.style.width = f.w + 'px'; cv.drag.el.style.height = f.h + 'px';
                return;
            }
            if (cv.drag && cv.drag.frame) {
                const f = cv.items[cv.drag.id]; if (!f) return;
                if (Math.abs(e.clientX - cv.drag.sx) + Math.abs(e.clientY - cv.drag.sy) > 6) cv.drag.moved = true;
                const dx = (e.clientX - cv.drag.sx) / cv.scale, dy = (e.clientY - cv.drag.sy) / cv.scale;
                f.x = cv.drag.ox + dx; f.y = cv.drag.oy + dy;
                cv.drag.el.style.left = f.x + 'px'; cv.drag.el.style.top = f.y + 'px';
                cv.drag.members.forEach(mm => {
                    const it = cv.items[mm.k]; if (!it) return;
                    it.x = mm.x + dx; it.y = mm.y + dy;
                    const el = document.querySelector(`.cv-card[data-id="${mm.k}"]`);
                    if (el) { el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; }
                });
                renderCanvasLinks();
                return;
            }
                        if (cv.drag) {
                const it = cv.items[cv.drag.id]; if (!it) return;
                if (Math.abs(e.clientX - cv.drag.sx) + Math.abs(e.clientY - cv.drag.sy) > 6) cv.drag.moved = true;
                it.x = cv.drag.ox + (e.clientX - cv.drag.sx) / cv.scale;
                it.y = cv.drag.oy + (e.clientY - cv.drag.sy) / cv.scale;
                cv.drag.el.style.left = it.x + 'px';
                cv.drag.el.style.top = it.y + 'px';
                renderCanvasLinks();
            } else if (cv.panDrag) {
                cv.pan.x = cv.panDrag.ox + (e.clientX - cv.panDrag.sx);
                cv.pan.y = cv.panDrag.oy + (e.clientY - cv.panDrag.sy);
                applyStageTransform();
            }
        });
        const up = () => {
            if (cv.drag) {
                if (cv.drag.moved) markCanvasDirty();
                else if (cv.drag.textTap) { /* V3.8: tap the text = edit it */
                    const el = cv.drag.el, id = cv.drag.id;
                    setTimeout(() => cvEditText(id, el), 10);
                }
            }
            cv.drag = null; cv.panDrag = null; cvPinch = null; cvPointers.clear();
            vp.classList.remove('panning');
        };
        vp.addEventListener('pointerup', up);
        vp.addEventListener('pointercancel', up);
        /* V3.3: wheel / trackpad zoom, centred on the cursor */
        vp.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = vp.getBoundingClientRect();
            const px = e.clientX - rect.left, py = e.clientY - rect.top;
            const old = cv.scale;
            cv.scale = Math.max(0.4, Math.min(2, cv.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
            cv.pan.x = px - ((px - cv.pan.x) / old) * cv.scale;
            cv.pan.y = py - ((py - cv.pan.y) / old) * cv.scale;
            applyStageTransform();
        }, { passive: false });
    }

    /* ---------- OUTLINE PRO (V3.4 — collapsible, searchable, scroll-spy page navigation) ---------- */
    let _outlineItems = [];
    const _outlineCollapsed = new Set();
    function renderOutline() {
        const el = document.getElementById('outline-list'); if (!el) return;
        const searchEl = document.getElementById('outline-search');
        if (!state.docId) { el.innerHTML = ''; _outlineItems = []; return; }
        let items = [];
        try {
            const lines = quill.getLines(0, quill.getLength());
            lines.forEach(line => {
                const fmt = line.formats ? line.formats() : {};
                if (fmt.header) {
                    const txt = (line.domNode && line.domNode.textContent || '').trim();
                    items.push({ level: fmt.header, text: txt || '(untitled heading)', node: line.domNode });
                }
            });
        } catch (e) { items = []; }
        const seen = {};
        items.forEach((it, i) => {
            const base = it.level + ':' + it.text;
            seen[base] = (seen[base] || 0) + 1;
            it.key = base + ':' + seen[base];
            it.hasChildren = !!(items[i + 1] && items[i + 1].level > it.level);
        });
        _outlineItems = items;
        const q = ((searchEl && searchEl.value) || '').trim().toLowerCase();
        el.innerHTML = '';
        if (!items.length) {
            el.innerHTML = '<div class="text-[10px] text-muted">Use headings (Heading 1\u20133 in the toolbar, or type /h1) to build a navigable outline of this note.</div>';
            return;
        }
        let hideDeeperThan = null;
        items.forEach((it, i) => {
            if (!q) {
                if (hideDeeperThan !== null) {
                    if (it.level > hideDeeperThan) return; /* inside a collapsed section */
                    hideDeeperThan = null;
                }
                if (it.hasChildren && _outlineCollapsed.has(it.key)) hideDeeperThan = it.level;
            } else if (!it.text.toLowerCase().includes(q)) { return; } /* search filters flat */
            const b = document.createElement('button');
            b.dataset.oi = i;
            b.className = 'ol-item w-full text-left text-xs py-1 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-text transition flex items-center';
            b.style.paddingLeft = (4 + (Math.min(it.level, 4) - 1) * 13) + 'px';
            b.style.paddingRight = '8px';
            const ch = (!q && it.hasChildren)
                ? '<span class="ol-ch" style="transform:' + (_outlineCollapsed.has(it.key) ? 'rotate(-90deg)' : 'none') + '">\u25be</span>'
                : '<span class="ol-ch"></span>';
            b.innerHTML = ch + '<span class="truncate">' + escapeHtml(it.text) + '</span>';
            b.onclick = () => { zdScrollToNode(it.node); };
            el.appendChild(b);
        });
        updateOutlineActive();
    }
    /* scroll-spy: highlights the section currently on screen (like the Obsidian page nav) */
    let _olT = null;
    function updateOutlineActive() {
        const el = document.getElementById('outline-list'); if (!el || !_outlineItems.length) return;
        const wrapTop = els.editorWrapper.getBoundingClientRect().top + 90;
        let activeIdx = 0;
        _outlineItems.forEach((it, i) => {
            try { if (it.node.getBoundingClientRect().top <= wrapTop) activeIdx = i; } catch (e) {}
        });
        el.querySelectorAll('.ol-item').forEach(b => b.classList.toggle('active', Number(b.dataset.oi) === activeIdx));
    }
    els.editorWrapper.addEventListener('scroll', () => {
        if (_olT) return;
        _olT = setTimeout(() => { _olT = null; updateOutlineActive(); }, 150);
    });
    document.getElementById('outline-search').addEventListener('input', renderOutline);

    /* ---------- AUTOCOMPLETE POPUP ([[links]], #tags, /slash commands) ---------- */
    /* V3.3: type "/" on a line to get Notion/Obsidian-style block commands */
    const SLASH_CMDS = [
        { k: 'h1 heading large', label: 'H1 · Large heading', run: (i) => quill.formatLine(i, 1, 'header', 1, 'user') },
        { k: 'h2 heading medium', label: 'H2 · Medium heading', run: (i) => quill.formatLine(i, 1, 'header', 2, 'user') },
        { k: 'h3 heading small', label: 'H3 · Small heading', run: (i) => quill.formatLine(i, 1, 'header', 3, 'user') },
        { k: 'bullet list', label: '•  Bulleted list', run: (i) => quill.formatLine(i, 1, 'list', 'bullet', 'user') },
        { k: 'numbered ordered list', label: '1.  Numbered list', run: (i) => quill.formatLine(i, 1, 'list', 'ordered', 'user') },
        { k: 'todo task checklist checkbox', label: '☑  Checklist', run: (i) => quill.formatLine(i, 1, 'list', 'unchecked', 'user') },
        { k: 'quote blockquote', label: '❝  Quote', run: (i) => quill.formatLine(i, 1, 'blockquote', true, 'user') },
        { k: 'code block', label: '{}  Code block', run: (i) => quill.formatLine(i, 1, 'code-block', true, 'user') },
        { k: 'normal text clear paragraph', label: '¶  Normal text', run: (i) => quill.formatLine(i, 1, { header: false, list: false, blockquote: false, 'code-block': false }, 'user') },
        { k: 'date today', label: '📅  Insert today\u2019s date', insert: () => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) },
        { k: 'time now clock', label: '🕐  Insert current time', insert: () => new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    ];

    const sug = { mode: null, query: '', start: 0, items: [], index: 0 };
    function hideSuggester() {
        const el = document.getElementById('suggester');
        if (el) el.classList.add('hidden');
        sug.mode = null;
    }
    function updateSuggester() {
        if (state.isGuest || !state.docId) return hideSuggester();
        const sel = quill.getSelection();
        if (!sel || sel.length !== 0) return hideSuggester();
        const lookback = Math.min(60, sel.index);
        const upto = quill.getText(sel.index - lookback, lookback);
        let m = upto.match(/\[\[([^\[\]\n]{0,40})$/);
        if (m) { sug.mode = 'wiki'; sug.query = m[1]; }
        else {
            m = upto.match(/(^|[\s\u00A0([{])#([A-Za-z0-9_\-\/]{0,30})$/);
            if (m) { sug.mode = 'tag'; sug.query = m[2]; }
            else {
                m = upto.match(/(^|\n)\/([a-zA-Z0-9 ]{0,20})$/);
                if (m) { sug.mode = 'cmd'; sug.query = m[2]; }
                else return hideSuggester();
            }
        }
        sug.start = sel.index - sug.query.length;
        const q = sug.query.toLowerCase();
        if (sug.mode === 'wiki') {
            sug.items = state.docs
                .filter(d => d.id !== state.docId && (d.title || '').toLowerCase().includes(q))
                .slice(0, 6)
                .map(d => ({ label: (d.title || 'Untitled'), value: d.title || 'Untitled' }));
            const exact = state.docs.some(d => (d.title || '').trim().toLowerCase() === q.trim());
            if (sug.query.trim() && !exact) sug.items.push({ label: '＋ Create "' + sug.query.trim() + '"', value: sug.query.trim() });
        } else if (sug.mode === 'tag') {
            const all = new Set();
            state.docs.forEach(d => docTags(d).forEach(t => all.add(t)));
            sug.items = Array.from(all).filter(t => t.includes(q)).sort().slice(0, 6).map(t => ({ label: '# ' + t, value: t }));
        } else {
            sug.items = SLASH_CMDS
                .filter(c => !q || c.k.includes(q) || c.label.toLowerCase().includes(q))
                .slice(0, 8)
                .map(c => ({ label: c.label, cmd: c }));
        }
        if (sug.items.length === 0) return hideSuggester();
        sug.index = 0;
        renderSuggester();
        positionSuggester(sel.index);
    }
    function renderSuggester() {
        const el = document.getElementById('suggester'); if (!el) return;
        el.innerHTML = '';
        sug.items.forEach((it, i) => {
            const b = document.createElement('button');
            b.className = 'sug-item w-full text-left px-3.5 py-2 text-xs truncate text-text hover:bg-gray-50 dark:hover:bg-gray-800 transition' + (i === sug.index ? ' selected' : '');
            b.textContent = it.label;
            b.onmousedown = (e) => e.preventDefault(); /* keep editor focus */
            b.onclick = () => { sug.index = i; applySuggestion(); };
            el.appendChild(b);
        });
        el.classList.remove('hidden');
    }
    function positionSuggester(index) {
        const el = document.getElementById('suggester'); if (!el) return;
        try {
            const b = quill.getBounds(index);
            const rect = document.querySelector('.ql-container').getBoundingClientRect();
            let left = rect.left + b.left;
            let top = rect.top + b.bottom + 6;
            left = Math.max(8, Math.min(left, window.innerWidth - 268));
            const h = el.offsetHeight || 160;
            if (top + h > window.innerHeight - 8) top = rect.top + b.top - h - 6;
            el.style.left = left + 'px';
            el.style.top = Math.max(8, top) + 'px';
        } catch (e) { hideSuggester(); }
    }
    function applySuggestion() {
        const it = sug.items[sug.index];
        if (!it || !sug.mode) return hideSuggester();
        const mode = sug.mode, start = sug.start, qlen = sug.query.length;
        hideSuggester();
        if (mode === 'wiki') {
            quill.deleteText(start, qlen, 'user');
            quill.insertText(start, it.value + ']]', 'user');
            quill.setSelection(start + it.value.length + 2, 0, 'silent');
        } else if (mode === 'tag') {
            quill.deleteText(start, qlen, 'user');
            quill.insertText(start, it.value + ' ', 'user');
            quill.setSelection(start + it.value.length + 1, 0, 'silent');
        } else if (mode === 'cmd') {
            /* remove the typed "/query" including the slash */
            quill.deleteText(start - 1, qlen + 1, 'user');
            const c = it.cmd;
            if (c.insert) {
                const s = c.insert();
                quill.insertText(start - 1, s, 'user');
                quill.setSelection(start - 1 + s.length, 0, 'silent');
            } else {
                c.run(start - 1);
                quill.setSelection(start - 1, 0, 'silent');
            }
        }
        scheduleTokenScan();
    }
    quill.root.addEventListener('keydown', (e) => {
        if (!sug.mode) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); sug.index = Math.min(sug.index + 1, sug.items.length - 1); renderSuggester(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); sug.index = Math.max(sug.index - 1, 0); renderSuggester(); }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); applySuggestion(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideSuggester(); }
    }, true);
    quill.on('selection-change', (range) => { if (sug.mode && (!range || range.length !== 0)) hideSuggester(); });
    els.editorWrapper.addEventListener('scroll', () => { if (sug.mode) hideSuggester(); });

