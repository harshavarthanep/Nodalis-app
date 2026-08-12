// ZenDocs — 05-production-patches-2.js
// V4.4-V4.6 production & polish patches: trash, encrypted vault, web clipper/reference panel, publish-as-webpage, markdown/CSV import, template import/export, mobile focus pill, More-menu reorganisation.
// (part of a mechanical split of the original single-file app; see README)

/* ============================================================
   V4.4 — PRODUCTION PATCH (requires V4.1–V4.3)
   FIX 1: feature switches now HIDE injected menu entries
   FIX 2: Esc layering — confirm/info close before day-detail
   Pomodoro: custom minutes + floating theme pill + end alert
   NEW: Trash (30-day) · Encrypted Vault · Web Clipper ·
        Reference split view · Publish as webpage ·
        MD/CSV importer · Template export/import
============================================================ */

document.head.insertAdjacentHTML('beforeend', `<style>
#pomo-pill { position:fixed; bottom:16px; right:16px; z-index:115; display:none; align-items:center; gap:7px; padding:8px 14px; border-radius:99px; background-image:var(--zd-grad); color:#fff; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; box-shadow:0 8px 24px rgba(0,0,0,.28); cursor:pointer; transition:transform .15s ease; }
#pomo-pill:hover { transform:scale(1.05); } #pomo-pill:active { transform:scale(.94); }
#pomo-pill.show { display:flex; animation:fadeInUp .3s cubic-bezier(0.16,1,0.3,1); }
.zd44-row { display:flex; align-items:center; gap:8px; padding:8px 6px; border-bottom:1px solid var(--border-color); }
.zd44-row:last-child { border-bottom:none; }
.zd44-row:hover { background:rgba(127,127,127,.06); border-radius:10px; }
.zd44-ib { width:26px; height:26px; flex-shrink:0; border-radius:99px; color:#9ca3af; display:flex; align-items:center; justify-content:center; }
.zd44-ib:hover { color:rgb(var(--accent-rgb)); background:rgb(var(--accent-rgb) / 0.1); }
.zd44-ib.danger:hover { color:#d93025; background:rgba(217,48,37,.1); }
#ref-pane { position:fixed; top:0; right:-360px; width:350px; height:100%; z-index:54; background:var(--surface-color); border-left:1px solid var(--border-color); display:flex; flex-direction:column; transition:right .25s ease; box-shadow:-8px 0 24px rgba(0,0,0,.12); }
#ref-pane.open { right:0; }
#ref-body { background:var(--paper-bg); color:var(--paper-text); }
#ref-body.ql-editor { padding:16px 18px !important; min-height:0 !important; height:auto !important; font-family:'Times New Roman',serif; font-size:10.5pt; line-height:1.55; }
#trash-modal, #vault-modal, #clip-modal, #zdimp-modal { z-index:127; }
.zd44-in { width:100%; background:var(--bg-color); border:1px solid var(--border-color); border-radius:12px; padding:8px 12px; font-size:13px; color:var(--text-color); outline:none; caret-color:rgb(var(--accent-rgb)); }
.zd44-in:focus { border-color:rgb(var(--accent-rgb)); }
</style>`);

/* ============================================================
   FIX 1 — feature switches hide injected (JS-created) entries
============================================================ */
const _zd44AFF = applyFeatureFlags;
applyFeatureFlags = function () {
    const off = _zd44AFF();
    const flags = zdFlags();
    document.querySelectorAll('[data-zdfn]').forEach(el =>
        el.classList.toggle('zd-feat-off', flags[el.dataset.zdfn] === false));
    return off;
};
/* retag the V4.3-injected buttons so the wrapper can hide them */
[['Focus timer', 'pomo'], ['Read aloud', 'tts'], ['Backup & restore', 'backup']].forEach(([lab, id]) => {
    document.querySelectorAll('#more-menu button, #mobile-menu-dropdown button').forEach(b => {
        if (b.textContent.trim() === lab) b.dataset.zdfn = id;
    });
});
/* injection helper v2 — every new entry is tagged from birth */
function zdMenuInject2(featId, fnName, label, svgPath) {
    const svg = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' + svgPath + '</svg>';
    const more = document.getElementById('more-menu');
    if (more) {
        const b = document.createElement('button');
        b.className = 'zd-mi'; b.dataset.zdfn = featId;
        b.innerHTML = svg + ' ' + label;
        b.onclick = () => { window[fnName](); toggleMoreMenu(); };
        more.appendChild(b);
    }
    const mob = document.getElementById('mobile-menu-dropdown');
    if (mob) {
        const b = document.createElement('button');
        b.className = 'w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-3';
        b.dataset.zdfn = featId;
        b.innerHTML = '<span class="w-4 text-gray-500">' + svg + '</span> ' + label;
        b.onclick = () => { window[fnName](); toggleMobileMenu(); };
        const divider = mob.querySelector('.border-t');
        if (divider) mob.insertBefore(b, divider); else mob.appendChild(b);
    }
}

/* ============================================================
   FIX 2 — Esc priority at WINDOW capture (runs before every
   document-level handler): confirm → info → glance → V4.4
   modals → then the existing chain (day-detail etc.) proceeds.
============================================================ */
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const stop = () => { e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); };
    const cm = document.getElementById('confirm-modal');
    if (cm && cm.classList.contains('open')) { stop(); document.getElementById('confirm-cancel').click(); return; }
    const im = document.getElementById('info-modal');
    if (im && im.style.display === 'flex') { stop(); closeInfoModal(); return; }
    const gl = document.getElementById('eis-glance-modal');
    if (gl && gl.classList.contains('open')) { stop(); closeEisGlance(); return; }
    for (const [id, fn] of [['vault-modal', 'closeVault'], ['trash-modal', 'closeTrash'], ['clip-modal', 'closeClipper'], ['zdimp-modal', 'closeImporter']]) {
        const m = document.getElementById(id);
        if (m && m.classList.contains('open')) { stop(); window[fn](); return; }
    }
    const rp = document.getElementById('ref-pane');
    if (rp && rp.classList.contains('open')) { stop(); closeRefPanel(); return; }
}, true);

/* ============================================================
   POMODORO v2 — custom minutes, floating pill, reminder-style end
============================================================ */
document.querySelector('#pomo-modal .grid.grid-cols-4').insertAdjacentHTML('afterend', `
<div class="flex gap-1.5 mb-3">
    <input id="pomo-custom" type="number" min="1" max="240" inputmode="numeric" placeholder="Custom minutes…" class="zd44-in" style="padding:6px 12px;font-size:12px">
    <button onclick="pomoCustom()" class="px-4 py-1.5 text-xs font-bold rounded-xl text-white active:scale-95 transition flex-shrink-0" style="background-image:var(--zd-grad)">Set</button>
</div>`);
document.body.insertAdjacentHTML('beforeend', `<button id="pomo-pill" title="Tap to pause & open the timer"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="13" r="8"/><path stroke-linecap="round" d="M12 9v4l2.5 2.5M9 2h6"/></svg><span id="pomo-pill-time">25:00</span></button>`);
window.pomoCustom = () => {
    const v = Math.max(1, Math.min(240, parseInt(document.getElementById('pomo-custom').value, 10) || 0));
    if (!v) { showToast('Enter minutes first (1–240).'); return; }
    pomoStop(true);
    pomo.total = pomo.left = v * 60; pomo.label = 'Focus';
    document.querySelectorAll('#pomo-modal .pomo-preset').forEach(x => x.classList.remove('on'));
    pomoPaint(); showToast(v + '-minute timer ready.');
};
const _zd44Paint = pomoPaint;
pomoPaint = function () {
    _zd44Paint();
    const pill = document.getElementById('pomo-pill');
    const active = pomo.running || (pomo.left > 0 && pomo.left < pomo.total);
    pill.classList.toggle('show', active);
    if (active) {
        const m = Math.floor(pomo.left / 60), s = pomo.left % 60;
        document.getElementById('pomo-pill-time').textContent = (pomo.running ? '' : '⏸ ') + m + ':' + String(s).padStart(2, '0');
    }
};
document.getElementById('pomo-pill').onclick = () => {
    if (pomo.running) { pomoStop(true); pomoPaint(); showToast('Timer paused.'); }
    openPomodoro();
};
/* end-of-timer alert in the reminder-popup style */
const _zd44PomoToggle = window.pomoToggle;
window.pomoToggle = () => {
    const wasDone = pomo.left <= 0;
    _zd44PomoToggle();
    if (!wasDone && !pomo._hooked) {
        pomo._hooked = true;
        const iv = setInterval(() => {
            if (pomo.left === 0 && !pomo.running && !pomo._alerted) {
                pomo._alerted = true;
                const rf = document.getElementById('rf-title');
                if (rf) {
                    rf.textContent = pomo.label + ' session complete — take a breath!';
                    _rfId = null;
                    document.getElementById('rem-fire-modal').classList.add('open');
                }
            }
            if (pomo.left > 0) pomo._alerted = false;
        }, 1000);
        pomo._iv2 = iv;
    }
    pomoPaint();
};

/* ============================================================
   TRASH — 30-day soft delete (notes move to users/{uid}/trash)
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="trash-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-sm flex flex-col" style="max-height:80vh">
  <div class="flex items-center justify-between mb-1 flex-shrink-0">
    <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13"/></svg> Trash</h3>
    <button onclick="closeTrash()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
  </div>
  <p class="text-[10px] text-muted mb-2 flex-shrink-0">Deleted notes stay here for 30 days, then vanish forever.</p>
  <div id="trash-list" class="flex-1 min-h-0 overflow-y-auto zd-scroll pr-1"></div>
</div></div>`);
function trashRef() { return db.collection('users').doc(state.user.uid).collection('trash'); }
/* deleting a note now moves it to trash instead of destroying it */
window.deleteCurrentDoc = async () => {
    if (!state.docId) return;
    const doc = state.docs.find(d => d.id === state.docId);
    const ok = await zdConfirm(`"${doc?.title || 'This note'}" moves to Trash — restorable for 30 days.`, { title: 'Move to trash?', okText: 'Move to trash', danger: true });
    if (!ok) return;
    const del = state.docId;
    try {
        const data = JSON.parse(JSON.stringify({
            title: doc.title || 'Untitled', content: doc.content || '',
            isFavorite: !!doc.isFavorite, folderId: doc.folderId || null,
            comments: doc.comments || {}, kanban: doc.kanban || null,
            eis: doc.eis || null, eisDue: doc.eisDue || null, eisDone: !!doc.eisDone
        }));
        data.trashedAt = Date.now();
        await trashRef().add(data);
        await db.collection('users').doc(state.user.uid).collection('docs').doc(del).delete();
        const rem = state.docs.filter(d => d.id !== del);
        if (rem.length > 0) openDoc(rem[0].id, rem[0]); else createNewDoc();
        showToast('Moved to trash — restorable for 30 days.');
    } catch (e) { console.error(e); showToast('Could not move to trash.'); }
};
window.openTrash = async () => {
    if (state.isGuest) { showToast('Sign in first.'); return; }
    document.getElementById('trash-modal').classList.add('open');
    const list = document.getElementById('trash-list');
    list.innerHTML = '<div class="text-center text-muted text-xs py-6">Loading…</div>';
    try {
        const snap = await trashRef().orderBy('trashedAt', 'desc').get();
        const cutoff = Date.now() - 30 * 864e5;
        const rows = [];
        snap.docs.forEach(ds => {
            const d = ds.data();
            if ((d.trashedAt || 0) < cutoff) { ds.ref.delete().catch(() => {}); return; } /* auto-purge */
            rows.push({ id: ds.id, d: d });
        });
        list.innerHTML = rows.length ? '' : '<div class="text-center text-muted text-xs py-8">Trash is empty.</div>';
        rows.forEach(r => {
            const left = Math.max(0, 30 - Math.floor((Date.now() - r.d.trashedAt) / 864e5));
            const row = document.createElement('div');
            row.className = 'zd44-row';
            row.innerHTML = `
                <span class="flex-1 min-w-0"><span class="block text-xs font-medium text-text truncate">${escapeHtml(r.d.title || 'Untitled')}</span>
                <span class="block text-[9px] text-muted">Deleted ${new Date(r.d.trashedAt).toLocaleDateString()} · ${left} day${left === 1 ? '' : 's'} left</span></span>
                <button class="zd44-ib t-restore" title="Restore"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9"/></svg></button>
                <button class="zd44-ib danger t-kill" title="Delete forever">×</button>`;
            row.querySelector('.t-restore').onclick = async () => {
                try {
                    const clean = Object.assign({}, r.d); delete clean.trashedAt;
                    clean.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    clean.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('users').doc(state.user.uid).collection('docs').add(clean);
                    await trashRef().doc(r.id).delete();
                    row.remove(); showToast('✓ Restored.');
                } catch (e) { showToast('Restore failed.'); }
            };
            row.querySelector('.t-kill').onclick = async () => {
                const ok = await zdConfirm('This cannot be undone.', { title: 'Delete forever?', okText: 'Delete forever', danger: true });
                if (!ok) return;
                try { await trashRef().doc(r.id).delete(); row.remove(); showToast('Deleted forever.'); } catch (e) { showToast('Failed.'); }
            };
            list.appendChild(row);
        });
    } catch (e) { console.error(e); list.innerHTML = '<div class="text-center text-muted text-xs py-6">Could not load trash — check Firestore rules allow users/{uid}/trash.</div>'; }
};
window.closeTrash = () => document.getElementById('trash-modal').classList.remove('open');
document.getElementById('trash-modal').addEventListener('click', (e) => { if (e.target.id === 'trash-modal') closeTrash(); });

/* ============================================================
   VAULT — passcode-encrypted secrets (AES-GCM + PBKDF2, on-device)
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="vault-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-sm flex flex-col" style="max-height:82vh">
  <div class="flex items-center justify-between mb-1 flex-shrink-0">
    <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg> Encrypted vault <span class="text-[9px] font-normal text-muted">AES-256 · zero-knowledge</span></h3>
    <button onclick="closeVault()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
  </div>
  <div id="vault-body" class="flex-1 min-h-0 overflow-y-auto zd-scroll pr-1"></div>
</div></div>`);
const zdB64 = a => btoa(String.fromCharCode.apply(null, a));
const zdU64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
let _vKeyObj = null;
function vaultRef() { return db.collection('users').doc(state.user.uid).collection('vault'); }
async function vDeriveKey(pass, salt) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function vEnc(obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _vKeyObj, new TextEncoder().encode(JSON.stringify(obj)));
    return { iv: zdB64(iv), ct: zdB64(new Uint8Array(ct)) };
}
async function vDec(blob) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: zdU64(blob.iv) }, _vKeyObj, zdU64(blob.ct));
    return JSON.parse(new TextDecoder().decode(pt));
}
window.openVault = () => {
    if (state.isGuest) { showToast('Sign in first.'); return; }
    if (!window.crypto || !crypto.subtle) { showToast('This browser doesn\u2019t support secure encryption.'); return; }
    document.getElementById('vault-modal').classList.add('open');
    _vKeyObj ? vRenderList() : vRenderLock();
};
window.closeVault = () => document.getElementById('vault-modal').classList.remove('open');
window.lockVault = () => { _vKeyObj = null; vRenderLock(); showToast('Vault locked.'); };
function vRenderLock() {
    document.getElementById('vault-body').innerHTML = `
        <div class="text-center py-3"><svg class="w-9 h-9 mx-auto text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4M12 15v3"/></svg>
        <p class="text-[11px] text-muted mb-3 leading-snug">Store passwords, keys &amp; private text encrypted with a passcode that <b>never leaves this device</b>.<br><span class="text-amber-500">If you forget it, nothing can be recovered.</span></p>
        <input id="v-pass" type="password" placeholder="Vault passcode" class="zd44-in mb-2" autocomplete="off">
        <button onclick="vUnlock()" class="w-full py-2.5 text-xs font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">Unlock / Create vault</button></div>`;
    setTimeout(() => { try { document.getElementById('v-pass').focus(); } catch (e) {} }, 100);
    document.getElementById('v-pass').addEventListener('keydown', e => { if (e.key === 'Enter') vUnlock(); });
}
window.vUnlock = async () => {
    const pass = document.getElementById('v-pass').value;
    if (!pass || pass.length < 4) { showToast('Passcode needs at least 4 characters.'); return; }
    try {
        const metaSnap = await vaultRef().doc('_meta').get();
        if (metaSnap.exists) {
            const m = metaSnap.data();
            _vKeyObj = await vDeriveKey(pass, zdU64(m.salt));
            try { await vDec(m.check); } catch (e) { _vKeyObj = null; showToast('Wrong passcode.'); return; }
        } else {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            _vKeyObj = await vDeriveKey(pass, salt);
            await vaultRef().doc('_meta').set({ salt: zdB64(salt), check: await vEnc({ ok: 'zd' }) });
            showToast('Vault created — remember your passcode!');
        }
        vRenderList();
    } catch (e) { console.error(e); showToast('Vault error — check connection & Firestore rules.'); }
};
async function vRenderList() {
    const body = document.getElementById('vault-body');
    body.innerHTML = '<div class="text-center text-muted text-xs py-6">Decrypting…</div>';
    try {
        const snap = await vaultRef().orderBy('createdAt', 'desc').get();
        let html = `<div class="flex gap-1.5 mb-3">
            <button onclick="vAddForm()" class="flex-1 py-2 text-xs font-bold rounded-xl text-white active:scale-95 transition" style="background-image:var(--zd-grad)">+ New secret</button>
            <button onclick="lockVault()" class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-95">Lock</button></div><div id="v-list"></div>`;
        body.innerHTML = html;
        const list = document.getElementById('v-list');
        let n = 0;
        for (const ds of snap.docs) {
            if (ds.id === '_meta') continue;
            let item; try { item = await vDec(ds.data().blob); } catch (e) { continue; }
            n++;
            const row = document.createElement('div');
            row.className = 'zd44-row';
            row.innerHTML = `<svg class="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg>
                <button class="v-view flex-1 min-w-0 text-left text-xs font-medium text-text truncate">${escapeHtml(item.t || 'Untitled secret')}</button>
                <button class="zd44-ib danger v-del" title="Delete">×</button>`;
            row.querySelector('.v-view').onclick = () => {
                body.innerHTML = `<button onclick="vRenderList()" class="text-xs text-accent mb-2">← Back</button>
                    <div class="text-sm font-bold text-text mb-2">${escapeHtml(item.t || 'Untitled')}</div>
                    <div class="text-xs text-text whitespace-pre-wrap break-words bg-bg border border-border rounded-xl p-3 mb-2">${escapeHtml(item.x || '')}</div>
                    <button onclick="navigator.clipboard.writeText(${JSON.stringify(JSON.stringify(item.x || ''))} && ''); navigator.clipboard.writeText(${JSON.stringify(item.x || '')}).then(()=>showToast('Copied.'))" class="w-full py-2 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-95">Copy to clipboard</button>`;
            };
            row.querySelector('.v-del').onclick = async () => {
                const ok = await zdConfirm('This secret will be deleted permanently.', { title: 'Delete secret?', okText: 'Delete', danger: true });
                if (!ok) return;
                await ds.ref.delete(); row.remove(); showToast('Deleted.');
            };
            list.appendChild(row);
        }
        if (!n) list.innerHTML = '<div class="text-center text-muted text-[10px] py-6">No secrets yet — add your first.</div>';
    } catch (e) { console.error(e); body.innerHTML = '<div class="text-center text-muted text-xs py-6">Could not load vault.</div>'; }
}
window.vAddForm = () => {
    document.getElementById('vault-body').innerHTML = `
        <button onclick="vRenderList()" class="text-xs text-accent mb-2">← Back</button>
        <input id="v-t" type="text" placeholder="Label (e.g. Bank PIN)" class="zd44-in mb-2" autocomplete="off">
        <textarea id="v-x" rows="5" placeholder="Secret content…" class="zd44-in mb-2" style="resize:vertical"></textarea>
        <button onclick="vSave()" class="w-full py-2.5 text-xs font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">Encrypt &amp; save</button>`;
    setTimeout(() => { try { document.getElementById('v-t').focus(); } catch (e) {} }, 80);
};
window.vSave = async () => {
    const t = document.getElementById('v-t').value.trim();
    const x = document.getElementById('v-x').value;
    if (!t && !x.trim()) { showToast('Write something first.'); return; }
    try {
        await vaultRef().add({ blob: await vEnc({ t: t || 'Untitled secret', x: x }), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        showToast('🔒 Encrypted & saved.'); vRenderList();
    } catch (e) { showToast('Save failed.'); }
};
document.getElementById('vault-modal').addEventListener('click', (e) => { if (e.target.id === 'vault-modal') closeVault(); });

/* ============================================================
   WEB CLIPPER — bookmarklet that saves any page into a note
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="clip-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-sm">
  <div class="flex items-center justify-between mb-2">
    <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656L5.586 10.758a6 6 0 108.486 8.486L20.5 12.5"/></svg> Web clipper</h3>
    <button onclick="closeClipper()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
  </div>
  <p class="text-[11px] text-muted leading-snug mb-3">Drag the button below to your <b>bookmarks bar</b>. On any webpage, select text (optional) and click it — the page title, link and selection land in a new ZenDocs note.</p>
  <a id="clip-marklet" class="block text-center w-full py-2.5 text-xs font-bold rounded-xl text-white mb-2 cursor-move" style="background-image:var(--zd-grad)" onclick="showToast('Drag me to your bookmarks bar — don\u2019t click.'); return false;">📎 Clip to ZenDocs</a>
  <button onclick="copyClipMarklet()" class="w-full py-2 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-95">Copy bookmarklet code (for mobile / manual add)</button>
</div></div>`);
function zdClipCode() {
    const app = location.origin + location.pathname;
    return "javascript:(function(){location.href='" + app + "?clip=1&ct='+encodeURIComponent(document.title.slice(0,120))+'&cu='+encodeURIComponent(location.href)+'&cs='+encodeURIComponent((window.getSelection?String(getSelection()):'').slice(0,1500));})()";
}
window.openClipper = () => { document.getElementById('clip-marklet').href = zdClipCode(); document.getElementById('clip-modal').classList.add('open'); };
window.closeClipper = () => document.getElementById('clip-modal').classList.remove('open');
window.copyClipMarklet = async () => { try { await navigator.clipboard.writeText(zdClipCode()); showToast('Bookmarklet copied — paste as a bookmark URL.'); } catch (e) { showToast('Copy failed.'); } };
document.getElementById('clip-modal').addEventListener('click', (e) => { if (e.target.id === 'clip-modal') closeClipper(); });
/* handle incoming ?clip=1 once the user & docs are ready */
(function () {
    const p = new URLSearchParams(location.search);
    if (p.get('clip') !== '1') return;
    const ct = p.get('ct') || 'Clipped page', cu = p.get('cu') || '', cs = p.get('cs') || '';
    const iv = setInterval(async () => {
        if (!state.user || state.firstLoad) return;
        clearInterval(iv);
        try {
            const ops = [{ insert: ct }, { insert: '\n', attributes: { header: 2 } }, { insert: '#clipped\n\n' }];
            if (cs) ops.push({ insert: cs }, { insert: '\n', attributes: { blockquote: true } }, { insert: '\n' });
            if (cu) ops.push({ insert: 'Source: ' }, { insert: cu, attributes: { link: cu } }, { insert: '\n' });
            const ref = await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: ct.slice(0, 120), content: { ops }, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            history.replaceState({}, document.title, location.pathname);
            openDoc(ref.id, { title: ct.slice(0, 120), content: { ops }, comments: {}, marginL: 96, marginR: 96 });
            showToast('📎 Page clipped into a new note.');
        } catch (e) { console.error(e); showToast('Clip failed.'); }
    }, 500);
})();

/* ============================================================
   REFERENCE PANEL — read-only second note beside the editor
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="ref-pane">
  <div class="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
    <span class="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/></svg> Reference <span id="ref-title" class="normal-case font-medium text-text truncate max-w-[130px]"></span></span>
    <span class="flex items-center gap-0.5">
      <button onclick="refPick()" title="Choose note" class="zd44-ib"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>
      <button onclick="closeRefPanel()" class="text-muted hover:text-danger text-lg leading-none active:scale-90 w-6">×</button>
    </span>
  </div>
  <div class="flex-1 min-h-0 overflow-y-auto zd-scroll"><div id="ref-body" class="ql-editor"></div></div>
</div>`);
let _refId = null;
window.openRefPanel = () => {
    if (state.isGuest || !state.docs.length) { showToast('Sign in and create a note first.'); return; }
    document.getElementById('ref-pane').classList.add('open');
    if (!_refId) refPick(); else refRender();
};
window.closeRefPanel = () => document.getElementById('ref-pane').classList.remove('open');
window.refPick = () => openNotePicker(d => { _refId = d.id; refRender(); }, 'Show beside the editor');
function refRender() {
    const d = state.docs.find(x => x.id === _refId);
    if (!d) { document.getElementById('ref-body').innerHTML = '<p style="opacity:.6">Note unavailable.</p>'; return; }
    document.getElementById('ref-title').textContent = '· ' + (d.title || 'Untitled');
    document.getElementById('ref-body').innerHTML = eisRenderHtml(d);
}
const _zd44Refresh = refreshOpenViews;
refreshOpenViews = function () {
    _zd44Refresh();
    if (document.getElementById('ref-pane').classList.contains('open') && _refId) refRender();
};

/* ============================================================
   PUBLISH AS WEBPAGE — standalone .html of the open note
============================================================ */
window.publishWebpage = () => {
    if (!state.docId) { showToast('Open a note first.'); return; }
    const title = els.title.value || 'Note';
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
body{margin:0;background:#f4efe6;font-family:Georgia,'Times New Roman',serif;color:#1f2937;}
.page{max-width:720px;margin:0 auto;padding:48px 28px;background:#fdfaf3;min-height:100vh;box-shadow:0 0 40px rgba(0,0,0,.08);line-height:1.65;font-size:17px;}
h1.zd-t{font-size:30px;margin:0 0 6px;}.zd-m{font-size:12px;color:#8a8069;margin-bottom:28px;}
img{max-width:100%;border-radius:8px;}a{color:#1a73e8;}blockquote{border-left:3px solid #1a73e8;margin-left:0;padding-left:16px;font-style:italic;color:#555;}
pre{background:#1e1e1e;color:#eee;padding:14px;border-radius:8px;overflow-x:auto;font-size:13px;}
.ql-hashtag{color:#1a73e8;background:rgba(26,115,232,.1);border-radius:10px;padding:0 5px;}.ql-wikilink{color:#7c3aed;border-bottom:1px dashed #7c3aed;}
ul[data-checked] li::before{content:'☐ ';}ul[data-checked=true] li::before{content:'☑ ';}
.zd-f{text-align:center;font-size:11px;color:#a39a83;padding:20px 0;}
.ql-align-center{text-align:center}.ql-align-right{text-align:right}.ql-align-justify{text-align:justify}
</style></head><body><div class="page"><h1 class="zd-t">${escapeHtml(title)}</h1><div class="zd-m">Published ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} · via ZenDocs</div>${quill.root.innerHTML}</div><div class="zd-f">Made with ZenDocs</div></body></html>`;
    downloadBlob(new Blob([html], { type: 'text/html' }), title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.html');
    showToast('Webpage downloaded — upload it anywhere (GitHub Pages, Netlify…).');
};

/* ============================================================
   IMPORTER — Markdown (.md/.txt, incl. Obsidian/Notion exports)
   and CSV files → notes
============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div id="zdimp-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-xs">
  <div class="flex items-center justify-between mb-2">
    <h3 class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 16V4m0 0l-4 4m4-4l4 4"/></svg> Import notes</h3>
    <button onclick="closeImporter()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
  </div>
  <button onclick="zdImportFiles('.md,.txt,.markdown')" class="w-full py-2.5 mb-1.5 text-xs font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">Markdown files (.md) — Obsidian / Notion</button>
  <button onclick="zdImportFiles('.csv')" class="w-full py-2.5 text-xs font-semibold rounded-xl bg-bg border border-border text-text hover:border-accent transition active:scale-[.98]">CSV — one note per row</button>
  <p class="text-[9px] text-muted mt-2 leading-snug">Select multiple files at once. Headings, lists, tasks, quotes, #tags and [[links]] are preserved from Markdown. For Notion, unzip its export first.</p>
</div></div>`);
window.openImporter = () => { if (state.isGuest) { showToast('Sign in first.'); return; } document.getElementById('zdimp-modal').classList.add('open'); };
window.closeImporter = () => document.getElementById('zdimp-modal').classList.remove('open');
function zdMdToOps(md) {
    const ops = []; let inCode = false;
    String(md).replace(/\r/g, '').split('\n').forEach(line => {
        if (/^```/.test(line)) { inCode = !inCode; return; }
        if (inCode) { ops.push({ insert: line }, { insert: '\n', attributes: { 'code-block': true } }); return; }
        let attrs = null, body = line;
        const h = line.match(/^(#{1,6})\s+(.*)/);
        if (h) { attrs = { header: Math.min(3, h[1].length) }; body = h[2]; }
        else if (/^-\s*\[x\]\s*/i.test(line)) { attrs = { list: 'checked' }; body = line.replace(/^-\s*\[x\]\s*/i, ''); }
        else if (/^-\s*\[\s?\]\s*/.test(line)) { attrs = { list: 'unchecked' }; body = line.replace(/^-\s*\[\s?\]\s*/, ''); }
        else if (/^\d+\.\s+/.test(line)) { attrs = { list: 'ordered' }; body = line.replace(/^\d+\.\s+/, ''); }
        else if (/^[-*+]\s+/.test(line)) { attrs = { list: 'bullet' }; body = line.replace(/^[-*+]\s+/, ''); }
        else if (/^>\s?/.test(line)) { attrs = { blockquote: true }; body = line.replace(/^>\s?/, ''); }
        body = body.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S[^*]*)\*/g, '$1$2');
        if (body) ops.push({ insert: body });
        ops.push(attrs ? { insert: '\n', attributes: attrs } : { insert: '\n' });
    });
    return ops.length ? ops : [{ insert: '\n' }];
}
function zdCsvRows(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
        else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; }
        else cell += c;
    }
    row.push(cell); if (row.some(x => x.trim())) rows.push(row);
    return rows;
}
window.zdImportFiles = (accept) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = true;
    inp.onchange = async () => {
        const files = Array.from(inp.files || []); if (!files.length) return;
        closeImporter();
        let made = 0;
        showToast('Importing…', 8000);
        try {
            const col = db.collection('users').doc(state.user.uid).collection('docs');
            for (const f of files) {
                const text = await f.text();
                if (/\.csv$/i.test(f.name)) {
                    const rows = zdCsvRows(text);
                    const head = rows.length > 1 ? rows[0] : null;
                    (head ? rows.slice(1) : rows).slice(0, 400).forEach(async r => {
                        const title = (r[0] || 'Imported row').slice(0, 120);
                        const body = r.slice(1).map((v, i) => (head && head[i + 1] ? head[i + 1] + ': ' : '') + v).join('\n');
                        await col.add({ title, content: { ops: [{ insert: (body || title) + '\n' }] }, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                        made++;
                    });
                    made += Math.max(0, (head ? rows.length - 1 : rows.length));
                } else {
                    const title = f.name.replace(/\.(md|txt|markdown)$/i, '').slice(0, 120) || 'Imported note';
                    await col.add({ title, content: { ops: zdMdToOps(text) }, isFavorite: false, folderId: null, comments: {}, marginL: 96, marginR: 96, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    made++;
                }
            }
            showToast('✓ Imported ' + made + ' note' + (made === 1 ? '' : 's') + '.');
        } catch (e) { console.error(e); showToast('Import stopped partway — imported notes are kept.'); }
    };
    inp.click();
};
document.getElementById('zdimp-modal').addEventListener('click', (e) => { if (e.target.id === 'zdimp-modal') closeImporter(); });

/* ============================================================
   TEMPLATE SHARING — export/import your templates as a file
============================================================ */
const _zd44OpenTpl = window.openTemplates;
window.openTemplates = function () {
    _zd44OpenTpl();
    const head = document.querySelector('#templates-modal .zd-view-head .flex.items-center.gap-1\\.5');
    if (head && !head.querySelector('[data-tplshare]')) {
        const ex = document.createElement('button');
        ex.dataset.tplshare = '1';
        ex.className = 'px-2.5 py-1 rounded-full text-[10px] font-semibold bg-bg border border-border text-text hover:border-accent transition active:scale-95';
        ex.textContent = 'Share ⬇';
        ex.title = 'Export your templates as a file to share';
        ex.onclick = async () => {
            try {
                const snap = await db.collection('users').doc(state.user.uid).collection('templates').get();
                const t = snap.docs.map(d => ({ name: d.data().name, content: d.data().content }));
                if (!t.length) { showToast('No templates to share yet.'); return; }
                downloadBlob(new Blob([JSON.stringify({ app: 'ZenDocs', templates: t })], { type: 'application/json' }), 'zendocs-templates.json');
                showToast('Template file downloaded — send it to anyone.');
            } catch (e) { showToast('Export failed.'); }
        };
        const im = document.createElement('button');
        im.dataset.tplshare = '1';
        im.className = ex.className;
        im.textContent = 'Import ⬆';
        im.title = 'Import a shared template file';
        im.onclick = () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = '.json';
            inp.onchange = async () => {
                try {
                    const data = JSON.parse(await inp.files[0].text());
                    if (!data || !Array.isArray(data.templates)) { showToast('Not a valid template file.'); return; }
                    for (const t of data.templates) {
                        await db.collection('users').doc(state.user.uid).collection('templates').add({ name: String(t.name || 'Shared template').slice(0, 100), content: t.content || { ops: [] }, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    }
                    loadUserTemplates();
                    showToast('✓ Imported ' + data.templates.length + ' template(s).');
                } catch (e) { showToast('Import failed.'); }
            };
            inp.click();
        };
        head.insertBefore(im, head.firstChild);
        head.insertBefore(ex, head.firstChild);
    }
};

/* ---------- register menus + feature switches, then re-apply ---------- */
zdMenuInject2('trash', 'openTrash', 'Trash', '<path stroke-linecap="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13"/>');
zdMenuInject2('vault', 'openVault', 'Encrypted vault', '<rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/>');
zdMenuInject2('ref', 'openRefPanel', 'Reference panel', '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/>');
zdMenuInject2('publish', 'publishWebpage', 'Publish as webpage', '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18"/>');
zdMenuInject2('clip', 'openClipper', 'Web clipper', '<path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656L5.586 10.758a6 6 0 108.486 8.486L20.5 12.5"/>');
zdMenuInject2('import', 'openImporter', 'Import notes (md/csv)', '<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 16V4m0 0l-4 4m4-4l4 4"/>');
try {
    ZD_FEATURES.push(
        { id: 'trash', label: 'Trash (30-day recycle bin)', fns: ['openTrash'] },
        { id: 'vault', label: 'Encrypted vault', fns: ['openVault'] },
        { id: 'ref', label: 'Reference panel (split view)', fns: ['openRefPanel'] },
        { id: 'publish', label: 'Publish as webpage', fns: ['publishWebpage'] },
        { id: 'clip', label: 'Web clipper', fns: ['openClipper'] },
        { id: 'import', label: 'Importer (md/csv)', fns: ['openImporter'] }
    );
} catch (e) {}
setTimeout(applyFeatureFlags, 600);        

    // New code

    /* ============================================================
   V4.5 — UI POLISH PATCH (requires V4.1–V4.4)
   A) Mobile: focus pill sits above the bottom toolbar + keyboard
   B) Desktop: "More tools" menu grouped into sections, capped
      height with a slim scroll, wider + cleaner
============================================================ */

/* ---------- A) FOCUS PILL vs BOTTOM TOOLBAR ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
/* Mobile: lift the pill clear of the bottom-docked toolbar (and the
   keyboard, via the same --keyboard-offset the toolbar uses). */
@media (max-width: 850px) {
    #pomo-pill { bottom: calc(84px + env(safe-area-inset-bottom, 0px)); right: 12px; padding: 7px 12px; font-size: 11px; }
    body.toolbar-bottom #pomo-pill { bottom: calc(84px + var(--keyboard-offset, 0px) + env(safe-area-inset-bottom, 0px)); }
    /* keep it below open sheets/menus but above the editor + toolbar */
    #pomo-pill { z-index: 49; }
}

/* ---------- B) MORE-TOOLS MENU RESTRUCTURE (desktop) ---------- */
#more-menu { width: 240px !important; padding: 0 !important; overflow: hidden; }
#more-menu-scroll { max-height: min(62vh, 480px); overflow-y: auto; overscroll-behavior: contain; padding: 6px 0; scrollbar-width: thin; scrollbar-color: rgba(140,140,150,0.45) transparent; }
#more-menu-scroll::-webkit-scrollbar { width: 5px; }
#more-menu-scroll::-webkit-scrollbar-thumb { background: rgba(140,140,150,0.45); border-radius: 99px; }
#more-menu-scroll::-webkit-scrollbar-track { background: transparent; }
.zd-mgroup { padding: 7px 14px 3px; font-size: 8.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: #9ca3af; user-select: none; display: flex; align-items: center; gap: 6px; }
.zd-mgroup::after { content: ''; flex: 1; height: 1px; background: var(--border-color); opacity: .7; }
.zd-mgroup:first-child { padding-top: 4px; }
#more-menu .zd-mi { padding: 7px 14px; font-size: 12.5px; }
#more-menu .zd-mi svg { flex-shrink: 0; opacity: .75; }
#more-menu .zd-mi:hover svg { opacity: 1; color: rgb(var(--accent-rgb)); }
/* zoom row: the two zoom actions share one compact line */
.zd-mzoom { display: flex; align-items: center; justify-content: space-between; padding: 7px 14px; }
.zd-mzoom > span { font-size: 12.5px; color: var(--text-color); display: flex; align-items: center; gap: 10px; }
.zd-mzoom > span svg { opacity: .75; }
.zd-mzoom .zd-mzbtns { display: flex; gap: 4px; }
.zd-mzoom .zd-mzb { width: 26px; height: 24px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); font-size: 12px; font-weight: 700; line-height: 1; transition: border-color .15s ease; }
.zd-mzoom .zd-mzb:hover { border-color: rgb(var(--accent-rgb)); color: rgb(var(--accent-rgb)); }
.zd-mzoom .zd-mzb:active { transform: scale(.9); }
</style>`);

/* ---------- B) reorganize the #more-menu DOM once at load ----------
   Buttons are MOVED (not recreated), so every existing onclick,
   data-zdfn feature tag, and future applyFeatureFlags() call keeps
   working exactly as before. Unmatched/unknown buttons (from any
   future patch) automatically land in "More". */
(function zdRestructureMoreMenu() {
    const menu = document.getElementById('more-menu');
    if (!menu || document.getElementById('more-menu-scroll')) return;

    /* label → group mapping (labels as rendered by V3.8–V4.4) */
    const GROUPS = [
        { name: 'Note tools', labels: ['Local AI summary', 'Study mode', 'Read aloud', 'Reference panel'] },
        { name: 'History & safety', labels: ['Version history', 'Time machine', 'Trash', 'Encrypted vault', 'Backup & restore'] },
        { name: 'Organize & time', labels: ['Deep Think map', 'Remind me…', 'Remind me\u2026', 'Focus timer'] },
        { name: 'Share & import', labels: ['Publish as webpage', 'Web clipper', 'Import notes (md/csv)'] }
    ];

    /* collect current items; pull the two zoom buttons aside */
    const items = Array.from(menu.children).filter(el => el.tagName === 'BUTTON');
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    let zoomIn = null, zoomOut = null;
    const pool = [];
    items.forEach(b => {
        const t = norm(b.textContent);
        if (t === 'Zoom in') { zoomIn = b; return; }
        if (t === 'Zoom out') { zoomOut = b; return; }
        pool.push(b);
    });

    /* rebuild inside a scroll container */
    menu.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.id = 'more-menu-scroll';
    menu.appendChild(scroll);

    const used = new Set();
    const addGroup = (name, btns) => {
        if (!btns.length) return;
        const h = document.createElement('div');
        h.className = 'zd-mgroup';
        h.textContent = name;
        scroll.appendChild(h);
        btns.forEach(b => scroll.appendChild(b));
    };

    /* VIEW group is built first: a compact zoom row */
    if (zoomIn && zoomOut) {
        const h = document.createElement('div');
        h.className = 'zd-mgroup';
        h.textContent = 'View';
        scroll.appendChild(h);
        const row = document.createElement('div');
        row.className = 'zd-mzoom';
        row.innerHTML = `<span><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/></svg> Editor zoom</span>
            <span class="zd-mzbtns">
                <button class="zd-mzb" title="Zoom out">−</button>
                <button class="zd-mzb" title="Reset zoom">1×</button>
                <button class="zd-mzb" title="Zoom in">+</button>
            </span>`;
        const [bOut, bReset, bIn] = row.querySelectorAll('.zd-mzb');
        bOut.onclick = (e) => { e.stopPropagation(); zoomEditor(-1); };
        bReset.onclick = (e) => { e.stopPropagation(); zoomEditor(0); };
        bIn.onclick = (e) => { e.stopPropagation(); zoomEditor(1); };
        scroll.appendChild(row);
    }

    /* named groups */
    GROUPS.forEach(g => {
        const btns = [];
        g.labels.forEach(lab => {
            pool.forEach(b => {
                if (!used.has(b) && norm(b.textContent) === norm(lab)) { used.add(b); btns.push(b); }
            });
        });
        addGroup(g.name, btns);
    });

    /* anything unmatched (future patches) falls into "More" */
    addGroup('More', pool.filter(b => !used.has(b)));
})();    

    // New Code
    /* ============================================================
   V4.6 — FIX & POLISH PATCH (requires V4.1–V4.5)
   1 Canvas auto-centres on open        9 Ctrl+K → search only
   2 Mobile ⋯ menu grouped            10 Unlinked mentions fixed
   3 Empty group separators hidden     11 One-tap mobile checkboxes
   4 Icons in feature switches         12 Locked notes (replaces vault)
   5 Web clipper removed               13 Sidebar stays open on filters
   6 Publish footer links to ZenDocs   14 Stray clicks no longer focus
   7 Vector PDF (Word-identical)          the editor / open the keyboard
   8 Help guide updated + Alt+R        15 Modal inputs keep the caret
============================================================ */

document.head.insertAdjacentHTML('beforeend', `<style>
/* 11 — native-feeling checkbox taps */
.ql-editor li[data-list="checked"], .ql-editor li[data-list="unchecked"] { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.ql-editor li[data-list="checked"]::before, .ql-editor li[data-list="unchecked"]::before { cursor: pointer; font-size: 1.15em; }
/* 4 — feature switch rows with icons */
.zd-frow { display:flex; align-items:center; gap:10px; padding:8px 2px; border-bottom:1px solid var(--border-color); }
.zd-frow:last-child { border-bottom:none; }
.zd-fico { width:26px; height:26px; flex-shrink:0; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgb(var(--accent-rgb) / 0.10); color:rgb(var(--accent-rgb)); }
.zd-fico svg { width:14px; height:14px; }
.zd-frow.off .zd-fico { background:rgba(127,127,127,.12); color:#9ca3af; }
/* 2 — mobile menu groups */
#mobile-menu-dropdown .zd-mgroup { padding:8px 16px 3px; font-size:8.5px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; color:#9ca3af; display:flex; align-items:center; gap:6px; }
#mobile-menu-dropdown .zd-mgroup::after { content:''; flex:1; height:1px; background:var(--border-color); opacity:.7; }
#lock-modal { z-index:128; }
</style>`);

/* ============================================================
   1 — CANVAS AUTO-CENTRE ON OPEN
============================================================ */
const _zd46OpenCanvas = window.openCanvas;
window.openCanvas = async function () {
    await _zd46OpenCanvas();
    /* fit after the stage has real dimensions (mobile needs 2 frames) */
    requestAnimationFrame(() => requestAnimationFrame(() => {
        try { if (Object.keys(cv.items).length) canvasFit(); else { cv.scale = 1; cv.pan = { x: 0, y: 0 }; applyStageTransform(); } } catch (e) {}
    }));
    setTimeout(() => { try { if (Object.keys(cv.items).length) canvasFit(); } catch (e) {} }, 260);
};

/* ============================================================
   5 — REMOVE WEB CLIPPER
============================================================ */
(function () {
    document.querySelectorAll('[data-zdfn="clip"]').forEach(el => el.remove());
    const m = document.getElementById('clip-modal'); if (m) m.remove();
    try { const i = ZD_FEATURES.findIndex(f => f.id === 'clip'); if (i >= 0) ZD_FEATURES.splice(i, 1); } catch (e) {}
})();

/* ============================================================
   2 — MOBILE ⋯ MENU: GROUPED (nodes are MOVED, handlers intact)
============================================================ */
(function zd46MobileMenu() {
    const menu = document.getElementById('mobile-menu-dropdown');
    if (!menu || menu.dataset.zd46) return;
    menu.dataset.zd46 = '1';
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const btns = Array.from(menu.querySelectorAll('button'));
    const GROUPS = [
        ['Essentials', ['Share link', 'Download', 'Duplicate', 'File info', 'Search notes', 'Notes & comments']],
        ['Views', ['Graph view', 'Daily note', 'Calendar', 'Kanban board', 'Canvas', 'Templates', 'Eisenhower matrix']],
        ['Reading & focus', ['Reading mode', 'Zen mode', 'Focus timer', 'Read aloud', 'Reference panel', 'Zoom in', 'Zoom out']],
        ['Note tools', ['Local AI summary', 'Study mode', 'Version history', 'Remind me…', 'Remind me\u2026', 'Publish as webpage', 'Lock this note']],
        ['Data & safety', ['Trash', 'Backup & restore', 'Import notes (md/csv)']],
        ['App', ['Light / dark', 'Features', 'Go offline']]
    ];
    const del = btns.find(b => norm(b.textContent) === 'Delete');
    menu.innerHTML = '';
    const used = new Set(); if (del) used.add(del);
    GROUPS.forEach(([name, labels]) => {
        const picked = [];
        labels.forEach(l => btns.forEach(b => { if (!used.has(b) && norm(b.textContent) === norm(l)) { used.add(b); picked.push(b); } }));
        if (!picked.length) return;
        const h = document.createElement('div'); h.className = 'zd-mgroup'; h.textContent = name;
        menu.appendChild(h); picked.forEach(b => menu.appendChild(b));
    });
    const rest = btns.filter(b => !used.has(b));
    if (rest.length) {
        const h = document.createElement('div'); h.className = 'zd-mgroup'; h.textContent = 'More';
        menu.appendChild(h); rest.forEach(b => menu.appendChild(b));
    }
    if (del) {
        const d = document.createElement('div');
        d.className = 'border-t border-gray-100 dark:border-gray-700 my-1';
        menu.appendChild(d); menu.appendChild(del);
    }
})();

/* ============================================================
   3 — HIDE GROUP HEADERS WHOSE ITEMS ARE ALL SWITCHED OFF
============================================================ */
function zd46TidyGroups() {
    ['more-menu-scroll', 'mobile-menu-dropdown'].forEach(id => {
        const wrap = document.getElementById(id); if (!wrap) return;
        const kids = Array.from(wrap.children);
        kids.forEach((el, i) => {
            if (!el.classList.contains('zd-mgroup')) return;
            let any = false;
            for (let j = i + 1; j < kids.length; j++) {
                if (kids[j].classList.contains('zd-mgroup')) break;
                if (kids[j].classList.contains('border-t')) continue;
                if (!kids[j].classList.contains('zd-feat-off')) { any = true; break; }
            }
            el.classList.toggle('zd-feat-off', !any);
        });
    });
}
const _zd46AFF = applyFeatureFlags;
applyFeatureFlags = function () { const r = _zd46AFF(); zd46TidyGroups(); return r; };

/* ============================================================
   4 — FEATURE SWITCHES WITH ICONS
============================================================ */
var ZD_FEAT_ICONS = {
    home: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-8 9 8M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/>',
    daily: '<circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M8 3v4m8-4v4M3 10h18"/>',
    board: '<rect x="3.5" y="4" width="4.6" height="16" rx="1"/><rect x="9.8" y="4" width="4.6" height="10" rx="1"/><rect x="16" y="4" width="4.6" height="13" rx="1"/>',
    canvas: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="6.5" width="7" height="7" rx="1.5"/><rect x="8" y="14" width="7" height="7" rx="1.5"/>',
    templates: '<rect x="4" y="7" width="10" height="14" rx="2"/><path stroke-linecap="round" d="M9 7V5a2 2 0 012-2h5.6L20 6.4V15a2 2 0 01-2 2h-2M7 12h4m-4 3.5h4"/>',
    graph: '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="8" r="2.4"/><circle cx="9" cy="18" r="2.4"/><path stroke-linecap="round" d="M8.2 6.7l7.4 1M6.9 8.2l1.6 7.4M16.3 9.9l-5.6 6.3"/>',
    ai: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 3l1 2.5L8.5 6.5 6 7.5 5 10 4 7.5 1.5 6.5 4 5.5 5 3zm14 4l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2 1.2-3zM10 12l1.5 3.7 3.7 1.5-3.7 1.5L10 22.5l-1.5-3.8-3.7-1.5 3.7-1.5L10 12z"/>',
    study: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-6.16-3.42L12 20l6.16-3.42"/>',
    tm: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    dt: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M8 8h8v8H8V8z"/>',
    folds: '<path stroke-linecap="round" d="M6 9l6 6 6-6M4 4h16"/>',
    rem: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>',
    eis: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    pomo: '<circle cx="12" cy="13" r="8"/><path stroke-linecap="round" d="M12 9v4l2.5 2.5M9 2h6"/>',
    tts: '<path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>',
    backup: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-6L9.6 4.6A2 2 0 008.2 4H6a2 2 0 00-2 2v1z"/>',
    trash: '<path stroke-linecap="round" d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/>',
    ref: '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/>',
    publish: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18"/>',
    import: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 16V4m0 0l-4 4m4-4l4 4"/>'
};
renderFeatures = function () {
    const flags = zdFlags();
    document.getElementById('feat-list').innerHTML = ZD_FEATURES.map(f => {
        const on = flags[f.id] !== false;
        const ico = ZD_FEAT_ICONS[f.id] || '<circle cx="12" cy="12" r="8"/>';
        return `<div class="zd-frow ${on ? '' : 'off'}">
            <span class="zd-fico"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${ico}</svg></span>
            <span class="text-xs text-text flex-1 min-w-0">${f.label}</span>
            <button onclick="featToggle('${f.id}')" class="zd-sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}"><span class="zd-sw-knob"></span></button>
        </div>`;
    }).join('');
    applyFeatureFlags();
};

/* ============================================================
   6 — PUBLISH: footer links back to ZenDocs
============================================================ */
window.publishWebpage = () => {
    if (!state.docId) { showToast('Open a note first.'); return; }
    const title = els.title.value || 'Note';
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
body{margin:0;background:#f4efe6;font-family:Georgia,'Times New Roman',serif;color:#1f2937;}
.page{max-width:720px;margin:0 auto;padding:48px 28px;background:#fdfaf3;min-height:100vh;box-shadow:0 0 40px rgba(0,0,0,.08);line-height:1.65;font-size:17px;}
h1.zd-t{font-size:30px;margin:0 0 6px;}.zd-m{font-size:12px;color:#8a8069;margin-bottom:28px;}
img{max-width:100%;border-radius:8px;}a{color:#1a73e8;}blockquote{border-left:3px solid #1a73e8;margin-left:0;padding-left:16px;font-style:italic;color:#555;}
pre{background:#1e1e1e;color:#eee;padding:14px;border-radius:8px;overflow-x:auto;font-size:13px;}
.ql-hashtag{color:#1a73e8;background:rgba(26,115,232,.1);border-radius:10px;padding:0 5px;}.ql-wikilink{color:#7c3aed;border-bottom:1px dashed #7c3aed;}
ul[data-checked] li::before{content:'\\2610 ';}ul[data-checked=true] li::before{content:'\\2611 ';}
.zd-f{text-align:center;font-size:11px;color:#a39a83;padding:20px 0;}
.zd-f a{color:#8a8069;text-decoration:none;font-weight:700;border-bottom:1px dotted #c4b99f;}
.zd-f a:hover{color:#1a73e8;border-bottom-color:#1a73e8;}
.ql-align-center{text-align:center}.ql-align-right{text-align:right}.ql-align-justify{text-align:justify}
</style></head><body><div class="page"><h1 class="zd-t">${escapeHtml(title)}</h1><div class="zd-m">Published ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</div>${quill.root.innerHTML}</div>
<div class="zd-f">Made with <a href="https://harshavarthanep.github.io/NotesV2/" target="_blank" rel="noopener">ZenDocs</a></div></body></html>`;
    downloadBlob(new Blob([html], { type: 'text/html' }), title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.html');
    showToast('Webpage downloaded — the footer links back to ZenDocs.');
};

/* ============================================================
   7 — PDF: real vector text, white page, identical to the Word export
   (prints the SAME HTML buildWordHtml() produces, inside a hidden
   iframe → choose "Save as PDF". Text stays selectable/editable,
   never a screenshot, always light regardless of app theme.)
============================================================ */
exportPDF = async function () {
    if (!state.docId && !state.isGuest) { showToast('Open a note first.'); return; }
    let built;
    try { built = buildWordHtml(); } catch (e) { showToast('Could not prepare the document.'); return; }
    const doc = built.html.replace('</head>', `<style>
        html,body{background:#ffffff !important;color:#000 !important;}
        *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        img{max-width:100% !important;}
        @page{size:A4;margin:1in;}
    </style></head>`);
    const old = document.getElementById('zd46-print'); if (old) old.remove();
    const f = document.createElement('iframe');
    f.id = 'zd46-print';
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;height:1200px;border:0;opacity:0;';
    document.body.appendChild(f);
    showToast('Opening print dialog — choose “Save as PDF”.', 5000);
    try {
        const d = f.contentDocument || f.contentWindow.document;
        d.open(); d.write(doc); d.close();
        const imgs = Array.from(d.images || []);
        await Promise.all(imgs.map(im => im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; })));
        await new Promise(r => setTimeout(r, 350));
        f.contentWindow.focus();
        f.contentWindow.print();
        setTimeout(() => { try { f.remove(); } catch (e) {} }, 60000);
    } catch (e) {
        console.error(e);
        try { f.remove(); } catch (err) {}
        showToast('Your browser blocked printing — try the Word (.docx) export instead.');
    }
};

/* ============================================================
   8 — REFERENCE PANEL SHORTCUT (Alt+R) + HELP GUIDE UPDATE
============================================================ */
document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
        e.preventDefault();
        if (state.isGuest) return;
        const p = document.getElementById('ref-pane');
        p && p.classList.contains('open') ? closeRefPanel() : openRefPanel();
    }
});
(function zd46Help() {
    const scroll = document.querySelector('#help-modal .overflow-y-auto');
    if (!scroll || scroll.dataset.zd46) return;
    scroll.dataset.zd46 = '1';
    const sec = document.createElement('section');
    sec.innerHTML = `<h4 class="font-semibold text-gray-800 dark:text-white mb-1.5 flex items-center gap-2"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg> New in V4 — planning, focus &amp; safety</h4>
    <ul class="list-disc pl-5 space-y-1">
        <li><b>Eisenhower matrix</b> (Matrix in the views row): sort notes into <i>Do first · Schedule · Delegate · Eliminate</i>. Tiles preview their notes with due chips before you open them, drag the grip to show more, tick a checkbox to complete, and set a <b>due date &amp; time</b> that fires a snoozable notification.</li>
        <li><b>Quick view (👁)</b> in the matrix and in any calendar day: the note rendered exactly as in the editor, read-only. The ⤢ button jumps to the real note. <b>Esc</b> or a click outside closes one layer at a time.</li>
        <li><b>Focus timer</b>: 25/45/5/15 or any custom length. The countdown lives in a small pill at the corner — tap it to pause and reopen the timer; you get a notification when it ends.</li>
        <li><b>Read aloud</b>: on-device text-to-speech with speed control, pause and resume.</li>
        <li><b>Trash</b>: deleted notes are recoverable for <b>30 days</b>, then purge themselves.</li>
        <li><b>Locked notes</b>: protect a note with a password. The note stays safely in your account (never only on this device), and if you forget the password you can unlock it by confirming your ZenDocs account password.</li>
        <li><b>Backup &amp; restore</b>: export every note and folder to one .json file; import adds notes without ever overwriting.</li>
        <li><b>Import</b> Markdown (.md — Obsidian/Notion) and CSV files; <b>Publish as webpage</b> saves a note as a standalone .html you can host anywhere.</li>
        <li><b>Reference panel</b> (<b>Alt+R</b>): pin a second note beside the editor, read-only, for side-by-side work.</li>
        <li><b>PDF export</b> now prints real, selectable text on a white A4 page — identical to the Word export, whatever theme you use.</li>
        <li><b>Features on this device</b>: every feature has an icon and a switch; anything you turn off disappears from the menus on this device only.</li>
    </ul>`;
    scroll.appendChild(sec);
    const sc = document.querySelector('#help-modal .overflow-y-auto section:last-child');
    if (sc) sc.className = '';
})();

/* ============================================================
   9 — Ctrl+K opens ONLY the search palette
============================================================ */
(function () {
    try {
        const b = quill.keyboard.bindings;
        [75, '75', 'K', 'k'].forEach(k => { if (b[k]) delete b[k]; });
    } catch (e) {}
    quill.root.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            closeLinkModal();
            if (!state.isGuest) openPalette();
        }
    }, true);
})();

/* ============================================================
   10 — UNLINKED MENTIONS: always refresh (the old early-return
   skipped them whenever a note had no backlinks yet)
============================================================ */
renderBacklinks = function () {
    const el = els.backlinksList; if (!el) return;
    if (!state.docId || state.isGuest) {
        el.innerHTML = '<div class="text-[10px] text-muted">—</div>';
        const u = document.getElementById('unlinked-list'); if (u) u.innerHTML = '';
        return;
    }
    const cur = state.docs.find(d => d.id === state.docId);
    const title = ((cur && cur.title) || els.title.value || '').trim();
    if (!title) { el.innerHTML = ''; return; }
    const re = new RegExp('\\[\\[\\s*' + escapeRegExp(title) + '\\s*\\]\\]', 'i');
    const refs = state.docs.filter(d => d.id !== state.docId && re.test(docPlainText(d)));
    if (refs.length === 0) {
        el.innerHTML = '<div class="text-[10px] text-muted">No notes link here yet. Type [[' + escapeHtml(title) + ']] in another note to create a backlink.</div>';
    } else {
        el.innerHTML = '';
        refs.forEach(d => {
            const b = document.createElement('button');
            b.className = 'w-full text-left text-xs p-2 rounded-lg border border-border hover:border-accent/50 bg-bg transition flex items-center gap-2 active:scale-[.98]';
            b.innerHTML = `<span class="text-accent flex-shrink-0"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5"/></svg></span><span class="bl-title truncate text-text transition-colors">${escapeHtml(d.title || 'Untitled')}</span>`;
            b.onclick = () => openDoc(d.id, d);
            el.appendChild(b);
        });
    }
    renderUnlinkedMentions(title, refs); /* ← now runs in BOTH cases */
};
/* refresh the panel whenever notes sync or the title changes */
const _zd46Refresh2 = refreshOpenViews;
refreshOpenViews = function () {
    _zd46Refresh2();
    if (!els.commentsPanel.classList.contains('hidden')) renderBacklinks();
};
els.title.addEventListener('blur', () => { setTimeout(renderBacklinks, 120); });

/* ============================================================
   11 — ONE-TAP CHECKBOXES (wider hit zone, no long press).
   Guarded by state.lastToggle so the existing touch handler and
   this one can never both fire for the same tap.
============================================================ */
els.editorWrapper.addEventListener('click', (e) => {
    if (state.reading || state.isGuest || !state.docId) return;
    if (Date.now() - state.lastToggle < 600) return; /* the old handler already did it */
    const li = e.target.closest && e.target.closest('.ql-editor li[data-list="checked"], .ql-editor li[data-list="unchecked"]');
    if (!li) return;
    const r = li.getBoundingClientRect();
    if (e.clientX > r.left + 26 || e.clientX < r.left - 44) return; /* marker zone only */
    if (e.clientY > r.top + Math.min(r.height, 40)) return;
    const blot = Quill.find(li); if (!blot) return;
    e.preventDefault(); e.stopPropagation();
    const idx = quill.getIndex(blot);
    quill.formatLine(idx, 1, 'list', li.dataset.list === 'checked' ? 'unchecked' : 'checked', 'user');
    state.lastToggle = Date.now();
    state.suppressClickUntil = Date.now() + 400;
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) {}
}, true);

/* ============================================================
   12 — LOCKED NOTES (replaces the device-only encrypted vault)
   Content stays in Firestore exactly like any other note, so it is
   always recoverable. The password (salted SHA-256 hash only) gates
   opening it. Forgot it → confirm your ZenDocs account password.
============================================================ */
(function () { /* retire the old vault UI */
    document.querySelectorAll('[data-zdfn="vault"]').forEach(el => el.remove());
    const m = document.getElementById('vault-modal'); if (m) m.remove();
    try { const i = ZD_FEATURES.findIndex(f => f.id === 'vault'); if (i >= 0) ZD_FEATURES.splice(i, 1); } catch (e) {}
})();
document.body.insertAdjacentHTML('beforeend', `
<div id="lock-modal" class="zd-cmodal"><div class="zd-cmodal-box max-w-xs">
  <div class="flex items-center justify-between mb-1">
    <h3 id="lock-title" class="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2"><svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg> Locked note</h3>
    <button onclick="closeLockModal()" class="text-muted hover:text-danger text-xl leading-none active:scale-90">×</button>
  </div>
  <div id="lock-sub" class="text-[11px] text-muted mb-3 leading-snug"></div>
  <input id="lock-pass" type="password" placeholder="Password" autocomplete="off" class="zd44-in mb-2">
  <input id="lock-pass2" type="password" placeholder="Confirm password" autocomplete="off" class="zd44-in mb-2 hidden">
  <button id="lock-go" class="w-full py-2.5 text-xs font-bold rounded-xl text-white active:scale-[.98] transition" style="background-image:var(--zd-grad)">Unlock</button>
  <button id="lock-forgot" onclick="lockForgot()" class="hidden w-full mt-1.5 py-2 text-[11px] font-semibold rounded-xl text-muted hover:text-accent transition">Forgot password? Use my account password</button>
  <button id="lock-remove" onclick="lockRemove()" class="hidden w-full mt-1.5 py-2 text-[11px] font-semibold rounded-xl text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition">Remove the lock from this note</button>
</div></div>`);
var zd46Unlocked = new Set();
var _lockMode = 'unlock', _lockDocId = null;
async function zd46Hash(pass, salt) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '::' + pass));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}
window.closeLockModal = () => { document.getElementById('lock-modal').classList.remove('open'); _lockDocId = null; };
function lockOpenUI(mode, docId, msg) {
    _lockMode = mode; _lockDocId = docId;
    const p1 = document.getElementById('lock-pass'), p2 = document.getElementById('lock-pass2');
    p1.value = ''; p2.value = '';
    p2.classList.toggle('hidden', mode !== 'set');
    document.getElementById('lock-go').textContent = mode === 'set' ? 'Lock this note' : 'Unlock';
    document.getElementById('lock-forgot').classList.toggle('hidden', mode !== 'unlock');
    document.getElementById('lock-remove').classList.toggle('hidden', mode !== 'manage');
    document.getElementById('lock-title').lastElementChild ? null : null;
    document.getElementById('lock-sub').innerHTML = msg;
    document.getElementById('lock-modal').classList.add('open');
    setTimeout(() => { try { p1.focus({ preventScroll: true }); zdArmProtect(p1); } catch (e) {} }, 90);
}
window.openLockNote = async () => {
    if (state.isGuest || !state.docId) { showToast('Open a note first.'); return; }
    if (!window.crypto || !crypto.subtle) { showToast('This browser can\u2019t hash passwords securely.'); return; }
    const d = state.docs.find(x => x.id === state.docId);
    if (d && d.lockHash) {
        lockOpenUI('manage', state.docId, 'This note is locked. You can remove the lock below, or keep it protected.');
        return;
    }
    lockOpenUI('set', state.docId, 'Choose a password to protect <b>' + escapeHtml(d ? (d.title || 'this note') : 'this note') + '</b>. The note itself stays safely in your account — if you forget the password you can still unlock it with your ZenDocs account password.');
};
document.getElementById('lock-go').onclick = async () => {
    const id = _lockDocId; if (!id) return;
    const pass = document.getElementById('lock-pass').value;
    if (!pass || pass.length < 4) { showToast('Use at least 4 characters.'); return; }
    const ref = db.collection('users').doc(state.user.uid).collection('docs').doc(id);
    try {
        if (_lockMode === 'set') {
            if (pass !== document.getElementById('lock-pass2').value) { showToast('The two passwords don\u2019t match.'); return; }
            const salt = btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(12))));
            await ref.update({ lockSalt: salt, lockHash: await zd46Hash(pass, salt) });
            const d = state.docs.find(x => x.id === id); if (d) { d.lockSalt = salt; d.lockHash = 'set'; }
            zd46Unlocked.add(id);
            closeLockModal(); renderDocs();
            showToast('🔒 Note locked. It stays in your account and syncs normally.');
        } else {
            const d = state.docs.find(x => x.id === id);
            const snap = await ref.get();
            const s = snap.exists ? snap.data() : {};
            if (!s.lockHash) { zd46Unlocked.add(id); closeLockModal(); openDoc(id, d || s); return; }
            if (await zd46Hash(pass, s.lockSalt || '') !== s.lockHash) { showToast('Wrong password.'); return; }
            zd46Unlocked.add(id);
            closeLockModal();
            openDoc(id, d || Object.assign({ id: id }, s));
        }
    } catch (e) { console.error(e); showToast('Could not update the lock.'); }
};
document.getElementById('lock-pass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('lock-go').click(); });
document.getElementById('lock-pass2').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('lock-go').click(); });
window.lockForgot = async () => {
    const id = _lockDocId; if (!id) return;
    const acct = prompt('Confirm your ZenDocs account password for ' + state.user.email + ':');
    if (!acct) return;
    try {
        const cred = firebase.auth.EmailAuthProvider.credential(state.user.email, acct);
        await state.user.reauthenticateWithCredential(cred);
        await db.collection('users').doc(state.user.uid).collection('docs').doc(id).update({ lockHash: null, lockSalt: null });
        const d = state.docs.find(x => x.id === id); if (d) { d.lockHash = null; d.lockSalt = null; }
        zd46Unlocked.add(id);
        closeLockModal(); renderDocs();
        showToast('Lock removed — the note is open again. Set a new password anytime.');
        if (d) openDoc(id, d);
    } catch (e) { showToast('That account password didn\u2019t match.'); }
};
window.lockRemove = async () => {
    const id = _lockDocId; if (!id) return;
    const ok = await zdConfirm('Anyone with access to your account will be able to open this note.', { title: 'Remove the lock?', okText: 'Remove lock', danger: true });
    if (!ok) return;
    try {
        await db.collection('users').doc(state.user.uid).collection('docs').doc(id).update({ lockHash: null, lockSalt: null });
        const d = state.docs.find(x => x.id === id); if (d) { d.lockHash = null; d.lockSalt = null; }
        closeLockModal(); renderDocs(); showToast('Lock removed.');
    } catch (e) { showToast('Could not remove the lock.'); }
};
document.getElementById('lock-modal').addEventListener('click', (e) => { if (e.target.id === 'lock-modal') closeLockModal(); });
/* gate: a locked note asks for its password before opening */
const _zd46OpenDoc = window.openDoc;
window.openDoc = function (id, data) {
    if (data && data.lockHash && !zd46Unlocked.has(id)) {
        lockOpenUI('unlock', id, 'Enter the password for <b>' + escapeHtml(data.title || 'this note') + '</b>.');
        return;
    }
    return _zd46OpenDoc(id, data);
};
/* locked notes stay out of search results, quick view and the reference pane */
const _zd46PaintPal = paintPaletteResults;
paintPaletteResults = function (results, snippets, query) {
    _zd46PaintPal((results || []).filter(d => !(d.lockHash && !zd46Unlocked.has(d.id))), snippets, query);
};
const _zd46Glance = window.openEisGlance;
window.openEisGlance = function (docId) {
    const d = state.docs.find(x => x.id === docId);
    if (d && d.lockHash && !zd46Unlocked.has(docId)) { showToast('🔒 This note is locked — open it to unlock.'); return; }
    return _zd46Glance(docId);
};
zdMenuInject2('lock', 'openLockNote', 'Lock this note', ZD_FEAT_ICONS.lock);
try { ZD_FEATURES.push({ id: 'lock', label: 'Locked notes (password)', fns: ['openLockNote'] }); } catch (e) {}

/* ============================================================
   13 — MOBILE SIDEBAR STAYS OPEN FOR FILTERS
   (All files / Starred / folders / tags show results IN the sidebar)
============================================================ */
window.filterDocs = (f) => {
    state.activeFilter = f;
    document.querySelectorAll('#sidebar .bg-white\\/10').forEach(e => e.classList.remove('bg-white/10', 'text-white'));
    if (f === 'all') document.getElementById('filter-all').classList.add('bg-white/10', 'text-white');
    else if (f === 'fav') document.getElementById('filter-fav').classList.add('bg-white/10', 'text-white');
    renderFolders(); renderDocs(); renderTags();
    /* the sidebar is where the results appear — leave it open */
};

/* ============================================================
   14 + 15 — STRAY CLICKS NEVER FOCUS THE EDITOR, AND MODAL /
   SIDEBAR INPUTS KEEP THE CARET (no more mobile keyboard popping
   open when you tap empty space in a panel or dialog)
============================================================ */
let zd46NoFocusUntil = 0;
document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.ql-editor') || t.closest('#toolbar') || t.closest('#doc-title')) return;
    zd46NoFocusUntil = Date.now() + 900;
    if (quill.hasFocus()) { try { quill.blur(); } catch (err) {} }
    const ae = document.activeElement;
    if (ae && ae !== document.body && !t.closest('input, textarea, select, [contenteditable]') &&
        (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && !ae.closest('#doc-title')) {
        /* tapping empty modal space dismisses the on-screen keyboard */
        try { ae.blur(); } catch (err) {}
    }
}, true);
(function () {
    const _f = quill.focus.bind(quill);
    const _s = quill.setSelection.bind(quill);
    quill.focus = function () { if (Date.now() < zd46NoFocusUntil) return; return _f(); };
    quill.setSelection = function (a, b, c) {
        if (Date.now() < zd46NoFocusUntil && !quill.hasFocus()) return null;
        return _s(a, b, c);
    };
})();
/* any input inside a dialog/panel is protected while it's being used */
const ZD46_HOSTS = '.zd-cmodal, .zd-view-modal, #sidebar, #comments-panel, #ref-pane, #dt-pane, #palette-modal, #note-picker-modal, #link-modal, #comment-modal, #reset-modal, #rem-modal, #day-detail-modal';
['focusin', 'input', 'pointerup'].forEach(ev => {
    document.addEventListener(ev, (e) => {
        const t = e.target;
        if (!t || !t.matches) return;
        if (!t.matches('input, textarea, select')) return;
        if (!t.closest(ZD46_HOSTS)) return;
        zd46NoFocusUntil = Date.now() + 900;
        try { zdArmProtect(t); } catch (err) {}
        if (ev === 'pointerup' && document.activeElement !== t) {
            setTimeout(() => { try { t.focus({ preventScroll: true }); } catch (err) {} }, 30);
        }
    }, true);
});

/* ---------- apply everything ---------- */
setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 500);    

    // New Code

