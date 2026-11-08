// @ts-check
// Reads and checks manifest.json. Used by the build (which stops on any
// problem) and by test/manifest.test.js.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{ id: string, title: string, blurb: string }} Section
 * @typedef {{ id: string, section: string, title: string }} Collection
 * @typedef {{ id: string, section: string, collection?: string, title: string, status: string, era: string }} Story
 * @typedef {{ sections: Section[], collections: Collection[], stories: Story[] }} Manifest
 */

export const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
export const SECTIONS = ["legends", "chronicles", "deep-time"];
export const STATUSES = ["built", "coming-soon"];

// Story ids become page paths (/<id>/), so keep them to plain slugs.
const SLUG = /^[a-z][a-z0-9-]{0,39}$/;

/** @returns {Manifest} */
export function loadManifest() {
  return JSON.parse(readFileSync(`${APP_DIR}manifest.json`, "utf8"));
}

/**
 * Folder that holds a story's data: stories/<section>/[<collection>/]<id>.
 * @param {Story} story
 */
export function storyDir(story) {
  const parts = ["stories", story.section, story.collection, story.id];
  return parts.filter(Boolean).join("/");
}

/**
 * @param {Manifest} manifest
 * @returns {string[]} problems found; empty when the manifest is valid
 */
export function validateManifest(manifest) {
  /** @type {string[]} */
  const problems = [];
  const sectionIds = manifest.sections.map((s) => s.id);
  if (sectionIds.join() !== SECTIONS.join()) {
    problems.push(`sections must be exactly ${SECTIONS.join(", ")} in that order`);
  }
  const collections = new Map(manifest.collections.map((c) => [c.id, c]));
  if (collections.size !== manifest.collections.length) {
    problems.push("collection ids must be unique");
  }
  for (const c of manifest.collections) {
    if (!SECTIONS.includes(c.section)) problems.push(`collection ${c.id}: unknown section ${c.section}`);
  }

  const seen = new Set();
  for (const story of manifest.stories) {
    const where = `story ${story.id}`;
    if (!SLUG.test(story.id)) problems.push(`${where}: id must be a lowercase slug`);
    if (seen.has(story.id)) problems.push(`${where}: duplicate id`);
    seen.add(story.id);
    if (!SECTIONS.includes(story.section)) problems.push(`${where}: unknown section ${story.section}`);
    if (!STATUSES.includes(story.status)) problems.push(`${where}: unknown status ${story.status}`);
    if (!story.title?.trim()) problems.push(`${where}: missing title`);
    if (!story.era?.trim()) problems.push(`${where}: missing era`);
    if (story.collection !== undefined) {
      const c = collections.get(story.collection);
      if (!c) problems.push(`${where}: unknown collection ${story.collection}`);
      else if (c.section !== story.section) {
        problems.push(`${where}: collection ${c.id} belongs to ${c.section}, not ${story.section}`);
      }
    }
    if (!existsSync(`${APP_DIR}${storyDir(story)}`)) {
      problems.push(`${where}: folder ${storyDir(story)} is missing`);
    }
  }
  return problems;
}
