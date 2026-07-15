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
index.html                    — landing page; lists every game as a "cartridge" card
assets/game-embed.js          — shared chrome every game page includes (nav bar, support link)
assets/version.js             — single source of truth for the displayed version string
games/fin-dash/index.html     — Fin Dash (canvas, single-tap flap physics)
games/burrow-bash/index.html  — Burrow Bash (DOM/CSS game, no canvas)
games/air-hockey/index.html   — Air Hockey (canvas, drag-controlled mallet vs. tunable-difficulty AI)
games/jungle-runner/index.html — Jungle Runner (canvas, single-tap grounded-jump endless runner)
games/koala-climb/index.html  — Koala Climb (canvas, drag-steered vertical bounce climber)
games/brick-breaker/index.html — Brick Breaker (canvas, drag-steered paddle, classic 3-lives breakout)
games/safari-rescue/index.html — Safari Rescue (canvas, discrete lane-switch dodge-and-collect vs. a timer)
games/lane-racer/index.html   — Lane Racer (canvas, lane-changing traffic/potholes/roadblocks dodge with fuel management)
games/globe-quiz/index.html   — Globe Quiz (DOM, timed multiple-choice trivia: capitals/flags, no Easy/Hard — see note below)
games/<slug>/index.html       — next game goes here
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
4. Add a bare `data-kb-play` attribute to whichever button actually begins
   a play — the button that's initially labelled "Start"/"Play" and gets
   relabelled "Play Again"/"Retry" for replays (every game follows this
   reuse pattern; see e.g. `games/fin-dash/index.html`'s `easyBtn`/`hardBtn`
   or `games/castle-hold/index.html`'s `startBtn`). `game-embed.js` listens
   for clicks on `[data-kb-play]` to ping the play-count API — without this
   attribute a game's plays silently never get counted (page-load alone
   isn't a reliable proxy: it only ever caught the first attempt, missing
   every replay via the same reused button).

That's the whole process for a new game — no other files need to change.

## The nav-bar/game-area space contract (applies to canvas AND DOM games)

`game-embed.js`'s nav bar (top) and support link (bottom) take real
layout space rather than floating transparently over the game. Any game
that sizes its play area against `window.innerHeight` — a `<canvas>` via
`fitCanvas()` (Fin Dash) or a plain sized `<div>` via an equivalent
`fitField()` (Burrow Bash) — **must** reserve room for both or they'll
encroach on the game on mobile. The embed script publishes both measured
heights once it's actually in the DOM (it loads after the game's own
inline script, so the game can't assume these are known at first paint):

- `window.kbNavbarHeight` / `window.kbBottomReserve` (number, px) — read
  these inside your fit function and subtract both from `window.innerHeight`.
- `--kb-navbar-h` / `--kb-bottom-reserve` (CSS custom properties on
  `<html>`) — use in
  `body { padding-top: var(--kb-navbar-h, 0px); padding-bottom: var(--kb-bottom-reserve, 0px); box-sizing: border-box; }`
  so the game's own centering reserves the same space.
- A `kb-navbar-ready` event on `window`, fired once all of the above are
  set (and again on resize) — listen for it and re-run your fit function,
  since the real heights aren't known until after your first fit call.

Both `games/fin-dash/index.html` (canvas) and `games/burrow-bash/index.html`
(DOM) implement this the same way: a fixed logical size (e.g. 360x480),
a fit function that computes `scale = min(innerWidth/W, availH/H)` and
sets the play area's pixel width/height from it, and a shared
`--game-scale` CSS custom property (set on the `#wrap` element) that
every bit of in-game UI sizes off via `calc(Npx * var(--game-scale, 1))`
— fonts, buttons, HUD text, everything. Follow this same pattern for new
games so they resize consistently.

## Versioning

`assets/version.js` sets `window.KB_VERSION` and `window.KB_UPDATED`.
Bump both whenever you ship a change worth the user noticing, so the
homepage footer (`v{VERSION} · updated {DATE}`) and the game nav bar's
brand text confirm you're looking at the latest deploy rather than a
stale cached copy.

## Difficulty design pattern used across all games

Every *reflex/arcade* game exposes Easy/Hard. Globe Quiz is the deliberate
exception — it's untimed-per-round trivia (15 questions, fixed 10s per
question) rather than a ramping reaction test, so there's no speed/spawn
axis to make "harder." If it ever needs difficulty tiers, prefer varying
the question pool (obscure vs. well-known countries) or the per-question
time limit over anything else, to stay consistent with the spirit below.

In every reflex/arcade game, "harder" means retuning
spawn/reaction parameters, never removing the safety margin that keeps
the game fair:

- Ramps (speed, spawn rate, branch spacing) always have a hard cap so
  the game never becomes physically unreactable, no matter how long a
  run goes on.
- Procedurally-placed hazards (Jungle Runner's obstacles, Koala Climb's
  branches, Safari Rescue's rocks/mounds) are spaced using a minimum
  pixel/height gap derived from the player's actual jump arc or lane
  count, so a hazard is never unreachable-fair or unavoidable-unfair by
  construction, not by luck.
- Air Hockey's AI difficulty isn't a speed multiplier: `reactionFrames`
  delays which historical puck sample it reacts to (simulating slow
  reflexes), `error` adds periodically-rerolled aim jitter, and
  `predictFactor` is how far ahead of the puck's velocity it aims (0 on
  Easy - no prediction at all). Reuse this shape (delay + jitter +
  prediction) for any future AI opponent rather than just scaling a
  single speed number.

## Two-body collision needs a post-hit cooldown, not just separation

Air Hockey's puck could get permanently wedged in a corner: near a wall,
"push the puck away from the mallet" and "push it into the wall" point
the same direction, so a stationary AI mallet and a cornered puck would
re-collide every single frame forever. Pushing the mallet back on
collision (not just the puck) looked like a fix but wasn't enough on its
own - if the AI's approach speed can close that recoil gap in a single
frame (easy near a wall, where mallet and puck are both pinned close
together), it re-collides before the puck's escape velocity had any real
frames to actually carry it away, producing an endless sub-pixel
oscillation right at the corner. The fix that actually holds: a short
cooldown (`puckHitCooldown`, ~8 frames) during which the puck is immune
to *any* mallet collision, guaranteeing genuine travel time. Apply this
same pattern - recoil alone is not sufficient - to any future game with
a body that gets repeatedly struck near a boundary.

## Mobile-first constraints learned the hard way

- Nothing that communicates "this is clickable" or "here's how you go
  back" may depend on `:hover` — touch devices never trigger it. Borders,
  glows, and badges on interactive elements must be visible at rest.
- Don't eyeball proportions from a description alone — a translucent bar
  can measure correctly in CSS pixels and still look broken because its
  background color nearly matches what's behind it. Prefer solid,
  high-contrast backgrounds plus an accent border for any chrome that
  needs to read clearly against a game canvas of unknown color.
