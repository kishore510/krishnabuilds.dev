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

test('leaving: the lobby frees the seat and passes on host; a game hands it to a bot', () => {
  const room = table(['A', 'B', 'C']);
  R.leave(room, 'id-A');
  assert.deepEqual(room.seats.map((s) => s.name), ['B', 'C']);
  assert.equal(room.host, 'id-B');
  R.start(room, 'id-B', rand);
  R.leave(room, 'id-C');
  assert.ok(room.seats[1].bot);
  assert.equal(room.seats[1].name, 'C');
});

test('a whole game with bots plays out and can be dealt again', () => {
  for (let g = 0; g < 30; g++) {
    const room = table(['A', 'B']);
    R.configure(room, 'id-A', { size: 4, level: g % 2 ? 'hard' : 'easy' });
    R.start(room, 'id-A', rand);
    let guard = 0;
    while (room.phase === 'playing' && guard++ < 5000) {
      if (R.botDue(room)) { assert.ok(R.botStep(room).ok); continue; }
      const seat = room.game.turn;
      const id = room.seats[seat].id;
      const mv = E.botMove(room.game, seat, 'easy', rand);
      assert.ok(R.move(room, id, mv).ok);
    }
    assert.equal(room.phase, 'over');
    assert.equal(R.botStep(room).ok, false);
    assert.equal(R.start(room, 'id-B', rand).error, 'not_host');
    assert.ok(R.start(room, 'id-A', rand).ok);
    assert.equal(room.seats.length, 4, 'the same seats play again');
  }
});
