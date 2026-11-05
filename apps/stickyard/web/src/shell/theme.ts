import { getTheme, setTheme } from "@krishnabuilds/ui";
import { create } from "zustand";
import { MEDIA } from "../styles/breakpoints";
import { STORAGE_KEYS, readKey, removeKey, type KeyValueStore } from "../storage";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Theme = "light" | "dark";

export function parsePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Cycle order for the single toggle button: system -> light -> dark -> system. */
export function nextPreference(preference: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(preference);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? "system";
}

/**
 * The preference, from the `kb-theme` cookie on .krishnabuilds.dev shared by every krishnabuilds.dev app (read and
 * written only through @krishnabuilds/ui; no cookie means system). Applied before first paint by the inline script in
 * index.html (a test keeps them in step).
 */
export function readPreference(): ThemePreference {
  try {
    return parsePreference(getTheme());
  } catch {
    return "system";
  }
}

/** Writes the shared preference. Returns false if the browser refused the cookie. */
function writePreference(preference: ThemePreference): boolean {
  try {
    setTheme(preference);
    return readPreference() === preference;
  } catch {
    return false;
  }
}

/**
 * The preference on first load (v0.45.0). A choice stored locally before (`stickyard:theme`) moves into the shared
 * cookie once, unless the cookie already holds a choice made in another app, which wins. The local copy is removed only
 * once the cookie holds the choice; if the cookie is blocked, the local choice keeps applying, as index.html does.
 */
export function migrateLocalTheme(store?: KeyValueStore): ThemePreference {
  const stored = readKey(STORAGE_KEYS.theme, store);
  if (stored === null) return readPreference();
  const local = parsePreference(stored);
  const shared = readPreference();
  if (shared === "system" && local !== "system" && !writePreference(local)) return local;
  removeKey(STORAGE_KEYS.theme, store);
  return readPreference();
}

const systemDark = () => Boolean(globalThis.matchMedia?.(MEDIA.systemDark).matches);

/** Applies the resolved theme to <html data-theme>. */
export function applyTheme(preference: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(preference, systemDark());
}

interface ThemeState {
  preference: ThemePreference;
  set(preference: ThemePreference): void;
  cycle(): void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  preference: migrateLocalTheme(),
  set: (preference) => {
    writePreference(preference);
    // The shared helper clears data-theme for system; Stickyard's own tokens need it set.
    applyTheme(preference);
    set({ preference });
  },
  cycle: () => get().set(nextPreference(get().preference)),
}));

/** Applies the stored theme now and follows the OS setting while the preference is "system". */
export function startTheme(): () => void {
  applyTheme(useThemeStore.getState().preference);
  const media = globalThis.matchMedia?.(MEDIA.systemDark);
  const onChange = () => applyTheme(useThemeStore.getState().preference);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
