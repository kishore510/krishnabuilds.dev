# Krishnabuilds Arcade — Status

Last updated: 2026-07-15, Fuseblock phase 1 + played-count fix + changelog page

## This session (2026-07-15)
- Built Fuseblock phase 1: a bomb-arena grid game (11x13 alternating-pillar
  arena, discrete d-pad movement, single bomb with expanding-blast animation
  that destroys soft blocks and kills on contact including self, one
  random-wander bot, hidden exit door, procedural audio, sessionStorage best
  time, and a from-scratch fullscreen toggle built clean rather than reusing
  Castle Hold's landscape-locked mode — flagged in BACKLOG.md as a candidate
  for a shared `assets/` helper once a third game wants the same shape).
  Verified with a headless Playwright session (movement, bomb fuse/pulse,
  blast expansion, block crumble, self-kill, win/lose overlays, touch d-pad,
  mute, fullscreen) rather than just eyeballing it; caught and fixed two real
  bugs that way (board rendering before the grid existed on first frame, and
  the fullscreen button visually overlapping the on-canvas timer text).
  Stopping after phase 1 per the build brief for playtesting.
- Fixed played-count undercounting: the only ping was a fire-once-per-page-
  load call, which missed every replay because every game reuses the same
  Start button (relabelled "Play Again"/"Retry") instead of reloading the
  page. Replaced it with a delegated click listener in `game-embed.js` that
  pings on any `[data-kb-play]` element; added that attribute to the actual
  play-triggering button(s) in all 22 games (careful to pick the right one
  where a game has more than one candidate button, e.g. Salvo's
  `startBattleBtn` vs. its setup-phase `startBtn`, Globe Quiz's category
  buttons + `playAgainBtn`). Documented the convention in CLAUDE.md's
  "Adding a new game" steps so it isn't dropped on the next game. Verified
  with Playwright that a page load alone fires zero pings and each Start/
  Play Again click fires exactly one.
- Added `changelog.html`, a lightweight player-facing changelog (new games
  + major fixes per session, not commit-level detail), linked from the
  landing page footer next to the version tag.
- Added Fuseblock to the landing page `GAMES` array (brief had this as a
  Phase 4 item, but moved it up at Krishna's request for easier testing).

## Previous session (2026-07-09)
- Fixed Crate Stack's HUD/overlay text losing contrast against its pale
  sky-gradient background (the score was rendering directly under the mute
  button, and popups/streak text had no backdrop) — gave it a solid HUD
  bar, a solid overlay panel, and pill-backed in-play text, matching the
  contrast pattern already used elsewhere in the arcade
- Built Plot Defender, an allotment tower-defence, from scratch across 5
  scoped phases, each committed independently:
  1. Path following + lives
  2. Compost economy + first defence (Scarecrow) with range/targeting
  3. Wave system (10 scripted waves) + win/lose + scoring
  4. Pest variety (rabbit/bird/slug) + defence variety (Beer Trap,
     Netting, Spray) with a type-effectiveness table
  5. Defence upgrades (tap to open a panel, spend compost for more
     damage/range), juice (hit sparks, death particles, wave-clear
     confetti, full audio set), Easy/Hard presets, arcade integration
- Rebalanced twice against real playtesting feedback: first because
  Scarecrow was a safe do-everything default (now has a real weakness
  vs. slugs), then again because a static 2-scarecrow/2-beer-trap
  loadout was clearing wave 6 undamaged (steepened the pest hp/volume
  ramp, scaled defence costs up per wave) — verified via a scripted
  before/after playtest reproducing the exact reported loadout
- Added a colourful painted "Krish's Allotment" signpost and ripe veg at
  the goal, and made the veg patch visibly wilt/crack/flash as lives are
  lost instead of that damage only living in the HUD counter
- Added three-layer onboarding: contextual first-play hints that advance
  on player action rather than a fixed timer script, a dismissible
  4-callout welcome overlay, and an always-available Help panel (pauses
  the game, shows a live-generated type-effectiveness table, has "Show
  tutorial again")
- Refactored the single hardcoded path into a map registry and added 3
  new maps alongside the original Allotment — Marshlands (tight
  serpentine, favours area/splash defences), Orchard Grove (long
  straight runs, favours single-target range/damage), and Twin Paths
  (two simultaneous lanes from separate entries) — plus a map picker on
  the ready/game-over screen with a live background preview
- Built the "played N times" per-game counter from the backlog: this
  repo already deploys as a Cloudflare Worker with static assets (not
  classic Pages, per the Workers Builds migration on 2026-07-07), so
  added `src/worker.js` handling `GET /api/plays` and
  `POST /api/play/<slug>` against one KV key holding all counts as a
  JSON blob, a fire-and-forget ping from `game-embed.js` on every game
  load, and a display line on each landing-page card. Verified the
  worker logic with a mock-KV unit test (increment/read-all/invalid-
  route-falls-through-to-assets) since `wrangler dev` isn't usable in
  this sandbox (no network to install it), and verified the site still
  loads with zero console errors and no visible counts when the API
  route 404s (plain static serving, before the KV namespace existed) —
  graceful no-op is the deliberate fallback. Krishna created the
  `PLAY_COUNTS` KV namespace and pasted the real id into
  `wrangler.jsonc` (the one step needing real Cloudflare auth, which
  this sandbox doesn't have) — live as of the next Workers Build
- Added `published` dates (backfilled from git history) to every game,
  a Newest/Popular sort toggle on the landing page (Popular reads the
  same `/api/plays` counts, falls back to original order until counts
  exist), a formatted "Published <date>" line on every card, and a
  same-day "NEW" badge
- Everything above is committed and pushed to `master`

## Recent history (last 6 sessions, newest first)
- 2026-07-15: Fuseblock phase 1 (bomb-arena grid game); fixed played-count
  to ping on every replay instead of only the first page load; added
  `changelog.html`; added Fuseblock to the landing page early at Krishna's
  request
- 2026-07-11 to 2026-07-14: Added 7 games in one stretch (Slide, Regatta,
  Losing the Plot, Trebuchet, Hoops, Salvo, Star Salvo), then Castle Hold
  built end-to-end (4 phases: core hold loop, tiers/melee, waves/matchups,
  upgrades/onboarding) with several animation and balance passes; added
  category filter tiles to the landing page; multiple bugfix rounds across
  Hoops/Trebuchet/Salvo/Losing the Plot after playtesting (this range
  wasn't logged in detail here at the time - see `git log` for the full
  commit-level record)
- 2026-07-09: Plot Defender built end-to-end (5 phases, two rebalance
  passes, onboarding, 3 new maps); Crate Stack contrast fix; play-count
  worker built (pending KV namespace creation)
- 2026-07-08: Added Garden Snake (caterpillar/snake), Veg Merge
  (2048-style, allotment veg tiers), Crate Stack (tower-stacking timing
  game)
- 2026-07-07: Added Globe Quiz (capitals/flags trivia); Koala Climb redo
  + weather arc; Jungle Runner redraw fix; Cloudflare Workers Builds
  migration fix; Lane Racer built, then hardened with lane-changing
  traffic, potholes, roadblocks, and a fairness backstop
- 2026-07-06: Added Air Hockey (puck physics + tunable AI), Burrow Bash
  (whack-a-mole), Jungle Runner (endless runner), the original Koala
  Climb, Turtle Trek (later replaced by Brick Breaker), Safari Rescue
  (lane-dodge rescue), Brick Breaker; assorted nav-bar/viewport/mobile
  fixes
- 2026-07-06: Initial commit — Fin Dash and the arcade shell (landing
  page, shared nav/embed script, versioning)

## Known open bugs
None currently open.

## Next up (top of backlog)
- Plot Defender tuning pass: play it for real (ideally across each of
  the 4 maps) and adjust wave/economy numbers based on how it actually
  feels, now that maps + upgrades + the rebalance are all in
