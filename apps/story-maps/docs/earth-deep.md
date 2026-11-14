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

- Recent eras (0 to 535 million years) are drawn from a published reconstruction (PaleoMAP, below).
- Older eras (Rodinia, Snowball Earth) are drawn loosely and labelled as one reconstruction among several. The card says so, as the Science content rule requires.
- The earliest eras show no continents: a molten or ocean world with a few islands.

## Where the coastlines come from

The repo is "all rights reserved", so a share-alike licence (CC BY-SA) can't be mixed in. CC BY with attribution in the README is fine, as Natural Earth is now.

**Chosen for 0 to 535 million years: PaleoMAP PaleoCoastlines v7.1** (Kocsis and Scotese, 2020; Zenodo, doi:10.5281/zenodo.4297693). Checked 2026-11-14: the Zenodo record and the archive's own `Readme.md` both state **CC BY 4.0**. That newer, dataset-specific licence replaces the restrictive 2010 page on Scotese's personal site. The related PALEOMAP PaleoAtlas (doi:10.5281/zenodo.10596610) is also CC BY 4.0.

- Contents: coastline (`CS`) and continental-margin (`CM`) shapefiles in present-day longitude and latitude for 81 ages, every 5 to 15 million years from 0 to 535 million years ago (for example 0, 20, 50, 65, 90, 150, 200, 250, 300, 400, 535).
- Size: about 40 KB of raw shapefile per age before simplifying.
- Attribution for `README.md`: "Paleocoastlines simplified from PaleoMAP PaleoCoastlines v7.1 by A. T. Kocsis and C. R. Scotese (2020), CC BY 4.0, doi:10.5281/zenodo.4297693. See Kocsis and Scotese, Earth-Science Reviews 2021, doi:10.1016/j.earscirev.2020.103463."
- The archive (89 MB) is not committed. Only the simplified shapes go in the basemap.

**Before 535 million years** (Rodinia, Snowball Earth and older), the dataset has nothing. Those eras are drawn by hand and loosely, each labelled as one reconstruction among several, or shown with no continents at all.

Ruled out:

| Source | Why |
| --- | --- |
| Müller et al. 2019 plate model (EarthByte) | CC BY-SA 4.0: share-alike |
| Ron Blakey's maps (as seen on Wikipedia) | Copyrighted, sold commercially |

## Build plan (each its own PR)

1. **Engine:** the `deep` basemap kind, eras, the `era` step field, validation and a fade between eras. Tested with a tiny stub basemap of two eras of rectangles. No real data yet.
2. **Basemap:** `earth-deep.json` from the chosen source, with attribution in `README.md`.
3. **Story: The Making of Earth** (Earth subject), with catalogue `deep-time` entries.
4. **Story: Life on Earth** (Life subject), on the same basemap. Its eras may need one or two more snapshots (for example, the Cambrian).

## Open questions

- Whether ice is its own layer (white shapes over land and sea) or just part of an era's land colours. A separate layer is suggested, because Snowball Earth and the ice ages need it and it is cheap.
- The Earth story's chapter list, to settle in step 3. A first idea: formation (4.54 billion years ago) and the Moon-forming impact; first oceans; first continents; the Great Oxidation; Rodinia; Snowball Earth; Pangaea; Pangaea breaking up; India meets Asia and the Himalayas rise; the last ice age; today.
