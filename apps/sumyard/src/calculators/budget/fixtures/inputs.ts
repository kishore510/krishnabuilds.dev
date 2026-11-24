import { fromPence, fromPounds, type Money } from '@/lib/money'
import {
  ACCOUNT_KINDS,
  type Account,
  type AccountKind,
  BUDGET_GROUPS,
  type BudgetGroup,
  type BudgetInputs,
  type BudgetPeriod,
  type IncomeLine,
  MAIN_ACCOUNT,
  type OutgoingLine,
} from '../types'

/* Inputs for the household budget tests (test-only). Every amount is made up. */

export const PERIODS: readonly BudgetPeriod[] = ['weekly', 'monthly', 'quarterly', 'annual']

export const pay = (pounds: number | string, period: BudgetPeriod = 'monthly', name = 'Pay'): IncomeLine => ({
  name,
  amount: fromPounds(pounds),
  period,
})

export const out = (
  pounds: number | string,
  group: BudgetGroup = 'other',
  period: BudgetPeriod = 'monthly',
  name = 'Line',
  account: string = MAIN_ACCOUNT,
  essential = true,
): OutgoingLine => ({
  name,
  amount: fromPounds(pounds),
  period,
  group,
  account,
  essential,
})

export const acc = (
  id: string,
  pounds: number | string,
  kind: AccountKind = 'spending',
  period: BudgetPeriod = 'monthly',
  name = `Account ${id}`,
): Account => ({ id, name, kind, amount: fromPounds(pounds), period })

export const inputs = (
  income: readonly IncomeLine[] = [],
  outgoings: readonly OutgoingLine[] = [],
  accounts: readonly Account[] = [],
): BudgetInputs => ({ income, accounts, outgoings })

/** Mulberry32: a small seeded generator for repeatable samples. */
export function generator(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const between = (random: () => number, low: number, high: number) => low + Math.floor(random() * (high - low + 1))

export const pick = <T>(random: () => number, list: readonly T[]): T => list[between(random, 0, list.length - 1)]!

/** Up to a few thousand pounds, any pence, sometimes nothing. */
export const amount = (random: () => number): Money => (random() < 0.15 ? fromPence(0) : fromPence(between(random, 1, 500_000)))

export function randomInputs(random: () => number): BudgetInputs {
  const income = Array.from({ length: between(random, 0, 3) }, (_, i) => ({
    name: `In ${i}`,
    amount: amount(random),
    period: pick(random, PERIODS),
  }))
  const accounts = Array.from({ length: between(random, 0, 3) }, (_, i) => ({
    id: `a${i}`,
    name: `Account ${i}`,
    kind: pick(random, ACCOUNT_KINDS),
    amount: amount(random),
    period: pick(random, PERIODS),
  }))
  const ids = [MAIN_ACCOUNT, ...accounts.map((a) => a.id)]
  const outgoings = Array.from({ length: between(random, 0, 12) }, (_, i) => ({
    name: `Out ${i}`,
    amount: amount(random),
    period: pick(random, PERIODS),
    group: pick(random, BUDGET_GROUPS),
    account: pick(random, ids),
    essential: random() < 0.5,
  }))
  return { income, accounts, outgoings }
}
