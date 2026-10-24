import { apps } from "./apps";
import { SiteHeader } from "./components/SiteHeader";

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
        <ul className="cards">
          {apps.map((app) => (
            <li key={app.name} className="card">
              <h2 className="card__title">
                {app.status === "live" ? (
                  <a href={app.url}>{app.name}</a>
                ) : (
                  app.name
                )}
              </h2>
              <p className="card__blurb">{app.blurb}</p>
              {app.status === "soon" && (
                <p className="card__badge">Coming soon</p>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
