// ZenDocs — 09-notes-qa-timeline-voice-trackers.js
// V7.2 ask-your-notes, V7.3 timeline & daily review, V7.4 voice capture, V8.0 trackers core (the grid).
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
   V7.2 — ASK YOUR NOTES
   Natural-language retrieval over your vault. BM25-style ranking
   with phrase boosting and passage extraction — it finds and shows
   the exact lines that answer you, with the source note. Entirely
   local: no cloud, no API key, no cost, works offline.
============================================================ */
(function zd72() {
    if (window.__zd72) return; window.__zd72 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #ask-modal{z-index:129;}
    #ask-in{width:100%;background:var(--bg-color);border:1.5px solid var(--border-color);
        border-radius:13px;padding:11px 13px;font-size:14px;color:var(--text-color);outline:none;
        caret-color:rgb(var(--accent-rgb));transition:border-color .16s ease;}
    #ask-in:focus{border-color:rgb(var(--accent-rgb));}
    @media (max-width:850px){#ask-in{font-size:16px;}}
    .ak-ex{padding:6px 11px;border-radius:99px;font-size:10.5px;font-weight:600;
        background:var(--bg-color);border:1px solid var(--border-color);color:var(--text-color);
        transition:all .15s ease;text-align:left;}
    .ak-ex:hover{border-color:rgb(var(--accent-rgb));color:rgb(var(--accent-rgb));}
    .ak-hit{border:1px solid var(--border-color);border-left:3px solid rgb(var(--accent-rgb));
        border-radius:11px;background:var(--bg-color);padding:11px 12px;margin-bottom:8px;
        animation:akIn .3s cubic-bezier(.22,1,.36,1) both;}
    @keyframes akIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
    .ak-hit:hover{border-color:rgb(var(--accent-rgb) / .6);}
    .ak-pass{font-size:12px;line-height:1.6;color:var(--text-color);}
    .ak-pass mark{background:rgb(var(--accent-rgb) / .22);color:rgb(var(--accent-rgb));
        border-radius:3px;padding:0 2.5px;font-weight:700;}
    .ak-src{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:7px;
        border-top:1px solid var(--border-color);font-size:9.5px;color:#9ca3af;}
    .ak-open{margin-left:auto;font-size:9.5px;font-weight:800;color:rgb(var(--accent-rgb));}
    .ak-score{font-size:8px;font-weight:800;padding:1px 6px;border-radius:99px;
        background:rgb(var(--accent-rgb) / .13);color:rgb(var(--accent-rgb));}
    #ask-thinking{display:none;align-items:center;gap:8px;padding:14px 0;font-size:11.5px;color:#9ca3af;}
    #ask-thinking.on{display:flex;}
    .ak-dot{width:5px;height:5px;border-radius:99px;background:rgb(var(--accent-rgb));
        animation:akPulse 1.2s ease-in-out infinite;}
    .ak-dot:nth-child(2){animation-delay:.15s}.ak-dot:nth-child(3){animation-delay:.3s}
    @keyframes akPulse{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.25)}}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="ask-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-lg flex flex-col" style="max-height:86vh">
      <div class="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35M11 8v.01M11 11v3"/></svg> Ask your notes</h3>
        <button onclick="closeAsk()" class="zdvh-x">×</button>
      </div>
      <input id="ask-in" placeholder="Where did I save the AWS deployment command?" autocomplete="off" spellcheck="false" class="flex-shrink-0">
      <div id="ask-thinking"><span class="ak-dot"></span><span class="ak-dot"></span><span class="ak-dot"></span><span>Searching your notes…</span></div>
      <div id="ask-out" class="flex-1 min-h-0 overflow-y-auto zd-scroll pr-1 mt-3"></div>
      <div class="text-[9px] text-muted mt-2 pt-2 border-t border-border flex-shrink-0 leading-snug">Searches every note on this device — nothing is sent anywhere.</div>
    </div></div>`);

    const $ = id => document.getElementById(id);
    const QSTOP = new Set('what where when who why how which show find tell give list all every did do does is are was were the a an of to in on for with at by from my me i and or that this it about any some can could would should'.split(' '));
    const tok = s => (String(s).toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []);

    window.openAsk = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        $('ask-modal').classList.add('open');
        $('ask-in').value = '';
        renderExamples();
        setTimeout(() => { try { $('ask-in').focus({ preventScroll: true }); zdArmProtect($('ask-in')); } catch (e) {} }, 90);
    };
    window.closeAsk = () => $('ask-modal').classList.remove('open');
    function renderExamples() {
        $('ask-out').innerHTML =
            '<div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-2">Try asking</div>' +
            '<div class="flex flex-col gap-1.5">' +
            ['Where did I save the AWS deployment command?',
             'Show every meeting where pricing was discussed',
             'What did I learn about React performance?',
             'What are my open action items?',
             'Notes about the launch plan'].map(q =>
                '<button class="ak-ex" onclick="askRun(' + JSON.stringify(q).replace(/"/g, '&quot;') + ')">' + escapeHtml(q) + '</button>').join('') +
            '</div>';
    }

    /* ---------- the engine ---------- */
    function search(q) {
        const terms = tok(q).filter(w => w.length > 1 && !QSTOP.has(w));
        if (!terms.length) return [];
        const phrase = q.toLowerCase().replace(/[?.!,]/g, '').trim();
        const pool = state.docs.filter(d => !(d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id))));
        const N = pool.length || 1;

        /* document frequency for IDF */
        const df = {};
        terms.forEach(t => { df[t] = pool.reduce((n, d) => n + (docPlainText(d).toLowerCase().indexOf(t) >= 0 ? 1 : 0), 0) || 0.5; });

        const results = [];
        pool.forEach(d => {
            const raw = docPlainText(d);
            const low = raw.toLowerCase();
            const title = (d.title || '').toLowerCase();
            let score = 0, matched = 0;
            terms.forEach(t => {
                const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
                let tf = 0, i = low.indexOf(t);
                while (i >= 0 && tf < 30) { tf++; i = low.indexOf(t, i + t.length); }
                if (tf) matched++;
                score += idf * (tf * 2.2) / (tf + 1.2);                 /* BM25-ish saturation */
                if (title.indexOf(t) >= 0) score += idf * 3.4;          /* title hits matter a lot */
            });
            if (!matched) return;
            score *= (matched / terms.length) ** 1.8;                   /* reward covering the question */
            if (low.indexOf(phrase) >= 0) score += 14;                  /* exact phrase */
            if (d.pinned) score *= 1.08;
            if (d.updatedAt && d.updatedAt.toDate) {
                const days = (Date.now() - d.updatedAt.toDate().getTime()) / 864e5;
                score *= 1 + Math.max(0, (60 - days)) / 300;            /* mild recency lift */
            }

            /* pull the best passage: score every line, keep its neighbours */
            const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
            let best = -1, bi = 0;
            lines.forEach((ln, i) => {
                const l = ln.toLowerCase();
                let s = 0;
                terms.forEach(t => { if (l.indexOf(t) >= 0) s += 1 + Math.log(1 + (N / df[t])); });
                if (l.indexOf(phrase) >= 0) s += 6;
                if (ln.length > 18 && ln.length < 260) s += 0.6;        /* prefer real sentences */
                if (s > best) { best = s; bi = i; }
            });
            const passage = lines.slice(Math.max(0, bi - 1), bi + 2).join(' ').slice(0, 340);
            results.push({ d: d, score: score, passage: passage || raw.slice(0, 200) });
        });
        return results.sort((a, b) => b.score - a.score).slice(0, 7);
    }
    function hl(text, q) {
        const terms = [...new Set(tok(q).filter(w => w.length > 2 && !QSTOP.has(w)))]
            .sort((a, b) => b.length - a.length);
        let out = escapeHtml(text);
        terms.forEach(t => {
            out = out.replace(new RegExp('(?<![\\w>])(' + escapeRegExp(t) + ')(?![\\w<])', 'gi'), '<mark>$1</mark>');
        });
        return out;
    }

    window.askRun = (preset) => {
        const q = (preset != null ? preset : $('ask-in').value).trim();
        if (preset != null) $('ask-in').value = q;
        if (q.length < 2) { renderExamples(); return; }
        $('ask-thinking').classList.add('on');
        $('ask-out').innerHTML = '';
        setTimeout(() => {
            let hits = [];
            try { hits = search(q); } catch (e) { console.error(e); }
            $('ask-thinking').classList.remove('on');
            if (!hits.length) {
                $('ask-out').innerHTML = '<div class="text-center text-muted text-[11.5px] py-10 leading-relaxed">Nothing in your notes matches that.<br>Try fewer words, or the exact term you wrote down.</div>';
                return;
            }
            const top = hits[0].score;
            $('ask-out').innerHTML =
                '<div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-2">' + hits.length + ' result' + (hits.length === 1 ? '' : 's') + '</div>' +
                hits.map((h, i) =>
                    '<div class="ak-hit" style="animation-delay:' + (i * 45) + 'ms">' +
                    '<div class="ak-pass">' + hl(h.passage, q) + '</div>' +
                    '<div class="ak-src">' +
                    '<svg class="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6L19 8.4V19a2 2 0 01-2 2z"/></svg>' +
                    '<span class="truncate">' + escapeHtml(h.d.title || 'Untitled') + '</span>' +
                    (i === 0 && top > 8 ? '<span class="ak-score">BEST</span>' : '') +
                    '<button class="ak-open" onclick="askOpen(\'' + h.d.id + '\')">Open →</button></div></div>'
                ).join('');
        }, 130);
    };
    window.askOpen = (id) => {
        const d = state.docs.find(x => x.id === id);
        closeAsk();
        if (d) setTimeout(() => openDoc(d.id, d), 40);
    };
    let askT = null;
    $('ask-in').addEventListener('input', () => { clearTimeout(askT); askT = setTimeout(() => askRun(), 320); });
    $('ask-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(askT); askRun(); } });
    ['focusin', 'pointerup'].forEach(ev => $('ask-in').addEventListener(ev, () => { try { zdArmProtect($('ask-in')); } catch (e) {} }));
    $('ask-modal').addEventListener('click', e => { if (e.target.id === 'ask-modal') closeAsk(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && $('ask-modal').classList.contains('open')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); closeAsk();
        }
        /* Ctrl+/ opens Ask */
        if ((e.ctrlKey || e.metaKey) && e.key === '/' && !state.isGuest) { e.preventDefault(); openAsk(); }
    }, true);

    try {
        zdMenuInject2('ask', 'openAsk', 'Ask your notes', '<circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35M11 8v.01M11 11v3"/>');
        ZD_FEATURES.push({ id: 'ask', label: 'Ask your notes', fns: ['openAsk'] });
        ZD_FEAT_ICONS.ask = '<circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35M11 8v.01M11 11v3"/>';
    } catch (e) {}
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 600);
})();

     // New Code

     /* ============================================================
   V7.3 — TIMELINE & DAILY REVIEW
   Timeline: what you learnt this week / month / year, drawn from
   your headings, tags and completed tasks.
   Daily review: each morning, notes that may be useful today.
============================================================ */
(function zd73() {
    if (window.__zd73) return; window.__zd73 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #tl-modal,#dr-modal{z-index:128;}
    .tl-seg{padding:6px 14px;border-radius:99px;font-size:11px;font-weight:800;color:#9ca3af;transition:all .16s ease;}
    .tl-seg.on{background-image:var(--zd-grad);color:#fff;}
    .tl-per{margin-bottom:16px;animation:tlIn .34s cubic-bezier(.22,1,.36,1) both;}
    @keyframes tlIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:none}}
    .tl-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
    .tl-dot{width:9px;height:9px;border-radius:99px;background-image:var(--zd-grad);flex-shrink:0;
        box-shadow:0 0 0 3px rgb(var(--accent-rgb) / .16);}
    .tl-when{font-size:11.5px;font-weight:800;color:var(--text-color);}
    .tl-cnt{font-size:8.5px;font-weight:800;padding:1.5px 7px;border-radius:99px;
        background:rgb(var(--accent-rgb) / .13);color:rgb(var(--accent-rgb));}
    .tl-line{margin-left:4px;padding-left:16px;border-left:2px solid var(--border-color);}
    .tl-item{display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;padding:7px 9px;
        border-radius:9px;transition:background .15s ease;margin-bottom:2px;}
    .tl-item:hover{background:rgba(127,127,127,.07);}
    .tl-lrn{font-size:11.5px;color:var(--text-color);line-height:1.45;}
    .tl-meta{font-size:9px;color:#9ca3af;margin-top:1px;}
    .tl-stat{display:flex;gap:12px;padding:9px 11px;border-radius:10px;background:var(--bg-color);
        border:1px solid var(--border-color);margin-bottom:10px;}
    .tl-stat b{display:block;font-size:16px;font-weight:800;color:rgb(var(--accent-rgb));line-height:1.1;}
    .tl-stat span{font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;font-weight:700;}
    .dr-card{border:1px solid var(--border-color);border-left:3px solid rgb(var(--accent-rgb));
        border-radius:11px;background:var(--bg-color);padding:10px 12px;margin-bottom:7px;
        width:100%;text-align:left;transition:transform .15s ease,border-color .15s ease;}
    .dr-card:hover{transform:translateX(3px);border-color:rgb(var(--accent-rgb) / .6);}
    .dr-why{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;
        color:rgb(var(--accent-rgb));margin-bottom:2px;}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="tl-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-lg flex flex-col" style="max-height:86vh">
      <div class="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg> Timeline</h3>
        <button onclick="closeTimeline()" class="zdvh-x">×</button>
      </div>
      <div class="flex gap-1 mb-3 bg-bg border border-border rounded-full p-0.5 w-fit flex-shrink-0">
        <button class="tl-seg on" data-r="week" onclick="tlRange('week')">This week</button>
        <button class="tl-seg" data-r="month" onclick="tlRange('month')">This month</button>
        <button class="tl-seg" data-r="year" onclick="tlRange('year')">This year</button>
      </div>
      <div id="tl-body" class="flex-1 min-h-0 overflow-y-auto zd-scroll pr-1"></div>
    </div></div>

    <div id="dr-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-md flex flex-col" style="max-height:84vh">
      <div class="flex items-center justify-between mb-1 flex-shrink-0">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/></svg> Daily review</h3>
        <button onclick="closeDaily()" class="zdvh-x">×</button>
      </div>
      <div id="dr-date" class="text-[10.5px] text-muted mb-3 flex-shrink-0"></div>
      <div id="dr-body" class="flex-1 min-h-0 overflow-y-auto zd-scroll pr-1"></div>
    </div></div>`);

    const $ = id => document.getElementById(id);
    const ts = v => (v && v.toDate) ? v.toDate().getTime() : 0;

    /* ---------- TIMELINE ---------- */
    let tlR = 'week';
    window.openTimeline = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        $('tl-modal').classList.add('open'); renderTl();
    };
    window.closeTimeline = () => $('tl-modal').classList.remove('open');
    window.tlRange = (r) => {
        tlR = r;
        document.querySelectorAll('.tl-seg').forEach(b => b.classList.toggle('on', b.dataset.r === r));
        renderTl();
    };
    /* "what you learnt" = headings + bold-ish first lines inside a note */
    function learnings(d) {
        const out = [];
        ((d.content && d.content.ops) || []).forEach((op, i, arr) => {
            if (typeof op.insert !== 'string') return;
            const a = op.attributes || {};
            if (a.header && a.header <= 3) {
                const prev = arr[i - 1];
                const t = (prev && typeof prev.insert === 'string') ? prev.insert.trim() : '';
                if (t && t.length > 3 && t.length < 120) out.push(t);
            }
        });
        if (!out.length) {
            const first = docPlainText(d).split('\n').map(s => s.trim()).find(s => s.length > 14);
            if (first) out.push(first.slice(0, 120));
        }
        return out.slice(0, 4);
    }
    function renderTl() {
        const now = Date.now();
        const span = tlR === 'week' ? 7 : tlR === 'month' ? 31 : 366;
        const cut = now - span * 864e5;
        const pool = state.docs.filter(d => !(d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id))))
            .filter(d => Math.max(ts(d.createdAt), ts(d.updatedAt)) >= cut)
            .sort((a, b) => Math.max(ts(b.createdAt), ts(b.updatedAt)) - Math.max(ts(a.createdAt), ts(a.updatedAt)));

        if (!pool.length) {
            $('tl-body').innerHTML = '<div class="text-center text-muted text-[11.5px] py-12 leading-relaxed">Nothing recorded in this period yet.<br>Write a note and it appears here.</div>';
            return;
        }
        /* headline numbers */
        let words = 0, done = 0, tagSet = new Set();
        pool.forEach(d => {
            const t = docPlainText(d).trim();
            words += t ? t.split(/\s+/).length : 0;
            ((d.content && d.content.ops) || []).forEach(o => { if (o.attributes && o.attributes.list === 'checked') done++; });
            docTags(d).forEach(x => tagSet.add(x));
        });
        /* bucket by day (week) or by week/month */
        const label = (t) => {
            const dt = new Date(t);
            if (tlR === 'week') return dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
            if (tlR === 'month') {
                const wk = Math.ceil(dt.getDate() / 7);
                return 'Week ' + wk + ' · ' + dt.toLocaleDateString(undefined, { month: 'long' });
            }
            return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        };
        const groups = {};
        pool.forEach(d => {
            const t = Math.max(ts(d.createdAt), ts(d.updatedAt));
            const k = label(t);
            (groups[k] = groups[k] || []).push(d);
        });

        let h = '<div class="tl-stat">' +
            '<span><b>' + pool.length + '</b><span>Notes</span></span>' +
            '<span><b>' + words.toLocaleString() + '</b><span>Words</span></span>' +
            '<span><b>' + done + '</b><span>Tasks done</span></span>' +
            '<span><b>' + tagSet.size + '</b><span>Topics</span></span></div>';

        Object.keys(groups).forEach((k, gi) => {
            const list = groups[k];
            h += '<div class="tl-per" style="animation-delay:' + (gi * 60) + 'ms">' +
                 '<div class="tl-hd"><span class="tl-dot"></span><span class="tl-when">' + escapeHtml(k) + '</span>' +
                 '<span class="tl-cnt">' + list.length + '</span></div><div class="tl-line">';
            list.slice(0, 8).forEach(d => {
                const lrn = learnings(d);
                const tags = docTags(d).slice(0, 3);
                h += '<button class="tl-item" onclick="tlOpen(\'' + d.id + '\')">' +
                     '<svg class="w-3 h-3 mt-1 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6L19 8.4V19a2 2 0 01-2 2z"/></svg>' +
                     '<span class="min-w-0 flex-1"><span class="block text-xs font-semibold text-text truncate">' + escapeHtml(d.title || 'Untitled') + '</span>' +
                     (lrn.length ? '<span class="tl-lrn block">' + lrn.map(x => '· ' + escapeHtml(x)).join('<br>') + '</span>' : '') +
                     (tags.length ? '<span class="tl-meta block">' + tags.map(t => '#' + escapeHtml(t)).join(' · ') + '</span>' : '') +
                     '</span></button>';
            });
            if (list.length > 8) h += '<div class="tl-meta" style="padding:4px 9px">+ ' + (list.length - 8) + ' more</div>';
            h += '</div></div>';
        });
        $('tl-body').innerHTML = h;
    }
    window.tlOpen = (id) => {
        const d = state.docs.find(x => x.id === id);
        closeTimeline(); if (d) setTimeout(() => openDoc(d.id, d), 40);
    };

    /* ---------- DAILY REVIEW ---------- */
    window.openDaily = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        $('dr-modal').classList.add('open');
        renderDr();
        localStorage.setItem('zdDrSeen', new Date().toISOString().slice(0, 10));
    };
    window.closeDaily = () => $('dr-modal').classList.remove('open');
    function renderDr() {
        const now = new Date();
        $('dr-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        const pool = state.docs.filter(d => !(d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id))));
        const picks = [], seen = new Set();
        const add = (d, why) => { if (d && !seen.has(d.id)) { seen.add(d.id); picks.push({ d: d, why: why }); } };

        /* 1 — due today or overdue in the matrix */
        pool.filter(d => d.eisDue && !d.eisDone && d.eisDue < now.getTime() + 864e5)
            .sort((a, b) => a.eisDue - b.eisDue).slice(0, 3)
            .forEach(d => add(d, d.eisDue < now.getTime() ? 'Overdue' : 'Due today'));
        /* 2 — most open tasks */
        pool.map(d => {
            let n = 0; ((d.content && d.content.ops) || []).forEach(o => { if (o.attributes && o.attributes.list === 'unchecked') n++; });
            return { d: d, n: n };
        }).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3)
          .forEach(x => add(x.d, x.n + ' open task' + (x.n === 1 ? '' : 's')));
        /* 3 — same weekday last week (rhythm) */
        pool.filter(d => {
            const t = ts(d.updatedAt); if (!t) return false;
            const dd = new Date(t), age = (now - t) / 864e5;
            return dd.getDay() === now.getDay() && age > 5 && age < 22;
        }).slice(0, 2).forEach(d => add(d, 'You worked on this last ' + now.toLocaleDateString(undefined, { weekday: 'long' })));
        /* 4 — resurfaced: linked from something recent but untouched for a month */
        const recent = pool.filter(d => ts(d.updatedAt) > now.getTime() - 7 * 864e5);
        const linked = new Set();
        recent.forEach(d => docLinks(d).forEach(l => linked.add(l.toLowerCase())));
        pool.filter(d => linked.has((d.title || '').trim().toLowerCase()) && ts(d.updatedAt) < now.getTime() - 30 * 864e5)
            .slice(0, 2).forEach(d => add(d, 'Referenced recently, not opened in a while'));
        /* 5 — pinned, if room */
        pool.filter(d => d.pinned).slice(0, 2).forEach(d => add(d, 'Pinned'));

        const t = dailyTitle(now);
        const hasDaily = state.docs.some(x => (x.title || '').trim() === t);
        let h = '<button onclick="closeDaily();setTimeout(openDailyNote,120)" class="w-full py-2.5 mb-3 text-[11.5px] font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">' +
                (hasDaily ? 'Open today’s note' : 'Start today’s note') + '</button>';
        h += picks.length
            ? '<div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-2">These may be useful today</div>' +
              picks.slice(0, 8).map(p =>
                '<button class="dr-card" onclick="drOpen(\'' + p.d.id + '\')">' +
                '<div class="dr-why">' + escapeHtml(p.why) + '</div>' +
                '<div class="text-xs font-semibold text-text truncate">' + escapeHtml(p.d.title || 'Untitled') + '</div>' +
                '<div class="text-[9.5px] text-muted truncate mt-0.5">' + escapeHtml(docPlainText(p.d).replace(/\n/g, ' ').slice(0, 90)) + '</div></button>').join('')
            : '<div class="text-center text-muted text-[11.5px] py-8 leading-relaxed">Clear slate — nothing is due and no tasks are waiting.</div>';
        $('dr-body').innerHTML = h;
    }
    window.drOpen = (id) => {
        const d = state.docs.find(x => x.id === id);
        closeDaily(); if (d) setTimeout(() => openDoc(d.id, d), 40);
    };
    /* offer it once per morning */
    setTimeout(() => {
        if (state.isGuest || !state.user) return;
        const today = new Date().toISOString().slice(0, 10);
        if (localStorage.getItem('zdDrSeen') === today) return;
        if (new Date().getHours() > 12) return;              /* ⚙ only before noon */
        showToast('Good morning — your daily review is ready.', 4500);
        setTimeout(() => { if (localStorage.getItem('zdDrSeen') !== today) openDaily(); }, 2200);
    }, 6000);

    [['tl-modal', 'closeTimeline'], ['dr-modal', 'closeDaily']].forEach(([id, fn]) => {
        $(id).addEventListener('click', e => { if (e.target.id === id) window[fn](); });
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        for (const [id, fn] of [['tl-modal', 'closeTimeline'], ['dr-modal', 'closeDaily']]) {
            if ($(id).classList.contains('open')) {
                e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                window[fn](); return;
            }
        }
    }, true);

    try {
        zdMenuInject2('timeline', 'openTimeline', 'Timeline', '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 7v5l3 2"/>');
        zdMenuInject2('daily', 'openDaily', 'Daily review', '<circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2"/>');
        ZD_FEATURES.push(
            { id: 'timeline', label: 'Timeline', fns: ['openTimeline'] },
            { id: 'daily', label: 'Daily review', fns: ['openDaily'] });
        ZD_FEAT_ICONS.timeline = '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 7v5l3 2"/>';
        ZD_FEAT_ICONS.daily = '<circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2"/>';
    } catch (e) {}
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 600);
})();

    // New Code

    /* ============================================================
   V7.4 — VOICE CAPTURE
   Web Speech API: free, built into the browser, no account and no
   third-party service. Continuous dictation with live interim text,
   spoken punctuation, automatic sentence capitalisation, and a
   language picker. Inserts at your cursor in the open note.
   Chrome / Edge / Android: excellent · Safari: good · Firefox: n/a
============================================================ */
(function zd74() {
    if (window.__zd74) return; window.__zd74 = true;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    document.head.insertAdjacentHTML('beforeend', `<style>
    #vc-modal{z-index:129;}
    #vc-orb{width:92px;height:92px;margin:4px auto 14px;border-radius:99px;position:relative;
        display:flex;align-items:center;justify-content:center;background-image:var(--zd-grad);
        box-shadow:0 14px 34px rgba(0,0,0,.3);transition:transform .2s ease;}
    #vc-orb.live{animation:vcBreathe 1.9s ease-in-out infinite;}
    @keyframes vcBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
    #vc-orb::before,#vc-orb::after{content:'';position:absolute;inset:0;border-radius:99px;
        border:2px solid rgb(var(--accent-rgb) / .5);opacity:0;}
    #vc-orb.live::before{animation:vcRing 2.1s ease-out infinite;}
    #vc-orb.live::after{animation:vcRing 2.1s ease-out .7s infinite;}
    @keyframes vcRing{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}
    #vc-orb svg{width:34px;height:34px;color:#fff;z-index:2;}
    /* live level bars */
    #vc-bars{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:22px;margin-bottom:12px;}
    #vc-bars i{width:3px;border-radius:99px;background:rgb(var(--accent-rgb) / .55);height:4px;
        transition:height .09s ease;}
    #vc-txt{min-height:96px;max-height:34vh;overflow-y:auto;padding:12px 13px;border-radius:12px;
        background:var(--bg-color);border:1px solid var(--border-color);font-size:13px;line-height:1.65;
        color:var(--text-color);white-space:pre-wrap;}
    #vc-txt .vc-int{color:#9ca3af;font-style:italic;}
    #vc-txt:empty::before{content:'Your words appear here as you speak…';color:#9ca3af;font-size:12px;}
    .vc-chip{padding:4px 9px;border-radius:99px;font-size:9px;font-weight:700;
        background:var(--bg-color);border:1px solid var(--border-color);color:#9ca3af;}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="vc-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-sm">
      <div class="flex items-center justify-between mb-1">
        <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/></svg> Voice capture</h3>
        <button onclick="closeVoice()" class="zdvh-x">×</button>
      </div>
      <div id="vc-state" class="text-[10.5px] text-muted mb-1">Tap the microphone and start speaking.</div>
      <div id="vc-orb"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/></svg></div>
      <div id="vc-bars"></div>
      <div id="vc-txt"></div>
      <div class="flex flex-wrap gap-1.5 mt-2.5 mb-3">
        <span class="vc-chip">say “new line”</span><span class="vc-chip">“full stop”</span>
        <span class="vc-chip">“comma”</span><span class="vc-chip">“question mark”</span>
        <span class="vc-chip">“new paragraph”</span>
      </div>
      <select id="vc-lang" class="w-full mb-2.5 text-xs bg-bg text-text border border-border rounded-lg px-2 py-2 outline-none"></select>
      <div class="grid grid-cols-2 gap-1.5">
        <button id="vc-go" onclick="vcToggle()" class="py-2.5 text-xs font-bold rounded-xl text-white active:scale-95 transition" style="background-image:var(--zd-grad)">Start listening</button>
        <button onclick="vcInsert()" class="py-2.5 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-95">Insert into note</button>
      </div>
      <button onclick="vcClear()" class="w-full mt-1.5 py-2 text-[10.5px] font-semibold rounded-xl text-muted hover:text-danger transition">Clear</button>
    </div></div>`);

    const $ = id => document.getElementById(id);
    const LANGS = [['en-US','English (US)'],['en-GB','English (UK)'],['en-IN','English (India)'],
        ['hi-IN','हिन्दी'],['ta-IN','தமிழ்'],['te-IN','తెలుగు'],['ml-IN','മലയാളം'],['kn-IN','ಕನ್ನಡ'],
        ['mr-IN','मराठी'],['bn-IN','বাংলা'],['gu-IN','ગુજરાતી'],['es-ES','Español'],['fr-FR','Français'],
        ['de-DE','Deutsch'],['pt-BR','Português'],['it-IT','Italiano'],['ja-JP','日本語'],
        ['ko-KR','한국어'],['zh-CN','中文'],['ar-SA','العربية'],['ru-RU','Русский']];
    $('vc-lang').innerHTML = LANGS.map(([v, n]) => '<option value="' + v + '">' + n + '</option>').join('');
    $('vc-lang').value = localStorage.getItem('zdVcLang') || (navigator.language || 'en-US');
    $('vc-lang').onchange = () => {
        localStorage.setItem('zdVcLang', $('vc-lang').value);
        if (rec && listening) { stop(); setTimeout(start, 260); }
    };
    for (let i = 0; i < 13; i++) $('vc-bars').insertAdjacentHTML('beforeend', '<i></i>');

    let rec = null, listening = false, wantOn = false;
    let rawCommitted = '';   /* raw text from previous (auto-restarted) sessions */
    let rawSession = '';     /* raw finals of the CURRENT session, rebuilt every event */
    let interim = '';        /* non-final words currently being heard */
    let finalText = '';      /* cleaned, display-ready text */
    let audioCtx = null, analyser = null, micStream = null, rafId = null;

    /* spoken punctuation → characters */
    const CMDS = [
        [/\b(new line|newline|next line)\b/gi, '\n'],
        [/\b(new paragraph|next paragraph)\b/gi, '\n\n'],
        [/\b(full stop|period)\b/gi, '.'],
        [/\b(comma)\b/gi, ','],
        [/\b(question mark)\b/gi, '?'],
        [/\b(exclamation mark|exclamation point)\b/gi, '!'],
        [/\b(colon)\b/gi, ':'], [/\b(semicolon)\b/gi, ';'],
        [/\b(open bracket)\b/gi, '('], [/\b(close bracket)\b/gi, ')'],
        [/\b(dash|hyphen)\b/gi, '-'], [/\b(bullet point|new bullet)\b/gi, '\n• ']
    ];
    function clean(s) {
        CMDS.forEach(([re, ch]) => { s = s.replace(re, ch); });
        s = s.replace(/\s+([.,!?;:])/g, '$1').replace(/([.,!?;:])(?=[^\s\n])/g, '$1 ');
        s = s.replace(/[ \t]{2,}/g, ' ');
        /* capitalise after . ! ? and at the start of a line */
        s = s.replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (m, p, c) => p + c.toUpperCase());
        s = s.replace(/\bi\b/g, 'I');
        return s;
    }
    function paint() {
        $('vc-txt').innerHTML = escapeHtml(finalText) + (interim ? '<span class="vc-int">' + escapeHtml(interim) + '</span>' : '');
        $('vc-txt').scrollTop = $('vc-txt').scrollHeight;
    }

    async function levels() {
        /* the level meter opens a SECOND mic stream, which breaks
           SpeechRecognition on Android/many devices — only run it on
           desktop, and never let a failure affect recognition */
        if (window.innerWidth < 900 || !navigator.mediaDevices) return;
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            audioCtx.createMediaStreamSource(micStream).connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const bars = Array.from($('vc-bars').children);
            const tick = () => {
                if (!listening) return;
                analyser.getByteFrequencyData(data);
                bars.forEach((b, i) => {
                    const v = data[Math.floor(i * data.length / bars.length)] / 255;
                    b.style.height = Math.max(4, v * 22) + 'px';
                });
                rafId = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { /* meter is cosmetic — recognition continues without it */ }
    }
    function stopLevels() {
        if (rafId) cancelAnimationFrame(rafId); rafId = null;
        Array.from($('vc-bars').children).forEach(b => b.style.height = '4px');
        try { if (micStream) micStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        try { if (audioCtx) audioCtx.close(); } catch (e) {}
        micStream = null; audioCtx = null;
    }

    // function start() {
    //     if (!SR) { showToast('Voice input isn’t supported in this browser — try Chrome, Edge or Safari.', 4200); return; }
    //     rec = new SR();
    function start() {
        if (!SR) { showToast('Voice input isn\u2019t supported in this browser — try Chrome, Edge or Safari.', 4200); return; }
        if (!window.isSecureContext) { showToast('Voice needs a secure (https) connection.', 4200); return; }
        if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
        rec = new SR();
        rec.lang = $('vc-lang').value;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.onstart = () => {
            listening = true; wantOn = true;
            $('vc-orb').classList.add('live');
            $('vc-go').textContent = 'Stop listening';
            $('vc-state').textContent = 'Listening… speak naturally.';
            setTimeout(levels, 600);
            try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
        };
        rec.onresult = (e) => {
            /* rebuild from scratch — e.results is cumulative, so appending
               incrementally duplicates words when resultIndex doesn't advance */
            let fin = '', itm = '';
            for (let i = 0; i < e.results.length; i++) {
                const r = e.results[i];
                if (!r || !r[0]) continue;
                const txt = r[0].transcript || '';
                if (r.isFinal) fin += txt + ' '; else itm += txt + ' ';
            }
            rawSession = fin;
            interim = itm.trim();
            finalText = clean((rawCommitted + ' ' + rawSession).replace(/\s{2,}/g, ' ').trim());
            paint();
        };
        rec.onerror = (e) => {
            console.warn('[voice]', e.error);
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                wantOn = false; stop();
                $('vc-state').textContent = 'Microphone blocked.';
                showToast('Microphone blocked — tap the 🔒/ⓘ icon in the address bar and allow the mic, then try again.', 5200);
            } else if (e.error === 'no-speech') {
                $('vc-state').textContent = 'Didn\u2019t catch that — keep going.';
            } else if (e.error === 'audio-capture') {
                wantOn = false; stop();
                showToast('No microphone found on this device.', 4200);
            } else if (e.error === 'network') {
                $('vc-state').textContent = 'Speech service unreachable — check your connection.';
            }
        };
        rec.onend = () => {
            listening = false;
            $('vc-orb').classList.remove('live');
            stopLevels();
            /* fold this session into the committed buffer, then reset it —
               the next session starts with a fresh, empty e.results */
            rawCommitted = (rawCommitted + ' ' + rawSession).replace(/\s{2,}/g, ' ').trim();
            rawSession = ''; interim = '';
            if (wantOn) { try { rec.start(); return; } catch (e) {} }
            $('vc-go').textContent = 'Start listening';
            $('vc-state').textContent = finalText ? 'Paused — insert it, or keep going.' : 'Tap the microphone and start speaking.';
        };
        try { rec.start(); } catch (e) { showToast('Could not start the microphone.'); }
    }
    function stop() {
        wantOn = false;
        try { if (rec) rec.stop(); } catch (e) {}
        listening = false;
        $('vc-orb').classList.remove('live');
        stopLevels();
        $('vc-go').textContent = 'Start listening';
    }
    let _vcBusy = false;
    window.vcToggle = () => {
        if (_vcBusy) return;                    /* blocks the orb + button double-fire */
        _vcBusy = true;
        setTimeout(() => { _vcBusy = false; }, 450);
        listening ? stop() : start();
    };
    window.vcClear = () => {
        rawCommitted = ''; rawSession = ''; interim = ''; finalText = '';
        paint(); $('vc-state').textContent = 'Cleared.';
    };
    window.vcInsert = () => {
        const t = (finalText + ' ' + interim).trim();
        if (!t) { showToast('Nothing captured yet.'); return; }
        if (state.isGuest || !state.docId) { showToast('Open a note first.'); return; }
        if (document.body.classList.contains('zd-read')) { try { zdUnsealNote(); } catch (e) {} }
        stop();
        const sel = quill.getSelection();
        const at = sel ? sel.index : quill.getLength() - 1;
        quill.insertText(at, t + ' ', 'user');
        quill.setSelection(at + t.length + 1, 0, 'silent');
        try { scanInlineTokens(true); } catch (e) {}
        rawCommitted = ''; rawSession = ''; interim = ''; finalText = ''; paint();
        closeVoice();
        showToast('Added ' + t.split(/\s+/).length + ' words to your note.');
    };
    window.openVoice = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        if (!SR) { showToast('Voice input needs Chrome, Edge, Safari or Android.', 4200); return; }
        $('vc-modal').classList.add('open');
        paint();
    };
    window.closeVoice = () => { stop(); $('vc-modal').classList.remove('open'); };
    $('vc-orb').onclick = () => vcToggle();
    $('vc-modal').addEventListener('click', e => { if (e.target.id === 'vc-modal') closeVoice(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && $('vc-modal').classList.contains('open')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); closeVoice();
        }
        /* Alt+V */
        if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key || '').toLowerCase() === 'v' && !state.isGuest) {
            e.preventDefault(); openVoice();
        }
    }, true);
    window.addEventListener('pagehide', stop);

    try {
        zdMenuInject2('voice', 'openVoice', 'Voice capture', '<rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/>');
        ZD_FEATURES.push({ id: 'voice', label: 'Voice capture', fns: ['openVoice'] });
        ZD_FEAT_ICONS.voice = '<rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/>';
    } catch (e) {}
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 600);
})();    

   // New Code

    /* ============================================================
   V8.0 — TRACKERS CORE  ·  "THE GRID"
   Habits (good & bad) · Gym/workout · Pet & garden
   Tunnel transition · Alt+T shortcut · per-tracker calendars
   BMI gauge · streaks · year progress · cyberpunk encouragement
   Firestore: users/{uid}/trackers/{id}
   V8.1 (robot) and V8.2 (consequences) mount into this.
============================================================ */
(function zd80() {
    if (window.__zd80) return; window.__zd80 = true;

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const TRK_TUNNEL_MS = 1550;   // ⚙ TUNNEL length in ms (enter & exit). 1550 = cinematic.
    const TRK_BOOT_MS   = 900;    // ⚙ how long the element boot-in sequence runs
    const TRK_MARQUEE_S = 30;     // ⚙ encouragement marquee loop (seconds)
    /* ─────────────────────────────────────────────────────────── */

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ============ TUNNEL ============ */
    #trk-tunnel{position:fixed;inset:0;z-index:210;display:none;overflow:hidden;background:#02040a;
        perspective:340px;perspective-origin:50% 50%;}
    #trk-tunnel.on{display:block;}
    /* receding square rings — the corridor */
    #trk-tunnel .tn-r{position:absolute;left:50%;top:50%;width:min(46vw,360px);height:min(46vw,360px);
        transform:translate(-50%,-50%);border-radius:14px;border:2px solid rgb(var(--accent-rgb) / .8);
        box-shadow:0 0 30px rgb(var(--accent-rgb) / .55),inset 0 0 40px rgb(var(--accent-rgb) / .18);
        opacity:0;will-change:transform,opacity;}
    #trk-tunnel.in .tn-r{animation:tnIn ${TRK_TUNNEL_MS}ms cubic-bezier(.42,0,.72,.14) forwards;}
    #trk-tunnel.out .tn-r{animation:tnOut ${TRK_TUNNEL_MS}ms cubic-bezier(.3,.9,.5,1) forwards;}
    @keyframes tnIn{
        0%{transform:translate(-50%,-50%) translateZ(-2600px) rotate(-14deg) scale(.9);opacity:0}
        18%{opacity:.95}
        78%{opacity:1}
        100%{transform:translate(-50%,-50%) translateZ(620px) rotate(26deg) scale(1.5);opacity:0}}
    @keyframes tnOut{
        0%{transform:translate(-50%,-50%) translateZ(620px) rotate(26deg) scale(1.5);opacity:0}
        26%{opacity:1}
        82%{opacity:.85}
        100%{transform:translate(-50%,-50%) translateZ(-2600px) rotate(-14deg) scale(.9);opacity:0}}
    /* speed streaks */
    #trk-tunnel .tn-s{position:absolute;left:50%;top:50%;width:2px;border-radius:99px;
        background:linear-gradient(180deg,transparent,rgb(var(--accent-rgb)),transparent);
        transform-origin:0 0;opacity:0;}
    #trk-tunnel.in .tn-s{animation:tnStreak ${TRK_TUNNEL_MS}ms cubic-bezier(.4,0,.7,.2) forwards;}
    #trk-tunnel.out .tn-s{animation:tnStreakOut ${TRK_TUNNEL_MS}ms cubic-bezier(.3,.9,.5,1) forwards;}
    @keyframes tnStreak{0%{height:0;opacity:0}25%{opacity:.85}100%{height:130vmax;opacity:0}}
    @keyframes tnStreakOut{0%{height:130vmax;opacity:0}35%{opacity:.7}100%{height:0;opacity:0}}
    /* grid floor rushing past */
    #trk-tunnel .tn-floor{position:absolute;left:-50%;right:-50%;bottom:-10%;height:70%;
        background-image:linear-gradient(rgb(var(--accent-rgb) / .38) 1px,transparent 1px),
                         linear-gradient(90deg,rgb(var(--accent-rgb) / .38) 1px,transparent 1px);
        background-size:64px 64px;transform:rotateX(76deg);transform-origin:50% 100%;opacity:0;}
    #trk-tunnel.in .tn-floor{animation:tnFloor ${TRK_TUNNEL_MS}ms linear forwards;}
    #trk-tunnel.out .tn-floor{animation:tnFloorOut ${TRK_TUNNEL_MS}ms linear forwards;}
    @keyframes tnFloor{0%{opacity:0;background-position-y:0}22%{opacity:.6}100%{opacity:0;background-position-y:900px}}
    @keyframes tnFloorOut{0%{opacity:0;background-position-y:900px}40%{opacity:.45}100%{opacity:0;background-position-y:0}}
    /* white core flash */
    #trk-tunnel .tn-core{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px;
        border-radius:99px;background:#fff;box-shadow:0 0 60px 22px rgb(var(--accent-rgb) / .9);opacity:0;}
    #trk-tunnel.in .tn-core{animation:tnCore ${TRK_TUNNEL_MS}ms cubic-bezier(.7,0,.9,.2) forwards;}
    #trk-tunnel.out .tn-core{animation:tnCoreOut ${TRK_TUNNEL_MS}ms ease-out forwards;}
    @keyframes tnCore{0%{transform:scale(.2);opacity:.3}62%{transform:scale(1.4);opacity:1}
                      100%{transform:scale(130);opacity:0}}
    @keyframes tnCoreOut{0%{transform:scale(130);opacity:.9}45%{transform:scale(1.2);opacity:1}
                         100%{transform:scale(.2);opacity:0}}
    #trk-tunnel .tn-lbl{position:absolute;left:0;right:0;bottom:12%;text-align:center;color:#fff;z-index:4;
        font-size:10px;font-weight:900;letter-spacing:.5em;text-transform:uppercase;
        text-shadow:0 0 18px rgb(var(--accent-rgb));animation:tnFlick .42s steps(2) infinite;}
    @keyframes tnFlick{50%{opacity:.2}}
    #trk-tunnel .tn-pct{position:absolute;left:0;right:0;bottom:7.5%;text-align:center;z-index:4;
        font-size:9px;font-weight:800;letter-spacing:.3em;color:rgb(var(--accent-rgb));opacity:.8;}

    /* ============ BOOT / DISSOLVE ============ */
    @keyframes bootBar{0%{opacity:0;clip-path:inset(0 50% 0 50%)}
                       60%{opacity:1;clip-path:inset(0 0 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}
    @keyframes bootUp{0%{opacity:0;transform:translateY(22px);filter:blur(6px)}
                      100%{opacity:1;transform:none;filter:none}}
    @keyframes bootGlitch{0%{opacity:0;transform:translateX(-9px) skewX(9deg)}
                          22%{opacity:1;transform:translateX(6px) skewX(-5deg)}
                          44%{transform:translateX(-3px) skewX(2deg)}
                          100%{opacity:1;transform:none}}
    #trk-modal.trk-boot .trk-head{animation:bootBar .55s cubic-bezier(.22,1,.36,1) both;}
    #trk-modal.trk-boot .trk-t{animation:bootGlitch .6s cubic-bezier(.22,1,.36,1) .1s both;}
    #trk-modal.trk-boot #trk-marq{animation:bootBar .55s cubic-bezier(.22,1,.36,1) .12s both;}
    #trk-modal.trk-boot #trk-tabs{animation:bootUp .5s cubic-bezier(.22,1,.36,1) .2s both;}
    #trk-modal.trk-boot #trk-robo{animation:bootUp .55s cubic-bezier(.22,1,.36,1) .28s both;}
    #trk-modal.trk-boot #trk-stats{animation:bootUp .55s cubic-bezier(.22,1,.36,1) .34s both;}
    #trk-modal.trk-boot #trk-grid{animation:bootUp .6s cubic-bezier(.22,1,.36,1) .46s both;}
    /* scanline sweep during boot */
    #trk-scan{position:absolute;left:0;right:0;top:0;height:34%;z-index:9;pointer-events:none;display:none;
        background:linear-gradient(180deg,transparent,rgb(var(--accent-rgb) / .13) 44%,
                   rgb(var(--accent-rgb) / .3) 52%,rgb(var(--accent-rgb) / .13) 60%,transparent);}
    #trk-modal.trk-boot #trk-scan{display:block;animation:trkScan ${TRK_BOOT_MS}ms cubic-bezier(.4,0,.3,1) forwards;}
    @keyframes trkScan{0%{top:-34%;opacity:0}14%{opacity:1}100%{top:104%;opacity:0}}
    /* dissolve on exit */
    #trk-modal.trk-off .trk-head,#trk-modal.trk-off #trk-marq,#trk-modal.trk-off #trk-tabs,
    #trk-modal.trk-off #trk-stats,#trk-modal.trk-off #trk-grid,#trk-modal.trk-off #trk-robo{
        animation:bootOut .38s cubic-bezier(.5,0,.9,.3) both;}
    #trk-modal.trk-off #trk-grid{animation-delay:0ms}
    #trk-modal.trk-off #trk-stats{animation-delay:60ms}
    #trk-modal.trk-off #trk-robo{animation-delay:100ms}
    #trk-modal.trk-off #trk-tabs{animation-delay:130ms}
    #trk-modal.trk-off #trk-marq{animation-delay:170ms}
    #trk-modal.trk-off .trk-head{animation-delay:200ms}
    @keyframes bootOut{0%{opacity:1;transform:none;filter:none}
                       100%{opacity:0;transform:translateY(-16px) scaleX(.96);filter:blur(7px)}}
    #trk-modal.trk-off #trk-fab,#trk-modal.trk-off ~ #trk-fab{opacity:0;transform:scale(.4);transition:all .3s ease;}
    @media (prefers-reduced-motion:reduce){
        #trk-tunnel .tn-r,#trk-tunnel .tn-s,#trk-tunnel .tn-floor,#trk-tunnel .tn-core{animation-duration:.3s!important}
        #trk-modal.trk-boot *{animation-duration:.2s!important;animation-delay:0ms!important}
    }

    /* ============ SECTION SHELL ============ */
    #trk-modal{position:fixed;inset:0;z-index:118;display:none;flex-direction:column;
        background:#080b11;color:#e8ecf5;}
    #trk-modal.open{display:flex;animation:trkIn .34s cubic-bezier(.22,1,.36,1);}
    @keyframes trkIn{0%{opacity:0;transform:scale(1.03)}100%{opacity:1;transform:none}}
    html:not(.dark) #trk-modal{background:#0b0e15;}
    #trk-modal::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;
        background:radial-gradient(700px 420px at 12% 6%,rgb(var(--accent-rgb) / .2),transparent 60%),
                   radial-gradient(560px 380px at 92% 94%,rgb(var(--accent-rgb) / .14),transparent 58%);}
    #trk-modal::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:1;opacity:.5;
        background:repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0 1px,transparent 1px 3px);}
    #trk-modal > *{position:relative;z-index:2;}
    .trk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;
        padding:0 12px;min-height:54px;border-bottom:1px solid rgba(255,255,255,.09);flex-shrink:0;
        background:rgba(8,11,17,.8);backdrop-filter:blur(10px);}
    .trk-t{font-size:14px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
        background-image:var(--zd-grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
    .trk-b{width:30px;height:30px;border-radius:99px;display:inline-flex;align-items:center;
        justify-content:center;color:#8b93a1;transition:all .15s ease;flex-shrink:0;}
    .trk-b svg{width:16px;height:16px;}
    .trk-b:hover{color:rgb(var(--accent-rgb));background:rgb(var(--accent-rgb) / .14);}
    .trk-x{width:32px;height:32px;border-radius:99px;display:flex;align-items:center;justify-content:center;
        font-size:21px;line-height:1;color:#8b93a1;flex-shrink:0;transition:all .15s ease;}
    .trk-x:hover{color:#ff5f57;background:rgba(255,95,87,.13);}

    /* ============ MARQUEE ============ */
    #trk-marq{overflow:hidden;white-space:nowrap;flex-shrink:0;padding:7px 0;
        border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);}
    #trk-marq span{display:inline-block;padding-left:100%;font-size:11px;font-weight:800;
        letter-spacing:.16em;text-transform:uppercase;color:rgb(var(--accent-rgb));
        text-shadow:0 0 14px rgb(var(--accent-rgb) / .55);
        animation:trkMarq ${TRK_MARQUEE_S}s linear infinite;}
    @keyframes trkMarq{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}

    /* ============ TABS ============ */
    #trk-tabs{display:flex;gap:5px;padding:10px 12px 0;overflow-x:auto;flex-shrink:0;
        -webkit-overflow-scrolling:touch;scrollbar-width:none;}
    #trk-tabs::-webkit-scrollbar{display:none;}
    .trk-tab{flex:0 0 auto;padding:7px 14px;border-radius:99px;font-size:11px;font-weight:800;
        color:#8b93a1;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);
        transition:all .16s ease;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;}
    .trk-tab svg{width:13px;height:13px;}
    .trk-tab:hover{color:#e8ecf5;border-color:rgba(255,255,255,.24);}
    .trk-tab.on{background-image:var(--zd-grad);color:#fff;border-color:transparent;
        box-shadow:0 5px 18px rgb(var(--accent-rgb) / .38);}

    /* ============ BODY ============ */
    #trk-body{flex:1;min-height:0;overflow-y:auto;padding:12px;padding-bottom:80px;}
    .trk-wrap{max-width:940px;margin:0 auto;}
    /* stats strip */
    .trk-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px;}
    @media(max-width:560px){.trk-strip{grid-template-columns:repeat(2,minmax(0,1fr));}}
    .trk-kpi{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:11px 12px;
        background:rgba(255,255,255,.035);position:relative;overflow:hidden;
        animation:kpiIn .4s cubic-bezier(.22,1,.36,1) both;}
    @keyframes kpiIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:none}}
    .trk-kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background-image:var(--zd-grad);}
    .trk-kpi b{display:block;font-size:21px;font-weight:900;line-height:1.1;color:#fff;
        font-variant-numeric:tabular-nums;}
    .trk-kpi span{font-size:8.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7d8695;}
    /* year bar */
    .trk-year{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px;margin-bottom:14px;
        background:rgba(255,255,255,.035);}
    .trk-bar{height:7px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden;position:relative;}
    .trk-bar i{display:block;height:100%;border-radius:99px;background-image:var(--zd-grad);
        box-shadow:0 0 14px rgb(var(--accent-rgb) / .65);transition:width .9s cubic-bezier(.22,1,.36,1);}
    .trk-bar::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);
        transform:translateX(-100%);animation:trkShine 2.6s ease-in-out infinite;}
    @keyframes trkShine{0%{transform:translateX(-100%)}65%,100%{transform:translateX(100%)}}

    /* ============ CARDS ============ */
    #trk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:11px;}
    @media(max-width:600px){#trk-grid{grid-template-columns:1fr;}}
    .tc{border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:13px;position:relative;
        background:rgba(255,255,255,.038);overflow:hidden;transition:transform .18s ease,border-color .18s ease;
        animation:kpiIn .42s cubic-bezier(.22,1,.36,1) both;}
    .tc:hover{transform:translateY(-3px);border-color:rgb(var(--accent-rgb) / .5);}
    .tc::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;background:var(--tc-c,rgb(var(--accent-rgb)));
        box-shadow:0 0 12px var(--tc-c,rgb(var(--accent-rgb)));}
    .tc-ico{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;background:color-mix(in srgb,var(--tc-c,#4a9eff) 18%,transparent);color:var(--tc-c,#4a9eff);}
    @supports not (background:color-mix(in srgb,red 10%,blue)){.tc-ico{background:rgba(255,255,255,.09);}}
    .tc-ico svg{width:17px;height:17px;}
    .tc-n{font-size:13px;font-weight:800;color:#fff;line-height:1.25;}
    .tc-s{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7d8695;}
    .tc-flame{font-size:10px;font-weight:900;padding:2px 8px;border-radius:99px;flex-shrink:0;
        background:rgba(255,167,38,.16);color:#ffa726;}
    .tc-dots{display:flex;gap:4px;margin:11px 0 10px;}
    .tc-dots i{flex:1;height:22px;border-radius:5px;background:rgba(255,255,255,.07);position:relative;
        transition:all .2s ease;}
    .tc-dots i.hit{background:var(--tc-c,#4a9eff);box-shadow:0 0 9px var(--tc-c,#4a9eff);}
    .tc-dots i.bad{background:#ff5f57;box-shadow:0 0 9px #ff5f57;}
    .tc-dots i.today{outline:2px solid rgba(255,255,255,.42);outline-offset:1px;}
    .tc-go{flex:1;padding:8px 0;border-radius:11px;font-size:11px;font-weight:800;color:#fff;
        background-image:var(--zd-grad);transition:transform .14s ease;}
    .tc-go:active{transform:scale(.96);}
    .tc-go.done{background:rgba(255,255,255,.09);background-image:none;color:#7d8695;}
    .tc-go.warn{background:linear-gradient(135deg,#ff5f57,#ff8a4c);background-image:linear-gradient(135deg,#ff5f57,#ff8a4c);}
    .tc-mini{width:34px;padding:8px 0;border-radius:11px;font-size:11px;font-weight:800;
        background:rgba(255,255,255,.07);color:#8b93a1;transition:all .15s ease;}
    .tc-mini:hover{background:rgba(255,255,255,.14);color:#fff;}

    /* ============ CALENDAR ============ */
    .trk-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
    .trk-cal .cd{aspect-ratio:1;border-radius:7px;display:flex;align-items:center;justify-content:center;
        font-size:9.5px;font-weight:700;background:rgba(255,255,255,.05);color:#6b7280;position:relative;
        cursor:pointer;transition:all .15s ease;}
    .trk-cal .cd:hover{background:rgba(255,255,255,.13);color:#fff;}
    .trk-cal .cd.hit{background:var(--tc-c,#4a9eff);color:#04060a;box-shadow:0 0 10px var(--tc-c,#4a9eff);}
    .trk-cal .cd.bad{background:#ff5f57;color:#fff;box-shadow:0 0 10px rgba(255,95,87,.75);}
    .trk-cal .cd.clean{background:rgba(74,222,128,.85);color:#04060a;box-shadow:0 0 10px rgba(74,222,128,.6);}
    .trk-cal .cd.today{outline:2px solid #fff;outline-offset:1px;}
    .trk-cal .cd.void{opacity:0;pointer-events:none;}
    .trk-cal .cd.future{opacity:.3;pointer-events:none;}
    .trk-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:5px;}
    .trk-dow span{text-align:center;font-size:8px;font-weight:800;letter-spacing:.06em;color:#5a6472;}

    /* ============ GAUGE ============ */
    .bmi-wrap{position:relative;width:100%;max-width:300px;margin:0 auto;}
    #bmi-needle{transform-origin:130px 134px;transform-box:view-box;
        animation:bmiSweep 1.4s cubic-bezier(.34,1.3,.5,1) both;}
    @keyframes bmiSweep{0%{transform:rotate(-90deg)}100%{}}
    .bmi-v{position:absolute;left:0;right:0;bottom:2px;text-align:center;}
    .bmi-v b{display:block;font-size:31px;font-weight:900;color:#fff;line-height:1;
        font-variant-numeric:tabular-nums;letter-spacing:-.02em;text-shadow:0 2px 18px rgba(0,0,0,.6);}
    .bmi-chip{display:inline-block;margin-top:5px;padding:2.5px 11px;border-radius:99px;border:1px solid;
        font-size:8.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;}
    .bmi-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:11px;
        padding-top:11px;border-top:1px solid rgba(255,255,255,.08);}
    @media(max-width:420px){.bmi-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 6px;}}
    .bmi-row span{text-align:center;min-width:0;}
    .bmi-row b{display:block;font-size:13px;font-weight:900;line-height:1.2;font-variant-numeric:tabular-nums;}
    .bmi-row i{display:block;font-size:7.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
        color:#5a6472;font-style:normal;margin-top:2px;}

    /* ============ SHEETS ============ */
    .trk-sheet{position:fixed;inset:0;z-index:124;display:none;align-items:center;justify-content:center;
        background:rgba(2,4,8,.76);backdrop-filter:blur(7px);padding:14px;}
    .trk-sheet.open{display:flex;animation:trkIn .22s ease-out;}
    .trk-box{width:100%;max-width:420px;max-height:88vh;overflow-y:auto;border-radius:18px;padding:16px;
        background:#0d1119;border:1px solid rgba(255,255,255,.12);color:#e8ecf5;
        box-shadow:0 28px 70px rgba(0,0,0,.6);animation:boxIn .28s cubic-bezier(.22,1,.36,1);}
    .trk-l{display:block;font-size:8.5px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;
        color:#7d8695;margin:11px 0 5px;}
    .trk-i{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.13);
        border-radius:10px;padding:9px 11px;font-size:13px;color:#e8ecf5;outline:none;
        caret-color:rgb(var(--accent-rgb));}
    @media(max-width:850px){.trk-i{font-size:16px;}}
    .trk-i:focus{border-color:rgb(var(--accent-rgb));}
    .trk-i::placeholder{color:#5a6472;}
    .trk-pick{display:flex;flex-wrap:wrap;gap:5px;}
    .trk-p{padding:6px 11px;border-radius:9px;font-size:11px;font-weight:700;color:#8b93a1;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11);transition:all .15s ease;}
    .trk-p:hover{color:#fff;border-color:rgba(255,255,255,.3);}
    .trk-p.on{background-image:var(--zd-grad);color:#fff;border-color:transparent;}
    .trk-int{display:flex;gap:5px;}
    .trk-int button{flex:1;padding:9px 0;border-radius:9px;font-size:14px;font-weight:900;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11);color:#5a6472;transition:all .15s ease;}
    .trk-int button.on{color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(0,0,0,.4);}
    .trk-int button:nth-child(1).on{background:#4ade80}.trk-int button:nth-child(2).on{background:#a3e635}
    .trk-int button:nth-child(3).on{background:#fbbf24}.trk-int button:nth-child(4).on{background:#fb923c}
    .trk-int button:nth-child(5).on{background:#ef4444}
    .trk-cta{width:100%;padding:11px 0;border-radius:12px;font-size:12.5px;font-weight:900;color:#fff;
        background-image:var(--zd-grad);margin-top:14px;transition:transform .14s ease;}
    .trk-cta:active{transform:scale(.98);}
    .trk-ghost{width:100%;padding:9px 0;border-radius:12px;font-size:11px;font-weight:800;margin-top:6px;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11);color:#8b93a1;}
    #trk-fab{position:fixed;right:18px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:120;
        width:54px;height:54px;border-radius:99px;display:none;align-items:center;justify-content:center;
        font-size:27px;color:#fff;background-image:var(--zd-grad);
        box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 0 rgb(var(--accent-rgb) / .5);
        animation:fabHalo 2.8s ease-in-out infinite;}
    #trk-modal.open ~ #trk-fab{display:flex;}
    @keyframes fabHalo{0%,100%{box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 0 rgb(var(--accent-rgb) / .45)}
                       65%{box-shadow:0 12px 30px rgba(0,0,0,.45),0 0 0 14px rgb(var(--accent-rgb) / 0)}}
    .trk-empty{text-align:center;padding:46px 20px;color:#5a6472;}
    .trk-empty svg{width:44px;height:44px;margin:0 auto 12px;opacity:.4;}
    /* V8.1 mounts here */
    #trk-robo{margin-bottom:13px;}
    </style>`);

    /* ============ ICONS & CATALOGUE ============ */
    const I = {
        good:  '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>',
        bad:   '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L2.4 17a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
        gym:   '<path stroke-linecap="round" stroke-linejoin="round" d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
        pet:   '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-4.4-7-9.6A4.4 4.4 0 0112 8.4a4.4 4.4 0 017 3C19 16.6 12 21 12 21z"/>',
        grid:  '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
        help:  '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.2 9.4A3 3 0 0112 7.6c1.7 0 3 1 3 2.3 0 1.1-1 2-2.3 2.2-.4.1-.7.4-.7.9m0 3h.01"/>',
        cal:   '<rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4m8-4v4M3 10h18"/>',
        scale: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v3m-7 3h14l2 12H3L5 9zm7 3a3 3 0 100 6 3 3 0 000-6z"/>'
    };
    const KIND = {
        good: { n: 'Good habit',    c: '#4ade80', i: I.good, verb: 'Done today' },
        bad:  { n: 'Break a habit', c: '#ff5f57', i: I.bad,  verb: 'I slipped' },
        gym:  { n: 'Workout',       c: '#38bdf8', i: I.gym,  verb: 'Log session' },
        pet:  { n: 'Pet & garden',  c: '#a78bfa', i: I.pet,  verb: 'Log care' }
    };
    const LINES = [
        'DISCIPLINE IS FREEDOM · SHOW UP AGAIN TODAY',
        'SMALL REPS COMPOUND · THE GRID REMEMBERS EVERYTHING',
        'YOU ARE ONE ENTRY AWAY FROM A BETTER STREAK',
        'MOTIVATION FADES · SYSTEMS ENDURE · KEEP LOGGING',
        'THE VERSION OF YOU IN A YEAR IS WATCHING RIGHT NOW',
        'CONSISTENCY BEATS INTENSITY · EVERY SINGLE TIME',
        'DON\u2019T BREAK THE CHAIN · NOT TODAY',
        'PROGRESS IS QUIET · THEN IT IS OBVIOUS',
        'YOU DO NOT RISE TO GOALS · YOU FALL TO SYSTEMS'
    ];
    const WORKOUTS = ['Push', 'Pull', 'Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Cardio', 'HIIT', 'Yoga', 'Swim', 'Run', 'Cycle', 'Full body', 'Rest'];
    const CARE = ['Fed', 'Watered', 'Walked', 'Played', 'Groomed', 'Cleaned', 'Pruned', 'Fertilised', 'Repotted', 'Vet / check'];

    /* ============ DOM ============ */
    document.body.insertAdjacentHTML('beforeend', `
    <div id="trk-tunnel">
      <div class="tn-floor"></div><span class="tn-core"></span>
      <div class="tn-lbl">entering the grid</div><div class="tn-pct" id="tn-pct">initialising</div>
    </div>

    <div id="trk-modal">
      <div class="trk-head">
        <span class="flex items-center gap-1">
          <button class="trk-b" onclick="trkTour()" title="How this works"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${I.help}</svg></button>
        </span>
        <span class="flex items-center gap-2 min-w-0">
          <svg class="w-4 h-4 flex-shrink-0" style="color:rgb(var(--accent-rgb))" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${I.grid}</svg>
          <span class="trk-t">The Grid</span>
        </span>
        <button class="trk-x" onclick="closeTrackers()" title="Exit (Esc)">×</button>
      </div>
      <div id="trk-marq"><span id="trk-marq-t"></span></div>
      <div id="trk-tabs"></div>
      <div id="trk-scan"></div>
      <div id="trk-body"><div class="trk-wrap">
        <div id="trk-robo"></div>
        <div id="trk-stats"></div>
        <div id="trk-grid"></div>
      </div></div>
    </div>
    <button id="trk-fab" onclick="trkNew()" title="New tracker">+</button>

    <div id="trk-edit" class="trk-sheet"><div class="trk-box" id="trk-edit-box"></div></div>
    <div id="trk-log" class="trk-sheet"><div class="trk-box" id="trk-log-box"></div></div>
    <div id="trk-detail" class="trk-sheet"><div class="trk-box" id="trk-detail-box"></div></div>
    <div id="trk-tourwrap" class="trk-sheet"><div class="trk-box" id="trk-tour-box"></div></div>`);

    /* ============ STATE ============ */
    const $ = id => document.getElementById(id);
    let TRK = [];            /* tracker docs */
    let BODY = { h: 0, w: [] }; /* height cm + [{d,kg}] */
    let unsub = null, tab = 'all', logId = null, calM = new Date();
    const key = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const TODAY = () => key(new Date());
    const col = () => db.collection('users').doc(state.user.uid).collection('trackers');

    function streak(t) {
        let n = 0; const d = new Date();
        for (let i = 0; i < 400; i++) {
            const k = key(d), hit = !!(t.logs && t.logs[k]);
            /* bad habits: a CLEAN day (no entry) is the win */
            const ok = t.kind === 'bad' ? !hit : hit;
            if (ok) n++; else if (i > 0 || t.kind === 'bad') break; else break;
            d.setDate(d.getDate() - 1);
        }
        return n;
    }
    function monthDone(t, y, m) {
        let n = 0;
        Object.keys(t.logs || {}).forEach(k => {
            const p = k.split('-');
            if (+p[0] === y && +p[1] === m + 1) n++;
        });
        return n;
    }
    function bmi() {
        if (!BODY.h || !BODY.w.length) return null;
        const kg = BODY.w[BODY.w.length - 1].kg, m = BODY.h / 100;
        return +(kg / (m * m)).toFixed(1);
    }

    /* ============ OPEN / CLOSE with the tunnel ============ */
    const PHASES = ['initialising', 'linking neural grid', 'loading streaks', 'grid online'];
    function tunnel(dir, cb) {
        const tn = $('trk-tunnel');
        tn.querySelectorAll('.tn-r,.tn-s').forEach(n => n.remove());
        /* corridor rings */
        for (let i = 0; i < 11; i++) {
            const r = document.createElement('span');
            r.className = 'tn-r';
            r.style.animationDelay = (dir === 'in' ? i * 92 : (10 - i) * 92) + 'ms';
            tn.appendChild(r);
        }
        /* radial speed streaks */
        for (let i = 0; i < 26; i++) {
            const s = document.createElement('span');
            s.className = 'tn-s';
            s.style.transform = 'rotate(' + (i * (360 / 26) + Math.random() * 8) + 'deg)';
            s.style.animationDelay = (Math.random() * 340) + 'ms';
            s.style.opacity = 0;
            tn.appendChild(s);
        }
        tn.querySelector('.tn-lbl').textContent = dir === 'in' ? 'entering the grid' : 'leaving the grid';
        let p = 0;
        const pt = setInterval(() => {
            p++; $('tn-pct').textContent = dir === 'in' ? (PHASES[p] || 'grid online') : 'disconnecting';
            if (p >= PHASES.length) clearInterval(pt);
        }, TRK_TUNNEL_MS / 4.4);
        tn.className = 'on ' + dir;
        try { if (navigator.vibrate) navigator.vibrate(dir === 'in' ? [8, 40, 12, 60, 18] : [14, 50, 8]); } catch (e) {}
        setTimeout(cb, TRK_TUNNEL_MS * (dir === 'in' ? 0.66 : 0.5));
        setTimeout(() => { clearInterval(pt); tn.className = ''; }, TRK_TUNNEL_MS + 140);
    }
    window.openTrackers = () => {
        if (state.isGuest) { showToast('Sign in to use trackers.'); return; }
        tunnel('in', () => {
            try { closeAllViews(); } catch (e) {}
            const m = $('trk-modal');
            m.classList.remove('trk-off');
            m.classList.add('open', 'trk-boot');
            marquee(); watch(); render();
            setTimeout(() => m.classList.remove('trk-boot'), TRK_BOOT_MS + 200);
            if (!localStorage.getItem('zdTrkTour')) setTimeout(trkTour, TRK_BOOT_MS + 500);
        });
    };
    window.closeTrackers = () => {
        ['trk-edit', 'trk-log', 'trk-detail', 'trk-tourwrap'].forEach(i => $(i).classList.remove('open'));
        const m = $('trk-modal');
        m.classList.add('trk-off');                    /* elements dissolve first */
        setTimeout(() => {
            tunnel('out', () => {
                m.classList.remove('open', 'trk-off', 'trk-boot');
                if (unsub) { unsub(); unsub = null; }
            });
        }, 300);
    };
    
    function marquee() {
        const pick = [];
        const s = LINES.slice().sort(() => Math.random() - 0.5);
        for (let i = 0; i < 4; i++) pick.push(s[i % s.length]);
        $('trk-marq-t').textContent = pick.join('   ///   ') + '   ///   ';
    }

    /* ============ DATA ============ */
    function watch() {
        if (unsub) unsub();
        unsub = col().onSnapshot(snap => {
            TRK = []; BODY = { h: 0, w: [] };
            snap.docs.forEach(d => {
                if (d.id === '_body') { const b = d.data(); BODY = { h: b.h || 0, w: b.w || [] }; return; }
                TRK.push(Object.assign({ id: d.id }, d.data()));
            });
            TRK.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.name || '').localeCompare(b.name || ''));
            render();
            try { if (window.zdRoboSync) zdRoboSync(TRK); } catch (e) {}   /* V8.1 hook */
        }, e => console.warn('[trk]', e));
    }
    async function save(id, patch) {
        try { await col().doc(id).set(patch, { merge: true }); }
        catch (e) { console.error(e); showToast('Could not save — check your connection.'); }
    }

    /* ============ RENDER ============ */
    function render() {
        if (!$('trk-modal').classList.contains('open')) return;
        /* tabs */
        const counts = { all: TRK.length };
        Object.keys(KIND).forEach(k => counts[k] = TRK.filter(t => t.kind === k).length);
        $('trk-tabs').innerHTML =
            [['all', 'All', I.grid]].concat(Object.keys(KIND).map(k => [k, KIND[k].n, KIND[k].i]))
            .map(([k, n, ic]) => `<button class="trk-tab ${tab === k ? 'on' : ''}" onclick="trkTab('${k}')">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${ic}</svg>${n}
                ${counts[k] ? '<span style="opacity:.7">' + counts[k] + '</span>' : ''}</button>`).join('');

        /* stats */
        const now = new Date(), y = now.getFullYear();
        const start = new Date(y, 0, 1), end = new Date(y, 11, 31);
        const dayOfYear = Math.floor((now - start) / 864e5) + 1;
        const totalDays = Math.floor((end - start) / 864e5) + 1;
        const left = totalDays - dayOfYear;
        const t2 = TODAY();
        const active = TRK.filter(t => tab === 'all' || t.kind === tab);
        const dueToday = active.filter(t => t.kind !== 'bad');
        const doneToday = dueToday.filter(t => t.logs && t.logs[t2]).length;
        const slips = active.filter(t => t.kind === 'bad' && t.logs && t.logs[t2]).length;
        const best = TRK.reduce((m, t) => Math.max(m, streak(t)), 0);
        let logged = 0; TRK.forEach(t => { logged += Object.keys(t.logs || {}).filter(k => k.indexOf(y + '-') === 0).length; });

        $('trk-stats').innerHTML = `
        <div class="trk-strip">
          <div class="trk-kpi" style="animation-delay:0ms"><b>${best}</b><span>Best streak</span></div>
          <div class="trk-kpi" style="animation-delay:60ms"><b>${doneToday}/${dueToday.length}</b><span>Done today</span></div>
          <div class="trk-kpi" style="animation-delay:120ms"><b>${logged}</b><span>Entries this year</span></div>
          <div class="trk-kpi" style="animation-delay:180ms"><b>${slips}</b><span>Slips today</span></div>
        </div>
        <div class="trk-year">
          <div class="flex items-center justify-between mb-2">
            <span style="font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#7d8695">${y} progress</span>
            <span style="font-size:10px;font-weight:800;color:rgb(var(--accent-rgb))">${left} days left</span>
          </div>
          <div class="trk-bar"><i style="width:${(dayOfYear / totalDays * 100).toFixed(1)}%"></i></div>
          <div style="font-size:9px;color:#5a6472;margin-top:6px">Day ${dayOfYear} of ${totalDays} · every entry is one you can never lose</div>
        </div>
        ${(tab === 'gym' || tab === 'all') ? gauge() : ''}`;

        /* cards */
        const g = $('trk-grid');
        if (!active.length) {
            g.innerHTML = `<div class="trk-empty" style="grid-column:1/-1">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">${I.grid}</svg>
                <div style="font-size:13px;font-weight:800;color:#8b93a1">Nothing tracked here yet</div>
                <div style="font-size:11px;margin-top:5px">Tap <b style="color:rgb(var(--accent-rgb))">+</b> to create your first tracker.</div></div>`;
            return;
        }
        g.innerHTML = active.map((t, i) => card(t, i)).join('');
    }
    function card(t, i) {
        const K = KIND[t.kind] || KIND.good;
        const c = t.color || K.c;
        const t2 = TODAY();
        const hit = !!(t.logs && t.logs[t2]);
        const st = streak(t);
        /* last 7 days */
        let dots = '';
        for (let d = 6; d >= 0; d--) {
            const dt = new Date(); dt.setDate(dt.getDate() - d);
            const h = !!(t.logs && t.logs[key(dt)]);
            const cls = t.kind === 'bad' ? (h ? 'bad' : (d === 0 ? '' : 'hit')) : (h ? 'hit' : '');
            dots += `<i class="${cls}${d === 0 ? ' today' : ''}"></i>`;
        }
        const label = t.kind === 'bad'
            ? (hit ? 'Slipped today' : 'Clean today \u2713')
            : (hit ? 'Logged today \u2713' : K.verb);
        return `<div class="tc" style="--tc-c:${c};animation-delay:${i * 55}ms">
          <div class="flex items-start gap-2.5">
            <span class="tc-ico"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${K.i}</svg></span>
            <span class="min-w-0 flex-1">
              <span class="tc-n block truncate">${escapeHtml(t.name || 'Untitled')}</span>
              <span class="tc-s">${K.n}${t.target ? ' · ' + t.target + '×/week' : ''}</span>
            </span>
            <span class="tc-flame">${t.kind === 'bad' ? '\u26e8 ' : '\u{1f525} '}${st}d</span>
          </div>
          <div class="tc-dots">${dots}</div>
          <div class="flex gap-1.5">
            <button class="tc-go ${hit && t.kind !== 'bad' ? 'done' : ''} ${t.kind === 'bad' ? 'warn' : ''}"
                onclick="trkQuick('${t.id}')">${label}</button>
            <button class="tc-mini" onclick="trkDetail('${t.id}')" title="Calendar &amp; history">${'\u2637'}</button>
            <button class="tc-mini" onclick="trkEdit('${t.id}')" title="Edit">${'\u270e'}</button>
          </div>
        </div>`;
    }
    function gauge() {
        const b = bmi();
        const kg = BODY.w.length ? BODY.w[BODY.w.length - 1].kg : null;
        if (!b) return `<div class="trk-year" style="text-align:center;padding:22px 12px">
            <svg style="width:30px;height:30px;margin:0 auto 9px;color:#5a6472" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">${I.scale}</svg>
            <div style="font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#7d8695;margin-bottom:3px">Body metrics</div>
            <div style="font-size:11px;color:#5a6472;margin-bottom:11px">Add your height and weight to unlock the gauge.</div>
            <button onclick="trkBody()" class="trk-p on" style="padding:8px 18px">Set up</button></div>`;

        const R = 100, CX = 130, CY = 128;
        const pt = (v) => {
            const deg = Math.max(0, Math.min(180, (v - 14) / 26 * 180));
            const th = (180 - deg) * Math.PI / 180;
            return [(CX + R * Math.cos(th)).toFixed(1), (CY - R * Math.sin(th)).toFixed(1)];
        };
        const arc = (a, b2, col, w) => {
            const p1 = pt(a), p2 = pt(b2);
            return `<path d="M${p1[0]} ${p1[1]}A${R} ${R} 0 0 1 ${p2[0]} ${p2[1]}" stroke="${col}" stroke-width="${w || 15}" fill="none" stroke-linecap="round"/>`;
        };
        const ang = Math.max(0, Math.min(180, (b - 14) / 26 * 180)) - 90;
        const Z = b < 18.5 ? ['Underweight', '#38bdf8', 'A little more fuel would help'] :
                  b < 25   ? ['Healthy', '#4ade80', 'Right where you want to be'] :
                  b < 30   ? ['Overweight', '#fbbf24', 'Small steady changes work best'] :
                             ['High', '#f87171', 'Worth a chat with your doctor'];
        const ideal = BODY.h ? +(22 * Math.pow(BODY.h / 100, 2)).toFixed(1) : null;
        const delta = ideal && kg ? +(kg - ideal).toFixed(1) : null;

        /* ticks */
        let ticks = '';
        [15, 18.5, 25, 30, 35, 40].forEach(v => {
            const deg = (v - 14) / 26 * 180, th = (180 - deg) * Math.PI / 180;
            const r1 = R - 11, r2 = R - 17;
            ticks += `<line x1="${(CX + r1 * Math.cos(th)).toFixed(1)}" y1="${(CY - r1 * Math.sin(th)).toFixed(1)}"
                x2="${(CX + r2 * Math.cos(th)).toFixed(1)}" y2="${(CY - r2 * Math.sin(th)).toFixed(1)}"
                stroke="rgba(255,255,255,.3)" stroke-width="1.6" stroke-linecap="round"/>`;
            const rl = R - 27;
            ticks += `<text x="${(CX + rl * Math.cos(th)).toFixed(1)}" y="${(CY - rl * Math.sin(th) + 3).toFixed(1)}"
                fill="rgba(255,255,255,.34)" font-size="8" font-weight="800" text-anchor="middle">${v}</text>`;
        });

        /* 30-day weight sparkline */
        let spark = '';
        const w30 = (BODY.w || []).slice(-30);
        if (w30.length > 2) {
            const lo = Math.min.apply(null, w30.map(x => x.kg)), hi = Math.max.apply(null, w30.map(x => x.kg));
            const rng = (hi - lo) || 1;
            const pts = w30.map((x, i) => (i / (w30.length - 1) * 100).toFixed(1) + ',' + (26 - (x.kg - lo) / rng * 22).toFixed(1)).join(' ');
            const trend = w30[w30.length - 1].kg - w30[0].kg;
            spark = `<div style="margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08)">
              <div class="flex items-center justify-between" style="margin-bottom:4px">
                <span style="font-size:8.5px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#7d8695">Weight trend · ${w30.length} entries</span>
                <span style="font-size:10px;font-weight:800;color:${trend <= 0 ? '#4ade80' : '#fbbf24'}">${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg</span>
              </div>
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:100%;height:30px">
                <defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgb(var(--accent-rgb))" stop-opacity=".34"/>
                  <stop offset="100%" stop-color="rgb(var(--accent-rgb))" stop-opacity="0"/></linearGradient></defs>
                <polygon points="0,30 ${pts} 100,30" fill="url(#spg)"/>
                <polyline points="${pts}" fill="none" stroke="rgb(var(--accent-rgb))" stroke-width="1.8"
                  stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
              </svg></div>`;
        }

        return `<div class="trk-year" style="padding:14px 14px 13px">
          <div class="flex items-center justify-between" style="margin-bottom:2px">
            <span style="font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#7d8695">Body metrics</span>
            <button onclick="trkBody()" style="font-size:10px;font-weight:800;color:rgb(var(--accent-rgb))">Update</button>
          </div>
          <div class="bmi-wrap">
            <svg viewBox="0 0 260 152" style="width:100%;display:block">
              <defs>
                <filter id="bmiGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <g transform="translate(0,6)">
                <path d="M${pt(14)[0]} ${pt(14)[1]}A${R} ${R} 0 0 1 ${pt(40)[0]} ${pt(40)[1]}"
                      stroke="rgba(255,255,255,.055)" stroke-width="21" fill="none" stroke-linecap="round"/>
                <g opacity=".9" filter="url(#bmiGlow)">
                  ${arc(14, 18.3, '#38bdf8')}${arc(18.7, 24.8, '#4ade80')}${arc(25.2, 29.8, '#fbbf24')}${arc(30.2, 40, '#f87171')}
                </g>
                ${ticks}
                <g id="bmi-needle" style="transform:rotate(${ang}deg)">
                  <line x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - R + 20}" stroke="#fff" stroke-width="3.4" stroke-linecap="round" filter="url(#bmiGlow)"/>
                  <circle cx="${CX}" cy="${CY - R + 20}" r="4" fill="${Z[1]}" stroke="#fff" stroke-width="1.6"/>
                </g>
                <circle cx="${CX}" cy="${CY}" r="11" fill="#0d1119" stroke="rgba(255,255,255,.28)" stroke-width="2"/>
                <circle cx="${CX}" cy="${CY}" r="4" fill="${Z[1]}"/>
              </g>
            </svg>
            <div class="bmi-v">
              <b>${b}</b>
              <span class="bmi-chip" style="color:${Z[1]};border-color:${Z[1]}55;background:${Z[1]}1f">${Z[0]}</span>
            </div>
          </div>
          <div style="text-align:center;font-size:10px;color:#7d8695;margin-top:2px">${Z[2]}</div>
          <div class="bmi-row">
            <span><b style="color:#fff">${kg} kg</b><i>Now</i></span>
            ${ideal ? `<span><b style="color:#4ade80">${ideal} kg</b><i>Healthy target</i></span>` : ''}
            ${delta !== null ? `<span><b style="color:${Math.abs(delta) < 1 ? '#4ade80' : '#fbbf24'}">${delta > 0 ? '−' : '+'}${Math.abs(delta)} kg</b><i>To target</i></span>` : ''}
            <span><b style="color:#fff">${BODY.h} cm</b><i>Height</i></span>
          </div>
          ${spark}</div>`;
    }
    window.trkTab = (k) => { tab = k; render(); };

    /* ============ QUICK LOG ============ */
    window.trkQuick = (id) => {
        const t = TRK.find(x => x.id === id); if (!t) return;
        const k = TODAY();
        if (t.logs && t.logs[k]) {           /* already logged → open the detail to edit/remove */
            trkLog(id, k);
            return;
        }
        trkLog(id, k);
    };

    /* ============ LOG SHEET ============ */
    let LG = {};
    window.trkLog = (id, dateKey) => {
        const t = TRK.find(x => x.id === id); if (!t) return;
        logId = id;
        const k = dateKey || TODAY();
        const ex = (t.logs && t.logs[k]) || {};
        LG = Object.assign({ date: k, intensity: ex.intensity || 3 }, ex);
        const K = KIND[t.kind];
        let fields = '';
        if (t.kind === 'gym') {
            fields = `
            <span class="trk-l">Session</span>
            <div class="trk-pick" id="lg-class">${WORKOUTS.map(w => `<button class="trk-p ${LG.klass === w ? 'on' : ''}" data-v="${w}">${w}</button>`).join('')}</div>
            <span class="trk-l">Intensity</span>
            <div class="trk-int" id="lg-int">${[1,2,3,4,5].map(n => `<button data-v="${n}" class="${LG.intensity === n ? 'on' : ''}">${n}</button>`).join('')}</div>
            <span class="trk-l">Duration (minutes)</span><input class="trk-i" id="lg-min" type="number" inputmode="numeric" placeholder="45" value="${LG.mins || ''}">
            <span class="trk-l">Supplements taken</span><input class="trk-i" id="lg-sup" placeholder="Whey, creatine…" value="${escapeHtml(LG.sup || '')}">
            <span class="trk-l">Food today &amp; calories</span>
            <textarea class="trk-i" id="lg-food" rows="2" placeholder="Oats, chicken rice, 2 eggs…">${escapeHtml(LG.food || '')}</textarea>
            <input class="trk-i" id="lg-kcal" type="number" inputmode="numeric" placeholder="Total kcal, e.g. 2200" value="${LG.kcal || ''}" style="margin-top:6px">
            <span class="trk-l">Body weight today (kg)</span><input class="trk-i" id="lg-kg" type="number" step="0.1" inputmode="decimal" placeholder="72.5" value="${LG.kg || ''}">`;
        } else if (t.kind === 'pet') {
            fields = `
            <span class="trk-l">Care given</span>
            <div class="trk-pick" id="lg-class">${CARE.map(w => `<button class="trk-p ${LG.klass === w ? 'on' : ''}" data-v="${w}">${w}</button>`).join('')}</div>
            <span class="trk-l">Amount / detail</span><input class="trk-i" id="lg-amt" placeholder="200 ml water, 1 cup food…" value="${escapeHtml(LG.amt || '')}">
            <span class="trk-l">How are they doing?</span>
            <div class="trk-int" id="lg-int">${[1,2,3,4,5].map(n => `<button data-v="${n}" class="${LG.intensity === n ? 'on' : ''}">${n}</button>`).join('')}</div>`;
        } else {
            fields = `
            <span class="trk-l">${t.kind === 'bad' ? 'How strong was the urge?' : 'How well did it go?'}</span>
            <div class="trk-int" id="lg-int">${[1,2,3,4,5].map(n => `<button data-v="${n}" class="${LG.intensity === n ? 'on' : ''}">${n}</button>`).join('')}</div>
            ${t.unit ? `<span class="trk-l">${escapeHtml(t.unit)}</span><input class="trk-i" id="lg-amt" placeholder="e.g. 30" value="${escapeHtml(LG.amt || '')}">` : ''}`;
        }
        $('trk-log-box').innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="flex items-center gap-2 min-w-0">
            <span class="tc-ico" style="--tc-c:${t.color || K.c};width:28px;height:28px;border-radius:9px"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${K.i}</svg></span>
            <span style="font-size:13px;font-weight:900;color:#fff" class="truncate">${escapeHtml(t.name)}</span>
          </span>
          <button class="trk-x" onclick="trkCloseSheet('trk-log')">×</button>
        </div>
        <div style="font-size:10px;color:#7d8695;margin-bottom:2px">${new Date(k + 'T12:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}${t.kind==='bad'?' · logging a slip is honesty, not failure':''}</div>
        ${fields}
        <span class="trk-l">Note</span>
        <textarea class="trk-i" id="lg-note" rows="2" placeholder="Anything worth remembering…">${escapeHtml(LG.note || '')}</textarea>
        <button class="trk-cta" onclick="trkSaveLog()">${(t.logs && t.logs[k]) ? 'Update entry' : 'Save entry'}</button>
        ${(t.logs && t.logs[k]) ? `<button class="trk-ghost" onclick="trkDelLog('${k}')">Remove this entry</button>` : ''}`;
        $('trk-log').classList.add('open');
        wireChips();
    };
    function wireChips() {
        const cl = $('lg-class');
        if (cl) cl.querySelectorAll('.trk-p').forEach(b => b.onclick = () => {
            cl.querySelectorAll('.trk-p').forEach(x => x.classList.remove('on'));
            b.classList.add('on'); LG.klass = b.dataset.v;
        });
        const it = $('lg-int');
        if (it) it.querySelectorAll('button').forEach(b => b.onclick = () => {
            it.querySelectorAll('button').forEach(x => x.classList.remove('on'));
            b.classList.add('on'); LG.intensity = +b.dataset.v;
        });
    }
    window.trkSaveLog = async () => {
        const t = TRK.find(x => x.id === logId); if (!t) return;
        const g = id => { const e = $(id); return e ? e.value.trim() : ''; };
        const entry = { at: Date.now(), intensity: LG.intensity || 3 };
        if (LG.klass) entry.klass = LG.klass;
        if (g('lg-note')) entry.note = g('lg-note');
        if (g('lg-amt')) entry.amt = g('lg-amt');
        if (g('lg-sup')) entry.sup = g('lg-sup');
        if (g('lg-food')) entry.food = g('lg-food');
        if (g('lg-min')) entry.mins = +g('lg-min');
        if (g('lg-kcal')) entry.kcal = +g('lg-kcal');
        const kg = parseFloat(g('lg-kg'));
        if (kg) {
            entry.kg = kg;
            const w = (BODY.w || []).filter(x => x.d !== LG.date);
            w.push({ d: LG.date, kg: kg });
            w.sort((a, b) => a.d.localeCompare(b.d));
            await save('_body', { h: BODY.h || 0, w: w.slice(-400) });
        }
        const logs = Object.assign({}, t.logs || {});
        logs[LG.date] = entry;
        await save(t.id, { logs: logs });
        trkCloseSheet('trk-log');
        const K = KIND[t.kind];
        showToast(t.kind === 'bad' ? 'Logged honestly — tomorrow is a clean slate.' : 'Logged · ' + (streak(Object.assign({}, t, { logs: logs })) ) + ' day streak');
        try { if (navigator.vibrate) navigator.vibrate(t.kind === 'bad' ? [20, 60, 20] : 16); } catch (e) {}
    };
    window.trkDelLog = async (k) => {
        const t = TRK.find(x => x.id === logId); if (!t) return;
        const logs = Object.assign({}, t.logs || {});
        delete logs[k];
        await save(t.id, { logs: logs });
        trkCloseSheet('trk-log');
        showToast('Entry removed.');
    };

    /* ============ CREATE / EDIT ============ */
    let ED = {};
    const PRESETS = [
        ['Drink water', 'good', 7, 'glasses'], ['Read', 'good', 5, 'pages'],
        ['Walk 10k steps', 'good', 6, 'steps'], ['Sleep by 11pm', 'good', 7, ''],
        ['Meditate', 'good', 7, 'minutes'], ['Journal', 'good', 5, ''],
        ['No smoking', 'bad', 7, 'cigarettes'], ['No junk food', 'bad', 7, ''],
        ['Less screen time', 'bad', 7, 'hours'], ['No late-night scrolling', 'bad', 7, ''],
        ['Gym', 'gym', 4, ''], ['Home workout', 'gym', 5, ''], ['Running', 'gym', 3, 'km'],
        ['Water the plants', 'pet', 3, ''], ['Feed the dog', 'pet', 7, ''], ['Walk the dog', 'pet', 7, '']
    ];
    window.trkNew = () => { ED = { kind: 'good', color: KIND.good.c, target: 7 }; editSheet(null); };
    window.trkPreset = (i) => {
        const [n, k, t, u] = PRESETS[i];
        ED = { kind: k, color: KIND[k].c, target: t, name: n, unit: u };
        editSheet(null);
    };
    window.trkEdit = (id) => {
        const t = TRK.find(x => x.id === id); if (!t) return;
        ED = { kind: t.kind, color: t.color || KIND[t.kind].c, target: t.target || 7, name: t.name, unit: t.unit || '' };
        editSheet(id);
    };
    function editSheet(id) {
        const COLORS = ['#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#ff5f57', '#22d3ee'];
        $('trk-edit-box').innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span style="font-size:13px;font-weight:900;color:#fff">${id ? 'Edit tracker' : 'New tracker'}</span>
          <button class="trk-x" onclick="trkCloseSheet('trk-edit')">×</button>
        </div>
        ${id ? '' : `<span class="trk-l">Quick start</span>
        <div class="trk-pick" style="max-height:82px;overflow-y:auto">${PRESETS.map((p, i) =>
            `<button class="trk-p" onclick="trkPreset(${i})">${p[0]}</button>`).join('')}</div>`}
        <span class="trk-l">Type</span>
        <div class="trk-pick" id="ed-kind">${Object.keys(KIND).map(k =>
            `<button class="trk-p ${ED.kind === k ? 'on' : ''}" data-v="${k}">
              <span style="display:inline-flex;align-items:center;gap:5px"><svg style="width:12px;height:12px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${KIND[k].i}</svg>${KIND[k].n}</span></button>`).join('')}</div>
        <div id="ed-hint" style="font-size:9.5px;color:#5a6472;margin-top:6px"></div>
        <span class="trk-l">Name</span>
        <input class="trk-i" id="ed-name" placeholder="Morning run · No doom-scrolling · Water the tulsi" value="${escapeHtml(ED.name || '')}">
        <span class="trk-l">Measure (optional)</span>
        <input class="trk-i" id="ed-unit" placeholder="minutes · pages · km · cigarettes" value="${escapeHtml(ED.unit || '')}">
        <span class="trk-l">Weekly target</span>
        <div class="trk-pick" id="ed-tgt">${[1,2,3,4,5,6,7].map(n => `<button class="trk-p ${ED.target === n ? 'on' : ''}" data-v="${n}">${n}×</button>`).join('')}</div>
        <span class="trk-l">Colour</span>
        <div class="trk-pick" id="ed-col">${COLORS.map(c =>
            `<button class="trk-p" data-v="${c}" style="width:30px;height:30px;padding:0;background:${c};border-color:${ED.color === c ? '#fff' : 'transparent'};border-width:2px"></button>`).join('')}</div>
        <button class="trk-cta" onclick="trkSaveTracker('${id || ''}')">${id ? 'Save changes' : 'Create tracker'}</button>
        ${id ? `<button class="trk-ghost" style="color:#ff5f57" onclick="trkDelete('${id}')">Delete this tracker</button>` : ''}`;
        $('trk-edit').classList.add('open');
        const hint = () => {
            $('ed-hint').innerHTML = {
                good: 'Marked on your calendar every day you <b>do</b> it. Streak grows with consistency.',
                bad:  'Inverted — a <b>clean</b> day (no entry) is the win. Logging a slip keeps you honest.',
                gym:  'Logs your session type, intensity, supplements, food, calories and body weight.',
                pet:  'Track feeding, watering, walks and care for a pet or plant.'
            }[ED.kind];
        };
        hint();
        $('ed-kind').querySelectorAll('.trk-p').forEach(b => b.onclick = () => {
            $('ed-kind').querySelectorAll('.trk-p').forEach(x => x.classList.remove('on'));
            b.classList.add('on'); ED.kind = b.dataset.v; ED.color = KIND[ED.kind].c; hint();
            $('ed-col').querySelectorAll('.trk-p').forEach(x => x.style.borderColor = x.dataset.v === ED.color ? '#fff' : 'transparent');
        });
        $('ed-tgt').querySelectorAll('.trk-p').forEach(b => b.onclick = () => {
            $('ed-tgt').querySelectorAll('.trk-p').forEach(x => x.classList.remove('on'));
            b.classList.add('on'); ED.target = +b.dataset.v;
        });
        $('ed-col').querySelectorAll('.trk-p').forEach(b => b.onclick = () => {
            ED.color = b.dataset.v;
            $('ed-col').querySelectorAll('.trk-p').forEach(x => x.style.borderColor = x.dataset.v === ED.color ? '#fff' : 'transparent');
        });
        setTimeout(() => { try { $('ed-name').focus({ preventScroll: true }); zdArmProtect($('ed-name')); } catch (e) {} }, 110);
    }
    window.trkSaveTracker = async (id) => {
        const name = $('ed-name').value.trim();
        if (!name) { showToast('Give it a name first.'); return; }
        const patch = { name: name, kind: ED.kind, color: ED.color, target: ED.target, unit: $('ed-unit').value.trim() };
        if (id) { await save(id, patch); showToast('Tracker updated.'); }
        else {
            patch.logs = {}; patch.order = TRK.length; patch.createdAt = Date.now();
            try { await col().add(patch); showToast('Tracker created — first entry starts the streak.'); }
            catch (e) { showToast('Could not create it.'); return; }
        }
        trkCloseSheet('trk-edit');
    };
    window.trkDelete = async (id) => {
        const t = TRK.find(x => x.id === id); if (!t) return;
        const ok = await zdConfirm('“' + (t.name || 'This tracker') + '” and all its history will be removed.', { title: 'Delete tracker?', okText: 'Delete', danger: true });
        if (!ok) return;
        try { await col().doc(id).delete(); trkCloseSheet('trk-edit'); showToast('Tracker deleted.'); }
        catch (e) { showToast('Could not delete it.'); }
    };

    /* ============ DETAIL + CALENDAR ============ */
    window.trkDetail = (id) => {
        const t = TRK.find(x => x.id === id); if (!t) return;
        logId = id; calM = new Date();
        drawDetail();
        $('trk-detail').classList.add('open');
    };
    window.trkCalNav = (n) => { calM.setMonth(calM.getMonth() + n); drawDetail(); };
    function drawDetail() {
        const t = TRK.find(x => x.id === logId); if (!t) return;
        const K = KIND[t.kind], c = t.color || K.c;
        const y = calM.getFullYear(), m = calM.getMonth();
        const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        const t2 = TODAY();
        let cells = '';
        for (let i = 0; i < first; i++) cells += '<div class="cd void"></div>';
        for (let d = 1; d <= days; d++) {
            const k = key(new Date(y, m, d));
            const hit = !!(t.logs && t.logs[k]);
            const future = k > t2;
            let cls = '';
            if (t.kind === 'bad') cls = hit ? 'bad' : (future ? 'future' : 'clean');
            else cls = hit ? 'hit' : (future ? 'future' : '');
            cells += `<div class="cd ${cls}${k === t2 ? ' today' : ''}" onclick="trkLog('${t.id}','${k}')" title="${k}">${d}</div>`;
        }
        const monthN = monthDone(t, y, m);
        const hist = Object.keys(t.logs || {}).sort().reverse().slice(0, 6);
        $('trk-detail-box').innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="flex items-center gap-2 min-w-0">
            <span class="tc-ico" style="--tc-c:${c};width:28px;height:28px;border-radius:9px"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${K.i}</svg></span>
            <span class="min-w-0"><span class="block truncate" style="font-size:13px;font-weight:900;color:#fff">${escapeHtml(t.name)}</span>
            <span class="tc-s">${K.n} · ${streak(t)} day streak</span></span>
          </span>
          <button class="trk-x" onclick="trkCloseSheet('trk-detail')">×</button>
        </div>
        <div class="flex items-center justify-between mb-2.5" style="padding:6px 2px">
          <button class="trk-p" onclick="trkCalNav(-1)">‹</button>
          <span style="font-size:11.5px;font-weight:900;color:#fff">${calM.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</span>
          <button class="trk-p" onclick="trkCalNav(1)">›</button>
        </div>
        <div class="trk-dow">${['S','M','T','W','T','F','S'].map(d=>'<span>'+d+'</span>').join('')}</div>
        <div class="trk-cal" style="--tc-c:${c}">${cells}</div>
        <div style="font-size:9.5px;color:#5a6472;margin-top:9px;line-height:1.5">
          ${t.kind === 'bad'
            ? '<span style="color:#4ade80">\u25a0</span> clean day &nbsp; <span style="color:#ff5f57">\u25a0</span> slip logged — <b>fewer red squares is the goal</b>'
            : '<span style="color:'+c+'">\u25a0</span> completed &nbsp; <span style="opacity:.4">\u25a0</span> missed — tap any day to log it retroactively'}
          <br>${monthN} ${t.kind==='bad'?'slip':'entr'}${t.kind==='bad'?(monthN===1?'':'s'):(monthN===1?'y':'ies')} this month
        </div>
        ${hist.length ? '<span class="trk-l">Recent entries</span>' + hist.map(k => {
            const e = t.logs[k];
            const bits = [e.klass, e.intensity ? 'intensity ' + e.intensity : '', e.mins ? e.mins + ' min' : '',
                          e.kcal ? e.kcal + ' kcal' : '', e.kg ? e.kg + ' kg' : '', e.amt, e.sup, e.note].filter(Boolean);
            return `<div style="padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.045);margin-bottom:5px">
                <div style="font-size:10px;font-weight:800;color:${t.kind==='bad'?'#ff5f57':c}">${new Date(k+'T12:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}</div>
                <div style="font-size:11px;color:#c3cad6;margin-top:2px;line-height:1.5">${escapeHtml(bits.join(' · ')) || '—'}</div></div>`;
        }).join('') : ''}
        <button class="trk-cta" onclick="trkLog('${t.id}','${t2}')">Log today</button>`;
    }

    /* ============ BODY METRICS ============ */
    window.trkBody = () => {
        const last = BODY.w.length ? BODY.w[BODY.w.length - 1].kg : '';
        $('trk-log-box').innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span style="font-size:13px;font-weight:900;color:#fff;display:flex;align-items:center;gap:7px">
            <svg style="width:15px;height:15px;color:rgb(var(--accent-rgb))" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${I.scale}</svg>Body metrics</span>
          <button class="trk-x" onclick="trkCloseSheet('trk-log')">×</button>
        </div>
        <div style="font-size:10px;color:#7d8695">Used for your BMI gauge. Stored in your account only.</div>
        <span class="trk-l">Height (cm)</span><input class="trk-i" id="bd-h" type="number" inputmode="numeric" placeholder="175" value="${BODY.h || ''}">
        <span class="trk-l">Weight today (kg)</span><input class="trk-i" id="bd-w" type="number" step="0.1" inputmode="decimal" placeholder="72.5" value="${last}">
        <button class="trk-cta" onclick="trkSaveBody()">Save</button>`;
        $('trk-log').classList.add('open');
        setTimeout(() => { try { $('bd-h').focus({ preventScroll: true }); zdArmProtect($('bd-h')); } catch (e) {} }, 110);
    };
    window.trkSaveBody = async () => {
        const h = parseFloat($('bd-h').value), kg = parseFloat($('bd-w').value);
        if (!h || !kg) { showToast('Enter both height and weight.'); return; }
        const w = (BODY.w || []).filter(x => x.d !== TODAY());
        w.push({ d: TODAY(), kg: kg });
        w.sort((a, b) => a.d.localeCompare(b.d));
        await save('_body', { h: h, w: w.slice(-400) });
        trkCloseSheet('trk-log');
        showToast('Body metrics updated.');
    };

    /* ============ TOUR ============ */
    const TSTEPS = [
        ['Welcome to the Grid', 'Every habit, workout and bit of care you track lives here. The Grid keeps score so you don\u2019t have to remember.', I.grid],
        ['Four kinds of tracker', '<b>Good habit</b> — marked each day you do it.<br><b>Break a habit</b> — inverted: a clean day is the win, and red squares are what you\u2019re reducing.<br><b>Workout</b> — session type, intensity, supplements, food, calories and body weight.<br><b>Pet &amp; garden</b> — feeding, watering, walks and care.', I.good],
        ['One tap a day', 'Each card has a big button — that\u2019s the whole ritual. The seven squares show your last week at a glance, and the flame counts your streak.', I.gym],
        ['Your calendar, per tracker', 'Tap the grid icon on any card for a full month view. Missed a day? Tap that square and log it retroactively — nothing is ever locked.', I.cal],
        ['Body &amp; progress', 'Add your height and weight for a live BMI gauge, and watch the year bar fill. It shows exactly how many days you have left to use.', I.scale],
        ['You\u2019re in', 'Press <b>Alt + T</b> from anywhere to jump straight back into the Grid. Now go make the first entry.', I.good]
    ];
    let tstep = 0;
    window.trkTour = () => { tstep = 0; drawTour(); $('trk-tourwrap').classList.add('open'); };
    function drawTour() {
        const [t, b, ic] = TSTEPS[tstep];
        $('trk-tour-box').innerHTML = `
        <div style="width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background-image:var(--zd-grad);color:#fff;margin-bottom:12px">
          <svg style="width:19px;height:19px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${ic}</svg></div>
        <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:6px">${t}</div>
        <div style="font-size:12px;color:#a8b0bd;line-height:1.65">${b}</div>
        <div class="flex items-center justify-between" style="margin-top:18px">
          <span style="display:flex;gap:4px">${TSTEPS.map((_, i) =>
            `<i style="display:block;width:${i===tstep?16:5}px;height:5px;border-radius:99px;${i===tstep?'background-image:var(--zd-grad)':'background:rgba(255,255,255,.18)'};transition:all .3s"></i>`).join('')}</span>
          <span style="display:flex;gap:6px">
            ${tstep ? '<button class="trk-p" onclick="trkTourNav(-1)">Back</button>' : ''}
            <button class="trk-p" onclick="trkTourEnd()">Skip</button>
            <button class="trk-p on" onclick="trkTourNav(1)">${tstep === TSTEPS.length - 1 ? 'Start' : 'Next'}</button>
          </span></div>`;
    }
    window.trkTourNav = (n) => { tstep += n; tstep >= TSTEPS.length ? trkTourEnd() : drawTour(); };
    window.trkTourEnd = () => { $('trk-tourwrap').classList.remove('open'); localStorage.setItem('zdTrkTour', '1'); };

    /* ============ PLUMBING ============ */
    window.trkCloseSheet = (id) => $(id).classList.remove('open');
    ['trk-edit', 'trk-log', 'trk-detail', 'trk-tourwrap'].forEach(id => {
        $(id).addEventListener('click', e => { if (e.target.id === id) $(id).classList.remove('open'); });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            for (const id of ['trk-tourwrap', 'trk-log', 'trk-detail', 'trk-edit']) {
                if ($(id).classList.contains('open')) {
                    e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                    $(id).classList.remove('open'); return;
                }
            }
            if ($('trk-modal').classList.contains('open')) {
                e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                closeTrackers(); return;
            }
        }
        /* ⚙ SHORTCUT: Alt+T */
        if (e.altKey && !e.ctrlKey && !e.metaKey && ((e.key || '').toLowerCase() === 't' || e.code === 'KeyT')) {
            e.preventDefault();
            $('trk-modal').classList.contains('open') ? closeTrackers() : openTrackers();
        }
    }, true);
    /* expose for V8.1 / V8.2 */
    window.zdTrk = { get list() { return TRK; }, get body() { return BODY; }, streak: streak, key: key, KIND: KIND, save: save, render: render };

    try {
        zdMenuInject2('trk', 'openTrackers', 'Trackers · The Grid', I.grid);
        ZD_FEATURES.push({ id: 'trk', label: 'Trackers (habits, gym, pets)', fns: ['openTrackers'] });
        ZD_FEAT_ICONS.trk = I.grid;
    } catch (e) {}
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 700);
})();    

   // New Code

