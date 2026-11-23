// Wildcard: how many new online tables may be started each day. One
// Durable Object (named LIMITER_NAME) holds today's counts, so they are
// exact (KV isn't, and the Rate Limiting binding only counts per minute).
//
//   - PER_IP_PER_DAY new tables per IP address, for everyone.
//   - SITE_PER_DAY new tables in all, so someone hopping between IPs (a
//     VPN) still can't run the free tier dry.
//   Joining a table is never limited.
//
// IPs are never stored or logged. Each is hashed with today's salt, a
// random value made at the first request of the UTC day and thrown away,
// with all of that day's counts, at the first request of the next. A hash
// can't be turned back into an IP, and once the salt is gone it can't be
// matched to one either.
//
// `admit` is pure so Node can test it (scripts/wildcard-limiter.test.mjs).

export const LIMITER_NAME = 'global';
export const PER_IP_PER_DAY = 5;
export const SITE_PER_DAY = 100;
const DAY = 24 * 60 * 60 * 1000;

// A fresh day: a new salt and no counts.
export function newDay(day, salt) {
  return { day, salt, total: 0, ips: {} };
}

// One request for a new table from `hash` (this day's hash of its IP).
// Counts it and returns { ok: true }, or { ok: false, error, retryAfter }
// (seconds until the next UTC midnight) without counting it.
export function admit(rec, hash, now, limits = { perIp: PER_IP_PER_DAY, site: SITE_PER_DAY }) {
  const retryAfter = Math.max(1, Math.ceil(((rec.day + 1) * DAY - now) / 1000));
  if ((rec.ips[hash] || 0) >= limits.perIp) return { ok: false, error: 'daily', retryAfter };
  if (rec.total >= limits.site) return { ok: false, error: 'full_today', retryAfter };
  rec.ips[hash] = (rec.ips[hash] || 0) + 1;
  rec.total++;
  return { ok: true };
}

export const dayOf = (now) => Math.floor(now / DAY);

// SHA-256 of salt and IP, hex, cut to 16 characters (64 bits: plenty to
// keep a day's few hundred IPs apart).
export async function hashIp(salt, ip) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + ip)));
  return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The Worker calls fetch('https://limiter/admit') with the IP in an
// `x-ip` header (a plain class with fetch, like WildcardTable, so Node can
// import this file). The IP lives only in this request. Today's
// record is kept in memory as well as storage, and changed only in
// synchronous code, so two requests at once can't both count from the
// same old total.
export class WildcardLimiter {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.rec = null;
    ctx.blockConcurrencyWhile(async () => {
      this.rec = (await ctx.storage.get('day')) || null;
    });
  }

  today(now) {
    const day = dayOf(now);
    if (!this.rec || this.rec.day !== day) this.rec = newDay(day, newSalt());
    return this.rec;
  }

  async fetch(request) {
    const ip = request.headers.get('x-ip') || 'unknown';
    return Response.json(await this.admit(ip));
  }

  async admit(ip) {
    const salt = this.today(Date.now()).salt;
    const hash = await hashIp(salt, String(ip));
    const now = Date.now();
    const rec = this.today(now);
    // Past midnight while hashing: hash again with the new day's salt.
    const r = admit(rec, rec.salt === salt ? hash : await hashIp(rec.salt, String(ip)), now);
    if (r.ok) await this.ctx.storage.put('day', rec);
    return r;
  }
}
