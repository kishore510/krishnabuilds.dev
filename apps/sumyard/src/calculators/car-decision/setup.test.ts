import { describe, expect, it } from 'vitest'
import { formatGBP } from '@/lib/format'
import { add, fromPounds, type Money, ZERO } from '@/lib/money'
import { calculate, carDecisionCalculator, FIELD_LABELS, type OptionInputs } from './definition'
import { blank, cash, electric, hp, inputs, keep, keepOwing, loan, pcp } from './fixtures/inputs'
import { CAR_FIELDS, COST_PART_LABELS, copyCar, costParts, optionSummary, START_TEMPLATES, startFrom } from './setup'

/*
 * The redesign's page helpers (CD3, CD4, CD2, CD6): Start from, Copy the car, an option row's one-line summary and the
 * cost parts the bars draw. No figure is made up here: summaries read the inputs, parts the engine's breakdown.
 */

const gbp = (amount: Money) => formatGBP(amount, 'pounds')

describe('Start from (CD3)', () => {
  it('offers keep or replace, cash or finance and finance offers, each within the most options', () => {
    expect(START_TEMPLATES.map((t) => t.id)).toEqual(['keep-or-replace', 'cash-or-finance', 'finance-offers'])
    for (const t of START_TEMPLATES) {
      expect(t.label).not.toBe('')
      expect(t.hint).not.toBe('')
    }
  })

  it('sets the kinds and names only: every amount empty, as a fresh option', () => {
    expect(startFrom('keep-or-replace').map((o) => [o.acquisition, o.name])).toEqual([
      ['keep', 'Keep my car'],
      ['pcp', 'New car on PCP'],
    ])
    expect(startFrom('cash-or-finance').map((o) => o.acquisition)).toEqual(['cash', 'loan', 'pcp'])
    expect(startFrom('finance-offers').map((o) => o.acquisition)).toEqual(['loan', 'hire-purchase', 'pcp'])
    for (const t of START_TEMPLATES) {
      for (const option of startFrom(t.id)) expect(option).toEqual({ ...blank(option.acquisition), name: option.name })
    }
  })

  it('makes valid inputs', () => {
    for (const t of START_TEMPLATES) {
      const made = { ...carDecisionCalculator.defaultInputs(), options: startFrom(t.id) }
      expect(carDecisionCalculator.validateInputs(made).ok).toBe(true)
    }
  })
})

describe('Copy the car (CD4)', () => {
  it('copies the car, its mileage, fuel and running costs; keeps the name, kind and finance', () => {
    const source = electric({ name: 'Source', ownMileage: true, annualMileage: 12_345, endLow: null })
    const target = pcp({ name: 'Target' })
    const copied = copyCar(source, target)
    for (const field of CAR_FIELDS) expect(copied[field]).toEqual(source[field])
    for (const field of Object.keys(target) as (keyof OptionInputs)[]) {
      if (!CAR_FIELDS.includes(field)) expect(copied[field]).toEqual(target[field])
    }
    expect(copied.name).toBe('Target')
    expect(copied.acquisition).toBe('pcp')
  })

  it('never copies finance, a kept car’s finance still owed included', () => {
    expect(CAR_FIELDS).not.toContain('owesFinance')
    expect(CAR_FIELDS).not.toContain('settlement')
    expect(CAR_FIELDS).not.toContain('deposit')
    expect(CAR_FIELDS).not.toContain('loanAmount')
    expect(CAR_FIELDS).not.toContain('name')
    expect(CAR_FIELDS).not.toContain('acquisition')
    const copied = copyCar(keepOwing(), blank('cash'))
    expect(copied.owesFinance).toBe(false)
    expect(copied.settlement).toBeNull()
  })

  it('a copied option is costed on the same car: the same depreciation and running costs', () => {
    const source = cash({ name: 'Cash' })
    const target = copyCar(source, loan({ value: fromPounds(1), endExpected: fromPounds(1) }))
    const outcome = calculate(inputs([source, target]))
    if (outcome.kind !== 'ok' || !outcome.comparison) throw new Error('not compared')
    const [a, b] = outcome.comparison.options
    expect(a!.cases.expected.breakdown.depreciation).toEqual(b!.cases.expected.breakdown.depreciation)
    expect(a!.cases.expected.breakdown.fuel).toEqual(b!.cases.expected.breakdown.fuel)
  })
})

describe('optionSummary (CD2)', () => {
  it('says how the car is had and its main figures, from the inputs', () => {
    expect(optionSummary(cash(), gbp)).toBe('Buy with cash · £18,000')
    expect(optionSummary(keep(), gbp)).toBe('Keep current car · worth £6,000')
    expect(optionSummary(keepOwing(), gbp)).toBe('Keep current car · worth £9,000 · £7,200 to settle')
    expect(optionSummary(loan(), gbp)).toMatch(/^Loan · £18,000 · £\d[\d,]* over \d+ months$/)
    expect(optionSummary(hp(), gbp)).toMatch(/^HP · £18,000 · \d+ months$/)
    expect(optionSummary(pcp(), gbp)).toMatch(/^PCP · £[\d,]+ · \d+ months$/)
  })

  it('says when nothing is filled in yet', () => {
    expect(optionSummary(blank('pcp'), gbp)).toBe('PCP · not filled in yet')
    expect(optionSummary(blank('keep'), gbp)).toBe('Keep current car · not filled in yet')
  })
})

describe('costParts (CD6)', () => {
  it('the breakdown’s parts with the running costs together; they add up to the net cost', () => {
    const outcome = calculate(inputs([keep(), loan(), pcp({ pcpEnd: 'hand-back' }), hp()]))
    if (outcome.kind !== 'ok' || !outcome.comparison) throw new Error('not compared')
    for (const option of outcome.comparison.options) {
      for (const c of Object.values(option.cases)) {
        const parts = costParts(c.breakdown)
        expect(parts.map((p) => p.id)).toEqual(['depreciation', 'finance', 'handedBack', 'fuel', 'running', 'lostInterest'])
        expect(parts.reduce((sum, p) => add(sum, p.value), ZERO)).toEqual(c.netCost)
        const b = c.breakdown
        expect(parts.find((p) => p.id === 'running')!.value).toEqual(add(add(b.insurance, b.maintenance), add(b.ved, b.other)))
      }
    }
  })

  it('names the parts in plain words (CD7)', () => {
    expect(COST_PART_LABELS.lostInterest).toBe('Interest your cash could have earned')
    expect(COST_PART_LABELS.running).toBe('Running costs')
    expect(FIELD_LABELS.insurance).toBe('Insurance')
  })
})
