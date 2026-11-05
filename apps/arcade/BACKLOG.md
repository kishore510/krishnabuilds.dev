# Krishnabuilds Arcade — Backlog

Simple ordered list, top = next. Items are `[ ]` pending or `[x]` done.

- [ ] Dojo Duel, built in small steps, one PR each:
  - [x] Step 1: arena and movement
  - [x] Step 2: attacks, blocking, health bars, training dummy
  - [x] Step 3: hit feel (hitstop, white flash and stagger pose, POW!/WHAM!
        bursts and sparks, kick screen shake, hit/block/whiff sounds; all
        values in the `FX` table). Moved ahead of rounds and the CPU AI
  - [x] Step 4: rounds (best of 3, 60 s clock, Round / Fight! / K.O. /
        Time! banners, win markers, result screen with Play Again; time-out
        goes to more health, a draw or double K.O. replays the round; values
        in the `ROUND` table). Normal hits no longer show a burst: `burst`
        is now opt-in per move in `MOVES`, and the KO blow gets a big WHAM!
  - [x] Step 5: a CPU that fights back. Easy / Hard on the start screen
        (default Easy), tuned in `AI_PRESETS` (reactionFrames, thinkInterval,
        error, blockChance, aggression, preferredRange, antiAirChance; Air
        Hockey's delay + jitter + prediction shape). It sees the player's
        visible state reactionFrames late, never inputs, and only uses the
        player's inputs: approach, poke, block by holding back (crouching for
        lows), punish whiffs, anti-air jab, back off after a hit. Seedable
        RNG (`?seed=N`), decision and reaction timer on the debug overlay.
        The dummy is now Practice mode
  - [ ] Power moves (1 2 3 and the Power button); set `burst: 'WHAM!'`
        (or another word) on their `MOVES` entries to show a comic burst

- [ ] Plot Defender tuning pass — play it for real (each of the 4 maps),
      adjust wave/economy numbers based on actual feel now that maps,
      upgrades, and the rebalance are all in
- [x] Play-count KV namespace wired up (2026-07-09) — worker, client
      ping, and landing-page display are all live now
- [ ] Consider extracting Fuseblock's fullscreen-toggle pattern into a shared
      `assets/` helper. Built clean for `games/fuseblock/index.html` Phase 1
      (2026-07-15): a small always-visible corner button that calls
      `el.requestFullscreen()` (feature-detected, hides itself if
      unsupported), a distinct minimal exit button shown only while
      `document.fullscreenElement` is set, and a `fullscreenchange` listener
      that toggles both plus re-runs `fitCanvas()`. Unlike Castle Hold's
      `data-fullscreen="landscape"` mode in `game-embed.js`, it doesn't hide
      the navbar permanently or lock orientation — just a portrait-friendly
      "make the game bigger" toggle. Worth pulling into `assets/` if a third
      game wants this same shape; two data points (Castle Hold's landscape
      lock vs. Fuseblock's plain toggle) isn't quite enough yet to know the
      right shared API.
