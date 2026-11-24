import { Plus, RotateCcw, Share2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AssumptionsPanel } from '@/components/AssumptionsPanel'
import { CurrencyInput } from '@/components/inputs/CurrencyInput'
import { Segmented } from '@/components/inputs/Segmented'
import { Select } from '@/components/inputs/Select'
import { SliderInput } from '@/components/inputs/SliderInput'
import { TextInput } from '@/components/inputs/TextInput'
import { NoTaxRulesBadge } from '@/components/NoTaxRulesBadge'
import { RefusalNotice } from '@/components/RefusalNotice'
import { ScenarioBar } from '@/components/ScenarioBar'
import { Section } from '@/components/Section'
import { StickyResult } from '@/components/StickyResult'
import { InlineNotice } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useItemKeys } from '@/hooks/useItemKeys'
import { formatGBP } from '@/lib/format'
import { MAX_BUDGET_LINES, MAX_INPUT_AMOUNT, MAX_ITEM_NAME_LENGTH } from '@/lib/inputLimits'
import { compare, type Money, subtract, toPence, ZERO } from '@/lib/money'
import { useStore } from '@/lib/store'
import { canonicalJson } from '@/lib/validate'
import { settingsStore } from '@/settings/settings'
import { DISCLAIMER } from '@/sheets/parts'
import { toasts } from '@/toast/toasts'
import { sessionFor } from '../session'
import {
  ACCOUNT_KIND_LABELS,
  applyTemplate,
  type BudgetPageInputs,
  budgetCalculator,
  calculate,
  coveringMonthly,
  GROUP_ESSENTIAL,
  GROUP_LABELS,
  inputRefusal,
  newAccount,
  PAY_LABEL,
  PAY_PERIODS,
  PERIOD_LABELS,
  PERIOD_UNITS,
  PERIODS,
  type SectionId,
  sectionSet,
  type TemplateId,
  type WhatIf,
  withoutAccounts,
  withWhatIf,
} from './definition'
import { Accounts } from './page/Accounts'
import { AddLines, LineEditor, mainOption } from './page/LineEditor'
import { type Gbp, IN_VIEW, pick, Results, shareText, type View } from './page/Results'
import { GROUP_SWATCHES, IconTile } from './page/style'
import { type Account, BUDGET_GROUPS, type BudgetGroup, type BudgetResult, type IncomeLine, MAIN_ACCOUNT, type OutgoingLine } from './types'

/*
 * The household budget page at #/c/budget, laid out as docs/ui-patterns.md:
 * Your pay always visible, extra income in a section, then "Your money" in
 * two views: what each line is for (a section per group, BD10) or where it is
 * paid from (accounts and transfers, BD11), and What if (BD7). Results are
 * always in view (StickyResult): left over across accounts, what is left in
 * each, a fix for an account that runs short, where income goes, the biggest
 * outgoings and the 50/30/20 check (BD12 to BD14). Share opens the sharing
 * dialog (BD16). What-ifs and every open/closed state are page state only,
 * never stored. Uses no tax rules. Every figure is the engine's.
 */

const ShareDialog = lazy(() => import('./share/ShareDialog'))

const session = sessionFor(budgetCalculator)

type By = 'what' | 'where'
const BY_OPTIONS: readonly { value: By; label: string }[] = [
  { value: 'what', label: 'What it’s for' },
  { value: 'where', label: 'Where it’s paid from' },
]
const PAY_PERIOD_OPTIONS = PAY_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))
const PERIOD_OPTIONS = PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))
const VIEW_OPTIONS: readonly { value: View; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

/** Quick-add names per group: a template, not advice. */
const PRESETS: Record<BudgetGroup, readonly string[]> = {
  home: ['Home insurance', 'Service charge', 'Cleaner'],
  bills: ['Water', 'TV licence', 'Streaming'],
  food: ['Takeaways', 'Coffee'],
  transport: ['Parking', 'Train or bus', 'Car service'],
  personal: ['Gym', 'Haircuts', 'Gifts'],
  debt: ['Car loan', 'Personal loan'],
  saving: ['Pension top-up', 'Emergency fund'],
  other: ['Charity', 'Pets'],
}

/** What the page adds to the engine's assumptions. No figures. */
const PAGE_ASSUMPTIONS = [
  'Uses no tax rules: enter your pay as it reaches your account, after tax and anything else your employer takes.',
  'What-ifs are tried out on this page only and never saved; Apply puts them into your inputs, which a scenario can then save.',
  'The 50/30/20 check compares your needs, wants and saving with a common rule of thumb; it is not advice.',
  'Illustrative only: a budget of what you enter, not a forecast or advice.',
]

const NOT_SET = 'Not set'
const NEEDS_FIXING = 'Fix the highlighted input'
const FULL_TEXT = `That’s the most lines Sumyard holds (${MAX_BUDGET_LINES}). Combine lines to add more.`

/** What-ifs by line key or account id, tied to the inputs' revision: a load or a fresh start drops them (BD7). */
interface Overlay {
  readonly revision: number
  readonly pay?: Money
  readonly income: ReadonlyMap<number, Money>
  readonly outgoings: ReadonlyMap<number, Money>
  readonly accounts: ReadonlyMap<string, Money>
}

const emptyOverlay = (revision: number): Overlay => ({ revision, income: new Map(), outgoings: new Map(), accounts: new Map() })

/** Line keys to places in the lists, for withWhatIf; keys no longer there are dropped. */
function byIndex<K>(amounts: ReadonlyMap<K, Money>, keys: readonly K[]): Map<number, Money> {
  const out = new Map<number, Money>()
  for (const [key, amount] of amounts) {
    const index = keys.indexOf(key)
    if (index >= 0) out.set(index, amount)
  }
  return out
}

const set = (patch: Partial<BudgetPageInputs>) => session.setInputs(patch)
const forget = (...fields: string[]) => {
  for (const field of fields) session.setFieldValid(field, true)
}

/** Replaces the inputs, with Undo while nothing else has changed them. */
function replaceWithUndo(next: BudgetPageInputs, message: string, done: string) {
  const before = session.get().inputs
  const revision = session.get().revision
  set(next)
  const after = session.get().inputs
  toasts.show({
    message,
    undo: {
      blocked: () =>
        session.get().revision !== revision
          ? 'Couldn’t undo: other inputs have been loaded since.'
          : canonicalJson(session.get().inputs) !== canonicalJson(after)
            ? 'Couldn’t undo: your inputs have changed since.'
            : undefined,
      run: () => set(before),
      done,
    },
  })
}

export default function BudgetPage() {
  const state = useStore(session)
  const amounts = useStore(settingsStore, (s) => s.amounts)
  const inputs = state.inputs
  const invalid = state.invalid.length > 0
  const incomeKeys = useItemKeys(inputs.income.length)
  const outgoingKeys = useItemKeys(inputs.outgoings.length)
  const [view, setView] = useState<View>('month')
  const [sharing, setSharing] = useState(false)
  const [stored, setOverlay] = useState(() => emptyOverlay(state.revision))
  const overlay = stored.revision === state.revision ? stored : emptyOverlay(state.revision)
  const whatIf: WhatIf = {
    ...(overlay.pay !== undefined && { pay: overlay.pay }),
    income: byIndex(overlay.income, incomeKeys.keys),
    outgoings: byIndex(overlay.outgoings, outgoingKeys.keys),
    accounts: byIndex(
      overlay.accounts,
      inputs.accounts.map((a) => a.id),
    ),
  }
  const whatIfInputs = withWhatIf(inputs, whatIf)
  const active = canonicalJson(whatIfInputs) !== canonicalJson(inputs)
  const baseline = useMemo(() => calculate(inputs), [inputs])
  const whatIfKey = canonicalJson(whatIfInputs)
  // biome-ignore lint/correctness/useExhaustiveDependencies: whatIfKey stands for whatIfInputs, a fresh object each render.
  const alternative = useMemo(() => (active ? calculate(whatIfInputs) : null), [active, whatIfKey])
  const gbp: Gbp = (amount) => formatGBP(amount, amounts)

  const result = !invalid && baseline.ok ? baseline.result : null
  const whatIfResult = result && alternative?.ok ? alternative.result : null
  const shown = whatIfResult ?? result
  const many = inputs.accounts.length > 0
  const label = `Left over${many ? ' across accounts' : ''}${whatIfResult ? ' with your what-ifs,' : ''} ${IN_VIEW[view]}`
  const shortNote = shown
    ? shown.accounts
        .filter((a) => toPence(a.short.year) > 0)
        .map((a) => `${a.name} is ${gbp(pick(a.short, view))} short`)
        .join('; ')
    : ''
  const value = shown
    ? `${gbp(pick(shown.leftover, view))} (${shareText(shown.leftover.share)} of your income)${shortNote ? `\n${shortNote}` : ''}`
    : null

  const apply = () => {
    const before = inputs
    const revision = state.revision
    session.setInputs({
      pay: whatIfInputs.pay,
      income: whatIfInputs.income,
      accounts: whatIfInputs.accounts,
      outgoings: whatIfInputs.outgoings,
    })
    setOverlay(emptyOverlay(revision))
    toasts.show({
      message: 'Applied your what-ifs to your inputs.',
      undo: {
        blocked: () => (session.get().revision !== revision ? 'Couldn’t undo: other inputs have been loaded since.' : undefined),
        run: () => session.setInputs(before),
        done: 'Your inputs are back as they were.',
      },
    })
  }

  const fix = (id: string) => {
    const account = result?.accounts.find((a) => a.id === id)
    if (!account) return
    const amount = coveringMonthly(account.paid.year)
    replaceWithUndo(
      { ...inputs, accounts: inputs.accounts.map((a) => (a.id === id ? { ...a, amount, period: 'monthly' } : a)) },
      `${account.name} now gets ${gbp(amount)} a month.`,
      `${account.name}’s transfer is back as it was.`,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 id="main-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
            {budgetCalculator.name}
          </h1>
          <p className="text-text-muted">{budgetCalculator.summary}</p>
          {/* On a phone the badge is in the sticky bar instead. */}
          <div className="hidden md:flex">
            <NoTaxRulesBadge />
          </div>
        </div>
        <Button
          id="bd-share"
          variant="primary"
          disabled={!result}
          aria-haspopup="dialog"
          onClick={() => setSharing(true)}
          className="h-auto min-h-touch py-2"
        >
          <Share2 />
          Share
        </Button>
      </div>

      <StickyResult
        label={label}
        value={value}
        emptyText={invalid ? 'Fix the highlighted inputs' : 'No result for these inputs'}
        announcement={value === null ? null : `${label}: ${value}`}
        controls={
          <>
            <Segmented id="bd-view-bar" label="Show amounts" value={view} options={VIEW_OPTIONS} onChange={setView} />
            <div className="flex">
              <NoTaxRulesBadge />
            </div>
          </>
        }
        results={
          invalid ? (
            <InlineNotice tone="warning" title="No results until the inputs are fixed">
              <p>Fix the highlighted inputs to see results.</p>
            </InlineNotice>
          ) : baseline.ok ? (
            <Results result={baseline.result} whatIf={whatIfResult} view={view} setView={setView} gbp={gbp} onFix={fix} />
          ) : (
            <RefusalNotice refusal={inputRefusal(baseline.problems)} />
          )
        }
      >
        <ScenarioBar calculator={budgetCalculator} session={session} />
        {/* Keyed by revision: a loaded scenario or a fresh start resets every box and which sections are open. */}
        <Inputs
          key={state.revision}
          inputs={inputs}
          invalidFields={state.invalid}
          result={baseline.ok ? baseline.result : null}
          incomeKeys={incomeKeys}
          outgoingKeys={outgoingKeys}
          overlay={overlay}
          setOverlay={setOverlay}
          whatIfActive={active}
          apply={apply}
          view={view}
          gbp={gbp}
        />
      </StickyResult>

      <AssumptionsPanel items={[...(result ? result.assumptions : []), ...PAGE_ASSUMPTIONS]}>
        <p className="text-text-muted">Illustrative only, not financial advice. {DISCLAIMER}</p>
      </AssumptionsPanel>

      {sharing && result && (
        <Suspense fallback={null}>
          <ShareDialog
            inputs={inputs}
            result={result}
            onClose={() => {
              setSharing(false)
              document.getElementById('bd-share')?.focus()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

type Keys = ReturnType<typeof useItemKeys>

/**
 * The inputs: Your pay always visible, then extra income, "Your money" and What if. Remounted (by key) on a load or a
 * fresh start; which sections and lines are open is never stored.
 */
function Inputs({
  inputs,
  invalidFields,
  result,
  incomeKeys,
  outgoingKeys,
  overlay,
  setOverlay,
  whatIfActive,
  apply,
  view,
  gbp,
}: {
  inputs: BudgetPageInputs
  invalidFields: readonly string[]
  result: BudgetResult | null
  incomeKeys: Keys
  outgoingKeys: Keys
  overlay: Overlay
  setOverlay: (overlay: Overlay) => void
  whatIfActive: boolean
  apply: () => void
  view: View
  gbp: Gbp
}) {
  const [openOnMount] = useState(() =>
    Object.fromEntries((['income', 'accounts', ...BUDGET_GROUPS] as SectionId[]).map((id) => [id, sectionSet(id, inputs)])),
  )
  const [by, setBy] = useState<By>(() => (inputs.accounts.length > 0 ? 'where' : 'what'))
  const [openLines, setOpenLines] = useState<ReadonlySet<number>>(() => new Set())
  // What takes focus after the next render: a new line's name, a restored line, or Add after a removal.
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => {
    if (focus === null) return
    document.getElementById(focus)?.focus()
    setFocus(null)
  }, [focus])
  const latest = useRef({ incomeKeys, outgoingKeys, setFocus })
  latest.current = { incomeKeys, outgoingKeys, setFocus }

  const accountOptions = [mainOption, ...inputs.accounts.map((a) => ({ value: a.id, label: a.name || ACCOUNT_KIND_LABELS[a.kind] }))]
  const per = IN_VIEW[view]

  /* ── Outgoing lines ─────────────────────────────────────────── */
  const outField = (key: number, part: string) => `bd-out-${key}-${part}`
  const updateLine = (index: number, patch: Partial<OutgoingLine>) =>
    set({ outgoings: inputs.outgoings.map((l, i) => (i === index ? { ...l, ...patch } : l)) })
  const toggleLine = (key: number, open: boolean) =>
    setOpenLines((s) => {
      const next = new Set(s)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  const addLine = (group: BudgetGroup, name: string) => {
    const key = outgoingKeys.inserted(inputs.outgoings.length)
    const line: OutgoingLine = { name, amount: ZERO, period: 'monthly', group, account: MAIN_ACCOUNT, essential: GROUP_ESSENTIAL[group] }
    set({ outgoings: [...inputs.outgoings, line] })
    toggleLine(key, true)
    setFocus(outField(key, name ? 'amount' : 'name'))
  }
  const removeLine = (index: number, key: number, label: string, addId: string) => {
    const line = inputs.outgoings[index]!
    const revision = session.get().revision
    forget(outField(key, 'name'), outField(key, 'amount'))
    outgoingKeys.removed(index)
    set({ outgoings: inputs.outgoings.filter((_, i) => i !== index) })
    setFocus(addId)
    toasts.show({
      message: `Removed “${label}”.`,
      undo: {
        blocked: () =>
          session.get().revision !== revision
            ? 'Couldn’t undo: other inputs have been loaded since.'
            : session.get().inputs.outgoings.length >= MAX_BUDGET_LINES
              ? 'Couldn’t undo: the list is full.'
              : undefined,
        run: () => {
          const now = session.get().inputs
          const at = Math.min(index, now.outgoings.length)
          const restored = latest.current.outgoingKeys.inserted(at)
          const account = now.accounts.some((a) => a.id === line.account) ? line.account : MAIN_ACCOUNT
          set({ outgoings: [...now.outgoings.slice(0, at), { ...line, account }, ...now.outgoings.slice(at)] })
          latest.current.setFocus(`bd-out-${restored}-row`)
        },
        done: `Restored “${label}”.`,
      },
    })
  }

  const groupSummary = (group: BudgetGroup) => {
    const keys = outgoingKeys.keys
    const lines = inputs.outgoings.filter((l) => l.group === group)
    if (inputs.outgoings.some((l, i) => l.group === group && invalidFields.some((f) => f.startsWith(`bd-out-${keys[i]}-`))))
      return NEEDS_FIXING
    if (!sectionSet(group, inputs)) return NOT_SET
    const count = `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`
    const total = result?.perGroup.find((g) => g.group === group)
    return total ? `${count}, ${gbp(pick(total, view))} ${per}` : count
  }

  const full = inputs.outgoings.length >= MAX_BUDGET_LINES
  const groups = (
    <div className="flex flex-col gap-3">
      {BUDGET_GROUPS.map((group) => {
        const keys = outgoingKeys.keys
        let number = 0
        return (
          <Section
            key={group}
            id={`bd-section-${group}`}
            title={GROUP_LABELS[group]}
            summary={groupSummary(group)}
            defaultOpen={openOnMount[group]}
            icon={<IconTile swatch={GROUP_SWATCHES[group]} />}
          >
            <ul className="flex flex-col">
              {inputs.outgoings.map((line, index) => {
                if (line.group !== group) return null
                number++
                const key = keys[index] ?? index
                const lineLabel = line.name || `${GROUP_LABELS[group]} line ${number}`
                const figures = result?.outgoingLines[index]
                return (
                  <LineEditor
                    key={key}
                    lineId={`bd-out-${key}`}
                    line={line}
                    label={lineLabel}
                    open={openLines.has(key)}
                    onOpenChange={(open) => toggleLine(key, open)}
                    figure={figures ? `${gbp(pick(figures, view))}` : ''}
                    accounts={accountOptions}
                    invalid={invalidFields.some((f) => f.startsWith(`bd-out-${key}-`))}
                    onChange={(patch) => updateLine(index, patch)}
                    onValidity={(part, ok) => session.setFieldValid(outField(key, part), ok)}
                    onRemove={() => removeLine(index, key, lineLabel, `bd-add-${group}`)}
                  />
                )
              })}
            </ul>
            <AddLines
              id={`bd-add-${group}`}
              presets={PRESETS[group]}
              full={full}
              fullText={FULL_TEXT}
              onAdd={(name) => addLine(group, name)}
            />
          </Section>
        )
      })}
    </div>
  )

  /* ── Accounts ───────────────────────────────────────────────── */
  const accountField = (id: string, part: string) => `bd-acc-${id}-${part}`
  const updateAccount = (id: string, patch: Partial<Account>) =>
    set({ accounts: inputs.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  const removeAccount = (id: string) => {
    const account = inputs.accounts.find((a) => a.id === id)!
    const name = account.name || ACCOUNT_KIND_LABELS[account.kind]
    forget(accountField(id, 'name'), accountField(id, 'amount'))
    replaceWithUndo(withoutAccounts(inputs, new Set([id])), `Deleted “${name}”. Its lines are now paid from main.`, `Restored “${name}”.`)
    setFocus('bd-by')
  }
  const addAccount = (kind: Account['kind']) => {
    const account = newAccount(inputs, kind)
    set({ accounts: [...inputs.accounts, account] })
    setFocus(accountField(account.id, 'name'))
  }
  const template = (id: TemplateId) => {
    const next = applyTemplate(inputs, id)
    if (canonicalJson(next) === canonicalJson(inputs)) return
    for (const a of inputs.accounts)
      if (!next.accounts.some((b) => b.id === a.id)) forget(accountField(a.id, 'name'), accountField(a.id, 'amount'))
    replaceWithUndo(
      next,
      'Set up your accounts. Lines from any removed account are now paid from main.',
      'Your accounts are back as they were.',
    )
  }

  const accountsInvalid = invalidFields.some((f) => f.startsWith('bd-acc-'))

  return (
    <>
      <section
        aria-labelledby="bd-your-pay"
        className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
      >
        <h2 id="bd-your-pay" className="text-base font-semibold">
          {PAY_LABEL}
        </h2>
        <CurrencyInput
          id="bd-pay"
          label="Pay after tax"
          hint="What reaches your main account, after tax, National Insurance, pension and anything else taken from your pay."
          value={inputs.pay}
          emptyValue={ZERO}
          placeholder="0.00"
          min={ZERO}
          max={MAX_INPUT_AMOUNT}
          onChange={(pay) => set({ pay })}
          onValidityChange={(ok) => session.setFieldValid('pay', ok)}
        />
        <Segmented
          id="bd-pay-period"
          label="Entered"
          value={inputs.payPeriod}
          options={PAY_PERIOD_OPTIONS}
          onChange={(payPeriod) => set({ payPeriod })}
        />
      </section>

      <IncomeSection
        inputs={inputs}
        result={result}
        keys={incomeKeys}
        invalidFields={invalidFields}
        defaultOpen={openOnMount.income!}
        gbp={gbp}
        setFocus={setFocus}
        latest={latest}
      />

      <section
        aria-labelledby="bd-money-title"
        className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h2 id="bd-money-title" className="text-base font-semibold">
            Your money
          </h2>
          <p className="text-xs text-text-muted">
            {inputs.outgoings.length} {inputs.outgoings.length === 1 ? 'line' : 'lines'} · {inputs.accounts.length + 1}{' '}
            {inputs.accounts.length === 0 ? 'account' : 'accounts'}
            {accountsInvalid ? ` · ${NEEDS_FIXING.toLowerCase()} under Where it’s paid from` : ''}
          </p>
        </div>
        <Segmented id="bd-by" label="Show by" value={by} options={BY_OPTIONS} onChange={setBy} />
        <div hidden={by !== 'what'}>{groups}</div>
        <div hidden={by !== 'where'}>
          <Accounts
            inputs={inputs}
            result={result}
            view={view}
            gbp={gbp}
            invalidFields={invalidFields}
            onAccount={updateAccount}
            onValidity={(field, ok) => session.setFieldValid(field, ok)}
            onRemove={removeAccount}
            onAdd={addAccount}
            onTemplate={template}
          />
        </div>
      </section>

      <WhatIfSection
        inputs={inputs}
        incomeKeys={incomeKeys.keys}
        outgoingKeys={outgoingKeys.keys}
        overlay={overlay}
        setOverlay={setOverlay}
        active={whatIfActive}
        apply={apply}
        gbp={gbp}
      />
    </>
  )
}

/** Extra income lines (BD3), each a full line editor, in a section. */
function IncomeSection({
  inputs,
  result,
  keys,
  invalidFields,
  defaultOpen,
  gbp,
  setFocus,
  latest,
}: {
  inputs: BudgetPageInputs
  result: BudgetResult | null
  keys: Keys
  invalidFields: readonly string[]
  defaultOpen: boolean
  gbp: Gbp
  setFocus: (id: string) => void
  latest: React.RefObject<{ incomeKeys: Keys; setFocus: (id: string | null) => void }>
}) {
  const field = (key: number, part: string) => `bd-in-${key}-${part}`
  const update = (index: number, patch: Partial<IncomeLine>) =>
    set({ income: inputs.income.map((l, i) => (i === index ? { ...l, ...patch } : l)) })
  const add = () => {
    const key = keys.inserted(inputs.income.length)
    set({ income: [...inputs.income, { name: '', amount: ZERO, period: 'monthly' }] })
    setFocus(field(key, 'name'))
  }
  const remove = (index: number, key: number, label: string) => {
    const line = inputs.income[index]!
    const revision = session.get().revision
    forget(field(key, 'name'), field(key, 'amount'))
    keys.removed(index)
    set({ income: inputs.income.filter((_, i) => i !== index) })
    setFocus('bd-add-income')
    toasts.show({
      message: `Removed “${label}”.`,
      undo: {
        blocked: () =>
          session.get().revision !== revision
            ? 'Couldn’t undo: other inputs have been loaded since.'
            : session.get().inputs.income.length >= MAX_BUDGET_LINES
              ? 'Couldn’t undo: the list is full.'
              : undefined,
        run: () => {
          const now = session.get().inputs.income
          const at = Math.min(index, now.length)
          const restored = latest.current.incomeKeys.inserted(at)
          set({ income: [...now.slice(0, at), line, ...now.slice(at)] })
          latest.current.setFocus(field(restored, 'name'))
        },
        done: `Restored “${label}”.`,
      },
    })
  }
  const invalid = inputs.income.some((_, i) => invalidFields.some((f) => f.startsWith(`bd-in-${keys.keys[i]}-`)))
  const extra = result ? subtract(result.income.month, result.incomeLines[0]!.month) : ZERO
  const summary = invalid
    ? NEEDS_FIXING
    : inputs.income.length === 0
      ? NOT_SET
      : `${inputs.income.length} ${inputs.income.length === 1 ? 'line' : 'lines'}${result ? `, ${gbp(extra)} a month` : ''}`
  const full = inputs.income.length >= MAX_BUDGET_LINES
  return (
    <Section id="bd-section-income" title="Income extras" summary={summary} defaultOpen={defaultOpen}>
      <p className="-mt-1 text-xs text-text-muted">
        Money coming in besides your pay, after any tax: rent from a lodger, side work, benefits.
      </p>
      {inputs.income.map((line, index) => {
        const key = keys.keys[index] ?? index
        const id = `bd-in-${key}`
        const label = line.name || `Income line ${index + 1}`
        const figures = result?.incomeLines[index + 1]
        return (
          <fieldset key={key} id={id} data-line className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-3">
            <legend className="sr-only">{label}</legend>
            <TextInput
              id={`${id}-name`}
              label="Name"
              value={line.name}
              maxLength={MAX_ITEM_NAME_LENGTH}
              onChange={(name) => update(index, { name })}
              onValidityChange={(ok) => session.setFieldValid(field(key, 'name'), ok)}
            />
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <CurrencyInput
                id={`${id}-amount`}
                label="Amount"
                value={line.amount}
                emptyValue={ZERO}
                placeholder="0.00"
                min={ZERO}
                max={MAX_INPUT_AMOUNT}
                onChange={(amount) => update(index, { amount })}
                onValidityChange={(ok) => session.setFieldValid(field(key, 'amount'), ok)}
              />
              <Select
                id={`${id}-period`}
                label="How often"
                value={line.period}
                options={PERIOD_OPTIONS}
                onChange={(period) => update(index, { period })}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-muted tabular-nums">
                {figures ? `${gbp(figures.month)} a month, ${gbp(figures.year)} a year` : ' '}
              </p>
              <Button id={`${id}-remove`} variant="ghost" aria-label={`Remove ${label}`} onClick={() => remove(index, key, label)}>
                Remove
              </Button>
            </div>
          </fieldset>
        )
      })}
      <div className="flex flex-col gap-1.5">
        <Button
          id="bd-add-income"
          disabled={full}
          onClick={add}
          className="h-auto min-h-touch max-w-full self-start py-2 text-left whitespace-normal"
        >
          <Plus />
          Add a line
        </Button>
        {full && <p className="text-xs text-text-muted">{FULL_TEXT}</p>}
      </div>
    </Section>
  )
}

/** One slider per amount, Your pay first, then transfers and lines (BD7): page state only. Reset what-ifs and Apply (with Undo). */
function WhatIfSection({
  inputs,
  incomeKeys,
  outgoingKeys,
  overlay,
  setOverlay,
  active,
  apply,
  gbp,
}: {
  inputs: BudgetPageInputs
  incomeKeys: readonly number[]
  outgoingKeys: readonly number[]
  overlay: Overlay
  setOverlay: (overlay: Overlay) => void
  active: boolean
  apply: () => void
  gbp: Gbp
}) {
  const [bad, setBad] = useState<ReadonlySet<string>>(() => new Set())
  const validity = (id: string) => (ok: boolean) =>
    setBad((s) => {
      if (ok === !s.has(id)) return s
      const next = new Set(s)
      if (ok) next.delete(id)
      else next.add(id)
      return next
    })
  const differs = (map: ReadonlyMap<unknown, Money>, key: unknown, amount: Money) => map.has(key) && compare(map.get(key)!, amount) !== 0
  const count = [
    overlay.pay !== undefined && compare(overlay.pay, inputs.pay) !== 0,
    ...inputs.income.map((l, i) => differs(overlay.income, incomeKeys[i], l.amount)),
    ...inputs.accounts.map((a) => differs(overlay.accounts, a.id, a.amount)),
    ...inputs.outgoings.map((l, i) => differs(overlay.outgoings, outgoingKeys[i], l.amount)),
  ].filter(Boolean).length
  const slider = (
    id: string,
    label: string,
    line: { amount: Money; period: IncomeLine['period'] },
    value: Money | undefined,
    onChange: (amount: Money) => void,
  ) => (
    <SliderInput
      key={id}
      id={id}
      label={label}
      unit={PERIOD_UNITS[line.period]}
      value={value ?? line.amount}
      scaleFrom={line.amount}
      max={MAX_INPUT_AMOUNT}
      onChange={onChange}
      onValidityChange={validity(id)}
      hint={`${PERIOD_LABELS[line.period]}; your inputs say ${gbp(line.amount)}.`}
    />
  )
  const put = <K,>(field: 'income' | 'outgoings' | 'accounts', key: K, amount: Money) => {
    const next = new Map(overlay[field] as ReadonlyMap<K, Money>)
    next.set(key, amount)
    setOverlay({ ...overlay, [field]: next })
  }

  return (
    <Section
      id="bd-section-whatif"
      title="What if"
      summary={count === 0 ? NOT_SET : `${count} what-if${count === 1 ? '' : 's'}, not saved`}
    >
      <p className="-mt-1 text-xs text-text-muted">
        Try other amounts: the results show your inputs and the what-ifs side by side. What-ifs are never saved; Apply puts them into your
        inputs.
      </p>
      {slider('bd-wi-pay', PAY_LABEL, { amount: inputs.pay, period: inputs.payPeriod }, overlay.pay, (pay) =>
        setOverlay({ ...overlay, pay }),
      )}
      {inputs.income.map((line, i) =>
        slider(`bd-wi-in-${incomeKeys[i] ?? i}`, line.name || `Income line ${i + 1}`, line, overlay.income.get(incomeKeys[i]!), (amount) =>
          put('income', incomeKeys[i]!, amount),
        ),
      )}
      {inputs.accounts.map((a) =>
        slider(`bd-wi-acc-${a.id}`, `Transfer to ${a.name || ACCOUNT_KIND_LABELS[a.kind]}`, a, overlay.accounts.get(a.id), (amount) =>
          put('accounts', a.id, amount),
        ),
      )}
      {BUDGET_GROUPS.flatMap((group) =>
        inputs.outgoings.flatMap((line, i) =>
          line.group === group
            ? [
                slider(
                  `bd-wi-out-${outgoingKeys[i] ?? i}`,
                  `${line.name || `${GROUP_LABELS[group]} line`} (${GROUP_LABELS[group].toLowerCase()})`,
                  line,
                  overlay.outgoings.get(outgoingKeys[i]!),
                  (amount) => put('outgoings', outgoingKeys[i]!, amount),
                ),
              ]
            : [],
        ),
      )}
      {bad.size > 0 && (
        <p className="text-xs font-medium text-danger">
          Fix the highlighted what-if; until then it keeps its last amount and can’t be applied.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          id="bd-wi-reset"
          variant="ghost"
          disabled={!active}
          onClick={() => setOverlay(emptyOverlay(overlay.revision))}
          className="h-auto min-h-touch max-w-full border border-border py-2 text-left whitespace-normal"
        >
          <RotateCcw />
          Reset what-ifs
        </Button>
        <Button
          id="bd-wi-apply"
          disabled={!active || bad.size > 0}
          onClick={apply}
          className="h-auto min-h-touch max-w-full py-2 text-left whitespace-normal"
        >
          Apply to my inputs
        </Button>
      </div>
    </Section>
  )
}
