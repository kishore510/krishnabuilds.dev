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
  };

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
    ball.t = 0; ball.result = null; ball.grip = shot.grip || 1;
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
  }

  // Advance one fixed step. Returns an array of events.
  function step(ball, cfg) {
    cfg = cfg || CONFIG;
    const ev = [];
    if (ball.phase === 'idle') return ev;
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
    return { vx: hs * dx / d, vy: hs * dy / d, vz: def.speed * Math.sin(a), spin: def.spin, grip: def.grip || 1 };
  }

  // Aim solver: find the launch angle (within the shot's range) whose first
  // bounce lands at the target depth. Bisection on angle; the landing
  // distance is monotonic across each shot's range.
  function solveShot(from, target, shotKey, cfg, opts) {
    cfg = cfg || CONFIG;
    let def = cfg.shots[shotKey];
    if (opts && opts.speedMul) def = Object.assign({}, def, { speed: def.speed * opts.speedMul });
    if (opts && opts.angles) def = Object.assign({}, def, { angles: opts.angles });
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
    }
    return Object.assign(shotFromAngle(from, target, def, angle), { angle, key: shotKey });
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
  function timingFor(cfg, kind) {
    const T = (cfg || CONFIG).timing;
    return Object.assign({}, T, kind && kind !== 'ground' ? T[kind] : {});
  }
  // On-screen name of a stroke.
  function strokeLabel(kind, shot, cfg) {
    if (kind === 'smash') return 'SMASH';
    if (kind === 'volley') return shot === 'drop' ? 'DROP VOLLEY' : shot === 'lob' ? 'LOB VOLLEY' : 'VOLLEY';
    return (cfg || CONFIG).shots[shot].name;
  }

  function timingScore(err, cfg, kind) {
    const T = timingFor(cfg, kind), a = Math.abs(err);
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
    const c = contactFor(cfg, kind), q = cfg.quality, T = timingFor(cfg, kind);
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
    out.quality = out.perfect ? 1 : clamp(timingScore(errMs, cfg, kind) * (1 - q.wDist * Math.min(1, dist / c.reach)), 0, 1);
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
  function predictContact(pr) {
    if (!pr.live || pr.hitBy !== 'machine') return { kind: 'none' };
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
  function reachPlan(path, from, cfg, tNow) {
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
          const need = Math.max(Math.abs(X - from.X) / pl.speedX, Math.abs(Y - from.Y) / pl.speedY) + cfg.feed.reaction;
          const slack = s.t - tNow - bs - need;
          const plan = { X, Y, t: s.t, slack, F, stroke: kind };
          if (!byStroke[kind] || slack > byStroke[kind].slack) byStroke[kind] = plan;
          if (!best || slack > best.slack) best = plan;
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
    for (const kind of KINDS) {
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
  function requestSwing(pr, shot, t) {
    pr.queue.push({ shot, t: (t == null ? pr.t : t) - pr.cfg.timing.inputLagMs / 1000 });
  }

  // Plan a tap: when the swing starts and how long its backswing is.
  function planSwing(pr, r) {
    const cfg = pr.cfg, T = cfg.timing;
    const pred = predictContact(pr);
    const sw = swingPreset(cfg, r.shot, pred.stroke || 'ground');
    const plan = { shot: r.shot, tap: r.t, start: r.t, bs: sw.backswing, tapErr: null, kind: pred.kind, predX: pred.X,
      stroke: pred.stroke || 'ground', follow: sw.follow, recovery: sw.recovery };
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
    };
    pr.pending = null;
    ev.push({ type: 'swing', shot: plan.shot, t: plan.start, tap: plan.tap, tapErr: plan.tapErr, bs: plan.bs, stroke: plan.stroke });
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
    if (aSpeed > 0 && pr.live && pr.hitBy === 'machine' && !pr.whiffed && ph === 'ready' && !(s.t0 != null && !s.done)) {
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

  // Advance practice by one fixed step. input = { stick: {x, y} } with x,y
  // in -1..1 (y -1 = up = towards the net). Returns events for the renderer.
  function practiceStep(pr, input) {
    const cfg = pr.cfg, dt = cfg.dt, b = pr.ball, ev = [];
    const stick = (input && input.stick) || { x: 0, y: 0 };
    const t1 = pr.t + dt;

    // Taps that fall inside this step: plan each (buffered, on time or
    // catching up); one swing at a time.
    pr.queue.sort((a, c) => a.t - c.t);
    while (pr.queue.length && pr.queue[0].t < t1) {
      const r = pr.queue.shift();
      const s = pr.swing;
      if (pr.pending || swingPhase(s.t0 == null ? null : r.t - s.t0, cfg, s.bs, s) !== 'ready') continue;
      const plan = planSwing(pr, r);
      if (plan.tapErr != null) { pr.taps.n++; pr.taps.sum += plan.tapErr; }
      if (plan.start < t1) startSwing(pr, plan, ev);
      else pr.pending = plan;
    }
    if (pr.pending && pr.pending.start < t1) startSwing(pr, pr.pending, ev);

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
    if (!s.done && s.t0 != null && t1 >= s.t0 + s.bs) {
      s.done = true;
      const back = s.t0 + s.bs - t1; // <= 0: rewind to the exact instant
      const live = pr.live && pr.hitBy === 'machine';
      const bs = {
        X: b.X + b.vx * back, Y: b.Y + b.vy * back, H: Math.max(cfg.ballRadius, b.H + b.vz * back), vy: b.vy,
        live, phase: b.phase,
      };
      const j = judgeContact(bs, pr.player, cfg, { tapErr: s.tapErr, kind: s.kind, stroke: s.strokeKind });
      s.stroke = j.stroke; s.result = j; pr.last = j;
      if (j.contact) {
        const aim = aimReturn(j, stick, s.shot, cfg, pr.rand, Math.hypot(b.vx, b.vy, b.vz));
        const from = { side: 'near', X: bs.X, Y: bs.Y, H: bs.H };
        let shot = solveShot(from, aim.target, aim.defKey, cfg, { speedMul: aim.pace, clearNet: !aim.noClear, angles: aim.angles });
        if (aim.lift) shot = liftShot(shot, aim.lift);
        if (aim.spinMul != null && aim.spinMul !== 1) shot = Object.assign({}, shot, { spin: shot.spin * aim.spinMul });
        launch(b, from, shot);
        pr.hitBy = 'player'; pr.shotKey = s.shot; pr.aim = { target: aim.target, miss: aim.mishit }; pr.path = null;
        ev.push(Object.assign({ type: 'hit', by: 'player', side: 'near', X: from.X, Y: from.Y, H: from.H,
          shot: s.shot, label: strokeLabel(j.kind, s.shot, cfg), angle: shot.angle, target: aim.target, pace: aim.pace, mishit: aim.mishit, risk: aim.risk || null,
          stick: { x: stick.x || 0, y: stick.y || 0 } }, j));
      } else {
        if (live) { pr.whiffed = true; countMiss(pr, j.reason); }
        ev.push(Object.assign({ type: 'whiff', live }, j));
      }
    }

    // A fed ball that got past the player.
    if (pr.live && pr.hitBy === 'machine' && s.done && !pr.pending) {
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

  const api = {
    CONFIG, COURT, netHeight, toWorld, judgeBounce, createBall, launch, step,
    simulate, solveShot, shotFromAngle, rng, createMachine, machineStep,
    strokeFor, swingPhase, swingPreset, timingScore, zoneOf, contactFor, timingFor, strokeLabel, predictFor, judgeContact, aimReturn, createPractice, requestSwing, practiceStep,
    playerBounds, tracePath, predictCrossing, predictContact, reachPlan, assistTarget, missReason, MISS_TEXT,
    SIDES, createScore, serverOf, courtOf, pointWon, pointsText, serviceBox, judgeServe,
    createRally, refHit, refBall,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TennisEngine = api;
})(typeof window !== 'undefined' ? window : this);
