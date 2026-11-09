# CLAUDE.md: Story Maps

Illustrated, data-driven story maps at `story-maps.krishnabuilds.dev`: a hub page plus one page per story. Follows the root `CLAUDE.md`; this file only adds what is specific to Story Maps.

Story Maps "stories" are not the Portal's `/stories/<slug>` pages (the Portal's write-ups about each app). In this folder, "story" always means a map in `manifest.json`.

## What this is

A static site with a small Node build step and no backend. Every page is a single self-contained HTML file with inline `<style>` and `<script>`: `scripts/build.mjs` inlines the shared tokens CSS, `src/theme.css` and the `kb-theme` pre-paint script (`src/prepaint.js`) into each page.

**One deliberate exception: fonts.** Yatra One and Tiro Devanagari Hindi are self-hosted as same-origin woff2 files in `dist/fonts/` (Latin and Devanagari subsets only, `unicode-range`, `font-display: swap`, with a serif fallback stack). Inlining them would add hundreds of KB to every page; as separate files the browser caches them across pages. No external font or asset requests, ever. Their SIL OFL licences are in `licences/` and ship next to the files.

## Commands

From the repo root: `pnpm turbo run build lint typecheck test --filter=@krishnabuilds/story-maps`. Output goes to `apps/story-maps/dist/`; preview with `python3 -m http.server 8080 -d dist` from `apps/story-maps` (that server has no 404 page; Cloudflare serves `dist/404.html` for unknown paths).

## Layout

```
manifest.json      sections, collections and every story (the hub reads only this)
stories/           one folder per story: stories/<section>/[<collection>/]<id>/; a built story has story.json there
basemaps/          shared regional maps, e.g. south-asia.json (coastlines, rivers, ranges, forests, labels)
art/glyphs.json    shared hand-drawn SVG: place glyphs, traveller icons, compass, lamp
hub/page.html      the shell every page is rendered into
src/theme.css      painted theme (saffron, lapis, gold), light and dark
src/prepaint.js    kb-theme pre-paint script; test/prepaint.test.js fails if it drifts from packages/ui/src/theme.ts
public/            favicon and apple-touch icon, copied as-is
licences/          OFL texts for the fonts
engine/src/        @krishnabuilds/story-maps-engine: map.js (pure: data to SVG, validate), player.js (browser), engine.css, player.html
scripts/build.mjs  the build; stops on any manifest or story data problem
```

## Sections

- **Legends**: epics and sacred stories, placed where tradition puts them. Grouped into collections (`indian` so far).
- **Chronicles**: civilisations, empires and routes, from archaeology and the historical record (ancient and modern). No collections.
- **Deep Time**: the Earth and the sky before people. Empty for now.

`manifest.json` story fields: `id` (lowercase slug, unique across all sections; also the page path `/<id>/`), `section`, optional `collection`, `title`, `status` (`built` or `coming-soon`), `era` (a broad tag such as "Epic tradition" or "Bronze Age", never a made-up date). A story's folder must exist; a `built` story also needs a valid `story.json`, and its `title` must match the manifest.

## Engine and data

- A new story is new **data**, never new engine code. If a story needs something the engine can't do, add a general feature to the engine and describe it in data.
- A built story is three kinds of data: its `story.json`, a basemap from `basemaps/` (reuse one for stories in the same region) and drawings from `art/glyphs.json`. A new drawing goes in the art library, not in engine code.
- `story.json` (see `stories/legends/indian/ramayana/story.json`): `id`, `title`, `description`, `canvas`, `basemap`, `source` (Tradition, Archaeology or History; a step may override it), `mapLabel`, `note`; `places` (`at` is [lon, lat], `glyph`, `label` side; `hidden` for route waypoints); `travellers` (icon from the art library); `phases`, `routeStyles`; `timeline` (`track` segments and `ticks`, 0 to 100); `steps` in order (`place`, `phase`, `title`, `native`, `when`, `at` on the timeline, `camera` {`at`, `width` in degrees}, `legs` {`from`, `to`, `traveller`, `style`, `bend`}, `text`, `today`); optional `effects`, `realms` and `people` (`heading`, and `items` with `id`, `name`, `native`, `life`, `role`, `text` and the `steps` they appear in, by index).
- The build runs the engine's `validate` on every built story and stops on any problem. Run `pnpm turbo run test build --filter=@krishnabuilds/story-maps` after editing data.
- Each story's data sets a `canvas`:
  - `geo`: a real map projected from longitude and latitude (Legends, Chronicles).
  - `earth-deep`: the Earth through geological time (Deep Time).
  - `cosmic`: the sky and space (Deep Time), or a mythic setting with no real geography.
- Only the `geo` canvas is built so far; `earth-deep` and `cosmic` are new engine features when the first such story needs them.
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
- Pins are tappable at any time (they open a place card); legs, the marker and effects stay `pointer-events: none` so taps reach the pins.
- Only the map zooms: it has `touch-action: none` and handles pinch, wheel and drag itself. Never block page zoom elsewhere (no `user-scalable=no`).
- Keep decoration counts modest (trees, waves, mountains): tens per layer, not hundreds.

## Versioning

Semver in `package.json`, with an entry in `CHANGELOG.md` for every release. Commit and PR titles: `Story Maps: <summary> (<version>)`.
