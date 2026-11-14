// Story Maps worker: serves the built site (dist/, via the ASSETS binding) and
// a tiny counts API for likes and reads, the same pattern as Arcade's play
// counter. Each count is one JSON blob under its own KV key ("likes" and
// "reads"), so a like and a read never overwrite each other. Fine for hobby
// traffic: the read-modify-write is not atomic, so two writes to the same key
// at the same instant can lose one.
//
// Routes:
//   GET    /api/stats        -> { likes: { "<id>": n }, reads: { "<id>": n } } (stories with a count only)
//   POST   /api/like/<id>    -> adds a like, returns { id, count }
//   DELETE /api/like/<id>    -> takes one back (never below 0), returns { id, count }
//   POST   /api/read/<id>    -> counts one opening of the story, returns { id, count }
// <id> must be a built story in manifest.json (404 otherwise, KV untouched).
// Writes are rate-limited per client IP (429, KV untouched).
// Anything else falls through to the static assets (and dist/404.html).
//
// There are no accounts, so one like per reader is kept by the page itself
// (hub/stats.js remembers it in localStorage). Every opening counts as a read,
// repeat visits included. The rate limit stops scripts.

import manifest from "../manifest.json";

const ROUTE = /^\/api\/(like|read)\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)$/;
const BUILT = new Set(manifest.stories.filter((s) => s.status === "built").map((s) => s.id));
/** @type {Record<string, string>} */
const KEYS = { like: "likes", read: "reads" };

/**
 * @typedef {{
 *   ASSETS: { fetch(request: Request | URL | string, init?: RequestInit): Promise<Response> },
 *   STORY_COUNTS: { get(key: string): Promise<string | null>, put(key: string, value: string): Promise<void> },
 *   WRITE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> },
 * }} Env
 */

/** @param {unknown} body @param {ResponseInit} [init] */
function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

/** @param {Env} env @param {string} key @returns {Promise<Record<string, number>>} */
async function readCounts(env, key) {
  const raw = await env.STORY_COUNTS.get(key);
  return raw ? JSON.parse(raw) : {};
}

/** @param {Request} request @param {Env} env */
async function isRateLimited(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const { success } = await env.WRITE_LIMITER.limit({ key: ip });
  return !success;
}

/** @param {string} key @param {string} id @param {1 | -1} change @param {Request} request @param {Env} env */
async function change(key, id, change, request, env) {
  if (!BUILT.has(id)) return new Response("Not found", { status: 404 });
  if (await isRateLimited(request, env)) {
    return new Response("Too many requests", { status: 429, headers: { "retry-after": "60" } });
  }
  const counts = await readCounts(env, key);
  const count = Math.max(0, (Object.hasOwn(counts, id) ? counts[id] : 0) + change);
  if (count) counts[id] = count;
  else delete counts[id];
  await env.STORY_COUNTS.put(key, JSON.stringify(counts));
  return json({ id, count });
}

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/stats") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
      const [likes, reads] = await Promise.all([readCounts(env, "likes"), readCounts(env, "reads")]);
      // A short cache is fine: these are friendly counters, not a ledger.
      return json({ likes, reads }, { headers: { "cache-control": "public, max-age=30" } });
    }

    if (pathname.startsWith("/api/")) {
      const match = pathname.match(ROUTE);
      if (!match) return new Response("Not found", { status: 404 });
      const [, kind, id] = match;
      if (request.method === "POST") return change(KEYS[kind], id, 1, request, env);
      if (kind === "like" && request.method === "DELETE") return change(KEYS[kind], id, -1, request, env);
      return new Response("Method not allowed", { status: 405, headers: { allow: kind === "like" ? "POST, DELETE" : "POST" } });
    }

    return env.ASSETS.fetch(request);
  },
};
