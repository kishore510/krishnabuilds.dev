// Wildcard online table: the room's rules, kept free of Durable Object and
// WebSocket code so Node can test them (scripts/wildcard-room.test.mjs).
// src/wildcard-table.js wraps this in a Durable Object.
//
// A room is plain JSON, saved whole after every change:
//   { code, phase: 'lobby' | 'playing' | 'over', size (2-4), level,
//     host (a player id), seats: [{ id, name, bot }], game (engine state) }
// Humans take seats in the order they join. At the start the host's chosen
// table size is filled with bots. A player who leaves the lobby frees their
// seat; one who leaves a game is replaced by a bot so the game goes on.
//
// Every function returns the messages to send as [{ to, msg }], where `to`
// is a player id or '*' (everyone). The game's hidden information only ever
// leaves through viewFor / eventsFor for the receiving seat.

import E from '../games/wildcard/engine.js';

export const MAX_SEATS = 4;
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
    seats: room.seats.map((s) => ({ name: s.name, bot: !!s.bot })),
  };
}
const toAll = (room, make) => humans(room).map((s) => ({ to: s.id, msg: make(s.id, seatOf(room, s.id)) }));
const roomForAll = (room) => toAll(room, (id) => roomMsg(room, id));

// Someone opens a connection with { name, id }.
export function join(room, id, rawName) {
  if (seatOf(room, id) >= 0) return { ok: true, out: [{ to: id, msg: roomMsg(room, id) }, ...stateFor(room, id)] };
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

// A connection closes. In the lobby the seat is freed (and the host role
// passes on); in a game a bot takes over the seat.
export function leave(room, id) {
  const at = seatOf(room, id);
  if (at < 0) return { out: [] };
  if (room.phase === 'lobby') room.seats.splice(at, 1);
  else room.seats[at] = { name: room.seats[at].name, bot: true };
  if (room.host === id) room.host = humans(room).length ? humans(room)[0].id : null;
  return { out: roomForAll(room) };
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
export function start(room, id, random) {
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
  return { ok: true, out: [...roomForAll(room), ...toAll(room, (pid, seat) => ({ t: 'deal', view: E.viewFor(room.game, seat) }))] };
}

function afterMove(room, events) {
  if (room.game.winner !== null) room.phase = 'over';
  const out = toAll(room, (pid, seat) => ({ t: 'update', events: E.eventsFor(events, seat), view: E.viewFor(room.game, seat) }));
  if (room.phase === 'over') out.push(...roomForAll(room));
  return out;
}

// A player's move: { type: 'play', card, colour, called } | { type: 'draw' } | { type: 'pass' }.
// The seat comes from the connection, never from the message.
export function move(room, id, mv) {
  if (room.phase !== 'playing') return { ok: false, error: 'not_playing' };
  const seat = seatOf(room, id);
  if (seat < 0) return { ok: false, error: 'not_seated' };
  const clean = mv && typeof mv === 'object' ? { type: mv.type, card: mv.card, colour: mv.colour, called: !!mv.called } : null;
  const r = E.apply(room.game, seat, clean);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, out: afterMove(room, r.events) };
}

// Whether the seat to play is a bot (the table then schedules botStep).
export const botDue = (room) => room.phase === 'playing' && room.game.winner === null && !!room.seats[room.game.turn].bot;

// One bot move, when one is due.
export function botStep(room) {
  if (!botDue(room)) return { ok: false, out: [] };
  const seat = room.game.turn;
  const r = E.apply(room.game, seat, E.botMove(room.game, seat, room.level));
  if (!r.ok) throw new Error('bot made an illegal move: ' + r.error);
  return { ok: true, out: afterMove(room, r.events) };
}

// What a (re)joining player needs to pick up a game in progress.
function stateFor(room, id) {
  const seat = seatOf(room, id);
  if (seat < 0 || !room.game) return [];
  return [{ to: id, msg: { t: 'deal', view: E.viewFor(room.game, seat), resume: true } }];
}
