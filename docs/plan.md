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
- [ ] Adopt `@krishnabuilds/tokens` in each migrated app
  - [ ] Chalkline
  - [ ] Stickyard
  - [ ] Sumyard
  - [ ] Arcade

## Week 3 — Stonks, then switch off the Pi

- [ ] Scan Stonks history for secrets and financial data; report before importing
- [ ] Migrate Stonks
- [ ] Data refresh on GitHub Actions cron writing to D1
- [ ] Read-only Worker dashboard
- [ ] Decide whether the Stonks dashboard is public or behind Cloudflare Access before going live; add Stonks to the app list when live
- [ ] Run new setup alongside the Pi and confirm parity
- [ ] Switch off the Pi

## Backlog

The app list in `packages/ui` (`src/apps.ts`) is the single source for the site header nav and the Portal cards.

### Portal

- [x] Add group, status, stack to apps.ts and group the cards
- [ ] Story page template, then one page per app as each migrates
- [ ] "How this is built" page

### Shared

- [ ] packages/ui: make the home link in SiteLinks look like a link and improve spacing/layout (affects all apps)
- [ ] Enforce one React version across apps and packages/ui (for example a root override) so shared components with hooks are safe
- [ ] Credits (About) miss transitive dependencies (e.g. `scheduler`) under pnpm in Sumyard and Stickyard, because they are looked up in the app's own `node_modules`; resolve them properly

### Chalkline

- [x] pnpm conversion, remove the workspace exclusion, deploy to chalkline.krishnabuilds.dev
- [x] After the new site is verified, retire the GitHub Pages workflow and archive the old repo
- [ ] Align ESLint with the shared config when typescript-eslint supports TypeScript 7
- [ ] Align react and react-dom with packages/ui (19.3.1) to remove a second React copy

### Sumyard

- [x] After the new site is verified, retire the GitHub Pages workflow and archive the old repo

### Arcade

- [ ] Restrict the play-counter endpoint to known game slugs (currently accepts any slug and has no rate limit)
- [ ] Archive the old repo after the new deploy is verified
- [ ] Consider moving the site into a public/ folder instead of using .assetsignore
- [ ] Generate the site-links app list from the shared list instead of duplicating it

### Stickyard

- [x] Deploy web to stickyard.krishnabuilds.dev and the relay Worker from Actions; add the new origin to ALLOWED_ORIGINS
- [x] Archive the old repo after cutover
- [ ] Port creation-switch.yml (the old repo is archived, so the kill switch no longer runs from there)
- [ ] Remove https://kishore510.github.io from ALLOWED_ORIGINS to retire the old Pages site
- [ ] Custom domain for the relay Worker (replace the workers.dev address)
- [ ] Fix stale comments in worker/wrangler.jsonc about secrets and ALLOWED_ORIGINS
- [ ] Rename @stickyard/* packages to @krishnabuilds/*
- [ ] Add a linter
