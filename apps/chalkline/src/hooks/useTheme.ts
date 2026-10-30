import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { readThemePreference, subscribeThemePreference, writeThemePreference } from '@/lib/sharedTheme'
import { nextPreference, resolveTheme, type Theme, type ThemePreference } from '@/lib/theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function useSystemDark() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DARK_QUERY)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  )
}

/** Current theme preference (the shared kb-theme cookie), applied to <html data-theme> and kept in sync with the OS. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribeThemePreference, readThemePreference, (): ThemePreference => 'system')
  const theme: Theme = resolveTheme(preference, useSystemDark())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const set = useCallback((next: ThemePreference) => {
    writeThemePreference(next)
    // The shared helper clears data-theme for system; Chalkline's own tokens need it set.
    document.documentElement.dataset.theme = resolveTheme(next, window.matchMedia(DARK_QUERY).matches)
  }, [])
  const cycle = useCallback(() => set(nextPreference(readThemePreference())), [set])

  return { preference, theme, set, cycle }
}
