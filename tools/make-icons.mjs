import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('icons/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const sizes = [
  [32, 'icons/favicon-32.png'],
  [180, 'icons/icon-180.png'],
  [192, 'icons/icon-192.png'],
  [512, 'icons/icon-512.png'],
];
for (const [size, out] of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}svg{width:${size}px;height:${size}px;display:block}</style>` + svg
  );
  const buf = await page.screenshot({ omitBackground: true });
  writeFileSync(out, buf);
  await page.close();
  console.log('wrote', out, size + 'px');
}
await browser.close();
