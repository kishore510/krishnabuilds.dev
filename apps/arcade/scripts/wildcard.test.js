// Wildcard engine tests. Dependency-free; run from apps/arcade with:
//   node --test scripts/wildcard.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const E = require(path.join(__dirname, '..', 'games', 'wildcard', 'engine.js'));

// Find a card id by colour and value (the first copy not in `skip`).
function find(colour, value, skip = []) {
  return E.CARDS.find((c) => c.colour === colour && c.value === value && !skip.includes(c.id)).id;
}
// A hand-built state: four players, given hands, a top card and the rest in the deck.
function rig({ hands, top, players = 4, turn = 0, dir = 1, colour }) {
  const used = new Set([top, ...hands.flat()]);
  const deck = E.CARDS.map((c) => c.id).filter((id) => !used.has(id));
  return {
    players, hands: hands.map((h) => h.slice()), deck, discard: [top],
    colour: colour || E.card(top).colour, turn, dir, drawn: null, winner: null, rng: 1,
  };
}
const allIds = (s) => [...s.deck, ...s.discard, ...s.hands.flat()].sort((a, b) => a - b);

test('the deck has 108 cards in the right mix', () => {
  assert.equal(E.CARDS.length, 108);
  const count = (pred) => E.CARDS.filter(pred).length;
  for (const c of E.COLOURS) {
    assert.equal(count((x) => x.colour === c), 25);
    assert.equal(count((x) => x.colour === c && x.value === '0'), 1);
    assert.equal(count((x) => x.colour === c && x.value === '7'), 2);
    assert.equal(count((x) => x.colour === c && x.value === 'draw2'), 2);
  }
  assert.equal(count((x) => x.value === 'wild'), 4);
  assert.equal(count((x) => x.value === 'wild4'), 4);
});

test('a new game deals 7 each, flips a number and keeps every card', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = E.createGame({ seed });
    assert.deepEqual(s.hands.map((h) => h.length), [7, 7, 7, 7]);
    assert.equal(s.discard.length, 1);
    assert.ok(E.isNumber(E.topCard(s)), `seed ${seed} flipped ${E.cardName(s.discard[0])}`);
    assert.equal(s.colour, E.topCard(s).colour);
    assert.deepEqual(allIds(s), E.CARDS.map((c) => c.id));
  }
});

test('the same seed deals the same game', () => {
  assert.deepEqual(E.createGame({ seed: 42 }), E.createGame({ seed: 42 }));
  assert.notDeepEqual(E.createGame({ seed: 42 }).hands, E.createGame({ seed: 43 }).hands);
});

test('2 to 4 players only', () => {
  assert.throws(() => E.createGame({ players: 1 }));
  assert.throws(() => E.createGame({ players: 5 }));
  assert.equal(E.createGame({ players: 2, seed: 1 }).hands.length, 2);
});

test('matching: colour, number or symbol, or any wild', () => {
  const j7 = find('jade', '7');
  const s = rig({ top: j7, hands: [[find('jade', '2'), find('coral', '7'), find('coral', '2'), find(null, 'wild'), find('indigo', 'skip')], [], [], []] });
  const legal = E.legalPlays(s, 0).map(E.cardName);
  assert.deepEqual(legal.sort(), ['Coral 7', 'Jade 2', 'Wild'].sort());
  // Symbols match symbols.
  const s2 = rig({ top: find('jade', 'skip'), hands: [[find('indigo', 'skip'), find('indigo', '1')], [], [], []] });
  assert.deepEqual(E.legalPlays(s2, 0).map(E.cardName), ['Indigo Skip']);
  // A wild's chosen colour is what must be matched next.
  const s3 = rig({ top: find(null, 'wild'), colour: 'saffron', hands: [[find('saffron', '4'), find('jade', '4')], [], [], []] });
  assert.deepEqual(E.legalPlays(s3, 0).map(E.cardName), ['Saffron 4']);
});

test('only the current seat may act, and only with its own legal cards', () => {
  const s = rig({ top: find('jade', '7'), hands: [[find('jade', '1'), find('coral', '3')], [find('jade', '2')], [], []] });
  assert.equal(E.play(s, 1, find('jade', '2')).error, 'not_your_turn');
  assert.equal(E.play(s, 0, find('jade', '2')).error, 'not_in_hand');
  assert.equal(E.play(s, 0, find('coral', '3')).error, 'does_not_match');
  assert.equal(E.play(s, 0, 999).error, 'bad_card');
  assert.equal(E.play(s, 0, '3').error, 'bad_card');
  assert.equal(E.draw(s, 2).error, 'not_your_turn');
  assert.equal(E.apply(s, 0, { type: 'cheat' }).error, 'bad_move');
  assert.equal(E.apply(s, 0, null).error, 'bad_move');
  assert.equal(s.turn, 0);
});

test('a wild needs a valid colour', () => {
  const w = find(null, 'wild');
  const s = rig({ top: find('jade', '7'), hands: [[w, find('coral', '1'), find('coral', '2')], [], [], []] });
  assert.equal(E.play(s, 0, w).error, 'choose_colour');
  assert.equal(E.play(s, 0, w, { colour: 'purple' }).error, 'choose_colour');
  assert.ok(E.play(s, 0, w, { colour: 'coral' }).ok);
  assert.equal(s.colour, 'coral');
  assert.equal(s.turn, 1);
});

test('skip, reverse and draw cards', () => {
  const others = [[find('indigo', '1')], [find('indigo', '2')], [find('indigo', '3')]];
  const mk = (card) => rig({ top: find('jade', '7'), hands: [[card, find('coral', '1'), find('coral', '2')], ...others] });

  let s = mk(find('jade', 'skip'));
  E.play(s, 0, find('jade', 'skip'));
  assert.equal(s.turn, 2);

  s = mk(find('jade', 'rev'));
  E.play(s, 0, find('jade', 'rev'));
  assert.equal(s.dir, -1);
  assert.equal(s.turn, 3);

  s = mk(find('jade', 'draw2'));
  const r = E.play(s, 0, find('jade', 'draw2'));
  assert.equal(s.hands[1].length, 3);
  assert.equal(s.turn, 2);
  assert.ok(r.events.some((e) => e.type === 'draw' && e.seat === 1 && e.cards.length === 2 && e.forced));

  s = mk(find(null, 'wild4'));
  E.play(s, 0, find(null, 'wild4'), { colour: 'indigo' });
  assert.equal(s.hands[1].length, 5);
  assert.equal(s.turn, 2);
  assert.equal(s.colour, 'indigo');
});

test('reverse with two players acts as a skip', () => {
  const s = rig({ players: 2, top: find('jade', '7'), hands: [[find('jade', 'rev'), find('coral', '1'), find('coral', '2')], [find('indigo', '1')]] });
  E.play(s, 0, find('jade', 'rev'));
  assert.equal(s.turn, 0);
});

test('turns wrap around in both directions', () => {
  const s = rig({ top: find('jade', '7'), turn: 3, hands: [[find('coral', '9')], [find('coral', '8')], [find('coral', '6')], [find('jade', '1'), find('coral', '1'), find('coral', '2')]] });
  E.play(s, 3, find('jade', '1'));
  assert.equal(s.turn, 0);
  const s2 = rig({ top: find('jade', '7'), turn: 0, dir: -1, hands: [[find('jade', '1'), find('coral', '1'), find('coral', '2')], [find('coral', '8')], [find('coral', '6')], [find('coral', '9')]] });
  E.play(s2, 0, find('jade', '1'));
  assert.equal(s2.turn, 3);
});

test('drawing: a playable card can be played or kept, an unplayable one ends the turn', () => {
  const s = rig({ top: find('jade', '7'), hands: [[find('coral', '1')], [], [], []] });
  s.deck.push(find('jade', '3')); // next card off the deck
  const r = E.draw(s, 0);
  assert.ok(r.events.some((e) => e.type === 'canPlayDrawn'));
  assert.equal(s.turn, 0);
  assert.deepEqual(E.legalPlays(s, 0), [find('jade', '3')]);
  assert.equal(E.draw(s, 0).error, 'already_drew');
  assert.equal(E.play(s, 0, find('coral', '1')).error, 'must_play_drawn');
  assert.ok(E.pass(s, 0).ok);
  assert.equal(s.turn, 1);
  assert.equal(s.hands[0].length, 2);

  const s2 = rig({ top: find('jade', '7'), hands: [[find('coral', '1')], [], [], []] });
  s2.deck.push(find('coral', '3'));
  E.draw(s2, 0);
  assert.equal(s2.turn, 1);
  assert.equal(E.pass(s2, 1).error, 'draw_first');
});

test('the discard pile is reshuffled into an empty deck, keeping its top card', () => {
  const s = rig({ top: find('jade', '7'), hands: [[find('coral', '1')], [], [], []] });
  const buried = s.deck.splice(0, s.deck.length - 0); // empty the deck...
  s.discard = [...buried, find('jade', '7')];          // ...into the discard pile
  const r = E.draw(s, 0);
  assert.ok(r.events.some((e) => e.type === 'reshuffle'));
  assert.equal(s.discard.length, 1);
  assert.equal(s.discard[0], find('jade', '7'));
  assert.deepEqual(allIds(s), E.CARDS.map((c) => c.id));
});

test('drawing from a completely empty table is harmless', () => {
  const s = rig({ top: find('jade', '7'), hands: [[find('coral', '1')], [], [], []] });
  s.hands[1] = s.deck.splice(0);
  const r = E.draw(s, 0);
  assert.ok(r.ok);
  assert.equal(s.hands[0].length, 1);
  assert.equal(s.turn, 1);
});

test('last card: calling is safe, forgetting costs two cards', () => {
  const hand = () => [find('jade', '1'), find('coral', '5')];
  const s = rig({ top: find('jade', '7'), hands: [hand(), [], [], []] });
  const r = E.play(s, 0, find('jade', '1'), { called: true });
  assert.equal(s.hands[0].length, 1);
  assert.ok(r.events.some((e) => e.type === 'lastCard'));

  const s2 = rig({ top: find('jade', '7'), hands: [hand(), [], [], []] });
  const r2 = E.play(s2, 0, find('jade', '1'));
  assert.equal(s2.hands[0].length, 3);
  assert.ok(r2.events.some((e) => e.type === 'penalty' && e.cards.length === 2));
});

test('emptying your hand wins and ends the game', () => {
  const s = rig({ top: find('jade', '7'), hands: [[find('jade', 'draw2')], [find('coral', '1')], [], []] });
  const r = E.play(s, 0, find('jade', 'draw2'));
  assert.equal(s.winner, 0);
  assert.ok(r.events.some((e) => e.type === 'win'));
  assert.equal(s.hands[1].length, 1, 'the game ends before the draw two lands');
  assert.equal(E.draw(s, 0).error, 'game_over');
  assert.deepEqual(E.legalPlays(s, 0), []);
});

test('viewFor hides other hands and the deck order', () => {
  const s = E.createGame({ seed: 7 });
  const v = E.viewFor(s, 2);
  assert.deepEqual(v.hand, s.hands[2]);
  assert.deepEqual(v.counts, [7, 7, 7, 7]);
  assert.equal(v.deckSize, s.deck.length);
  assert.ok(!('hands' in v) && !('deck' in v) && !('rng' in v));
  v.hand.push(1);
  assert.equal(s.hands[2].length, 7, 'the view is a copy');
});

test('eventsFor hides cards other seats drew, and who can play a drawn card', () => {
  const hand = [find('coral', '3'), find('jade', '5')];
  const s = rig({ players: 3, hands: [[find('coral', 'draw2'), find('jade', '1')], hand, [find('indigo', '9')]], top: find('coral', '7') });
  const r = E.play(s, 0, find('coral', 'draw2'), { called: true });
  const drew = r.events.find((e) => e.type === 'draw');
  assert.equal(drew.seat, 1);
  assert.equal(E.eventsFor(r.events, 1).find((e) => e.type === 'draw').cards.length, 2);
  assert.deepEqual(E.eventsFor(r.events, 1).find((e) => e.type === 'draw').cards, drew.cards, 'the drawer sees its cards');
  assert.deepEqual(E.eventsFor(r.events, 0).find((e) => e.type === 'draw').cards, [null, null], 'others see only how many');
  assert.ok(drew.cards.every((id) => id !== null), 'the original events are untouched');

  const t = rig({ players: 2, hands: [[find('jade', '1')], [find('indigo', '9')]], top: find('coral', '7') });
  t.deck.push(find('coral', '4')); // the next draw matches
  const d = E.draw(t, 0);
  assert.ok(E.eventsFor(d.events, 0).some((e) => e.type === 'canPlayDrawn'));
  assert.ok(!E.eventsFor(d.events, 1).some((e) => e.type === 'canPlayDrawn'));
  assert.deepEqual(E.eventsFor(d.events, 1).find((e) => e.type === 'draw').cards, [null]);
});

test('viewFor shows the top four of the pile', () => {
  const s = rig({ hands: [[1], [2], [3], [4]], top: find('coral', '7') });
  s.discard = [10, 11, 12, 13, 14];
  assert.deepEqual(E.viewFor(s, 0).pile, [11, 12, 13, 14]);
  assert.equal(E.viewFor(s, 0).top, 14);
});

for (const level of ['easy', 'hard']) {
  test(`${level} bots only make legal moves and full games finish`, () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = E.createGame({ seed });
      let moves = 0;
      while (s.winner === null) {
        const seat = s.turn;
        const move = E.botMove(s, seat, level);
        const r = E.apply(s, seat, move);
        assert.ok(r.ok, `seed ${seed} move ${moves}: ${JSON.stringify(move)} -> ${r.error}`);
        assert.equal(s.hands.flat().length + s.deck.length + s.discard.length, 108);
        assert.ok(++moves < 2000, `seed ${seed} never ended`);
      }
      assert.equal(s.hands[s.winner].length, 0);
    }
  });
}

test('hard bots beat easy bots more often than not', () => {
  let hardWins = 0;
  const games = 400;
  for (let seed = 1; seed <= games; seed++) {
    const s = E.createGame({ seed, first: seed % 4 });
    const levels = ['hard', 'easy', 'hard', 'easy'];
    while (s.winner === null) E.apply(s, s.turn, E.botMove(s, s.turn, levels[s.turn]));
    if (levels[s.winner] === 'hard') hardWins++;
  }
  // Two of each: an even split would be 50%.
  assert.ok(hardWins / games > 0.55, `hard won ${hardWins} of ${games}`);
});
