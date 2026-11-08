# @krishnabuilds/story-maps-engine

The Story Maps engine: it turns one story's data into an interactive map page (map, route, timeline, story sheet, Play/Back/Next, realms).

- `src/map.js`: pure functions, no DOM. `buildMap(story, basemap, art)` returns the SVG and the route legs; `validate(story, basemap, art)` lists problems with the data. The build and the tests run it in Node.
- `src/player.js`: runs in the browser. Reads the page's `#sm-data` JSON, draws the map and handles steps, camera, timeline, sheet and realms.
- `src/engine.css`, `src/player.html`: the story page's styles and markup.

`apps/story-maps/scripts/build.mjs` inlines all four into each built story's page, with the story's data. The files are classic scripts (no modules, no bundler) so a page stays one self-contained file.

It lives inside `apps/story-maps` because only Story Maps uses it. It moves to `packages/` only when a second app needs it (see `docs/decisions.md`). Rules for data and performance are in `apps/story-maps/CLAUDE.md`.
