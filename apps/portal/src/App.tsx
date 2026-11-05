import {
  apps,
  groups,
  isOpen,
  SiteHeader,
  statusLabels,
} from "@krishnabuilds/ui";

import { Preview } from "./Preview";

const SOURCE_URL = "https://github.com/kishore510/krishnabuilds.dev";
// Until the Portal has its own page, "How this is built" opens the decision log on GitHub.
const HOW_URL = `${SOURCE_URL}/blob/main/docs/decisions.md`;

export function App() {
  return (
    <>
      <SiteHeader apps={apps} />
      <main className="page">
        <section className="hero">
          <h1>Small web apps, built in the open.</h1>
          <p>Tools, games and experiments, with the decisions written down.</p>
          <div className="hero__links">
            <a className="button button--primary" href="#apps">
              Browse the apps
            </a>
            <a className="button" href={HOW_URL}>
              How this is built
            </a>
          </div>
        </section>
        <div id="apps" className="apps">
          {groups.map((group) => {
            const groupApps = apps.filter((app) => app.group === group.id);
            if (groupApps.length === 0) return null;
            return (
              <section
                key={group.id}
                className="group"
                aria-labelledby={`group-${group.id}`}
              >
                <h2 id={`group-${group.id}`} className="group__title">
                  {group.label}
                </h2>
                <ul className="cards">
                  {groupApps.map((app) => (
                    <li
                      key={app.name}
                      className={isOpen(app) ? "card card--link" : "card"}
                    >
                      <Preview name={app.name} />
                      <div className="card__head">
                        <h3 className="card__title">
                          {isOpen(app) ? (
                            <a href={app.url}>{app.name}</a>
                          ) : (
                            app.name
                          )}
                        </h3>
                        <span className="card__badge" data-status={app.status}>
                          {statusLabels[app.status]}
                        </span>
                      </div>
                      <p className="card__blurb">{app.blurb}</p>
                      <ul className="card__stack" aria-label="Built with">
                        {app.stack.map((tech) => (
                          <li key={tech} className="card__tag">
                            {tech}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
      <footer className="footer">
        <ul className="footer__links">
          <li>
            <a href={SOURCE_URL}>Source on GitHub</a>
          </li>
          <li>
            <a href={HOW_URL}>How this is built</a>
          </li>
        </ul>
        <p>Built with React and Vite, hosted on Cloudflare. System fonts.</p>
        <p>No ads, no tracking and no analytics.</p>
        <p>Personal projects, not financial advice.</p>
      </footer>
    </>
  );
}
