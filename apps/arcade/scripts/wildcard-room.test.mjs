// Wildcard online room rules (src/wildcard-room.js). Run from apps/arcade:
//   node --test scripts/wildcard-room.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/wildcard-room.js';
import E from '../games/wildcard/engine.js';

let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const msgsTo = (out, id) => out.filter((o) => o.to === id).map((o) => o.msg);

function table(names) {
  const room = R.createRoom('BCDF');
  for (const n of names) assert.ok(R.join(room, 'id-' + n, n).ok);
  return room;
}

test('the first to join hosts; names are cleaned and kept unique', () => {
  const room = table(['Ana', 'ana', '  <b>Zed</b>\n ']);
  assert.equal(room.host, 'id-Ana');
  assert.deepEqual(room.seats.map((s) => s.name), ['Ana', 'ana 2', 'bZed/b']);
  assert.equal(R.cleanName(''), 'Player');
  assert.equal([...R.cleanName('x'.repeat(40))].length, 14);
});

test('a lobby holds four; nobody joins a game in progress', () => {
  const room = table(['A', 'B', 'C', 'D']);
  assert.equal(R.join(room, 'id-E', 'E').error, 'full');
  const two = table(['A', 'B']);
  R.start(two, 'id-A', rand);
  assert.equal(R.join(two, 'id-C', 'C').error, 'in_progress');
});

test('only the host configures and starts, and it takes two people', () => {
  const solo = table(['A']);
  assert.equal(R.start(solo, 'id-A', rand).error, 'need_two');
  const room = table(['A', 'B']);
  assert.equal(R.configure(room, 'id-B', { size: 2 }).error, 'not_host');
  assert.equal(R.configure(room, 'id-A', { size: 1 }).error, 'bad_size');
  assert.equal(R.configure(room, 'id-A', { level: 'nope' }).error, 'bad_level');
  assert.ok(R.configure(room, 'id-A', { size: 3, level: 'hard' }).ok);
  assert.equal(R.start(room, 'id-B', rand).error, 'not_host');
  const r = R.start(room, 'id-A', rand);
  assert.ok(r.ok);
  assert.equal(room.seats.length, 3);
  assert.deepEqual(room.seats.map((s) => !!s.bot), [false, false, true], 'bots fill the empty seats');
  assert.equal(room.game.players, 3);
});

test('each player is sent only their own seat\'s view', () => {
  const room = table(['A', 'B']);
  const r = R.start(room, 'id-A', rand);
  for (const [id, seat] of [['id-A', 0], ['id-B', 1]]) {
    const deal = msgsTo(r.out, id).find((m) => m.t === 'deal');
    assert.equal(deal.view.seat, seat);
    assert.deepEqual(deal.view.hand, room.game.hands[seat]);
    assert.ok(!('hands' in deal.view) && !('deck' in deal.view) && !('rng' in deal.view));
  }
  assert.ok(!r.out.some((o) => o.to !== 'id-A' && o.to !== 'id-B'), 'bots get nothing');
});

test('moves come from the connection\'s seat, never from the message', () => {
  const room = table(['A', 'B']);
  R.configure(room, 'id-A', { size: 2 });
  R.start(room, 'id-A', rand);
  const turnId = room.game.turn === 0 ? 'id-A' : 'id-B';
  const otherId = turnId === 'id-A' ? 'id-B' : 'id-A';
  assert.equal(R.move(room, otherId, { type: 'draw', seat: room.game.turn }).error, 'not_your_turn');
  assert.equal(R.move(room, 'stranger', { type: 'draw' }).error, 'not_seated');
  assert.equal(R.move(room, turnId, null).error, 'bad_move');
  assert.ok(R.move(room, turnId, { type: 'draw' }).ok);
});

test('another player\'s drawn cards never reach you', () => {
  const room = table(['A', 'B']);
  R.configure(room, 'id-A', { size: 2 });
  R.start(room, 'id-A', rand);
  const turnId = room.game.turn === 0 ? 'id-A' : 'id-B';
  const otherId = turnId === 'id-A' ? 'id-B' : 'id-A';
  const r = R.move(room, turnId, { type: 'draw' });
  const mine = msgsTo(r.out, turnId)[0].events.find((e) => e.type === 'draw');
  const theirs = msgsTo(r.out, otherId)[0].events.find((e) => e.type === 'draw');
  assert.ok(Number.isInteger(mine.cards[0]));
  assert.deepEqual(theirs.cards, [null]);
});

test('leaving the lobby frees the seat and passes on host', () => {
  const room = table(['A', 'B', 'C']);
  R.leave(room, 'id-A');
  assert.deepEqual(room.seats.map((s) => s.name), ['B', 'C']);
  assert.equal(room.host, 'id-B');
});

// A two-person game at time t, with seat `turn` to play.
function game(t = 1000) {
  const room = table(['A', 'B']);
  R.configure(room, 'id-A', { size: 3 });
  R.start(room, 'id-A', rand, t);
  return room;
}
const idAt = (room, seat) => room.seats[seat].id;

test('a dropped connection keeps the seat; coming back with the same id takes it back', () => {
  const room = game();
  R.leave(room, 'id-B', 2000);
  assert.equal(room.seats[1].off, 2000);
  assert.ok(!room.seats[1].bot && !room.seats[1].auto, 'no bot yet');
  const msg = msgsTo(R.leave(room, 'id-A', 2000).out, 'id-B');
  assert.equal(msg.length, 1, 'the away player still gets room messages if they are listening');
  R.leave(room, 'id-A', 2000); // already away: nothing changes
  const r = R.join(room, 'id-B', 'B', 3000);
  assert.ok(r.ok);
  assert.ok(!('off' in room.seats[1]));
  const mine = msgsTo(r.out, 'id-B');
  assert.equal(mine[0].t, 'deal', 'the table first, so the page can draw it');
  assert.ok(mine[0].resume);
  assert.equal(mine[1].t, 'room');
  assert.equal(mine[1].you, 1);
  assert.equal(R.join(room, 'id-new', 'C', 3000).error, 'in_progress', 'strangers still can\'t join a game');
});

test('the host role passes to someone connected, and back when the host returns to an empty host seat', () => {
  const room = game();
  R.leave(room, 'id-A', 2000);
  assert.equal(room.host, 'id-B');
  R.leave(room, 'id-B', 2000);
  assert.equal(room.host, 'id-B', 'nobody connected to pass it to');
  R.join(room, 'id-A', 'A', 3000);
  assert.equal(room.host, 'id-A');
});

test('nothing is due while nobody is connected', () => {
  const room = game();
  assert.notEqual(R.dueAt(room), null);
  R.leave(room, 'id-A', 2000);
  R.leave(room, 'id-B', 2000);
  assert.equal(R.dueAt(room), null);
  assert.equal(R.tick(room, 1e12).ok, false);
});

test('a player gone on their turn gets GRACE_MS, then a bot plays their seat until they come back', () => {
  const room = game(1000);
  room.game.turn = 1; // B to play
  R.leave(room, 'id-B', 5000);
  assert.equal(R.dueAt(room), 5000 + R.GRACE_MS);
  assert.equal(R.tick(room, 5000 + R.GRACE_MS - 1).ok, false);
  const r = R.tick(room, 5000 + R.GRACE_MS);
  assert.ok(r.ok);
  assert.ok(room.seats[1].auto, 'a bot has the seat');
  assert.ok(room.seats[1].off);
  assert.ok(msgsTo(r.out, 'id-A').some((m) => m.t === 'room' && m.seats[1].away && m.seats[1].auto));
  R.join(room, 'id-B', 'B', 99999);
  assert.ok(!room.seats[1].auto && !room.seats[1].off);
});

test('choosing to leave hands the seat to a bot at once', () => {
  const room = game(1000);
  room.game.turn = 1;
  R.leave(room, 'id-B', 5000, true);
  assert.ok(room.seats[1].auto);
  assert.equal(R.dueAt(room), 1000 + R.BOT_DELAY_MS);
});

test('a connected player who sits on their turn for TURN_MS gets a bot until they say they are back', () => {
  const room = game(1000);
  room.game.turn = 0;
  assert.equal(R.dueAt(room), 1000 + R.TURN_MS);
  assert.ok(R.tick(room, 1000 + R.TURN_MS).ok);
  assert.ok(room.seats[0].auto && !room.seats[0].off);
  assert.equal(room.turnAt, 1000 + R.TURN_MS);
  const b = R.back(room, 'id-A', 70000);
  assert.ok(b.ok && !room.seats[0].auto);
  assert.ok(msgsTo(b.out, 'id-B').some((m) => m.t === 'room' && !m.seats[0].auto));
  assert.equal(R.back(room, 'stranger', 70000).error, 'not_seated');
});

test('back on your own turn restarts your clock', () => {
  const room = game(1000);
  room.game.turn = 0;
  room.seats[0].auto = true;
  R.back(room, 'id-A', 50000);
  assert.equal(R.dueAt(room), 50000 + R.TURN_MS);
});

test('dealing again gives anyone away a bot straight away', () => {
  const room = game(1000);
  room.phase = 'over';
  R.leave(room, 'id-B', 2000);
  R.start(room, 'id-A', rand, 3000);
  assert.ok(room.seats[1].auto);
});

test('a whole game with bots plays out and can be dealt again', () => {
  for (let g = 0; g < 30; g++) {
    const room = table(['A', 'B']);
    R.configure(room, 'id-A', { size: 4, level: g % 2 ? 'hard' : 'easy' });
    R.start(room, 'id-A', rand);
    let guard = 0;
    while (room.phase === 'playing' && guard++ < 5000) {
      const seat = room.game.turn;
      if (room.seats[seat].bot) { assert.ok(R.tick(room, R.dueAt(room)).ok); continue; }
      const id = room.seats[seat].id;
      const mv = E.botMove(room.game, seat, 'easy', rand);
      assert.ok(R.move(room, id, mv).ok);
    }
    assert.equal(room.phase, 'over');
    assert.equal(R.dueAt(room), null);
    assert.equal(R.tick(room, 1e15).ok, false);
    assert.equal(R.start(room, 'id-B', rand).error, 'not_host');
    assert.ok(R.start(room, 'id-A', rand).ok);
    assert.equal(room.seats.length, 4, 'the same seats play again');
  }
});

test('players are told how long the current turn has before a bot takes it', () => {
  const room = game(1000);
  room.game.turn = 0;
  room.turnAt = 1000;
  assert.equal(R.turnLeft(room, 1000), R.TURN_MS);
  assert.equal(R.turnLeft(room, 1000 + R.TURN_MS + 5), 0);
  const seen = msgsTo(R.back(room, 'id-A', 11000).out, 'id-A');
  assert.equal(seen.length, 0, 'back with no bot playing sends nothing');
  room.seats[0].auto = true;
  assert.equal(R.turnLeft(room, 2000), null, 'no clock while a bot has the seat');
  const back = msgsTo(R.back(room, 'id-A', 20000).out, 'id-A');
  assert.equal(back[0].turnLeft, R.TURN_MS, 'I\'m back restarts the clock');
  room.seats[0].off = 20000;
  assert.equal(R.turnLeft(room, 21000), null, 'no clock while they are away');
  delete room.seats[0].off;
  // A move restarts the clock for whoever is next, and every update says so.
  const seat = room.game.turn, id = room.seats[seat].id;
  const ups = msgsTo(R.move(room, id, E.botMove(room.game, seat, 'easy', rand), 30000).out, 'id-B').filter((m) => m.t === 'update');
  assert.equal(ups.length, 1);
  const next = room.seats[room.game.turn];
  assert.equal(ups[0].turnLeft, next.bot ? null : R.TURN_MS);
});

test('a rejoining player gets the time left on the turn with the table', () => {
  const room = game(1000);
  room.game.turn = 1;
  room.turnAt = 5000;
  R.leave(room, 'id-A', 6000);
  const deal = msgsTo(R.join(room, 'id-A', 'A', 15000).out, 'id-A')[0];
  assert.equal(deal.t, 'deal');
  assert.equal(deal.turnLeft, 5000 + R.TURN_MS - 15000);
});
