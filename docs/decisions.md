# Decision log

Newest at the bottom. Each entry: date, decision, why.

## 2026-10-24 — Monorepo with pnpm + Turborepo

All web apps live in one repo using pnpm workspaces and Turborepo. pnpm is fast and strict about dependencies; Turborepo gives task orchestration and caching with very little config. Both are widely used, boring choices.

## 2026-10-24 — `apps/*` and `packages/*` layout

Deployable apps go in `apps/*`; shared code (`tokens`, `ui`, `config`) goes in `packages/*`. This is the conventional Turborepo layout, so tooling and docs work without customisation.

## 2026-10-24 — Independent Cloudflare deploys with path-filtered CI

Each app deploys to Cloudflare on its own. CI is path-filtered so changing one app does not rebuild or redeploy the others. Keeps apps decoupled and deploys fast.

## 2026-10-24 — Design system: tokens first, then a small `ui` package

Start with design tokens only. Add a small `ui` package later, and only extract a component once it is duplicated in two apps. Avoids building a component library nobody uses.

## 2026-10-24 — Stonks on GitHub Actions cron + D1 + read-only Worker dashboard

Stonks data refresh runs as a scheduled GitHub Actions workflow writing to Cloudflare D1, with a read-only Worker serving the dashboard. Removes the need for the always-on Pi. Credentials live in GitHub Secrets / Cloudflare secrets only.

## 2026-10-24 — Public repo

The repo is public, including its full git history. Consequences: no secrets or personal/financial data ever committed, and every app's history is scanned for secrets (and findings reported) before it is imported.

## 2026-10-24 — Squash merge only

PRs are squash merged to keep `main` history linear and one commit per change.

## 2026-10-24 — Two-layer tokens with CSS-variable theming via data-theme

`packages/tokens` has primitives (raw palette, spacing, type, radii) and semantic tokens (bg, surface, text, accent, etc.), each semantic token with a light and dark value pointing at primitives. A plain Node script generates `dist/tokens.css`. With no `data-theme` on `<html>` the page follows the OS setting; `data-theme="light"` or `"dark"` overrides it. The Portal toggle will only set that attribute, so adding it needs no token changes. No Style Dictionary or other new tooling.

## 2026-10-24 — Portal is Vite + React + TypeScript

The Portal uses the same stack as the other apps (React 19, TypeScript strict, Vite 8) so the whole monorepo shares one toolchain and shared components can later live in `packages/ui`. Astro and other static-site frameworks were rejected as an extra framework for a single landing page.

## 2026-10-24 — Portal deploys as a Worker with static assets, via GitHub Actions

The Portal deploys with `wrangler deploy` from a path-filtered GitHub Actions workflow on pushes to `main`, as a Cloudflare Worker serving static assets (not Pages or dashboard Git integration). Same tooling as Stonks will use later. Credentials live in GitHub Secrets only. API token is scoped to one account and zone, with a 1-year expiry.

## 2026-10-24 — Portal landing page: plain React + CSS, one app list

The landing page is plain React and CSS. A single typed array in `apps/portal/src/apps.ts` drives both the header menu and the app cards. No router, UI library or CSS framework. The header and app list stay local to `apps/portal` until a second app needs them. Stonks is intentionally left off the list until it goes live.

## 2026-10-24 — Cross-app consistency via shared tokens and header

All apps are migrated into this repo and share `@krishnabuilds/tokens`, plus a shared site header and app list in `packages/ui` (extracted when the first migrated app needs them). Each app lives on its own subdomain, so moving between apps is a full page load; the shared header is what makes it feel like one product.

## 2026-10-24 — Theme preference stored in a cookie on `.krishnabuilds.dev`

The theme preference is stored in a cookie scoped to `.krishnabuilds.dev`, not `localStorage`. `localStorage` is per subdomain, so a choice made in one app would not carry over to the others.

## 2026-10-24 — Inline head script applies the theme before first paint

`apps/portal/index.html` has a few lines of inline script that read the `kb-theme` cookie and set `data-theme` on `<html>` before the stylesheet paints, so a saved light/dark choice never flashes the OS theme first. It duplicates the cookie name and values in `src/theme.ts`, so the two must stay in sync. "System" is not stored: choosing it expires the cookie. The cookie gets `Secure` only on https, because browsers drop `Secure` cookies over plain http (for example a phone testing the dev server on the LAN).

## 2026-10-25 — Portal structure: grouped apps with story pages

The Portal organises apps into four groups named by verb: Create (Chalkline, Stickyard), Calculate (Sumyard, Stonks), Play (Arcade) and Tinker (hardware and experiments, e.g. the rover). Groups are kept to four or five; a new app must fit one, or adding a group is a deliberate decision. Names can change later.

Each app gets a short story page in addition to its launch link: why it was built, what it does, architecture, key decisions and trade-offs, how AI helped, and what would change. A "How this is built" page covers the platform (monorepo, tokens, independent deploys, CI, decision log, AI guardrails). The aim is a portfolio that shows how things are built, not just links.

The app list in apps/portal/src/apps.ts will gain group, status (live, beta, building, idea) and stack fields. No filtering, search or tags until there are around 10 apps. Content stays strictly about personal projects and generic lessons; no employer detail.

## 2026-10-28 — History imports use a merge commit

PRs are squash merged by default. The exception is importing an existing repo into the monorepo (for example Chalkline into apps/chalkline): that PR must use a merge commit so the original commit history is preserved. Squash and rebase merges are not allowed for imports.

## 2026-10-28 — Chalkline deploys to chalkline.krishnabuilds.dev as a Worker

Same pattern as the Portal: a Worker serving static assets, deployed by a path-filtered GitHub Actions workflow on pushes to main. Chalkline's tests run in CI and before each deploy.

## 2026-10-28 — Chalkline lint placeholder and TypeScript 7

Chalkline is on TypeScript 7 while the rest of the repo is on 6, and the shared ESLint config does not support 7 yet. Chalkline's lint script runs tsc --noEmit as a placeholder until typescript-eslint supports TypeScript 7.

## 2026-10-28 — No real personal financial data in the public repo

Sumyard's mortgage cross-check file must never contain figures from real statements, and no real balances, salaries or account details go into any file in this public repo. Real-figure checking is done locally and not committed.

## 2026-10-28 — Sumyard keeps Biome and deploys to sumyard.krishnabuilds.dev

Sumyard deploys as a Worker with static assets, same pattern as Chalkline and the Portal. It keeps Biome for linting, because the shared ESLint config is for the other apps and Sumyard is on TypeScript 7. Revisit when typescript-eslint supports TypeScript 7.

## 2026-10-28 — packages/ui starts with the site header and app list

Chalkline and Sumyard are both migrated, so the "extract once duplicated in two apps" rule is met for the header and the app list. packages/ui is source-only (each app's Vite compiles it) with plain CSS on the shared tokens. The Portal adopts it first; Chalkline gets a slim header with a link home and an app switcher, and Sumyard adopts it after, in separate PRs.

## 2026-10-28 — Chalkline gets site links inside its menu, not a header bar

Chalkline is a full-screen canvas tool and phone screen space is scarce, so it gets a link home and an app switcher inside its existing toolbar menu instead of an always-visible header. packages/ui provides an unstyled SiteLinks component that each app styles itself until the app adopts the shared tokens.

## 2026-10-28 — packages/ui components import only their own CSS

An app that uses one component should not ship another component's styles. packages/ui declares only its CSS files as side effects (`"sideEffects": ["**/*.css"]`), so importing SiteLinks from the package entry no longer pulls in SiteHeader's or ThemeToggle's CSS.

## 2026-10-28 — Sumyard gets site links; external-URL guard allows only the krishnabuilds.dev origins

Sumyard adopts the shared SiteLinks (home link and app switcher) in its existing chrome. Its build guard against external URLs now allows only https://krishnabuilds.dev and its subdomains, so links within the platform work while any other external URL still fails the build.

## 2026-10-28 — Arcade deploys from GitHub Actions to the existing Worker

Arcade moves from Cloudflare Workers Builds on its own repo to a path-filtered GitHub Actions deploy in the monorepo, to the same Worker (krishnabuilds-arcade) so the KV play counts and the domain carry over. Arcade stays plain static files plus one Worker with no build step; the assets upload uses an ignore list so only the site is published.

## 2026-10-28 — Arcade gets site links via a plain script, not packages/ui

Arcade has no build step and 34 standalone HTML games, so it cannot use the React SiteLinks component. It gets a dependency-free assets/site-links.js with the same links. The app list is duplicated there until a layout and tokens pass; keep it in sync with packages/ui.

## 2026-10-28 — Stickyard flattened into pnpm workspace members

Stickyard was an npm workspace (shared, web, worker). pnpm cannot nest workspaces, so its three packages and its root tooling package are plain members of the monorepo workspace, built and tested by Turborepo. Package names stay @stickyard/* for now, and it keeps TypeScript 5.9 and has no linter; both are revisited later. This PR converts only. The Worker (name `stickyard`) and the GitHub Pages site keep deploying from the old repo until the deploy PR.

## 2026-10-28 — Stickyard deploys as two Workers from one Actions workflow

The relay Worker keeps its name (stickyard) and workers.dev address so live rooms and the hardcoded web config keep working, and deploys with --keep-vars. The web app deploys as a Worker with static assets at stickyard.krishnabuilds.dev, after the relay so the new origin is allowed first. ALLOWED_ORIGINS lists both the new site and the old GitHub Pages origin until the old site is retired. Secrets (create passcode, signing key, creation switch) stay on the Worker and are never handled by this workflow.

## 2026-10-28 — Stickyard is live on the Portal with site links

Stickyard deploys from the monorepo as a relay Worker plus a web app Worker, is listed on the Portal as live in the Create group, and uses the shared SiteLinks inside its existing menu.

## 2026-10-29 — Stickyard creation switch lives at the repo root

The Stickyard creation kill switch (creation-switch.yml) was ported from the archived old repo to .github/workflows/ in the monorepo, because GitHub only runs workflows from the root. It is manual-only (workflow_dispatch), sets the Worker secret CREATION_ENABLED to true or false using the existing CLOUDFLARE_API_TOKEN, and shares the deploy-stickyard concurrency group so it cannot overlap a deploy. Existing rooms keep working when creation is off.

## 2026-10-29 — Arcade play counter validates against the games folder

POST /api/play/<slug> now counts a play only if /games/<slug>/ exists in the deployed assets, so the games folder is the allowlist and adding a game needs no Worker change. Slugs are limited to 40 characters with a strict format, and inherited property names like constructor are rejected. A per-play cleanup of stored keys was rejected because it would add one lookup per game on every play and risk the subrequest limit. Rate limiting and atomic counters are deliberately left out; a Cloudflare rate-limiting rule is the first step if abuse appears.

## 2026-10-30 — Stonks is rebuilt, not migrated

Stonks began as hand-copied scripts on a Raspberry Pi before Claude Code, so its code and history are not worth importing. It is rebuilt in `apps/stonks` using the concept only, with no git history imported. The architecture is unchanged: GitHub Actions cron, Cloudflare D1 and a read-only Worker dashboard. The old setup is a reference for a written spec that contains no secrets or real data. Existing data, if kept, moves into D1 directly and never via the repo.

## 2026-10-30 — Stonks collects broadly and filters at read time

Ingest stays wide: everything that passes only a provable-junk filter is stored, along with the filter inputs as columns. The result of each signal rule is stored per row, so rules can be changed and replayed over history without re-collecting. Strict views such as a price cap, US-only or UK-tradable are queries, not ingest gates.

## 2026-10-30 — Stonks outcomes are derived, with a control group

Win and loss outcomes are computed from stored price history rather than written by a separate tracker. Outcomes are computed for all collected rows, not just flagged ones, so flagged results can be compared against a baseline.

## 2026-10-30 — Stonks data source and limits are validated by spikes first

Data-source feasibility from GitHub Actions and D1 limits are checked with throwaway spikes before any slice is built. The result and any change of source are recorded here.

## 2026-10-30 — Arcade play counter gets a basic per-IP rate limit

POST /api/play/<slug> is limited to 20 requests per minute per client IP using the Workers Rate Limiting binding (PLAY_LIMITER in wrangler.jsonc), and returns 429 when over the limit. The check runs before the games-folder lookup and the KV write, so rejected requests are cheap. The binding is approximate and per Cloudflare location, which is enough for a fun counter, needs no dashboard setup and works on the free plan. This replaces the earlier choice to leave rate limiting out. Atomic counters are still out of scope.

## 2026-10-30 — Chalkline adopts the shared tokens for type scale and spacing only

Chalkline imports `@krishnabuilds/tokens/tokens.css` and takes its Tailwind type scale (xs to 2xl) and spacing base from the shared `--kb-*` variables, which had the same values. Its colours (paper and blackboard) and its 8 to 12px radii stay Chalkline's own, because the shared palette and radii differ and swapping them would change how the app looks. Screenshots of the app and its style sheet page at 360 and 1280px in light and dark were pixel-identical before and after. Theme handling is unchanged: Chalkline sets `data-theme` on `<html>` from its own setting, which the shared tokens also follow.

## 2026-10-30 — Stonks D1 schema keeps the daily table narrow

The D1 spike (Week 3, Spike 2 in `docs/plan.md`) found that about 1,900 rows a night at about 1 KB each with 3 indexes reaches the 500 MB Free-plan database cap in about 6.5 months, and that a full scan of a year's rows uses about a seventh of the daily read limit. So the schema follows these rules:

- **Narrow daily table**: one row per instrument per night, holding only numbers, flags and foreign keys (target about 200 bytes). No repeated names, descriptions or text blobs.
- **Separate instruments table**: name, exchange, sector and other slow-changing text are stored once and referenced by id.
- **Few, deliberate indexes**: start with (date) and (instrument_id, date) and add one only for a query that needs it. Each index adds a row written per insert and storage.
- **Nightly summary tables**: the dashboard and outcome views read small precomputed aggregates written by the nightly job, not full scans of the daily table.
- **Cold archive to R2**: rows older than a set window (for example 12 months) are exported to R2 and deleted from D1, keeping the database under 500 MB.

Moving to Workers Paid (10 GB, no daily caps) is the fallback if these are not enough; it is not needed for year one.

## 2026-10-30 — Sumyard adopts the shared tokens for type scale and spacing only

Sumyard follows Chalkline: it imports `@krishnabuilds/tokens/tokens.css` and takes its Tailwind type scale (xs to 2xl) and spacing base from the shared `--kb-*` variables, which had the same values. Its palette and radii stay its own, and Biome stays its linter. Screenshots of the home, mortgage and budget pages at 360 and 1280px in light and dark were pixel-identical before and after. Sumyard always sets `data-theme` on `<html>` before first paint, so the shared theme blocks agree with its own.
