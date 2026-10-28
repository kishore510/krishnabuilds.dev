// @vitest-environment happy-dom
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { FileMenu } from './FileMenu'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let unmount: () => void = () => undefined
afterEach(() => {
  unmount()
  document.body.innerHTML = ''
})

async function openMenu() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () =>
    root.render(
      <ReactFlowProvider>
        <FileMenu layout="phone" />
      </ReactFlowProvider>,
    ),
  )
  unmount = () => act(() => root.unmount())
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click())
  return host
}

describe('File menu site links', () => {
  it('links home and to the apps, with Chalkline marked current', async () => {
    const host = await openMenu()
    const nav = host.querySelector('nav')!
    const links = [...nav.querySelectorAll('a')]
    expect(links[0]?.textContent).toBe('krishnabuilds')
    expect(links[0]?.getAttribute('href')).toBe('https://krishnabuilds.dev')
    expect(links.map((a) => a.textContent)).toContain('Chalkline')
    const current = nav.querySelector('[aria-current="page"]')
    expect(current?.textContent).toBe('Chalkline')
    // Above the file commands, and not inside the menu role.
    expect(nav.compareDocumentPosition(host.querySelector('[role="menu"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(nav.closest('[role="menu"]')).toBeNull()
  })
})
