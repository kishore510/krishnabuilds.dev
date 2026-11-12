import { describe, expect, it } from "vitest";

import { layoutWarnings } from "../scripts/layout.mjs";

const basemap = { id: "test", projection: { lon0: 0, lat0: 30, unitsPerDegree: 20 }, size: [600, 600] };
const place = (at, label = "right", name = "Town") => ({ name, at, glyph: "fort", label });
const story = (places, steps) => ({
  places,
  travellers: {},
  phases: { one: {} },
  routeStyles: {},
  steps: steps || Object.keys(places).map((id) => ({ place: id, phase: "one", title: "A title", camera: { at: places[id].at, width: 10 }, legs: [] })),
});

describe("layoutWarnings", () => {
  it("passes places that are well apart", () => {
    expect(layoutWarnings(story({ a: place([10, 20]), b: place([15, 12]) }), basemap)).toEqual([]);
  });

  it("flags one pin hiding another", () => {
    expect(layoutWarnings(story({ a: place([10, 20], "left"), b: place([10.3, 20], "right") }), basemap).join("\n")).toMatch(/one pin hides the other/);
  });

  it("flags a label over a neighbouring pin, and clears when the label moves", () => {
    expect(layoutWarnings(story({ a: place([10, 20], "right"), b: place([12, 20], "right") }), basemap).join("\n")).toMatch(/place a: its label \(right\) covers the pin of b/);
    expect(layoutWarnings(story({ a: place([10, 20], "left"), b: place([12, 20], "right") }), basemap)).toEqual([]);
  });

  it("flags a label off the map edge, but not a hidden waypoint beyond it", () => {
    const places = { a: place([29.5, 20], "right", "A long place name"), far: { name: "Beyond", at: [-5, 20], hidden: true } };
    const steps = [{ place: "a", phase: "one", title: "T", camera: { at: [29.5, 20], width: 10 }, legs: [{ from: "far", to: "a", traveller: "t", style: "s" }] }];
    const s = { ...story(places, steps), travellers: { t: {} }, routeStyles: { s: {} } };
    expect(layoutWarnings(s, basemap)).toEqual(["place a: its label runs off the map edge; try another label side"]);
  });

  it("flags a chapter whose camera misses its place, and things never used", () => {
    const places = { a: place([10, 20]), b: place([20, 10]) };
    const steps = [{ place: "a", phase: "one", title: "T", camera: { at: [25, 5], width: 10 }, legs: [] }];
    const warnings = layoutWarnings(story(places, steps), basemap).join("\n");
    expect(warnings).toMatch(/step 1: its place a is outside the camera/);
    expect(warnings).toMatch(/place b: not used/);
  });
});
