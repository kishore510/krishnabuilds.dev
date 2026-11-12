# CLAUDE.md: Story Maps

Illustrated, data-driven story maps at `story-maps.krishnabuilds.dev`: a hub page plus one page per story. Follows the root `CLAUDE.md`; this file only adds what is specific to Story Maps.

Story Maps "stories" are not the Portal's `/stories/<slug>` pages (the Portal's write-ups about each app). In this folder, "story" always means a map in `manifest.json`.

## What this is

A static site with a small Node build step and no backend. Every page is a single self-contained HTML file with inline `<style>` and `<script>`: `scripts/build.mjs` inlines the shared tokens CSS, `src/theme.css` and the `kb-theme` pre-paint script (`src/prepaint.js`) into each page.

**One deliberate exception: fonts.** Yatra One and Tiro Devanagari Hindi are self-hosted as same-origin woff2 files in `dist/fonts/` (Latin and Devanagari subsets only, `unicode-range`, `font-display: swap`, with a serif fallback stack). Inlining them would add hundreds of KB to every page; as separate files the browser caches them across pages. No external font or asset requests, ever. Their SIL OFL licences are in `licences/` and ship next to the files.

## Commands

From the repo root: `pnpm turbo run build lint typecheck test --filter=@krishnabuilds/story-maps`. Output goes to `apps/story-maps/dist/`; preview with `python3 -m http.server 8080 -d dist` from `apps/story-maps` (that server has no 404 page; Cloudflare serves `dist/404.html` for unknown paths).

`BACKLOG.md` lists what to build next, in order, and what is built; the skill and a test keep it current.

Adding a story: use the `new-story-map` skill (`.claude/skills/new-story-map/SKILL.md` at the repo root). It needs no engine or hub code read. From `apps/story-maps`:

- `pnpm story:ref` prints what a story's data may refer to: basemap extents, glyph and traveller ids, lanes, taken ids.
- `pnpm story:check <id>` runs the build's data checks on one story, plus layout warnings (`scripts/layout.mjs`): in each chapter, pins hiding each other, labels over pins and more than 5 places shown in full; labels off the map, cameras that miss their place, unused data. Warnings don't fail the build; older stories carry some.
- `pnpm story:shots <id> [steps]` saves phone screenshots of chosen chapters to `.work/<id>/` (ignored by git). It needs Playwright, which is not a dependency here; Claude Code cloud sessions have it.

## Layout

```
manifest.json      sections, collections and every story
catalogue.json     regions, timeline lanes and entries (civilisations, dynasties, events, legends, routes) for the hub and /explore/<id>/
stories/           one folder per story: stories/<section>/[<collection>/]<id>/; a built story has story.json there
basemaps/          shared maps: south-asia.json, world.json, near-east.json, mesoamerica.json (coastlines, rivers, ranges, forests, labels)
art/glyphs.json    shared hand-drawn SVG: place glyphs, traveller icons, compass, lamp
hub/page.html      the shell every page is rendered into
hub/explore.js     pure catalogue functions (dates, neighbours, meanwhile, timeline packing), run by the build and the hub
hub/hub.js         the hub in the browser: story cards, Atlas, Timeline and Browse
hub/progress.js    story pages only: remembers the last chapter read (the engine itself stores nothing)
hub/tour.js        the guided tour on the hub and story pages, and the button that reopens it; remembers that it has been shown (`sm-tour`)
hub/tour.css       styles for the tour
hub/explore.css    styles for the hub and entry pages
src/theme-picker.js Parchment / Night / Auto picker; test/prepaint.test.js fails if it writes a different cookie from packages/ui
src/theme.css      painted theme (saffron, lapis, gold), light and dark
src/prepaint.js    kb-theme pre-paint script; test/prepaint.test.js fails if it drifts from packages/ui/src/theme.ts
public/            favicon and apple-touch icon, copied as-is
licences/          OFL texts for the fonts
engine/src/        @krishnabuilds/story-maps-engine: map.js (pure: data to SVG, validate), player.js (browser), engine.css, player.html
scripts/build.mjs  the build; stops on any manifest, catalogue or story data problem
scripts/layout.mjs layout warnings for a story's data; scripts/story-*.mjs are the three commands above
```

## Catalogue

`catalogue.json` drives the hub's Atlas, Timeline and Browse and the `/explore/<id>/` entry pages. Stories stay in `manifest.json`; entries link to them with `story`, and every story must be linked from at least one entry (the build checks).

- `regions`: `id`, `title`, `short`, `hue` (saffron, lapis, jade, ochre, plum or rose; colours in `src/theme.css`) and `lanes` (`id`, `title`), the timeline's columns. A region with no lanes (Across regions) is in Browse only.
- `entries`: `id` (slug; page path `/explore/<id>/`), `name`, `summary`, `kind` (`civilisation`, `dynasty`, `event`, `legend`, `route`), `source` (History, Archaeology or Tradition), `region`, and for the timeline `lane`, `from` and `to` (whole years, negative for BCE, never 0; an event has only `from`). Optional: `approx` (show "c."), `story`, `chapter`, `after` (named successors), `native` and `lang`, `note` (30 words at most), `added` (YYYY-MM-DD, when the entry was added; a record only, it doesn't make the entry "New").
- **One entry per story, the rest by chapter.** Only one entry may link to a story without a `chapter`: the entry the story is about, and its `name` should match the story's title closely enough to be recognised. Any other entry covered by that story (an event, a book, a later dynasty) sets `chapter` (1-based, as in the story's address `#n`) and is shown as "Part of <story>", opening at that chapter. The build fails on a second entry without a chapter, or a chapter the story doesn't have.
- **Every entry needs a `summary`** (the build fails without one), including every new entry and every story added from now on: a short paragraph on what made it unique, its most iconic figures and its biggest achievements, in about 50 to 60 words and never more than 60. It follows the content rules: label tradition as tradition, give disputed figures as disputed estimates, native terms in brackets after the English. See `maurya` for the model.
- **Atlas**: every civilisation and dynasty also needs `at` (`[lon, lat]`, its heartland) and `radius` (its rough reach in degrees, 1 to 15); the build fails without them. The atlas draws a circle there in the years between `from` and `to`. It is a marker, never a border: keep it on the heartland, and for an overseas empire on the home country. The atlas and the story cards draw the `world` basemap's coastlines.
- Kinds: `civilisation` for a culture known mainly as a whole, often from archaeology (Indus, Sumer, Maya, Minoan Crete), and `dynasty` for a dynasty, kingdom or empire (Maurya, Ming, Spanish Empire). Both need `from`, `to` and a lane, and both fill the timeline. Browse labels them Civilisations and Dynasties & empires. Don't split dynasties from empires: most entries are both.
- Legends have no dates or lane, so they are in Browse only.
- The same content rules apply: never invent a date. Where sources disagree, give the usual range, set `approx` and say so in `note`.
- Keep lanes readable: the tests fail if a lane needs more than two entries side by side. Split a lane before that happens.

## Sections

- **Legends**: epics and sacred stories, placed where tradition puts them. Grouped into collections (`indian` so far).
- **Chronicles**: civilisations, empires and routes, from archaeology and the historical record (ancient and modern). No collections.
- **Deep Time**: the Earth and the sky before people. Empty for now.

`manifest.json` story fields: `id` (lowercase slug, unique across all sections; also the page path `/<id>/`), `section`, optional `collection`, `title`, `status` (`built` or `coming-soon`), `era` (a broad tag such as "Epic tradition" or "Bronze Age", never a made-up date). A `built` story also needs `added`: when its map was finished, as `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` in UTC (set it when the story is built). The hub's "New story maps" row lists every finished map, newest first by `added`, however old; the New pill marks those from the last 45 days. Placeholder entries and coming-soon stories are never listed there. A story's folder must exist; a `built` story also needs a valid `story.json`, and its `title` must match the manifest.

## Engine and data

- A new story is new **data**, never new engine code. If a story needs something the engine can't do, add a general feature to the engine and describe it in data.
- A built story is three kinds of data: its `story.json`, a basemap from `basemaps/` (reuse one for stories in the same region) and drawings from `art/glyphs.json`. A new drawing goes in the art library, not in engine code.
- `story.json` (see `stories/legends/indian/ramayana/story.json`): `id`, `title`, `description`, `canvas`, `basemap`, `source` (Tradition, Archaeology or History; a step may override it), `mapLabel`, `note`; `places` (`at` is [lon, lat], `glyph`, `label` side; `hidden` for route waypoints); `travellers` (icon from the art library); `phases`, `routeStyles`; `timeline` (`track` segments and `ticks`, 0 to 100); `steps` in order (`place`, `phase`, `title`, `native`, `when`, `at` on the timeline, `camera` {`at`, `width` in degrees}, `legs` {`from`, `to`, `traveller`, `style`, `bend`}, `text`, `today`); optional `effects`, `realms` and `people` (`heading`, and `items` with `id`, `name`, `native`, `life`, `role`, `text` and the `steps` they appear in, by index).
- **What a chapter shows.** A chapter draws in full (glyph and name) only its own `place` and the ends of its `legs`. Places from earlier chapters are small dots, later ones are not drawn until their chapter, and “Whole map” adds them as dots. So a story may have many places close together, as long as no single chapter shows two that collide: keep a chapter to 5 places in full at most (`pnpm story:check` warns), and never add a leg only to put a name on the map. Context that should stay on the map for many chapters, such as a rival capital, is a realm, not a place.
- Optional story settings: `nativeLang`, the language tag for `native` text (Hindi, `hi`, if unset; a step, realm or person can set its own `lang`), and `routes`: `journey` (the default) keeps earlier chapters' routes on the map, `chapter` shows only the current chapter's, and `overview` (`{ at: [lon, lat], width }` in degrees), the story's own whole-map view when the basemap's doesn't frame it.
- A realm gives either `area` (one outline for the whole story) or `pieces`: `[{ steps: [[from, to], ...], areas: [outline or { at, radius }] }]`, each piece shown only in its own steps, so an empire can gain and lose lands chapter by chapter. `{ at: [lon, lat], radius }` (in degrees) is a dot for a port or island too small to outline. `label.moves` (`[{ from, at }]`) moves the label as the realm changes.
- Basemap extras: a land shape can list `holes` (inland seas, cut out with the even-odd rule), and `sea.shallowsWidth` draws the coastal glow thinner on a wide map.
- The build runs the engine's `validate` on every built story and stops on any problem. Run `pnpm turbo run test build --filter=@krishnabuilds/story-maps` after editing data.
- Each story's data sets a `canvas`:
  - `geo`: a real map projected from longitude and latitude (Legends, Chronicles).
  - `earth-deep`: the Earth through geological time (Deep Time).
  - `cosmic`: the sky and space (Deep Time), or a mythic setting with no real geography.
- Only the `geo` canvas is built so far; `earth-deep` and `cosmic` are new engine features when the first such story needs them.
- The engine stores nothing and makes no requests (the tests check). It puts the chapter in the address (`#12`), announces each chapter with an `sm:chapter` event and takes `StoryMap.offerResume(i)`; `hub/progress.js` does the remembering. The build passes each story `more`: the other built stories (a card that names one links to it), the stories to offer at the end and the catalogue entries around it.
- The engine lives in `engine/` until a second app needs it; only then does it move to `packages/` (see `docs/decisions.md`).
- `docs/reference/rama-journey-map.html` is the look-and-behaviour reference. It is reference only: it loads Google Fonts and defines a blur filter, which these rules forbid. Don't copy its code into the engine.

## Content rules

- Label traditions as traditions ("Tradition places this at...", "Traditionally..."). Tag every card **Tradition**, **Archaeology** or **History** (recorded history, such as the colonial era).
- Where more than one place claims an event, say so and name them.
- Never invent rulers, dates, names or places. If a source doesn't name it, write "not named".
- Cards are about 50 to 60 words, never more than 60 (the build checks). People cards follow the same limit. Don't pad a shorter card with detail the sources don't give.
- For recorded history, give disputed figures (famine and massacre deaths, partition) as estimates and say they are disputed.
- Plain English translations, with the native term in brackets the first time: "fire ritual (yajna)".
- Any third-party art or data needs its own attribution and licence check before it's committed.

## Performance rules

Phones first. In the map:

- No SVG masks or blur filters (`feGaussianBlur` and similar). Reveal routes with dash arrays.
- No infinite SVG animations. Run an effect a few times, then stop, and respect `prefers-reduced-motion`.
- Don't re-centre the camera while the story sheet is being dragged; do it once when the drag ends.
- Coalesce resize and ResizeObserver work into one `requestAnimationFrame`. Zoom and pan also draw at most once a frame.
- Every place drawn, pin or dot, is tappable (it opens a place card); legs, the marker and effects stay `pointer-events: none` so taps reach the pins.
- Only the map zooms: it has `touch-action: none` and handles pinch, wheel and drag itself. Never block page zoom elsewhere (no `user-scalable=no`).
- Keep decoration counts modest (trees, waves, mountains): tens per layer, not hundreds.

## Versioning

Semver in `package.json`, with an entry in `CHANGELOG.md` for every release. Commit and PR titles: `Story Maps: <summary> (<version>)`.
