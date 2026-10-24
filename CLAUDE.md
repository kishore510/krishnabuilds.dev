# CLAUDE.md

Guidance for Claude (and humans) working in this repo.

## Project overview

`krishnabuilds.dev` is a monorepo holding a personal portfolio of small web apps:

| App | Notes |
| --- | --- |
| **Portal** | The krishnabuilds.dev landing page and shell linking to the other apps |
| **Chalkline** | Simple app, migrating in week 2 |
| **Stickyard** | Simple app, migrating in week 2 |
| **Sumyard** | Simple app, migrating in week 2 |
| **Arcade** | Games |
| **Stonks** | Portfolio tracker: GitHub Actions cron + D1 + read-only Worker dashboard |

The Android allotment app is a **separate repo** and does not live here.

See `docs/plan.md` for the roadmap and `docs/decisions.md` for the decision log.

## Stack

- **pnpm workspaces + Turborepo.** Node version in `.nvmrc`; pnpm version pinned via `packageManager`.
- **Layout:**
  - `apps/*` — one folder per deployable app.
  - `packages/*` — shared code: `tokens` (design tokens), `ui` (small component library), `config` (shared tooling config).
- **Deploys:** each app deploys independently to Cloudflare.
- **CI:** path-filtered, so a change to one app only builds/deploys that app (plus anything depending on a changed package).
- Root scripts (`pnpm build`, `lint`, `typecheck`, `dev`) all go through `turbo`.

## Design system rule

1. **Tokens first.** Colours, spacing, type scale, radii live in `packages/tokens`.
2. **Then a small `ui` package.** Keep it minimal.
3. **Only extract a component once it is duplicated in two apps.** No speculative shared components.

## Working rules

- Prefer boring, well-known tooling over clever or new tooling.
- Flag over-engineering — call it out rather than quietly building it.
- One step at a time; keep changes and PRs small.
- Never push to `main`. Work on a branch and open a PR.
- Squash merge only.

## PUBLIC REPO RULES

This repository is **public**, and so is its entire git history.

- **Never commit** secrets, API keys, tokens, `.env` files, `.dev.vars`, personal or financial data, holdings, trade history, or D1 exports/dumps.
- **Secrets go in GitHub Secrets only** (and Cloudflare's secret store at deploy time), never in the repo.
- **Before importing any app's git history**, scan that history for secrets and sensitive data, and **report findings to the owner before importing**. Do not import until they confirm.
- If something sensitive is committed by mistake, stop and tell the owner — deleting it in a later commit does not remove it from history.
