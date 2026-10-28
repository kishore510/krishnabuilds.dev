# @krishnabuilds/ui

Small set of shared React components for krishnabuilds.dev apps.

## What's in it

- **App list** (`apps`, `groups`, `statusLabels`, `isOpen`, `AppEntry`): the typed list of apps. The single source for the site header menu and the Portal's cards.
- **`SiteHeader`**: site name, app links and theme toggle; collapses behind a menu button on narrow screens.
- **`SiteLinks`**: unstyled home link plus links to the apps that can be opened, with the `current` app marked `aria-current="page"`. No CSS and no token variables: the app styles the `kb-site-links__*` class hooks or passes its own classes via `classNames`. For apps that put site links in their own menu (Chalkline).
- **`ThemeToggle`** and `getTheme` / `setTheme`: Light / Dark / System, stored in the `kb-theme` cookie on `.krishnabuilds.dev` so every subdomain shares it.

## Use

Source-only: there is no build step. The package exports TypeScript/React source and each app's Vite compiles it, including the components' CSS.

```jsonc
// apps/<app>/package.json
"devDependencies": { "@krishnabuilds/ui": "workspace:*" }
```

```tsx
import "@krishnabuilds/tokens/tokens.css";
import { apps, SiteHeader } from "@krishnabuilds/ui";

<SiteHeader apps={apps} />;
```

The CSS uses `@krishnabuilds/tokens` variables, so the app must load `tokens.css`. React is a peer dependency.

To avoid a theme flash, the app's `index.html` needs the inline head script that reads `kb-theme` (see `apps/portal/index.html`). Keep it in sync with `src/theme.ts`.

## Rule

Only add a component here once two apps need it. No speculative shared components.
