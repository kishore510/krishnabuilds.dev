// Krishnabuilds Arcade worker: serves the static site (via the ASSETS
// binding) and a tiny play-count API backed by a single KV key holding
// all counts as one JSON blob - simplest thing that works for a dozen
// games with hobby-project traffic, no need for per-key list() calls or
// Durable Objects for atomicity.
//
// Routes:
//   GET  /api/plays        -> { "<slug>": <count>, ... } for every game
//   POST /api/play/<slug>  -> increments that slug, returns { slug, count }
// Anything else falls through to the static assets.

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

// slug is already validated as [a-z0-9-]+ by the route regex below before
// this is ever called.
async function handlePlayPost(slug, env) {
  const counts = await readCounts(env);
  counts[slug] = (counts[slug] || 0) + 1;
  await env.PLAY_COUNTS.put(COUNTS_KEY, JSON.stringify(counts));
  return new Response(JSON.stringify({ slug, count: counts[slug] }), {
    headers: { 'content-type': 'application/json' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/plays' && request.method === 'GET') {
      return handlePlaysGet(env);
    }

    const playMatch = url.pathname.match(/^\/api\/play\/([a-z0-9-]+)$/);
    if (playMatch && request.method === 'POST') {
      return handlePlayPost(playMatch[1], env);
    }

    return env.ASSETS.fetch(request);
  }
};
