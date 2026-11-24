import { describe, expect, it } from 'vitest'
import { taxYear } from '@/config/tax/2026-27'
import { MAX_BUDGET_ACCOUNTS, MAX_BUDGET_LINES, MAX_INPUT_AMOUNT, MAX_ITEM_NAME_LENGTH } from '@/lib/inputLimits'
import { fromPence, fromPounds, ratio, toPence, ZERO } from '@/lib/money'
import { readScenario } from '@/scenarios/scenario'
import { CALCULATORS } from '../index'
import { scenarioTaxYear } from '../session'
import { budget } from './calc'
import {
  ACCOUNT_TEMPLATES,
  applyTemplate,
  type BudgetPageInputs,
  budgetCalculator,
  calculate,
  currentTemplate,
  DEFAULT_LINES,
  inputRefusal,
  MIGRATED_JOINT_LINE,
  newAccountId,
  sectionSet,
  toEngineInputs,
  withoutAccounts,
  withWhatIf,
} from './definition'

/*
 * The household budget's registry entry. Inputs from storage or an imported
 * file are untrusted, so validateInputs checks every field and builds a
 * fresh object. Amounts are made up.
 */

const defaults = () => budgetCalculator.defaultInputs()
const check = (raw: unknown) => budgetCalculator.validateInputs(raw)
const errorsOf = (raw: unknown) => {
  const result = check(raw)
  return result.ok ? [] : result.errors
}

const example: BudgetPageInputs = {
  pay: fromPounds(2_500),
  payPeriod: 'monthly',
  income: [{ name: 'Rent from lodger', amount: fromPounds(300), period: 'monthly' }],
  accounts: [
    { id: 'a1', name: 'Personal', kind: 'spending', amount: fromPounds(200), period: 'monthly', othersIn: ZERO },
    { id: 'a2', name: 'Joint', kind: 'joint', amount: fromPounds(700), period: 'monthly', othersIn: ZERO },
  ],
  outgoings: [
    { name: 'Groceries', amount: fromPounds(400), period: 'monthly', group: 'food', account: 'a2', essential: true },
    { name: 'Fuel', amount: fromPounds(150), period: 'monthly', group: 'transport', account: 'a1', essential: true },
    { name: 'Credit card payment', amount: fromPounds(200), period: 'monthly', group: 'debt', account: 'main', essential: true },
    { name: 'Stocks and shares ISA', amount: fromPounds(250), period: 'monthly', group: 'saving', account: 'main', essential: true },
  ],
}

describe('registration', () => {
  it('is registered as budget, inputs version 3, with no tax rules', () => {
    expect(CALCULATORS.get('budget')).toBe(budgetCalculator)
    expect(budgetCalculator.inputsVersion).toBe(3)
    expect(budgetCalculator.taxRules).toBe('none')
    expect(budgetCalculator.name).toBe('Household budget')
  })

  it('a scenario carries no tax year, whatever the session holds', () => {
    expect(scenarioTaxYear(budgetCalculator, { taxYear: '2026-27' })).toBeUndefined()
    const raw = {
      id: 'b1',
      calculatorId: 'budget',
      name: 'Mine',
      inputs: example,
      inputsVersion: 3,
      createdAt: '2026-11-24T00:00:00Z',
      updatedAt: '2026-11-24T00:00:00Z',
    }
    const read = readScenario(raw, CALCULATORS)
    expect(read.ok && Object.hasOwn(read.scenario, 'taxYear')).toBe(false)
    expect(read.ok && read.scenario.inputs).toEqual(example)
    expect(readScenario({ ...raw, taxYear: '2026-27' }, CALCULATORS)).toMatchObject({ ok: false })
  })

  it('has nothing older than version 1 to migrate from', () => {
    expect(() => budgetCalculator.migrateInputs(0, {})).toThrow()
  })
})

describe('the version 1 migration (BD15)', () => {
  const v1 = {
    pay: toPence(fromPounds(3_000)),
    payPeriod: 'monthly',
    income: [{ name: 'Side work', amount: toPence(fromPounds(1_200)), period: 'annual' }],
    outgoings: [
      { name: 'Groceries', amount: toPence(fromPounds(400)), period: 'monthly', kind: 'spending' },
      { name: 'Car insurance', amount: toPence(fromPounds(600)), period: 'annual', kind: 'spending' },
      { name: 'Gym', amount: toPence(fromPounds(30)), period: 'monthly', kind: 'spending' },
      { name: 'House account', amount: toPence(fromPounds(500)), period: 'monthly', kind: 'joint' },
      { name: '', amount: toPence(fromPounds(50)), period: 'weekly', kind: 'joint' },
      { name: 'Credit card', amount: toPence(fromPounds(150)), period: 'monthly', kind: 'debt' },
      { name: 'ISA', amount: toPence(fromPounds(300)), period: 'monthly', kind: 'savings' },
    ],
  }
  const scenario = {
    id: 'old',
    calculatorId: 'budget',
    name: 'Before the redesign',
    inputs: v1,
    inputsVersion: 1,
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
  }

  it('reads a version 1 scenario as the current version', () => {
    const read = readScenario(scenario, CALCULATORS)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const inputs = read.scenario.inputs as BudgetPageInputs
    expect(inputs.outgoings.map((l) => [l.name, l.group, l.account])).toEqual([
      ['Groceries', 'food', 'main'],
      ['Car insurance', 'transport', 'main'],
      ['Gym', 'other', 'main'],
      [MIGRATED_JOINT_LINE, 'other', 'joint-1'],
      [MIGRATED_JOINT_LINE, 'other', 'joint-2'],
      ['Credit card', 'debt', 'main'],
      ['ISA', 'saving', 'main'],
    ])
    expect(inputs.accounts.map((a) => [a.id, a.name, a.kind, a.period])).toEqual([
      ['joint-1', 'House account', 'joint', 'monthly'],
      ['joint-2', 'Joint account', 'joint', 'weekly'],
    ])
    for (const l of inputs.outgoings) expect(l.essential).toBe(true)
  })

  it('keeps what is left, the outgoings and the savings rate exactly as they were', () => {
    const read = readScenario(scenario, CALCULATORS)
    if (!read.ok) throw new Error('not read')
    const outcome = calculate(read.scenario.inputs as BudgetPageInputs)
    if (!outcome.ok) throw new Error('refused')
    const r = outcome.result
    const income = 3_000 * 12 + 1_200
    const out = 400 * 12 + 600 + 30 * 12 + 500 * 12 + 50 * 52 + 150 * 12 + 300 * 12
    expect(r.income.year).toBe(fromPounds(income))
    expect(r.outgoings.year).toBe(fromPounds(out))
    expect(r.leftover.year).toBe(fromPounds(income - out))
    expect(r.savingsRate).toEqual(ratio(toPence(fromPounds(300 * 12)), toPence(fromPounds(income))))
    expect(r.warnings).toEqual([])
  })

  it('refuses hostile keys and passes a broken line on for validation to reject', () => {
    expect(() => budgetCalculator.migrateInputs(1, JSON.parse('{"pay":0,"__proto__":{"x":1}}'))).toThrow(/not safe/)
    expect(() => budgetCalculator.migrateInputs(1, null)).toThrow()
    const migrated = budgetCalculator.migrateInputs(1, { ...v1, outgoings: [null] })
    expect(check(migrated).ok).toBe(false)
  })
})

describe('the version 2 migration (BD17)', () => {
  it('gives every account nothing from others, and keeps the totals', () => {
    const v2 = JSON.parse(JSON.stringify({ ...example, accounts: example.accounts.map(({ othersIn: _, ...a }) => a) }))
    const read = readScenario(
      {
        id: 'v2',
        calculatorId: 'budget',
        name: 'V2',
        inputs: v2,
        inputsVersion: 2,
        createdAt: '2026-11-24T00:00:00Z',
        updatedAt: '2026-11-24T00:00:00Z',
      },
      CALCULATORS,
    )
    expect(read.ok && read.scenario.inputs).toEqual(example)
    expect(() => budgetCalculator.migrateInputs(2, JSON.parse('{"accounts":[],"__proto__":{"x":1}}'))).toThrow(/not safe/)
  })

  it('a joint account with money from others reads back as it was', () => {
    const shared = { ...example, accounts: example.accounts.map((a) => (a.kind === 'joint' ? { ...a, othersIn: fromPounds(300) } : a)) }
    expect(check(shared)).toEqual({ ok: true, inputs: shared })
  })
})

describe('defaults', () => {
  it('are valid: no pay, a month, no extra income, no other accounts and the named template lines, all blank', () => {
    const d = defaults()
    expect(check(d)).toEqual({ ok: true, inputs: d })
    expect(d.pay).toBe(ZERO)
    expect(d.payPeriod).toBe('monthly')
    expect(d.income).toEqual([])
    expect(d.accounts).toEqual([])
    expect(d.outgoings).toEqual(DEFAULT_LINES)
    for (const l of d.outgoings) {
      expect(l.amount).toBe(ZERO)
      expect(l.account).toBe('main')
    }
    expect(d.outgoings.find((l) => l.name === 'Eating out')!.essential).toBe(false)
    expect(d.outgoings.find((l) => l.name === 'Groceries')!.essential).toBe(true)
  })

  it('a fresh copy each time', () => {
    expect(defaults()).not.toBe(defaults())
    expect(defaults().outgoings).not.toBe(defaults().outgoings)
  })

  it('no section is set on a fresh page; one with an amount, an account, an added or renamed line is', () => {
    const d = defaults()
    for (const id of ['income', 'accounts', 'home', 'food', 'debt', 'saving', 'other'] as const) expect(sectionSet(id, d)).toBe(false)
    expect(sectionSet('income', example)).toBe(true)
    expect(sectionSet('accounts', example)).toBe(true)
    expect(sectionSet('debt', example)).toBe(true)
    const renamed = { ...d, outgoings: d.outgoings.map((l) => (l.name === 'Energy' ? { ...l, name: 'Gas and electric' } : l)) }
    expect(sectionSet('bills', renamed)).toBe(true)
    expect(sectionSet('food', renamed)).toBe(false)
  })
})

describe('validateInputs', () => {
  it('accepts valid inputs and builds a fresh object', () => {
    const result = check(example)
    expect(result).toEqual({ ok: true, inputs: example })
    expect(result.ok && result.inputs).not.toBe(example)
    expect(result.ok && result.inputs.outgoings[0]).not.toBe(example.outgoings[0])
    expect(result.ok && result.inputs.accounts[0]).not.toBe(example.accounts[0])
  })

  it('drops unknown fields', () => {
    const result = check({
      ...example,
      extra: 1,
      outgoings: [{ ...example.outgoings[0], note: 'x' }],
      accounts: example.accounts.map((a) => ({ ...a, sortCode: 'x' })),
    })
    expect(result.ok && result.inputs).toEqual({ ...example, outgoings: [example.outgoings[0]] })
  })

  it('tidies a name and cuts it to the longest a name may be', () => {
    const long = 'a'.repeat(MAX_ITEM_NAME_LENGTH + 5)
    const result = check({ ...example, income: [{ ...example.income[0], name: `  ${long}` }] })
    expect(result.ok && result.inputs.income[0]!.name).toBe('a'.repeat(MAX_ITEM_NAME_LENGTH))
    const account = check({ ...example, accounts: [{ ...example.accounts[0], name: `  ${long}` }, example.accounts[1]] })
    expect(account.ok && account.inputs.accounts[0]!.name).toBe('a'.repeat(MAX_ITEM_NAME_LENGTH))
  })

  it.each([
    ['not an object', null],
    ['an array', []],
    ['a string', 'budget'],
  ])('refuses %s', (_, raw) => {
    expect(check(raw).ok).toBe(false)
  })

  it('refuses hostile keys', () => {
    const hostile = JSON.parse(
      `{"pay":0,"payPeriod":"monthly","income":[],"accounts":[],"outgoings":[{"__proto__":{"x":1},"name":"a","amount":0,"period":"monthly","group":"food","account":"main","essential":true}]}`,
    )
    expect(errorsOf(hostile).join(' ')).toMatch(/not safe/)
    expect(check({ ...example, constructor: 1 }).ok).toBe(false)
  })

  it.each([
    ['a negative pay', { pay: -1 }, /Your pay/],
    ['pay past the input limit', { pay: toPence(MAX_INPUT_AMOUNT) + 1 }, /Your pay/],
    ['pay in pounds and pence as a decimal', { pay: 1.5 }, /Your pay/],
    ['a weekly pay', { payPeriod: 'weekly' }, /month or a year/],
    ['income that is not a list', { income: {} }, /Extra income/],
    ['accounts that are not a list', { accounts: {} }, /Accounts/],
    ['outgoings that are not a list', { outgoings: 'x' }, /Outgoings/],
  ])('refuses %s', (_, patch, message) => {
    expect(errorsOf({ ...example, ...patch }).join(' ')).toMatch(message)
  })

  it.each([
    ['a negative amount', { amount: -1 }],
    ['an amount past the limit', { amount: toPence(MAX_INPUT_AMOUNT) + 1 }],
    ['an amount as text', { amount: '5' }],
    ['no name', { name: undefined }],
    ['a name that is not text', { name: 5 }],
    ['a daily period', { period: 'daily' }],
    ['an unknown group', { group: 'treats' }],
    ['no group', { group: undefined }],
    ['an essential flag that is not true or false', { essential: 'yes' }],
    ['an account that is not there', { account: 'a9' }],
    ['a line that is not an object', null],
  ])('refuses an outgoing line with %s', (_, patch) => {
    const line = patch === null ? null : JSON.parse(JSON.stringify({ ...example.outgoings[0], ...patch }))
    expect(errorsOf({ ...example, outgoings: [line] }).join(' ')).toMatch(/line 1/)
  })

  it.each([
    ['main as its id', { id: 'main' }],
    ['an id with spaces', { id: 'my account' }],
    ['an id that is not text', { id: 7 }],
    ['an unknown kind', { kind: 'pension' }],
    ['a negative transfer', { amount: -1 }],
    ['a daily transfer', { period: 'daily' }],
    ['money from others below nothing', { othersIn: -1 }],
    ['no money from others', { othersIn: undefined }],
    ['no name', { name: undefined }],
  ])('refuses an account with %s', (_, patch) => {
    const account = JSON.parse(JSON.stringify({ ...example.accounts[0], ...patch }))
    expect(errorsOf({ ...example, accounts: [account, example.accounts[1]] }).join(' ')).toMatch(/account 1/)
  })

  it('refuses an id used twice', () => {
    expect(errorsOf({ ...example, accounts: [example.accounts[0], example.accounts[0]] }).join(' ')).toMatch(/used twice/)
  })

  it('refuses more lines or accounts than a list holds', () => {
    const line = example.outgoings[2]!
    expect(check({ ...example, outgoings: Array.from({ length: MAX_BUDGET_LINES }, () => line) }).ok).toBe(true)
    expect(errorsOf({ ...example, outgoings: Array.from({ length: MAX_BUDGET_LINES + 1 }, () => line) }).join(' ')).toMatch(/at most/)
    const accounts = Array.from({ length: MAX_BUDGET_ACCOUNTS + 1 }, (_, i) => ({ ...example.accounts[0]!, id: `x${i}` }))
    expect(errorsOf({ ...example, accounts }).join(' ')).toMatch(/at most/)
  })
})

describe('the engine mapping', () => {
  it('puts Your pay first among the income lines', () => {
    const engine = toEngineInputs(example)
    expect(engine.income[0]).toEqual({ name: 'Your pay', amount: example.pay, period: 'monthly' })
    expect(engine.income.slice(1)).toEqual(example.income)
    expect(engine.outgoings).toEqual(example.outgoings)
    expect(engine.accounts).toEqual(example.accounts)
    expect(calculate(example)).toEqual(budget(engine))
  })

  it('a yearly pay is a yearly line', () => {
    const r = calculate({ ...example, payPeriod: 'annual', income: [] })
    expect(r.ok && r.result.income.year).toBe(example.pay)
  })

  it('an engine refusal reads by field, with no figures', () => {
    const refusal = inputRefusal([
      { field: 'outgoings', index: 2, reason: 'above-maximum' },
      { field: 'accounts', index: 0, reason: 'bad-account-id' },
      { field: 'result', reason: 'too-large' },
    ])
    expect(refusal.kind).toBe('inputs')
    expect(refusal.problems.map((x) => x.label)).toEqual(['Outgoings, line 3', 'Accounts, account 1', 'Result'])
    for (const x of refusal.problems) expect(x.message).not.toMatch(/\d/)
  })
})

describe('what-ifs (BD7)', () => {
  it('replace the amounts named and nothing else, transfers included', () => {
    const next = withWhatIf(example, {
      pay: fromPounds(2_600),
      outgoings: new Map([[1, fromPounds(600)]]),
      income: new Map(),
      accounts: new Map([[0, fromPounds(450)]]),
    })
    expect(next.pay).toBe(fromPounds(2_600))
    expect(next.outgoings[1]).toEqual({ ...example.outgoings[1], amount: fromPounds(600) })
    expect(next.outgoings[0]).toBe(example.outgoings[0])
    expect(next.accounts[0]).toEqual({ ...example.accounts[0], amount: fromPounds(450) })
    expect(next.accounts[1]).toBe(example.accounts[1])
    expect(example.pay).toBe(fromPounds(2_500))
  })

  it('ignore a line that is no longer there', () => {
    const next = withWhatIf(example, { outgoings: new Map([[99, fromPounds(1)]]), income: new Map() })
    expect(next).toEqual(example)
  })
})

describe('accounts: ids, removal and templates (BD11)', () => {
  it('a new id is the first free one', () => {
    expect(newAccountId(example)).toBe('a3')
    expect(newAccountId({ ...example, accounts: [example.accounts[1]!] })).toBe('a1')
  })

  it('removing an account pays its lines from main, and leaves the rest as they were', () => {
    const next = withoutAccounts(example, new Set(['a1']))
    expect(next.accounts.map((a) => a.id)).toEqual(['a2'])
    expect(next.outgoings.map((l) => l.account)).toEqual(['a2', 'main', 'main', 'main'])
    expect(check(next).ok).toBe(true)
  })

  it('the template the accounts match, if any', () => {
    expect(currentTemplate(example)).toBe('both')
    expect(currentTemplate(defaults())).toBe('one')
    expect(currentTemplate({ ...example, accounts: [...example.accounts, { ...example.accounts[0]!, id: 'a3' }] })).toBeUndefined()
  })

  it.each(ACCOUNT_TEMPLATES.map((t) => [t.id, t.kinds] as const))('applying %s gives exactly its accounts, valid', (id, kinds) => {
    const next = applyTemplate(example, id)
    expect(next.accounts.map((a) => a.kind).sort()).toEqual([...kinds].sort())
    expect(currentTemplate(next)).toBe(id)
    expect(check(next).ok).toBe(true)
  })

  it('keeps an account the template needs, with its name, transfer and lines', () => {
    const next = applyTemplate(example, 'joint')
    expect(next.accounts).toEqual([example.accounts[1]])
    expect(next.outgoings.map((l) => l.account)).toEqual(['a2', 'main', 'main', 'main'])
  })

  it('a new account from a template is blank, a month', () => {
    const next = applyTemplate(example, 'all')
    const pot = next.accounts.find((a) => a.kind === 'savings')!
    expect(pot).toEqual({ id: 'a3', name: 'Savings pot', kind: 'savings', amount: ZERO, period: 'monthly', othersIn: ZERO })
  })
})

describe('summarise (compare)', () => {
  it('gives the inputs and the year’s results as rows', () => {
    const summary = budgetCalculator.summarise(example, taxYear)
    expect(summary.inputs.map((r) => r.label)).toEqual([
      'Your pay',
      'Pay entered',
      'Extra income lines',
      'Accounts besides main',
      'Outgoing lines',
    ])
    expect(summary.results.ok).toBe(true)
    if (!summary.results.ok) return
    expect(summary.results.rows.map((r) => r.label)).toEqual([
      'Income a year',
      'Outgoings a year',
      'Left over a year',
      'Left in main account a year',
      'Put in by others a year',
      'Top-up needed a year',
      'Home a year',
      'Bills a year',
      'Food a year',
      'Transport a year',
      'Personal spending a year',
      'Debt a year',
      'Saving and investing a year',
      'Other a year',
      'Savings rate',
    ])
    const income = toPence(fromPounds(2_800 * 12))
    expect(summary.results.rows[2]!.value).toEqual({ kind: 'money', amount: fromPence(income - toPence(fromPounds(1_000 * 12))) })
    // Main: 2,800 in, 450 paid, 900 transferred: 1,450 a month. The personal account has 50 left and the joint 300: nothing short.
    expect(summary.results.rows[3]!.value).toEqual({ kind: 'money', amount: fromPounds(1_450 * 12) })
    expect(summary.results.rows[5]!.value).toEqual({ kind: 'money', amount: fromPounds(0) })
    expect(summary.results.rows.at(-1)!.value).toEqual({ kind: 'ratio', ratio: ratio(toPence(fromPounds(250 * 12)), income) })
  })

  it('a savings rate with no income is n/a', () => {
    const summary = budgetCalculator.summarise(defaults(), taxYear)
    expect(summary.results.ok && summary.results.rows.at(-1)!.value).toEqual({ kind: 'text', text: 'n/a' })
  })
})
