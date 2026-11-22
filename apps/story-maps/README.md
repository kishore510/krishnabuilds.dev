# Story Maps

Illustrated maps that follow a story across the land, one chapter at a time. Live at https://story-maps.krishnabuilds.dev.

The front page has three shelves, Nature, Humankind and Science, each holding subjects (sections). Those with stories so far:

- **Legends**: epics and sacred stories, placed where tradition puts them.
- **Chronicles**: civilisations, empires and the routes that joined them, ancient and modern.
- **Universe**: the sky and everything in it (the first subject on the Nature shelf; Earth and Life to come).
- **Lives**: people followed from place to place, on the Humankind shelf.
- **Physics and Astronomy**: the first subject on the Science shelf; discoveries and ideas, not biographies.

Every story is listed in `manifest.json` and has a folder under `stories/`. The hub's Timeline and Browse, and an entry page for every civilisation, dynasty, event, legend and route, come from `catalogue.json`. A small Node build (`scripts/build.mjs`) turns them into one self-contained HTML page per story and entry, plus the front page and Explore (`/explore/`). No framework. Deployed as a Cloudflare Worker serving static assets plus a tiny counts API for likes and reads (`src/worker.js`, one KV namespace each), from `.github/workflows/deploy-story-maps.yml` on pushes to `main`.

```sh
pnpm turbo run build lint typecheck test --filter=@krishnabuilds/story-maps
```

Working notes, content rules and performance rules are in `CLAUDE.md`.

## Licence

There is no licence file: all rights are reserved, like the rest of this repo (see `docs/decisions.md`). The stories, maps and illustrations may not be reused without permission.

Third-party material keeps its own terms:

- **Fonts**: Yatra One (Copyright 2014 The Yatra Project Authors) and Tiro Devanagari Hindi (Copyright 2020 The Indigo Project Authors), both under the SIL Open Font License 1.1, installed from the Fontsource npm packages. The full licence texts are in `licences/` and are published next to the font files.
- **Coastlines and country shapes**: the `world` basemap and the Powers areas in The British Empire are simplified from Natural Earth 1:110m land and countries, which are in the public domain (naturalearthdata.com). The `near-east` basemap's coastlines and lakes, and the coasts of the Powers areas in Mesopotamia and Pharaonic Egypt, are simplified from Natural Earth 1:50m land and lakes, and its rivers from Natural Earth 1:10m rivers, also public domain. The `mesoamerica` basemap's coastlines, lakes and rivers are simplified from Natural Earth 1:10m land, lakes and rivers, also public domain; its Valley of Mexico lakes, Lake Pátzcuaro and Lake Petén Itzá are drawn by hand. The `europe` basemap's coastlines are simplified from Natural Earth 1:50m land, also public domain; its Seine, Rhine and Vistula are drawn by hand. Made with Natural Earth.
- **Ancient coastlines**: the `earth-deep` basemap's eras from 535 million years ago to today are simplified from PaleoMAP PaleoCoastlines v7.1 by A. T. Kocsis and C. R. Scotese (2020), licensed CC BY 4.0 (doi:10.5281/zenodo.4297693; see Kocsis and Scotese, *Earth-Science Reviews* 213, 2021, doi:10.1016/j.earscirev.2020.103463). Ancient positions of places are reconstructed with the PALEOMAP rotation model in the same dataset. The older eras and the ice-age ice sheets are drawn by hand and are illustrative. `scripts/paleo/` rebuilds the basemap from the dataset.
- **The Moon**: the `moon` basemap's maria are simplified from the LROC Global Mare Boundaries (LROC_GLOBAL_MARE_180), made by the LROC Science Operations Center at Arizona State University for NASA's Lunar Reconnaissance Orbiter; its metadata sets no use or access constraints (Nelson et al., *Lunar and Planetary Science Conference* 45, 2014, abstract 2861). Crater and mare names, centres and diameters are from the IAU Gazetteer of Planetary Nomenclature, USGS Astrogeology Science Center, which is in the public domain. The South Pole–Aitken basin ring follows Garrick-Bethell and Zuber, *Icarus* 204, 2009. `scripts/moon/` rebuilds the basemap from both datasets.
- Any other third-party art or data needs its own attribution, recorded here, before it is added.
