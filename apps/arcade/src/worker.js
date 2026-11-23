// Krishnabuilds Arcade worker: serves the static site (via the ASSETS
// binding), a tiny play-count API backed by a single KV key holding all
// counts as one JSON blob (simplest thing that works for hobby-project
// traffic), and Wildcard's online tables, one Durable Object each.
//
// Routes:
//   GET  /api/plays        -> { "<slug>": <count>, ... } for every game
//   POST /api/play/<slug>  -> increments that slug, returns { slug, count };
//                             404 (KV untouched) unless games/<slug>/ exists;
//                             429 (KV untouched) if this IP is over the limit
// Any other /api/play/* path that isn't a well-formed slug is a 404.
//
// Wildcard online tables (one WildcardTable Durable Object per room code):
//   POST /api/wildcard/rooms             -> { code } for a new, empty table;
//                                           429 { error } if this IP is over
//                                           the per-minute ('busy') or daily
//                                           ('daily') limit, or the site's
//                                           daily cap is used up ('full_today')
//   GET  /api/wildcard/rooms/<code>/ws   -> WebSocket to that table (404 if
//                                           there is no such table)
// Both need the request's Origin to be this site's own.
//
// Anything else falls through to the static assets.

export { WildcardTable } from './wildcard-table.js';
export { WildcardLimiter } from './wildcard-limiter.js';
import { LIMITER_NAME } from './wildcard-limiter.js';

const COUNTS_KEY = 'counts';

async function readCounts(env) {
  const raw = await env.PLAY_COUNTS.get(COUNTS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function handlePlaysGet(env) {
  const counts = await readCounts(env);
  return new Response(JSON.stringify(counts), {
    headers: {
      'content-type': 'application/json',
      // Short cache is fine - this is a fun counter, not a ledger.
      'cache-control': 'public, max-age=30'
    }
  });
}

// 1-40 chars of [a-z0-9-], not starting or ending with a hyphen.
const PLAY_ROUTE = /^\/api\/play\/([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)$/;

function notFound() {
  return new Response('Not found', { status: 404 });
}

// A slug is a real game only if its folder serves games/<slug>/index.html.
// Only an exact 200 counts: a missing folder is a 404, and anything else
// (e.g. a redirect, which ASSETS.fetch returns rather than follows) is
// treated as not a game.
async function isGame(slug, request, env) {
  const res = await env.ASSETS.fetch(
    new URL(`/games/${slug}/`, request.url),
    { method: 'HEAD' }
  );
  return res.status === 200;
}

// Basic per-IP limit via the PLAY_LIMITER binding (see wrangler.jsonc). It is
// per Cloudflare location and approximate, which is fine for a fun counter.
async function isRateLimited(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.PLAY_LIMITER.limit({ key: ip });
  return !success;
}

// The route regex only checks the slug's shape; isGame() checks it names a
// real game before KV is read or written. The rate limit runs first so
// rejected requests cost no asset lookup or KV read.
async function handlePlayPost(slug, request, env) {
  if (await isRateLimited(request, env)) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'retry-after': '60' }
    });
  }
  if (!(await isGame(slug, request, env))) return notFound();

  const counts = await readCounts(env);
  counts[slug] = (Object.hasOwn(counts, slug) ? counts[slug] : 0) + 1;

  await env.PLAY_COUNTS.put(COUNTS_KEY, JSON.stringify(counts));
  return new Response(JSON.stringify({ slug, count: counts[slug] }), {
    headers: { 'content-type': 'application/json' }
  });
}

// ---------- Wildcard online tables ----------

// 4 characters, no vowels (so no words) and no look-alikes (0/O, 1/I/L).
const CODE_ALPHABET = 'BCDFGHJKMNPQRSTVWXZ23456789';
const CODE_RE = /^[BCDFGHJKMNPQRSTVWXZ2-9]{4}$/;
const ROOM_WS_ROUTE = /^\/api\/wildcard\/rooms\/([A-Za-z0-9]{4})\/ws$/;
// Browsers always send a truthful Origin on POSTs and WebSocket upgrades;
// requiring our own origin stops other sites using the tables from their
// visitors' browsers. Scripts can fake it, so the rate limits still apply.
function originOk(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

async function handleRoomCreate(request, env) {
  if (!originOk(request)) return json({ error: 'origin' }, 403);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await env.ROOM_LIMITER.limit({ key: ip })).success) {
    return json({ error: 'busy' }, 429, { 'retry-after': '60' });
  }
  // The exact daily counts (src/wildcard-limiter.js). The per-minute limit
  // above runs first, so a burst never reaches the one limiter object.
  const limiter = env.WILDCARD_LIMITER.get(env.WILDCARD_LIMITER.idFromName(LIMITER_NAME));
  const day = await (await limiter.fetch('https://limiter/admit', { method: 'POST', headers: { 'x-ip': ip } })).json();
  if (!day.ok) return json({ error: day.error }, 429, { 'retry-after': String(day.retryAfter) });
  // A clash with a live table is unlikely (27^4 codes); try a few.
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const stub = env.WILDCARD_TABLE.get(env.WILDCARD_TABLE.idFromName(code));
    const res = await stub.fetch('https://table/create?code=' + code, { method: 'POST' });
    if (res.status === 201) return json({ code });
  }
  return json({ error: 'busy' }, 503);
}

function handleRoomSocket(code, request, env) {
  if (!originOk(request)) return new Response('Forbidden', { status: 403 });
  code = code.toUpperCase();
  if (!CODE_RE.test(code)) return new Response('No such table', { status: 404 });
  const stub = env.WILDCARD_TABLE.get(env.WILDCARD_TABLE.idFromName(code));
  return stub.fetch('https://table/ws', request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/plays' && request.method === 'GET') {
      return handlePlaysGet(env);
    }

    const playMatch = url.pathname.match(PLAY_ROUTE);
    if (playMatch && request.method === 'POST') {
      return handlePlayPost(playMatch[1], request, env);
    }
    if (!playMatch && url.pathname.startsWith('/api/play/')) {
      return notFound();
    }

    if (url.pathname === '/api/wildcard/rooms' && request.method === 'POST') {
      return handleRoomCreate(request, env);
    }
    const roomMatch = url.pathname.match(ROOM_WS_ROUTE);
    if (roomMatch && request.method === 'GET') {
      return handleRoomSocket(roomMatch[1], request, env);
    }
    if (url.pathname.startsWith('/api/wildcard/')) return notFound();

    return env.ASSETS.fetch(request);
  }
};
