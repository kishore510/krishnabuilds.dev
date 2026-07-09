# Krishnabuilds Arcade — Backlog

Simple ordered list, top = next. Items are `[ ]` pending or `[x]` done.

- [ ] Blocked on Krishna: create the `PLAY_COUNTS` KV namespace
      (`npx wrangler kv namespace create PLAY_COUNTS`) and paste its id
      into `wrangler.jsonc` — the play-count worker (`src/worker.js`),
      the client-side ping, and the landing-page display are all built
      and pushed, just wired to a placeholder KV id until this runs
- [ ] Plot Defender tuning pass — play it for real (each of the 4 maps),
      adjust wave/economy numbers based on actual feel now that maps,
      upgrades, and the rebalance are all in
