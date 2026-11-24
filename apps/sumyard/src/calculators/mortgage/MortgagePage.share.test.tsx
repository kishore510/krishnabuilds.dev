// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatGBP } from '@/lib/format'
import { fromPence, fromPounds, toPence } from '@/lib/money'
import { scenarioStore } from '@/scenarios/index'
import { settingsStore } from '@/settings/settings'
import { click, mount, type } from '@/test/dom'
import { toasts } from '@/toast/toasts'
import { sessionFor } from '../session'
import { calculate, type MortgagePageInputs, mortgageCalculator } from './definition'
import MortgagePage from './MortgagePage'
import ShareMortgage from './ShareMortgage'

/* The mortgage redesign: section icons, the headline before the warnings, the ring and Share. Kept apart from the page tests. */

let view: ReturnType<typeof mount>
const session = sessionFor(mortgageCalculator)
beforeEach(() => {
  localStorage.clear()
  scenarioStore.clear()
  settingsStore.update({ amounts: 'pence' })
  session.startNew()
  view = mount(<MortgagePage />)
})
afterEach(() => {
  view.unmount()
  toasts.dismiss()
})

const $ = (selector: string) => document.querySelector(selector)
const set = (patch: Partial<MortgagePageInputs>) => act(() => session.setInputs(patch))
const money = (pence: number) => formatGBP(fromPence(pence), 'pence')

const example: Partial<MortgagePageInputs> = {
  startDate: '2026-01-15',
  balance: fromPounds(200_000),
  termYears: 25,
  fixed: true,
  fixedRate: '4.5',
  fixedEndDate: '2028-01-31',
  reversionRate: '7',
  monthly: fromPounds(200),
  lumpSums: [{ date: '2026-06-01', amount: fromPounds(30_000) }],
  erc: true,
  ercRate: '3',
  allowanceRate: '10',
}

function ok() {
  const out = calculate(session.get().inputs)
  if (out.kind !== 'ok') throw new Error(out.kind)
  return out
}

describe('mortgage redesign', () => {
  it('every input section has an icon tile, hidden from screen readers', () => {
    const headers = [...view.host.querySelectorAll('button[id^="mo-section-"][aria-expanded]')]
    expect(headers.length).toBe(6)
    for (const h of headers) expect(h.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
  })

  it('the headline comes before the warnings', () => {
    set(example)
    const answer = $('[data-answer]')!
    const warning = $('[data-warning="over-allowance"]')!
    expect(answer.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the ring: amount borrowed paid off, interest and the charge, adding up to the total paid', () => {
    set(example)
    const { result } = ok()
    const ring = $('[data-ring]')!
    const arcs = [...ring.querySelectorAll('circle[data-part]')]
    expect(arcs.map((a) => a.getAttribute('data-part'))).toEqual(['capital', 'interest', 'charge'])
    expect(arcs.reduce((t, a) => t + Number(a.getAttribute('data-value')), 0)).toBe(toPence(result.overpaying.totalPaid))
    expect(ring.querySelector('[data-total-paid]')?.textContent).toBe(money(toPence(result.overpaying.totalPaid)))
    expect($('[data-owed-note]')).toBeNull()
  })

  it('interest-only: what is still owed is said beside the ring, not drawn in it', () => {
    set({ ...example, repaymentType: 'interest-only', erc: false })
    expect($('[data-ring] circle[data-part="capital"]')).not.toBeNull()
    expect($('[data-owed-note]')?.textContent).toMatch(/Still owed at the end/)
  })

  it('Share is off until there are results, and off again while an input needs fixing', () => {
    const share = $('#mo-share') as HTMLButtonElement
    expect(share.disabled).toBe(true)
    set(example)
    expect(share.disabled).toBe(false)
    expect(share.getAttribute('aria-haspopup')).toBe('dialog')
    type($('#mo-balance') as HTMLInputElement, 'abc')
    expect(share.disabled).toBe(true)
  })

  it('the dialog has an amounts switch and no line names switch; amounts off shows no pound figure', () => {
    set(example)
    const { result, inputs } = ok()
    const dialog = mount(<ShareMortgage share={{ result, inputs, whatIf: false }} onClose={() => undefined} />)
    try {
      const el = $('dialog')!
      expect(el.textContent).toMatch(/Share your mortgage overpayment/)
      expect(el.querySelectorAll('[role="switch"]')).toHaveLength(1)
      click($('dialog input[value="text"]'))
      expect($('dialog pre')!.textContent).toMatch(/^Mortgage overpayment, .* \(over the term\)/)
      expect($('dialog pre')!.textContent).toMatch(/£/)
      click(el.querySelector('[role="switch"]'))
      expect($('dialog pre')!.textContent).not.toMatch(/£/)
    } finally {
      dialog.unmount()
    }
  })
})
