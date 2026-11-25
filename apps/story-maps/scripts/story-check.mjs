// pnpm story:check <id>: every check for one story, without building the site
// or opening a browser. Errors are what the build would stop on; warnings are
// layout problems worth a look (scripts/layout.mjs).
//
// Exit code 1 on errors. Warnings do not fail: fix them or say why they stand.

import { checkStory, loadStoryData } from "./engine.mjs";
import { layoutWarnings } from "./layout.mjs";
import { loadManifest } from "./manifest.mjs";
import { loadNextContext, nextProblems, nextStories } from "./next.mjs";

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

const errors = [...checkStory(entry), ...nextProblems(loadManifest().stories).filter((p) => p.startsWith(`story ${id}:`))];
const { story, basemap } = loadStoryData(entry);
const warnings = errors.length ? [] : layoutWarnings(story, basemap);

const words = story.steps.map((/** @type {any} */ s) => s.text.trim().split(/\s+/).length);
const people = story.people ? story.people.items.length : 0;
const realms = story.realms ? story.realms.items.length : 0;
console.log(`${story.title} (${id}) on ${basemap.id}`);
console.log(`${story.steps.length} chapters, ${Object.keys(story.places).length} places, ${people} people, ${realms} realms; cards ${Math.min(...words)} to ${Math.max(...words)} words`);
const thin = words.map((/** @type {number} */ n, /** @type {number} */ i) => (n < 40 ? i + 1 : 0)).filter(Boolean);
if (thin.length) console.log(`Short cards (under 40 words), fine if the sources say no more: steps ${thin.join(", ")}`);

// Where the end card sends readers ("Follow another story"). These are also the first
// Related links on the story's pages, which search engines follow, so check them.
if (!errors.length) {
  const ctx = loadNextContext();
  const picks = nextStories(entry, ctx).slice(0, 2);
  console.log(`End card offers: ${picks.map((p) => `${p.story.title} (${p.why})`).join("; ")}`);
  for (const p of picks) {
    if (p.weak) warnings.push(`end card offers ${p.story.id} only because it is ${p.why === "same shelf" ? "on the same shelf" : "on another shelf"}: set "next" in manifest.json to the stories a reader should follow on to`);
  }
  const offeredBy = ctx.stories.filter((s) => s.id !== id && nextStories(s, ctx).slice(0, 2).some((p) => p.story.id === id));
  console.log(`Offered at the end of: ${offeredBy.map((s) => s.title).join("; ") || "no story yet"}`);
  if (!offeredBy.length) warnings.push(`no other story's end card offers this one: add "${id}" to the "next" of the story readers should come here from`);
}

for (const e of errors) console.log(`ERROR  ${e}`);
for (const w of warnings) console.log(`warn   ${w}`);
console.log(errors.length ? `${errors.length} errors: fix these first, then run again for the layout checks.` : `No errors, ${warnings.length} layout warnings.`);
process.exit(errors.length ? 1 : 0);
