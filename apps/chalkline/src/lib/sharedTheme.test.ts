// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { adoptLocalTheme, readThemePreference, subscribeThemePreference, writeThemePreference } from './sharedTheme'

// happy-dom keeps a Max-Age=0 cookie (as `kb-theme=system`) where a browser deletes it, so tests
// check that no light or dark choice is stored rather than that the cookie is gone.
const clearCookie = () => {
  document.cookie = 'kb-theme=; Path=/; Max-Age=0'
}

describe('shared theme (kb-theme cookie)', () => {
  afterEach(clearCookie)

  it('reads system when there is no cookie, and what was written otherwise', () => {
    expect(readThemePreference()).toBe('system')
    writeThemePreference('dark')
    expect(document.cookie).toContain('kb-theme=dark')
    expect(readThemePreference()).toBe('dark')
    writeThemePreference('system')
    expect(document.cookie).not.toMatch(/kb-theme=(light|dark)/)
    expect(readThemePreference()).toBe('system')
  })

  it('tells subscribers when it changes', () => {
    let calls = 0
    const stop = subscribeThemePreference(() => calls++)
    writeThemePreference('light')
    stop()
    writeThemePreference('dark')
    expect(calls).toBe(1)
  })

  it('moves a local choice into the cookie when there is none', () => {
    expect(adoptLocalTheme('dark')).toBe(true)
    expect(readThemePreference()).toBe('dark')
  })

  it('keeps a choice made in another app over the local one', () => {
    writeThemePreference('light')
    expect(adoptLocalTheme('dark')).toBe(true)
    expect(readThemePreference()).toBe('light')
  })

  it('writes nothing for a local system choice', () => {
    expect(adoptLocalTheme('system')).toBe(true)
    expect(document.cookie).not.toMatch(/kb-theme=(light|dark)/)
  })
})
