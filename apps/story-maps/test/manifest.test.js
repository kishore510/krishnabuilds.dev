import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { APP_DIR, loadManifest, SHELVES, STATUSES, validateManifest } from "../scripts/manifest.mjs";

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
    const sections = manifest.sections.map((s) => s.id);
    for (const section of manifest.sections) expect(SHELVES).toContain(section.shelf);
    for (const story of manifest.stories) {
      expect(sections).toContain(story.section);
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

  it("needs a finished time on every built story, and only on a known format", () => {
    const first = manifest.stories.find((s) => s.status === "built");
    const coming = manifest.stories.find((s) => s.status === "coming-soon");
    const broken = {
      ...manifest,
      stories: [
        ...manifest.stories,
        { ...first, id: "x-undated", added: undefined },
        { ...first, id: "x-baddate", added: "12 Nov 2026" },
        { ...coming, id: "x-placeholder", added: undefined },
      ],
    };
    const problems = validateManifest(broken).join("\n");
    expect(problems).toContain("story x-undated: a built story needs added");
    expect(problems).toContain("story x-baddate: a built story needs added");
    expect(problems).not.toContain("x-placeholder: a built story needs added");
  });

  it("keeps story ids off subject pages and the site's own paths", () => {
    const first = manifest.stories[0];
    const broken = { ...manifest, stories: [...manifest.stories, { ...first, id: "lives" }, { ...first, id: "explore" }] };
    const problems = validateManifest(broken).join("\n");
    expect(problems).toContain("story lives: id clashes with the subject page /lives/");
    expect(problems).toContain("explore: id is a reserved path");
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
