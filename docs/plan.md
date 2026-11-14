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

## Week 3: Stonks shelved, close out

Shelved 2026-11-04, see decisions.md. Original slice plan kept below for reference only.

- [x] Spike 1: nightly data fetch from GitHub Actions
  - **PASS.** About 6,200 tickers fetched from a GitHub-hosted runner in 11 to 14 minutes, with no rate limiting
- [x] Spike 2: D1 limits against the nightly row count plus history
  - **PASS with a narrow schema** (see "Stonks D1 schema keeps the daily table narrow" in `docs/decisions.md`). Writes had plenty of headroom; database size was the constraint
- [x] Decision: shelve Stonks (2026-11-04)
- Spike 3 ideas (weather, carbon, river, rail, road) were not pursued; see decisions.md
- [ ] Archive old Stonks data and scripts outside the repo
- [ ] Check nothing else depends on the Pi
- [ ] Decide: switch off the Pi or leave Stonks running there
- [ ] Archive the old docs repo

### Archived: original Stonks plan (not active)

#### Phase A: Plan and spec

- [ ] Write `docs/stonks-spec.md` in my own words from the existing docs: purpose, pipeline, features, signal rules, outcomes definition, weekly digest, data model. No secrets, hostnames or real data
- [x] Decide: keep historical Stonks data in D1 or start fresh
  - Start fresh: D1 starts empty and nothing is imported from the Pi (see `docs/decisions.md`)

#### Phase C: Build in thin vertical slices (each is its own small PR)

- [ ] Slice 1: scaffold `apps/stonks`, D1 schema and migrations, path-filtered CI, one ingest run writing a small sample to D1
- [ ] Slice 2: full nightly ingest on GitHub Actions cron, storing per-rule results per row; run history and error log
- [ ] Slice 3: derived outcomes and control-group baseline as SQL views
- [ ] Slice 4: read-only Worker dashboard (latest signals, history, outcomes vs baseline) on the shared tokens and site header
- [ ] Decide public vs Cloudflare Access before going live; add Stonks to the app list when live
- [ ] Slice 5: weekly digest (SQL aggregates plus two Claude calls a week, stored; dashboard never calls Claude) and email heartbeat

#### Phase D: Cutover

- [ ] Run new setup alongside the Pi and confirm parity
- [ ] Switch off the Pi
- [ ] Archive the old docs repo

## Portal and Branding

One small PR each, in order.

- [ ] Shared accent token: #1f6aa5 light, #7cc0e6 dark; Chalkline, Stickyard and Sumyard map their local accent to it
- [x] Branding assets: "kb" favicon, apple-touch icon, shared share image; icon, Open Graph and Twitter tags and "AppName · krishnabuilds" titles in all five apps
- [x] Portal landing page: hand-written SVG card previews, hero, footer
- [x] Story page template, then draft story pages for Arcade, Chalkline, Stickyard and Sumyard
- [x] "How this is built" page: monorepo diagram, working principles, AI guardrails, decision log from `docs/decisions.md`
- [x] Stickyard and Sumyard join the shared `kb-theme` cookie, migrating an existing local choice once
- [x] Arcade: drop Google Fonts for the system font stack; site-links bar uses the shared accent

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

### Story Maps

- [x] Scaffold `apps/story-maps` and deploy to story-maps.krishnabuilds.dev (0.1.0)
- [x] Portal card in a new Explore group
- [x] Engine and the first story, Rama’s Journey; Story Maps goes live (0.2.0)
- [x] The Mahabharata (0.23.0)
- [x] The Life of Krishna (0.26.0)
- [x] The Churning of the Ocean (Samudra Manthan) (0.27.0)
- [x] Greece and Persia (0.28.0)
- [x] The Mughal Empire (0.30.0)
- [x] The Delhi Sultanate (0.31.0)
- [x] Browse lists every finished story map newest first; `story:ref`, `story:check`, `story:shots` and the `new-story-map` skill for adding stories (0.32.0)
- [x] The Marathas (0.33.0)
- [x] The Silk Road (0.41.0)
- [x] The Mahajanapadas and the Buddha (0.35.0)
- [x] The Shunga Dynasty (0.36.0)
- [x] The Kalinga War (0.37.0)
- [x] The Kushan Empire (0.38.0)
- [x] The Pallavas (0.39.0)
- [x] The Vakataka Dynasty (0.40.0)
- [x] Harsha’s Empire (0.42.0)
- [x] Front page with three shelves (Nature, Humankind, Science); the atlas, timeline and Browse move to Explore; the cosmic canvas (0.43.0)
- [x] The Big Bang and Marie Curie, the first stories on the Nature and Science shelves (0.44.0)
- [x] Lives, a subject for people; Marie Curie moves there; Radioactivity in Physics and Astronomy (0.45.0)
- [x] Front page: links to each shelf and to Explore under the heading; arrows on long story rows (0.46.0)
- [x] The Spanish Empire (0.47.0)
- [x] Hyder Ali and Tipu Sultan (0.48.0)
- [x] The Iliad (0.49.0)
- [x] The Odyssey (0.52.0)
- [x] Minoan Crete (0.56.0)
- [x] Socrates, a Life on the near-east map (0.57.0)
- [x] Aristotle, a Life on the near-east map (0.58.0)
- [x] Building Molecules, the first Chemistry story (0.59.0)

The running list of what is built and what is next is `apps/story-maps/BACKLOG.md`. Agreed order for the next stories: the Mughals first, then the Delhi Sultanate, the Silk Road, the Marathas, and the Mahajanapadas and the Buddha. Together they close the gaps in the Indian Chronicles, which then run from the Indus to 1947 except for north India from about 550 to 1200 CE.

### Stickyard

- [x] Deploy web to stickyard.krishnabuilds.dev and the relay Worker from Actions; add the new origin to ALLOWED_ORIGINS
- [x] Archive the old repo after cutover
- [x] Port creation-switch.yml (the old repo is archived, so the kill switch no longer runs from there). Not active until the owner runs it once off and on from the monorepo and confirms both; see the Kill switch section of apps/stickyard/README.md
- [ ] Remove https://kishore510.github.io from ALLOWED_ORIGINS to retire the old Pages site
- [ ] Custom domain for the relay Worker (replace the workers.dev address)
- [ ] Fix stale comments in worker/wrangler.jsonc about secrets and ALLOWED_ORIGINS
- [ ] Rename @stickyard/* packages to @krishnabuilds/*
- [ ] Add a linter
