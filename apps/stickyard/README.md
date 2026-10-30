# Stickyard

A real-time collaborative sticky-note whiteboard for workshops and retros. Join by link and a typed name, no accounts.

Personal learning project. Front end on a Cloudflare Worker with static assets at https://stickyard.krishnabuilds.dev, relay on a Cloudflare Worker with one Durable Object per room.

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md), [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md) and [docs/LIMITS.md](docs/LIMITS.md).

**Status:** v0.44.0 (protocol v23, stored schema 14; 10c AI, part 3 of 4: Summary and sentiment, after 10a Settings and your own key and 10b Set up board from a prompt). Start a session with the create passcode, share its link or show it as a QR code (Share session), and join by link, QR code and name. On a 6400 × 4000 board: sticky notes with size, colour and text style, frames, text labels and shapes (rectangle, oval, diamond), an emoji picker for note, shape and frame text, fifteen templates in three groups (retros, planning and facilitation, architecture and analysis), multi-select and arrange (notes, shapes and frames), z-order, duplicate, undo/redo, chat, automatic reconnect, and presence (avatars, join/leave messages). Sessions expire after 7 days with nobody in them. The session's host (whoever started it, on that device) can run a timer everyone sees, lock the board, and end the session. The host can also run anonymous dot voting: everyone spreads a few dots over the notes, and the totals and a results list show when the host stops the round. Everyone sees other people's pointers, with their names, while they move over the board (switchable in Participants). Anyone can export the board as a PNG picture, a Markdown file or a board file (JSON), made in the browser, also on a phone through its share sheet, and import a board file or text (one note per line) to add to any board. Navigation: Fit to notes (a far-away item is left out, with Show all), Zoom to selection, Go to a person's pointer from Participants, and a clickable overview map; on a tablet the side panels start collapsed. The host can also run a silent brainstorm: everyone writes notes only they can see, until the host reveals them all at once. Anyone can follow someone's view from Participants (it stops when you move the view yourself), and the host can ask everyone to come to their view with Bring to me (a banner with Go there; nobody is moved without choosing it). Anyone can react to a note (thumbs up, heart, laugh, celebrate, thinking, plus one): everyone sees the counts, nobody sees who. Arrows join notes and shapes (straight or elbowed, solid, dashed or dotted, with heads) and follow them when they move; up to 100 a session, drawn from a wider screen. Notes and shapes can be grouped (G) under a labelled, tinted box that moves as one, for affinity grouping; up to 30 groups a session. A Stencils tab places ready-made areas (frames, notes, shapes, arrows and groups) and saves your own from a selection, kept in this browser only. Settings holds your own Anthropic API key for AI features (bring your own key; the browser calls Anthropic itself, Stickyard has no AI server), with Test key. Set up board from a prompt asks Anthropic for frames and notes from a description you type (only that is sent), shows a preview, and adds them only when you choose Add to board, as one undo step. The host can Summarise board: an overview, themes, sentiment and possible actions from the notes' text (no names are sent), read-only until they choose Add to board. See [CHANGELOG.md](CHANGELOG.md) for what each version added.

## Layout

| Folder | What |
|---|---|
| `web/` | Vite + React + TypeScript + Zustand + Tailwind front end. Design tokens in `web/src/styles/tokens.css` |
| `worker/` | Cloudflare Worker + SQLite-backed Durable Object (WebSocket Hibernation API) |
| `shared/` | Zod message schemas and `PROTOCOL_VERSION`, used by both sides |

Stickyard lives in the krishnabuilds.dev monorepo (`apps/stickyard`): it uses pnpm and Turborepo, follows the root `CLAUDE.md`, and deploys from GitHub Actions (`.github/workflows/deploy-stickyard.yml` at the monorepo root). `shared/` is consumed as TypeScript source (no build step).

## Local development

Requires Node 24 (see `.nvmrc`; `nvm use`). Works on a Raspberry Pi 5 (arm64), including local `wrangler dev`.

```sh
pnpm install   # from the monorepo root
cp worker/.dev.vars.example worker/.dev.vars   # then fill in your own local values (gitignored)

# terminal 1: relay on http://127.0.0.1:8787
cd worker && pnpm exec wrangler dev --ip 127.0.0.1 --port 8787

# terminal 2: web on http://127.0.0.1:5173
cd web && pnpm exec vite --host 127.0.0.1
```

In dev the web app talks to `http://127.0.0.1:8787` by default. To point it elsewhere (for example a deployed Worker), create `web/.env.local` (gitignored) with:

```sh
VITE_WORKER_URL=https://stickyard.<your-subdomain>.workers.dev
```

The production Worker URL is a single constant in `web/src/config.ts`.

Checks (same as CI):

```sh
pnpm turbo run typecheck --filter="./apps/stickyard/**"   # tsc --noEmit in shared, web, worker
pnpm turbo run test --filter="./apps/stickyard/**"        # vitest; worker tests run inside workerd
pnpm turbo run build --filter="./apps/stickyard/**"       # web build + worker dry-run bundle
```

Screenshots (local only, not in CI): `pnpm shots` (in `apps/stickyard`) starts a local relay with made-up secrets and the Vite dev server, seeds a room, and saves the welcome page and the room at 360, 768 and 1280 px in light and dark to `shots/` (gitignored). It uses the Chromium at `CHROMIUM_PATH` or `/opt/pw-browsers/chromium`, else Playwright's own; `SHOTS_HASHES="#/help,#/about"` adds pages.

Notes for Claude Code: `CLAUDE.md` is kept short (a test caps it at 6 KB); the detail for each area lives in `docs/architecture/`.

`worker/.dev.vars` holds local-only values for `CREATE_PASSCODE`, `ROOM_SIGNING_KEY` and `CREATION_ENABLED=true`. Use made-up values, never the production ones. Tests use their own obviously fake values (`worker/vitest.config.ts`).

Endpoints (all browser calls are Origin-checked; see below):

| Endpoint | What |
|---|---|
| `GET /health` | `{ "ok": true, "protocolVersion": <PROTOCOL_VERSION> }` (10 at v0.10.2). No Durable Object. Used for the start page's status line |
| `POST /rooms` | Body `{ "passcode": "..." }` (max 1 KB). `200 { code }`, `401 invalid_passcode`, `429 rate_limited` + `Retry-After`, `503 creation_disabled` / `not_configured`, `400` / `413` |
| `GET /rooms/check?room=<code>` | `200` if the code's signature is valid, else `404`. No Durable Object |
| `GET /ws?room=<code>` | The room WebSocket. Origin, then signature, then the room's Durable Object. Invalid codes: one generic `404` |
| `GET /ws` (no code) | Only answers a v1 `hello` with `version_mismatch` so old cached pages say "please reload" |

Room codes are `<id>.<sig>`: 16 random bytes and a 128-bit HMAC-SHA256 of `stickyard-room-v1:<id>` keyed by `ROOM_SIGNING_KEY`, both base64url. Abuse limits (passcode lockout, daily creation caps, per-socket message rate) are in `worker/src/limits.ts`; the participant cap and text limits are in `shared/src/protocol.ts`.

## Deploy

Stickyard lives in the krishnabuilds.dev monorepo (`apps/stickyard`): it uses pnpm and Turborepo, follows the root `CLAUDE.md`, and deploys from GitHub Actions (`.github/workflows/deploy-stickyard.yml` at the monorepo root). On a push to `main` that touches `apps/stickyard/**`, it tests and builds Stickyard, deploys the relay Worker (`stickyard`, `wrangler deploy --keep-vars`), then the web app as the `krishnabuilds-stickyard` Worker at https://stickyard.krishnabuilds.dev. It uses the monorepo's `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets only.

The Cloudflare API token needs only **Account → Workers Scripts → Edit**, scoped to this one account (enough for Worker + Durable Object migrations + workers.dev). Deployed relay: `https://stickyard.kishore510.workers.dev`.

The allowed browser origin for `/ws` is `ALLOWED_ORIGINS` in `worker/wrangler.jsonc`. `localhost` / `127.0.0.1` over http on any port are always allowed for dev. This stops other websites using the relay from a browser. It does not stop scripts, which can fake the header.

Manual Origin check (use `--http1.1`; over HTTP/2 there is no `Upgrade` header, so you'd get 426):

```sh
WS=(--http1.1 -s -o /dev/null -w "%{http_code}\n" -H "Upgrade: websocket" -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==")
curl -m 5 "${WS[@]}" -H "Origin: https://kishore510.github.io" https://stickyard.kishore510.workers.dev/ws  # 101 (then times out: socket stays open)
curl "${WS[@]}" -H "Origin: https://evil.example" https://stickyard.kishore510.workers.dev/ws               # 403
```

## Secrets

No secrets are ever committed. The Worker needs two:

| Secret | Purpose |
|---|---|
| `CREATE_PASSCODE` | Gates starting a session (compared in constant time, never logged) |
| `ROOM_SIGNING_KEY` | HMAC key for room codes, and for hashing client IPs in the limiter |

If either is missing, creating **and** joining are refused (503); `/health` still works.

They live only on the Worker as Worker secrets and survive deploys. The monorepo's deploy workflow (`deploy-stickyard.yml`) never sets or reads them.

Rotating `ROOM_SIGNING_KEY` invalidates every existing room link. Rotating `CREATE_PASSCODE` only affects starting new sessions.

The same Cloudflare API token (**Account → Workers Scripts → Edit**) covers deploys and secrets. CI deploy credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) live only in GitHub Actions secrets. Locally, `worker/.dev.vars` (gitignored, see `worker/.dev.vars.example`) holds made-up values. Tests use obviously fake values. GitHub secret scanning and push protection are on. If a secret is ever committed, rotate it: deleting the file doesn't remove it from history.

## Kill switch (stop new sessions)

`CREATION_ENABLED` is also a Worker secret. Starting sessions works only when it is exactly `true`; anything else (including unset) returns `503 creation_disabled`. Existing sessions keep working either way.

Flip it from a phone in under a minute, no code change: **GitHub mobile app → krishnabuilds.dev → Actions → Room creation switch → Run workflow → on/off**. Or from a terminal:

```sh
gh workflow run creation-switch.yml -R kishore510/krishnabuilds.dev -f creation=off
gh workflow run creation-switch.yml -R kishore510/krishnabuilds.dev -f creation=on
```

The workflow is `.github/workflows/creation-switch.yml` at the monorepo root (GitHub only runs workflows from there). It uses the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` Actions secrets as the deploys. Secrets survive later deploys, so the setting sticks until the switch is run again.

The switch is not proven until it has been run once from the monorepo. First-run check: run it **off**, confirm starting a session shows it is disabled while an open room still works, then run it **on** and confirm starting a session works again.

## What Cloudflare may log

Our code logs nothing about requests (a test forbids `console.` in `worker/src`). Workers observability is on, so Cloudflare keeps short-term invocation logs with request metadata: the URL (for `/ws` and `/rooms/check` this includes the **room code**), method, status, headers such as `Origin` and `User-Agent`, approximate location, and possibly the client IP. The create passcode is only ever in a POST body, which is not logged.
