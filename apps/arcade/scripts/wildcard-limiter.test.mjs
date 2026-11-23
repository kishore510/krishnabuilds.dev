// Wildcard's daily limits on new online tables (src/wildcard-limiter.js).
// Run from apps/arcade: node --test scripts/wildcard-limiter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/wildcard-limiter.js';

const DAY = 24 * 60 * 60 * 1000;
const noon = 20000 * DAY + DAY / 2;

test('each IP gets PER_IP_PER_DAY new tables, then waits for midnight', () => {
  const rec = L.newDay(L.dayOf(noon), 'salt');
  for (let i = 0; i < L.PER_IP_PER_DAY; i++) assert.ok(L.admit(rec, 'a', noon).ok);
  const no = L.admit(rec, 'a', noon);
  assert.equal(no.ok, false);
  assert.equal(no.error, 'daily');
  assert.equal(no.retryAfter, DAY / 2 / 1000);
  assert.ok(L.admit(rec, 'b', noon).ok, 'another IP is unaffected');
  assert.equal(rec.total, L.PER_IP_PER_DAY + 1, 'refusals are not counted');
});

test('the site-wide cap stops everyone once used up', () => {
  const rec = L.newDay(L.dayOf(noon), 'salt');
  const limits = { perIp: 5, site: 3 };
  for (const ip of ['a', 'b', 'c']) assert.ok(L.admit(rec, ip, noon, limits).ok);
  assert.equal(L.admit(rec, 'd', noon, limits).error, 'full_today');
});

test('IPs are hashed with the day\'s salt: same salt same hash, new salt new hash, never the raw IP', async () => {
  const a = await L.hashIp('one', '203.0.113.7');
  assert.equal(a, await L.hashIp('one', '203.0.113.7'));
  assert.notEqual(a, await L.hashIp('two', '203.0.113.7'));
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.ok(!a.includes('203'));
});

test('the limiter object counts by hash, stores no IP, and starts afresh each day', async () => {
  const store = new Map();
  const ctx = {
    storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, structuredClone(v)); } },
    blockConcurrencyWhile: (f) => f(),
  };
  const obj = new L.WildcardLimiter(ctx, {});
  const ip = '198.51.100.23';
  for (let i = 0; i < L.PER_IP_PER_DAY; i++) assert.ok((await obj.admit(ip)).ok);
  assert.equal((await obj.admit(ip)).error, 'daily');
  const saved = JSON.stringify(store.get('day'));
  assert.ok(!saved.includes(ip), 'the IP is never stored');
  // Tomorrow: a new salt and no counts.
  const yesterday = obj.rec;
  obj.rec = Object.assign({}, yesterday, { day: yesterday.day - 1 });
  assert.ok((await obj.admit(ip)).ok);
  assert.notEqual(obj.rec.salt, yesterday.salt);
  assert.equal(obj.rec.total, 1);
});
