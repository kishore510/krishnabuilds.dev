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
