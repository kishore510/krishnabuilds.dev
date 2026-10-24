// Shared site header: site name on the left, app links on the right.
// Collapses behind a menu button on narrow screens.
//
// Self-contained so it can move into packages/ui along with apps.ts.

import "./SiteHeader.css";

import { useEffect, useId, useRef, useState } from "react";

import type { AppEntry } from "../apps";

type SiteHeaderProps = {
  apps: AppEntry[];
};

export function SiteHeader({ apps }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
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
        <nav className="kb-site-header__nav" aria-label="Apps">
          <button
            ref={buttonRef}
            type="button"
            className="kb-site-header__toggle"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
          <ul
            id={listId}
            className="kb-site-header__list"
            data-open={open}
          >
            {apps.map((app) => (
              <li key={app.name}>
                {app.status === "live" ? (
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
      </div>
    </header>
  );
}
