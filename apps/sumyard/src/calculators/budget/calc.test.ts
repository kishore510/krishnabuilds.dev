import { describe, expect, it } from 'vitest'
import { MAX_ACCOUNT_ID_LENGTH, MAX_BUDGET_ACCOUNTS, MAX_BUDGET_LINES, MAX_INPUT_AMOUNT } from '@/lib/inputLimits'
import { fromPence, fromPounds, type Money, MoneyError, mulRound, ratio, toPence } from '@/lib/money'
import { MONTHS_PER_YEAR, PERIODS_PER_YEAR } from '@/lib/periods'
import { budget } from './calc'
import { acc, inputs, out, PERIODS, pay } from './fixtures/inputs'
import type { BudgetInputs, BudgetResult } from './types'

/*
 * The household budget engine (BD2 to BD5, BD9 and BD10 to BD14 in
 * docs/modelling-decisions.md). Every amount is made up. Expected figures are
 * worked out by hand here from the calendar divisors in src/lib/periods.ts,
 * never typed in as a tax figure.
 */

function run(i: BudgetInputs): BudgetResult {
  const outcome = budget(i)
  if (!outcome.ok) throw new Error(`refused: ${JSON.stringify(outcome.problems)}`)
  return outcome.result
}

const p = (m: Money) => toPence(m)
const pounds = (m: Money) => p(m) / 100
const group = (r: BudgetResult, g: string) => r.perGroup.find((t) => t.group === g)!
const account = (r: BudgetResult, id: string) => r.accounts.find((a) => a.id === id)!

describe('period conversion (BD2)', () => {
  it('a weekly amount is that many weeks a year, exactly', () => {
    const r = run(inputs([], [out(100, 'food', 'weekly')]))
    expect(p(r.outgoings.year)).toBe(p(fromPounds(100)) * PERIODS_PER_YEAR.weekly)
    expect(p(r.outgoings.year)).toBe(p(fromPounds(5_200)))
  })

  it.each(PERIODS)('a %s amount is the amount times its periods a year', (period) => {
    const r = run(inputs([pay('123.45', period)], [out('67.89', 'debt', period)], [acc('a', '10.01', 'spending', period)]))
    expect(p(r.income.year)).toBe(12_345 * PERIODS_PER_YEAR[period])
    expect(p(r.outgoings.year)).toBe(6_789 * PERIODS_PER_YEAR[period])
    expect(p(r.outgoingLines[0]!.year)).toBe(6_789 * PERIODS_PER_YEAR[period])
    expect(p(account(r, 'a').moneyIn.year)).toBe(1_001 * PERIODS_PER_YEAR[period])
  })

  it('a month figure is the year divided by the months, to the nearest penny', () => {
    // 10 a week is 520 a year: 43.333... a month, so 43.33.
    const r = run(inputs([pay(10, 'weekly')], [out(10, 'food', 'weekly')]))
    expect(r.income.month).toBe(mulRound(r.income.year, ratio(1, MONTHS_PER_YEAR), 'nearest'))
    expect(p(r.income.month)).toBe(4_333)
    expect(p(r.outgoingLines[0]!.month)).toBe(4_333)
  })

  it('round trip: a monthly amount comes back as itself, and a yearly one divisible by the months comes back exactly', () => {
    const r = run(inputs([pay('1234.56', 'monthly')], [out(1_200, 'saving', 'annual'), out('25.5', 'home', 'monthly')]))
    expect(r.incomeLines[0]!.month).toBe(fromPounds('1234.56'))
    expect(r.outgoingLines[0]!.month).toBe(fromPounds(100))
    expect(r.outgoingLines[1]!.month).toBe(fromPounds('25.5'))
  })
})

describe('groups and shares, one account (BD10, BD3)', () => {
  const example = inputs(
    [pay(3_000, 'monthly', 'Your pay'), pay(1_200, 'annual', 'Side work')],
    [
      out(400, 'food', 'monthly', 'Groceries'),
      out(600, 'transport', 'annual', 'Car insurance'),
      out(150, 'debt', 'monthly', 'Credit card'),
      out(300, 'saving', 'monthly', 'ISA'),
    ],
  )

  it('adds income, outgoings and each group for the year', () => {
    const r = run(example)
    expect(r.income.year).toBe(fromPounds(37_200))
    expect(group(r, 'food').year).toBe(fromPounds(4_800))
    expect(group(r, 'transport').year).toBe(fromPounds(600))
    expect(group(r, 'debt').year).toBe(fromPounds(1_800))
    expect(group(r, 'saving').year).toBe(fromPounds(3_600))
    expect(r.outgoings.year).toBe(fromPounds(10_800))
    expect(r.leftover.year).toBe(fromPounds(26_400))
    expect(r.income.month).toBe(fromPounds(3_100))
    expect(r.leftover.month).toBe(fromPounds(2_200))
  })

  it('every group is listed in order, with nothing for a group with no lines', () => {
    const r = run(inputs([pay(1_000)], [out(10, 'debt')]))
    expect(r.perGroup.map((t) => t.group)).toEqual(['home', 'bills', 'food', 'transport', 'personal', 'debt', 'saving', 'other'])
    expect(p(group(r, 'home').year)).toBe(0)
  })

  it('shares are of total income, exact; the savings rate is the saving group', () => {
    const r = run(example)
    expect(group(r, 'saving').share).toEqual(ratio(p(fromPounds(3_600)), p(fromPounds(37_200))))
    expect(r.savingsRate).toEqual(group(r, 'saving').share)
    expect(r.outgoings.share).toEqual(ratio(p(fromPounds(10_800)), p(fromPounds(37_200))))
    expect(r.leftover.share).toEqual(ratio(p(fromPounds(26_400)), p(fromPounds(37_200))))
  })

  it('with only main, main holds everything and nothing is short', () => {
    const r = run(example)
    expect(r.accounts.map((a) => a.id)).toEqual(['main'])
    const main = account(r, 'main')
    expect(main.kind).toBe('main')
    expect(main.moneyIn).toEqual(r.income)
    expect(main.paid).toEqual({ year: r.outgoings.year, month: r.outgoings.month })
    expect(p(main.transfersOut.year)).toBe(0)
    expect(main.left).toEqual({ year: r.leftover.year, month: r.leftover.month })
    expect(p(r.topUp.year)).toBe(0)
  })

  it('keeps each line as entered beside its figures', () => {
    const r = run(example)
    expect(r.outgoingLines.map((l) => l.line.name)).toEqual(['Groceries', 'Car insurance', 'Credit card', 'ISA'])
    expect(r.outgoingLines[1]!.month).toBe(fromPounds(50))
    expect(r.incomeLines[1]!.month).toBe(fromPounds(100))
  })

  it('has no warnings when income covers outgoings', () => {
    expect(run(example).warnings).toEqual([])
  })

  it('states its assumptions in words, with no figures', () => {
    const r = run(example)
    expect(r.assumptions.length).toBeGreaterThan(0)
    for (const a of r.assumptions) expect(a).not.toMatch(/\d/)
  })
})

describe('accounts, transfers and what is left in each (BD11, BD12, BD13)', () => {
  // A main account, a spending account, a joint account (the person's share) and a savings pot. Monthly, made up.
  const setup = inputs(
    [pay(3_400)],
    [
      out(1_100, 'home', 'monthly', 'Mortgage contribution'),
      out(220, 'debt', 'monthly', 'Car loan'),
      out(45, 'transport', 'monthly', 'Car insurance'),
      out(25, 'transport', 'monthly', 'Car service'),
      out(75, 'bills', 'monthly', 'Phone and broadband'),
      out(250, 'saving', 'monthly', 'ISA'),
      out(150, 'saving', 'monthly', 'Investments'),
      out(120, 'transport', 'monthly', 'Fuel', 'p'),
      out(110, 'transport', 'monthly', 'Parking', 'p'),
      out(60, 'food', 'monthly', 'Extra groceries', 'p'),
      out(80, 'food', 'monthly', 'Eating out', 'p', false),
      out(90, 'personal', 'monthly', 'Shopping', 'p', false),
      out(140, 'home', 'monthly', 'House cleaner', 'j', false),
      out(160, 'food', 'monthly', 'Groceries', 'j'),
    ],
    [acc('p', 230, 'spending'), acc('j', 300, 'joint'), acc('e', 50, 'savings')],
  )

  it('main: income less its lines less every transfer out', () => {
    const main = account(run(setup), 'main')
    expect(pounds(main.moneyIn.month)).toBe(3_400)
    expect(pounds(main.paid.month)).toBe(1_865)
    expect(pounds(main.transfersOut.month)).toBe(580)
    expect(pounds(main.left.month)).toBe(955)
    expect(pounds(main.left.year)).toBe(955 * 12)
    expect(p(main.short.year)).toBe(0)
  })

  it('a spending account paying out more than goes in is short, and the shortfall is the top-up', () => {
    const r = run(setup)
    const personal = account(r, 'p')
    expect(personal.kind).toBe('spending')
    expect(pounds(personal.moneyIn.month)).toBe(230)
    expect(pounds(personal.paid.month)).toBe(460)
    expect(pounds(personal.left.month)).toBe(-230)
    expect(pounds(personal.short.month)).toBe(230)
    expect(p(personal.saved.year)).toBe(0)
    expect(pounds(r.topUp.month)).toBe(230)
    expect(r.warnings).toEqual(['account-short'])
  })

  it('a joint account that pays out what goes in has nothing left and is not short', () => {
    const joint = account(run(setup), 'j')
    expect(joint.kind).toBe('joint')
    expect(p(joint.left.year)).toBe(0)
    expect(p(joint.short.year)).toBe(0)
  })

  it('a savings pot’s money left is put aside: saving, not left over', () => {
    const r = run(setup)
    const pot = account(r, 'e')
    expect(pounds(pot.left.month)).toBe(50)
    expect(pounds(pot.saved.month)).toBe(50)
    expect(pounds(r.potSaved.month)).toBe(50)
    expect(r.savingsRate).toEqual(ratio(p(fromPounds(450 * 12)), p(fromPounds(3_400 * 12))))
  })

  it('left over across accounts: income less every line less what pots put aside, and the sum of the accounts', () => {
    const r = run(setup)
    expect(pounds(r.outgoings.month)).toBe(2_675)
    expect(pounds(r.leftover.month)).toBe(725)
    expect(pounds(r.leftover.year)).toBe(725 * 12)
    const sum = r.accounts.reduce((t, a) => t + p(a.left.year) - p(a.saved.year), 0)
    expect(sum).toBe(p(r.leftover.year))
  })

  it('groups and the pots add up to outgoings; transfers are not outgoings', () => {
    const r = run(setup)
    expect(pounds(group(r, 'home').month)).toBe(1_240)
    expect(pounds(group(r, 'transport').month)).toBe(300)
    expect(pounds(group(r, 'food').month)).toBe(300)
    expect(pounds(group(r, 'saving').month)).toBe(400)
    const groups = r.perGroup.reduce((t, g) => t + p(g.year), 0)
    expect(groups + p(r.potSaved.year)).toBe(p(r.outgoings.year))
  })

  it('needs, wants and saving add up to outgoings (BD14)', () => {
    const r = run(setup)
    expect(pounds(r.needs.month)).toBe(1_915)
    expect(pounds(r.wants.month)).toBe(310)
    expect(pounds(r.saving.month)).toBe(450)
    expect(r.saving.share).toEqual(r.savingsRate)
  })

  it('moving the transfer to cover what the account pays clears the warning and leaves left over as it was', () => {
    const fixed = { ...setup, accounts: setup.accounts.map((a) => (a.id === 'p' ? { ...a, amount: fromPounds(460) } : a)) }
    const r = run(fixed)
    expect(r.warnings).toEqual([])
    expect(pounds(account(r, 'main').left.month)).toBe(725)
    expect(pounds(r.leftover.month)).toBe(725)
    expect(p(r.topUp.year)).toBe(0)
  })

  it('a transfer into a spending account never changes left over; one into a pot is saved', () => {
    const base = run(inputs([pay(1_000)], [], [acc('s', 0, 'spending'), acc('e', 0, 'savings')]))
    const spending = run(inputs([pay(1_000)], [], [acc('s', 300, 'spending'), acc('e', 0, 'savings')]))
    const pot = run(inputs([pay(1_000)], [], [acc('s', 0, 'spending'), acc('e', 300, 'savings')]))
    expect(spending.leftover).toEqual(base.leftover)
    expect(pounds(pot.leftover.month)).toBe(700)
    expect(pounds(pot.potSaved.month)).toBe(300)
  })

  it('a savings pot that pays out more than goes in is short, saves nothing, and its shortfall counts', () => {
    const r = run(inputs([pay(1_000)], [out(80, 'other', 'monthly', 'Spent from pot', 'e')], [acc('e', 50, 'savings')]))
    const pot = account(r, 'e')
    expect(pounds(pot.short.month)).toBe(30)
    expect(p(pot.saved.year)).toBe(0)
    expect(pounds(r.leftover.month)).toBe(920)
    expect(r.warnings).toEqual(['account-short'])
  })

  it('main transferring more than comes in is below nothing, with a warning, while left over may still be positive', () => {
    const r = run(inputs([pay(100)], [], [acc('s', 200, 'spending')]))
    expect(pounds(account(r, 'main').left.month)).toBe(-100)
    expect(pounds(account(r, 's').left.month)).toBe(200)
    expect(pounds(r.leftover.month)).toBe(100)
    expect(r.warnings).toEqual(['main-short'])
  })

  it('accounts come back in the order given, after main', () => {
    const r = run(setup)
    expect(r.accounts.map((a) => a.id)).toEqual(['main', 'p', 'j', 'e'])
    expect(r.accounts.map((a) => a.name)).toEqual(['Main account', 'Account p', 'Account j', 'Account e'])
  })
})

describe('blank, zero and negative leftover (BD4, BD5)', () => {
  it('a blank amount is nothing, with no warning', () => {
    const r = run(inputs([pay(1_000)], [out(0, 'food'), out(0, 'saving', 'weekly')], [acc('a', 0)]))
    expect(p(r.outgoings.year)).toBe(0)
    expect(r.leftover.year).toBe(r.income.year)
    expect(r.warnings).toEqual([])
  })

  it('nothing at all: zero everywhere, shares n/a, a no-income warning, no division', () => {
    const r = run(inputs())
    expect(p(r.income.year)).toBe(0)
    expect(p(r.leftover.year)).toBe(0)
    expect(r.outgoings.share).toBeNull()
    expect(r.leftover.share).toBeNull()
    expect(r.savingsRate).toBeNull()
    expect(r.needs.share).toBeNull()
    for (const t of r.perGroup) expect(t.share).toBeNull()
    expect(r.warnings).toEqual(['no-income'])
  })

  it('zero income with outgoings: leftover below nothing, shares n/a, the warnings', () => {
    const r = run(inputs([pay(0)], [out(50)]))
    expect(r.leftover.year).toBe(fromPounds(-600))
    expect(r.leftover.share).toBeNull()
    expect(r.warnings).toEqual(['negative-leftover', 'no-income', 'main-short'])
  })

  it('negative leftover is shown as it is, never capped, with a warning', () => {
    const r = run(inputs([pay(1_000)], [out(1_250)]))
    expect(r.leftover.year).toBe(fromPounds(-3_000))
    expect(r.leftover.month).toBe(fromPounds(-250))
    expect(r.leftover.share).toEqual(ratio(p(fromPounds(-3_000)), p(fromPounds(12_000))))
    expect(r.warnings).toEqual(['negative-leftover', 'main-short'])
  })

  it('a penny below nothing a month is still negative', () => {
    const r = run(inputs([pay('100')], [out('100.01')]))
    expect(p(r.leftover.month)).toBe(-1)
    expect(r.warnings).toContain('negative-leftover')
  })
})

describe('the penny drift between month rows and month totals (BD2)', () => {
  it('is nothing when every line divides evenly', () => {
    const r = run(inputs([pay(1_000)], [out(100), out(1_200, 'other', 'annual')]))
    expect(p(r.pennyDrift.income)).toBe(0)
    expect(p(r.pennyDrift.groups)).toBe(0)
    expect(p(r.pennyDrift.lines.other)).toBe(0)
    expect(p(r.pennyDrift.leftover)).toBe(0)
  })

  it('is stated when rounding each line moves the sum', () => {
    // Three weekly lines of 10: each 43.33 a month; together 1,560 a year is 130.00 a month, so the lines are a penny short.
    const r = run(
      inputs(
        [pay(10, 'weekly'), pay(10, 'weekly'), pay(10, 'weekly')],
        [out(10, 'food', 'weekly'), out(10, 'food', 'weekly'), out(10, 'food', 'weekly')],
      ),
    )
    expect(p(r.income.month)).toBe(13_000)
    expect(p(r.pennyDrift.income)).toBe(-1)
    expect(p(r.pennyDrift.lines.food)).toBe(-1)
    expect(p(r.pennyDrift.lines.debt)).toBe(0)
  })

  it('is what the rows add up to less the total, for groups and leftover too', () => {
    const r = run(inputs([pay(10, 'weekly')], [out(10, 'food', 'weekly'), out(10, 'debt', 'weekly')], [acc('e', 10, 'savings', 'weekly')]))
    const rows = r.perGroup.reduce((sum, t) => sum + p(t.month), 0) + p(r.potSaved.month)
    expect(p(r.pennyDrift.groups)).toBe(rows - p(r.outgoings.month))
    expect(p(r.pennyDrift.leftover)).toBe(p(r.income.month) - p(r.outgoings.month) - p(r.leftover.month))
  })
})

describe('refusals (BD9, BD11)', () => {
  const big = fromPence(p(MAX_INPUT_AMOUNT) + 1)

  it('refuses an amount past the input limit, by line, without throwing', () => {
    const outcome = budget(inputs([pay(1)], [out(1), { ...out(1), amount: big }]))
    expect(outcome).toEqual({ ok: false, problems: [{ field: 'outgoings', index: 1, reason: 'above-maximum' }] })
  })

  it('huge amounts hit the safe-integer guard cleanly: a refusal, never a throw or a wrong number', () => {
    const huge = { ...pay(1), amount: Number.MAX_SAFE_INTEGER as Money }
    expect(() => budget(inputs([huge]))).not.toThrow()
    expect(budget(inputs([huge]))).toMatchObject({ ok: false, problems: [{ field: 'income', index: 0, reason: 'above-maximum' }] })
    expect(budget(inputs([{ ...pay(1), amount: 1.5 as Money }]))).toMatchObject({ ok: false, problems: [{ reason: 'not-money' }] })
    expect(budget(inputs([{ ...pay(1), amount: Number.NaN as Money }]))).toMatchObject({ ok: false, problems: [{ reason: 'not-money' }] })
  })

  it('the largest inputs it accepts still work out exactly', () => {
    const ids = Array.from({ length: MAX_BUDGET_ACCOUNTS }, (_, i) => `a${i}`)
    const full = inputs(
      Array.from({ length: MAX_BUDGET_LINES }, () => ({ ...pay(1, 'weekly'), amount: MAX_INPUT_AMOUNT })),
      Array.from({ length: MAX_BUDGET_LINES }, (_, i) => ({
        ...out(1, 'saving', 'weekly'),
        amount: MAX_INPUT_AMOUNT,
        account: ids[i % ids.length]!,
      })),
      ids.map((id) => ({ ...acc(id, 1, 'savings', 'weekly'), amount: MAX_INPUT_AMOUNT })),
    )
    const r = run(full)
    expect(p(r.income.year)).toBe(p(MAX_INPUT_AMOUNT) * PERIODS_PER_YEAR.weekly * MAX_BUDGET_LINES)
  })

  it('refuses a negative amount', () => {
    expect(budget(inputs([pay(-1)]))).toEqual({ ok: false, problems: [{ field: 'income', index: 0, reason: 'below-minimum' }] })
    expect(budget(inputs([], [], [acc('a', -1)]))).toEqual({
      ok: false,
      problems: [{ field: 'accounts', index: 0, reason: 'below-minimum' }],
    })
  })

  it('refuses an unknown period, group, account kind or essential flag', () => {
    expect(budget(inputs([], [{ ...out(1), group: 'fun' as 'debt' }]))).toEqual({
      ok: false,
      problems: [{ field: 'outgoings', index: 0, reason: 'not-a-choice' }],
    })
    expect(budget(inputs([], [{ ...out(1), essential: 'yes' as unknown as boolean }]))).toEqual({
      ok: false,
      problems: [{ field: 'outgoings', index: 0, reason: 'not-a-choice' }],
    })
    expect(budget(inputs([{ ...pay(1), period: 'daily' as 'weekly' }]))).toEqual({
      ok: false,
      problems: [{ field: 'income', index: 0, reason: 'not-a-choice' }],
    })
    expect(budget(inputs([], [], [{ ...acc('a', 1), kind: 'pension' as 'joint' }]))).toEqual({
      ok: false,
      problems: [{ field: 'accounts', index: 0, reason: 'not-a-choice' }],
    })
  })

  it('refuses a line paid from an account that is not there', () => {
    expect(budget(inputs([], [out(1, 'food', 'monthly', 'Line', 'gone')], [acc('a', 1)]))).toEqual({
      ok: false,
      problems: [{ field: 'outgoings', index: 0, reason: 'unknown-account' }],
    })
  })

  it('refuses an account id that is main, repeated, empty, too long or not plain', () => {
    const long = 'a'.repeat(MAX_ACCOUNT_ID_LENGTH + 1)
    for (const bad of [[acc('main', 1)], [acc('a', 1), acc('a', 2)], [acc('', 1)], [acc(long, 1)], [acc('A b', 1)]]) {
      const outcome = budget(inputs([], [], bad))
      expect(outcome.ok).toBe(false)
      expect(!outcome.ok && outcome.problems.map((x) => x.reason)).toContain('bad-account-id')
    }
    expect(budget(inputs([], [], [acc('a'.repeat(MAX_ACCOUNT_ID_LENGTH), 1)])).ok).toBe(true)
  })

  it('refuses more than the most accounts (MAX_BUDGET_ACCOUNTS)', () => {
    const many = Array.from({ length: MAX_BUDGET_ACCOUNTS + 1 }, (_, i) => acc(`a${i}`, 1))
    expect(budget(inputs([], [], many))).toEqual({ ok: false, problems: [{ field: 'accounts', reason: 'too-many-accounts' }] })
    expect(budget(inputs([], [], many.slice(1))).ok).toBe(true)
  })

  it('refuses more than the most lines a list holds (MAX_BUDGET_LINES)', () => {
    const many = Array.from({ length: MAX_BUDGET_LINES + 1 }, () => out(1))
    expect(budget(inputs([], many))).toEqual({ ok: false, problems: [{ field: 'outgoings', reason: 'too-many-lines' }] })
    expect(
      budget(
        inputs(
          Array.from({ length: MAX_BUDGET_LINES + 1 }, () => pay(1)),
          [],
        ),
      ),
    ).toEqual({
      ok: false,
      problems: [{ field: 'income', reason: 'too-many-lines' }],
    })
    expect(budget(inputs([], many.slice(1))).ok).toBe(true)
  })

  it('refuses a list that is not a list', () => {
    expect(budget({ income: null, accounts: [], outgoings: [] } as unknown as BudgetInputs)).toEqual({
      ok: false,
      problems: [{ field: 'income', reason: 'not-a-list' }],
    })
    expect(budget({ income: [], accounts: 'x', outgoings: [] } as unknown as BudgetInputs)).toEqual({
      ok: false,
      problems: [{ field: 'accounts', reason: 'not-a-list' }],
    })
  })

  it('names every problem at once', () => {
    const outcome = budget(inputs([pay(-1)], [out(-1), out(1), { ...out(1), amount: big }], [acc('a', -1)]))
    expect(!outcome.ok && outcome.problems.map((x) => `${x.field}${x.index}`)).toEqual(['income0', 'accounts0', 'outgoings0', 'outgoings2'])
  })

  it('MoneyError is never thrown to the caller', () => {
    expect(() => budget(inputs([{ ...pay(1), amount: Number.MAX_VALUE as Money }]))).not.toThrow(MoneyError)
  })
})
