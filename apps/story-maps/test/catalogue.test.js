import { describe, expect, it } from "vitest";

import { loadCatalogue, loadExplore, validateCatalogue } from "../scripts/catalogue.mjs";
import { loadManifest } from "../scripts/manifest.mjs";

const catalogue = loadCatalogue();
const { stories } = loadManifest();
const X = loadExplore();
const byId = (id) => catalogue.entries.find((e) => e.id === id);

/** A copy of the catalogue with extra or changed entries. */
function withEntries(...entries) {
  return { ...catalogue, entries: [...catalogue.entries, ...entries] };
}

describe("catalogue.json", () => {
  it("passes every check", () => {
    expect(validateCatalogue(catalogue, stories)).toEqual([]);
  });

  it("links every story in manifest.json from at least one entry", () => {
    const linked = new Set(catalogue.entries.map((e) => e.story).filter(Boolean));
    for (const s of stories) expect(linked).toContain(s.id);
  });

  it("checks people and deep time, and finds the lives that overlap an entry", () => {
    const base = { source: "History", region: "europe", summary: "A test." };
    const problems = validateCatalogue(
      withEntries(
        { ...base, id: "x-life", name: "No dates", kind: "person" },
        { ...base, id: "x-deep", name: "Dated", kind: "deep-time", from: -9000 },
        { ...base, id: "x-when", name: "Stray when", kind: "person", from: 1800, to: 1850, when: "long ago" },
        { ...base, id: "x-found", name: "Spanned", kind: "discovery", from: 1800, to: 1850, lane: "west" },
      ),
      stories,
    ).join("\n");
    expect(problems).toContain("entry x-life: a person needs from and to");
    expect(problems).toContain("entry x-deep: deep time has no years or lane");
    expect(problems).toContain("entry x-deep: deep time needs when");
    expect(problems).toContain("entry x-when: only deep time takes when");
    expect(problems).toContain("entry x-found: a discovery has one year");
    expect(problems).toContain("entry x-found: a discovery has no lane");
    expect(X.rangeText(byId("radioactivity"))).toBe("1896 CE");
    expect(X.rangeText(byId("big-bang"))).toBe("13.8 billion years ago");
    expect(X.lives(byId("british-empire"), catalogue.entries).map((e) => e.id)).toContain("marie-curie");
    expect(X.lives(byId("maurya"), catalogue.entries)).toEqual([]);
  });

  it("catches bad years, lanes, kinds and links", () => {
    const problems = validateCatalogue(
      withEntries(
        { id: "x-zero", name: "Zero", kind: "dynasty", source: "History", region: "india", lane: "north", from: 0, to: 10 },
        { id: "x-back", name: "Backwards", kind: "dynasty", source: "History", region: "india", lane: "north", from: 900, to: 800 },
        { id: "x-lane", name: "Wrong lane", kind: "dynasty", source: "History", region: "india", lane: "china", from: 1, to: 2 },
        { id: "x-kind", name: "Odd kind", kind: "myth", source: "History", region: "india" },
        { id: "x-legend", name: "Dated legend", kind: "legend", source: "History", region: "india", from: -500 },
        { id: "x-event", name: "Long event", kind: "event", source: "History", region: "india", lane: "north", from: 5, to: 9 },
        { id: "x-story", name: "Lost story", kind: "route", source: "History", region: "across", from: 1, to: 2, story: "nowhere" },
        { id: "x-after", name: "Lost successor", kind: "dynasty", source: "History", region: "india", lane: "north", from: 1, to: 2, after: ["nobody"] },
        { id: "x-field", name: "Typo", kind: "dynasty", source: "History", region: "india", lane: "north", from: 1, to: 2, form: 3 },
        { id: "x-nosum", name: "No summary", kind: "legend", source: "Tradition", region: "india" },
        { id: "x-long", name: "Long summary", kind: "legend", source: "Tradition", region: "india", summary: "word ".repeat(61) },
        { id: "x-civ", name: "Undated civilisation", kind: "civilisation", source: "Archaeology", region: "americas", summary: "A test." },
      ),
      stories,
    ).join("\n");
    expect(problems).toContain("entry x-zero: from must be a whole year, not 0");
    expect(problems).toContain("entry x-back: to is before from");
    expect(problems).toContain("entry x-lane: lane china is not a lane of region india");
    expect(problems).toContain("entry x-kind: unknown kind myth");
    expect(problems).toContain("entry x-legend: legends have no dates or lane");
    expect(problems).toContain("entry x-legend: legends are tagged Tradition");
    expect(problems).toContain("entry x-event: an event has one year");
    expect(problems).toContain("entry x-story: unknown story nowhere");
    expect(problems).toContain("entry x-after: after lists unknown entry nobody");
    expect(problems).toContain("entry x-field: unknown field form");
    expect(problems).toContain("entry x-nosum: missing summary");
    expect(problems).toContain("entry x-long: summary is over 60 words");
    expect(problems).toContain("entry x-civ: a civilisation needs from and to");
    expect(problems).toContain("entry x-civ: a civilisation needs a lane");
  });

  it("places every civilisation and dynasty on the atlas, and catches a bad position", () => {
    for (const e of catalogue.entries.filter((x) => X.isSpan(x))) {
      expect(e.at, e.id).toHaveLength(2);
      expect(e.radius, e.id).toBeGreaterThanOrEqual(1);
    }
    const base = { kind: "dynasty", source: "History", region: "india", lane: "north", from: 1, to: 2, summary: "A test." };
    const problems = validateCatalogue(
      withEntries(
        { ...base, id: "x-nowhere", name: "Nowhere" },
        { ...base, id: "x-far", name: "Too far", at: [200, 10], radius: 3 },
        { ...base, id: "x-huge", name: "Too big", at: [80, 20], radius: 40 },
      ),
      stories,
    ).join("\n");
    expect(problems).toContain("entry x-nowhere: a dynasty needs at and radius for the atlas");
    expect(problems).toContain("entry x-far: at must be [longitude, latitude]");
    expect(problems).toContain("entry x-huge: radius must be 1 to 15 degrees");
  });

  it("catches a duplicate id and a story no entry links to", () => {
    const problems = validateCatalogue(withEntries({ ...byId("gupta") }), [...stories, { id: "unlinked" }]).join("\n");
    expect(problems).toContain("entry gupta: duplicate id");
    expect(problems).toContain("story unlinked is in manifest.json but no catalogue entry links to it");
  });

  it("lets only one entry link to a whole story; the rest name a chapter", () => {
    const legend = { kind: "legend", source: "Tradition", region: "india", summary: "A test." };
    const problems = validateCatalogue(
      withEntries(
        { ...legend, id: "x-second", name: "Second", story: "mahabharata" },
        { ...legend, id: "x-zero", name: "Zero", story: "mahabharata", chapter: 0 },
        { ...legend, id: "x-nostory", name: "No story", chapter: 3 },
        { ...legend, id: "x-part", name: "Part", story: "mahabharata", chapter: 5 },
      ),
      stories,
    ).join("\n");
    expect(problems).toContain("entry x-second: mahabharata already links to story mahabharata; give one of them a chapter");
    expect(problems).toContain("entry x-zero: chapter must be a whole number from 1, with a story");
    expect(problems).toContain("entry x-nostory: chapter must be a whole number from 1, with a story");
    expect(problems).not.toContain("x-part");
  });
});

describe("hub/explore.js", () => {
  it("writes dates the way the cards do", () => {
    expect(X.rangeText(byId("maurya"))).toBe("c. 322 – c. 185 BCE");
    expect(X.rangeText(byId("satavahana"))).toBe("c. 100 BCE – c. 220 CE");
    expect(X.rangeText(byId("mughal"))).toBe("1526 – 1857 CE");
    expect(X.rangeText(byId("partition"))).toBe("1947 CE");
    expect(X.rangeText(byId("ramayana"))).toBe("Tradition");
    expect(X.lengthText(byId("maurya"))).toBe("about 140 years");
    expect(X.lengthText({ kind: "dynasty", from: -27, to: 476 })).toBe("500 years");
    expect(X.lengthText({ kind: "dynasty", from: -10, to: 10 })).toBe("19 years");
  });

  it("finds named and unnamed neighbours", () => {
    const named = X.neighbours(byId("maurya"), catalogue.entries);
    expect(named.before.id).toBe("nanda");
    expect(named.after.id).toBe("shunga");
    // No `after` on Gupta, so the next dynasty in the lane is used.
    expect(X.neighbours(byId("gupta"), catalogue.entries).after.id).toBe("harsha");
  });

  it("lists who ruled elsewhere at the same time, longest overlap first", () => {
    const list = X.meanwhile(byId("chola"), catalogue.entries, 8);
    expect(list.length).toBeGreaterThan(3);
    for (const m of list) {
      expect(m.entry.lane).not.toBe("south");
      expect(m.entry.from).toBeLessThanOrEqual(1279);
      expect(m.entry.to).toBeGreaterThanOrEqual(848);
    }
    const years = list.map((m) => m.years);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });

  it("treats civilisations like dynasties on the timeline", () => {
    expect(X.isSpan(byId("indus"))).toBe(true);
    expect(X.isSpan(byId("maurya"))).toBe(true);
    expect(X.isSpan(byId("partition"))).toBe(false);
    expect(X.isSpan(byId("ramayana"))).toBe(false);
    // The Indus cities were trading with Sumer and Akkad.
    const ids = X.meanwhile(byId("indus"), catalogue.entries, 20).map((m) => m.entry.id);
    expect(ids).toContain("sumer");
    expect(ids).toContain("pharaonic-egypt");
    expect(X.laneMates(byId("vedic"), catalogue.entries).map((e) => e.id)).toContain("indus");
  });

  it("covers every dated lane entry in the timeline bounds", () => {
    const { start, end } = X.bounds(catalogue.entries);
    expect(Number.isInteger(start / 100)).toBe(true);
    for (const e of catalogue.entries.filter((x) => x.lane)) {
      expect(e.from).toBeGreaterThanOrEqual(start);
      expect(X.endOf(e)).toBeLessThanOrEqual(end);
    }
  });

  it("packs every lane so no two blocks in a slot overlap", () => {
    for (const region of catalogue.regions) {
      for (const lane of region.lanes) {
        const dyn = catalogue.entries.filter((e) => e.lane === lane.id && X.isSpan(e));
        const { items, slots } = X.pack(dyn, { s: 0.45, start: -3300, pad: 26, minH: 30, tol: 30 });
        expect(items).toHaveLength(dyn.length);
        for (let k = 0; k < slots; k++) {
          const inSlot = items.filter((it) => it.k === k).sort((a, b) => a.top - b.top);
          for (let i = 1; i < inSlot.length; i++) {
            expect(inSlot[i].top).toBeGreaterThanOrEqual(inSlot[i - 1].top + inSlot[i - 1].h);
          }
        }
        // Keep the sample lanes readable on a phone: at most two side by side.
        expect(slots, lane.id).toBeLessThanOrEqual(2);
      }
    }
  });
});
