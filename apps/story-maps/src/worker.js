// Story Maps worker: serves the built site (dist/, via the ASSETS binding) and
// a tiny likes API backed by a single KV key holding every story's count as
// one JSON blob, the same pattern as Arcade's play counter. Fine for hobby
// traffic: the read-modify-write is not atomic, so two likes landing at the
// same instant can lose one.
//
// Routes:
//   GET    /api/likes        -> { "<id>": <count>, ... } for stories with a like
//   POST   /api/like/<id>    -> adds a like, returns { id, count }
//   DELETE /api/like/<id>    -> takes one back (never below 0), returns { id, count }
// <id> must be a built story in manifest.json (404 otherwise, KV untouched).
// Writes are rate-limited per client IP (429, KV untouched).
// Anything else falls through to the static assets (and dist/404.html).
//
// There are no accounts, so one like per reader is kept by the page itself
// (hub/likes.js remembers it in localStorage); the rate limit stops scripts.

import manifest from "../manifest.json";

const COUNTS_KEY = "likes";
const LIKE_ROUTE = /^\/api\/like\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)$/;
const BUILT = new Set(manifest.stories.filter((s) => s.status === "built").map((s) => s.id));

/**
 * @typedef {{
 *   ASSETS: { fetch(request: Request | URL | string, init?: RequestInit): Promise<Response> },
 *   LIKE_COUNTS: { get(key: string): Promise<string | null>, put(key: string, value: string): Promise<void> },
 *   LIKE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> },
 * }} Env
 */

/** @param {unknown} body @param {ResponseInit} [init] */
function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

/** @param {Env} env @returns {Promise<Record<string, number>>} */
async function readCounts(env) {
  const raw = await env.LIKE_COUNTS.get(COUNTS_KEY);
  return raw ? JSON.parse(raw) : {};
}

/** @param {Request} request @param {Env} env */
async function isRateLimited(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const { success } = await env.LIKE_LIMITER.limit({ key: ip });
  return !success;
}

/** @param {string} id @param {1 | -1} change @param {Request} request @param {Env} env */
async function changeLike(id, change, request, env) {
  if (!BUILT.has(id)) return new Response("Not found", { status: 404 });
  if (await isRateLimited(request, env)) {
    return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });
  }
  const counts = await readCounts(env);
  const count = Math.max(0, (Object.hasOwn(counts, id) ? counts[id] : 0) + change);
  if (count) counts[id] = count;
  else delete counts[id];
  await env.LIKE_COUNTS.put(COUNTS_KEY, JSON.stringify(counts));
  return json({ id, count });
}

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/likes") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
      // A short cache is fine: this is a friendly counter, not a ledger.
      return json(await readCounts(env), { headers: { "cache-control": "public, max-age=30" } });
    }

    if (pathname.startsWith("/api/")) {
      const match = pathname.match(LIKE_ROUTE);
      if (!match) return new Response("Not found", { status: 404 });
      if (request.method === "POST") return changeLike(match[1], 1, request, env);
      if (request.method === "DELETE") return changeLike(match[1], -1, request, env);
      return new Response("Method not allowed", { status: 405, headers: { allow: "POST, DELETE" } });
    }

    return env.ASSETS.fetch(request);
  },
};
