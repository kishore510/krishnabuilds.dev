import { getTheme, setTheme } from '@krishnabuilds/ui'
import { parsePreference, type ThemePreference } from './theme'

/*
 * The theme preference is shared by every krishnabuilds.dev app: the `kb-theme`
 * cookie on .krishnabuilds.dev, read and written only through @krishnabuilds/ui
 * (light or dark; no cookie means system). Sumyard keeps no copy of its own;
 * `sumyard:v1:theme` is only read once, to move an older choice across.
 */

export const readSharedTheme = (): ThemePreference => {
  try {
    return parsePreference(getTheme())
  } catch {
    return 'system'
  }
}

/** Writes the shared preference. Returns false if the browser refused the cookie. */
export function writeSharedTheme(preference: ThemePreference): boolean {
  try {
    setTheme(preference)
    return readSharedTheme() === preference
  } catch {
    return false
  }
}

/**
 * One-time move of a theme Sumyard stored locally (before 0.32.0) into the
 * shared cookie. A choice already in the cookie, made in another app, wins.
 * Returns true when the local copy can be dropped: the cookie holds the
 * choice, or there was nothing to keep (system).
 */
export function adoptLocalTheme(local: ThemePreference): boolean {
  if (readSharedTheme() !== 'system' || local === 'system') return true
  return writeSharedTheme(local)
}
