import { CircleCheck } from 'lucide-react'
import { Donut, type DonutPart } from '@/components/Donut'
import { Segmented } from '@/components/inputs/Segmented'
import { InlineNotice } from '@/components/states'
import { Button } from '@/components/ui/button'
import { formatGBPChange, formatPercent, formatPointsChange } from '@/lib/format'
import { add, fromPence, type Money, mulRound, type Ratio, ratio, subtract, subtractRatio, toPence, ZERO } from '@/lib/money'
import { MONTHS_PER_YEAR } from '@/lib/periods'
import { cn } from '@/lib/utils'
import { coveringTransfer, GROUP_LABELS, NOT_APPLICABLE } from '../definition'
import { type AccountResult, type BudgetResult, MAIN_ACCOUNT, SAVING_GROUP, type YearAndMonth } from '../types'
import { accountSwatch, GROUP_SWATCHES, Key, LEFTOVER_SWATCH, MAIN_SWATCH, POT_SWATCH, SHORT_ICON } from './style'

/*
 * The household budget's results column (U6, BD12 to BD14): the headline
 * (left over across accounts), what is left in each account, a fix for any
 * account that runs short, the what-if comparison, where income goes, the
 * biggest outgoings, the 50/30/20 check and the table by group. Every figure
 * is the engine's (../calc.ts); the page only picks the month or year one.
 */

export type View = 'month' | 'year'
export type Gbp = (amount: Money) => string

export const VIEW_OPTIONS: readonly { value: View; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]
export const IN_VIEW: Record<View, string> = { month: 'a month', year: 'a year' }

export const pick = (figure: YearAndMonth, view: View) => (view === 'month' ? figure.month : figure.year)
/** A share to one decimal place: enough to tell parts apart, short enough to read. */
export const shareText = (share: Ratio | null) => (share === null ? NOT_APPLICABLE : formatPercent(share, 1))
const capitalised = (text: string) => text.replace(/^./, (c) => c.toUpperCase())
/** formatGBP shows a minus for an amount below nothing. */
const signed = (amount: Money, gbp: Gbp) => gbp(amount)

/** A month or year figure from an exact year (BD2): the engine's own rounding. */
export const yearInView = (year: Money, view: View): Money =>
  view === 'year' ? year : mulRound(year, ratio(1, MONTHS_PER_YEAR), 'nearest')

/** The 50/30/20 rule of thumb's shares (BD14): a comparison only, never advice. */
const RULE = { needs: ratio(1, 2), wants: ratio(3, 10), saving: ratio(1, 5) } as const

/** What an account shows in its tile: left over, or put aside for a savings pot. */
export function accountFigure(a: AccountResult): { amount: YearAndMonth; note: string; tone: 'positive' | 'danger' | 'neutral' } {
  if (toPence(a.short.year) > 0)
    return {
      amount: { year: subtract(ZERO, a.short.year), month: subtract(ZERO, a.short.month) },
      note: 'Short: topped up from main',
      tone: 'danger',
    }
  if (a.kind === 'savings') return { amount: a.saved, note: 'Put aside, counted as saved', tone: 'positive' }
  if (a.id === MAIN_ACCOUNT) {
    return toPence(a.left.year) < 0
      ? { amount: a.left, note: 'Pays and moves out more than comes in', tone: 'danger' }
      : { amount: a.left, note: 'After bills, saving and transfers', tone: toPence(a.left.year) > 0 ? 'positive' : 'neutral' }
  }
  return toPence(a.left.year) > 0
    ? { amount: a.left, note: 'Left to spend on anything else', tone: 'positive' }
    : { amount: a.left, note: 'Every pound used', tone: 'neutral' }
}

export function Results({
  result,
  whatIf,
  view,
  setView,
  gbp,
  onFix,
}: {
  result: BudgetResult
  whatIf: BudgetResult | null
  view: View
  setView: (view: View) => void
  gbp: Gbp
  /** Sets an account's transfer to cover what it pays for. */
  onFix: (accountId: string) => void
}) {
  const r = whatIf ?? result
  const per = IN_VIEW[view]
  const negative = r.warnings.includes('negative-leftover')
  const short = r.accounts.filter((a) => toPence(a.short.year) > 0)
  const many = r.accounts.length > 1
  const drift = r.pennyDrift
  const drifts =
    view === 'month' && [drift.income, drift.groups, drift.leftover, ...Object.values(drift.lines)].some((amount) => toPence(amount) !== 0)
  const status = short.length
    ? {
        text: short.length === 1 ? '1 account runs short' : `${short.length} accounts run short`,
        className: 'bg-danger-subtle text-danger',
      }
    : negative
      ? { text: 'More going out than coming in', className: 'bg-danger-subtle text-danger' }
      : { text: 'In the green', className: 'bg-positive-subtle text-positive' }

  return (
    <>
      <section
        data-budget-card
        aria-labelledby="bd-headline-label"
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            data-status
            className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', status.className)}
          >
            {status.text}
          </span>
          <Segmented id="bd-view" label="Show amounts" value={view} options={VIEW_OPTIONS} onChange={setView} />
        </div>
        <p className="flex flex-col">
          <span id="bd-headline-label" className="text-sm text-text-muted">
            Left over{many ? ' across your accounts' : ''}, {per}
            {whatIf ? ', with your what-ifs' : ''}
          </span>
          <span data-headline className={cn('text-3xl font-bold tracking-tight tabular-nums', negative ? 'text-danger' : 'text-positive')}>
            {signed(pick(r.leftover, view), gbp)}
          </span>
          <span className="mt-1 text-sm text-text">
            {r.leftover.share === null
              ? 'Enter your pay to see the share of your income each part takes.'
              : `${shareText(r.leftover.share)} of your income, after everything you spend and save.`}
            {toPence(r.fromOthers.year) > 0 && ` Includes ${gbp(pick(r.fromOthers, view))} ${per} others put in.`}
          </span>
        </p>
        <dl className="grid grid-cols-3 gap-2">
          {(
            [
              ['Take-home', gbp(pick(r.income, view))],
              ['Going out', gbp(pick(r.outgoings, view))],
              ['Saving rate', shareText(r.savingsRate)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-md bg-surface-muted px-3 py-2">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="text-base font-semibold text-text tabular-nums [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
        {many && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text-muted">Left in each account, {per}</h3>
            <ul data-account-tiles className="grid gap-2 sm:grid-cols-2">
              {r.accounts.map((a, i) => {
                const f = accountFigure(a)
                const swatch = a.id === MAIN_ACCOUNT ? MAIN_SWATCH : a.kind === 'savings' ? POT_SWATCH : accountSwatch(i - 1)
                return (
                  <li
                    key={a.id}
                    data-account={a.id}
                    className={cn(
                      'flex min-w-0 gap-2.5 rounded-md border px-3 py-2',
                      f.tone === 'danger' ? 'border-danger bg-danger-subtle' : 'border-border bg-surface',
                    )}
                  >
                    <Key swatch={swatch} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm text-text [overflow-wrap:anywhere]">{a.name}</span>
                      <span
                        className={cn(
                          'text-lg font-bold tabular-nums',
                          f.tone === 'danger' ? 'text-danger' : f.tone === 'positive' ? 'text-positive' : 'text-text',
                        )}
                      >
                        {signed(pick(f.amount, view), gbp)}
                      </span>
                      <span className="text-xs text-text-muted">{f.note}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            {toPence(r.topUp.year) > 0 && (
              <p className="text-xs text-text-muted">
                Main less the top-up:{' '}
                <span className="font-semibold text-text tabular-nums">
                  {signed(pick(subtractFigures(r.accounts[0]!.left, r.topUp), view), gbp)}
                </span>{' '}
                really left in main {per}.
              </p>
            )}
          </div>
        )}
        {short.map((a) => (
          <div
            key={a.id}
            data-short={a.id}
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-md border border-danger bg-danger-subtle p-3"
          >
            <SHORT_ICON aria-hidden="true" className="size-5 shrink-0 text-danger" />
            <p className="min-w-56 flex-1 text-sm text-text">
              <strong>
                {a.name} runs {gbp(pick(a.short, view))} short {per}
              </strong>
              , so you’re topping it up from your main account. Moving {gbp(coveringTransfer(a))} a month instead of{' '}
              {gbp(subtract(a.moneyIn.month, a.fromOthers.month))} would cover what it pays for
              {toPence(a.fromOthers.year) > 0 ? `, with the ${gbp(a.fromOthers.month)} others put in` : ''}.
            </p>
            {!whatIf && (
              <Button variant="danger" onClick={() => onFix(a.id)} className="h-auto min-h-touch py-1.5 whitespace-normal">
                Move {gbp(coveringTransfer(a))} a month
              </Button>
            )}
          </div>
        ))}
        {!short.length && many && !negative && (
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <CircleCheck aria-hidden="true" className="size-4 text-positive" />
            Every account covers what it pays for.
          </p>
        )}
      </section>

      {r.warnings.includes('no-income') && (
        <div data-warning="no-income">
          <InlineNotice tone="info">
            <p>Enter your pay to see the share of your income each part takes. Until then shares are {NOT_APPLICABLE}.</p>
          </InlineNotice>
        </div>
      )}
      {negative && (
        <div data-warning="negative-leftover">
          <InlineNotice tone="warning" title="More going out than coming in">
            <p>
              Your outgoings are {gbp(subtract(ZERO, pick(r.leftover, view)))} {per} more than your income
              {whatIf ? ' with your what-ifs' : ''}. It is shown as it is, not capped at nothing.
            </p>
          </InlineNotice>
        </div>
      )}
      {!negative && r.warnings.includes('main-short') && (
        <div data-warning="main-short">
          <InlineNotice tone="warning" title="Your main account goes below nothing">
            <p>
              Main pays out and moves {gbp(subtract(ZERO, pick(r.accounts[0]!.left, view)))} {per} more than comes in. The money is still
              yours, in your other accounts; consider moving less.
            </p>
          </InlineNotice>
        </div>
      )}

      {whatIf && <WhatIfResults result={result} whatIf={whatIf} view={view} gbp={gbp} />}

      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <WhereItGoes result={r} view={view} gbp={gbp} />
      </div>
      <Biggest result={r} view={view} gbp={gbp} />
      <RuleCheck result={r} />
      <GroupTable result={r} view={view} gbp={gbp} drifts={drifts} whatIf={whatIf !== null} />
    </>
  )
}

const subtractFigures = (a: YearAndMonth, b: YearAndMonth): YearAndMonth => ({
  year: subtract(a.year, b.year),
  month: subtract(a.month, b.month),
})

/** The donut of where income goes: each group, what pots put aside, and what is left (BD12). With outgoings over income, where outgoings go. */
export function WhereItGoes({ result: r, view, gbp }: { result: BudgetResult; view: View; gbp: Gbp }) {
  const negative = toPence(r.leftover.year) < 0
  const parts: DonutPart[] = [
    ...r.perGroup.map((g) => ({
      id: g.group,
      label: GROUP_LABELS[g.group],
      value: toPence(g.year),
      stroke: GROUP_SWATCHES[g.group].stroke,
      key: <Key swatch={GROUP_SWATCHES[g.group]} />,
    })),
    ...(toPence(r.potSaved.year) > 0
      ? [
          {
            id: 'pots',
            label: 'Put aside in savings pots',
            value: toPence(r.potSaved.year),
            stroke: POT_SWATCH.stroke,
            key: <Key swatch={POT_SWATCH} />,
          },
        ]
      : []),
    ...(negative
      ? []
      : [
          {
            id: 'leftover',
            label: 'Left over',
            value: toPence(r.leftover.year),
            stroke: LEFTOVER_SWATCH.stroke,
            key: <Key swatch={LEFTOVER_SWATCH} />,
          },
        ]),
  ]
  const others = toPence(r.fromOthers.year) > 0
  const total = negative ? r.outgoings.year : add(r.income.year, r.fromOthers.year)
  return (
    <Donut
      title={
        negative
          ? `Where your outgoings go, ${IN_VIEW[view]}`
          : others
            ? `Where your income and money from others goes, ${IN_VIEW[view]}`
            : `Where your income goes, ${IN_VIEW[view]}`
      }
      parts={parts}
      total={toPence(total)}
      centre={
        <>
          <span className="text-xs text-text-muted">Going out</span>
          <span className="text-lg font-bold text-text tabular-nums">{gbp(pick(r.outgoings, view))}</span>
          <span className="text-xs text-text-muted">{IN_VIEW[view]}</span>
        </>
      }
      formatValue={(v) => gbp(yearInView(fromPence(v), view))}
      emptyText="Nothing to show yet: enter your pay and outgoings."
    />
  )
}

/** The three biggest lines outside saving, ranked, with their share of what is spent. */
function Biggest({ result: r, view, gbp }: { result: BudgetResult; view: View; gbp: Gbp }) {
  const spend = r.outgoingLines.filter((l) => l.line.group !== SAVING_GROUP && toPence(l.year) > 0)
  const top = [...spend].sort((a, b) => toPence(b.year) - toPence(a.year)).slice(0, 3)
  if (top.length === 0) return null
  const spent = spend.reduce((s, l) => s + toPence(l.year), 0)
  const topTotal = top.reduce((s, l) => s + toPence(l.year), 0)
  const largest = toPence(top[0]!.year)
  return (
    <section aria-labelledby="bd-biggest-title" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 id="bd-biggest-title" className="text-base font-semibold text-text">
          Your biggest outgoings
        </h2>
        <p className="text-sm text-text-muted">
          {top.length === 1 ? 'This is' : `These ${top.length} are`} {formatPercent(ratio(topTotal, spent), 0)} of what you spend, not
          counting saving.
        </p>
      </div>
      <ol data-biggest className="flex flex-col gap-3">
        {top.map((l, i) => (
          <li key={r.outgoingLines.indexOf(l)}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="mr-1.5 font-semibold text-text-muted">{i + 1}</span>
                {l.line.name || GROUP_LABELS[l.line.group]}
              </span>
              <span className="font-semibold tabular-nums">{gbp(pick(l, view))}</span>
            </div>
            <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={cn('h-full rounded-full', GROUP_SWATCHES[l.line.group].fill)}
                style={{ width: `${(toPence(l.year) / largest) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Needs, wants and saving beside the 50/30/20 rule of thumb (BD14). */
function RuleCheck({ result: r }: { result: BudgetResult }) {
  if (r.needs.share === null) return null
  const rows = [
    { label: 'Needs', share: r.needs.share, guide: RULE.needs, fill: 'bg-group-home' },
    { label: 'Wants', share: r.wants.share!, guide: RULE.wants, fill: 'bg-group-food' },
    { label: 'Saving', share: r.saving.share!, guide: RULE.saving, fill: 'bg-group-saving' },
  ]
  const width = (share: Ratio) => `${Math.min(Math.max(share.numerator / share.denominator, 0), 1) * 100}%`
  return (
    <section aria-labelledby="bd-rule-title" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bd-rule-title" className="text-base font-semibold text-text">
          50/30/20 check
        </h2>
        <span className="text-xs text-text-muted">A rule of thumb, not advice</span>
      </div>
      <ul data-rule className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex justify-between gap-3 text-sm">
              <span>{row.label}</span>
              <span>
                <span className="font-semibold tabular-nums">{formatPercent(row.share, 0)}</span>
                <span className="text-text-muted"> · guide {formatPercent(row.guide, 0)}</span>
              </span>
            </div>
            <div aria-hidden="true" className="relative mt-1 h-2 rounded-full bg-surface-muted">
              <div className={cn('h-full rounded-full', row.fill)} style={{ width: width(row.share) }} />
              <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-text" style={{ left: width(row.guide) }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">Mark a line essential or not in its editor. Left over is not counted in any of the three.</p>
    </section>
  )
}

/** Your inputs beside the what-ifs, with the change (BD7). */
function WhatIfResults({ result, whatIf, view, gbp }: { result: BudgetResult; whatIf: BudgetResult; view: View; gbp: Gbp }) {
  const figures: [string, YearAndMonth, YearAndMonth][] = [
    ['Income', result.income, whatIf.income],
    ['Outgoings', result.outgoings, whatIf.outgoings],
    ['Left over', result.leftover, whatIf.leftover],
  ]
  if (result.accounts.length > 1) figures.push(['Left in main account', result.accounts[0]!.left, whatIf.accounts[0]!.left])
  const rows = [
    ...figures.map(([label, a, b]) => ({
      label,
      base: signed(pick(a, view), gbp),
      next: signed(pick(b, view), gbp),
      change: formatGBPChange(subtract(pick(b, view), pick(a, view)), 'pence'),
    })),
    {
      label: 'Savings rate',
      base: shareText(result.savingsRate),
      next: shareText(whatIf.savingsRate),
      change:
        result.savingsRate && whatIf.savingsRate
          ? formatPointsChange(subtractRatio(whatIf.savingsRate, result.savingsRate))
          : NOT_APPLICABLE,
    },
  ]
  const cell = 'px-3 py-2 text-right tabular-nums'
  return (
    <section
      data-what-if-results
      aria-labelledby="bd-what-if-title"
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <h2 id="bd-what-if-title" className="text-base font-semibold text-text">
        Your inputs and your what-ifs, {IN_VIEW[view]}
      </h2>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (axe scrollable-region-focusable). */}
      <section tabIndex={0} aria-label="Your inputs and your what-ifs, as a table" className="overflow-x-auto">
        <table className="w-full text-sm text-text">
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                <span className="sr-only">Figure</span>
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Your inputs
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                What if
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {row.label}
                </th>
                <td className={cell}>{row.base}</td>
                <td className={cell}>{row.next}</td>
                <td className={`${cell} font-medium`}>{row.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  )
}

/** Each group with its share of your income, then outgoings, left over and income; the penny note in the month view (BD2). */
function GroupTable({
  result,
  view,
  gbp,
  drifts,
  whatIf,
}: {
  result: BudgetResult
  view: View
  gbp: Gbp
  drifts: boolean
  whatIf: boolean
}) {
  const cell = 'px-3 py-2 text-right tabular-nums whitespace-nowrap'
  const total = (label: string, figure: YearAndMonth & { share?: Ratio | null }) => (
    <tr className="border-t border-border-strong font-medium">
      <th scope="row" className="px-3 py-2 text-left">
        {label}
      </th>
      <td className={cell}>{signed(pick(figure, view), gbp)}</td>
      <td className={cell}>{figure.share === undefined ? '' : shareText(figure.share)}</td>
    </tr>
  )
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h2 id="bd-groups-title" className="text-base font-semibold text-text">
        By group, {IN_VIEW[view]}
        {whatIf ? ', with your what-ifs' : ''}
      </h2>
      <section
        aria-labelledby="bd-groups-title"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (axe scrollable-region-focusable).
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm"
      >
        <table data-group-table className="w-full border-collapse text-sm text-text">
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Group
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {capitalised(IN_VIEW[view])}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Of your income
              </th>
            </tr>
          </thead>
          <tbody>
            {result.perGroup.map((t) => (
              <tr key={t.group} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {GROUP_LABELS[t.group]}
                </th>
                <td className={cell}>{gbp(pick(t, view))}</td>
                <td className={cell}>{shareText(t.share)}</td>
              </tr>
            ))}
            {toPence(result.potSaved.year) > 0 && (
              <tr className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  Put aside in savings pots
                </th>
                <td className={cell}>{gbp(pick(result.potSaved, view))}</td>
                <td className={cell}>{shareText(result.potSaved.share)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {total('Outgoings', result.outgoings)}
            {total('Left over', result.leftover)}
            {total('Income', result.income)}
          </tfoot>
        </table>
      </section>
      {drifts && (
        <p data-penny-note className="text-xs text-text-muted">
          Each month figure is its yearly figure divided by the months, to the nearest penny, so the rows here and in the lines can differ
          from their total by a penny or two. The yearly figures add up exactly.
        </p>
      )}
    </div>
  )
}
