# Krishnabuilds Arcade — Status

Last updated: 2026-07-15, Fuseblock phases 1-4 complete (core loop, bot tiers +
levels, power-ups, polish) + played-count fix + changelog page

## Fuseblock fix-forward + phases 2-4 (2026-07-15, later in the day)
- Fix-forward pass on Phase 1 issues found in playtesting: d-pad hit zones
  grew from 28x28 to a ~62px effective tap area; root-caused (not just
  padded around) why up/down felt unreliable in fullscreen and in general -
  the four directional hit-zones overlapped each other and, tied on
  z-index, later-DOM-order zones (left/right) silently stole taps from
  up/down. Replaced all four with a single big hit-region that computes
  direction live from pointer position - no overlap possible, and a thumb
  can slide between directions without lifting. Also found and fixed the
  actual fullscreen bugs: `#wrap` (the fullscreen element) growing to fill
  the viewport had stopped coinciding with the canvas's own box once it did
  its own flex-centering, so every absolutely-positioned control silently
  drifted off the visible d-pad/bomb button; fixed by adding `#stage` as an
  inner wrapper that always exactly matches the canvas, with `#wrap` only
  responsible for growing/centering `#stage`. Separately, `fitCanvas()` was
  still reserving space for the nav bar/coffee-link even in fullscreen
  (where neither renders, being outside `#wrap`), so the canvas never
  visibly grew - fixed. Added a still-missing Phase 1 rule: player-bot cell
  overlap is now instant death either direction, matching blast contact.
  Added a lit/pressed glow on the d-pad and a flash on the bomb button so a
  tap's registration is never in doubt. Real Fullscreen API calls hang in
  this sandboxed headless environment, so fullscreen fixes were verified by
  simulating the exact `:fullscreen` CSS state and checking hit-zone
  alignment + canvas growth against it, not by driving the literal API.
- Phase 2: five bot tiers (Green/wander, Blue/+chase, Purple/+blast
  avoidance, Red/+bomb-placing+speed, Gold/+dodge-dash), each strictly the
  previous tier's behavior plus one new trait, no tier gets blast
  resistance or extra HP. Bombs gained an `owner` field (player or bot) so
  bombsActive credits back to whoever placed it. Roguelike level
  progression - bot count and tier mix ramp on a tunable weighted-pool
  formula rather than a hand-authored table, no fixed ending, runs until
  the player dies. Best level reached tracked in sessionStorage.
- Phase 3: power-ups (Bomb Up, Fire Up, Speed Boots, Kick, Remote
  Detonate) drop at a tunable 22% chance from destroyed blocks, never the
  door block, never a type already maxed. Remote Detonate adds a third
  control button, hidden until picked up, that fires all the player's own
  armed bombs at once.
- Phase 4 polish: distinct pickup jingle per power-up type instead of one
  shared sound; a subtle pitch drop on enemy-placed bombs and a whoosh on
  Gold's dash as light audio tells; screen shake on explosion (arena only -
  HUD stays legible) and particle debris on both block destruction and
  bomb blasts, on top of (not replacing) the Phase 1 crumble/expand/death
  animations; a proper glowing halo behind the bomb fuse spark instead of
  a flat dot; re-confirmed the fullscreen toggle still behaves correctly
  after all the above.
- Post-phase-4 tuning from live feedback: levels 1-2 only ever spawned 1
  bot (`botCountForLevel`'s floor was 1), which read as too sparse -
  bumped the floor to 2 so every level has at least a real threat, cap
  still 6 (now reached at level 9 instead of 11). Also clarified for
  Krishna that blocks currently only ever drop power-ups, never bots -
  bots spawning mid-level from a destroyed block is a different mechanic
  that isn't built and would need its own design pass (spawn safety,
  whether it can ambush the player right by a wall they just cleared).
  Separately, `BOT_SPAWN_CELLS` was ordered corner-by-corner (all 3 cells
  of one corner, then the next), so low bot counts clustered in a single
  corner instead of spreading out - 2 bots meant the same corner's first
  two cells. Reordered to interleave across the three non-player corners
  (each corner's primary cell first, then each corner's secondary, then
  tertiary) so N bots always claim N different corners before any corner
  doubles up. Verified with real coordinates, not just eyeballing it -
  first verification attempt used a sloppy corner-classifier in the test
  itself and produced a false negative.
- Every phase verified with headless Playwright rather than eyeballing it -
  forced state manipulation to isolate mechanics from the maze/RNG
  (multiple test bugs caught along the way, e.g. testing movement on an
  even grid row, which still has real pillars at every even column), plus
  full real-time simulations to catch anything a scripted shortcut would
  miss.
- Everything above is committed and pushed to `master`.

## This session (2026-07-15, earlier)
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
