import { describe, expect, it } from "vitest";

import { loadManifest, SECTIONS, STATUSES, validateManifest } from "../scripts/manifest.mjs";

const manifest = loadManifest();

describe("manifest.json", () => {
  it("passes every check", () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it("has unique story ids", () => {
    const ids = manifest.stories.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only known sections and statuses", () => {
    for (const story of manifest.stories) {
      expect(SECTIONS).toContain(story.section);
      expect(STATUSES).toContain(story.status);
    }
  });

  it("catches a duplicate id, a bad section and a bad status", () => {
    const first = manifest.stories[0];
    const broken = {
      ...manifest,
      stories: [...manifest.stories, { ...first }, { ...first, id: "x-1", section: "myths", status: "done" }],
    };
    const problems = validateManifest(broken).join("\n");
    expect(problems).toContain(`story ${first.id}: duplicate id`);
    expect(problems).toContain("story x-1: unknown section myths");
    expect(problems).toContain("story x-1: unknown status done");
  });

  it("allows a story with no collection", () => {
    const loose = manifest.stories.find((s) => s.collection === undefined);
    expect(loose).toBeDefined();
  });
});
