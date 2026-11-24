// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fromPounds } from '@/lib/money'
import { settingsStore } from '@/settings/settings'
import { click, mount } from '@/test/dom'
import { type BudgetPageInputs, calculate } from '../definition'
import ShareDialog from './ShareDialog'

/* The share dialog (BD16). Amounts are made up. */

const inputs: BudgetPageInputs = {
  pay: fromPounds(3_000),
  payPeriod: 'monthly',
  income: [],
  accounts: [{ id: 'a1', name: 'Personal', kind: 'spending', amount: fromPounds(200), period: 'monthly' }],
  outgoings: [
    { name: 'Rent', amount: fromPounds(1_000), period: 'monthly', group: 'home', account: 'main', essential: true },
    { name: 'Fuel', amount: fromPounds(150), period: 'monthly', group: 'transport', account: 'a1', essential: true },
  ],
}

let view: ReturnType<typeof mount>
let closed = 0
beforeEach(() => {
  settingsStore.update({ amounts: 'pounds' })
  const outcome = calculate(inputs)
  if (!outcome.ok) throw new Error('refused')
  closed = 0
  view = mount(<ShareDialog inputs={inputs} result={outcome.result} onClose={() => closed++} />)
})
afterEach(() => view.unmount())

const $ = (selector: string) => document.querySelector(selector)
const pick = (format: string) => click($(`dialog input[type="radio"][value="${format}"]`))

describe('the share dialog', () => {
  it('is a labelled dialog that says nothing is uploaded, with four formats', () => {
    const dialog = $('dialog')!
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.textContent).toMatch(/Share your budget/)
    expect(dialog.textContent).toMatch(/Nothing is uploaded/)
    expect([...dialog.querySelectorAll('input[type="radio"]')].map((r) => (r as HTMLInputElement).value)).toEqual([
      'image',
      'pdf',
      'csv',
      'text',
    ])
    expect(($('dialog input[value="image"]') as HTMLInputElement).checked).toBe(true)
    expect($('dialog canvas')).not.toBeNull()
  })

  it('text: previews the summary; without amounts, no pound figure shows', () => {
    pick('text')
    expect($('dialog pre')?.textContent).toMatch(/Left over across accounts each month: £1,850/)
    expect($('dialog pre')?.textContent).toMatch(/Rent: £1,000/)
    click([...document.querySelectorAll('dialog [role="switch"]')][0]!)
    expect($('dialog pre')?.textContent).not.toMatch(/£/)
  })

  it('without line names, shows groups only', () => {
    pick('text')
    click([...document.querySelectorAll('dialog [role="switch"]')][1]!)
    expect($('dialog pre')?.textContent).not.toMatch(/Rent|Fuel/)
    expect($('dialog pre')?.textContent).toMatch(/Home: £1,000/)
  })

  it('spreadsheet: previews the CSV with a header row', () => {
    pick('csv')
    expect($('dialog pre')?.textContent).toMatch(/^"Group","Line","Paid from","A month","A year","Of income"/)
  })

  it('PDF: previews the page that prints, kept in a print-only root in the light theme', () => {
    pick('pdf')
    expect($('dialog article')?.textContent).toMatch(/Household budget/)
    const root = document.getElementById('sy-print-root')!
    expect(root.getAttribute('data-theme')).toBe('light')
    expect(root.textContent).toMatch(/Left in each account/)
  })

  it('Close closes it', () => {
    click($('dialog button[aria-label="Close"]'))
    act(() => {
      $('dialog')!.dispatchEvent(new Event('close'))
    })
    expect(closed).toBeGreaterThan(0)
  })
})
