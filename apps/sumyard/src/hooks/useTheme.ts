import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { adoptLocalTheme, readSharedTheme, writeSharedTheme } from '@/lib/sharedTheme'
import { nextPreference, readPreference, resolveTheme, THEME_KEY, type Theme, type ThemePreference } from '@/lib/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const storage = (): Storage | undefined => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

// The preference lives in the shared kb-theme cookie (see src/lib/sharedTheme.ts). This in-memory copy keeps the choice
// for the visit even when the cookie is blocked, and listeners re-render on change.
let current: ThemePreference | undefined
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

/**
 * The preference on first read. A Light or Dark choice stored locally before 0.32.0 moves into the shared cookie once
 * (unless the cookie already holds a choice from another app), and the local copy is removed only when that worked.
 * If the cookie is blocked, the local choice still applies for this visit, as the pre-paint script does.
 */
function initialPreference(): ThemePreference {
  const store = storage()
  let stored: string | null = null
  try {
    stored = store?.getItem(THEME_KEY) ?? null
  } catch {
    stored = null
  }
  if (stored === null) return readSharedTheme()
  const local = readPreference(store)
  if (!adoptLocalTheme(local)) return local
  try {
    store?.removeItem(THEME_KEY)
  } catch {
    // Left in place: the next visit tries again.
  }
  return readSharedTheme()
}

function getPreference(): ThemePreference {
  current ??= initialPreference()
  return current
}

const systemDark = () => window.matchMedia?.(DARK_QUERY).matches ?? false

function setPreference(next: ThemePreference) {
  current = next
  writeSharedTheme(next)
  // The shared helper clears data-theme for system; Sumyard's own tokens need it set.
  document.documentElement.dataset.theme = resolveTheme(next, systemDark())
  notify()
}

function subscribePreference(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia?.(DARK_QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

/** Current theme preference, applied to <html data-theme> and kept in sync with the OS (as Chalkline's useTheme). */
export function useTheme() {
  const preference = useSyncExternalStore(subscribePreference, getPreference, () => 'system' as const)
  const theme: Theme = resolveTheme(
    preference,
    useSyncExternalStore(subscribeSystem, systemDark, () => false),
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const set = useCallback((next: ThemePreference) => setPreference(next), [])
  const cycle = useCallback(() => setPreference(nextPreference(getPreference())), [])

  return { preference, theme, set, cycle }
}

/** The theme preference outside React (backup and restore). Same store as the toggle. */
export const themeStore = { get: getPreference, set: setPreference }

/** Tests only: forget the in-memory preference so the next read comes from the cookie (and any old local value). */
export function resetThemeForTests() {
  current = undefined
}
