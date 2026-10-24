# 3-week plan

## Week 1 — Repo, tooling, tokens, portal

- [x] Create public repo
- [x] Scaffold monorepo: pnpm workspaces, Turborepo, `apps/*` + `packages/*`
- [x] Root scripts, `.nvmrc`, `.gitignore`
- [x] CI workflow (lint, typecheck, build)
- [x] `CLAUDE.md`, plan and decision log
- [x] Shared tooling config (`packages/config`)
- [ ] Design tokens (`packages/tokens`)
- [ ] Portal app shell (`apps/portal`)
- [ ] Portal landing page
- [ ] Cloudflare deploy for Portal
- [ ] Path-filtered deploy workflow

## Week 2 — Migrate three simple apps (preserving history)

For each app: scan history for secrets and report before importing, import with history, wire up build + deploy.

- [ ] Chalkline
- [ ] Stickyard
- [ ] Sumyard
- [ ] Extract shared components into `packages/ui` only where duplicated in two apps

## Week 3 — Stonks, then switch off the Pi

- [ ] Scan Stonks history for secrets and financial data; report before importing
- [ ] Migrate Stonks
- [ ] Data refresh on GitHub Actions cron writing to D1
- [ ] Read-only Worker dashboard
- [ ] Run new setup alongside the Pi and confirm parity
- [ ] Switch off the Pi
