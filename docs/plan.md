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
  - [x] Chalkline (type scale and spacing base only; keeps its own palette and radii)
  - [ ] Stickyard
  - [x] Sumyard (type scale and spacing base only; keeps its own palette and radii)
  - [ ] Arcade

## Week 3 — Stonks rebuild, then switch off the Pi

### Phase A: Plan and spec

- [ ] Write `docs/stonks-spec.md` in my own words from the existing docs: purpose, pipeline, features, signal rules, outcomes definition, weekly digest, data model. No secrets, hostnames or real data
- [ ] Decide: keep historical Stonks data in D1 or start fresh

### Phase B: Spikes (throwaway, nothing committed except findings in docs)

- [ ] Spike 1: nightly data fetch from GitHub Actions. Can the universe source and the price-history source be fetched from a GitHub-hosted runner for ~1,300 tickers, within runtime and rate limits? Record pass/fail, runtime and failure modes. If it fails, evaluate alternatives before continuing
- [x] Spike 2: D1 limits against ~1,300 rows/night plus history. Check current free-tier limits and record the headroom
  - **Result: FAIL on the Free plan as modelled (wide 1 KB rows); PASS with the schema guidance in `docs/decisions.md` for about the first year.** Writes have plenty of headroom; database size is the blocker and reads need care.
  - Free-plan limits (Cloudflare D1 docs, Limits and Pricing pages, checked 2026-10-30): 100,000 rows written/day and 5 million rows read/day, both reset at 00:00 UTC; when either runs out, queries fail until the reset. **Maximum database size is 500 MB on Free** (10 GB is the Workers Paid limit, which explains the conflicting sources; 10 GB cannot be raised). Account storage is 5 GB on Free; tables and indexes both count. 50 queries per Worker invocation on Free (1,000 Paid), where a `db.batch()` counts as one. Also: 100 bound parameters per query, 30 s per query, and a 50 MB query result cap from 2026-11-04
  - Model: 1,900 rows/night (up from the ~1,300 estimate), 365 nights, about 1 KB per row, 3 indexes. Index entries are assumed at about 100 bytes each; this is an estimate, so measure it in Slice 1 with the `meta` object (`rows_read`, `rows_written`, `size_after`)
  - Size after one year: 693,500 rows, about 0.69 GB of table data plus about 0.21 GB of indexes, **about 0.9 GB total. The 500 MB cap is hit after about 200 nights (about 6.5 months)**, or about 260 nights with no indexes. Account storage (5 GB) is not the constraint
  - Writes per night: 1,900 rows × (1 table + 3 index entries) = **about 7,600 rows written, 7.6% of the daily limit** (about 13× headroom). Upserts that replace rows can roughly double this and still fit. A one-year history import would be about 2.8 million rows written, about 28 days of the free write limit, so Slice 6 needs a staged import or Workers Paid
  - Reads: a full scan of the daily table at the end of year one reads 693,500 rows, so **the 5 million daily limit allows about 7 full scans a day** (about 14 at six months). Any dashboard view or outcome query that scans the whole table on each page load would exhaust it; reads must use indexes or precomputed summaries
  - Ingest runs from GitHub Actions, so the 50-queries-per-invocation limit applies only to the dashboard Worker. Inserts should be batched, with rows per statement kept under the 100 bound-parameter limit
  - Narrow-row check: at about 200 bytes per daily row plus 3 index entries (about 500 bytes in total per row), one year is about 350 MB, which fits under 500 MB with about 30% headroom and reaches the cap after about 17 months, unless older rows are archived or the account moves to Workers Paid (10 GB)
- [ ] Go/no-go recorded in `docs/decisions.md`

### Phase C: Build in thin vertical slices (each is its own small PR)

- [ ] Slice 1: scaffold `apps/stonks`, D1 schema and migrations, path-filtered CI, one ingest run writing a small sample to D1
- [ ] Slice 2: full nightly ingest on GitHub Actions cron, storing per-rule results per row; run history and error log
- [ ] Slice 3: derived outcomes and control-group baseline as SQL views
- [ ] Slice 4: read-only Worker dashboard (latest signals, history, outcomes vs baseline) on the shared tokens and site header
- [ ] Decide public vs Cloudflare Access before going live; add Stonks to the app list when live
- [ ] Slice 5: weekly digest (SQL aggregates plus two Claude calls a week, stored; dashboard never calls Claude) and email heartbeat
- [ ] Slice 6: import historical data to D1 directly, if kept

### Phase D: Cutover

- [ ] Run new setup alongside the Pi and confirm parity
- [ ] Switch off the Pi
- [ ] Archive the old docs repo

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
- [ ] Theme choice is stored in localStorage, not the shared `kb-theme` cookie, so it does not carry over to or from the other apps. Decide whether Chalkline should join the shared cookie

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
