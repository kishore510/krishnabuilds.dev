// Which stories a story's end card offers next ("Follow another story"). The same
// two links are the first "Related" links on the story page and its /read/ page,
// which search engines follow, so they should lead somewhere a reader would go.
//
// nextStories is pure: the build, `pnpm story:check` and test/next.test.js all call it.
// loadNextContext reads what it needs from the app's files.
//
// Order:
//   1. The story's own `next` in manifest.json, as written (for when the rules get it wrong).
//   2. Close stories: the same section; a story either one names in its cards at least 3
//      times, whatever the shelf (Radioactivity names Marie Curie); or one from the same
//      shelf that sits next to it on the timeline or shares its years.
//   3. The rest of the same shelf.
//   4. Everything else.
// Within a group: named often (10 times or more), then timeline neighbours, then
// most mentions, then most shared years, then manifest order from this story on.

import { loadCatalogue, loadExplore } from "./catalogue.mjs";
import { loadStoryData } from "./engine.mjs";
import { loadManifest } from "./manifest.mjs";

/**
 * @typedef {import("./manifest.mjs").Story} Story
 * @typedef {import("./manifest.mjs").Section} Section
 * @typedef {import("./catalogue.mjs").Entry} Entry
 * @typedef {{ story: Story, why: string, weak: boolean }} Pick
 */

/**
 * The text a story's reader sees on its cards: its description, chapter titles and
 * text, and people cards. Not `today` (what stands at a place now), whose museums and
 * memorials name people the story is not about.
 * @param {any} data a story.json
 */
export function storyWords(data) {
  const parts = [data.description, ...data.steps.flatMap((/** @type {any} */ s) => [s.title, s.text])];
  for (const p of data.people?.items ?? []) parts.push(p.name, p.role, p.text);
  return parts.filter(Boolean).join("\n");
}

// Named this often, two stories share a subject (Maurya and Ashoka, Plato and Socrates):
// that outranks being neighbours on the timeline.
const OFTEN = 10;
// Named fewer times than this, it is a passing mention ("the British take it to London").
const SOME = 3;

/**
 * How many times a name appears in text as whole words. A short form must not run on
 * into another capitalised word, so "British" in "the British Museum" is not the
 * British Empire.
 * @param {string} text @param {string} name @param {boolean} short
 */
const count = (text, name, short) => {
  const word = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = short ? "(?![\\p{L}\\p{N}]| \\p{Lu})" : "(?![\\p{L}\\p{N}])";
  return text.match(new RegExp(`(?<![\\p{L}\\p{N}])${word}${tail}`, "gu"))?.length ?? 0;
};

/**
 * How often text names a story, counting each place once: "Chola" inside "The Chola
 * Empire" is not a second mention. Short forms drop "The" and a dynasty or empire's
 * word ("The Chola Empire" is also "Chola"; "The Delhi Sultanate" stays whole), and
 * count only when withShort is set.
 * @param {string} text @param {string[]} names @param {boolean} withShort
 */
const mentionsIn = (text, names, withShort) => {
  /** @type {{ name: string, short: boolean }[]} */
  const list = [];
  for (const name of names) {
    list.push({ name, short: false });
    const short = name.replace(/^The /, "").replace(/ (Empire|Dynasty|Kingdom)$/, "");
    if (withShort && short !== name.replace(/^The /, "")) list.push({ name: short, short: true });
  }
  list.sort((x, y) => y.name.length - x.name.length);
  let rest = text;
  let n = 0;
  for (const { name, short } of list) {
    n += count(rest, name, short);
    rest = rest.split(name).join(" ");
  }
  return n;
};

/**
 * @param {Story} entry the story whose end card this is
 * @param {{
 *   stories: Story[],
 *   sections: Section[],
 *   entries: Entry[],
 *   words: Map<string, string>,
 *   neighbours: (e: Entry, all: Entry[]) => { before?: Entry, after?: Entry },
 * }} ctx built stories in manifest order, the manifest's sections, the catalogue's
 *   entries, each built story's storyWords, and hub/explore.js's neighbours
 * @returns {Pick[]} every other built story, best first; `weak` when nothing ties it to
 *   this story but its shelf, or not even that
 */
export function nextStories(entry, { stories, sections, entries, words, neighbours }) {
  const mine = entries.filter((e) => e.story === entry.id);
  /** @param {string} id */
  const shelfOf = (id) => sections.find((x) => x.id === id)?.shelf;

  // Stories about the entries straight after (then before) this one's on the timeline.
  /** @type {string[]} */
  const neighbourStories = [];
  const own = [...mine].sort((a, b) => (a.chapter === undefined ? 0 : 1) - (b.chapter === undefined ? 0 : 1));
  for (const e of own) {
    const { before, after } = neighbours(e, entries);
    for (const x of [after, before]) {
      if (x?.story && x.story !== entry.id && !neighbourStories.includes(x.story)) neighbourStories.push(x.story);
    }
  }

  /** The longest stretch of years one of this story's entries shares with one of s's. @param {Story} s */
  const shared = (s) => {
    let years = 0;
    for (const a of mine) {
      for (const b of entries) {
        if (b.story !== s.id || a.from === undefined || a.to === undefined || b.from === undefined || b.to === undefined) continue;
        years = Math.max(years, Math.min(a.to, b.to) - Math.max(a.from, b.from));
      }
    }
    return years;
  };

  /** The names a story goes by: its title and its own catalogue entry's name. @param {Story} s */
  const names = (s) => [...new Set([s.title, ...entries.filter((e) => e.story === s.id && e.chapter === undefined).map((e) => e.name)])];
  const myWords = words.get(entry.id) ?? "";
  // How often either story names the other in its cards. Across shelves only full
  // names count: "Roman" in Pluto's story is a god, not the Roman Empire.
  /** @param {Story} s */
  const mentions = (s) => {
    const short = shelfOf(s.section) === shelfOf(entry.section);
    const n = mentionsIn(myWords, names(s), short) + mentionsIn(words.get(s.id) ?? "", names(entry), short);
    return n >= SOME ? n : 0;
  };

  const at = stories.findIndex((s) => s.id === entry.id);
  const inOrder = [...stories.slice(at + 1), ...stories.slice(0, Math.max(at, 0))];
  const chosen = entry.next ?? [];

  return inOrder
    .map((s, i) => {
      const years = shared(s);
      const named = mentions(s);
      const n = neighbourStories.indexOf(s.id);
      const sameShelf = shelfOf(s.section) === shelfOf(entry.section);
      const pick = chosen.indexOf(s.id);
      /** @type {[number, string]} */
      const [group, why] =
        pick >= 0 ? [0, "chosen in manifest.json"]
        : s.section === entry.section ? [1, "same subject"]
        : named > 0 ? [1, `named ${named} times in the cards`]
        : sameShelf && n >= 0 ? [1, "next to it on the timeline"]
        : sameShelf && years > 0 ? [1, `shares ${years} years`]
        : sameShelf ? [2, "same shelf"]
        : [3, "another shelf"];
      return { s, i, group, why, pick, named, n: n < 0 ? neighbourStories.length : n, years };
    })
    .sort((a, b) => a.group - b.group || a.pick - b.pick || +(b.named >= OFTEN) - +(a.named >= OFTEN) || a.n - b.n || b.named - a.named || b.years - a.years || a.i - b.i)
    .map((x) => ({ story: x.s, why: x.why, weak: x.group >= 2 }));
}

/**
 * Problems with the stories' own `next` lists: each must name built stories, other
 * than itself, at most two, once each.
 * @param {Story[]} all every story in manifest.json
 */
export function nextProblems(all) {
  /** @type {string[]} */
  const problems = [];
  const built = new Set(all.filter((s) => s.status === "built").map((s) => s.id));
  for (const s of all) {
    if (s.next === undefined) continue;
    const where = `story ${s.id}: next`;
    if (!Array.isArray(s.next) || !s.next.length || s.next.length > 2) {
      problems.push(`${where} must list one or two story ids`);
      continue;
    }
    if (new Set(s.next).size !== s.next.length) problems.push(`${where} lists a story twice`);
    for (const id of s.next) {
      if (id === s.id) problems.push(`${where} lists the story itself`);
      else if (!built.has(id)) problems.push(`${where}: ${id} is not a built story`);
    }
  }
  return problems;
}

/**
 * Everything nextStories needs, read from manifest.json, catalogue.json and each built
 * story. For `pnpm story:check` and the tests; the build has these loaded already.
 */
export function loadNextContext() {
  const manifest = loadManifest();
  const stories = manifest.stories.filter((s) => s.status === "built");
  const X = loadExplore();
  return {
    stories,
    sections: manifest.sections,
    entries: loadCatalogue().entries,
    words: new Map(stories.map((s) => [s.id, storyWords(loadStoryData(s).story)])),
    neighbours: /** @type {any} */ (X.neighbours),
  };
}
