// @ts-check
// Loads the engine (apps/story-maps/engine/src) and a built story's data, for
// the build and the tests. The engine files are classic browser scripts, so
// map.js is run here against a stand-in global to reach its pure functions.

import { existsSync, readFileSync } from "node:fs";

import { APP_DIR, storyDir } from "./manifest.mjs";

/** @typedef {import("./manifest.mjs").Story} Story */

export const ENGINE_DIR = `${APP_DIR}engine/src/`;

/** @param {string} path */
const read = (path) => readFileSync(path, "utf8");
/** @param {string} path */
const readJson = (path) => JSON.parse(read(path));

/**
 * The engine's pure functions (buildMap, validate, ...), run in Node.
 * @returns {Record<string, Function>}
 */
export function loadMapFunctions() {
  /** @type {{ StoryMap?: Record<string, Function> }} */
  const fakeGlobal = {};
  new Function("globalThis", read(`${ENGINE_DIR}map.js`))(fakeGlobal);
  if (!fakeGlobal.StoryMap) throw new Error("engine/src/map.js did not define StoryMap");
  return fakeGlobal.StoryMap;
}

/** The engine's browser parts: CSS, the page markup and the script (map then player). */
export function loadEngineAssets() {
  return {
    css: read(`${ENGINE_DIR}engine.css`),
    html: read(`${ENGINE_DIR}player.html`),
    js: `${read(`${ENGINE_DIR}map.js`)}\n${read(`${ENGINE_DIR}player.js`)}`,
  };
}

/**
 * A built story's data: stories/.../<id>/story.json, its basemap and the shared art.
 * @param {Story} entry
 */
export function loadStoryData(entry) {
  const path = `${APP_DIR}${storyDir(entry)}/story.json`;
  if (!existsSync(path)) throw new Error(`${entry.id} is marked built but ${storyDir(entry)}/story.json is missing`);
  const story = readJson(path);
  const basemapPath = `${APP_DIR}basemaps/${story.basemap}.json`;
  if (!existsSync(basemapPath)) throw new Error(`${entry.id}: basemap ${story.basemap} not found in basemaps/`);
  return { story, basemap: readJson(basemapPath), art: readJson(`${APP_DIR}art/glyphs.json`) };
}

/**
 * Problems with a built story's data; empty when it is usable.
 * @param {Story} entry
 * @param {Record<string, Function>} [map]
 * @returns {string[]}
 */
export function checkStory(entry, map = loadMapFunctions()) {
  const { story, basemap, art } = loadStoryData(entry);
  const problems = map.validate(story, basemap, art);
  if (story.id !== entry.id) problems.unshift(`story.json id ${story.id} does not match manifest id ${entry.id}`);
  if (story.title !== entry.title) problems.unshift(`story.json title does not match manifest title "${entry.title}"`);
  return problems;
}
