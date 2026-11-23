// Search-engine helpers for the build: the sitemap, robots.txt, JSON-LD and the
// plain-text copy of a story. Pure functions, so test/seo.test.js can run them.

/** @param {string} text */
const xml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** @param {string} text */
export const escHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * sitemap.xml for the pages that may be indexed. `lastmod` is optional (a date or date-time).
 * @param {string} origin @param {{ path: string, lastmod?: string }[]} pages
 */
export function sitemap(origin, pages) {
  const rows = pages.map((p) => `  <url><loc>${xml(origin + p.path)}</loc>${p.lastmod ? `<lastmod>${xml(p.lastmod.slice(0, 10))}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

/** @param {string} origin */
export const robots = (origin) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;

/**
 * Breadcrumb trail as JSON-LD. `trail` runs from the front page to this page.
 * @param {string} origin @param {{ name: string, path: string }[]} trail
 */
export const breadcrumb = (origin, trail) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: origin + t.path })),
});

/** @param {string} origin */
export const webSite = (origin) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Story Maps",
  url: `${origin}/`,
  description: "Illustrated story maps of history, legend and science, told chapter by chapter.",
});

/**
 * @param {string} origin
 * @param {{ type: string, name: string, description: string, path: string, published?: string }} page
 */
export const webPage = (origin, page) => ({
  "@context": "https://schema.org",
  "@type": page.type,
  name: page.name,
  ...(page.type === "Article" ? { headline: page.name } : {}),
  description: page.description,
  url: origin + page.path,
  inLanguage: "en",
  ...(page.published ? { datePublished: page.published.slice(0, 10) } : {}),
  isPartOf: { "@type": "WebSite", name: "Story Maps", url: `${origin}/` },
});

/** JSON-LD for a <script> tag: escape "<" so no "</script>" can end it early. @param {object} data */
export const ldScript = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>\n`;

/**
 * @typedef {{ title: string, when?: string, text: string, today?: string, phase?: string, source?: string, native?: string, lang?: string }} TextStep
 * @typedef {{ title: string, description: string, source?: string, note?: string, nativeLang?: string, phases?: Record<string, { name: string }>, steps: TextStep[], people?: { heading?: string, items: { name: string, native?: string, lang?: string, life?: string, role?: string, text?: string }[] } }} TextStory
 */

/**
 * A short copy of a story for crawlers on the story page itself, where the map is drawn by
 * script: its title, description, chapter titles and plain links. The whole text is on the
 * story's text page (`storyRead`), which this links to, so the two pages don't carry the same
 * text. Visually hidden and out of the reading order of assistive tech; the links take
 * tabindex="-1" so keyboard users never land on a link they cannot see. Its title is an <h2>,
 * since the player already has the page's one <h1>.
 * @param {TextStory} story @param {string} readHref
 * @param {{ text: string, href: string }[]} [links]
 */
export function storyText(story, readHref, links = []) {
  const chapters = story.steps.map((s) => `<li>${escHtml(s.title)}${s.when ? ` (${escHtml(s.when)})` : ""}</li>`).join("");
  const nav = links.length
    ? `<nav><h3>Related</h3><ul>${links.map((l) => `<li><a href="${escHtml(l.href)}" tabindex="-1">${escHtml(l.text)}</a></li>`).join("")}</ul></nav>`
    : "";
  return `<article class="sm-seo" aria-hidden="true"><h2>${escHtml(story.title)}</h2><p>${escHtml(story.description)}</p><p><a href="${escHtml(readHref)}" tabindex="-1">Read the whole story</a></p><ol>${chapters}</ol>${nav}</article>`;
}

/**
 * The whole story as a readable page: every chapter's text in order, with its date, source
 * and native name, a link to open each chapter on the map, the people cards, the story's note
 * and related links. The <main> content only; the build wraps it in the page shell.
 * @param {TextStory} story
 * @param {{ kicker: string, mapHref: string, links?: { text: string, href: string }[] }} opts
 */
export function storyRead(story, { kicker, mapHref, links = [] }) {
  const defaultLang = story.nativeLang ?? "hi";
  const native = (/** @type {string | undefined} */ text, /** @type {string | undefined} */ lang) =>
    text ? `<p class="sm-read-native" lang="${escHtml(lang ?? defaultLang)}" dir="auto">${escHtml(text)}</p>` : "";
  const contents = story.steps.map((s, i) => `<li><a href="#chapter-${i + 1}">${escHtml(s.title)}</a></li>`).join("");
  const chapters = story.steps
    .map((s, i) => {
      const meta = [`Chapter ${i + 1}`, s.phase ? story.phases?.[s.phase]?.name : undefined, s.when].filter(Boolean).map((x) => escHtml(String(x)));
      const source = s.source ?? story.source;
      return [
        `<section class="sm-read-ch" id="chapter-${i + 1}">`,
        `<p class="sm-read-meta">${meta.join(" · ")}${source ? ` <span class="sm-tag">${escHtml(source)}</span>` : ""}</p>`,
        `<h2>${escHtml(s.title)}</h2>`,
        native(s.native, s.lang),
        `<p>${escHtml(s.text)}</p>`,
        s.today ? `<p class="sm-read-today">${escHtml(s.today)}</p>` : "",
        `<p class="sm-read-open"><a href="${escHtml(mapHref)}#${i + 1}">See chapter ${i + 1} on the map</a></p>`,
        "</section>",
      ].join("");
    })
    .join("\n");
  const people = story.people?.items.length
    ? `<section class="sm-read-people"><h2>${escHtml(story.people.heading ?? "People")}</h2>${story.people.items
        .map(
          (p) =>
            `<div class="sm-read-person"><h3>${escHtml(p.name)}${p.life ? ` <span class="sm-muted">(${escHtml(p.life)})</span>` : ""}</h3>${native(p.native, p.lang)}${p.role ? `<p class="sm-read-role">${escHtml(p.role)}</p>` : ""}${p.text ? `<p>${escHtml(p.text)}</p>` : ""}</div>`,
        )
        .join("")}</section>`
    : "";
  const related = links.length
    ? `<nav class="sm-panel sm-read-related" aria-label="Related"><h2>Related</h2><ul>${links.map((l) => `<li><a href="${escHtml(l.href)}">${escHtml(l.text)}</a></li>`).join("")}</ul></nav>`
    : "";
  return [
    '<article class="sm-read">',
    '<header class="sm-read-head">',
    kicker ? `<p class="sm-kicker">${escHtml(kicker)}</p>` : "",
    `<h1>${escHtml(story.title)}</h1>`,
    `<p class="sm-read-desc">${escHtml(story.description)}</p>`,
    `<div class="sm-btns"><a class="sm-btn sm-btn--primary" href="${escHtml(mapHref)}">Open the story map</a></div>`,
    "</header>",
    `<nav class="sm-panel sm-read-contents" aria-label="Chapters"><h2>${story.steps.length} chapters</h2><ol>${contents}</ol></nav>`,
    chapters,
    people,
    story.note ? `<p class="sm-note">${escHtml(story.note)}</p>` : "",
    related,
    "</article>",
  ].join("\n");
}
