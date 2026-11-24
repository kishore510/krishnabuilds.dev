import { MAX_ACCOUNT_ID_LENGTH, MAX_BUDGET_ACCOUNTS, MAX_BUDGET_LINES, MAX_INPUT_AMOUNT } from '@/lib/inputLimits'
import { add, compare, type Money, MoneyError, mulRound, type Ratio, ratio, subtract, toPence, ZERO } from '@/lib/money'
import { MONTHS_PER_YEAR, PERIODS_PER_YEAR } from '@/lib/periods'
import {
  ACCOUNT_KINDS,
  type Account,
  type AccountResult,
  BUDGET_GROUPS,
  type BudgetGroup,
  type BudgetInputs,
  type BudgetOutcome,
  type BudgetPeriod,
  type BudgetProblem,
  type BudgetResult,
  type BudgetWarning,
  type GroupTotal,
  type IncomeLine,
  MAIN_ACCOUNT,
  type OutgoingLine,
  type ResolvedLine,
  SAVING_GROUP,
  type WithShare,
  type YearAndMonth,
} from './types'

/*
 * The household budget engine. Pure: inputs in, results out; no UI, storage,
 * clock or network, and no tax rule. The decisions it carries out are in
 * docs/modelling-decisions.md:
 *
 * - BD2: a line's year is its amount times its periods a year (whole
 *   numbers, so exact); every month figure is its own year divided by the
 *   months, to the nearest penny; totals come from the years.
 * - BD3, BD5: shares are of total income for the year, exact Ratios, and
 *   null with no income; what is left may be below nothing.
 * - BD10 to BD14: groups, accounts with transfers from main, what is left
 *   in each, savings pots, needs, wants and saving.
 * - BD9: amounts, list lengths and account ids outside the input limits are
 *   refused by line, never thrown, and so is a result past the safe range.
 */

const PERIODS: readonly BudgetPeriod[] = ['weekly', 'monthly', 'quarterly', 'annual']

/** Main's name in the results; the page may show its own. */
export const MAIN_ACCOUNT_NAME = 'Main account'

const MONTH = ratio(1, MONTHS_PER_YEAR)

const ACCOUNT_ID = /^[a-z\d-]+$/

/** Plain-language assumptions (no figures). */
const ASSUMPTIONS: readonly string[] = [
  'Amounts are what you enter, after tax: no tax, National Insurance, ISA or pension rule is applied.',
  'A weekly amount counts as the weeks in a year, a quarterly one as the quarters, so a year is exact; a month is the year divided by the months, to the nearest penny.',
  'Every share is of your total income for the year: your pay and any extra income, which land in your main account.',
  'A blank amount counts as nothing.',
  'A card or loan payment is an outgoing in its own right: enter the card payment or the spending on that card, not both.',
  'A transfer between your own accounts is not spending: what each account pays for is counted once, from the account that pays it.',
  'For a joint account, enter your own share of what goes in and of what it pays for.',
  'Money left in a savings pot is counted as saved; money left in any other account is counted as left over.',
  'An account that pays out more than goes in is short, and the shortfall is shown as a top-up from your main account.',
  'The savings rate is the saving group and what savings pots put aside, as a share of your income; what is left over is not counted as saved.',
  'No interest, growth, inflation or change over time is modelled.',
]

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => list.includes(value as T)

/** The problem with an amount and period; undefined when they are fine. */
function amountProblem(amount: unknown, period: unknown): BudgetProblem['reason'] | undefined {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount)) return 'not-money'
  if (compare(amount as Money, ZERO) < 0) return 'below-minimum'
  if (compare(amount as Money, MAX_INPUT_AMOUNT) > 0) return 'above-maximum'
  if (!isOneOf(PERIODS, period)) return 'not-a-choice'
  return undefined
}

function incomeProblems(lines: unknown): BudgetProblem[] {
  if (!Array.isArray(lines)) return [{ field: 'income', reason: 'not-a-list' }]
  if (lines.length > MAX_BUDGET_LINES) return [{ field: 'income', reason: 'too-many-lines' }]
  return lines.flatMap((line, index) => {
    const { amount, period } = (line ?? {}) as Partial<IncomeLine>
    const reason = amountProblem(amount, period)
    return reason ? [{ field: 'income' as const, index, reason }] : []
  })
}

/** Problems with the accounts, and the ids a line may name. */
function accountProblems(accounts: unknown): { problems: BudgetProblem[]; ids: ReadonlySet<string> } {
  const ids = new Set<string>([MAIN_ACCOUNT])
  if (!Array.isArray(accounts)) return { problems: [{ field: 'accounts', reason: 'not-a-list' }], ids }
  if (accounts.length > MAX_BUDGET_ACCOUNTS) return { problems: [{ field: 'accounts', reason: 'too-many-accounts' }], ids }
  const problems = accounts.flatMap((raw, index) => {
    const { id, kind, amount, period } = (raw ?? {}) as Partial<Account>
    const plain = typeof id === 'string' && id.length <= MAX_ACCOUNT_ID_LENGTH && ACCOUNT_ID.test(id)
    if (!plain || ids.has(id)) return [{ field: 'accounts' as const, index, reason: 'bad-account-id' as const }]
    ids.add(id)
    const reason = amountProblem(amount, period) ?? (isOneOf(ACCOUNT_KINDS, kind) ? undefined : 'not-a-choice')
    return reason ? [{ field: 'accounts' as const, index, reason }] : []
  })
  return { problems, ids }
}

function outgoingProblems(lines: unknown, ids: ReadonlySet<string>): BudgetProblem[] {
  if (!Array.isArray(lines)) return [{ field: 'outgoings', reason: 'not-a-list' }]
  if (lines.length > MAX_BUDGET_LINES) return [{ field: 'outgoings', reason: 'too-many-lines' }]
  return lines.flatMap((line, index) => {
    const { amount, period, group, essential, account } = (line ?? {}) as Partial<OutgoingLine>
    const reason =
      amountProblem(amount, period) ??
      (isOneOf(BUDGET_GROUPS, group) && typeof essential === 'boolean' ? undefined : 'not-a-choice') ??
      (typeof account === 'string' && ids.has(account) ? undefined : 'unknown-account')
    return reason ? [{ field: 'outgoings' as const, index, reason }] : []
  })
}

const monthOf = (year: Money): Money => mulRound(year, MONTH, 'nearest')

const both = (year: Money): YearAndMonth => ({ year, month: monthOf(year) })

const yearOf = (line: { amount: Money; period: BudgetPeriod }): Money =>
  mulRound(line.amount, ratio(PERIODS_PER_YEAR[line.period], 1), 'nearest')

const resolve = <L extends IncomeLine>(line: L): ResolvedLine<L> => ({ line, ...both(yearOf(line)) })

const sum = (amounts: readonly Money[]): Money => amounts.reduce(add, ZERO)

const positive = (amount: Money): Money => (compare(amount, ZERO) > 0 ? amount : ZERO)

/** part over income, exactly; null with no income (BD5). */
const shareOf = (part: Money, income: Money): Ratio | null => (toPence(income) === 0 ? null : ratio(toPence(part), toPence(income)))

function calculate(inputs: BudgetInputs): BudgetResult {
  const incomeLines = inputs.income.map(resolve)
  const outgoingLines = inputs.outgoings.map(resolve)
  const income = both(sum(incomeLines.map((l) => l.year)))
  const withShare = (year: Money): WithShare => ({ ...both(year), share: shareOf(year, income.year) })

  const linesOf = (pick: (line: OutgoingLine) => boolean) => outgoingLines.filter((l) => pick(l.line))
  const yearsOf = (pick: (line: OutgoingLine) => boolean) => sum(linesOf(pick).map((l) => l.year))

  // Accounts besides main (BD11, BD12).
  const others: AccountResult[] = inputs.accounts.map((a) => {
    const moneyIn = yearOf(a)
    const paid = yearsOf((l) => l.account === a.id)
    const left = subtract(moneyIn, paid)
    const saved = a.kind === 'savings' ? positive(left) : ZERO
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      moneyIn: both(moneyIn),
      paid: both(paid),
      transfersOut: both(ZERO),
      left: both(left),
      saved: both(saved),
      short: both(positive(subtract(ZERO, left))),
    }
  })
  const transfersOut = sum(others.map((a) => a.moneyIn.year))
  const mainPaid = yearsOf((l) => l.account === MAIN_ACCOUNT)
  const mainLeft = subtract(subtract(income.year, mainPaid), transfersOut)
  const main: AccountResult = {
    id: MAIN_ACCOUNT,
    name: MAIN_ACCOUNT_NAME,
    kind: 'main',
    moneyIn: income,
    paid: both(mainPaid),
    transfersOut: both(transfersOut),
    left: both(mainLeft),
    saved: both(ZERO),
    short: both(ZERO),
  }
  const accounts = [main, ...others]

  // Groups, pots and the totals (BD10, BD12, BD13).
  const perGroup: GroupTotal[] = BUDGET_GROUPS.map((group: BudgetGroup) => ({ group, ...withShare(yearsOf((l) => l.group === group)) }))
  const potSavedYear = sum(others.map((a) => a.saved.year))
  const outgoingsYear = add(sum(perGroup.map((g) => g.year)), potSavedYear)
  const outgoings = withShare(outgoingsYear)
  const leftover = withShare(subtract(income.year, outgoingsYear))
  const potSaved = withShare(potSavedYear)

  // Needs, wants and saving (BD14).
  const saving = withShare(add(yearsOf((l) => l.group === SAVING_GROUP), potSavedYear))
  const needs = withShare(yearsOf((l) => l.group !== SAVING_GROUP && l.essential))
  const wants = withShare(yearsOf((l) => l.group !== SAVING_GROUP && !l.essential))

  const groupLines = Object.fromEntries(
    perGroup.map((g) => [g.group, subtract(sum(linesOf((l) => l.group === g.group).map((l) => l.month)), g.month)]),
  ) as Record<BudgetGroup, Money>

  const warnings: BudgetWarning[] = []
  if (compare(leftover.year, ZERO) < 0) warnings.push('negative-leftover')
  if (toPence(income.year) === 0) warnings.push('no-income')
  if (others.some((a) => toPence(a.short.year) > 0)) warnings.push('account-short')
  if (compare(mainLeft, ZERO) < 0) warnings.push('main-short')

  return {
    income,
    outgoings,
    leftover,
    perGroup,
    potSaved,
    needs,
    wants,
    saving,
    savingsRate: saving.share,
    accounts,
    topUp: both(sum(others.map((a) => a.short.year))),
    incomeLines,
    outgoingLines,
    pennyDrift: {
      income: subtract(sum(incomeLines.map((l) => l.month)), income.month),
      groups: subtract(add(sum(perGroup.map((g) => g.month)), potSaved.month), outgoings.month),
      lines: groupLines,
      leftover: subtract(subtract(income.month, outgoings.month), leftover.month),
    },
    warnings,
    assumptions: ASSUMPTIONS,
  }
}

/** The budget for these inputs, or a typed refusal naming each problem (BD9). Never throws on bad inputs. */
export function budget(inputs: BudgetInputs): BudgetOutcome {
  const accounts = accountProblems(inputs?.accounts)
  const problems = [...incomeProblems(inputs?.income), ...accounts.problems, ...outgoingProblems(inputs?.outgoings, accounts.ids)]
  if (problems.length > 0) return { ok: false, problems }
  try {
    return { ok: true, result: calculate(inputs) }
  } catch (error) {
    if (error instanceof MoneyError) return { ok: false, problems: [{ field: 'result', reason: 'too-large' }] }
    throw error
  }
}
