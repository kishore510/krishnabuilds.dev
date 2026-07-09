# krishnabuilds.dev

A small games hub. Static site, no build step — the only backend is a
tiny optional Cloudflare Worker that powers the "Played N times" counter
(see below); everything else works with zero setup.

## Structure

```
index.html              — landing page, lists every game as a "cartridge"
assets/game-embed.js    — shared script every game page includes
src/worker.js           — play-count API + static-asset serving (see below)
wrangler.jsonc          — Cloudflare Worker config (Workers Builds auto-deploys this)
games/
  fin-dash/index.html   — Fin Dash
  <slug>/index.html     — next game goes here
```

## Adding a new game

1. Make a folder: `games/<slug>/`
2. Drop the game's self-contained HTML file in as `games/<slug>/index.html`
3. Near the end of that file's `<body>`, before `</body>`, add:
   ```html
   <script src="../../assets/game-embed.js" data-coffee-url="https://buymeacoffee.com/yourname"></script>
   ```
   This automatically adds a "← All games" link and a "☕ Support" link —
   no extra CSS or markup needed in the game itself.
4. Open `index.html` (the landing page) and add one entry to the `GAMES`
   array near the bottom of the file:
   ```js
   {
     name: 'Game Name',
     tagline: 'One short line about it.',
     emoji: '🎮',
     color: 'linear-gradient(135deg, #hex1, #hex2)',
     tags: ['genre', 'length'],
     path: 'games/<slug>/index.html'
   }
   ```
   The card, its colors, and the link are generated from this automatically.

That's the whole process — no other files need to change.

## Before going live

- Replace `https://buymeacoffee.com/yourname` in both
  `assets/game-embed.js` (default) and `index.html` (footer button) with
  your real link.
- If hosting on Cloudflare Pages: point the project's custom domain at
  `krishnabuilds.dev`, source = this repo, build output = repo root
  (no build command needed).

## Play-count counter (optional)

Every game pings `POST /api/play/<slug>` once per page load
(`assets/game-embed.js`), and the landing page reads `GET /api/plays` to
show "Played N times" on each card. Both routes are handled by
`src/worker.js`, backed by a single Cloudflare KV namespace holding all
counts as one JSON blob. This repo deploys as a Cloudflare Worker with
static assets (`wrangler.jsonc`'s `assets` block), not classic Pages —
Cloudflare Workers Builds auto-deploys on every push to `master`, same as
before, no local `wrangler deploy` needed.

**One-time setup** (not done yet in this repo — `wrangler.jsonc` has a
placeholder KV id):

1. `npx wrangler login` (if you haven't already)
2. `npx wrangler kv namespace create PLAY_COUNTS`
3. Copy the `id` it prints into `wrangler.jsonc` → `kv_namespaces[0].id`
4. Commit and push — the next Workers Build picks up the binding

If this step is skipped, nothing breaks: the fetch calls fail silently
(caught and ignored), games load exactly as before, and the landing page
just shows no play-count line on any card.
