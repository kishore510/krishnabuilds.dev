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

  it("hides realm details only on a collapsed phone sheet, never in the desktop side panel", () => {
    // The side panel (900px and up) never gets .open, so a collapsed-sheet rule
    // outside the phone media query would hide the details on laptops.
    const css = engineSource[2];
    const phone = css.match(/@media \(max-width: 899\.98px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(phone).toContain(".sm-sheet:not(.open) .sm-realm-details");
    expect(css.replace(phone, "")).not.toMatch(/:not\(\.open\) \.sm-realm/);
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

  it("catches bad people cards", () => {
    const withPeople = built.find((s) => loadStoryData(s).story.people);
    expect(withPeople).toBeDefined();
    const { story, basemap, art } = structuredClone(loadStoryData(/** @type {any} */ (withPeople)));
    story.people.items[0].steps = [story.steps.length];
    story.people.items[1].text = Array(61).fill("word").join(" ");
    story.people.items[2].id = story.people.items[3].id;
    const problems = map.validate(story, basemap, art).join("\n");
    expect(problems).toContain("steps out of range");
    expect(problems).toContain("61 words");
    expect(problems).toContain("duplicate id");
  });

  it("catches bad realm pieces", () => {
    const withRealms = built.find((s) => loadStoryData(s).story.realms);
    const { story, basemap, art } = structuredClone(loadStoryData(/** @type {any} */ (withRealms)));
    const last = story.steps.length - 1;
    const [a, b, c] = story.realms.items;
    a.pieces = [{ steps: [[0, last + 1]], areas: [{ at: [80, 20], radius: 1 }] }];
    b.pieces = [{ steps: [[0, 1]], areas: [[[80, 20], [81, 21]]] }];
    c.pieces = [{ steps: [[0, 1]], areas: [{ at: [80, 20], radius: 0 }] }];
    delete a.area;
    delete b.area;
    const problems = map.validate(story, basemap, art).join("\n");
    expect(problems).toContain(`realm ${a.id}: a piece's steps must be [from, to] ranges`);
    expect(problems).toContain(`realm ${b.id}: an area must be`);
    expect(problems).toContain(`realm ${c.id}: give either area or pieces`);
    expect(problems).toContain(`realm ${c.id}: an area must be`);
  });

  it("catches bad label moves, route modes and language tags", () => {
    const { story, basemap, art } = fresh();
    story.routes = "trail";
    story.nativeLang = "Hindi";
    if (story.realms) story.realms.items[0].label.moves = [{ from: 0, at: [80, 20] }];
    const problems = map.validate(story, basemap, art).join("\n");
    expect(problems).toContain("routes must be journey or chapter");
    expect(problems).toContain("nativeLang Hindi is not a language tag");
    if (story.realms) expect(problems).toContain("label moves must be in step order");
  });
});

describe("buildMap", () => {
  const entry = built[0];

  it("draws realm pieces with their steps, dots as circles, and moving labels", () => {
    const { story, basemap, art } = structuredClone(loadStoryData(entry));
    const last = story.steps.length - 1;
    story.realms = {
      toggle: "Powers",
      mainHeading: "Powers",
      minorHeading: "Others",
      items: [
        {
          id: "test",
          name: "Test realm",
          color: "#d9432a",
          active: [[0, last]],
          label: { text: "Test", at: [80, 20], moves: [{ from: 2, at: [82, 22] }] },
          pieces: [
            { steps: [[0, 1], [3, 4]], areas: [[[78, 18], [82, 18], [80, 22]], { at: [85, 15], radius: 1 }] },
            { steps: [[2, last]], areas: [{ at: [86, 16], radius: 0.5 }] },
          ],
          facts: {},
          rulers: [],
          role: "A test.",
          ties: [],
        },
      ],
    };
    expect(map.validate(story, basemap, art)).toEqual([]);
    const { svg } = map.buildMap(story, basemap, art);
    expect(svg).toContain('class="sm-realm-piece" data-steps="0-1,3-4"');
    expect(svg).toContain(`class="sm-realm-piece" data-steps="2-${last}"`);
    expect(svg).toMatch(/<circle class="sm-realm-shape sm-realm-dot"[^>]* r="10"/); // 0.5 degrees at 20 units per degree
    expect(svg).toContain('data-steps="0-1" x=');
    expect(svg).toContain(`data-steps="2-${last}" x=`);
  });

  it("cuts holes in land with the even-odd rule", () => {
    const { story, basemap, art } = structuredClone(loadStoryData(entry));
    basemap.land.shapes[0].holes = [[[80, 20], [81, 20], [80.5, 21]]];
    const { svg } = map.buildMap(story, basemap, art);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('clip-rule="evenodd"');
  });
});
