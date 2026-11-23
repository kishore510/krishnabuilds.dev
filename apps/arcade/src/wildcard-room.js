// Wildcard online table: the room's rules, kept free of Durable Object and
// WebSocket code so Node can test them (scripts/wildcard-room.test.mjs).
// src/wildcard-table.js wraps this in a Durable Object.
//
// A room is plain JSON, saved whole after every change:
//   { code, phase: 'lobby' | 'playing' | 'over', size (2-4), level,
//     host (a player id), seats, game (engine state), turnAt }
// A seat is a bot { name, bot: true } or a person { id, name, off, auto }:
// `off` is when their connection dropped (absent while connected), `auto`
// means a bot is playing their seat until they come back.
// Humans take seats in the order they join. At the start the host's chosen
// table size is filled with bots. A player who leaves the lobby frees their
// seat. In a game the seat stays theirs: a bot plays it once they have been
// gone GRACE_MS on their turn (at once if they chose to leave), or once
// they have sat on their turn for TURN_MS while connected. Coming back with
// the same id (`join`), or sending `back`, hands the seat back to them.
// `turnAt` is when the current turn began; `dueAt` says when `tick` next
// has something to do, and the table sets its alarm for then.
//
// Every function returns the messages to send as [{ to, msg }], where `to`
// is a player id or '*' (everyone). The game's hidden information only ever
// leaves through viewFor / eventsFor for the receiving seat.

import E from '../games/wildcard/engine.js';

export const MAX_SEATS = 4;
export const BOT_DELAY_MS = 900;
export const TURN_MS = 45 * 1000;
export const GRACE_MS = 20 * 1000;
export const BOT_NAMES = ['Pip', 'Bao', 'Rio'];
const LEVELS = ['easy', 'hard'];

export function createRoom(code) {
  return { code, phase: 'lobby', size: 4, level: 'easy', host: null, seats: [], game: null };
}

// A display name: printable characters only, trimmed, at most 14.
export function cleanName(raw) {
  const s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, 14).join('') || 'Player';
}

const seatOf = (room, id) => room.seats.findIndex((s) => !s.bot && s.id === id);
const humans = (room) => room.seats.filter((s) => !s.bot);
const connected = (room) => humans(room).filter((s) => !s.off);

function roomMsg(room, id) {
  return {
    t: 'room',
    code: room.code,
    phase: room.phase,
    size: room.size,
    level: room.level,
    you: seatOf(room, id),
    host: room.host === id,
    hostSeat: room.host === null ? -1 : seatOf(room, room.host),
    seats: room.seats.map((s) => ({ name: s.name, bot: !!s.bot, away: !!s.off, auto: !!s.auto })),
  };
}
const toAll = (room, make) => humans(room).map((s) => ({ to: s.id, msg: make(s.id, seatOf(room, s.id)) }));
const roomForAll = (room) => toAll(room, (id) => roomMsg(room, id));

// Someone opens a connection with { name, id }. The same id again (a new
// tab, a reload, a dropped connection) takes back the same seat.
export function join(room, id, rawName, now = Date.now()) {
  const at = seatOf(room, id);
  if (at >= 0) {
    reclaim(room, at, now);
    const h = seatOf(room, room.host);
    if (h < 0 || room.seats[h].off) room.host = id; // a host who is away hands over
    return { ok: true, out: [...stateFor(room, id), ...roomForAll(room)] }; // the table, then the seats
  }
  if (room.phase !== 'lobby') return { ok: false, error: 'in_progress' };
  if (room.seats.length >= MAX_SEATS) return { ok: false, error: 'full' };
  let name = cleanName(rawName);
  const taken = new Set(room.seats.map((s) => s.name.toLowerCase()));
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = cleanName(rawName).slice(0, 12) + ' ' + n;
  room.seats.push({ id, name });
  if (room.host === null) room.host = id;
  if (room.size < room.seats.length) room.size = room.seats.length;
  return { ok: true, out: roomForAll(room) };
}

// A seat goes back to its person: no longer away, no bot playing it. On
// their own turn the clock starts again.
function reclaim(room, at, now) {
  const s = room.seats[at];
  delete s.off;
  if (s.auto && room.phase === 'playing' && room.game.turn === at) room.turnAt = now;
  delete s.auto;
}

// A connection closes. In the lobby the seat is freed (and the host role
// passes on). In a game the seat is kept for them to come back to: a bot
// plays it after GRACE_MS on their turn, or at once if `left` (they chose
// to leave rather than lost the connection).
export function leave(room, id, now = Date.now(), left = false) {
  const at = seatOf(room, id);
  if (at < 0) return { out: [] };
  if (room.phase === 'lobby') room.seats.splice(at, 1);
  else {
    room.seats[at].off = now;
    if (left) room.seats[at].auto = true;
  }
  if (room.host === id) room.host = connected(room).length ? connected(room)[0].id : room.phase === 'lobby' ? null : id;
  return { out: roomForAll(room) };
}

// "I'm back": a connected player whose seat a bot took over plays again.
export function back(room, id, now = Date.now()) {
  const at = seatOf(room, id);
  if (at < 0) return { ok: false, error: 'not_seated' };
  if (!room.seats[at].auto) return { ok: true, out: [] };
  reclaim(room, at, now);
  return { ok: true, out: roomForAll(room) };
}

// The host sets the table size (2-4) or bot skill while in the lobby.
export function configure(room, id, opts) {
  if (room.host !== id) return { ok: false, error: 'not_host' };
  if (room.phase !== 'lobby') return { ok: false, error: 'in_progress' };
  const o = opts || {};
  if (o.size != null) {
    if (!Number.isInteger(o.size) || o.size < 2 || o.size > MAX_SEATS || o.size < room.seats.length) return { ok: false, error: 'bad_size' };
    room.size = o.size;
  }
  if (o.level != null) {
    if (!LEVELS.includes(o.level)) return { ok: false, error: 'bad_level' };
    room.level = o.level;
  }
  return { ok: true, out: roomForAll(room) };
}

// The host deals: bots fill the empty seats, the server picks the seed and
// who goes first. `random()` returns [0, 1) and should be crypto-backed.
// Also used for "deal again" once a game is over (phase 'over').
export function start(room, id, random, now = Date.now()) {
  if (room.host !== id) return { ok: false, error: 'not_host' };
  if (room.phase === 'playing') return { ok: false, error: 'in_progress' };
  if (room.phase === 'lobby' && humans(room).length < 2) return { ok: false, error: 'need_two' };
  if (room.phase === 'lobby') {
    let b = 0;
    while (room.seats.length < room.size) room.seats.push({ name: BOT_NAMES[b++], bot: true });
  }
  const n = room.seats.length;
  room.game = E.createGame({ players: n, seed: Math.floor(random() * 4294967296), first: Math.floor(random() * n) });
  room.phase = 'playing';
  room.turnAt = now;
  // Anyone away when the cards are dealt gets a bot straight away.
  for (const s of humans(room)) if (s.off) s.auto = true;
  return { ok: true, out: [...roomForAll(room), ...toAll(room, (pid, seat) => ({ t: 'deal', view: E.viewFor(room.game, seat) }))] };
}

function afterMove(room, events, now) {
  room.turnAt = now;
  if (room.game.winner !== null) room.phase = 'over';
  const out = toAll(room, (pid, seat) => ({ t: 'update', events: E.eventsFor(events, seat), view: E.viewFor(room.game, seat) }));
  if (room.phase === 'over') out.push(...roomForAll(room));
  return out;
}

// A player's move: { type: 'play', card, colour, called } | { type: 'draw' } | { type: 'pass' }.
// The seat comes from the connection, never from the message.
export function move(room, id, mv, now = Date.now()) {
  if (room.phase !== 'playing') return { ok: false, error: 'not_playing' };
  const seat = seatOf(room, id);
  if (seat < 0) return { ok: false, error: 'not_seated' };
  const clean = mv && typeof mv === 'object' ? { type: mv.type, card: mv.card, colour: mv.colour, called: !!mv.called } : null;
  const r = E.apply(room.game, seat, clean);
  if (!r.ok) return { ok: false, error: r.error };
  // Playing your own card while a bot had your seat takes it back.
  const out = room.seats[seat].auto ? (delete room.seats[seat].auto, roomForAll(room)) : [];
  return { ok: true, out: [...out, ...afterMove(room, r.events, now)] };
}

// When `tick` next has work: a bot's move BOT_DELAY_MS after the last one,
// or the moment a person's turn runs out. null when nothing is due, which
// includes nobody being connected: the game waits for someone to come back
// rather than bots playing to an empty room.
export function dueAt(room) {
  if (room.phase !== 'playing' || room.game.winner !== null || !connected(room).length) return null;
  const s = room.seats[room.game.turn];
  const since = room.turnAt || 0;
  if (s.bot || s.auto) return since + BOT_DELAY_MS;
  if (s.off) return Math.max(since, s.off) + GRACE_MS;
  return since + TURN_MS;
}

// Run whatever is due at `now`: a bot move, or a person's turn running out,
// when a bot takes their seat and moves for them.
export function tick(room, now = Date.now()) {
  const due = dueAt(room);
  if (due === null || now < due) return { ok: false, out: [] };
  const seat = room.game.turn;
  const s = room.seats[seat];
  const out = [];
  if (!s.bot && !s.auto) { s.auto = true; out.push(...roomForAll(room)); }
  const r = E.apply(room.game, seat, E.botMove(room.game, seat, room.level));
  if (!r.ok) throw new Error('bot made an illegal move: ' + r.error);
  return { ok: true, out: [...out, ...afterMove(room, r.events, now)] };
}

// What a (re)joining player needs to pick up a game in progress.
function stateFor(room, id) {
  const seat = seatOf(room, id);
  if (seat < 0 || !room.game) return [];
  return [{ to: id, msg: { t: 'deal', view: E.viewFor(room.game, seat), resume: true } }];
}
