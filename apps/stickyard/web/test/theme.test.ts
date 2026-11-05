// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTheme } from "@krishnabuilds/ui";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateLocalTheme, nextPreference, parsePreference, readPreference, resolveTheme } from "../src/shell/theme";
import { STORAGE_KEYS, readKey, storageKey, writeKey } from "../src/storage";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
};

describe("theme preference", () => {
  it("cycles follow system -> light -> dark", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });

  it("resolves system from the OS setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("falls back to system for anything unexpected", () => {
    expect(parsePreference("purple")).toBe("system");
    expect(parsePreference(null)).toBe("system");
  });

  it("index.html applies the shared cookie first, then an older local choice, before first paint", () => {
    const html = readFileSync(join(import.meta.dirname, "..", "index.html"), "utf8");
    expect(html).toContain("document.cookie.match(/(?:^|; )kb-theme=(light|dark)(?:;|$)/)");
    expect(html).toContain(`localStorage.getItem("${STORAGE_KEYS.theme}")`);
  });
});

describe("shared theme (kb-theme cookie, v0.45.0)", () => {
  beforeEach(() => setTheme("system"));

  it("reads the shared cookie", () => {
    expect(readPreference()).toBe("system");
    setTheme("dark");
    expect(readPreference()).toBe("dark");
  });

  it("moves an older local choice into the cookie once, then removes the local copy", () => {
    expect(STORAGE_KEYS.theme).toBe("stickyard:theme");
    const store = memory();
    store.setItem(STORAGE_KEYS.theme, "dark");
    expect(migrateLocalTheme(store)).toBe("dark");
    expect(readPreference()).toBe("dark");
    expect(store.map.has(STORAGE_KEYS.theme)).toBe(false);
  });

  it("keeps a choice already made in another app over an older local one", () => {
    setTheme("light");
    const store = memory();
    store.setItem(STORAGE_KEYS.theme, "dark");
    expect(migrateLocalTheme(store)).toBe("light");
    expect(store.map.has(STORAGE_KEYS.theme)).toBe(false);
  });

  it("drops a local System choice and leaves the cookie alone", () => {
    const store = memory();
    store.setItem(STORAGE_KEYS.theme, "system");
    expect(migrateLocalTheme(store)).toBe("system");
    expect(store.map.has(STORAGE_KEYS.theme)).toBe(false);
  });
});

describe("storage", () => {
  it("every key uses the prefix", () => {
    for (const key of Object.values(STORAGE_KEYS)) expect(key.startsWith(storageKey(""))).toBe(true);
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readKey("stickyard:x", blocked)).toBeNull();
    expect(writeKey("stickyard:x", "1", blocked)).toBe(false);
    expect(readKey("stickyard:x", undefined)).toBeNull();
  });
});
