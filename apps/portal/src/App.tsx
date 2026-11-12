import {
  apps,
  groups,
  isOpen,
  SiteHeader,
  statusLabels,
} from "@krishnabuilds/ui";

import { decisions } from "./decisions";
import { Footer, HOW_URL } from "./Footer";
import { Preview } from "./Preview";
import { storyFor } from "./stories";

// Apps in group order (Create, Calculate, Play, Explore, Tinker). The group
// is shown on each card rather than as a heading over a one-card section.
const ordered = groups.flatMap((group) =>
  apps
    .filter((app) => app.group === group.id)
    .map((app) => ({ app, group: group.label })),
);

const liveCount = apps.filter(isOpen).length;
const latest = decisions.slice(0, 3);

// "Story Maps" -> "story-maps": the card's data-app, which sets its colour.
function slug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

// Decision titles are Markdown headings; drop the code ticks for plain text.
function plain(title: string) {
  return title.replaceAll("`", "");
}

export function App() {
  return (
    <>
      <SiteHeader apps={apps} />
      <div className="home">
        <main className="page">
          <section className="hero">
            <p className="eyebrow">Personal projects · Open source</p>
            <h1>
              Small web apps, <span className="hero__mark">built in the open.</span>
            </h1>
            <div className="hero__strip" aria-hidden="true">
              {ordered.map(({ app }) => (
                <span key={app.name} data-app={slug(app.name)} />
              ))}
            </div>
            <p className="hero__lede">
              Tools, games and experiments, with the decisions written down.
            </p>
            <div className="hero__links">
              <a className="button button--primary" href="#apps">
                Browse the apps
              </a>
              <a className="button" href={HOW_URL}>
                How this is built
              </a>
            </div>
            <dl className="facts">
              <div>
                <dt>Apps live</dt>
                <dd>{liveCount}</dd>
              </div>
              <div>
                <dt>Decisions logged</dt>
                <dd>{decisions.length}</dd>
              </div>
              <div>
                <dt>Ads and trackers</dt>
                <dd>0</dd>
              </div>
            </dl>
          </section>

          <section id="apps" className="section" aria-labelledby="apps-title">
            <div className="section__head">
              <h2 id="apps-title">The apps</h2>
              <p>Each one is its own small world. Pick one and have a play.</p>
            </div>
            <ul className="cards">
              {ordered.map(({ app, group }) => {
                const story = storyFor(app.name);
                return (
                  <li
                    key={app.name}
                    className={isOpen(app) ? "card card--link" : "card"}
                    data-app={slug(app.name)}
                  >
                    <div className="card__art">
                      <Preview name={app.name} />
                    </div>
                    <div className="card__body">
                      <p className="card__meta">
                        <span className="card__group">{group}</span>
                        <span className="card__badge" data-status={app.status}>
                          {statusLabels[app.status]}
                        </span>
                      </p>
                      <h3 className="card__title">
                        {isOpen(app) ? (
                          <a href={app.url}>{app.name}</a>
                        ) : (
                          app.name
                        )}
                      </h3>
                      <p className="card__blurb">{app.blurb}</p>
                      <ul className="card__stack" aria-label="Built with">
                        {app.stack.map((tech) => (
                          <li key={tech} className="card__tag">
                            {tech}
                          </li>
                        ))}
                      </ul>
                      <p className="card__actions">
                        {isOpen(app) && (
                          <span className="card__open" aria-hidden="true">
                            Open {app.name} <span className="card__arrow">→</span>
                          </span>
                        )}
                        {story && (
                          <a className="card__story" href={`/stories/${story.slug}`}>
                            Read the story
                            <span className="visually-hidden"> of {app.name}</span>
                          </a>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="section" aria-labelledby="log-title">
            <div className="section__head">
              <h2 id="log-title">Fresh from the decision log</h2>
              <p>
                Every choice behind these apps is written down, with the reason
                why.
              </p>
            </div>
            <ol className="latest">
              {latest.map((decision) => (
                <li key={`${decision.date}-${decision.title}`}>
                  <time dateTime={decision.date}>{decision.date}</time>
                  <span className="latest__title">{plain(decision.title)}</span>
                  <span className="latest__tag">{decision.tag}</span>
                </li>
              ))}
            </ol>
            <p className="latest__more">
              <a className="button" href={HOW_URL}>
                Read all {decisions.length} decisions
              </a>
            </p>
          </section>
        </main>
      </div>
      <Footer />
    </>
  );
}
