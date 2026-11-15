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
 * The story's chapters as plain HTML, so the text is in the page itself and not only in the
 * script that draws the map. Visually hidden and out of the reading order of assistive tech:
 * the map already offers every chapter, this is a copy for crawlers.
 * @param {{ title: string, description: string, steps: { title: string, when?: string, text: string, today?: string }[] }} story
 */
export function storyText(story) {
  const chapters = story.steps
    .map((s, i) => `<section><h2>${i + 1}. ${escHtml(s.title)}${s.when ? ` (${escHtml(s.when)})` : ""}</h2><p>${escHtml(s.text)}</p>${s.today ? `<p>${escHtml(s.today)}</p>` : ""}</section>`)
    .join("");
  return `<article class="sm-seo" aria-hidden="true"><h1>${escHtml(story.title)}</h1><p>${escHtml(story.description)}</p>${chapters}</article>`;
}
