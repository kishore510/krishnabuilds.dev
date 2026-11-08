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
    restitution: 0.75,        // vertical bounce: vz' = -e * vz
    friction: 0.6,            // court grip during the bounce (sliding friction)
    spinInertia: 0.55,        // I = k m r^2 for a tennis ball
    ballRadius: 0.033,        // m
    netStopKeep: 0.12,        // speed kept when the ball runs into the net
    netClipKeep: 0.55,        // horizontal speed kept when it clips the tape
    netClipPop: 1.2,          // upward speed added by a tape clip (m/s)
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
      minX: -6.0, maxX: 6.0,
      minY: 22.6, maxY: 25.3,   // limited forward/back
      speedX: 6.5, speedY: 3.0,
      accel: 30,                // speeding up
      decel: 45,                // stopping or turning (stick released or reversed)
      deadzone: 0.15,           // stick magnitude below this is ignored
      swingMove: 0.3,           // movement scale during backswing and follow-through
    },

    // Swing timing (s), from the prototype's keyframes (tau -0.16, 0, 0.18,
    // 0.6). Contact is the instant `backswing` seconds after the tap.
    swing: { backswing: 0.16, follow: 0.18, recovery: 0.42 },

    // Where the ball should be at contact, relative to the player (m).
    contact: {
      side: 0.7,                // ideal contact point, this far to the stroke side
      ahead: 0.5,               // ...and this far in front (towards the net)
      height: 1.0,              // ideal height
      reach: 1.0,               // lateral reach around the ideal point
      minH: 0.2, maxH: 2.3,     // outside these heights: whiff
      backhandBelow: -0.25,     // ball X - player X below this: backhand
    },

    // Timing error and distance -> quality 0..1 -> what the shot does.
    quality: {
      whiffMs: 140,             // |timing error| above this: whiff
      perfectMs: 25, perfectDist: 0.35,
      wTime: 0.65, wDist: 0.35, // q = 1 - wTime*|err|/whiffMs - wDist*dist/reach
      good: 0.65, ok: 0.35,     // band thresholds (below ok: POOR)
      paceMin: 0.85,            // speed multiplier at q = 0 (1 at q = 1)
      perfectPace: 1.12,        // speed multiplier for PERFECT
      maxPull: 2.8,             // sideways miss at the timing limit (m)
      maxShort: 4.5,            // depth lost at q = 0 (m)
      mishitBelow: 0.3,         // below this q a shot can be mishit out
      mishitChance: 0.6,        // chance at q = 0, scaling to 0 at mishitBelow
    },

    // Joystick at contact -> target on the far court.
    aim: {
      x: 3.4,                   // full left/right puts the target this far from centre (m)
      deeper: 1.5,              // full up: this much deeper than the shot's depth
      shorter: 4.0,             // full down: this much shorter
    },

    // The ball machine in practice feeds from the far end only.
    feed: {
      first: 0.8,               // delay before the first ball (s)
      delay: 1.6,               // delay after each point (s)
      width: 2.5,               // lands within +-this of the centre line (m)
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
    ball.t = 0; ball.result = null;
  }

  function bounce(ball, cfg) {
    const e = cfg.restitution, r = cfg.ballRadius, k = cfg.spinInertia;
    const vzIn = -ball.vz;
    ball.vz = e * vzIn;
    // Along the spin axis: friction acts on the contact point's slip.
    const u = ball.vx * ball.ax + ball.vy * ball.ay;
    const lx = ball.vx - u * ball.ax, ly = ball.vy - u * ball.ay;
    const slip = u - r * ball.spin;          // contact point velocity
    const maxDu = cfg.friction * (1 + e) * vzIn;
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
    return { vx: hs * dx / d, vy: hs * dy / d, vz: def.speed * Math.sin(a), spin: def.spin };
  }

  // Aim solver: find the launch angle (within the shot's range) whose first
  // bounce lands at the target depth. Bisection on angle; the landing
  // distance is monotonic across each shot's range.
  function solveShot(from, target, shotKey, cfg, opts) {
    cfg = cfg || CONFIG;
    let def = cfg.shots[shotKey];
    if (opts && opts.speedMul) def = Object.assign({}, def, { speed: def.speed * opts.speedMul });
    const want = Math.hypot(target.X - from.X, target.Y - from.Y);
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
      for (let i = 0; i < 24; i++) {
        const s = simulate(from, shotFromAngle(from, target, def, angle), cfg);
        if (!s.net && !s.ball.touchedNet) break;
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

  // Forehand unless the ball is clearly on the player's left.
  function strokeFor(dx, cfg) {
    return dx >= (cfg || CONFIG).contact.backhandBelow ? 'fh' : 'bh';
  }

  // Swing phase `e` seconds after the tap. 'contact' is the instant of
  // contact, reported for one display frame or so.
  function swingPhase(e, cfg) {
    const s = (cfg || CONFIG).swing;
    if (e == null || e < 0) return 'ready';
    if (e < s.backswing) return 'backswing';
    if (e < s.backswing + 0.02) return 'contact';
    if (e < s.backswing + s.follow) return 'follow-through';
    if (e < s.backswing + s.follow + s.recovery) return 'recovery';
    return 'ready';
  }

  // Judge a contact. b = ball at the contact instant {X, Y, H, vy, hittable},
  // p = player {X, Y}. errMs < 0 is early (the ball hasn't reached the ideal
  // contact plane yet), > 0 late.
  function judgeContact(b, p, cfg) {
    cfg = cfg || CONFIG;
    const c = cfg.contact, q = cfg.quality;
    const stroke = strokeFor(b.X - p.X, cfg), F = stroke === 'fh' ? 1 : -1;
    const lat = Math.abs(b.X - (p.X + F * c.side));
    const planeY = p.Y - c.ahead;
    let errMs = b.vy > 0.5 ? (b.Y - planeY) / b.vy * 1000 : (b.Y < planeY ? -9999 : 9999);
    errMs = clamp(errMs, -9999, 9999);
    const dist = Math.hypot(lat, 0.5 * (b.H - c.height));
    const out = { stroke, errMs, dist, lat, H: b.H, contact: false, reason: null, quality: 0, band: 'WHIFF', perfect: false };
    if (!b.hittable) out.reason = 'no ball';
    else if (errMs < -q.whiffMs) out.reason = 'early';
    else if (errMs > q.whiffMs) out.reason = 'late';
    else if (lat > c.reach) out.reason = 'reach';
    else if (b.H < c.minH) out.reason = 'low';
    else if (b.H > c.maxH) out.reason = 'high';
    if (out.reason) return out;
    out.contact = true;
    out.perfect = Math.abs(errMs) <= q.perfectMs && dist <= q.perfectDist;
    out.quality = out.perfect ? 1 : clamp(1 - q.wTime * Math.abs(errMs) / q.whiffMs - q.wDist * Math.min(1, dist / c.reach), 0, 1);
    out.band = out.perfect ? 'PERFECT' : out.quality >= q.good ? 'GOOD' : out.quality >= q.ok ? 'OK' : 'POOR';
    return out;
  }

  // Where a return should land, from the stick and the contact judgement.
  // Returns { target, pace, mishit }. Uses pr.rand only for a possible mishit.
  function aimReturn(j, stick, shotKey, cfg, rand) {
    const a = cfg.aim, q = cfg.quality, def = cfg.shots[shotKey];
    const jx = clamp(stick.x || 0, -1, 1), jy = clamp(stick.y || 0, -1, 1);
    let X = jx * a.x;
    let Y = def.depth - Math.max(0, -jy) * a.deeper + Math.max(0, jy) * a.shorter;
    const F = j.stroke === 'fh' ? 1 : -1;
    if (!j.perfect) {
      // Early pulls a forehand left and a backhand right; late the opposite.
      X += F * clamp(j.errMs / q.whiffMs, -1, 1) * q.maxPull;
      Y += (1 - j.quality) * q.maxShort;
    }
    Y = Math.min(Y, COURT.netY - 1.5);
    let mishit = null;
    if (j.quality < q.mishitBelow && rand() < q.mishitChance * (q.mishitBelow - j.quality) / q.mishitBelow) {
      mishit = rand() < 0.5 ? 'long' : 'wide';
      if (mishit === 'long') Y = -1.5;
      else X = Math.sign(X || F) * (COURT.singlesHalf + 0.9);
    }
    const pace = j.perfect ? q.perfectPace : q.paceMin + (1 - q.paceMin) * j.quality;
    return { target: { X, Y }, pace, mishit };
  }

  function createPractice(seed, cfg) {
    cfg = cfg || CONFIG;
    const pl = cfg.player;
    return {
      cfg, rand: rng(seed == null ? 1 : seed), ball: createBall(),
      mode: 'auto', cycle: 0, t: 0, wait: cfg.feed.first,
      player: { X: pl.startX, Y: pl.startY, vx: 0, vy: 0 },
      swing: { t0: null, shot: null, done: true, stroke: 'fh', result: null },
      queue: [], live: false, hitBy: null, whiffed: false,
      rally: 0, best: 0, last: null, shotKey: null, aim: null,
    };
  }

  // Queue a swing that started at sim time t (pr.t's clock).
  function requestSwing(pr, shot, t) {
    pr.queue.push({ shot, t: t == null ? pr.t : t });
  }

  // Move v towards target; accelerate when pushing on, decelerate when
  // stopping, slowing or reversing.
  function approach(v, target, acc, dec, dt) {
    const stopping = target === 0 || v * target < 0 || Math.abs(target) < Math.abs(v);
    const r = (stopping ? dec : acc) * dt;
    return v < target ? Math.min(target, v + r) : Math.max(target, v - r);
  }

  function movePlayer(pr, stick, dt) {
    const pl = pr.cfg.player, p = pr.player;
    let sx = stick.x || 0, sy = stick.y || 0;
    const m = Math.hypot(sx, sy);
    if (m > 1) { sx /= m; sy /= m; }
    if (m < pl.deadzone) { sx = 0; sy = 0; }
    const ph = swingPhase(pr.swing.t0 == null ? null : pr.t - pr.swing.t0, pr.cfg);
    const k = (ph === 'backswing' || ph === 'contact' || ph === 'follow-through') ? pl.swingMove : 1;
    p.vx = approach(p.vx, sx * pl.speedX * k, pl.accel, pl.decel, dt);
    p.vy = approach(p.vy, sy * pl.speedY * k, pl.accel, pl.decel, dt);
    p.X += p.vx * dt; p.Y += p.vy * dt;
    if (p.X < pl.minX || p.X > pl.maxX) { p.X = clamp(p.X, pl.minX, pl.maxX); p.vx = 0; }
    if (p.Y < pl.minY || p.Y > pl.maxY) { p.Y = clamp(p.Y, pl.minY, pl.maxY); p.vy = 0; }
  }

  function endPoint(pr) { pr.live = false; pr.wait = pr.cfg.feed.delay; }

  function feed(pr, ev) {
    const cfg = pr.cfg, R = pr.rand, key = pickShot(pr), def = cfg.shots[key];
    const from = { side: 'far', X: (R() - 0.5) * 2, Y: cfg.farContactY, H: cfg.contactHeight };
    const target = { X: (R() * 2 - 1) * cfg.feed.width, Y: COURT.length - (def.depth + (R() - 0.5) * 1.5) };
    const shot = solveShot(from, target, key, cfg);
    launch(pr.ball, from, shot);
    pr.live = true; pr.hitBy = 'machine'; pr.whiffed = false;
    pr.shotKey = key; pr.aim = { target, miss: null };
    ev.push({ type: 'hit', by: 'machine', side: 'far', X: from.X, Y: from.Y, H: from.H, shot: key, angle: shot.angle });
  }

  // Advance practice by one fixed step. input = { stick: {x, y} } with x,y
  // in -1..1 (y -1 = up = towards the net). Returns events for the renderer.
  function practiceStep(pr, input) {
    const cfg = pr.cfg, dt = cfg.dt, sw = cfg.swing, b = pr.ball, ev = [];
    const stick = (input && input.stick) || { x: 0, y: 0 };
    const t1 = pr.t + dt;

    // Swings whose tap falls inside this step.
    pr.queue.sort((a, c) => a.t - c.t);
    while (pr.queue.length && pr.queue[0].t < t1) {
      const r = pr.queue.shift();
      const e = pr.swing.t0 == null ? null : r.t - pr.swing.t0;
      if (swingPhase(e, cfg) !== 'ready') continue; // still swinging: ignored
      const guessX = b.phase === 'idle' ? b.X : b.X + b.vx * sw.backswing;
      pr.swing = { t0: r.t, shot: r.shot, done: false, stroke: strokeFor(guessX - pr.player.X, cfg), result: null };
      ev.push({ type: 'swing', shot: r.shot, t: r.t });
    }

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

    // Contact instant reached this step?
    const s = pr.swing;
    if (!s.done && s.t0 != null && t1 >= s.t0 + sw.backswing) {
      s.done = true;
      const back = s.t0 + sw.backswing - t1; // <= 0: rewind to the exact instant
      const bs = {
        X: b.X + b.vx * back, Y: b.Y + b.vy * back, H: Math.max(cfg.ballRadius, b.H + b.vz * back), vy: b.vy,
        hittable: pr.live && pr.hitBy === 'machine' && b.phase === 'bounced',
      };
      const j = judgeContact(bs, pr.player, cfg);
      s.stroke = j.stroke; s.result = j; pr.last = j;
      if (j.contact) {
        const aim = aimReturn(j, stick, s.shot, cfg, pr.rand);
        const from = { side: 'near', X: bs.X, Y: bs.Y, H: bs.H };
        const shot = solveShot(from, aim.target, s.shot, cfg, { speedMul: aim.pace, clearNet: true });
        launch(b, from, shot);
        pr.hitBy = 'player'; pr.shotKey = s.shot; pr.aim = { target: aim.target, miss: aim.mishit };
        ev.push(Object.assign({ type: 'hit', by: 'player', side: 'near', X: from.X, Y: from.Y, H: from.H,
          shot: s.shot, angle: shot.angle, target: aim.target, pace: aim.pace, mishit: aim.mishit,
          stick: { x: stick.x || 0, y: stick.y || 0 } }, j));
      } else {
        if (bs.hittable) pr.whiffed = true;
        ev.push(Object.assign({ type: 'whiff', live: bs.hittable }, j));
      }
    }

    // A fed ball that got past the player.
    if (pr.live && pr.hitBy === 'machine' && s.done) {
      const off = b.Y > cfg.player.maxY + 2.2 || Math.abs(b.X) > 9 || b.t > 6;
      if (b.phase === 'dead' || b.phase === 'net' || off) {
        pr.rally = 0;
        ev.push({ type: 'missed', whiffed: pr.whiffed });
        endPoint(pr);
      }
    }
    if (pr.live && pr.hitBy === 'player' && b.t > 6) endPoint(pr);
    return ev;
  }

  const api = {
    CONFIG, COURT, netHeight, toWorld, judgeBounce, createBall, launch, step,
    simulate, solveShot, shotFromAngle, rng, createMachine, machineStep,
    strokeFor, swingPhase, judgeContact, aimReturn, createPractice, requestSwing, practiceStep,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TennisEngine = api;
})(typeof window !== 'undefined' ? window : this);
