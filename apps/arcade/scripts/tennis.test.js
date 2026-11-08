// Tennis engine tests. Dependency-free; run from apps/arcade with:
//   node --test scripts/tennis.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'games', 'tennis', 'engine.js'));

const C = E.CONFIG, COURT = E.COURT;
const near = (X = 0) => ({ side: 'near', X, Y: C.nearContactY, H: C.contactHeight });

function dropBall(height, cfg) {
  const b = E.createBall();
  E.launch(b, { side: 'near', X: 0, Y: 5, H: height }, { vx: 0, vy: 0, vz: 0, spin: 0 });
  b.ax = 0; b.ay = -1;
  let peak = 0, bounced = false;
  for (let i = 0; i < 1200; i++) {
    const ev = E.step(b, cfg);
    if (ev.some(e => e.type === 'bounce')) bounced = true;
    if (bounced) { peak = Math.max(peak, b.H); if (b.vz < 0 && peak > 0.1) break; }
  }
  return peak;
}

test('a dropped ball bounces back to e^2 of its height (no drag)', () => {
  const h0 = 2, r = C.ballRadius;
  const noDrag = Object.assign({}, C, { drag: 0 });
  const peak = dropBall(h0, noDrag);
  const expected = r + (h0 - r) * C.restitution ** 2;
  assert.ok(Math.abs(peak - expected) < 0.02, `peak ${peak} vs ${expected}`);
  // With drag it comes up a little lower, as a real ball does.
  const withDrag = dropBall(h0);
  assert.ok(withDrag < peak && withDrag > peak * 0.9, `with drag ${withDrag}`);
});

test('gravity: a ball in free flight follows ~g', () => {
  const b = E.createBall();
  E.launch(b, { side: 'near', X: 0, Y: 5, H: 10 }, { vx: 0, vy: 0, vz: 0, spin: 0 });
  for (let i = 0; i < 60; i++) E.step(b); // 0.5 s
  assert.ok(Math.abs(b.H - (10 - 0.5 * 9.81 * 0.25)) < 0.05, `H ${b.H}`);
});

test('topspin dips sooner than flat from the same launch', () => {
  const launch = { vx: 0, vy: -26, vz: 4 };
  const land = spin => E.simulate(near(), Object.assign({ spin }, launch)).firstBounce;
  const flat = land(0), top = land(260), back = land(-150);
  assert.ok(flat && top && back);
  assert.ok(top.Y > flat.Y + 1, `topspin lands shorter: ${top.Y} vs ${flat.Y}`);
  assert.ok(back.Y < flat.Y, `backspin floats longer: ${back.Y} vs ${flat.Y}`);
});

test('topspin kicks forward off the bounce, backspin skids and slows', () => {
  function afterBounce(spin) {
    const b = E.createBall();
    E.launch(b, { side: 'near', X: 0, Y: 15, H: 0.5 }, { vx: 0, vy: -20, vz: -8, spin });
    const vIn = Math.abs(b.vy);
    while (b.bounces === 0) E.step(b);
    return { ratio: Math.abs(b.vy) / vIn, spinOut: b.spin };
  }
  const top = afterBounce(500), flat = afterBounce(0), back = afterBounce(-300);
  assert.ok(top.ratio > flat.ratio, `top ${top.ratio} flat ${flat.ratio}`);
  assert.ok(flat.ratio > back.ratio, `flat ${flat.ratio} back ${back.ratio}`);
  assert.ok(flat.spinOut > 0, 'a flat ball picks up topspin from the court');
});

test('a low ball is stopped by the net and stays on the hitter side', () => {
  const b = E.createBall();
  E.launch(b, { side: 'near', X: 0, Y: 16, H: 0.6 }, { vx: 0, vy: -25, vz: 0, spin: 0 });
  let net = null, first = null;
  for (let i = 0; i < 360 && !first; i++) {
    for (const e of E.step(b)) {
      if (e.type === 'net') net = e;
      if (e.type === 'bounce') first = e;
    }
  }
  assert.ok(net && net.stopped, 'hits the net');
  assert.equal(b.touchedNet, true);
  assert.ok(first, 'then drops and bounces');
  assert.equal(first.result, 'NET');
  assert.ok(first.Y > COURT.netY, 'on the hitter side');
});

test('a ball just over the tape clips it and carries on slower', () => {
  const b = E.createBall();
  // Aim the centre to pass about 1.5 cm above the tape.
  E.launch(b, { side: 'near', X: 0, Y: 13, H: COURT.netCentre + 0.015 }, { vx: 0, vy: -15, vz: 0, spin: 0 });
  b.H += 0.5 * 9.81 * (1.115 / 15) ** 2; // pre-compensate the fall to the net
  let net = null;
  for (let i = 0; i < 30; i++) for (const e of E.step(b)) if (e.type === 'net') net = e;
  assert.ok(net && !net.stopped, 'clips the tape');
  assert.ok(Math.abs(b.vy) < 15 * C.netClipKeep + 0.5);
  assert.ok(b.Y < COURT.netY, 'goes over');
});

test('net is higher at the posts than in the centre', () => {
  assert.equal(E.netHeight(0), COURT.netCentre);
  assert.ok(Math.abs(E.netHeight(COURT.postX) - COURT.netPost) < 1e-9);
  assert.ok(E.netHeight(3) > E.netHeight(0));
});

test('in/out: lines are in, just over is out', () => {
  const eps = 0.01;
  assert.equal(E.judgeBounce(0, 0, 'near'), 'IN');               // on the baseline
  assert.equal(E.judgeBounce(0, -eps, 'near'), 'OUT_LONG');
  assert.equal(E.judgeBounce(COURT.singlesHalf, 5, 'near'), 'IN'); // on the sideline
  assert.equal(E.judgeBounce(COURT.singlesHalf + eps, 5, 'near'), 'OUT_WIDE');
  assert.equal(E.judgeBounce(-COURT.singlesHalf - eps, 5, 'near'), 'OUT_WIDE');
  assert.equal(E.judgeBounce(0, COURT.length, 'far'), 'IN');
  assert.equal(E.judgeBounce(0, COURT.length + eps, 'far'), 'OUT_LONG');
  assert.equal(E.judgeBounce(0, COURT.netY + 1, 'near'), 'NET');  // own half
  assert.equal(E.judgeBounce(0, COURT.netY - 1, 'far'), 'NET');
});

test('the solver lands each shot within 0.3 m of its target', () => {
  for (const key of ['flat', 'top', 'lob']) {
    for (const X of [-2.5, 0, 2.5]) {
      const target = { X: -X * 0.6, Y: C.shots[key].depth };
      const shot = E.solveShot(near(X), target, key);
      const s = E.simulate(near(X), shot);
      assert.ok(s.firstBounce && !s.net, `${key} clears the net`);
      const err = Math.hypot(s.firstBounce.X - target.X, s.firstBounce.Y - target.Y);
      assert.ok(err < 0.3, `${key} from ${X}: off by ${err.toFixed(2)} m`);
      assert.equal(s.firstBounce.result, 'IN');
    }
  }
});

test('the far player aims back at the near court', () => {
  const from = { side: 'far', X: 0, Y: C.farContactY, H: 1 };
  const target = { X: 1, Y: COURT.length - 3 };
  const s = E.simulate(from, E.solveShot(from, target, 'top'));
  assert.equal(s.firstBounce.result, 'IN');
  assert.ok(Math.abs(s.firstBounce.Y - target.Y) < 0.3);
});

test('crossing times match the target feel (flat 0.8s, topspin 0.95s, lob ~1.45s)', () => {
  const want = { flat: [0.8, 0.1], top: [0.95, 0.1], lob: [1.45, 0.15] };
  for (const key of Object.keys(want)) {
    const shot = E.solveShot(near(), { X: 0, Y: C.shots[key].depth }, key);
    const s = E.simulate(near(), shot, C, { untilY: C.farContactY });
    const [t, tol] = want[key];
    assert.ok(s.crossT != null, `${key} reaches the receiver`);
    assert.ok(Math.abs(s.crossT - t) <= tol, `${key} crossed in ${s.crossT.toFixed(3)}s, want ${t}±${tol}`);
  }
});

test('the ball machine is deterministic for a seed and keeps rallying', () => {
  function run(seed) {
    const m = E.createMachine(seed);
    const log = [];
    for (let i = 0; i < 120 * 30; i++) {
      for (const e of E.machineStep(m)) {
        if (e.type === 'hit' || e.type === 'bounce' || e.type === 'reset') log.push(e.type + ':' + (e.result || e.shot || '') + ':' + (e.X != null ? e.X.toFixed(4) : ''));
      }
    }
    return log;
  }
  const a = run(42), b = run(42);
  assert.deepEqual(a, b);
  assert.ok(a.filter(x => x.startsWith('hit')).length > 15, 'it keeps hitting for 30 s');
  assert.ok(a.some(x => x.startsWith('bounce:IN')));
});

test('a ball at rest stops bouncing', () => {
  const b = E.createBall();
  E.launch(b, { side: 'near', X: 0, Y: 5, H: 1 }, { vx: 0, vy: -1, vz: 0, spin: 0 });
  let bounces = 0;
  for (let i = 0; i < 120 * 10; i++) bounces += E.step(b).filter(e => e.type === 'bounce').length;
  assert.ok(bounces < 15, `bounces ${bounces}`);
  assert.equal(b.rolling, true);
  assert.ok(Math.abs(b.H - C.ballRadius) < 1e-9);
});

// ---------------------------------------------------------------------------
// Stage 2: practice mode, movement, swing and contact.
// ---------------------------------------------------------------------------

// Run a practice with no swings and find when (and where) the first fed ball
// crosses the player's ideal contact plane after its bounce.
function idealContact(seed, mode) {
  const pr = E.createPractice(seed);
  pr.mode = mode;
  const plane = pr.player.Y - C.contact.ahead;
  let prevY = null;
  for (let i = 0; i < 120 * 5; i++) {
    E.practiceStep(pr, {});
    const b = pr.ball;
    if (prevY != null && pr.live && b.phase === 'bounced' && prevY < plane && b.Y >= plane) {
      const f = (plane - prevY) / (b.Y - prevY);
      return { t: pr.t - C.dt + f * C.dt, X: b.X - (1 - f) * b.vx * C.dt, H: b.H };
    }
    prevY = b.Y;
  }
  throw new Error('fed ball never reached the contact plane');
}

// Same seed again: stand at `dx` from the ideal forehand spot, swing `offMs`
// late (negative = early), hold `stick` from the tap on (it also moves the
// player a little, as it would in play). Returns the contact or whiff event
// and, if it was hit, the return's first bounce.
function trial({ seed = 3, mode = 'top', offMs = 0, dx = 0, stick = { x: 0, y: 0 }, shot = 'top' } = {}) {
  const ideal = idealContact(seed, mode);
  const pr = E.createPractice(seed);
  pr.mode = mode;
  pr.player.X = ideal.X - C.contact.side + dx;
  E.requestSwing(pr, shot, ideal.t - C.swing.backswing + offMs / 1000);
  let contact = null, ret = null;
  for (let i = 0; i < 120 * 8 && !ret; i++) {
    const held = pr.swing.t0 != null ? stick : { x: 0, y: 0 };
    for (const e of E.practiceStep(pr, { stick: held })) {
      if (e.type === 'hit' && e.by === 'player') contact = e;
      if (e.type === 'whiff') contact = e;
      if (e.type === 'return') ret = e;
    }
    if (contact && contact.type === 'whiff') break;
  }
  return { contact, ret, pr };
}

test('swinging at the ideal moment makes a PERFECT contact', () => {
  for (const mode of ['flat', 'top', 'lob']) {
    const { contact, ret } = trial({ mode });
    assert.equal(contact.type, 'hit', `${mode}: ${contact.reason}`);
    assert.ok(Math.abs(contact.errMs) < 5, `${mode} timing error ${contact.errMs}`);
    assert.equal(contact.band, 'PERFECT');
    assert.equal(contact.pace, C.quality.perfectPace);
    assert.equal(ret.result, 'IN');
  }
});

test('early and late swings lose quality step by step, then whiff', () => {
  for (const sign of [-1, 1]) {
    let prevQ = 1.01;
    for (const ms of [0, 40, 80, 120]) {
      const { contact } = trial({ offMs: sign * ms });
      assert.equal(contact.type, 'hit', `${sign * ms} ms: ${contact.reason}`);
      assert.ok(Math.sign(contact.errMs) === sign || ms === 0, `sign of ${contact.errMs}`);
      assert.ok(Math.abs(Math.abs(contact.errMs) - ms) < 6, `measured ${contact.errMs} for ${sign * ms}`);
      assert.ok(contact.quality < prevQ, `${sign * ms} ms quality ${contact.quality} not below ${prevQ}`);
      prevQ = contact.quality;
    }
    const { contact } = trial({ offMs: sign * 170 });
    assert.equal(contact.type, 'whiff');
    assert.equal(contact.reason, sign < 0 ? 'early' : 'late');
  }
});

test('poor timing pulls the shot off line', () => {
  const ok = trial({}).ret, early = trial({ offMs: -100 }).ret, late = trial({ offMs: 100 }).ret;
  // Forehand: early pulls left, late pushes right.
  assert.ok(early.X < ok.X - 1, `early ${early.X} vs ${ok.X}`);
  assert.ok(late.X > ok.X + 1, `late ${late.X} vs ${ok.X}`);
});

test('reach zone: a ball outside it is a whiff', () => {
  const near = trial({ dx: 0.6 });
  assert.equal(near.contact.type, 'hit');
  assert.ok(near.contact.quality < 1);
  // Player further left: the ball is out on their right, beyond reach.
  const far = trial({ dx: -(C.contact.reach + 0.6) });
  assert.equal(far.contact.type, 'whiff');
  assert.equal(far.contact.reason, 'reach');
  // Unit level: height limits and a missing ball.
  const p = { X: 0, Y: 24 }, at = { X: 0.7, Y: 23.5, vy: 15, hittable: true };
  assert.equal(E.judgeContact(Object.assign({}, at, { H: 1 }), p).contact, true);
  assert.equal(E.judgeContact(Object.assign({}, at, { H: 0.1 }), p).reason, 'low');
  assert.equal(E.judgeContact(Object.assign({}, at, { H: 2.6 }), p).reason, 'high');
  assert.equal(E.judgeContact(Object.assign({}, at, { H: 1, hittable: false }), p).reason, 'no ball');
});

test('forehand on the right and in the middle, backhand clearly on the left', () => {
  assert.equal(E.strokeFor(0.8), 'fh');
  assert.equal(E.strokeFor(0), 'fh');
  assert.equal(E.strokeFor(-0.1), 'fh');
  assert.equal(E.strokeFor(-1.0), 'bh');
  const p = { X: 0, Y: 24 }, b = { Y: 23.5, H: 1, vy: 15, hittable: true };
  assert.equal(E.judgeContact(Object.assign({ X: -0.7 }, b), p).stroke, 'bh');
  assert.equal(E.judgeContact(Object.assign({ X: -0.7 }, b), p).band, 'PERFECT');
  assert.equal(E.judgeContact(Object.assign({ X: 0.7 }, b), p).stroke, 'fh');
});

test('aim: the stick left/right lands the return left/right of centre', () => {
  for (const shot of ['flat', 'top', 'lob']) {
    const L = trial({ shot, stick: { x: -1, y: 0 } }).ret;
    const M = trial({ shot, stick: { x: 0, y: 0 } }).ret;
    const R = trial({ shot, stick: { x: 1, y: 0 } }).ret;
    for (const r of [L, M, R]) assert.equal(r.result, 'IN', `${shot} ${r.X}`);
    assert.ok(L.X < -C.aim.x + 0.5 && L.X > -C.aim.x - 0.5, `${shot} left ${L.X}`);
    assert.ok(Math.abs(M.X) < 0.5, `${shot} centre ${M.X}`);
    assert.ok(R.X > C.aim.x - 0.5 && R.X < C.aim.x + 0.5, `${shot} right ${R.X}`);
  }
  // Up goes deeper, down shorter.
  const deep = trial({ stick: { x: 0, y: -1 } }).ret, short = trial({ stick: { x: 0, y: 1 } }).ret;
  assert.ok(deep.Y < short.Y - 3, `deep ${deep.Y} short ${short.Y}`);
});

test('the player accelerates, stops and stays inside the bounds', () => {
  const pr = E.createPractice(1), P = C.player;
  for (let i = 0; i < 12; i++) E.practiceStep(pr, { stick: { x: 1, y: 0 } }); // 0.1 s
  assert.ok(pr.player.vx > 0 && pr.player.vx < P.speedX, `vx ${pr.player.vx}`);
  for (let i = 0; i < 120 * 3; i++) E.practiceStep(pr, { stick: { x: 1, y: -1 } });
  assert.equal(pr.player.X, P.maxX);
  assert.equal(pr.player.Y, P.minY);
  for (let i = 0; i < 6; i++) E.practiceStep(pr, { stick: { x: -0.05, y: 0 } }); // inside the deadzone
  E.practiceStep(pr, { stick: { x: 1, y: 0 } });
  pr.player.X = 0;
  for (let i = 0; i < 120; i++) E.practiceStep(pr, { stick: { x: 1, y: 0 } });
  assert.ok(Math.abs(pr.player.vx - P.speedX) < 1e-9);
  let n = 0;
  while (pr.player.vx > 0 && n < 120) { E.practiceStep(pr, {}); n++; }
  assert.ok(n * C.dt <= P.speedX / P.decel + 2 * C.dt, `stopped in ${n} steps`);
});

test('a swing runs ready, backswing, contact, follow-through, recovery, ready', () => {
  const s = C.swing;
  assert.equal(E.swingPhase(null), 'ready');
  assert.equal(E.swingPhase(0.05), 'backswing');
  assert.equal(E.swingPhase(s.backswing + 0.01), 'contact');
  assert.equal(E.swingPhase(s.backswing + 0.1), 'follow-through');
  assert.equal(E.swingPhase(s.backswing + s.follow + 0.1), 'recovery');
  assert.equal(E.swingPhase(s.backswing + s.follow + s.recovery + 0.01), 'ready');
  // A second tap during the swing is ignored.
  const pr = E.createPractice(1);
  E.requestSwing(pr, 'top', 0.1); E.requestSwing(pr, 'lob', 0.3);
  const swings = [];
  for (let i = 0; i < 120; i++) for (const e of E.practiceStep(pr, {})) if (e.type === 'swing') swings.push(e.shot);
  assert.deepEqual(swings, ['top']);
});

test('a ball the player never swings at counts as missed and resets the rally', () => {
  const pr = E.createPractice(3);
  pr.rally = 4;
  let missed = null;
  for (let i = 0; i < 120 * 6 && !missed; i++) for (const e of E.practiceStep(pr, {})) if (e.type === 'missed') missed = e;
  assert.ok(missed);
  assert.equal(pr.rally, 0);
  assert.equal(pr.best, 0);
});

test('practice is deterministic: same seed, inputs and steps give the same result', () => {
  function run() {
    const pr = E.createPractice(11);
    const log = [];
    for (let i = 0; i < 120 * 20; i++) {
      const stick = { x: Math.sin(i / 50), y: Math.cos(i / 90) * 0.5 };
      if (i % 97 === 0) E.requestSwing(pr, ['top', 'flat', 'lob'][i % 3], pr.t + 0.003);
      for (const e of E.practiceStep(pr, { stick })) {
        if (e.type !== 'bounce' || e.n === 1) log.push(JSON.stringify(e));
      }
    }
    log.push(JSON.stringify([pr.player, pr.ball, pr.rally, pr.best]));
    return log;
  }
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.ok(a.some(l => l.includes('"type":"swing"')));
});
