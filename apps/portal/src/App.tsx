import {
  apps,
  groups,
  isOpen,
  SiteHeader,
  statusLabels,
} from "@krishnabuilds/ui";

export function App() {
  return (
    <>
      <SiteHeader apps={apps} />
      <main className="page">
        <section className="hero">
          <h1>Welcome to krishnabuilds</h1>
          <p>
            A small collection of web apps I'm building: tools, games and
            experiments. Pick one and have a play.
          </p>
        </section>
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
      </main>
    </>
  );
}
