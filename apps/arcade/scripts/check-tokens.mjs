// Arcade has no build step, so it serves a committed copy of the shared
// tokens (assets/kb-tokens.css). This fails if the copy has drifted from
// packages/tokens/dist/tokens.css; `pnpm sync-tokens` refreshes it.
//
//   node scripts/check-tokens.mjs          check (pnpm lint, run in CI)
//   node scripts/check-tokens.mjs --write  copy the shared file over

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const shared = require.resolve("@krishnabuilds/tokens/tokens.css");
const copy = join(import.meta.dirname, "..", "assets", "kb-tokens.css");

const expected = readFileSync(shared, "utf8");
if (process.argv.includes("--write")) {
  writeFileSync(copy, expected);
  console.log("Updated assets/kb-tokens.css from @krishnabuilds/tokens.");
} else {
  let actual = "";
  try {
    actual = readFileSync(copy, "utf8");
  } catch {}
  if (actual !== expected) {
    console.error("assets/kb-tokens.css is out of date with @krishnabuilds/tokens. Run `pnpm --filter @krishnabuilds/arcade sync-tokens` and commit it.");
    process.exit(1);
  }
  console.log("assets/kb-tokens.css matches @krishnabuilds/tokens.");
}
