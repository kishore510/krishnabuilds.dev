// @vitest-environment happy-dom
import { apps, isOpen } from '@krishnabuilds/ui'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@/test/dom'
import { MainMenu } from './MainMenu'

let view: ReturnType<typeof mount>
beforeEach(() => {
  view = mount(<MainMenu />)
  act(() => view.host.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click())
})
afterEach(() => view.unmount())

const nav = () => view.host.querySelector('nav')
const menu = () => view.host.querySelector('[role="menu"]')
const key = (target: Element, init: KeyboardEventInit) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  })

describe('MainMenu site links', () => {
  it('links home and to the other apps, with Sumyard marked current', () => {
    const links = [...nav()!.querySelectorAll('a')]
    expect(links[0]?.textContent).toBe('krishnabuilds')
    expect(links[0]?.getAttribute('href')).toBe('https://krishnabuilds.dev')
    const appLinks = links.slice(1)
    expect(appLinks.map((a) => a.textContent)).toEqual(apps.filter(isOpen).map((app) => app.name))
    expect(appLinks.map((a) => a.textContent)).toEqual(expect.arrayContaining(['Chalkline', 'Sumyard']))
    const current = nav()!.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toBe('Sumyard')
  })

  it('are plain links below the menu commands, outside the menu role, at touch size', () => {
    expect(nav()!.closest('[role="menu"]')).toBeNull()
    expect(menu()!.compareDocumentPosition(nav()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const a of nav()!.querySelectorAll('a')) {
      expect(a.getAttribute('role')).toBeNull()
      expect(a.hasAttribute('tabindex')).toBe(false)
      expect(a.hasAttribute('target')).toBe(false)
      expect(a.className).toMatch(/\bh-touch\b/)
    }
  })

  it('Tab from a menu item keeps the menu open so focus moves on into the site links', () => {
    const item = view.host.querySelector('[role="menuitem"]')!
    key(item, { key: 'Tab' })
    expect(menu()).not.toBeNull()
    act(() => nav()!.querySelector('a')!.focus())
    expect(menu()).not.toBeNull()
    expect(document.activeElement?.textContent).toBe('krishnabuilds')
  })

  it('Escape on a site link closes the menu and returns focus to the button', () => {
    const link = nav()!.querySelector('a')!
    act(() => link.focus())
    key(link, { key: 'Escape' })
    expect(menu()).toBeNull()
    expect(document.activeElement?.getAttribute('aria-haspopup')).toBe('menu')
  })

  it('focus moving out of the panel (Tab past the last link) closes the menu', () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    act(() => [...nav()!.querySelectorAll('a')].at(-1)!.focus())
    act(() => outside.focus())
    expect(menu()).toBeNull()
    outside.remove()
  })
})
