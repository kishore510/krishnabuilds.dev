import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { APP_DIR, loadManifest, SECTIONS, STATUSES, validateManifest } from "../scripts/manifest.mjs";

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

  it("wants a build time on every built story, and only on those", () => {
    const first = manifest.stories.find((s) => s.status === "built");
    const undated = { ...first, builtAt: undefined };
    const broken = {
      ...manifest,
      stories: [{ ...undated, id: "x-1" }, { ...first, id: "x-2", builtAt: "2026-11-12" }, { ...first, id: "x-3", status: "coming-soon" }],
    };
    const problems = validateManifest(broken).join("\n");
    expect(problems).toContain("story x-1: a built story needs builtAt");
    expect(problems).toContain("story x-2: a built story needs builtAt");
    expect(problems).toContain("story x-3: only a built story has builtAt");
  });

  it("allows a story with no collection", () => {
    const loose = manifest.stories.find((s) => s.collection === undefined);
    expect(loose).toBeDefined();
  });

  it("BACKLOG.md lists every built story under Built, and none of them under Next", () => {
    const [next, built] = readFileSync(`${APP_DIR}BACKLOG.md`, "utf8").split("\n## Built\n");
    for (const story of manifest.stories.filter((s) => s.status === "built")) {
      expect(built, `${story.id} is missing from Built in BACKLOG.md`).toContain(`(\`${story.id}\`)`);
      expect(next, `${story.id} is built but still under Next in BACKLOG.md`).not.toContain(`\`${story.id}\``);
    }
  });
});
