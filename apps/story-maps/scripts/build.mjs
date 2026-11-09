// @ts-check
// Builds Story Maps into dist/:
//   dist/index.html          the hub, listing every story in manifest.json
//   dist/<id>/index.html     one page per story
//   dist/404.html            served by Cloudflare for unknown paths
//   dist/fonts/              self-hosted fonts and their OFL licences
// Every page inlines the shared tokens CSS, the painted theme and the
// kb-theme pre-paint script, so it needs nothing else except the fonts.
// Built stories also inline the engine (engine/src) and their data.

import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { checkStory, loadEngineAssets, loadMapFunctions, loadStoryData } from "./engine.mjs";
import { APP_DIR, loadManifest, validateManifest } from "./manifest.mjs";

/** @typedef {import("./manifest.mjs").Story} Story */

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

/**
 * @param {{ title: string, description: string, path: string, body: string, noindex?: boolean, story?: boolean }} page
 */
function render(page) {
  /** @type {Record<string, string>} */
  const vars = {
    title: esc(page.title),
    description: esc(page.description),
    url: `${ORIGIN}${page.path}`,
    robots: page.noindex ? '<meta name="robots" content="noindex">\n' : "",
    prepaint,
    styles: page.story ? `${styles}\n${engine.css}` : styles,
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

const HOME = '<header class="sm-top"><a href="https://krishnabuilds.dev">← krishnabuilds</a></header>';
const BACK = '<header class="sm-top"><a href="/">← All story maps</a></header>';
const FOOT =
  '<footer class="sm-foot">Legends follow tradition; Chronicles follow archaeology and the historical record. Maps are stylised and not to scale. © krishnabuilds. All rights reserved.</footer>';

/** @param {Story} story */
function card(story) {
  const badge =
    story.status === "built"
      ? '<span class="sm-badge sm-badge--built">Open</span>'
      : '<span class="sm-badge">Coming soon</span>';
  return `<li><a class="sm-card" href="/${story.id}/"><span class="sm-card__title">${esc(story.title)}</span><span class="sm-tags"><span class="sm-tag">${esc(story.era)}</span>${badge}</span></a></li>`;
}

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

/** @param {Story[]} stories */
const cards = (stories) => `<ul class="sm-cards">${stories.map(card).join("")}</ul>`;

// --- hub ---------------------------------------------------------------------

const sections = manifest.sections.map((section) => {
  const stories = manifest.stories.filter((s) => s.section === section.id);
  const parts = [
    `<section class="sm-section" aria-labelledby="s-${section.id}">`,
    `<h2 id="s-${section.id}">${esc(section.title)}</h2>`,
    `<p class="sm-blurb">${esc(section.blurb)}</p>`,
  ];
  const loose = stories.filter((s) => s.collection === undefined);
  if (loose.length) parts.push(cards(loose));
  for (const c of manifest.collections.filter((c) => c.section === section.id)) {
    const inCollection = stories.filter((s) => s.collection === c.id);
    if (inCollection.length) parts.push(`<h3>${esc(c.title)}</h3>`, cards(inCollection));
  }
  if (!stories.length) parts.push('<p class="sm-empty">Nothing here yet.</p>');
  parts.push("</section>");
  return parts.join("\n");
});

write(
  "index.html",
  render({
    title: "Story Maps · krishnabuilds",
    description: "Illustrated maps that follow a story across the land, one chapter at a time.",
    path: "/",
    body: [
      HOME,
      '<main class="sm-page">',
      '<section class="sm-hero"><h1>Story Maps</h1><p>Illustrated maps that follow a story across the land, one chapter at a time.</p></section>',
      ...sections,
      FOOT,
      "</main>",
    ].join("\n"),
  }),
);

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
    ].join("\n"),
  }),
);

console.log(`Built hub, ${manifest.stories.length} story pages and 404 into dist/`);
