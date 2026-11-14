// @ts-check
// Builds Story Maps into dist/:
//   dist/index.html          the front page: three shelves, their subjects and story cards
//   dist/explore/index.html  the atlas, the timeline and Browse (catalogue.json)
//   dist/<id>/index.html     one page per story
//   dist/explore/<id>/       one page per catalogue entry (catalogue.json)
//   dist/404.html            served by Cloudflare for unknown paths
//   dist/fonts/              self-hosted fonts and their OFL licences
// Every page inlines the shared tokens CSS, the painted theme and the
// kb-theme pre-paint script, so it needs nothing else except the fonts.
// Built stories also inline the engine (engine/src) and their data.

import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { checkStory, loadEngineAssets, loadMapFunctions, loadStoryData } from "./engine.mjs";
import { loadCatalogue, loadExplore, validateCatalogue } from "./catalogue.mjs";
import { APP_DIR, loadManifest, validateManifest } from "./manifest.mjs";

/** @typedef {import("./manifest.mjs").Story} Story */
/** @typedef {import("./catalogue.mjs").Entry} Entry */

const require = createRequire(import.meta.url);
const DIST = `${APP_DIR}dist/`;
const ORIGIN = "https://story-maps.krishnabuilds.dev";

// Latin and Devanagari only. Other characters fall back to the stacks in
// src/theme.css.
const SUBSETS = /** @type {const} */ (["latin", "devanagari"]);
const FONTS = [
  { pkg: "yatra-one", family: "Yatra One", style: "normal" },
  { pkg: "tiro-devanagari-hindi", family: "Tiro Devanagari Hindi", style: "normal" },
  { pkg: "tiro-devanagari-hindi", family: "Tiro Devanagari Hindi", style: "italic" },
];

/** @param {string} path */
const read = (path) => readFileSync(path, "utf8");

/** @param {string} text */
function esc(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// --- check the manifest first ------------------------------------------------

const manifest = loadManifest();
const problems = validateManifest(manifest);
if (problems.length) {
  console.error(`manifest.json has problems:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
const catalogue = loadCatalogue();
const catalogueProblems = validateCatalogue(catalogue, manifest.stories);
if (catalogueProblems.length) {
  console.error(`catalogue.json has problems:\n- ${catalogueProblems.join("\n- ")}`);
  process.exit(1);
}
const mapFunctions = loadMapFunctions();
for (const entry of manifest.stories.filter((s) => s.status === "built")) {
  const storyProblems = checkStory(entry, mapFunctions);
  if (storyProblems.length) {
    console.error(`${entry.id}/story.json has problems:\n- ${storyProblems.join("\n- ")}`);
    process.exit(1);
  }
}
// An entry's chapter must exist in its story.
for (const e of catalogue.entries.filter((x) => x.chapter !== undefined)) {
  const s = manifest.stories.find((x) => x.id === e.story);
  const n = s?.status === "built" ? loadStoryData(s).story.steps.length : 0;
  if (/** @type {number} */ (e.chapter) > n) {
    console.error(`catalogue.json: entry ${e.id}: chapter ${e.chapter} is not in story ${e.story} (${n} chapters)`);
    process.exit(1);
  }
}

// --- fonts -------------------------------------------------------------------

rmSync(DIST, { recursive: true, force: true });
mkdirSync(`${DIST}fonts`, { recursive: true });

const fontFaces = [];
for (const font of FONTS) {
  /** @type {Record<string, string>} */
  const ranges = require(`@fontsource/${font.pkg}/unicode.json`);
  for (const subset of SUBSETS) {
    const file = `${font.pkg}-${subset}-400-${font.style}.woff2`;
    copyFileSync(require.resolve(`@fontsource/${font.pkg}/files/${file}`), `${DIST}fonts/${file}`);
    fontFaces.push(
      [
        "@font-face {",
        `  font-family: "${font.family}";`,
        `  font-style: ${font.style};`,
        "  font-weight: 400;",
        "  font-display: swap;",
        `  src: url(/fonts/${file}) format("woff2");`,
        `  unicode-range: ${ranges[subset]};`,
        "}",
      ].join("\n"),
    );
  }
}
for (const pkg of new Set(FONTS.map((f) => f.pkg))) {
  copyFileSync(`${APP_DIR}licences/OFL-${pkg}.txt`, `${DIST}fonts/OFL-${pkg}.txt`);
}

cpSync(`${APP_DIR}public`, DIST, { recursive: true });

// --- page shell --------------------------------------------------------------

const shell = read(`${APP_DIR}hub/page.html`);
const styles = [
  read(require.resolve("@krishnabuilds/tokens/tokens.css")),
  fontFaces.join("\n"),
  read(`${APP_DIR}src/theme.css`),
].join("\n");
const prepaint = read(`${APP_DIR}src/prepaint.js`).trim();
const engine = loadEngineAssets();
const exploreCss = read(`${APP_DIR}hub/explore.css`);
const exploreJs = read(`${APP_DIR}hub/explore.js`);
const hubJs = read(`${APP_DIR}hub/hub.js`);
const frontJs = read(`${APP_DIR}hub/front.js`);
const progressJs = read(`${APP_DIR}hub/progress.js`);
const statsJs = read(`${APP_DIR}hub/stats.js`);
const statsCss = read(`${APP_DIR}hub/stats.css`);
const tourJs = read(`${APP_DIR}hub/tour.js`);
const tourCss = read(`${APP_DIR}hub/tour.css`);
const themePickerJs = read(`${APP_DIR}src/theme-picker.js`);

/**
 * @param {{ title: string, description: string, path: string, body: string, noindex?: boolean, story?: boolean, explore?: boolean, tour?: boolean }} page
 */
function render(page) {
  /** @type {Record<string, string>} */
  const vars = {
    title: esc(page.title),
    description: esc(page.description),
    url: `${ORIGIN}${page.path}`,
    robots: page.noindex ? '<meta name="robots" content="noindex">\n' : "",
    prepaint,
    styles: page.story ? `${styles}\n${engine.css}\n${tourCss}\n${statsCss}` : page.explore ? `${styles}\n${exploreCss}${page.tour ? `\n${tourCss}` : ""}` : styles,
    bodyAttrs: page.story ? ' class="sm-story-page"' : "",
    body: page.body,
  };
  // One pass, so inserted text is never scanned for placeholders again.
  return shell.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in vars)) throw new Error(`hub/page.html: unknown placeholder ${match}`);
    return vars[key];
  });
}

/** @param {string} path @param {string} html */
function write(path, html) {
  mkdirSync(`${DIST}${path}`.replace(/[^/]*$/, ""), { recursive: true });
  writeFileSync(`${DIST}${path}`, html);
}

// Parchment is the light cream theme, Night the dark one; Auto follows the device.
const THEME_PICKER =
  '<div class="sm-theme" role="group" aria-label="Theme">' +
  [["light", "Parchment"], ["dark", "Night"], ["system", "Auto"]]
    .map(([value, label]) => `<button type="button" data-kb-theme="${value}" aria-pressed="false">${label}</button>`)
    .join("") +
  "</div>";
const THEME_SCRIPT = `<script>\n${themePickerJs}</script>`;
const HOME = `<header class="sm-top"><a href="https://krishnabuilds.dev">← krishnabuilds</a>${THEME_PICKER}</header>`;
const BACK = `<header class="sm-top"><a href="/">← All story maps</a>${THEME_PICKER}</header>`;
const FOOT =
  '<footer class="sm-foot">Legends follow tradition; Chronicles follow archaeology and the historical record; Nature and Science follow the evidence. Maps are stylised and not to scale. © krishnabuilds. All rights reserved.</footer>';

/**
 * Fills {{key}} placeholders in one pass, so inserted text is never scanned again.
 * @param {string} template @param {Record<string, string>} vars @param {string} name
 */
function fill(template, vars, name) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in vars)) throw new Error(`${name}: unknown placeholder ${match}`);
    return vars[key];
  });
}

/** @param {Story} entry */
function storyPage(entry) {
  const data = { ...loadStoryData(entry), more: storyLinks(entry) };
  // JSON inside <script>: escape "<" so no "</script>" can end it early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const page = fill(
    engine.html,
    {
      title: esc(data.story.title),
      mapLabel: esc(data.story.mapLabel),
      note: esc(data.story.note),
      data: json,
      engine: engine.js,
    },
    "engine/src/player.html",
  );
  return `${page}\n<script>\n${progressJs}</script>\n<script>\n${statsJs}</script>\n<script>\n${tourJs}</script>`;
}

// --- hub: timeline and Browse ------------------------------------------------

const X = loadExplore();
const storyById = new Map(manifest.stories.map((s) => [s.id, s]));
/** @param {Entry} e */
const isBuilt = (e) => Boolean(e.story && storyById.get(e.story)?.status === "built");
const regionById = new Map(catalogue.regions.map((r) => [r.id, r]));
/** @type {Map<string, string>} */
const laneTitle = new Map(catalogue.regions.flatMap((r) => r.lanes.map((l) => [l.id, l.title])));
/** @param {string} regionId */
const hueOf = (regionId) => `--hue:var(--sm-hue-${regionById.get(regionId)?.hue})`;
const KIND = { civilisation: "Civilisation", dynasty: "Dynasty or empire", event: "Event", legend: "Epic or legend", route: "Route", person: "Person", "deep-time": "Deep time", discovery: "Discovery" };

const builtStories = manifest.stories.filter((s) => s.status === "built");

/**
 * Where a story's last chapter and its text can send the reader: the other
 * built stories, the ones to offer next (stories about its neighbours first)
 * and the catalogue entries around it.
 * @param {Story} entry
 */
function storyLinks(entry) {
  const mine = catalogue.entries.filter((e) => e.story === entry.id);
  /** @type {Map<string, Entry>} */
  const related = new Map(mine.map((e) => [e.id, e]));
  // Stories about the entries that come straight after (then before) this one's are offered first.
  /** @type {string[]} */
  const neighbourStories = [];
  // The story's own entry (the one without a chapter) comes first.
  const own = [...mine].sort((a, b) => (a.chapter === undefined ? 0 : 1) - (b.chapter === undefined ? 0 : 1));
  for (const e of own) {
    const { before, after } = X.neighbours(e, catalogue.entries);
    for (const x of [after, before]) {
      if (!x) continue;
      related.set(x.id, x);
      if (x.story && x.story !== entry.id && !neighbourStories.includes(x.story)) neighbourStories.push(x.story);
    }
  }
  for (const e of mine) {
    for (const m of X.meanwhile(e, catalogue.entries, 2)) related.set(m.entry.id, m.entry);
  }
  const at = builtStories.indexOf(entry);
  const inOrder = [...builtStories.slice(at + 1), ...builtStories.slice(0, Math.max(at, 0))];
  // Offer first the stories that share the most years with this one; then the rest in manifest order.
  /** @param {Story} s */
  const shared = (s) => {
    let years = 0;
    for (const a of mine) {
      for (const b of catalogue.entries) {
        if (b.story !== s.id || a.from === undefined || a.to === undefined || b.from === undefined || b.to === undefined) continue;
        years = Math.max(years, Math.min(a.to, b.to) - Math.max(a.from, b.from));
      }
    }
    return years;
  };
  /** @param {Story} s */
  const rank = (s) => {
    const n = neighbourStories.indexOf(s.id);
    return n < 0 ? neighbourStories.length : n;
  };
  const next = inOrder
    .map((s, i) => ({ s, i, years: shared(s) }))
    .sort((a, b) => rank(a.s) - rank(b.s) || b.years - a.years || a.i - b.i)
    .map((x) => x.s);
  return {
    stories: inOrder.map((s) => ({ title: s.title, href: `/${s.id}/` })),
    next: next.slice(0, 2).map((s) => ({ title: s.title, href: `/${s.id}/`, era: s.era })),
    related: [...related.values()].slice(0, 6).map((e) => ({ name: e.name, href: `/explore/${e.id}/`, dates: X.rangeText(e) })),
  };
}

// --- the world, for the atlas and the story cards ----------------------------

const world = JSON.parse(read(`${APP_DIR}basemaps/world.json`));
const worldP = /** @type {(at: number[]) => number[]} */ (mapFunctions.projector(world.projection));
const [WORLD_W, WORLD_H] = world.size;
const n1 = (/** @type {number} */ n) => Math.round(n * 10) / 10;
// One copy of the coastlines; the atlas and every story card draw it with <use>.
const WORLD_DEFS =
  '<svg class="sm-defs" width="0" height="0" aria-hidden="true"><defs>' +
  `<path id="sm-world-land" fill-rule="evenodd" d="${/** @type {string[]} */ (mapFunctions.landPaths(world)).join("")}"/>` +
  `<linearGradient id="sm-world-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${world.sea.top}"/><stop offset=".55" stop-color="${world.sea.middle}"/><stop offset="1" stop-color="${world.sea.bottom}"/></linearGradient>` +
  `<linearGradient id="sm-world-fill" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(WORLD_H * 0.18)}" x2="0" y2="${n1(WORLD_H * 0.94)}"><stop offset="0" stop-color="${world.land.top}"/><stop offset=".5" stop-color="${world.land.middle}"/><stop offset="1" stop-color="${world.land.bottom}"/></linearGradient>` +
  "</defs></svg>";
const WORLD_LAYERS =
  `<rect x="${-WORLD_W}" y="${-WORLD_H * 2}" width="${WORLD_W * 3}" height="${WORLD_H * 5}" fill="url(#sm-world-sea)"/>` +
  `<use href="#sm-world-land" fill="none" stroke="${world.sea.shallows}" stroke-width="7" stroke-linejoin="round" opacity=".3"/>` +
  `<use href="#sm-world-land" fill="url(#sm-world-fill)" stroke="${world.land.edge}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;

/** A small map for a story's card: the world cropped to the story's places, with its routes and pins. @param {Story} entry */
function storyThumb(entry) {
  const { story, basemap } = loadStoryData(entry);
  // A sky story (the cosmic canvas) has no place in the world: it is drawn on its own dark ground.
  const sky = basemap.kind === "sky";
  const project = sky ? /** @type {(at: number[]) => number[]} */ (mapFunctions.projector(basemap.projection)) : worldP;
  /** @type {Record<string, number[]>} */
  const where = {};
  for (const [id, place] of Object.entries(story.places)) where[id] = project(/** @type {{ at: number[] }} */ (place).at);
  const shown = Object.entries(story.places).filter(([, p]) => !(/** @type {{ hidden?: boolean }} */ (p).hidden)).map(([id]) => where[id]);
  const xs = shown.map((p) => p[0]);
  const ys = shown.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  // 16:9, with room around the places, and never closer than about 30 degrees across.
  const w = Math.max((Math.max(...xs) - Math.min(...xs)) * 1.3, (Math.max(...ys) - Math.min(...ys)) * 1.3 * (16 / 9), 150);
  const h = (w * 9) / 16;
  const u = w / 320;
  const legs = story.steps
    .flatMap((/** @type {{ legs: { from: string, to: string }[] }} */ step) => step.legs)
    .map((/** @type {{ from: string, to: string }} */ l) => `M${n1(where[l.from][0])} ${n1(where[l.from][1])}L${n1(where[l.to][0])} ${n1(where[l.to][1])}`)
    .join("");
  return (
    `<svg class="sm-story-card__map" viewBox="${n1(cx - w / 2)} ${n1(cy - h / 2)} ${n1(w)} ${n1(h)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    (sky
      ? `<rect x="${n1(cx - w)}" y="${n1(cy - h)}" width="${n1(w * 2)}" height="${n1(h * 2)}" fill="${basemap.sky.middle}"/>` +
        `<circle cx="${n1(shown[0][0])}" cy="${n1(shown[0][1])}" r="${n1(u * 70)}" fill="#ff8a3a" opacity=".3"/><circle cx="${n1(shown[0][0])}" cy="${n1(shown[0][1])}" r="${n1(u * 26)}" fill="#fff3c4" opacity=".7"/>`
      : WORLD_LAYERS) +
    (legs ? `<path d="${legs}" fill="none" stroke="#fff6dc" stroke-width="${n1(u * 1.6)}" stroke-dasharray="${n1(u * 5)} ${n1(u * 4)}" stroke-linecap="round" opacity=".85"/>` : "") +
    shown.map(([x, y]) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(u * 4)}" fill="#f6e6c0" stroke="#7a3b12" stroke-width="${n1(u * 1.3)}"/>`).join("") +
    "</svg>"
  );
}

/** @param {Story} s */
function storyCard(s) {
  const n = loadStoryData(s).story.steps.length;
  return (
    `<li><a class="sm-story-card" href="/${s.id}/" data-story="${s.id}">${storyThumb(s)}` +
    `<span class="sm-story-card__body"><span class="sm-story-card__kicker">${esc(s.era)}</span>` +
    `<span class="sm-story-card__name">${esc(s.title)}</span>` +
    `<span class="sm-story-card__meta"><span data-meta>${n} chapters</span><span class="sm-story-card__stats" data-stats hidden></span></span></span></a></li>`
  );
}

// The front page: each shelf, its subjects that have a story (newest story first) and, in one line, the subjects to come.
const shelves = manifest.shelves
  .map((shelf) => {
    const sections = manifest.sections.filter((x) => x.shelf === shelf.id);
    const withStories = sections.map((section) => ({ section, stories: builtStories.filter((x) => x.section === section.id) }));
    const open = withStories.filter((x) => x.stories.length);
    const toCome = withStories.filter((x) => !x.stories.length).map((x) => x.section.title);
    return [
      `<section class="sm-shelf sm-shelf--${shelf.id}" id="${shelf.id}" aria-labelledby="sm-shelf-${shelf.id}">`,
      `<div class="sm-shelf__head"><h2 id="sm-shelf-${shelf.id}">${esc(shelf.title)}</h2><p>${esc(shelf.blurb)}</p></div>`,
      ...open.map(({ section, stories }) => {
        const newestFirst = [...stories].sort((x, y) => String(y.added).localeCompare(String(x.added)));
        return (
          `<div class="sm-subject" id="${section.id}"><h3><a href="/${section.id}/">${esc(section.title)}</a> <span class="sm-subject__n">${stories.length} ${stories.length === 1 ? "story map" : "story maps"}</span></h3>` +
          `<p class="sm-subject__blurb">${esc(section.blurb)} <a class="sm-subject__all" href="/${section.id}/">See all and share ›</a></p>` +
          // The arrows are for a mouse, which cannot swipe; hub/front.js shows them only on a row that overflows.
          `<div class="sm-row"><button type="button" class="sm-row__go" data-go="-1" aria-label="Earlier ${esc(section.title)} story maps" hidden>‹</button>` +
          `<ul class="sm-story-row">${newestFirst.map(storyCard).join("")}</ul>` +
          `<button type="button" class="sm-row__go" data-go="1" aria-label="More ${esc(section.title)} story maps" hidden>›</button></div></div>`
        );
      }),
      toCome.length ? `<p class="sm-shelf__next">To come: ${toCome.map(esc).join(", ")}.</p>` : "",
      "</section>",
    ].join("\n");
  })
  .join("\n");

write(
  "index.html",
  render({
    title: "Story Maps · krishnabuilds",
    description: "Illustrated maps that tell a story chapter by chapter: the universe and the Earth, civilisations and legends, and the people and discoveries of science.",
    path: "/",
    explore: true,
    tour: true,
    body: [
      HOME,
      '<main class="sm-page sm-hub sm-front">',
      WORLD_DEFS,
      '<section class="sm-hero"><h1>Story Maps</h1><p>Follow a story across an illustrated map: what happened, what people did, and how we found out.</p>' +
        `<nav class="sm-doors" aria-label="Where to start">${manifest.shelves
          .map((shelf) => {
            const ids = manifest.sections.filter((x) => x.shelf === shelf.id).map((x) => x.id);
            const n = builtStories.filter((x) => ids.includes(x.section)).length;
            return `<a class="sm-door sm-shelf--${shelf.id}" href="#${shelf.id}"><span class="sm-door__t">${esc(shelf.title)}</span><span class="sm-door__n">${n} ${n === 1 ? "story map" : "story maps"}</span></a>`;
          })
          .join("")}<a class="sm-door sm-explore-link" href="/explore/"><span class="sm-door__t">Explore through time</span><span class="sm-door__n">Timeline, search and atlas</span></a></nav></section>`,
      shelves,
      FOOT,
      "</main>",
      `<script>\n${frontJs}</script>`,
      `<script>\n${tourJs}</script>`,
      THEME_SCRIPT,
    ].join("\n"),
  }),
);

// One page per subject, at /<subject>/, so a subject can be shared on its own: every story map in it, newest first,
// grouped by collection where it has them. A subject with none yet still gets a page that says so.
for (const section of manifest.sections) {
  const shelf = manifest.shelves.find((x) => x.id === section.shelf);
  const stories = builtStories.filter((x) => x.section === section.id).sort((x, y) => String(y.added).localeCompare(String(x.added)));
  const groups = manifest.collections.filter((c) => c.section === section.id).map((c) => ({ title: c.title, stories: stories.filter((s) => s.collection === c.id) }));
  const loose = stories.filter((s) => !groups.some((g) => g.stories.includes(s)));
  const grid = (/** @type {Story[]} */ list) => `<ul class="sm-story-row sm-story-grid">${list.map(storyCard).join("")}</ul>`;
  const others = manifest.sections.filter((x) => x.id !== section.id && builtStories.some((s) => s.section === x.id));
  const count = `${stories.length} ${stories.length === 1 ? "story map" : "story maps"}`;
  write(
    `${section.id}/index.html`,
    render({
      title: `${section.title} · Story Maps · krishnabuilds`,
      description: `${section.blurb} ${stories.length ? `${count} on illustrated maps, chapter by chapter.` : "Story maps to come."}`,
      path: `/${section.id}/`,
      explore: true,
      body: [
        BACK,
        `<main class="sm-page sm-hub sm-front sm-subject-page sm-shelf--${shelf?.id}">`,
        WORLD_DEFS,
        `<section class="sm-hero"><p class="sm-subject-page__shelf"><a href="/#${shelf?.id}">${esc(shelf?.title ?? "")}</a></p><h1>${esc(section.title)}</h1><p>${esc(section.blurb)}</p>` +
          `<p class="sm-subject-page__bar"><span class="sm-subject__n">${count}</span><button type="button" class="sm-btn" data-share>Share this page</button></p></section>`,
        stories.length
          ? [
              ...groups.filter((g) => g.stories.length).map((g) => `<section class="sm-subject"><h2>${esc(g.title)}</h2>${grid(g.stories)}</section>`),
              loose.length ? `<section class="sm-subject">${groups.length ? "<h2>More</h2>" : ""}${grid(loose)}</section>` : "",
            ].join("\n")
          : '<p class="sm-muted">No story maps here yet. They are being drawn.</p>',
        others.length ? `<nav class="sm-subject-page__more" aria-label="Other subjects"><h2>Other subjects</h2><p>${others.map((x) => `<a href="/${x.id}/">${esc(x.title)}</a>`).join(" · ")}</p></nav>` : "",
        FOOT,
        "</main>",
        `<script>\n${frontJs}</script>`,
        THEME_SCRIPT,
      ].join("\n"),
    }),
  );
}

const hubData = {
  regions: catalogue.regions,
  entries: catalogue.entries,
  stories: Object.fromEntries(
    manifest.stories.map((s) => {
      // The region to colour a story's card by: its main entry's (the one with no chapter), else the first that links to it.
      const linked = catalogue.entries.filter((e) => e.story === s.id);
      const region = (linked.find((e) => e.chapter === undefined) ?? linked[0])?.region;
      return [s.id, { title: s.title, built: s.status === "built", era: s.era, added: s.added, region }];
    }),
  ),
  // The atlas projects [lon, lat] the same way the world basemap does.
  world: { ...world.projection, size: world.size },
};
// JSON inside <script>: escape "<" so no "</script>" can end it early.
const hubJson = JSON.stringify(hubData).replace(/</g, "\\u003c");

write(
  "explore/index.html",
  render({
    title: "Explore · Story Maps · krishnabuilds",
    description: "An atlas and a timeline of civilisations, dynasties and empires, and a list of everything in Story Maps by name.",
    path: "/explore/",
    explore: true,
    tour: true,
    body: [
      BACK,
      '<main class="sm-page sm-hub">',
      WORLD_DEFS,
      '<section class="sm-hero"><h1>Explore</h1><p>Move through time and watch who ruled where, or look anything up by name.</p></section>',
      '<div class="sm-hub-bar"><nav class="sm-tabs" aria-label="Views"><a id="sm-tab-timeline" href="#timeline">Timeline</a><a id="sm-tab-browse" href="#browse">Browse</a><a id="sm-tab-atlas" href="#atlas">Atlas</a></nav><p class="sm-count" id="sm-count"></p></div>',
      '<section class="sm-v-atlas" id="sm-v-atlas" aria-label="Atlas" hidden>',
      '<div class="sm-at">',
      '<div class="sm-at-stage" id="sm-at-stage">',
      `<svg id="sm-at-map" role="group" aria-label="The world in the chosen year. Each circle is a civilisation or empire; tap one to read about it.">${WORLD_LAYERS}<g id="sm-at-blobs"></g><g id="sm-at-labels"></g></svg>`,
      '<p class="sm-at-year" id="sm-at-year" aria-live="polite"></p>',
      '<div class="sm-at-zoom" role="group" aria-label="Zoom the map"><button type="button" id="sm-at-in" aria-label="Zoom in">+</button><button type="button" id="sm-at-out" aria-label="Zoom out">−</button></div>',
      '<div class="sm-at-card" id="sm-at-card" hidden></div>',
      "</div>",
      '<div class="sm-at-bar"><button type="button" class="sm-at-play" id="sm-at-play" aria-label="Play through time"></button>',
      '<div class="sm-at-slider"><label class="sm-sr" for="sm-at-range">Year</label><input type="range" id="sm-at-range" step="10"><div class="sm-at-ticks" id="sm-at-ticks" aria-hidden="true"></div></div></div>',
      "</div>",
      '<div class="sm-tl-now" id="sm-at-now"></div>',
      '<p class="sm-key"><span>Drag the year to move through time. Each circle marks a heartland and a rough reach, not a border.</span></p>',
      "</section>",
      '<section class="sm-v-timeline" id="sm-v-timeline" aria-label="Timeline">',
      '<div class="sm-chips" id="sm-tl-regions" role="group" aria-label="Regions"></div>',
      '<div class="sm-tl-now" id="sm-tl-now" aria-live="polite"></div>',
      '<div class="sm-tl">',
      '<div class="sm-tl-scroller" id="sm-tl-scroller"><div id="sm-tl-inner"></div></div>',
      '<div class="sm-tl-guide" id="sm-tl-guide"><span id="sm-tl-pill"></span></div>',
      '<div class="sm-tl-zoom" role="group" aria-label="Zoom the timeline"><button type="button" id="sm-zoom-out" aria-label="Zoom out">−</button><span id="sm-zoom-name"></span><button type="button" id="sm-zoom-in" aria-label="Zoom in">+</button></div>',
      "</div>",
      '<p class="sm-key"><span><i class="sm-key-built"></i>Story map ready</span><span><i></i>Story map to come</span><span><i class="sm-key-event"></i>Event</span><span>Scroll through time; the line shows who ruled at the same moment.</span></p>',
      "</section>",
      '<section class="sm-v-browse" id="sm-v-browse" aria-label="Browse" hidden>',
      '<div class="sm-search"><label class="sm-sr" for="sm-q">Search</label><input id="sm-q" type="search" placeholder="Search civilisations, empires, legends and people" autocomplete="off"></div>',
      '<div class="sm-browse-body" id="sm-browse-body"></div>',
      "</section>",
      `<noscript><div class="sm-noscript"><h2>Everything</h2><ul>${catalogue.entries
        .map((e) => `<li><a href="/explore/${e.id}/">${esc(e.name)}</a> <span class="sm-muted">${esc(X.rangeText(e))}</span></li>`)
        .join("")}</ul></div></noscript>`,
      FOOT,
      "</main>",
      `<script type="application/json" id="sm-catalogue">${hubJson}</script>`,
      `<script>\n${exploreJs}\n${hubJs}</script>`,
      `<script>\n${tourJs}</script>`,
      THEME_SCRIPT,
    ].join("\n"),
  }),
);

// --- entry pages -------------------------------------------------------------

/** @param {string} kind @param {Entry | null} e */
function mini(kind, e) {
  if (!e) return `<div class="sm-mini"><span class="sm-mini__k">${kind}</span><span class="sm-mini__n sm-muted">Nothing yet</span></div>`;
  return `<a class="sm-mini" href="/explore/${e.id}/" style="${hueOf(e.region)}"><span class="sm-mini__k">${kind}</span><span class="sm-mini__n">${esc(e.name)}</span><span class="sm-mini__d">${esc(X.rangeText(e))}</span></a>`;
}

/** This entry and its lane neighbours to scale, like a slice of the timeline. @param {Entry} e */
function contextStrip(e) {
  if (!e.lane || !X.isSpan(e)) return "";
  const from = /** @type {number} */ (e.from);
  const to = /** @type {number} */ (e.to);
  const pad = Math.max(150, (to - from) * 0.8);
  const lo = from - pad;
  const hi = to + pad;
  /** @type {Entry[]} */
  const mates = X.laneMates(e, catalogue.entries);
  const segs = [e, ...mates.filter((x) => /** @type {number} */ (x.to) > lo && /** @type {number} */ (x.from) < hi)];
  /** @param {number} y */
  const pct = (y) => Math.min(100, Math.max(0, ((y - lo) / (hi - lo)) * 100));
  /** @param {number} y */
  const label = (y) => X.yearText(Math.round(y / 10) * 10 || 1);
  return `<div class="sm-ctx" aria-hidden="true">${segs
    .map((x) => {
      const l = pct(/** @type {number} */ (x.from));
      const w = Math.max(pct(/** @type {number} */ (x.to)) - l, 1.5);
      const current = x === e ? ' aria-current="page"' : "";
      return `<a href="/explore/${x.id}/" tabindex="-1"${current} style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%;${hueOf(x.region)}" title="${esc(x.name)}">${esc(x.name)}</a>`;
    })
    .join("")}<span style="left:0">${label(lo)}</span><span style="right:0">${label(hi)}</span></div>`;
}

/** @param {Entry} e */
function entryPage(e) {
  const region = regionById.get(e.region);
  const lane = e.lane ? laneTitle.get(e.lane) : undefined;
  const { before, after } = X.neighbours(e, catalogue.entries);
  /** @type {{ entry: Entry, years: number }[]} */
  const meanwhile = X.meanwhile(e, catalogue.entries, 8);
  const skip = [before?.id, after?.id].filter(Boolean);
  /** @type {Entry[]} */
  const more = X.moreFromRegion(e, catalogue.entries, skip, 6);
  /** @type {Entry[]} */
  const lives = X.lives(e, catalogue.entries, 6);
  const story = e.story ? storyById.get(e.story) : undefined;
  const length = X.lengthText(e);
  const kicker = [KIND[/** @type {keyof typeof KIND} */ (e.kind)], [region?.title, lane].filter(Boolean).join(" › ")].join(" · ");

  let storyPanel;
  if (story && isBuilt(e) && e.chapter) {
    // Part of a larger story: open it at this entry's chapter.
    const step = loadStoryData(story).story.steps[e.chapter - 1];
    storyPanel = `<section class="sm-panel sm-panel--map"><h2>Part of the story map: ${esc(story.title)}</h2><p>It is told in chapter ${e.chapter}, “${esc(step.title)}”, of the larger story.</p><div class="sm-btns"><a class="sm-btn sm-btn--primary" href="/${story.id}/#${e.chapter}">Open at chapter ${e.chapter}</a><a class="sm-btn" href="/${story.id}/">Start from the beginning</a></div></section>`;
  } else if (story && isBuilt(e)) {
    storyPanel = `<section class="sm-panel sm-panel--map"><h2>Story map: ${esc(story.title)}</h2><p>Follow it across an illustrated map, chapter by chapter.</p><div class="sm-btns"><a class="sm-btn sm-btn--primary" href="/${story.id}/">Open the story map</a></div></section>`;
  } else if (story) {
    storyPanel = `<section class="sm-panel"><h2>Story map coming: ${esc(story.title)}</h2><p class="sm-muted">This map is still being drawn.</p></section>`;
  } else {
    storyPanel = '<section class="sm-panel"><h2>Story map to come</h2><p class="sm-muted">There is no story map for this yet. Its place on the timeline and its neighbours are below.</p></section>';
  }

  const main = [
    '<div class="sm-entry-main">',
    '<div class="sm-entry-head">',
    `<p class="sm-entry-kicker">${esc(kicker)}</p>`,
    `<h1>${esc(e.name)}</h1>`,
    e.native ? `<p class="sm-entry-native" lang="${esc(e.lang ?? "hi")}">${esc(e.native)}</p>` : "",
    `<p class="sm-entry-dates">${esc(X.rangeText(e))}${length ? ` <span>· ${esc(length)}</span>` : ""}</p>`,
    e.note ? `<p class="sm-entry-note">${esc(e.note)}</p>` : "",
    `<p class="sm-entry-source"><span class="sm-tag">${esc(e.source)}</span></p>`,
    "</div>",
    `<p class="sm-entry-summary">${esc(e.summary)}</p>`,
    contextStrip(e),
    storyPanel,
    e.lane && X.isDated(e)
      ? `<div class="sm-btns">${e.at ? `<a class="sm-btn" href="/explore/?at=${e.id}#atlas">Show on the atlas</a>` : ""}<a class="sm-btn" href="/explore/?at=${e.id}#timeline">Show on the timeline</a></div>`
      : "",
    e.lane || before || after ? `<div class="sm-pair">${mini("Before", before)}${mini("After", after)}</div>` : "",
    "</div>",
  ];
  const side = [
    '<div class="sm-entry-side">',
    meanwhile.length
      ? `<section class="sm-panel"><h2>Meanwhile elsewhere</h2><ul class="sm-list">${meanwhile
          .map(
            ({ entry: x, years }) =>
              `<li><a href="/explore/${x.id}/" style="${hueOf(x.region)}"><span class="sm-dot"></span><span><span class="sm-list__n">${esc(x.name)}</span><span class="sm-list__r">${esc(regionById.get(x.region)?.title ?? "")}</span></span><span class="sm-list__o">${years} ${years === 1 ? "year" : "years"}<br>together</span></a></li>`,
          )
          .join("")}</ul></section>`
      : "",
    lives.length
      ? `<section class="sm-panel"><h2>At work in these years</h2><ul class="sm-list">${lives
          .map(
            (x) =>
              `<li><a href="/explore/${x.id}/" style="${hueOf(x.region)}"><span class="sm-dot"></span><span><span class="sm-list__n">${esc(x.name)}</span><span class="sm-list__r">${esc(X.rangeText(x))}</span></span><span class="sm-list__o">${isBuilt(x) ? "Story map" : ""}</span></a></li>`,
          )
          .join("")}</ul></section>`
      : "",
    more.length
      ? `<section class="sm-panel"><h2>More from ${esc(region?.short ?? "")}</h2><ul class="sm-list">${more
          .map(
            (x) =>
              `<li><a href="/explore/${x.id}/" style="${hueOf(x.region)}"><span class="sm-dot"></span><span><span class="sm-list__n">${esc(x.name)}</span><span class="sm-list__r">${esc(X.rangeText(x))}</span></span><span class="sm-list__o">${isBuilt(x) ? "Story map" : ""}</span></a></li>`,
          )
          .join("")}</ul></section>`
      : "",
    "</div>",
  ];
  // Remember this entry as explored, for the hub's count and "Pick up where you left off".
  const remember = `<script>try{var k="sm-explored",a=JSON.parse(localStorage.getItem(k)||"[]").filter(function(x){return x!==${JSON.stringify(e.id)}});a.unshift(${JSON.stringify(e.id)});localStorage.setItem(k,JSON.stringify(a.slice(0,200)))}catch(err){}</script>`;
  return [
    BACK,
    `<main class="sm-page sm-entry" style="${hueOf(e.region)}">`,
    ...main,
    ...side,
    FOOT,
    "</main>",
    remember,
    THEME_SCRIPT,
  ].join("\n");
}

for (const e of catalogue.entries) {
  write(
    `explore/${e.id}/index.html`,
    render({
      title: `${e.name} · Story Maps · krishnabuilds`,
      description: e.summary,
      path: `/explore/${e.id}/`,
      explore: true,
      body: entryPage(e),
    }),
  );
}

// --- story pages ---------------------------------------------------------------

for (const story of manifest.stories) {
  if (story.status === "built") {
    const { story: data } = loadStoryData(story);
    write(
      `${story.id}/index.html`,
      render({
        title: `${story.title} · Story Maps · krishnabuilds`,
        description: data.description,
        path: `/${story.id}/`,
        story: true,
        body: storyPage(story),
      }),
    );
    continue;
  }
  const section = manifest.sections.find((s) => s.id === story.section);
  const collection = manifest.collections.find((c) => c.id === story.collection);
  const kicker = [section?.title, collection?.title].filter(Boolean).join(" · ");
  write(
    `${story.id}/index.html`,
    render({
      title: `${story.title} · Story Maps · krishnabuilds`,
      description: `${story.title}: an illustrated story map. Coming soon.`,
      path: `/${story.id}/`,
      body: [
        BACK,
        '<main class="sm-page sm-story">',
        `<p class="sm-kicker">${esc(kicker)}</p>`,
        `<h1>${esc(story.title)}</h1>`,
        `<span class="sm-tag">${esc(story.era)}</span>`,
        '<p class="sm-note">This map is still being drawn. Check back soon.</p>',
        FOOT,
        "</main>",
        THEME_SCRIPT,
      ].join("\n"),
    }),
  );
}

// --- 404 -----------------------------------------------------------------------

write(
  "404.html",
  render({
    title: "Not found · Story Maps · krishnabuilds",
    description: "This page is not on the map.",
    path: "/404.html",
    noindex: true,
    body: [
      BACK,
      '<main class="sm-page sm-story">',
      "<h1>Not on the map</h1>",
      '<p>There is no page here. <a href="/">See all story maps</a>.</p>',
      "</main>",
      THEME_SCRIPT,
    ].join("\n"),
  }),
);

console.log(
  `Built the front page, Explore, ${manifest.stories.length} story pages, ${catalogue.entries.length} entry pages and 404 into dist/`,
);
