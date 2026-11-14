import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it } from "vitest";

import worker from "../src/worker.js";

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const built = manifest.stories.find((/** @type {{ status: string }} */ s) => s.status === "built").id;
const soon = manifest.stories.find((/** @type {{ status: string }} */ s) => s.status === "coming-soon")?.id;

/** Each namespace is its own map, so a test can see which one a count went to. @type {Record<string, Map<string, string>>} */
let kv;
/** @param {string} ns */
const fakeKv = (ns) => ({
  get: async (/** @type {string} */ k) => kv[ns].get(k) ?? null,
  put: async (/** @type {string} */ k, /** @type {string} */ v) => {
    writes++;
    kv[ns].set(k, v);
  },
});
let allow = true;
let writes = 0;
const env = {
  ASSETS: { fetch: async () => new Response("asset") },
  LIKE_COUNTS: fakeKv("likes"),
  READ_COUNTS: fakeKv("reads"),
  WRITE_LIMITER: { limit: async () => ({ success: allow }) },
};

/** @param {string} path @param {string} [method] */
const call = (path, method = "GET") => worker.fetch(new Request(`https://story-maps.test${path}`, { method }), env);

beforeEach(() => {
  kv = { likes: new Map(), reads: new Map() };
  allow = true;
  writes = 0;
});

describe("counts API", () => {
  it("starts empty, counts a like and takes it back", async () => {
    expect(await (await call("/api/stats")).json()).toEqual({ likes: {}, reads: {} });
    expect(await (await call(`/api/like/${built}`, "POST")).json()).toEqual({ id: built, count: 1 });
    expect(await (await call(`/api/like/${built}`, "POST")).json()).toEqual({ id: built, count: 2 });
    expect(await (await call("/api/stats")).json()).toEqual({ likes: { [built]: 2 }, reads: {} });
    expect(await (await call(`/api/like/${built}`, "DELETE")).json()).toEqual({ id: built, count: 1 });
  });

  it("never goes below zero and drops stories with no likes", async () => {
    expect(await (await call(`/api/like/${built}`, "DELETE")).json()).toEqual({ id: built, count: 0 });
    expect(await (await call("/api/stats")).json()).toEqual({ likes: {}, reads: {} });
  });

  it("counts every opening as a read, kept apart from likes", async () => {
    await call(`/api/read/${built}`, "POST");
    expect(await (await call(`/api/read/${built}`, "POST")).json()).toEqual({ id: built, count: 2 });
    await call(`/api/like/${built}`, "POST");
    expect(await (await call("/api/stats")).json()).toEqual({ likes: { [built]: 1 }, reads: { [built]: 2 } });
    expect((await call(`/api/read/${built}`, "DELETE")).status).toBe(405);
    expect([...kv.likes.keys()]).toEqual(["likes"]);
    expect([...kv.reads.keys()]).toEqual(["reads"]);
  });

  it("only counts built stories, and leaves KV alone otherwise", async () => {
    for (const id of ["no-such-story", "constructor", "__proto__", soon].filter(Boolean)) {
      expect((await call(`/api/like/${id}`, "POST")).status).toBe(404);
      expect((await call(`/api/read/${id}`, "POST")).status).toBe(404);
    }
    expect((await call("/api/like/Bad_Id", "POST")).status).toBe(404);
    expect((await call("/api/other")).status).toBe(404);
    expect(writes).toBe(0);
  });

  it("refuses other methods", async () => {
    expect((await call(`/api/like/${built}`)).status).toBe(405);
    expect((await call("/api/stats", "POST")).status).toBe(405);
    expect((await call("/api/likes")).status).toBe(404);
  });

  it("rate-limits writes without touching KV", async () => {
    allow = false;
    expect((await call(`/api/like/${built}`, "POST")).status).toBe(429);
    expect((await call(`/api/read/${built}`, "POST")).status).toBe(429);
    expect(writes).toBe(0);
  });

  it("serves everything else from the static assets", async () => {
    expect(await (await call(`/${built}/`)).text()).toBe("asset");
  });
});
