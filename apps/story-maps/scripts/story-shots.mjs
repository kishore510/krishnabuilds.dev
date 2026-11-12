// pnpm story:shots <id> [steps]: phone-sized screenshots of chosen chapters,
// for the few things arithmetic can't judge (realm shapes, route bends, how a
// crowded corner reads). Build first. `steps` is a list such as 1,7,12; with
// none it takes the first and last chapters and every chapter the layout
// checks flag, eight at most. Stories with realms are shot with the layer on.
//
// Needs Playwright with a Chromium, which Claude Code cloud sessions have.
// It is deliberately not a dependency of this app.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, normalize } from "node:path";

import { loadStoryData } from "./engine.mjs";
import { layoutWarnings } from "./layout.mjs";
import { APP_DIR, loadManifest } from "./manifest.mjs";

const [id, list] = process.argv.slice(2);
const entry = loadManifest().stories.find((s) => s.id === id && s.status === "built");
const DIST = `${APP_DIR}dist`;
if (!entry || !existsSync(`${DIST}/${id}/index.html`)) {
  console.error(entry ? `dist/${id}/ is missing: run the build first.` : "Usage: pnpm story:shots <built story id> [steps, such as 1,7,12]");
  process.exit(1);
}

const { story, basemap } = loadStoryData(entry);
const last = story.steps.length;
let steps = (list || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= last);
if (!steps.length) {
  const flagged = layoutWarnings(story, basemap).map((w) => Number((/^step (\d+)/.exec(w) || [])[1])).filter(Boolean);
  steps = [...new Set([1, ...flagged, last])].slice(0, 8);
}

const TYPES = { ".html": "text/html", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".css": "text/css", ".js": "text/javascript" };
const server = createServer((req, res) => {
  let path = normalize(decodeURIComponent((req.url || "/").split(/[?#]/)[0]));
  if (path.endsWith("/")) path += "index.html";
  const file = `${DIST}${path}`;
  if (path.includes("..") || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] || "application/octet-stream" }).end(readFileSync(file));
});
await new Promise((done) => server.listen(0, "127.0.0.1", () => done(null)));
const address = /** @type {import("node:net").AddressInfo} */ (server.address());

// Not a dependency (see the note at the top), so tsc must not try to resolve it.
// require, not import: a globally installed Playwright is found through NODE_PATH.
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
// No first-visit tour over the map.
await page.addInitScript('localStorage.setItem("sm-tour", JSON.stringify({ hub: true, story: true }))');

const out = `${APP_DIR}.work/${id}`;
mkdirSync(out, { recursive: true });
for (const n of steps) {
  await page.goto(`http://127.0.0.1:${address.port}/${id}/#${n}`);
  await page.reload();
  const toggle = page.locator("#sm-realm-toggle:not([hidden])");
  if ((await toggle.count()) && (await toggle.getAttribute("aria-pressed")) === "false") await toggle.click();
  await page.waitForTimeout(1800);
  const file = `${out}/step-${String(n).padStart(2, "0")}.png`;
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();
server.close();
