# Krishnabuilds Arcade

A small games hub at `arcade.krishnabuilds.dev`: 36 quick browser games,
each one a single self-contained HTML file under `games/<slug>/`. Static
site, no build step. The only backend is a small Cloudflare Worker
(`src/worker.js`) for the "Played N times" counter.

**Maintainer guide:** [`CLAUDE.md`](CLAUDE.md) in this folder covers how to
add a game, the shared nav-bar/layout contract, card art, versioning, and
per-game notes. **Dojo Duel** (the biggest game) has its own section
there, "Dojo Duel notes", starting with what the game is to play.
History lives in [`BACKLOG.md`](BACKLOG.md) and [`changelog.html`](changelog.html).

## Games

The landing page is generated from the `GAMES` array in `index.html`; that
array is the source of truth. As of 1.67.0, by category, oldest first:

**Arcade** (14)

- **Fin Dash** (`games/fin-dash/`, 2026-07-06): Swim a fish through coral, rock, and kelp. Easy or Hard.
- **Burrow Bash** (`games/burrow-bash/`, 2026-07-06): Whack the moles before they duck back down. Easy or Hard.
- **Jungle Runner** (`games/jungle-runner/`, 2026-07-06): Jump logs, gaps, and vines as the pace ramps up. Easy or Hard.
- **Koala Climb** (`games/koala-climb/`, 2026-07-06): Auto-climbing koala — dodge branches, grab acorns for bonus points. Easy or Hard.
- **Brick Breaker** (`games/brick-breaker/`, 2026-07-06): Clear every brick with a paddle and ball. 3 lives. Easy or Hard.
- **Safari Rescue** (`games/safari-rescue/`, 2026-07-06): Switch lanes to dodge rocks and rescue 10 stranded animals in time. Easy or Hard.
- **Garden Snake** (`games/garden-snake/`, 2026-07-08): Glide a caterpillar around the allotment, munching leaves. Easy or Hard.
- **Crate Stack** (`games/crate-stack/`, 2026-07-08): Time each drop to keep the tower aligned as it climbs. Easy or Hard.
- **Star Salvo** (`games/star-salvo/`, 2026-07-11): Waves of divers sweep in from the stars. Easy or Hard.
- **Fuseblock** (`games/fuseblock/`, 2026-07-15): Plant bombs, crack the arena open, dodge your own blast, find the door.
- **Chomp Alley** (`games/chomp-alley/`, 2026-07-15): Gobble every pellet while Ember hunts you through the maze.
- **Drumfront** (`games/drumfront/`, 2026-07-17): Tap two drums in rhythm to command your squad's Attack.
- **Slice Master** (`games/slice-master/`, 2026-09-13): Tap to keep the knife airborne, slice fruit, then gamble it on the multiplier tower.
- **Dojo Duel** (`games/dojo-duel/`, 2026-11-05): Beat REN in a best-of-3 dojo duel: punch, kick, block and throw fireballs.

**Racing** (2)

- **Lane Racer** (`games/lane-racer/`, 2026-07-07): Race the clock, manage your fuel, brake before the oil. Easy or Hard.
- **Regatta** (`games/regatta/`, 2026-07-11): Ride the drift through a buoy course. Easy or Hard, 3 courses.

**Puzzle** (11)

- **Veg Merge** (`games/veg-merge/`, 2026-07-08): Slide and merge veg from seed to giant pumpkin, 2048-style.
- **Slide** (`games/slide/`, 2026-07-11): Classic sliding tile puzzle — numbers or a picture. 3×3 to 5×5.
- **Shard Rush** (`games/shard-rush/`, 2026-07-19): Swap faceted shards to chain matches — cascades keep climbing until the board runs dry.
- **Mosaica** (`games/mosaica/`, 2026-07-26): Stack, rotate, and clear before the kiln overflows.
- **Comet Watch** (`games/comet-watch/`, 2026-07-30): Clear the night sky, one patch at a time.
- **Solitaire** (`games/solitaire/`, 2026-07-30): Classic Klondike, one card at a time.
- **Sudoku** (`games/sudoku/`, 2026-07-31): Classic number logic, one grid at a time.
- **Inkgrid** (`games/inkgrid/`, 2026-07-31): Fill the grid, reveal the picture.
- **Word Search** (`games/word-search/`, 2026-08-01): Find every word, one sweep at a time.
- **Lexigrid** (`games/lexigrid/`, 2026-08-03): One word a day. Six guesses to find it.
- **Word Circle** (`games/word-circle/`, 2026-08-04): Swipe the circle, spell every word.

**Strategy** (5)

- **Plot Defender** (`games/plot-defender/`, 2026-07-09): Place, match, and upgrade defences to hold the veg patch through 10 waves. Easy or Hard.
- **Losing the Plot** (`games/losing-the-plot/`, 2026-07-11): Grow it, sell it, restock — run a real farm economy. Easy or Hard.
- **Trebuchet** (`games/trebuchet/`, 2026-07-11): Archers, cannons, catapults and trebuchets — build the right defence for each threat.
- **Salvo** (`games/salvo/`, 2026-07-11): Freely rearrange your fleet, then the enemy board takes over the screen. A CPU that actually targets back.
- **Castle Hold** (`games/castle-hold/`, 2026-07-12): A siege you never leave the walls for. Place archers, hold the gate, don’t let a single enemy through.

**Sports** (3)

- **Air Hockey** (`games/air-hockey/`, 2026-07-06): Best of 7 against the CPU. Easy or Hard.
- **Hoops** (`games/hoops/`, 2026-07-11): Flick to shoot real arc physics — nail the angle and power as the hoop starts drifting.
- **Tennis** (`games/tennis/`, 2026-11-08): Landscape, full screen. Run with the left thumb, swipe with the right to hit (topspin, flat, lob, drop, curveball). World Tour of seven opponents on hard, clay and grass, quick matches, and a ball-machine practice mode.

**Trivia** (1)

- **Globe Quiz** (`games/globe-quiz/`, 2026-07-07): Capitals or flags — 15 quick questions, 10 seconds each.

## Structure

```
index.html              — landing page; one "cartridge" card per GAMES entry
games/<slug>/index.html — one self-contained file per game
assets/game-embed.js    — shared chrome every game page includes (nav bar, guide link, play ping)
assets/site-links.js    — link home + app switcher
assets/version.js       — the displayed version string
assets/art/<slug>.svg   — each game's card picture (rules in CLAUDE.md, "Card art")
assets/kb-tokens.css    — committed copy of the shared @krishnabuilds/tokens CSS; `pnpm lint` fails if it drifts
scripts/                — hand-run checks: card-art-check.mjs, dojo-duel-balance.mjs; tennis.test.js (node:test, run in CI)
src/worker.js           — play-count API + static-asset serving
wrangler.jsonc          — Cloudflare Worker config (deployed from GitHub Actions)
```

## Adding a new game

Follow "Adding a new game" in [`CLAUDE.md`](CLAUDE.md). It has the exact
embed script tag and support-link URL to copy, the `data-kb-play` attribute
the play counter needs, and the GAMES entry fields.

## Shipping

Arcade lives in the krishnabuilds.dev monorepo and follows the root
`CLAUDE.md`: work on a branch, open a PR, squash merge. Deploys run from
GitHub Actions on merge to `main`.

## Play-count counter

Each game's start button carries `data-kb-play`; `assets/game-embed.js`
sends `POST /api/play/<slug>` when it is clicked, and the landing page reads
`GET /api/plays` to show "Played N times" on each card and power the
Popular sort. Both routes are in `src/worker.js`, backed by the
`PLAY_COUNTS` KV namespace (wired up in July 2026) and a per-IP rate limit.
If the API is unreachable the landing page simply shows no counts.
