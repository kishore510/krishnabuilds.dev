// Shared site header: site name on the left, app links and theme toggle on
// the right. Collapses behind a menu button on narrow screens.
//
// Self-contained so it can move into packages/ui along with apps.ts.

import "./SiteHeader.css";

import { useEffect, useId, useRef, useState } from "react";

import { type AppEntry, isOpen } from "../apps";
import { ThemeToggle } from "./ThemeToggle";

type SiteHeaderProps = {
  apps: AppEntry[];
};

export function SiteHeader({ apps }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="kb-site-header">
      <div className="kb-site-header__inner">
        <a className="kb-site-header__brand" href="https://krishnabuilds.dev">
          krishnabuilds
        </a>
        <button
          ref={buttonRef}
          type="button"
          className="kb-site-header__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
        <div id={panelId} className="kb-site-header__panel" data-open={open}>
          <nav aria-label="Apps">
            <ul className="kb-site-header__list">
              {apps.map((app) => (
                <li key={app.name}>
                  {isOpen(app) ? (
                    <a
                      className="kb-site-header__link"
                      href={app.url}
                      onClick={() => setOpen(false)}
                    >
                      {app.name}
                    </a>
                  ) : (
                    <span className="kb-site-header__soon">
                      {app.name} <small>Coming soon</small>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
