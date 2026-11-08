# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static games hub — no build step, no backend, no package manager. Every
page is a single self-contained HTML file with inline `<style>`/`<script>`
(one exception: a game whose logic needs headless tests may split it into a
pure, DOM-free script next to its `index.html`; Tennis's `engine.js` is the
only one so far, see `docs/decisions.md`, 2026-11-08).
Live at `arcade.krishnabuilds.dev`. Arcade now lives in the krishnabuilds.dev
monorepo and follows the root `CLAUDE.md`: work on a branch, open a PR,
squash merge; deploys run from GitHub Actions on merge to `main`.

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
assets/site-links.js          — link home + app switcher (bar on the landing page, pill via game-embed.js); app list must match packages/ui. Opt-in `kbSetChromeHidden(bool)` (game-embed.js) hides the guide link and pill; only Dojo Duel calls it
assets/version.js             — single source of truth for the displayed version string
assets/art/<slug>.svg         — optional card pictures for the landing page (see "Card art")
games/fin-dash/index.html     — Fin Dash (canvas, single-tap flap physics)
games/burrow-bash/index.html  — Burrow Bash (DOM/CSS game, no canvas)
games/air-hockey/index.html   — Air Hockey (canvas, drag-controlled mallet vs. tunable-difficulty AI)
games/jungle-runner/index.html — Jungle Runner (canvas, single-tap grounded-jump endless runner)
games/koala-climb/index.html  — Koala Climb (canvas, drag-steered vertical bounce climber)
games/brick-breaker/index.html — Brick Breaker (canvas, drag-steered paddle, classic 3-lives breakout)
games/safari-rescue/index.html — Safari Rescue (canvas, discrete lane-switch dodge-and-collect vs. a timer)
games/lane-racer/index.html   — Lane Racer (canvas, lane-changing traffic/potholes/roadblocks dodge with fuel management)
games/globe-quiz/index.html   — Globe Quiz (DOM, timed multiple-choice trivia: capitals/flags, no Easy/Hard — see note below)
games/fuseblock/index.html    — Fuseblock (canvas, bomb-placement grid arena: 5 bot tiers, roguelike level progression, power-ups)
games/mosaica/index.html      — Mosaica (canvas, drag-to-column/rotate tetromino stacker, ceramic-tile visual theme; Phase 1 core loop only)
games/dojo-duel/index.html    — Dojo Duel (canvas, landscape fullscreen 1v1 fighter vs CPU; see "Dojo Duel notes" below for its layout and tuning tables)
games/<slug>/index.html       — next game goes here
```

This list is not every game. The `GAMES` array in `index.html` is the source
of truth, and `README.md` lists all 35 with their folders and taglines.

## Adding a new game

1. Create `games/<slug>/index.html` as a self-contained file (own `<style>`/`<script>`, no shared CSS/JS assumed beyond the embed script below). The only allowed split is a pure logic script beside it for headless `node:test` tests, as Tennis does with `engine.js` and `scripts/tennis.test.js`. **Include `<meta name="viewport" content="width=device-width, initial-scale=1">` in `<head>`** — without it, mobile browsers render the page at an implied desktop width and zoom the whole thing out to fit, which shrinks every element uniformly (this cost a long debugging session on Fin Dash's nav bar before the missing tag was found).
2. Before `</body>`, include the shared chrome:
   ```html
   <script src="../../assets/version.js"></script>
   <script src="../../assets/game-embed.js" data-coffee-url="https://kishorecraft88.gumroad.com/l/abuoox"></script>
   ```
   This injects a top nav bar ("← All games" + brand/version text) and a
   floating "Want to build your own? Get the guide" link — no per-game
   CSS/markup needed. **Always copy the `data-coffee-url` value verbatim
   from an existing game (e.g. `games/sudoku/index.html`) — do not use
   `https://buymeacoffee.com/Krishnabuilds`.** That URL is stale (an early
   placeholder from before the support link became "get the guide"); five
   games (Comet Watch, Inkgrid, Lexigrid, Shard Rush, Word Search) got
   built with it copied from an outdated version of this instruction
   before the mismatch was caught and fixed. Every current game uses the
   gumroad URL above — `grep -rh data-coffee-url games/*/index.html | sort
   -u` should show exactly one URL (aside from the unrelated
   `data-fullscreen` attribute some games also carry) before you commit a
   new game.
3. Add one entry to the `GAMES` array near the bottom of `index.html`'s
   inline script (name, tagline, emoji, gradient `color`, `tags`, `path`).
   The card on the landing page is generated entirely from this array.
   Optionally add `art: 'assets/art/<slug>.svg'` for a card picture instead
   of the emoji (cards without it keep the emoji); see "Card art" below.
4. Add a bare `data-kb-play` attribute to whichever button actually begins
   a play — the button that's initially labelled "Start"/"Play" and gets
   relabelled "Play Again"/"Retry" for replays (every game follows this
   reuse pattern; see e.g. `games/fin-dash/index.html`'s `easyBtn`/`hardBtn`
   or `games/castle-hold/index.html`'s `startBtn`). `game-embed.js` listens
   for clicks on `[data-kb-play]` to ping the play-count API — without this
   attribute a game's plays silently never get counted (page-load alone
   isn't a reliable proxy: it only ever caught the first attempt, missing
   every replay via the same reused button).
5. Ship it through the monorepo flow in the root `CLAUDE.md`: branch, PR,
   squash merge to `main`. The game is live once the GitHub Actions deploy
   for that merge finishes.

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

## Card art

A GAMES entry's optional `art` points at `assets/art/<slug>.svg`; the card
shows that picture instead of its emoji. Every picture shares one style so
the shelf reads as a family. Follow these for every new one:

- **Canvas:** `viewBox="0 0 240 92"` (with `width="240" height="92"`). Grid
  view covers the label with it (92 px tall, 149-274 px wide); list view shows
  only the middle 118x92 at 1:1, fading the top and bottom into the card's
  `color`.
- **Safe zone:** the subject sits inside x 61-179, y 28-86. Above y 28 is the
  notch (top centre) and the New / Play badges (top corners); the strips
  outside x 61-179 are cropped on phones and in list view, so they only hold
  supporting detail (pattern, spare pills, the end of a path).
- **Budget:** under 10 KB per file (most come in at 2-4 KB) and 200 KB for
  all of them together. No external fonts, images or `url()`s; text uses the
  system font stack (`system-ui, -apple-system, 'Segoe UI', Roboto, Arial,
  sans-serif`) at weight 800.
- **Palette:** 2-3 colours from the game itself (its GAMES `color` and the
  hex values its canvas actually draws with), plus one accent, usually a warm
  amber/yellow (`#ffb703`, `#ffd166`, `#ffcf5a`) or whatever the game already
  uses to mean "this one". A cream or near-white is fine for highlights.
- **Layers, back to front:** a three-stop diagonal `linearGradient` built
  from the game's `color` (`x1=0 y1=0 x2=1 y2=1`); a faint pattern at about
  0.07-0.15 opacity that hints at the game's world (tiles, waves, grass,
  stars, shoji); a soft `radialGradient` glow behind the subject; then the
  subject in bold flat shapes with one highlight and a soft dark ellipse
  shadow under anything that stands on the ground.
- **Subject:** draw what you actually see when playing (look at the game's
  draw code and a screenshot, not just its emoji): its own objects, its own
  colours, caught mid-action (a shot in the air, a puck with a trail). Keep
  it to two to four objects that read at 160 px wide.
- **Original only:** nothing that copies another product's logo, characters
  or signature look (e.g. Lexigrid deliberately avoids the green / yellow /
  grey tile scheme that genre is known for).
- **Check:** `node apps/arcade/scripts/card-art-check.mjs` from the repo root
  (rules above, every file used by exactly one game, every card shows its art
  or emoji in grid and list view at 360 and 1280 px, a game with no `art`
  still falls back to its emoji, combined size report).

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

## Dojo Duel notes

`games/dojo-duel/index.html` is the biggest single-file game here (a 1v1
fighter vs the CPU, landscape, fixed 60 Hz simulation on a 640x360 logical
canvas). It was built in seven small steps (see `BACKLOG.md`); every number
worth tuning is in one of the tables at the top of the script, so balance
changes should never need to touch the logic.

### The game at a glance

What a player sees, for anyone discussing or changing the game. Numbers
are the current values in the tables below; check those before quoting.

- **Premise:** you are KAI, fighting a CPU fighter in a dojo: REN on Easy
  and Hard, or one of four challengers. It plays in landscape only
  (portrait shows a rotate prompt and pauses).
- **Modes** (title screen picker, then one FIGHT! button): **Easy**,
  **Hard** (REN reacts faster, blocks more, and counters a spammed move),
  and **Practice** (a training dummy instead of REN; T cycles it between
  stand, block and low block). A second row picks a challenger, each with
  its own name, gi colour and intro line on the title screen:
  - **Rusher** (GORO, orange): presses in close and attacks a lot, blocks
    little.
  - **Turtle** (IWA, green): blocks almost everything, attacks rarely, and
    counters a repeated move for longer.
  - **Zoner** (SORA, purple): keeps its distance and spends its energy on
    fireballs, never on boosts.
  - **Sensei** (black and gold, the boss): Hard's reactions and counter
    state, plus more frequent and smarter power-ups (shields earlier).

  **Tournament** (first row, `TOURNAMENT` / `UPGRADES`): three fights in a
  row, GORO, then IWA or SORA (random; `?seed=N` repeats it), then the
  Sensei. One round wins each of the first two fights; the Sensei is best of
  3. After each won fight the player picks 1 of 3 random upgrades (longer
  Boost or Shield, cheaper Boost or Fireball, faster energy, +20 health, more
  energy at the start of each round). They last for the run, apply only to
  KAI and show as icons under KAI's name, with FIGHT n/3 under the clock.
  A loss ends the run (Knocked out), beating the Sensei makes you Champion;
  either way Play Again starts a fresh run. A run that reaches the Sensei
  takes about 2.5 minutes of game time; the most it can take is 5 rounds of
  60 s plus banners.
- **Arenas** (`ARENAS`): an Arena button under the opponent pickers cycles
  where you fight. Each recolours the dojo and changes one thing, for both
  fighters: 🏯 **Dojo** (the original, no change), 🧊 **Ice Dojo** (hits
  and blocks slide you about 3x as far), 🌙 **Moon Dojo** (low gravity:
  higher, floatier jumps) and ⛩️ **Temple** (energy refills 50% faster).
  Tournament puts each fight in a different random arena. Round 1's banner
  names the arena.
- **Match rules** (`ROUND`): best of 3 rounds with a 60 s clock. Knock the CPU
  out, or have more health when time runs out. A draw or double K.O.
  replays the round. Then a You win / You lose screen with Play Again and
  Change opponent.
- **Moves** (`MOVES`): Punch and Kick change with stance. Standing gives
  **Jab** and **Kick**, crouching gives **Low Jab** and **Sweep**, and in
  the air you get **Air Punch** and **Air Kick**.
- **Blocking:** hold back, or press Block. Crouch to block a Sweep and
  stand to block air attacks. Blocked hits still chip a little health.
- **Energy and power-ups** (`POWER`): a blue meter under each health bar.
  It starts each round at 35 of 100, refills about 2 a second plus 6 for
  each hit you land, and stops refilling while you block. It pays for
  six power-ups:
  - **Fireball** (40): a projectile that can be blocked.
  - **Boost** (40): 4 s of faster walking and quicker recovery.
  - **Shield** (60): soaks one hit, or lasts 2 s.
  - **Parry** (30): a brief stance (a 10-frame window after 2 frames).
    A hit in the window does nothing, stuns the attacker for 40 frames and
    refunds 15 energy; a parried fireball fizzles. Mistimed, it leaves you
    in an 18-frame recovery.
  - **Rage** (45): 4 s of dealing 1.4x damage and taking 1.3x.
  - **Dash strike** (25): a 10-frame wind-up, then an 80 px lunging punch
    (11 damage). It's -16 on block, so unsafe.

  The CPU plays by the same energy rules. REN (Easy, Hard) only uses the
  first three; the challengers use the new ones too (GORO dashes and rages,
  IWA and SORA parry, the Sensei uses all three).
- **Power loadout:** the player takes 3 of the 6 into a fight, picked under
  Powers on the title screen (next to the Arena button; default Fireball,
  Boost, Shield; remembered). Picking a fourth drops the oldest pick, and
  tapping a picked one swaps in the first unpicked one. Only
  those 3 show in the fight, on keys 1-3 in the order above. The CPU is
  unaffected and still has all six.
- **Controls:**
  - Touch: a left pad to move, jump and crouch; Punch, Kick, Block and
    Power buttons in the bottom-right corner; and the loadout's three power
    icons in a column beside them (key 1 at the bottom) to pick the
    power-up before pressing Power. Idle controls are outlines over a light
    fill and brighten while pressed; tap targets are 44 px or more. On touch
    only the fighters can't walk under the pad or buttons (the walls move
    in, at most 140 px a side).
  - The site-links pill and Get the guide link hide during a fight and
    come back on the title, pause, upgrade and result screens; the round
    back button always stays.
  - Keyboard: arrows or W A S D to move, J punch, K kick, L block, and 1 to
    3 for the loadout's power-ups.
  - Other keys: M mutes, H shows hitboxes, T sets the Practice dummy,
    Escape resumes.
  - The How to play panel opens on the first visit, and "?" brings it back.
- **Feel** (`FX`): hits freeze the action briefly (hitstop), flash the
  fighter white and stagger them. Kicks and K.O.s shake the screen. Comic
  POW! / WHAM! bursts appear on K.O.s and fireball hits.
- **History:** built in seven steps (1.56.0 to 1.63.0, PRs #54 onward),
  then the 1.64.0 fix that stops jab spam beating Hard, the four
  challengers in 1.68.0, Tournament mode in 1.69.0, Parry / Rage / Dash
  strike in 1.70.0, arenas in 1.71.0 and the touch declutter (power
  loadout, lighter controls, chrome hidden in a fight) in 1.72.0. Step by step in
  `BACKLOG.md`, player-facing notes in `changelog.html`.

### File layout (top to bottom)

- **CSS:** title / How to play / pause / result screens (they pad their
  bottom by `--chrome-overlap` so nothing sits under the shared bottom
  chrome; `CHROME_ROW`, 60 px), the in-fight top buttons, then the touch
  controls. `#controls` is fixed to the viewport and only shows in a fight,
  when the pill and guide link are hidden: the pad keeps a 54 px
  `--chrome-row` free for the back button under it, and the buttons on the
  right sit `--edge` (10 px) from the corner.
- **HTML:** `#rotateHint`, then `#wrap` (canvas, `#topBtns`, `#overlay`
  title screen with the "?" button and the `#loadout` picker, `#howto`, `#pause`, `#upgrade` (the
  tournament upgrade pick), `#result`), then
  `#controls` (pad, four action buttons, `#powers` holding the six icons;
  `setLoadout` keeps the loadout's three in the DOM).
- **Script, in order:** the tuning tables `POWER`, `AI_PRESETS`,
  `TOURNAMENT`, `UPGRADES`, arena
  constants, `MOVE`, `ARENAS`, `FX`, `ROUND`, `BOXES`, `MOVES`; then fighter update
  (`updateFighter`), energy and fireballs, hits (`applyHit`, `canBlock`),
  hit effects, input (keyboard maps, touch pad, buttons, loadout,
  `updateControls` and the touch-only `updateStage` walls), opponent modes,
  the seeded RNG, the CPU AI (`aiInput`), debug overlay, audio, layout
  (`fitCanvas`), drawing, then the game state, loop, pause and the
  `window.dojoDuel` test handle.

### The tables

- **`MOVES`** — frame data per attack: `startup` / `active` / `recovery`
  frames, `damage` / `chip`, `hitstun` / `blockstun`, `knock`, `height`
  (`mid`, `low` must be blocked crouching, `high` standing), `hitbox` in
  `BOXES` base units, and an opt-in comic `burst`. The fireball's row is
  built from `POWER.fireball`. A move is "+N on hit/block" by comparing the
  defender's stun with the attacker's remaining frames; that difference is
  what decides whether mashing it is safe.
- **`FX`** — hit feel only (hitstop per button, white flash, stagger pose,
  kick / KO screen shake, burst sizes, sparks, block slide). Nothing in it
  changes damage, stun or range.
- **`ROUND`** — best of 3, 60 s clock, banner lengths. Time-out goes to more
  health; a draw or double KO replays the round.
- **`POWER`** — the energy economy (`energy.start` fraction of `max`, `regen`
  per second, `onHit` bonus, no refill while blocking), each power-up's
  cost and numbers (`fireball`, `boost`, `shield`, `parry`, `rage`,
  `dash`), and `POWER.ai`, the rules for when the CPU reaches for one. Keep
  `shield.cost` above `energy.start * max`, or every round opens with a
  free shield. Parry and Dash strike are `MOVES` rows built from `POWER`
  (parry has no hitbox; its active frames are the window, see `parrying()`;
  dash has a `lunge`, px a frame through its active frames, and the threat
  ranges add the lunge). Rage scales landed damage through `rageMul()`.
  The new `POWER.ai` rules (`parryChance` / `parryLead`, `rageChance` /
  `rageRange` / `rageFinish`, `dashChance` / `dashMin` / `dashMax`) are
  off (chance 0) by default and only roll the RNG when on, so Easy and Hard
  play exactly as before; challengers turn them on in `powerAi`.
- **`AI_PRESETS`** — Easy / Hard (REN) and the challengers `rusher`,
  `turtle`, `zoner`, `sensei`, in the Air Hockey shape (delay + jitter +
  prediction, never a speed multiplier): `reactionFrames` (how old the
  CPU's view of the player is), `thinkInterval`, `error`, `blockChance`,
  `aggression`, `preferredRange`, `antiAirChance`, `powerUse`, and the
  counter state (`counterHits`, `counterWindow`, `counterFrames`,
  `counterBlock`, `counterSpace`, `counterPower`): once one move connects
  (hit or blocked) `counterHits` times within `counterWindow` seconds, as
  the CPU saw it, it spends `counterFrames` guarding more, backing off out
  of that move's reach and throwing a sweep (a kick against a sweep) timed
  for the player walking back in, with a shield when cornered or a
  fireball from range when energy allows. Easy has it off
  (`counterHits: 0`). A challenger row also carries `name`, `accent` (title
  screen), `colors` (gi), `intro`, and optionally `powerAi`, keys that
  replace `POWER.ai`'s for that opponent only (the Zoner never boosts; the
  Sensei shields at 40 health). Easy / Hard take REN's look from
  `REN_LOOK`. The CPU only
  sends the player's own inputs and pays the same energy costs. A reaction
  can only block an attack whose `startup` is at least `reactionFrames`
  (4 blocks the 4-frame jab, 5 can't; above 6 it can't react to sweeps).
- **`TOURNAMENT`** — the run: `fights` (each a `pool` of `AI_PRESETS` ids,
  one drawn per run with the run's seeded RNG, and `wins`, rounds needed),
  `choices` (upgrades offered after a win, never one already taken) and
  `pickDelayMs` (the cards ignore taps this long, so a punch mashed at the
  K.O. can't pick one).
- **`UPGRADES`** — each row's `mods` are summed into `player.mods` (the CPU
  keeps `NO_MODS`): `fireballCost` / `boostCost`, `boostFrames` /
  `shieldFrames`, `regen` (per second), `health` (max), `startEnergy`.
  `text` builds the card's line from `POWER`, so it stays right when POWER
  changes. Keep `energy.start * max + startEnergy` below `shield.cost`.
  The game reads costs, durations and health through `powerCost(f, id)`,
  `maxHealth(f)` and `f.mods`; `opponent` is the preset the CPU plays (the
  mode, or the current fight's) and `tour` the run (null outside it).

- **`ARENAS`** — `name`, `icon`, `tweak` (the short line on the Arena
  button and round banner), `mods` (any of `gravityMul`, `jumpVyMul`,
  `friction`, `regenMul`, merged over `ARENA_BASE` into `arenaMods` by
  `useArena`; physics reads `gravity()`, `arenaMods.*`), `palette` (the
  colours `drawArena` uses) and `decor` (`stars`, `shine` or none). No
  visual-only arenas: each new one needs a tweak.

### Testing and balance

- `?seed=N` fixes the AI's RNG, `?debug=1` (or H) shows boxes and state,
  `?touch=1` forces the touch controls. Keys 1-3 press `slot1`-`slot3`
  (the loadout); `press('power1')`..`('power6')` still name a power-up
  directly, which the balance harness uses, whatever the loadout.
  `dojoDuel.loadout` and `dojoDuel.stage` (the touch walls) are on the
  handle too. `window.dojoDuel` exposes the
  state, tables, `paused` + `step(n, keys)` for frame-stepping, `hold()` /
  `press()` for input, plus `pauseGame` / `resumeGame` and the audio
  context. Nothing in the game uses it.
- Balance is checked with `scripts/dojo-duel-balance.mjs` (run by hand,
  not wired into CI or lint):
  `node apps/arcade/scripts/dojo-duel-balance.mjs` from the repo root. It
  serves `apps/arcade` locally, loads the game in headless Chromium, sets
  `paused = true` and drives whole matches (seeds 1000-1059 by default)
  with scripted players through `hold` / `step`: one-move spammers (jab,
  kick, sweep mashed at their furthest reach about 10 times a second;
  fireball whenever affordable), a mid-skill bot (sees REN 14 frames late,
  blocks half) and a good bot (8 frames, blocks 80%). Options: `--rows`,
  `--matches`, `--first-seed`, and `--set hard.counterHits=5` (or
  `easy.*`, `rusher.*`, `sensei.powerAi.fireballRange=200`, `ai.*` for
  `POWER.ai`) to try a value without editing the game. Every bot has a row
  against each challenger (`jab-rusher` ... `good-sensei`); `--rows` takes
  `*` patterns such as `'*-sensei'` or `'good-*'`. Tournament rows
  (`good-tournament` etc.) play whole runs, picking a random upgrade after
  each win, and report runs won, how many won fight 1 and fight 2, and run
  length in game time. `window.dojoDuel` has `tour`, `opponent` and
  `pickUpgrade(i)` for this.
  Bots `dash`, `rage` (jab spam + rage) and `parry` (jab spam + mashed
  parry) cover the new powers; mid and good also punish a blocked move at
  -10 or worse (only the dash strike). `--powers` adds a column of what
  the CPU spent energy on per match and how many hits it parried.
  `--arena ice` plays the rows in that arena, and `--set ice.mods.friction=0.9`
  edits one. `?arena=moon` picks one in the page.
  60 matches a row is about +/-7 points of noise; check a change on a
  second seed range (`--first-seed 2000`) before trusting it.
- Balance targets (1.64.0, numbers in PR for that version): jab spam vs
  Hard 50% or less, kick / sweep / fireball spam lose to Hard, good bot vs
  Hard 15-35%, mid bot vs Easy above 90%. Jab spam still beats Easy, which
  has no counter state. Jab frame data was deliberately left alone.
  Challengers (1.68.0): jab / kick / sweep / fireball spam lose to Turtle,
  Zoner and Sensei, no challenger loses more than 50% to a single spammed
  move, good bot vs each 15-45%. Mid bot wins little against any of them
  (2-20%); they are meant to be harder than Easy.
  New powers (1.70.0): the same challenger targets hold, and dash, rage
  and parry spam lose to every opponent.
  Arenas (1.71.0): spam still loses everywhere. Ice makes REN and the
  challengers easier for the good bot (20-43%). Moon matches the Dojo,
  because neither the CPU nor the bots jump. Temple takes the good bot
  below 15% against Zoner and Sensei, because the bots never spend energy
  and the CPU does.
  Tournament (1.69.0) has no target yet. The good bot wins about 3-4% of
  runs, mostly because the single-round fights are a coin flip it often
  loses.

### Robustness

- Pause: a hidden tab (`visibilitychange`), `pagehide` (iOS lock / app
  switch) or turning to portrait pauses the fight, drops held touches and
  shows Resume (Escape also resumes). The loop doesn't tick while
  `suspended`, and resuming resets the frame clock so no time is skipped.
- Audio: iOS Safari only starts an AudioContext inside a gesture and
  suspends it again on lock or interruption, so every `touchend`, `click`
  and `keydown` creates or resumes it; the first time it plays a silent
  one-sample buffer to unlock older iOS.
- Multi-touch: the pad and each button capture their own pointer, so the
  pad, Punch / Kick / Block and the power icons work together.
- Storage: `sessionStorage` `dojoDuelDebug`, `dojoDuelMuted`;
  `localStorage` `dojoDuelHowtoSeen` (the How to play panel opens by itself
  until it's dismissed once) and `dojoDuelPowers` (the loadout, e.g.
  `fireball,boost,shield`; anything invalid falls back to the default).

## Mobile-first constraints learned the hard way

- Nothing that communicates "this is clickable" or "here's how you go
  back" may depend on `:hover` — touch devices never trigger it. Borders,
  glows, and badges on interactive elements must be visible at rest.
- Don't eyeball proportions from a description alone — a translucent bar
  can measure correctly in CSS pixels and still look broken because its
  background color nearly matches what's behind it. Prefer solid,
  high-contrast backgrounds plus an accent border for any chrome that
  needs to read clearly against a game canvas of unknown color.
