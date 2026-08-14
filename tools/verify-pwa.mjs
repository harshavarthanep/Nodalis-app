import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
const DIST='/home/claude/nodalis/dist';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'};
const server=createServer(async(req,res)=>{let p=new URL(req.url,'http://x').pathname; if(p==='/')p='/index.html'; const f=join(DIST,p); if(!existsSync(f)){res.writeHead(404).end('not found');return;} res.writeHead(200,{'Content-Type':MIME[extname(f)]||'application/octet-stream'}); res.end(await readFile(f));});
await new Promise(r=>server.listen(8990,r));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const page=await b.newPage({viewport:{width:1400,height:900}});
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:8990/');
await page.waitForFunction(()=>window.NODALIS&&window.NODALIS.store,null,{timeout:20000});
await page.evaluate(async()=>{await window.NODALIS.loader.finish(true)});
await page.waitForSelector('.onboard-choice',{timeout:10000}).catch(()=>{});
await page.locator('.onboard-choice',{hasText:'this device'}).first().click().catch(()=>{});
await page.waitForTimeout(2500);
await page.evaluate(()=>{window.NODALIS.help.closeTour(); while(window.NODALIS.modal.anyOpen())window.NODALIS.modal.closeTop();});
await page.waitForTimeout(1200);

const report = await page.evaluate(async()=>{
  const reg = await navigator.serviceWorker.getRegistration();
  const manifestLink = document.querySelector('link[rel="manifest"]');
  let manifest=null;
  try { manifest = await (await fetch(manifestLink.href)).json(); } catch(e){}
  const favicons = Array.from(document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')).map(l=>({rel:l.rel, href:l.href.slice(0,40)}));
  return {
    swRegistered: !!reg,
    swScope: reg?reg.scope:null,
    swActive: !!(reg && (reg.active||reg.installing||reg.waiting)),
    manifestName: manifest?manifest.name:null,
    manifestStart: manifest?manifest.start_url:null,
    manifestIcons: manifest?manifest.icons.length:0,
    favicons,
    notes: window.NODALIS.store.state.notes.size,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    activeTabBg: (()=>{const x=document.querySelector('#view-tabs button.is-active');return x?getComputedStyle(x).backgroundColor:null})(),
    vaultLabel: (document.querySelector('.vault-status-label')||{}).textContent,
    degraded: window.NODALIS.db.isDegraded(),
  };
});
console.log(JSON.stringify(report,null,1));
console.log('console errors:', errs.filter(e=>!/favicon/i.test(e)));
await page.screenshot({path: join(DIST,'..','tests/shots/dist-pwa.png')});

// second load should be served from the SW cache with the server down
server.close();
await page.waitForTimeout(500);
const offline = await page.goto('http://127.0.0.1:8990/').then(r=>r?r.status():'no response').catch(e=>'error: '+e.message.split('\n')[0]);
console.log('offline reload status (server stopped):', offline);
const stillThere = await page.evaluate(()=>!!document.getElementById('app')).catch(()=>false);
console.log('app shell present offline:', stillThere);
await b.close();
