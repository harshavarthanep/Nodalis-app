// ZenDocs — 06-auth-header-guest.js
// V4.7 premium auth screen, V5.0 unified header toolbar, V5.1b guest shared-view + auth polish.
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
   V4.7 — PREMIUM AUTH SCREEN
   Distinct Sign in / Create account tabs · inline reset pane ·
   human error messages with recovery actions · app logo ·
   show/hide password · strength meter · Caps-Lock hint.
   Rebuilds #auth-screen and rebinds every handler. The old
   #reset-modal stays in the page but is no longer used.
============================================================ */
(function zd47Auth() {
    const screen = document.getElementById('auth-screen');
    if (!screen || screen.dataset.zd47) return;
    screen.dataset.zd47 = '1';
    screen.classList.add('zd-auth');

    document.head.insertAdjacentHTML('beforeend', `<style>
    #auth-screen.zd-auth { background:#0e1014 !important; padding:18px !important; overflow-y:auto; align-items:center; }
    #auth-screen.zd-auth::before { content:''; position:absolute; inset:0; pointer-events:none;
        background:radial-gradient(820px 460px at 12% 18%, rgb(var(--accent-rgb) / 0.22), transparent 62%),
                   radial-gradient(680px 420px at 88% 88%, rgb(var(--accent-rgb) / 0.14), transparent 60%),
                   linear-gradient(180deg, rgba(255,255,255,.03), transparent 40%); }
    #auth-screen.zd-auth::after { content:''; position:absolute; inset:0; pointer-events:none; opacity:.35;
        background-image:linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
        background-size:46px 46px; mask-image:radial-gradient(circle at 50% 40%, #000 30%, transparent 78%); -webkit-mask-image:radial-gradient(circle at 50% 40%, #000 30%, transparent 78%); }
    .zda-wrap { position:relative; z-index:2; width:100%; max-width:880px; margin:auto; display:grid; grid-template-columns:1fr; gap:0;
        border-radius:26px; overflow:hidden; border:1px solid rgba(255,255,255,.09); box-shadow:0 34px 80px rgba(0,0,0,.55); }
    @media (min-width:860px) { .zda-wrap { grid-template-columns:1.05fr .95fr; } }
    .zda-brand { display:none; padding:38px 34px; color:#fff; position:relative; background:#14161c; }
    @media (min-width:860px) { .zda-brand { display:flex; flex-direction:column; } }
    .zda-brand::before { content:''; position:absolute; inset:0; opacity:.92; background-image:var(--zd-grad); }
    .zda-brand::after { content:''; position:absolute; inset:0; background:linear-gradient(160deg, rgba(0,0,0,.12), rgba(0,0,0,.55)); }
    .zda-brand > * { position:relative; z-index:2; }
    .zda-logo { width:46px; height:46px; border-radius:13px; box-shadow:0 8px 22px rgba(0,0,0,.35); background:rgba(255,255,255,.16); display:flex; align-items:center; justify-content:center; }
    .zda-logo img { width:46px; height:46px; border-radius:13px; display:block; }
    .zda-feat { display:flex; gap:11px; align-items:flex-start; margin-top:14px; }
    .zda-feat svg { width:16px; height:16px; flex-shrink:0; margin-top:2px; opacity:.95; }
    .zda-card { background:rgba(20,22,28,.86); backdrop-filter:blur(20px); padding:30px 26px; }
    @media (min-width:860px) { .zda-card { padding:36px 34px; } }
    .zda-seg { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border-radius:14px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.07); margin-bottom:20px; }
    .zda-seg button { padding:9px 0; border-radius:11px; font-size:12.5px; font-weight:700; color:#9ca3af; transition:color .18s ease, background .18s ease, box-shadow .18s ease; }
    .zda-seg button:hover { color:#e5e7eb; }
    .zda-seg button.on { color:#fff; background-image:var(--zd-grad); box-shadow:0 6px 16px rgba(0,0,0,.35); }
    .zda-lab { display:block; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#8b93a1; margin-bottom:6px; }
    .zda-field { position:relative; margin-bottom:13px; }
    .zda-in { width:100%; background:rgba(255,255,255,.045); border:1.5px solid rgba(255,255,255,.10); border-radius:13px;
        padding:12px 42px 12px 40px; font-size:14px; color:#f3f4f6; outline:none; transition:border-color .18s ease, background .18s ease; caret-color:rgb(var(--accent-rgb)); }
    .zda-in::placeholder { color:#6b7280; }
    .zda-in:focus { border-color:rgb(var(--accent-rgb)); background:rgba(255,255,255,.07); }
    .zda-field.bad .zda-in { border-color:#f87171; }
    .zda-ico { position:absolute; left:13px; top:50%; transform:translateY(-50%); width:16px; height:16px; color:#6b7280; pointer-events:none; }
    .zda-field:focus-within .zda-ico { color:rgb(var(--accent-rgb)); }
    .zda-eye { position:absolute; right:9px; top:50%; transform:translateY(-50%); width:28px; height:28px; border-radius:99px; color:#8b93a1; display:flex; align-items:center; justify-content:center; }
    .zda-eye:hover { color:#fff; background:rgba(255,255,255,.09); }
    .zda-hint { font-size:10.5px; color:#f87171; margin:-8px 0 10px 2px; min-height:0; }
    .zda-btn { width:100%; padding:12.5px 0; border-radius:14px; font-size:13.5px; font-weight:800; color:#fff;
        background-image:var(--zd-grad); box-shadow:0 10px 26px rgba(0,0,0,.4); transition:transform .12s ease, filter .18s ease; display:flex; align-items:center; justify-content:center; gap:8px; }
    .zda-btn:hover { filter:brightness(1.08); } .zda-btn:active { transform:scale(.985); }
    .zda-btn[disabled] { opacity:.65; pointer-events:none; }
    .zda-msg { display:none; gap:9px; padding:11px 12px; border-radius:13px; font-size:12px; line-height:1.45; margin-bottom:14px; align-items:flex-start; }
    .zda-msg.show { display:flex; animation:fadeIn .2s ease-out; }
    .zda-msg.err { background:rgba(248,113,113,.11); border:1px solid rgba(248,113,113,.3); color:#fca5a5; }
    .zda-msg.ok { background:rgba(52,211,153,.11); border:1px solid rgba(52,211,153,.3); color:#6ee7b7; }
    .zda-msg svg { width:15px; height:15px; flex-shrink:0; margin-top:1px; }
    .zda-msg button { font-weight:800; text-decoration:underline; color:inherit; }
    .zda-bars { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; margin:-6px 0 5px; }
    .zda-bars i { height:3px; border-radius:99px; background:rgba(255,255,255,.12); transition:background .2s ease; }
    .zda-strength { font-size:10px; color:#8b93a1; margin-bottom:11px; }
    .zda-link { font-size:12px; color:rgb(var(--accent-rgb)); font-weight:600; }
    .zda-link:hover { text-decoration:underline; }
    .zda-foot { margin-top:18px; padding-top:15px; border-top:1px solid rgba(255,255,255,.08); font-size:11px; color:#7b8494; text-align:center; line-height:1.6; }
    .zda-caps { display:none; font-size:10.5px; color:#fbbf24; margin:-8px 0 10px 2px; }
    .zda-caps.show { display:block; }
    .zda-mlogo { display:flex; align-items:center; gap:11px; margin-bottom:20px; }
    @media (min-width:860px) { .zda-mlogo { display:none; } }
    .zda-mlogo img { width:38px; height:38px; border-radius:11px; }
    </style>`);

    const LOGO = `<img src="./icon-192.png" alt="ZenDocs" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:'<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\' style=\\'width:22px;height:22px;color:#fff\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11 15l-4 1 1-4 9.6-9.4z\\'/></svg>'}))">`;
    const IC = {
        mail: '<svg class="zda-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path stroke-linecap="round" d="M3.5 7l8.5 6 8.5-6"/></svg>',
        lock: '<svg class="zda-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg>',
        check: '<svg class="zda-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
        eye: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.4 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.6 7c-1.3 4.1-5.1 7-9.6 7s-8.3-2.9-9.6-7z"/></svg>',
        eyeOff: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A9.8 9.8 0 0112 5c4.5 0 8.3 2.9 9.6 7a11 11 0 01-2.4 3.6M6.2 6.6A11 11 0 002.4 12c1.3 4.1 5.1 7 9.6 7 1.2 0 2.3-.2 3.4-.6"/></svg>',
        warn: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.5m0 3.5h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>',
        ok: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
    };
    const pwField = (id, ph, ac) => `<div class="zda-field" data-f="${id}">${IC.lock}
        <input id="${id}" type="password" class="zda-in" placeholder="${ph}" autocomplete="${ac}" spellcheck="false">
        <button type="button" class="zda-eye" data-eye="${id}" title="Show password">${IC.eye}</button></div>`;

    screen.innerHTML = `
    <div class="zda-wrap">
      <aside class="zda-brand">
        <div class="flex items-center gap-3">
          <span class="zda-logo">${LOGO}</span>
          <span><span class="block text-xl font-light leading-tight">Zen<b class="font-bold">Docs</b></span>
          <span class="block text-[10px] uppercase tracking-[.16em] opacity-80">Professional cloud editor</span></span>
        </div>
        <div class="mt-8 text-[22px] font-semibold leading-snug">Think clearly.<br>Write beautifully.</div>
        <div class="mt-1.5 text-[12.5px] opacity-85 leading-relaxed">Notes, tasks, graphs and daily planning — synced across every device.</div>
        <div class="mt-6">
          <div class="zda-feat"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-10 5 5 0 10-9.8 2A4 4 0 003 15z"/></svg><span class="text-[12px] leading-snug"><b>Autosave &amp; offline</b><br><span class="opacity-80">Every keystroke kept safe.</span></span></div>
          <div class="zda-feat"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="8" r="2.4"/><circle cx="9" cy="18" r="2.4"/><path stroke-linecap="round" d="M8.2 6.7l7.4 1M6.9 8.2l1.6 7.4M16.3 9.9l-5.6 6.3"/></svg><span class="text-[12px] leading-snug"><b>Linked thinking</b><br><span class="opacity-80">#tags, [[links]] and a live graph.</span></span></div>
          <div class="zda-feat"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg><span class="text-[12px] leading-snug"><b>Plan &amp; focus</b><br><span class="opacity-80">Matrix, board, calendar, timer.</span></span></div>
        </div>
        <div class="mt-auto pt-7 text-[10px] opacity-70">Made with love ❤️ by Harsha Varthan E P</div>
      </aside>

      <div id="auth-box" class="zda-card opacity-0 transform transition-all duration-500">
        <div class="zda-mlogo"><span class="zda-logo" style="width:38px;height:38px;border-radius:11px">${LOGO}</span>
          <span><span class="block text-lg font-light text-white leading-tight">Zen<b class="font-bold">Docs</b></span>
          <span class="block text-[9px] uppercase tracking-[.14em] text-gray-500">Professional cloud editor</span></span></div>

        <div class="zda-seg" role="tablist">
          <button id="zda-tab-in" type="button" onclick="zdAuthTab('signin')">Sign in</button>
          <button id="zda-tab-up" type="button" onclick="zdAuthTab('signup')">Create account</button>
        </div>

        <div id="zda-msg" class="zda-msg"><span id="zda-msg-ico"></span><span id="zda-msg-txt" class="flex-1"></span></div>

        <!-- SIGN IN -->
        <form id="zda-p-signin" novalidate>
          <h2 class="text-[17px] font-bold text-white mb-0.5">Welcome back</h2>
          <p class="text-[11.5px] text-gray-500 mb-5">Sign in to your existing ZenDocs account.</p>
          <span class="zda-lab">Email</span>
          <div class="zda-field" data-f="zda-in-email">${IC.mail}<input id="zda-in-email" type="email" class="zda-in" placeholder="you@example.com" autocomplete="username" spellcheck="false"></div>
          <span class="zda-lab">Password</span>
          ${pwField('zda-in-pass', 'Your password', 'current-password')}
          <div id="zda-caps-in" class="zda-caps">⚠ Caps Lock is on.</div>
          <div class="flex justify-end mb-4"><button type="button" class="zda-link" onclick="zdAuthTab('reset')">Forgot password?</button></div>
          <button type="submit" id="zda-btn-in" class="zda-btn">Sign in</button>
          <p class="text-center text-[11.5px] text-gray-500 mt-4">New to ZenDocs? <button type="button" class="zda-link" onclick="zdAuthTab('signup')">Create a free account</button></p>
        </form>

        <!-- SIGN UP -->
        <form id="zda-p-signup" novalidate style="display:none">
          <h2 class="text-[17px] font-bold text-white mb-0.5">Create your account</h2>
          <p class="text-[11.5px] text-gray-500 mb-5">Free, private, and ready in seconds.</p>
          <span class="zda-lab">Email</span>
          <div class="zda-field" data-f="zda-up-email">${IC.mail}<input id="zda-up-email" type="email" class="zda-in" placeholder="you@example.com" autocomplete="username" spellcheck="false"></div>
          <span class="zda-lab">Create password</span>
          ${pwField('zda-up-pass', 'At least 6 characters', 'new-password')}
          <div class="zda-bars"><i></i><i></i><i></i><i></i></div>
          <div id="zda-strength" class="zda-strength">Use 8+ characters with a number for a strong password.</div>
          <span class="zda-lab">Confirm password</span>
          <div class="zda-field" data-f="zda-up-pass2">${IC.check}<input id="zda-up-pass2" type="password" class="zda-in" placeholder="Repeat your password" autocomplete="new-password" spellcheck="false"></div>
          <div id="zda-caps-up" class="zda-caps">⚠ Caps Lock is on.</div>
          <button type="submit" id="zda-btn-up" class="zda-btn mt-1">Create account</button>
          <p class="text-center text-[11.5px] text-gray-500 mt-4">Already registered? <button type="button" class="zda-link" onclick="zdAuthTab('signin')">Sign in instead</button></p>
        </form>

        <!-- RESET -->
        <form id="zda-p-reset" novalidate style="display:none">
          <h2 class="text-[17px] font-bold text-white mb-0.5">Reset your password</h2>
          <p class="text-[11.5px] text-gray-500 mb-5">We'll email you a secure link to choose a new one.</p>
          <span class="zda-lab">Account email</span>
          <div class="zda-field" data-f="zda-rs-email">${IC.mail}<input id="zda-rs-email" type="email" class="zda-in" placeholder="you@example.com" autocomplete="username" spellcheck="false"></div>
          <button type="submit" id="zda-btn-rs" class="zda-btn mt-1">Send reset link</button>
          <p class="text-center text-[11.5px] text-gray-500 mt-4"><button type="button" class="zda-link" onclick="zdAuthTab('signin')">← Back to sign in</button></p>
        </form>

        <div id="auth-cancel-container" class="hidden text-center mt-4">
          <button type="button" onclick="closeLoginForGuest()" class="text-[11.5px] text-gray-500 hover:text-white transition">Cancel &amp; return to the shared note</button>
        </div>
        <span id="auth-error" class="hidden"></span>
        <div class="zda-foot">Your notes stay private to your account.<br>By continuing you agree to use ZenDocs responsibly.</div>
      </div>
    </div>`;

    /* keep global refs pointing at the new nodes */
    els.authBox = document.getElementById('auth-box');
    els.authCancelContainer = document.getElementById('auth-cancel-container');
    els.email = document.getElementById('zda-in-email');
    els.pass = document.getElementById('zda-in-pass');
    els.authError = document.getElementById('auth-error');

    const $ = id => document.getElementById(id);
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    function msg(kind, text, action) {
        const box = $('zda-msg');
        $('zda-msg-ico').innerHTML = kind === 'ok' ? IC.ok : IC.warn;
        $('zda-msg-txt').innerHTML = text + (action ? ' <button type="button" data-act="' + action.k + '">' + action.t + '</button>' : '');
        box.className = 'zda-msg show ' + (kind === 'ok' ? 'ok' : 'err');
        const b = $('zda-msg-txt').querySelector('button');
        if (b) b.onclick = action.run;
    }
    function clearMsg() { $('zda-msg').className = 'zda-msg'; document.querySelectorAll('.zda-field.bad').forEach(f => f.classList.remove('bad')); }
    function bad(id) { const f = document.querySelector('.zda-field[data-f="' + id + '"]'); if (f) f.classList.add('bad'); const el = $(id); if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
    function busy(btn, on, label) {
        btn.disabled = on;
        btn.innerHTML = on ? '<svg class="animate-spin" style="width:15px;height:15px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" d="M12 3a9 9 0 019 9"/></svg> Please wait…' : label;
    }

    window.zdAuthTab = (t) => {
        clearMsg();
        const map = { signin: 'zda-p-signin', signup: 'zda-p-signup', reset: 'zda-p-reset' };
        Object.keys(map).forEach(k => { $(map[k]).style.display = k === t ? '' : 'none'; });
        $('zda-tab-in').classList.toggle('on', t === 'signin');
        $('zda-tab-up').classList.toggle('on', t === 'signup');
        /* carry the typed email across tabs so nothing is retyped */
        const carry = ($('zda-in-email').value || $('zda-up-email').value || $('zda-rs-email').value || '').trim();
        if (carry) { $('zda-in-email').value = carry; $('zda-up-email').value = carry; $('zda-rs-email').value = carry; }
        const first = { signin: 'zda-in-email', signup: 'zda-up-email', reset: 'zda-rs-email' }[t];
        if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            setTimeout(() => { try { $(first).focus({ preventScroll: true }); } catch (e) {} }, 80);
        }
    };
    window.showResetModal = () => zdAuthTab('reset'); /* the old modal is retired */

    /* eye toggles */
    screen.querySelectorAll('[data-eye]').forEach(b => {
        b.onclick = () => {
            const i = $(b.dataset.eye);
            const show = i.type === 'password';
            i.type = show ? 'text' : 'password';
            b.innerHTML = show ? IC.eyeOff : IC.eye;
            b.title = show ? 'Hide password' : 'Show password';
            try { i.focus({ preventScroll: true }); } catch (e) {}
        };
    });
    /* Caps Lock hints */
    [['zda-in-pass', 'zda-caps-in'], ['zda-up-pass', 'zda-caps-up']].forEach(([p, c]) => {
        $(p).addEventListener('keyup', e => { try { $(c).classList.toggle('show', e.getModifierState && e.getModifierState('CapsLock')); } catch (err) {} });
    });
    /* strength meter */
    $('zda-up-pass').addEventListener('input', () => {
        const v = $('zda-up-pass').value;
        let s = 0;
        if (v.length >= 6) s++;
        if (v.length >= 10) s++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
        if (/\d/.test(v) || /[^\w\s]/.test(v)) s++;
        const cols = ['#f87171', '#fbbf24', '#60a5fa', '#34d399'];
        const names = ['Too weak', 'Weak', 'Good', 'Strong'];
        document.querySelectorAll('.zda-bars i').forEach((bar, i) => { bar.style.background = (v && i < s) ? cols[Math.max(0, s - 1)] : 'rgba(255,255,255,.12)'; });
        $('zda-strength').textContent = v ? (names[Math.max(0, s - 1)] + ' password' + (s < 3 ? ' — add length, a capital or a number.' : '.')) : 'Use 8+ characters with a number for a strong password.';
    });
    /* protect the caret from the editor (V4.4/V4.6 guards) */
    screen.querySelectorAll('input').forEach(i => {
        i.addEventListener('focusin', () => { try { zdArmProtect(i); } catch (e) {} });
        i.addEventListener('input', () => { clearMsg(); try { zdArmProtect(i); } catch (e) {} });
    });

    function friendly(e, mode) {
        const c = (e && e.code) || '';
        switch (c) {
            case 'auth/invalid-email': return { m: 'That email address doesn\u2019t look right — check for typos.', f: mode === 'signup' ? 'zda-up-email' : (mode === 'reset' ? 'zda-rs-email' : 'zda-in-email') };
            case 'auth/missing-password': return { m: 'Please enter your password.', f: mode === 'signup' ? 'zda-up-pass' : 'zda-in-pass' };
            case 'auth/user-disabled': return { m: 'This account has been disabled.' };
            case 'auth/user-not-found': return { m: 'No ZenDocs account uses this email yet.', act: { k: 'up', t: 'Create one now', run: () => zdAuthTab('signup') } };
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials': return { m: 'Incorrect email or password.', f: 'zda-in-pass', act: { k: 'rs', t: 'Reset password', run: () => zdAuthTab('reset') } };
            case 'auth/too-many-requests': return { m: 'Too many attempts — wait a few minutes.', act: { k: 'rs', t: 'Reset password instead', run: () => zdAuthTab('reset') } };
            case 'auth/email-already-in-use': return { m: 'An account already exists with this email.', act: { k: 'in', t: 'Sign in instead', run: () => zdAuthTab('signin') } };
            case 'auth/weak-password': return { m: 'Password too weak — use at least 6 characters.', f: 'zda-up-pass' };
            case 'auth/network-request-failed': return { m: 'Network problem — check your connection and try again.' };
            case 'auth/operation-not-allowed': return { m: 'Email sign-in isn\u2019t enabled for this project.' };
            case 'auth/missing-email': return { m: 'Please enter your email address.' };
            default: return { m: (e && e.message) ? String(e.message).replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/[^)]+\)\.?\s*$/, '') : 'Something went wrong. Please try again.' };
        }
    }

    /* SIGN IN */
    $('zda-p-signin').onsubmit = async (ev) => {
        ev.preventDefault(); clearMsg();
        const email = $('zda-in-email').value.trim(), pass = $('zda-in-pass').value;
        if (!EMAIL_RE.test(email)) { msg('err', 'Enter a valid email address.'); bad('zda-in-email'); return; }
        if (!pass) { msg('err', 'Enter your password.'); bad('zda-in-pass'); return; }
        const btn = $('zda-btn-in'); busy(btn, true);
        try {
            await auth.signInWithEmailAndPassword(email, pass);
            localStorage.setItem('zdLastEmail', email);
            msg('ok', 'Signed in — loading your workspace…');
        } catch (e) {
            const f = friendly(e, 'signin');
            msg('err', f.m, f.act); if (f.f) bad(f.f);
            busy(btn, false, 'Sign in');
        }
    };
    /* SIGN UP */
    $('zda-p-signup').onsubmit = async (ev) => {
        ev.preventDefault(); clearMsg();
        const email = $('zda-up-email').value.trim(), p1 = $('zda-up-pass').value, p2 = $('zda-up-pass2').value;
        if (!EMAIL_RE.test(email)) { msg('err', 'Enter a valid email address so you can recover your account.'); bad('zda-up-email'); return; }
        if (p1.length < 6) { msg('err', 'Choose a password with at least 6 characters.'); bad('zda-up-pass'); return; }
        if (p1 !== p2) { msg('err', 'The two passwords don\u2019t match.'); bad('zda-up-pass2'); return; }
        const btn = $('zda-btn-up'); busy(btn, true);
        try {
            await auth.createUserWithEmailAndPassword(email, p1);
            localStorage.setItem('zdLastEmail', email);
            msg('ok', 'Account created — setting up your workspace…');
        } catch (e) {
            const f = friendly(e, 'signup');
            msg('err', f.m, f.act); if (f.f) bad(f.f);
            busy(btn, false, 'Create account');
        }
    };
    /* RESET */
    $('zda-p-reset').onsubmit = async (ev) => {
        ev.preventDefault(); clearMsg();
        const email = $('zda-rs-email').value.trim();
        if (!EMAIL_RE.test(email)) { msg('err', 'Enter the email address of your account.'); bad('zda-rs-email'); return; }
        const btn = $('zda-btn-rs'); busy(btn, true);
        try {
            await auth.sendPasswordResetEmail(email);
            msg('ok', 'Reset link sent to <b>' + escapeHtml(email) + '</b>. Check your inbox (and spam folder), then sign in with your new password.');
            busy(btn, false, 'Send reset link');
        } catch (e) {
            const f = friendly(e, 'reset');
            msg('err', f.m, f.act); if (f.f) bad(f.f);
            busy(btn, false, 'Send reset link');
        }
    };

    /* start on Sign in, prefilled with the last email used here */
    zdAuthTab('signin');
    const last = localStorage.getItem('zdLastEmail');
    if (last) { $('zda-in-email').value = last; $('zda-up-email').value = last; $('zda-rs-email').value = last; }
})();    

    // New Code

    /* ============================================================
   V4.8b — CALENDAR "NOTES THIS MONTH" (corrected)
   Fixes vs V4.8/V4.9: calendar grid never shrinks · opening a note
   properly closes the calendar · fixed-height list with a drag grip
   (kanban style) · stable row heights (no layout jumping) · mobile
   keyboard no longer dismissed while scrolling · breathing room
   below the list.
============================================================ */
(function zd48b() {
    const modal = document.getElementById('calendar-modal');
    if (!modal || modal.dataset.zd48b) return;
    modal.dataset.zd48b = '1';

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* keep the calendar exactly as it was — normal block flow */
    #cal-scroll { display:block !important; }
    #cal-grid { flex-shrink:0 !important; }

    #cm-panel { max-width:56rem; margin:18px auto 0; border-top:1px solid var(--border-color); padding-top:14px; padding-bottom:28px; }
    #cm-bar { display:grid; gap:8px; align-items:center; grid-template-columns:auto minmax(0,1fr) auto auto; margin-bottom:10px; }
    #cm-title { font-size:11px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:#9ca3af; display:flex; align-items:center; gap:6px; white-space:nowrap; }
    #cm-count { font-size:9px; font-weight:800; padding:2px 7px; border-radius:99px; background:rgb(var(--accent-rgb) / 0.13); color:rgb(var(--accent-rgb)); }
    #cm-search { width:100%; min-width:0; background:var(--bg-color); border:1px solid var(--border-color); border-radius:11px; padding:7px 11px; font-size:12px; color:var(--text-color); outline:none; caret-color:rgb(var(--accent-rgb)); }
    #cm-search:focus { border-color:rgb(var(--accent-rgb)); }
    #cm-sort { max-width:152px; background:var(--bg-color); border:1px solid var(--border-color); border-radius:11px; padding:7px 9px; font-size:11.5px; color:var(--text-color); outline:none; }
    #cm-dir { width:30px; height:30px; flex-shrink:0; border-radius:10px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-color); font-size:12px; font-weight:800; transition:border-color .15s ease; }
    #cm-dir:hover { border-color:rgb(var(--accent-rgb)); color:rgb(var(--accent-rgb)); }

    #cm-box { border:1px solid var(--border-color); border-radius:16px; background:var(--surface-color); overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,.05); }
    #cm-list { overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; padding:4px 7px; }
    #cm-grip { height:16px; display:flex; align-items:center; justify-content:center; cursor:ns-resize; touch-action:none; color:#9ca3af; opacity:.5; border-top:1px solid var(--border-color); transition:opacity .15s ease,color .15s ease; }
    #cm-grip:hover { opacity:1; color:rgb(var(--accent-rgb)); }
    #cm-grip::before { content:''; width:40px; height:3px; border-radius:99px; background:currentColor; }

    /* fixed row height → no layout shifting as the list re-renders */
    .cm-row { display:flex; align-items:center; gap:8px; height:46px; padding:0 5px; border-bottom:1px solid var(--border-color); }
    .cm-row:last-child { border-bottom:none; }
    .cm-row:hover { background:rgba(127,127,127,.06); border-radius:10px; }
    .cm-open { flex:1; min-width:0; text-align:left; }
    .cm-ib { width:27px; height:27px; flex-shrink:0; border-radius:99px; color:#9ca3af; display:flex; align-items:center; justify-content:center; }
    .cm-ib:hover { color:rgb(var(--accent-rgb)); background:rgb(var(--accent-rgb) / 0.1); }
    .cm-ib:active { transform:scale(.86); }
    .cm-gh { height:24px; font-size:8.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#9ca3af; padding:0 4px; display:flex; align-items:center; gap:6px; }
    .cm-gh::after { content:''; flex:1; height:1px; background:var(--border-color); opacity:.7; }

    @media (max-width:900px) {
        #cm-bar { grid-template-columns:1fr auto; gap:8px; }
        #cm-title { grid-column:1; grid-row:1; font-size:10px; }
        #cm-search { grid-column:1 / -1; grid-row:2; font-size:16px; padding:9px 12px; border-radius:12px; }
        #cm-sort { grid-column:1; grid-row:3; width:100%; max-width:none; font-size:13px; padding:8px 10px; border-radius:12px; }
        #cm-dir { grid-column:2; grid-row:3; width:38px; height:38px; font-size:14px; border-radius:12px; }
        .cm-row { height:50px; }
        .cm-ib { width:30px; height:30px; }
        #cm-panel { padding-bottom:36px; }
    }
    @media (max-width:380px) { #cm-sort { font-size:12px; } #cm-title { font-size:9.5px; } }
    </style>`);

    const bodyEl = modal.querySelector('.flex-1.overflow-y-auto');
    if (bodyEl) bodyEl.id = 'cal-scroll';
    const grid = document.getElementById('cal-grid');
    if (!grid) return;

    grid.insertAdjacentHTML('afterend', `
    <div id="cm-panel">
      <div id="cm-bar">
        <span id="cm-title"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span id="cm-label">Notes this month</span><span id="cm-count">0</span></span>
        <input id="cm-search" type="text" placeholder="Filter by title or text…" autocomplete="off" spellcheck="false">
        <select id="cm-sort" title="Sort notes">
          <option value="created">Created date</option>
          <option value="edited">Last edited</option>
          <option value="title">Title (A–Z)</option>
          <option value="words">Word count</option>
          <option value="folder">Folder</option>
          <option value="due">Matrix due date</option>
        </select>
        <button id="cm-dir" type="button" title="Toggle ascending / descending">↓</button>
      </div>
      <div id="cm-box">
        <div id="cm-list" class="zd-scroll"></div>
        <div id="cm-grip" title="Drag to resize the list"></div>
      </div>
    </div>`);

    const $ = id => document.getElementById(id);
    const st = {
        sort: localStorage.getItem('zdCmSort') || 'created',
        dir: localStorage.getItem('zdCmDir') || 'desc',
        h: Math.max(120, Math.min(560, +localStorage.getItem('zdCmH') || 260)),
        q: ''
    };
    $('cm-sort').value = st.sort;
    $('cm-dir').textContent = st.dir === 'desc' ? '↓' : '↑';
    $('cm-list').style.height = st.h + 'px';

    const ts = v => (v && v.toDate) ? v.toDate().getTime() : 0;
    const isLocked = d => !!(d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id)));
    const inMonth = (d, y, m) => {
        const c = ts(d.createdAt);
        if (c) { const dt = new Date(c); if (dt.getFullYear() === y && dt.getMonth() === m) return true; }
        const md = (d.title || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return !!(md && +md[1] === y && +md[2] === m + 1);
    };

    window.renderCalMonthNotes = function () {
        const list = $('cm-list'); if (!list) return;
        const keepTop = list.scrollTop;
        const y = calMonth.getFullYear(), m = calMonth.getMonth();
        $('cm-label').textContent = 'Notes in ' + calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

        let docs = state.docs.filter(d => inMonth(d, y, m));
        const q = st.q.trim().toLowerCase();
        if (q) docs = docs.filter(d =>
            (d.title || '').toLowerCase().includes(q) ||
            (!isLocked(d) && docPlainText(d).toLowerCase().includes(q)));

        const wc = d => { const t = docPlainText(d).trim(); return t ? t.split(/\s+/).length : 0; };
        const fname = d => ((state.folders.find(f => f.id === d.folderId) || {}).name || '~');
        const cmp = {
            created: (a, b) => ts(a.createdAt) - ts(b.createdAt),
            edited: (a, b) => ts(a.updatedAt) - ts(b.updatedAt),
            title: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }),
            words: (a, b) => wc(a) - wc(b),
            folder: (a, b) => fname(a).localeCompare(fname(b), undefined, { sensitivity: 'base' }) || (a.title || '').localeCompare(b.title || ''),
            due: (a, b) => (a.eisDue || Infinity) - (b.eisDue || Infinity)
        }[st.sort] || (() => 0);
        docs.sort(cmp);
        if (st.dir === 'desc' && st.sort !== 'due') docs.reverse();

        $('cm-count').textContent = docs.length;
        list.innerHTML = '';
        if (!docs.length) {
            list.innerHTML = '<div class="text-center text-muted text-[11px] py-8">' +
                (q ? 'No notes match “' + escapeHtml(st.q) + '” this month.' : 'No notes were created in this month yet.') + '</div>';
            return;
        }

        let lastGroup = null;
        docs.forEach(d => {
            let g = null;
            if (st.sort === 'folder') { const f = state.folders.find(x => x.id === d.folderId); g = f ? (f.emoji + ' ' + f.name) : '🏠 No folder'; }
            else if (st.sort === 'created' || st.sort === 'edited') {
                const t = ts(st.sort === 'created' ? d.createdAt : d.updatedAt);
                g = t ? new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'No date';
            }
            if (g && g !== lastGroup) {
                lastGroup = g;
                const h = document.createElement('div');
                h.className = 'cm-gh';
                h.innerHTML = '<span>' + escapeHtml(g) + '</span>';
                list.appendChild(h);
            }

            const locked = isLocked(d);
            const isDaily = /^\d{4}-\d{2}-\d{2}$/.test((d.title || '').trim());
            const folder = state.folders.find(f => f.id === d.folderId);
            const words = wc(d);
            const meta = [];
            meta.push((st.sort === 'edited' ? 'Edited ' : 'Created ') +
                (ts(st.sort === 'edited' ? d.updatedAt : d.createdAt) ? new Date(ts(st.sort === 'edited' ? d.updatedAt : d.createdAt)).toLocaleDateString() : '—'));
            if (!locked) meta.push(words + (words === 1 ? ' word' : ' words'));
            if (folder && st.sort !== 'folder') meta.push(folder.emoji + ' ' + folder.name);
            if (d.eisDue) meta.push('Due ' + new Date(d.eisDue).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));

            const row = document.createElement('div');
            row.className = 'cm-row';
            row.innerHTML = `
                <span class="flex-shrink-0 ${isDaily ? 'text-amber-500' : locked ? 'text-accent' : 'text-gray-400'}">${
                    locked ? '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg>'
                    : isDaily ? '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/></svg>'
                    : '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'}</span>
                <button class="cm-open">
                    <span class="block text-xs font-medium text-text truncate">${escapeHtml(d.title || 'Untitled')}${d.pinned ? ' <span class="text-accent text-[9px]">PINNED</span>' : ''}${d.isFavorite ? ' <span class="text-gold">★</span>' : ''}</span>
                    <span class="block text-[9px] text-muted truncate">${escapeHtml(meta.join(' · '))}</span>
                </button>
                <button class="cm-ib cm-eye" title="Quick view"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.4 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.6 7c-1.3 4.1-5.1 7-9.6 7s-8.3-2.9-9.6-7z"/></svg></button>
                <button class="cm-ib cm-info" title="File info">${INFO_SVG}</button>
                <button class="cm-ib cm-dup" title="Duplicate">${DUP_SVG}</button>`;
            row.querySelector('.cm-open').onclick = () => zd48bOpen(d);
            row.querySelector('.cm-eye').onclick = (e) => { e.stopPropagation(); openEisGlance(d.id); };
            row.querySelector('.cm-info').onclick = (e) => { e.stopPropagation(); showDocInfo(d.id); };
            row.querySelector('.cm-dup').onclick = (e) => { e.stopPropagation(); duplicateDocFromSidebar(e, d.id); };
            list.appendChild(row);
        });
        list.scrollTop = keepTop; /* no scroll jump on re-render */
    };

    /* FIX: fully leave the calendar (and any stacked layer) before opening */
    function zd48bOpen(d) {
        try { document.getElementById('cm-search').blur(); } catch (e) {}
        try { closeEisGlance(); } catch (e) {}
        try { closeDayDetail(); } catch (e) {}
        try { closeCalPicker(); } catch (e) {}
        modal.classList.remove('open');
        setTimeout(() => openDoc(d.id, d), 30);
    }

    /* controls */
    $('cm-sort').addEventListener('change', () => {
        st.sort = $('cm-sort').value; localStorage.setItem('zdCmSort', st.sort); renderCalMonthNotes();
    });
    $('cm-dir').addEventListener('click', () => {
        st.dir = st.dir === 'desc' ? 'asc' : 'desc';
        localStorage.setItem('zdCmDir', st.dir);
        $('cm-dir').textContent = st.dir === 'desc' ? '↓' : '↑';
        renderCalMonthNotes();
    });
    let _cmT = null;
    $('cm-search').addEventListener('input', () => {
        st.q = $('cm-search').value;
        clearTimeout(_cmT); _cmT = setTimeout(renderCalMonthNotes, 160);
    });
    /* FIX (mobile): scrolling must never steal focus from the search box */
    ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach(ev => {
        $('cm-list').addEventListener(ev, (e) => { e.stopPropagation(); }, { passive: true });
    });
    ['focusin', 'pointerup', 'input'].forEach(ev =>
        $('cm-search').addEventListener(ev, () => { try { zdArmProtect($('cm-search')); } catch (e) {} }));
    const setPh = () => { $('cm-search').placeholder = window.innerWidth < 900 ? 'Search this month…' : 'Filter by title or text…'; };
    setPh(); window.addEventListener('resize', setPh);

    /* drag grip — kanban style, height remembered */
    $('cm-grip').addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const list = $('cm-list');
        const sy = e.clientY, sh = list.getBoundingClientRect().height;
        const move = (ev) => { list.style.height = Math.max(120, Math.min(560, sh + (ev.clientY - sy))) + 'px'; };
        const up = (ev) => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
            st.h = Math.round(Math.max(120, Math.min(560, sh + (ev.clientY - sy))));
            localStorage.setItem('zdCmH', st.h);
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    });

    /* follow month navigation + live sync */
    const _zd48bCal = renderCalendar;
    renderCalendar = function () { _zd48bCal(); try { renderCalMonthNotes(); } catch (e) {} };
    const _zd48bRefresh = refreshOpenViews;
    refreshOpenViews = function () {
        _zd48bRefresh();
        if (modal.classList.contains('open')) { try { renderCalMonthNotes(); } catch (e) {} }
    };

    /* FIX: glance "open in editor" must close every layer, including calendar */
    window.eisGlanceOpenFull = function () {
        const id = (typeof _eisGlanceId !== 'undefined') ? _eisGlanceId : null;
        const d = id ? state.docs.find(x => x.id === id) : null;
        try { closeEisGlance(); } catch (e) {}
        try { closeEisSection(); } catch (e) {}
        try { closeEisenhower(); } catch (e) {}
        try { closeDayDetail(); } catch (e) {}
        try { closeCalendar(); } catch (e) {}
        try { closeKanban(); } catch (e) {}
        try { if (window.closeHome) closeHome(); } catch (e) {}
        if (d) setTimeout(() => openDoc(d.id, d), 30);
        else showToast('That note is no longer available.');
    };
})();

    // New Code

     /* ============================================================
   V5.0 — HEADER TOOLBAR ORGANIZED (desktop + tablet)
   Groups the header icons into labelled clusters with dividers,
   moves rarely-used actions behind the ⋯ menu, and adds a compact
   tablet mode. Buttons are MOVED, so every handler and feature
   switch keeps working.
============================================================ */
(function zd50Header() {
    const bar = document.getElementById('logged-in-controls');
    if (!bar || bar.dataset.zd50) return;
    bar.dataset.zd50 = '1';

    document.head.insertAdjacentHTML('beforeend', `<style>
    #logged-in-controls { gap:0 !important; }
    .zd-hgrp { display:none; align-items:center; gap:1px; padding:0 4px; }
    @media (min-width:768px) { .zd-hgrp { display:flex; } }
    .zd-hsep { display:none; width:1px; height:20px; margin:0 3px; background:var(--border-color); flex-shrink:0; }
    @media (min-width:768px) { .zd-hsep { display:block; } }
    #logged-in-controls .zd-hgrp > button { position:relative; }
    /* tablet / small laptop: tighten spacing so nothing wraps */
    @media (min-width:768px) and (max-width:1180px) {
        .zd-hgrp { padding:0 2px; }
        .zd-hgrp > button { padding:6px !important; }
        .zd-hgrp > button svg { width:17px !important; height:17px !important; }
        .zd-hsep { margin:0 1px; height:18px; }
        #share-btn { padding-left:10px !important; padding-right:10px !important; margin-right:2px !important; }
        #folder-dd-btn { max-width:120px !important; }
        .zd-hgrp.zd-hgrp-low { display:none !important; } /* folded into ⋯ */
    }
    @media (min-width:768px) { #share-btn { order:-1; } }
    </style>`);

    const norm = s => (s || '').trim();
    const pick = id => document.getElementById(id);

    /* the four clusters, in display order */
    const PLAN = [
        { title: 'Document', ids: ['folder-dd-wrap'] },
        { title: 'Panels', ids: ['comments-btn'] },
        { title: 'Reading', ids: ['zen-btn'] },
        { title: 'Appearance', ids: ['theme-btn'] },
        { title: 'File', ids: ['duplicate-btn', 'download-btn'], low: true },
        { title: 'More', ids: ['more-btn-wrap'] },
        { title: 'Danger', ids: ['delete-btn'] }
    ];

    /* wrap #more-btn so it can be relocated with its dropdown */
    const moreBtn = pick('more-btn');
    if (moreBtn && moreBtn.parentElement && !pick('more-btn-wrap')) {
        moreBtn.parentElement.id = 'more-btn-wrap';
    }
    /* reading-mode + folder select have no ids on the button itself */
    const readBtn = Array.from(bar.querySelectorAll('button')).find(b => (b.getAttribute('title') || '').indexOf('Reading mode') === 0);
    if (readBtn && !readBtn.id) readBtn.id = 'zd-read-btn';

    const order = [
        { t: 'Document', ids: ['folder-dd-wrap'] },
        { t: 'Panels', ids: ['comments-btn'] },
        { t: 'Reading', ids: ['zd-read-btn', 'zen-btn'] },
        { t: 'Appearance', ids: ['theme-btn'] },
        { t: 'File', ids: ['duplicate-btn', 'download-btn'], low: true },
        { t: 'Tools', ids: ['more-btn-wrap'] },
        { t: 'Danger', ids: ['delete-btn'] }
    ];

    /* keep the mobile-only nodes exactly where they are */
    const mobileKeep = ['m-folder-btn', 'm-fav-btn', 'folder-select'];
    const mobileMenuWrap = bar.querySelector('.mobile-menu-container');

    const frag = document.createDocumentFragment();
    let first = true;
    order.forEach(g => {
        const nodes = g.ids.map(pick).filter(Boolean);
        if (!nodes.length) return;
        if (!first) {
            const sep = document.createElement('span');
            sep.className = 'zd-hsep';
            frag.appendChild(sep);
        }
        first = false;
        const wrap = document.createElement('span');
        wrap.className = 'zd-hgrp' + (g.low ? ' zd-hgrp-low' : '');
        wrap.title = g.t;
        nodes.forEach(n => wrap.appendChild(n));
        frag.appendChild(wrap);
    });

    /* rebuild: share first, grouped desktop clusters, then mobile controls */
    const share = pick('share-btn');
    const keepNodes = mobileKeep.map(pick).filter(Boolean);
    bar.appendChild(frag);
    keepNodes.forEach(n => bar.appendChild(n));
    if (mobileMenuWrap) bar.appendChild(mobileMenuWrap);
    if (share && share.parentElement !== bar.parentElement) { /* share lives outside the group bar already */ }

    /* on tablet widths, Duplicate + Download fold into the ⋯ menu */
    const scroll = document.getElementById('more-menu-scroll') || document.getElementById('more-menu');
    if (scroll && !scroll.dataset.zd50) {
        scroll.dataset.zd50 = '1';
        const h = document.createElement('div');
        h.className = 'zd-mgroup';
        h.id = 'zd50-file-group';
        h.textContent = 'File';
        const mk = (label, svg, fn) => {
            const b = document.createElement('button');
            b.className = 'zd-mi';
            b.id = 'zd50-mi-' + fn;
            b.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' + svg + '</svg> ' + label;
            b.onclick = () => { window[fn](); toggleMoreMenu(); };
            return b;
        };
        const dup = mk('Duplicate document', '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/>', 'duplicateCurrentDoc');
        const dl = mk('Download…', '<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>', 'openDownloadMenu');
        scroll.insertBefore(dl, scroll.firstChild);
        scroll.insertBefore(dup, scroll.firstChild);
        scroll.insertBefore(h, scroll.firstChild);
        /* show these two only when the header versions are hidden (tablet) */
        const sync = () => {
            const tablet = window.matchMedia('(min-width:768px) and (max-width:1180px)').matches;
            [h, dup, dl].forEach(el => el.classList.toggle('zd-feat-off', !tablet));
            try { zd46TidyGroups(); } catch (e) {}
        };
        sync();
        window.addEventListener('resize', sync);
    }

    /* refresh separators/groups when features are switched off */
    const _zd50AFF = applyFeatureFlags;
    applyFeatureFlags = function () {
        const r = _zd50AFF();
        document.querySelectorAll('#logged-in-controls .zd-hgrp').forEach(g => {
            const any = Array.from(g.children).some(c => !c.classList.contains('zd-feat-off'));
            g.classList.toggle('zd-feat-off', !any);
        });
        /* hide a separator whose neighbouring group is hidden */
        const kids = Array.from(document.querySelectorAll('#logged-in-controls > *'));
        kids.forEach((el, i) => {
            if (!el.classList.contains('zd-hsep')) return;
            let prev = null, next = null;
            for (let j = i - 1; j >= 0; j--) { if (kids[j].classList.contains('zd-hgrp')) { prev = kids[j]; break; } }
            for (let j = i + 1; j < kids.length; j++) { if (kids[j].classList.contains('zd-hgrp')) { next = kids[j]; break; } }
            const ok = prev && next && !prev.classList.contains('zd-feat-off') && !next.classList.contains('zd-feat-off');
            el.classList.toggle('zd-feat-off', !ok);
        });
        return r;
    };
    setTimeout(applyFeatureFlags, 300);
})();  


    /* ============================================================
   V5.1b — GUEST SHARED VIEW + AUTH POLISH
   • Full-bleed auth background on every pane (signin/signup/reset)
   • Smooth height morph between panes
   • Guest: real blurred sidebar w/ lock + sign-in, locked download,
     copy/print blocked, margins disabled, aesthetic banner
   • Screenshot shield hardened + never shown on the login screen
   • Login screen from a shared link shows no guest chrome
============================================================ */
(function zd51b() {
    if (window.__zd51b) return; window.__zd51b = true;
    const SITE = 'https://harshavarthanep.github.io/NotesV2/site/';

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ---------- AUTH: full background on every pane + smooth morph ---------- */
    #auth-screen.zd-auth { position:fixed !important; inset:0 !important; min-height:100dvh; }
    #auth-screen.zd-auth .zda-wrap { align-items:stretch; }
    #auth-screen.zd-auth .zda-brand { height:100%; }
    .zda-card { position:relative; transition:height .34s cubic-bezier(.22,1,.36,1); overflow:hidden; }
    .zda-pane { transition:opacity .22s ease, transform .28s cubic-bezier(.22,1,.36,1); }
    .zda-pane.out { opacity:0; transform:translateY(6px); pointer-events:none; }
    body.zd-authopen #gv-shield-msg, body.zd-authopen.gv-shield #paper-container { display:none !important; filter:none !important; }
    body.zd-authopen #preview-banner, body.zd-authopen #gv-nudge, body.zd-authopen #gv-panel { display:none !important; }

    /* ---------- GUEST banner ---------- */
    body.zd-guest #preview-banner { background:transparent !important; padding:0 !important; box-shadow:none !important; }
    .gv-bar { position:relative; display:flex; align-items:center; gap:11px; padding:9px 13px; color:#fff; overflow:hidden; background-image:var(--zd-grad); }
    .gv-bar::after { content:''; position:absolute; inset:0; background:linear-gradient(120deg,rgba(255,255,255,.17),transparent 46%,rgba(0,0,0,.24)); pointer-events:none; }
    .gv-bar>*{position:relative;z-index:2;}
    .gv-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.26);font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;}
    .gv-dot{width:6px;height:6px;border-radius:99px;background:#6ee7b7;box-shadow:0 0 0 3px rgba(110,231,183,.3);animation:offlinePulse 2.2s ease-in-out infinite;}
    .gv-t1{display:block;font-size:12.5px;font-weight:700;}
    .gv-t2{display:none;font-size:10px;opacity:.9;}
    @media(min-width:640px){.gv-t2{display:block;}}
    .gv-cta{display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:99px;background:#fff;color:#111827;font-size:11.5px;font-weight:800;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.25);}
    .gv-cta:active{transform:scale(.96);}
    .gv-more{display:none;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:#fff;opacity:.92;border-bottom:1px dotted rgba(255,255,255,.6);white-space:nowrap;}
    @media(min-width:760px){.gv-more{display:inline-flex;}}

    /* ---------- GUEST: locked chrome ---------- */
    body.zd-guest .gv-lock{position:relative;}
    body.zd-guest .gv-lock::after{content:'';position:absolute;right:0;bottom:0;width:11px;height:11px;border-radius:99px;background:var(--surface-color) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='3'%3E%3Crect x='5' y='11' width='14' height='10' rx='2'/%3E%3Cpath d='M8 11V7a4 4 0 018 0v4'/%3E%3C/svg%3E") center/8px no-repeat;}
    body.zd-guest .ql-editor,body.zd-guest #paper-container{user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none;}
    body.zd-guest .ql-editor img{pointer-events:none;}
    body.zd-guest #ruler-wrap{display:none!important;}   /* margins disabled */

    /* ---------- GUEST sidebar (blurred + locked) ---------- */
    body.zd-guest #sidebar{display:flex!important;}
    body.zd-guest #sidebar>div:not(#gv-gate){filter:blur(6px);opacity:.42;pointer-events:none;user-select:none;}
    #gv-gate{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;
        background:linear-gradient(180deg,rgba(20,20,24,.55),rgba(20,20,24,.82));backdrop-filter:blur(3px);}
    html:not(.dark) #gv-gate{background:linear-gradient(180deg,rgba(247,242,231,.62),rgba(247,242,231,.88));}
    #gv-gate .gv-ring{width:58px;height:58px;border-radius:99px;display:flex;align-items:center;justify-content:center;background-image:var(--zd-grad);box-shadow:0 12px 30px rgba(0,0,0,.45);margin-bottom:13px;animation:gvFloat 3.4s ease-in-out infinite;}
    @keyframes gvFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    #gv-gate .gv-h{font-size:13.5px;font-weight:800;color:#fff;}
    html:not(.dark) #gv-gate .gv-h{color:#332c22;}
    #gv-gate .gv-p{font-size:11px;line-height:1.5;color:#c9cdd6;margin:3px 0 14px;}
    html:not(.dark) #gv-gate .gv-p{color:#6b6252;}
    #gv-gate .gv-b{width:100%;max-width:210px;padding:10px 0;border-radius:13px;font-size:12px;font-weight:800;color:#fff;background-image:var(--zd-grad);box-shadow:0 8px 22px rgba(0,0,0,.4);}
    #gv-gate .gv-b:active{transform:scale(.97);}
    #gv-gate .gv-l{width:100%;max-width:210px;margin-top:7px;padding:8px 0;border-radius:13px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.25);color:#e5e7eb;display:flex;align-items:center;justify-content:center;gap:6px;}
    html:not(.dark) #gv-gate .gv-l{border-color:#e2d9c4;color:#4b4437;}

    /* ---------- nudge ---------- */
    #gv-nudge{position:fixed;bottom:20px;right:14px;z-index:118;max-width:272px;display:none;background:var(--surface-color);border:1px solid var(--border-color);border-radius:16px;padding:12px;box-shadow:0 18px 44px rgba(0,0,0,.3);}
    #gv-nudge.show{display:block;animation:fadeInUp .45s cubic-bezier(.16,1,.3,1);}
    @media(max-width:850px){#gv-nudge{bottom:14px;left:14px;right:14px;max-width:none;}}

    /* ---------- screenshot shield ---------- */
    body.zd-guest.gv-shield #paper-container,body.zd-guest.gv-shield .ql-editor{filter:blur(16px)!important;}
    #gv-shield-msg{position:fixed;inset:0;z-index:96;display:none;align-items:center;justify-content:center;background:rgba(10,10,14,.62);backdrop-filter:blur(6px);}
    body.zd-guest.gv-shield #gv-shield-msg{display:flex;}
    @media print{body.zd-guest *{visibility:hidden!important;}body.zd-guest::after{visibility:visible!important;content:'Protected shared note — sign in to ZenDocs to export.';position:fixed;left:0;top:40%;width:100%;text-align:center;font:600 14px Inter,sans-serif;}}
    </style>`);

    /* ---------- AUTH: smooth pane morph + no guest chrome on login ---------- */
    (function authMorph() {
        const card = document.getElementById('auth-box');
        if (!card || !window.zdAuthTab) return;
        ['zda-p-signin', 'zda-p-signup', 'zda-p-reset'].forEach(id => {
            const p = document.getElementById(id); if (p) p.classList.add('zda-pane');
        });
        const orig = window.zdAuthTab;
        window.zdAuthTab = function (t) {
            const h0 = card.getBoundingClientRect().height;
            const cur = card.querySelector('.zda-pane:not([style*="display: none"])');
            if (cur) cur.classList.add('out');
            card.style.height = h0 + 'px';
            setTimeout(() => {
                orig(t);
                const nxt = card.querySelector('.zda-pane:not([style*="display: none"])');
                if (nxt) nxt.classList.add('out');
                card.style.height = 'auto';
                const h1 = card.getBoundingClientRect().height;
                card.style.height = h0 + 'px';
                requestAnimationFrame(() => {
                    card.style.height = h1 + 'px';
                    if (nxt) nxt.classList.remove('out');
                    setTimeout(() => { card.style.height = ''; }, 380);
                });
            }, 140);
        };
    })();

    // <div class="flex gap-1.5 mt-2">
    //       <button id="gv-nudge-in" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg text-white active:scale-95 transition" style="background-image:var(--zd-grad)"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h12M13 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/></svg>Sign in — free</button>
    //       <a href="${SITE}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-muted hover:text-accent transition"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18"/></svg>Learn more</a>
    //     </div>

    document.body.insertAdjacentHTML('beforeend', `
    <div id="gv-nudge"><div class="flex items-start gap-2.5">
      <span class="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white" style="background-image:var(--zd-grad)"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11 15l-4 1 1-4 9.6-9.4z"/></svg></span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-text">Like what you see?</div>
        <div class="text-[10.5px] text-muted leading-snug">Create a free account to save this note and build your own workspace.</div>
        <div class="flex gap-1.5 mt-2">
          <button id="gv-nudge-in" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg text-white active:scale-95 transition" style="background-image:var(--zd-grad)">Sign in — free</button>
          <a href="${SITE}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-muted hover:text-accent transition">Learn more</a>
        </div>
      </div>
      <button id="gv-nudge-x" class="text-muted hover:text-danger text-base leading-none flex-shrink-0 active:scale-90">×</button>
    </div></div>
    <div id="gv-shield-msg"><div class="text-center px-6">
      <svg class="w-10 h-10 mx-auto text-white/90 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" d="M3 3l18 18"/></svg>
      <div class="text-white text-sm font-bold">Content hidden</div>
      <div class="text-white/70 text-[11px] mt-0.5">Sign in to ZenDocs to view and save this note.</div></div></div>`);

    const $ = id => document.getElementById(id);
    let strikes = 0, snoozed = 0, applied = false;
    const authOpen = () => !els.authScreen.classList.contains('hidden');

    function showNudge() { if (state.isGuest && !authOpen() && Date.now() >= snoozed) $('gv-nudge').classList.add('show'); }
    function hideNudge(s) { $('gv-nudge').classList.remove('show'); if (s) { snoozed = Date.now() + 120000; setTimeout(showNudge, 125000); } }
    $('gv-nudge-x').onclick = () => hideNudge(true);
    $('gv-nudge-in').onclick = () => { hideNudge(); openLoginForGuest(); };
    function locked(w) { strikes++; showToast('🔒 ' + w + ' needs a free ZenDocs account.', 3200); if (strikes >= 2) setTimeout(showNudge, 700); }
    window.zdGuestLocked = locked;

    function applyGuestUI() {
        if (!state.isGuest || applied) return;
        applied = true;
        document.body.classList.add('zd-guest');

        const b = els.previewBanner;
        b.className = 'z-[70]';
        b.innerHTML = `<div class="gv-bar">
            <span class="gv-badge"><span class="gv-dot"></span>Live · Read-only</span>
            <span class="flex-1 min-w-0"><span class="gv-t1">You're viewing a shared note</span><span class="gv-t2">Editing, copying and exporting are locked — sign in free to save your own copy.</span></span>
            <a class="gv-more" href="${SITE}" target="_blank" rel="noopener"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18"/></svg>What is ZenDocs?</a>
            <button class="gv-cta" id="gv-bar-in"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Save a copy</button></div>`;
        b.classList.remove('hidden');
        $('gv-bar-in').onclick = () => openLoginForGuest();

        /* real sidebar, blurred, with the lock gate on top */
        const sb = document.getElementById('sidebar');
        sb.classList.remove('hidden');
        sb.style.position = sb.style.position || '';
        if (!$('gv-gate')) {
            sb.insertAdjacentHTML('beforeend', `<div id="gv-gate">
                <span class="gv-ring"><svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg></span>
                <div class="gv-h">Workspace locked</div>
                <div class="gv-p">Folders, #tags, graph, daily notes,<br>boards and sync — free.</div>
                <button class="gv-b" id="gv-gate-in"><span class="inline-flex items-center justify-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h12M13 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/></svg>Sign in / Create account</span></button>
                <a class="gv-l" href="${SITE}" target="_blank" rel="noopener"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18"/></svg>Explore ZenDocs</a></div>`);
            $('gv-gate-in').onclick = () => openLoginForGuest();
        }
        els.hamburgerBtn.classList.remove('hidden');

        const dl = els.guestDownloadBtn;
        if (dl) { dl.classList.add('gv-lock'); dl.title = 'Download — sign in to unlock'; dl.onclick = (e) => { e.preventDefault(); locked('Downloading'); }; }
        els.title.disabled = false; els.title.readOnly = true;
        state.marginL = 96; state.marginR = 96;
        renderGuestOutline();
    }
    const _ld = window.loadGuestView;
    if (typeof _ld === 'function') window.loadGuestView = async function (i) { const r = await _ld(i); [400, 1200, 2600].forEach(t => setTimeout(applyGuestUI, t)); setTimeout(showNudge, 50000); return r; };
    const w = setInterval(() => { if (state.isGuest) { applyGuestUI(); if (applied) clearInterval(w); } }, 800);
    setTimeout(() => clearInterval(w), 30000);

    function renderGuestOutline() {
        const el = $('outline-list'); if (!el || !state.isGuest) return;
        const q = (($('outline-search') || {}).value || '').trim().toLowerCase();
        const items = [];
        try { quill.getLines(0, quill.getLength()).forEach(l => { const f = l.formats ? l.formats() : {}; if (f.header) items.push({ lvl: f.header, txt: ((l.domNode && l.domNode.textContent) || '').trim() || '(untitled)', node: l.domNode }); }); } catch (e) {}
        el.innerHTML = items.length ? '' : '<div class="text-[10px] text-muted">This note has no headings.</div>';
        items.forEach(it => {
            if (q && !it.txt.toLowerCase().includes(q)) return;
            const b = document.createElement('button');
            b.className = 'ol-item w-full text-left text-xs py-1 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-text transition flex items-center';
            b.style.paddingLeft = (4 + (Math.min(it.lvl, 4) - 1) * 13) + 'px';
            b.innerHTML = '<span class="ol-ch"></span><span class="truncate">' + escapeHtml(it.txt) + '</span>';
            b.onclick = () => { zdScrollToNode(it.node); };
            el.appendChild(b);
        });
    }
    const _ro = renderOutline; renderOutline = function () { return state.isGuest ? renderGuestOutline() : _ro(); };
    const os = $('outline-search'); if (os) os.addEventListener('input', () => { if (state.isGuest) renderGuestOutline(); });

    /* block copy / print / context menu / exports */
    ['copy', 'cut'].forEach(ev => document.addEventListener(ev, (e) => {
        if (!state.isGuest || (e.target.closest && e.target.closest('input,textarea'))) return;
        e.preventDefault();
        try { e.clipboardData && e.clipboardData.setData('text/plain', 'Shared via ZenDocs — ' + SITE); } catch (x) {}
        locked('Copying text');
    }, true));
    document.addEventListener('contextmenu', (e) => { if (state.isGuest && e.target.closest && e.target.closest('#paper-container')) { e.preventDefault(); locked('Saving content'); } }, true);
    document.addEventListener('dragstart', (e) => { if (state.isGuest && e.target.closest && e.target.closest('#paper-container')) e.preventDefault(); }, true);
    document.addEventListener('keydown', (e) => {
        if (!state.isGuest) return;
        const inF = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
        const k = (e.key || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'p', 's', 'a'].includes(k) && !inF) { e.preventDefault(); if (k !== 'a') locked(k === 'p' ? 'Printing' : k === 's' ? 'Saving' : 'Copying'); }
    }, true);
    const _dm = window.openDownloadMenu; window.openDownloadMenu = function () { if (state.isGuest) { locked('Downloading'); return; } return _dm(); };
    ['exportWord', 'exportPDF', 'exportText', 'exportMarkdown', 'copyMarkdown', 'publishWebpage'].forEach(fn => {
        const o = window[fn]; if (typeof o !== 'function') return;
        window[fn] = function () { if (state.isGuest) { locked('Exporting'); return; } return o.apply(this, arguments); };
    });

    /* screenshot shield — pre-emptive (keydown), never on the login screen */
    const shield = (ms) => {
        if (!state.isGuest || authOpen()) return;
        document.body.classList.add('gv-shield');
        clearTimeout(window.__gvT);
        window.__gvT = setTimeout(() => document.body.classList.remove('gv-shield'), ms || 1600);
    };
    document.addEventListener('keydown', (e) => {
        if (!state.isGuest) return;
        const k = e.key || '', c = e.code || '';
        if (k === 'PrintScreen' || c === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(k)) || (e.metaKey && k.toLowerCase() === 's' && e.shiftKey) || (e.shiftKey && e.metaKey && c === 'KeyS')) {
            shield(2200);
            try { navigator.clipboard.writeText('Shared via ZenDocs — sign in at ' + SITE); } catch (x) {}
            locked('Screenshots');
        }
    }, true);
    window.addEventListener('blur', () => shield(6000));
    window.addEventListener('focus', () => { document.body.classList.remove('gv-shield'); });
    document.addEventListener('visibilitychange', () => { document.visibilityState === 'visible' ? document.body.classList.remove('gv-shield') : shield(9000); });

    /* login screen: hide all guest chrome + back returns to the note */
    const _ol = window.openLoginForGuest;
    window.openLoginForGuest = function () {
        hideNudge(); document.body.classList.remove('gv-shield');
        document.body.classList.add('zd-authopen');
        try { history.pushState({ zdLogin: 1 }, '', location.href); } catch (e) {}
        const r = _ol(); els.authCancelContainer && els.authCancelContainer.classList.remove('hidden'); return r;
    };
    const _cl = window.closeLoginForGuest;
    window.closeLoginForGuest = function () {
        document.body.classList.remove('zd-authopen');
        const r = _cl();
        try { if (history.state && history.state.zdLogin) history.back(); } catch (e) {}
        return r;
    };
    window.addEventListener('popstate', () => { if (state.isGuest && authOpen()) { document.body.classList.remove('zd-authopen'); _cl(); } });
})();


