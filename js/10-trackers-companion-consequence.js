// ZenDocs — 10-trackers-companion-consequence.js
// V8.1 tracker robot companion & ask-your-tracker, V8.2 consequence engine.
// (part of a mechanical split of the original single-file app; see README)

    /* ============================================================
   V8.1 — GRID-1  ·  ROBOT COMPANION + ASK YOUR TRACKER
   A living companion whose health, face and body state are driven
   entirely by your real tracker data — and a natural-language
   engine that answers questions about your own history.
   Mounts into #trk-robo (V8.0) and exposes window.zdRobo for V8.2.
============================================================ */
(function zd81() {
    if (window.__zd81) return; window.__zd81 = true;
    if (!window.zdTrk) { console.warn('[V8.1] V8.0 must be applied first'); return; }

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const RO_WINDOW   = 14;   // ⚙ how many days of history feed the health score
    const RO_COLLAPSE = 7;    // ⚙ consecutive fail days before V8.2 collapse triggers
    const RO_LINE_MS  = 9000; // ⚙ how often GRID-1 changes what it says
    /* ─────────────────────────────────────────────────────────── */

    const T = window.zdTrk, K = T.key;
    const $ = id => document.getElementById(id);

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ============ ROBO CARD ============ */
    #ro-card{display:flex;align-items:center;gap:14px;padding:14px;border-radius:16px;
        border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.038);position:relative;overflow:hidden;}
    #ro-card::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;
        background:var(--ro-c,#4ade80);box-shadow:0 0 14px var(--ro-c,#4ade80);transition:all .6s ease;}
    #ro-card::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:0;
        background:radial-gradient(420px 200px at 12% 0%,var(--ro-c,#4ade80),transparent 70%);
        transition:opacity .8s ease;}
    #ro-card[data-mood="thriving"]::after{opacity:.11}
    #ro-card[data-mood="sick"]::after,#ro-card[data-mood="critical"]::after{opacity:.14}
    #ro-card > *{position:relative;z-index:2;}
    @media(max-width:520px){#ro-card{gap:11px;padding:12px;}}

    /* ============ ROBOT ============ */
    .ro-stage{position:relative;width:104px;height:104px;flex-shrink:0;cursor:pointer;
        transition:transform .2s cubic-bezier(.3,1.4,.5,1);}
    .ro-stage:active{transform:scale(.94);}
    @media(max-width:520px){.ro-stage{width:86px;height:86px;}}
    .ro-ring{position:absolute;inset:0;transform:rotate(-90deg);}
    .ro-ring circle{transition:stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1),stroke .6s ease;}
    .ro-bot{position:absolute;inset:11px;width:calc(100% - 22px);height:calc(100% - 22px);
        animation:roFloat 3.6s ease-in-out infinite;overflow:visible;}
    @keyframes roFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    #ro-card[data-mood="thriving"] .ro-bot{animation:roBounce 1.9s cubic-bezier(.3,1.3,.5,1) infinite;}
    @keyframes roBounce{0%,100%{transform:translateY(0) rotate(0)}
        35%{transform:translateY(-7px) rotate(-3deg)}70%{transform:translateY(-1px) rotate(2deg)}}
    #ro-card[data-mood="sad"] .ro-bot{animation:roSag 5s ease-in-out infinite;}
    @keyframes roSag{0%,100%{transform:translateY(2px) rotate(-2deg)}50%{transform:translateY(4px) rotate(-3deg)}}
    #ro-card[data-mood="sick"] .ro-bot,#ro-card[data-mood="critical"] .ro-bot{
        animation:roSick 4s ease-in-out infinite,roFlick 2.6s steps(1) infinite;}
    @keyframes roSick{0%,100%{transform:translateY(3px) rotate(2deg)}50%{transform:translateY(6px) rotate(-2deg)}}
    @keyframes roFlick{0%,90%,100%{opacity:1}92%{opacity:.28}94%{opacity:1}96%{opacity:.4}}
    .ro-shell{fill:rgba(255,255,255,.09);stroke:var(--ro-c,#4ade80);stroke-width:2.4;transition:stroke .6s ease;}
    .ro-visor{fill:#04070d;stroke:var(--ro-c,#4ade80);stroke-width:1.6;stroke-opacity:.5;}
    .ro-eye{fill:var(--ro-c,#4ade80);filter:drop-shadow(0 0 5px var(--ro-c,#4ade80));}
    .ro-eye-l{stroke:var(--ro-c,#4ade80);stroke-width:3.4;stroke-linecap:round;fill:none;
        filter:drop-shadow(0 0 5px var(--ro-c,#4ade80));}
    .ro-blink{animation:roBlink 4.4s steps(1) infinite;}
    @keyframes roBlink{0%,95%,100%{transform:scaleY(1)}96%,98%{transform:scaleY(.12)}}
    .ro-ant{stroke:var(--ro-c,#4ade80);stroke-width:2.2;stroke-linecap:round;}
    .ro-tip{fill:var(--ro-c,#4ade80);animation:roPulse 1.7s ease-in-out infinite;}
    @keyframes roPulse{0%,100%{opacity:.45;r:3}50%{opacity:1;r:4.2}}
    .ro-core{fill:var(--ro-c,#4ade80);animation:roCore 2.1s ease-in-out infinite;}
    @keyframes roCore{0%,100%{opacity:.5}50%{opacity:1}}
    #ro-card[data-mood="critical"] .ro-core{animation:roCore .5s steps(2) infinite;}
    .ro-crack{stroke:#ff5f57;stroke-width:1.4;fill:none;opacity:0;transition:opacity .6s ease;}
    #ro-card[data-mood="sick"] .ro-crack,#ro-card[data-mood="critical"] .ro-crack{opacity:.9;}
    .ro-spark{fill:#fbbf24;opacity:0;}
    #ro-card[data-mood="sick"] .ro-spark,#ro-card[data-mood="critical"] .ro-spark{
        animation:roSpark 2.4s ease-out infinite;}
    @keyframes roSpark{0%{opacity:0;transform:translate(0,0) scale(.4)}
        12%{opacity:1}55%{opacity:.7}100%{opacity:0;transform:translate(6px,16px) scale(.2)}}
    .ro-tear{fill:#38bdf8;opacity:0;}
    #ro-card[data-mood="sad"] .ro-tear{animation:roTear 3.4s ease-in infinite;}
    @keyframes roTear{0%{opacity:0;transform:translateY(0)}18%{opacity:.95}100%{opacity:0;transform:translateY(15px)}}
    .ro-hp{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);
        font-size:8px;font-weight:900;letter-spacing:.06em;color:var(--ro-c,#4ade80);
        text-shadow:0 0 8px currentColor;}

    /* ============ SPEECH ============ */
    .ro-txt{min-width:0;flex:1;}
    .ro-nm{display:flex;align-items:center;gap:7px;margin-bottom:3px;flex-wrap:wrap;}
    .ro-nm b{font-size:11.5px;font-weight:900;letter-spacing:.14em;color:#fff;text-transform:uppercase;}
    .ro-chip{font-size:8px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;
        padding:2px 8px;border-radius:99px;border:1px solid;white-space:nowrap;}
    .ro-say{font-size:12px;line-height:1.55;color:#c3cad6;min-height:34px;
        animation:roSay .45s cubic-bezier(.22,1,.36,1);}
    @keyframes roSay{0%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:none}}
    .ro-say b{color:#fff;}
    .ro-btns{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap;}
    .ro-b{padding:7px 13px;border-radius:10px;font-size:10.5px;font-weight:900;color:#fff;
        background-image:var(--zd-grad);transition:transform .14s ease;white-space:nowrap;}
    .ro-b:active{transform:scale(.95);}
    .ro-b2{padding:7px 12px;border-radius:10px;font-size:10.5px;font-weight:800;color:#8b93a1;
        background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);white-space:nowrap;}
    .ro-b2:hover{color:#fff;border-color:rgba(255,255,255,.28);}

    /* ============ ASK SHEET ============ */
    #ro-ask{position:fixed;inset:0;z-index:126;display:none;align-items:flex-end;justify-content:center;
        background:rgba(2,4,8,.8);backdrop-filter:blur(8px);}
    #ro-ask.open{display:flex;animation:trkIn .22s ease-out;}
    @media(min-width:700px){#ro-ask{align-items:center;padding:16px;}}
    #ro-ask-box{width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;
        background:#0d1119;border:1px solid rgba(255,255,255,.12);color:#e8ecf5;
        border-radius:20px 20px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.65);
        animation:roUp .34s cubic-bezier(.22,1,.36,1);}
    @media(min-width:700px){#ro-ask-box{border-radius:20px;animation:boxIn .3s cubic-bezier(.22,1,.36,1);}}
    @keyframes roUp{0%{transform:translateY(100%)}100%{transform:none}}
    .ak2-head{display:flex;align-items:center;gap:10px;padding:14px 15px 12px;flex-shrink:0;
        border-bottom:1px solid rgba(255,255,255,.09);}
    .ak2-av{width:34px;height:34px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;
        justify-content:center;background-image:var(--zd-grad);}
    .ak2-av svg{width:18px;height:18px;color:#fff;}
    #ro-ask-body{flex:1;min-height:0;overflow-y:auto;padding:14px 15px;}
    .ak2-in{display:flex;gap:7px;padding:12px 15px 14px;flex-shrink:0;
        border-top:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.02);}
    #ak2-q{flex:1;min-width:0;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.14);
        border-radius:12px;padding:11px 13px;font-size:13.5px;color:#e8ecf5;outline:none;
        caret-color:rgb(var(--accent-rgb));}
    @media(max-width:850px){#ak2-q{font-size:16px;}}
    #ak2-q:focus{border-color:rgb(var(--accent-rgb));}
    #ak2-q::placeholder{color:#5a6472;}
    .ak2-send{width:44px;flex-shrink:0;border-radius:12px;background-image:var(--zd-grad);color:#fff;
        display:flex;align-items:center;justify-content:center;}
    .ak2-send svg{width:17px;height:17px;}
    .ak2-send:active{transform:scale(.93);}
    .ak2-ex{display:block;width:100%;text-align:left;padding:9px 12px;border-radius:11px;font-size:11.5px;
        font-weight:600;color:#a8b0bd;background:rgba(255,255,255,.045);
        border:1px solid rgba(255,255,255,.1);margin-bottom:6px;transition:all .15s ease;}
    .ak2-ex:hover{color:#fff;border-color:rgb(var(--accent-rgb));}
    .ak2-you{align-self:flex-end;max-width:86%;margin:0 0 10px auto;padding:9px 13px;border-radius:14px 14px 3px 14px;
        background-image:var(--zd-grad);color:#fff;font-size:12.5px;font-weight:600;line-height:1.5;
        animation:roSay .3s cubic-bezier(.22,1,.36,1);}
    .ak2-bot{max-width:94%;margin-bottom:14px;padding:12px 13px;border-radius:14px 14px 14px 3px;
        background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
        animation:roSay .38s cubic-bezier(.22,1,.36,1);}
    .ak2-num{font-size:29px;font-weight:900;color:#fff;line-height:1;font-variant-numeric:tabular-nums;
        letter-spacing:-.02em;}
    .ak2-unit{font-size:11px;font-weight:800;color:#7d8695;margin-left:5px;letter-spacing:.04em;
        text-transform:uppercase;}
    .ak2-say{font-size:12px;line-height:1.6;color:#c3cad6;}
    .ak2-say b{color:#fff;}
    .ak2-coach{font-size:10.5px;line-height:1.5;color:rgb(var(--accent-rgb));font-weight:700;
        margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);}
    .ak2-chart{display:flex;align-items:flex-end;gap:2.5px;height:38px;margin:11px 0 3px;}
    .ak2-chart i{flex:1;border-radius:3px 3px 1px 1px;background:rgba(255,255,255,.1);min-height:3px;
        animation:ak2Bar .5s cubic-bezier(.22,1,.36,1) both;transform-origin:bottom;}
    @keyframes ak2Bar{0%{transform:scaleY(0)}100%{transform:scaleY(1)}}
    .ak2-lbl{font-size:8px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#5a6472;}
    .ak2-rows{margin-top:10px;}
    .ak2-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:9px;
        background:rgba(255,255,255,.04);margin-bottom:4px;font-size:11.5px;}
    .ak2-row b{color:#fff;font-weight:800;}
    .ak2-dot{width:7px;height:7px;border-radius:99px;flex-shrink:0;}
    .ak2-think{display:flex;gap:4px;padding:10px 0;}
    .ak2-think i{width:6px;height:6px;border-radius:99px;background:rgb(var(--accent-rgb));
        animation:ak2P 1.1s ease-in-out infinite;}
    .ak2-think i:nth-child(2){animation-delay:.14s}.ak2-think i:nth-child(3){animation-delay:.28s}
    @keyframes ak2P{0%,100%{opacity:.25;transform:scale(.75)}50%{opacity:1;transform:scale(1.2)}}
    </style>`);

    /* ============ HEALTH MODEL ============ */
    const MOODS = {
        thriving: { c: '#4ade80', n: 'Thriving',  min: 86 },
        happy:    { c: '#a3e635', n: 'Healthy',   min: 70 },
        neutral:  { c: '#38bdf8', n: 'Steady',    min: 50 },
        worried:  { c: '#fbbf24', n: 'Worried',   min: 34 },
        sad:      { c: '#fb923c', n: 'Struggling',min: 18 },
        sick:     { c: '#ff5f57', n: 'Failing',   min: 6  },
        critical: { c: '#dc2626', n: 'Critical',  min: 0  }
    };
    function keysBack(n) {
        const out = [], d = new Date();
        for (let i = 0; i < n; i++) { out.push(K(d)); d.setDate(d.getDate() - 1); }
        return out;
    }
    function daysSince(t) {
        const ks = Object.keys(t.logs || {});
        if (!ks.length) return 999;
        const last = ks.sort().pop();
        return Math.round((new Date(K(new Date()) + 'T12:00') - new Date(last + 'T12:00')) / 864e5);
    }
    function badRun(t) {
        let n = 0; const d = new Date();
        for (let i = 0; i < 400; i++) {
            if (t.logs && t.logs[K(d)]) n++; else break;
            d.setDate(d.getDate() - 1);
        }
        return n;
    }
    function health() {
        const list = T.list || [];
        if (!list.length) return { score: 100, mood: 'neutral', neglect: 0, run: 0, worst: null, per: [] };
        const win = keysBack(RO_WINDOW);
        const per = list.map(t => {
            const hits = win.filter(k => t.logs && t.logs[k]).length;
            let rate, fail;
            if (t.kind === 'bad') {
                rate = Math.max(0, 1 - hits / RO_WINDOW);
                fail = badRun(t);
            } else {
                const expect = Math.max(1, Math.round((t.target || 7) / 7 * RO_WINDOW));
                rate = Math.min(1, hits / expect);
                fail = Math.max(0, daysSince(t) - 1);
            }
            return { t: t, rate: rate, fail: Math.min(fail, 60), hits: hits };
        });
        const score = Math.round(per.reduce((s, p) => s + p.rate, 0) / per.length * 100);
        const worst = per.slice().sort((a, b) => a.rate - b.rate)[0];
        const neglect = per.filter(p => p.t.kind !== 'bad').reduce((m, p) => Math.max(m, p.fail), 0);
        const run = per.filter(p => p.t.kind === 'bad').reduce((m, p) => Math.max(m, p.fail), 0);
        let mood = 'critical';
        for (const k of Object.keys(MOODS)) { if (score >= MOODS[k].min) { mood = k; break; } }
        if (Math.max(neglect, run) >= RO_COLLAPSE) mood = score < 40 ? 'critical' : 'sick';
        return { score: score, mood: mood, neglect: neglect, run: run, worst: worst, per: per };
    }

    /* ============ ROBOT SVG ============ */
    function eyes(m) {
        if (m === 'thriving') return `<path class="ro-eye-l" d="M40 44q5-7 10 0"/><path class="ro-eye-l" d="M70 44q5-7 10 0"/>`;
        if (m === 'happy')    return `<circle class="ro-eye ro-blink" cx="45" cy="45" r="5"/><circle class="ro-eye ro-blink" cx="75" cy="45" r="5"/>`;
        if (m === 'neutral')  return `<rect class="ro-eye ro-blink" x="39" y="42" width="12" height="6" rx="3"/><rect class="ro-eye ro-blink" x="69" y="42" width="12" height="6" rx="3"/>`;
        if (m === 'worried')  return `<path class="ro-eye-l" d="M39 40l12 4"/><path class="ro-eye-l" d="M81 40l-12 4"/><circle class="ro-eye" cx="45" cy="47" r="3.6"/><circle class="ro-eye" cx="75" cy="47" r="3.6"/>`;
        if (m === 'sad')      return `<path class="ro-eye-l" d="M40 48q5 6 10 0"/><path class="ro-eye-l" d="M70 48q5 6 10 0"/><circle class="ro-tear" cx="45" cy="54" r="2.6"/>`;
        return `<path class="ro-eye-l" d="M41 41l8 8M49 41l-8 8"/><path class="ro-eye-l" d="M71 41l8 8M79 41l-8 8"/>`;
    }
    function mouth(m) {
        if (m === 'thriving' || m === 'happy') return `<path class="ro-eye-l" style="stroke-width:2.6" d="M50 58q10 7 20 0"/>`;
        if (m === 'neutral') return `<path class="ro-eye-l" style="stroke-width:2.6" d="M52 58h16"/>`;
        if (m === 'worried') return `<path class="ro-eye-l" style="stroke-width:2.6" d="M52 59q8-3 16 0"/>`;
        return `<path class="ro-eye-l" style="stroke-width:2.6" d="M50 60q10-8 20 0"/>`;
    }
    function botSvg(m) {
        return `<svg class="ro-bot" viewBox="0 0 120 130">
          <ellipse cx="60" cy="126" rx="26" ry="3.4" fill="#000" opacity=".34"/>
          <line class="ro-ant" x1="60" y1="20" x2="60" y2="7"/><circle class="ro-tip" cx="60" cy="5" r="3.4"/>
          <rect class="ro-shell" x="20" y="20" width="80" height="60" rx="21"/>
          <rect class="ro-shell" x="8"  y="40" width="9"  height="20" rx="4.5"/>
          <rect class="ro-shell" x="103" y="40" width="9" height="20" rx="4.5"/>
          <rect class="ro-visor" x="29" y="32" width="62" height="34" rx="16"/>
          ${eyes(m)}${mouth(m)}
          <path class="ro-crack" d="M74 32l4 9-6 5 5 8"/><path class="ro-crack" d="M33 66l6-7"/>
          <rect class="ro-shell" x="31" y="86" width="58" height="34" rx="15"/>
          <circle class="ro-core" cx="60" cy="103" r="8"/>
          <circle cx="60" cy="103" r="3.2" fill="#04070d"/>
          <rect class="ro-shell" x="41" y="112" width="38" height="4" rx="2" opacity=".5"/>
          <circle class="ro-spark" cx="82" cy="78" r="2.2"/>
          <circle class="ro-spark" cx="36" cy="90" r="1.7" style="animation-delay:.9s"/>
          <circle class="ro-spark" cx="88" cy="98" r="2" style="animation-delay:1.6s"/>
        </svg>`;
    }

    /* ============ WHAT GRID-1 SAYS ============ */
    const SAY = {
        thriving: ['Systems at peak. <b>You are the reason.</b> Whatever you did this fortnight — do it again.',
                   'Every circuit is green. This is what <b>compounding</b> looks like from the inside.',
                   'I have nothing to warn you about. Rare. <b>Enjoy it, then protect it.</b>'],
        happy:    ['Running clean. One or two gaps, nothing structural. <b>Keep the rhythm.</b>',
                   'Good week. The streaks are holding and my core is steady. <b>Log today and it stays that way.</b>',
                   'Healthy. Not perfect — healthy. <b>That is the sustainable one.</b>'],
        neutral:  ['Holding steady. <b>Half your habits are carrying the other half.</b> Pick one to lift.',
                   'No alarms, no fireworks. <b>Consistency is the next upgrade.</b>',
                   'Stable. If you want me brighter, the fastest path is <b>the one you keep skipping.</b>'],
        worried:  ['My readings are slipping. <b>Two good days would turn this around</b> — that is all it takes.',
                   'Warning, not failure. Something is being neglected and <b>I can feel it in the grid.</b>',
                   'I am dimming a little. <b>Log one thing today</b> and I will stop nagging.'],
        sad:      ['I am not doing well. Neither is the plan. <b>Come back to one habit — just one.</b>',
                   'Streaks broken, panels cold. <b>You have restarted before. Do it again today.</b>',
                   'This is the part where most people quit. <b>You are not most people.</b> One entry.'],
        sick:     ['Critical drift. Panels cracking. <b>I am still here — that means it is not too late.</b>',
                   'My core is failing and it is measurable, not emotional. <b>Today. One tracker. Now.</b>',
                   'Sparks in the housing. <b>Seven days of nothing does this.</b> Break the pattern.'],
        critical: ['Systems collapsing. <b>I have logged every missed day and I will show you all of them.</b>',
                   'Structural failure imminent. <b>You built me to hold you accountable. I am doing my job.</b>',
                   'This is the last warning I can give politely. <b>Log something.</b>']
    };
    const NOTRK = 'No trackers on the grid yet. <b>Create one and I will start keeping score</b> — habits, workouts, plants, anything.';

    /* ============ PAINT ============ */
    let lineIx = 0, lineT = null, lastMood = null, lastScore = null;
    function paint(bump) {
        const host = $('trk-robo'); if (!host) return;
        const h = health();
        const M = MOODS[h.mood];
        const list = T.list || [];
        const R = 47, C = 2 * Math.PI * R;
        const bank = SAY[h.mood] || SAY.neutral;
        const line = list.length ? bank[lineIx % bank.length] : NOTRK;

        host.innerHTML = `
        <div id="ro-card" data-mood="${h.mood}" style="--ro-c:${M.c}">
          <div class="ro-stage" onclick="roAsk()" title="Ask GRID-1">
            <svg class="ro-ring" viewBox="0 0 104 104">
              <circle cx="52" cy="52" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="3.5"/>
              <circle cx="52" cy="52" r="${R}" fill="none" stroke="${M.c}" stroke-width="3.5"
                stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
                stroke-dashoffset="${(C * (1 - (list.length ? h.score : 100) / 100)).toFixed(1)}"/>
            </svg>
            ${botSvg(h.mood)}
            <span class="ro-hp">${list.length ? h.score + '%' : '—'}</span>
          </div>
          <div class="ro-txt">
            <div class="ro-nm"><b>GRID-1</b>
              <span class="ro-chip" style="color:${M.c};border-color:${M.c}55;background:${M.c}1c">${M.n}</span>
              ${h.neglect >= 3 || h.run >= 3 ? `<span class="ro-chip" style="color:#ff5f57;border-color:#ff5f5755;background:#ff5f571c">${Math.max(h.neglect, h.run)}d drift</span>` : ''}
            </div>
            <div class="ro-say" id="ro-say">${line}</div>
            <div class="ro-btns">
              <button class="ro-b" onclick="roAsk()">Ask GRID-1</button>
              <button class="ro-b2" onclick="roAsk('how am I doing')">Full report</button>
              ${h.worst && h.worst.rate < .7 ? `<button class="ro-b2" onclick="trkQuick('${h.worst.t.id}')">Fix ${escapeHtml((h.worst.t.name || '').slice(0, 16))}</button>` : ''}
            </div>
          </div>
        </div>`;

        if (bump && lastScore !== null && h.score > lastScore) {
            const st = host.querySelector('.ro-stage');
            if (st) { st.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.13)' }, { transform: 'scale(1)' }], { duration: 460, easing: 'cubic-bezier(.3,1.4,.5,1)' }); }
        }
        if (lastMood && lastMood !== h.mood && list.length) {
            const up = Object.keys(MOODS).indexOf(h.mood) < Object.keys(MOODS).indexOf(lastMood);
            showToast(up ? 'GRID-1 is recovering — ' + M.n.toLowerCase() + '.' : 'GRID-1 status: ' + M.n.toLowerCase() + '.', 3400);
        }
        lastMood = h.mood; lastScore = h.score;
        window.zdRobo = Object.assign({}, h, { color: M.c, label: M.n, refresh: paint, collapseAt: RO_COLLAPSE });

        clearTimeout(lineT);
        lineT = setTimeout(() => { lineIx++; paint(); }, RO_LINE_MS);
    }
    window.zdRoboSync = () => paint(true);
    const _ot = window.openTrackers;
    window.openTrackers = function () { const r = _ot.apply(this, arguments); setTimeout(() => paint(), 500); return r; };
    const _ct = window.closeTrackers;
    window.closeTrackers = function () { clearTimeout(lineT); roCloseAsk(); return _ct.apply(this, arguments); };

    /* ============ ASK SHEET ============ */
    document.body.insertAdjacentHTML('beforeend', `
    <div id="ro-ask"><div id="ro-ask-box">
      <div class="ak2-head">
        <span class="ak2-av"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4" y="7" width="16" height="12" rx="4"/><path stroke-linecap="round" d="M12 7V3M8 12h.01M16 12h.01M9.5 16h5"/></svg></span>
        <span class="min-w-0 flex-1">
          <span style="display:block;font-size:12px;font-weight:900;letter-spacing:.1em;color:#fff">ASK GRID-1</span>
          <span style="display:block;font-size:9.5px;color:#7d8695">Answers come from your own tracker history</span>
        </span>
        <button class="trk-x" onclick="roCloseAsk()">×</button>
      </div>
      <div id="ro-ask-body"></div>
      <div class="ak2-in">
        <input id="ak2-q" placeholder="How many workouts this month?" autocomplete="off" spellcheck="false">
        <button class="ak2-send" onclick="roSend()"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg></button>
      </div>
    </div></div>`);

    const EXAMPLES = ['How am I doing?', 'What is my longest streak?', 'How many workouts this month?',
        'When did I last skip?', 'Which habit am I failing?', 'Average calories this week',
        'Am I losing weight?', "What's left to log today?"];
    let convo = [];
    window.roAsk = (preset) => {
        $('ro-ask').classList.add('open');
        if (!convo.length) drawAsk();
        if (preset) { $('ak2-q').value = preset; roSend(); }
        else setTimeout(() => { try { if (window.innerWidth > 700) { $('ak2-q').focus({ preventScroll: true }); zdArmProtect($('ak2-q')); } } catch (e) {} }, 140);
    };
    window.roCloseAsk = () => $('ro-ask').classList.remove('open');
    function drawAsk() {
        const b = $('ro-ask-body');
        if (!convo.length) {
            b.innerHTML = '<div class="ak2-lbl" style="margin-bottom:8px">Try asking</div>' +
                EXAMPLES.map(q => `<button class="ak2-ex" onclick="roAsk(${JSON.stringify(q).replace(/"/g, '&quot;')})">${escapeHtml(q)}</button>`).join('');
            return;
        }
        b.innerHTML = convo.map(m => m.you
            ? `<div class="ak2-you">${escapeHtml(m.you)}</div>`
            : `<div class="ak2-bot">${m.bot}</div>`).join('');
        b.scrollTop = b.scrollHeight;
    }
    window.roSend = () => {
        const q = $('ak2-q').value.trim();
        if (!q) return;
        $('ak2-q').value = '';
        convo.push({ you: q });
        convo.push({ bot: '<div class="ak2-think"><i></i><i></i><i></i></div>' });
        drawAsk();
        setTimeout(() => {
            let out;
            try { out = answer(q); } catch (e) { console.error(e); out = card('', '', 'Something went wrong reading that. Try rephrasing.'); }
            convo[convo.length - 1] = { bot: out };
            if (convo.length > 24) convo = convo.slice(-24);
            drawAsk();
        }, 320);
    };
    $('ak2-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); roSend(); } });
    ['focusin', 'pointerup'].forEach(ev => $('ak2-q').addEventListener(ev, () => { try { zdArmProtect($('ak2-q')); } catch (e) {} }));
    $('ro-ask').addEventListener('click', e => { if (e.target.id === 'ro-ask') roCloseAsk(); });
    /* window capture so V8.0's document handler can't close the whole section first */
    window.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if ($('ro-ask').classList.contains('open')) {
            e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            roCloseAsk();
        }
    }, true);

    /* ============ THE ENGINE ============ */
    const STOP = new Set('what when where which how many much did do does is are was my me i the a an of to in on for with at by from and or that this it about have has had been show tell give list all any'.split(' '));
    function card(num, unit, say, extra, coach) {
        return (num !== '' && num !== null ? `<div><span class="ak2-num">${num}</span>${unit ? '<span class="ak2-unit">' + unit + '</span>' : ''}</div>` : '') +
               `<div class="ak2-say"${num !== '' ? ' style="margin-top:6px"' : ''}>${say}</div>` +
               (extra || '') + (coach ? `<div class="ak2-coach">${coach}</div>` : '');
    }
    function chart(vals, col) {
        const max = Math.max.apply(null, vals.concat([1]));
        return '<div class="ak2-chart">' + vals.map((v, i) =>
            `<i style="height:${Math.max(3, v / max * 38)}px;background:${v ? col : 'rgba(255,255,255,.1)'};animation-delay:${i * 22}ms"></i>`).join('') + '</div>';
    }
    function range(q) {
        const s = q.toLowerCase();
        let m = s.match(/last\s+(\d+)\s*(day|week|month)/);
        if (m) { const n = +m[1]; return { n: m[2] === 'week' ? n * 7 : m[2] === 'month' ? n * 30 : n, l: 'the last ' + m[1] + ' ' + m[2] + (n > 1 ? 's' : '') }; }
        if (/\btoday\b/.test(s)) return { n: 1, l: 'today' };
        if (/\byesterday\b/.test(s)) return { n: 2, l: 'yesterday', y: true };
        if (/\b(this |last )?week\b/.test(s)) return { n: 7, l: 'the last 7 days' };
        if (/\b(this |last )?month\b/.test(s)) return { n: 30, l: 'the last 30 days' };
        if (/\b(this |last )?year\b/.test(s)) return { n: 365, l: 'the last year' };
        if (/\b(ever|all time|total|overall|always)\b/.test(s)) return { n: 3650, l: 'all time' };
        return { n: 30, l: 'the last 30 days' };
    }
    function pickTracker(q) {
        const list = T.list || []; if (!list.length) return null;
        const s = q.toLowerCase();
        let best = null, bs = 0;
        list.forEach(t => {
            const words = (t.name || '').toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
            let sc = 0;
            if (s.indexOf((t.name || '').toLowerCase()) >= 0) sc += 10;
            words.forEach(w => { if (s.indexOf(w) >= 0) sc += 3; });
            const kw = { gym: ['gym', 'workout', 'exercise', 'train', 'lift', 'session'],
                         pet: ['pet', 'dog', 'cat', 'plant', 'garden', 'water', 'feed'],
                         bad: ['slip', 'quit', 'break', 'bad', 'relapse'],
                         good: ['habit'] }[t.kind] || [];
            kw.forEach(w => { if (s.indexOf(w) >= 0) sc += 1.5; });
            if (sc > bs) { bs = sc; best = t; }
        });
        return bs >= 1.5 ? best : null;
    }
    const KC = k => (T.KIND[k] || T.KIND.good).c;
    const has = (s, arr) => arr.some(w => s.indexOf(w) >= 0);

    function answer(q) {
        const s = q.toLowerCase();
        const list = T.list || [];
        if (!list.length) return card('', '', 'Nothing is being tracked yet, so I have no history to read. <b>Create your first tracker</b> and ask me again tomorrow.', '', 'Tap the + button — it takes ten seconds.');
        const h = health(), t = pickTracker(q), R = range(q);
        const keys = keysBack(R.n);

        /* ---- summary / report ---- */
        if (has(s, ['how am i', 'how i am', 'report', 'summary', 'status', 'overview', 'doing overall', 'my progress'])) {
            const rows = h.per.slice().sort((a, b) => b.rate - a.rate).map(p =>
                `<div class="ak2-row"><span class="ak2-dot" style="background:${p.t.color || KC(p.t.kind)}"></span>
                 <span class="flex-1 min-w-0" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.t.name)}</span>
                 <b style="color:${p.rate > .7 ? '#4ade80' : p.rate > .4 ? '#fbbf24' : '#ff5f57'}">${Math.round(p.rate * 100)}%</b>
                 <span style="color:#5a6472;font-size:10px">${T.streak(p.t)}d</span></div>`).join('');
            const best = h.per.slice().sort((a, b) => b.rate - a.rate)[0];
            return card(h.score, '/ 100 health', `Across <b>${list.length} tracker${list.length === 1 ? '' : 's'}</b> over the last ${RO_WINDOW} days I read you as <b>${MOODS[h.mood].n.toLowerCase()}</b>. Strongest is <b>${escapeHtml(best.t.name)}</b>; weakest is <b>${escapeHtml(h.worst.t.name)}</b>.`,
                '<div class="ak2-rows">' + rows + '</div>',
                h.score >= 70 ? 'Protect the streaks you already have — that is the whole game now.'
                              : 'Do not fix everything. Fix <b>' + escapeHtml(h.worst.t.name) + '</b> for three days and the score moves on its own.');
        }

        /* ---- what's left today ---- */
        if (has(s, ['left today', 'remaining', 'still need', 'yet to', 'pending', "what's left", 'whats left', 'to do today'])) {
            const today = K(new Date());
            const due = list.filter(x => x.kind !== 'bad' && !(x.logs && x.logs[today]));
            const done = list.filter(x => x.kind !== 'bad' && x.logs && x.logs[today]).length;
            if (!due.length) return card('0', 'left', `Everything due is logged — <b>${done} for ${done === 1 ? 'the day' : 'today'}</b>. Nothing is waiting on you.`, '', 'Rest is part of the system. See you tomorrow.');
            return card(due.length, due.length === 1 ? 'left' : 'left', `You have <b>${due.length}</b> still to log today${done ? ', and ' + done + ' already done' : ''}.`,
                '<div class="ak2-rows">' + due.map(x =>
                    `<div class="ak2-row"><span class="ak2-dot" style="background:${x.color || KC(x.kind)}"></span>
                     <span class="flex-1">${escapeHtml(x.name)}</span>
                     <b style="color:#7d8695;font-size:10px">${T.streak(x)}d streak</b></div>`).join('') + '</div>',
                'Start with the shortest one. Momentum is easier than motivation.');
        }

        /* ---- streaks ---- */
        if (s.indexOf('streak') >= 0 || has(s, ['chain', 'in a row', 'consecutive'])) {
            if (t) {
                const st = T.streak(t);
                const vals = keysBack(14).reverse().map(k => (t.logs && t.logs[k]) ? 1 : 0);
                return card(st, 'day' + (st === 1 ? '' : 's'), `<b>${escapeHtml(t.name)}</b> is on a <b>${st}-day</b> ${t.kind === 'bad' ? 'clean run' : 'streak'}.`,
                    chart(t.kind === 'bad' ? vals.map(v => 1 - v) : vals, t.color || KC(t.kind)) + '<div class="ak2-lbl">last 14 days</div>',
                    st === 0 ? 'Zero is just the day before one. Log it now.' : st < 7 ? 'Get to seven and it starts feeling automatic.' : 'Do not break this one — you have earned it.');
            }
            const ranked = list.map(x => ({ x: x, s: T.streak(x) })).sort((a, b) => b.s - a.s);
            return card(ranked[0].s, 'day best', `Your longest active run is <b>${escapeHtml(ranked[0].x.name)}</b>.`,
                '<div class="ak2-rows">' + ranked.slice(0, 6).map(r =>
                    `<div class="ak2-row"><span class="ak2-dot" style="background:${r.x.color || KC(r.x.kind)}"></span>
                     <span class="flex-1">${escapeHtml(r.x.name)}</span><b>${r.s}d</b></div>`).join('') + '</div>',
                'Streaks are the cheapest motivation there is. Guard the top one.');
        }

        /* ---- when did I last ---- */
        if (has(s, ['when did i last', 'last time', 'when was the last', 'how long since', 'when did i'])) {
            const target = t || h.worst.t;
            const d = daysSince(target);
            if (d > 900) return card('never', '', `I have no entries at all for <b>${escapeHtml(target.name)}</b>.`, '', 'Today is a good first day.');
            const ks = Object.keys(target.logs || {}).sort();
            const lastK = ks[ks.length - 1];
            const e = target.logs[lastK];
            const bits = [e.klass, e.mins ? e.mins + ' min' : '', e.intensity ? 'intensity ' + e.intensity : '', e.note].filter(Boolean);
            return card(d === 0 ? 'today' : d === 1 ? 'yesterday' : d, d > 1 ? 'days ago' : '',
                `Last entry for <b>${escapeHtml(target.name)}</b> was <b>${new Date(lastK + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</b>${bits.length ? ' — ' + escapeHtml(bits.join(' · ')) : ''}.`,
                '', d >= 3 ? 'Three days is where habits quietly die. Log it today.' : 'Still warm — keep it going.');
        }

        /* ---- weight / BMI ---- */
        if (has(s, ['weight', 'bmi', 'kg', 'heavier', 'lighter', 'losing', 'gaining', 'body'])) {
            const w = (T.body.w || []);
            if (w.length < 2) return card('', '', 'I need at least two weigh-ins to show a trend. <b>Log your weight</b> in a workout entry or in Body metrics.', '', 'One number a week is enough to see the shape of it.');
            const win = w.slice(-Math.min(w.length, Math.max(4, Math.round(R.n / 3))));
            const delta = +(win[win.length - 1].kg - win[0].kg).toFixed(1);
            const kg = win[win.length - 1].kg;
            const ideal = T.body.h ? +(22 * Math.pow(T.body.h / 100, 2)).toFixed(1) : null;
            const lo = Math.min.apply(null, win.map(x => x.kg));
            return card(kg, 'kg now', `Over your last <b>${win.length} weigh-ins</b> you have ${delta === 0 ? 'held steady' : delta < 0 ? 'lost <b>' + Math.abs(delta) + ' kg</b>' : 'gained <b>' + delta + ' kg</b>'}.${ideal ? ' A healthy target for your height is around <b>' + ideal + ' kg</b>.' : ''}`,
                chart(win.map(x => x.kg - lo + 1), delta <= 0 ? '#4ade80' : '#fbbf24') + '<div class="ak2-lbl">weigh-in trend</div>',
                Math.abs(delta) < .4 ? 'Flat is fine if that was the goal. If not, the lever is consistency, not intensity.'
                    : delta < 0 ? 'Steady loss is the durable kind. Do not accelerate it.' : 'Worth checking against your calorie entries.');
        }

        /* ---- calories / food ---- */
        if (has(s, ['calorie', 'kcal', 'ate', 'eat', 'food', 'diet', 'nutrition'])) {
            const vals = [], all = [];
            keys.forEach(k => { let v = 0; list.forEach(x => { const e = x.logs && x.logs[k]; if (e && e.kcal) v += e.kcal; }); vals.push(v); if (v) all.push(v); });
            if (!all.length) return card('', '', `No calorie entries in ${R.l}. Add them in a workout log and I will track the average for you.`, '', 'Even rough numbers beat no numbers.');
            const avg = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
            return card(avg.toLocaleString(), 'kcal / day avg', `Across <b>${all.length} logged day${all.length === 1 ? '' : 's'}</b> in ${R.l}, your highest was <b>${Math.max.apply(null, all).toLocaleString()}</b> and lowest <b>${Math.min.apply(null, all).toLocaleString()}</b>.`,
                chart(vals.slice().reverse(), '#fbbf24') + '<div class="ak2-lbl">' + R.l + '</div>',
                'Averages matter more than any single day. Keep logging even the bad ones.');
        }

        /* ---- intensity ---- */
        if (has(s, ['intensity', 'how hard', 'effort'])) {
            const pool = [];
            (t ? [t] : list).forEach(x => keys.forEach(k => { const e = x.logs && x.logs[k]; if (e && e.intensity) pool.push(e.intensity); }));
            if (!pool.length) return card('', '', `No intensity data in ${R.l} yet.`, '', 'Rate each session as you log it — it becomes useful fast.');
            const avg = (pool.reduce((a, b) => a + b, 0) / pool.length).toFixed(1);
            return card(avg, '/ 5 average', `Across <b>${pool.length} entr${pool.length === 1 ? 'y' : 'ies'}</b>${t ? ' for <b>' + escapeHtml(t.name) + '</b>' : ''} in ${R.l}.`, '',
                avg >= 4 ? 'High output. Make sure recovery is in the plan too.' : avg <= 2 ? 'Gentle is still showing up. But there is room to push.' : 'Well balanced — sustainable effort.');
        }

        /* ---- worst / failing ---- */
        if (has(s, ['worst', 'failing', 'behind', 'struggl', 'weakest', 'need work', 'bad at', 'neglect', 'skip'])) {
            const w = h.worst;
            const vals = keysBack(14).reverse().map(k => (w.t.logs && w.t.logs[k]) ? 1 : 0);
            return card(Math.round(w.rate * 100), '% of target', `<b>${escapeHtml(w.t.name)}</b> is your weakest link — ${w.t.kind === 'bad' ? '<b>' + w.hits + ' slip' + (w.hits === 1 ? '' : 's') + '</b>' : 'only <b>' + w.hits + ' entr' + (w.hits === 1 ? 'y' : 'ies') + '</b>'} in the last ${RO_WINDOW} days.`,
                chart(w.t.kind === 'bad' ? vals.map(v => 1 - v) : vals, '#ff5f57') + '<div class="ak2-lbl">last 14 days</div>',
                'Shrink it until it is embarrassing to skip. Two minutes counts as a win.');
        }

        /* ---- best ---- */
        if (has(s, ['best', 'strongest', 'top', 'good at', 'winning', 'proud'])) {
            const b = h.per.slice().sort((a, b2) => b2.rate - a.rate)[0];
            return card(Math.round(b.rate * 100), '% of target', `<b>${escapeHtml(b.t.name)}</b> is carrying you — <b>${b.hits} entr${b.hits === 1 ? 'y' : 'ies'}</b> in the last ${RO_WINDOW} days and a <b>${T.streak(b.t)}-day</b> streak.`,
                chart(keysBack(14).reverse().map(k => (b.t.logs && b.t.logs[k]) ? 1 : 0), b.t.color || KC(b.t.kind)) + '<div class="ak2-lbl">last 14 days</div>',
                'Copy whatever makes this one easy and apply it to your weakest tracker.');
        }

        /* ---- list ---- */
        if (has(s, ['list', 'show all', 'my tracker', 'what am i tracking', 'everything'])) {
            return card(list.length, 'trackers', 'Everything currently on the grid:',
                '<div class="ak2-rows">' + list.map(x =>
                    `<div class="ak2-row"><span class="ak2-dot" style="background:${x.color || KC(x.kind)}"></span>
                     <span class="flex-1 min-w-0" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.name)}</span>
                     <span style="color:#5a6472;font-size:10px">${T.KIND[x.kind].n}</span><b>${Object.keys(x.logs || {}).length}</b></div>`).join('') + '</div>',
                'Fewer trackers, tracked properly, beats a long list you ignore.');
        }

        /* ---- count / total (default numeric) ---- */
        const target = t;
        if (target) {
            const hits = keys.filter(k => target.logs && target.logs[k]).length;
            const vals = keys.slice().reverse().map(k => (target.logs && target.logs[k]) ? 1 : 0);
            const mins = keys.reduce((a, k) => { const e = target.logs && target.logs[k]; return a + (e && e.mins ? e.mins : 0); }, 0);
            const cls = {};
            keys.forEach(k => { const e = target.logs && target.logs[k]; if (e && e.klass) cls[e.klass] = (cls[e.klass] || 0) + 1; });
            const top = Object.keys(cls).sort((a, b) => cls[b] - cls[a]).slice(0, 4);
            const rate = Math.round(hits / R.n * 100);
            return card(hits, target.kind === 'bad' ? (hits === 1 ? 'slip' : 'slips') : (hits === 1 ? 'entry' : 'entries'),
                `<b>${escapeHtml(target.name)}</b> in ${R.l} — that is <b>${rate}%</b> of days${mins ? ', totalling <b>' + mins + ' minutes</b>' : ''}.${top.length ? ' Most common: <b>' + escapeHtml(top.map(c => c + ' ×' + cls[c]).join(', ')) + '</b>.' : ''}`,
                chart(target.kind === 'bad' ? vals.map(v => 1 - v) : vals, target.kind === 'bad' ? '#ff5f57' : (target.color || KC(target.kind))) + '<div class="ak2-lbl">' + R.l + '</div>',
                target.kind === 'bad'
                    ? (hits === 0 ? 'Zero slips. That is not luck — that is you.' : 'Every logged slip is data, not defeat. Fewer next fortnight.')
                    : (rate >= 70 ? 'This is a real habit now, not an intention.' : 'Raise the floor before the ceiling — aim for one more day a week.'));
        }

        /* ---- fallback: total entries + notes search ---- */
        const terms = s.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
        const found = [];
        list.forEach(x => Object.keys(x.logs || {}).forEach(k => {
            const e = x.logs[k];
            const blob = [x.name, e.klass, e.note, e.amt, e.sup, e.food].filter(Boolean).join(' ').toLowerCase();
            if (terms.length && terms.some(w => blob.indexOf(w) >= 0)) found.push({ x: x, k: k, e: e });
        }));
        if (found.length) {
            found.sort((a, b) => b.k.localeCompare(a.k));
            return card(found.length, 'matching entries', `Found mentions of <b>${escapeHtml(terms.join(' '))}</b> in your history:`,
                '<div class="ak2-rows">' + found.slice(0, 7).map(f =>
                    `<div class="ak2-row"><span class="ak2-dot" style="background:${f.x.color || KC(f.x.kind)}"></span>
                     <span class="flex-1 min-w-0" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml([f.x.name, f.e.klass, f.e.note].filter(Boolean).join(' · '))}</span>
                     <span style="color:#5a6472;font-size:10px">${new Date(f.k + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></div>`).join('') + '</div>');
        }
        let tot = 0; list.forEach(x => { tot += keys.filter(k => x.logs && x.logs[k]).length; });
        return card(tot, 'entries', `I could not pin that question to one tracker, so here is the whole grid for ${R.l}: <b>${tot} entr${tot === 1 ? 'y' : 'ies'}</b> across <b>${list.length}</b> tracker${list.length === 1 ? '' : 's'}, health <b>${h.score}/100</b>.`,
            '', 'Try naming a tracker — “how many gym sessions this month” or “streak for water”.');
    }

    setTimeout(() => paint(), 1400);
})();    

    // New Code

     /* ============================================================
   V8.2 — CONSEQUENCE ENGINE
   The Grid physically degrades as you drift: flicker, cracks,
   failing power, emergency lighting. At 7 days of neglect it
   COLLAPSES — GRID-1 comes to the glass, takes over the screen,
   reads your record back to you, then rebuilds itself with you.
   Reads window.zdRobo (V8.1) · mounts over #trk-modal (V8.0)
============================================================ */
(function zd82() {
    if (window.__zd82) return; window.__zd82 = true;
    if (!window.zdTrk) { console.warn('[V8.2] needs V8.0 + V8.1'); return; }

    /* ───────────────────────────────────────────────────────────
       ⚙ CUSTOMISE
       ─────────────────────────────────────────────────────────── */
    const COL_DAYS   = 7;      // ⚙ consecutive drift days that trigger collapse
    const COL_WARN   = 5;      // ⚙ day the emergency warning banner appears
    const COL_TYPE   = 26;     // ⚙ typewriter speed (ms per character) — lower = faster
    const COL_SKIP_MS = 4200;  // ⚙ how long before the Skip button appears
    const COL_GRACE  = 7;      // ⚙ days of grace after a collapse before it can fire again
    /* ─────────────────────────────────────────────────────────── */

    const T = window.zdTrk, K = T.key, $ = id => document.getElementById(id);

    document.head.insertAdjacentHTML('beforeend', `<style>
    /* ============ DAMAGE STATES ============ */
    #trk-modal{transition:filter .8s ease;}
    #trk-dmg{position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;transition:opacity 1s ease;overflow:hidden;}
    #trk-dmg.on{opacity:1;}
    /* static noise */
    #trk-dmg .dm-noise{position:absolute;inset:-50%;opacity:0;mix-blend-mode:overlay;
        background-image:repeating-conic-gradient(#fff 0% 0.0002%,transparent 0% 0.0004%);
        background-size:180px 180px;animation:dmNoise .35s steps(3) infinite;}
    @keyframes dmNoise{0%{transform:translate(0,0)}33%{transform:translate(-24px,14px)}66%{transform:translate(18px,-20px)}}
    /* emergency wash */
    #trk-dmg .dm-red{position:absolute;inset:0;opacity:0;
        background:radial-gradient(1200px 600px at 50% -10%,rgba(220,38,38,.34),transparent 66%),
                   linear-gradient(0deg,rgba(220,38,38,.14),transparent 40%);}
    /* cracks */
    #trk-dmg svg{position:absolute;inset:0;width:100%;height:100%;}
    #trk-dmg .dm-crack{stroke:rgba(255,255,255,.5);stroke-width:1.3;fill:none;
        filter:drop-shadow(0 0 5px rgba(255,95,87,.85));
        stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.4s cubic-bezier(.4,0,.3,1);}
    /* falling debris */
    #trk-dmg .dm-bit{position:absolute;top:-6px;width:2px;height:9px;border-radius:1px;
        background:rgba(255,255,255,.32);opacity:0;}
    #trk-dmg.on .dm-bit{animation:dmFall linear infinite;}
    @keyframes dmFall{0%{opacity:0;transform:translateY(0) rotate(0)}
        8%{opacity:.7}100%{opacity:0;transform:translateY(105vh) rotate(340deg)}}
    /* stage escalation */
    body.dmg-2 #trk-dmg .dm-noise{opacity:.05}
    body.dmg-3 #trk-dmg .dm-noise{opacity:.09}
    body.dmg-4 #trk-dmg .dm-noise{opacity:.14}body.dmg-4 #trk-dmg .dm-red{opacity:.4}
    body.dmg-5 #trk-dmg .dm-noise{opacity:.19}body.dmg-5 #trk-dmg .dm-red{opacity:.62;animation:dmSiren 2.6s ease-in-out infinite}
    body.dmg-6 #trk-dmg .dm-noise{opacity:.25}body.dmg-6 #trk-dmg .dm-red{opacity:.85;animation:dmSiren 1.3s ease-in-out infinite}
    @keyframes dmSiren{0%,100%{opacity:.28}50%{opacity:.9}}
    body.dmg-3 #trk-modal{animation:dmFlick 7s steps(1) infinite;}
    body.dmg-4 #trk-modal{animation:dmFlick 4.4s steps(1) infinite;}
    body.dmg-5 #trk-modal{animation:dmFlick 2.6s steps(1) infinite;}
    body.dmg-6 #trk-modal{animation:dmFlick 1.5s steps(1) infinite,dmShake 9s ease-in-out infinite;}
    @keyframes dmFlick{0%,88%,100%{filter:none}
        90%{filter:brightness(.32) saturate(.4)}91%{filter:none}
        93%{filter:brightness(.5)}94%{filter:none}96%{filter:brightness(.24) hue-rotate(-14deg)}97%{filter:none}}
    @keyframes dmShake{0%,92%,100%{transform:none}94%{transform:translate(-2px,1px)}96%{transform:translate(2px,-1px)}98%{transform:translate(-1px,0)}}
    body.dmg-4 .trk-kpi,body.dmg-5 .trk-kpi,body.dmg-6 .trk-kpi{border-color:rgba(255,95,87,.3)!important;}
    body.dmg-5 .tc,body.dmg-6 .tc{border-color:rgba(255,95,87,.26)!important;}
    body.dmg-6 .trk-t{animation:dmGlitchT 3.4s steps(1) infinite;}
    @keyframes dmGlitchT{0%,90%,100%{transform:none;opacity:1}92%{transform:translateX(-3px) skewX(7deg);opacity:.7}
        94%{transform:translateX(3px) skewX(-5deg)}96%{transform:none}}
    /* warning banner */
    #trk-warn{display:none;flex-shrink:0;align-items:center;gap:9px;padding:9px 13px;
        border-bottom:1px solid rgba(220,38,38,.4);background:rgba(220,38,38,.14);
        animation:warnPulse 2s ease-in-out infinite;}
    #trk-warn.on{display:flex;}
    @keyframes warnPulse{0%,100%{background:rgba(220,38,38,.11)}50%{background:rgba(220,38,38,.22)}}
    #trk-warn svg{width:16px;height:16px;color:#ff5f57;flex-shrink:0;animation:warnRot 4s linear infinite;}
    @keyframes warnRot{0%,80%{transform:none}90%{transform:scale(1.2)}100%{transform:none}}
    #trk-warn b{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#ff8a80;}
    #trk-warn span{font-size:10.5px;color:#e8b4b0;line-height:1.4;min-width:0;}
    #trk-warn button{flex-shrink:0;padding:5px 12px;border-radius:8px;font-size:10px;font-weight:900;
        background:#dc2626;color:#fff;white-space:nowrap;}

    /* ============ COLLAPSE STAGE ============ */
    #col{position:fixed;inset:0;z-index:205;display:none;overflow:hidden;background:#000;}
    #col.on{display:block;}
    /* phase 1: the room tears apart */
    #col .cl-shatter{position:absolute;inset:0;opacity:0;}
    #col.p1 .cl-shatter{opacity:1;}
    #col .cl-shard{position:absolute;background:rgba(255,255,255,.055);
        border:1px solid rgba(255,95,87,.55);box-shadow:0 0 22px rgba(255,95,87,.4);}
    #col.p1 .cl-shard{animation:clShard 2.1s cubic-bezier(.5,0,.7,.2) forwards;}
    @keyframes clShard{0%{opacity:1;transform:none}
        18%{transform:translate(var(--jx),var(--jy)) rotate(var(--jr))}
        100%{opacity:0;transform:translate(calc(var(--dx)*1.6),calc(var(--dy)*1.6)) rotate(var(--dr)) scale(.5)}}
    #col .cl-boom{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:99px;
        background:#fff;opacity:0;}
    #col.p1 .cl-boom{animation:clBoom 1.5s cubic-bezier(.2,.9,.3,1) .25s forwards;}
    @keyframes clBoom{0%{opacity:.9;transform:scale(.2)}55%{opacity:.5}100%{opacity:0;transform:scale(80)}}
    #col .cl-siren{position:absolute;inset:0;opacity:0;
        background:radial-gradient(900px 500px at 50% 50%,rgba(220,38,38,.6),transparent 70%);}
    #col.p1 .cl-siren{animation:clSiren .42s steps(2) 5;}
    @keyframes clSiren{50%{opacity:1}}
    #col .cl-alarm{position:absolute;left:0;right:0;top:44%;text-align:center;opacity:0;z-index:5;
        font-size:clamp(13px,4.4vw,22px);font-weight:900;letter-spacing:.34em;color:#ff5f57;
        text-shadow:0 0 26px rgba(255,95,87,.95);}
    #col.p1 .cl-alarm{animation:clAlarm 2.1s steps(1) forwards;}
    @keyframes clAlarm{0%{opacity:0}12%{opacity:1}30%{opacity:.2}38%{opacity:1}62%{opacity:.25}70%{opacity:1}100%{opacity:0}}

    /* phase 2: GRID-1 approaches the glass */
    #col .cl-bot{position:absolute;left:50%;top:50%;width:min(52vmin,300px);height:min(52vmin,300px);
        margin:calc(min(52vmin,300px) / -2) 0 0 calc(min(52vmin,300px) / -2);opacity:0;}
    #col.p2 .cl-bot{animation:clApproach 2.5s cubic-bezier(.4,0,.55,.95) forwards;}
    @keyframes clApproach{0%{opacity:0;transform:scale(.18) translateY(70px)}
        18%{opacity:1}62%{transform:scale(1.15) translateY(0)}
        78%{transform:scale(1.05)}100%{opacity:1;transform:scale(4.6)}}
    #col .cl-bot .cb-shell{fill:rgba(255,255,255,.07);stroke:#dc2626;stroke-width:2.2;}
    #col .cl-bot .cb-visor{fill:#000;stroke:#dc2626;stroke-width:1.6;stroke-opacity:.6;}
    #col .cl-bot .cb-eye{stroke:#dc2626;stroke-width:3.6;stroke-linecap:round;fill:none;
        filter:drop-shadow(0 0 7px #dc2626);animation:cbEye .5s steps(2) infinite;}
    @keyframes cbEye{50%{opacity:.4}}
    #col .cl-bot .cb-crack{stroke:#ff5f57;stroke-width:1.5;fill:none;opacity:.95;}

    /* phase 3: the visor becomes the screen */
    #col .cl-panel{position:absolute;inset:0;background:#000;opacity:0;z-index:6;
        display:flex;align-items:center;justify-content:center;padding:clamp(18px,6vw,54px);}
    #col.p3 .cl-panel,#col.p4 .cl-panel{opacity:1;transition:opacity .5s ease;}
    #col .cl-panel::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
        background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);}
    #col .cl-panel::after{content:'';position:absolute;inset:0;pointer-events:none;
        box-shadow:inset 0 0 140px rgba(220,38,38,.28);}
    #cl-inner{position:relative;z-index:2;width:100%;max-width:600px;max-height:100%;overflow-y:auto;}
    #cl-inner::-webkit-scrollbar{width:0}
    .cl-eyes{display:flex;justify-content:center;gap:clamp(26px,9vw,58px);margin-bottom:clamp(18px,5vw,34px);}
    .cl-eyes i{display:block;width:clamp(34px,10vw,62px);height:clamp(6px,1.6vw,9px);border-radius:99px;
        background:var(--cl-c,#dc2626);box-shadow:0 0 24px var(--cl-c,#dc2626);
        animation:clEye 2.6s ease-in-out infinite;transition:background .9s ease,box-shadow .9s ease;}
    .cl-eyes i:last-child{animation-delay:.16s}
    @keyframes clEye{0%,100%{transform:scaleX(1);opacity:.85}50%{transform:scaleX(.7);opacity:1}}
    #cl-type{font:600 clamp(12.5px,3.5vw,16px)/1.85 ui-monospace,'SF Mono',Menlo,monospace;
        color:#f0d4d0;white-space:pre-wrap;min-height:44vh;letter-spacing:.01em;}
    #cl-type b{color:#fff;font-weight:900;}
    #cl-type .cl-em{color:#ff8a80;font-weight:900;}
    #cl-type .cl-hope{color:#4ade80;font-weight:800;}
    #cl-type .cl-cur{display:inline-block;width:9px;height:1.05em;background:#dc2626;
        vertical-align:-2px;animation:clCur .6s steps(1) infinite;}
    @keyframes clCur{50%{opacity:0}}
    #cl-acts{display:flex;flex-direction:column;gap:8px;margin-top:clamp(16px,4vw,26px);opacity:0;
        transition:opacity .6s ease;}
    #cl-acts.on{opacity:1;}
    #cl-go{width:100%;padding:15px 0;border-radius:14px;font-size:13px;font-weight:900;color:#fff;
        letter-spacing:.1em;text-transform:uppercase;background:linear-gradient(135deg,#dc2626,#f87171);
        box-shadow:0 12px 34px rgba(220,38,38,.45);transition:all .3s ease;}
    #cl-go.hope{background-image:var(--zd-grad);box-shadow:0 12px 34px rgb(var(--accent-rgb) / .5);}
    #cl-go:active{transform:scale(.98);}
    #cl-skip{align-self:center;padding:8px 16px;font-size:10.5px;font-weight:800;letter-spacing:.1em;
        text-transform:uppercase;color:#7d5c5a;opacity:0;transition:opacity .5s ease;}
    #cl-skip.on{opacity:1;}
    #cl-skip:hover{color:#c3cad6;}

    /* phase 4: rebuild */
    #col.p5 .cl-panel{opacity:0;}
    #cl-rebuild{position:absolute;inset:0;z-index:7;display:none;flex-direction:column;
        align-items:center;justify-content:center;gap:16px;padding:24px;background:#04070d;}
    #col.p5 #cl-rebuild{display:flex;animation:clFadeIn .5s ease-out;}
    @keyframes clFadeIn{0%{opacity:0}100%{opacity:1}}
    #cl-rebuild .rb-bot{width:min(38vmin,190px);animation:rbHeal 2.8s cubic-bezier(.22,1,.36,1) forwards;}
    @keyframes rbHeal{0%{filter:grayscale(1) brightness(.4);transform:scale(.86) translateY(10px)}
        100%{filter:none;transform:none}}
    #cl-rebuild .rb-t{font-size:clamp(13px,3.6vw,16px);font-weight:900;letter-spacing:.16em;
        text-transform:uppercase;color:#fff;text-align:center;}
    #cl-rebuild .rb-s{font-size:11.5px;color:#8b93a1;text-align:center;max-width:330px;line-height:1.6;}
    #cl-rbar{width:min(76vw,300px);height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;}
    #cl-rbar i{display:block;height:100%;width:0;border-radius:99px;background-image:var(--zd-grad);
        box-shadow:0 0 16px rgb(var(--accent-rgb) / .8);transition:width .28s linear;}
    #cl-rpct{font:900 10px/1 ui-monospace,monospace;letter-spacing:.28em;color:rgb(var(--accent-rgb));}
    /* the section reassembles behind */
    #trk-modal.trk-rebuilt .trk-head,#trk-modal.trk-rebuilt #trk-marq,#trk-modal.trk-rebuilt #trk-tabs,
    #trk-modal.trk-rebuilt #trk-robo,#trk-modal.trk-rebuilt #trk-stats,#trk-modal.trk-rebuilt #trk-grid{
        animation:rbIn .75s cubic-bezier(.22,1,.36,1) both;}
    #trk-modal.trk-rebuilt .trk-head{animation-delay:0ms}
    #trk-modal.trk-rebuilt #trk-marq{animation-delay:130ms}
    #trk-modal.trk-rebuilt #trk-tabs{animation-delay:250ms}
    #trk-modal.trk-rebuilt #trk-robo{animation-delay:370ms}
    #trk-modal.trk-rebuilt #trk-stats{animation-delay:490ms}
    #trk-modal.trk-rebuilt #trk-grid{animation-delay:610ms}
    @keyframes rbIn{0%{opacity:0;transform:translateY(26px) scale(.97);filter:blur(9px) brightness(2)}
        60%{filter:blur(0) brightness(1.25)}100%{opacity:1;transform:none;filter:none}}
    @media (prefers-reduced-motion:reduce){
        #col *,#trk-modal{animation-duration:.25s!important}
        body[class*="dmg-"] #trk-modal{animation:none!important}
    }
    </style>`);

    /* ============ DOM ============ */
    const modal = $('trk-modal');
    modal.insertAdjacentHTML('afterbegin', `
    <div id="trk-dmg">
      <div class="dm-noise"></div><div class="dm-red"></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <path class="dm-crack" data-s="2" pathLength="1" d="M0 12 L18 19 L26 15 L41 24"/>
        <path class="dm-crack" data-s="3" pathLength="1" d="M100 30 L82 38 L74 33 L58 44 L52 40"/>
        <path class="dm-crack" data-s="4" pathLength="1" d="M12 100 L20 78 L14 68 L26 52 L22 44"/>
        <path class="dm-crack" data-s="5" pathLength="1" d="M88 100 L80 82 L88 70 L76 58 L82 48"/>
        <path class="dm-crack" data-s="6" pathLength="1" d="M0 56 L16 60 L24 54 L38 62 L46 56 L62 66 L78 60 L100 68"/>
      </svg>
    </div>`);
    $('trk-marq').insertAdjacentHTML('afterend', `
    <div id="trk-warn">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L2.4 17a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>
      <span class="min-w-0 flex-1"><b id="trk-warn-t">structural warning</b><br><span id="trk-warn-s"></span></span>
      <button onclick="colFixNow()">Log now</button>
    </div>`);
    document.body.insertAdjacentHTML('beforeend', `
    <div id="col">
      <div class="cl-shatter" id="cl-shatter"></div>
      <div class="cl-siren"></div><span class="cl-boom"></span>
      <div class="cl-alarm">system failure</div>
      <svg class="cl-bot" viewBox="0 0 120 120">
        <line class="cb-shell" x1="60" y1="18" x2="60" y2="6" stroke-linecap="round"/>
        <circle class="cb-shell" cx="60" cy="4" r="3.4" style="fill:#dc2626"/>
        <rect class="cb-shell" x="18" y="18" width="84" height="64" rx="22"/>
        <rect class="cb-visor" x="28" y="31" width="64" height="38" rx="18"/>
        <path class="cb-eye" d="M40 42l9 9M49 42l-9 9"/><path class="cb-eye" d="M71 42l9 9M80 42l-9 9"/>
        <path class="cb-eye" style="stroke-width:2.8" d="M50 62q10-8 20 0"/>
        <path class="cb-crack" d="M76 31l5 11-7 6 6 9"/><path class="cb-crack" d="M32 69l7-8"/>
        <path class="cb-crack" d="M18 46l9 3"/>
      </svg>
      <div class="cl-panel">
        <div id="cl-inner">
          <div class="cl-eyes" id="cl-eyes"><i></i><i></i></div>
          <div id="cl-type"></div>
          <div id="cl-acts">
            <button id="cl-go" onclick="colAdvance()">…</button>
            <button id="cl-skip" onclick="colSkip()">Skip</button>
          </div>
        </div>
      </div>
      <div id="cl-rebuild">
        <svg class="rb-bot" viewBox="0 0 120 130">
          <line x1="60" y1="20" x2="60" y2="7" stroke="#4ade80" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="60" cy="5" r="3.4" fill="#4ade80"/>
          <rect x="20" y="20" width="80" height="60" rx="21" fill="rgba(255,255,255,.09)" stroke="#4ade80" stroke-width="2.4"/>
          <rect x="29" y="32" width="62" height="34" rx="16" fill="#04070d" stroke="#4ade80" stroke-width="1.6" stroke-opacity=".5"/>
          <path d="M40 44q5-7 10 0" stroke="#4ade80" stroke-width="3.4" fill="none" stroke-linecap="round"/>
          <path d="M70 44q5-7 10 0" stroke="#4ade80" stroke-width="3.4" fill="none" stroke-linecap="round"/>
          <path d="M50 58q10 7 20 0" stroke="#4ade80" stroke-width="2.6" fill="none" stroke-linecap="round"/>
          <rect x="31" y="86" width="58" height="34" rx="15" fill="rgba(255,255,255,.09)" stroke="#4ade80" stroke-width="2.4"/>
          <circle cx="60" cy="103" r="8" fill="#4ade80"/><circle cx="60" cy="103" r="3.2" fill="#04070d"/>
        </svg>
        <div class="rb-t" id="rb-t">rebuilding the grid</div>
        <div id="cl-rbar"><i></i></div>
        <div id="cl-rpct">0%</div>
        <div class="rb-s" id="rb-s">Every panel comes back online with you.</div>
      </div>
    </div>`);

    /* ============ HELPERS ============ */
    const KC = k => (T.KIND[k] || T.KIND.good).c;
    function drift() {
        const r = window.zdRobo;
        if (!r) return 0;
        return Math.max(r.neglect || 0, r.run || 0);
    }
    function ack() {
        try { return JSON.parse(localStorage.getItem('zdColAck') || 'null'); } catch (e) { return null; }
    }
    function setAck(d) {
        const v = { d: d, at: Date.now(), k: K(new Date()) };
        localStorage.setItem('zdColAck', JSON.stringify(v));
        try { T.save('_body', { colAck: v }); } catch (e) {}   /* rides in _body so it isn't read as a tracker */
    }
    function eligible() {
        const d = drift();
        if (d < COL_DAYS) { if (ack() && d < 2) localStorage.removeItem('zdColAck'); return false; }
        const a = ack();
        if (!a) return true;
        /* after a collapse you get a grace window; it only fires again on a fresh full failure */
        return d >= (a.d || COL_DAYS) + COL_GRACE;
    }
    /* longest streak that has already ended, for the record */
    function lostStreak(t) {
        const ks = Object.keys(t.logs || {}).sort();
        if (!ks.length) return { len: 0, end: null };
        let best = 0, bestEnd = null, run = 0, prev = null;
        ks.forEach(k => {
            if (prev) {
                const gap = Math.round((new Date(k + 'T12:00') - new Date(prev + 'T12:00')) / 864e5);
                run = gap === 1 ? run + 1 : 1;
            } else run = 1;
            if (run > best) { best = run; bestEnd = k; }
            prev = k;
        });
        return { len: best, end: bestEnd };
    }
    function daysSince(t) {
        const ks = Object.keys(t.logs || {});
        if (!ks.length) return 999;
        return Math.round((new Date(K(new Date()) + 'T12:00') - new Date(ks.sort().pop() + 'T12:00')) / 864e5);
    }

    /* ============ AMBIENT DAMAGE ============ */
    let bitsMade = false;
    function paintDamage() {
        const d = Math.min(6, drift());
        const list = T.list || [];
        for (let i = 1; i <= 6; i++) document.body.classList.remove('dmg-' + i);
        const dmg = $('trk-dmg');
        if (!list.length || d < 2) {
            dmg.classList.remove('on');
            dmg.querySelectorAll('.dm-crack').forEach(p => p.style.strokeDashoffset = 1);
            $('trk-warn').classList.remove('on');
            return;
        }
        document.body.classList.add('dmg-' + d);
        dmg.classList.add('on');
        dmg.querySelectorAll('.dm-crack').forEach(p => { p.style.strokeDashoffset = (+p.dataset.s <= d) ? 0 : 1; });
        if (d >= 4 && !bitsMade) {
            bitsMade = true;
            for (let i = 0; i < 14; i++) {
                const b = document.createElement('span');
                b.className = 'dm-bit';
                b.style.left = (Math.random() * 100) + '%';
                b.style.animationDuration = (2.4 + Math.random() * 3.4) + 's';
                b.style.animationDelay = (Math.random() * 4) + 's';
                dmg.appendChild(b);
            }
        }
        /* warning banner */
        const w = $('trk-warn');
        if (d >= COL_WARN) {
            const r = window.zdRobo, worst = r && r.worst ? r.worst.t : null;
            const left = Math.max(0, COL_DAYS - d);
            $('trk-warn-t').textContent = left <= 0 ? 'critical — collapse imminent' : 'structural warning · ' + d + ' day drift';
            $('trk-warn-s').innerHTML = worst
                ? (left <= 0
                    ? 'The Grid cannot hold. <b>' + escapeHtml(worst.name) + '</b> has been failing for ' + d + ' days.'
                    : '<b>' + escapeHtml(worst.name) + '</b> is ' + d + ' days behind. <b>' + left + ' day' + (left === 1 ? '' : 's') + '</b> before systems collapse.')
                : 'Multiple trackers are failing.';
            w.classList.add('on');
        } else w.classList.remove('on');
    }

    /* ============ MONOLOGUE ============ */
    function script() {
        const list = T.list || [], r = window.zdRobo || {};
        const now = new Date(), y = now.getFullYear();
        const doy = Math.floor((now - new Date(y, 0, 1)) / 864e5) + 1;
        const yearLeft = (Math.floor((new Date(y, 11, 31) - new Date(y, 0, 1)) / 864e5) + 1) - doy;
        const fails = (r.per || []).filter(p => p.rate < .6);
        const best = (r.per || []).slice().sort((a, b) => b.rate - a.rate)[0];
        let totalEntries = 0, followed = new Set();
        list.forEach(t => Object.keys(t.logs || {}).forEach(k => {
            if (k.indexOf(y + '-') === 0) { totalEntries++; if (t.kind !== 'bad') followed.add(k); }
        }));

        const L = [];
        L.push('> SYSTEM LOG RECOVERED\n> ' + now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '\n\n');
        L.push('I am GRID-1.\nI do not forget. That is the whole point of me.\n\n');
        L.push('<span class="cl-em">You stopped showing up ' + drift() + ' days ago.</span>\n\n');
        L.push('Here is what I recorded while you were gone.\n\n');

        fails.slice(0, 5).forEach(p => {
            const t = p.t;
            if (t.kind === 'bad') {
                const run = (function () { let n = 0; const d = new Date(); for (let i = 0; i < 400; i++) { if (t.logs && t.logs[K(d)]) n++; else break; d.setDate(d.getDate() - 1); } return n; })();
                L.push('  <b>' + escapeHtml(t.name) + '</b>\n    <span class="cl-em">' + p.hits + ' slip' + (p.hits === 1 ? '' : 's') + '</span> in 14 days'
                    + (run > 1 ? ' — ' + run + ' consecutive' : '') + '.\n');
            } else {
                const ds = daysSince(t), ls = lostStreak(t);
                L.push('  <b>' + escapeHtml(t.name) + '</b>\n    Last logged <span class="cl-em">'
                    + (ds > 900 ? 'never' : ds + ' day' + (ds === 1 ? '' : 's') + ' ago') + '</span>.'
                    + (ls.len >= 3 ? '\n    A <span class="cl-em">' + ls.len + '-day streak</span> died on ' + new Date(ls.end + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '.' : '') + '\n');
            }
        });
        L.push('\n  Grid health: <span class="cl-em">' + (r.score || 0) + ' / 100</span>\n');
        L.push('  Failing systems: <span class="cl-em">' + fails.length + ' of ' + list.length + '</span>\n\n');
        L.push('That is the record. I am not going to soften it.\n\n');
        L.push('...\n\n');
        L.push('But I did not come here to bury you in it.\n\n');
        L.push('<span class="cl-hope">Look at what is also true.</span>\n\n');
        if (best && best.hits > 0) L.push('  You held <b>' + escapeHtml(best.t.name) + '</b> together anyway.\n    <span class="cl-hope">' + best.hits + ' entr' + (best.hits === 1 ? 'y' : 'ies') + '</span> while everything else slipped.\n\n');
        L.push('  You logged <span class="cl-hope">' + totalEntries + ' entr' + (totalEntries === 1 ? 'y' : 'ies') + '</span> this year.\n');
        L.push('  You showed up on <span class="cl-hope">' + followed.size + ' separate days</span>.\n');
        L.push('  You built me. Nobody made you do that.\n\n');
        L.push('<span class="cl-hope">And there are still ' + yearLeft + ' days left in ' + y + '.</span>\n\n');
        L.push('Seven days of nothing did not erase you.\nIt just proved the system needs you in it.\n\n');
        L.push('So here is the deal.\n\n');
        L.push('You do not owe me seven days.\nYou owe me <span class="cl-hope">one entry</span>.\nToday. Right now. The smallest possible version of it.\n\n');
        L.push('I will rebuild every panel you burned down.\nI will start the streak counter at one.\n\n');
        L.push('<span class="cl-hope">Then we go again.</span>');
        return L.join('');
    }

    /* ============ SEQUENCE ============ */
    let typing = null, phase = 0, skipT = null;
    function shards() {
        const host = $('cl-shatter');
        host.innerHTML = '';
        const cols = window.innerWidth < 620 ? 4 : 7, rows = window.innerWidth < 620 ? 6 : 5;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const s = document.createElement('span');
            s.className = 'cl-shard';
            s.style.left = (c / cols * 100) + '%'; s.style.top = (r / rows * 100) + '%';
            s.style.width = (100 / cols) + '%'; s.style.height = (100 / rows) + '%';
            const cx = (c + .5) / cols - .5, cy = (r + .5) / rows - .5;
            s.style.setProperty('--dx', (cx * 160 + (Math.random() - .5) * 60) + 'vw');
            s.style.setProperty('--dy', (cy * 160 + (Math.random() - .5) * 60) + 'vh');
            s.style.setProperty('--dr', ((Math.random() - .5) * 180) + 'deg');
            s.style.setProperty('--jx', ((Math.random() - .5) * 14) + 'px');
            s.style.setProperty('--jy', ((Math.random() - .5) * 14) + 'px');
            s.style.setProperty('--jr', ((Math.random() - .5) * 10) + 'deg');
            s.style.animationDelay = (Math.random() * 260) + 'ms';
            host.appendChild(s);
        }
    }
    window.colRun = () => {
        if (phase) return;
        phase = 1;
        const col = $('col');
        $('cl-type').innerHTML = '';
        $('cl-acts').classList.remove('on');
        $('cl-skip').classList.remove('on');
        $('cl-eyes').style.setProperty('--cl-c', '#dc2626');
        $('cl-go').classList.remove('hope');
        col.className = 'on p1';
        shards();
        try { if (navigator.vibrate) navigator.vibrate([70, 60, 120, 50, 200, 70, 260]); } catch (e) {}
        setTimeout(() => { phase = 2; col.className = 'on p2'; try { if (navigator.vibrate) navigator.vibrate([30, 240, 60, 300]); } catch (e) {} }, 2150);
        setTimeout(() => { phase = 3; col.className = 'on p2 p3'; type(); }, 4450);
    };
    function type() {
        const src = script(), el = $('cl-type');
        let i = 0, out = '';
        clearTimeout(skipT);
        skipT = setTimeout(() => $('cl-skip').classList.add('on'), COL_SKIP_MS);
        clearInterval(typing);
        typing = setInterval(() => {
            if (i >= src.length) { done(); return; }
            /* emit whole tags at once so markup never renders half-written */
            if (src[i] === '<') { const e = src.indexOf('>', i); out += src.slice(i, e + 1); i = e + 1; }
            else { out += src[i]; i++; }
            el.innerHTML = out + '<span class="cl-cur"></span>';
            if (src[i - 1] === '\n') el.parentElement.scrollTop = el.parentElement.scrollHeight;
        }, COL_TYPE);
    }
    function done() {
        clearInterval(typing); typing = null;
        clearTimeout(skipT);
        $('cl-type').innerHTML = script();
        $('cl-eyes').style.setProperty('--cl-c', '#4ade80');
        const go = $('cl-go');
        go.textContent = "I'm ready — rebuild it";
        go.classList.add('hope');
        $('cl-acts').classList.add('on');
        $('cl-skip').classList.remove('on');
        $('cl-inner').scrollTop = $('cl-inner').scrollHeight;
        try { if (navigator.vibrate) navigator.vibrate([16, 90, 16]); } catch (e) {}
    }
    window.colSkip = () => { if (typing) done(); };
    window.colAdvance = () => { if (typing) { done(); return; } rebuild(); };
    function rebuild() {
        phase = 5;
        setAck(drift());
        $('col').className = 'on p5';
        const bar = $('#cl-rbar i') ? null : document.querySelector('#cl-rbar i');
        const STEPS = [
            [12, 'restoring power'], [28, 'reseating panels'], [46, 'recovering streak data'],
            [64, 'sealing structural cracks'], [80, 'recalibrating GRID-1'], [94, 'grid coming online'], [100, 'grid restored']
        ];
        let si = 0, p = 0;
        const iv = setInterval(() => {
            p += 2;
            if (bar) bar.style.width = p + '%';
            $('cl-rpct').textContent = p + '%';
            if (si < STEPS.length && p >= STEPS[si][0]) { $('rb-t').textContent = STEPS[si][1]; si++; }
            if (p >= 100) {
                clearInterval(iv);
                $('rb-s').innerHTML = 'Streak counter reset to zero.<br><b style="color:#4ade80">Make the first entry and it becomes one.</b>';
                try { if (navigator.vibrate) navigator.vibrate([20, 60, 20, 60, 40]); } catch (e) {}
                setTimeout(finish, 1400);
            }
        }, 46);
    }
    function finish() {
        $('col').className = '';
        phase = 0;
        modal.classList.add('trk-rebuilt');
        paintDamage();
        try { if (window.zdRoboSync) zdRoboSync(); } catch (e) {}
        setTimeout(() => modal.classList.remove('trk-rebuilt'), 1600);
        showToast('The Grid is rebuilt. One entry starts everything again.', 5200);
        /* hand them straight to the smallest possible win */
        setTimeout(() => {
            const r = window.zdRobo;
            if (r && r.worst && r.worst.t) trkQuick(r.worst.t.id);
        }, 1900);
    }
    window.colFixNow = () => {
        const r = window.zdRobo;
        if (r && r.worst && r.worst.t) trkQuick(r.worst.t.id);
        else showToast('Open a tracker and log it.');
    };

    /* ============ WIRING ============ */
    const _open = window.openTrackers;
    window.openTrackers = function () {
        const r = _open.apply(this, arguments);
        setTimeout(() => {
            paintDamage();
            if (eligible()) colRun();
        }, 1900);
        return r;
    };
    const _close = window.closeTrackers;
    window.closeTrackers = function () {
        if (phase) return;                       /* the collapse cannot be walked out of */
        for (let i = 1; i <= 6; i++) document.body.classList.remove('dmg-' + i);
        return _close.apply(this, arguments);
    };
    const _sync = window.zdRoboSync;
    window.zdRoboSync = function () {
        const r = _sync.apply(this, arguments);
        setTimeout(paintDamage, 60);
        return r;
    };
    /* Esc is disabled while the sequence plays */
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && phase) {
            e.preventDefault(); e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (typing) { done(); return; }
            showToast('Read it. Then rebuild.', 2200);
        }
    }, true);
    /* cross-device: pick up an acknowledgement made elsewhere */
    setTimeout(() => {
        if (state.isGuest || !state.user) return;
        db.collection('users').doc(state.user.uid).collection('trackers').doc('_body').get()
          .then(s => {
              if (!s.exists) return;
              const a = s.data().colAck;
              if (a && (!ack() || a.at > (ack().at || 0))) localStorage.setItem('zdColAck', JSON.stringify(a));
          }).catch(() => {});
    }, 3000);
    setTimeout(paintDamage, 2200);
})();   

    // New Code

