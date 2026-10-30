import { getTheme, setTheme } from '@krishnabuilds/ui'
import { type ThemePreference } from './theme'

/*
 * The theme preference is shared by every krishnabuilds.dev app: the `kb-theme`
 * cookie on .krishnabuilds.dev, read and written only by @krishnabuilds/ui
 * (light or dark; no cookie means system). Chalkline keeps no copy of its own.
 */

const listeners = new Set<() => void>()

export function subscribeThemePreference(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export const readThemePreference = (): ThemePreference => getTheme()

export function writeThemePreference(preference: ThemePreference) {
  setTheme(preference)
  for (const onChange of listeners) onChange()
}

/**
 * One-time move of a theme Chalkline stored locally (before 0.32) into the
 * shared cookie. A choice already in the cookie, made in another app, wins.
 * Returns true when the local copy can be dropped: the cookie holds the
 * choice, or there was nothing to keep (system).
 */
export function adoptLocalTheme(local: ThemePreference): boolean {
  try {
    if (getTheme() !== 'system' || local === 'system') return true
    setTheme(local)
    return getTheme() === local
  } catch {
    return false
  }
}
