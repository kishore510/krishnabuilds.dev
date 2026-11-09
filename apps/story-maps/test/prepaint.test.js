// src/prepaint.js is a copy of the kb-theme pre-paint logic in
// packages/ui/src/theme.ts (Story Maps pages are plain HTML, so they can't
// import it). This test fails if the two drift: it writes the cookie with the
// real setTheme, then checks that the pre-paint script and the real getTheme
// read every cookie jar the same way.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

const prepaintSrc = readFileSync(new URL("../src/prepaint.js", import.meta.url), "utf8");
const themeUrl = new URL("../../../packages/ui/src/theme.ts", import.meta.url);
const themeSrc = readFileSync(themeUrl, "utf8");

/** A minimal document: a cookie jar and an <html> element. */
function fakeDocument(jar = "") {
  /** @type {Record<string, string>} */
  const attrs = {};
  const written = [];
  return {
    attrs,
    written,
    get cookie() {
      return jar;
    },
    set cookie(value) {
      written.push(value);
    },
    documentElement: {
      setAttribute: (name, value) => {
        attrs[name] = value;
      },
      removeAttribute: (name) => {
        delete attrs[name];
      },
    },
  };
}

/** Runs src/prepaint.js against a jar and returns the data-theme it set, or null. */
function prepaint(jar) {
  const doc = fakeDocument(jar);
  new Function("document", prepaintSrc)(doc);
  return doc.attrs["data-theme"] ?? null;
}

/** The data-theme a page should have for a theme: none for "system". */
const attrFor = (theme) => (theme === "system" ? null : theme);

async function loadTheme(doc) {
  globalThis.document = doc;
  globalThis.location = { hostname: "story-maps.krishnabuilds.dev", protocol: "https:" };
  return import(/* @vite-ignore */ themeUrl.href);
}

afterEach(() => {
  delete globalThis.document;
  delete globalThis.location;
});

describe("src/prepaint.js matches packages/ui/src/theme.ts", () => {
  it("uses the same cookie name", () => {
    const name = themeSrc.match(/const COOKIE = "([^"]+)"/)?.[1];
    expect(name).toBe("kb-theme");
    expect(prepaintSrc).toContain(`${name}=`);
  });

  it.each(["light", "dark", "system"])("reads back what setTheme(%s) stores", async (theme) => {
    const doc = fakeDocument();
    const { setTheme } = await loadTheme(doc);
    setTheme(theme);
    const [written] = doc.written;
    // A Max-Age=0 cookie is deleted, so the jar no longer holds it.
    const pair = written.split("; ")[0];
    const jar = /Max-Age=0(;|$)/.test(written) ? "a=1" : `a=1; ${pair}; b=2`;
    expect(prepaint(jar)).toBe(attrFor(theme));
  });

  it.each([
    "",
    "kb-theme=dark",
    "kb-theme=light",
    "x=1; kb-theme=dark",
    "kb-theme=light; x=1",
    "kb-theme=system",
    "kb-theme=sepia",
    "notkb-theme=dark",
    "kb-theme=darker",
  ])("agrees with getTheme for the jar %j", async (jar) => {
    const { getTheme } = await loadTheme(fakeDocument(jar));
    expect(prepaint(jar)).toBe(attrFor(getTheme()));
  });
});

// src/theme-picker.js has its own copy of setTheme (kbSetTheme) for the same
// reason. It must write exactly the cookie the real setTheme writes.
const pickerSrc = readFileSync(new URL("../src/theme-picker.js", import.meta.url), "utf8");

describe("src/theme-picker.js matches packages/ui/src/theme.ts", () => {
  it.each([
    ["light", "story-maps.krishnabuilds.dev", "https:"],
    ["dark", "story-maps.krishnabuilds.dev", "https:"],
    ["system", "story-maps.krishnabuilds.dev", "https:"],
    ["dark", "localhost", "http:"],
  ])("kbSetTheme(%s) on %s writes what setTheme writes", async (theme, hostname, protocol) => {
    const realDoc = fakeDocument();
    const { setTheme } = await loadTheme(realDoc);
    globalThis.location = { hostname, protocol };
    setTheme(theme);

    const pickerDoc = fakeDocument();
    const kbSetTheme = new Function("document", "location", `${pickerSrc}\nreturn kbSetTheme;`)(pickerDoc, { hostname, protocol });
    kbSetTheme(theme);

    expect(pickerDoc.written).toEqual(realDoc.written);
    expect(pickerDoc.attrs).toEqual(realDoc.attrs);
  });
});
