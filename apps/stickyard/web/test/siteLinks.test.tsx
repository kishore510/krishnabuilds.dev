// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The site links (krishnabuilds.dev and the other apps) in the top bar menu, below the commands
 * and outside the menu role. The app is rendered for real, as in shell.test.tsx; the connection
 * check is stubbed. happy-dom has no Tab default action, so `tab` moves focus the way a browser
 * would when the app doesn't handle the key itself.
 */

vi.mock("../src/connection/store", async () => {
  const { create } = await import("zustand");
  return { useConnectionCheck: create(() => ({ status: "connected", start: () => () => {} })) };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

async function mount() {
  window.history.replaceState(null, "", "/#/");
  vi.resetModules();
  const { App } = await import("../src/App");
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<App />));
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

const menuButton = () =>
  [...document.querySelectorAll<HTMLElement>("button")].find((b) => /^Menu/.test(b.getAttribute("aria-label") ?? ""));
const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
const commands = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
const siteNav = () => document.querySelector<HTMLElement>('nav[aria-label="krishnabuilds.dev"]');
const links = () => [...(siteNav()?.querySelectorAll<HTMLElement>("a[href]") ?? [])];

async function openMenu() {
  await act(async () => menuButton()?.click());
  await settle();
}

async function press(key: string, init: KeyboardEventInit = {}) {
  const target = document.activeElement ?? document.body;
  let prevented = false;
  await act(async () => {
    prevented = !target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
  await settle();
  return prevented;
}

/** Tab (or Shift+Tab): the app's handler first, then the browser's move to the next tabbable element. */
async function tab(shiftKey = false) {
  const from = document.activeElement as HTMLElement;
  if (await press("Tab", { shiftKey })) return;
  const tabbable = [...document.querySelectorAll<HTMLElement>("a[href], button, input, textarea, select, [tabindex]")].filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute("disabled"),
  );
  const next = tabbable[tabbable.indexOf(from) + (shiftKey ? -1 : 1)];
  await act(async () => next?.focus());
  await settle();
}

beforeEach(() => localStorage.clear());

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

describe("site links in the menu", () => {
  it("lists the home link and the other apps, with Stickyard marked current, outside the menu role", async () => {
    await mount();
    await openMenu();
    const [home, ...apps] = links();
    expect(home?.getAttribute("href")).toBe("https://krishnabuilds.dev");
    expect(apps.map((a) => a.textContent)).toEqual(["Arcade", "Chalkline", "Stickyard", "Sumyard"]);
    for (const a of apps) {
      const current = a.textContent === "Stickyard";
      expect(a.getAttribute("aria-current"), a.textContent ?? "").toBe(current ? "page" : null);
    }
    expect(apps.find((a) => a.textContent === "Stickyard")?.getAttribute("href")).toBe("https://stickyard.krishnabuilds.dev");
    expect(menu()?.contains(siteNav())).toBe(false);
    expect(menu()?.getAttribute("aria-label")).toBe("Menu");
    for (const a of links()) expect(a.getAttribute("role")).toBeNull();
  });

  it("Tab moves from the last command into the links, through them, and out (closing the menu)", async () => {
    await mount();
    await openMenu();
    await press("End");
    expect(document.activeElement).toBe(commands().at(-1));
    await tab();
    expect(document.activeElement).toBe(links()[0]);
    for (const link of links().slice(1)) {
      await tab();
      expect(document.activeElement).toBe(link);
    }
    await tab();
    expect(menu()).toBeNull();
    expect(siteNav()).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("Shift+Tab goes back through the links to the last command, then closes", async () => {
    await mount();
    await openMenu();
    const all = links();
    await act(async () => all.at(-1)?.focus());
    for (const link of all.slice(0, -1).reverse()) {
      await tab(true);
      expect(document.activeElement).toBe(link);
    }
    await tab(true);
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(commands().at(-1));
    await tab(true);
    expect(menu()).toBeNull();
  });

  it("Escape in the links closes the menu and returns focus to the menu button", async () => {
    await mount();
    await openMenu();
    await act(async () => links()[2]?.focus());
    expect(await press("Escape")).toBe(true);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it("pressing in the links keeps the menu open; pressing outside closes it", async () => {
    await mount();
    await openMenu();
    await act(async () => links()[1]?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await settle();
    expect(menu()).not.toBeNull();
    await act(async () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await settle();
    expect(menu()).toBeNull();
  });
});
