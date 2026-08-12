// ZenDocs — 12-weather-alerts-init.js
// V10/V10.5 live weather, sky & ambience, auto day/night theme, alert timing, plus final app init calls.
// (part of a mechanical split of the original single-file app; see README)

     /* ════════════════════════════════════════════════════════════
   V10 — LIVE WEATHER · SKY · AMBIENCE · AUTO DAY/NIGHT
   Consolidated build. Replaces V10.0 → V10.4 completely.

   A living sky behind your notes, driven by real conditions at
   your location: true solar arc, true lunar phase, rain, snow,
   lightning, fog, drifting light. Synthesised nature ambience.
   Automatic theme switching at your real sunrise and sunset.

   All state is DEVICE-LOCAL (localStorage). Nothing is written
   to Firestore, so every device reflects its own place and time.

   Switches — Features on this device:
     • wx        Live weather backdrop
     • autotheme Auto day / night theme
   ════════════════════════════════════════════════════════════ */
(function zdWeather() {
    if (window.__zdWx) return; window.__zdWx = true;

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const REFRESH   = 8 * 60 * 1000;   // ⚙ re-fetch conditions (8 min)
    const RETRY     = 45 * 1000;       // ⚙ retry when we have no real data yet
    const ALPHA     = 1;               // ⚙ sky strength 0–1
    const DENSITY   = 1;               // ⚙ particle multiplier (.5 half, 2 double)
    const AT_CHECK  = 3 * 60 * 1000;   // ⚙ auto-theme re-check
    const SND_VOL   = 0.34;            // ⚙ default ambience volume 0–1
    const DEBUG     = true;            // ⚙ false to silence console diagnostics
    /* ─────────────────────────────────────────────────────────── */

    const $ = id => document.getElementById(id);
    const mob = () => innerWidth < 620;
    const tab = () => innerWidth < 1000;
    const dens = () => (mob() ? .4 : tab() ? .68 : 1) * DENSITY;
    const log = (...a) => { if (DEBUG) console.log('%c[wx]', 'color:#4ade80;font-weight:700', ...a); };
    const guard = (n, f) => { try { return f(); } catch (e) { console.warn('[wx:' + n + ']', e); } };

    /* ═══════════ 1 · REGISTER SWITCHES FIRST (never lose them) ═══════════ */
    const IC = {
        clear:'<circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/>',
        moon:'<path stroke-linecap="round" stroke-linejoin="round" d="M20 15A9 9 0 118.6 3.6 7 7 0 0020 15z"/>',
        cloud:'<path stroke-linecap="round" stroke-linejoin="round" d="M4 15a4 4 0 004 4h9a5 5 0 10-.1-10 5 5 0 10-9.8 2A4 4 0 004 15z"/>',
        partly:'<path stroke-linecap="round" stroke-linejoin="round" d="M7 8a4 4 0 016.5-2M5 17a3.5 3.5 0 003.5 3.5H17a4 4 0 10-.5-8 4.5 4.5 0 00-8.4 1A3.5 3.5 0 005 17z"/>',
        rain:'<path stroke-linecap="round" stroke-linejoin="round" d="M5 14a4 4 0 004 4h8a4.5 4.5 0 10-.6-8.9A5 5 0 005 14zM8 20l-1 2m5-2l-1 2m5-2l-1 2"/>',
        snow:'<path stroke-linecap="round" stroke-linejoin="round" d="M5 13a4 4 0 004 4h8a4.5 4.5 0 10-.6-8.9A5 5 0 005 13zM9 20h.01M13 21h.01M17 20h.01"/>',
        storm:'<path stroke-linecap="round" stroke-linejoin="round" d="M5 13a4 4 0 004 4h1l3-4-1 5 3-1h1a4.5 4.5 0 10-.6-8.9A5 5 0 005 13z"/>',
        fog:'<path stroke-linecap="round" d="M4 9h16M4 13h16M6 17h12"/>',
        wind:'<path stroke-linecap="round" stroke-linejoin="round" d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h8a2.5 2.5 0 112.5 2.5"/>',
        hot:'<path stroke-linecap="round" stroke-linejoin="round" d="M10 14V5a2 2 0 114 0v9a4 4 0 11-4 0z"/>',
        pin:'<path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-5.6-7-10a7 7 0 1114 0c0 4.4-7 10-7 10zm0-8a3 3 0 100-6 3 3 0 000 6z"/>',
        vol:'<path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>',
        mute:'<path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM17 9l4 6m0-6l-4 6"/>'
    };
    (function register() {
        let n = 0;
        const iv = setInterval(() => {
            if (++n > 80) { clearInterval(iv); return; }
            if (typeof ZD_FEATURES === 'undefined') return;
            try {
                if (typeof ZD_FEAT_ICONS === 'undefined') window.ZD_FEAT_ICONS = {};
                if (!ZD_FEATURES.some(f => f.id === 'wx'))
                    ZD_FEATURES.push({ id: 'wx', label: 'Live weather backdrop', fns: [] });
                if (!ZD_FEATURES.some(f => f.id === 'autotheme'))
                    ZD_FEATURES.push({ id: 'autotheme', label: 'Auto day / night theme', fns: [] });
                ZD_FEAT_ICONS.wx = IC.rain;
                ZD_FEAT_ICONS.autotheme = IC.clear;
                clearInterval(iv);
                log('switches registered');
            } catch (e) {}
        }, 260);
    })();

    /* ═══════════ 2 · STYLES ═══════════ */
    guard('css', () => document.head.insertAdjacentHTML('beforeend', `<style>
    /* ---------- stage: lives INSIDE the editor, beneath the paper ---------- */
    #editor-wrapper{position:relative;}
    #editor-wrapper > #wx{position:fixed;z-index:0;pointer-events:none;overflow:hidden;
        opacity:0;transition:opacity 1.5s ease;}
    #editor-wrapper > #wx.on{opacity:${ALPHA};}
    #wx *{pointer-events:none;}
    #paper-container{position:relative!important;z-index:3!important;background:var(--paper-bg)!important;}
    #paper-container .ql-editor{position:relative;z-index:1;}
    #ruler-wrap{position:relative;z-index:4;}
    #wx .wl{position:absolute;inset:0;}

    /* ---------- sky ---------- */
    .wx-sky{position:absolute;inset:-1px;transition:background 2.4s ease;}
    .wx-horizon{position:absolute;left:-12%;right:-12%;bottom:-8%;height:52%;filter:blur(34px);opacity:.75;}

    /* ---------- sun / moon ---------- */
    .wx-orb{position:absolute;border-radius:99px;
        transition:left 4s linear,top 4s linear,opacity 1.6s ease,width .8s ease,height .8s ease;
        will-change:left,top;}
    .wx-sun{background:radial-gradient(circle,#fffef8 0%,#fff0bd 26%,rgba(255,209,110,.52) 52%,rgba(255,180,64,0) 76%);
        animation:wxSunP 8s ease-in-out infinite;}
    @keyframes wxSunP{0%,100%{filter:brightness(1)}50%{filter:brightness(1.09)}}
    .wx-moon{overflow:visible;}
    .wx-moon .mn-glow{fill:none;stroke:rgba(226,238,255,.2);stroke-width:11;filter:blur(8px);}
    .wx-moon .mn-dark{fill:#101827;opacity:.5;}
    .wx-moon .mn-lit{fill:#f8f9fd;}
    .wx-moon .mn-cr{fill:#cbd3e4;opacity:.5;}
    .wx-halo{position:absolute;border-radius:99px;transition:left 4s linear,top 4s linear,opacity 1.6s ease;}

    /* ---------- stars ---------- */
    .wx-star{position:absolute;border-radius:99px;background:#fff;animation:wxTw var(--tw,4s) ease-in-out infinite;}
    @keyframes wxTw{0%,100%{opacity:.12;transform:scale(.7)}50%{opacity:var(--mx,.9);transform:scale(1)}}
    .wx-shoot{position:absolute;width:2px;height:2px;border-radius:99px;background:#fff;opacity:0;}
    .wx-shoot.go{animation:wxSh 1.2s cubic-bezier(.3,0,.6,1) forwards;}
    @keyframes wxSh{0%{opacity:0;transform:translate(0,0)}
        10%{opacity:1;box-shadow:0 0 9px 2px #fff,-54px 54px 22px -9px rgba(255,255,255,.3)}
        100%{opacity:0;transform:translate(54vw,54vh)}}

    /* ---------- clouds ---------- */
    .wx-cloud{position:absolute;border-radius:99px;filter:blur(28px);will-change:transform;
        animation:wxDr linear infinite;}
    @keyframes wxDr{0%{transform:translateX(-48vw)}100%{transform:translateX(148vw)}}

    /* ---------- precipitation ---------- */
    .wx-drop{position:absolute;top:-10%;width:1.4px;border-radius:99px;will-change:transform;
        background:linear-gradient(180deg,transparent,var(--rc),transparent);animation:wxFa linear infinite;}
    @keyframes wxFa{to{transform:translate3d(var(--rx),128vh,0)}}
    .wx-splash{position:absolute;border-radius:99px;border:1px solid var(--sc);opacity:0;
        animation:wxSp 1.2s ease-out infinite;}
    @keyframes wxSp{0%{width:0;height:0;opacity:.75}100%{width:32px;height:10px;opacity:0}}
    .wx-flake{position:absolute;top:-8%;border-radius:99px;background:rgba(255,255,255,.92);
        will-change:transform;box-shadow:0 0 7px rgba(255,255,255,.55);animation:wxSn linear infinite;}
    @keyframes wxSn{0%{transform:translate3d(0,0,0) rotate(0)}
        50%{transform:translate3d(var(--sx),62vh,0) rotate(180deg)}
        100%{transform:translate3d(0,128vh,0) rotate(360deg)}}

    /* ---------- lightning ---------- */
    .wx-flash{position:absolute;inset:0;opacity:0;
        background:radial-gradient(140% 96% at var(--fx,50%) -14%,rgba(234,245,255,.96),rgba(160,198,255,.4) 42%,transparent 76%);}
    .wx-flash.go{animation:wxSt 1.6s steps(1) forwards;}
    @keyframes wxSt{0%{opacity:0}3%{opacity:.8}7%{opacity:.05}12%{opacity:.94}18%{opacity:.08}
        28%{opacity:.44}34%{opacity:.05}48%{opacity:.25}56%{opacity:0}100%{opacity:0}}
    .wx-bolt{position:absolute;inset:0;width:100%;height:100%;opacity:0;
        filter:drop-shadow(0 0 6px rgba(216,240,255,.95)) drop-shadow(0 0 24px rgba(132,184,255,.6));}
    .wx-bolt path{fill:none;stroke:#f8fdff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}
    .wx-bolt .bh{stroke:rgba(162,210,255,.5);stroke-width:7;filter:blur(3px);}
    .wx-bolt.go{animation:wxBo 1.6s steps(1) forwards;}
    @keyframes wxBo{0%,8%{opacity:0}10%{opacity:1}16%{opacity:0}25%{opacity:.9}31%{opacity:0}100%{opacity:0}}

    /* ---------- fog · wind · shimmer · motes ---------- */
    .wx-fog{position:absolute;left:-38%;right:-38%;height:50%;filter:blur(46px);will-change:transform;
        background:radial-gradient(ellipse at 50% 50%,var(--fc),transparent 68%);animation:wxFo linear infinite;}
    @keyframes wxFo{0%{transform:translateX(-28%)}50%{transform:translateX(28%)}100%{transform:translateX(-28%)}}
    .wx-gust{position:absolute;height:1.5px;border-radius:99px;opacity:0;will-change:transform;
        background:linear-gradient(90deg,transparent,var(--gc),transparent);animation:wxGu linear infinite;}
    @keyframes wxGu{0%{opacity:0;transform:translateX(-34vw)}12%{opacity:.75}80%{opacity:.5}
        100%{opacity:0;transform:translateX(134vw)}}
    .wx-shim{position:absolute;inset:0;opacity:.5;mix-blend-mode:overlay;
        background:repeating-linear-gradient(0deg,rgba(255,226,164,.06) 0 3px,transparent 3px 9px);
        animation:wxShi 5s ease-in-out infinite;}
    @keyframes wxShi{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
    .wx-mote{position:absolute;border-radius:99px;opacity:0;will-change:transform;animation:wxMo linear infinite;}
    @keyframes wxMo{0%{opacity:0;transform:translate(0,0)}14%{opacity:var(--mo)}
        86%{opacity:var(--mo)}100%{opacity:0;transform:translate(var(--mx2),var(--my2))}}

    /* ══════ AMBIENT CHROME ══════
       Translucent overlay ONLY. The underlying background colour and
       every text colour are untouched, so contrast can never break —
       this is what keeps the mobile sidebar readable. */
    body.wx-amb #sidebar,
    body.wx-amb .zd-header,
    body.wx-amb #toolbar.ql-toolbar,
    body.wx-amb #ruler-wrap{
        background-image:linear-gradient(160deg,var(--wxc1,transparent),var(--wxc2,transparent))!important;
        transition:background-image 2.4s ease;}
    body.wx-amb #views-row{
        background-image:linear-gradient(160deg,var(--wxc1,transparent),var(--wxc2,transparent))!important;
        transition:background-image 2.4s ease;}

    /* ══════ DUSK — light theme after dark ══════
       Only the SKY and the PAPER change. No chrome colours are
       overridden anywhere, on any screen size. */
    body.wx-dusk #wx .wx-sky{
        background:linear-gradient(178deg,#4b4674 0%,#7a6789 30%,#b3838a 58%,#dfa38c 82%,#f0c29e 100%)!important;}
    body.wx-dusk #wx .wx-star{opacity:.3!important;animation:none!important;}
    body.wx-dusk #wx .wx-mote{opacity:.38!important;}
    body.wx-dusk #wx .wx-moon .mn-lit{fill:#fff7ec;}
    body.wx-dusk #wx .wx-moon .mn-dark{fill:#5d5274;opacity:.38;}
    body.wx-dusk #wx .wx-halo{background:radial-gradient(circle,rgba(255,234,206,.28),transparent 66%)!important;}
    body.wx-dusk #wx .wx-horizon{
        background:radial-gradient(ellipse at 50% 100%,rgba(255,208,152,.52),transparent 72%)!important;opacity:1;}
    body.wx-dusk #paper-container{
        background:linear-gradient(175deg,#fffbf3,#fdf4e6 60%,#faeddd)!important;
        box-shadow:0 0 0 1px rgba(162,122,82,.1),0 18px 60px rgba(58,34,18,.2),
                   0 0 100px 30px rgba(255,212,152,.13)!important;}

    /* dark theme in daylight — the mirror case */
    body.wx-daydark #wx .wx-sky{
        background:linear-gradient(178deg,#1b2740 0%,#2b3b59 46%,#3a4c68 100%)!important;}
    body.wx-daydark #wx .wx-sun{opacity:.5;}
    body.wx-daydark #wx .wx-cloud{opacity:.48;}
    body.wx-daydark #wx.on{opacity:.7;}

    /* ══════ MOBILE ══════ */
    @media (max-width:900px){
        body.zd-wx-sb #wx{opacity:0!important;visibility:hidden!important;}
        #editor-wrapper > #wx.on{opacity:.8;}
        #wx-btn{display:none!important;}
    }
    @media (min-width:901px){ #wx-btn.on{display:inline-flex!important;} }

    /* ══════ HEADER BUTTON ══════ */
    #wx-btn{display:none;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:99px;
        font-size:11.5px;font-weight:800;color:var(--text-color);flex-shrink:0;
        background:rgba(127,127,127,.12);transition:all .16s ease;white-space:nowrap;}
    #wx-btn:hover{background:rgba(127,127,127,.2);}
    #wx-btn:active{transform:scale(.94);}
    #wx-btn svg{width:15px;height:15px;flex-shrink:0;}
    #wx-btn .wxb-t{font-variant-numeric:tabular-nums;}
    #wx-btn .wxb-s{width:6px;height:6px;border-radius:99px;background:#4ade80;flex-shrink:0;
        box-shadow:0 0 6px #4ade80;display:none;}
    #wx-btn.snd .wxb-s{display:block;animation:wxbP 1.6s ease-in-out infinite;}
    @keyframes wxbP{0%,100%{opacity:.5}50%{opacity:1}}
    @media(max-width:1180px){ #wx-btn .wxb-l{display:none;} }

    /* ══════ PANEL ══════ */
    #wx-p{position:fixed;inset:0;z-index:128;display:none;align-items:flex-end;justify-content:center;
        background:rgba(4,6,11,.6);backdrop-filter:blur(8px);}
    #wx-p.open{display:flex;animation:fadeIn .22s ease-out;}
    @media(min-width:640px){#wx-p{align-items:center;padding:18px;}}
    #wx-pb{width:100%;max-width:404px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;
        background:var(--surface-color);border:1px solid var(--border-color);
        border-radius:22px 22px 0 0;box-shadow:0 -22px 62px rgba(0,0,0,.5);
        animation:dr2Up .4s cubic-bezier(.22,1,.36,1);}
    @media(min-width:640px){#wx-pb{border-radius:22px;animation:boxIn .34s cubic-bezier(.22,1,.36,1);}}
    #wx-hero{position:relative;padding:20px;flex-shrink:0;color:#fff;overflow:hidden;transition:background 1.8s ease;}
    #wx-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.42));}
    #wx-hero > *{position:relative;z-index:2;}
    #wx-hx{position:absolute;top:12px;right:12px;z-index:3;width:30px;height:30px;border-radius:99px;
        display:flex;align-items:center;justify-content:center;font-size:19px;color:rgba(255,255,255,.78);
        background:rgba(255,255,255,.14);}
    #wx-hx:hover{color:#fff;background:rgba(255,255,255,.26);}
    .wx-temp{font-size:44px;font-weight:200;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
    .wx-cond{font-size:13px;font-weight:700;margin-top:2px;}
    .wx-place{font-size:10.5px;opacity:.84;margin-top:3px;display:flex;align-items:center;gap:4px;}
    .wx-place svg{width:11px;height:11px;}
    #wx-body{flex:1;min-height:0;overflow-y:auto;padding:14px 16px 20px;}
    .wx-g{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:14px;}
    .wx-c{padding:11px;border-radius:13px;background:var(--bg-color);border:1px solid var(--border-color);}
    .wx-c b{display:block;font-size:15px;font-weight:800;color:var(--text-color);line-height:1.2;font-variant-numeric:tabular-nums;}
    .wx-c span{display:block;font-size:8.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#9ca3af;margin-top:2px;}
    .wx-l{display:flex;align-items:center;gap:7px;font-size:8.5px;font-weight:900;letter-spacing:.13em;
        text-transform:uppercase;color:#9ca3af;margin:0 0 9px;}
    .wx-l::after{content:'';flex:1;height:1px;background:var(--border-color);opacity:.7;}
    .wx-h{display:flex;gap:5px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px;scrollbar-width:none;}
    .wx-h::-webkit-scrollbar{display:none}
    .wx-h > div{flex:0 0 auto;width:54px;text-align:center;padding:9px 0;border-radius:11px;
        background:var(--bg-color);border:1px solid var(--border-color);}
    .wx-h i{display:block;font-size:8.5px;font-style:normal;font-weight:800;color:#9ca3af;}
    .wx-h svg{width:15px;height:15px;margin:4px auto;color:var(--text-color);opacity:.82;}
    .wx-h b{display:block;font-size:11.5px;font-weight:800;color:var(--text-color);font-variant-numeric:tabular-nums;}
    .wx-h u{display:block;font-size:8px;text-decoration:none;color:#38bdf8;font-weight:800;margin-top:1px;}
    .wx-snd{display:flex;align-items:center;gap:11px;padding:12px;border-radius:14px;
        background:var(--bg-color);border:1px solid var(--border-color);}
    #wx-sb{width:42px;height:42px;border-radius:99px;flex-shrink:0;display:flex;align-items:center;
        justify-content:center;color:#fff;background-image:var(--zd-grad);
        box-shadow:0 6px 16px rgba(0,0,0,.26);transition:transform .15s ease;}
    #wx-sb:active{transform:scale(.93);}
    #wx-sb svg{width:19px;height:19px;}
    #wx-sb.off{background:rgba(127,127,127,.2);background-image:none;color:#9ca3af;box-shadow:none;}
    #wx-vol{width:100%;-webkit-appearance:none;appearance:none;height:4px;border-radius:99px;outline:none;
        background:var(--border-color);margin-top:8px;}
    #wx-vol::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:99px;
        background:rgb(var(--accent-rgb));cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);}
    #wx-vol::-moz-range-thumb{width:15px;height:15px;border:0;border-radius:99px;background:rgb(var(--accent-rgb));}
    .wx-bars{display:flex;align-items:flex-end;gap:2px;height:16px;margin-top:5px;}
    .wx-bars i{flex:1;border-radius:2px;background:rgb(var(--accent-rgb) / .45);height:3px;}
    .wx-snd.live .wx-bars i{animation:wxEq 1.1s ease-in-out infinite;}
    @keyframes wxEq{0%,100%{height:3px}50%{height:14px}}
    #wx-ref{width:100%;margin-top:9px;padding:9px 0;border-radius:12px;font-size:11px;font-weight:800;
        background:var(--bg-color);border:1px solid var(--border-color);color:var(--text-color);}
    #wx-ref:hover{border-color:rgb(var(--accent-rgb));color:rgb(var(--accent-rgb));}
    #wx-note{font-size:9.5px;color:#9ca3af;text-align:center;margin-top:8px;line-height:1.5;}

    /* ══════ ALERT ══════ */
    #wx-al{position:fixed;inset:0;z-index:130;display:none;align-items:center;justify-content:center;
        background:rgba(4,6,11,.68);backdrop-filter:blur(9px);padding:18px;}
    #wx-al.open{display:flex;animation:fadeIn .24s ease-out;}
    #wx-alb{width:100%;max-width:340px;border-radius:22px;overflow:hidden;
        background:var(--surface-color);border:1px solid var(--border-color);
        box-shadow:0 26px 66px rgba(0,0,0,.55);animation:boxIn .36s cubic-bezier(.22,1,.36,1);}
    #wx-alh{padding:26px 20px 20px;text-align:center;color:#fff;position:relative;overflow:hidden;}
    #wx-alh::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent,rgba(0,0,0,.3));}
    #wx-alh > *{position:relative;z-index:2;}
    #wx-ali{width:58px;height:58px;margin:0 auto 12px;border-radius:99px;display:flex;align-items:center;
        justify-content:center;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);
        animation:wxAlF 2.6s ease-in-out infinite;}
    @keyframes wxAlF{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    #wx-ali svg{width:28px;height:28px;}
    #wx-alt{font-size:17px;font-weight:800;letter-spacing:-.01em;}
    #wx-als{font-size:12px;opacity:.9;margin-top:5px;line-height:1.55;}
    #wx-alf{padding:16px;}
    #wx-alg{width:100%;padding:12px 0;border-radius:13px;font-size:12.5px;font-weight:900;color:#fff;
        background-image:var(--zd-grad);box-shadow:0 8px 22px rgb(var(--accent-rgb) / .3);}
    #wx-alg:active{transform:scale(.98);}

    @media (prefers-reduced-motion:reduce){
        #wx .wx-drop,#wx .wx-flake,#wx .wx-cloud,#wx .wx-gust,#wx .wx-fog,#wx .wx-shim,#wx .wx-mote{animation:none!important}
        #editor-wrapper > #wx.on{opacity:.4}
    }
    </style>`));

    /* ═══════════ 3 · STAGE ═══════════ */
    let WX = null, WL = null, absMode = false;
    function mount() {
        const host = $('editor-wrapper');
        if (!host) return false;
        if (!WX) {
            host.insertAdjacentHTML('afterbegin', '<div id="wx"><div class="wl" id="wx-l"></div></div>');
            WX = $('wx'); WL = $('wx-l');
        } else if (WX.parentElement !== host) host.insertBefore(WX, host.firstChild);
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        /* a transformed / filtered ancestor breaks position:fixed — detect once */
        let el = host;
        while (el && el !== document.body) {
            const cs = getComputedStyle(el);
            if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none') { absMode = true; break; }
            el = el.parentElement;
        }
        return true;
    }
    function fit() {
        const host = $('editor-wrapper');
        if (!WX || !host) return;
        if (absMode) {
            WX.style.position = 'absolute';
            WX.style.left = '0'; WX.style.top = '0'; WX.style.width = '100%';
            WX.style.height = Math.max(host.scrollHeight, host.clientHeight) + 'px';
        } else {
            const r = host.getBoundingClientRect();
            WX.style.position = 'fixed';
            WX.style.left = r.left + 'px'; WX.style.top = r.top + 'px';
            WX.style.width = r.width + 'px'; WX.style.height = r.height + 'px';
        }
        placeOrb();
    }
    guard('mount', () => { mount(); fit(); });
    setInterval(() => { mount(); fit(); }, 900);
    addEventListener('resize', fit);
    addEventListener('scroll', fit, true);

    /* ═══════════ 4 · ASTRONOMY ═══════════ */
    const LBL = { clear:'Clear', mostly:'Mostly clear', partly:'Partly cloudy', overcast:'Overcast',
        fog:'Fog', drizzle:'Drizzle', rain:'Rain', sleet:'Sleet', snow:'Snow', storm:'Thunderstorm' };
    function bucket(c) {
        if (c === 0) return 'clear'; if (c === 1) return 'mostly';
        if (c === 2) return 'partly'; if (c === 3) return 'overcast';
        if (c === 45 || c === 48) return 'fog';
        if (c >= 51 && c <= 57) return 'drizzle';
        if ((c >= 61 && c <= 65) || (c >= 80 && c <= 82)) return 'rain';
        if (c === 66 || c === 67) return 'sleet';
        if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
        if (c >= 95) return 'storm';
        return 'clear';
    }
    const kIcon = (k, day) => k === 'storm' ? IC.storm : (k === 'snow' || k === 'sleet') ? IC.snow
        : (k === 'rain' || k === 'drizzle') ? IC.rain : k === 'fog' ? IC.fog
        : k === 'overcast' ? IC.cloud : (k === 'partly' || k === 'mostly') ? IC.partly
        : day ? IC.clear : IC.moon;

    let W = null, lastPaint = 0, boltT = null, shootT = null;
    const on = () => { try { return typeof zdFeatOn !== 'function' || zdFeatOn('wx'); } catch (e) { return true; } };
    const autoOn = () => { try { return typeof zdFeatOn === 'function' && zdFeatOn('autotheme'); } catch (e) { return false; } };

    function skyPos() {
        const n = Date.now();
        if (W && W.sunrise && W.sunset) {
            if (n >= W.sunrise && n <= W.sunset) {
                const t = (n - W.sunrise) / (W.sunset - W.sunrise);
                return { day: true, t: t };
            }
            const b = n > W.sunset ? W.sunset : W.sunset - 864e5;
            const a = n > W.sunset ? W.sunrise + 864e5 : W.sunrise;
            return { day: false, t: Math.max(0, Math.min(1, (n - b) / (a - b))) };
        }
        const h = new Date().getHours() + new Date().getMinutes() / 60;
        const day = h >= 6 && h < 18;
        return { day: day, t: day ? (h - 6) / 12 : ((h < 6 ? h + 6 : h - 18) / 12) };
    }
    function phase() {
        const known = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853 * 864e5;
        return ((((Date.now() - known) % syn) + syn) % syn) / syn;
    }
    function phaseName(p) {
        if (p < .034 || p > .966) return 'New moon';
        if (p < .216) return 'Waxing crescent';
        if (p < .284) return 'First quarter';
        if (p < .466) return 'Waxing gibbous';
        if (p < .534) return 'Full moon';
        if (p < .716) return 'Waning gibbous';
        if (p < .784) return 'Last quarter';
        return 'Waning crescent';
    }
    /* lit region = outer limb + terminator ellipse (the real construction) */
    function moonSvg(size) {
        const p = phase(), R = 30, cx = 33, cy = 33;
        const k = Math.cos(2 * Math.PI * p);
        const rx = Math.abs(R * k).toFixed(3);
        const s1 = p < .5 ? 1 : 0;
        const s2 = (k < 0) ? (1 - s1) : s1;
        const lit = `M ${cx} ${cy - R} A ${R} ${R} 0 0 ${s1} ${cx} ${cy + R} A ${rx} ${R} 0 0 ${s2} ${cx} ${cy - R} Z`;
        const id = 'mc' + Math.random().toString(36).slice(2, 7);
        return `<svg class="wx-orb wx-moon" viewBox="0 0 66 66" style="width:${size}px;height:${size}px;margin:${-size/2}px 0 0 ${-size/2}px">
          <defs><clipPath id="${id}"><path d="${lit}"/></clipPath></defs>
          <circle class="mn-glow" cx="${cx}" cy="${cy}" r="${R - 1}"/>
          <circle class="mn-dark" cx="${cx}" cy="${cy}" r="${R}"/>
          <path class="mn-lit" d="${lit}"/>
          <g clip-path="url(#${id})">
            <circle class="mn-cr" cx="25" cy="24" r="6.2"/><circle class="mn-cr" cx="41" cy="36" r="4.6"/>
            <circle class="mn-cr" cx="29" cy="43" r="3.4"/><circle class="mn-cr" cx="44" cy="23" r="2.6"/>
            <circle class="mn-cr" cx="21" cy="38" r="2.2"/>
          </g></svg>`;
    }
    function pal(k, day, t) {
        const dawn = day && t < .13, dusk = day && t > .87;
        if (!day) {
            if (k === 'storm') return ['#05070f', '#0e1728', '#080d1a'];
            if (k === 'rain' || k === 'drizzle' || k === 'sleet') return ['#070c17', '#101b2e', '#0a1120'];
            if (k === 'snow') return ['#0a1120', '#18243f', '#0d1526'];
            if (k === 'fog') return ['#0b0f17', '#1b212e', '#0f141f'];
            if (k === 'overcast') return ['#06090f', '#121722', '#090d15'];
            return ['#040713', '#0c1731', '#07101f'];
        }
        if (dawn) return ['#31406b', '#ef9a68', '#ffd6a2'];
        if (dusk) return ['#243055', '#e8785a', '#ffc08c'];
        if (k === 'storm') return ['#48536a', '#6c7891', '#59647a'];
        if (k === 'rain' || k === 'drizzle' || k === 'sleet') return ['#6f8397', '#93a6bd', '#7f92a9'];
        if (k === 'snow') return ['#a3b1c4', '#d3dce8', '#b6c2d2'];
        if (k === 'fog') return ['#b0b8c4', '#d6dce4', '#c2c9d3'];
        if (k === 'overcast') return ['#8b98aa', '#adb9c8', '#9aa6b6'];
        if (k === 'partly' || k === 'mostly') return ['#5da0e8', '#a8d6f8', '#7db8ee'];
        return ['#4a90e2', '#9ecffa', '#6aa9ec'];
    }

    /* ═══════════ 5 · ORB PLACEMENT (always visible beside the paper) ═══════════ */
    function placeOrb() {
        if (!WX) return;
        const orb = WX.querySelector('.wx-orb'), halo = WX.querySelector('.wx-halo');
        if (!orb) return;
        const paper = $('paper-container');
        const wr = WX.getBoundingClientRect();
        if (!wr.width || !wr.height) return;
        const pos = skyPos();
        let x, y, size;

        if (paper && paper.offsetParent !== null) {
            const pr = paper.getBoundingClientRect();
            const left = Math.max(0, pr.left - wr.left);
            const right = Math.max(0, wr.right - pr.right);
            const top = Math.max(0, pr.top - wr.top);
            const band = Math.max(left, right);
            if (band >= 110) {
                /* a real margin: the orb rides the sky beside the page */
                size = Math.min(104, Math.max(56, band * .52));
                const cx = (left >= right) ? left / 2 : wr.width - right / 2;
                /* drift gently within the band across the day */
                x = ((cx + (pos.t - .5) * band * .3) / wr.width) * 100;
                y = 70 - Math.sin(pos.t * Math.PI) * 52;
            } else if (top >= 90) {
                size = Math.min(84, Math.max(48, top * .58));
                x = 8 + pos.t * 84;
                y = ((top / 2) / wr.height) * 100;
            } else {
                /* no room — a soft glow only, high on the sky */
                size = 0;
                x = 8 + pos.t * 84; y = 8;
            }
        } else { size = 96; x = 8 + pos.t * 84; y = 68 - Math.sin(pos.t * Math.PI) * 54; }

        if (size === 0) { orb.style.opacity = '0'; }
        else {
            orb.style.opacity = '';
            orb.style.width = size + 'px'; orb.style.height = size + 'px';
            orb.style.margin = (-size / 2) + 'px 0 0 ' + (-size / 2) + 'px';
        }
        orb.style.left = x.toFixed(2) + '%'; orb.style.top = y.toFixed(2) + '%';
        if (halo) {
            const hs = Math.max(140, size * 2.6);
            halo.style.width = hs + 'px'; halo.style.height = hs + 'px';
            halo.style.margin = (-hs / 2) + 'px 0 0 ' + (-hs / 2) + 'px';
            halo.style.left = x.toFixed(2) + '%'; halo.style.top = y.toFixed(2) + '%';
        }
    }

    /* ═══════════ 6 · PAINT ═══════════ */
    function paint() {
        if (!WX || !WL) { mount(); if (!WX) return; }
        if (!on()) { WX.classList.remove('on'); WL.innerHTML = ''; stopT(); tint(null); mood(); return; }
        const k = W ? bucket(W.code) : 'clear';
        const pos = skyPos();
        const day = W && W.isDay !== undefined ? !!W.isDay : pos.day;
        const [a, b, c] = pal(k, day, pos.t);
        const s = dens();
        let h = '';

        h += `<div class="wx-sky" style="background:linear-gradient(${day ? '178deg' : '176deg'},${a} 0%,${b} 54%,${c} 100%)"></div>`;
        h += `<div class="wx-horizon" style="background:radial-gradient(ellipse at 50% 100%,${day ? 'rgba(255,238,196,.34)' : 'rgba(88,120,192,.2)'},transparent 70%)"></div>`;

        if (!day) {
            for (let i = 0; i < Math.round(115 * s); i++) {
                const sz = Math.random() < .1 ? 2.6 : Math.random() < .38 ? 1.8 : 1.2;
                h += `<span class="wx-star" style="left:${(Math.random()*100).toFixed(2)}%;top:${(Math.random()*80).toFixed(2)}%;
                    width:${sz}px;height:${sz}px;--tw:${(2.4+Math.random()*5.5).toFixed(1)}s;
                    --mx:${(.45+Math.random()*.55).toFixed(2)};animation-delay:${(Math.random()*6).toFixed(1)}s"></span>`;
            }
            h += '<span class="wx-shoot" id="wx-sh" style="left:6%;top:8%"></span>';
        }

        const closed = k === 'overcast' || k === 'storm' || k === 'fog';
        if (!closed) {
            h += `<span class="wx-halo" style="background:radial-gradient(circle,${day ? 'rgba(255,234,172,.22)' : 'rgba(186,212,255,.16)'},transparent 66%)"></span>`;
            h += day ? '<span class="wx-orb wx-sun"></span>' : moonSvg(72);
        }

        const CN = { clear:0, mostly:2, partly:5, overcast:9, fog:3, drizzle:7, rain:8, sleet:8, snow:7, storm:10 }[k] || 0;
        for (let i = 0; i < Math.round(CN * (mob() ? .55 : 1)); i++) {
            const w = 150 + Math.random() * 300, ht = w * (.26 + Math.random() * .18);
            const ct = day ? (k === 'storm' ? 'rgba(56,64,80,.85)' : k === 'overcast' ? 'rgba(150,162,180,.68)' : 'rgba(255,255,255,.66)')
                           : (k === 'storm' ? 'rgba(12,18,32,.9)' : 'rgba(44,58,86,.58)');
            h += `<span class="wx-cloud" style="top:${(1+Math.random()*48).toFixed(1)}%;left:0;
                width:${w.toFixed(0)}px;height:${ht.toFixed(0)}px;background:${ct};
                animation-duration:${(56+Math.random()*100).toFixed(0)}s;animation-delay:-${(Math.random()*100).toFixed(0)}s"></span>`;
        }

        if (k === 'rain' || k === 'drizzle' || k === 'storm' || k === 'sleet') {
            const heavy = k === 'storm' || k === 'rain';
            const rc = day ? 'rgba(196,218,246,.55)' : 'rgba(172,202,248,.6)';
            for (let i = 0; i < Math.round((heavy ? 140 : 66) * s); i++) {
                h += `<span class="wx-drop" style="left:${(Math.random()*108-4).toFixed(1)}%;
                    height:${(heavy?13+Math.random()*24:8+Math.random()*13).toFixed(0)}vh;
                    --rc:${rc};--rx:${(-2-Math.random()*5).toFixed(1)}vw;
                    animation-duration:${(heavy?.48+Math.random()*.34:.82+Math.random()*.5).toFixed(2)}s;
                    animation-delay:-${(Math.random()*2).toFixed(2)}s;opacity:${(.3+Math.random()*.55).toFixed(2)}"></span>`;
            }
            for (let i = 0; i < Math.round(11 * s); i++)
                h += `<span class="wx-splash" style="left:${(Math.random()*100).toFixed(1)}%;bottom:${(Math.random()*18).toFixed(1)}%;
                    --sc:${day?'rgba(210,228,255,.5)':'rgba(170,200,250,.4)'};animation-delay:-${(Math.random()*1.2).toFixed(2)}s"></span>`;
        }
        if (k === 'snow' || k === 'sleet') {
            for (let i = 0; i < Math.round(64 * s); i++) {
                const sz = 2 + Math.random() * 4.5;
                h += `<span class="wx-flake" style="left:${(Math.random()*100).toFixed(1)}%;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;
                    --sx:${(Math.random()*9-4.5).toFixed(1)}vw;animation-duration:${(9+Math.random()*10).toFixed(1)}s;
                    animation-delay:-${(Math.random()*16).toFixed(1)}s;opacity:${(.38+Math.random()*.58).toFixed(2)}"></span>`;
            }
        }
        if (k === 'fog' || (k === 'overcast' && !day)) {
            const fc = day ? 'rgba(226,232,242,.44)' : 'rgba(76,92,120,.36)';
            for (let i = 0; i < 3; i++)
                h += `<span class="wx-fog" style="top:${16+i*27}%;--fc:${fc};animation-duration:${48+i*24}s;animation-delay:-${i*16}s"></span>`;
        }
        if (W && W.wind > 16) {
            for (let i = 0; i < Math.round(8 * s); i++)
                h += `<span class="wx-gust" style="top:${(8+Math.random()*78).toFixed(1)}%;width:${(90+Math.random()*200).toFixed(0)}px;
                    --gc:${day?'rgba(255,255,255,.4)':'rgba(180,205,255,.3)'};
                    animation-duration:${(2.2+Math.random()*2.8).toFixed(1)}s;animation-delay:-${(Math.random()*4).toFixed(1)}s"></span>`;
        }
        if (k === 'clear' || k === 'mostly' || k === 'partly') {
            for (let i = 0; i < Math.round(16 * s); i++) {
                const sz = day ? 2 + Math.random() * 2 : 2.4 + Math.random() * 2.4;
                h += `<span class="wx-mote" style="left:${(Math.random()*100).toFixed(1)}%;top:${(20+Math.random()*70).toFixed(1)}%;
                    width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;
                    background:${day?'rgba(255,248,214,.9)':'rgba(198,255,170,.95)'};
                    box-shadow:0 0 ${day?6:9}px ${day?2:3}px ${day?'rgba(255,232,150,.5)':'rgba(150,255,120,.55)'};
                    --mo:${day?.55:.85};--mx2:${(Math.random()*30-15).toFixed(0)}vw;--my2:${(-14-Math.random()*26).toFixed(0)}vh;
                    animation-duration:${(14+Math.random()*16).toFixed(0)}s;animation-delay:-${(Math.random()*24).toFixed(0)}s"></span>`;
            }
        }
        if (day && k === 'clear' && W && W.temp >= 33) h += '<span class="wx-shim"></span>';
        if (k === 'storm') h += '<div class="wx-flash" id="wx-fl"></div><svg class="wx-bolt" id="wx-bo" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';

        WL.innerHTML = h;
        WX.classList.add('on');
        stopT();
        if (k === 'storm') schedBolt();
        if (!day) schedShoot();
        tint([a, b]); chip(k, day); mood();
        lastPaint = Date.now();
        fit();
    }
    /* translucent chrome overlay — never overrides a colour */
    function tint(cols) {
        const r = document.documentElement.style;
        if (!cols || !on()) { document.body.classList.remove('wx-amb'); r.removeProperty('--wxc1'); r.removeProperty('--wxc2'); return; }
        const hex = c => { const m = c.replace('#',''); return [parseInt(m.slice(0,2),16),parseInt(m.slice(2,4),16),parseInt(m.slice(4,6),16)]; };
        const [r1,g1,b1] = hex(cols[0]), [r2,g2,b2] = hex(cols[1]);
        r.setProperty('--wxc1', `rgba(${r1},${g1},${b1},.17)`);
        r.setProperty('--wxc2', `rgba(${r2},${g2},${b2},.1)`);
        document.body.classList.add('wx-amb');
    }
    function isNight() {
        if (W && W.sunrise && W.sunset) { const n = Date.now(); return !(n >= W.sunrise && n <= W.sunset); }
        if (W && W.isDay !== undefined) return !W.isDay;
        const h = new Date().getHours(); return h < 6 || h >= 18;
    }
    function mood() {
        const live = on() && WX && WX.classList.contains('on');
        const light = !document.documentElement.classList.contains('dark');
        const night = isNight();
        document.body.classList.toggle('wx-dusk', !!(live && light && night));
        document.body.classList.toggle('wx-daydark', !!(live && !light && !night));
    }
    setInterval(mood, 2000);
    guard('mood-obs', () => new MutationObserver(mood).observe(document.documentElement, { attributes:true, attributeFilter:['class'] }));

    function chip(k, day) {
        const btn = $('wx-btn'); if (!btn) return;
        if (!on() || !W) { btn.classList.remove('on'); return; }
        btn.innerHTML = `<span class="wxb-s"></span>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${kIcon(k, day)}</svg>
            <span class="wxb-t">${Math.round(W.temp)}°</span>
            <span class="wxb-l" style="opacity:.66;font-weight:600">${LBL[k]}</span>`;
        btn.title = (W.place ? W.place + ' · ' : '') + LBL[k] + ' · ' + Math.round(W.temp) + '°C'
            + (day ? '' : ' · ' + phaseName(phase())) + (W.fallback ? ' · sample data' : '');
        btn.classList.add('on');
        btn.classList.toggle('snd', S.playing);
    }
    function jag() {
        let x = 18 + Math.random() * 64, d = 'M' + x.toFixed(1) + ' 0';
        for (let i = 1; i <= 7; i++) { x = Math.max(3, Math.min(97, x + (Math.random()-.5)*24)); d += ' L' + x.toFixed(1) + ' ' + (i*14); }
        return d;
    }
    function schedBolt() {
        boltT = setTimeout(() => {
            const f = $('wx-fl'), b = $('wx-bo');
            if (f) { f.style.setProperty('--fx', (16+Math.random()*68).toFixed(0)+'%'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
            if (b && Math.random() > .38) { const d = jag(); b.innerHTML = `<path class="bh" d="${d}"/><path d="${d}"/>`; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
            if (S.playing) S.thunder();
            schedBolt();
        }, 5000 + Math.random() * 14000);
    }
    function schedShoot() {
        shootT = setTimeout(() => {
            const s = $('wx-sh');
            if (s) { s.style.left = (2+Math.random()*40)+'%'; s.style.top = (2+Math.random()*26)+'%'; s.classList.remove('go'); void s.offsetWidth; s.classList.add('go'); }
            schedShoot();
        }, 24000 + Math.random() * 46000);
    }
    function stopT() { clearTimeout(boltT); clearTimeout(shootT); boltT = shootT = null; }

    /* ═══════════ 7 · AMBIENT SOUND (synthesised, no files) ═══════════ */
    const S = {
        ctx:null, master:null, nodes:[], timers:[], playing:false, noiseBuf:null,
        vol: parseFloat(localStorage.getItem('zdWxVol') || SND_VOL),
        init() {
            if (this.ctx) return;
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain(); this.master.gain.value = 0;
            this.master.connect(this.ctx.destination);
            const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            this.noiseBuf = buf;
        },
        noise(g0, type, freq, q) {
            const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
            const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
            const g = this.ctx.createGain(); g.gain.value = g0;
            s.connect(f); f.connect(g); g.connect(this.master); s.start();
            this.nodes.push(s, f, g); return { src:s, filt:f, gain:g };
        },
        chirp(f0, f1, dur, vol, type) {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
            o.type = type || 'sine';
            o.frequency.setValueAtTime(f0, t);
            o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(vol, t + dur * .18);
            g.gain.exponentialRampToValueAtTime(.0001, t + dur);
            o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .05);
        },
        every(min, max, fn) {
            const go = () => { if (!this.playing) return; try { fn(); } catch (e) {} this.timers.push(setTimeout(go, min + Math.random()*(max-min))); };
            this.timers.push(setTimeout(go, 400 + Math.random() * 1800));
        },
        thunder() {
            if (!this.ctx || !this.playing) return;
            const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
            const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 150;
            const g = this.ctx.createGain(), t = this.ctx.currentTime;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(.5, t + .12);
            g.gain.exponentialRampToValueAtTime(.0001, t + 2.8);
            f.frequency.exponentialRampToValueAtTime(45, t + 2.8);
            s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 3);
        },
        pad() {
            [110, 164.8, 220].forEach((fr, i) => {
                const o = this.ctx.createOscillator(), g = this.ctx.createGain(),
                      lf = this.ctx.createOscillator(), lg = this.ctx.createGain(), fi = this.ctx.createBiquadFilter();
                o.type = 'sine'; o.frequency.value = fr + (i-1)*.4; g.gain.value = .022;
                lf.frequency.value = .05 + i*.02; lg.gain.value = .012;
                lf.connect(lg); lg.connect(g.gain); lf.start();
                fi.type = 'lowpass'; fi.frequency.value = 620;
                o.connect(fi); fi.connect(g); g.connect(this.master); o.start();
                this.nodes.push(o, g, lf, lg, fi);
            });
        },
        build(kind, day) {
            this.pad();
            const wind = () => {
                const w = this.noise(.05, 'lowpass', 380);
                const l = this.ctx.createOscillator(), lg = this.ctx.createGain();
                l.frequency.value = .07; lg.gain.value = 180;
                l.connect(lg); lg.connect(w.filt.frequency); l.start(); this.nodes.push(l, lg);
            };
            if (kind === 'rain' || kind === 'drizzle' || kind === 'storm' || kind === 'sleet') {
                const heavy = kind === 'rain' || kind === 'storm';
                this.noise(heavy ? .17 : .09, 'bandpass', heavy ? 1150 : 1700, .6);
                this.noise(heavy ? .1 : .05, 'lowpass', 460);
                this.noise(.035, 'highpass', 5200);
                if (kind === 'storm') { wind(); this.every(9000, 22000, () => this.thunder()); }
                if (!day) this.every(4500, 12000, () => {
                    for (let i = 0; i < 2 + Math.round(Math.random()*2); i++)
                        setTimeout(() => this.chirp(180 + Math.random()*60, 120, .16, .05, 'sawtooth'), i * 170);
                });
            } else if (kind === 'snow') { this.noise(.045, 'lowpass', 300); wind(); }
            else if (kind === 'fog' || kind === 'overcast') {
                this.noise(.04, 'lowpass', 420); wind();
                if (day) this.every(9000, 20000, () => this.chirp(1500, 1100, .2, .035));
            } else {
                this.noise(.03, 'lowpass', 520); wind();
                if (day) {
                    this.every(2200, 6500, () => {
                        const n = 2 + Math.round(Math.random()*3);
                        for (let i = 0; i < n; i++) {
                            const base = 1800 + Math.random()*1600;
                            setTimeout(() => this.chirp(base, base*(.55+Math.random()*.8), .09+Math.random()*.09, .055), i*(70+Math.random()*110));
                        }
                    });
                    this.every(14000, 34000, () => this.chirp(700, 900, .3, .03, 'triangle'));
                } else {
                    this.every(900, 2400, () => {
                        const f = 4200 + Math.random()*900;
                        for (let i = 0; i < 4; i++) setTimeout(() => this.chirp(f, f*.93, .035, .028, 'triangle'), i*52);
                    });
                    this.every(6000, 16000, () => {
                        for (let i = 0; i < 2; i++) setTimeout(() => this.chirp(150+Math.random()*50, 105, .19, .045, 'sawtooth'), i*240);
                    });
                    this.every(20000, 48000, () => this.chirp(520, 380, .5, .028, 'sine'));
                }
            }
        },
        start() {
            try {
                this.init();
                if (this.ctx.state === 'suspended') this.ctx.resume();
                this.stop(true);
                this.playing = true;
                const k = W ? bucket(W.code) : 'clear';
                const day = W && W.isDay !== undefined ? !!W.isDay : skyPos().day;
                this.build(k, day);
                const t = this.ctx.currentTime;
                this.master.gain.cancelScheduledValues(t);
                this.master.gain.setValueAtTime(this.master.gain.value, t);
                this.master.gain.linearRampToValueAtTime(this.vol, t + 1.6);
                localStorage.setItem('zdWxSnd', '1');
            } catch (e) { console.warn('[wx:audio]', e); this.playing = false; }
        },
        stop(silent) {
            this.timers.forEach(clearTimeout); this.timers = [];
            if (this.ctx && this.master) {
                const t = this.ctx.currentTime;
                this.master.gain.cancelScheduledValues(t);
                this.master.gain.setValueAtTime(this.master.gain.value, t);
                this.master.gain.linearRampToValueAtTime(0, t + (silent ? .05 : .7));
            }
            const ns = this.nodes.slice(); this.nodes = [];
            setTimeout(() => ns.forEach(n => { try { n.stop && n.stop(); } catch(e){} try { n.disconnect(); } catch(e){} }), silent ? 80 : 800);
            if (!silent) { this.playing = false; localStorage.removeItem('zdWxSnd'); }
        },
        setVol(v) {
            this.vol = v; localStorage.setItem('zdWxVol', String(v));
            if (this.ctx && this.master && this.playing) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, .12);
        }
    };
    window.zdWxSound = S;

    /* ═══════════ 8 · DATA — permission-aware, self-healing ═══════════ */
    const GK = 'zdWxGeo';
    const saveGeo = (la, lo) => { try { localStorage.setItem(GK, JSON.stringify({ lat:la, lon:lo, at:Date.now() })); } catch(e){} };
    const readGeo = () => { try { return JSON.parse(localStorage.getItem(GK) || 'null'); } catch(e){ return null; } };
    const cache = () => { try { return JSON.parse(localStorage.getItem('zdWx') || 'null'); } catch(e){ return null; } };
    let fetching = false;

    async function permState() {
        try {
            if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
            return (await navigator.permissions.query({ name:'geolocation' })).state;
        } catch (e) { return 'unknown'; }
    }
    async function pull(lat, lon) {
        if (fetching) return; fetching = true;
        try {
            const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4)
                + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,cloud_cover,wind_speed_10m,precipitation'
                + '&hourly=temperature_2m,weather_code,precipitation_probability'
                + '&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max'
                + '&timezone=auto&forecast_days=2&forecast_hours=12&_=' + Date.now();
            const r = await fetch(u, { cache:'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json(), cu = j.current || {}, dl = j.daily || {}, hr = j.hourly || {};
            if (cu.temperature_2m === undefined) throw new Error('no current block');
            const prev = cache() || {};
            W = {
                code: cu.weather_code | 0, temp: cu.temperature_2m, feels: cu.apparent_temperature,
                hum: cu.relative_humidity_2m, isDay: cu.is_day === 1, cloud: cu.cloud_cover,
                wind: cu.wind_speed_10m, precip: cu.precipitation,
                hi: dl.temperature_2m_max ? dl.temperature_2m_max[0] : null,
                lo: dl.temperature_2m_min ? dl.temperature_2m_min[0] : null,
                uv: dl.uv_index_max ? dl.uv_index_max[0] : null,
                sunrise: dl.sunrise ? new Date(dl.sunrise[0]).getTime() : null,
                sunset: dl.sunset ? new Date(dl.sunset[0]).getTime() : null,
                hourly: (hr.time || []).slice(0, 12).map((t, i) => ({
                    t: new Date(t).getTime(), temp: hr.temperature_2m[i], code: hr.weather_code[i],
                    pop: hr.precipitation_probability ? hr.precipitation_probability[i] : 0
                })).filter(x => x.t > Date.now() - 36e5),
                lat: lat, lon: lon, place: prev.place || '', at: Date.now(), fallback: false
            };
            localStorage.setItem('zdWx', JSON.stringify(W));
            log('live', LBL[bucket(W.code)], Math.round(W.temp) + '°', W.isDay ? 'day' : 'night');
            paint(); autoTheme(); alerts();
            if (!W.place) {
                try {
                    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`);
                    const gj = await g.json();
                    if (gj.results && gj.results[0]) {
                        W.place = gj.results[0].name + (gj.results[0].admin1 ? ', ' + gj.results[0].admin1 : '');
                        localStorage.setItem('zdWx', JSON.stringify(W));
                        chip(bucket(W.code), !!W.isDay);
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[wx:fetch]', e.message || e);
            if (!W) sample();
        } finally { fetching = false; }
    }
    /* sample sky — never written to cache, so it can't block real data */
    function sample() {
        const h = new Date().getHours();
        W = { code:0, temp:22, feels:22, hum:50, isDay:h>=6&&h<18, cloud:8, wind:6, precip:0,
              hi:null, lo:null, uv:null, sunrise:null, sunset:null, hourly:[], place:'', at:0, fallback:true };
        paint();
    }
    /* the one entry point. Prompts only when the browser has never been asked. */
    async function refresh(silent) {
        if (!on()) return;
        const st = await permState(), geo = readGeo();
        if (st === 'denied') {
            if (geo) pull(geo.lat, geo.lon); else sample();
            if (!silent) { try { showToast('Location is blocked for this site — enable it in your browser settings.', 5200); } catch(e){} }
            return;
        }
        if (!navigator.geolocation) { if (geo) pull(geo.lat, geo.lon); else sample(); return; }
        const opts = (st === 'granted')
            ? { enableHighAccuracy:false, timeout:12000, maximumAge:5*60*1000 }   /* silent read */
            : { enableHighAccuracy:false, timeout:12000, maximumAge:0 };          /* first ask */
        navigator.geolocation.getCurrentPosition(
            p => { saveGeo(p.coords.latitude, p.coords.longitude); pull(p.coords.latitude, p.coords.longitude); },
            e => { console.warn('[wx:geo]', e && e.message); if (geo) pull(geo.lat, geo.lon); else sample(); },
            opts);
        if (!silent) { try { showToast('Updating conditions…'); } catch(e){} }
    }
    window.zdWxRefresh = () => refresh(false);

    /* ═══════════ 9 · AUTO THEME (waits for the app to appear) ═══════════ */
    let atLast = null, appReady = false;
    (function waitForApp() {
        const check = () => {
            const ls = $('loading-screen');
            const gone = !ls || ls.classList.contains('hidden') ||
                getComputedStyle(ls).opacity === '0' || getComputedStyle(ls).display === 'none';
            if (gone) { appReady = true; setTimeout(autoTheme, 600); return true; }
            return false;
        };
        if (check()) return;
        const iv = setInterval(() => { if (check()) clearInterval(iv); }, 300);
        setTimeout(() => { appReady = true; clearInterval(iv); }, 10000);
    })();
    function autoTheme() {
        if (!autoOn() || !appReady) return;
        let dark;
        if (W && W.sunrise && W.sunset) { const n = Date.now(); dark = !(n >= W.sunrise && n <= W.sunset); }
        else { const h = new Date().getHours(); dark = h < 6 || h >= 18; }
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark === dark) { atLast = dark; return; }
        const first = atLast === null;
        atLast = dark;
        try { toggleTheme(); } catch (e) { try { document.documentElement.classList.toggle('dark', dark); } catch(x){} }
        if (!first) { try { showToast(dark ? 'Sunset — switching to dark.' : 'Sunrise — switching to light.', 3600); } catch(e){} }
    }

    /* ═══════════ 10 · ALERTS ═══════════ */
    function alerts() {
        if (!on() || !W || W.fallback || !$('wx-al')) return false;
        const today = new Date().toISOString().slice(0, 10);
        let seen = {}; try { seen = JSON.parse(localStorage.getItem('zdWxAlert') || '{}'); } catch(e){}
        if (seen.d !== today) seen = { d: today, k: [] };
        const fire = (id, col, ico, title, sub) => {
            if (seen.k.indexOf(id) >= 0) return false;
            seen.k.push(id); localStorage.setItem('zdWxAlert', JSON.stringify(seen));
            $('wx-alh').style.background = col;
            $('wx-ali').innerHTML = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' + ico + '</svg>';
            $('wx-alt').textContent = title; $('wx-als').innerHTML = sub;
            $('wx-al').classList.add('open');
            try { if (navigator.vibrate) navigator.vibrate(16); } catch(e){}
            return true;
        };
        const k = bucket(W.code);
        const wet = (W.hourly || []).filter(h => h.t <= Date.now() + 6*36e5 && h.pop >= 55);
        if (k === 'storm') return fire('storm','linear-gradient(160deg,#3b4a63,#1e2739)',IC.storm,
            'Thunderstorm nearby','Lightning is active around you. Best to stay indoors and unplug anything you care about.');
        if (k === 'rain' || k === 'drizzle') return fire('raining','linear-gradient(160deg,#4a6584,#26384d)',IC.rain,
            "It's raining",'Take an umbrella if you\'re heading out. Bring the washing in.');
        if (wet.length) {
            const w = wet[0], hh = new Date(w.t).toLocaleTimeString([], { hour:'numeric' });
            return fire('rainsoon','linear-gradient(160deg,#4a6584,#26384d)',IC.rain,
                'Rain expected around ' + hh, '<b>' + w.pop + '%</b> chance in the next few hours. Worth carrying an umbrella.');
        }
        if (W.temp >= 36 || (W.uv !== null && W.uv >= 9)) return fire('hot','linear-gradient(160deg,#e0672f,#a03410)',IC.hot,
            'Very hot outside','It\'s <b>' + Math.round(W.temp) + '°C</b>'
            + (W.feels ? ' (feels like ' + Math.round(W.feels) + '°)' : '')
            + (W.uv >= 9 ? ' with a UV index of <b>' + Math.round(W.uv) + '</b>' : '') + '. Drink water and stay out of direct sun.');
        if (W.temp <= 2) return fire('cold','linear-gradient(160deg,#3f6d9e,#1c3350)',IC.snow,
            'Freezing outside','It\'s <b>' + Math.round(W.temp) + '°C</b>. Layer up before you head out.');
        if (W.wind >= 45) return fire('wind','linear-gradient(160deg,#5c6b7d,#2c3641)',IC.wind,
            'Strong winds','Gusts around <b>' + Math.round(W.wind) + ' km/h</b>. Secure anything loose outdoors.');
        if (k === 'snow') return fire('snow','linear-gradient(160deg,#7d93ad,#3d4f66)',IC.snow,
            "It's snowing",'Travel may be slower than usual. Give yourself extra time.');
        return false;
    }

    /* ═══════════ 11 · PANEL MARKUP ═══════════ */
    guard('ui', () => document.body.insertAdjacentHTML('beforeend', `
    <div id="wx-p"><div id="wx-pb">
      <div id="wx-hero">
        <button id="wx-hx" type="button">×</button>
        <div class="wx-temp" id="wx-t">--°</div>
        <div class="wx-cond" id="wx-cd">—</div>
        <div class="wx-place" id="wx-pl"></div>
      </div>
      <div id="wx-body"></div>
    </div></div>
    <div id="wx-al"><div id="wx-alb">
      <div id="wx-alh"><div id="wx-ali"></div><div id="wx-alt"></div><div id="wx-als"></div></div>
      <div id="wx-alf"><button id="wx-alg" type="button">Got it</button></div>
    </div></div>`));

    function sndName() {
        const k = W ? bucket(W.code) : 'clear';
        const day = W && W.isDay !== undefined ? !!W.isDay : skyPos().day;
        if (k === 'storm') return 'Rain & distant thunder';
        if (k === 'rain' || k === 'drizzle' || k === 'sleet') return day ? 'Steady rainfall' : 'Rain & night frogs';
        if (k === 'snow') return 'Soft snowfall';
        if (k === 'fog' || k === 'overcast') return day ? 'Still, overcast air' : 'Quiet overcast night';
        return day ? 'Birdsong & light breeze' : 'Crickets & night air';
    }
    window.wxOpen = function () {
        if (!W) { try { showToast('Conditions are still loading…'); } catch(e){} refresh(true); return; }
        const k = bucket(W.code), day = !!W.isDay;
        const [a, b] = pal(k, day, skyPos().t);
        $('wx-hero').style.background = `linear-gradient(160deg,${a},${b})`;
        $('wx-t').textContent = Math.round(W.temp) + '°';
        $('wx-cd').textContent = LBL[k] + (W.feels != null ? ' · feels ' + Math.round(W.feels) + '°' : '');
        $('wx-pl').innerHTML = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' + IC.pin + '</svg>'
            + (W.fallback ? 'Sample conditions' : (W.place || 'Your location'));
        let h = '<div class="wx-g">';
        if (W.hi != null) h += `<div class="wx-c"><b>${Math.round(W.hi)}° / ${Math.round(W.lo)}°</b><span>High / low</span></div>`;
        h += `<div class="wx-c"><b>${Math.round(W.wind)} km/h</b><span>Wind</span></div>`;
        h += `<div class="wx-c"><b>${Math.round(W.hum)}%</b><span>Humidity</span></div>`;
        h += `<div class="wx-c"><b>${W.uv != null ? Math.round(W.uv) : '—'}</b><span>UV index</span></div>`;
        if (W.sunrise) h += `<div class="wx-c"><b>${new Date(W.sunrise).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b><span>Sunrise</span></div>
            <div class="wx-c"><b>${new Date(W.sunset).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b><span>Sunset</span></div>`;
        h += `<div class="wx-c" style="grid-column:1/-1"><b>${phaseName(phase())}</b><span>Moon · ${Math.round((1-Math.cos(2*Math.PI*phase()))/2*100)}% lit</span></div></div>`;
        if (W.hourly && W.hourly.length) {
            h += '<div class="wx-l"><span>Next hours</span></div><div class="wx-h">';
            W.hourly.slice(0, 10).forEach((x, i) => {
                h += `<div><i>${i === 0 ? 'Now' : new Date(x.t).toLocaleTimeString([], {hour:'numeric'})}</i>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${kIcon(bucket(x.code), x.t >= (W.sunrise||0) && x.t <= (W.sunset||9e15))}</svg>
                    <b>${Math.round(x.temp)}°</b>${x.pop >= 20 ? '<u>'+x.pop+'%</u>' : ''}</div>`;
            });
            h += '</div>';
        }
        h += `<div class="wx-l"><span>Ambience</span></div>
          <div class="wx-snd${S.playing?' live':''}" id="wx-sndrow">
            <button id="wx-sb" type="button" class="${S.playing?'on':'off'}">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${S.playing?IC.vol:IC.mute}</svg></button>
            <span class="flex-1 min-w-0">
              <span style="font-size:12px;font-weight:700;color:var(--text-color)">${sndName()}</span>
              <span class="wx-bars">${Array(14).fill(0).map((_,i)=>`<i style="animation-delay:${i*70}ms"></i>`).join('')}</span>
              <input id="wx-vol" type="range" min="0" max="100" value="${Math.round(S.vol*100)}">
            </span></div>
          <button id="wx-ref" type="button">↻ Update conditions</button>
          <div id="wx-note">${W.fallback ? 'Showing a sample sky — allow location to see your own conditions.'
              : 'Updated ' + Math.max(1, Math.round((Date.now()-W.at)/60000)) + ' min ago · refreshes automatically'}</div>`;
        $('wx-body').innerHTML = h;
        const v = $('wx-vol'); if (v) v.oninput = () => S.setVol(v.value / 100);
        const sb = $('wx-sb'); if (sb) sb.onclick = () => wxSnd();
        const rf = $('wx-ref'); if (rf) rf.onclick = () => refresh(false);
        $('wx-p').classList.add('open');
    };
    window.wxClose = function () { const p = $('wx-p'); if (p) p.classList.remove('open'); };
    window.wxSnd = function () {
        if (S.playing) { S.stop(); try { showToast('Ambience off.'); } catch(e){} }
        else { S.start(); try { showToast('Ambience on — ' + sndName().toLowerCase() + '.'); } catch(e){} }
        const b = $('wx-sb'), row = $('wx-sndrow');
        if (b) { b.className = S.playing ? 'on' : 'off';
            b.innerHTML = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' + (S.playing?IC.vol:IC.mute) + '</svg>'; }
        if (row) row.classList.toggle('live', S.playing);
        const btn = $('wx-btn'); if (btn) btn.classList.toggle('snd', S.playing);
    };
    guard('wire', () => {
        const hx = $('wx-hx'); if (hx) hx.onclick = () => wxClose();
        const ag = $('wx-alg'); if (ag) ag.onclick = () => $('wx-al').classList.remove('open');
        const p = $('wx-p'); if (p) p.addEventListener('click', e => { if (e.target.id === 'wx-p') wxClose(); });
        const al = $('wx-al'); if (al) al.addEventListener('click', e => { if (e.target.id === 'wx-al') al.classList.remove('open'); });
        addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if ($('wx-al') && $('wx-al').classList.contains('open')) {
                e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                $('wx-al').classList.remove('open'); return;
            }
            if ($('wx-p') && $('wx-p').classList.contains('open')) {
                e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); wxClose();
            }
        }, true);
    });

    /* ═══════════ 12 · HEADER BUTTON (desktop) ═══════════ */
    function mountBtn() {
        if ($('wx-btn')) return;
        const b = document.createElement('button');
        b.id = 'wx-btn'; b.type = 'button';
        b.addEventListener('click', () => { if (typeof window.wxOpen === 'function') window.wxOpen(); });
        const bar = $('logged-in-controls');
        try {
            if (bar) {
                const grp = bar.querySelector('.zd-hgrp');
                if (grp && grp.parentElement) grp.parentElement.insertBefore(b, grp);
                else bar.insertBefore(b, bar.firstChild);
            } else { const hdr = document.querySelector('.zd-header'); if (hdr) hdr.appendChild(b); else throw 0; }
        } catch (e) { b.style.cssText = 'position:fixed;top:14px;right:240px;z-index:52;'; document.body.appendChild(b); }
    }
    guard('btn', mountBtn);
    setTimeout(() => guard('btn2', mountBtn), 2500);

    /* ═══════════ 13 · MOBILE SIDEBAR AWARENESS ═══════════ */
    guard('sb', () => {
        const sb = $('sidebar'); if (!sb) return;
        const sync = () => document.body.classList.toggle('zd-wx-sb',
            innerWidth <= 900 && (sb.classList.contains('sidebar-open') || sb.classList.contains('open')));
        new MutationObserver(sync).observe(sb, { attributes:true, attributeFilter:['class','style'] });
        addEventListener('resize', sync); setInterval(sync, 700); sync();
    });

    /* ═══════════ 14 · LIFECYCLE ═══════════ */
    function tick() {
        if (!on()) { if (WX) WX.classList.remove('on'); stopT(); tint(null); mood(); return; }
        const age = W ? Date.now() - (W.at || 0) : Infinity;
        if (!W || W.fallback || age > REFRESH) refresh(true);
        else if (Date.now() - lastPaint > 45000) paint();
        autoTheme();
    }
    setTimeout(() => { if (on()) { const c = cache(); if (c && !c.fallback) { W = c; paint(); } refresh(true); } else { sample(); tint(null); } }, 800);
    setInterval(tick, 60000);
    setInterval(() => { if (on() && (!W || W.fallback)) refresh(true); }, RETRY);
    setInterval(autoTheme, AT_CHECK);
    setInterval(placeOrb, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { fit(); tick(); } });
    if (localStorage.getItem('zdWxSnd') === '1') {
        const kick = () => { if (on()) { S.start(); const b = $('wx-btn'); if (b) b.classList.add('snd'); }
            removeEventListener('pointerdown', kick); removeEventListener('keydown', kick); };
        addEventListener('pointerdown', kick, { once:true });
        addEventListener('keydown', kick, { once:true });
    }
    ['openHome','openCalendar','openKanban','openCanvas','openTemplates','openEisenhower',
     'openGraph','openTrackers','openMeeting'].forEach(f => {
        const o = window[f]; if (typeof o !== 'function') return;
        window[f] = function () { stopT(); return o.apply(this, arguments); };
    });
    ['closeHome','closeCalendar','closeKanban','closeCanvas','closeTemplates','closeEisenhower',
     'closeGraph','closeTrackers','closeMeeting'].forEach(f => {
        const o = window[f]; if (typeof o !== 'function') return;
        window[f] = function () { const r = o.apply(this, arguments); setTimeout(() => { mount(); fit(); if (on() && W) paint(); }, 600); return r; };
    });

    /* ═══════════ 15 · SWITCH REACTIONS ═══════════ */
    const _aff = window.applyFeatureFlags;
    if (typeof _aff === 'function') {
        window.applyFeatureFlags = function () {
            const r = _aff.apply(this, arguments);
            setTimeout(() => guard('flags', () => {
                if (!on()) {
                    if (WX) { WX.classList.remove('on'); WL.innerHTML = ''; }
                    stopT(); tint(null); mood();
                    const b = $('wx-btn'); if (b) b.classList.remove('on');
                    if (S.playing) S.stop();
                } else { mount(); fit(); refresh(true); }
                atLast = null; autoTheme();
            }), 80);
            return r;
        };
    }
    setTimeout(() => guard('menu', () => {
        if (!document.querySelector('[data-zdfn="wx"]')) zdMenuInject2('wx', 'wxOpen', 'Weather & ambience', IC.rain);
    }), 1200);

    /* ═══════════ 16 · DIAGNOSTICS ═══════════ */
    window.zdWxTest = function (kind) {
        const codes = { clear:0, partly:2, overcast:3, fog:45, drizzle:53, rain:63, snow:73, storm:95 };
        if (!W) sample();
        if (kind === 'night') W.isDay = false;
        else if (kind === 'day') W.isDay = true;
        else if (codes[kind] !== undefined) W.code = codes[kind];
        paint(); mood();
        console.log('[wx] preview:', kind);
    };
    window.zdWxWhy = async function () {
        console.log('%c[wx] diagnostic', 'color:#38bdf8;font-weight:700', {
            sky: !!$('wx'), insideEditor: !!($('wx') && $('wx').parentElement === $('editor-wrapper')),
            button: !!$('wx-btn'), switchOn: (() => { try { return zdFeatOn('wx'); } catch(e){ return 'n/a'; } })(),
            permission: await permState(), cachedGeo: readGeo(),
            data: W ? { cond: LBL[bucket(W.code)], temp: W.temp, live: !W.fallback,
                        age: W.at ? Math.round((Date.now()-W.at)/1000) + 's' : 'n/a' } : null
        });
    };
    setTimeout(() => { log('ready — run zdWxWhy() for a full diagnostic'); }, 3200);
})();   

    // New Code

    /* ============================================================
   V10.5 — ALERT TIMING & LOCATION ACCURACY
   1 Alerts appeared over the loading screen, the login screen and
     the daily review → they now queue and wait for a clear stage
   2 Some browsers only ever showed sample data, and readings
     disagreed with other services → high-accuracy fix, IP fallback,
     nearest-hour reconciliation and a visible source label
============================================================ */
(function zd105() {
    if (window.__zd105) return; window.__zd105 = true;
    const $ = id => document.getElementById(id);
    const log = (...a) => console.log('%c[wx5]', 'color:#38bdf8;font-weight:700', ...a);

    /* ════════════════════════════════════════════════════════════
       1 · ALERTS WAIT FOR A CLEAR STAGE
       An alert is only ever shown when the app is genuinely idle:
       loaded, signed in, no modal open, tab visible, and the user
       has had a moment to settle.
       ════════════════════════════════════════════════════════════ */
    const BLOCKERS = [
        '#loading-screen', '#auth-screen',            /* boot & sign-in */
        '#dr2.open', '#dr-modal.open',                /* daily review */
        '#wx-p.open', '#confirm-modal.open',
        '#trk-modal.open', '#mt.open', '#col.on',     /* grid & meeting */
        '#ment-modal.open', '#ask-modal.open', '#conn-modal.open',
        '#tl-modal.open', '#stats-modal.open', '#lock-modal.open',
        '#lk-pw.open', '#vault-modal.open', '#qc-modal.open',
        '#tour-card.on', '#help-modal.open', '#fxs.open',
        '#palette-modal.open', '#note-picker-modal.open'
    ];
    function stageBusy() {
        /* boot / auth screens use display or a hidden class rather than .open */
        for (const sel of ['#loading-screen', '#auth-screen']) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const cs = getComputedStyle(el);
            if (!el.classList.contains('hidden') && cs.display !== 'none' && cs.opacity !== '0') return sel;
        }
        for (const sel of BLOCKERS.slice(2)) if (document.querySelector(sel)) return sel;
        /* any full-screen view still animating in */
        if (document.querySelector('.zd-view-modal.open')) return 'view';
        if (document.querySelector('#zfx.on, #crt.on, #trk-tunnel.on')) return 'transition';
        if (document.visibilityState !== 'visible') return 'hidden tab';
        /* signed out or notes not loaded yet */
        try { if (typeof state !== 'undefined' && (state.isGuest || !state.docId)) return 'no note open'; } catch (e) {}
        return null;
    }

    /* intercept the alert modal: if the stage is busy, hold it back */
    let queued = null, settled = 0;
    const AL = $('wx-al');
    if (AL) {
        const _add = AL.classList.add.bind(AL.classList);
        AL.classList.add = function (...cls) {
            if (cls.indexOf('open') >= 0) {
                const why = stageBusy();
                const tooSoon = Date.now() - settled < 2500;
                if (why || tooSoon) {
                    /* snapshot the alert and show it when the stage clears */
                    queued = {
                        bg: $('wx-alh').style.background,
                        ico: $('wx-ali').innerHTML,
                        title: $('wx-alt').textContent,
                        sub: $('wx-als').innerHTML,
                        at: Date.now()
                    };
                    log('alert held —', why || 'settling');
                    return;
                }
            }
            return _add(...cls);
        };
    }
    function flushQueue() {
        if (!queued || !AL) return;
        if (stageBusy()) return;
        if (Date.now() - settled < 2500) return;
        if (Date.now() - queued.at > 30 * 60 * 1000) { queued = null; return; }  /* stale */
        const q = queued; queued = null;
        $('wx-alh').style.background = q.bg;
        $('wx-ali').innerHTML = q.ico;
        $('wx-alt').textContent = q.title;
        $('wx-als').innerHTML = q.sub;
        AL.classList.add('open');
        try { if (navigator.vibrate) navigator.vibrate(16); } catch (e) {}
        log('alert shown:', q.title);
    }
    /* track when the stage last became clear, so we never interrupt mid-action */
    let wasBusy = true;
    setInterval(() => {
        const busy = !!stageBusy();
        if (wasBusy && !busy) settled = Date.now();
        wasBusy = busy;
        flushQueue();
    }, 900);

    /* ════════════════════════════════════════════════════════════
       2 · LOCATION & ACCURACY
       ════════════════════════════════════════════════════════════ */
    const GK = 'zdWxGeo';
    const readGeo = () => { try { return JSON.parse(localStorage.getItem(GK) || 'null'); } catch (e) { return null; } };
    const saveGeo = (lat, lon, src) => {
        try { localStorage.setItem(GK, JSON.stringify({ lat, lon, at: Date.now(), src })); } catch (e) {}
    };
    async function permState() {
        try {
            if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
            return (await navigator.permissions.query({ name: 'geolocation' })).state;
        } catch (e) { return 'unknown'; }
    }
    /* IP fallback — approximate, but far better than a sample sky.
       Two providers, both free and keyless, tried in order. */
    async function ipLocate() {
        const tries = [
            async () => {
                const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
                const j = await r.json();
                if (j && j.latitude) return { lat: +j.latitude, lon: +j.longitude, place: j.city ? (j.city + (j.region ? ', ' + j.region : '')) : '' };
                return null;
            },
            async () => {
                const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { cache: 'no-store' });
                const j = await r.json();
                if (j && j.latitude) return { lat: +j.latitude, lon: +j.longitude, place: j.city ? (j.city + (j.region ? ', ' + j.region : '')) : '' };
                return null;
            }
        ];
        for (const t of tries) {
            try { const r = await t(); if (r && isFinite(r.lat) && isFinite(r.lon)) return r; } catch (e) {}
        }
        return null;
    }
    /* fetch conditions and reconcile the reading with the nearest hourly slot,
       which is what most weather sites display — this removes the disagreement */
    async function pull(lat, lon, src, placeHint) {
        try {
            const u = 'https://api.open-meteo.com/v1/forecast'
                + '?latitude=' + (+lat).toFixed(4) + '&longitude=' + (+lon).toFixed(4)
                + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,cloud_cover,wind_speed_10m,precipitation'
                + '&hourly=temperature_2m,weather_code,precipitation_probability,apparent_temperature'
                + '&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max'
                + '&timezone=auto&forecast_days=2&forecast_hours=24'
                + '&_=' + Date.now();
            const r = await fetch(u, { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json(), cu = j.current || {}, dl = j.daily || {}, hr = j.hourly || {};
            if (cu.temperature_2m === undefined) throw new Error('no current block');

            /* nearest hourly slot — the value most services publish */
            let temp = cu.temperature_2m, feels = cu.apparent_temperature, code = cu.weather_code | 0;
            if (hr.time && hr.time.length) {
                const now = Date.now();
                let best = -1, bd = Infinity;
                hr.time.forEach((t, i) => { const d = Math.abs(new Date(t).getTime() - now); if (d < bd) { bd = d; best = i; } });
                if (best >= 0 && bd < 90 * 60 * 1000) {
                    const ht = hr.temperature_2m[best];
                    /* blend: the observation leads, the forecast hour steadies it */
                    if (isFinite(ht)) temp = Math.round((temp * 0.62 + ht * 0.38) * 10) / 10;
                    if (hr.apparent_temperature && isFinite(hr.apparent_temperature[best]))
                        feels = Math.round((feels * 0.62 + hr.apparent_temperature[best] * 0.38) * 10) / 10;
                    /* if the hour disagrees on precipitation, trust the hour */
                    const hc = hr.weather_code[best] | 0;
                    if (hc >= 51 && code < 51) code = hc;
                }
            }
            let prev = {}; try { prev = JSON.parse(localStorage.getItem('zdWx') || '{}'); } catch (e) {}
            const W = {
                code, temp, feels,
                hum: cu.relative_humidity_2m, isDay: cu.is_day === 1, cloud: cu.cloud_cover,
                wind: cu.wind_speed_10m, precip: cu.precipitation,
                hi: dl.temperature_2m_max ? dl.temperature_2m_max[0] : null,
                lo: dl.temperature_2m_min ? dl.temperature_2m_min[0] : null,
                uv: dl.uv_index_max ? dl.uv_index_max[0] : null,
                sunrise: dl.sunrise ? new Date(dl.sunrise[0]).getTime() : null,
                sunset: dl.sunset ? new Date(dl.sunset[0]).getTime() : null,
                hourly: (hr.time || []).map((t, i) => ({
                    t: new Date(t).getTime(), temp: hr.temperature_2m[i], code: hr.weather_code[i],
                    pop: hr.precipitation_probability ? hr.precipitation_probability[i] : 0
                })).filter(x => x.t > Date.now() - 36e5).slice(0, 12),
                lat: +lat, lon: +lon, place: placeHint || prev.place || '',
                at: Date.now(), fallback: false, src: src || 'gps'
            };
            localStorage.setItem('zdWx', JSON.stringify(W));
            log('live via', W.src, '·', Math.round(W.temp) + '°', '·', (W.place || (+lat).toFixed(2) + ',' + (+lon).toFixed(2)));

            /* hand it to the main module and repaint */
            if (typeof zdWxTest === 'function') zdWxTest('__sync');
            /* place name when we don't have one */
            if (!W.place) {
                try {
                    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`);
                    const gj = await g.json();
                    if (gj.results && gj.results[0]) {
                        W.place = gj.results[0].name + (gj.results[0].admin1 ? ', ' + gj.results[0].admin1 : '');
                        localStorage.setItem('zdWx', JSON.stringify(W));
                        if (typeof zdWxTest === 'function') zdWxTest('__sync');
                    }
                } catch (e) {}
            }
            return true;
        } catch (e) { console.warn('[wx5:fetch]', e.message || e); return false; }
    }

    /* the replacement refresh: GPS → cached fix → IP, in that order */
    let busy = false;
    async function refresh(silent) {
        try { if (typeof zdFeatOn === 'function' && !zdFeatOn('wx')) return; } catch (e) {}
        if (busy) return; busy = true;
        if (!silent) { try { showToast('Updating conditions…'); } catch (e) {} }
        try {
            const st = await permState();
            const geo = readGeo();

            /* secure context is required for geolocation on every modern browser */
            const secure = window.isSecureContext || location.hostname === 'localhost';
            if (!secure) log('insecure context — geolocation unavailable, using IP');

            if (secure && navigator.geolocation && st !== 'denied') {
                const opts = st === 'granted'
                    ? { enableHighAccuracy: true, timeout: 15000, maximumAge: 3 * 60 * 1000 }
                    : { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
                const pos = await new Promise(res => {
                    let done = false;
                    const finish = v => { if (!done) { done = true; res(v); } };
                    navigator.geolocation.getCurrentPosition(
                        p => finish(p),
                        e => { log('geo error:', e.code, e.message); finish(null); },
                        opts);
                    /* some browsers never call either callback — don't hang */
                    setTimeout(() => finish(null), 16000);
                });
                if (pos && pos.coords) {
                    saveGeo(pos.coords.latitude, pos.coords.longitude, 'gps');
                    if (await pull(pos.coords.latitude, pos.coords.longitude, 'gps')) { busy = false; return; }
                }
            }
            /* a previous fix still beats nothing */
            if (geo && isFinite(geo.lat)) {
                if (await pull(geo.lat, geo.lon, geo.src || 'cached')) { busy = false; return; }
            }
            /* last resort: approximate position from the network */
            const ip = await ipLocate();
            if (ip) {
                saveGeo(ip.lat, ip.lon, 'ip');
                if (await pull(ip.lat, ip.lon, 'ip', ip.place)) {
                    if (!silent && st === 'denied')
                        try { showToast('Using approximate location — allow location access for exact conditions.', 5200); } catch (e) {}
                    busy = false; return;
                }
            }
            log('all sources failed');
            if (!silent) try { showToast('Could not reach the weather service.', 4200); } catch (e) {}
        } finally { busy = false; }
    }
    window.zdWxRefresh = () => refresh(false);

    /* keep it genuinely fresh */
    setTimeout(() => refresh(true), 1800);
    setInterval(() => refresh(true), 8 * 60 * 1000);
    /* retry hard while we still have no live reading */
    setInterval(() => {
        let w = null; try { w = JSON.parse(localStorage.getItem('zdWx') || 'null'); } catch (e) {}
        if (!w || w.fallback) refresh(true);
    }, 40 * 1000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        let w = null; try { w = JSON.parse(localStorage.getItem('zdWx') || 'null'); } catch (e) {}
        if (!w || w.fallback || Date.now() - (w.at || 0) > 8 * 60 * 1000) refresh(true);
    });
    /* re-fetch the moment the user grants permission in the browser UI */
    guardPerm();
    async function guardPerm() {
        try {
            if (!navigator.permissions || !navigator.permissions.query) return;
            const p = await navigator.permissions.query({ name: 'geolocation' });
            p.onchange = () => { log('permission →', p.state); if (p.state === 'granted') refresh(true); };
        } catch (e) {}
    }

    /* show the source in the panel so it's never a mystery */
    const _open = window.wxOpen;
    if (typeof _open === 'function') {
        window.wxOpen = function () {
            const r = _open.apply(this, arguments);
            setTimeout(() => {
                const note = $('wx-note');
                let w = null; try { w = JSON.parse(localStorage.getItem('zdWx') || 'null'); } catch (e) {}
                if (!note || !w) return;
                const label = w.fallback ? 'Sample sky — no location available'
                    : w.src === 'ip' ? 'Approximate location (network) · allow location for exact conditions'
                    : w.src === 'cached' ? 'Last known location'
                    : 'Precise location';
                note.innerHTML = label + (w.fallback ? '' :
                    ' · updated ' + Math.max(1, Math.round((Date.now() - w.at) / 60000)) + ' min ago');
            }, 60);
            return r;
        };
    }

    /* diagnostic */
    window.zdWxWhy = async function () {
        let w = null; try { w = JSON.parse(localStorage.getItem('zdWx') || 'null'); } catch (e) {}
        console.log('%c[wx] diagnostic', 'color:#38bdf8;font-weight:700', {
            secureContext: window.isSecureContext,
            permission: await permState(),
            geolocationAPI: !!navigator.geolocation,
            cachedFix: readGeo(),
            source: w ? w.src : null,
            live: w ? !w.fallback : false,
            reading: w ? Math.round(w.temp) + '° ' + (w.isDay ? 'day' : 'night') : null,
            ageSeconds: w && w.at ? Math.round((Date.now() - w.at) / 1000) : null,
            stageBusy: stageBusy() || 'clear',
            alertQueued: !!queued
        });
    };
    log('alert gating + location accuracy active — run zdWxWhy()');
})();    
        
    /* ============================================================
       INIT
    ============================================================ */
    initTheme();
    initDesktopSidebar();
    initToolbarPosition();
    initSections();  /* V3.4: restore collapsed sidebar sections */
    initSearchWorker(); /* V3.6: off-thread palette search */
    initAccent();    /* V3.4: restore accent color */
