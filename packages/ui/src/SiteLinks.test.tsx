// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { AppEntry } from "./apps";
import { SiteLinks } from "./SiteLinks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const app = (name: string, status: AppEntry["status"]): AppEntry => ({
  name,
  blurb: "",
  url: `https://${name.toLowerCase()}.example`,
  group: "create",
  status,
  stack: [],
});

const apps = [
  app("Alpha", "live"),
  app("Bravo", "beta"),
  app("Charlie", "building"),
  app("Delta", "idea"),
];

let unmount = () => {};
afterEach(() => {
  unmount();
  document.body.innerHTML = "";
});

function render(current?: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<SiteLinks apps={apps} current={current} />));
  unmount = () => act(() => root.unmount());
  return host;
}

const links = (host: HTMLElement) => [...host.querySelectorAll("a")];

describe("SiteLinks", () => {
  it("renders the home link first", () => {
    const home = links(render())[0]!;
    expect(home.textContent).toBe("krishnabuilds");
    expect(home.getAttribute("href")).toBe("https://krishnabuilds.dev");
    expect(home.closest("nav")).not.toBeNull();
  });

  it("lists only apps that can be opened", () => {
    const host = render();
    const items = [...host.querySelectorAll("ul > li > a")];
    expect(items.map((a) => a.textContent)).toEqual(["Alpha", "Bravo"]);
    expect(items.map((a) => a.getAttribute("href"))).toEqual([
      "https://alpha.example",
      "https://bravo.example",
    ]);
  });

  it("marks only the current app with aria-current", () => {
    const host = render("Bravo");
    const marked = host.querySelectorAll('[aria-current="page"]');
    expect(marked).toHaveLength(1);
    expect(marked[0]!.textContent).toBe("Bravo");
  });

  it("opens links in the same tab", () => {
    expect(links(render()).every((a) => !a.hasAttribute("target"))).toBe(true);
  });
});
