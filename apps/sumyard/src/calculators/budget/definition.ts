import { MAX_ACCOUNT_ID_LENGTH, MAX_BUDGET_ACCOUNTS, MAX_BUDGET_LINES, MAX_INPUT_AMOUNT, MAX_ITEM_NAME_LENGTH } from '@/lib/inputLimits'
import { compare, fromPence, type Money, mulRound, type Ratio, ratio, subtract, ZERO } from '@/lib/money'
import { MONTHS_PER_YEAR } from '@/lib/periods'
import { canonicalJson, checkUntrustedJson, cleanText, isRecord } from '@/lib/validate'
import { type CalculatorDefinition, defineCalculator, figureFromSummary, type InputRefusal, type SummaryRow } from '../registry'
import { budget } from './calc'
import {
  ACCOUNT_KINDS,
  type Account,
  type AccountKind,
  BUDGET_GROUPS,
  type BudgetGroup,
  type BudgetInputs,
  type BudgetOutcome,
  type BudgetPeriod,
  type BudgetProblem,
  type BudgetProblemReason,
  type IncomeLine,
  MAIN_ACCOUNT,
  type OutgoingLine,
} from './types'

/*
 * The household budget's registry entry (inputs version 2): what a scenario
 * stores, the defaults (named blank lines, a template: BD4), validation, the
 * version 1 migration (BD15), the engine mapping, what-ifs (BD7), account
 * templates and the compare summary. Uses no tax rules (taxRules: 'none'):
 * scenarios carry no tax year and summarise ignores the config. No figure
 * here: bounds come from src/lib/inputLimits.ts and every result from the
 * engine (./calc.ts).
 */

/** How often Your pay is entered (BD3). */
export type PayPeriod = Extract<BudgetPeriod, 'monthly' | 'annual'>

/** What the page stores. Money is integer pence; a blank amount is nothing (BD4). */
export interface BudgetPageInputs {
  /** Your pay after tax, into main. */
  readonly pay: Money
  readonly payPeriod: PayPeriod
  /** Extra income lines (BD3), into main. */
  readonly income: readonly IncomeLine[]
  /** Accounts besides main, each with its transfer from main (BD11). */
  readonly accounts: readonly Account[]
  readonly outgoings: readonly OutgoingLine[]
}

export const PERIODS: readonly BudgetPeriod[] = ['weekly', 'monthly', 'quarterly', 'annual']
export const PAY_PERIODS: readonly PayPeriod[] = ['monthly', 'annual']

export const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: 'A week',
  monthly: 'A month',
  quarterly: 'A quarter',
  annual: 'A year',
}

/** How often, in words after an amount ("per month"), for the sliders' spoken value. */
export const PERIOD_UNITS: Record<BudgetPeriod, string> = {
  weekly: 'per week',
  monthly: 'per month',
  quarterly: 'per quarter',
  annual: 'per year',
}

/** Each group's name (BD10), as the page, table, exports and compare show it. */
export const GROUP_LABELS: Record<BudgetGroup, string> = {
  home: 'Home',
  bills: 'Bills',
  food: 'Food',
  transport: 'Transport',
  personal: 'Personal spending',
  debt: 'Debt',
  saving: 'Saving and investing',
  other: 'Other',
}

/** Whether a new line in a group is essential (BD14). Saving lines are counted as saving either way. */
export const GROUP_ESSENTIAL: Record<BudgetGroup, boolean> = {
  home: true,
  bills: true,
  food: true,
  transport: true,
  personal: false,
  debt: true,
  saving: true,
  other: false,
}

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  spending: 'Spending account',
  joint: 'Joint account',
  savings: 'Savings pot',
}

/** What each kind of account is for, in a line under its name. */
export const ACCOUNT_KIND_HINTS: Record<AccountKind, string> = {
  spending: 'Gets a transfer from main; what is left is yours to spend',
  joint: 'Your share goes in from main; add what others put in beside it',
  savings: 'Gets a transfer from main; what is left is counted as saved',
}

export const MAIN_ACCOUNT_LABEL = 'Main account'
export const PAY_LABEL = 'Your pay'

const line = (name: string, group: BudgetGroup, period: BudgetPeriod = 'monthly', essential = GROUP_ESSENTIAL[group]): OutgoingLine => ({
  name,
  amount: ZERO,
  period,
  group,
  account: MAIN_ACCOUNT,
  essential,
})

/** The named blank lines a fresh page starts with: a template, not advice. */
export const DEFAULT_LINES: readonly OutgoingLine[] = [
  line('Rent or mortgage', 'home'),
  line('Council tax', 'home'),
  line('Energy', 'bills'),
  line('Phone and broadband', 'bills'),
  line('Groceries', 'food'),
  line('Eating out', 'food', 'monthly', false),
  line('Fuel or travel', 'transport'),
  line('Car insurance', 'transport', 'annual'),
  line('Shopping', 'personal'),
  line('Credit card payment', 'debt'),
  line('Cash savings', 'saving'),
  line('Stocks and shares ISA', 'saving'),
]

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => list.includes(value as T)

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= ZERO && value <= MAX_INPUT_AMOUNT

const ACCOUNT_ID = /^[a-z\d-]+$/
const isAccountId = (value: unknown): value is string =>
  typeof value === 'string' && value !== MAIN_ACCOUNT && value.length <= MAX_ACCOUNT_ID_LENGTH && ACCOUNT_ID.test(value)

const AMOUNT_RULE = 'must be whole pence from nothing up to the input limit.'
const PERIOD_RULE = 'must be weekly, monthly, quarterly or yearly.'

function readIncome(raw: unknown): IncomeLine | string {
  if (!isRecord(raw) || Array.isArray(raw)) return 'is not a line.'
  if (typeof raw.name !== 'string') return 'has no name.'
  if (!isAmount(raw.amount)) return `amount ${AMOUNT_RULE}`
  if (!isOneOf(PERIODS, raw.period)) return PERIOD_RULE
  return { name: cleanText(raw.name, MAX_ITEM_NAME_LENGTH), amount: fromPence(raw.amount), period: raw.period }
}

function readAccount(raw: unknown): Account | string {
  if (!isRecord(raw) || Array.isArray(raw)) return 'is not an account.'
  if (!isAccountId(raw.id)) return 'has an id that is not short plain text.'
  if (typeof raw.name !== 'string') return 'has no name.'
  if (!isOneOf(ACCOUNT_KINDS, raw.kind)) return 'must be a spending account, a joint account or a savings pot.'
  if (!isAmount(raw.amount)) return `transfer ${AMOUNT_RULE}`
  if (!isOneOf(PERIODS, raw.period)) return PERIOD_RULE
  if (!isAmount(raw.othersIn)) return `money from others ${AMOUNT_RULE}`
  return {
    id: raw.id,
    name: cleanText(raw.name, MAX_ITEM_NAME_LENGTH),
    kind: raw.kind,
    amount: fromPence(raw.amount),
    period: raw.period,
    othersIn: fromPence(raw.othersIn),
  }
}

function readOutgoing(raw: unknown, ids: ReadonlySet<string>): OutgoingLine | string {
  const base = readIncome(raw)
  if (typeof base === 'string') return base
  const r = raw as Record<string, unknown>
  if (!isOneOf(BUDGET_GROUPS, r.group)) return 'must be in one of the groups.'
  if (typeof r.essential !== 'boolean') return 'must say whether it is essential.'
  if (typeof r.account !== 'string' || !ids.has(r.account)) return 'is paid from an account that is not there.'
  return { ...base, group: r.group, account: r.account, essential: r.essential }
}

function readList<T>(raw: unknown, label: string, most: number, read: (item: unknown) => T | string, errors: string[]): T[] {
  if (!Array.isArray(raw)) {
    errors.push(`${label} must be a list.`)
    return []
  }
  if (raw.length > most) {
    errors.push(`${label} can hold at most the most a list holds.`)
    return []
  }
  return raw.flatMap((item, index) => {
    const value = read(item)
    if (typeof value === 'string') {
      errors.push(`${label}, ${label === 'Accounts' ? 'account' : 'line'} ${index + 1} ${value}`)
      return []
    }
    return [value]
  })
}

/** Checks untrusted inputs (storage, an imported file) field by field and builds a fresh object. */
function validate(raw: unknown) {
  if (!isRecord(raw) || Array.isArray(raw)) return { ok: false as const, errors: ['The inputs are not a set of household budget inputs.'] }
  const hostile = checkUntrustedJson(raw)
  if (hostile) return { ok: false as const, errors: [`The inputs are not safe to read: ${hostile}`] }
  const errors: string[] = []
  if (!isAmount(raw.pay)) errors.push(`${PAY_LABEL} ${AMOUNT_RULE}`)
  if (!isOneOf(PAY_PERIODS, raw.payPeriod)) errors.push(`${PAY_LABEL} must be entered a month or a year.`)
  const income = readList(raw.income, 'Extra income', MAX_BUDGET_LINES, readIncome, errors)
  const accounts = readList(raw.accounts, 'Accounts', MAX_BUDGET_ACCOUNTS, readAccount, errors)
  const ids = new Set([MAIN_ACCOUNT])
  for (const a of accounts) {
    if (ids.has(a.id)) errors.push(`Accounts: the id ${a.id} is used twice.`)
    ids.add(a.id)
  }
  const outgoings = readList(raw.outgoings, 'Outgoings', MAX_BUDGET_LINES, (item) => readOutgoing(item, ids), errors)
  if (errors.length > 0) return { ok: false as const, errors }
  const inputs: BudgetPageInputs = { pay: fromPence(raw.pay as number), payPeriod: raw.payPeriod as PayPeriod, income, accounts, outgoings }
  return { ok: true as const, inputs }
}

/** The groups version 1's default spending lines belong in (BD15); any other spending line is Other. */
const V1_GROUPS: Readonly<Record<string, BudgetGroup>> = { Groceries: 'food', 'Car insurance': 'transport', Mobile: 'bills' }

/** The line each migrated joint account gets, so the totals stay as they were (BD15). */
export const MIGRATED_JOINT_LINE = 'Spending from this account'

/**
 * Version 1 to 2 (decision BD15): kinds become groups, each joint line a
 * joint account with one line for its whole transfer, every other line paid
 * from main; what is left does not move. Untrusted: hostile keys refuse it;
 * a broken line is passed on as it is, for validation to reject; the result
 * is validated after.
 */
function migrateFromVersion1(old: unknown): unknown {
  if (!isRecord(old)) throw new Error('Version 1 inputs are not an object')
  const hostile = checkUntrustedJson(old)
  if (hostile) throw new Error(`Version 1 inputs are not safe to read: ${hostile}`)
  if (!Array.isArray(old.outgoings)) return { ...old, accounts: [] }
  const accounts: unknown[] = []
  const outgoings: unknown[] = []
  for (const item of old.outgoings as unknown[]) {
    if (!isRecord(item)) {
      outgoings.push(item)
      continue
    }
    const { kind, ...rest } = item
    if (kind === 'joint') {
      const id = `joint-${accounts.length + 1}`
      const name = typeof item.name === 'string' && item.name.trim() !== '' ? item.name : ACCOUNT_KIND_LABELS.joint
      accounts.push({ id, name, kind: 'joint', amount: item.amount, period: item.period })
      outgoings.push({ name: MIGRATED_JOINT_LINE, amount: item.amount, period: item.period, group: 'other', account: id, essential: true })
      continue
    }
    const group: unknown =
      kind === 'debt'
        ? 'debt'
        : kind === 'savings'
          ? 'saving'
          : kind === 'spending'
            ? (V1_GROUPS[typeof item.name === 'string' ? item.name : ''] ?? 'other')
            : kind
    outgoings.push({ ...rest, group, account: MAIN_ACCOUNT, essential: true })
  }
  return { ...old, accounts, outgoings }
}

/**
 * Version 2 to 3 (decision BD17): every account gets nothing from others. Untrusted: hostile keys refuse it; a broken
 * account is passed on as it is, for validation to reject; the result is validated after.
 */
function migrateFromVersion2(old: unknown): unknown {
  if (!isRecord(old)) throw new Error('Version 2 inputs are not an object')
  const hostile = checkUntrustedJson(old)
  if (hostile) throw new Error(`Version 2 inputs are not safe to read: ${hostile}`)
  if (!Array.isArray(old.accounts)) return old
  return { ...old, accounts: (old.accounts as unknown[]).map((a) => (isRecord(a) && !Array.isArray(a) ? { ...a, othersIn: 0 } : a)) }
}

const MIGRATIONS = [migrateFromVersion1, migrateFromVersion2] as const

/** Older inputs, one version at a time, up to the current one. */
function migrate(from: number, old: unknown): unknown {
  if (!Number.isSafeInteger(from) || from < 1 || from > MIGRATIONS.length)
    throw new Error(`The household budget has no inputs version ${from} to migrate from`)
  return MIGRATIONS.slice(from - 1).reduce((inputs, step) => step(inputs), old)
}

/** The engine's inputs: Your pay first among the income lines (BD3). */
export function toEngineInputs(inputs: BudgetPageInputs): BudgetInputs {
  return {
    income: [{ name: PAY_LABEL, amount: inputs.pay, period: inputs.payPeriod }, ...inputs.income],
    accounts: inputs.accounts,
    outgoings: inputs.outgoings,
  }
}

export const calculate = (inputs: BudgetPageInputs): BudgetOutcome => budget(toEngineInputs(inputs))

/** Why the engine refused, in words with no figures. */
export const PROBLEM_MESSAGES: Record<BudgetProblemReason, string> = {
  'not-a-list': 'This is not a list of lines.',
  'too-many-lines': 'This list has more lines than Sumyard holds.',
  'not-money': 'Enter an amount in pounds and pence.',
  'below-minimum': 'Enter nothing or more.',
  'above-maximum': 'This is above the most Sumyard models.',
  'not-a-choice': 'Choose one of the options.',
  'too-large': 'The totals would grow past the largest amount Sumyard can work out exactly. Try smaller amounts.',
  'too-many-accounts': 'There are more accounts than Sumyard holds.',
  'bad-account-id': 'This account can’t be read. Remove it and add it again.',
  'unknown-account': 'Choose which account pays this line.',
}

const FIELD_NAMES: Record<BudgetProblem['field'], string> = {
  income: 'Income',
  accounts: 'Accounts',
  outgoings: 'Outgoings',
  result: 'Result',
}

/** The engine's refusal as an InputRefusal, for RefusalNotice and compare. */
export function inputRefusal(problems: readonly BudgetProblem[]): InputRefusal {
  return {
    ok: false,
    kind: 'inputs',
    problems: problems.map(({ field, index, reason }) => ({
      field: index === undefined ? field : `${field}-${index}`,
      label: index === undefined ? FIELD_NAMES[field] : `${FIELD_NAMES[field]}, ${field === 'accounts' ? 'account' : 'line'} ${index + 1}`,
      message: PROBLEM_MESSAGES[reason],
    })),
  }
}

/** What-if amounts over the inputs (BD7): Your pay, lines and transfers by their place in each list. Page state only. */
export interface WhatIf {
  readonly pay?: Money
  readonly income: ReadonlyMap<number, Money>
  readonly outgoings: ReadonlyMap<number, Money>
  readonly accounts?: ReadonlyMap<number, Money>
}

const overlay = <L extends { amount: Money }>(lines: readonly L[], amounts: ReadonlyMap<number, Money> | undefined): readonly L[] =>
  !amounts || amounts.size === 0 ? lines : lines.map((l, i) => (amounts.has(i) ? { ...l, amount: amounts.get(i)! } : l))

/** The inputs with the what-if amounts in place; lines no longer there are ignored. A fresh object; the inputs are untouched. */
export function withWhatIf(inputs: BudgetPageInputs, whatIf: WhatIf): BudgetPageInputs {
  return {
    ...inputs,
    pay: whatIf.pay ?? inputs.pay,
    income: overlay(inputs.income, whatIf.income),
    accounts: overlay(inputs.accounts, whatIf.accounts),
    outgoings: overlay(inputs.outgoings, whatIf.outgoings),
  }
}

export type SectionId = 'income' | 'accounts' | BudgetGroup

/** A section differs from a fresh page's (an amount, a name, a line or account added or removed), so it opens on load; an empty group does not. */
export function sectionSet(id: SectionId, inputs: BudgetPageInputs): boolean {
  if (id === 'income') return inputs.income.length > 0
  if (id === 'accounts') return inputs.accounts.length > 0
  const ofGroup = (lines: readonly OutgoingLine[]) => lines.filter((l) => l.group === id)
  const lines = ofGroup(inputs.outgoings)
  // A group with no lines has nothing to show, so it stays closed.
  return lines.length > 0 && canonicalJson(lines) !== canonicalJson(ofGroup(DEFAULT_LINES))
}

/* ── Accounts: add, remove, templates (BD11) ─────────────────────────── */

/** The first free id of the form a1, a2, … */
export function newAccountId(inputs: BudgetPageInputs): string {
  const taken = new Set(inputs.accounts.map((a) => a.id))
  let n = 1
  while (taken.has(`a${n}`)) n++
  return `a${n}`
}

export const newAccount = (inputs: BudgetPageInputs, kind: AccountKind): Account => ({
  id: newAccountId(inputs),
  name: ACCOUNT_KIND_LABELS[kind],
  kind,
  amount: ZERO,
  period: 'monthly',
  othersIn: ZERO,
})

/** The inputs without these accounts; their lines are paid from main instead. */
export function withoutAccounts(inputs: BudgetPageInputs, ids: ReadonlySet<string>): BudgetPageInputs {
  return {
    ...inputs,
    accounts: inputs.accounts.filter((a) => !ids.has(a.id)),
    outgoings: inputs.outgoings.map((l) => (ids.has(l.account) ? { ...l, account: MAIN_ACCOUNT } : l)),
  }
}

export type TemplateId = 'one' | 'spending' | 'joint' | 'both' | 'all'

/** Ways to set up accounts, each the kinds of account besides main. */
export const ACCOUNT_TEMPLATES: readonly { id: TemplateId; label: string; kinds: readonly AccountKind[] }[] = [
  { id: 'one', label: 'One account', kinds: [] },
  { id: 'spending', label: 'Main + spending account', kinds: ['spending'] },
  { id: 'joint', label: 'Main + joint account', kinds: ['joint'] },
  { id: 'both', label: 'Main + spending + joint', kinds: ['spending', 'joint'] },
  { id: 'all', label: 'Plus a savings pot', kinds: ['spending', 'joint', 'savings'] },
]

const kindsKey = (kinds: readonly AccountKind[]) => [...kinds].sort().join()

/** The template the accounts match exactly, if any. */
export const currentTemplate = (inputs: BudgetPageInputs): TemplateId | undefined =>
  ACCOUNT_TEMPLATES.find((t) => kindsKey(t.kinds) === kindsKey(inputs.accounts.map((a) => a.kind)))?.id

/**
 * The inputs set up as a template: the first account of each kind the template needs is kept (its name, transfer and
 * lines), a blank one is added where none is there, and every other account is removed, its lines paid from main.
 */
export function applyTemplate(inputs: BudgetPageInputs, id: TemplateId): BudgetPageInputs {
  const template = ACCOUNT_TEMPLATES.find((t) => t.id === id)!
  const keep = new Set<string>()
  for (const kind of template.kinds) {
    const found = inputs.accounts.find((a) => a.kind === kind && !keep.has(a.id))
    if (found) keep.add(found.id)
  }
  let next = withoutAccounts(inputs, new Set(inputs.accounts.filter((a) => !keep.has(a.id)).map((a) => a.id)))
  for (const kind of template.kinds) {
    if (next.accounts.some((a) => a.kind === kind)) continue
    next = { ...next, accounts: [...next.accounts, newAccount(next, kind)] }
  }
  return next
}

/** A monthly transfer that covers a yearly amount: the year divided by the months, rounded up to the penny, so never short. */
export const coveringMonthly = (year: Money): Money => mulRound(year, ratio(1, MONTHS_PER_YEAR), 'up')

/** The monthly transfer from main that covers what an account pays, after what others put in (BD12, BD17). */
export const coveringTransfer = (a: { paid: { year: Money }; fromOthers: { year: Money } }): Money => {
  const needed = subtract(a.paid.year, a.fromOthers.year)
  return coveringMonthly(compare(needed, ZERO) > 0 ? needed : ZERO)
}

export const NOT_APPLICABLE = 'n/a'

const money = (label: string, amount: Money): SummaryRow => ({ label, value: { kind: 'money', amount } })
const share = (label: string, value: Ratio | null): SummaryRow => ({
  label,
  value: value === null ? { kind: 'text', text: NOT_APPLICABLE } : { kind: 'ratio', ratio: value },
})

export const budgetCalculator: CalculatorDefinition<BudgetPageInputs> = defineCalculator<BudgetPageInputs>({
  id: 'budget',
  name: 'Household budget',
  summary: 'Where your money goes each month, account by account, and what’s left.',
  taxRules: 'none',
  inputsVersion: MIGRATIONS.length + 1,
  defaultInputs: () => ({ pay: ZERO, payPeriod: 'monthly', income: [], accounts: [], outgoings: DEFAULT_LINES.map((l) => ({ ...l })) }),
  validateInputs: validate,
  migrateInputs: migrate,
  homeFigure(inputs, config) {
    return figureFromSummary(this.summarise(inputs, config), 'Left over a year', 'left over a year')
  },
  summarise(inputs) {
    const rows: SummaryRow[] = [
      money(PAY_LABEL, inputs.pay),
      { label: 'Pay entered', value: { kind: 'text', text: PERIOD_LABELS[inputs.payPeriod] } },
      { label: 'Extra income lines', value: { kind: 'count', count: inputs.income.length } },
      { label: 'Accounts besides main', value: { kind: 'count', count: inputs.accounts.length } },
      { label: 'Outgoing lines', value: { kind: 'count', count: inputs.outgoings.length } },
    ]
    const outcome = calculate(inputs)
    if (!outcome.ok) return { inputs: rows, results: inputRefusal(outcome.problems) }
    const r = outcome.result
    return {
      inputs: rows,
      results: {
        ok: true,
        rows: [
          money('Income a year', r.income.year),
          money('Outgoings a year', r.outgoings.year),
          money('Left over a year', r.leftover.year),
          money('Left in main account a year', r.accounts[0]!.left.year),
          money('Put in by others a year', r.fromOthers.year),
          money('Top-up needed a year', r.topUp.year),
          ...r.perGroup.map((t) => money(`${GROUP_LABELS[t.group]} a year`, t.year)),
          share('Savings rate', r.savingsRate),
        ],
      },
    }
  },
})
