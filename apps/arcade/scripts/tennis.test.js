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
  // Within 2%: the fixed 1/120 s step snaps the landing to the surface.
  assert.ok(Math.abs(peak - expected) < 0.02 * expected, `peak ${peak} vs ${expected}`);
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

// Step a practice until the machine has fed its first ball.
function feedFirst(pr, input) {
  for (let i = 0; i < 120 * 3; i++) {
    for (const e of E.practiceStep(pr, input || {})) if (e.type === 'hit' && e.by === 'machine') return e;
  }
  throw new Error('no feed');
}

// A practice with assist off (so only the test moves the player).
function quiet(seed, mode) {
  const pr = E.createPractice(seed);
  pr.mode = mode; pr.assist = 'off';
  return pr;
}

// Run a practice with no swings and find when (and where) the first fed ball
// crosses the player's ideal contact plane after its bounce.
function idealContact(seed, mode) {
  const pr = quiet(seed, mode);
  const plane = pr.player.Y - C.contact.ahead;
  let prevY = null;
  for (let i = 0; i < 120 * 6; i++) {
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

// Same seed again: once the ball is fed, stand at `dx` from the ideal
// forehand spot, tap `offMs` from the ideal tap (negative = early), hold
// `stick` from the swing on (it also moves the player a little, as it would
// in play). Returns the swing, the contact or whiff event and, if it was
// hit, the return's first bounce.
function trial({ seed = 3, mode = 'top', offMs = 0, dx = 0, px = null, stick = { x: 0, y: 0 }, shot = 'top' } = {}) {
  const ideal = idealContact(seed, mode);
  const pr = quiet(seed, mode);
  feedFirst(pr);
  pr.player.X = px != null ? px : ideal.X - C.contact.side + dx;
  const tap = ideal.t - E.swingPreset(C, shot).backswing + offMs / 1000;
  E.requestSwing(pr, shot, tap);
  let contact = null, ret = null, swing = null;
  for (let i = 0; i < 120 * 8 && !ret; i++) {
    const held = pr.swing.t0 != null ? stick : { x: 0, y: 0 };
    for (const e of E.practiceStep(pr, { stick: held })) {
      if (e.type === 'swing') swing = e;
      if (e.type === 'hit' && e.by === 'player') contact = e;
      if (e.type === 'whiff') contact = e;
      if (e.type === 'return') ret = e;
    }
    if (contact && contact.type === 'whiff') break;
  }
  return { contact, ret, pr, swing, ideal, tap };
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

test('a tap inside the buffer fires at the ideal moment; earlier is TOO EARLY', () => {
  const T = C.timing;
  for (const ms of [-60, -100, -(T.bufferMs - 5), -(T.bufferMs + T.earlyGraceMs - 5)]) {
    const r = trial({ offMs: ms });
    const idealStart = r.ideal.t - C.swing.backswing;
    assert.ok(Math.abs(r.swing.t - idealStart) < 1e-6, `${ms} ms: swing started ${(r.swing.t - idealStart) * 1000} ms off`);
    assert.equal(r.contact.type, 'hit', `${ms} ms: ${r.contact.reason}`);
    assert.ok(Math.abs(r.contact.errMs - ms) < 3, `measured ${r.contact.errMs} for ${ms}`);
    assert.equal(r.contact.band, ms >= -T.bufferMs ? 'GOOD' : 'POOR', `${ms} ms band`);
  }
  // Outside the buffer and its grace: the swing goes at once and is early.
  const r = trial({ offMs: -(T.bufferMs + T.earlyGraceMs + 20) });
  assert.ok(Math.abs(r.swing.t - r.tap) < 1e-9, 'swings at the tap');
  assert.equal(r.contact.type, 'whiff');
  assert.equal(r.contact.reason, 'early');
});

test('a late tap catches up, then loses quality step by step, then is TOO LATE', () => {
  const T = C.timing, sw = C.swing;
  let prevQ = 1.01;
  for (const ms of [0, 60, 120, 180]) {
    const r = trial({ offMs: ms });
    assert.equal(r.contact.type, 'hit', `${ms} ms: ${r.contact.reason}`);
    assert.ok(Math.abs(r.contact.errMs - ms) < 3, `measured ${r.contact.errMs} for ${ms}`);
    assert.ok(r.contact.quality < prevQ, `${ms} ms quality ${r.contact.quality} not below ${prevQ}`);
    assert.ok(Math.abs(r.swing.bs - Math.max(sw.minBackswing, sw.backswing - ms / 1000)) < 1e-9, `${ms} ms backswing ${r.swing.bs}`);
    prevQ = r.contact.quality;
  }
  // Up to (backswing - minBackswing) late, contact lands on the ideal instant.
  const r = trial({ offMs: 60 });
  assert.ok(Math.abs(r.swing.t + r.swing.bs - r.ideal.t) < 1e-6);
  assert.equal(r.contact.band, 'GOOD');
  const late = trial({ offMs: T.poorMs + T.lateGraceMs + 20 });
  assert.equal(late.contact.type, 'whiff');
  assert.equal(late.contact.reason, 'late');
});

test('poor timing pulls the shot off line; a buffered tap does not', () => {
  const ok = trial({}).ret, buffered = trial({ offMs: -100 }).ret;
  const early = trial({ offMs: -(C.timing.bufferMs + 15) }).ret, late = trial({ offMs: 120 }).ret;
  // Forehand: early pulls left, late pushes right.
  assert.ok(Math.abs(buffered.X - ok.X) < 0.5, `buffered ${buffered.X} vs ${ok.X}`);
  assert.ok(early.X < ok.X - 0.5, `early ${early.X} vs ${ok.X}`);
  assert.ok(late.X > ok.X + 1, `late ${late.X} vs ${ok.X}`);
});

test('reach zone: inside is a hit, outside is TOO FAR LEFT / RIGHT', () => {
  const near = trial({ dx: 0.6 });
  assert.equal(near.contact.type, 'hit');
  assert.ok(near.contact.quality < 1);
  // A feed near the middle, so the player can stand well off either side.
  let seed = 1;
  while (Math.abs(idealContact(seed, 'top').X) > 1.2) seed++;
  const X = idealContact(seed, 'top').X, off = C.contact.side + C.contact.reach + 0.6;
  // Player further left: the ball is out on their right, beyond reach.
  const right = trial({ seed, px: X - off });
  assert.equal(right.contact.type, 'whiff');
  assert.equal(right.contact.reason, 'right');
  const left = trial({ seed, px: X + off });
  assert.equal(left.contact.type, 'whiff');
  assert.equal(left.contact.reason, 'left');
});

test('each miss reason is returned for crafted cases', () => {
  const c = C.contact, T = C.timing;
  const p = { X: 0, Y: 24 }, at = { X: c.side, Y: 24 - c.ahead, H: 1, vy: 15, live: true, phase: 'bounced' };
  const j = (b, tm) => E.judgeContact(Object.assign({}, at, b), p, C, Object.assign({ kind: 'ok', tapErr: 0 }, tm));
  assert.equal(j({}).contact, true);
  assert.equal(j({}).band, 'PERFECT');
  assert.equal(j({}, { tapErr: -(T.bufferMs + T.earlyGraceMs + 1) }).reason, 'early');
  assert.equal(j({}, { tapErr: T.poorMs + T.lateGraceMs + 1 }).reason, 'late');
  assert.equal(j({ X: -(c.side + c.reach + 0.1) }).reason, 'left');
  assert.equal(j({ X: c.side + c.reach + 0.1 }).reason, 'right');
  assert.equal(j({ H: c.maxH + 0.1 }).reason, 'deep');
  assert.equal(j({}, { kind: 'deep', tapErr: null }).reason, 'deep');
  assert.equal(j({ H: c.minH - 0.05 }).reason, 'short');
  assert.equal(j({}, { kind: 'short', tapErr: null }).reason, 'short');
  assert.equal(j({ phase: 'dead' }).reason, 'short');
  assert.equal(j({ live: false }).reason, 'none');
  // A ball never swung at: why it got away.
  const pr = E.createPractice(1);
  const why = x => { pr.crossing = x; return E.missReason(pr); };
  const cx = { X: c.side, H: 1, phase: 'bounced', pX: 0, pY: 24 };
  assert.equal(why(Object.assign({}, cx)), 'noswing');
  assert.equal(why(Object.assign({}, cx, { phase: 'flight' })), 'deep');
  assert.equal(why(Object.assign({}, cx, { H: c.maxH + 0.2 })), 'deep');
  assert.equal(why(Object.assign({}, cx, { H: 0.05 })), 'short');
  assert.equal(why(Object.assign({}, cx, { X: -3 })), 'left');
  assert.equal(why(Object.assign({}, cx, { X: 3 })), 'right');
  assert.equal(why(null), 'short');
  for (const r of ['early', 'late', 'left', 'right', 'deep', 'short', 'noswing']) assert.ok(E.MISS_TEXT[r]);
});

test('forehand on the right and in the middle, backhand clearly on the left', () => {
  assert.equal(E.strokeFor(0.8), 'fh');
  assert.equal(E.strokeFor(0), 'fh');
  assert.equal(E.strokeFor(-0.1), 'fh');
  assert.equal(E.strokeFor(-1.0), 'bh');
  const p = { X: 0, Y: 24 }, b = { Y: 23.5, H: 1, vy: 15, hittable: true };
  assert.equal(E.judgeContact(Object.assign({ X: -C.contact.side }, b), p).stroke, 'bh');
  assert.equal(E.judgeContact(Object.assign({ X: -C.contact.side }, b), p).band, 'PERFECT');
  assert.equal(E.judgeContact(Object.assign({ X: C.contact.side }, b), p).stroke, 'fh');
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
  const pr = quiet(1, 'auto'), P = C.player;
  for (let i = 0; i < 12; i++) E.practiceStep(pr, { stick: { x: 1, y: 0 } }); // 0.1 s
  assert.ok(pr.player.vx > 0 && pr.player.vx < P.speedX, `vx ${pr.player.vx}`);
  for (let i = 0; i < 6; i++) E.practiceStep(pr, { stick: { x: -0.05, y: 0 } }); // inside the deadzone
  E.practiceStep(pr, { stick: { x: 1, y: 0 } });
  pr.player.X = -3;
  for (let i = 0; i < 120; i++) E.practiceStep(pr, { stick: { x: 1, y: 0 } });
  assert.ok(Math.abs(pr.player.vx - P.speedX) < 1e-9, `vx ${pr.player.vx}`);
  let n = 0;
  while (pr.player.vx > 0 && n < 120) { E.practiceStep(pr, {}); n++; }
  assert.ok(n * C.dt <= P.speedX / P.decel + 2 * C.dt, `stopped in ${n} steps`);
});

test('the player reaches the net zone; the clamp stops them at the net and sidelines', () => {
  const B = E.playerBounds();
  assert.equal(B.minY, COURT.netY + C.player.netGap);
  assert.ok(B.minX < -COURT.singlesHalf && B.maxX > COURT.singlesHalf, 'just outside the singles sidelines');
  assert.ok(B.maxX < COURT.doublesHalf);
  for (const sx of [1, -1]) {
    const pr = quiet(1, 'auto');
    let minY = Infinity;
    for (let i = 0; i < 120 * 4; i++) {
      E.practiceStep(pr, { stick: { x: sx, y: -1 } });
      minY = Math.min(minY, pr.player.Y);
      assert.ok(Math.abs(pr.player.X) <= B.maxX + 1e-9);
    }
    assert.equal(pr.player.Y, B.minY, 'stopped at the net limit');
    assert.ok(minY >= B.minY && minY > COURT.netY, 'never touched the net');
    assert.equal(pr.player.X, sx > 0 ? B.maxX : B.minX);
    // Within about 3 m of the net: the net zone.
    assert.ok(pr.player.Y - COURT.netY < 3);
    // And all the way back.
    for (let i = 0; i < 120 * 4; i++) E.practiceStep(pr, { stick: { x: 0, y: 1 } });
    assert.equal(pr.player.Y, B.maxY);
  }
});

test('a swing runs ready, backswing, contact, follow-through, recovery, ready', () => {
  const s = C.swing;
  assert.equal(E.swingPhase(null), 'ready');
  assert.equal(E.swingPhase(0.05), 'backswing');
  assert.equal(E.swingPhase(s.backswing + 0.01), 'contact');
  assert.equal(E.swingPhase(s.backswing + 0.1), 'follow-through');
  assert.equal(E.swingPhase(s.backswing + s.follow + 0.1), 'recovery');
  assert.equal(E.swingPhase(s.backswing + s.follow + s.recovery + 0.01), 'ready');
  assert.equal(E.swingPhase(0.08, C, 0.07), 'contact'); // a shortened backswing
  // A second tap during the swing is ignored.
  const pr = E.createPractice(1);
  E.requestSwing(pr, 'top', 0.1); E.requestSwing(pr, 'lob', 0.3);
  const swings = [];
  for (let i = 0; i < 120; i++) for (const e of E.practiceStep(pr, {})) if (e.type === 'swing') swings.push(e.shot);
  assert.deepEqual(swings, ['top']);
});

test('a ball the player never swings at is missed with a reason and resets the rally', () => {
  // Strong assist puts the player in reach; they just don't swing.
  const pr = E.createPractice(3);
  pr.assist = 'strong';
  pr.rally = 4;
  let missed = null;
  for (let i = 0; i < 120 * 6 && !missed; i++) for (const e of E.practiceStep(pr, {})) if (e.type === 'missed') missed = e;
  assert.ok(missed);
  assert.equal(missed.reason, 'noswing');
  assert.equal(pr.misses.noswing, 1);
  assert.equal(pr.rally, 0);
  assert.equal(pr.best, 0);
});

test('machine feeds are always reachable from anywhere in the player\'s range', () => {
  const B = E.playerBounds();
  const xs = [B.minX, 0, B.maxX], ys = [B.minY, (B.minY + B.maxY) / 2, COURT.length - 1, B.maxY];
  let n = 0;
  for (const pace of [C.feed.pace, 1]) {
    for (const mode of ['flat', 'top', 'lob']) {
      for (const X of xs) {
        for (const Y of ys) {
          for (const seed of [1, 2]) {
            const pr = quiet(seed, mode);
            pr.pace = pace; pr.player.X = X; pr.player.Y = Y;
            const hit = feedFirst(pr);
            const plan = E.reachPlan(pr.path, pr.player, C, pr.path[0].t);
            assert.ok(plan && plan.slack >= 0 && hit.reachable, `${pace} ${mode} from (${X.toFixed(1)}, ${Y.toFixed(1)}) seed ${seed}: slack ${plan && plan.slack}`);
            n++;
          }
        }
      }
    }
  }
  assert.equal(n, 144);
});

// A bot that runs to the reach plan's stance and taps at the ideal moment.
function botRally(seed, mode, X, Y, pace, stroke, shot) {
  const pr = quiet(seed, mode);
  pr.pace = pace; pr.player.X = X; pr.player.Y = Y;
  feedFirst(pr);
  const best = E.reachPlan(pr.path, pr.player, C, pr.t);
  const plan = stroke ? best.byStroke[stroke] : best;
  let tapped = false, out = null;
  for (let i = 0; i < 120 * 6 && !out; i++) {
    const p = pr.player, dx = plan.X - p.X, dy = plan.Y - p.Y;
    const stick = { x: clampN(dx * 3), y: clampN(dy * 3 * C.player.speedX / C.player.speedY) };
    const pred = E.predictContact(pr);
    const bs = E.swingPreset(C, shot || 'top', pred.stroke).backswing;
    if (!tapped && pred.kind === 'ok' && Math.hypot(dx, dy) < 0.15 && pr.t >= pred.t - bs - 0.1) {
      E.requestSwing(pr, shot || 'top', pred.t - bs);
      tapped = true;
    }
    for (const e of E.practiceStep(pr, { stick: tapped ? {} : stick })) {
      if ((e.type === 'hit' && e.by === 'player') || e.type === 'whiff' || e.type === 'missed') out = e;
    }
  }
  return out;
}
const clampN = v => Math.max(-1, Math.min(1, v));

test('a player who runs to the feed from anywhere can hit it', () => {
  const B = E.playerBounds();
  for (const pace of [C.feed.pace, 1]) {
    for (const mode of ['flat', 'top', 'lob']) {
      for (const [X, Y] of [[0, B.minY], [B.minX, B.minY], [B.maxX, B.maxY], [0, 24.2], [-2, 18]]) {
        const e = botRally(5, mode, X, Y, pace);
        assert.equal(e && e.type, 'hit', `${pace} ${mode} from (${X}, ${Y}): ${e && (e.reason || e.type)}`);
      }
    }
  }
});

test('slow feeds land within 0.3 m of their targets', () => {
  const from = { side: 'far', X: 0.5, Y: C.farContactY, H: 1 };
  for (const key of ['flat', 'top', 'lob']) {
    const mul = Math.max(C.feed.pace, C.feed.minPace[key] || 0);
    for (const dY of [-0.75, 0, 0.75]) {
      for (const X of [-2.5, 0, 2.5]) {
        const target = { X, Y: COURT.length - C.shots[key].depth + dY };
        const shot = E.solveShot(from, target, key, C, { speedMul: mul, angles: C.feed.angles[key] });
        const s = E.simulate(from, shot);
        const err = Math.hypot(s.firstBounce.X - target.X, s.firstBounce.Y - target.Y);
        assert.ok(err < 0.3, `${key} to ${X}, ${target.Y.toFixed(1)}: off by ${err.toFixed(2)} m`);
      }
    }
  }
});

test('assist drifts the player towards the predicted contact and never overrides the stick', () => {
  // No stick: strong assist ends near the stance; off doesn't move.
  const run = (assist, stick) => {
    const pr = E.createPractice(4);
    pr.mode = 'top'; pr.assist = assist; pr.player.X = 2.5;
    feedFirst(pr, { stick });
    const target = E.assistTarget(pr);
    const xs = [];
    for (let i = 0; i < 120 * 3 && pr.live && pr.hitBy === 'machine' && !pr.crossing; i++) {
      E.practiceStep(pr, { stick });
      xs.push(pr.player.X);
    }
    return { pr, target, xs };
  };
  const off = run('off', {}), strong = run('strong', {}), light = run('light', {});
  assert.equal(off.pr.player.X, 2.5);
  assert.ok(Math.abs(strong.target.X - 2.5) > 1, 'the test feed needs a real move');
  assert.ok(Math.abs(strong.pr.player.X - strong.target.X) < 0.3, `strong ended ${strong.pr.player.X}, target ${strong.target.X}`);
  const dLight = Math.abs(light.pr.player.X - light.target.X);
  assert.ok(dLight < Math.abs(2.5 - light.target.X), 'light moves towards it');
  assert.ok(Math.abs(strong.pr.player.X - strong.target.X) <= dLight + 1e-9, 'strong gets at least as close as light');
  // A held stick wins on its axis: X moves exactly as with assist off.
  for (const stick of [{ x: 1, y: 0 }, { x: -0.6, y: 0 }]) {
    const a = run('off', stick), b = run('strong', stick);
    const k = Math.min(a.xs.length, b.xs.length);
    assert.ok(k > 30);
    assert.deepEqual(b.xs.slice(0, k), a.xs.slice(0, k));
  }
});

test('practice is deterministic: same seed, inputs and steps give the same result', () => {
  function run(assist) {
    const pr = E.createPractice(11);
    pr.assist = assist;
    const log = [];
    for (let i = 0; i < 120 * 20; i++) {
      const stick = { x: Math.sin(i / 50), y: Math.cos(i / 90) * 0.5 };
      if (i % 97 === 0) E.requestSwing(pr, ['top', 'flat', 'lob', 'drop'][i % 4], pr.t + 0.003);
      for (const e of E.practiceStep(pr, { stick: i % 400 < 200 ? stick : {} })) {
        if (e.type !== 'bounce' || e.n === 1) log.push(JSON.stringify(e));
      }
    }
    log.push(JSON.stringify([pr.player, pr.ball, pr.rally, pr.best, pr.misses]));
    return log;
  }
  for (const assist of ['off', 'light', 'strong']) {
    const a = run(assist), b = run(assist);
    assert.deepEqual(a, b);
    assert.ok(a.some(l => l.includes('"type":"swing"')));
  }
});

// ---------------------------------------------------------------------------
// Stage 2.2: drop shot.
// ---------------------------------------------------------------------------
const pastNet = Y => COURT.netY - Y;

// First bounce, net clearance, and the bounce after it (peak height and
// how far on the second bounce or roll-out is).
function flight(from, shot) {
  const b = E.createBall();
  E.launch(b, from, shot);
  let b1 = null, b2 = null, peak = 0, clear = Infinity, pY = b.Y;
  while (b.t < 6 && !b2) {
    const ev = E.step(b);
    if (!b1 && (pY - COURT.netY) * (b.Y - COURT.netY) <= 0) clear = b.H - E.netHeight(b.X);
    pY = b.Y;
    for (const e of ev) if (e.type === 'bounce') { if (e.n === 1) b1 = { X: e.X, Y: e.Y, result: e.result }; else b2 = { Y: e.Y }; }
    if (b1 && !b2) peak = Math.max(peak, b.H);
    if (b1 && !b2 && b.rolling) b2 = { Y: b.Y };
  }
  return { b1, b2, peak, clear, net: b.touchedNet, ball: b };
}

test('a drop lands within the configured band past the net', () => {
  const d = C.drop;
  for (const [X, Y] of [[0, 25], [0, 24.2], [3, 24.2], [-3, 22], [0, 19], [2, 16]]) {
    const from = { side: 'near', X, Y, H: 0.9 };
    const shot = E.solveShot(from, { X: 0, Y: COURT.netY - d.pastNet }, 'drop', C, { clearNet: true });
    const f = flight(from, shot);
    assert.ok(f.b1 && f.b1.result === 'IN', `from ${X}, ${Y}`);
    const p = pastNet(f.b1.Y);
    assert.ok(p >= d.band[0] && p <= d.band[1], `from ${X}, ${Y}: ${p.toFixed(2)} m past the net`);
    assert.ok(f.clear > 0 && f.clear < 0.3, `tight over the tape: ${f.clear.toFixed(2)}`);
  }
  // In play, from a fed ball, with the stick nudging it within the band.
  for (const [stick, lo, hi] of [[{ x: 0, y: 0 }, d.band[0], d.band[1]], [{ x: 0, y: -1 }, d.pastNet, d.band[1] + 0.4], [{ x: 0, y: 1 }, d.band[0] - 0.3, d.pastNet]]) {
    const { contact, ret } = trial({ shot: 'drop', stick });
    assert.equal(contact.band, 'PERFECT');
    assert.equal(contact.shot, 'drop');
    const p = pastNet(ret.Y);
    assert.equal(ret.result, 'IN');
    assert.ok(p >= lo && p <= hi, `stick ${stick.y}: ${p.toFixed(2)} m past the net`);
  }
  const L = trial({ shot: 'drop', stick: { x: -1, y: 0 } }).ret, R = trial({ shot: 'drop', stick: { x: 1, y: 0 } }).ret;
  assert.ok(L.X < -2 && R.X > 2, `left ${L.X}, right ${R.X}`);
});

test('a drop\'s bounce is lower and shorter than topspin\'s at the same landing spot', () => {
  const from = { side: 'near', X: 0, Y: 22, H: 0.9 }, target = { X: 0, Y: COURT.netY - 2.5 };
  const drop = flight(from, E.solveShot(from, target, 'drop', C, { clearNet: true }));
  const top = flight(from, E.solveShot(from, target, 'top', C, { speedMul: 0.55, angles: [-5, 30], clearNet: true }));
  assert.ok(Math.abs(drop.b1.Y - top.b1.Y) < 0.6, `same spot: ${drop.b1.Y.toFixed(2)} vs ${top.b1.Y.toFixed(2)}`);
  assert.ok(drop.peak < top.peak * 0.7, `peak ${drop.peak.toFixed(2)} vs topspin ${top.peak.toFixed(2)}`);
  const dropOn = drop.b1.Y - drop.b2.Y, topOn = top.b1.Y - top.b2.Y;
  assert.ok(dropOn < topOn * 0.5, `second bounce ${dropOn.toFixed(2)} m on vs topspin ${topOn.toFixed(2)} m`);
});

test('a poor drop hits the net or lands outside the band; a perfect one does neither', () => {
  const d = C.drop, from = { side: 'near', X: 0.5, Y: 23.5, H: 0.9 };
  const poor = { stroke: 'fh', perfect: false, quality: 0.15, pull: 0, band: 'POOR' };
  const kinds = new Set();
  for (let seed = 1; seed <= 24; seed++) {
    const aim = E.aimReturn(poor, {}, 'drop', C, E.rng(seed));
    kinds.add(aim.risk);
    let shot = E.solveShot(from, aim.target, 'drop', C, { speedMul: aim.pace, clearNet: !aim.noClear });
    if (aim.lift) shot = Object.assign({}, shot, liftBy(shot, aim.lift));
    shot.spin *= aim.spinMul;
    const f = flight(from, shot);
    const p = f.b1 ? pastNet(f.b1.Y) : null;
    const fault = f.net || !f.b1 || f.b1.result !== 'IN' || p < d.band[0] || p > d.band[1];
    assert.ok(fault, `seed ${seed} ${aim.risk}: landed ${p && p.toFixed(2)} m past the net`);
  }
  assert.deepEqual([...kinds].sort(), ['float', 'short']);
  const perfect = E.aimReturn({ stroke: 'fh', perfect: true, quality: 1, pull: 0 }, {}, 'drop', C, E.rng(1));
  assert.equal(perfect.risk, null);
});
function liftBy(shot, deg) {
  const v = Math.hypot(shot.vx, shot.vy, shot.vz), h = Math.hypot(shot.vx, shot.vy), a = (shot.angle + deg) * Math.PI / 180;
  return { vx: shot.vx / h * v * Math.cos(a), vy: shot.vy / h * v * Math.cos(a), vz: v * Math.sin(a) };
}

test('the drop swing is a shorter, softer preset of the same state machine', () => {
  const base = E.swingPreset(C, 'top'), drop = E.swingPreset(C, 'drop');
  assert.ok(drop.backswing < base.backswing && drop.follow < base.follow);
  const r = trial({ shot: 'drop', offMs: 0 });
  assert.ok(Math.abs(r.swing.bs - drop.backswing) < 1e-9);
  assert.equal(r.contact.type, 'hit');
});

test('machine drop feeds are reachable and land short', () => {
  const B = E.playerBounds();
  for (const pace of [C.feed.pace, 1]) {
    for (const [X, Y] of [[0, B.maxY], [B.minX, 24.2], [B.maxX, 20], [0, B.minY]]) {
      for (const seed of [1, 2, 3]) {
        const pr = quiet(seed, 'drop');
        pr.pace = pace; pr.player.X = X; pr.player.Y = Y;
        const hit = feedFirst(pr);
        assert.equal(hit.shot, 'drop');
        assert.ok(hit.reachable, `${pace} from (${X}, ${Y}) seed ${seed}`);
        assert.ok(hit.landing.Y - COURT.netY < 6, `lands ${(hit.landing.Y - COURT.netY).toFixed(1)} m past the net`);
      }
      const e = botRally(4, 'drop', X, Y, pace);
      assert.equal(e && e.type, 'hit', `bot from (${X}, ${Y}): ${e && (e.reason || e.type)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Stage 2.3: net play.
// ---------------------------------------------------------------------------
// A straight-line test path from Y0 to Y1 towards the near baseline,
// bouncing at bounceY (or never), with height H(Y).
function linePath({ X = 0.9, Y0 = 6, Y1 = 26, bounceY = null, H }) {
  const pts = [];
  for (let i = 0; i <= 400; i++) {
    const Y = Y0 + (Y1 - Y0) * i / 400;
    pts.push({ t: i * 0.004, X, Y, H: H(Y), vy: 20, phase: bounceY != null && Y >= bounceY ? 'bounced' : 'flight' });
  }
  return pts;
}

test('zones by distance to the net', () => {
  const n = COURT.netY;
  assert.equal(E.zoneOf(n + 1), 'NET');
  assert.equal(E.zoneOf(n + C.zones.net), 'NET');
  assert.equal(E.zoneOf(n + C.zones.net + 0.1), 'MID');
  assert.equal(E.zoneOf(n + 6.4), 'MID');            // the service line
  assert.equal(E.zoneOf(n + C.zones.back - 0.1), 'MID');
  assert.equal(E.zoneOf(n + C.zones.back), 'BACK');
  assert.equal(E.zoneOf(24.2), 'BACK');
  assert.equal(E.zoneOf(E.playerBounds().minY), 'NET');
});

test('stroke by situation: volley, groundstroke or smash', () => {
  const n = COURT.netY, at = Y => ({ X: 0, Y });
  const air = linePath({ H: () => 1.1 });                       // never bounces on the way
  assert.equal(E.predictFor(air, at(n + 2)).stroke, 'volley');  // NET
  assert.equal(E.predictFor(air, at(n + 6)).stroke, 'volley');  // MID
  assert.equal(E.predictFor(air, at(24.2)).kind, 'deep');       // BACK: it gets past you
  const bounced = linePath({ bounceY: n + 1, H: () => 1.0 });   // bounces in front
  const g = E.predictFor(bounced, at(n + 3));
  assert.equal(g.kind, 'ok');
  assert.equal(g.stroke, 'ground');
  assert.equal(E.predictFor(bounced, at(24.2)).stroke, 'ground');
  const high = linePath({ H: () => 2.6 });
  assert.equal(E.predictFor(high, at(n + 2)).stroke, 'smash');
  assert.equal(E.predictFor(high, at(n + 7)).stroke, 'smash');
  // The forehand / backhand rule holds for volleys too.
  const p = { X: 0, Y: n + 2 }, b = { Y: n + 2 - C.contact.volley.ahead, H: 1.2, vy: 20, live: true, phase: 'flight' };
  const vb = E.judgeContact(Object.assign({ X: -0.9 }, b), p, C, { kind: 'ok', tapErr: 0, stroke: 'volley' });
  assert.equal(vb.stroke, 'bh'); assert.equal(vb.kind, 'volley'); assert.equal(vb.contact, true);
  const vf = E.judgeContact(Object.assign({ X: 0.9 }, b), p, C, { kind: 'ok', tapErr: 0, stroke: 'volley' });
  assert.equal(vf.stroke, 'fh'); assert.equal(vf.band, 'PERFECT');
  // An unbounced ball is no groundstroke.
  assert.equal(E.judgeContact(Object.assign({ X: 0.9 }, b), p, C, { kind: 'ok', tapErr: 0 }).reason, 'early');
  assert.equal(E.strokeLabel('volley', 'top'), 'VOLLEY');
  assert.equal(E.strokeLabel('volley', 'drop'), 'DROP VOLLEY');
  assert.equal(E.strokeLabel('smash', 'lob'), 'SMASH');
});

test('volley swing is shorter than a groundstroke; volley windows are no harsher', () => {
  const total = p => p.backswing + p.follow + p.recovery;
  const g = E.swingPreset(C, 'top'), v = E.swingPreset(C, 'top', 'volley'), sm = E.swingPreset(C, 'flat', 'smash');
  assert.ok(v.backswing < g.backswing / 2, `volley backswing ${v.backswing}`);
  assert.ok(total(v) < total(g) * 0.6);
  assert.ok(sm.backswing <= g.backswing);
  const gt = E.timingFor(C), vt = E.timingFor(C, 'volley');
  assert.ok(vt.perfectMs >= gt.perfectMs && vt.goodMs >= gt.goodMs && vt.poorMs >= gt.poorMs);
  assert.ok(vt.bufferMs >= gt.bufferMs);
});

test('the aim solver lands volleys and smashes in the court over the net', () => {
  const n = COURT.netY, perfect = { stroke: 'fh', perfect: true, quality: 1, pull: 0, kind: 'volley' };
  for (const Y of [n + 1.2, n + 2.5, n + 5, n + 8]) {
    for (const X of [-3, 0, 3]) {
      for (const H of [0.5, 1.0, 1.7]) {
        for (const shot of ['flat', 'top', 'drop', 'lob']) {
          for (const sx of [-1, 0, 1]) {
            const aim = E.aimReturn(Object.assign({ H, Y }, perfect), { x: sx, y: 0 }, shot, C, E.rng(1), 18);
            const from = { side: 'near', X, Y, H };
            const s = E.simulate(from, E.solveShot(from, aim.target, aim.defKey, C, { speedMul: aim.pace, angles: aim.angles, clearNet: true }));
            assert.ok(s.firstBounce && !s.net && !s.ball.touchedNet, `${shot} volley from ${X}, ${(Y - n).toFixed(1)} m, ${H} m`);
            assert.equal(s.firstBounce.result, 'IN', `${shot} volley from ${X}, ${(Y - n).toFixed(1)} m, ${H} m, stick ${sx}: ${s.firstBounce.X.toFixed(1)}, ${s.firstBounce.Y.toFixed(1)}`);
          }
        }
      }
      for (const H of [2.1, 2.6, 3.2]) {
        for (const sx of [-1, 0, 1]) {
          const aim = E.aimReturn(Object.assign({}, perfect, { kind: 'smash' }), { x: sx, y: 0 }, 'flat', C, E.rng(1));
          const from = { side: 'near', X, Y, H };
          const shot = E.solveShot(from, aim.target, aim.defKey, C, { speedMul: aim.pace, clearNet: true });
          const s = E.simulate(from, shot);
          assert.ok(shot.angle < 0, `a smash goes down: ${shot.angle.toFixed(1)}°`);
          assert.ok(s.firstBounce && !s.ball.touchedNet && s.firstBounce.result === 'IN', `smash from ${X}, ${(Y - n).toFixed(1)} m, ${H} m`);
        }
      }
    }
  }
  // Volleys take their pace from the incoming ball.
  const slow = E.aimReturn(perfect, {}, 'flat', C, E.rng(1), 10), fast = E.aimReturn(perfect, {}, 'flat', C, E.rng(1), 30);
  assert.ok(fast.pace > slow.pace);
});

test('volley and overhead feeds are reachable, and volleyed or smashed from the net', () => {
  const B = E.playerBounds(), n = COURT.netY;
  for (const mode of ['volley', 'overhead']) {
    const want = mode === 'volley' ? 'volley' : 'smash';
    for (const pace of [C.feed.pace, 1]) {
      for (const [X, Y] of [[0, B.minY], [B.minX, n + 2.5], [B.maxX, n + 6], [0, 24.2], [B.minX, B.maxY]]) {
        for (const seed of [1, 2]) {
          const pr = quiet(seed, mode);
          pr.pace = pace; pr.player.X = X; pr.player.Y = Y;
          const hit = feedFirst(pr);
          assert.ok(hit.reachable, `${mode} ${pace} from (${X}, ${Y}) seed ${seed}`);
          if (E.zoneOf(Y) !== 'BACK') {
            const plan = E.reachPlan(pr.path, pr.player, C, pr.path[0].t);
            assert.ok(plan.byStroke[want] && plan.byStroke[want].slack >= 0, `${mode} from (${X}, ${Y}): no ${want}`);
          }
        }
      }
      for (const [X, Y] of [[0, n + 2], [-2, n + 4]]) {
        for (const shot of ['flat', 'top', 'drop', 'lob']) {
          const e = botRally(3, mode, X, Y, pace, want, shot);
          assert.equal(e && e.type, 'hit', `${mode} ${shot} from (${X}, ${Y}): ${e && (e.reason || e.type)}`);
          assert.equal(e.kind, want);
          assert.equal(e.label, E.strokeLabel(want, shot));
        }
      }
    }
  }
});

test('a short ball makes the player step up; assist and movement get them there', () => {
  for (const seed of [1, 2, 3]) {
    const pr = E.createPractice(seed);
    pr.mode = 'short'; pr.assist = 'strong';
    const hit = feedFirst(pr);
    assert.ok(hit.reachable);
    assert.ok(hit.landing.Y - COURT.netY < 7, `lands ${(hit.landing.Y - COURT.netY).toFixed(1)} m past the net`);
    const y0 = pr.player.Y;
    for (let i = 0; i < 120 * 3 && !pr.crossing; i++) E.practiceStep(pr, {});
    assert.ok(y0 - pr.player.Y > 2, `stepped up ${(y0 - pr.player.Y).toFixed(2)} m`);
    const e = botRally(seed, 'short', 0, 24.2, C.feed.pace);
    assert.equal(e && e.type, 'hit', `bot: ${e && (e.reason || e.type)}`);
  }
  assert.ok(C.feed.auto.includes('short'), 'Auto mixes in short balls');
});

test('net play is deterministic', () => {
  function run() {
    const log = [];
    for (const mode of ['volley', 'overhead', 'short']) {
      const pr = E.createPractice(21);
      pr.mode = mode; pr.player.Y = COURT.netY + 2.5;
      for (let i = 0; i < 120 * 12; i++) {
        if (i % 61 === 0) E.requestSwing(pr, ['top', 'flat', 'lob', 'drop'][i % 4], pr.t + 0.002);
        for (const e of E.practiceStep(pr, { stick: { x: Math.sin(i / 40) * 0.3, y: 0 } })) {
          if (e.type !== 'bounce' || e.n === 1) log.push(JSON.stringify(e));
        }
      }
      log.push(JSON.stringify([pr.player, pr.ball, pr.misses]));
    }
    return log;
  }
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.ok(a.some(l => l.includes('"kind":"volley"') || l.includes('"stroke":"volley"')));
});

// ---------------------------------------------------------------------
// Stage 3: match rules and scoring
// ---------------------------------------------------------------------
const win = (sc, who, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...E.pointWon(sc, who)); return ev; };
const games = (sc, who, n) => { for (let i = 0; i < n; i++) win(sc, who, 4); };

test('scoring: a love game goes 15, 30, 40, game', () => {
  const sc = E.createScore('quick');
  const said = [];
  for (let i = 0; i < 3; i++) { E.pointWon(sc, 0); said.push(E.pointsText(sc)); }
  assert.deepEqual(said, ['15–0', '30–0', '40–0']);
  const ev = E.pointWon(sc, 0);
  assert.ok(ev.some(e => e.type === 'game' && e.who === 0));
  assert.deepEqual(sc.sets[0], [1, 0]);
  assert.deepEqual(sc.points, [0, 0]);
});

test('scoring: deuce, advantage, back to deuce, then a game from advantage', () => {
  const sc = E.createScore('quick');
  win(sc, 0, 3); win(sc, 1, 3);
  assert.equal(E.pointsText(sc), 'DEUCE');
  E.pointWon(sc, 1); assert.equal(E.pointsText(sc), 'ADV CPU');
  E.pointWon(sc, 0); assert.equal(E.pointsText(sc), 'DEUCE');
  E.pointWon(sc, 0); assert.equal(E.pointsText(sc), 'ADV YOU');
  assert.deepEqual(sc.sets[0], [0, 0]);
  const ev = E.pointWon(sc, 0);
  assert.ok(ev.some(e => e.type === 'game' && e.who === 0));
  assert.deepEqual(sc.sets[0], [1, 0]);
});

test('scoring: the score is called server first', () => {
  const sc = E.createScore('quick', C, 1);   // the CPU serves
  E.pointWon(sc, 0);
  assert.equal(E.pointsText(sc), '0–15');
});

test('scoring: Quick sets end 3-1 or 4-2, never 3-2', () => {
  const a = E.createScore('quick');
  games(a, 0, 2); games(a, 1, 1);
  const ev = win(a, 0, 4);
  assert.ok(ev.some(e => e.type === 'set' && e.who === 0));
  assert.deepEqual(a.sets[0], [3, 1]);
  assert.equal(a.winner, 0);

  const b = E.createScore('quick');
  games(b, 0, 2); games(b, 1, 2); games(b, 0, 1);
  assert.deepEqual(b.sets[0], [3, 2]);
  assert.equal(b.winner, null);
  games(b, 0, 1);
  assert.deepEqual(b.sets[0], [4, 2]);
  assert.equal(b.winner, 0);
});

test('scoring: Standard sets 6-4 and 7-5', () => {
  const a = E.createScore('standard');
  games(a, 1, 4); games(a, 0, 6);
  assert.deepEqual(a.sets[0], [6, 4]); assert.equal(a.winner, 0);
  const b = E.createScore('standard');
  games(b, 0, 5); games(b, 1, 5); games(b, 1, 1);
  assert.equal(b.winner, null);
  games(b, 1, 1);
  assert.deepEqual(b.sets[0], [5, 7]); assert.equal(b.winner, 1);
});

test('tie-break at 6-6: 7-5 wins the set 7-6', () => {
  const sc = E.createScore('standard');
  for (let i = 0; i < 6; i++) { games(sc, 0, 1); games(sc, 1, 1); }
  assert.equal(sc.tiebreak, true);
  win(sc, 0, 5); win(sc, 1, 5);
  assert.equal(E.pointsText(sc).split('–').map(Number).sort().join(), '5,5');
  win(sc, 0, 1);
  assert.equal(sc.winner, null);
  const ev = win(sc, 0, 1);
  assert.ok(ev.some(e => e.type === 'set' && e.tb && e.tb[0] === 7 && e.tb[1] === 5));
  assert.deepEqual(sc.sets[0], [7, 6]);
  assert.equal(sc.winner, 0);
});

test('tie-break needs two clear: 6-6 goes on to 8-6', () => {
  const sc = E.createScore('quick');
  for (let i = 0; i < 3; i++) { games(sc, 0, 1); games(sc, 1, 1); }
  assert.equal(sc.tiebreak, true);
  win(sc, 0, 6); win(sc, 1, 6);
  win(sc, 1, 1); assert.equal(sc.winner, null);   // 6-7
  win(sc, 0, 1); assert.equal(sc.winner, null);   // 7-7
  win(sc, 0, 1); assert.equal(sc.winner, null);   // 8-7
  win(sc, 0, 1);                                   // 9-7
  assert.deepEqual(sc.sets[0], [4, 3]);
  assert.deepEqual(sc.tbScores[0], [9, 7]);
  assert.equal(sc.winner, 0);
});

test('match end: no more points count once it is won', () => {
  const sc = E.createScore('quick');
  games(sc, 1, 3);
  assert.equal(sc.winner, 1);
  assert.deepEqual(E.pointWon(sc, 0), []);
  assert.deepEqual(sc.sets[0], [0, 3]);
});

test('best-of-3 is ready: two sets win it', () => {
  const cfg = Object.assign({}, C, { match: Object.assign({}, C.match, {
    formats: Object.assign({}, C.match.formats, { bo3: { label: 'Bo3', bestOf: 3, games: 3, tiebreakAt: 3, tbPoints: 7 } }) }) });
  const sc = E.createScore('bo3', cfg);
  games(sc, 0, 3); assert.equal(sc.winner, null); assert.equal(sc.sets.length, 2);
  games(sc, 1, 3); assert.equal(sc.winner, null);
  games(sc, 0, 3); assert.equal(sc.winner, 0);
  assert.deepEqual(sc.setsWon, [2, 1]);
});

test('serve: the server alternates each game; courts alternate each point', () => {
  const sc = E.createScore('standard', C, 0);
  const servers = [];
  for (let g = 0; g < 4; g++) { servers.push(E.serverOf(sc)); win(sc, g % 2, 4); }
  assert.deepEqual(servers, [0, 1, 0, 1]);
  const courts = [];
  for (let i = 0; i < 5; i++) { courts.push(E.courtOf(sc)); E.pointWon(sc, i % 2); }
  assert.deepEqual(courts, ['deuce', 'ad', 'deuce', 'ad', 'deuce']);
});

test('serve: tie-break order is one point, then two each; the next set follows on', () => {
  const cfg = Object.assign({}, C, { match: Object.assign({}, C.match, {
    formats: { bo3: { label: 'Bo3', bestOf: 3, games: 3, tiebreakAt: 3, tbPoints: 7 } } }) });
  const sc = E.createScore('bo3', cfg, 0);
  for (let i = 0; i < 3; i++) { win(sc, E.serverOf(sc), 4); win(sc, E.serverOf(sc), 4); }
  assert.equal(sc.tiebreak, true);
  const first = E.serverOf(sc), order = [];
  for (let i = 0; i < 7; i++) { order.push(E.serverOf(sc)); E.pointWon(sc, 0); }
  const o = 1 - first;
  assert.deepEqual(order, [first, o, o, first, first, o, o]);
  assert.equal(sc.tiebreak, false);
  assert.equal(E.serverOf(sc), o, 'the receiver of the first tie-break point serves the next set');
});

test('serve boxes: diagonal, deuce on the server\'s right', () => {
  const nd = E.serviceBox('near', 'deuce'), na = E.serviceBox('near', 'ad');
  assert.ok(nd.maxX === 0 && nd.maxY === COURT.netY);   // far court, left as the near player sees it
  assert.ok(na.minX === 0);
  const fd = E.serviceBox('far', 'deuce');
  assert.ok(fd.minX === 0 && fd.minY === COURT.netY);   // near court, the far server's right is -X
  const svc = COURT.netY - COURT.serviceFromNet;
  assert.equal(E.judgeServe(-2, svc + 1, 'near', 'deuce'), 'IN');
  assert.equal(E.judgeServe(-2, svc, 'near', 'deuce'), 'IN');            // on the line
  assert.equal(E.judgeServe(-2, svc - 0.05, 'near', 'deuce'), 'OUT_LONG');
  assert.equal(E.judgeServe(2, svc + 1, 'near', 'deuce'), 'OUT_WIDE');   // wrong box
  assert.equal(E.judgeServe(-4.2, svc + 1, 'near', 'deuce'), 'OUT_WIDE');
  assert.equal(E.judgeServe(-2, COURT.netY + 1, 'near', 'deuce'), 'NET');
});

// Play one ball for the referee: launched from `from` with `shot`.
function refPlay(r, ball, cfg) {
  cfg = cfg || C;
  for (let i = 0; i < 2400 && !r.over; i++) E.refBall(r, ball, E.step(ball, cfg), cfg);
  return r.over;
}
function servePlay(target, opts) {
  opts = opts || {};
  const r = E.createRally(0, opts.court || 'deuce');
  const ball = E.createBall();
  const from = { side: 'near', X: 0.8, Y: COURT.length - 0.2, H: 2.7 };
  let shot = opts.shot || E.solveShot(from, target, 'flat', C, { clearNet: true });
  E.launch(ball, from, shot);
  E.refHit(r, 0);
  return { r, ball, over: refPlay(r, ball) };
}

test('point: a rally ball that bounces twice is a WINNER for the hitter', () => {
  const r = E.createRally(0, 'deuce'); r.serve = false;
  const ball = E.createBall();
  E.launch(ball, near(0), E.solveShot(near(0), { X: 1, Y: 4 }, 'top', C));
  E.refHit(r, 0); r.serve = false; r.hits = 3;
  assert.deepEqual(refPlay(r, ball), { type: 'point', winner: 0, reason: 'WINNER', by: 0 });
});

test('point: out long and out wide are OUT; into the net is NET', () => {
  for (const [target, reason] of [[{ X: 0, Y: -1.5 }, 'OUT'], [{ X: 5.2, Y: 5 }, 'OUT']]) {
    const r = E.createRally(1, 'deuce');
    const ball = E.createBall();
    E.launch(ball, near(0), E.solveShot(near(0), target, 'flat', C, { clearNet: true }));
    E.refHit(r, 1); E.refHit(r, 0);       // the far player served, the near player returns
    const o = refPlay(r, ball);
    assert.equal(o.reason, reason); assert.equal(o.winner, 1); assert.equal(o.by, 0);
  }
  const r = E.createRally(1, 'deuce');
  const ball = E.createBall();
  E.launch(ball, near(0), E.shotFromAngle(near(0), { X: 0, Y: 4 }, C.shots.flat, -6));
  E.refHit(r, 1); E.refHit(r, 0);
  const o = refPlay(r, ball);
  assert.equal(o.reason, 'NET'); assert.equal(o.winner, 1);
});

test('serve: in the box and untouched is an ACE', () => {
  const { over } = servePlay({ X: -2, Y: COURT.netY - COURT.serviceFromNet + 0.8 });
  assert.deepEqual(over, { type: 'point', winner: 0, reason: 'ACE', by: 0 });
});

test('serve: long, wide or wrong box is a FAULT; into the net is a NET fault', () => {
  const svc = COURT.netY - COURT.serviceFromNet;
  assert.deepEqual(servePlay({ X: -2, Y: svc - 1.5 }).over, { type: 'fault', reason: 'OUT', by: 0 });
  assert.deepEqual(servePlay({ X: 2, Y: svc + 1 }).over, { type: 'fault', reason: 'OUT', by: 0 });
  const from = { side: 'near', X: 0.8, Y: COURT.length - 0.2, H: 2.7 };
  const into = E.shotFromAngle(from, { X: -2, Y: svc }, C.shots.flat, -9);
  assert.deepEqual(servePlay(null, { shot: into }).over, { type: 'fault', reason: 'NET', by: 0 });
});

test('serve: a net cord that lands in the box is a LET; one that lands out is a fault', () => {
  const from = { side: 'near', X: 0.8, Y: COURT.length - 0.2, H: 2.7 };
  const target = { X: -1.5, Y: COURT.netY - 3 };
  let let_ = null, cordOut = null;
  // Search launch angles for a tape clip; keep one that lands in and one out.
  for (let a = -8; a < 2 && !(let_ && cordOut); a += 0.02) {
    for (const speed of [20, 26, 32, 38]) {
      const shot = E.shotFromAngle(from, target, Object.assign({}, C.shots.flat, { speed }), a);
      const s = E.simulate(from, shot, C);
      if (!s.ball.touchedNet || s.net || !s.firstBounce) continue;
      const res = E.judgeServe(s.firstBounce.X, s.firstBounce.Y, 'near', 'deuce');
      if (res === 'IN' && !let_) let_ = shot;
      if (res !== 'IN' && res !== 'NET' && !cordOut) cordOut = shot;
    }
  }
  assert.ok(let_, 'found a let');
  assert.deepEqual(servePlay(null, { shot: let_ }).over, { type: 'let', by: 0 });
  if (cordOut) assert.equal(servePlay(null, { shot: cordOut }).over.type, 'fault');
});

test('point: after a return the serve is no longer an ace', () => {
  const r = E.createRally(1, 'deuce');
  E.refHit(r, 1); E.refHit(r, 0);
  assert.equal(r.serve, false); assert.equal(r.touched, true);
  const ball = E.createBall();
  E.launch(ball, near(0), E.solveShot(near(0), { X: 0, Y: 4 }, 'top', C));
  assert.equal(refPlay(r, ball).reason, 'WINNER');
});

// ---------------------------------------------------------------------
// Stage 3: the serve
// ---------------------------------------------------------------------
// Step until the next serve, tap `shot` errMs from the toss's peak, and
// play on until the serve is decided (fault, let, point) or re-tossed.
function serveOnce(m, shot, errMs, stick, cap) {
  const out = [];
  for (let i = 0; i < (cap || 3000); i++) {
    if (m.phase === 'serve' && m.serve.state === 'toss' && !m.serve.tap && m.serve.server === 0) {
      E.matchSwing(m, shot, m.serve.tossT0 + m.serve.peakT + errMs / 1000);
    }
    for (const e of E.matchStep(m, { stick: stick || { x: 0, y: 0 } })) {
      if (['serve', 'fault', 'let', 'pointEnd', 'retoss'].includes(e.type)) out.push(e);
    }
    if (out.some(e => e.type !== 'serve')) break;
  }
  return out;
}
const lastOf = a => a[a.length - 1];
const withServe = over => Object.assign({}, C, { serve: Object.assign({}, C.serve, over) });

test('serve: the toss goes up by itself and peaks above the server', () => {
  const m = E.createMatch({ seed: 3, serveDrill: true });
  let peak = 0, tossed = false;
  for (let i = 0; i < 240; i++) {
    for (const e of E.matchStep(m, {})) if (e.type === 'toss') tossed = true;
    if (m.ball.phase === 'toss') peak = Math.max(peak, m.ball.H);
  }
  assert.ok(tossed);
  assert.ok(peak > 2.7 && peak < 3.1, `peak ${peak}`);
  assert.ok(Math.abs(m.serve.peakT - C.serve.tossVz / C.gravity) < 0.03);
});

test('serve: the first tap tosses; an untouched toss is tossed again, no fault', () => {
  const m = E.createMatch({ seed: 3, serveDrill: true });
  while (m.phase !== 'serve') E.matchStep(m, {});
  E.matchSwing(m, 'flat');
  assert.equal(m.serve.state, 'toss');
  assert.equal(m.serve.tap, null, 'the tossing tap is not the serve');
  const ev = E.matchStep(m, {});
  assert.ok(ev.some(e => e.type === 'toss'));
  let re = null;
  for (let i = 0; i < 300 && !re; i++) re = E.matchStep(m, {}).find(e => e.type === 'retoss');
  assert.ok(re, 're-tossed');
  assert.equal(m.serveNo, 1);
  assert.equal(m.phase, 'serve');
});

test('serve: a swing far off the peak misses the toss and re-tosses', () => {
  const m = E.createMatch({ seed: 5, serveDrill: true });
  const r = serveOnce(m, 'flat', -C.serve.missMs - 40);
  assert.equal(lastOf(r).type, 'retoss');
  assert.equal(m.serveNo, 1);
});

test('serve: well timed serves land in the box; flat is faster, kick bounces higher', () => {
  const sum = { flat: { in: 0, v: 0, peak: 0 }, top: { in: 0, v: 0, peak: 0 } };
  for (const shot of ['flat', 'top']) for (let seed = 1; seed <= 15; seed++) {
    const m = E.createMatch({ seed, serveDrill: true });
    let v = 0, bounced = false, peak = 0;
    const out = [];
    for (let i = 0; i < 3000 && !out.some(e => e.type !== 'serve'); i++) {
      if (m.phase === 'serve' && m.serve.state === 'toss' && !m.serve.tap) E.matchSwing(m, shot, m.serve.tossT0 + m.serve.peakT);
      for (const e of E.matchStep(m, {})) {
        if (e.type === 'serve') v = Math.hypot(m.ball.vx, m.ball.vy, m.ball.vz);
        if (e.type === 'bounce') bounced = true;
        if (['serve', 'fault', 'let', 'pointEnd'].includes(e.type)) out.push(e);
      }
      if (bounced && m.ball.Y > 0) peak = Math.max(peak, m.ball.H);
    }
    const end = lastOf(out);
    if (end.type === 'pointEnd' && end.reason === 'ACE') sum[shot].in++;
    sum[shot].v += v / 15; sum[shot].peak += peak / 15;
  }
  assert.equal(sum.flat.in, 15); assert.equal(sum.top.in, 15);
  assert.ok(sum.flat.v > sum.top.v + 6, JSON.stringify(sum));
  assert.ok(sum.top.peak > sum.flat.peak + 0.2, JSON.stringify(sum));
});

test('serve: timing quality sets the fault rate; the kick is safer than the flat', () => {
  const faults = (shot, err) => {
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = serveOnce(E.createMatch({ seed, serveDrill: true }), shot, err);
      if (lastOf(r).type === 'fault') n++;
    }
    return n;
  };
  const perfect = faults('flat', 0), late = faults('flat', 180), kickLate = faults('top', 180);
  assert.ok(perfect <= 2, `perfect ${perfect}`);
  assert.ok(late >= 15, `late ${late}`);
  assert.ok(kickLate < late, `kick ${kickLate} vs flat ${late}`);
});

test('serve: the joystick aims within the box', () => {
  const land = sx => {
    const m = E.createMatch({ seed: 9, serveDrill: true });
    let x = null;
    for (let i = 0; i < 3000 && x == null; i++) {
      if (m.phase === 'serve' && m.serve.state === 'toss' && !m.serve.tap) E.matchSwing(m, 'top', m.serve.tossT0 + m.serve.peakT);
      for (const e of E.matchStep(m, { stick: { x: sx, y: 0 } })) if (e.type === 'bounce' && e.n === 1) x = e.X;
    }
    return x;
  };
  const L = land(-1), M = land(0), R = land(1);
  assert.ok(L < M - 1 && M < R - 1, `${L} ${M} ${R}`);
  // Deuce court: the box left of the centre line (even a perfect serve
  // scatters by `spread`, so allow a little over the line).
  assert.ok(L > -COURT.singlesHalf && R < C.serve.first.spread, `${L} ${R}`);
});

test('serve: a fault gives a second serve; two faults are a double fault', () => {
  // Aim outside the box on purpose: every serve is a fault.
  const cfg = withServe({ first: Object.assign({}, C.serve.first, { margin: -1.5 }), second: Object.assign({}, C.serve.second, { margin: -1.5 }) });
  const m = E.createMatch({ seed: 2, near: 'human', far: 'none' }, cfg);
  const a = serveOnce(m, 'flat', 0);
  assert.equal(lastOf(a).type, 'fault');
  assert.equal(m.serveNo, 2);
  const b = serveOnce(m, 'flat', 0);
  const end = lastOf(b);
  assert.equal(end.type, 'pointEnd'); assert.equal(end.reason, 'DOUBLE FAULT');
  assert.equal(end.winner, 1);
  assert.deepEqual(m.score.points, [0, 1]);
  assert.equal(m.stats[0].doubleFaults, 1); assert.equal(m.stats[0].errors, 1);
});

test('serve: the second serve is safer than the first', () => {
  const sv = C.serve;
  assert.ok(sv.second.margin > sv.first.margin && sv.second.spread < sv.first.spread && sv.second.pace < sv.first.pace);
});

test('serve: courts alternate each point, the server each game, players placed diagonally', () => {
  const m = E.createMatch({ seed: 4, near: 'human', far: 'none' });
  const courts = [];
  for (let p = 0; p < 4; p++) {
    while (m.phase !== 'serve') E.matchStep(m, {});
    courts.push(m.serve.court);
    const me = m.actors[0].player, them = m.actors[1].player;
    const sgn = m.serve.court === 'deuce' ? 1 : -1;
    assert.equal(Math.sign(me.X), sgn); assert.equal(Math.sign(them.X), sgn);  // both on their own right (deuce)
    const r = serveOnce(m, 'top', 0);
    assert.equal(lastOf(r).reason, 'ACE');
  }
  assert.deepEqual(courts, ['deuce', 'ad', 'deuce', 'ad']);
  assert.deepEqual(m.score.sets[0], [1, 0]);
  while (m.phase !== 'pre' && m.phase !== 'serve') E.matchStep(m, {});
  assert.equal(E.matchServer(m), 1);
  assert.equal(m.serve.server, 1);
});

test('serve: the receiver (far, mirrored) predicts a groundstroke after the bounce', () => {
  const m = E.createMatch({ seed: 6, serveDrill: true });
  let pred = null;
  for (let i = 0; i < 3000 && !pred; i++) {
    if (m.phase === 'serve' && m.serve.state === 'toss' && !m.serve.tap) E.matchSwing(m, 'top', m.serve.tossT0 + m.serve.peakT);
    for (const e of E.matchStep(m, {})) if (e.type === 'serve') pred = E.predictContact(m.actors[1]);
  }
  const far = m.actors[1];
  assert.equal(far.mustBounce, true);
  assert.equal(pred.kind, 'ok'); assert.equal(pred.stroke, 'ground');
  // The far player's plane, back in real coordinates, is near the far baseline.
  const real = E.toReal(far, pred);
  assert.ok(real.Y < 2.5 && real.Y > -1.5, `crosses at real Y ${real.Y}`);
});
