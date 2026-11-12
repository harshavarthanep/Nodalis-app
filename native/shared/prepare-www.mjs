// Copies the Nodalis web app (index.html in the repository root) into a
// native shell's www/ folder and injects native-bridge.js before the app's
// own code. Run from native/desktop or native/mobile:
//
//     node ../shared/prepare-www.mjs www
//
// Your website file is never changed - only the copy inside www/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const dest = path.resolve(process.cwd(), process.argv[2] || 'www');
const src = process.env.NODALIS_HTML
  ? path.resolve(process.env.NODALIS_HTML)
  : path.join(repoRoot, 'index.html');

if (!fs.existsSync(src)) {
  console.error('Cannot find the app at ' + src + '. Put the Nodalis index.html in the repository root.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

let html = fs.readFileSync(src, 'utf8');
const bridge = fs.readFileSync(path.join(here, 'native-bridge.js'), 'utf8');
const marker = '<!-- nodalis-native-bridge -->';
const block = '\n' + marker + '\n<script>\n' + bridge + '\n</script>\n';

if (!html.includes(marker)) {
  let done = false;
  html = html.replace(/<meta\s+charset=["']?utf-8["']?\s*\/?>/i, (m) => { done = true; return m + block; });
  if (!done) html = html.replace(/<head[^>]*>/i, (m) => { done = true; return m + block; });
  if (!done) { console.error('Could not find <head> in index.html'); process.exit(1); }
}

// The app shell is the installed app, so the web-install manifest is not needed.
html = html.replace(/<link\s+rel=["']manifest["'][^>]*>/i, '');

fs.writeFileSync(path.join(dest, 'index.html'), html);

const icons = path.join(repoRoot, 'icons');
if (fs.existsSync(icons)) fs.cpSync(icons, path.join(dest, 'icons'), { recursive: true });

const kb = Math.round(fs.statSync(path.join(dest, 'index.html')).size / 1024);
console.log('Prepared ' + path.relative(process.cwd(), dest) + '/index.html (' + kb + ' KB) from ' + src);
