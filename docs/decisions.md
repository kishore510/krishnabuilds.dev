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
