# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static games hub — no build step, no backend, no package manager. Every
page is a single self-contained HTML file with inline `<style>`/`<script>`.
Live at `arcade.krishnabuilds.dev`, deployed via Cloudflare Pages: pushes to
`master` deploy automatically (source = repo root, no build command).

## Commands

There's no build/lint/test tooling — it's plain HTML/CSS/JS. To preview locally:

```
python3 -m http.server 8080
```

then open `http://localhost:8080/` for the landing page or
`http://localhost:8080/games/<slug>/index.html` for a game directly.

To sanity-check inline `<script>` blocks parse without a browser:

```
node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1])"
```

## Structure

```
index.html              — landing page; lists every game as a "cartridge" card
assets/game-embed.js     — shared chrome every game page includes (nav bar, support link)
assets/version.js        — single source of truth for the displayed version string
games/fin-dash/index.html — Fin Dash (canvas game)
games/<slug>/index.html — next game goes here
```

## Adding a new game

1. Create `games/<slug>/index.html` as a self-contained file (own `<style>`/`<script>`, no shared CSS/JS assumed beyond the embed script below). **Include `<meta name="viewport" content="width=device-width, initial-scale=1">` in `<head>`** — without it, mobile browsers render the page at an implied desktop width and zoom the whole thing out to fit, which shrinks every element uniformly (this cost a long debugging session on Fin Dash's nav bar before the missing tag was found).
2. Before `</body>`, include the shared chrome:
   ```html
   <script src="../../assets/version.js"></script>
   <script src="../../assets/game-embed.js" data-coffee-url="https://buymeacoffee.com/Krishnabuilds"></script>
   ```
   This injects a top nav bar ("← All games" + brand/version text) and a
   floating "☕ Support" link — no per-game CSS/markup needed.
3. Add one entry to the `GAMES` array near the bottom of `index.html`'s
   inline script (name, tagline, emoji, gradient `color`, `tags`, `path`).
   The card on the landing page is generated entirely from this array.

That's the whole process for a new game — no other files need to change.

## The nav-bar/canvas space contract (important for canvas games)

`game-embed.js`'s nav bar (top) and support link (bottom) take real
layout space rather than floating transparently over the game. Any game
that sizes a canvas against `window.innerHeight` (e.g. a
`fitCanvas()`-style function) **must** reserve room for both or they'll
encroach on the game on mobile. The embed script publishes both measured
heights once it's actually in the DOM (it loads after the game's own
inline script, so the game can't assume these are known at first paint):

- `window.kbNavbarHeight` / `window.kbBottomReserve` (number, px) — read
  these inside `fitCanvas()` and subtract both from `window.innerHeight`.
- `--kb-navbar-h` / `--kb-bottom-reserve` (CSS custom properties on
  `<html>`) — use in
  `body { padding-top: var(--kb-navbar-h, 0px); padding-bottom: var(--kb-bottom-reserve, 0px); box-sizing: border-box; }`
  so the game's own centering reserves the same space.
- A `kb-navbar-ready` event on `window`, fired once all of the above are
  set (and again on resize) — listen for it and re-run your fit function,
  since the real heights aren't known until after your first
  `fitCanvas()` call.

See `games/fin-dash/index.html` for the reference implementation of all
three.

## Versioning

`assets/version.js` sets `window.KB_VERSION` and `window.KB_UPDATED`.
Bump both whenever you ship a change worth the user noticing, so the
homepage footer (`v{VERSION} · updated {DATE}`) and the game nav bar's
brand text confirm you're looking at the latest deploy rather than a
stale cached copy.

## Mobile-first constraints learned the hard way

- Nothing that communicates "this is clickable" or "here's how you go
  back" may depend on `:hover` — touch devices never trigger it. Borders,
  glows, and badges on interactive elements must be visible at rest.
- Don't eyeball proportions from a description alone — a translucent bar
  can measure correctly in CSS pixels and still look broken because its
  background color nearly matches what's behind it. Prefer solid,
  high-contrast backgrounds plus an accent border for any chrome that
  needs to read clearly against a game canvas of unknown color.
