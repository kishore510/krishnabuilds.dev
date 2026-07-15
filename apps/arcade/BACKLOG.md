# Krishnabuilds Arcade — Backlog

Simple ordered list, top = next. Items are `[ ]` pending or `[x]` done.

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
