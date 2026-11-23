// Wildcard online table: one Durable Object per room code, the only
// authority for its game. It deals, shuffles and runs the bots, and sends
// each player just what their seat may see. The rules of the room live in
// wildcard-room.js; this file is the WebSockets, storage and alarms.
//
// Uses WebSocket Hibernation: the object can be evicted between messages,
// so the room is saved to storage after every change and each socket
// carries its player id in its attachment.
//
// One alarm does two jobs: run the next bot move when a bot is due, and
// otherwise delete the room once it has been idle (nobody connected for
// EMPTY_MS, or no change at all for IDLE_MS).

import * as R from './wildcard-room.js';

const BOT_DELAY_MS = 900;
const EMPTY_MS = 10 * 60 * 1000;
const IDLE_MS = 2 * 60 * 60 * 1000;
const MAX_MESSAGE = 1024;

export class WildcardTable {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    // The Worker creates the room before handing out its code.
    if (url.pathname === '/create' && request.method === 'POST') {
      if (this.room) return new Response('taken', { status: 409 });
      this.room = R.createRoom(url.searchParams.get('code'));
      this.room.touched = Date.now();
      await this.save();
      await this.schedule(); // expires if nobody joins
      return new Response('created', { status: 201 });
    }
    if (url.pathname === '/ws') {
      if (!this.room) return new Response('No such table', { status: 404 });
      if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ id: null });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws, data) {
    if (!this.room) { ws.close(4404, 'gone'); return; }
    if (typeof data !== 'string' || data.length > MAX_MESSAGE) { ws.close(1009, 'too big'); return; }
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const me = ws.deserializeAttachment() || {};

    if (m.t === 'hello') {
      if (me.id) return;
      const id = typeof m.id === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(m.id) ? m.id : null;
      if (!id) { this.send(ws, { t: 'error', error: 'bad_id' }); ws.close(4400, 'bad id'); return; }
      // The same player in a second tab: the newer connection wins.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && (other.deserializeAttachment() || {}).id === id) {
          other.serializeAttachment({ id: null });
          other.close(4409, 'replaced');
        }
      }
      const r = R.join(this.room, id, m.name);
      if (!r.ok) { this.send(ws, { t: 'error', error: r.error }); ws.close(4403, r.error); return; }
      ws.serializeAttachment({ id });
      return this.commit(r.out);
    }
    if (!me.id) return;
    let r;
    if (m.t === 'config') r = R.configure(this.room, me.id, { size: m.size, level: m.level });
    else if (m.t === 'start') r = R.start(this.room, me.id, random);
    else if (m.t === 'move') r = R.move(this.room, me.id, m.move);
    else return;
    if (!r.ok) { this.send(ws, { t: 'error', error: r.error }); return; }
    return this.commit(r.out);
  }

  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }

  async gone(ws) {
    const me = ws.deserializeAttachment() || {};
    ws.serializeAttachment({ id: null });
    if (!this.room || !me.id) return this.schedule();
    return this.commit(R.leave(this.room, me.id).out);
  }

  async alarm() {
    if (!this.room) return;
    if (R.botDue(this.room)) return this.commit(R.botStep(this.room).out);
    const now = Date.now();
    const open = this.sockets().length;
    if ((!open && now - this.room.touched >= EMPTY_MS) || now - this.room.touched >= IDLE_MS) {
      for (const ws of this.ctx.getWebSockets()) { try { ws.close(4410, 'expired'); } catch (e) {} }
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    return this.schedule();
  }

  // Save, send, and set the alarm for whatever comes next.
  async commit(out) {
    this.room.touched = Date.now();
    await this.save();
    const byId = new Map();
    for (const ws of this.sockets()) byId.set(ws.deserializeAttachment().id, ws);
    for (const { to, msg } of out) {
      const ws = byId.get(to);
      if (ws) this.send(ws, msg);
    }
    return this.schedule();
  }

  async schedule() {
    if (!this.room) return;
    const touched = this.room.touched || Date.now();
    const at = R.botDue(this.room) ? Date.now() + BOT_DELAY_MS
      : this.sockets().length ? touched + IDLE_MS : touched + EMPTY_MS;
    await this.ctx.storage.setAlarm(at);
  }

  save() { return this.ctx.storage.put('room', this.room); }

  // Sockets that have said hello and hold a seat.
  sockets() { return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() || {}).id); }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) {} }
}

function random() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
