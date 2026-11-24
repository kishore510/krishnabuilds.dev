import { describe, expect, it } from 'vitest'
import { fromPounds, type Money } from '@/lib/money'
import { type BudgetPageInputs, calculate } from '../definition'
import type { BudgetResult } from '../types'
import { csvText, plainPounds, shareCsv, shareFileName, shareModel, shareText } from './summary'

/* What a shared budget says (BD16). Amounts are made up. */

const inputs: BudgetPageInputs = {
  pay: fromPounds(3_400),
  payPeriod: 'monthly',
  income: [],
  accounts: [
    { id: 'p', name: 'Personal', kind: 'spending', amount: fromPounds(230), period: 'monthly' },
    { id: 'e', name: 'Rainy day', kind: 'savings', amount: fromPounds(50), period: 'monthly' },
  ],
  outgoings: [
    { name: 'Mortgage contribution', amount: fromPounds(1_100), period: 'monthly', group: 'home', account: 'main', essential: true },
    { name: '=HYPERLINK("x")', amount: fromPounds(100), period: 'monthly', group: 'other', account: 'main', essential: false },
    { name: 'Fuel', amount: fromPounds(120), period: 'monthly', group: 'transport', account: 'p', essential: true },
    { name: 'Eating out', amount: fromPounds(200), period: 'monthly', group: 'food', account: 'p', essential: false },
    { name: 'ISA', amount: fromPounds(250), period: 'monthly', group: 'saving', account: 'main', essential: true },
  ],
}

const result = (): BudgetResult => {
  const outcome = calculate(inputs)
  if (!outcome.ok) throw new Error('refused')
  return outcome.result
}
const now = new Date(2026, 10, 24)
const model = (amounts: boolean, names: boolean) => shareModel(inputs, result(), { amounts, names }, 'pounds', now)

describe('the shared summary', () => {
  it('leads with left over across accounts, the month, and each account with any shortfall', () => {
    const m = model(true, true)
    // 3,400 − (1,100 + 100 + 120 + 200 + 250) − 50 put aside = 1,580.
    expect(m.headline).toBe('£1,580')
    expect(m.when).toBe('November 2026')
    expect(m.accounts.map((a) => [a.name, a.value, a.short])).toEqual([
      ['Main account', '£1,670', false],
      ['Personal', '-£90', true],
      ['Rainy day', '£50', false],
    ])
    expect(m.parts.map((p) => p.id)).toEqual(['home', 'food', 'transport', 'saving', 'other', 'pots', 'leftover'])
    expect(m.biggest).toEqual(['Mortgage contribution £1,100', 'Eating out £200', 'Fuel £120'])
  })

  it('without amounts, shows no pound figure anywhere, only shares of income', () => {
    const m = model(false, true)
    const text = shareText(m)
    expect(text).not.toMatch(/£/)
    expect(m.headline).toBe('46%')
    expect(shareCsv(inputs, result(), { amounts: false, names: true })).not.toMatch(/1100|£/)
  })

  it('without names, shows groups only', () => {
    const text = shareText(model(true, false))
    expect(text).not.toMatch(/Mortgage contribution|Fuel|Eating out/)
    expect(text).toMatch(/Home: £1,100/)
    const csv = shareCsv(inputs, result(), { amounts: true, names: false })
    expect(csv).not.toMatch(/Mortgage|Fuel|HYPERLINK/)
    expect(model(true, false).biggest).toEqual([])
  })

  it('text names every account and ends with the not-advice line', () => {
    const text = shareText(model(true, true))
    expect(text).toMatch(/• Personal: -£90 \(short, topped up from main\)/)
    expect(text.trim().split('\n').at(-1)).toBe('Illustrative only, not financial advice. Made with Sumyard.')
  })
})

describe('the CSV (BD16)', () => {
  it('has a line per row, plain numbers, and the accounts after a blank row', () => {
    const csv = shareCsv(inputs, result(), { amounts: true, names: true })
    const rows = csv.trimEnd().split('\r\n')
    expect(rows[0]).toBe('"Group","Line","Paid from","A month","A year","Of income"')
    expect(rows[1]).toBe('"Home","Mortgage contribution","Main account",1100.00,13200.00,32.4%')
    expect(rows).toContain('"Personal","Spending account",230.00,320.00,-90.00')
    expect(rows).toContain('')
  })

  it('writes a cell that would start a formula as plain text', () => {
    expect(csvText('=SUM(A1)')).toBe(`"'=SUM(A1)"`)
    expect(csvText('+44')).toBe(`"'+44"`)
    expect(csvText('-x')).toBe(`"'-x"`)
    expect(csvText('@cmd')).toBe(`"'@cmd"`)
    expect(csvText('say "hi"')).toBe('"say ""hi"""')
    expect(shareCsv(inputs, result(), { amounts: true, names: true })).toMatch(/"'=HYPERLINK\(""x""\)"/)
  })

  it('pounds and pence from whole pence, negatives included', () => {
    expect(plainPounds(fromPounds('1234.5'))).toBe('1234.50')
    expect(plainPounds(fromPounds('-0.07'))).toBe('-0.07')
    expect(plainPounds(0 as Money)).toBe('0.00')
  })

  it('names the file by month', () => {
    expect(shareFileName(now, 'csv')).toBe('sumyard-budget-2026-11.csv')
  })
})
