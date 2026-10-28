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

## Week 2 — Migrate three simple apps (preserving history)

For each app: scan history for secrets and report before importing, import with history, wire up build + deploy.

- [ ] Chalkline
- [ ] Stickyard
- [ ] Sumyard
- [ ] Extract shared components into `packages/ui` only where duplicated in two apps
- [ ] Extract shared site header and app list into `packages/ui` when the first migrated app needs them, so every app has the same nav bar
- [ ] For each migrated app: adopt `@krishnabuilds/tokens` and the shared header, and add its subdomain via wrangler `custom_domain`

## Week 3 — Stonks, then switch off the Pi

- [ ] Scan Stonks history for secrets and financial data; report before importing
- [ ] Migrate Stonks
- [ ] Data refresh on GitHub Actions cron writing to D1
- [ ] Read-only Worker dashboard
- [ ] Decide whether the Stonks dashboard is public or behind Cloudflare Access before going live; add Stonks to the app list when live
- [ ] Run new setup alongside the Pi and confirm parity
- [ ] Switch off the Pi

## Backlog

- [ ] Portal: add group, status, stack to apps.ts and group the cards (can ride along with the first migrated app)
- [ ] Portal: story page template, then one page per app as each migrates
- [ ] Portal: "How this is built" page
- [ ] Chalkline: pnpm conversion, remove the workspace exclusion, wire Cloudflare deploy to chalkline.krishnabuilds.dev, retire the GitHub Pages workflow
