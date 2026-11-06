# Krishnabuilds Arcade — Backlog

Simple ordered list, top = next. Items are `[ ]` pending or `[x]` done.

- [x] Dojo Duel, built in small steps, one PR each (notes for maintainers in
      CLAUDE.md, "Dojo Duel notes"):
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
        The dummy is now Practice mode. Fix (1.60.1): holding back against
        an incoming attack stands in guard instead of walking away (the
        "kick did nothing" bug), raised-fist hurtbox, Easy range 115 -> 100
  - [x] Step 6: energy and power-ups. An energy meter under each health
        bar (starts each round at `POWER.energy.start` of full, refills
        slowly, faster on a landed hit, not while blocking). Fireball (1):
        a projectile with its own hitbox on the debug overlay, blockable,
        gone on contact, one on screen per fighter, `burst: 'POW!'`. Speed
        boost (2): faster walk and shorter attack recovery for a few
        seconds. Shield (3): soaks one unblocked hit or expires. Touch: three
        44 px icons beside Power (tap to select, Power fires; selected is
        highlighted, unaffordable dims). Not enough energy: "NO ENERGY"
        flash on the meter and a dull click, nothing else. The CPU uses
        them under the same energy rules and reaction delay, gated by
        `AI_PRESETS.powerUse` (Easy rarely; Hard: shield when low, fireball
        at range, boost to press in, rules in `POWER.ai`). Synth sounds,
        boost glow and shield bubble. Every value is in the `POWER` table.
        Fix (1.61.1): on short phones the bottom chrome (site-links pill,
        back button, guide link) covered Start and the start screen
        couldn't scroll past it; start/result screens now pad above it
        (`--chrome-overlap`, set in fitCanvas) and scroll from the top,
        Start moved above the controls legend, top buttons only in a fight.
        Title screen (1.62.0): DOJO DUEL logo, KAI vs REN, mode picker and a
        pulsing FIGHT! button over a vignette so the fighters show; the
        controls legend moved to a How to play panel (Got it / Escape)
  - [x] Step 7 (1.63.0): tuning and polish, no new features. Honest landing
        card (tagline, tags). How to play: short Touch / Keyboard table,
        opens by itself on the first visit, "?" in the title screen's top
        right brings it back. Seeded balance harness: the shield was too
        cheap (35 = the round's starting energy) and decided matches for
        both sides, and boost made a mashed jab safe; POWER retuned (shield
        60 / 2 s, boost 40 / recovery x0.75, regen 2/s, CPU shields at 25
        health). AI_PRESETS unchanged. Pause on hidden tab / lock / portrait,
        audio resumed on every gesture for iOS, refit after rotation,
        multi-touch and no-:hover checked
- [x] Dojo Duel follow-up (1.64.0): holding jab in range beat Easy every
      time and Hard ~9 in 10 (jab is about even on block and chips 1; REN's
      kick and sweep pokes lose to it). Fixed in REN's move choice, jab frame
      data untouched: a counter state (`AI_PRESETS` `counter*`) starts after
      4 connects from one move in 2.5 s (as REN saw them, reactionFrames
      late), guards more, backs off out of the move's reach and sweeps the
      walk back in, with shield / fireball when energy allows. Hard's
      thinkInterval 10 -> 14 to keep it beatable. Easy has no counter state
      (jab spam still beats Easy). Harness committed as
      `scripts/dojo-duel-balance.mjs`; numbers in the PR
- [ ] Dojo Duel: less repetition, four small PRs in order
  - [x] PR 1 (1.68.0): four challengers as new `AI_PRESETS` rows, each with
        a name, gi colours, title-screen accent and intro line: Rusher (GORO:
        aggressive, short range, low block), Turtle (IWA: blocks 90%, long
        counter state, patient), Zoner (SORA: keeps 230 px away, fireballs
        only), Sensei (Hard's counter state, more and smarter power-ups). A
        preset's optional `powerAi` overrides `POWER.ai` for that opponent.
        Second picker row on the title screen; Easy / Hard / Practice
        unchanged (REN). Balance harness covers every bot against each
        (`--rows '*-sensei'`, nested `--set sensei.powerAi.x=`); numbers in
        the PR
  - [x] PR 2 (1.69.0): Tournament mode. `TOURNAMENT` table (three fights:
        rusher, turtle or zoner, sensei; 1 / 1 / 2 rounds to win) and
        `UPGRADES` table (seven player-only upgrades summed into
        `player.mods`: costs, durations, regen, health, start energy). Pick 1
        of 3 after each won fight (cards ignore taps for 0.7 s), icons under
        KAI's name and FIGHT n/3 under the clock. ?seed=N repeats the
        opponent draw and the offers. Harness rows `*-tournament`
        (runs won, how far, run length); numbers in the PR
  - [x] PR 3 (1.70.0): Parry (30: 2-frame start, 10-frame window, 18
        recovery; a parried hit stuns the attacker 40 frames, refunds 15,
        fizzles a fireball), Rage (45: 4 s, deal x1.4, take x1.3), Dash
        strike (25: 10-frame wind-up, 80 px lunge on its 8 active frames,
        -16 on block). Keys 4-6 and a second column of touch icons. CPU
        rules in `POWER.ai` (`parryChance` / `parryLead`, `rageChance` /
        `rageRange` / `rageFinish`, `dashChance` / `dashMin` / `dashMax`),
        all off by default so Easy / Hard are unchanged; challengers turn
        them on in `powerAi`. Sensei `dashChance` tuned to 0.2. Lunging moves
        count their lunge in the threat ranges. Harness: dash / rage / parry
        spam bots, `--powers`, bots punish blocked moves at -10 or worse
        (only the dash strike); numbers in the PR
  - [x] PR 4 (1.71.0): `ARENAS` table, a palette (and small decor) plus
        one gameplay tweak each, through `arenaMods`: Ice (`friction` 0.94:
        knockback slides about 3x as far), Moon (gravity x0.65, jump speed
        x0.85: peak 131 px vs 117, 54 frames in the air vs 41), Temple
        (energy regen x1.5). The Dojo is unchanged. Title-screen Arena
        button cycles them (`?arena=ice`); Tournament draws one per fight,
        no repeats. Sliding on after a walk was tried for Ice and dropped
        (it handed the Rusher its walk-ins). Harness `--arena`; numbers in
        the PR

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
