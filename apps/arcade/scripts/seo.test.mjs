import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildSitemap, gameDescription, gameFolders, gameTitle, gameUrl, inject, parseGames } from './seo.mjs';

const APP = join(fileURLToPath(import.meta.url), '..', '..');
const games = parseGames(readFileSync(join(APP, 'index.html'), 'utf8'));
const FIX = 'Fix: run `node scripts/seo.mjs --inject` from apps/arcade.';

test('every game folder has an entry in the GAMES list', () => {
  for (const slug of gameFolders(APP)) assert.ok(games.has(slug), `games/${slug} has no GAMES entry in index.html`);
});

test('every game page has its title, description and canonical link', () => {
  for (const slug of gameFolders(APP)) {
    const html = readFileSync(join(APP, 'games', slug, 'index.html'), 'utf8');
    const game = games.get(slug);
    assert.ok(html.includes(`<title>${gameTitle(slug, game).replace(/&/g, '&amp;')}</title>`), `games/${slug}: title. ${FIX}`);
    assert.ok(html.includes(`<link rel="canonical" href="${gameUrl(slug)}">`), `games/${slug}: canonical. ${FIX}`);
    assert.ok(html.includes('name="description"') && html.includes(gameDescription(game).replace(/&/g, '&amp;')), `games/${slug}: description. ${FIX}`);
  }
});

test('the sitemap lists the home page and every game once', () => {
  const xml = buildSitemap(APP);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.includes('https://arcade.krishnabuilds.dev/'));
  for (const slug of gameFolders(APP)) assert.ok(locs.includes(gameUrl(slug)), `${slug} missing from the sitemap`);
});

test('inject is idempotent and escapes text', () => {
  const game = { name: 'A & B', tagline: 'Say "hi" <now>.' };
  const once = inject('<head><title>x</title></head>', 'a-b', game);
  assert.equal(inject(once, 'a-b', game), once);
  assert.ok(once.includes('A &amp; B'));
  assert.ok(once.includes('&quot;hi&quot; &lt;now&gt;'));
});

test('robots.txt names the sitemap and keeps crawlers off the API', () => {
  const txt = readFileSync(join(APP, 'robots.txt'), 'utf8');
  assert.ok(txt.includes('Sitemap: https://arcade.krishnabuilds.dev/sitemap.xml'));
  assert.ok(txt.includes('Disallow: /api/'));
});
