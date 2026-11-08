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
