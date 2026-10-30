import { storedPreference, type ThemePreference } from '@/lib/theme'
import { readKey, removeKey, writeKey, type KeyValueStore } from '@/persistence/localStore'
import { STORAGE_KEYS } from '@/persistence/storageKeys'
import { readLegacyPrefs } from './legacy'
import { defaultSettings, parseSettings, parseSettingsText, SECTION_NAMES, type Settings } from './schema'

export const SETTINGS_KEY = STORAGE_KEYS.settings.key

export interface SettingsLoad {
  settings: Settings
  /** Old preference keys folded into settings on this load (empty after the first run). */
  migrated: string[]
  /** Old keys that were removed after migrating. */
  removed: string[]
  /** A theme Chalkline had stored locally (before 0.32), found on this load and offered to the shared cookie. */
  theme: ThemePreference | null
}

/** Moves a locally stored theme to the shared cookie; true when the local copy can be dropped. */
export type AdoptTheme = (local: ThemePreference) => boolean

const hasStoredTheme = (text: string): boolean => {
  try {
    const raw: unknown = JSON.parse(text)
    return typeof raw === 'object' && raw !== null && 'appearance' in raw
  } catch {
    return false
  }
}

/** Merges a partial set of sections into settings, then validates (bad values fall back). */
export function mergeSettings(base: Settings, patch: { [K in keyof Settings]?: Partial<Settings[K]> }): Settings {
  const next: Record<string, unknown> = { ...base }
  for (const name of SECTION_NAMES) {
    const part = patch[name]
    if (part) next[name] = { ...base[name], ...part }
  }
  return parseSettings(next)
}

/**
 * Loads settings. On the first run of this version there is no settings key
 * yet: old preference keys are folded in, written under the new key, and the
 * old keys removed only once that write has succeeded (and reads back).
 * Someone with old preferences or an autosave is not a first-time visitor.
 */
export function loadSettings(storage: KeyValueStore | undefined, adoptTheme: AdoptTheme = () => false): SettingsLoad {
  const write = (settings: Settings) => {
    const serialized = JSON.stringify(settings)
    return writeKey(SETTINGS_KEY, serialized, storage) === 'ok' && readKey(SETTINGS_KEY, storage) === serialized
  }

  const text = readKey(SETTINGS_KEY, storage)
  if (text !== null) {
    const settings = parseSettingsText(text)
    if (!hasStoredTheme(text)) return { settings, migrated: [], removed: [], theme: null }
    // Settings from before 0.32 hold the theme. Once the shared cookie has it, rewrite settings without it, once.
    const theme = storedPreference(text, null)
    if (adoptTheme(theme)) write(settings)
    return { settings, migrated: [], removed: [], theme }
  }

  const legacy = readLegacyPrefs(storage)
  const returning = legacy.found.length > 0 || readKey(STORAGE_KEYS.autosave.key, storage) !== null
  const settings = mergeSettings(defaultSettings(), { ...legacy.patch, ...(returning && { onboarding: { firstRunDone: true } }) })
  if (!returning) return { settings, migrated: [], removed: [], theme: null }

  // The old theme key is removed only once the shared cookie has its value.
  const keepTheme = legacy.theme !== null && !adoptTheme(legacy.theme)
  const removable = legacy.found.filter((key) => !(keepTheme && key === STORAGE_KEYS.legacyTheme.key))
  const removed = write(settings) ? removable.filter((key) => removeKey(key, storage)) : []
  return { settings, migrated: legacy.found, removed, theme: legacy.theme }
}
