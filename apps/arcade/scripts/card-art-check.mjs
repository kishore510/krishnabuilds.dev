// Checks the landing page cards: every GAMES entry shows either its `art`
// picture (loaded, not broken) or its emoji, in grid and list view at phone
// and desktop widths. Also checks each assets/art/*.svg against the card art
// rules (viewBox 0 0 240 92, under 10 KB, nothing external).
//
// Run by hand from the repo root (not wired into CI or lint):
//   node apps/arcade/scripts/card-art-check.mjs

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');   // apps/arcade
const problems = [];

// --- static rules for the SVG files ---
const artDir = join(ROOT, 'assets', 'art');
for (const f of (await readdir(artDir)).filter(f => f.endsWith('.svg'))) {
  const svg = await readFile(join(artDir, f), 'utf8');
  const bytes = Buffer.byteLength(svg);
  if (bytes >= 10240) problems.push(`${f}: ${bytes} bytes, must be under 10 KB`);
  if (!/<svg[^>]*\sviewBox="0 0 240 92"/.test(svg)) problems.push(`${f}: viewBox must be "0 0 240 92"`);
  if (/https?:\/\/(?!www\.w3\.org\/)/.test(svg) || /<image\b|@import|@font-face|url\(\s*['"]?(?!#)/.test(svg)) {
    problems.push(`${f}: references something external (only #ids allowed)`);
  }
}

// --- static server for apps/arcade ---
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (path === '' || path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
for (const width of [360, 1280]) {
  for (const layout of ['grid', 'single']) {
    const where = `${width}px ${layout}`;
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    await ctx.addInitScript(l => {
      try {
        localStorage.setItem('kbArcadeLayout', l);
        localStorage.setItem('kbArcadeCategory', 'all');
        localStorage.setItem('kbArcadeSort', 'newest');
      } catch {}
    }, layout);
    const page = await ctx.newPage();
    const bad = [];
    page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/')) bad.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => { if (!r.url().includes('/api/')) bad.push(`failed ${r.url()}`); });
    page.on('pageerror', e => bad.push(`page error: ${e.message}`));
    await page.goto(base);

    const games = await page.evaluate(() => GAMES.map(g => ({ name: g.name, path: g.path, emoji: g.emoji, art: g.art || null })));
    const cards = await page.locator('.cartridge').count();
    if (cards !== games.length) problems.push(`${where}: ${cards} cards for ${games.length} GAMES entries`);

    let arts = 0;
    for (const g of games) {
      const label = page.locator(`.cartridge[href="${g.path}"] .label`);
      if (await label.count() !== 1) { problems.push(`${where}: no single card for ${g.name}`); continue; }
      const img = label.locator('img.art');
      const span = label.locator(':scope > span');
      if (g.art) {
        arts++;
        if (await img.count() !== 1 || await span.count() !== 0) { problems.push(`${where}: ${g.name} should show only its art`); continue; }
        if (await img.getAttribute('src') !== g.art) problems.push(`${where}: ${g.name} img src is not ${g.art}`);
        await img.scrollIntoViewIfNeeded();          // it's loading="lazy"
        await page.waitForFunction(el => el.complete, await img.elementHandle(), { timeout: 5000 }).catch(() => {});
        const ok = await img.evaluate(el => el.complete && el.naturalWidth > 0);
        const box = await img.boundingBox();
        if (!ok) problems.push(`${where}: ${g.name} art is broken (${g.art})`);
        if (!box || box.width < 100 || box.height < 80) problems.push(`${where}: ${g.name} art drawn at ${box && Math.round(box.width)}x${box && Math.round(box.height)}`);
      } else {
        if (await img.count() !== 0) problems.push(`${where}: ${g.name} has no art but renders an img`);
        const text = (await span.textContent().catch(() => '')) || '';
        if (text.trim() !== g.emoji) problems.push(`${where}: ${g.name} emoji fallback missing`);
      }
    }
    // Nothing anywhere on the page may be a broken image.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const broken = await page.$$eval('img', els => els.filter(el => el.complete && el.naturalWidth === 0).map(el => el.src));
    broken.forEach(src => problems.push(`${where}: broken image ${src}`));
    bad.forEach(b => problems.push(`${where}: ${b}`));
    console.log(`${where}: ${games.length} cards, ${arts} with art, ${games.length - arts} emoji`);
    await ctx.close();
  }
}
await browser.close();
server.close();

if (problems.length) {
  console.error('\n' + problems.map(p => 'FAIL ' + p).join('\n'));
  process.exit(1);
}
console.log('OK: every card shows its art or its emoji, no broken images.');
