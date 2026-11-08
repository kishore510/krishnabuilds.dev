# Story Maps

Illustrated maps that follow a story across the land, one chapter at a time. Live at https://story-maps.krishnabuilds.dev.

Three sections:

- **Legends**: epics and sacred stories, placed where tradition puts them.
- **Chronicles**: ancient civilisations and the routes that joined them.
- **Deep Time**: the Earth and the sky before people (later).

Every story is listed in `manifest.json` and has a folder under `stories/`. A small Node build (`scripts/build.mjs`) turns them into one self-contained HTML page per story plus a hub page. No framework, no backend. Deployed as a Cloudflare Worker serving static assets, from `.github/workflows/deploy-story-maps.yml` on pushes to `main`.

```sh
pnpm turbo run build lint typecheck test --filter=@krishnabuilds/story-maps
```

Working notes, content rules and performance rules are in `CLAUDE.md`.

## Licence

There is no licence file: all rights are reserved, like the rest of this repo (see `docs/decisions.md`). The stories, maps and illustrations may not be reused without permission.

Third-party material keeps its own terms:

- **Fonts**: Yatra One (Copyright 2014 The Yatra Project Authors) and Tiro Devanagari Hindi (Copyright 2020 The Indigo Project Authors), both under the SIL Open Font License 1.1, installed from the Fontsource npm packages. The full licence texts are in `licences/` and are published next to the font files.
- Any other third-party art or data needs its own attribution, recorded here, before it is added.
