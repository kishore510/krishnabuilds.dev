// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CALCULATORS } from '@/calculators/index'
import { formatGBP, formatPercent } from '@/lib/format'
import { fromPence, fromPounds, type Money, toPence } from '@/lib/money'
import { scenarioStore } from '@/scenarios/index'
import { readScenario } from '@/scenarios/scenario'
import { settingsStore } from '@/settings/settings'
import { click, mount, type } from '@/test/dom'
import { toasts } from '@/toast/toasts'
import { sessionFor } from '../session'
import BudgetPage from './BudgetPage'
import { type BudgetPageInputs, budgetCalculator, calculate } from './definition'
import type { BudgetResult } from './types'

/*
 * The household budget page at #/c/budget. Expected figures come from the
 * engine through calculate(), formatted as the page formats them. Amounts
 * are made up. Default lines get keys in order: Rent or mortgage is
 * bd-out-0, Groceries bd-out-4, Eating out bd-out-5, Credit card payment
 * bd-out-9, the ISA bd-out-11.
 */

let view: ReturnType<typeof mount>
const session = sessionFor(budgetCalculator)

beforeEach(() => {
  localStorage.clear()
  scenarioStore.clear()
  settingsStore.update({ amounts: 'pence' })
  session.startNew()
  view = mount(<BudgetPage />)
})
afterEach(() => {
  view.unmount()
  toasts.dismiss()
})

const $ = (selector: string) => view.host.querySelector(selector)
const $$ = (selector: string) => [...view.host.querySelectorAll(selector)]
const box = (id: string) => $(`#${id}`) as HTMLInputElement
const money = (amount: Money) => formatGBP(amount, 'pence')
const share = (r: { share: Parameters<typeof formatPercent>[0] | null }) => formatPercent(r.share!, 1)
const set = (patch: Partial<BudgetPageInputs>) => act(() => session.setInputs(patch))
const headline = () => $('[data-sticky-value]')?.textContent?.trim()
const engine = (inputs: BudgetPageInputs = session.get().inputs): BudgetResult => {
  const outcome = calculate(inputs)
  if (!outcome.ok) throw new Error('refused')
  return outcome.result
}
function stat(label: string): string | undefined {
  const dt = [...view.host.querySelectorAll('dt')].find((el) => el.textContent?.trim() === label)
  return dt?.nextElementSibling?.textContent?.trim()
}
const chooseView = (value: 'year' | 'month') => click($(`input[name="bd-view"][value="${value}"]`))
const showBy = (value: 'what' | 'where') => click($(`input[name="bd-by"][value="${value}"]`))
const choose = (select: Element | null, value: string) => {
  const el = select as HTMLSelectElement
  act(() => {
    el.value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
const slide = (input: HTMLInputElement, pence: number) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, String(pence))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const amountOf = (key: number) => box(`bd-out-${key}-amount`)

const typical = () => {
  type(box('bd-pay'), '3,000')
  type(amountOf(0), '1,000')
  type(amountOf(4), '400')
  type(amountOf(9), '200')
  type(amountOf(11), '300')
}

/** Main, a spending account getting 230 that pays fuel 120 and parking 110 and eating out 80: 80 short. */
const withAccount = () => {
  const d = budgetCalculator.defaultInputs()
  set({
    pay: fromPounds(3_000),
    accounts: [{ id: 'a1', name: 'Personal', kind: 'spending', amount: fromPounds(230), period: 'monthly', othersIn: fromPounds(0) }],
    outgoings: [
      { name: 'Rent', amount: fromPounds(1_000), period: 'monthly', group: 'home', account: 'main', essential: true },
      { name: 'Fuel', amount: fromPounds(120), period: 'monthly', group: 'transport', account: 'a1', essential: true },
      { name: 'Parking', amount: fromPounds(110), period: 'monthly', group: 'transport', account: 'a1', essential: true },
      { name: 'Eating out', amount: fromPounds(80), period: 'monthly', group: 'food', account: 'a1', essential: false },
    ],
  })
  return d
}

describe('the page', () => {
  it('has its title, says it uses no tax rules, and shows no verified badge', () => {
    expect($('h1')?.textContent).toBe('Household budget')
    expect($('[data-no-tax-rules]')?.textContent).toMatch(/no tax rules/i)
    expect($('[data-verified-badge]')).toBeNull()
  })

  it('says it is illustrative, not advice, and lists assumptions including transfers and double counting', () => {
    expect(view.host.textContent).toMatch(/Illustrative only, not financial advice/)
    const assumptions = $('#assumptions')!.textContent!
    expect(assumptions).toMatch(/card payment or the spending on that card, not both/)
    expect(assumptions).toMatch(/transfer between your own accounts is not spending/)
  })

  it('has Your pay always in view, every section closed and the groups shown on a fresh page', () => {
    expect(box('bd-pay')).not.toBeNull()
    for (const id of ['income', 'home', 'bills', 'food', 'transport', 'personal', 'debt', 'saving', 'other', 'whatif'])
      expect($(`#bd-section-${id}-button`)?.getAttribute('aria-expanded'), id).toBe('false')
    expect(($('input[name="bd-by"][value="what"]') as HTMLInputElement).checked).toBe(true)
  })

  it('a loaded version 1 scenario is migrated, opens its sections and shows its accounts', () => {
    const read = readScenario(
      {
        id: 's1',
        calculatorId: 'budget',
        name: 'Old',
        inputsVersion: 1,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
        inputs: {
          pay: toPence(fromPounds(2_000)),
          payPeriod: 'monthly',
          income: [],
          outgoings: [
            { name: 'Credit card', amount: toPence(fromPounds(90)), period: 'monthly', kind: 'debt' },
            { name: 'Joint account', amount: toPence(fromPounds(500)), period: 'monthly', kind: 'joint' },
          ],
        },
      },
      CALCULATORS,
    )
    if (!read.ok) throw new Error('not read')
    act(() => session.load(read.scenario))
    const open = (id: string) => $(`#bd-section-${id}-button`)?.getAttribute('aria-expanded')
    expect(open('debt')).toBe('true')
    expect(open('home')).toBe('false')
    expect($('#bd-section-debt-summary')?.textContent).toBe(`1 line, ${money(fromPounds(90))} a month`)
    expect(($('input[name="bd-by"][value="where"]') as HTMLInputElement).checked).toBe(true)
    expect($('[data-account-card="joint-1"]')?.textContent).toMatch(/Joint account/)
    expect(headline()).toMatch(money(fromPounds(1_410)))
  })

  it('prefills the named lines, blank, in their groups', () => {
    const names = (id: string) => $$(`#bd-section-${id}-panel [data-line] input[id$="-name"]`).map((i) => (i as HTMLInputElement).value)
    expect(names('home')).toEqual(['Rent or mortgage', 'Council tax'])
    expect(names('food')).toEqual(['Groceries', 'Eating out'])
    expect(names('saving')).toEqual(['Cash savings', 'Stocks and shares ISA'])
    expect(amountOf(0).value).toBe('')
  })

  it('a blank amount is nothing, with no warning about it', () => {
    type(box('bd-pay'), '1,000')
    expect(headline()).toMatch(money(fromPounds(1_000)))
    expect($('[data-line] [id$="-amount-error"]')).toBeNull()
  })
})

describe('results', () => {
  it('shows what is left a month with its share of your income, what goes out and the saving rate', () => {
    typical()
    const r = engine()
    expect(headline()).toBe(`${money(r.leftover.month)} (${share(r.leftover)} of your income)`)
    expect($('[data-headline]')?.textContent).toBe(money(r.leftover.month))
    expect(stat('Take-home')).toBe(money(r.income.month))
    expect(stat('Going out')).toBe(money(r.outgoings.month))
    expect(stat('Saving rate')).toBe(formatPercent(r.savingsRate!, 1))
    expect($('[data-status]')?.textContent).toBe('In the green')
  })

  it('Year and Month agree: a year is twelve months for whole-month amounts', () => {
    typical()
    const month = engine()
    chooseView('year')
    expect($('[data-headline]')?.textContent).toBe(money(month.leftover.year))
    expect(toPence(month.leftover.year)).toBe(toPence(month.leftover.month) * 12)
    expect(headline()).toMatch(money(month.leftover.year))
  })

  it('draws where income goes, with each group and what is left named', () => {
    typical()
    const legend = $('figure ul')!.textContent!
    for (const name of ['Home', 'Food', 'Debt', 'Saving and investing', 'Left over']) expect(legend).toContain(name)
    expect($('figure svg')?.getAttribute('aria-label')).toMatch(/Where your income goes/)
  })

  it('has a table by group, the biggest outgoings and the 50/30/20 check', () => {
    typical()
    const r = engine()
    const rows = $$('[data-group-table] tbody tr').map((tr) => [...tr.children].map((c) => c.textContent?.trim()))
    expect(rows[0]).toEqual(['Home', money(r.perGroup[0]!.month), formatPercent(r.perGroup[0]!.share!, 1)])
    expect($$('[data-biggest] li').map((li) => li.textContent)).toEqual([
      `1Rent or mortgage${money(fromPounds(1_000))}`,
      `2Groceries${money(fromPounds(400))}`,
      `3Credit card payment${money(fromPounds(200))}`,
    ])
    expect($('[data-rule]')?.textContent).toMatch(/Needs.*guide 50%.*Wants.*guide 30%.*Saving.*guide 20%/)
  })

  it('negative leftover is shown as it is, with a warning', () => {
    type(box('bd-pay'), '1,000')
    type(amountOf(0), '1,200')
    expect(headline()).toMatch(money(fromPounds(-200)))
    expect($('[data-warning="negative-leftover"]')).not.toBeNull()
  })

  it('no income: shares are n/a', () => {
    type(amountOf(0), '100')
    expect(stat('Saving rate')).toBe('n/a')
    expect(headline()).toMatch(/n\/a/)
  })

  it('states the penny difference in the month view when rounded lines differ from the total', () => {
    set({
      pay: fromPounds(2_000),
      outgoings: [0, 1, 2].map(() => ({
        name: 'Bus',
        amount: fromPounds(10),
        period: 'weekly',
        group: 'transport',
        account: 'main',
        essential: true,
      })),
    })
    expect($('[data-penny-note]')?.textContent).toMatch(/penny|pence/)
    chooseView('year')
    expect($('[data-penny-note]')).toBeNull()
  })

  it('an invalid amount shows no results until it is fixed', () => {
    type(amountOf(0), '-5')
    expect(headline()).toBeUndefined()
    expect(view.host.textContent).toMatch(/Fix the highlighted input/)
    type(amountOf(0), '5')
    expect(headline()).toBeDefined()
  })
})

describe('lines', () => {
  it('a row opens its editor, which changes the group and the essential flag', () => {
    click($('#bd-section-food-button'))
    const row = $('#bd-out-5-row')!
    expect(row.getAttribute('aria-expanded')).toBe('false')
    click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    choose($('#bd-out-5-group'), 'personal')
    expect(session.get().inputs.outgoings[5]!.group).toBe('personal')
    click($('#bd-out-5-essential'))
    expect(session.get().inputs.outgoings[5]!.essential).toBe(true)
  })

  it('a line can be added to a group, blank or from a quick-add name', () => {
    click($('#bd-section-transport-button'))
    click($('#bd-add-transport'))
    expect(session.get().inputs.outgoings.filter((l) => l.group === 'transport')).toHaveLength(3)
    expect(document.activeElement?.id).toMatch(/-name$/)
    click($('#bd-section-transport-panel button[aria-label="Add Parking"]'))
    const added = session.get().inputs.outgoings.at(-1)!
    expect([added.name, added.group, added.account, added.essential]).toEqual(['Parking', 'transport', 'main', true])
    expect(document.activeElement?.id).toMatch(/-amount$/)
  })

  it('a removed line comes back with Undo', () => {
    type(amountOf(9), '150')
    click($('#bd-out-9-remove'))
    expect(session.get().inputs.outgoings.some((l) => l.name === 'Credit card payment')).toBe(false)
    act(() => toasts.undo())
    const restored = session.get().inputs.outgoings.find((l) => l.name === 'Credit card payment')
    expect(restored?.amount).toBe(fromPounds(150))
    expect(session.get().inputs.outgoings.map((l) => l.name)[9]).toBe('Credit card payment')
  })

  it('extra income adds to income', () => {
    type(box('bd-pay'), '1,000')
    click($('#bd-add-income'))
    const amount = $('#bd-section-income-panel [data-line] input[id$="-amount"]') as HTMLInputElement
    type(amount, '100')
    expect(stat('Take-home')).toBe(money(fromPounds(1_100)))
  })

  it('a yearly line counts a twelfth a month', () => {
    type(box('bd-pay'), '1,000')
    type(amountOf(7), '600')
    expect(stat('Going out')).toBe(money(fromPounds(50)))
  })
})

describe('accounts (BD11, BD12)', () => {
  it('adding an account switches nothing on its own, and a line can then be paid from it', () => {
    typical()
    showBy('where')
    click($('#bd-add-account-spending'))
    const [account] = session.get().inputs.accounts
    expect(account?.kind).toBe('spending')
    expect(document.activeElement?.id).toBe(`bd-acc-${account!.id}-name`)
    type(box(`bd-acc-${account!.id}-amount`), '400')
    showBy('what')
    click($('#bd-section-food-button'))
    click($('#bd-out-4-row'))
    choose($('#bd-out-4-account'), account!.id)
    expect(session.get().inputs.outgoings[4]!.account).toBe(account!.id)
    const r = engine()
    expect($('[data-account-tiles]')?.textContent).toContain(money(r.accounts[1]!.left.month))
    expect(headline()).toBe(`${money(r.leftover.month)} (${share(r.leftover)} of your income)`)
  })

  it('an account that runs short is flagged in the headline, its tile and an alert with a fix, with Undo', () => {
    withAccount()
    expect(headline()).toMatch(`Personal is ${money(fromPounds(80))} short`)
    expect($('[data-account="a1"]')?.textContent).toMatch(money(fromPounds(-80)))
    expect($('[data-short="a1"]')?.textContent).toMatch(/Personal runs .* short a month/)
    expect($('[data-status]')?.textContent).toBe('1 account runs short')
    click([...$('[data-short="a1"]')!.querySelectorAll('button')].find((b) => /Move/.test(b.textContent ?? '')))
    expect(session.get().inputs.accounts[0]!.amount).toBe(fromPounds(310))
    expect($('[data-short="a1"]')).toBeNull()
    act(() => toasts.undo())
    expect(session.get().inputs.accounts[0]!.amount).toBe(fromPounds(230))
  })

  it('main less the top-up is what is really left, and the left over is the same either way', () => {
    withAccount()
    const r = engine()
    expect(toPence(r.accounts[0]!.left.month)).toBe(toPence(fromPounds(1_770)))
    expect(toPence(r.leftover.month)).toBe(toPence(fromPounds(1_690)))
    showBy('where')
    expect($('[data-account-card="main"]')?.textContent).toMatch(/Really left/)
  })

  it('deleting an account pays its lines from main, with Undo', () => {
    withAccount()
    showBy('where')
    click($('#bd-acc-a1-remove'))
    expect(session.get().inputs.accounts).toEqual([])
    expect(session.get().inputs.outgoings.every((l) => l.account === 'main')).toBe(true)
    act(() => toasts.undo())
    expect(session.get().inputs.accounts.map((a) => a.id)).toEqual(['a1'])
    expect(session.get().inputs.outgoings.filter((l) => l.account === 'a1')).toHaveLength(3)
  })

  it('a template sets up the accounts it names, keeping one that fits', () => {
    withAccount()
    showBy('where')
    click($('#bd-template-all'))
    expect(
      session
        .get()
        .inputs.accounts.map((a) => a.kind)
        .sort(),
    ).toEqual(['joint', 'savings', 'spending'])
    expect(session.get().inputs.accounts[0]!.name).toBe('Personal')
    expect($('#bd-template-all')?.getAttribute('aria-pressed')).toBe('true')
    click($('#bd-template-one'))
    expect(session.get().inputs.accounts).toEqual([])
  })

  it('a joint account takes what others put in: not your take-home, and it covers the joint costs (BD17)', () => {
    set({
      pay: fromPounds(3_000),
      accounts: [{ id: 'j', name: 'Monzo joint', kind: 'joint', amount: fromPounds(300), period: 'monthly', othersIn: fromPounds(0) }],
      outgoings: [
        { name: 'Groceries', amount: fromPounds(400), period: 'monthly', group: 'food', account: 'j', essential: true },
        { name: 'Cleaner', amount: fromPounds(138), period: 'monthly', group: 'home', account: 'j', essential: false },
      ],
    })
    showBy('where')
    expect($('[data-short="j"]')?.textContent).toMatch(new RegExp(`runs ${money(fromPounds(238)).replace('.', '\\.')} short`))
    type(box('bd-acc-j-others'), '300')
    expect(session.get().inputs.accounts[0]!.othersIn).toBe(fromPounds(300))
    expect($('[data-short="j"]')).toBeNull()
    expect(stat('Take-home')).toBe(money(fromPounds(3_000)))
    expect($('[data-account="j"]')?.textContent).toMatch(money(fromPounds(62)))
    expect($('[data-budget-card]')?.textContent).toMatch(`Includes ${money(fromPounds(300))} a month others put in`)
    choose($('#bd-acc-j-kind'), 'spending')
    expect(session.get().inputs.accounts[0]!.othersIn).toBe(fromPounds(0))
    expect($('#bd-acc-j-others')).toBeNull()
  })

  it('the fix for a short joint account allows for what others put in', () => {
    set({
      pay: fromPounds(3_000),
      accounts: [{ id: 'j', name: 'Joint', kind: 'joint', amount: fromPounds(100), period: 'monthly', othersIn: fromPounds(300) }],
      outgoings: [{ name: 'Groceries', amount: fromPounds(600), period: 'monthly', group: 'food', account: 'j', essential: true }],
    })
    click([...$('[data-short="j"]')!.querySelectorAll('button')].find((b) => /Move/.test(b.textContent ?? '')))
    expect(session.get().inputs.accounts[0]!.amount).toBe(fromPounds(300))
  })

  it('renaming an account changes it everywhere', () => {
    withAccount()
    showBy('where')
    type(box('bd-acc-a1-name'), 'Monzo personal')
    expect($('[data-account="a1"]')?.textContent).toMatch(/Monzo personal/)
  })
})

describe('what if (BD7)', () => {
  it('a slider shows the what-if beside the inputs, with the change, without touching the inputs', () => {
    typical()
    const before = session.get().inputs
    slide(box('bd-wi-out-4'), toPence(fromPounds(300)))
    expect(session.get().inputs).toBe(before)
    const card = $('[data-what-if-results]')!
    const base = engine()
    const next = engine({ ...before, outgoings: before.outgoings.map((l, i) => (i === 4 ? { ...l, amount: fromPounds(300) } : l)) })
    expect(card.textContent).toContain(money(base.leftover.month))
    expect(card.textContent).toContain(money(next.leftover.month))
    expect(card.textContent).toContain(`+${money(fromPounds(100))}`)
  })

  it('a transfer has a slider too', () => {
    withAccount()
    slide(box('bd-wi-acc-a1'), toPence(fromPounds(310)))
    expect($('[data-what-if-results]')?.textContent).toMatch(/Left in main account/)
    expect(session.get().inputs.accounts[0]!.amount).toBe(fromPounds(230))
  })

  it('Reset what-ifs drops them', () => {
    typical()
    slide(box('bd-wi-out-4'), toPence(fromPounds(300)))
    click($('#bd-wi-reset'))
    expect($('[data-what-if-results]')).toBeNull()
  })

  it('Apply writes the what-ifs into the inputs, with Undo', () => {
    typical()
    slide(box('bd-wi-pay'), toPence(fromPounds(3_200)))
    click($('#bd-wi-apply'))
    expect(session.get().inputs.pay).toBe(fromPounds(3_200))
    expect(box('bd-pay').value).toBe('3,200')
    expect($('[data-what-if-results]')).toBeNull()
    act(() => toasts.undo())
    expect(session.get().inputs.pay).toBe(fromPounds(3_000))
  })

  it('what-ifs are never stored: a fresh start or a load drops them', () => {
    typical()
    slide(box('bd-wi-out-4'), toPence(fromPounds(300)))
    act(() => session.startNew())
    expect($('[data-what-if-results]')).toBeNull()
    expect(JSON.stringify(session.get().inputs)).not.toMatch(/whatIf/i)
  })

  it('the slider range is native and labelled in words', () => {
    typical()
    expect(box('bd-wi-out-4').type).toBe('range')
    expect(box('bd-wi-out-4').getAttribute('aria-valuetext')).toBe('400 pounds per month')
    expect(fromPence(Number(box('bd-wi-out-4').value))).toBe(fromPounds(400))
  })
})

describe('share', () => {
  it('Share waits for a result', () => {
    expect(($('#bd-share') as HTMLButtonElement).disabled).toBe(false)
    type(amountOf(0), '-5')
    expect(($('#bd-share') as HTMLButtonElement).disabled).toBe(true)
  })
})
