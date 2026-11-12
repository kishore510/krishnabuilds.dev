---
name: new-story-map
description: Add a new story to Story Maps (apps/story-maps) from a topic the owner names. Use when asked to build, add or write the next story map. Splits the work so the main model writes the content and a cheaper subagent turns it into data, with scripts doing the checks.
---

# Add a story map

A story is data. The engine, the hub, the controls and the page layout are finished and covered by their own tests, so adding a story never needs them read, changed or re-tested. What can go wrong in a new story is all in its data: a wrong fact, a card that is too long, a pin on top of another, a camera that misses its place, a realm outline that looks odd. The steps below spend the expensive model on the first of those and scripts on the rest.

If the owner names no story, build the first one under **Next** in `apps/story-maps/BACKLOG.md`.

Work from `apps/story-maps`. Its `CLAUDE.md` has the data format and the content rules; read that. Do not open `engine/`, `hub/`, `scripts/build.mjs`, `art/glyphs.json`, the basemaps or `catalogue.json` in full: `pnpm story:ref` prints everything a story may refer to (basemap extents, glyph and traveller ids, lanes, taken ids, catalogue entries waiting for a story). If the lockfile is not installed yet, run `pnpm install --frozen-lockfile` at the repo root first.

## 1. Content (you, the main model)

Run `pnpm story:ref`, then decide and write the brief to `.work/<id>/brief.md` (ignored by git). The brief is the whole hand-off, so it must leave no content decision open:

- `id`, title, section (and collection), `era`, the default source tag, the language of native names.
- Basemap: the existing one that covers every visible place. Places beyond its edge can be hidden waypoints that routes arrive from.
- Places: a name for the pin, what and where it is today (enough to find its coordinates without guessing), and a glyph from the list.
- Phases, in order, with names.
- Chapters, in order. For each: place, phase, title (under 40 characters), native name if there is one, `when`, source tag if it differs from the default, who travels from where to where if anyone does, the card text and the `today` line. Card text is final: 50 to 60 words, never over 60, following the content rules.
- People cards: name, native name, life, role, the chapters they appear in, and text under the same limit.
- Realms, if the story has powers that grow and shrink: for each, its name, role, rulers and ties by chapter, facts, and in words what land it holds in which chapters ("the Ganga plain from Prayag to Champa in chapters 3 to 8, then also Avanti").
- The catalogue: which existing entry gets `story`, or the full new entry; and which other entries the story covers, each with the `chapter` it should open at (summary of 50 to 60 words; see the Catalogue section of `CLAUDE.md`).
- The story's `description`, `mapLabel`, `note`, and for the README the paragraph on sources and what is disputed.

Stop and ask the owner before going further if the story needs any of these, because each is its own piece of work and its own PR: a new basemap or a wider one, an engine feature, or more than two or three new glyphs. One or two new glyphs or a traveller icon you may draw yourself in `art/glyphs.json`, matching the neighbours' style.

## 2. Assembly (a subagent on a cheaper model)

Start one subagent with the Agent tool, `model: "sonnet"`, and give it this job in full, since it starts with no context:

- Read `apps/story-maps/CLAUDE.md` (the "Engine and data" section is the format), the brief, the output of `pnpm story:ref`, and one built story on the same basemap as the pattern to copy for structure, colours, route styles and timeline (`stories/chronicles/nanda/story.json` is a compact one with realms and people).
- Write `story.json` and the story's `README.md`; add the manifest entry (or flip `coming-soon` to `built`) with `added` set to the output of `date -u +%Y-%m-%dT%H:%M`; add or link the catalogue entry with `added` set to today; bump the minor version in `package.json`; add the `CHANGELOG.md` entry; tick or add the story in the Story Maps list in `docs/plan.md`; in `BACKLOG.md`, remove the story from **Next** and add it to the top of **Built** in the same form as its neighbours.
- Copy every card, title and people text from the brief exactly. It supplies only what the brief leaves to it: coordinates, label sides, cameras, route bends, timeline positions, colours and realm outlines.
- Run `pnpm story:check <id>` until there are no errors, and clear the warnings it can by moving label sides, widening cameras and merging or hiding crowded pins. A warning it believes should stand, it lists with the reason.
- Run `pnpm turbo run build lint typecheck test --filter=@krishnabuilds/story-maps` from the repo root, then `pnpm story:shots <id>` (add chapter numbers for the realm changes named in the brief).
- Report: the check output, the screenshot paths, any place whose coordinates it was unsure of, and anything in the brief it could not follow.

If no subagent is available, do the same steps yourself.

## 3. Review (you)

You wrote the content, so do not reread `story.json` end to end. Look at:

- the subagent's report and the remaining warnings;
- the screenshots: realm outlines against the coastline and each other, route bends, crowded corners, native-script labels rendering;
- the coordinates it flagged, and a spot check of a few others;
- `git diff --stat`, to see that only the story's files, `manifest.json`, `catalogue.json`, `CHANGELOG.md`, `BACKLOG.md`, `package.json` and `docs/plan.md` changed.

Fix small things directly and rerun `pnpm story:check <id>`. Then commit as `Story Maps: <title> (<version>)` and follow the repo's branch and PR rules.
