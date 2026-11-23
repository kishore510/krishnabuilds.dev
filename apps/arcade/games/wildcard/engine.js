// Wildcard engine: pure game logic, no DOM. Loaded by index.html as a plain
// script (sets window.WildcardEngine) and by Node tests via require(). The
// online version will run this same file inside the Worker, so it must stay
// free of browser APIs and must never trust a caller's claim about a seat.
//
// Rules (a Crazy Eights family game):
//   - 108 cards: in each of four colours one 0, two each of 1-9, two Skip,
//     two Reverse, two Draw two; plus four Wild and four Wild draw four.
//   - 2 to 4 players, 7 cards each. The first discard is always a number.
//   - On your turn play a card that matches the colour in play or the top
//     card's number or symbol, or any wild (choosing the next colour).
//   - Or draw one card. If it can be played you may play it straight away;
//     otherwise, or if you'd rather keep it, your turn ends.
//   - Skip: the next player misses a turn. Reverse: play changes direction
//     (with two players it acts as a Skip). Draw two / Wild draw four: the
//     next player draws that many and misses their turn. No stacking.
//   - Call "Last card" when you play down to one card. Forget, and you draw
//     two as a penalty straight away.
//   - First to empty their hand wins the round.
(function (root) {
  'use strict';

  const COLOURS = ['coral', 'saffron', 'jade', 'indigo'];
  const HAND_SIZE = 7;
  const LAST_CARD_PENALTY = 2;

  // ----- cards ------------------------------------------------------------
  // A card is { id, colour, value }. colour is null for wilds. value is
  // '0'-'9', 'skip', 'rev', 'draw2', 'wild' or 'wild4'. Ids are 0..107 and
  // fixed, so a card can be named in a message by its id alone.
  function buildDeck() {
    const cards = [];
    const add = (colour, value) => cards.push({ id: cards.length, colour, value });
    for (const c of COLOURS) {
      add(c, '0');
      for (let n = 1; n <= 9; n++) { add(c, String(n)); add(c, String(n)); }
      for (const v of ['skip', 'rev', 'draw2']) { add(c, v); add(c, v); }
    }
    for (let i = 0; i < 4; i++) add(null, 'wild');
    for (let i = 0; i < 4; i++) add(null, 'wild4');
    return cards;
  }
  const CARDS = buildDeck();
  const card = (id) => CARDS[id];
  const isWild = (c) => c.colour === null;
  const isNumber = (c) => /^[0-9]$/.test(c.value);

  const NAMES = { skip: 'Skip', rev: 'Reverse', draw2: 'Draw two', wild: 'Wild', wild4: 'Wild draw four' };
  const COLOUR_NAMES = { coral: 'Coral', saffron: 'Saffron', jade: 'Jade', indigo: 'Indigo' };
  function cardName(id) {
    const c = card(id);
    const v = NAMES[c.value] || c.value;
    return isWild(c) ? v : COLOUR_NAMES[c.colour] + ' ' + v;
  }

  // ----- seeded RNG (mulberry32) -------------------------------------------
  // The state carries its own RNG so a game can be replayed from its seed
  // and so the server, not the client, decides every shuffle.
  function nextRandom(state) {
    let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(state, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom(state) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ----- game state ---------------------------------------------------------
  // state = {
  //   players, hands: [[id...]...], deck: [id...] (top = end), discard: [id...]
  //   (top = end), colour (the colour in play), turn (seat), dir (1 or -1),
  //   drawn (id of a card the current player just drew and may still play, or
  //   null), winner (seat or null), rng
  // }
  function createGame(opts) {
    const o = opts || {};
    const players = o.players == null ? 4 : o.players;
    if (!Number.isInteger(players) || players < 2 || players > 4) throw new Error('players must be 2-4');
    const seed = o.seed == null ? Math.floor(Math.random() * 4294967296) : o.seed >>> 0;
    const state = {
      players, hands: [], deck: [], discard: [], colour: null,
      turn: o.first == null ? 0 : o.first, dir: 1, drawn: null, winner: null, rng: seed,
    };
    state.deck = shuffle(state, CARDS.map((c) => c.id));
    for (let p = 0; p < players; p++) state.hands.push([]);
    for (let i = 0; i < HAND_SIZE; i++) {
      for (let p = 0; p < players; p++) state.hands[p].push(state.deck.pop());
    }
    // The first discard is a number card: anything else goes back into the
    // deck at a random place below the top and we flip again.
    for (;;) {
      const id = state.deck.pop();
      if (isNumber(card(id))) { state.discard.push(id); state.colour = card(id).colour; break; }
      const at = Math.floor(nextRandom(state) * state.deck.length);
      state.deck.splice(at, 0, id);
    }
    return state;
  }

  const topCard = (state) => card(state.discard[state.discard.length - 1]);
  const nextSeat = (state, from, steps) =>
    (((from + state.dir * (steps == null ? 1 : steps)) % state.players) + state.players) % state.players;

  function matches(state, id) {
    const c = card(id);
    if (isWild(c)) return true;
    return c.colour === state.colour || c.value === topCard(state).value;
  }

  // The card ids `seat` may play now (empty when it isn't their turn).
  function legalPlays(state, seat) {
    if (state.winner !== null || seat !== state.turn) return [];
    if (state.drawn !== null) return matches(state, state.drawn) ? [state.drawn] : [];
    return state.hands[seat].filter((id) => matches(state, id));
  }

  // Draw n cards for seat, reshuffling the discard pile (all but its top
  // card) into the deck when it runs out. Returns the ids drawn, which can
  // be fewer than n if every card is in someone's hand.
  function drawCards(state, seat, n, events) {
    const got = [];
    for (let i = 0; i < n; i++) {
      if (state.deck.length === 0) {
        if (state.discard.length <= 1) break;
        const top = state.discard.pop();
        state.deck = shuffle(state, state.discard);
        state.discard = [top];
        events.push({ type: 'reshuffle', count: state.deck.length });
      }
      const id = state.deck.pop();
      state.hands[seat].push(id);
      got.push(id);
    }
    return got;
  }

  const fail = (error) => ({ ok: false, error, events: [] });

  // Play a card. opts.colour is required for a wild; opts.called says the
  // player called "Last card" (only matters when this leaves one card).
  function play(state, seat, id, opts) {
    const o = opts || {};
    if (state.winner !== null) return fail('game_over');
    if (seat !== state.turn) return fail('not_your_turn');
    if (!Number.isInteger(id) || id < 0 || id >= CARDS.length) return fail('bad_card');
    const hand = state.hands[seat];
    const at = hand.indexOf(id);
    if (at < 0) return fail('not_in_hand');
    if (state.drawn !== null && id !== state.drawn) return fail('must_play_drawn');
    if (!matches(state, id)) return fail('does_not_match');
    const c = card(id);
    if (isWild(c) && !COLOURS.includes(o.colour)) return fail('choose_colour');

    const events = [];
    hand.splice(at, 1);
    state.discard.push(id);
    state.colour = isWild(c) ? o.colour : c.colour;
    state.drawn = null;
    events.push({ type: 'play', seat, card: id, colour: state.colour });

    if (hand.length === 0) {
      state.winner = seat;
      events.push({ type: 'win', seat });
      return { ok: true, events };
    }
    if (hand.length === 1) {
      if (o.called) events.push({ type: 'lastCard', seat });
      else {
        const got = drawCards(state, seat, LAST_CARD_PENALTY, events);
        events.push({ type: 'penalty', seat, cards: got });
      }
    }

    let skipNext = false;
    if (c.value === 'rev') {
      state.dir = -state.dir;
      events.push({ type: 'reverse', dir: state.dir });
      if (state.players === 2) skipNext = true;
    } else if (c.value === 'skip') {
      skipNext = true;
    } else if (c.value === 'draw2' || c.value === 'wild4') {
      const victim = nextSeat(state, seat);
      const got = drawCards(state, victim, c.value === 'draw2' ? 2 : 4, events);
      events.push({ type: 'draw', seat: victim, cards: got, forced: true });
      skipNext = true;
    }
    if (skipNext) events.push({ type: 'skip', seat: nextSeat(state, seat) });
    state.turn = nextSeat(state, seat, skipNext ? 2 : 1);
    events.push({ type: 'turn', seat: state.turn });
    return { ok: true, events };
  }

  // Draw one card instead of playing. If it can be played, the turn stays
  // with this seat (play it or pass); otherwise the turn moves on.
  function draw(state, seat) {
    if (state.winner !== null) return fail('game_over');
    if (seat !== state.turn) return fail('not_your_turn');
    if (state.drawn !== null) return fail('already_drew');
    const events = [];
    const got = drawCards(state, seat, 1, events);
    events.push({ type: 'draw', seat, cards: got, forced: false });
    if (got.length && matches(state, got[0])) {
      state.drawn = got[0];
      events.push({ type: 'canPlayDrawn', seat, card: got[0] });
    } else {
      state.turn = nextSeat(state, seat);
      events.push({ type: 'turn', seat: state.turn });
    }
    return { ok: true, events };
  }

  // Keep a playable card you just drew and end your turn.
  function pass(state, seat) {
    if (state.winner !== null) return fail('game_over');
    if (seat !== state.turn) return fail('not_your_turn');
    if (state.drawn === null) return fail('draw_first');
    state.drawn = null;
    state.turn = nextSeat(state, seat);
    return { ok: true, events: [{ type: 'pass', seat }, { type: 'turn', seat: state.turn }] };
  }

  // What one seat is allowed to see: its own hand, everyone's card counts,
  // the discard pile's top card and the deck's size. The online table sends
  // each player only this.
  function viewFor(state, seat) {
    return {
      players: state.players,
      seat,
      hand: state.hands[seat].slice(),
      counts: state.hands.map((h) => h.length),
      top: state.discard[state.discard.length - 1],
      colour: state.colour,
      turn: state.turn,
      dir: state.dir,
      deckSize: state.deck.length,
      drawn: state.turn === seat ? state.drawn : null,
      winner: state.winner,
    };
  }

  // ----- bots ---------------------------------------------------------------
  // A bot sees only what a player sees (viewFor), so it can't cheat.
  // Easy: plays a random legal card, picks a random colour for wilds and
  //   forgets to call Last card about a quarter of the time.
  // Hard: holds wilds back, saves Draw cards for when the next player is
  //   close to winning, dumps high-count colours, picks its strongest colour
  //   and always calls Last card.
  const BOT = {
    easy: { forgetLastCard: 0.25 },
    hard: { forgetLastCard: 0 },
  };

  function botMove(state, seat, level, rand) {
    const r = rand || (() => nextRandom(state));
    const v = viewFor(state, seat);
    const legal = legalPlays(state, seat);
    const cfg = BOT[level] || BOT.easy;
    if (legal.length === 0) return state.drawn !== null ? { type: 'pass' } : { type: 'draw' };

    let pick;
    if (level === 'hard') pick = hardPick(state, v, legal);
    else pick = legal[Math.floor(r() * legal.length)];

    const move = { type: 'play', card: pick };
    if (isWild(card(pick))) move.colour = level === 'hard' ? bestColour(v.hand, pick) : COLOURS[Math.floor(r() * 4)];
    move.called = v.hand.length === 2 && r() >= cfg.forgetLastCard;
    return move;
  }

  function bestColour(hand, except) {
    const n = { coral: 0, saffron: 0, jade: 0, indigo: 0 };
    for (const id of hand) if (id !== except && card(id).colour) n[card(id).colour] += isNumber(card(id)) ? 1 : 1.5;
    return COLOURS.reduce((a, b) => (n[b] > n[a] ? b : a));
  }

  function hardPick(state, v, legal) {
    const nextCount = v.counts[nextSeat(state, v.seat)];
    const perColour = { coral: 0, saffron: 0, jade: 0, indigo: 0 };
    for (const id of v.hand) if (card(id).colour) perColour[card(id).colour]++;
    let best = legal[0], bestScore = -Infinity;
    for (const id of legal) {
      const c = card(id);
      let s = 0;
      if (isWild(c)) s -= 20;                       // keep wilds for when nothing else goes
      if (c.value === 'wild4') s -= 5;
      if (c.colour) s += perColour[c.colour] * 2;    // play from the colour you hold most of
      if (isNumber(c)) s += Number(c.value) * 0.3;   // shed high numbers first
      const attack = c.value === 'draw2' || c.value === 'wild4' || c.value === 'skip';
      if (attack) s += nextCount <= 2 ? 30 : -3;     // save attacks for a threat
      if (c.value === 'rev' && nextCount <= 2) s += 15;
      if (s > bestScore) { bestScore = s; best = id; }
    }
    return best;
  }

  // Apply a move object (from botMove, or a client message) to the state.
  function apply(state, seat, move) {
    if (!move || typeof move !== 'object') return fail('bad_move');
    if (move.type === 'play') return play(state, seat, move.card, { colour: move.colour, called: !!move.called });
    if (move.type === 'draw') return draw(state, seat);
    if (move.type === 'pass') return pass(state, seat);
    return fail('bad_move');
  }

  const api = {
    COLOURS, HAND_SIZE, LAST_CARD_PENALTY, CARDS, BOT,
    card, cardName, isWild, isNumber,
    createGame, legalPlays, matches, topCard, nextSeat,
    play, draw, pass, apply, viewFor, botMove,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WildcardEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
