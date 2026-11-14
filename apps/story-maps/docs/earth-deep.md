# The `earth-deep` canvas: design note

Status: proposed, not built. First used by **The Making of Earth** (Earth), then **Life on Earth** (Life). The Big Bang ends as the Earth forms; The Making of Earth starts there.

## The problem

Every map so far is fixed: the `geo` canvas draws today's coastlines, and the `cosmic` canvas draws a sky. Deep time needs land that moves: Rodinia, Pangaea, India crossing the ocean to Asia, ice sheets that come and go.

## The approach: snapshots, not motion

A deep basemap holds a few **eras**. Each era is one picture of the globe at one time: its own land shapes, optional ice and its own labels (Panthalassa, Tethys). Each chapter shows one era, and the map fades from one to the next.

This reuses what the engine already has. Realm pieces are already drawn as `<g data-steps="…">` groups that the player shows and hides by chapter (`player.js`, around line 718). An era is the same idea applied to the ground instead of a realm.

Not doing (over-engineering for a story page):

- Plate-motion simulation, or morphing one coastline into the next.
- Rivers, forests, waves and ships on past eras. They stay on the present-day era only, if at all.
- A new projection. The globe is drawn equirectangular, like `world`.

## Data shape (sketch)

```jsonc
// basemaps/earth-deep.json
{
  "id": "earth-deep",
  "kind": "deep",
  "projection": { "lon0": -180, "lat0": 90, "unitsPerDegree": 5 },
  "size": [1800, 900],
  "sea": { … }, "land": { … },          // default colours, as in world.json
  "eras": [
    { "id": "hadean", "name": "Molten Earth", "sea": { … }, "land": { "shapes": [] } },   // colour overrides, no continents
    { "id": "pangaea", "name": "Pangaea, 250 million years ago",
      "land": { "shapes": [ … ] }, "ice": [ … ], "labels": [ … ] },
    { "id": "today", "name": "Today", "land": { "shapes": [ … ] } }
  ]
}
```

In the story:

- Each step names its era: `"era": "pangaea"`. Validation: every step of an `earth-deep` story names an era that exists, and an `earth-deep` story must use a `deep` basemap (and the reverse).
- Places are given in **that era's** coordinates (where the place was then). A place that appears in two eras, such as India, is two places. That is simple, and it is honest about what the map shows.
- The timeline and the catalogue are unchanged: chapters use `when` in words, and entries use the existing `deep-time` kind.

Page weight: pages are self-contained, so the basemap is inlined into each story page. Keep it to about 8 eras and under about 80 KB (`world.json` is 48 KB for one era). Coastlines are simplified hard; continents should be recognisable, not survey-accurate.

## Content honesty

Reconstructions get less certain the further back they go. Before about 750 million years ago, published maps disagree widely, and before about 3 billion years ago there are no continents to draw with confidence. The map shows that rather than hiding it:

- Recent eras (0 to about 540 million years) are drawn from a published reconstruction.
- Older eras (Rodinia, Snowball Earth) are drawn loosely and labelled as one reconstruction among several. The card says so, as the Science content rule requires.
- The earliest eras show no continents: a molten or ocean world with a few islands.

## Where the coastlines come from

**Not settled. This needs the owner's decision before any data is committed.** The repo is "all rights reserved", so a share-alike licence (CC BY-SA) can't be mixed in. CC BY with attribution in the README is fine, as Natural Earth is now.

| Source | Covers | Licence (as reported, not yet confirmed) | Fit |
| --- | --- | --- | --- |
| PALEOMAP PaleoCoastlines, Scotese (Zenodo 10.5281/zenodo.4297693) | 0 to about 750 million years | Zenodo record says CC BY 4.0, but Scotese's own 2010 licence page limits use to personal, teaching and research | Best fit if CC BY 4.0 is confirmed |
| Müller et al. 2019 plate model (EarthByte) | 0 to about 230 million years | CC BY-SA 4.0 | Ruled out: share-alike |
| Ron Blakey's maps (as seen on Wikipedia) | many eras | Copyrighted, sold commercially | Ruled out |
| Hand-placed Natural Earth continents | any era | Public domain, own work | Fallback: today's continents, simplified and moved by hand to rough past positions. Recognisable for Pangaea, crude for older eras |

The licence wording could not be checked from this session: zenodo.org and gplates.org are outside its network allowlist. To confirm it, either the owner reads the two Zenodo records, or a later session's environment allows `zenodo.org`, which is also needed to download the data.

## Build plan (each its own PR)

1. **Engine:** the `deep` basemap kind, eras, the `era` step field, validation and a fade between eras. Tested with a tiny stub basemap of two eras of rectangles. No real data yet.
2. **Basemap:** `earth-deep.json` from the chosen source, with attribution in `README.md`.
3. **Story: The Making of Earth** (Earth subject), with catalogue `deep-time` entries.
4. **Story: Life on Earth** (Life subject), on the same basemap. Its eras may need one or two more snapshots (for example, the Cambrian).

## Open questions

- The coastline source: see above.
- Whether ice is its own layer (white shapes over land and sea) or just part of an era's land colours. A separate layer is suggested, because Snowball Earth and the ice ages need it and it is cheap.
- The Earth story's chapter list, to settle in step 3. A first idea: formation (4.54 billion years ago) and the Moon-forming impact; first oceans; first continents; the Great Oxidation; Rodinia; Snowball Earth; Pangaea; Pangaea breaking up; India meets Asia and the Himalayas rise; the last ice age; today.
