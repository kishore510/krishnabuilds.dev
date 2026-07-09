# Krishnabuilds Arcade — Status

Last updated: 2026-07-09, Plot Defender built end-to-end (phases 1-5, onboarding, maps) + play-count worker

## This session (2026-07-09)
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
