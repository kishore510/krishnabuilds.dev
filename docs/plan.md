# 3-week plan

## Week 1 — Repo, tooling, tokens, portal

- [x] Create public repo
- [x] Scaffold monorepo: pnpm workspaces, Turborepo, `apps/*` + `packages/*`
- [x] Root scripts, `.nvmrc`, `.gitignore`
- [x] CI workflow (lint, typecheck, build)
- [x] `CLAUDE.md`, plan and decision log
- [x] Shared tooling config (`packages/config`)
- [x] Design tokens (`packages/tokens`)
- [x] Portal app shell (`apps/portal`)
- [x] Portal landing page
- [x] Theme toggle (light / dark / system) in Portal, persisted in a cookie scoped to `.krishnabuilds.dev` so all subdomains share it
- [x] Cloudflare deploy for Portal
- [x] Path-filtered deploy workflow

## Week 2 — Migrate the simple apps and Arcade (preserving history)

For each app: scan history for secrets and report before importing, import with history, wire up build + deploy.

Rule for `packages/ui`: only extract a component once it is duplicated in two apps.

- [x] Chalkline (migrated, deployed)
- [x] Stickyard (migrated, deployed)
- [x] Sumyard (migrated, deployed)
- [x] Arcade (migrated, deployed)
- [x] Extract the shared site header and app list into `packages/ui`
- [x] Add each migrated app's subdomain via wrangler `custom_domain`
- [x] Add each migrated app to the Portal app list
- [x] Give each migrated app the shared site links (home link and app switcher)
- [x] Adopt `@krishnabuilds/tokens` in each migrated app
  - [x] Chalkline (type scale and spacing base only; keeps its own palette and radii)
  - [x] Stickyard (web only; type scale and spacing only; keeps its own palette and radii)
  - [x] Sumyard (type scale and spacing base only; keeps its own palette and radii)
  - [x] Arcade (committed copy of the shared CSS with a drift check; site links bar sizes only)

## Week 3 — Close out Stonks, switch off the Pi

Stonks is retired, not rebuilt (see `docs/decisions.md`).

- [x] Spike 1: nightly data fetch from GitHub Actions
  - **PASS.** About 6,200 tickers fetched from a GitHub-hosted runner in 11 to 14 minutes, with no rate limiting
- [x] Spike 2: D1 limits against the nightly row count plus history
  - **PASS with a narrow schema** (see "Stonks D1 schema keeps the daily table narrow" in `docs/decisions.md`). Writes had plenty of headroom; database size was the constraint
- [x] Decision: retire Stonks
- [ ] Archive the old Stonks data and scripts outside the repo
- [ ] Check nothing else runs on the Pi
- [ ] Switch off the Pi
- [ ] Archive the old docs repo

## Portal and Branding

One small PR each, in order.

- [ ] Shared accent token: #1f6aa5 light, #7cc0e6 dark; Chalkline, Stickyard and Sumyard map their local accent to it
- [x] Branding assets: "kb" favicon, apple-touch icon, shared share image; icon, Open Graph and Twitter tags and "AppName · krishnabuilds" titles in all five apps
- [x] Portal landing page: hand-written SVG card previews, hero, footer
- [x] Story page template, then draft story pages for Arcade, Chalkline, Stickyard and Sumyard
- [x] "How this is built" page: monorepo diagram, working principles, AI guardrails, decision log from `docs/decisions.md`
- [ ] Stickyard and Sumyard join the shared `kb-theme` cookie, migrating an existing local choice once
- [ ] Arcade: drop Google Fonts for the system font stack; site-links bar uses the shared accent

## Backlog

The app list in `packages/ui` (`src/apps.ts`) is the single source for the site header nav and the Portal cards.

### Portal

- [x] Add group, status, stack to apps.ts and group the cards

### Shared

- [ ] packages/ui: make the home link in SiteLinks look like a link and improve spacing/layout (affects all apps)
- [ ] Enforce one React version across apps and packages/ui (for example a root override) so shared components with hooks are safe
- [ ] Credits (About) miss transitive dependencies (e.g. `scheduler`) under pnpm in Sumyard and Stickyard, because they are looked up in the app's own `node_modules`; resolve them properly

### Chalkline

- [x] pnpm conversion, remove the workspace exclusion, deploy to chalkline.krishnabuilds.dev
- [x] After the new site is verified, retire the GitHub Pages workflow and archive the old repo
- [ ] Align ESLint with the shared config when typescript-eslint supports TypeScript 7
- [ ] Align react and react-dom with packages/ui (19.3.1) to remove a second React copy
- [x] Join the shared `kb-theme` cookie instead of storing the theme in localStorage, migrating an existing local choice once (0.32.0)

### Sumyard

- [x] After the new site is verified, retire the GitHub Pages workflow and archive the old repo

### Arcade

- [x] Restrict the play-counter endpoint to known game slugs and add basic rate limiting
- [ ] Archive the old repo after the new deploy is verified
- [ ] Consider moving the site into a public/ folder instead of using .assetsignore
- [ ] Generate the site-links app list from the shared list instead of duplicating it

### Stickyard

- [x] Deploy web to stickyard.krishnabuilds.dev and the relay Worker from Actions; add the new origin to ALLOWED_ORIGINS
- [x] Archive the old repo after cutover
- [x] Port creation-switch.yml (the old repo is archived, so the kill switch no longer runs from there). Not active until the owner runs it once off and on from the monorepo and confirms both; see the Kill switch section of apps/stickyard/README.md
- [ ] Remove https://kishore510.github.io from ALLOWED_ORIGINS to retire the old Pages site
- [ ] Custom domain for the relay Worker (replace the workers.dev address)
- [ ] Fix stale comments in worker/wrangler.jsonc about secrets and ALLOWED_ORIGINS
- [ ] Rename @stickyard/* packages to @krishnabuilds/*
- [ ] Add a linter
