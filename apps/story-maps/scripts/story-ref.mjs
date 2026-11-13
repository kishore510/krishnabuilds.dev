// pnpm story:ref: everything a new story's data may refer to, printed from the
// data files themselves so it is never out of date. Read this instead of
// opening art/glyphs.json, catalogue.json, the basemaps or the engine.

import { readdirSync, readFileSync } from "node:fs";

import { MIN_CAMERA_UNITS } from "./layout.mjs";
import { APP_DIR, loadManifest } from "./manifest.mjs";

/** @param {string} path */
const json = (path) => JSON.parse(readFileSync(`${APP_DIR}${path}`, "utf8"));
const round = (/** @type {number} */ n) => Math.round(n * 10) / 10;

const manifest = loadManifest();
const pkg = json("package.json");
const art = json("art/glyphs.json");
const catalogue = json("catalogue.json");

console.log(`Story Maps ${pkg.version}. A new story is the next minor version.\n`);

console.log("BASEMAPS (use one that covers every visible place; a new one only if none does)");
for (const file of readdirSync(`${APP_DIR}basemaps`).sort()) {
  const b = json(`basemaps/${file}`);
  const { lon0, lat0, unitsPerDegree: k } = b.projection;
  const [w, h] = b.size;
  console.log(
    `  ${b.id}: lon ${round(lon0)} to ${round(lon0 + w / k)}, lat ${round(lat0 - h / (k * (b.projection.stretch || 1)))} to ${round(lat0)}; ` +
      `a pin is ${round(28 / k)}° wide; cameras narrower than ${round(MIN_CAMERA_UNITS / k)}° all look the same on a phone; ` +
      `whole map ${b.overview.width}° at [${b.overview.at}]`,
  );
}

console.log(`\nPLACE GLYPHS\n  ${Object.keys(art.glyphs).join(", ")}`);
console.log(`\nTRAVELLER ICONS\n  ${Object.keys(art.travellers).join(", ")}`);
console.log(`\nEFFECTS\n  lamps`);
console.log(`\nLABEL SIDES\n  right, left, top, bottom`);

console.log("\nSECTIONS AND FOLDERS");
for (const section of manifest.sections) {
  const collections = manifest.collections.filter((c) => c.section === section.id).map((c) => c.id);
  console.log(`  ${section.id}: stories/${section.id}/${collections.length ? `<${collections.join("|")}>/` : ""}<id>/`);
}

console.log("\nSTORIES (ids are taken; coming-soon ones already have a folder and a manifest entry)");
for (const s of manifest.stories) console.log(`  ${s.id} [${s.section}${s.collection ? `/${s.collection}` : ""}] ${s.status}: ${s.title}`);

console.log("\nCATALOGUE REGIONS AND LANES");
for (const r of catalogue.regions) console.log(`  ${r.id}: ${r.lanes.map((/** @type {any} */ l) => l.id).join(", ") || "(no lanes; Browse only)"}`);

console.log("\nCATALOGUE ENTRIES WITH NO STORY YET (link one with \"story\" rather than adding a duplicate)");
const open = catalogue.entries.filter((/** @type {any} */ e) => !e.story);
console.log(`  ${open.map((/** @type {any} */ e) => e.id).join(", ")}`);
