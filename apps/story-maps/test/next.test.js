import { describe, expect, it } from "vitest";

import { loadManifest } from "../scripts/manifest.mjs";
import { loadNextContext, nextProblems, nextStories, storyWords } from "../scripts/next.mjs";

// The end card's "Follow another story" picks are also the first Related links on each
// story's pages, which search engines follow. When one of these fails for a new story,
// run `pnpm story:check <id>` and set "next" in manifest.json (see CLAUDE.md).
const ctx = loadNextContext();
const top = new Map(ctx.stories.map((s) => [s.id, nextStories(s, ctx).slice(0, 2)]));

describe("the end card's next stories", () => {
  it("are never offered only for sharing a shelf, or not even that", () => {
    const weak = [...top].flatMap(([id, picks]) => picks.filter((p) => p.weak).map((p) => `${id} -> ${p.story.id} (${p.why})`));
    expect(weak).toEqual([]);
  });

  it("lead to every built story from at least one other", () => {
    const offered = new Set([...top.values()].flatMap((picks) => picks.map((p) => p.story.id)));
    expect(ctx.stories.map((s) => s.id).filter((id) => !offered.has(id))).toEqual([]);
  });

  it("keep a story on its subject", () => {
    const ids = (/** @type {string} */ id) => top.get(id)?.map((p) => p.story.id);
    expect(ids("moon-missions")).not.toContain("portuguese-empire");
    expect(ctx.stories.find((s) => s.id === ids("moon-missions")?.[0])?.section).toBe("universe");
    expect(ids("marie-curie")).toContain("radioactivity");
    expect(ids("maurya")).toContain("ashoka");
  });

  it("put a story's own next first, in order", () => {
    const moon = ctx.stories.find((s) => s.id === "moon-missions");
    const picks = nextStories({ ...moon, next: ["gandhi", "zero"] }, ctx);
    expect(picks.slice(0, 2).map((p) => p.story.id)).toEqual(["gandhi", "zero"]);
  });
});

describe("nextStories", () => {
  const sections = [
    { id: "a", shelf: "nature", title: "A", blurb: "" },
    { id: "b", shelf: "nature", title: "B", blurb: "" },
    { id: "c", shelf: "science", title: "C", blurb: "" },
  ];
  const story = (id, section, title) => ({ id, section, title, status: "built", era: "x" });
  const stories = [story("one", "a", "One"), story("far", "c", "The Far Empire"), story("near", "b", "Near"), story("two", "a", "Two")];
  const run = (words) => nextStories(stories[0], { stories, sections, entries: [], words: new Map(Object.entries(words)), neighbours: () => ({}) });

  it("ranks the same section, then the same shelf, then other shelves", () => {
    expect(run({}).map((p) => [p.story.id, p.weak])).toEqual([["two", false], ["near", true], ["far", true]]);
  });

  it("counts a story named three times or more as close, even from another shelf", () => {
    expect(run({ one: "The Far Empire. The Far Empire. The Far Empire." })[0].story.id).toBe("far");
    expect(run({ one: "The Far Empire. The Far Empire." })[0].story.id).toBe("two");
  });

  it("reads short names on the same shelf only, and not before another capitalised word", () => {
    const shelf = [story("one", "a", "One"), story("hoysala", "b", "The Hoysala Empire"), story("two", "a", "Two")];
    const go = (text) =>
      nextStories(shelf[0], { stories: shelf, sections, entries: [], words: new Map([["one", text]]), neighbours: () => ({}) })[0].story.id;
    expect(go("Hoysala kings. Hoysala temples. Hoysala art.")).toBe("hoysala");
    expect(go("Hoysala Museum. Hoysala Museum. Hoysala Museum.")).toBe("two");
    expect(run({ one: "Far away. Far, far. Far." })[0].story.id).toBe("two");
  });

  it("reads card text but not the today lines", () => {
    const words = storyWords({ description: "D", steps: [{ title: "T", text: "X", today: "Museum of Y" }], people: { items: [{ name: "P", role: "R", text: "Z" }] } });
    expect(words).toContain("X");
    expect(words).toContain("Z");
    expect(words).not.toContain("Museum of Y");
  });
});

describe("next in manifest.json", () => {
  it("names built stories, one or two, never itself or twice", () => {
    expect(nextProblems(loadManifest().stories)).toEqual([]);
    const s = (id, next, status = "built") => ({ id, section: "a", title: id, status, era: "x", next });
    expect(nextProblems([s("a", ["a"]), s("b", ["c"]), s("c", [], "coming-soon"), s("d", ["a", "a"]), s("e", ["a", "b", "d"])])).toEqual([
      "story a: next lists the story itself",
      "story b: next: c is not a built story",
      "story c: next must list one or two story ids",
      "story d: next lists a story twice",
      "story e: next must list one or two story ids",
    ]);
  });
});
