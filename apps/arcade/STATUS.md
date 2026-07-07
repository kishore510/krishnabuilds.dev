# Krishnabuilds Arcade — Status

Last updated: 2026-07-07, Lane Racer hazard variety + fairness pass

## This session
- Redid Koala Climb from its original Doodle-Jump-style bounce mechanic into
  an auto-climbing lane-dodge game (branches approach left/right, tap the
  opposite side to dodge); added acorn bonus pickups and a height-driven
  day → windy → rain → night weather arc
- Found and fixed a canvas-redraw bug where old branches/obstacles never
  got cleared between frames, so sprites left visible trails instead of
  moving cleanly — the same root cause existed in Jungle Runner (missing a
  full-canvas repaint each frame) and got the same fix
- Diagnosed why Cloudflare Pages deploys stopped triggering on push:
  Cloudflare had auto-created a `cloudflare/workers-autoconfig` branch
  (a Workers Builds migration) with a `wrangler.jsonc` that needed merging
  into `master` before builds would resume
- Built Lane Racer from scratch: 3-lane fuel-managed racer, auto-accelerate
  + hold-to-brake, oil/traffic hazards, delta-time movement throughout
  (verified frame-rate independence via a headless bot simulation)
- Extended Lane Racer per feedback ("too easy, want more variety/pressure"):
  lane-changing traffic, pothole and roadblock hazard types, tighter
  pacing. This surfaced a real fairness bug — different hazard types close
  on the player at different speeds, so two hazards that looked safely
  spaced at spawn time could drift into blocking all 3 lanes by the time
  they reached the player. Fixed with a spawn-time check plus a continuous
  runtime backstop that guarantees a lane is never fully blocked; verified
  with 45+ simulated races afterward with zero fairness failures
- Not yet committed: `assets/version.js`, `games/lane-racer/index.html`
  (the traffic/pothole/roadblock hardening pass above — the initial Lane
  Racer build is already on `master`)

## Recent history (last 5 sessions, newest first)
- 2026-07-07: Koala Climb redo + weather arc; Jungle Runner redraw fix;
  Cloudflare Workers Builds migration fix; Lane Racer built, then hardened
  with lane-changing traffic, potholes, roadblocks, and a fairness backstop
- 2026-07-06: Added Air Hockey (puck physics + tunable AI), Burrow Bash
  (whack-a-mole), Jungle Runner (endless runner), the original Koala Climb,
  Turtle Trek (later replaced by Brick Breaker), Safari Rescue (lane-dodge
  rescue), Brick Breaker; assorted nav-bar/viewport/mobile fixes
- 2026-07-06: Initial commit — Fin Dash and the arcade shell (landing page,
  shared nav/embed script, versioning)

## Known open bugs
None currently open.

## Next up (top of backlog)
- Get Lane Racer's hazard-variety changes committed and pushed once
  reviewed in-browser
- Global "played N times" counter per game — needs a small Cloudflare
  Worker + KV/D1, since the site is otherwise fully static (discussed with
  Krishna, not yet started)
