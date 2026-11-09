// @ts-check
// Reads and checks catalogue.json: the regions, lanes and entries (dynasties,
// events, legends, routes) behind the hub's timeline, Browse and the
// /explore/<id>/ pages. Used by the build (which stops on any problem) and by
// test/catalogue.test.js. Also runs hub/explore.js in Node for its pure functions.

import { readFileSync } from "node:fs";

import { APP_DIR } from "./manifest.mjs";

/**
 * @typedef {{ id: string, title: string }} Lane
 * @typedef {{ id: string, title: string, short: string, hue: string, lanes: Lane[] }} Region
 * @typedef {{
 *   id: string, name: string, kind: string, source: string, region: string, lane?: string,
 *   from?: number, to?: number, approx?: boolean, story?: string, after?: string[],
 *   native?: string, lang?: string, note?: string, added?: string
 * }} Entry
 * @typedef {{ regions: Region[], entries: Entry[] }} Catalogue
 */

export const KINDS = ["dynasty", "event", "legend", "route"];
export const SOURCES = ["History", "Archaeology", "Tradition"];
// Region colours; each has light and dark values in src/theme.css (--sm-hue-<name>).
export const HUES = ["saffron", "lapis", "jade", "ochre", "plum"];
const FIELDS = new Set([
  "id", "name", "kind", "source", "region", "lane", "from", "to", "approx",
  "story", "after", "native", "lang", "note", "added",
]);
const SLUG = /^[a-z][a-z0-9-]{0,39}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE_WORDS = 30;

/** @returns {Catalogue} */
export function loadCatalogue() {
  return JSON.parse(readFileSync(`${APP_DIR}catalogue.json`, "utf8"));
}

/** hub/explore.js, run in Node against a stand-in global. @returns {Record<string, Function>} */
export function loadExplore() {
  /** @type {{ Explore?: Record<string, Function> }} */
  const fakeGlobal = {};
  new Function("globalThis", readFileSync(`${APP_DIR}hub/explore.js`, "utf8"))(fakeGlobal);
  if (!fakeGlobal.Explore) throw new Error("hub/explore.js did not define Explore");
  return fakeGlobal.Explore;
}

/** @param {unknown} y */
const isYear = (y) => Number.isInteger(y) && y !== 0 && /** @type {number} */ (y) >= -10000 && /** @type {number} */ (y) <= 2100;

/**
 * @param {Catalogue} catalogue
 * @param {{ id: string }[]} stories every story in manifest.json
 * @returns {string[]} problems found; empty when the catalogue is valid
 */
export function validateCatalogue(catalogue, stories) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, Region>} */
  const regions = new Map();
  /** @type {Map<string, string>} lane id to region id */
  const lanes = new Map();
  for (const r of catalogue.regions) {
    if (!SLUG.test(r.id)) problems.push(`region ${r.id}: id must be a lowercase slug`);
    if (regions.has(r.id)) problems.push(`region ${r.id}: duplicate id`);
    regions.set(r.id, r);
    if (!r.title?.trim() || !r.short?.trim()) problems.push(`region ${r.id}: needs a title and a short title`);
    if (!HUES.includes(r.hue)) problems.push(`region ${r.id}: hue must be one of ${HUES.join(", ")}`);
    for (const l of r.lanes) {
      if (!SLUG.test(l.id)) problems.push(`lane ${l.id}: id must be a lowercase slug`);
      if (lanes.has(l.id)) problems.push(`lane ${l.id}: duplicate id`);
      if (!l.title?.trim()) problems.push(`lane ${l.id}: missing title`);
      lanes.set(l.id, r.id);
    }
  }

  const storyIds = new Set(stories.map((s) => s.id));
  const ids = new Set(catalogue.entries.map((e) => e.id));
  const seen = new Set();
  const used = new Set();
  for (const e of catalogue.entries) {
    const where = `entry ${e.id}`;
    for (const key of Object.keys(e)) if (!FIELDS.has(key)) problems.push(`${where}: unknown field ${key}`);
    if (!SLUG.test(e.id)) problems.push(`${where}: id must be a lowercase slug`);
    if (seen.has(e.id)) problems.push(`${where}: duplicate id`);
    seen.add(e.id);
    if (!e.name?.trim()) problems.push(`${where}: missing name`);
    if (!KINDS.includes(e.kind)) problems.push(`${where}: unknown kind ${e.kind}`);
    if (!SOURCES.includes(e.source)) problems.push(`${where}: source must be ${SOURCES.join(", ")}`);
    if (!regions.has(e.region)) problems.push(`${where}: unknown region ${e.region}`);
    if (e.lane !== undefined && lanes.get(e.lane) !== e.region) {
      problems.push(`${where}: lane ${e.lane} is not a lane of region ${e.region}`);
    }

    const hasFrom = e.from !== undefined;
    const hasTo = e.to !== undefined;
    if (hasFrom && !isYear(e.from)) problems.push(`${where}: from must be a whole year, not 0 (1 BCE is -1)`);
    if (hasTo && !isYear(e.to)) problems.push(`${where}: to must be a whole year, not 0 (1 BCE is -1)`);
    if (e.kind === "dynasty" || e.kind === "route") {
      if (!hasFrom || !hasTo) problems.push(`${where}: a ${e.kind} needs from and to`);
      else if (/** @type {number} */ (e.to) < /** @type {number} */ (e.from)) problems.push(`${where}: to is before from`);
    }
    if (e.kind === "dynasty" || e.kind === "event") {
      if (e.lane === undefined) problems.push(`${where}: a ${e.kind} needs a lane`);
    }
    if (e.kind === "event") {
      if (!hasFrom) problems.push(`${where}: an event needs from`);
      if (hasTo) problems.push(`${where}: an event has one year, from; leave out to`);
    }
    if (e.kind === "legend") {
      if (hasFrom || hasTo || e.lane !== undefined) problems.push(`${where}: legends have no dates or lane`);
      if (e.source !== "Tradition") problems.push(`${where}: legends are tagged Tradition`);
    }
    if (e.approx !== undefined && typeof e.approx !== "boolean") problems.push(`${where}: approx must be true or false`);

    if (e.story !== undefined) {
      if (!storyIds.has(e.story)) problems.push(`${where}: unknown story ${e.story}`);
      used.add(e.story);
    }
    for (const next of e.after ?? []) {
      const n = catalogue.entries.find((x) => x.id === next);
      if (!ids.has(next)) problems.push(`${where}: after lists unknown entry ${next}`);
      else if (n && hasFrom && n.from !== undefined && n.from < /** @type {number} */ (e.from)) {
        problems.push(`${where}: ${next} is listed after it but starts earlier`);
      }
    }
    if (e.native !== undefined && !e.native.trim()) problems.push(`${where}: native is empty`);
    if (e.note !== undefined && e.note.trim().split(/\s+/).length > MAX_NOTE_WORDS) {
      problems.push(`${where}: note is over ${MAX_NOTE_WORDS} words`);
    }
    if (e.added !== undefined && !DAY.test(e.added)) problems.push(`${where}: added must be YYYY-MM-DD`);
  }
  for (const s of stories) {
    if (!used.has(s.id)) problems.push(`story ${s.id} is in manifest.json but no catalogue entry links to it`);
  }
  return problems;
}
