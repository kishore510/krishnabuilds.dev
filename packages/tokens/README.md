# @krishnabuilds/tokens

Design tokens for krishnabuilds.dev apps, in two layers:

- **Primitives**: raw palette, spacing, type scale, radii.
- **Semantic**: `bg`, `surface`, `text`, `text-muted`, `border`, `accent`, `accent-fg`, `danger`, `focus-ring`. Each has a light and a dark value pointing at a primitive.

Source of truth is `src/tokens.ts`. `pnpm build` checks WCAG AA contrast (fails the build below 4.5:1) and writes `dist/tokens.css`.

## Use

```css
@import "@krishnabuilds/tokens/tokens.css";

body {
  background: var(--kb-color-bg);
  color: var(--kb-color-text);
  font-family: var(--kb-font-family-sans);
}
```

Use semantic variables (`--kb-color-text`) in apps, not primitives (`--kb-color-gray-900`), so theming works.

The raw objects are also importable from TypeScript: `import { primitives, semantic } from "@krishnabuilds/tokens"`.

## Theming

- No `data-theme` on `<html>`: follows the OS (`prefers-color-scheme`).
- `<html data-theme="light">` or `<html data-theme="dark">`: forces that theme.

Each theme block also sets `color-scheme`, so form controls and scrollbars match.

A theme toggle UI comes later with the Portal. It will only set that attribute; the tokens will not change.
