# Brand assets

The minimal branding set (see "Minimal branding set" in `docs/decisions.md`).

- `favicon.svg`: hand-written "kb" on the accent (#1f6aa5) rounded square. Copied as-is into each app's `public/` folder (Arcade: its root).
- `apple-touch-icon.png` (180×180): `favicon.svg` rendered square (no rounded corners; iOS adds its own), copied into each app.
- `og.png` (1200×630): `og.html` rendered with Chromium. It lives only in the Portal (`apps/portal/public/og.png`); every app's `og:image` points at `https://krishnabuilds.dev/og.png`.

To regenerate the PNGs, open `og.html` in Chromium at 1200×630 and screenshot it, and screenshot `favicon.svg` at 180×180 with `rect { rx: 0 }`. Then copy the files back into the apps. Tags are copied into each `index.html` by hand; there is no shared Head component.
