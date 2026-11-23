import { describe, expect, it } from "vitest";

import { breadcrumb, ldScript, robots, sitemap, storyText, webPage } from "../scripts/seo.mjs";

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
  it("copies every chapter into the page, escaped", () => {
    const html = storyText({ title: "T & U", description: "Desc", steps: [{ title: "One", when: "c. 1 BCE", text: "A <b> text" }, { title: "Two", text: "More", today: "Today" }] });
    expect(html).toContain("<h2>T &amp; U</h2>");
    expect(html).not.toContain("<h1");
    expect(html).toContain("1. One (c. 1 BCE)");
    expect(html).toContain("A &lt;b&gt; text");
    expect(html).toContain("2. Two");
    expect(html).toContain("<p>Today</p>");
    expect(html).not.toContain("<nav");
  });

  it("adds related links that keyboard focus skips", () => {
    const html = storyText({ title: "T", description: "D", steps: [] }, [{ text: "A & B", href: "/explore/a/" }]);
    expect(html).toContain('<a href="/explore/a/" tabindex="-1">A &amp; B</a>');
  });
});
