# krishnabuilds.dev

A small games hub. Static site, no build step, no backend.

## Structure

```
index.html              — landing page, lists every game as a "cartridge"
assets/game-embed.js    — shared script every game page includes
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
