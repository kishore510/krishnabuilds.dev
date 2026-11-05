// @vitest-environment happy-dom

import { setTheme } from '@krishnabuilds/ui'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetThemeForTests } from '@/hooks/useTheme'
import { THEME_KEY } from '@/lib/theme'
import { ThemeToggle } from './ThemeToggle'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLElement

function render() {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<ThemeToggle />))
  return host.querySelector('button')!
}

const sharedTheme = () => document.cookie.match(/(?:^|; )kb-theme=([a-z]+)/)?.[1] ?? null

beforeEach(() => {
  localStorage.clear()
  setTheme('system')
  resetThemeForTests()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('ThemeToggle', () => {
  it('starts on System and cycles System -> Light -> Dark -> System, saving each choice in the shared cookie', () => {
    const button = render()
    expect(button.getAttribute('aria-label')).toBe('System theme (tap to change)')

    act(() => button.click())
    expect(button.getAttribute('aria-label')).toBe('Light theme (tap to change)')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(sharedTheme()).toBe('light')

    act(() => button.click())
    expect(button.getAttribute('aria-label')).toBe('Dark theme (tap to change)')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(sharedTheme()).toBe('dark')

    act(() => button.click())
    expect(button.getAttribute('aria-label')).toBe('System theme (tap to change)')
    expect(sharedTheme()).toBeNull()
    expect(document.documentElement.dataset.theme).toMatch(/^(light|dark)$/)
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
  })

  it('restores the shared choice on the next visit', () => {
    setTheme('dark')
    const button = render()
    expect(button.getAttribute('aria-label')).toBe('Dark theme (tap to change)')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('moves a choice stored before 0.32.0 into the shared cookie once, then removes the local copy', () => {
    localStorage.setItem(THEME_KEY, JSON.stringify({ schemaVersion: 1, theme: 'dark' }))
    const button = render()
    expect(button.getAttribute('aria-label')).toBe('Dark theme (tap to change)')
    expect(sharedTheme()).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
  })

  it('keeps a choice already made in another app over an older local one', () => {
    setTheme('light')
    localStorage.setItem(THEME_KEY, JSON.stringify({ schemaVersion: 1, theme: 'dark' }))
    const button = render()
    expect(button.getAttribute('aria-label')).toBe('Light theme (tap to change)')
    expect(sharedTheme()).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
  })

  it('is a 44 px touch target with an icon', () => {
    const button = render()
    expect(button.className).toContain('size-touch')
    expect(button.querySelector('svg')).not.toBeNull()
  })
})
