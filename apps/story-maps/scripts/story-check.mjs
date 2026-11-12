// pnpm story:check <id>: every check for one story, without building the site
// or opening a browser. Errors are what the build would stop on; warnings are
// layout problems worth a look (scripts/layout.mjs).
//
// Exit code 1 on errors. Warnings do not fail: fix them or say why they stand.

import { checkStory, loadStoryData } from "./engine.mjs";
import { layoutWarnings } from "./layout.mjs";
import { loadManifest } from "./manifest.mjs";

const id = process.argv[2];
const entry = loadManifest().stories.find((s) => s.id === id);
if (!entry) {
  console.error(id ? `No story "${id}" in manifest.json.` : "Usage: pnpm story:check <id>");
  process.exit(1);
}
if (entry.status !== "built") {
  console.error(`${id} is ${entry.status}; set status to "built" in manifest.json once story.json exists.`);
  process.exit(1);
}

const errors = checkStory(entry);
const { story, basemap } = loadStoryData(entry);
const warnings = errors.length ? [] : layoutWarnings(story, basemap);

const words = story.steps.map((/** @type {any} */ s) => s.text.trim().split(/\s+/).length);
const people = story.people ? story.people.items.length : 0;
const realms = story.realms ? story.realms.items.length : 0;
console.log(`${story.title} (${id}) on ${basemap.id}`);
console.log(`${story.steps.length} chapters, ${Object.keys(story.places).length} places, ${people} people, ${realms} realms; cards ${Math.min(...words)} to ${Math.max(...words)} words`);
const thin = words.map((/** @type {number} */ n, /** @type {number} */ i) => (n < 40 ? i + 1 : 0)).filter(Boolean);
if (thin.length) console.log(`Short cards (under 40 words), fine if the sources say no more: steps ${thin.join(", ")}`);

for (const e of errors) console.log(`ERROR  ${e}`);
for (const w of warnings) console.log(`warn   ${w}`);
console.log(errors.length ? `${errors.length} errors: fix these first, then run again for the layout checks.` : `No errors, ${warnings.length} layout warnings.`);
process.exit(errors.length ? 1 : 0);
