// Krishnabuilds Arcade worker: serves the static site (via the ASSETS
// binding) and a tiny play-count API backed by a single KV key holding
// all counts as one JSON blob - simplest thing that works for a dozen
// games with hobby-project traffic, no need for per-key list() calls or
// Durable Objects for atomicity.
//
// Routes:
//   GET  /api/plays        -> { "<slug>": <count>, ... } for every game
//   POST /api/play/<slug>  -> increments that slug, returns { slug, count };
//                             404 (KV untouched) unless games/<slug>/ exists
// Any other /api/play/* path that isn't a well-formed slug is a 404.
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

// The route regex only checks the slug's shape; isGame() checks it names a
// real game before KV is read or written.
async function handlePlayPost(slug, request, env) {
  if (!(await isGame(slug, request, env))) return notFound();

  const stored = await readCounts(env);
  // Rebuild the blob from real games only, so stale or junk keys left by
  // older versions of this worker are dropped on the next valid play.
  const counts = {};
  await Promise.all(Object.keys(stored).map(async (key) => {
    if (key !== slug && PLAY_ROUTE.test(`/api/play/${key}`) &&
        (await isGame(key, request, env))) {
      counts[key] = stored[key];
    }
  }));
  const previous = Object.hasOwn(stored, slug) ? stored[slug] : 0;
  counts[slug] = previous + 1;

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

    const playMatch = url.pathname.match(PLAY_ROUTE);
    if (playMatch && request.method === 'POST') {
      return handlePlayPost(playMatch[1], request, env);
    }
    if (!playMatch && url.pathname.startsWith('/api/play/')) {
      return notFound();
    }

    return env.ASSETS.fetch(request);
  }
};
