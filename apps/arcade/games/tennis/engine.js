// Tennis engine: pure game logic, no DOM. Loaded by index.html as a plain
// script (sets window.TennisEngine) and by Node tests via require().
//
// Units: the simulation runs in metres and seconds on a real court.
//   X = across the court, 0 at the centre line, + to the right as seen
//       by the near player.
//   Y = along the court, 0 at the far baseline, COURT.length at the near one.
//   H = height of the ball's centre above the ground.
// toWorld() converts to the drawing coordinates x in [-1,1] (doubles
// sidelines), z in [0,1] (far to near baseline) and h (scaled height).
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------
  // CONFIG: every tuning number lives here. Change pace via the shots.
  // ---------------------------------------------------------------------
  const CONFIG = {
    dt: 1 / 120,              // fixed physics step (s)
    gravity: 9.81,            // m/s^2
    drag: 0.0125,             // quadratic drag: a = drag * |v| * v
    magnus: 0.0011,           // lift: a = magnus * spin * |v|, at right angles to v
    spinDecay: 0.15,          // spin lost per second (fraction)
    restitution: 0.82,        // vertical bounce: vz' = -e * vz (lively, so the ball stays playable longer)
    friction: 0.6,            // court grip during the bounce (sliding friction)
    spinInertia: 0.55,        // I = k m r^2 for a tennis ball
    ballRadius: 0.033,        // m
    netStopKeep: 0.12,        // speed kept when the ball runs into the net
    netClipKeep: 0.4,         // horizontal speed kept when it clips the tape (net cords drop short)
    netClipPop: 0.8,          // upward speed added by a tape clip (m/s)
    contactHeight: 1.0,       // where shots are struck (m)
    nearContactY: 22.1,       // hitter positions (m from far baseline)
    farContactY: 1.66,
    hScale: 0.46,             // metres -> drawing height units (net is 0.42)

    // Shot types. speed in m/s, spin in rad/s (+ topspin, - backspin),
    // angle range (degrees) the aim solver searches, depth = metres short
    // of the opposite baseline the shot lands. Pace comes from speed:
    // defaults cross baseline-to-baseline contact in about 0.80s (flat),
    // 0.95s (topspin) and 1.5s (lob). Keep each angle range on one side of
    // the shot's maximum-range angle so the solver's bisection works.
    shots: {
      flat: { name: 'FLAT DRIVE', speed: 30, spin: 40, angles: [-2, 12], depth: 3.0 },
      top:  { name: 'TOPSPIN',    speed: 26, spin: 260, angles: [0, 20], depth: 3.5 },
      lob:  { name: 'LOB',        speed: 17.5, spin: -40, angles: [12, 30], depth: 2.5 },
      // Drop shot: soft, heavy backspin, lands just past the net (depth =
      // net - 2.5 m). Its speed scales with the distance to the target,
      // as sqrt(distance / speedRef) within speedClamp, so it lands short
      // from anywhere. grip multiplies the court's bounce friction, so the
      // backspin checks the ball up instead of kicking on.
      drop: { name: 'DROP', speed: 12.5, spin: -300, angles: [0, 32], depth: 23.77 / 2 - 2.5,
        speedRef: 12.5, speedClamp: [0.7, 1.25], grip: 2.2 },
      // Overhead smash (any button, high ball near the net): fast, steep
      // downward launch, deep target.
      smash: { name: 'SMASH', speed: 34, spin: 30, angles: [-28, 4], depth: 4.5 },
      // Serves (Stage 3), struck from about 2.7 m. Flat: fast and low over
      // the net. Kick: slower, heavy topspin, higher over the net and up
      // off the bounce.
      serveFlat: { name: 'FLAT SERVE', speed: 44, spin: 30, angles: [-12, 6] },
      serveKick: { name: 'KICK SERVE', speed: 33, spin: 320, angles: [-6, 16] },
    },

    machine: {
      aimWidth: 0.7,          // fraction of the singles half-width it aims within
      missChance: 0.15,       // chance a shot is deliberately long, wide or into the net
      restartDelay: 1.1,      // pause after a dead ball (s)
      firstDelay: 0.6,
    },

    // --- Practice mode (Stage 2) ------------------------------------------
    // The near player. Positions in metres (see Units above), speeds in m/s,
    // accel/decel in m/s^2. Stick y up (-1) moves towards the net.
    player: {
      startX: 0, startY: 24.2,  // 0.4 m behind the baseline
      minX: -4.9, maxX: 4.9,    // just outside the singles sidelines (4.115)
      netGap: 1.0,              // closest the player gets to the net (m)
      maxY: 25.3,               // furthest back (1.5 m behind the baseline)
      speedX: 7.5, speedY: 5.5,
      accel: 34,                // speeding up
      decel: 45,                // stopping or turning (stick released or reversed)
      deadzone: 0.15,           // stick magnitude (or one axis, for assist) below this is idle
      swingMove: 0.3,           // movement scale during backswing and follow-through
    },

    // Swing timing (s), from the prototype's keyframes (tau -0.16, 0, 0.18,
    // 0.6). Contact is `backswing` seconds after the swing starts. A late
    // tap shortens the backswing, down to minBackswing (see timing).
    // Presets override these per shot (drop) or stroke (volley, smash).
    swing: {
      backswing: 0.16, minBackswing: 0.07, follow: 0.18, recovery: 0.42,
      drop: { backswing: 0.12, minBackswing: 0.06, follow: 0.12, recovery: 0.36 },
      volley: { backswing: 0.07, minBackswing: 0.04, follow: 0.10, recovery: 0.25 },
      smash: { backswing: 0.14, minBackswing: 0.07, follow: 0.20, recovery: 0.40 },
    },

    // Court zones by the player's distance to the net (m): NET within
    // `net`, BACK from `back` (1.5 m inside the baseline) back, MID between.
    // Volleys and smashes are only played from MID and NET.
    zones: { net: 3.0, back: 10.4 },

    // Tap timing, in ms from the ideal tap (the ball reaches the contact
    // plane `backswing` later). Early taps inside buffer + earlyGrace are
    // queued and fire at the ideal moment; late taps shorten the backswing so
    // contact still lands on time up to (backswing - minBackswing) late.
    // Outside earlyGrace / lateGrace the swing misses (TOO EARLY / LATE).
    // earlyQ / lateQ map |error| (ms) to a timing score, linearly between rows.
    timing: {
      perfectMs: 35,
      bufferMs: 150, earlyGraceMs: 30,
      goodMs: 90, poorMs: 170, lateGraceMs: 30,
      earlyQ: [[35, 0.8], [150, 0.8], [180, 0.35]],
      lateQ: [[35, 0.95], [90, 0.7], [170, 0.3], [200, 0.05]],
      earlyPull: 0.3,           // sideways pull (fraction of maxPull) in the early grace
      inputLagMs: 0,            // subtracted from every tap (display / touch lag)
      // The ball arrives faster at the net, so volley windows are wider in ms.
      volley: {
        perfectMs: 40, goodMs: 100, poorMs: 180, lateGraceMs: 30,
        earlyQ: [[40, 0.8], [150, 0.8], [180, 0.35]],
        lateQ: [[40, 0.95], [100, 0.7], [180, 0.3], [210, 0.05]],
      },
      smash: {},
      // Swipe play (a swing asked for with opts.touch): a swipe made any
      // time the ball is on its way is held and fires at the ideal moment,
      // so it never misses for being early; the closer its release to the
      // ideal moment the better the shot. Late swipes are judged as taps.
      // A swiped shot lands scatter metres (standard deviation) from its
      // target: base + poor * (1 - quality), times the shot's own factor;
      // nothing on a Perfect. So a mistimed flat drive at the lines goes
      // out, and a mistimed topspin to the middle stays in.
      touch: {
        perfectMs: 70, bufferMs: 4000, earlyGraceMs: 0,
        goodMs: 130, poorMs: 210, lateGraceMs: 40,
        earlyQ: [[70, 0.9], [220, 0.74], [500, 0.55], [1100, 0.42]],
        lateQ: [[70, 0.92], [130, 0.68], [210, 0.35], [250, 0.1]],
        scatter: { base: 0.3, poor: 2.0, flat: 1.5, top: 1, lob: 1.2, drop: 0.5, smash: 1.2 },
      },
    },

    // Swipe gestures (classifySwipe). Distances in CSS px, speeds in px/ms,
    // measured over the last `window` ms before the finger lifts.
    //   up, slow      lob            up, medium   topspin
    //   up, fast      flat drive     down         drop shot
    //   a bent path   the ball curves in the air (flat, topspin, serves)
    // The swipe's direction aims left/right (aimAngle degrees = the
    // sideline); its length sets depth (lenShort..lenLong).
    swipe: {
      tapDist: 14, minDist: 26, window: 140,
      lobSpeed: 0.34, flatSpeed: 1.0,
      aimAngle: 36, lenShort: 60, lenLong: 230, shortY: 0.35,
      downRatio: 0.55,          // down by at least this share of the sideways travel: a drop
      curveMin: 0.14, curveFull: 0.38, curveSpin: 190, // bend (sagitta / chord) -> sidespin (rad/s)
    },
    // Sidespin: the ball bends sideways in the air (the same lift law as
    // topspin, turned on its side) and kicks that way off the bounce.
    curve: { kick: 0.004, keep: 0.5 },

    // Court surfaces: bounce height and grip. The default CONFIG is hard.
    surfaces: {
      hard:  { label: 'Hard',  restitution: 0.82, friction: 0.6 },
      clay:  { label: 'Clay',  restitution: 0.87, friction: 0.74 },
      grass: { label: 'Grass', restitution: 0.75, friction: 0.46 },
    },

    // Where the ball should be at contact, relative to the player (m).
    contact: {
      side: 0.9,                // ideal contact point, this far to the stroke side
      ahead: 0.5,               // ...and this far in front (towards the net)
      height: 1.0,              // ideal height
      reach: 1.3,               // lateral reach around the ideal point
      minH: 0.15, maxH: 2.4,    // below: TOO SHORT, above: TOO DEEP
      backhandBelow: -0.25,     // ball X - player X below this: backhand
      // Volleys: taken further in front, a little higher, wider reach.
      volley: { side: 0.9, ahead: 0.7, height: 1.2, reach: 1.5, minH: 0.3, maxH: 2.0 },
      // Smash: a high ball, almost overhead.
      smash: { side: 0.3, ahead: 0.4, height: 2.6, reach: 1.2, minH: 2.0, maxH: 3.4 },
    },

    // Timing score and distance -> quality 0..1 -> what the shot does.
    quality: {
      perfectDist: 0.35,        // PERFECT also needs the ball this close to ideal
      wDist: 0.35,              // q = timing score * (1 - wDist * dist/reach)
      good: 0.6,                // GOOD at or above, POOR below
      paceMin: 0.85,            // speed multiplier at q = 0 (1 at q = 1)
      perfectPace: 1.12,        // speed multiplier for PERFECT
      maxPull: 2.8,             // sideways miss at the timing limit (m)
      maxShort: 4.5,            // depth lost at q = 0 (m)
      mishitBelow: 0.3,         // below this q a shot can be mishit out
      mishitChance: 0.6,        // chance at q = 0, scaling to 0 at mishitBelow
    },

    // Drop shot placement and risk. Target: pastNet metres past the net
    // (the stick's up/down moves it by up to nudge within band). Off
    // Perfect, a drop either falls short by up to `short` m at q = 0 with
    // no net lift (it can clip or find the net), or floats: launched up to
    // `lift` degrees higher with only spinKeep of its backspin. netShare is
    // the chance it's the short kind.
    drop: { pastNet: 2.5, band: [1.5, 3.5], nudge: 1.0, x: 2.6, short: 2.6, lift: 13, spinKeep: 0.4, netShare: 0.5 },

    // Volleys: pace = shot speed * mix[0] + incoming ball speed * mix[1]
    // (mostly the incoming ball's pace). depth as for shots; Topspin is
    // the angled volley (angledX from centre, the stick or stroke side
    // picks the side). angles = the solver's range from a high contact.
    volley: {
      mix: { flat: [0.45, 0.35], top: [0.42, 0.3], drop: [0.9, 0.03], lob: [0.85, 0.05] },
      depth: { flat: 3.5, top: 7.5, lob: 2.5 },
      angledX: 3.6,
      // The lob volley goes up steeply: above its maximum-range angle, where
      // a higher angle lands shorter.
      angles: { flat: [-14, 28], top: [-14, 30], drop: [-8, 32], lob: [46, 80] },
      lowSlow: 0.5,             // flat / topspin volleys below the tape in the NET zone lose pace in proportion, to this at most
    },
    // Smash risk and reward: bigger pull when mistimed, more pace when
    // Perfect, mishits from a higher quality.
    smash: { pullMul: 1.5, perfectPace: 1.15, mishitBelow: 0.45 },

    // Joystick at contact -> target on the far court.
    aim: {
      x: 3.4,                   // full left/right puts the target this far from centre (m)
      deeper: 1.5,              // full up: this much deeper than the shot's depth
      shorter: 4.0,             // full down: this much shorter
    },

    // The ball machine in practice feeds from the far end only, and only
    // balls the player can reach from where they stand (see reachPlan).
    feed: {
      first: 0.8,               // delay before the first ball (s)
      delay: 1.6,               // delay after each point (s)
      width: 2.5,               // lands within +-this of the centre line (m)
      pace: 0.7,                // default speed multiplier (1 = match pace)
      minPace: { lob: 0.9, drop: 1 }, // slower than this can't reach (lob) or cross the net (drop)
      // Angle ranges the solver searches for feeds (wider than the shots',
      // so slow feeds still reach). Below each shot's maximum-range angle.
      angles: { flat: [-2, 22], top: [0, 38], lob: [12, 38], drop: [0, 34] },
      // Feed modes beyond the four shots. land: metres past the net;
      // behind: lands this far behind the player (so it reaches them before
      // bouncing); prefer: with the player at MID or NET, look for a feed
      // they can play this way first; angles: the solver's range.
      modes: {
        short: { shot: 'drop', land: 5.0 },  // a low, short ball that dies before the baseline
        volley: { shot: 'flat', behind: 4.5, prefer: 'volley' },
        overhead: { shot: 'lob', behind: 1.5, prefer: 'smash', angles: [46, 68], pace: 1 },
      },
      // Auto cycles through these feed modes.
      auto: ['flat', 'top', 'lob', 'drop', 'short'],
      tries: 14,                // candidates per pace step before taking the best one
      slower: [1, 0.8, 0.65, 0.5],// if none is reachable, try again this much slower...
      slowAngles: [10, 40],     // ...searching these (higher, longer-hanging) angles
      leadIn: 3.0,              // later candidates land this far in front of the player
      reaction: 0.3,            // s the player needs before moving (reachability)
      margin: 0.05,             // a feed is accepted with at least this much time to spare (s)
      hMargin: 0.15,            // "reachable" needs the ball this far inside minH..maxH
    },

    // Soft assist: while a fed ball is inbound and the player isn't
    // swinging, an idle stick axis drifts towards the predicted stance.
    // A stick axis outside the deadzone always wins on that axis.
    assist: { level: 'light', speed: { off: 0, light: 1.3, strong: 2.8 }, gain: 3 },

    // Drawing sizes in canvas px (360-wide canvas: CSS px on a 360 px phone),
    // at the near baseline; they shrink with perspective. Visual only: the
    // physics stays in metres.
    render: {
      playerH: 85,              // standing height
      ballNear: 9, ballFar: 7,  // ball diameter at the near / far baseline
      ballMin: 7,               // never drawn smaller
      racketHead: 22,           // head length (width is 0.75 of it)
      racketLen: 0.4,           // whole racket, fraction of playerH
      trail: 4,                 // trail samples
      shadowMin: 5,             // ball shadow width at least this (px)
      magnetMs: 40,             // racket head snaps onto the ball this close to contact
      cueLead: 0.3,             // swing cue fades in this long before the ideal tap (s)
      missMs: 900,              // miss reason label time
    },

    // --- Match (Stage 3) ----------------------------------------------------
    // A set is won at `games` with a two-game lead, or by the tie-break at
    // tiebreakAt-all (first to tbPoints, win by two). The match is won at
    // ceil(bestOf / 2) sets, so best-of-3 only needs a new row here.
    match: {
      formats: {
        quick:    { label: 'Quick',    bestOf: 1, games: 3, tiebreakAt: 3, tbPoints: 7 },
        standard: { label: 'Standard', bestOf: 1, games: 6, tiebreakAt: 6, tbPoints: 7 },
      },
      defaultFormat: 'quick',
      firstServer: 'near',      // 'near' (you), 'far' or 'random' (seeded)
      preServe: 0.6,            // players placed before each serve (s)
      callTime: 0.9,            // result label (WINNER, OUT, ...) (s)
      bannerTime: 1.3,          // score banner (s)
      faultTime: 0.8,           // FAULT / LET label before the next serve (s)
      offCourt: 6,              // past a baseline by this (or 9 m wide) after a good bounce: past the receiver
      maxPoint: 10,             // s a ball may stay live after a good bounce before the hitter wins it (safety)
      rallySoft: 20,            // shots; past this the CPU's error chance grows by its rallyRamp a shot
      rallyCap: 30,             // the CPU's shot at this count is a forced error, and it stops playing after it
    },

    // Serve: the toss goes up by itself after autoToss (or on the first
    // tap); tap Flat or Topspin as the ball peaks. Contact comes backswing
    // later. Timing (ms from the peak) sets quality q, which sets pace and
    // scatter; past missMs the swing misses the toss and it's tossed again
    // (no fault). The stick aims within the box: x across it, y deeper
    // (up) or shorter, kept `margin` inside the lines, then scattered by
    // spread + spreadPoor * (1 - q) metres and angleErr * (1 - q) degrees.
    serve: {
      stand: { behind: 0.3, offX: 0.8 },     // server: behind the baseline, off the centre mark
      receive: { behind: 1.0, offX: 2.3 },   // receiver's starting spot
      hand: { side: 0.25, ahead: 0.35, H: 1.8 }, // toss release, from the server's feet
      tossVz: 4.6,              // m/s up: peaks about 1.08 m above the hand
      autoToss: 0.8,            // s before the toss goes up by itself
      retossDelay: 0.5,
      backswing: 0.18,
      perfectMs: 45, missMs: 240,
      q: [[45, 0.95], [110, 0.7], [200, 0.3], [240, 0.1]],
      touch: { perfectMs: 75, missMs: 330, q: [[75, 0.95], [160, 0.72], [260, 0.35], [330, 0.12]] }, // swipe serves
      paceMin: 0.82, perfectPace: 1.05,
      shots: { flat: 'serveFlat', top: 'serveKick' }, // button -> CONFIG.shots key (Lob and Drop don't serve)
      first:  { margin: 0.25, pace: 1.0,  spread: 0.25, spreadPoor: 1.1, angleErr: 2.2 },
      second: { margin: 0.8,  pace: 0.85, spread: 0.15, spreadPoor: 0.7, angleErr: 1.2 },
      band: 1.6,                // depth range the stick covers inside the margin (m)
    },

    // CPU opponent, per difficulty. It plays through the same inputs as a
    // person (a stick and timed shot taps) and the same physics, shots and
    // aim solver; harder means quicker and more accurate, never faster
    // than the player can move.
    //   reaction    s after the opponent's contact before it starts moving
    //   speedMul    fraction of the player's top speed (<= 1)
    //   predictErr  m of error in where it thinks it should stand, rolled
    //               each shot; `refine` of it fades as the ball arrives
    //   tapMean/Sd  ms; its tap timing error is drawn from N(mean, sd)
    //   errorRate   chance a shot is an unforced error (long, wide or net),
    //               x0.5 off a perfect contact up to x2.5 off a poor one
    //   aimMargin   m inside the sidelines it aims; aimSpread m of scatter;
    //               deep  how far up it pushes the stick (deeper) on drives
    //   paceMul     pace on its shots; topShare topspin vs flat when deep
    //   approachRate chance it follows a short ball (contact within
    //               approachDepth m of the net) in; netY where it stands then
    //   lobRate     chance it lobs an opponent at the net (else a pass)
    //   dropRate    chance of a drop (or drop volley) when it can
    //   firstFlat / secondFlat  chance a serve is flat (else kick)
    //   serveAimX   how far across the box it aims (stick, 0..1)
    //   serveMargin m inside the box lines on a first serve (+0.3 second)
    //   mercyAim    Easy only: aim pulled this far towards the player
    //   rallyRamp   extra error chance a shot past match.rallySoft
    //   attack      chance a drive goes for the open court (the far corner from the opponent)
    cpu: {
      easy:   { label: 'Easy', reaction: 0.32, speedMul: 0.80, predictErr: 1.2, refine: 0.5, tapMean: 25, tapSd: 80,
                errorRate: 0.12, aimMargin: 1.6, aimSpread: 0.9, deep: 0, paceMul: 0.85, topShare: 0.7,
                approachRate: 0.15, approachDepth: 7.5, netY: 3.2, lobRate: 0.15, dropRate: 0.02,
                firstFlat: 0.3, secondFlat: 0.05, serveAimX: 0.4, serveMargin: 0.9, mercyAim: 0.35, rallyRamp: 0.04 },
      medium: { label: 'Medium', reaction: 0.24, speedMul: 0.92, predictErr: 0.7, refine: 0.6, tapMean: 10, tapSd: 55,
                errorRate: 0.08, aimMargin: 1.1, aimSpread: 0.55, deep: 0.3, paceMul: 0.93, topShare: 0.6,
                approachRate: 0.45, approachDepth: 7.5, netY: 3.0, lobRate: 0.25, dropRate: 0.05,
                firstFlat: 0.5, secondFlat: 0.1, serveAimX: 0.7, serveMargin: 0.6, mercyAim: 0, rallyRamp: 0.04, attack: 0.2 },
      hard:   { label: 'Hard', reaction: 0.16, speedMul: 1.0, predictErr: 0.35, refine: 0.75, tapMean: 0, tapSd: 24,
                errorRate: 0.03, aimMargin: 0.7, aimSpread: 0.35, deep: 0.6, paceMul: 1.0, topShare: 0.5,
                approachRate: 0.75, approachDepth: 7.5, netY: 2.8, lobRate: 0.35, dropRate: 0.08,
                firstFlat: 0.7, secondFlat: 0.15, serveAimX: 0.9, serveMargin: 0.4, mercyAim: 0, rallyRamp: 0.025, attack: 0.45 },
      defaultLevel: 'medium',
      brake: 0.7,               // fraction of the player's deceleration it plans to stop with
      homeBehind: 0.4,          // baseline home: this far behind the baseline
    },

    // World Tour: opponents in order. Each is a CPU level (`base`) with a
    // few of its numbers replaced (`over`), on a surface, in a format.
    tour: [
      { id: 'milo',   name: 'MILO',   title: 'The Rookie',       base: 'easy',   surface: 'hard',  format: 'quick',
        blurb: 'New on tour. Keeps the ball in play and not much else.', kit: ['#f2c94c', '#2b3a67'],
        over: { errorRate: 0.16, paceMul: 0.8 } },
      { id: 'ines',   name: 'INES',   title: 'The Wall',         base: 'easy',   surface: 'clay',  format: 'quick',
        blurb: 'Gets everything back from the baseline. Be patient, then go for the corner.', kit: ['#ff8a5c', '#5a2d1a'],
        over: { errorRate: 0.06, speedMul: 0.9, reaction: 0.26, approachRate: 0, topShare: 0.9, paceMul: 0.84 } },
      { id: 'bruno',  name: 'BRUNO',  title: 'The Big Server',   base: 'medium', surface: 'grass', format: 'quick',
        blurb: 'Huge first serve, shaky in long rallies. Get the return back.', kit: ['#f4f4f0', '#1d5c3a'],
        over: { firstFlat: 0.9, serveAimX: 0.9, serveMargin: 0.45, errorRate: 0.12, rallyRamp: 0.06 } },
      { id: 'sana',   name: 'SANA',   title: 'The Net Rusher',   base: 'medium', surface: 'grass', format: 'quick',
        blurb: 'Follows everything in to the net. Lob her or pass her.', kit: ['#c3a6ff', '#3a2a6a'],
        over: { approachRate: 0.95, approachDepth: 10.5, dropRate: 0.12 } },
      { id: 'tomas',  name: 'TOMAS',  title: 'The Magician',     base: 'medium', surface: 'clay',  format: 'quick',
        blurb: 'Drop shots, lobs and angles. Never the same ball twice.', kit: ['#5ee0c0', '#134a44'],
        over: { dropRate: 0.3, lobRate: 0.6, aimMargin: 0.9, reaction: 0.2 } },
      { id: 'kenji',  name: 'KENJI',  title: 'The Counterpuncher', base: 'hard', surface: 'hard',  format: 'quick',
        blurb: 'Fast, deep and steady. You have to win the point yourself.', kit: ['#ff5e7a', '#3a1020'],
        over: { errorRate: 0.03, approachRate: 0.3, paceMul: 0.95, attack: 0.3 } },
      { id: 'astrid', name: 'ASTRID', title: 'The Champion',     base: 'hard',   surface: 'hard',  format: 'standard',
        blurb: 'World number one. No weaknesses, a full set to prove yourself.', kit: ['#16181f', '#d4af37'],
        over: { tapSd: 20, aimMargin: 0.6, errorRate: 0.025, dropRate: 0.12, lobRate: 0.45, attack: 0.6 } },
    ],
  };

  // A config for one match: CONFIG on `surface`, and (opts.tour = a
  // CONFIG.tour row or its id) that opponent as the CPU level 'tour'.
  function configFor(opts) {
    opts = opts || {};
    const sf = CONFIG.surfaces[opts.surface] || CONFIG.surfaces.hard;
    const cfg = Object.assign({}, CONFIG, { restitution: sf.restitution, friction: sf.friction, surface: CONFIG.surfaces[opts.surface] ? opts.surface : 'hard' });
    const row = typeof opts.tour === 'string' ? CONFIG.tour.find(r => r.id === opts.tour) : opts.tour;
    if (row) cfg.cpu = Object.assign({}, CONFIG.cpu, { tour: Object.assign({}, CONFIG.cpu[row.base], row.over, { label: row.name }) });
    return cfg;
  }

  // Real court dimensions (m), measured to the outside of the lines.
  const COURT = {
    length: 23.77,
    doublesHalf: 5.485,
    singlesHalf: 4.115,
    netY: 23.77 / 2,
    serviceFromNet: 6.40,
    netCentre: 0.914,
    netPost: 1.07,
    postX: 5.485 + 0.914,
  };

  function netHeight(X) {
    const a = Math.min(1, Math.abs(X) / COURT.postX);
    return COURT.netCentre + (COURT.netPost - COURT.netCentre) * a;
  }

  function toWorld(X, Y, H, cfg) {
    cfg = cfg || CONFIG;
    return { x: X / COURT.doublesHalf, z: Y / COURT.length, h: H * cfg.hScale };
  }

  // 'near' hitter plays towards the far end (Y decreasing).
  function towards(side) { return side === 'near' ? -1 : 1; }

  // Is a bounce at (X, Y) in for a ball hit by `side`? Lines count as in.
  function judgeBounce(X, Y, side) {
    const farHalf = Y <= COURT.netY;
    const opponentHalf = side === 'near' ? farHalf : !farHalf;
    if (!opponentHalf) return 'NET';
    if (Y < 0 || Y > COURT.length) return 'OUT_LONG';
    if (Math.abs(X) > COURT.singlesHalf) return 'OUT_WIDE';
    return 'IN';
  }

  function createBall() {
    return {
      X: 0, Y: 0, H: 0, vx: 0, vy: 0, vz: 0,
      spin: 0, ax: 0, ay: -1,      // spin axis direction (unit, horizontal)
      grip: 1,                     // bounce friction multiplier (drop shot)
      curve: 0,                    // sidespin (rad/s): + bends to the hitter's right
      side: 'near', phase: 'idle', bounces: 0, touchedNet: false, rolling: false,
      t: 0, result: null,
    };
  }

  function launch(ball, from, shot) {
    ball.X = from.X; ball.Y = from.Y; ball.H = from.H;
    ball.vx = shot.vx; ball.vy = shot.vy; ball.vz = shot.vz;
    ball.spin = shot.spin;
    const u = Math.hypot(shot.vx, shot.vy) || 1;
    ball.ax = shot.vx / u; ball.ay = shot.vy / u;
    ball.side = from.side;
    ball.phase = 'flight'; ball.bounces = 0; ball.touchedNet = false; ball.rolling = false;
    ball.t = 0; ball.result = null; ball.grip = shot.grip || 1; ball.curve = shot.curve || 0;
  }

  function bounce(ball, cfg) {
    const e = cfg.restitution, r = cfg.ballRadius, k = cfg.spinInertia;
    const vzIn = -ball.vz;
    ball.vz = e * vzIn;
    // Along the spin axis: friction acts on the contact point's slip.
    const u = ball.vx * ball.ax + ball.vy * ball.ay;
    const lx = ball.vx - u * ball.ax, ly = ball.vy - u * ball.ay;
    const slip = u - r * ball.spin;          // contact point velocity
    const maxDu = cfg.friction * (ball.grip || 1) * (1 + e) * vzIn;
    const rollDu = k * Math.abs(slip) / (1 + k); // change that reaches rolling
    const du = -Math.sign(slip) * Math.min(maxDu, rollDu);
    const u2 = u + du;
    ball.spin -= du / (k * r);
    // Sideways speed just loses a little to friction (no sidespin model).
    const lat = Math.hypot(lx, ly);
    const latKeep = lat > 0 ? Math.max(0, lat - Math.min(maxDu, lat / (1 + k) * k)) / lat : 0;
    ball.vx = u2 * ball.ax + lx * latKeep;
    ball.vy = u2 * ball.ay + ly * latKeep;
    // Sidespin kicks the ball sideways off the court and is mostly spent.
    if (ball.curve) {
      const kick = cfg.curve.kick * ball.curve;
      ball.vx += -ball.ay * kick; ball.vy += ball.ax * kick;
      ball.curve *= cfg.curve.keep;
    }
  }

  // Advance one fixed step. Returns an array of events.
  function step(ball, cfg) {
    cfg = cfg || CONFIG;
    const ev = [];
    if (ball.phase === 'idle' || ball.phase === 'held') return ev; // held: in the server's hand
    const dt = cfg.dt, r = cfg.ballRadius;
    if (ball.rolling) {
      // Resting on the court: roll to a stop, no more bounces.
      const keep = Math.max(0, 1 - 1.5 * dt);
      ball.vx *= keep; ball.vy *= keep; ball.vz = 0; ball.H = r;
      ball.X += ball.vx * dt; ball.Y += ball.vy * dt; ball.t += dt;
      return ev;
    }
    const v = Math.hypot(ball.vx, ball.vy, ball.vz);
    // Drag.
    let axx = -cfg.drag * v * ball.vx, ayy = -cfg.drag * v * ball.vy, azz = -cfg.gravity - cfg.drag * v * ball.vz;
    // Magnus, in the vertical plane of the spin axis: topspin pushes down.
    const u = ball.vx * ball.ax + ball.vy * ball.ay;
    const m = cfg.magnus * ball.spin;
    axx += m * ball.vz * ball.ax; ayy += m * ball.vz * ball.ay; azz += -m * u;
    // Sidespin: the same lift, sideways (at right angles to the flight).
    if (ball.curve) { const c = cfg.magnus * ball.curve; axx += -c * ball.vy; ayy += c * ball.vx; ball.curve *= 1 - cfg.spinDecay * dt; }
    ball.vx += axx * dt; ball.vy += ayy * dt; ball.vz += azz * dt;
    ball.spin *= 1 - cfg.spinDecay * dt;

    const pY = ball.Y, pH = ball.H, pX = ball.X;
    ball.X += ball.vx * dt; ball.Y += ball.vy * dt; ball.H += ball.vz * dt;
    ball.t += dt;

    // Net: did the ball's centre cross the net plane this step?
    const ny = COURT.netY;
    if ((pY - ny) * (ball.Y - ny) <= 0 && pY !== ball.Y) {
      const f = (ny - pY) / (ball.Y - pY);
      const cx = pX + (ball.X - pX) * f, ch = pH + (ball.H - pH) * f;
      if (Math.abs(cx) <= COURT.postX) {
        const top = netHeight(cx);
        if (ch < top) {
          // Into the net: stop on the hitter's side.
          const back = Math.sign(pY - ny) || 1;
          ball.Y = ny + back * r;
          ball.X = cx; ball.H = Math.max(r, ch);
          ball.vy = -ball.vy * cfg.netStopKeep;
          ball.vx *= cfg.netStopKeep; ball.vz = Math.min(0, ball.vz) * cfg.netStopKeep;
          ball.spin = 0;
          ball.touchedNet = true;
          if (ball.phase === 'flight') ball.phase = 'net';
          ev.push({ type: 'net', X: cx, Y: ny, H: ch, stopped: true });
        } else if (ch < top + r && !ball.touchedNet) {
          // Clips the tape and carries on, slower and popped up.
          ball.vx *= cfg.netClipKeep; ball.vy *= cfg.netClipKeep;
          ball.vz = Math.abs(ball.vz) * 0.3 + cfg.netClipPop;
          ball.touchedNet = true;
          ev.push({ type: 'net', X: cx, Y: ny, H: ch, stopped: false });
        }
      }
    }

    // Ground.
    if (ball.H < r && ball.vz < 0) {
      ball.H = r; // land on the surface
      const impact = -ball.vz;
      bounce(ball, cfg);
      ball.bounces++;
      const e = { type: 'bounce', X: ball.X, Y: ball.Y, n: ball.bounces, impact };
      if (ball.bounces === 1) {
        ball.result = ball.phase === 'net' ? 'NET' : judgeBounce(ball.X, ball.Y, ball.side);
        e.result = ball.result;
        ball.phase = ball.result === 'IN' ? 'bounced' : 'dead';
      } else {
        ball.phase = 'dead';
      }
      ev.push(e);
      if (ball.vz < 0.5) { ball.vz = 0; ball.H = r; ball.rolling = true; }
    }
    return ev;
  }

  // Simulate a launch without side effects. Returns where the first bounce
  // lands (or where it stopped at the net) and the flight time.
  function simulate(from, shot, cfg, opts) {
    cfg = cfg || CONFIG; opts = opts || {};
    const b = createBall();
    launch(b, from, shot);
    const until = opts.untilY;
    const maxT = opts.maxT || 6;
    let firstBounce = null, net = false, crossT = null;
    while (b.t < maxT) {
      const ev = step(b, cfg);
      for (const e of ev) {
        if (e.type === 'net' && e.stopped) net = true;
        if (e.type === 'bounce' && e.n === 1) firstBounce = { X: e.X, Y: e.Y, t: b.t, result: e.result };
      }
      if (until != null && crossT == null && (b.Y - until) * towards(from.side) >= 0) crossT = b.t;
      if (until == null && (firstBounce || net)) break;
      if (until != null && (crossT != null || b.phase === 'dead')) break;
    }
    return { firstBounce, net, crossT, ball: b };
  }

  function shotFromAngle(from, target, def, angleDeg) {
    const dx = target.X - from.X, dy = target.Y - from.Y;
    const d = Math.hypot(dx, dy) || 1;
    const a = angleDeg * Math.PI / 180;
    const hs = def.speed * Math.cos(a);
    return { vx: hs * dx / d, vy: hs * dy / d, vz: def.speed * Math.sin(a), spin: def.spin, grip: def.grip || 1, curve: def.curve || 0 };
  }

  // Aim solver: find the launch angle (within the shot's range) whose first
  // bounce lands at the target depth. Bisection on angle; the landing
  // distance is monotonic across each shot's range.
  function solveShot(from, target, shotKey, cfg, opts) {
    cfg = cfg || CONFIG;
    let def = cfg.shots[shotKey];
    if (opts && opts.speedMul) def = Object.assign({}, def, { speed: def.speed * opts.speedMul });
    if (opts && opts.angles) def = Object.assign({}, def, { angles: opts.angles });
    if (opts && opts.curve) def = Object.assign({}, def, { curve: opts.curve });
    const want = Math.hypot(target.X - from.X, target.Y - from.Y);
    if (def.speedRef) {
      const k = Math.sqrt(want / def.speedRef), c = def.speedClamp || [0, Infinity];
      def = Object.assign({}, def, { speed: def.speed * Math.max(c[0], Math.min(c[1], k)) });
    }
    const dist = (ang) => {
      const s = simulate(from, shotFromAngle(from, target, def, ang), cfg);
      if (!s.firstBounce) return -1; // stopped by the net: counts as short
      return Math.hypot(s.firstBounce.X - from.X, s.firstBounce.Y - from.Y) * (s.net ? -1 : 1);
    };
    let lo = def.angles[0], hi = def.angles[1];
    const dLo = dist(lo), dHi = dist(hi);
    const rising = dHi > dLo;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2, dm = dist(mid);
      if ((dm < want) === rising) lo = mid; else hi = mid;
    }
    let angle = (lo + hi) / 2;
    // opts.clearNet: if the best angle still finds the net or the tape
    // (too much pace for the depth), lift it until the ball clears; it then
    // lands a little longer than asked.
    if (opts && opts.clearNet) {
      for (let i = 0; i < 64; i++) {
        const s = simulate(from, shotFromAngle(from, target, def, angle), cfg);
        const own = s.firstBounce && s.firstBounce.result === 'NET'; // bounced on the hitter's side
        if (!s.net && !s.ball.touchedNet && !own) break;
        angle += 0.25;
      }
      // A tape clip pops the ball up and can land it long, which fools the
      // bisection near the net. If the cleared angle now lands short of the
      // target, search again between it and the top of the range.
      if (rising && angle < def.angles[1]) {
        const d = dist(angle);
        if (d > 0 && d < want - 0.3) {
          let a = angle, b = def.angles[1];
          for (let i = 0; i < 24; i++) { const mid = (a + b) / 2; if (dist(mid) < want) a = mid; else b = mid; }
          angle = (a + b) / 2;
        }
      }
    }
    return Object.assign(shotFromAngle(from, target, def, angle), { angle, key: shotKey });
  }

  // solveShot for a ball with sidespin (opts.curve): it bends in the air,
  // so aim off to the side until the first bounce lands on the target.
  function solveCurved(from, target, shotKey, cfg, opts) {
    let shot = solveShot(from, target, shotKey, cfg, opts);
    if (!opts || !opts.curve) return shot;
    const aim = { X: target.X, Y: target.Y };
    for (let i = 0; i < 4; i++) {
      const s = simulate(from, shot, cfg);
      if (!s.firstBounce || s.net) break;
      const ex = target.X - s.firstBounce.X;
      if (Math.abs(ex) < 0.05) break;
      aim.X += ex;
      shot = solveShot(from, aim, shotKey, cfg, opts);
    }
    return shot;
  }

  // Seeded RNG so the ball machine (and tests) are repeatable.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------
  // Ball machine: rallies balls back and forth between the two contact
  // points. Each return is struck from where the ball actually arrives.
  // ---------------------------------------------------------------------
  function createMachine(seed, cfg) {
    cfg = cfg || CONFIG;
    return {
      cfg, rand: rng(seed == null ? 1 : seed), ball: createBall(),
      mode: 'auto', cycle: 0, wait: cfg.machine.firstDelay, nextSide: 'near',
      shotKey: null, lastCross: null, aim: null,
    };
  }

  function pickShot(mc) {
    if (mc.mode !== 'auto') return mc.mode;
    const keys = ['flat', 'top', 'lob'];
    return keys[mc.cycle++ % keys.length];
  }

  function machineHit(mc, from) {
    const cfg = mc.cfg, R = mc.rand, key = pickShot(mc), def = cfg.shots[key];
    const dir = towards(from.side);
    const baseY = from.side === 'near' ? 0 : COURT.length;
    let target = {
      X: (R() * 2 - 1) * COURT.singlesHalf * cfg.machine.aimWidth,
      Y: baseY - dir * (def.depth + (R() - 0.5) * 1.5),
    };
    let shot, miss = null;
    if (R() < cfg.machine.missChance) {
      miss = ['long', 'wide', 'net'][Math.floor(R() * 3)];
      if (miss === 'long') target.Y = baseY + dir * 1.2;
      if (miss === 'wide') target.X = Math.sign(target.X || 1) * (COURT.singlesHalf + 0.7);
    }
    if (miss === 'net') {
      shot = shotFromAngle(from, target, def, def.angles[0] - 3);
      shot.key = key; shot.angle = def.angles[0] - 3;
    } else {
      shot = solveShot(from, target, key, cfg);
    }
    launch(mc.ball, from, shot);
    mc.shotKey = key; mc.aim = { target, miss };
    return { type: 'hit', side: from.side, X: from.X, Y: from.Y, H: from.H, shot: key, miss, angle: shot.angle };
  }

  // Advance the machine by one fixed step; returns events for the renderer.
  function machineStep(mc) {
    const cfg = mc.cfg, b = mc.ball, ev = [];
    if (mc.wait > 0) {
      mc.wait -= cfg.dt;
      if (mc.wait <= 0) {
        const side = mc.nextSide;
        const Y = side === 'near' ? cfg.nearContactY : cfg.farContactY;
        ev.push(machineHit(mc, { side, X: (mc.rand() - 0.5) * 2, Y, H: cfg.contactHeight }));
      }
      return ev;
    }
    const out = step(b, cfg);
    for (const e of out) ev.push(e);
    // Receiver plane reached after a good bounce: hit it back.
    if (b.phase === 'bounced') {
      const recvSide = b.side === 'near' ? 'far' : 'near';
      const recvY = recvSide === 'near' ? cfg.nearContactY : cfg.farContactY;
      if ((b.Y - recvY) * towards(b.side) >= 0) {
        mc.lastCross = b.t;
        ev.push({ type: 'cross', t: b.t, shot: mc.shotKey });
        const H = Math.min(2.2, Math.max(0.8, b.H)); // the machine picks low balls up
        ev.push(machineHit(mc, { side: recvSide, X: Math.max(-COURT.singlesHalf, Math.min(COURT.singlesHalf, b.X)), Y: recvY, H }));
        return ev;
      }
    }
    const offCourt = b.Y < -6 || b.Y > COURT.length + 6 || Math.abs(b.X) > 9;
    if (!mc.dying && (b.phase === 'dead' || b.phase === 'net' || offCourt || b.t > 4)) {
      mc.dying = true; mc.dieT = 0;
    }
    if (mc.dying) {
      mc.dieT += cfg.dt;
      if (mc.dieT >= cfg.machine.restartDelay) {
        mc.dying = false;
        b.phase = 'idle';
        mc.nextSide = mc.nextSide === 'near' ? 'far' : 'near';
        mc.wait = cfg.dt; // serve on the next step
        ev.push({ type: 'reset' });
      }
    }
    return ev;
  }

  // ---------------------------------------------------------------------
  // Practice mode: the machine feeds from the far end; the near player
  // moves, swings and returns. Swing requests carry their own sim time, so
  // the outcome doesn't depend on which frame the input arrived in.
  // ---------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, f) => a + (b - a) * f;

  // Where the player may stand. The net-side limit keeps netGap metres
  // from the net, so the player can never touch or cross it.
  function playerBounds(cfg) {
    const pl = (cfg || CONFIG).player;
    return { minX: pl.minX, maxX: pl.maxX, minY: COURT.netY + pl.netGap, maxY: pl.maxY };
  }

  // Forehand unless the ball is clearly on the player's left.
  function strokeFor(dx, cfg) {
    return dx >= (cfg || CONFIG).contact.backhandBelow ? 'fh' : 'bh';
  }

  // The swing timing for a shot and stroke kind ('ground', 'volley',
  // 'smash'): the base swing with the kind's (or the shot's) preset on top.
  function swingPreset(cfg, shot, kind) {
    const sw = (cfg || CONFIG).swing;
    const over = kind && kind !== 'ground' ? sw[kind] : sw[shot];
    return Object.assign({ backswing: sw.backswing, minBackswing: sw.minBackswing, follow: sw.follow, recovery: sw.recovery }, over || {});
  }

  // Swing phase `e` seconds after the swing starts, with backswing `bs`
  // (default: the full one) and pre's follow / recovery (default: the
  // base swing's). 'contact' is the instant of contact, reported for one
  // display frame or so.
  function swingPhase(e, cfg, bs, pre) {
    const s = Object.assign({}, (cfg || CONFIG).swing, pre && pre.follow != null ? { follow: pre.follow, recovery: pre.recovery } : {});
    if (bs == null) bs = s.backswing;
    if (e == null || e < 0) return 'ready';
    if (e < bs) return 'backswing';
    if (e < bs + 0.02) return 'contact';
    if (e < bs + s.follow) return 'follow-through';
    if (e < bs + s.follow + s.recovery) return 'recovery';
    return 'ready';
  }

  // Piecewise-linear lookup in [[x, y], ...] rows (flat beyond the ends).
  function table(rows, x) {
    if (x <= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i++) {
      if (x <= rows[i][0]) return lerp(rows[i - 1][1], rows[i][1], (x - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]));
    }
    return rows[rows.length - 1][1];
  }

  // Timing score 0..1 for a tap `err` ms from the ideal tap.
  // Court zone for a player at Y: 'NET', 'MID' or 'BACK'.
  function zoneOf(Y, cfg) {
    const z = (cfg || CONFIG).zones, d = Y - COURT.netY;
    return d <= z.net ? 'NET' : d >= z.back ? 'BACK' : 'MID';
  }
  // Contact geometry and timing windows for a stroke kind ('ground',
  // 'volley', 'smash'): the base values with the kind's overrides.
  function contactFor(cfg, kind) {
    const c = (cfg || CONFIG).contact;
    return Object.assign({}, c, kind && kind !== 'ground' ? c[kind] : {});
  }
  function timingFor(cfg, kind, touch) {
    const T = (cfg || CONFIG).timing;
    return Object.assign({}, T, kind && kind !== 'ground' ? T[kind] : {}, touch ? T.touch : {});
  }
  // On-screen name of a stroke.
  function strokeLabel(kind, shot, cfg, curve) {
    if (kind === 'smash') return 'SMASH';
    if (curve && kind !== 'volley' && (shot === 'flat' || shot === 'top')) return 'CURVEBALL';
    if (kind === 'volley') return shot === 'drop' ? 'DROP VOLLEY' : shot === 'lob' ? 'LOB VOLLEY' : 'VOLLEY';
    return (cfg || CONFIG).shots[shot].name;
  }

  function timingScore(err, cfg, kind, touch) {
    const T = timingFor(cfg, kind, touch), a = Math.abs(err);
    if (a <= T.perfectMs) return 1;
    return table(err < 0 ? T.earlyQ : T.lateQ, a);
  }

  // Miss reasons, as the engine reports them, and their on-screen text.
  const MISS_TEXT = {
    early: 'TOO EARLY', late: 'TOO LATE', left: 'TOO FAR LEFT', right: 'TOO FAR RIGHT',
    deep: 'TOO DEEP', short: 'TOO SHORT', noswing: 'NO SWING',
  };

  // Judge a contact. b = ball at the contact instant {X, Y, H, vy, live,
  // phase} (or {hittable} for a bare check), p = player {X, Y}.
  // tm = { tapErr, kind } from the swing plan: tapErr is ms from the ideal
  // tap (< 0 early); kind is the prediction's ('ok', 'deep', 'short').
  // Without tapErr the error is measured at the contact plane instead.
  // Left/right name the side the ball went past ("TOO FAR LEFT": it was
  // out on your left, move left).
  function judgeContact(b, p, cfg, tm) {
    cfg = cfg || CONFIG;
    const kind = (tm && tm.stroke) || 'ground';
    const touch = !!(tm && tm.touch);
    const c = contactFor(cfg, kind), q = cfg.quality, T = timingFor(cfg, kind, touch);
    const stroke = strokeFor(b.X - p.X, cfg), F = stroke === 'fh' ? 1 : -1;
    const idealX = p.X + F * c.side, lat = Math.abs(b.X - idealX);
    const planeY = p.Y - c.ahead;
    let errMs;
    if (tm && tm.tapErr != null) errMs = tm.tapErr;
    else errMs = b.vy > 0.5 ? (b.Y - planeY) / b.vy * 1000 : (b.Y < planeY ? -9999 : 9999);
    errMs = clamp(errMs, -9999, 9999);
    const live = b.live != null ? b.live : !!b.hittable;
    // Groundstrokes need the bounce; volleys and smashes take the ball in
    // the air on the player's half (or just after a bounce).
    const hittable = b.hittable != null ? b.hittable
      : live && (b.phase === 'bounced' || (kind !== 'ground' && b.phase === 'flight' && b.Y > COURT.netY));
    const dist = Math.hypot(lat, 0.5 * (b.H - c.height));
    const out = { stroke, kind, errMs, dist, lat, H: b.H, Y: b.Y, contact: false, reason: null, quality: 0, band: 'WHIFF', perfect: false, pull: 0 };
    const pk = tm && tm.kind;
    if (!live) out.reason = 'none';
    else if (pk === 'deep' || pk === 'short') out.reason = pk;
    else if (errMs < -(T.bufferMs + T.earlyGraceMs)) out.reason = 'early';
    else if (errMs > T.poorMs + T.lateGraceMs) out.reason = 'late';
    else if (!hittable) out.reason = b.phase === 'flight' ? 'early' : 'short';
    else if (lat > c.reach) out.reason = b.X < idealX ? 'left' : 'right';
    else if (b.H > c.maxH) out.reason = 'deep';
    else if (b.H < c.minH) out.reason = 'short';
    if (out.reason) return out;
    out.contact = true;
    out.perfect = Math.abs(errMs) <= T.perfectMs && dist <= q.perfectDist;
    out.quality = out.perfect ? 1 : clamp(timingScore(errMs, cfg, kind, touch) * (1 - q.wDist * Math.min(1, dist / c.reach)), 0, 1);
    out.band = out.perfect ? 'PERFECT' : out.quality >= q.good ? 'GOOD' : 'POOR';
    // Sideways pull: a buffered early tap fires on time (no pull); the
    // early grace pulls a little; late pushes more the later it is.
    if (errMs < -T.bufferMs) out.pull = -T.earlyPull;
    else if (errMs > T.perfectMs) out.pull = clamp((errMs - T.perfectMs) / (T.poorMs + T.lateGraceMs - T.perfectMs), 0, 1);
    return out;
  }

  // Where a return should land, from the stick and the contact judgement.
  // Returns { target, pace, mishit }. Uses rand only for a possible mishit.
  // Returns { target, pace (speed multiplier), mishit, defKey (the shot
  // definition to solve with), angles (solver range, optional), and for a
  // drop lift / spinMul / noClear / risk }. incoming = speed of the ball
  // at contact (m/s), for volleys.
  function aimReturn(j, stick, shotKey, cfg, rand, incoming) {
    const kind = j.kind || 'ground';
    if (kind === 'volley') {
      const v = cfg.volley, def = cfg.shots[shotKey], mix = v.mix[shotKey];
      let speedMul = mix[0] + mix[1] * (incoming || 0) / def.speed;
      // A volley from below the tape has to be lifted, so it can't be hit hard.
      const atNet = j.Y == null || j.Y - COURT.netY <= cfg.zones.net;
      if (atNet && (shotKey === 'flat' || shotKey === 'top') && j.H < COURT.netCentre) speedMul *= Math.max(v.lowSlow, j.H / COURT.netCentre);
      if (shotKey === 'drop') return Object.assign(aimDrop(j, stick, cfg, rand), { pace: speedMul, angles: v.angles.drop, defKey: 'drop' });
      const out = aimDeep(j, stick, cfg, rand, v.depth[shotKey], 1, cfg.quality.mishitBelow);
      if (shotKey === 'top') {
        // Angled volley: wide to the side the stick (or the stroke) picks.
        const side = Math.sign(stick.x || 0) || (j.stroke === 'fh' ? 1 : -1);
        out.target.X = side * v.angledX + (out.target.X - clamp(stick.x || 0, -1, 1) * cfg.aim.x);
      }
      out.pace *= speedMul; out.angles = v.angles[shotKey]; out.defKey = shotKey;
      return out;
    }
    if (kind === 'smash') {
      const sm = cfg.smash, out = aimDeep(j, stick, cfg, rand, cfg.shots.smash.depth, sm.pullMul, sm.mishitBelow);
      if (j.perfect) out.pace = sm.perfectPace;
      out.defKey = 'smash';
      return out;
    }
    if (shotKey === 'drop') return Object.assign(aimDrop(j, stick, cfg, rand), { defKey: 'drop' });
    return Object.assign(aimDeep(j, stick, cfg, rand, cfg.shots[shotKey].depth, 1, cfg.quality.mishitBelow), { defKey: shotKey });
  }

  // A deep target at `depth` (m from the far baseline), aimed by the
  // stick, pulled and shortened by poor contact, sometimes mishit.
  function aimDeep(j, stick, cfg, rand, depth, pullMul, mishitBelow) {
    const a = cfg.aim, q = cfg.quality;
    const jx = clamp(stick.x || 0, -1, 1), jy = clamp(stick.y || 0, -1, 1);
    let X = jx * a.x;
    let Y = depth - Math.max(0, -jy) * a.deeper + Math.max(0, jy) * a.shorter;
    const F = j.stroke === 'fh' ? 1 : -1;
    if (!j.perfect) {
      // Early pulls a forehand left and a backhand right; late the opposite.
      X += F * j.pull * q.maxPull * pullMul;
      Y += (1 - j.quality) * q.maxShort;
    }
    Y = Math.min(Y, COURT.netY - 1.5);
    let mishit = null;
    if (j.quality < mishitBelow && rand() < q.mishitChance * (mishitBelow - j.quality) / mishitBelow) {
      mishit = rand() < 0.5 ? 'long' : 'wide';
      if (mishit === 'long') Y = -1.5;
      else X = Math.sign(X || F) * (COURT.singlesHalf + 0.9);
    }
    const pace = j.perfect ? q.perfectPace : q.paceMin + (1 - q.paceMin) * j.quality;
    return { target: { X, Y }, pace, mishit };
  }

  // A drop: pastNet metres over the net, nudged by the stick within the
  // band. Off Perfect it risks falling short into the net (POOR only: no
  // net lift) or floating up with less backspin.
  function aimDrop(j, stick, cfg, rand) {
    const d = cfg.drop, q = cfg.quality, F = j.stroke === 'fh' ? 1 : -1;
    const jx = clamp(stick.x || 0, -1, 1), jy = clamp(stick.y || 0, -1, 1);
    let X = jx * d.x;
    const past = clamp(d.pastNet - jy * d.nudge, d.band[0], d.band[1]);
    let Y = COURT.netY - past;
    const out = { target: null, pace: 1, mishit: null, lift: 0, spinMul: 1, noClear: false, risk: null };
    if (!j.perfect) {
      X += F * j.pull * q.maxPull;
      const bad = 1 - j.quality;
      if (rand() < d.netShare) {
        out.risk = 'short';
        Y += bad * d.short;
        out.noClear = j.quality < q.good;
      } else {
        out.risk = 'float';
        out.lift = bad * d.lift;
        out.spinMul = d.spinKeep + (1 - d.spinKeep) * j.quality;
      }
    }
    out.target = { X, Y };
    return out;
  }

  // Tilt a solved shot `deg` degrees up (same speed and direction).
  function liftShot(shot, deg) {
    const v = Math.hypot(shot.vx, shot.vy, shot.vz), h = Math.hypot(shot.vx, shot.vy) || 1;
    const a = (shot.angle + deg) * Math.PI / 180;
    return Object.assign({}, shot, {
      vx: shot.vx / h * v * Math.cos(a), vy: shot.vy / h * v * Math.cos(a), vz: v * Math.sin(a), angle: shot.angle + deg,
    });
  }

  // A launched ball's whole flight, one sample per physics step, with the
  // same sim times practice will reach (t0 + dt + dt ...). Pure.
  function tracePath(ball, t0, cfg) {
    cfg = cfg || CONFIG;
    const b = Object.assign({}, ball), pts = [];
    let t = t0;
    pts.push({ t, X: b.X, Y: b.Y, H: b.H, vy: b.vy, phase: b.phase });
    for (let i = 0; i < 6 / cfg.dt && b.phase !== 'dead' && b.phase !== 'net' && !b.rolling; i++) {
      step(b, cfg); t += cfg.dt;
      pts.push({ t, X: b.X, Y: b.Y, H: b.H, vy: b.vy, phase: b.phase });
    }
    return pts;
  }

  // When and where the ball on `path` crosses the plane Y = planeY, in the
  // wanted phase ('bounced' or 'flight'). Returns the crossing ({t, X, Y,
  // H, vy}; t may be in the past) or null, and notes an unbounced
  // crossing on `seen`.
  function crossAt(path, planeY, phase, seen) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if (a.Y < planeY && b.Y >= planeY) {
        if (b.phase !== phase) { if (seen && b.phase === 'flight') seen.unbounced = true; continue; }
        const f = (planeY - a.Y) / (b.Y - a.Y);
        return { t: lerp(a.t, b.t, f), X: lerp(a.X, b.X, f), Y: planeY, H: lerp(a.H, b.H, f), vy: b.vy };
      }
    }
    return null;
  }

  // Groundstroke crossing of planeY. kind: 'ok' (with t, X, Y, H, vy),
  // 'deep' (it only crosses before bouncing: it gets past you), 'short'
  // (it dies first), 'none' (no path).
  function predictCrossing(path, planeY) {
    if (!path) return { kind: 'none' };
    const seen = {};
    const x = crossAt(path, planeY, 'bounced', seen);
    if (x) return Object.assign({ kind: 'ok', stroke: 'ground' }, x);
    return { kind: seen.unbounced ? 'deep' : 'short' };
  }

  // The contact a player at p would make with the ball on `path`, by
  // situation: in MID or NET, a ball that reaches them before bouncing is
  // a volley, or a smash if it's high; otherwise a groundstroke after the
  // bounce. Adds stroke ('ground', 'volley', 'smash') to predictCrossing's
  // result.
  function predictFor(path, p, cfg) {
    cfg = cfg || CONFIG;
    if (!path) return { kind: 'none' };
    if (zoneOf(p.Y, cfg) !== 'BACK') {
      const v = contactFor(cfg, 'volley'), sm = contactFor(cfg, 'smash');
      const xv = crossAt(path, p.Y - v.ahead, 'flight');
      if (xv && xv.H >= sm.minH) {
        const xs = crossAt(path, p.Y - sm.ahead, 'flight');
        if (xs) return Object.assign({ kind: 'ok', stroke: 'smash' }, xs);
      }
      if (xv && xv.H >= v.minH) return Object.assign({ kind: 'ok', stroke: 'volley' }, xv);
      const g = predictCrossing(path, p.Y - contactFor(cfg, 'ground').ahead);
      if (g.kind === 'ok' || !xv) return g;
      return Object.assign({ kind: 'ok', stroke: 'volley' }, xv); // too low, and it never comes up
    }
    return predictCrossing(path, p.Y - cfg.contact.ahead);
  }
  // Is a ball on its way to this player? Practice: fed by the machine;
  // match: hit by the opponent.
  function incoming(pr) { return pr.live && pr.hitBy != null && pr.hitBy !== 'player'; }
  function predictContact(pr) {
    if (!incoming(pr)) return { kind: 'none' };
    // A serve must bounce before it's returned.
    if (pr.mustBounce) return predictCrossing(pr.path, pr.player.Y - pr.cfg.contact.ahead);
    return predictFor(pr.path, pr.player, pr.cfg);
  }

  // Is a sample hittable at a comfortable height as this stroke kind?
  function inBand(s, cfg, kind) {
    const c = contactFor(cfg, kind || 'ground'), m = cfg.feed.hMargin;
    const phaseOk = kind && kind !== 'ground' ? s.phase === 'flight' && s.Y > COURT.netY : s.phase === 'bounced';
    return phaseOk && s.H >= c.minH + m && s.H <= c.maxH - m;
  }

  const KINDS = ['ground', 'volley', 'smash'];

  // Can a player at `from` (at sim time tNow) get to a stance that puts
  // some hittable point of `path` at their ideal contact point, before the
  // swing has to start? Groundstrokes after the bounce from anywhere;
  // volleys and smashes before it, from MID or NET. Returns the plan with
  // the most time to spare ({ X, Y, t, slack, F, stroke, byStroke }, slack
  // in s, >= 0 means reachable; byStroke = the best plan per stroke kind),
  // or null if no point of the path is hittable from inside the bounds.
  // opts.score(plan, sample) ranks plans instead of slack (the CPU);
  // opts.speedMul / opts.reaction replace the player's speed and reaction;
  // opts.euclid times a diagonal run as the stick really allows (one
  // stick, magnitude at most 1) instead of both axes at full speed.
  function reachPlan(path, from, cfg, tNow, opts) {
    cfg = cfg || CONFIG;
    const pl = cfg.player, B = playerBounds(cfg);
    let best = null;
    const byStroke = {};
    for (const kind of KINDS) {
      const c = contactFor(cfg, kind), bs = swingPreset(cfg, 'top', kind).backswing;
      for (let i = 0; i < path.length; i += 2) {
        const s = path[i];
        if (!inBand(s, cfg, kind)) continue;
        if (kind === 'volley' && s.H >= contactFor(cfg, 'smash').minH) continue; // that's a smash
        for (const F of [1, -1]) {
          const X = s.X - F * c.side, Y = s.Y + c.ahead;
          if (X < B.minX || X > B.maxX || Y < B.minY || Y > B.maxY) continue;
          if (kind !== 'ground' && zoneOf(Y, cfg) === 'BACK') continue;
          const sm = (opts && opts.speedMul) || 1, react = opts && opts.reaction != null ? opts.reaction : cfg.feed.reaction;
          const tx = Math.abs(X - from.X) / (pl.speedX * sm), ty = Math.abs(Y - from.Y) / (pl.speedY * sm);
          const need = (opts && opts.euclid ? Math.hypot(tx, ty) : Math.max(tx, ty)) + react;
          const slack = s.t - tNow - bs - need;
          const plan = { X, Y, t: s.t, slack, F, stroke: kind };
          plan.score = opts && opts.score ? opts.score(plan, s) : slack;
          if (!byStroke[kind] || plan.score > byStroke[kind].score) byStroke[kind] = plan;
          if (!best || plan.score > best.score) best = plan;
        }
      }
    }
    if (best) best.byStroke = byStroke;
    return best;
  }

  // Assist target: the stance for the predicted contact. Stay at this
  // depth if the ball will be at a good height here; otherwise the nearest
  // stance (any stroke kind) where it is.
  function assistTarget(pr) {
    const cfg = pr.cfg, p = pr.player, B = playerBounds(cfg);
    const pred = predictContact(pr);
    if (pred.kind === 'ok' && pred.t > pr.t && inBand(Object.assign({ phase: pred.stroke === 'ground' ? 'bounced' : 'flight' }, pred), cfg, pred.stroke)) {
      const c = contactFor(cfg, pred.stroke), F = strokeFor(pred.X - p.X, cfg) === 'fh' ? 1 : -1;
      return { X: clamp(pred.X - F * c.side, B.minX, B.maxX), Y: p.Y, stroke: pred.stroke };
    }
    let best = null, bestD = Infinity;
    for (const kind of pr.mustBounce ? ['ground'] : KINDS) {
      const c = contactFor(cfg, kind);
      for (const s of pr.path || []) {
        if (s.t <= pr.t + cfg.swing.backswing || !inBand(s, cfg, kind)) continue;
        const Y = s.Y + c.ahead;
        if (Y < B.minY || Y > B.maxY || (kind !== 'ground' && zoneOf(Y, cfg) === 'BACK')) continue;
        const F = strokeFor(s.X - p.X, cfg) === 'fh' ? 1 : -1;
        const X = clamp(s.X - F * c.side, B.minX, B.maxX);
        const d = Math.abs(Y - p.Y) + 0.3 * Math.abs(X - p.X);
        if (d < bestD) { bestD = d; best = { X, Y, stroke: kind }; }
      }
    }
    return best;
  }

  function createPractice(seed, cfg) {
    cfg = cfg || CONFIG;
    const pl = cfg.player;
    return {
      cfg, rand: rng(seed == null ? 1 : seed), ball: createBall(),
      mode: 'auto', cycle: 0, t: 0, wait: cfg.feed.first,
      pace: cfg.feed.pace, assist: cfg.assist.level,
      player: { X: pl.startX, Y: pl.startY, vx: 0, vy: 0 },
      swing: { t0: null, bs: cfg.swing.backswing, shot: null, done: true, stroke: 'fh', result: null },
      pending: null, queue: [], live: false, hitBy: null, whiffed: false,
      path: null, crossing: null, prevRel: null,
      rally: 0, best: 0, last: null, shotKey: null, aim: null,
      misses: {}, taps: { n: 0, sum: 0 },
    };
  }

  // Queue a swing tapped at sim time t (pr.t's clock).
  // opts (swipe play): { touch: true, aim: {x, y} (used instead of the
  // stick at contact), curve (sidespin, rad/s) }.
  function requestSwing(pr, shot, t, opts) {
    pr.queue.push(Object.assign({ shot, t: (t == null ? pr.t : t) - pr.cfg.timing.inputLagMs / 1000 }, opts || null));
  }

  // Plan a tap: when the swing starts and how long its backswing is.
  function planSwing(pr, r) {
    const cfg = pr.cfg;
    const pred = predictContact(pr);
    const T = timingFor(cfg, pred.stroke, r.touch);
    const sw = swingPreset(cfg, r.shot, pred.stroke || 'ground');
    const plan = { shot: r.shot, tap: r.t, start: r.t, bs: sw.backswing, tapErr: null, kind: pred.kind, predX: pred.X,
      stroke: pred.stroke || 'ground', follow: sw.follow, recovery: sw.recovery,
      req: r, touch: !!r.touch, aim: r.aim || null, curve: r.curve || 0 };
    // A swipe waits for a ball it can't yet reach (the player is still
    // getting to it); it is planned again every step until it starts.
    if (r.touch && pred.kind !== 'ok') plan.start = Infinity;
    if (pred.kind === 'ok') {
      const ideal = pred.t - sw.backswing;
      plan.tapErr = (r.t - ideal) * 1000;
      if (plan.tapErr < 0 && plan.tapErr >= -(T.bufferMs + T.earlyGraceMs)) plan.start = ideal; // buffered
      else if (plan.tapErr > 0) plan.bs = Math.max(sw.minBackswing, sw.backswing - plan.tapErr / 1000); // catch up
    }
    return plan;
  }

  function startSwing(pr, plan, ev) {
    const b = pr.ball;
    const guessX = plan.predX != null ? plan.predX : b.phase === 'idle' ? b.X : b.X + b.vx * plan.bs;
    pr.swing = {
      t0: plan.start, bs: plan.bs, shot: plan.shot, done: false, stroke: strokeFor(guessX - pr.player.X, pr.cfg),
      result: null, tapErr: plan.tapErr, kind: plan.kind, strokeKind: plan.stroke, follow: plan.follow, recovery: plan.recovery,
      touch: plan.touch, aim: plan.aim, curve: plan.curve,
    };
    pr.pending = null;
    ev.push({ type: 'swing', shot: plan.shot, t: plan.start, tap: plan.tap, tapErr: plan.tapErr, bs: plan.bs, stroke: plan.stroke });
  }

  // Take the taps that fall before t1: plan each (buffered, on time or
  // catching up), one swing at a time. A swipe replaces a waiting one and
  // is ignored when no ball is on its way; a waiting swipe is planned
  // again each step, because the player is still moving.
  function takeTaps(pr, t1, ev) {
    pr.queue.sort((a, c) => a.t - c.t);
    while (pr.queue.length && pr.queue[0].t < t1) {
      const r = pr.queue.shift(), s = pr.swing;
      if (r.touch && (!incoming(pr) || pr.whiffed)) continue;
      if (pr.pending && !(r.touch && pr.pending.touch)) continue;
      if (swingPhase(s.t0 == null ? null : r.t - s.t0, pr.cfg, s.bs, s) !== 'ready') continue;
      const plan = planSwing(pr, r);
      if (plan.tapErr != null && !pr.pending) { pr.taps.n++; pr.taps.sum += plan.tapErr; }
      pr.pending = plan;
    }
    if (pr.pending && pr.pending.touch) pr.pending = incoming(pr) ? planSwing(pr, pr.pending.req) : null;
    if (pr.pending && pr.pending.start < t1) startSwing(pr, pr.pending, ev);
  }

  function swinging(pr) {
    const s = pr.swing;
    return pr.pending != null || swingPhase(s.t0 == null ? null : pr.t - s.t0, pr.cfg, s.bs, s) !== 'ready';
  }

  // Move v towards target; accelerate when pushing on, decelerate when
  // stopping, slowing or reversing.
  function approach(v, target, acc, dec, dt) {
    const stopping = target === 0 || v * target < 0 || Math.abs(target) < Math.abs(v);
    const r = (stopping ? dec : acc) * dt;
    return v < target ? Math.min(target, v + r) : Math.max(target, v - r);
  }

  function movePlayer(pr, stick, dt) {
    const cfg = pr.cfg, pl = cfg.player, p = pr.player, B = playerBounds(cfg);
    let sx = stick.x || 0, sy = stick.y || 0;
    const m = Math.hypot(sx, sy);
    if (m > 1) { sx /= m; sy /= m; }
    if (m < pl.deadzone) { sx = 0; sy = 0; }
    const s = pr.swing;
    const ph = swingPhase(s.t0 == null ? null : pr.t - s.t0, cfg, s.bs, s);
    const k = (ph === 'backswing' || ph === 'contact' || ph === 'follow-through') ? pl.swingMove : 1;
    let tx = sx * pl.speedX * k, ty = sy * pl.speedY * k;
    // Assist: only on an idle stick axis, while a fed ball is inbound and
    // the swing hasn't started.
    const aSpeed = cfg.assist.speed[pr.assist] || 0;
    if (aSpeed > 0 && incoming(pr) && !pr.whiffed && ph === 'ready' && !(s.t0 != null && !s.done)) {
      const tgt = assistTarget(pr);
      if (tgt) {
        if (Math.abs(stick.x || 0) < pl.deadzone) tx = clamp((tgt.X - p.X) * cfg.assist.gain, -aSpeed, aSpeed);
        if (Math.abs(stick.y || 0) < pl.deadzone) ty = clamp((tgt.Y - p.Y) * cfg.assist.gain, -aSpeed, aSpeed);
      }
    }
    p.vx = approach(p.vx, tx, pl.accel, pl.decel, dt);
    p.vy = approach(p.vy, ty, pl.accel, pl.decel, dt);
    p.X += p.vx * dt; p.Y += p.vy * dt;
    if (p.X < B.minX || p.X > B.maxX) { p.X = clamp(p.X, B.minX, B.maxX); p.vx = 0; }
    if (p.Y < B.minY || p.Y > B.maxY) { p.Y = clamp(p.Y, B.minY, B.maxY); p.vy = 0; }
  }

  function endPoint(pr) { pr.live = false; pr.wait = pr.cfg.feed.delay; pr.path = null; pr.pending = null; }

  // Feed speed multiplier for a shot at the current pace setting.
  function feedPace(pr, key) {
    return Math.max(pr.pace, pr.cfg.feed.minPace[key] || 0);
  }

  // Feed a ball the player can reach from where they stand. Candidates
  // move from a normal deep feed towards one landing in front of the
  // player; the first reachable one goes (or the best of them).
  function pickFeed(pr) {
    if (pr.mode !== 'auto') return pr.mode;
    const list = pr.cfg.feed.auto;
    return list[pr.cycle++ % list.length];
  }

  // Feed a ball the player can reach from where they stand. Candidates
  // move from the mode's usual target towards one landing in front of the
  // player (or, for volley and overhead feeds, just behind them); then
  // slower, higher ones. The first one with time to spare goes, else the
  // best. Volley and overhead feeds to a player at MID or NET look for one
  // they can volley or smash first.
  function feed(pr, ev) {
    const cfg = pr.cfg, R = pr.rand, FD = cfg.feed, p = pr.player;
    const mode = pickFeed(pr), spec = FD.modes[mode] || { shot: mode }, key = spec.shot, def = cfg.shots[key];
    const from = { side: 'far', X: (R() - 0.5) * 2, Y: cfg.farContactY, H: cfg.contactHeight };
    const pace = spec.pace || feedPace(pr, key);
    const opts = { clearNet: true };
    const prefer = spec.prefer && zoneOf(p.Y, cfg) !== 'BACK' ? spec.prefer : null;
    const ok = c => c && c.slack >= FD.margin;
    let best = null, bestPref = null;
    for (let n = 0; n < FD.tries * FD.slower.length && !(prefer ? ok(bestPref) : ok(best)); n++) {
      const i = n % FD.tries, k = i / (FD.tries - 1);
      const step = Math.floor(n / FD.tries);
      opts.speedMul = pace * FD.slower[step];
      opts.angles = spec.angles || (step ? FD.slowAngles : FD.angles[key]);
      const deepX = (R() * 2 - 1) * FD.width, jitter = (R() - 0.5) * 1.5;
      let baseY, nearY;
      if (spec.behind != null) {
        baseY = clamp(p.Y + spec.behind + jitter * 0.5, COURT.netY + 3, COURT.length - 0.6);
        nearY = clamp(p.Y + 0.8, COURT.netY + 2, COURT.length - 0.6);
      } else {
        baseY = spec.land != null ? COURT.netY + spec.land + jitter * 0.5 : COURT.length - (def.depth + jitter);
        nearY = clamp(p.Y - FD.leadIn, COURT.netY + 2, COURT.length - 1);
      }
      const target = { X: lerp(deepX, clamp(p.X, -FD.width, FD.width), k), Y: lerp(baseY, nearY, k) };
      const shot = solveShot(from, target, key, cfg, opts);
      const b = createBall();
      launch(b, from, shot);
      const path = tracePath(b, pr.t, cfg);
      const plan = reachPlan(path, p, cfg, pr.t);
      const slack = plan ? plan.slack : -Infinity;
      const cand = { target, shot, path, slack, plan };
      if (!best || slack > best.slack) best = cand;
      const ps = prefer && plan && plan.byStroke[prefer];
      if (ps && (!bestPref || ps.slack > bestPref.slack)) bestPref = Object.assign({}, cand, { slack: ps.slack });
    }
    if (prefer && ok(bestPref)) best = bestPref;
    launch(pr.ball, from, best.shot);
    pr.path = best.path; pr.crossing = null; pr.prevRel = null;
    pr.live = true; pr.hitBy = 'machine'; pr.whiffed = false;
    pr.shotKey = key; pr.aim = { target: best.target, miss: null };
    ev.push({ type: 'hit', by: 'machine', side: 'far', X: from.X, Y: from.Y, H: from.H, shot: key, mode, angle: best.shot.angle,
      landing: firstBounce(best.path), reachable: best.slack >= FD.margin });
  }

  function firstBounce(path) {
    for (let i = 1; i < path.length; i++) {
      if (path[i - 1].phase === 'flight' && path[i].phase !== 'flight') return { X: path[i].X, Y: path[i].Y, t: path[i].t };
    }
    return null;
  }

  // Why a fed ball the player never hit got away, from where it crossed
  // their contact plane (or didn't).
  function missReason(pr) {
    const cfg = pr.cfg, x = pr.crossing;
    if (!x) return 'short';
    let kind = 'ground';
    if (x.phase !== 'bounced') {
      if (zoneOf(x.pY, cfg) === 'BACK') return 'deep';  // past you before bouncing
      kind = x.H >= contactFor(cfg, 'smash').minH ? 'smash' : 'volley';
    }
    const c = contactFor(cfg, kind);
    if (x.H > c.maxH) return 'deep';
    if (x.H < c.minH) return 'short';
    const F = strokeFor(x.X - x.pX, cfg) === 'fh' ? 1 : -1, idealX = x.pX + F * c.side;
    if (Math.abs(x.X - idealX) > c.reach) return x.X < idealX ? 'left' : 'right';
    return 'noswing';
  }

  function countMiss(pr, reason) {
    if (!reason || reason === 'none') return;
    pr.misses[reason] = (pr.misses[reason] || 0) + 1;
  }

  // The contact instant of pr's swing, if it falls in the step that ends
  // at t1: judge it and, on a hit, aim and solve the return in pr's own
  // frame (nothing is launched). adjust(aim, j) may change the aim first
  // (the CPU's margins and scatter). Returns null (no contact this step)
  // or { j, bs, live } plus { aim, shot, from } on a hit.
  function swingContact(pr, stick, t1, live, adjust) {
    const cfg = pr.cfg, b = pr.ball, s = pr.swing;
    if (s.done || s.t0 == null || t1 < s.t0 + s.bs) return null;
    s.done = true;
    const back = s.t0 + s.bs - t1; // <= 0: rewind to the exact instant
    const bs = {
      X: b.X + b.vx * back, Y: b.Y + b.vy * back, H: Math.max(cfg.ballRadius, b.H + b.vz * back), vy: b.vy,
      live, phase: b.phase,
    };
    const j = judgeContact(bs, pr.player, cfg, { tapErr: s.tapErr, kind: s.kind, stroke: s.strokeKind, touch: s.touch });
    if (s.aim) stick = s.aim;
    s.stroke = j.stroke; s.result = j; pr.last = j;
    const out = { j, bs, live };
    if (!j.contact) return out;
    let aim = aimReturn(j, stick, s.shot, cfg, pr.rand, Math.hypot(b.vx, b.vy, b.vz));
    if (adjust) aim = adjust(aim, j) || aim;
    if (s.touch && !j.perfect && !aim.mishit) {
      const sc = timingFor(cfg, j.kind, true).scatter;
      const sd = (sc.base + sc.poor * (1 - j.quality)) * (sc[aim.defKey] || 1);
      aim.target = { X: aim.target.X + gauss(pr.rand) * sd, Y: Math.min(COURT.netY - 0.8, aim.target.Y + gauss(pr.rand) * sd) };
    }
    const from = { side: 'near', X: bs.X, Y: bs.Y, H: bs.H };
    const curve = s.curve && !aim.mishit && j.kind === 'ground' && (aim.defKey === 'flat' || aim.defKey === 'top') ? s.curve : 0;
    let shot = solveCurved(from, aim.target, aim.defKey, cfg, { speedMul: aim.pace, clearNet: !aim.noClear, angles: aim.angles, curve });
    out.curve = curve;
    if (aim.lift) shot = liftShot(shot, aim.lift);
    if (aim.spinMul != null && aim.spinMul !== 1) shot = Object.assign({}, shot, { spin: shot.spin * aim.spinMul });
    return Object.assign(out, { aim, shot, from });
  }

  // Advance practice by one fixed step. input = { stick: {x, y} } with x,y
  // in -1..1 (y -1 = up = towards the net). Returns events for the renderer.
  function practiceStep(pr, input) {
    const cfg = pr.cfg, dt = cfg.dt, b = pr.ball, ev = [];
    const stick = (input && input.stick) || { x: 0, y: 0 };
    const t1 = pr.t + dt;

    // Taps that fall inside this step: plan each (buffered, on time or
    // catching up); one swing at a time.
    takeTaps(pr, t1, ev);

    movePlayer(pr, stick, dt);

    if (pr.wait > 0) {
      pr.wait -= dt;
      if (pr.wait <= 0) { pr.wait = 0; feed(pr, ev); }
    }

    // Ball.
    for (const e of step(b, cfg)) {
      ev.push(e);
      if (e.type === 'bounce' && e.n === 1 && pr.live) {
        if (pr.hitBy === 'player') {
          if (e.result === 'IN') { pr.rally++; pr.best = Math.max(pr.best, pr.rally); }
          else pr.rally = 0;
          ev.push({ type: 'return', result: e.result, X: e.X, Y: e.Y, rally: pr.rally });
          endPoint(pr);
        } else if (e.result !== 'IN') {
          ev.push({ type: 'feedFault', result: e.result });
          endPoint(pr);
        }
      }
    }
    pr.t = t1;

    // Where a fed ball first crosses the player's contact plane (for the
    // reason when it's never hit).
    if (pr.live && pr.hitBy === 'machine') {
      const rel = b.Y - (pr.player.Y - cfg.contact.ahead);
      if (!pr.crossing && pr.prevRel != null && pr.prevRel < 0 && rel >= 0) {
        pr.crossing = { X: b.X, H: b.H, phase: b.phase, pX: pr.player.X, pY: pr.player.Y };
      }
      pr.prevRel = rel;
    }

    // Contact instant reached this step?
    const s = pr.swing;
    const c = swingContact(pr, stick, t1, pr.live && pr.hitBy === 'machine');
    if (c) {
      const j = c.j, live = c.live;
      if (j.contact) {
        const { aim, shot, from } = c;
        launch(b, from, shot);
        pr.hitBy = 'player'; pr.shotKey = s.shot; pr.aim = { target: aim.target, miss: aim.mishit }; pr.path = null;
        ev.push(Object.assign({ type: 'hit', by: 'player', side: 'near', X: from.X, Y: from.Y, H: from.H,
          shot: s.shot, label: strokeLabel(j.kind, s.shot, cfg, c.curve), curve: c.curve, speed: Math.hypot(shot.vx, shot.vy, shot.vz), angle: shot.angle, target: aim.target, pace: aim.pace, mishit: aim.mishit, risk: aim.risk || null,
          stick: { x: stick.x || 0, y: stick.y || 0 } }, j));
      } else {
        if (live) { pr.whiffed = true; countMiss(pr, j.reason); }
        ev.push(Object.assign({ type: 'whiff', live }, j));
      }
    }

    // A fed ball that got past the player.
    if (pr.live && pr.hitBy === 'machine' && s.done && (!pr.pending || pr.pending.start === Infinity)) {
      const off = b.Y > cfg.player.maxY + 2.2 || Math.abs(b.X) > 9 || b.t > 6;
      if (b.phase === 'dead' || b.phase === 'net' || off) {
        pr.rally = 0;
        const reason = pr.whiffed ? null : missReason(pr);
        countMiss(pr, reason);
        ev.push({ type: 'missed', whiffed: pr.whiffed, reason });
        endPoint(pr);
      }
    }
    if (pr.live && pr.hitBy === 'player' && b.t > 6) endPoint(pr);
    return ev;
  }

  // ---------------------------------------------------------------------
  // Match rules (Stage 3): scoring, serve legality and the point referee.
  // Players are indexed 0 = near (you), 1 = far (the CPU).
  // ---------------------------------------------------------------------
  const SIDES = ['near', 'far'];
  const POINT_NAMES = ['0', '15', '30', '40'];

  function createScore(formatKey, cfg, firstServer) {
    cfg = cfg || CONFIG;
    const key = cfg.match.formats[formatKey] ? formatKey : cfg.match.defaultFormat;
    return {
      format: key, f: cfg.match.formats[key],
      sets: [[0, 0]], tbScores: [null], points: [0, 0], tiebreak: false, tbFirst: null,
      server: firstServer || 0, setsWon: [0, 0], winner: null,
    };
  }

  // Who serves the next point. In a game it's the game's server; in a
  // tie-break the player whose turn it was serves one point, then the
  // serve changes every two points.
  function serverOf(sc) {
    if (!sc.tiebreak) return sc.server;
    const n = sc.points[0] + sc.points[1];
    if (n === 0) return sc.tbFirst;
    return Math.floor((n - 1) / 2) % 2 === 0 ? 1 - sc.tbFirst : sc.tbFirst;
  }

  // Deuce court after an even number of points in the game (or tie-break).
  function courtOf(sc) { return (sc.points[0] + sc.points[1]) % 2 === 0 ? 'deuce' : 'ad'; }

  // Record a point for `who`. Returns the events it caused, in order:
  // point, then game / tiebreak / set / match as they happen.
  function pointWon(sc, who) {
    if (sc.winner != null) return [];
    const ev = [{ type: 'point', who }], p = sc.points, other = 1 - who;
    p[who]++;
    const need = sc.tiebreak ? sc.f.tbPoints : 4;
    if (p[who] >= need && p[who] - p[other] >= 2) winGame(sc, who, ev);
    return ev;
  }

  function winGame(sc, who, ev) {
    const si = sc.sets.length - 1, g = sc.sets[si], F = sc.f, tb = sc.tiebreak;
    g[who]++;
    if (tb) sc.tbScores[si] = sc.points.slice();
    sc.points = [0, 0];
    ev.push({ type: 'game', who, tiebreak: tb, games: g.slice() });
    // After a tie-break the receiver of its first point serves next, as if
    // the tie-break had been one game.
    sc.server = tb ? 1 - sc.tbFirst : 1 - sc.server;
    sc.tiebreak = false;
    if (tb || (g[who] >= F.games && g[who] - g[1 - who] >= 2)) {
      sc.setsWon[who]++;
      ev.push({ type: 'set', who, games: g.slice(), tb: sc.tbScores[si] });
      if (sc.setsWon[who] >= Math.ceil(F.bestOf / 2)) {
        sc.winner = who;
        ev.push({ type: 'match', who });
      } else { sc.sets.push([0, 0]); sc.tbScores.push(null); }
    } else if (g[0] === F.tiebreakAt && g[1] === F.tiebreakAt) {
      sc.tiebreak = true; sc.tbFirst = sc.server;
      ev.push({ type: 'tiebreak' });
    }
  }

  // The points as a player would call them, server first ("30–15",
  // "DEUCE", "ADV YOU"); a tie-break counts 1, 2, 3.
  function pointsText(sc, names) {
    names = names || ['YOU', 'CPU'];
    const p = sc.points, s = serverOf(sc), r = 1 - s;
    if (sc.tiebreak) return p[s] + '–' + p[r];
    if (p[0] >= 3 && p[1] >= 3) return p[0] === p[1] ? 'DEUCE' : 'ADV ' + names[p[0] > p[1] ? 0 : 1];
    return POINT_NAMES[p[s]] + '–' + POINT_NAMES[p[r]];
  }

  // The service box a serve from `serverSide` into `court` must land in.
  // Deuce court: the server stands to the right of the centre mark (as
  // they face the net) and serves across into the receiver's right box.
  function serviceBox(serverSide, court) {
    const sgn = serverSide === 'near' ? 1 : -1, toX = court === 'deuce' ? -sgn : sgn;
    const yNear = serverSide === 'near' ? COURT.netY - COURT.serviceFromNet : COURT.netY;
    return {
      minX: toX > 0 ? 0 : -COURT.singlesHalf, maxX: toX > 0 ? COURT.singlesHalf : 0,
      minY: yNear, maxY: yNear + COURT.serviceFromNet,
    };
  }

  // A serve's first bounce: 'IN' (lines count), 'OUT_LONG' (past the
  // service line), 'OUT_WIDE' (past the sideline or the centre line) or
  // 'NET' (on the server's side).
  function judgeServe(X, Y, serverSide, court) {
    const box = serviceBox(serverSide, court);
    const farHalf = Y <= COURT.netY;
    if ((serverSide === 'near') !== farHalf) return 'NET';
    if (Y < box.minY || Y > box.maxY) return 'OUT_LONG';
    if (X < box.minX || X > box.maxX) return 'OUT_WIDE';
    return 'IN';
  }

  // The referee for one point. It is told about every contact (refHit) and
  // reads the ball's events (refBall); either may end the point.
  //   { type: 'point', winner, reason: 'ACE' | 'WINNER' | 'OUT' | 'NET', by }
  //   { type: 'fault', reason: 'OUT' | 'NET' }  (the match decides double faults)
  //   { type: 'let' }
  // by = the player whose shot decided it.
  function createRally(server, court) {
    return { server, court, hitter: server, serve: true, hits: 0, touched: false, bounced: false, over: null };
  }

  function refHit(r, who) {
    if (r.over) return;
    if (r.hits > 0 && who !== r.hitter) { r.serve = false; r.touched = true; }
    r.hitter = who; r.hits++; r.bounced = false;
  }

  function refBall(r, ball, events, cfg) {
    cfg = cfg || CONFIG;
    if (r.over || r.hits === 0) return r.over;
    const h = r.hitter, o = 1 - h;
    const end = (winner, reason) => { r.over = { type: 'point', winner, reason, by: h }; };
    for (const e of events) {
      if (r.over) break;
      if (e.type === 'net' && e.stopped) {
        if (r.serve) r.over = { type: 'fault', reason: 'NET', by: h };
        else end(o, 'NET');
      } else if (e.type === 'bounce' && e.n === 1 && !r.bounced) {
        if (r.serve) {
          const res = ball.phase === 'net' ? 'NET' : judgeServe(e.X, e.Y, SIDES[h], r.court);
          if (res !== 'IN') r.over = { type: 'fault', reason: res === 'NET' ? 'NET' : 'OUT', by: h };
          else if (ball.touchedNet) r.over = { type: 'let', by: h };
          else r.bounced = true;
        } else if (e.result !== 'IN') end(o, e.result === 'NET' ? 'NET' : 'OUT');
        else r.bounced = true;
      } else if (e.type === 'bounce' && r.bounced) {
        end(h, r.serve && !r.touched ? 'ACE' : 'WINNER');
      }
    }
    if (!r.over && r.bounced) {
      const off = ball.Y < -cfg.match.offCourt || ball.Y > COURT.length + cfg.match.offCourt || Math.abs(ball.X) > 9;
      if (ball.rolling || off || ball.t > cfg.match.maxPoint) end(h, r.serve && !r.touched ? 'ACE' : 'WINNER');
    }
    return r.over;
  }

  // ---------------------------------------------------------------------
  // Match play (Stage 3). Both players are "actors" shaped like practice
  // state, so planSwing, movePlayer, predictContact, assistTarget and
  // swingContact work on them unchanged. Each actor sees the court in its
  // own frame: the near player's is the real one; the far player's is
  // turned 180 degrees (X -> -X, Y -> length - Y), so it too stands at
  // the bottom and hits up the court. The physics is symmetric under that
  // turn, so the far player plays with exactly the same physics, shots and
  // aim solver as the near one.
  // ---------------------------------------------------------------------
  function mirrorBallInto(dst, b) {
    Object.assign(dst, b);
    dst.X = -b.X; dst.Y = COURT.length - b.Y; dst.vx = -b.vx; dst.vy = -b.vy; dst.ax = -b.ax; dst.ay = -b.ay;
    dst.side = b.side === 'near' ? 'far' : 'near';
    return dst;
  }
  function mirrorPath(path) {
    return path.map(s => ({ t: s.t, X: -s.X, Y: COURT.length - s.Y, H: s.H, vy: -s.vy, phase: s.phase }));
  }
  // An actor's own-frame point in real court coordinates (and back: the
  // turn is its own inverse).
  function toReal(a, p) { return a.side === 'near' ? { X: p.X, Y: p.Y } : { X: -p.X, Y: COURT.length - p.Y }; }

  // Standard normal from the seeded RNG (Box-Muller).
  function gauss(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }

  function createActor(m, side, ctl) {
    const cfg = m.cfg, pl = cfg.player;
    return {
      side, idx: side === 'near' ? 0 : 1, ctl, cfg, rand: m.rand, t: 0,
      ball: side === 'near' ? m.ball : createBall(),
      player: { X: pl.startX, Y: pl.startY, vx: 0, vy: 0 },
      swing: { t0: null, bs: cfg.swing.backswing, shot: null, done: true, stroke: 'fh', result: null },
      pending: null, queue: [], live: false, hitBy: null, whiffed: false, mustBounce: false, path: null,
      assist: ctl === 'human' ? cfg.assist.level : 'off', taps: { n: 0, sum: 0 }, misses: {}, last: null,
      stick: { x: 0, y: 0 }, cpu: null,
    };
  }

  function newStats() { return { points: 0, aces: 0, doubleFaults: 0, winners: 0, errors: 0, serves: 0, firstIn: 0 }; }

  // opts: { seed, format, near: 'human' | 'none' | CPU level, far: ...,
  // serveDrill (true: the near player serves every point, no score) }.
  function createMatch(opts, cfg) {
    opts = opts || {}; cfg = cfg || CONFIG;
    const rand = rng(opts.seed == null ? 1 : opts.seed);
    const m = {
      cfg, rand, t: 0, ball: createBall(), path: null,
      phase: 'pre', timer: 0, serveNo: 1, serve: null, rally: null, call: null, banner: null,
      stats: [newStats(), newStats()], longest: 0, points: 0, drill: !!opts.serveDrill, drillN: 0,
      humanStick: { x: 0, y: 0 }, winner: null, names: opts.names || ['YOU', 'CPU'],
    };
    m.actors = [createActor(m, 'near', opts.near || 'human'), createActor(m, 'far', opts.far || 'none')];
    m.actors.forEach(a => { if (CPU_LEVELS && cfg.cpu && cfg.cpu[a.ctl]) a.cpu = createCpu(m, a); });
    const fs = cfg.match.firstServer;
    const first = m.drill ? 0 : fs === 'far' ? 1 : fs === 'random' ? (rand() < 0.5 ? 0 : 1) : 0;
    m.score = createScore(opts.format || cfg.match.defaultFormat, cfg, first);
    startPoint(m);
    return m;
  }

  function matchServer(m) { return m.drill ? 0 : serverOf(m.score); }
  function matchCourt(m) { return m.drill ? (m.drillN % 2 ? 'ad' : 'deuce') : courtOf(m.score); }

  // Where the server's toss is released, in the server's own frame.
  function handPos(cfg, a) {
    const h = cfg.serve.hand;
    return { X: a.player.X + h.side, Y: a.player.Y - h.ahead, H: h.H };
  }

  function resetActor(a) {
    a.live = false; a.hitBy = null; a.whiffed = false; a.mustBounce = false; a.path = null;
    a.pending = null; a.queue = [];
    a.swing = { t0: null, bs: a.cfg.swing.backswing, shot: null, done: true, stroke: 'fh', result: null };
    a.player.vx = 0; a.player.vy = 0;
    if (a.cpu) cpuReset(a);
  }

  // A new point: first serve, players to their spots.
  function startPoint(m) { m.serveNo = 1; placeForServe(m); }

  function placeForServe(m) {
    const cfg = m.cfg, sv = cfg.serve, si = matchServer(m), court = matchCourt(m), sgn = court === 'deuce' ? 1 : -1;
    m.actors.forEach(a => {
      resetActor(a);
      const spot = a.idx === si ? sv.stand : sv.receive;
      a.player.X = sgn * spot.offX; a.player.Y = COURT.length + spot.behind;
    });
    const srv = m.actors[si], hp = handPos(cfg, srv), rp = toReal(srv, hp), b = m.ball;
    Object.assign(b, createBall(), { X: rp.X, Y: rp.Y, H: hp.H, phase: 'held', side: srv.side });
    m.rally = null; m.path = null;
    m.phase = 'pre'; m.timer = cfg.match.preServe;
    m.serve = { server: si, court, state: 'wait', wait: 0, tossT0: null, peakT: null, tap: null };
  }

  function beginServe(m) {
    m.phase = 'serve';
    m.serve.state = 'wait'; m.serve.wait = m.cfg.serve.autoToss;
  }

  // Throw the toss up from the server's hand (sim time m.t).
  function tossNow(m, ev) {
    const cfg = m.cfg, S = m.serve, srv = m.actors[S.server], hp = handPos(cfg, srv), rp = toReal(srv, hp), b = m.ball;
    Object.assign(b, createBall(), { X: rp.X, Y: rp.Y, H: hp.H, vz: cfg.serve.tossVz, phase: 'toss', side: srv.side });
    // Time to the top of the toss, with drag, as the ball will fly it.
    const c = Object.assign({}, b);
    let n = 0;
    while (c.vz > 0 && n < 400) { step(c, cfg); n++; }
    S.state = 'toss'; S.tossT0 = m.t; S.peakT = n * cfg.dt; S.tap = null;
    ev.push({ type: 'toss', who: S.server });
  }

  function retoss(m, ev, why) {
    const cfg = m.cfg, S = m.serve, srv = m.actors[S.server], hp = handPos(cfg, srv), rp = toReal(srv, hp);
    Object.assign(m.ball, createBall(), { X: rp.X, Y: rp.Y, H: hp.H, phase: 'held', side: srv.side });
    S.state = 'wait'; S.wait = cfg.serve.retossDelay; S.tap = null;
    ev.push({ type: 'retoss', who: S.server, why });
  }

  // A shot button during a match. The serving player's first tap throws
  // the toss; the next Flat or Topspin tap is the serve. Otherwise it's a
  // swing, timed exactly as in practice.
  function matchSwing(m, shot, t, opts) {
    const me = m.actors[0];
    if (me.ctl !== 'human' || m.phase === 'over') return;
    t = t == null ? m.t : t;
    const S = m.serve;
    if (S && S.server === 0 && (m.phase === 'pre' || m.phase === 'serve')) {
      if (m.phase !== 'serve') return;
      if (S.state === 'wait') { tossNow(m, m.pendingEv || (m.pendingEv = [])); return; }
      if (S.state === 'toss' && !S.tap && m.cfg.serve.shots[shot]) {
        S.tap = { shot, t: t - m.cfg.timing.inputLagMs / 1000, stick: (opts && opts.aim) || null,
          touch: !!(opts && opts.touch), curve: (opts && opts.curve) || 0 };
      }
      return;
    }
    requestSwing(me, shot, t, opts);
  }

  // The serve's contact: judge the timing, aim in the box, scatter and
  // launch. Returns true if a ball was served.
  function serveContact(m, t1, ev) {
    const cfg = m.cfg, S = m.serve, a = m.actors[S.server], b = m.ball;
    const SV = S.tap.touch ? Object.assign({}, cfg.serve, cfg.serve.touch) : cfg.serve;
    const errMs = (S.tap.t - (S.tossT0 + S.peakT)) * 1000, ae = Math.abs(errMs);
    if (ae > SV.missMs) { retoss(m, ev, errMs < 0 ? 'early' : 'late'); return false; }
    const back = S.tap.t + SV.backswing - t1; // <= 0: rewind to the contact instant
    const own = a.side === 'near' ? { X: b.X, Y: b.Y } : { X: -b.X, Y: COURT.length - b.Y };
    const from = { side: 'near', X: own.X, Y: own.Y, H: Math.max(1.2, b.H + b.vz * back) };
    const perfect = ae <= SV.perfectMs, q = perfect ? 1 : table(SV.q, ae);
    const sv = m.serveNo === 1 ? SV.first : SV.second;
    const stick = S.tap.stick || (a.ctl === 'human' ? m.humanStick : { x: 0, y: 0 });
    const sx = clamp(stick.x || 0, -1, 1), sy = clamp(stick.y || 0, -1, 1);
    let margin = sv.margin;
    if (a.cpu) margin = Math.max(margin, a.cpu.lv.serveMargin + (m.serveNo === 1 ? 0 : 0.3));
    const box = serviceBox('near', S.court);
    let X = lerp(box.minX + margin, box.maxX - margin, (sx + 1) / 2);
    let Y = box.minY + margin + SV.band * (sy + 1) / 2;
    const target = { X, Y }, sigma = sv.spread + sv.spreadPoor * (1 - q);
    X += gauss(m.rand) * sigma; Y += gauss(m.rand) * sigma;
    const pace = (perfect ? SV.perfectPace : SV.paceMin + (1 - SV.paceMin) * q) * sv.pace;
    const key = SV.shots[S.tap.shot];
    let shot = solveCurved(from, { X, Y }, key, cfg, { speedMul: pace, clearNet: true, curve: S.tap.curve || 0 });
    const tilt = gauss(m.rand) * sv.angleErr * (1 - q);
    if (tilt) shot = liftShot(shot, tilt);
    const real = a.side === 'near' ? shot : Object.assign({}, shot, { vx: -shot.vx, vy: -shot.vy });
    const rf = toReal(a, from);
    launch(b, { side: a.side, X: rf.X, Y: rf.Y, H: from.H }, real);
    a.swing = { t0: S.tap.t, bs: SV.backswing, shot: S.tap.shot, done: true, stroke: 'fh', result: null,
      strokeKind: 'smash', follow: cfg.swing.smash.follow, recovery: cfg.swing.smash.recovery };
    m.stats[a.idx].serves++;
    m.rally = createRally(S.server, S.court);
    refHit(m.rally, S.server);
    m.phase = 'rally';
    afterHit(m, a);
    ev.push({ type: 'serve', who: a.idx, side: a.side, shot: S.tap.shot, label: S.tap.curve ? 'CURVE SERVE' : cfg.shots[key].name, serveNo: m.serveNo,
      curve: S.tap.curve || 0, speed: Math.hypot(shot.vx, shot.vy, shot.vz),
      errMs, quality: q, perfect, pace, X: rf.X, Y: rf.Y, H: from.H, target: toReal(a, target), aimed: toReal(a, { X, Y }) });
    return true;
  }

  // After a's contact: the ball is on its way to the other player.
  function afterHit(m, a) {
    const o = m.actors[1 - a.idx];
    a.live = false; a.hitBy = 'player'; a.path = null; a.mustBounce = false;
    const path = tracePath(m.ball, m.t, m.cfg);
    m.path = path;
    o.live = true; o.hitBy = 'opponent'; o.whiffed = false; o.mustBounce = !!(m.rally && m.rally.serve);
    o.path = o.side === 'near' ? path : mirrorPath(path);
    if (o.cpu) cpuIncoming(m, o);
    if (a.cpu) cpuHit(m, a);
  }

  // A rally contact for actor a (its swing reached contact this step).
  function actorContact(m, a, t1, ev) {
    const cfg = m.cfg, r = m.rally;
    const capped = a.ctl !== 'human' && r && r.hits >= cfg.match.rallyCap;
    const live = m.phase === 'rally' && incoming(a) && !capped;
    const aimStick = a.cpu ? a.cpu.aimStick || { x: 0, y: 0 } : a.stick;
    const c = swingContact(a, aimStick, t1, live, a.cpu ? (aim, j) => cpuAim(m, a, aim, j) : null);
    if (!c) return;
    const j = c.j;
    if (!j.contact) {
      if (live) { a.whiffed = true; countMiss(a, j.reason); }
      ev.push(Object.assign({ type: 'whiff', who: a.idx, side: a.side, live }, j));
      return;
    }
    const rf = toReal(a, c.from), real = a.side === 'near' ? c.shot : Object.assign({}, c.shot, { vx: -c.shot.vx, vy: -c.shot.vy });
    launch(m.ball, { side: a.side, X: rf.X, Y: rf.Y, H: c.from.H }, real);
    refHit(r, a.idx);
    afterHit(m, a);
    ev.push(Object.assign({ type: 'hit', who: a.idx, side: a.side, by: a.side, X: rf.X, Y: rf.Y, H: c.from.H,
      shot: a.swing.shot, label: strokeLabel(j.kind, a.swing.shot, cfg, c.curve), curve: c.curve, speed: Math.hypot(c.shot.vx, c.shot.vy, c.shot.vz), angle: c.shot.angle,
      target: toReal(a, c.aim.target), pace: c.aim.pace, mishit: c.aim.mishit, risk: c.aim.risk || null, rally: r.hits }, j));
  }

  // Tests: put a live rally ball in play, struck by `who` from `from`
  // (real coordinates) with `shot`, as if it were the rally's hits-th shot.
  function launchFor(m, who, from, shot, hits) {
    const a = m.actors[who];
    m.actors.forEach(resetActor);
    launch(m.ball, Object.assign({ side: a.side }, from), shot);
    m.rally = createRally(1 - who, 'deuce');
    m.rally.serve = false; m.rally.touched = true; m.rally.hitter = who; m.rally.hits = hits || 2;
    m.phase = 'rally';
    afterHit(m, a);
  }

  // The referee's decision: a let or a fault replays the serve, anything
  // else is a point.
  function resolve(m, o, ev) {
    const cfg = m.cfg, si = m.serve.server;
    if (o.type === 'let') {
      endLive(m);
      m.call = { label: 'LET', winner: null, by: si };
      m.phase = 'fault'; m.timer = cfg.match.faultTime;
      ev.push({ type: 'let', who: si });
    } else if (o.type === 'fault') {
      if (m.serveNo === 1) {
        endLive(m);
        m.serveNo = 2;
        m.call = { label: 'FAULT', winner: null, by: si };
        m.phase = 'fault'; m.timer = cfg.match.faultTime;
        ev.push({ type: 'fault', who: si, reason: o.reason });
      } else pointEnd(m, 1 - si, 'DOUBLE FAULT', si, ev);
    } else {
      if (m.serveNo === 1) m.stats[si].firstIn++; // a point (not a fault) on the first serve: it went in
      pointEnd(m, o.winner, o.reason, o.by, ev);
    }
  }

  function endLive(m) { m.actors.forEach(a => { a.live = false; a.pending = null; a.queue = []; }); }

  function pointEnd(m, winner, reason, by, ev) {
    const cfg = m.cfg, st = m.stats, hits = m.rally ? m.rally.hits : 0;
    endLive(m);
    st[winner].points++;
    if (reason === 'ACE') st[by].aces++;
    if (reason === 'DOUBLE FAULT') st[by].doubleFaults++;
    if ((reason === 'WINNER' || reason === 'ACE') && by === winner) st[winner].winners++;
    if ((reason === 'OUT' || reason === 'NET' || reason === 'DOUBLE FAULT') && by !== winner) st[by].errors++;
    m.longest = Math.max(m.longest, hits);
    m.points++;
    if (m.drill) m.drillN++;
    const sev = m.drill ? [] : pointWon(m.score, winner);
    m.call = { label: reason, winner, by, hits };
    m.banner = bannerFor(m, sev);
    m.phase = 'call'; m.timer = cfg.match.callTime;
    ev.push({ type: 'pointEnd', winner, reason, by, hits, score: sev });
  }

  // The score banner after a point: { title, sub }.
  function bannerFor(m, sev) {
    const names = m.names, sc = m.score;
    if (m.drill) return { title: m.call.label, sub: '' };
    const has = t => sev.find(e => e.type === t);
    const set = has('set'), game = has('game');
    if (has('match')) return { title: (sc.winner === 0 ? (names[0] === 'YOU' ? 'YOU WIN' : names[0] + ' WINS') : names[1] + ' WINS'), sub: setsText(sc) };
    if (set) return { title: 'SET ' + names[set.who], sub: setsText(sc) };
    if (game) {
      const g = game.games;
      return { title: 'GAME ' + names[game.who], sub: (has('tiebreak') ? 'TIE-BREAK · ' : '') + 'GAMES ' + g[0] + '–' + g[1] };
    }
    return { title: pointsText(sc, names), sub: sc.tiebreak ? 'TIE-BREAK' : '' };
  }

  // Sets as "4–2" or "7–6 (7–5)", the near player first.
  function setsText(sc) {
    return sc.sets.map((g, i) => {
      if (g[0] === 0 && g[1] === 0 && i === sc.sets.length - 1 && i > 0) return null;
      const tb = sc.tbScores[i];
      return g[0] + '–' + g[1] + (tb ? ' (' + tb[0] + '–' + tb[1] + ')' : '');
    }).filter(Boolean).join('  ');
  }

  // Taps queued for an actor that fall inside this step (as practice).
  function actorTaps(a, t1, ev) {
    const sev = [];
    takeTaps(a, t1, sev);
    for (const e of sev) ev.push(Object.assign(e, { who: a.idx, side: a.side }));
  }

  function canMove(m, a) {
    if (m.phase === 'pre' || m.phase === 'over' || m.phase === 'fault') return false;
    if (m.phase === 'serve') return a.idx !== m.serve.server && a.ctl === 'human';
    return true;
  }

  // Advance the match one fixed step. input = { stick } for the near
  // (human) player. Returns events for the renderer.
  function matchStep(m, input) {
    const cfg = m.cfg, dt = cfg.dt, t1 = m.t + dt, b = m.ball;
    const ev = m.pendingEv || [];
    m.pendingEv = null;
    m.humanStick = (input && input.stick) || { x: 0, y: 0 };
    const A = m.actors;
    for (const a of A) {
      a.t = m.t;
      if (a.side === 'far') mirrorBallInto(a.ball, b);
      a.stick = a.ctl === 'human' ? m.humanStick : { x: 0, y: 0 };
      if (a.cpu) cpuThink(m, a, t1, ev);
    }
    for (const a of A) actorTaps(a, t1, ev);

    // Phase clock.
    if (m.phase !== 'rally' && m.phase !== 'serve' && m.phase !== 'over') {
      m.timer -= dt;
      if (m.timer <= 0) {
        if (m.phase === 'pre') beginServe(m);
        else if (m.phase === 'fault') { placeForServe(m); }
        else if (m.phase === 'call') { m.phase = 'banner'; m.timer = cfg.match.bannerTime; ev.push({ type: 'banner', banner: m.banner }); }
        else if (m.phase === 'banner') {
          if (m.score.winner != null) { m.phase = 'over'; m.winner = m.score.winner; ev.push({ type: 'matchOver', winner: m.winner }); }
          else startPoint(m);
        }
      }
    }
    if (m.phase === 'serve' && m.serve.state === 'wait') {
      m.serve.wait -= dt;
      if (m.serve.wait <= 0 && !(A[m.serve.server].ctl === 'none')) tossNow(m, ev);
    }

    for (const a of A) {
      if (canMove(m, a)) movePlayer(a, a.cpu ? a.move || { x: 0, y: 0 } : a.stick, dt);
      else { a.player.vx = 0; a.player.vy = 0; }
    }

    // Ball and referee.
    const bev = step(b, cfg);
    for (const e of bev) ev.push(e);
    if (m.phase === 'rally' && m.rally) {
      const o = refBall(m.rally, b, bev, cfg);
      if (o) resolve(m, o, ev);
      else if (b.t > cfg.match.maxPoint + 4) pointEnd(m, m.rally.hitter, 'WINNER', m.rally.hitter, ev);
    }
    m.t = t1;
    for (const a of A) { a.t = t1; if (a.side === 'far') mirrorBallInto(a.ball, b); }

    // The serve: contact, or a toss that comes down unhit.
    if (m.phase === 'serve' && m.serve.state === 'toss') {
      const S = m.serve;
      if (S.tap && t1 >= S.tap.t + cfg.serve.backswing) serveContact(m, t1, ev);
      else if (!S.tap && b.vz < 0 && b.H < cfg.serve.hand.H - 0.25) retoss(m, ev, 'drop');
    }
    for (const a of A) actorContact(m, a, t1, ev);
    return ev;
  }

  // ---------------------------------------------------------------------
  // CPU opponent. Everything it does goes through its actor's stick and
  // shot taps, in its own frame, like a person playing that end.
  // ---------------------------------------------------------------------
  const CPU_LEVELS = ['easy', 'medium', 'hard'];

  function createCpu(m, a) {
    const c = { level: a.ctl, lv: m.cfg.cpu[a.ctl] };
    cpuResetState(m.cfg, c);
    return c;
  }
  function cpuResetState(cfg, c) {
    Object.assign(c, { net: false, recover: { X: 0, Y: COURT.length + cfg.cpu.homeBehind }, react: Infinity,
      err: { x: 0, y: 0 }, tapErr: 0, tapped: false, shotKey: null, total: null, predPt: null, plan: null });
  }
  function cpuReset(a) { cpuResetState(a.cfg, a.cpu); }

  // The opponent's position in a's frame (they stand on the far half).
  function oppPos(m, a) {
    const o = m.actors[1 - a.idx].player;
    return { X: -o.X, Y: COURT.length - o.Y };
  }

  // A ball is on its way: roll this shot's perception and timing errors.
  function cpuIncoming(m, a) {
    const c = a.cpu, lv = c.lv, R = m.rand;
    c.react = m.t + lv.reaction; c.plan = null;
    c.err = { x: gauss(R) * lv.predictErr, y: gauss(R) * lv.predictErr * 0.5 };
    c.tapErr = lv.tapMean + gauss(R) * lv.tapSd;
    c.tapped = false; c.shotKey = null; c.total = null;
  }

  // After its own contact: recover towards the middle of the opponent's
  // angles (or to the net, after an approach).
  function cpuHit(m, a) {
    const c = a.cpu, cfg = m.cfg, tx = c.lastTarget ? c.lastTarget.X : 0;
    c.recover = c.net ? { X: clamp(tx * 0.3, -2, 2), Y: COURT.netY + c.lv.netY }
      : { X: clamp(tx * 0.25, -1.5, 1.5), Y: COURT.length + cfg.cpu.homeBehind };
    c.tapped = false; c.shotKey = null; c.predPt = null;
  }

  // Shot choice for the contact `pred` (its stroke is set by the
  // situation, as for a person). Also picks the aim stick and whether to
  // come in.
  function cpuChoose(m, a, pred) {
    const c = a.cpu, lv = c.lv, R = m.rand, cfg = m.cfg, op = oppPos(m, a);
    const oppAtNet = COURT.netY - op.Y < cfg.zones.back;
    const away = -Math.sign(op.X || (R() - 0.5)), me = a.player;
    let shot, sx = (R() * 2 - 1) * 0.85, sy = 0;
    if (pred.stroke === 'smash') { shot = 'flat'; sx = away * (0.5 + 0.4 * R()); c.net = true; }
    else if (pred.stroke === 'volley') {
      shot = R() < lv.dropRate ? 'drop' : R() < 0.4 ? 'top' : 'flat';
      sx = away * (0.3 + 0.6 * R()); c.net = true;
    } else {
      const inside = pred.Y - COURT.netY < lv.approachDepth;
      if (oppAtNet && R() < lv.lobRate) { shot = 'lob'; sx = away * 0.5 * R(); }
      else if (oppAtNet) { shot = R() < 0.5 ? 'top' : 'flat'; sx = away * (0.75 + 0.2 * R()); }
      else if (me.Y - COURT.netY < cfg.zones.back + 1 && COURT.netY - op.Y > cfg.zones.back && R() < lv.dropRate) { shot = 'drop'; sx = away * R(); }
      else {
        shot = R() < lv.topShare ? 'top' : 'flat';
        // attack: the chance it goes for the open court, wide of the opponent.
        if (lv.attack && R() < lv.attack) sx = -Math.sign(op.X || sx) * (0.55 + 0.3 * R());
        else sx = clamp(sx + away * 0.3, -1, 1);
      }
      c.net = inside && shot !== 'lob' && shot !== 'drop' && R() < lv.approachRate;
    }
    // Its margin limits where it means to aim (the stick), before timing
    // quality pulls and shortens the shot exactly as it does a person's.
    const xm = (COURT.singlesHalf - lv.aimMargin) / cfg.aim.x;
    if (shot !== 'drop') sy = -lv.deep;
    c.aimStick = { x: clamp(sx, -xm, xm), y: sy };
    return shot;
  }

  // The CPU's margins, scatter, pace, mercy and rally pressure applied to
  // an aim from aimReturn (its own frame: the target is on the far half).
  function cpuAim(m, a, aim, j) {
    const c = a.cpu, lv = c.lv, R = m.rand, cfg = m.cfg, t = Object.assign({}, aim.target);
    const drop = aim.defKey === 'drop';
    const sp = drop ? lv.aimSpread * 0.4 : lv.aimSpread;
    t.X += gauss(R) * sp; t.Y = Math.min(COURT.netY - 1.5, t.Y + gauss(R) * sp);
    if (lv.mercyAim) t.X = lerp(t.X, oppPos(m, a).X, lv.mercyAim);
    const out = Object.assign({}, aim, { target: t, pace: aim.pace * lv.paceMul });
    // Unforced errors: errorRate a shot, more off a poor contact; and
    // rally pressure: past rallySoft the chance grows each shot, and the
    // shot that would reach rallyCap is always one (long).
    const hits = m.rally ? m.rally.hits : 0, M = cfg.match, q = j ? j.quality : 1;
    let p = lv.errorRate * (0.5 + 2 * (1 - q));
    if (hits > M.rallySoft) p += (hits - M.rallySoft) * lv.rallyRamp;
    const kind = hits + 1 >= M.rallyCap ? 'long' : R() < p ? ['long', 'wide', 'net'][Math.floor(R() * 3)] : null;
    if (kind) {
      const base = { mishit: kind, noClear: false, lift: 0, spinMul: 1, defKey: drop ? 'flat' : out.defKey, angles: drop ? null : out.angles };
      if (kind === 'long') Object.assign(out, base, { target: { X: t.X, Y: -0.8 - R() * 1.5 } });
      else if (kind === 'wide') Object.assign(out, base, { target: { X: Math.sign(t.X || (R() - 0.5)) * (COURT.singlesHalf + 0.3 + R()), Y: t.Y } });
      else Object.assign(out, base, { noClear: true, lift: -(2 + 4 * R()) });
    }
    c.lastTarget = out.target;
    return out;
  }

  function cpuThink(m, a, t1) {
    const c = a.cpu, lv = c.lv, cfg = m.cfg, S = m.serve, R = m.rand;
    a.stick = { x: 0, y: 0 };
    // Serving: toss by itself, tap from its timing distribution.
    if (m.phase === 'serve' && S.server === a.idx) {
      if (S.state === 'toss' && !S.tap) {
        const flat = R() < (m.serveNo === 1 ? lv.firstFlat : lv.secondFlat);
        const err = lv.tapMean + gauss(R) * lv.tapSd;
        S.tap = { shot: flat ? 'flat' : 'top', t: S.tossT0 + S.peakT + err / 1000,
          stick: { x: (R() * 2 - 1) * lv.serveAimX, y: (R() * 2 - 1) * 0.5 } };
      }
      return;
    }
    if (m.phase !== 'rally') return;
    const capped = m.rally && m.rally.hits >= cfg.match.rallyCap;
    let tgt = c.recover;
    c.predPt = null;
    if (incoming(a) && !a.whiffed && !capped) {
      const pred = predictContact(a);
      if (m.t < c.react) tgt = null;   // still reacting
      else {
        // Stay at this depth if the ball comes to it at a good height;
        // otherwise (a short ball, a drop) run to the stance with the most
        // time to spare, preferring a groundstroke.
        let at = null;
        // A stance it chose for this ball is kept while it can still get there.
        if (c.plan) {
          const pl = cfg.player, p = c.plan;
          const need = Math.hypot((p.X - a.player.X) / (pl.speedX * lv.speedMul), (p.Y - a.player.Y) / (pl.speedY * lv.speedMul));
          if (p.t - m.t - swingPreset(cfg, 'top', p.stroke).backswing - need >= -0.02) at = p;
        }
        if (!at && pred.kind === 'ok' && inBand(Object.assign({ phase: pred.stroke === 'ground' ? 'bounced' : 'flight' }, pred), cfg, pred.stroke)) at = assistTarget(a);
        if (!at) {
          // Among stances it can reach with time to spare, the one where
          // the ball is nearest its ideal contact height; else the most
          // time to spare. Volleys only when it's coming in.
          const pl = reachPlan(a.path, a.player, cfg, m.t, { speedMul: lv.speedMul, reaction: 0, euclid: true, score: (p, smp) =>
            (p.slack >= 0.12 ? 10 - Math.abs(smp.H - contactFor(cfg, p.stroke).height) : p.slack) - (p.stroke !== 'ground' && !c.net ? 3 : 0) });
          at = pl && (a.mustBounce ? pl.byStroke.ground : pl) || null;
          c.plan = at;
        }
        if (at) {
          const remain = pred.kind === 'ok' ? Math.max(0, pred.t - m.t) : 0.4;
          if (c.total == null) c.total = Math.max(0.3, remain);
          const k = (1 - lv.refine) + lv.refine * clamp(remain / c.total, 0, 1);
          tgt = { X: at.X + c.err.x * k, Y: at.Y + c.err.y * k };
          if (pred.kind === 'ok') c.predPt = Object.assign(toReal(a, { X: pred.X + c.err.x * k, Y: pred.Y + c.err.y * k }), { H: pred.H });
        }
      }
      // Tap when its (imperfect) timing says so.
      const s = a.swing;
      const ready = !a.pending && (s.t0 == null || swingPhase(m.t - s.t0, cfg, s.bs, s) === 'ready');
      if (!c.tapped && ready && pred.kind === 'ok' && m.t >= c.react) {
        const shot = c.shotKey || (c.shotKey = cpuChoose(m, a, pred));
        const tapT = pred.t - swingPreset(cfg, shot, pred.stroke).backswing + c.tapErr / 1000;
        if (t1 >= tapT) {
          requestSwing(a, shot, Math.max(tapT, m.t - 0.15));
          c.tapped = true;
        }
      }
    }
    // Head straight for the target: the stick points along the time it
    // needs on each axis, full on until it's close, then eases off.
    if (tgt) {
      const pl = cfg.player, ux = (tgt.X - a.player.X) / pl.speedX, uy = (tgt.Y - a.player.Y) / pl.speedY;
      const d = Math.hypot(tgt.X - a.player.X, tgt.Y - a.player.Y);
      const n = Math.hypot(ux, uy);
      // Full on, braking only as late as its deceleration allows (at full
      // stick it runs d / n m/s this way); never inside the stick's
      // deadzone until it's within 5 cm.
      const vWant = Math.sqrt(2 * pl.decel * cfg.cpu.brake * d);
      const mag = d < 0.05 ? 0 : Math.max(pl.deadzone + 0.02, Math.min(1, vWant * n / d));
      const k = n > 1e-6 ? mag / n : 0;
      a.move = { x: ux * k * lv.speedMul, y: uy * k * lv.speedMul };
    } else a.move = { x: 0, y: 0 };
  }

  // ---------------------------------------------------------------------
  // Swipe gestures. pts = [{ x, y, t }] in CSS px and ms, y down the
  // screen. Returns { kind: 'none' | 'tap' | 'swipe' } and for a swipe
  // { shot, aim: {x, y} (as a stick: x right, y -1 deeper), curve
  // (sidespin, rad/s), speed (px/ms), len, bend }.
  // ---------------------------------------------------------------------
  function classifySwipe(pts, cfg) {
    const S = (cfg || CONFIG).swipe;
    if (!pts || !pts.length) return { kind: 'none' };
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < S.tapDist) return { kind: 'tap', x: b.x, y: b.y };
    if (len < S.minDist) return { kind: 'none' };
    // Speed over the last `window` ms (a finger often rests, then flicks).
    let i = pts.length - 1, path = 0;
    while (i > 0 && b.t - pts[i - 1].t <= S.window) { path += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); i--; }
    const span = b.t - pts[i].t;
    const speed = span > 0 ? path / span : len / Math.max(1, b.t - a.t);
    // Bend: the furthest the path strays from the straight line, signed
    // (+ = to the right of the direction of travel).
    let bend = 0;
    for (const p of pts) {
      const c = (dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
      if (Math.abs(c) > Math.abs(bend)) bend = c;
    }
    bend = bend / len;
    const down = dy > 0 && dy >= Math.abs(dx) * S.downRatio;
    const out = { kind: 'swipe', speed, len, bend, curve: 0 };
    const depth = lerp(S.shortY, -1, clamp((len - S.lenShort) / (S.lenLong - S.lenShort), 0, 1));
    if (down) {
      out.shot = 'drop';
      out.aim = { x: clamp(Math.atan2(dx, dy) * 180 / Math.PI / S.aimAngle, -1, 1), y: -depth * 0.5 };
      return out;
    }
    out.shot = speed >= S.flatSpeed ? 'flat' : speed < S.lobSpeed ? 'lob' : 'top';
    out.aim = { x: clamp(Math.atan2(dx, Math.max(1e-6, -dy)) * 180 / Math.PI / S.aimAngle, -1, 1), y: depth };
    // A path that bulges left sends the ball out left and bends it back
    // to the right (and the other way round).
    if (out.shot !== 'lob' && Math.abs(bend) >= S.curveMin) {
      out.curve = -Math.sign(bend) * S.curveSpin * clamp((Math.abs(bend) - S.curveMin) / (S.curveFull - S.curveMin), 0.35, 1);
    }
    return out;
  }

  const api = {
    configFor, solveCurved, classifySwipe, timingFor,
    CONFIG, COURT, netHeight, toWorld, judgeBounce, createBall, launch, step,
    simulate, solveShot, shotFromAngle, rng, createMachine, machineStep,
    strokeFor, swingPhase, swingPreset, timingScore, zoneOf, contactFor, strokeLabel, predictFor, judgeContact, aimReturn, createPractice, requestSwing, practiceStep,
    playerBounds, tracePath, predictCrossing, predictContact, reachPlan, assistTarget, missReason, MISS_TEXT,
    SIDES, createScore, serverOf, courtOf, pointWon, pointsText, serviceBox, judgeServe,
    createRally, refHit, refBall,
    createMatch, matchStep, matchSwing, launchFor, matchServer, matchCourt, setsText, mirrorPath, toReal, incoming,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TennisEngine = api;
})(typeof window !== 'undefined' ? window : this);
