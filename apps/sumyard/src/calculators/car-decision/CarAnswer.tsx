import { type ReactNode, useState } from 'react'
import { IconTile } from '@/components/IconTile'
import { ResultCard } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { type Money, type Ratio, toPence } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AcquisitionKind, Comparison, ValueCase } from '../car-ownership/types'
import { CASE_LABELS, fieldList, type OptionStatus, VALUE_CASES } from './definition'
import { list, savingsSentence, scenarioTable, switchCosts, type Verdict } from './narrative'
import { optionSwatch } from './style'

/*
 * The answer first (session 3d-1; the redesign's CD5), at the top of the results column (sticky from md): the verdict as
 * the headline, each option's bar and the switch cost; and, in "How sure is this", each option in the low, expected and
 * high cases. Every sentence comes from ./narrative.ts on the engine's comparison; nothing here is worked out.
 */

type Gbp = (amount: Money) => string

/** One option in the ranked bars: its place in the editor (its colour) and its state. */
export interface RankRow {
  readonly index: number
  readonly name: string
  readonly kind: AcquisitionKind
  readonly status: OptionStatus
}

/** What stops an option having a figure, in a few words. */
const noFigure = (status: OptionStatus, kind: AcquisitionKind) =>
  status.kind === 'missing'
    ? `Needs ${fieldList(status.missing, kind).toLowerCase()}`
    : status.kind === 'held'
      ? 'Fix the highlighted input'
      : 'No results: see its inputs'

/**
 * The answer (CD5): the verdict's gap as the headline, emphasised, with the total and the savings return under it; one
 * bar per option, in the engine's order, of its average cost a month in its own colour (CD1); then the switch cost
 * against keeping and, when the options differ in the running costs left empty, which. Every figure is the engine's;
 * the bars only draw them. No verdict: the reason in full, no headline.
 */
export function AnswerCard({
  verdict,
  emptyNote,
  comparison,
  valueCase,
  names,
  rows,
  savingsReturn,
  table,
  gbp,
}: {
  verdict: Verdict
  emptyNote: string | null
  comparison: Comparison
  valueCase: ValueCase
  /** Names by engine index. */
  names: readonly string[]
  /** Every option, in the cards' order. */
  rows: readonly RankRow[]
  savingsReturn: Ratio
  /** The side-by-side table, behind "Show as a table". */
  table: ReactNode
  gbp: Gbp
}) {
  const switches = switchCosts(comparison, valueCase, names, gbp)
  const months = comparison.horizonMonths
  const caseWord = CASE_LABELS[valueCase].toLowerCase()
  const headline =
    verdict.kind === 'lowest'
      ? {
          label: `${list(verdict.lowest.map((o) => names[o]!))} against ${names[verdict.next]}`,
          figure: `${gbp(verdict.gapPerMonth)} a month less`,
          sentence: `${gbp(verdict.gapTotal)} less over ${months} months, on average cost per month owned. ${savingsSentence(savingsReturn)}`,
        }
      : verdict.kind === 'tie'
        ? { label: list(verdict.lowest.map((o) => names[o]!)), figure: 'The same cost', sentence: verdict.text }
        : null
  const ok = (row: RankRow) => (row.status.kind === 'ok' ? row.status : null)
  const largest = Math.max(
    0,
    ...rows.map((row) => {
      const status = ok(row)
      return status ? toPence(status.result.cases[valueCase].netCostPerCoverageMonth) : 0
    }),
  )
  const [tableOpen, setTableOpen] = useState(false)
  return (
    <ResultCard
      title="The answer"
      data-verdict-panel
      headline={headline?.figure}
      headlineLabel={headline?.label}
      emphasis={headline !== null}
      sentence={headline?.sentence}
      footer={
        <>
          {/* The verdict in full, as before: the screen reader's announcement and the place a reason is said. */}
          <p data-verdict data-verdict-kind={verdict.kind} className={headline ? 'sr-only' : 'text-base text-text'}>
            {verdict.text}
          </p>
          <div data-rank-bars className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text">Average cost per month owned, {caseWord} end value</h3>
            <ol className="flex flex-col">
              {rows.map((row) => {
                const status = ok(row)
                const perMonth = status ? status.result.cases[valueCase].netCostPerCoverageMonth : null
                const width = perMonth && largest > 0 ? Math.max(0, (toPence(perMonth) * 100) / largest) : 0
                const swatch = optionSwatch(row.index, row.kind)
                return (
                  <li
                    key={row.index}
                    data-rank-row={row.index}
                    className="flex flex-col gap-1 border-t border-border py-2 first:border-t-0"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <IconTile swatch={swatch} size="sm" />
                      <span className="min-w-0 flex-1 text-text [overflow-wrap:anywhere]">{row.name}</span>
                      <span className={cn('text-right tabular-nums', status ? 'font-semibold text-text' : 'text-xs text-text-muted')}>
                        {perMonth ? `${gbp(perMonth)} a month` : noFigure(row.status, row.kind)}
                      </span>
                    </span>
                    {status && (
                      <span aria-hidden="true" className="block h-2 rounded-full bg-surface-muted">
                        <span className={cn('block h-2 rounded-full', swatch.fill)} style={{ width: `${width}%` }} />
                      </span>
                    )}
                    {status && !status.result.fullCoverage && (
                      <span className="text-xs text-text-muted">
                        Covers {status.result.coverageMonths} of {months} months: not compared by total
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
            <Button
              variant="ghost"
              aria-expanded={tableOpen}
              aria-controls="cd-side-by-side"
              onClick={() => setTableOpen(!tableOpen)}
              className="self-start px-0 text-accent"
            >
              {tableOpen ? 'Hide the table' : 'Show as a table'}
            </Button>
            <div id="cd-side-by-side" hidden={!tableOpen}>
              {table}
            </div>
          </div>
          {emptyNote && (
            <p data-empty-costs-differ className="text-sm text-text-muted">
              {emptyNote}
            </p>
          )}
          {switches.length > 0 && (
            <ul data-switch-costs className="flex list-disc flex-col gap-1 pl-5 text-sm text-text">
              {switches.map((s) => (
                <li key={s.option} data-switch-cost>
                  {s.text}
                </li>
              ))}
            </ul>
          )}
        </>
      }
    />
  )
}

/** Each option's average cost per month owned in the low, expected and high cases, and whether the lowest changes. */
export function ScenarioTable({
  comparison,
  valueCase,
  names,
  gbp,
}: {
  comparison: Comparison
  valueCase: ValueCase
  names: readonly string[]
  gbp: Gbp
}) {
  const table = scenarioTable(comparison, names)
  const cell = 'px-3 py-2 text-right tabular-nums whitespace-nowrap'
  return (
    <section
      data-scenarios
      aria-labelledby="cd-scenarios-title"
      className="flex min-w-0 flex-col gap-3 text-sm text-text [overflow-wrap:anywhere]"
    >
      <h3 id="cd-scenarios-title" className="text-sm font-semibold">
        Low, expected and high end values
      </h3>
      <p data-scenario-sentence>{table.sentence}</p>
      <section
        aria-label="Each option in the three cases, as a table"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (axe scrollable-region-focusable).
        tabIndex={0}
        className="relative overflow-x-auto rounded-lg border border-border outline-offset-2"
      >
        <table data-scenario-table className="w-full border-collapse">
          <caption className="sr-only">Average cost per month owned for each option in each end-value case</caption>
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                Option
              </th>
              {VALUE_CASES.map((c) => (
                <th key={c} scope="col" className={`${cell} font-medium`}>
                  {CASE_LABELS[c]}
                  {c === valueCase && <span className="sr-only"> (shown)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.option} className="border-t border-border">
                <th scope="row" className="max-w-40 px-3 py-2 text-left font-normal [overflow-wrap:anywhere]">
                  {row.name}
                  {!row.fullCoverage && (
                    <span className="block text-xs text-text-muted">
                      Covers {row.coverageMonths} of {comparison.horizonMonths} months: not compared
                    </span>
                  )}
                </th>
                {VALUE_CASES.map((c) => (
                  <td key={c} className={`${cell} ${c === valueCase ? 'font-semibold' : ''}`}>
                    {gbp(row.perMonth[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-text-muted">Average cost per month owned. The case shown is in bold.</p>
    </section>
  )
}
