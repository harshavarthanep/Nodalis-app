// ZenDocs — 11-transitions-review-shortcuts-meeting.js
// V9.0 screen transitions, V9.1/V9.2 daily review, V9.3 other preset picker, V9.4 locked-notes enforcement, V9.5 shortcuts, V9.6 meeting mode.
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
   V9.0 — SCREEN TRANSITIONS
   • Old-CRT glitch sweep when toggling light / dark
   • A unique full-screen effect entering AND exiting each view:
       Home     → warm iris bloom
       Today    → sunrise wipe
       Month    → calendar grid tiles flip through
       Board    → kanban columns sweep across
       Canvas   → ink blot spreads / retracts
       Tmpl     → paper sheets deal past
       Matrix   → four quadrants slam together
       Graph    → nodes burst and connect
   The Grid keeps its own tunnel (V8.0) untouched.
============================================================ */
(function zd90() {
    if (window.__zd90) return; window.__zd90 = true;

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const FX_MS    = 620;   // ⚙ view transition length (ms)
    const CRT_MS   = 1300;   // ⚙ light/dark CRT glitch length (ms)
    const FX_ON    = true;  // ⚙ set false to disable all view effects
    /* ─────────────────────────────────────────────────────────── */

    document.head.insertAdjacentHTML('beforeend', `<style>
    #fx{position:fixed;inset:0;z-index:198;display:none;overflow:hidden;pointer-events:none;}
    #fx.on{display:block;}
    #fx .fx-l{position:absolute;inset:0;}

              /* ============ THEME SWITCH — storm & sunrise ============ */
    /* Fully transparent stage: every layer draws over your live notes.
       The weather itself carries the crossfade, so there is no colour block. */
    #crt{position:fixed;inset:0;z-index:199;display:none;pointer-events:none;
        overflow:hidden;contain:strict;}
    #crt.on{display:block;}

    /* ---------- shared: the atmosphere that doubles as the crossfade ---------- */
    #crt .cr-atmo{position:absolute;inset:-2px;opacity:0;will-change:opacity,transform;}
    /* night falling — deep storm gloom rolls down from above */
    #crt.lt .cr-atmo{background:linear-gradient(180deg,#080a0e 0%,#0d1015 42%,#111419 100%);}
    #crt.lt.on .cr-atmo{animation:atGloom ${CRT_MS}ms cubic-bezier(.4,0,.3,1) forwards;}
    @keyframes atGloom{
        0%{opacity:0;transform:translateY(-46%)}
        20%{opacity:.5;transform:translateY(0)}
        44%{opacity:.84}
        52%{opacity:.9}
        66%{opacity:.72}
        100%{opacity:0}}
    /* dawn breaking — warm light floods in */
    #crt.sr .cr-atmo{background:linear-gradient(180deg,#fffaf0 0%,#fdf3e2 48%,#f8efe2 100%);}
    #crt.sr.on .cr-atmo{animation:atDawn ${CRT_MS}ms cubic-bezier(.35,0,.3,1) forwards;}
    @keyframes atDawn{
        0%{opacity:0}18%{opacity:.24}40%{opacity:.66}
        52%{opacity:.9}68%{opacity:.54}100%{opacity:0}}

    /* ============ LIGHTNING (day → night) ============ */
    #crt .lt-bolt{position:absolute;inset:0;width:100%;height:100%;opacity:0;
        filter:drop-shadow(0 0 8px rgba(190,220,255,.95)) drop-shadow(0 0 28px rgba(120,170,255,.6));}
    #crt.lt.on .lt-bolt{animation:ltShow ${CRT_MS}ms steps(1) forwards;}
    @keyframes ltShow{0%,24%{opacity:0}25%{opacity:1}58%{opacity:1}
        61%{opacity:.35}64%{opacity:.9}70%{opacity:0}100%{opacity:0}}
    #crt .lt-core{stroke:#fbfdff;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round;
        stroke-dasharray:1;stroke-dashoffset:1;}
    #crt .lt-halo{stroke:rgba(174,208,255,.5);stroke-width:9;fill:none;stroke-linecap:round;
        stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;filter:blur(4px);}
    #crt.lt.on .lt-core,#crt.lt.on .lt-halo{
        animation:ltDraw ${CRT_MS}ms cubic-bezier(.2,.8,.3,1) forwards;}
    @keyframes ltDraw{0%,24%{stroke-dashoffset:1}31%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}
    #crt .lt-b2{opacity:0;}
    #crt.lt.on .lt-b2{animation:ltFork ${CRT_MS}ms steps(1) forwards;}
    @keyframes ltFork{0%,39%{opacity:0}40%{opacity:1}56%{opacity:1}60%{opacity:0}100%{opacity:0}}
    /* the flash — real lightning stutters two or three times */
    #crt .lt-flash{position:absolute;inset:0;opacity:0;
        background:radial-gradient(120% 80% at 50% -10%,#ffffff,rgba(212,232,255,.9) 40%,rgba(150,190,255,.3) 75%,transparent);}
    #crt.lt.on .lt-flash{animation:ltFlash ${CRT_MS}ms steps(1) forwards;}
    @keyframes ltFlash{0%,25%{opacity:0}
        26%{opacity:.62}29%{opacity:.06}
        31%{opacity:.8}34%{opacity:.1}
        40%{opacity:.34}43%{opacity:.08}
        48%{opacity:.5}53%{opacity:.14}
        62%{opacity:.05}100%{opacity:0}}
    /* afterglow where the bolt lands */
    #crt .lt-glow{position:absolute;left:50%;top:-14%;width:70vmax;height:70vmax;
        margin-left:-35vmax;border-radius:99px;opacity:0;
        background:radial-gradient(circle,rgba(196,224,255,.5),rgba(120,170,255,.16) 45%,transparent 70%);}
    #crt.lt.on .lt-glow{animation:ltGlow ${CRT_MS}ms ease-out forwards;}
    @keyframes ltGlow{0%,25%{opacity:0;transform:scale(.5)}
        30%{opacity:1;transform:scale(1)}62%{opacity:.34;transform:scale(1.3)}100%{opacity:0;transform:scale(1.6)}}
    /* rain */
    #crt .lt-rain{position:absolute;top:-14%;width:1.4px;border-radius:99px;opacity:0;
        background:linear-gradient(180deg,transparent,rgba(206,226,255,.75),transparent);}
    #crt.lt.on .lt-rain{animation:ltRain linear infinite;}
    @keyframes ltRain{0%{opacity:0;transform:translate3d(0,0,0)}
        10%{opacity:.6}90%{opacity:.4}100%{opacity:0;transform:translate3d(-4vw,116vh,0)}}

    /* ============ SUNRISE (night → day) ============ */
    #crt .sr-fan{position:absolute;left:50%;top:-8%;width:0;height:0;
        will-change:transform;transform-origin:0 0;}
    #crt.sr.on .sr-fan{animation:srSway ${CRT_MS}ms cubic-bezier(.4,0,.6,1) forwards;}
    @keyframes srSway{0%{transform:rotate(-7deg)}100%{transform:rotate(7deg)}}
    #crt .sr-ray{position:absolute;left:0;top:0;height:0;transform-origin:top center;opacity:0;
        border-radius:50% 50% 46% 46%;will-change:height,opacity;
        background:linear-gradient(180deg,rgba(255,246,214,.92),rgba(255,214,140,.5) 26%,
            rgba(255,183,88,.22) 58%,rgba(255,160,60,0) 88%);
        filter:blur(7px);mix-blend-mode:screen;}
    #crt.sr.on .sr-ray{animation:srRay ${CRT_MS}ms cubic-bezier(.16,.85,.28,1) both;}
    @keyframes srRay{0%{height:0;opacity:0}
        14%{opacity:.3}30%{opacity:.72}
        48%{height:165vmax;opacity:.62}
        66%{opacity:.34}100%{height:165vmax;opacity:0}}
    /* the sun cresting the top edge */
    #crt .sr-core{position:absolute;left:50%;top:-24vmax;width:48vmax;height:48vmax;
        margin-left:-24vmax;border-radius:99px;opacity:0;
        background:radial-gradient(circle,#fffdf6 0%,#ffe9b0 26%,rgba(255,196,86,.44) 52%,rgba(255,164,54,0) 76%);}
    #crt.sr.on .sr-core{animation:srCore ${CRT_MS}ms cubic-bezier(.22,1,.36,1) forwards;}
    @keyframes srCore{0%{opacity:0;transform:scale(.34) translateY(26px)}
        34%{opacity:.95;transform:scale(1) translateY(0)}
        60%{opacity:.7;transform:scale(1.12)}100%{opacity:0;transform:scale(1.3)}}
    /* anamorphic flare across the horizon */
    #crt .sr-flare{position:absolute;left:-20%;right:-20%;top:6%;height:2.5px;opacity:0;
        background:linear-gradient(90deg,transparent,rgba(255,236,180,.85) 34%,#fff 50%,rgba(255,236,180,.85) 66%,transparent);
        filter:blur(2.5px);}
    #crt.sr.on .sr-flare{animation:srFlare ${CRT_MS}ms ease-out forwards;}
    @keyframes srFlare{0%,16%{opacity:0;transform:scaleX(.2)}
        34%{opacity:.9;transform:scaleX(1)}60%{opacity:.4}100%{opacity:0}}
    /* dust motes drifting through the light */
    #crt .sr-mote{position:absolute;width:3px;height:3px;border-radius:99px;opacity:0;
        background:rgba(255,242,206,.95);box-shadow:0 0 7px 2px rgba(255,214,140,.6);}
    #crt.sr.on .sr-mote{animation:srMote ${CRT_MS}ms ease-out both;}
    @keyframes srMote{0%{opacity:0;transform:translateY(20px) scale(.4)}
        30%{opacity:.9;transform:translateY(0) scale(1)}
        70%{opacity:.5;transform:translateY(-22px) scale(.9)}
        100%{opacity:0;transform:translateY(-44px) scale(.3)}}

    @media (prefers-reduced-motion:reduce){#crt{display:none!important;}}

    /* ============ 1. HOME — iris bloom ============ */
    .fx-iris{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:99px;
        background:radial-gradient(circle,rgba(255,255,255,.96),rgb(var(--accent-rgb) / .9) 42%,rgb(var(--accent-rgb) / 0) 72%);}
    #fx.in .fx-iris{animation:fxIrisIn ${FX_MS}ms cubic-bezier(.3,.9,.3,1) forwards;}
    #fx.out .fx-iris{animation:fxIrisOut ${FX_MS}ms cubic-bezier(.6,0,.7,.2) forwards;}
    @keyframes fxIrisIn{0%{transform:scale(0);opacity:1}70%{opacity:.9}100%{transform:scale(300);opacity:0}}
    @keyframes fxIrisOut{0%{transform:scale(300);opacity:0}30%{opacity:.9}100%{transform:scale(0);opacity:1}}
    .fx-ray{position:absolute;left:50%;top:50%;width:2px;height:150vmax;transform-origin:0 0;
        background:linear-gradient(180deg,rgb(var(--accent-rgb) / .8),transparent);opacity:0;}
    #fx.in .fx-ray{animation:fxRay ${FX_MS}ms ease-out forwards;}
    #fx.out .fx-ray{animation:fxRayOut ${FX_MS}ms ease-in forwards;}
    @keyframes fxRay{0%{opacity:0;height:0}30%{opacity:.85}100%{opacity:0;height:150vmax}}
    @keyframes fxRayOut{0%{opacity:0;height:150vmax}40%{opacity:.7}100%{opacity:0;height:0}}

    /* ============ 2. TODAY — sunrise wipe ============ */
    .fx-sun{position:absolute;left:50%;bottom:-30vmax;width:60vmax;height:60vmax;margin-left:-30vmax;
        border-radius:99px;background:radial-gradient(circle,#fff8e1,#ffc857 40%,rgba(255,167,38,0) 70%);}
    #fx.in .fx-sun{animation:fxSunIn ${FX_MS}ms cubic-bezier(.25,1,.4,1) forwards;}
    #fx.out .fx-sun{animation:fxSunOut ${FX_MS}ms cubic-bezier(.5,0,.75,.2) forwards;}
    @keyframes fxSunIn{0%{transform:translateY(30vmax) scale(.3);opacity:0}
        35%{opacity:1}100%{transform:translateY(-70vmax) scale(2.6);opacity:0}}
    @keyframes fxSunOut{0%{transform:translateY(-70vmax) scale(2.6);opacity:0}
        45%{opacity:1}100%{transform:translateY(30vmax) scale(.3);opacity:0}}
    .fx-sky{position:absolute;inset:0;opacity:0;
        background:linear-gradient(0deg,rgba(255,167,38,.55),rgba(255,214,102,.28) 45%,transparent 80%);}
    #fx.in .fx-sky{animation:fxFade ${FX_MS}ms ease-out forwards;}
    #fx.out .fx-sky{animation:fxFadeR ${FX_MS}ms ease-in forwards;}
    @keyframes fxFade{0%{opacity:0}40%{opacity:1}100%{opacity:0}}
    @keyframes fxFadeR{0%{opacity:0}60%{opacity:1}100%{opacity:0}}

    /* ============ 3. MONTH — grid tiles ============ */
    .fx-cell{position:absolute;background:rgb(var(--accent-rgb) / .92);
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.22);opacity:0;}
    #fx.in .fx-cell{animation:fxCellIn ${FX_MS}ms cubic-bezier(.3,1,.4,1) both;}
    #fx.out .fx-cell{animation:fxCellOut ${FX_MS}ms cubic-bezier(.6,0,.7,.3) both;}
    @keyframes fxCellIn{0%{opacity:0;transform:scale(.2) rotateX(80deg)}
        45%{opacity:1;transform:none}100%{opacity:0;transform:scale(1.5) rotateX(-70deg)}}
    @keyframes fxCellOut{0%{opacity:0;transform:scale(1.5) rotateX(-70deg)}
        55%{opacity:1;transform:none}100%{opacity:0;transform:scale(.2) rotateX(80deg)}}

    /* ============ 4. BOARD — column sweep ============ */
    .fx-col{position:absolute;top:0;bottom:0;background:rgb(var(--accent-rgb) / .9);
        box-shadow:0 0 40px rgb(var(--accent-rgb) / .7);}
    #fx.in .fx-col{animation:fxColIn ${FX_MS}ms cubic-bezier(.35,1,.35,1) both;}
    #fx.out .fx-col{animation:fxColOut ${FX_MS}ms cubic-bezier(.6,0,.7,.3) both;}
    @keyframes fxColIn{0%{transform:translateY(-105%)}42%{transform:none}100%{transform:translateY(105%)}}
    @keyframes fxColOut{0%{transform:translateY(105%)}52%{transform:none}100%{transform:translateY(-105%)}}

    /* ============ 5. CANVAS — ink blot ============ */
    .fx-ink{position:absolute;border-radius:48% 52% 44% 56%/54% 46% 56% 44%;
        background:rgb(var(--accent-rgb) / .94);filter:blur(.4px);}
    #fx.in .fx-ink{animation:fxInkIn ${FX_MS}ms cubic-bezier(.28,1,.35,1) both;}
    #fx.out .fx-ink{animation:fxInkOut ${FX_MS}ms cubic-bezier(.6,0,.75,.25) both;}
    @keyframes fxInkIn{0%{transform:scale(0) rotate(0);opacity:1}
        60%{opacity:.95}100%{transform:scale(26) rotate(90deg);opacity:0}}
    @keyframes fxInkOut{0%{transform:scale(26) rotate(90deg);opacity:0}
        40%{opacity:.95}100%{transform:scale(0) rotate(0);opacity:1}}
    .fx-drip{position:absolute;width:5px;border-radius:99px;background:rgb(var(--accent-rgb) / .85);opacity:0;}
    #fx.in .fx-drip{animation:fxDrip ${FX_MS}ms cubic-bezier(.4,0,.6,1) both;}
    @keyframes fxDrip{0%{height:0;opacity:0}30%{opacity:1}100%{height:60vh;opacity:0}}

    /* ============ 6. TMPL — dealt sheets ============ */
    .fx-sheet{position:absolute;left:50%;top:50%;width:min(30vw,240px);height:min(40vh,320px);
        margin:min(-20vh,-160px) 0 0 min(-15vw,-120px);border-radius:8px;
        background:linear-gradient(160deg,#fffdf7,#e8dfcc);
        box-shadow:0 16px 40px rgba(0,0,0,.4),inset 0 0 0 1px rgba(0,0,0,.08);opacity:0;}
    #fx.in .fx-sheet{animation:fxSheetIn ${FX_MS}ms cubic-bezier(.3,1,.4,1) both;}
    #fx.out .fx-sheet{animation:fxSheetOut ${FX_MS}ms cubic-bezier(.6,0,.7,.3) both;}
    @keyframes fxSheetIn{0%{opacity:0;transform:translate(0,60vh) rotate(0) scale(.7)}
        40%{opacity:1;transform:translate(var(--sx),var(--sy)) rotate(var(--sr)) scale(1)}
        100%{opacity:0;transform:translate(calc(var(--sx)*3),-70vh) rotate(calc(var(--sr)*2.4)) scale(1.3)}}
    @keyframes fxSheetOut{0%{opacity:0;transform:translate(calc(var(--sx)*3),-70vh) rotate(calc(var(--sr)*2.4)) scale(1.3)}
        50%{opacity:1;transform:translate(var(--sx),var(--sy)) rotate(var(--sr)) scale(1)}
        100%{opacity:0;transform:translate(0,60vh) rotate(0) scale(.7)}}

    /* ============ 7. MATRIX — quadrant slam ============ */
    .fx-quad{position:absolute;width:50%;height:50%;background:rgb(var(--accent-rgb) / .93);
        box-shadow:inset 0 0 0 2px rgba(255,255,255,.28),0 0 50px rgb(var(--accent-rgb) / .6);}
    #fx.in .fx-quad{animation:fxQuadIn ${FX_MS}ms cubic-bezier(.3,1.3,.4,1) both;}
    #fx.out .fx-quad{animation:fxQuadOut ${FX_MS}ms cubic-bezier(.6,0,.7,.3) both;}
    @keyframes fxQuadIn{0%{transform:translate(var(--qx),var(--qy));opacity:0}
        46%{transform:none;opacity:1}100%{transform:scale(1.9);opacity:0}}
    @keyframes fxQuadOut{0%{transform:scale(1.9);opacity:0}
        50%{transform:none;opacity:1}100%{transform:translate(var(--qx),var(--qy));opacity:0}}
    .fx-cross{position:absolute;background:#fff;opacity:0;box-shadow:0 0 26px #fff;}
    #fx.in .fx-cross{animation:fxCross ${FX_MS}ms ease-out .16s both;}
    @keyframes fxCross{0%{opacity:0;transform:scale(0)}45%{opacity:1;transform:none}100%{opacity:0;transform:scale(1.4)}}

    /* ============ 8. GRAPH — node burst ============ */
    .fx-node{position:absolute;border-radius:99px;background:rgb(var(--accent-rgb));
        box-shadow:0 0 20px rgb(var(--accent-rgb) / .9);opacity:0;}
    #fx.in .fx-node{animation:fxNodeIn ${FX_MS}ms cubic-bezier(.25,1.2,.4,1) both;}
    #fx.out .fx-node{animation:fxNodeOut ${FX_MS}ms cubic-bezier(.6,0,.7,.3) both;}
    @keyframes fxNodeIn{0%{opacity:0;transform:translate(-50%,-50%) scale(0)}
        40%{opacity:1;transform:translate(-50%,-50%) scale(1)}
        100%{opacity:0;transform:translate(-50%,-50%) scale(3.4)}}
    @keyframes fxNodeOut{0%{opacity:0;transform:translate(-50%,-50%) scale(3.4)}
        50%{opacity:1;transform:translate(-50%,-50%) scale(1)}
        100%{opacity:0;transform:translate(-50%,-50%) scale(0)}}
    .fx-edge{position:absolute;height:1.6px;transform-origin:0 50%;background:rgb(var(--accent-rgb) / .75);opacity:0;}
    #fx.in .fx-edge{animation:fxEdge ${FX_MS}ms cubic-bezier(.3,1,.4,1) .1s both;}
    @keyframes fxEdge{0%{opacity:0;transform:scaleX(0)}45%{opacity:.9;transform:scaleX(1)}100%{opacity:0}}

    @media (prefers-reduced-motion:reduce){
        #fx,#crt{animation-duration:.15s!important}
        #fx *,#crt *{animation-duration:.15s!important;animation-delay:0ms!important}
    }
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="fx"><div class="fx-l" id="fx-l"></div></div>
    <div id="crt"><div class="cr-atmo"></div><div id="cr-stage"></div></div>`);

    const $ = id => document.getElementById(id);
    const L = $('fx-l'), FX = $('fx');
    let busy = false;

    /* ============ BUILDERS ============ */
    const BUILD = {
        home() {
            let h = '<span class="fx-iris"></span>';
            for (let i = 0; i < 12; i++)
                h += `<span class="fx-ray" style="transform:rotate(${i * 30}deg);animation-delay:${i * 16}ms"></span>`;
            return h;
        },
        today() { return '<div class="fx-sky"></div><span class="fx-sun"></span>'; },
        month() {
            const c = window.innerWidth < 620 ? 5 : 7, r = 5;
            let h = '';
            for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) {
                const d = (Math.abs(x - (c - 1) / 2) + Math.abs(y - (r - 1) / 2)) * 34;
                h += `<span class="fx-cell" style="left:${x / c * 100}%;top:${y / r * 100}%;
                    width:${100 / c}%;height:${100 / r}%;animation-delay:${d}ms"></span>`;
            }
            return h;
        },
        board() {
            const n = window.innerWidth < 620 ? 4 : 6;
            let h = '';
            for (let i = 0; i < n; i++)
                h += `<span class="fx-col" style="left:${i / n * 100}%;width:${100 / n}%;animation-delay:${i * 52}ms"></span>`;
            return h;
        },
        canvas() {
            let h = '';
            const pts = [[50, 50, 0], [26, 34, 70], [74, 62, 110], [38, 72, 150], [66, 28, 190]];
            pts.forEach(([x, y, d], i) => {
                const s = i ? 60 : 130;
                h += `<span class="fx-ink" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;
                    margin:${-s / 2}px 0 0 ${-s / 2}px;animation-delay:${d}ms"></span>`;
            });
            for (let i = 0; i < 5; i++)
                h += `<span class="fx-drip" style="left:${14 + i * 18}%;top:${34 + Math.random() * 20}%;animation-delay:${160 + i * 60}ms"></span>`;
            return h;
        },
        tmpl() {
            let h = '';
            for (let i = 0; i < 5; i++)
                h += `<span class="fx-sheet" style="--sx:${(i - 2) * 15}vw;--sy:${(i % 2 ? -1 : 1) * 4}vh;
                    --sr:${(i - 2) * 9}deg;animation-delay:${i * 62}ms"></span>`;
            return h;
        },
        matrix() {
            const q = [[0, 0, '-100%', '-100%'], [50, 0, '100%', '-100%'], [0, 50, '-100%', '100%'], [50, 50, '100%', '100%']];
            let h = '';
            q.forEach(([x, y, dx, dy], i) => {
                h += `<span class="fx-quad" style="left:${x}%;top:${y}%;--qx:${dx};--qy:${dy};animation-delay:${i * 42}ms"></span>`;
            });
            h += '<span class="fx-cross" style="left:0;top:calc(50% - 2px);width:100%;height:4px"></span>';
            h += '<span class="fx-cross" style="top:0;left:calc(50% - 2px);height:100%;width:4px;animation-delay:.06s"></span>';
            return h;
        },
        graph() {
            const N = window.innerWidth < 620 ? 9 : 14, pts = [];
            let h = '';
            for (let i = 0; i < N; i++) {
                const a = (i / N) * Math.PI * 2 + Math.random() * .4;
                const rad = 16 + Math.random() * 26;
                const x = 50 + Math.cos(a) * rad, y = 50 + Math.sin(a) * rad * .82;
                const s = 9 + Math.random() * 16;
                pts.push([x, y]);
                h += `<span class="fx-node" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;
                    animation-delay:${i * 26}ms"></span>`;
            }
            pts.forEach(([x, y], i) => {
                const [x2, y2] = pts[(i + 1 + Math.floor(Math.random() * 2)) % N];
                const dx = (x2 - x) / 100 * window.innerWidth, dy = (y2 - y) / 100 * window.innerHeight;
                h += `<span class="fx-edge" style="left:${x}%;top:${y}%;width:${Math.hypot(dx, dy)}px;
                    transform:rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg);animation-delay:${i * 26 + 60}ms"></span>`;
            });
            return h;
        }
    };

    function play(kind, dir, cb) {
        if (!FX_ON || busy || !BUILD[kind]) { if (cb) cb(); return; }
        busy = true;
        L.innerHTML = BUILD[kind]();
        FX.className = 'on ' + dir;
        if (cb) setTimeout(cb, Math.round(FX_MS * (dir === 'in' ? 0.34 : 0.5)));
        setTimeout(() => { FX.className = ''; L.innerHTML = ''; busy = false; }, FX_MS + 90);
    }


    /* ============ LIGHT / DARK CRT ============ */
         /* ============ THEME SWITCH — storm & sunrise ============ */
    /* One jagged bolt with two forks, generated fresh each strike so no two
       are identical. Coordinates are in a 400×800 viewBox, sliced to fill. */
    function boltPath(x0, spread, steps) {
        let x = x0, y = 0, d = 'M' + x + ' 0';
        const step = 800 / steps;
        for (let i = 1; i <= steps; i++) {
            y = Math.round(step * i);
            x = Math.round(x + (Math.random() - .5) * spread);
            x = Math.max(40, Math.min(360, x));
            d += ' L' + x + ' ' + y;
        }
        return { d: d, endX: x };
    }
    function forkPath(fromX, fromY, dir) {
        let x = fromX, y = fromY, d = 'M' + x + ' ' + y;
        for (let i = 1; i <= 4; i++) {
            y = Math.round(y + 55 + Math.random() * 40);
            x = Math.round(x + dir * (26 + Math.random() * 34));
            d += ' L' + x + ' ' + y;
        }
        return d;
    }
    function buildStorm() {
        const main = boltPath(170 + Math.random() * 60, 84, 9);
        const f1 = forkPath(Math.round(main.endX * .55 + 90), 250 + Math.random() * 90, -1);
        const f2 = forkPath(Math.round(main.endX * .6 + 70), 430 + Math.random() * 90, 1);
        let rain = '';
        const N = window.innerWidth < 620 ? 18 : 34;
        for (let i = 0; i < N; i++) {
            rain += `<span class="lt-rain" style="left:${(Math.random() * 108 - 4).toFixed(1)}%;
                height:${(9 + Math.random() * 16).toFixed(0)}vh;
                animation-duration:${(.55 + Math.random() * .5).toFixed(2)}s;
                animation-delay:${Math.round(CRT_MS * .14 + Math.random() * CRT_MS * .42)}ms"></span>`;
        }
        return `<span class="lt-glow"></span>
        <svg class="lt-bolt" viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice">
          <path class="lt-halo" pathLength="1" d="${main.d}"/>
          <path class="lt-core" pathLength="1" d="${main.d}"/>
          <g class="lt-b2">
            <path class="lt-halo" style="stroke-width:5;animation:none;stroke-dashoffset:0" d="${f1}"/>
            <path class="lt-core" style="stroke-width:1.5;animation:none;stroke-dashoffset:0" d="${f1}"/>
            <path class="lt-halo" style="stroke-width:5;animation:none;stroke-dashoffset:0" d="${f2}"/>
            <path class="lt-core" style="stroke-width:1.5;animation:none;stroke-dashoffset:0" d="${f2}"/>
          </g>
        </svg>
        <span class="lt-flash"></span>${rain}`;
    }
    function buildSunrise() {
        const N = window.innerWidth < 620 ? 13 : 21;
        let rays = '';
        for (let i = 0; i < N; i++) {
            const a = -78 + (i / (N - 1)) * 156 + (Math.random() - .5) * 5;
            const w = 26 + Math.random() * 68;
            rays += `<span class="sr-ray" style="width:${w.toFixed(0)}px;margin-left:${(-w / 2).toFixed(0)}px;
                transform:rotate(${a.toFixed(1)}deg);
                animation-delay:${Math.round(Math.abs(a) * 2.4 + Math.random() * 60)}ms;
                opacity:0"></span>`;
        }
        let motes = '';
        const M = window.innerWidth < 620 ? 10 : 20;
        for (let i = 0; i < M; i++) {
            motes += `<span class="sr-mote" style="left:${(Math.random() * 100).toFixed(1)}%;
                top:${(12 + Math.random() * 72).toFixed(1)}%;
                animation-delay:${Math.round(CRT_MS * .2 + Math.random() * CRT_MS * .38)}ms"></span>`;
        }
        return `<span class="sr-core"></span><span class="sr-flare"></span>
                <span class="sr-fan">${rays}</span>${motes}`;
    }

    const _tt = window.toggleTheme;
    if (typeof _tt === 'function') {
        window.toggleTheme = function () {
            if (busy) return;
            if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return _tt.apply(this, arguments);
            busy = true;
            const wasDark = document.documentElement.classList.contains('dark');
            const kind = wasDark ? 'sr' : 'lt';          /* dark→light = sunrise, light→dark = storm */
            const crt = $('crt'), stage = $('cr-stage');
            stage.innerHTML = wasDark ? buildSunrise() : buildStorm();
            crt.className = '';
            void crt.offsetWidth;                        /* restart every animation cleanly */
            crt.className = 'on ' + kind;
            try {
                if (navigator.vibrate) navigator.vibrate(wasDark
                    ? [0, 300, 8, 120, 12, 130, 18, 150, 28]                   /* dawn: a slow swell */
                    : [0, 400, 16, 28, 10, 150, 18, 30, 12, 70, 90]);          /* strike, strike, rumble */
            } catch (e) {}
            /* the theme flips at peak brightness — inside the flash, inside the glare */
            setTimeout(() => { _tt.call(this); }, Math.round(CRT_MS * 0.5));
            setTimeout(() => { crt.className = ''; stage.innerHTML = ''; busy = false; }, CRT_MS + 90);
        };
    }
    setTimeout(() => {
        ['theme-btn', 'm-theme-btn'].forEach(id => {
            const b = document.getElementById(id);
            if (!b) return;
            b.removeAttribute('onclick');
            b.addEventListener('click', e => { e.preventDefault(); toggleTheme(); });
        });
        document.querySelectorAll('#more-menu button, #mobile-menu-dropdown button').forEach(b => {
            if (!/light\s*\/\s*dark/i.test(b.textContent)) return;
            b.removeAttribute('onclick');
            b.addEventListener('click', () => {
                toggleTheme();
                try { toggleMoreMenu(); } catch (e) {}
                try { toggleMobileMenu(); } catch (e) {}
            });
        });
    }, 900);
})();

    // New Code

    /* ============================================================
   V9.1 — DAILY REVIEW, REBUILT
   A proper morning briefing: greeting, habit check-in ring that
   opens The Grid, quick-log chips for today's unlogged habits,
   the daily note, and the notes worth reopening today.
   Replaces V7.3's daily review. Reads V8.0 trackers directly, so
   it works even if The Grid hasn't been opened this session.
============================================================ */
(function zd91() {
    if (window.__zd91) return; window.__zd91 = true;

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const DR_PICKS = 6;    // ⚙ how many "useful today" notes to surface
    const DR_CHIPS = 4;    // ⚙ how many quick-log habit chips to show
    /* ─────────────────────────────────────────────────────────── */

    document.head.insertAdjacentHTML('beforeend', `<style>
    #dr2{position:fixed;inset:0;z-index:128;display:none;align-items:flex-end;justify-content:center;
        background:rgba(4,6,11,.68);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);}
    #dr2.open{display:flex;animation:dr2Bg .26s ease-out;}
    @keyframes dr2Bg{0%{opacity:0}100%{opacity:1}}
    @media(min-width:640px){#dr2{align-items:center;padding:18px;}}
    #dr2-box{width:100%;max-width:452px;max-height:92vh;display:flex;flex-direction:column;
        background:var(--surface-color);border:1px solid var(--border-color);
        border-radius:24px 24px 0 0;overflow:hidden;box-shadow:0 -24px 70px rgba(0,0,0,.55);
        animation:dr2Up .42s cubic-bezier(.22,1,.36,1);}
    @media(min-width:640px){#dr2-box{border-radius:24px;animation:dr2In .38s cubic-bezier(.22,1,.36,1);}}
    @keyframes dr2Up{0%{transform:translateY(100%)}100%{transform:none}}
    @keyframes dr2In{0%{opacity:0;transform:translateY(16px) scale(.97)}100%{opacity:1;transform:none}}

    /* ---------- hero ---------- */
    #dr2-hero{position:relative;padding:20px 20px 17px;flex-shrink:0;overflow:hidden;
        border-bottom:1px solid var(--border-color);}
    #dr2-hero::before{content:'';position:absolute;inset:0;pointer-events:none;
        background:radial-gradient(520px 240px at 82% -30%,rgb(var(--accent-rgb) / .2),transparent 66%),
                   radial-gradient(360px 200px at 6% 120%,rgb(var(--accent-rgb) / .11),transparent 62%);}
    #dr2-hero > *{position:relative;z-index:2;}
    .dr2-eyebrow{display:flex;align-items:center;gap:6px;font-size:8.5px;font-weight:900;
        letter-spacing:.15em;text-transform:uppercase;color:rgb(var(--accent-rgb));margin-bottom:7px;}
    .dr2-eyebrow svg{width:12px;height:12px;}
    .dr2-hi{font-size:22px;font-weight:800;color:var(--text-color);line-height:1.15;letter-spacing:-.015em;}
    .dr2-dt{font-size:11px;color:var(--muted-color,#9ca3af);margin-top:3px;font-weight:500;}
    #dr2-x{position:absolute;top:14px;right:14px;z-index:3;width:32px;height:32px;border-radius:99px;
        display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;
        color:#9ca3af;transition:all .15s ease;}
    #dr2-x:hover{color:#ef4444;background:rgba(239,68,68,.11);}
    #dr2-x:active{transform:scale(.9);}

    #dr2-body{flex:1;min-height:0;overflow-y:auto;padding:16px 16px 22px;}
    .dr2-lbl{display:flex;align-items:center;gap:7px;font-size:8.5px;font-weight:900;letter-spacing:.13em;
        text-transform:uppercase;color:#9ca3af;margin:20px 0 9px;}
    .dr2-lbl:first-child{margin-top:0;}
    .dr2-lbl::after{content:'';flex:1;height:1px;background:var(--border-color);opacity:.7;}

    /* ---------- the habit check-in ---------- */
    #dr2-grid{width:100%;display:flex;align-items:center;gap:14px;padding:15px;border-radius:18px;
        border:1px solid var(--border-color);background:var(--bg-color);text-align:left;
        position:relative;overflow:hidden;transition:transform .18s cubic-bezier(.22,1,.36,1),border-color .18s ease;
        animation:dr2Pop .46s cubic-bezier(.22,1,.36,1) both;}
    #dr2-grid:hover{transform:translateY(-2px);border-color:rgb(var(--accent-rgb) / .6);}
    #dr2-grid:active{transform:scale(.985);}
    @keyframes dr2Pop{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:none}}
    #dr2-grid::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.9;
        background:radial-gradient(300px 160px at 100% 0%,var(--dg-c,rgb(var(--accent-rgb) / .16)),transparent 70%);}
    #dr2-grid > *{position:relative;z-index:2;}
    .dg-ring{position:relative;width:62px;height:62px;flex-shrink:0;}
    .dg-ring > svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);}
    .dg-ring circle{transition:stroke-dashoffset 1s cubic-bezier(.22,1,.36,1);}
    .dg-ico{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        color:var(--dg-c,rgb(var(--accent-rgb)));}
        /* the mark sits dead centre and is never touched by the ring's rules */
    .dg-ico > svg.dg-mark{position:static!important;inset:auto!important;transform:none!important;
        width:25px!important;height:25px!important;display:block;overflow:visible;}
    @media(max-width:520px){.dg-ico > svg.dg-mark{width:23px!important;height:23px!important;}}
    /* the heart beats — a real double-thump, scaled about its own centre */
    .dg-mark .dg-heart{transform-box:fill-box;transform-origin:center;
        animation:dgBeat 2.2s cubic-bezier(.4,0,.5,1) infinite;}
    @keyframes dgBeat{0%,100%{transform:scale(1)}
        11%{transform:scale(1.12)}21%{transform:scale(1)}
        31%{transform:scale(1.07)}43%{transform:scale(1)}}
    /* the trace draws left to right, in time with the beat */
    .dg-mark .dg-ecg{stroke-width:1.7;stroke-dasharray:1;stroke-dashoffset:1;
        animation:dgTrace 2.2s cubic-bezier(.5,0,.5,1) infinite;}
    @keyframes dgTrace{0%{stroke-dashoffset:1}
        34%{stroke-dashoffset:0}72%{stroke-dashoffset:0}
        86%{stroke-dashoffset:-1}100%{stroke-dashoffset:-1}}
    .dg-t{font-size:13.5px;font-weight:800;color:var(--text-color);line-height:1.25;}
    .dg-s{font-size:10.5px;color:#9ca3af;margin-top:3px;line-height:1.45;}
    .dg-s b{color:var(--dg-c,rgb(var(--accent-rgb)));font-weight:800;}
    .dg-arrow{flex-shrink:0;width:28px;height:28px;border-radius:99px;display:flex;align-items:center;
        justify-content:center;background:var(--dg-c,rgb(var(--accent-rgb)));color:#fff;
        box-shadow:0 4px 14px rgba(0,0,0,.28);}
    .dg-arrow svg{width:14px;height:14px;}
    #dr2-grid:hover .dg-arrow{animation:dgNudge .6s ease-in-out infinite;}
    @keyframes dgNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
    .dg-flame{position:absolute;top:10px;right:52px;z-index:3;font-size:9.5px;font-weight:900;
        padding:2.5px 8px;border-radius:99px;background:rgba(255,167,38,.16);color:#ffa726;white-space:nowrap;}

    /* ---------- quick chips ---------- */
    #dr2-chips{display:flex;flex-wrap:wrap;gap:6px;}
    .dr2-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:99px;
        font-size:11px;font-weight:700;background:var(--bg-color);border:1px solid var(--border-color);
        color:var(--text-color);transition:all .16s ease;
        animation:dr2Pop .4s cubic-bezier(.22,1,.36,1) both;}
    .dr2-chip:hover{border-color:var(--cc,rgb(var(--accent-rgb)));color:var(--cc,rgb(var(--accent-rgb)));
        transform:translateY(-1px);}
    .dr2-chip:active{transform:scale(.95);}
    .dr2-chip i{width:7px;height:7px;border-radius:99px;background:var(--cc,#4ade80);flex-shrink:0;}
    .dr2-chip.done{opacity:.45;}
    .dr2-chip.done i{background:#4ade80;}

    /* ---------- daily note ---------- */
    #dr2-note{width:100%;display:flex;align-items:center;gap:11px;padding:13px 15px;border-radius:16px;
        color:#fff;background-image:var(--zd-grad);text-align:left;
        box-shadow:0 8px 24px rgb(var(--accent-rgb) / .28);
        transition:transform .16s ease;animation:dr2Pop .44s cubic-bezier(.22,1,.36,1) .06s both;}
    #dr2-note:active{transform:scale(.98);}
    #dr2-note svg{width:19px;height:19px;flex-shrink:0;}
    #dr2-note b{display:block;font-size:12.5px;font-weight:800;}
    #dr2-note span{display:block;font-size:10px;opacity:.86;margin-top:1px;}

    /* ---------- picks ---------- */
    .dr2-card{width:100%;text-align:left;display:flex;align-items:flex-start;gap:10px;
        padding:11px 13px;border-radius:14px;background:var(--bg-color);
        border:1px solid var(--border-color);border-left:3px solid var(--pc,rgb(var(--accent-rgb)));
        margin-bottom:7px;transition:all .16s ease;
        animation:dr2Pop .4s cubic-bezier(.22,1,.36,1) both;}
    .dr2-card:hover{transform:translateX(3px);border-color:rgb(var(--accent-rgb) / .55);}
    .dr2-card:active{transform:scale(.99);}
    .dr2-why{display:inline-flex;align-items:center;gap:4px;font-size:8.5px;font-weight:900;
        letter-spacing:.07em;text-transform:uppercase;color:var(--pc,rgb(var(--accent-rgb)));margin-bottom:3px;}
    .dr2-why svg{width:10px;height:10px;}
   /* the card and its column must be allowed to shrink below their content */
    .dr2-card{align-items:flex-start;}
    .dr2-card > span{min-width:0;flex:1 1 auto;overflow:hidden;}
    .dr2-why{flex-wrap:wrap;}
    /* title: wraps to a second line, then clamps */
    .dr2-ti{font-size:12.5px;font-weight:700;color:var(--text-color);line-height:1.35;
        white-space:normal;overflow-wrap:anywhere;word-break:break-word;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    /* preview: two lines on phones, one on wider screens */
    .dr2-ex{font-size:10px;color:#9ca3af;margin-top:3px;line-height:1.45;
        white-space:normal;overflow-wrap:anywhere;word-break:break-word;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    @media (min-width:640px){ .dr2-ex{-webkit-line-clamp:1;} }
    .dr2-empty{text-align:center;padding:26px 16px;color:#9ca3af;font-size:11.5px;line-height:1.7;}
    .dr2-empty svg{width:34px;height:34px;margin:0 auto 10px;opacity:.4;}
    .dr2-skel{height:74px;border-radius:18px;background:var(--bg-color);
        animation:dr2Sk 1.3s ease-in-out infinite;}
    @keyframes dr2Sk{0%,100%{opacity:.5}50%{opacity:.85}}
    </style>`);

    /* remove the old panel */
    const old = document.getElementById('dr-modal'); if (old) old.remove();

    document.body.insertAdjacentHTML('beforeend', `
    <div id="dr2"><div id="dr2-box">
      <div id="dr2-hero">
        <button id="dr2-x" onclick="closeDaily()" title="Close (Esc)">×</button>
        <div class="dr2-eyebrow">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/></svg>
          <span>Daily review</span>
        </div>
        <div class="dr2-hi" id="dr2-hi">Good morning</div>
        <div class="dr2-dt" id="dr2-dt"></div>
      </div>
      <div id="dr2-body"></div>
    </div></div>`);

    const $ = id => document.getElementById(id);
    const ts = v => (v && v.toDate) ? v.toDate().getTime() : 0;
    const dkey = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const locked = d => !!(d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(d.id)));

    /* the runner mark — daily action */
    /* heart with an ECG trace through it — reads as health, habit and vitality,
       and stays legible at 26px inside the ring */
    /* heart + ECG trace — centred on the 24×24 box, pathLength normalised so the
       trace animation is exact regardless of the path's real length */
    const RUN = '<svg class="dg-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
        + '<path class="dg-heart" d="M12 20.4l-6.55-6.45a4.35 4.35 0 116.55-5.65 4.35 4.35 0 116.55 5.65L12 20.4z"/>'
        + '<path class="dg-ecg" pathLength="1" d="M6.7 13h2.15l1.35-2.75 1.7 4.85 1.5-3.35 1 1.25h2.05"/></svg>';
    const ARROW = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>';

    /* ---------- trackers: read straight from Firestore so this works standalone ---------- */
    let TRKS = null;
    async function loadTrk() {
        if (state.isGuest || !state.user) { TRKS = []; return; }
        try {
            const snap = await db.collection('users').doc(state.user.uid).collection('trackers').get();
            TRKS = [];
            snap.docs.forEach(d => { if (d.id !== '_body') TRKS.push(Object.assign({ id: d.id }, d.data())); });
        } catch (e) { TRKS = []; }
    }
    function streak(t) {
        let n = 0; const d = new Date();
        for (let i = 0; i < 400; i++) {
            const hit = !!(t.logs && t.logs[dkey(d)]);
            const ok = t.kind === 'bad' ? !hit : hit;
            if (ok) n++; else break;
            d.setDate(d.getDate() - 1);
        }
        return n;
    }

    /* ---------- open / close ---------- */
    window.openDaily = async () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        const h = new Date().getHours();
        $('dr2-hi').textContent = h < 5 ? 'Still up?' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Winding down';
        $('dr2-dt').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        $('dr2-body').innerHTML = '<div class="dr2-skel"></div>';
        $('dr2').classList.add('open');
        localStorage.setItem('zdDrSeen', new Date().toISOString().slice(0, 10));
        if (TRKS === null) await loadTrk();
        renderDr2();
    };
    window.closeDaily = () => $('dr2').classList.remove('open');
    window.drOpen = (id) => {
        const d = state.docs.find(x => x.id === id);
        closeDaily();
        if (d) setTimeout(() => openDoc(d.id, d), 60);
    };
    /* habit chip → close the review, then open that tracker's log sheet */
    window.drLog = (id) => {
        closeDaily();
        setTimeout(() => {
            if (typeof trkLog === 'function' && window.zdTrk && (window.zdTrk.list || []).length) trkLog(id, dkey(new Date()));
            else if (typeof openTrackers === 'function') openTrackers();
        }, 260);
    };
    window.drGrid = () => {
        closeDaily();
        setTimeout(() => { try { openTrackers(); } catch (e) { showToast('Trackers are switched off on this device.'); } }, 280);
        try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
    };

    /* ---------- render ---------- */
    function renderDr2() {
        const now = new Date(), today = dkey(now);
        const trks = TRKS || [];
        const due = trks.filter(t => t.kind !== 'bad');
        const doneToday = due.filter(t => t.logs && t.logs[today]);
        const openToday = due.filter(t => !(t.logs && t.logs[today]));
        const slips = trks.filter(t => t.kind === 'bad' && t.logs && t.logs[today]).length;
        const best = trks.reduce((m, t) => Math.max(m, streak(t)), 0);
        const pct = due.length ? doneToday.length / due.length : 0;
        const R = 27, C = 2 * Math.PI * R;
        const col = !trks.length ? 'rgb(var(--accent-rgb))'
            : pct === 1 ? '#4ade80' : pct >= .5 ? '#38bdf8' : pct > 0 ? '#fbbf24' : '#fb923c';

        /* --- the check-in card --- */
        let sub, title;
        if (!trks.length) { title = 'Start tracking a habit'; sub = 'Running, gym, reading, water — <b>one tap a day</b> is the whole ritual.'; }
        else if (!due.length) { title = 'Open The Grid'; sub = 'Your streaks and calendars are waiting.'; }
        else if (pct === 1) { title = 'All habits logged'; sub = `<b>${doneToday.length}/${due.length}</b> done today${slips ? ' · ' + slips + ' slip logged' : ''} — that is the day won.`; }
        else if (pct === 0) { title = 'Check in for today'; sub = `<b>${due.length}</b> habit${due.length === 1 ? '' : 's'} waiting${best ? ' · protect your <b>' + best + '-day</b> streak' : ''}.`; }
        else { title = 'Finish today\u2019s check-in'; sub = `<b>${doneToday.length}/${due.length}</b> logged — <b>${openToday.length}</b> still to go.`; }

        let h = `<button id="dr2-grid" onclick="drGrid()" style="--dg-c:${col}">
            ${best >= 3 ? `<span class="dg-flame">🔥 ${best}d</span>` : ''}
            <span class="dg-ring">
              <svg viewBox="0 0 62 62">
                <circle cx="31" cy="31" r="${R}" fill="none" stroke="var(--border-color)" stroke-width="4"/>
                <circle cx="31" cy="31" r="${R}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"
                  stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - (trks.length ? pct : 0))).toFixed(1)}"/>
              </svg>
              <span class="dg-ico">${RUN}</span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="dg-t">${title}</span>
              <span class="dg-s">${sub}</span>
            </span>
            <span class="dg-arrow">${ARROW}</span>
          </button>`;

        /* --- quick chips --- */
        if (openToday.length || doneToday.length) {
            const chips = openToday.slice(0, DR_CHIPS).map((t, i) =>
                `<button class="dr2-chip" style="--cc:${t.color || '#4ade80'};animation-delay:${i * 40}ms" onclick="drLog('${t.id}')">
                   <i></i>${escapeHtml((t.name || '').slice(0, 22))}</button>`).join('')
              + doneToday.slice(0, 3).map((t, i) =>
                `<button class="dr2-chip done" style="animation-delay:${(i + openToday.length) * 40}ms" onclick="drLog('${t.id}')">
                   <i></i>${escapeHtml((t.name || '').slice(0, 18))} ✓</button>`).join('');
            h += `<div class="dr2-lbl"><span>${openToday.length ? 'Log in one tap' : 'Today'}</span></div>
                  <div id="dr2-chips">${chips}</div>`;
        }

        /* --- daily note --- */
        const t = dailyTitle(now);
        const hasDaily = state.docs.some(x => (x.title || '').trim() === t);
        h += `<div class="dr2-lbl"><span>Today\u2019s page</span></div>
        <button id="dr2-note" onclick="closeDaily();setTimeout(openDailyNote,200)">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/></svg>
          <span class="min-w-0 flex-1"><b>${hasDaily ? 'Open today\u2019s note' : 'Start today\u2019s note'}</b>
          <span>${hasDaily ? 'Pick up where you left off' : 'A clean page for ' + now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</span></span>
        </button>`;

        /* --- notes worth reopening --- */
        const pool = state.docs.filter(d => !locked(d));
        const picks = [], seen = new Set();
        const add = (d, why, ico, c) => { if (d && !seen.has(d.id)) { seen.add(d.id); picks.push({ d: d, why: why, ico: ico, c: c }); } };
        const CLOCK = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 7v5l3 2"/></svg>';
        const CHECK = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        const LINK = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.8 10.2a4 4 0 010 5.7l-3 3a4 4 0 11-5.6-5.7"/></svg>';
        const STAR = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5z"/></svg>';
        /* reuse the app's own pin glyph if it's defined, else the matching bookmark */
        const PIN = (typeof PIN_SVG !== 'undefined' ? PIN_SVG
                   : typeof BOOKMARK_SVG !== 'undefined' ? BOOKMARK_SVG
                   : '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 4.8A1.8 1.8 0 017.8 3h8.4A1.8 1.8 0 0118 4.8V21l-6-3.4L6 21V4.8z"/></svg>');

        pool.filter(d => d.eisDue && !d.eisDone && d.eisDue < now.getTime() + 864e5)
            .sort((a, b) => a.eisDue - b.eisDue).slice(0, 3)
            .forEach(d => add(d, d.eisDue < now.getTime() ? 'Overdue' : 'Due today', CLOCK, d.eisDue < now.getTime() ? '#ef4444' : '#fbbf24'));
        pool.map(d => {
            let n = 0; ((d.content && d.content.ops) || []).forEach(o => { if (o.attributes && o.attributes.list === 'unchecked') n++; });
            return { d: d, n: n };
        }).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3)
          .forEach(x => add(x.d, x.n + ' open task' + (x.n === 1 ? '' : 's'), CHECK, '#38bdf8'));
        pool.filter(d => {
            const tt = ts(d.updatedAt); if (!tt) return false;
            const dd = new Date(tt), age = (now - tt) / 864e5;
            return dd.getDay() === now.getDay() && age > 5 && age < 22;
        }).slice(0, 2).forEach(d => add(d, 'You worked on this last ' + now.toLocaleDateString(undefined, { weekday: 'long' }), CLOCK, '#a78bfa'));
        try {
            const recent = pool.filter(d => ts(d.updatedAt) > now.getTime() - 7 * 864e5);
            const linked = new Set();
            recent.forEach(d => (docLinks(d) || []).forEach(l => linked.add(String(l).toLowerCase())));
            pool.filter(d => linked.has((d.title || '').trim().toLowerCase()) && ts(d.updatedAt) < now.getTime() - 30 * 864e5)
                .slice(0, 2).forEach(d => add(d, 'Referenced recently, not opened', LINK, '#a78bfa'));
        } catch (e) {}
        pool.filter(d => d.pinned || d.isFavorite).slice(0, 2)
            .forEach(d => add(d, d.pinned ? 'Pinned' : 'Starred', d.pinned ? PIN : STAR, '#f59e0b'));

        h += `<div class="dr2-lbl"><span>${picks.length ? 'May be useful today' : 'Your notes'}</span></div>`;
        h += picks.length
            ? picks.slice(0, DR_PICKS).map((p, i) =>
               `<button class="dr2-card" style="--pc:${p.c};animation-delay:${i * 45}ms" onclick="drOpen('${p.d.id}')">
                   <span class="min-w-0 flex-1">
                     <span class="dr2-why">${p.ico}${escapeHtml(p.why)}</span>
                     <span class="dr2-ti">${escapeHtml(p.d.title || 'Untitled')}</span>
                     <span class="dr2-ex">${escapeHtml(docPlainText(p.d).replace(/\s+/g, ' ').slice(0, 78))}</span>
                   </span>
                 </button>`).join('')
            : `<div class="dr2-empty">
                 <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                 Clear slate — nothing due, no tasks waiting.<br><b style="color:var(--text-color)">Enjoy the quiet start.</b>
               </div>`;

        $('dr2-body').innerHTML = h;
    }

    /* keep the tracker snapshot fresh */
    setInterval(() => { if (!$('dr2').classList.contains('open')) TRKS = null; }, 120000);
    const _op = window.openTrackers;
    if (typeof _op === 'function') window.openTrackers = function () { TRKS = null; return _op.apply(this, arguments); };

    /* plumbing */
    $('dr2').addEventListener('click', e => { if (e.target.id === 'dr2') closeDaily(); });
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && $('dr2').classList.contains('open')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            closeDaily();
        }
    }, true);
})();    

    // New Code

    /* ============================================================
   V9.2 — DAILY REVIEW: PERMANENT ACCESS
   Alt+D shortcut · guaranteed menu entry · feature switch · help
============================================================ */
(function zd92() {
    if (window.__zd92) return; window.__zd92 = true;
    const ICO = '<circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4"/>';

    /* the menu entry may already exist from V7.3 — only add it if missing */
    setTimeout(() => {
        if (!document.querySelector('[data-zdfn="daily"]')) {
            try { zdMenuInject2('daily', 'openDaily', 'Daily review', ICO); } catch (e) {}
        }
        try {
            if (!ZD_FEATURES.some(f => f.id === 'daily'))
                ZD_FEATURES.push({ id: 'daily', label: 'Daily review', fns: ['openDaily'] });
            ZD_FEAT_ICONS.daily = ICO;
            applyFeatureFlags();
        } catch (e) {}
    }, 800);

    /* ⚙ SHORTCUT: Alt+D opens the daily review from anywhere */
    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && ((e.key || '').toLowerCase() === 'd' || e.code === 'KeyD')) {
            const ae = document.activeElement;
            if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
            e.preventDefault();
            if (typeof zdFeatOn === 'function' && !zdFeatOn('daily')) return;
            openDaily();
        }
    }, true);

    /* add it to the shortcut table in Help */
    setTimeout(() => {
        const rows = document.querySelectorAll('#help-modal table tbody');
        if (!rows.length) return;
        const K = k => '<kbd style="display:inline-block;padding:1px 6px;border-radius:5px;border:1px solid var(--border-color);background:var(--bg-color);font:700 10.5px ui-monospace,monospace;color:var(--text-color)">' + k + '</kbd>';
        const tr = document.createElement('tr');
        tr.innerHTML = '<td style="padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top">' + K('Alt') + ' + ' + K('D') +
            '</td><td style="padding:3px 0;font-size:12px;line-height:1.5">Daily review — habit check-in, today\u2019s note and the notes worth reopening</td>';
        rows[0].appendChild(tr);
    }, 1600);
})();    
                                                                                                            
    // New Code

    /* ============================================================
   V9.3 — "OTHER…" ON EVERY PRESET PICKER
   Quick start · Workout session · Pet care · Colour
   Your own entries are remembered per type and reappear as chips.
   Purely additive — V8.0's own handlers are never replaced.
============================================================ */
(function zd93() {
    if (window.__zd93) return; window.__zd93 = true;
    if (!window.zdTrk) { console.warn('[V9.3] needs V8.0'); return; }

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const KEEP = 14;   // ⚙ how many of your own entries to remember per picker
    /* ─────────────────────────────────────────────────────────── */

    const $ = id => document.getElementById(id);

    document.head.insertAdjacentHTML('beforeend', `<style>
    .zdo-chip{border-style:dashed!important;color:#7d8695!important;}
    .zdo-chip:hover{border-color:rgb(var(--accent-rgb))!important;color:rgb(var(--accent-rgb))!important;}
    .zdo-chip.on{border-style:solid!important;}
    .zdo-row{display:none;gap:6px;margin-top:7px;width:100%;}
    .zdo-row.on{display:flex;animation:zdoIn .22s cubic-bezier(.22,1,.36,1);}
    @keyframes zdoIn{0%{opacity:0;transform:translateY(-5px)}100%{opacity:1;transform:none}}
    .zdo-row input{flex:1;min-width:0;background:rgba(255,255,255,.05);
        border:1px solid rgb(var(--accent-rgb) / .55);border-radius:9px;padding:8px 11px;
        font-size:13px;color:#e8ecf5;outline:none;caret-color:rgb(var(--accent-rgb));}
    @media(max-width:850px){.zdo-row input{font-size:16px;}}
    .zdo-row input::placeholder{color:#5a6472;}
    .zdo-row button{flex-shrink:0;padding:0 15px;border-radius:9px;font-size:11px;font-weight:900;
        color:#fff;background-image:var(--zd-grad);}
    .zdo-row button:active{transform:scale(.95);}
    .zdo-mine{position:relative;padding-right:24px!important;}
    .zdo-x{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:15px;height:15px;
        border-radius:99px;font-size:11px;line-height:13px;color:#5a6472;background:rgba(255,255,255,.07);}
    .zdo-x:hover{color:#fff;background:#ef4444;}
    .zdo-swatch{position:relative;width:30px;height:30px;padding:0!important;border-radius:9px;
        border:2px dashed rgba(255,255,255,.3)!important;overflow:hidden;cursor:pointer;
        background:conic-gradient(#ff5f57,#fbbf24,#4ade80,#38bdf8,#a78bfa,#f472b6,#ff5f57)!important;}
    .zdo-swatch input{position:absolute;inset:0;opacity:0;cursor:pointer;border:0;padding:0;}
    </style>`);

    /* ---------- remembered entries ---------- */
    const mine = k => { try { return JSON.parse(localStorage.getItem('zdOther_' + k) || '[]'); } catch (e) { return []; } };
    function remember(k, v) {
        const a = mine(k).filter(x => x.toLowerCase() !== v.toLowerCase());
        a.unshift(v);
        localStorage.setItem('zdOther_' + k, JSON.stringify(a.slice(0, KEEP)));
    }
    function forget(k, v) {
        localStorage.setItem('zdOther_' + k, JSON.stringify(mine(k).filter(x => x !== v)));
    }

    /* ---------- carrier: routes a custom value through V8.0's own handler ----------
       V8.0 wires each chip to read its data-v, so we borrow a wired sibling for one
       synthetic click. The value lands in V8.0's state exactly as a preset would,
       then the sibling is restored — nothing is left changed. */
    function apply(container, value, chip) {
        const carrier = container.querySelector('.trk-p[data-v]');
        if (!carrier) return false;
        const v0 = carrier.dataset.v, h0 = carrier.innerHTML;
        carrier.dataset.v = value;
        carrier.click();
        carrier.dataset.v = v0; carrier.innerHTML = h0;
        container.querySelectorAll('.trk-p').forEach(x => x.classList.remove('on'));
        if (chip) chip.classList.add('on');
        return true;
    }

    /* ---------- attach an Other… control to any chip container ---------- */
    function attach(container, storeKey, placeholder, current) {
        if (!container || container.dataset.zdo) return;
        container.dataset.zdo = '1';

        /* remembered entries first, as ordinary-looking chips */
        mine(storeKey).forEach(v => {
            const b = document.createElement('button');
            b.className = 'trk-p zdo-mine' + (current && current.toLowerCase() === v.toLowerCase() ? ' on' : '');
            b.innerHTML = escapeHtml(v) + '<span class="zdo-x" title="Remove">×</span>';
            b.onclick = (e) => {
                if (e.target.classList.contains('zdo-x')) {
                    e.stopPropagation(); forget(storeKey, v); b.remove(); return;
                }
                apply(container, v, b);
            };
            container.appendChild(b);
        });

        /* the Other… chip */
        const other = document.createElement('button');
        other.className = 'trk-p zdo-chip';
        other.innerHTML = '+ Other…';
        container.appendChild(other);

        /* inline input, placed after the picker so it never breaks the wrap */
        const row = document.createElement('div');
        row.className = 'zdo-row';
        row.innerHTML = `<input type="text" maxlength="40" placeholder="${placeholder}" autocomplete="off" spellcheck="false"><button type="button">Add</button>`;
        container.insertAdjacentElement('afterend', row);
        const inp = row.querySelector('input'), ok = row.querySelector('button');

        const commit = () => {
            const v = inp.value.trim();
            if (!v) { inp.focus(); return; }
            remember(storeKey, v);
            const b = document.createElement('button');
            b.className = 'trk-p zdo-mine';
            b.innerHTML = escapeHtml(v) + '<span class="zdo-x" title="Remove">×</span>';
            b.onclick = (e) => {
                if (e.target.classList.contains('zdo-x')) { e.stopPropagation(); forget(storeKey, v); b.remove(); return; }
                apply(container, v, b);
            };
            container.insertBefore(b, other);
            apply(container, v, b);
            inp.value = ''; row.classList.remove('on'); other.classList.remove('on');
            showToast('Added “' + v + '”.');
        };
        other.onclick = () => {
            const open = row.classList.toggle('on');
            other.classList.toggle('on', open);
            if (open) setTimeout(() => { try { inp.focus({ preventScroll: true }); zdArmProtect(inp); } catch (e) {} }, 90);
        };
        ok.onclick = commit;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
        ['focusin', 'pointerup', 'input'].forEach(ev => inp.addEventListener(ev, () => { try { zdArmProtect(inp); } catch (e) {} }));
    }

    /* ---------- 1. LOG SHEET: Session (gym) / Care (pet) ---------- */
    const _log = window.trkLog;
    window.trkLog = function (id, dateKey) {
        const r = _log.apply(this, arguments);
        setTimeout(() => {
            const c = $('lg-class'); if (!c) return;
            const t = (window.zdTrk.list || []).find(x => x.id === id);
            const kind = t ? t.kind : 'gym';
            const cur = (t && t.logs && t.logs[dateKey || ''] && t.logs[dateKey].klass) || '';
            attach(c, 'class_' + kind,
                kind === 'pet' ? 'e.g. Misted leaves, Nail trim…' : 'e.g. Calisthenics, Boxing, Pilates…',
                cur);
        }, 40);
        return r;
    };

    /* ---------- 2. EDIT SHEET: Quick start + Colour ---------- */
    function injectEdit() {
        const box = $('trk-edit-box'); if (!box) return;

        /* quick start — reveal a blank form and jump to the name field */
        const lbl = Array.from(box.querySelectorAll('.trk-l')).find(l => /quick start/i.test(l.textContent));
        const qs = lbl && lbl.nextElementSibling;
        if (qs && qs.classList.contains('trk-pick') && !qs.dataset.zdoQs) {
            qs.dataset.zdoQs = '1';
            const b = document.createElement('button');
            b.className = 'trk-p zdo-chip';
            b.innerHTML = '+ Something else…';
            b.onclick = () => {
                const n = $('ed-name');
                if (!n) return;
                n.value = '';
                qs.querySelectorAll('.trk-p').forEach(x => x.classList.remove('on'));
                b.classList.add('on');
                try { n.focus({ preventScroll: true }); zdArmProtect(n); } catch (e) {}
                n.scrollIntoView({ block: 'nearest' });
                showToast('Name it whatever you track — then pick a type below.');
            };
            qs.appendChild(b);
        }

        /* colour — native picker, routed through V8.0's own swatch handler */
        const col = $('ed-col');
        if (col && !col.dataset.zdoCol) {
            col.dataset.zdoCol = '1';
            const w = document.createElement('label');
            w.className = 'trk-p zdo-swatch';
            w.title = 'Any colour you like';
            w.innerHTML = '<input type="color" value="#4ade80">';
            const pick = w.querySelector('input');
            pick.oninput = () => {
                w.style.background = pick.value + '!important';
                w.style.setProperty('background', pick.value, 'important');
                w.style.borderStyle = 'solid';
                apply(col, pick.value, null);
                col.querySelectorAll('.trk-p').forEach(x => x.style.borderColor = 'transparent');
                w.style.borderColor = '#fff';
            };
            col.appendChild(w);
        }
    }
    ['trkNew', 'trkEdit', 'trkPreset'].forEach(fn => {
        const o = window[fn];
        if (typeof o !== 'function') return;
        window[fn] = function () { const r = o.apply(this, arguments); setTimeout(injectEdit, 60); return r; };
    });
})();

    // Note Code

    /* ============================================================
   V9.4 — LOCKED NOTES: ENFORCED FOR ALL VIEWERS
   A locked note now shows the same lock veil and password gate to
   anyone who opens it — signed in, on another device, or viewing a
   shared link. Content is withheld until the password checks out.
============================================================ */
(function zd94() {
    if (window.__zd94) return; window.__zd94 = true;

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* guest lock veil — reuses the V5.4 look, forced above guest chrome */
    body.zd-guest #lk-veil{z-index:70!important;}
    body.zd-guest.zd-locked #paper-container .ql-editor{filter:blur(5px) opacity(.5)!important;}
    body.zd-guest.zd-locked #doc-title{filter:blur(4px) opacity(.55);}
    #lk-pw{position:fixed;inset:0;z-index:132;display:none;align-items:center;justify-content:center;
        background:rgba(4,6,11,.78);backdrop-filter:blur(9px);padding:16px;}
    #lk-pw.open{display:flex;animation:fadeIn .2s ease-out;}
    #lk-pw-box{width:100%;max-width:330px;padding:22px;border-radius:20px;
        background:var(--surface-color);border:1px solid var(--border-color);
        box-shadow:0 26px 64px rgba(0,0,0,.55);animation:boxIn .3s cubic-bezier(.22,1,.36,1);
        position:relative;overflow:hidden;text-align:center;}
    #lk-pw-box::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background-image:var(--zd-grad);}
    #lk-pw-ring{width:58px;height:58px;margin:2px auto 13px;border-radius:99px;display:flex;
        align-items:center;justify-content:center;background-image:var(--zd-grad);
        box-shadow:0 10px 26px rgba(0,0,0,.34);position:relative;}
    #lk-pw-ring::after{content:'';position:absolute;inset:-7px;border-radius:99px;
        border:2px solid rgb(var(--accent-rgb) / .4);animation:lkPulse 2.2s ease-out infinite;}
    #lk-pw-ring svg{width:25px;height:25px;color:#fff;}
    #lk-pw-in{width:100%;background:var(--bg-color);border:1.5px solid var(--border-color);
        border-radius:12px;padding:11px 13px;font-size:15px;color:var(--text-color);outline:none;
        text-align:center;letter-spacing:.14em;caret-color:rgb(var(--accent-rgb));margin-top:4px;}
    @media(max-width:850px){#lk-pw-in{font-size:16px;}}
    #lk-pw-in:focus{border-color:rgb(var(--accent-rgb));}
    #lk-pw-box.bad #lk-pw-in{border-color:#ef4444;animation:lkShake .38s cubic-bezier(.36,.07,.19,.97);}
    @keyframes lkShake{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(4px)}50%{transform:translateX(-5px)}}
    #lk-pw-go{width:100%;margin-top:10px;padding:11px 0;border-radius:13px;font-size:12.5px;
        font-weight:900;color:#fff;background-image:var(--zd-grad);}
    #lk-pw-go:active{transform:scale(.98);}
    #lk-pw-err{font-size:10.5px;color:#ef4444;font-weight:700;min-height:14px;margin-top:7px;}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="lk-pw"><div id="lk-pw-box">
      <div id="lk-pw-ring"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 018 0v4"/></svg></div>
      <div style="font-size:14.5px;font-weight:800;color:var(--text-color)">Protected note</div>
      <div id="lk-pw-sub" style="font-size:11px;color:#9ca3af;margin:5px 0 12px;line-height:1.55"></div>
      <input id="lk-pw-in" type="password" placeholder="Password" autocomplete="off" spellcheck="false">
      <div id="lk-pw-err"></div>
      <button id="lk-pw-go">Unlock</button>
      <button onclick="lkPwClose()" style="width:100%;margin-top:6px;padding:8px 0;font-size:10.5px;font-weight:800;color:#9ca3af">Cancel</button>
    </div></div>`);

    const $ = id => document.getElementById(id);
    let pend = null;

    async function hash(pass, salt) {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '::' + pass));
        return btoa(String.fromCharCode.apply(null, new Uint8Array(b)));
    }
    window.lkPwClose = () => { $('lk-pw').classList.remove('open'); $('lk-pw-err').textContent = ''; };
    window.lkPwAsk = (opts) => {
        pend = opts;
        $('lk-pw-sub').innerHTML = 'Enter the password for <b>' + escapeHtml(opts.title || 'this note') + '</b> to read it.';
        $('lk-pw-in').value = ''; $('lk-pw-err').textContent = '';
        $('lk-pw-box').classList.remove('bad');
        $('lk-pw').classList.add('open');
        setTimeout(() => { try { $('lk-pw-in').focus({ preventScroll: true }); zdArmProtect($('lk-pw-in')); } catch (e) {} }, 110);
    };
    async function tryUnlock() {
        if (!pend) return;
        const p = $('lk-pw-in').value;
        if (!p) return;
        try {
            if (await hash(p, pend.salt || '') !== pend.hash) {
                $('lk-pw-box').classList.add('bad');
                $('lk-pw-err').textContent = 'Incorrect password.';
                $('lk-pw-in').value = '';
                setTimeout(() => $('lk-pw-box').classList.remove('bad'), 420);
                try { if (navigator.vibrate) navigator.vibrate([18, 60, 18]); } catch (e) {}
                return;
            }
        } catch (e) { $('lk-pw-err').textContent = 'Could not verify.'; return; }
        lkPwClose();
        try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
        pend.ok();
        pend = null;
    }
    $('lk-pw-go').onclick = tryUnlock;
    $('lk-pw-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); } });
    ['focusin', 'pointerup', 'input'].forEach(ev => $('lk-pw-in').addEventListener(ev, () => { try { zdArmProtect($('lk-pw-in')); } catch (e) {} }));
    $('lk-pw').addEventListener('click', e => { if (e.target.id === 'lk-pw') lkPwClose(); });
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && $('lk-pw').classList.contains('open')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); lkPwClose();
        }
    }, true);

    /* ---------- shared links: gate before any content is painted ---------- */
    const _lg = window.loadGuestView;
    if (typeof _lg === 'function') {
        window.loadGuestView = async function (shareId) {
            let sd = null;
            try { const s = await db.collection('shared_docs').doc(shareId).get(); if (s.exists) sd = s.data(); } catch (e) {}
            if (sd && sd.lockHash) {
                /* never let the plain content reach the editor */
                const r = await _lg.call(this, shareId);
                try { quill.setContents('', 'silent'); } catch (e) {}
                els.title.value = 'Protected note';
                document.body.classList.add('zd-locked');
                try { zdShowVeil({ id: 'shared', title: sd.t || 'this shared note' }); } catch (e) {}
                const btn = $('lk-btn');
                if (btn) btn.onclick = () => lkPwAsk({
                    title: sd.t || 'this note', hash: sd.lockHash, salt: sd.lockSalt || '',
                    ok: () => {
                        try { zdHideVeil(); } catch (e) {}
                        document.body.classList.remove('zd-locked');
                        els.title.value = sd.t || 'Untitled';
                        quill.setContents(sd.c, 'silent');
                        quill.disable();
                        showToast('Unlocked — read-only.');
                    }
                });
                const sub = $('lk-sub');
                if (sub) sub.textContent = 'The owner protected this note with a password.';
                setTimeout(() => { if (btn) btn.click(); }, 700);
                return r;
            }
            return _lg.apply(this, arguments);
        };
    }

    /* ---------- signed-in viewers on any device: verify against the doc itself ---------- */
    const _lk = document.getElementById('lk-btn');
    if (_lk) {
        _lk.addEventListener('click', async () => {
            if (state.isGuest || !state.docId) return;
            let s;
            try { s = (await db.collection('users').doc(state.user.uid).collection('docs').doc(state.docId).get()).data(); } catch (e) { return; }
            if (!s || !s.lockHash) return;
            lkPwAsk({
                title: s.title || 'this note', hash: s.lockHash, salt: s.lockSalt || '',
                ok: () => {
                    try { zd46Unlocked.add(state.docId); } catch (e) {}
                    try { zdHideVeil(); } catch (e) {}
                    const d = state.docs.find(x => x.id === state.docId);
                    if (d) openDoc(d.id, d);
                    showToast('🔓 Unlocked on this device.');
                }
            });
        }, true);
    }
    /* imported copies of a shared locked note stay locked */
    const _od = window.openDoc;
    window.openDoc = function (id, data) {
        if (data && data.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(id))) {
            try { if (window.closeMentions) closeMentions(); } catch (e) {}
        }
        return _od.apply(this, arguments);
    };
    /* locked notes never leak through quick view, search snippets or the reference pane */
    ['openEisGlance', 'openRefPanel'].forEach(fn => {
        const o = window[fn]; if (typeof o !== 'function') return;
        window[fn] = function (id) {
            const d = state.docs.find(x => x.id === id);
            if (d && d.lockHash && !(typeof zd46Unlocked !== 'undefined' && zd46Unlocked.has(id))) {
                showToast('🔒 This note is locked — open it to unlock.'); return;
            }
            return o.apply(this, arguments);
        };
    });
})();

   /* ============================================================
   V9.5 — SHORTCUTS: Ask your notes (Alt+A) + Help table entries
============================================================ */
(function zd95() {
    if (window.__zd95) return; window.__zd95 = true;

    /* ⚙ Alt+A — Ask your notes (Ctrl+/ from V7.2 still works too) */
    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && ((e.key || '').toLowerCase() === 'a' || e.code === 'KeyA')) {
            const ae = document.activeElement;
            if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
            e.preventDefault();
            if (typeof zdFeatOn === 'function' && !zdFeatOn('ask')) return;
            if (typeof openAsk === 'function') openAsk();
        }
    }, true);

    setTimeout(() => {
        const tb = document.querySelectorAll('#help-modal table tbody');
        if (!tb.length) return;
        const K = k => '<kbd style="display:inline-block;padding:1px 6px;border-radius:5px;border:1px solid var(--border-color);background:var(--bg-color);font:700 10.5px ui-monospace,monospace;color:var(--text-color)">' + k + '</kbd>';
        const row = (keys, desc) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td style="padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top">' + keys +
                '</td><td style="padding:3px 0;font-size:12px;line-height:1.5">' + desc + '</td>';
            return tr;
        };
        tb[0].appendChild(row(K('Alt') + ' + ' + K('A') + ' / ' + K('Ctrl') + ' + ' + K('/'),
            '<b>Ask your notes</b> — natural-language search across everything you\u2019ve written'));
        tb[0].appendChild(row(K('Alt') + ' + ' + K('T'), '<b>The Grid</b> — habit, workout and care trackers'));
        tb[0].appendChild(row(K('Alt') + ' + ' + K('M'), '<b>Meeting mode</b> — record, transcribe and extract actions'));
    }, 1800);
})();

    /* ============================================================
   V9.6 — MEETING MODE  ·  optional
   Record → live transcript → speaker separation → summary →
   action items → saved as a note. Alt+M.

   HOW IT HEARS THE ROOM
   • Microphone: your voice and anyone physically present.
   • System audio (remote participants): tap "Capture tab audio".
     Chrome/Edge on desktop only — you'll be asked to pick a tab or
     window and MUST tick "Share tab audio". Speech recognition
     reads the mic, so tab audio is mixed to your speakers and
     re-heard; use headphones OFF for best results.
   • Speaker separation is heuristic: it splits on pauses and
     tracks pitch/volume bands per segment. Rename speakers after.
   Chrome/Edge/Android: full · Safari: mic only · Firefox: n/a
============================================================ */
(function zd96() {
    if (window.__zd96) return; window.__zd96 = true;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const MT_GAP    = 1500;   // ⚙ silence (ms) that may indicate a speaker change
    const MT_BANDS  = 4;      // ⚙ how many distinct speakers to try to separate
    const MT_ENTER  = 900;    // ⚙ enter/exit animation length (ms)
    /* ─────────────────────────────────────────────────────────── */

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ---------- entry animation: an opening console ---------- */
    #mt-fx{position:fixed;inset:0;z-index:206;display:none;overflow:hidden;background:#05070c;}
    #mt-fx.on{display:block;}
    #mt-fx .mf-bar{position:absolute;left:0;right:0;height:50%;background:#05070c;
        border-color:rgb(var(--accent-rgb) / .6);}
    #mt-fx .mf-top{top:0;border-bottom:1px solid;}
    #mt-fx .mf-bot{bottom:0;border-top:1px solid;}
    #mt-fx.in .mf-top{animation:mfTop ${MT_ENTER}ms cubic-bezier(.65,0,.35,1) forwards;}
    #mt-fx.in .mf-bot{animation:mfBot ${MT_ENTER}ms cubic-bezier(.65,0,.35,1) forwards;}
    @keyframes mfTop{0%{transform:translateY(-100%)}38%{transform:none}62%{transform:none}100%{transform:translateY(-100%)}}
    @keyframes mfBot{0%{transform:translateY(100%)}38%{transform:none}62%{transform:none}100%{transform:translateY(100%)}}
    #mt-fx.out .mf-top{animation:mfTop ${MT_ENTER}ms cubic-bezier(.65,0,.35,1) reverse forwards;}
    #mt-fx.out .mf-bot{animation:mfBot ${MT_ENTER}ms cubic-bezier(.65,0,.35,1) reverse forwards;}
    #mt-fx .mf-wave{position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;opacity:0;
        background:linear-gradient(90deg,transparent,rgb(var(--accent-rgb)),transparent);
        box-shadow:0 0 24px 6px rgb(var(--accent-rgb) / .7);}
    #mt-fx.on .mf-wave{animation:mfWave ${MT_ENTER}ms ease-out forwards;}
    @keyframes mfWave{0%{opacity:0;transform:scaleX(0)}30%{opacity:1;transform:scaleX(1)}
        58%{opacity:1}100%{opacity:0;transform:scaleX(1.1)}}
    #mt-fx .mf-lbl{position:absolute;left:0;right:0;top:calc(50% + 22px);text-align:center;opacity:0;
        font:900 9px/1 ui-monospace,monospace;letter-spacing:.4em;text-transform:uppercase;
        color:rgb(var(--accent-rgb));}
    #mt-fx.on .mf-lbl{animation:mfLbl ${MT_ENTER}ms steps(1) forwards;}
    @keyframes mfLbl{0%,26%{opacity:0}34%{opacity:1}56%{opacity:.4}62%{opacity:1}78%{opacity:0}}

    /* ---------- section ---------- */
    #mt{position:fixed;inset:0;z-index:117;display:none;flex-direction:column;background:#070a10;color:#e8ecf5;}
    #mt.open{display:flex;}
    #mt::before{content:'';position:absolute;inset:0;pointer-events:none;
        background:radial-gradient(760px 420px at 8% 0%,rgb(var(--accent-rgb) / .16),transparent 62%),
                   radial-gradient(600px 400px at 96% 100%,rgb(var(--accent-rgb) / .1),transparent 60%);}
    #mt > *{position:relative;z-index:2;}
    .mt-head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;
        min-height:54px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.09);flex-shrink:0;
        background:rgba(7,10,16,.82);backdrop-filter:blur(10px);}
    .mt-t{font-size:13px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;text-align:center;
        background-image:var(--zd-grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
    .mt-b{width:30px;height:30px;border-radius:99px;display:inline-flex;align-items:center;
        justify-content:center;color:#8b93a1;transition:all .15s ease;}
    .mt-b svg{width:16px;height:16px;}
    .mt-b:hover{color:rgb(var(--accent-rgb));background:rgb(var(--accent-rgb) / .13);}
    .mt-x{width:32px;height:32px;border-radius:99px;display:flex;align-items:center;justify-content:center;
        font-size:21px;line-height:1;color:#8b93a1;}
    .mt-x:hover{color:#ef4444;background:rgba(239,68,68,.12);}

    /* control deck */
    #mt-deck{flex-shrink:0;padding:14px;border-bottom:1px solid rgba(255,255,255,.08);}
    .mt-wrap{max-width:820px;margin:0 auto;}
    #mt-rec{display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:16px;
        border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);}
    #mt-orb{width:54px;height:54px;border-radius:99px;flex-shrink:0;position:relative;
        display:flex;align-items:center;justify-content:center;background-image:var(--zd-grad);
        box-shadow:0 8px 22px rgba(0,0,0,.34);cursor:pointer;transition:transform .18s ease;}
    #mt-orb:active{transform:scale(.93);}
    #mt-orb svg{width:22px;height:22px;color:#fff;z-index:2;}
    #mt-orb.live::after{content:'';position:absolute;inset:0;border-radius:99px;
        border:2px solid rgb(var(--accent-rgb) / .55);animation:mtRing 1.9s ease-out infinite;}
    @keyframes mtRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.75);opacity:0}}
    #mt-orb.live{animation:mtBreathe 2s ease-in-out infinite;}
    @keyframes mtBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
    #mt-time{font:900 21px/1 ui-monospace,monospace;color:#fff;font-variant-numeric:tabular-nums;}
    #mt-state{font-size:10.5px;color:#8b93a1;margin-top:3px;}
    #mt-bars{display:flex;align-items:flex-end;gap:2px;height:26px;flex:1;min-width:0;}
    #mt-bars i{flex:1;min-width:2px;border-radius:2px;background:rgb(var(--accent-rgb) / .5);height:3px;
        transition:height .08s ease;}
    .mt-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
    .mt-p{padding:7px 12px;border-radius:10px;font-size:10.5px;font-weight:800;color:#8b93a1;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11);transition:all .15s ease;}
    .mt-p:hover{color:#fff;border-color:rgba(255,255,255,.3);}
    .mt-p.on{background-image:var(--zd-grad);color:#fff;border-color:transparent;}
    #mt-sys.on{background:linear-gradient(135deg,#4ade80,#22d3ee);color:#04070d;}

    /* tabs + body */
    #mt-tabs{display:flex;gap:5px;padding:11px 14px 0;flex-shrink:0;overflow-x:auto;scrollbar-width:none;}
    #mt-tabs::-webkit-scrollbar{display:none}
    #mt-body{flex:1;min-height:0;overflow-y:auto;padding:12px 14px 90px;}
    .mt-seg{display:flex;gap:10px;padding:10px 12px;border-radius:13px;margin-bottom:7px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
        border-left:3px solid var(--sc,#38bdf8);animation:mtIn .3s cubic-bezier(.22,1,.36,1) both;}
    @keyframes mtIn{0%{opacity:0;transform:translateY(7px)}100%{opacity:1;transform:none}}
    .mt-av{width:28px;height:28px;border-radius:99px;flex-shrink:0;display:flex;align-items:center;
        justify-content:center;font:900 10px/1 ui-monospace,monospace;color:#04070d;background:var(--sc,#38bdf8);}
    .mt-who{font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--sc,#38bdf8);
        cursor:pointer;display:inline-flex;align-items:center;gap:5px;}
    .mt-who:hover{text-decoration:underline}
    .mt-at{font-size:9px;color:#5a6472;font-weight:700;}
    .mt-said{font-size:12.5px;line-height:1.65;color:#dfe4ec;margin-top:3px;}
    .mt-said.interim{color:#7d8695;font-style:italic;}
    #mt-raw{font:500 11.5px/1.8 ui-monospace,monospace;color:#a8b0bd;white-space:pre-wrap;
        padding:13px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);}
    .mt-card{padding:13px;border-radius:14px;background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.09);margin-bottom:9px;}
    .mt-h{font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#7d8695;
        margin-bottom:8px;display:flex;align-items:center;gap:7px;}
    .mt-h::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.1)}
    .mt-li{display:flex;gap:9px;font-size:12.5px;line-height:1.6;color:#dfe4ec;margin-bottom:7px;}
    .mt-li b{color:#fff}
    .mt-tick{width:16px;height:16px;flex-shrink:0;margin-top:2px;border-radius:4px;
        border:1.6px solid rgb(var(--accent-rgb));display:flex;align-items:center;justify-content:center;}
    .mt-tick svg{width:11px;height:11px;color:rgb(var(--accent-rgb))}
    .mt-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:11px;}
    @media(max-width:520px){.mt-kpi{grid-template-columns:repeat(2,1fr)}}
    .mt-kpi div{padding:10px;border-radius:12px;background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.09);}
    .mt-kpi b{display:block;font-size:19px;font-weight:900;color:#fff;line-height:1.1;font-variant-numeric:tabular-nums}
    .mt-kpi span{font-size:8px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#7d8695}
    #mt-save{position:fixed;left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));
        z-index:119;display:none;max-width:400px;margin:0 auto;padding:13px 0;border-radius:15px;
        font-size:12.5px;font-weight:900;color:#fff;background-image:var(--zd-grad);
        box-shadow:0 12px 32px rgba(0,0,0,.45);}
    #mt.open ~ #mt-save{display:block}
    #mt-save:active{transform:scale(.98)}
    .mt-empty{text-align:center;padding:52px 20px;color:#5a6472;font-size:12px;line-height:1.8}
    .mt-empty svg{width:40px;height:40px;margin:0 auto 12px;opacity:.35}
    </style>`);

    document.body.insertAdjacentHTML('beforeend', `
    <div id="mt-fx"><div class="mf-bar mf-top"></div><div class="mf-bar mf-bot"></div>
      <div class="mf-wave"></div><div class="mf-lbl">meeting mode</div></div>
    <div id="mt">
      <div class="mt-head">
        <button class="mt-b" onclick="mtHelp()" title="How this works"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.2 9.4A3 3 0 0112 7.6c1.7 0 3 1 3 2.3 0 1.1-1 2-2.3 2.2-.4.1-.7.4-.7.9m0 3h.01"/></svg></button>
        <span class="mt-t">Meeting Mode</span>
        <button class="mt-x" onclick="closeMeeting()">×</button>
      </div>
      <div id="mt-deck"><div class="mt-wrap">
        <div id="mt-rec">
          <span id="mt-orb" onclick="mtToggle()"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/></svg></span>
          <span style="flex-shrink:0"><span id="mt-time">00:00</span><span id="mt-state" style="display:block">Tap to start recording</span></span>
          <span id="mt-bars"></span>
        </div>
        <div class="mt-row">
          <button class="mt-p" id="mt-sys" onclick="mtSys()">＋ Capture tab audio</button>
          <button class="mt-p" onclick="mtSpk()">Speakers: <b id="mt-nspk">auto</b></button>
          <select class="mt-p" id="mt-lang" style="outline:none"></select>
          <button class="mt-p" onclick="mtClear()">Clear</button>
        </div>
      </div></div>
      <div id="mt-tabs"></div>
      <div id="mt-body"><div class="mt-wrap" id="mt-inner"></div></div>
    </div>
    <button id="mt-save" onclick="mtSave()">Save as note</button>`);

    const $ = id => document.getElementById(id);
    const COLS = ['#38bdf8', '#4ade80', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c'];
    const LANGS = [['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['en-IN', 'English (India)'],
        ['hi-IN', 'हिन्दी'], ['ta-IN', 'தமிழ்'], ['te-IN', 'తెలుగు'], ['es-ES', 'Español'],
        ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['pt-BR', 'Português'], ['ja-JP', '日本語'],
        ['ko-KR', '한국어'], ['zh-CN', '中文'], ['ar-SA', 'العربية']];
    $('mt-lang').innerHTML = LANGS.map(([v, n]) => '<option value="' + v + '">' + n + '</option>').join('');
    $('mt-lang').value = localStorage.getItem('zdMtLang') || navigator.language || 'en-US';
    $('mt-lang').onchange = () => { localStorage.setItem('zdMtLang', $('mt-lang').value); if (live) { stop(); setTimeout(start, 300); } };
    for (let i = 0; i < 22; i++) $('mt-bars').insertAdjacentHTML('beforeend', '<i></i>');

    let rec = null, live = false, want = false, tab = 'live';
    let segs = [], raw = '', interim = '', t0 = 0, timer = null, lastEnd = 0;
    let ctx = null, an = null, mic = null, sys = null, mixed = null, raf = null, sysOn = false;
    let names = JSON.parse(localStorage.getItem('zdMtNames') || '{}');
    let nspk = localStorage.getItem('zdMtSpk') || 'auto';
    $('mt-nspk').textContent = nspk;

    /* ---------- enter / exit ---------- */
    window.openMeeting = () => {
        if (state.isGuest) { showToast('Sign in first.'); return; }
        if (!SR) { showToast('Meeting mode needs Chrome, Edge, Safari or Android.', 4600); return; }
        const fx = $('mt-fx'); fx.className = 'on in';
        setTimeout(() => { try { closeAllViews(); } catch (e) {} $('mt').classList.add('open'); render(); }, MT_ENTER * .42);
        setTimeout(() => { fx.className = ''; }, MT_ENTER + 80);
    };
    window.closeMeeting = () => {
        if (live && !confirm('Recording is still running. Stop and close?')) return;
        stop(); stopSys();
        const fx = $('mt-fx'); fx.className = 'on out';
        $('mt').classList.remove('open');
        setTimeout(() => { fx.className = ''; }, MT_ENTER + 60);
    };

    /* ---------- audio graph: mic (+ optional tab audio) ---------- */
    async function meters() {
        try {
            mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !sysOn, noiseSuppression: true } });
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') await ctx.resume();
            const dest = ctx.createGain();
            ctx.createMediaStreamSource(mic).connect(dest);
            if (sys) { try { ctx.createMediaStreamSource(sys).connect(dest); } catch (e) {} }
            an = ctx.createAnalyser(); an.fftSize = 128;
            dest.connect(an);
            const data = new Uint8Array(an.frequencyBinCount);
            const bars = Array.from($('mt-bars').children);
            const tick = () => {
                if (!live) return;
                an.getByteFrequencyData(data);
                let lo = 0, hi = 0, amp = 0;
                bars.forEach((b, i) => {
                    const v = data[Math.floor(i * data.length / bars.length)] / 255;
                    b.style.height = Math.max(3, v * 26) + 'px';
                    amp += v;
                    if (i < bars.length / 2) lo += v; else hi += v;
                });
                cur = { amp: amp / bars.length, tone: hi / (lo + hi + .0001) };
                raf = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {}
    }
    let cur = { amp: 0, tone: .5 };
    function stopMeters() {
        if (raf) cancelAnimationFrame(raf); raf = null;
        Array.from($('mt-bars').children).forEach(b => b.style.height = '3px');
        try { if (mic) mic.getTracks().forEach(t => t.stop()); } catch (e) {}
        try { if (ctx) ctx.close(); } catch (e) {}
        mic = null; ctx = null;
    }
    window.mtSys = async () => {
        if (sysOn) { stopSys(); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            showToast('Tab audio needs Chrome or Edge on a computer.', 4600); return;
        }
        try {
            sys = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            if (!sys.getAudioTracks().length) {
                sys.getTracks().forEach(t => t.stop()); sys = null;
                showToast('No audio shared — pick a tab and tick “Share tab audio”.', 5200); return;
            }
            sys.getVideoTracks().forEach(t => t.stop());
            sysOn = true;
            $('mt-sys').classList.add('on');
            $('mt-sys').innerHTML = '✓ Tab audio on';
            sys.getAudioTracks()[0].onended = stopSys;
            showToast('Tab audio captured. Keep speakers on so it can be transcribed.', 5200);
            if (live) { stopMeters(); meters(); }
        } catch (e) { showToast('Tab audio cancelled.'); }
    };
    function stopSys() {
        try { if (sys) sys.getTracks().forEach(t => t.stop()); } catch (e) {}
        sys = null; sysOn = false;
        $('mt-sys').classList.remove('on');
        $('mt-sys').innerHTML = '＋ Capture tab audio';
    }

    /* ---------- speaker heuristic ---------- */
    function who() {
        const N = nspk === 'auto' ? MT_BANDS : +nspk;
        const gap = Date.now() - lastEnd;
        if (segs.length && gap < MT_GAP) return segs[segs.length - 1].s;   /* same turn continues */
        const band = Math.min(N - 1, Math.floor(cur.tone * N * 1.15));
        return band;
    }

    /* ---------- recognition ---------- */
    function start() {
        rec = new SR();
        rec.lang = $('mt-lang').value;
        rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.onstart = () => {
            live = true; want = true;
            if (!t0) { t0 = Date.now(); timer = setInterval(clock, 500); }
            $('mt-orb').classList.add('live');
            $('mt-state').textContent = sysOn ? 'Recording · mic + tab audio' : 'Recording · microphone';
            setTimeout(meters, 500);
            try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
        };
        rec.onresult = (e) => {
            let fin = '', itm = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) fin += r[0].transcript + ' '; else itm += r[0].transcript;
            }
            interim = itm.trim();
            if (fin.trim()) {
                const s = who();
                const at = Math.max(0, Math.round((Date.now() - t0) / 1000));
                if (segs.length && segs[segs.length - 1].s === s && Date.now() - lastEnd < MT_GAP)
                    segs[segs.length - 1].t += ' ' + fin.trim();
                else segs.push({ s: s, t: fin.trim(), at: at });
                raw += fin;
                lastEnd = Date.now();
            }
            if (tab === 'live') render();
        };
        rec.onerror = (e) => {
            if (e.error === 'not-allowed') { want = false; stop(); showToast('Microphone blocked — allow it in site settings.', 5000); }
            else if (e.error === 'audio-capture') { want = false; stop(); showToast('No microphone found.', 4200); }
        };
        rec.onend = () => {
            live = false; interim = '';
            $('mt-orb').classList.remove('live');
            stopMeters();
            if (want) { try { rec.start(); return; } catch (e) {} }
            clearInterval(timer); timer = null;
            $('mt-state').textContent = segs.length ? 'Paused · ' + segs.length + ' segments' : 'Tap to start recording';
            render();
        };
        try { rec.start(); } catch (e) { showToast('Could not start recording.'); }
    }
    function stop() { want = false; try { if (rec) rec.stop(); } catch (e) {} live = false; $('mt-orb').classList.remove('live'); stopMeters(); clearInterval(timer); timer = null; }
    window.mtToggle = () => { live ? stop() : start(); };
    function clock() {
        const s = Math.floor((Date.now() - t0) / 1000);
        $('mt-time').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    window.mtClear = async () => {
        if (segs.length && !(await zdConfirm('The transcript will be discarded.', { title: 'Clear meeting?', okText: 'Clear', danger: true }))) return;
        stop(); segs = []; raw = ''; interim = ''; t0 = 0; lastEnd = 0;
        $('mt-time').textContent = '00:00'; $('mt-state').textContent = 'Tap to start recording';
        render();
    };
    window.mtSpk = () => {
        const opts = ['auto', '2', '3', '4', '5', '6'];
        nspk = opts[(opts.indexOf(nspk) + 1) % opts.length];
        localStorage.setItem('zdMtSpk', nspk);
        $('mt-nspk').textContent = nspk;
        render();
    };
    window.mtRename = (i) => {
        const v = prompt('Name for Speaker ' + (i + 1) + ':', names[i] || '');
        if (v === null) return;
        if (v.trim()) names[i] = v.trim(); else delete names[i];
        localStorage.setItem('zdMtNames', JSON.stringify(names));
        render();
    };
    const nm = i => names[i] || 'Speaker ' + (i + 1);

    /* ---------- analysis ---------- */
    const STOP = new Set('the a an and or but if of to in on for with at by from as is are was were be been it its this that these those i we you he she they our your their not no do does did can could will would should may might must have has had about into over under again more most some such only own same so than too very just also there here when where why how what which who while during before after above below up down out off all any both each few other new okay ok yeah yes right well like really actually basically kind sort thing things going know think mean say said get got make made want need let us said'.split(' '));
    function analyse() {
        const text = raw.trim();
        const sents = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.split(/\s+/).length > 3);
        const words = (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter(w => !STOP.has(w));
        const tf = {}; words.forEach(w => tf[w] = (tf[w] || 0) + 1);
        const key = Object.keys(tf).sort((a, b) => tf[b] - tf[a]).slice(0, 12);
        /* summary: sentences richest in the meeting's own key terms */
        const scored = sents.map((s, i) => {
            const l = s.toLowerCase();
            let sc = 0;
            key.forEach((k, ki) => { if (l.indexOf(k) >= 0) sc += (12 - ki) / 12; });
            if (i < sents.length * .18) sc *= 1.3;
            if (s.split(/\s+/).length > 8 && s.split(/\s+/).length < 44) sc += .4;
            return { s: s, sc: sc, i: i };
        }).sort((a, b) => b.sc - a.sc).slice(0, 6).sort((a, b) => a.i - b.i);
        /* actions: commitment language */
        const AC = /\b(i'?ll|we'?ll|i will|we will|let'?s|need to|needs to|should|must|have to|has to|going to|gonna|action item|follow up|follow-up|take care of|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|eod|end of day)|due|deadline|assign|owns?|responsible)\b/i;
        const acts = [];
        segs.forEach(g => g.t.split(/(?<=[.!?])\s+/).forEach(s => {
            if (AC.test(s) && s.split(/\s+/).length > 3 && acts.length < 14)
                acts.push({ who: nm(g.s), t: s.trim().replace(/^(so|and|but|ok|okay|yeah)[,\s]+/i, ''), at: g.at });
        }));
        const QU = /\?\s*$|^(what|why|how|when|where|who|should we|do we|can we|are we|is there)\b/i;
        const qs = [];
        segs.forEach(g => g.t.split(/(?<=[.!?])\s+/).forEach(s => {
            if (QU.test(s.trim()) && s.split(/\s+/).length > 3 && qs.length < 8) qs.push({ who: nm(g.s), t: s.trim() });
        }));
        const spk = {};
        segs.forEach(g => { spk[g.s] = (spk[g.s] || 0) + g.t.split(/\s+/).length; });
        return { sum: scored.map(x => x.s), acts: acts, qs: qs, key: key.slice(0, 8), spk: spk, words: words.length + STOP.size * 0 };
    }

    /* ---------- render ---------- */
    window.mtTab = (t) => { tab = t; render(); };
    function render() {
        const TABS = [['live', 'Transcript'], ['sum', 'Summary'], ['act', 'Actions'], ['raw', 'Raw text']];
        $('mt-tabs').innerHTML = TABS.map(([k, n]) =>
            `<button class="mt-p ${tab === k ? 'on' : ''}" onclick="mtTab('${k}')">${n}</button>`).join('');
        const b = $('mt-inner');
        if (!segs.length && !interim) {
            b.innerHTML = `<div class="mt-empty">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/></svg>
                Tap the microphone to begin.<br>Speech is transcribed live and split by speaker.<br>
                <b style="color:#8b93a1">On a computer, add “Capture tab audio”</b><br>to include people on the call.</div>`;
            return;
        }
        if (tab === 'live') {
            b.innerHTML = segs.map((g, i) =>
                `<div class="mt-seg" style="--sc:${COLS[g.s % COLS.length]};animation-delay:${Math.min(i, 8) * 25}ms">
                   <span class="mt-av">${nm(g.s).slice(0, 2).toUpperCase()}</span>
                   <span class="min-w-0 flex-1">
                     <span class="mt-who" onclick="mtRename(${g.s})">${escapeHtml(nm(g.s))}
                       <svg style="width:9px;height:9px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" d="M16.9 4.4l2.7 2.7-11 11L5 19l.9-3.6z"/></svg></span>
                     <span class="mt-at"> · ${String(Math.floor(g.at / 60)).padStart(2, '0')}:${String(g.at % 60).padStart(2, '0')}</span>
                     <span class="mt-said">${escapeHtml(g.t)}</span></span></div>`).join('')
              + (interim ? `<div class="mt-seg" style="--sc:#5a6472"><span class="mt-av">…</span>
                   <span class="flex-1"><span class="mt-said interim">${escapeHtml(interim)}</span></span></div>` : '');
            $('mt-body').scrollTop = $('mt-body').scrollHeight;
            return;
        }
        if (tab === 'raw') { b.innerHTML = '<div id="mt-raw">' + escapeHtml(raw.trim() || '—') + '</div>'; return; }
        const A = analyse();
        if (tab === 'sum') {
            const mins = t0 ? Math.round((Date.now() - t0) / 60000) : 0;
            b.innerHTML = `<div class="mt-kpi">
                <div><b>${mins}</b><span>Minutes</span></div>
                <div><b>${Object.keys(A.spk).length}</b><span>Speakers</span></div>
                <div><b>${segs.length}</b><span>Segments</span></div>
                <div><b>${A.acts.length}</b><span>Actions</span></div></div>
              <div class="mt-card"><div class="mt-h">Summary</div>
                ${A.sum.length ? A.sum.map(s => `<div class="mt-li"><span style="color:rgb(var(--accent-rgb));font-weight:900">·</span><span>${escapeHtml(s)}</span></div>`).join('') : '<div style="color:#5a6472;font-size:12px">Not enough speech yet.</div>'}</div>
              <div class="mt-card"><div class="mt-h">Topics</div>
                <div style="display:flex;flex-wrap:wrap;gap:5px">${A.key.map(k => `<span class="mt-p" style="pointer-events:none">${escapeHtml(k)}</span>`).join('')}</div></div>
              <div class="mt-card"><div class="mt-h">Airtime</div>
                ${Object.keys(A.spk).sort((a, c) => A.spk[c] - A.spk[a]).map(s => {
                    const tot = Object.values(A.spk).reduce((x, y) => x + y, 0) || 1;
                    return `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
                      <span style="color:${COLS[s % COLS.length]};font-weight:800">${escapeHtml(nm(s))}</span>
                      <span style="color:#7d8695">${Math.round(A.spk[s] / tot * 100)}% · ${A.spk[s]} words</span></div>
                      <div style="height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden">
                      <i style="display:block;height:100%;width:${A.spk[s] / tot * 100}%;background:${COLS[s % COLS.length]};border-radius:99px"></i></div></div>`;
                }).join('')}</div>`;
            return;
        }
        b.innerHTML = `<div class="mt-card"><div class="mt-h">Action items</div>
            ${A.acts.length ? A.acts.map(a => `<div class="mt-li"><span class="mt-tick"></span>
                <span><b>${escapeHtml(a.who)}</b> — ${escapeHtml(a.t)}
                <span class="mt-at">${String(Math.floor(a.at / 60)).padStart(2, '0')}:${String(a.at % 60).padStart(2, '0')}</span></span></div>`).join('')
              : '<div style="color:#5a6472;font-size:12px">Nothing detected yet. Phrases like “I’ll…”, “we need to…”, “by Friday” are picked up automatically.</div>'}</div>
          <div class="mt-card"><div class="mt-h">Open questions</div>
            ${A.qs.length ? A.qs.map(q => `<div class="mt-li"><span style="color:#fbbf24;font-weight:900">?</span><span><b>${escapeHtml(q.who)}</b> — ${escapeHtml(q.t)}</span></div>`).join('')
              : '<div style="color:#5a6472;font-size:12px">No open questions detected.</div>'}</div>`;
    }

    /* ---------- save ---------- */
    window.mtSave = async () => {
        if (!segs.length) { showToast('Nothing recorded yet.'); return; }
        stop();
        const A = analyse();
        const now = new Date();
        const title = 'Meeting · ' + now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
                      ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const ops = [];
        const H = (t, l) => { ops.push({ insert: t }, { insert: '\n', attributes: { header: l } }); };
        const P = t => ops.push({ insert: t + '\n' });
        H(title, 1);
        P('#meeting');
        P('');
        H('Summary', 2);
        (A.sum.length ? A.sum : ['(not enough speech captured)']).forEach(s => ops.push({ insert: s }, { insert: '\n', attributes: { list: 'bullet' } }));
        H('Action items', 2);
        (A.acts.length ? A.acts : []).forEach(a => ops.push({ insert: a.who + ' — ' + a.t }, { insert: '\n', attributes: { list: 'unchecked' } }));
        if (!A.acts.length) P('(none detected)');
        if (A.qs.length) { H('Open questions', 2); A.qs.forEach(q => ops.push({ insert: q.who + ' — ' + q.t }, { insert: '\n', attributes: { list: 'bullet' } })); }
        H('Topics', 2); P(A.key.map(k => '#' + k.replace(/[^a-z0-9]/gi, '')).join(' '));
        H('Transcript', 2);
        segs.forEach(g => {
            ops.push({ insert: nm(g.s) + ' · ' + String(Math.floor(g.at / 60)).padStart(2, '0') + ':' + String(g.at % 60).padStart(2, '0'), attributes: { bold: true } });
            ops.push({ insert: '\n' }, { insert: g.t + '\n\n' });
        });
        H('Raw transcript', 3);
        ops.push({ insert: raw.trim() }, { insert: '\n', attributes: { 'code-block': true } });
        try {
            const ref = await db.collection('users').doc(state.user.uid).collection('docs').add({
                title: title, content: { ops: ops }, isFavorite: false, folderId: null, comments: {},
                marginL: 96, marginR: 96,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            closeMeeting();
            setTimeout(() => openDoc(ref.id, { title: title, content: { ops: ops }, comments: {}, marginL: 96, marginR: 96 }), MT_ENTER);
            showToast('Meeting saved — summary, actions and full transcript.', 4600);
        } catch (e) { console.error(e); showToast('Could not save the note.'); }
    };

    window.mtHelp = () => {
        alert('MEETING MODE\n\n'
            + '1. Tap the microphone. Everything spoken in the room is transcribed live.\n\n'
            + '2. For people on a call, tap "Capture tab audio" (Chrome/Edge on a computer), pick the meeting tab and TICK "Share tab audio". Keep your speakers on — the audio is re-heard through the mic.\n\n'
            + '3. Speakers are separated automatically by pauses and voice tone. Tap any name to rename them — names are remembered.\n\n'
            + '4. Summary, Actions and Raw text tabs update as you go. "Save as note" writes all of it, including the unedited raw transcript.\n\n'
            + 'Shortcut: Alt+M');
    };

    /* ⚙ SHORTCUT: Alt+M */
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && $('mt').classList.contains('open')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            closeMeeting(); return;
        }
        if (e.altKey && !e.ctrlKey && !e.metaKey && ((e.key || '').toLowerCase() === 'm' || e.code === 'KeyM')) {
            const ae = document.activeElement;
            if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
            e.preventDefault();
            $('mt').classList.contains('open') ? closeMeeting() : openMeeting();
        }
    }, true);
    window.addEventListener('pagehide', () => { stop(); stopSys(); });

    try {
        zdMenuInject2('meet', 'openMeeting', 'Meeting mode', '<rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/>');
        ZD_FEATURES.push({ id: 'meet', label: 'Meeting mode', fns: ['openMeeting'] });
        ZD_FEAT_ICONS.meet = '<rect x="9" y="3" width="6" height="11" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/>';
    } catch (e) {}
    setTimeout(() => { try { applyFeatureFlags(); } catch (e) {} }, 700);
})();


