import { apps, SiteHeader } from "@krishnabuilds/ui";
import { useState } from "react";

import { type Tag, decisions, tags } from "./decisions";
import { Footer } from "./Footer";
import { inline, Markdown } from "./Markdown";

const packages = ["tokens", "ui", "config"];
const appFolders = ["portal", "chalkline", "stickyard", "sumyard", "arcade", "story-maps"];
const domains = [
  "krishnabuilds.dev",
  "arcade.krishnabuilds.dev",
  "chalkline.krishnabuilds.dev",
  "stickyard.krishnabuilds.dev (+ relay)",
  "sumyard.krishnabuilds.dev",
  "story-maps.krishnabuilds.dev",
];

// Hand-written SVG, drawn with the shared tokens (.dg-* classes in styles.css).
function Diagram() {
  return (
    <svg
      className="diagram"
      viewBox="0 0 320 542"
      role="img"
      aria-labelledby="diagram-title"
    >
      <title id="diagram-title">
        One public repo with shared packages (tokens, ui, config) and six apps.
        GitHub Actions runs CI on every pull request and a path-filtered deploy
        per app, to one Cloudflare Worker per app on its own subdomain.
      </title>
      <rect className="dg-group" x="8" y="8" width="304" height="196" rx="10" />
      <text className="dg-title" x="20" y="30">
        Public GitHub repo · pnpm + Turborepo
      </text>
      <text className="dg-label" x="20" y="52">
        packages/
      </text>
      {packages.map((name, i) => (
        <g key={name}>
          <rect className="dg-box dg-box--accent" x={20 + i * 96} y="58" width="88" height="28" rx="6" />
          <text className="dg-text dg-text--on-accent" x={64 + i * 96} y="76">
            {name}
          </text>
        </g>
      ))}
      <text className="dg-label" x="20" y="108">
        apps/
      </text>
      {appFolders.map((name, i) => (
        <g key={name}>
          <rect className="dg-box" x={20 + (i % 3) * 96} y={114 + Math.floor(i / 3) * 36} width="88" height="28" rx="6" />
          <text className="dg-text" x={64 + (i % 3) * 96} y={132 + Math.floor(i / 3) * 36}>
            {name}
          </text>
        </g>
      ))}
      <path className="dg-arrow" d="M160 204v20" />
      <path className="dg-head" d="M160 232l-5-8h10z" />
      <rect className="dg-group" x="8" y="232" width="304" height="52" rx="10" />
      <text className="dg-title" x="20" y="254">
        GitHub Actions
      </text>
      <text className="dg-label" x="20" y="272">
        CI on every PR · a path-filtered deploy per app
      </text>
      <path className="dg-arrow" d="M160 284v20" />
      <path className="dg-head" d="M160 312l-5-8h10z" />
      <rect className="dg-group" x="8" y="312" width="304" height="222" rx="10" />
      <text className="dg-title" x="20" y="334">
        Cloudflare · one Worker per app
      </text>
      {domains.map((domain, i) => (
        <g key={domain}>
          <rect className="dg-box" x="20" y={344 + i * 30} width="280" height="24" rx="6" />
          <text className="dg-text dg-text--left" x="30" y={360 + i * 30}>
            {domain}
          </text>
        </g>
      ))}
    </svg>
  );
}

const principles = [
  "Prefer boring, well-known tooling over clever or new tooling.",
  "Flag over-engineering instead of quietly building it.",
  "One step at a time: small pull requests, never straight to main, squash merge only.",
  "Each app deploys on its own; CI is path-filtered so a change only rebuilds what it touches.",
  "Tokens first, then a small ui package. A component is shared only once two apps duplicate it.",
  "Write the decision down, with the why, in the repo.",
];

const guardrails = [
  "Secrets live only in GitHub Secrets and Cloudflare's secret store, never in the repo, and are never pasted into a chat.",
  "Decisions are logged in the repo (below), so the reasoning is reviewable alongside the code.",
  "No real personal or financial figures in a public repo: examples are generic or made up.",
  "Every app's history is scanned for secrets, and findings reported, before it is imported.",
];

export function HowPage() {
  const [filter, setFilter] = useState<Tag | "All">("All");
  const shown = decisions.filter((d) => filter === "All" || d.tag === filter);
  return (
    <>
      <SiteHeader apps={apps} />
      <main className="page story how">
        <p className="story__back">
          <a href="/">← All apps</a>
        </p>
        <header className="story__head">
          <h1>How this is built</h1>
          <p>
            One public monorepo, small pull requests and the decisions written
            down.
          </p>
        </header>
        <section className="story__section">
          <h2>The shape of it</h2>
          <Diagram />
        </section>
        <section className="story__section">
          <h2>Working principles</h2>
          <ul>
            {principles.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
        <section className="story__section">
          <h2>AI guardrails</h2>
          <p>
            The apps are built with an AI coding assistant, inside the repo's
            own rules:
          </p>
          <ul>
            {guardrails.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
        <section className="story__section" aria-labelledby="log-title">
          <h2 id="log-title">Decision log</h2>
          <p>
            Every decision from <code>docs/decisions.md</code>, newest first.
            Open one to read why.
          </p>
          <div className="filters" role="group" aria-label="Filter decisions">
            {(["All", ...tags] as const).map((tag) => (
              <button
                key={tag}
                type="button"
                className="filter"
                aria-pressed={filter === tag}
                onClick={() => setFilter(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="log__count" aria-live="polite">
            {shown.length} {shown.length === 1 ? "decision" : "decisions"}
          </p>
          <ul className="log">
            {shown.map((d) => (
              <li key={`${d.date}-${d.title}`}>
                <details className="log__item">
                  <summary>
                    <span className="log__date">{d.date}</span>
                    <span className="log__title">{inline(d.title)}</span>
                    <span className="log__tag">{d.tag}</span>
                  </summary>
                  <div className="log__body">
                    <Markdown text={d.body} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
