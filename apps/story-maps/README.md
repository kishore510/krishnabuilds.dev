# Story Maps

Illustrated maps that follow a story across the land, one chapter at a time. Live at https://story-maps.krishnabuilds.dev.

Three sections:

- **Legends**: epics and sacred stories, placed where tradition puts them.
- **Chronicles**: civilisations, empires and the routes that joined them, ancient and modern.
- **Deep Time**: the Earth and the sky before people (later).

Every story is listed in `manifest.json` and has a folder under `stories/`. The hub's Timeline and Browse, and an entry page for every civilisation, dynasty, event, legend and route, come from `catalogue.json`. A small Node build (`scripts/build.mjs`) turns them into one self-contained HTML page per story and entry, plus the hub page. No framework, no backend. Deployed as a Cloudflare Worker serving static assets, from `.github/workflows/deploy-story-maps.yml` on pushes to `main`.

```sh
pnpm turbo run build lint typecheck test --filter=@krishnabuilds/story-maps
```

Working notes, content rules and performance rules are in `CLAUDE.md`.

## Licence

There is no licence file: all rights are reserved, like the rest of this repo (see `docs/decisions.md`). The stories, maps and illustrations may not be reused without permission.

Third-party material keeps its own terms:

- **Fonts**: Yatra One (Copyright 2014 The Yatra Project Authors) and Tiro Devanagari Hindi (Copyright 2020 The Indigo Project Authors), both under the SIL Open Font License 1.1, installed from the Fontsource npm packages. The full licence texts are in `licences/` and are published next to the font files.
- **Coastlines and country shapes**: the `world` basemap and the Powers areas in The British Empire are simplified from Natural Earth 1:110m land and countries, which are in the public domain (naturalearthdata.com). The `near-east` basemap's coastlines and lakes, and the coasts of the Powers areas in Mesopotamia and Pharaonic Egypt, are simplified from Natural Earth 1:50m land and lakes, and its rivers from Natural Earth 1:10m rivers, also public domain. Made with Natural Earth.
- Any other third-party art or data needs its own attribution, recorded here, before it is added.
