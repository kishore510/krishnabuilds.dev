// Search-engine tags for the Arcade: a sitemap built from the games folder, and the
// head tags every game page needs (description, canonical link, share tags, JSON-LD).
//
//   node scripts/seo.mjs --sitemap   write sitemap.xml (the deploy runs this; the file is git-ignored)
//   node scripts/seo.mjs --inject    add any missing head tags to game pages (safe to re-run)
//
// The GAMES list in index.html is the source for names, taglines and dates, so a new
// game needs its entry there and then one `--inject`; scripts/seo.test.mjs says so if not.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const ORIGIN = 'https://arcade.krishnabuilds.dev';
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUFFIX = ' · Arcade · krishnabuilds';

/** @param {string} text */
export const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The GAMES array from the landing page, keyed by folder name. @param {string} html */
export function parseGames(html) {
  const m = /const GAMES = (\[[\s\S]*?\n  \]);/.exec(html);
  if (!m) throw new Error('index.html: could not find the GAMES list');
  const list = vm.runInNewContext(m[1]);
  /** @type {Map<string, { name: string, tagline: string, published?: string }>} */
  const games = new Map();
  for (const g of list) {
    const slug = /^games\/([^/]+)\//.exec(g.path)?.[1];
    if (slug) games.set(slug, g);
  }
  return games;
}

/** Folders under games/ that hold a page. @param {string} [app] */
export const gameFolders = (app = APP) =>
  readdirSync(join(app, 'games'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(app, 'games', d.name, 'index.html')))
    .map((d) => d.name)
    .sort();

export const gameUrl = (/** @type {string} */ slug) => `${ORIGIN}/games/${slug}/`;

/** @param {string} slug @param {{ name: string, tagline: string }} game */
export const gameTitle = (slug, game) => `${game.name}${SUFFIX}`;
/** @param {{ name: string, tagline: string }} game */
export const gameDescription = (game) => `Play ${game.name} free in your browser. ${game.tagline}`;

/** @param {string} slug @param {{ name: string, tagline: string, multiplayer?: boolean }} game */
export function gameHead(slug, game) {
  const title = gameTitle(slug, game);
  const description = gameDescription(game);
  const url = gameUrl(slug);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    description,
    url,
    gamePlatform: 'Web browser',
    playMode: game.multiplayer ? ['SinglePlayer', 'MultiPlayer'] : 'SinglePlayer',
    isAccessibleForFree: true,
    isPartOf: { '@type': 'WebSite', name: 'Arcade', url: `${ORIGIN}/` },
  };
  return [
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${url}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="krishnabuilds">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${url}">`,
    '<meta property="og:image" content="https://krishnabuilds.dev/og.png">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

/** @param {{ path: string, lastmod?: string }[]} pages */
export function sitemap(pages) {
  const rows = pages.map((p) => `  <url><loc>${ORIGIN}${p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

/** @param {string} [app] */
export function buildSitemap(app = APP) {
  const games = parseGames(readFileSync(join(app, 'index.html'), 'utf8'));
  return sitemap([{ path: '/' }, ...gameFolders(app).map((slug) => ({ path: `/games/${slug}/`, lastmod: games.get(slug)?.published }))]);
}

/** Adds the head tags to a game page that lacks them; returns the new html. @param {string} html @param {string} slug @param {{ name: string, tagline: string }} game */
export function inject(html, slug, game) {
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(gameTitle(slug, game))}</title>`);
  if (out === html && !/<title>/.test(html)) throw new Error(`games/${slug}: no <title>`);
  if (!/rel="canonical"/.test(out)) out = out.replace(/(<title>[^<]*<\/title>)/, `$1\n${gameHead(slug, game)}`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === '--sitemap') {
    writeFileSync(join(APP, 'sitemap.xml'), buildSitemap());
    console.log(`sitemap.xml: ${gameFolders().length + 1} pages`);
  } else if (mode === '--inject') {
    const games = parseGames(readFileSync(join(APP, 'index.html'), 'utf8'));
    for (const slug of gameFolders()) {
      const game = games.get(slug);
      if (!game) { console.error(`games/${slug}: no entry in the GAMES list in index.html`); process.exitCode = 1; continue; }
      const file = join(APP, 'games', slug, 'index.html');
      const before = readFileSync(file, 'utf8');
      const after = inject(before, slug, game);
      if (after !== before) { writeFileSync(file, after); console.log(`updated games/${slug}`); }
    }
  } else {
    console.error('usage: node scripts/seo.mjs --sitemap | --inject');
    process.exitCode = 1;
  }
}
