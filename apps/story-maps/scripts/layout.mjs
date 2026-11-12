// Layout checks for one story's data: the things a person would otherwise look
// for in a screenshot. Pure arithmetic in map units, mirroring how
// engine/src/map.js draws a pin (disc radius 14, label 10.5px on one of four
// sides). Pins and labels scale with the map, so one pass covers every zoom.
//
// A chapter draws in full only its own place and the ends of its routes
// (placesNow in map.js); every other place is a small dot or not drawn. So
// pins and labels are checked chapter by chapter, among the places that
// chapter shows in full, and a chapter that shows too many is flagged.
//
// These are warnings, not build failures: a label estimate can be a little off,
// and a close pair is sometimes right. Look at the flagged chapters, then decide.

import { loadMapFunctions } from "./engine.mjs";

const { placesNow } = loadMapFunctions();

/** A chapter that shows more full pins than this reads as clutter on a phone. */
export const MAX_PINS_PER_CHAPTER = 5;
const DISC = 14;
const FONT = 10.5;
/** Average glyph width of the heading font, as a share of the font size. */
const CHAR = 0.56;
/** Label anchor offsets, as in map.js: [dx, dy, anchor]. */
const OFFSETS = { right: [19, 4, "start"], left: [-19, 4, "end"], top: [0, -20, "middle"], bottom: [0, 28, "middle"] };
/** Overlaps smaller than this (map units) are ignored. */
const SLACK = 2;
/** The player never shows less than this many map units across a phone (see fit() in player.js). */
export const MIN_CAMERA_UNITS = 390 / 2.2;

export const MAX_TITLE_CHARS = 60;

/** @typedef {{ x0: number, y0: number, x1: number, y1: number }} Box */

/**
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} side
 * @returns {Box}
 */
export function labelBox(text, x, y, side) {
  const [dx, dy, anchor] = /** @type {[number, number, string]} */ (OFFSETS[/** @type {keyof typeof OFFSETS} */ (side)] || OFFSETS.right);
  const w = text.length * FONT * CHAR;
  const left = anchor === "start" ? x + dx : anchor === "end" ? x + dx - w : x + dx - w / 2;
  return { x0: left, y0: y + dy - FONT * 0.8, x1: left + w, y1: y + dy + FONT * 0.25 };
}

/** @param {Box} a @param {Box} b */
const boxesOverlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > SLACK && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > SLACK;

/** @param {Box} box @param {number} cx @param {number} cy @param {number} r */
function boxHitsCircle(box, cx, cy, r) {
  const nx = Math.max(box.x0, Math.min(cx, box.x1));
  const ny = Math.max(box.y0, Math.min(cy, box.y1));
  return Math.hypot(nx - cx, ny - cy) < r - SLACK;
}

/**
 * @param {any} story
 * @param {any} basemap
 * @returns {string[]} warnings; empty when nothing looks wrong.
 */
export function layoutWarnings(story, basemap) {
  const warnings = [];
  const { lon0, lat0, unitsPerDegree: k } = basemap.projection;
  const [W, H] = basemap.size;
  /** @param {[number, number]} at */
  const P = ([lon, lat]) => [(lon - lon0) * k, (lat0 - lat) * k];
  const deg = (/** @type {number} */ units) => `${(units / k).toFixed(2)}°`;

  // Places and their labels.
  const pins = [];
  for (const [id, p] of Object.entries(story.places)) {
    const [x, y] = P(p.at);
    // A hidden place may sit off the map on purpose: a route that arrives from beyond the edge.
    if (p.hidden) continue;
    if (x < 0 || x > W || y < 0 || y > H) warnings.push(`place ${id}: [${p.at}] is off the ${basemap.id} map`);
    const box = labelBox(p.name, x, y, p.label);
    if (box.x0 < 0 || box.x1 > W || box.y0 < 0 || box.y1 > H) warnings.push(`place ${id}: its label runs off the map edge; try another label side`);
    pins.push({ id, x, y, box, side: p.label });
  }
  // Pins and labels that collide in a chapter that shows both in full. A pair
  // is reported once, with the chapters it happens in.
  /** @type {Map<string, Set<number>>} */
  const clashes = new Map();
  const clash = (/** @type {string} */ text, /** @type {number} */ step) => clashes.set(text, (clashes.get(text) || new Set()).add(step + 1));
  const byId = new Map(pins.map((p) => [p.id, p]));
  story.steps.forEach((/** @type {any} */ s, /** @type {number} */ n) => {
    if (!story.places[s.place]) return;
    const shown = placesNow(story, n).map((/** @type {string} */ id) => byId.get(id)).filter(Boolean);
    if (shown.length > MAX_PINS_PER_CHAPTER) {
      warnings.push(`step ${n + 1}: shows ${shown.length} places in full; keep it to ${MAX_PINS_PER_CHAPTER} (split the chapter's routes, or hide a waypoint)`);
    }
    for (let i = 0; i < shown.length; i++) {
      for (let j = i + 1; j < shown.length; j++) {
        const [a, b] = [shown[i], shown[j]];
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        // Neighbouring pins may touch; one sitting on another's centre hides it.
        if (gap < DISC) {
          clash(`places ${a.id} and ${b.id}: one pin hides the other (${deg(gap)} apart; a pin is ${deg(DISC * 2)} wide). Merge them, or hide one and name it in the card`, n);
          continue;
        }
        if (boxesOverlap(a.box, b.box)) clash(`places ${a.id} and ${b.id}: labels overlap (${a.side} and ${b.side}); move one to another side`, n);
        if (boxHitsCircle(a.box, b.x, b.y, DISC)) clash(`place ${a.id}: its label (${a.side}) covers the pin of ${b.id}`, n);
        if (boxHitsCircle(b.box, a.x, a.y, DISC)) clash(`place ${b.id}: its label (${b.side}) covers the pin of ${a.id}`, n);
      }
    }
  });
  for (const [text, at] of clashes) warnings.push(`step ${[...at].join(", ")}: ${text}`);

  // Each chapter's camera should frame its place and both ends of its routes.
  story.steps.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    const where = `step ${i + 1}`;
    if (!s.camera || !story.places[s.place]) return;
    const [cx, cy] = P(s.camera.at);
    const half = Math.max(s.camera.width * k, MIN_CAMERA_UNITS) / 2;
    const inFrame = (/** @type {string} */ id) => {
      const [x, y] = P(story.places[id].at);
      return Math.abs(x - cx) <= half * 0.92 && Math.abs(y - cy) <= half * 0.92;
    };
    if (!inFrame(s.place)) warnings.push(`${where}: its place ${s.place} is outside the camera`);
    for (const leg of s.legs || []) {
      for (const end of [leg.from, leg.to]) {
        if (story.places[end] && !story.places[end].hidden && !inFrame(end)) warnings.push(`${where}: route end ${end} is outside the camera`);
      }
    }
    if ((s.title || "").length > MAX_TITLE_CHARS) warnings.push(`${where}: title is ${s.title.length} characters; keep it under ${MAX_TITLE_CHARS}`);
  });

  // Things defined but never used.
  const usedPlaces = new Set();
  const used = { travellers: new Set(), phases: new Set(), routeStyles: new Set() };
  for (const s of story.steps) {
    usedPlaces.add(s.place);
    used.phases.add(s.phase);
    for (const leg of s.legs || []) {
      usedPlaces.add(leg.from).add(leg.to);
      used.travellers.add(leg.traveller);
      used.routeStyles.add(leg.style);
    }
  }
  for (const e of story.effects || []) usedPlaces.add(e.place);
  for (const id of Object.keys(story.places)) if (!usedPlaces.has(id)) warnings.push(`place ${id}: not used by any step or route`);
  for (const key of /** @type {const} */ (["travellers", "phases", "routeStyles"])) {
    for (const id of Object.keys(story[key] || {})) if (!used[key].has(id)) warnings.push(`${key} ${id}: never used`);
  }

  // Every realm label should sit on the map.
  for (const r of (story.realms && story.realms.items) || []) {
    for (const at of [r.label && r.label.at, ...((r.label && r.label.moves) || []).map((/** @type {any} */ m) => m.at)]) {
      if (!at) continue;
      const [x, y] = P(at);
      if (x < 0 || x > W || y < 0 || y > H) warnings.push(`realm ${r.id}: a label position [${at}] is off the map`);
    }
  }
  return warnings;
}
