import { describe, expect, it } from "vitest";

import { breadcrumb, ldScript, robots, sitemap, storyRead, storyText, webPage } from "../scripts/seo.mjs";

const ORIGIN = "https://example.test";

describe("sitemap", () => {
  it("lists each page once, with a date-only lastmod when there is one", () => {
    const xml = sitemap(ORIGIN, [{ path: "/" }, { path: "/a/", lastmod: "2026-11-13T09:30" }]);
    expect(xml).toContain("<loc>https://example.test/</loc></url>");
    expect(xml).toContain("<loc>https://example.test/a/</loc><lastmod>2026-11-13</lastmod>");
  });

  it("escapes characters that are special in XML", () => {
    expect(sitemap(ORIGIN, [{ path: "/a&b/" }])).toContain("/a&amp;b/");
  });
});

describe("robots", () => {
  it("allows the site, keeps crawlers off the API and names the sitemap", () => {
    const txt = robots(ORIGIN);
    expect(txt).toContain("Allow: /");
    expect(txt).toContain("Disallow: /api/");
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

describe("structured data", () => {
  it("builds a numbered breadcrumb trail", () => {
    const ld = breadcrumb(ORIGIN, [{ name: "Home", path: "/" }, { name: "Page", path: "/p/" }]);
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1].item).toBe("https://example.test/p/");
  });

  it("gives an Article a headline and a publication date", () => {
    const ld = webPage(ORIGIN, { type: "Article", name: "N", description: "D", path: "/n/", published: "2026-11-13T09:30" });
    expect(ld.headline).toBe("N");
    expect(ld.datePublished).toBe("2026-11-13");
  });

  it("cannot be closed early by text inside it", () => {
    expect(ldScript({ a: "</script><b>" })).not.toContain("</script><b>");
  });
});

describe("storyText", () => {
  const story = { title: "T & U", description: "Desc", steps: [{ title: "One", when: "c. 1 BCE", text: "A <b> text" }, { title: "Two", text: "More" }] };

  it("lists the chapter titles and links to the text page, without the chapter text", () => {
    const html = storyText(story, "/t/read/");
    expect(html).toContain("<h2>T &amp; U</h2>");
    expect(html).not.toContain("<h1");
    expect(html).toContain("<li>One (c. 1 BCE)</li>");
    expect(html).not.toContain("A &lt;b&gt; text");
    expect(html).toContain('<a href="/t/read/" tabindex="-1">Read the whole story</a>');
    expect(html).not.toContain("<nav");
  });

  it("adds related links that keyboard focus skips", () => {
    const html = storyText({ title: "T", description: "D", steps: [] }, "/t/read/", [{ text: "A & B", href: "/explore/a/" }]);
    expect(html).toContain('<a href="/explore/a/" tabindex="-1">A &amp; B</a>');
  });
});

describe("storyRead", () => {
  const story = {
    title: "T & U",
    description: "Desc",
    source: "History",
    note: "A note",
    nativeLang: "fr",
    phases: { p1: { name: "Rise" } },
    steps: [
      { title: "One", phase: "p1", when: "1800", native: "Un", text: "A <b> text", today: "Now a museum" },
      { title: "Two", text: "More", source: "Tradition", native: "Zwei", lang: "de" },
    ],
    people: { heading: "People", items: [{ name: "N", life: "1–2", role: "Role", text: "Bio" }] },
  };
  const html = storyRead(story, { kicker: "Wars", mapHref: "/t/", links: [{ text: "Rel", href: "/explore/r/" }] });

  it("has one h1 and every chapter's full text, escaped, in order", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("<h1>T &amp; U</h1>");
    expect(html).toContain("A &lt;b&gt; text");
    expect(html.indexOf('id="chapter-1"')).toBeLessThan(html.indexOf('id="chapter-2"'));
    expect(html).toContain("Now a museum");
  });

  it("gives each chapter its phase, date, source, native name and a link to it on the map", () => {
    expect(html).toContain("Chapter 1 · Rise · 1800");
    expect(html).toContain('<span class="sm-tag">History</span>');
    expect(html).toContain('<span class="sm-tag">Tradition</span>');
    expect(html).toContain('lang="fr" dir="auto">Un<');
    expect(html).toContain('lang="de" dir="auto">Zwei<');
    expect(html).toContain('href="/t/#2"');
    expect(html).toContain('<a href="#chapter-2">Two</a>');
  });

  it("adds the people, the note and plain related links", () => {
    expect(html).toContain("<h2>People</h2>");
    expect(html).toContain("Bio");
    expect(html).toContain("A note");
    expect(html).toContain('<a href="/explore/r/">Rel</a>');
    expect(html).not.toContain("tabindex");
  });
});
