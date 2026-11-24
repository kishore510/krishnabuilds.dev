import { describe, expect, it } from 'vitest'
import { fromPence, type Money, type Ratio, toPence } from '@/lib/money'
import { PERIODS_PER_YEAR } from '@/lib/periods'
import { budget } from './calc'
import { amount, between, generator, out, pick, randomInputs } from './fixtures/inputs'
import { type BudgetInputs, type BudgetResult, MAIN_ACCOUNT } from './types'

/* Properties of the household budget engine over seeded random inputs (a failure names its case). Amounts are made up. */

const CASES = 300
const p = (m: Money) => toPence(m)

function run(i: BudgetInputs): BudgetResult {
  const outcome = budget(i)
  if (!outcome.ok) throw new Error(`refused: ${JSON.stringify(outcome.problems)}`)
  return outcome.result
}

const each = (seed: number, test: (c: BudgetInputs, random: () => number) => void) => {
  const random = generator(seed)
  for (let index = 0; index < CASES; index++) {
    const c = randomInputs(random)
    try {
      test(c, random)
    } catch (error) {
      throw new Error(`case ${index} ${JSON.stringify(c)}: ${(error as Error).message}`)
    }
  }
}

/** a + b === 1 exactly, in BigInt. */
const sumIsOne = (a: Ratio, b: Ratio) =>
  BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator) ===
  BigInt(a.denominator) * BigInt(b.denominator)

const shuffle = <T>(random: () => number, list: readonly T[]): T[] => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = between(random, 0, i)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

describe('properties', () => {
  it('group totals and what pots put aside add up to outgoings, exactly', () =>
    each(1, (c) => {
      const r = run(c)
      expect(r.perGroup.reduce((sum, t) => sum + p(t.year), 0) + p(r.potSaved.year)).toBe(p(r.outgoings.year))
    }))

  it('each line’s year is its amount times its periods, and the lines add up to what each account paid', () =>
    each(2, (c) => {
      const r = run(c)
      for (const l of [...r.incomeLines, ...r.outgoingLines]) expect(p(l.year)).toBe(p(l.line.amount) * PERIODS_PER_YEAR[l.line.period])
      expect(r.incomeLines.reduce((sum, l) => sum + p(l.year), 0)).toBe(p(r.income.year))
      for (const a of r.accounts) {
        const paid = r.outgoingLines.filter((l) => l.line.account === a.id).reduce((sum, l) => sum + p(l.year), 0)
        expect(p(a.paid.year)).toBe(paid)
      }
    }))

  it('leftover is income less outgoings, and the sum of every account’s left less what pots put aside, exactly', () =>
    each(3, (c) => {
      const r = run(c)
      expect(p(r.leftover.year)).toBe(p(r.income.year) - p(r.outgoings.year))
      expect(r.accounts.reduce((sum, a) => sum + p(a.left.year) - p(a.saved.year), 0)).toBe(p(r.leftover.year))
    }))

  it('needs, wants and saving add up to outgoings; the top-up is every shortfall', () =>
    each(4, (c) => {
      const r = run(c)
      expect(p(r.needs.year) + p(r.wants.year) + p(r.saving.year)).toBe(p(r.outgoings.year))
      expect(r.accounts.reduce((sum, a) => sum + p(a.short.year), 0)).toBe(p(r.topUp.year))
      for (const a of r.accounts) {
        expect(p(a.short.year)).toBeGreaterThanOrEqual(0)
        expect(p(a.saved.year)).toBeGreaterThanOrEqual(0)
        if (a.id === MAIN_ACCOUNT) expect(p(a.short.year)).toBe(0)
      }
    }))

  it('the outgoings share and the leftover share add up to one exactly (or both are n/a with no income)', () =>
    each(5, (c) => {
      const r = run(c)
      if (p(r.income.year) === 0) {
        expect(r.outgoings.share).toBeNull()
        expect(r.leftover.share).toBeNull()
      } else expect(sumIsOne(r.outgoings.share!, r.leftover.share!)).toBe(true)
    }))

  it('adding a line never raises leftover', () =>
    each(6, (c, random) => {
      const before = run(c)
      const ids = [MAIN_ACCOUNT, ...c.accounts.map((a) => a.id)]
      const added = { ...out(0, 'food'), amount: fromPence(between(random, 0, 100_000)), account: pick(random, ids) }
      const after = run({ ...c, outgoings: [...c.outgoings, added] })
      expect(p(after.leftover.year)).toBeLessThanOrEqual(p(before.leftover.year))
    }))

  it('a transfer into a spending or joint account never changes leftover', () =>
    each(7, (c, random) => {
      const spenders = c.accounts.filter((a) => a.kind !== 'savings')
      if (spenders.length === 0) return
      const target = pick(random, spenders).id
      const changed = { ...c, accounts: c.accounts.map((a) => (a.id === target ? { ...a, amount: amount(random) } : a)) }
      expect(run(changed).leftover).toEqual(run(c).leftover)
    }))

  it('moving a line between main and a spending or joint account never changes leftover', () =>
    each(8, (c, random) => {
      const spenders = [MAIN_ACCOUNT, ...c.accounts.filter((a) => a.kind !== 'savings').map((a) => a.id)]
      if (c.outgoings.length === 0) return
      const moved = c.outgoings.map((l) =>
        l.account === MAIN_ACCOUNT || spenders.includes(l.account) ? { ...l, account: pick(random, spenders) } : l,
      )
      expect(run({ ...c, outgoings: moved }).leftover).toEqual(run(c).leftover)
    }))

  it('line and account order never changes the totals', () =>
    each(9, (c, random) => {
      const a = run(c)
      const b = run({ income: shuffle(random, c.income), accounts: shuffle(random, c.accounts), outgoings: shuffle(random, c.outgoings) })
      expect(b.income).toEqual(a.income)
      expect(b.outgoings).toEqual(a.outgoings)
      expect(b.leftover).toEqual(a.leftover)
      expect(b.perGroup).toEqual(a.perGroup)
      expect(b.savingsRate).toEqual(a.savingsRate)
      expect(b.topUp).toEqual(a.topUp)
    }))

  it('every month figure is within half a penny of its year divided by the months', () =>
    each(10, (c) => {
      const r = run(c)
      const figures = [r.income, r.outgoings, r.leftover, r.topUp, r.potSaved, ...r.perGroup, ...r.outgoingLines]
      for (const a of r.accounts) figures.push(a.moneyIn, a.paid, a.transfersOut, a.left, a.saved, a.short)
      for (const x of figures)
        expect(Math.abs(p(x.month) * PERIODS_PER_YEAR.monthly - p(x.year)) * 2).toBeLessThanOrEqual(PERIODS_PER_YEAR.monthly)
    }))
})
