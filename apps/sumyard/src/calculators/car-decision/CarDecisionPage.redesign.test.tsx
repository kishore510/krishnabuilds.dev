// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatGBP } from '@/lib/format'
import { fromPounds, type Money, toPence } from '@/lib/money'
import { percentRatio } from '@/lib/parse'
import { scenarioStore } from '@/scenarios/index'
import { settingsStore } from '@/settings/settings'
import { click, mount, type } from '@/test/dom'
import { toasts } from '@/toast/toasts'
import { compareOptions } from '../car-ownership/calc'
import { sessionFor } from '../session'
import CarDecisionPage from './CarDecisionPage'
import { type CarDecisionInputs, calculate, carDecisionCalculator, resolveOption, toEngineOption } from './definition'
import { cash, inputs, keep, loan, pcp } from './fixtures/inputs'
import { CAR_FIELDS } from './setup'

/*
 * The car decision redesign (CD1 to CD11) on the page: option rows that open one at a time, Start from and Copy the car
 * with Undo, the range and mileage switches, the answer's headline and bars, the chart's measure and the three cases
 * shown only with a range. Kept apart from the older page tests (happy-dom keeps every page with a select alive).
 * Every expected figure is the engine's.
 */

let view: ReturnType<typeof mount>
const session = sessionFor(carDecisionCalculator)

beforeEach(() => {
  localStorage.clear()
  scenarioStore.clear()
  settingsStore.update({ amounts: 'pence' })
  session.startNew()
  view = mount(<CarDecisionPage />)
})
afterEach(() => {
  view.unmount()
  toasts.dismiss()
})

const $ = (selector: string, within: ParentNode = view.host) => within.querySelector(selector)
const $$ = (selector: string, within: ParentNode = view.host) => [...within.querySelectorAll(selector)]
const money = (amount: Money) => formatGBP(amount, 'pence')
const set = (patch: Partial<CarDecisionInputs>) => act(() => session.setInputs(patch))
const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? ''
const rows = () => $$('[data-option-row] > button[aria-expanded]') as HTMLButtonElement[]
const panelOf = (row: HTMLButtonElement) => $(`#${row.getAttribute('aria-controls')}`)!
const pick = (select: HTMLSelectElement, value: string) =>
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })

function engine(i: CarDecisionInputs) {
  const outcome = compareOptions(
    i.options.map((o) => toEngineOption(resolveOption(o, i.annualMileage), percentRatio(i.generalIncrease!))),
    { horizonMonths: i.horizonMonths, savingsReturn: percentRatio(i.savingsReturn!) },
  )
  if (!outcome.ok) throw new Error('refused')
  return outcome.result
}

describe('option rows (CD1, CD2)', () => {
  it('a fresh page opens the first option on its editor; the others are rows', () => {
    const [first, second] = rows()
    expect(first!.getAttribute('aria-expanded')).toBe('true')
    expect(second!.getAttribute('aria-expanded')).toBe('false')
    expect(panelOf(second!).hasAttribute('hidden')).toBe(true)
  })

  it('one editor open at a time; a row says its summary and, once costed, its cost a month', () => {
    const i = inputs([keep(), loan()])
    set(i)
    const [first, second] = rows()
    click(second)
    expect(second!.getAttribute('aria-expanded')).toBe('true')
    expect(first!.getAttribute('aria-expanded')).toBe('false')
    const result = engine(i)
    expect(text($('[data-row-figure]', first!.parentElement!))).toBe(
      `${money(result.options[0]!.cases.expected.netCostPerCoverageMonth)} a month`,
    )
    expect(text(first)).toContain('Keep current car · worth')
    // Each row has an icon tile in its option's colour (CD1), hidden from screen readers.
    expect(first!.querySelector('[aria-hidden="true"]')!.className).toMatch(/bg-car-1/)
    expect(second!.querySelector('[aria-hidden="true"]')!.className).toMatch(/bg-car-2/)
  })

  it('a closed editor keeps its boxes mounted, so typed text survives closing it', () => {
    const [first] = rows()
    const value = $('[id$="-value"]', panelOf(first!)) as HTMLInputElement
    type(value, '12,345')
    click(first)
    expect(panelOf(first!).hasAttribute('hidden')).toBe(true)
    expect(value.value).toBe('12,345')
  })
})

describe('Start from (CD3)', () => {
  it('sets the kinds and names, every amount empty, with Undo back to the options before', () => {
    const before = inputs([keep(), loan()])
    set(before)
    click($('#cd-template-finance-offers'))
    expect(session.get().inputs.options.map((o) => [o.acquisition, o.name])).toEqual([
      ['loan', 'Loan'],
      ['hire-purchase', 'HP'],
      ['pcp', 'PCP'],
    ])
    expect(session.get().inputs.options.every((o) => o.value === null)).toBe(true)
    expect(rows()[0]!.getAttribute('aria-expanded')).toBe('true')
    act(() => toasts.undo())
    expect(session.get().inputs.options).toEqual(before.options)
  })
})

describe('Copy the car (CD4)', () => {
  it('copies the car into this option, not its finance, with Undo', () => {
    const source = cash({ name: 'Car A', value: fromPounds(21_000), annualMileage: 12_000 })
    const target = loan({ name: 'Loan on A' })
    set(inputs([source, target]))
    click(rows()[1])
    const select = $('[id$="-copy-from"]', panelOf(rows()[1]!)) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['Choose an option', 'Car A'])
    pick(select, '0')
    const copied = session.get().inputs.options[1]!
    for (const field of CAR_FIELDS) expect(copied[field], field).toEqual(source[field])
    expect(copied.loanAmount).toEqual(target.loanAmount)
    expect(copied.name).toBe('Loan on A')
    act(() => toasts.undo())
    expect(session.get().inputs.options[1]).toEqual(target)
  })
})

describe('the range and the shared mileage (CD10, CD11)', () => {
  it('low and high are behind a switch; switching off clears them, and the three cases go', () => {
    set(inputs([cash({ endLow: null, endHigh: null }), loan({ endLow: null, endHigh: null })]))
    const panel = panelOf(rows()[0]!)
    expect($('[id$="-end-low"]', panel)).toBeNull()
    expect($('[data-no-range]')).not.toBeNull()
    expect($('input[name$="cd-case"]')).toBeNull()
    click($('[id$="-range"]', panel))
    expect($('[id$="-end-low"]', panel)).not.toBeNull()
    set({ options: [cash(), loan({ endLow: null, endHigh: null })] })
    expect($('[data-no-range]')).toBeNull()
    expect($$('input[name$="cd-case"]').length).toBeGreaterThan(0)
    click($('[id$="-range"]', panelOf(rows()[0]!)))
    expect(session.get().inputs.options[0]!.endLow).toBeNull()
    expect(session.get().inputs.options[0]!.endHigh).toBeNull()
  })

  it('with no range every result is the expected case, whatever case was stored', () => {
    const i = inputs([cash({ endLow: null, endHigh: null }), loan({ endLow: null, endHigh: null })], { valueCase: 'low' })
    set(i)
    expect(text($('[data-rank-bars] h3'))).toMatch(/expected end value/)
  })

  it('options on the shared mileage use the shared box; one that drives a different distance keeps its own', () => {
    const shared = (patch = {}) => ({ ownMileage: false, annualMileage: null, ...patch })
    const i = inputs([cash(shared()), loan(shared())], { annualMileage: 9_000 })
    set(i)
    expect(($('#cd-mileage') as HTMLInputElement).value).toBe('9,000')
    expect(text($('[data-shared-mileage]', panelOf(rows()[0]!)))).toBe('Uses the shared 9,000 miles a year.')
    const outcome = calculate(session.get().inputs)
    if (outcome.kind !== 'ok' || !outcome.comparison) throw new Error('not compared')
    expect(outcome.comparison).toEqual(engine(i))
    type($('#cd-mileage') as HTMLInputElement, '11000')
    expect(session.get().inputs.annualMileage).toBe(11_000)
    click($('[id$="-own-mileage"]', panelOf(rows()[0]!)))
    expect(session.get().inputs.options[0]!.ownMileage).toBe(true)
    expect($('[id$="-mileage"][inputmode]', panelOf(rows()[0]!))).not.toBeNull()
  })

  it('with no shared mileage, options on it say they need the annual mileage', () => {
    set(inputs([cash({ ownMileage: false, annualMileage: null }), loan()]))
    expect(text($('[data-row-figure]', rows()[0]!.parentElement!))).toBe('Needs 1 more')
    expect(text($('[data-rank-row="0"]'))).toMatch(/needs annual mileage/i)
  })
})

describe('the answer (CD5) and the result sections (CD8)', () => {
  it('the headline is the verdict’s gap a month; a bar per option in the engine’s order', () => {
    const i = inputs([keep(), loan(), pcp()])
    set(i)
    const result = engine(i)
    const full = result.ranking.expected.full
    const [first, next] = [full[0]!.option, full[1]!.option]
    const gap = toPence(result.options[next]!.cases.expected.netCost) - toPence(result.options[first]!.cases.expected.netCost)
    expect(gap).toBeGreaterThan(0)
    expect(text($('[data-verdict-panel] [data-headline]'))).toMatch(/^£[\d,.]+ a month less$/)
    expect(text($('[data-verdict-panel]'))).toContain(`${i.options[first]!.name} against ${i.options[next]!.name}`)
    expect($$('[data-rank-row]').map((r) => Number(r.getAttribute('data-rank-row')))).toEqual(full.map((e) => e.option))
  })

  it('the side-by-side table is behind “Show as a table”', () => {
    set(inputs([keep(), loan()]))
    const button = $$('[data-rank-bars] button').find((b) => text(b) === 'Show as a table')!
    expect($('#cd-side-by-side')!.hasAttribute('hidden')).toBe(true)
    click(button)
    expect($('#cd-side-by-side')!.hasAttribute('hidden')).toBe(false)
    expect($('#cd-side-by-side [data-compare-table]')).not.toBeNull()
  })

  it('sections with live summaries: where the money goes open, the rest closed', () => {
    set(inputs([keep(), loan(), pcp()]))
    const button = (id: string) => $(`#${id}-button`)!
    expect(button('cd-section-money').getAttribute('aria-expanded')).toBe('true')
    for (const id of ['cd-section-month', 'cd-section-changes', 'cd-section-sure'])
      expect(button(id).getAttribute('aria-expanded'), id).toBe('false')
    expect(text($('#cd-section-money-summary'))).toMatch(/is the largest part for/)
    expect(text($('#cd-section-month-summary'))).toContain('to month 48')
  })

  it('the chart shows net cost or cash paid so far, each the engine’s', () => {
    const i = inputs([keep(), loan()])
    set(i)
    const result = engine(i)
    const lastCell = () => $$('[data-crossover] [data-chart] tbody tr').at(-1)!
    expect($('[data-crossover]')!.getAttribute('data-measure')).toBe('net')
    expect(text(lastCell())).toContain(money(result.options[0]!.cases.expected.months.at(-1)!.netCost))
    click($$('input[name$="cd-chart-measure"]').find((input) => text(input.closest('label')) === 'Cash paid so far'))
    expect($('[data-crossover]')!.getAttribute('data-measure')).toBe('cash')
    expect(text(lastCell())).toContain(money(result.options[0]!.cases.expected.months.at(-1)!.cashOut))
  })

  it('Share is off until there are results', () => {
    const share = $('#cd-share') as HTMLButtonElement
    expect(share.disabled).toBe(true)
    set(inputs([keep(), loan()]))
    expect(share.disabled).toBe(false)
    expect(share.getAttribute('aria-haspopup')).toBe('dialog')
  })
})
