// @ts-check
// Builds Story Maps into dist/:
//   dist/index.html          the hub, listing every story in manifest.json
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
const themePickerJs = read(`${APP_DIR}src/theme-picker.js`);

/**
 * @param {{ title: string, description: string, path: string, body: string, noindex?: boolean, story?: boolean, explore?: boolean }} page
 */
function render(page) {
  /** @type {Record<string, string>} */
  const vars = {
    title: esc(page.title),
    description: esc(page.description),
    url: `${ORIGIN}${page.path}`,
    robots: page.noindex ? '<meta name="robots" content="noindex">\n' : "",
    prepaint,
    styles: page.story ? `${styles}\n${engine.css}` : page.explore ? `${styles}\n${exploreCss}` : styles,
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
  '<footer class="sm-foot">Legends follow tradition; Chronicles follow archaeology and the historical record. Maps are stylised and not to scale. © krishnabuilds. All rights reserved.</footer>';

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
  const data = loadStoryData(entry);
  // JSON inside <script>: escape "<" so no "</script>" can end it early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return fill(
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
const KIND = { dynasty: "Dynasty", event: "Event", legend: "Legend", route: "Route" };

const hubData = {
  regions: catalogue.regions,
  entries: catalogue.entries,
  stories: Object.fromEntries(manifest.stories.map((s) => [s.id, { title: s.title, built: s.status === "built" }])),
};
// JSON inside <script>: escape "<" so no "</script>" can end it early.
const hubJson = JSON.stringify(hubData).replace(/</g, "\\u003c");

write(
  "index.html",
  render({
    title: "Story Maps · krishnabuilds",
    description: "Illustrated maps that follow a story across the land, and a timeline of the dynasties and empires behind them.",
    path: "/",
    explore: true,
    body: [
      HOME,
      '<main class="sm-page sm-hub">',
      '<section class="sm-hero"><h1>Story Maps</h1><p>Illustrated maps that follow a story across the land, and a timeline of who ruled where, and when.</p></section>',
      '<div class="sm-hub-bar"><nav class="sm-tabs" aria-label="Views"><a id="sm-tab-timeline" href="#timeline">Timeline</a><a id="sm-tab-browse" href="#browse">Browse</a></nav><p class="sm-count" id="sm-count"></p></div>',
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
      '<div class="sm-search"><label class="sm-sr" for="sm-q">Search</label><input id="sm-q" type="search" placeholder="Search dynasties, events, legends and regions" autocomplete="off"></div>',
      '<div class="sm-browse-body" id="sm-browse-body"></div>',
      "</section>",
      `<noscript><div class="sm-noscript"><h2>Everything</h2><ul>${catalogue.entries
        .map((e) => `<li><a href="/explore/${e.id}/">${esc(e.name)}</a> <span class="sm-muted">${esc(X.rangeText(e))}</span></li>`)
        .join("")}</ul></div></noscript>`,
      FOOT,
      "</main>",
      `<script type="application/json" id="sm-catalogue">${hubJson}</script>`,
      `<script>\n${exploreJs}\n${hubJs}</script>`,
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
  if (!e.lane || e.kind !== "dynasty") return "";
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
  const story = e.story ? storyById.get(e.story) : undefined;
  const length = X.lengthText(e);
  const kicker = [KIND[/** @type {keyof typeof KIND} */ (e.kind)], [region?.title, lane].filter(Boolean).join(" › ")].join(" · ");

  let storyPanel;
  if (story && isBuilt(e)) {
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
    e.lane && X.isDated(e) ? `<div class="sm-btns"><a class="sm-btn" href="/?at=${e.id}#timeline">Show on the timeline</a></div>` : "",
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
  `Built hub, ${manifest.stories.length} story pages, ${catalogue.entries.length} entry pages and 404 into dist/`,
);
