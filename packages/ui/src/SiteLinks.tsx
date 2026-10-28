// Unstyled site links: a home link followed by links to the other apps, for
// apps that put them in their own menu instead of using SiteHeader. No CSS and
// no token variables; the app styles the className hooks (or passes its own
// classes through `classNames`).

import { type AppEntry, apps as allApps, isOpen } from "./apps";

type SiteLinksProps = {
  /** Name of the app this is rendered in; its link gets aria-current="page". */
  current?: string;
  apps?: AppEntry[];
  /** Extra classes per part, added to the kb-site-links__* hooks. */
  classNames?: {
    root?: string;
    home?: string;
    list?: string;
    link?: string;
  };
};

const join = (hook: string, extra?: string) =>
  extra ? `${hook} ${extra}` : hook;

export function SiteLinks({
  current,
  apps = allApps,
  classNames = {},
}: SiteLinksProps) {
  return (
    <nav
      className={join("kb-site-links", classNames.root)}
      aria-label="krishnabuilds.dev"
    >
      <a
        className={join("kb-site-links__home", classNames.home)}
        href="https://krishnabuilds.dev"
      >
        krishnabuilds
      </a>
      <ul className={join("kb-site-links__list", classNames.list)}>
        {apps.filter(isOpen).map((app) => (
          <li key={app.name} className="kb-site-links__item">
            <a
              className={join("kb-site-links__link", classNames.link)}
              href={app.url}
              aria-current={app.name === current ? "page" : undefined}
            >
              {app.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
