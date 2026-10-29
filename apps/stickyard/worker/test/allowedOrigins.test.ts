import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { isAllowedOrigin, parseAllowedOrigins } from "../src/origin";
import { BASE, PAGES_ORIGIN, testEnv } from "./helpers";

/** The monorepo web app's origin, alongside the old GitHub Pages origin until that site is retired. */
const SITE_ORIGIN = "https://stickyard.krishnabuilds.dev";

describe("ALLOWED_ORIGINS in wrangler.jsonc", () => {
  it("parses to exactly the old Pages origin and the new site origin", () => {
    expect(parseAllowedOrigins(testEnv.ALLOWED_ORIGINS)).toEqual([PAGES_ORIGIN, SITE_ORIGIN]);
  });

  it.each([SITE_ORIGIN, PAGES_ORIGIN])("allows %s", async (origin) => {
    expect(isAllowedOrigin(origin, parseAllowedOrigins(testEnv.ALLOWED_ORIGINS))).toBe(true);
    const res = await exports.default.fetch(new Request(`${BASE}/health`, { headers: { Origin: origin } }));
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
  });

  it.each(["https://evil.example.test", "https://krishnabuilds.dev", "https://other.krishnabuilds.dev", "http://stickyard.krishnabuilds.dev"])(
    "rejects %s",
    async (origin) => {
      expect(isAllowedOrigin(origin, parseAllowedOrigins(testEnv.ALLOWED_ORIGINS))).toBe(false);
      const res = await exports.default.fetch(new Request(`${BASE}/health`, { headers: { Origin: origin } }));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    },
  );
});
