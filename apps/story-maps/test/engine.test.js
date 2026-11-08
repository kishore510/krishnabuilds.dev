import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { checkStory, ENGINE_DIR, loadMapFunctions, loadStoryData } from "../scripts/engine.mjs";
import { loadManifest } from "../scripts/manifest.mjs";

const map = loadMapFunctions();
const built = loadManifest().stories.filter((s) => s.status === "built");
const engineSource = ["map.js", "player.js", "engine.css", "player.html"].map((f) => readFileSync(`${ENGINE_DIR}${f}`, "utf8"));

describe("built stories", () => {
  it("there is at least one", () => {
    expect(built.length).toBeGreaterThan(0);
  });

  it.each(built.map((s) => [s.id, s]))("%s: data passes every check", (_id, entry) => {
    expect(checkStory(entry, map)).toEqual([]);
  });

  it.each(built.map((s) => [s.id, s]))("%s: map follows the performance rules", (_id, entry) => {
    const { story, basemap, art } = loadStoryData(entry);
    const { svg, legs } = map.buildMap(story, basemap, art);
    expect(svg).not.toMatch(/<mask|<filter|feGaussianBlur|<animate/i);
    expect(legs.length).toBe(story.steps.reduce((n, s) => n + s.legs.length, 0));
    const trees = (basemap.forests?.clusters ?? []).reduce((n, c) => n + c.count, 0);
    expect(trees).toBeLessThanOrEqual(100);
    expect(basemap.waves.count).toBeLessThanOrEqual(100);
  });
});

describe("engine source", () => {
  it("has no infinite animations", () => {
    const css = engineSource[2];
    const animations = css.match(/animation:[^;]+;/g) ?? [];
    expect(animations.length).toBeGreaterThan(0);
    for (const a of animations.filter((x) => x !== "animation: none;")) expect(a).toMatch(/\s\d+;$/); // an explicit iteration count
    expect(css).not.toMatch(/animation[^;]*infinite/);
  });

  it("makes no network requests and uses no storage", () => {
    for (const src of engineSource) {
      expect(src).not.toMatch(/https?:\/\//);
      expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/);
    }
  });
});

describe("validate", () => {
  const entry = built[0];

  /** A fresh copy of the first built story's data, to break on purpose. */
  const fresh = () => structuredClone(loadStoryData(entry));

  it("catches a leg to an unknown place", () => {
    const { story, basemap, art } = fresh();
    story.steps[2].legs[0].to = "atlantis";
    expect(map.validate(story, basemap, art).join("\n")).toContain("unknown place");
  });

  it("catches a card over 60 words", () => {
    const { story, basemap, art } = fresh();
    story.steps[0].text = Array(61).fill("word").join(" ");
    expect(map.validate(story, basemap, art).join("\n")).toContain("61 words");
  });

  it("catches an unknown canvas, source and glyph", () => {
    const { story, basemap, art } = fresh();
    story.canvas = "flat";
    story.source = "Legend";
    story.places[story.steps[0].place].glyph = "dragon";
    const problems = map.validate(story, basemap, art).join("\n");
    expect(problems).toContain("canvas must be one of");
    expect(problems).toContain("source must be");
    expect(problems).toContain("unknown glyph dragon");
  });

  it("catches a timeline that goes backwards", () => {
    const { story, basemap, art } = fresh();
    story.steps[3].at = story.steps[2].at - 1;
    expect(map.validate(story, basemap, art).join("\n")).toContain("step 4: timeline position");
  });
});
