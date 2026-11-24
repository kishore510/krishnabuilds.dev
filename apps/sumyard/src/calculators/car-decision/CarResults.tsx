import { type ReactNode, useState } from 'react'
import { IconTile } from '@/components/IconTile'
import { RefusalNotice } from '@/components/RefusalNotice'
import { ResultCard, StatRow } from '@/components/ResultCard'
import { InlineNotice } from '@/components/states'
import { Button } from '@/components/ui/button'
import { formatPercent, formatPercentFixed } from '@/lib/format'
import { CARD_LARGEST_PARTS } from '@/lib/inputLimits'
import { APR_DISPLAY_DIGITS, compare, type ExactPence, type Money, toPence, ZERO } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AcquisitionKind, Flip, FlipPoints, FuelCost, ValueCase } from '../car-ownership/types'
import { CASE_LABELS, type CarDecisionInputs, coverageText, fieldList, type OptionInputs, type OptionStatus } from './definition'
import { emptyRunningCosts, emptyRunningText, moneyFlows } from './narrative'
import { type RateShown, rateShown } from './rates'
import { equityAtHorizon, type FlipSentence, flipSentences, fuelSentence, isNegative, pairNames } from './results'
import { COST_PART_LABELS, type CostPart, costParts } from './setup'
import { type CostPartId, optionSwatch, PART_SWATCHES } from './style'

/*
 * The car decision's results (slice 3c-1; the redesign's CD6 and CD7), every figure the engine's:
 *
 * - "Where the money goes": a bar per option split into its cost parts, each part in its own colour and icon, with a
 *   table of every part; then a slim card per option (cost a month, the total, its largest parts, money in and out);
 * - the side-by-side table, behind "Show as a table" under the answer's bars;
 * - "What changes the answer": the flip points between a pair of options as threshold sentences.
 *
 * The words are "lowest net cost under these assumptions": no option is
 * called anything stronger, and nothing tells anyone what to do.
 */

type Gbp = (amount: Money) => string

export interface CardData {
  readonly index: number
  readonly name: string
  readonly kind: AcquisitionKind
  readonly status: OptionStatus
  /** The option's inputs: which optional boxes are left empty (3d-1 fix). */
  readonly inputs: OptionInputs
}

type Ok = Extract<OptionStatus, { kind: 'ok' }>

/**
 * The figures a card and the side-by-side table both show, worked out once so each table cell reads exactly as its card
 * does (3d-1 fix).
 */
function measures(status: Ok, valueCase: ValueCase, gbp: Gbp) {
  const { result } = status
  const c = result.cases[valueCase]
  const equity = equityAtHorizon(result, valueCase)
  return {
    perMonth: gbp(c.netCostPerCoverageMonth),
    total: gbp(c.netCost),
    coverage: coverageText(result),
    equity: equity === null ? 'Nothing: handed back' : gbp(equity),
    cashOut: gbp(c.cashOut),
    opportunity: gbp(c.breakdown.opportunityCost),
  }
}

/** Percentage places an APR is shown to: the engine's display digits less the two a percentage takes. */
const APR_PLACES = APR_DISPLAY_DIGITS - 2

const RATE_TEST: Record<RateShown['kind'], string> = { apr: 'apr', effective: 'effective', implied: 'implied', none: 'none' }

/** The rate an ok option shows, from its engine option and result. */
function rateFor(status: Ok): RateShown | null {
  return rateShown(status.option.acquisition, status.result.finance)
}

/** An APR to one fixed decimal place (F15: the engine's display rounding), an effective rate to two at most. */
const rateText = (shown: Exclude<RateShown, { kind: 'none' }>) =>
  shown.kind === 'apr' ? formatPercentFixed(shown.rate, APR_PLACES) : formatPercent(shown.rate)

function Rate({ shown }: { shown: RateShown }) {
  return (
    <p data-rate data-rate-kind={RATE_TEST[shown.kind]} className="flex flex-col text-sm text-text">
      {shown.kind === 'none' ? (
        <span>{shown.why}</span>
      ) : (
        <>
          <span>
            <span className="text-text-muted">{shown.label}:</span>{' '}
            <span data-rate-value className="font-medium tabular-nums">
              {rateText(shown)}
            </span>
          </span>
          {shown.kind === 'implied' && <span className="text-xs text-text-muted">{shown.why}</span>}
          {shown.kind === 'effective' && (
            <>
              <span className="text-xs text-text-muted">{shown.why}</span>
              <span data-rate-fees className="text-xs text-text-muted">
                {shown.fees}
              </span>
            </>
          )}
        </>
      )}
    </p>
  )
}

/**
 * One option's card (U16): the headline average cost per month owned (the engine's net cost per month of coverage), the
 * largest part of it, the total, coverage, equity, cash out, opportunity cost, the breakdown, then the money that changes
 * hands, apart from the cost (3d-1).
 */
function OptionCard({ card, valueCase, gbp }: { card: CardData; valueCase: ValueCase; gbp: Gbp }) {
  const { status, name, index } = card
  const props = {
    title: name,
    heading: 'h3' as const,
    'data-option-card': '',
    'data-option-index': index,
    className: 'relative min-w-0 p-4',
  }
  if (status.kind !== 'ok') {
    return (
      <ResultCard
        {...props}
        footer={
          status.kind === 'missing' ? (
            <div data-card-missing>
              <InlineNotice title="Needs inputs">
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {status.missing.map((field) => (
                    <li key={field}>
                      <span className="font-medium">{fieldList([field], card.kind)}:</span> needed for this option’s figures.
                    </li>
                  ))}
                </ul>
              </InlineNotice>
            </div>
          ) : status.kind === 'held' ? (
            <div data-card-invalid>
              <InlineNotice tone="warning">
                <p>Fix the highlighted input in this option to see its figures.</p>
              </InlineNotice>
            </div>
          ) : (
            <RefusalNotice refusal={status.refusal} heading="h3" />
          )
        }
      ></ResultCard>
    )
  }
  return <OkCard status={status} index={index} inputs={card.inputs} valueCase={valueCase} gbp={gbp} props={props} />
}

/** An option's parts above nothing, largest first. */
const largestParts = (parts: readonly CostPart[]) =>
  parts.filter((p) => compare(p.value, ZERO) > 0).sort((a, b) => compare(b.value, a.value))

function OkCard({
  status,
  index,
  inputs,
  valueCase,
  gbp,
  props,
}: {
  status: Ok
  index: number
  inputs: OptionInputs
  valueCase: ValueCase
  gbp: Gbp
  props: Record<string, unknown> & { title: string; heading: 'h3' }
}) {
  const { result } = status
  const c = result.cases[valueCase]
  const equity = equityAtHorizon(result, valueCase)
  const shown = rateFor(status)
  const largest = largestParts(costParts(c.breakdown)).slice(0, CARD_LARGEST_PARTS)
  const empty = emptyRunningText(emptyRunningCosts(inputs))
  const shownAs = measures(status, valueCase, gbp)
  return (
    <ResultCard
      {...props}
      headline={shownAs.perMonth}
      headlineLabel="Average cost per month owned"
      sentence={
        <span className={cn('inline-block h-1 w-10 rounded-full', optionSwatch(index, result.acquisition).fill)} aria-hidden="true" />
      }
      footer={
        <>
          {!result.fullCoverage && (
            <div data-coverage-flag>
              <InlineNotice tone="warning" title={`Covers only ${coverageText(result)}`}>
                <p>
                  The car is handed back at the end of the term and no replacement is modelled, so the months after are not covered. It is
                  not ordered against options that cover the whole horizon.
                </p>
              </InlineNotice>
            </div>
          )}
          {result.acquisition === 'keep' && isNegative(result.forgoneSale) && (
            <div data-negative-equity-now>
              <InlineNotice tone="warning" title="Negative equity now">
                <p>
                  The settlement figure is more than the car is worth today, so selling it now would not clear the finance. That shortfall
                  counts as a sale given up below nothing.
                </p>
              </InlineNotice>
            </div>
          )}
          {equity !== null && isNegative(equity) && (
            <div data-negative-equity>
              <InlineNotice tone="warning" title="Negative equity at the horizon">
                <p>More is still owed on the car than it is worth then, in this case.</p>
              </InlineNotice>
            </div>
          )}
          {empty && (
            <p data-empty-costs className="text-sm text-text">
              {empty}
            </p>
          )}
          {shown && <Rate shown={shown} />}
          <MoneyFlowRows status={status} valueCase={valueCase} gbp={gbp} />
        </>
      }
    >
      <StatRow label="Total net cost" value={shownAs.total} detail={`Over ${result.horizonMonths} months`} marker="total" />
      {!result.fullCoverage && <StatRow label="Covers" value={shownAs.coverage} marker="coverage" />}
      {largest.map((part) => (
        <StatRow
          key={part.id}
          label={part.label}
          value={gbp(part.value)}
          marker={`part-${part.id}`}
          icon={<IconTile swatch={PART_SWATCHES[part.id]} size="sm" />}
        />
      ))}
      <StatRow
        label="Yours at the end"
        value={shownAs.equity}
        detail="What the car is worth then, less anything still owed on it"
        marker="equity"
      />
    </ResultCard>
  )
}

const UPFRONT_DETAIL: Record<AcquisitionKind, string> = {
  keep: 'None: its value counts as a sale given up, not cash',
  cash: 'The price, at the start',
  loan: 'What the loan doesn’t cover, and any fee then',
  'hire-purchase': 'The deposit and any fee then',
  pcp: 'The deposit and any fee then',
}

const UPFRONT_OWING = 'None: what a sale would leave after clearing the finance counts as a sale given up, not cash'

/** The money that changes hands (3d-1), apart from the net cost: upfront, monthly and at the end. */
function MoneyFlowRows({ status, valueCase, gbp }: { status: Ok; valueCase: ValueCase; gbp: Gbp }) {
  const { result } = status
  const flows = moneyFlows(status.option, result)
  const kind = result.acquisition
  const owing = kind === 'keep' && result.finance !== null
  const feeName = kind === 'hire-purchase' ? 'option to purchase fee' : 'purchase fee'
  const { monthly, final } = flows
  const monthlyDetail = monthly
    ? [
        `${monthly.payments} payment${monthly.payments === 1 ? '' : 's'}${owing ? ' left' : ''}`,
        // Only when it shows differently: a last payment pennies apart reads the same in whole pounds.
        gbp(monthly.last) !== gbp(monthly.amount) ? `the last ${gbp(monthly.last)}` : null,
        monthly.payments > result.horizonMonths ? `${result.horizonMonths} of them within the horizon` : null,
      ]
        .filter(Boolean)
        .join('; ')
    : ''
  const finalDetail = final
    ? [
        `Due at month ${final.month}${compare(final.fee, ZERO) > 0 ? `, with a ${gbp(final.fee)} ${feeName}` : ''}`,
        final.withinHorizon ? '' : ', after the horizon: what is still owed then is taken off the car’s value here',
      ].join('')
    : ''
  return (
    <div data-money-flows className="flex flex-col gap-1 border-t border-border pt-3">
      <h4 className="text-sm font-semibold text-text">Money in and out</h4>
      <p className="text-xs text-text-muted">The cash that changes hands, apart from the cost above.</p>
      <dl className="flex flex-col">
        <StatRow
          label="Cash paid out"
          value={gbp(result.cases[valueCase].cashOut)}
          detail="Everything paid over the months covered"
          marker="cash-out"
        />
        <StatRow label="Upfront cash" value={gbp(flows.upfront)} detail={owing ? UPFRONT_OWING : UPFRONT_DETAIL[kind]} marker="upfront" />
        {monthly && <StatRow label="Monthly payment" value={`${gbp(monthly.amount)} a month`} detail={monthlyDetail} marker="monthly" />}
        {final && <StatRow label="Final payment due at the end" value={gbp(final.amount)} detail={finalDetail} marker="final" />}
      </dl>
    </div>
  )
}

/** The grid's columns from md for one to four cards, by count. */
const GRID_COLUMNS = ['', 'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-2 lg:grid-cols-3', 'md:grid-cols-2 xl:grid-cols-4']

/**
 * "Where the money goes" (CD6): a bar per costed option, its parts above nothing side by side in their colours, scaled to
 * the largest so bars compare; parts below nothing said under it; a key of the parts shown; every part as a table; then
 * a slim card per option, in the cards' order.
 */
export function CostSection({ cards, valueCase, gbp }: { cards: readonly CardData[]; valueCase: ValueCase; gbp: Gbp }) {
  const [tableOpen, setTableOpen] = useState(false)
  const costed = cards.flatMap((card) => (card.status.kind === 'ok' ? [{ card, status: card.status }] : []))
  const rows = costed.map(({ card, status }) => ({ card, status, parts: costParts(status.result.cases[valueCase].breakdown) }))
  const above = (parts: readonly CostPart[]) => parts.filter((p) => compare(p.value, ZERO) > 0)
  const sum = (parts: readonly CostPart[]) => parts.reduce((t, p) => t + toPence(p.value), 0)
  const widest = Math.max(0, ...rows.map((r) => sum(above(r.parts))))
  const used = (Object.keys(COST_PART_LABELS) as CostPartId[]).filter((id) =>
    rows.some((r) => compare(r.parts.find((p) => p.id === id)!.value, ZERO) !== 0),
  )
  const caseWord = CASE_LABELS[valueCase].toLowerCase()
  return (
    <div data-cost-section className="flex min-w-0 flex-col gap-4">
      {rows.length > 0 && (
        <div data-cost-bars className="flex min-w-0 flex-col gap-3">
          <p className="text-sm text-text-muted">
            Each option’s total net cost over the horizon, {caseWord} end value, split into its parts.
          </p>
          <ul className="flex flex-col gap-3">
            {rows.map(({ card, status, parts }) => {
              const below = parts.filter((p) => compare(p.value, ZERO) < 0)
              return (
                <li key={card.index} data-cost-bar={card.index} className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm">
                    <IconTile swatch={optionSwatch(card.index, card.kind)} size="sm" />
                    <span className="min-w-0 flex-1 text-text [overflow-wrap:anywhere]">{card.name}</span>
                    <span className="font-semibold text-text tabular-nums">{gbp(status.result.cases[valueCase].netCost)}</span>
                  </span>
                  <span aria-hidden="true" className="flex h-4 w-full overflow-hidden rounded-sm bg-surface-muted">
                    {above(parts).map((p) => (
                      <span
                        key={p.id}
                        className={cn('h-4 border-r-2 border-surface last:border-r-0', PART_SWATCHES[p.id].fill)}
                        style={{ width: `${widest > 0 ? (toPence(p.value) * 100) / widest : 0}%` }}
                      />
                    ))}
                  </span>
                  {below.length > 0 && (
                    <span className="text-xs text-text-muted">
                      Less {below.map((p) => `${p.label.toLowerCase()} ${gbp(p.value)}`).join(', ')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <ul aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text">
            {used.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <IconTile swatch={PART_SWATCHES[id]} size="sm" />
                {COST_PART_LABELS[id]}
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            aria-expanded={tableOpen}
            aria-controls="cd-parts-table"
            onClick={() => setTableOpen(!tableOpen)}
            className="self-start px-0 text-accent"
          >
            {tableOpen ? 'Hide the table' : 'Show as a table'}
          </Button>
          <div id="cd-parts-table" hidden={!tableOpen}>
            <section
              aria-label="Each option’s cost parts, as a table"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (axe scrollable-region-focusable).
              tabIndex={0}
              className="relative overflow-x-auto rounded-lg border border-border"
            >
              <table data-parts-table className="w-full border-collapse text-sm text-text">
                <caption className="sr-only">Each option’s cost parts over the horizon, {caseWord} end value</caption>
                <thead>
                  <tr className="text-text-muted">
                    <th scope="col" className={`${FIRST_COLUMN} font-medium`}>
                      Part
                    </th>
                    {rows.map(({ card }) => (
                      <th
                        key={card.index}
                        scope="col"
                        className="min-w-28 max-w-48 px-3 py-2 text-right font-medium [overflow-wrap:anywhere]"
                      >
                        {card.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(COST_PART_LABELS) as CostPartId[]).map((id) => (
                    <tr key={id} className="border-t border-border">
                      <th scope="row" className={`${FIRST_COLUMN} font-normal`}>
                        {COST_PART_LABELS[id]}
                      </th>
                      {rows.map(({ card, parts }) => (
                        <td key={card.index} className={CELL}>
                          {gbp(parts.find((p) => p.id === id)!.value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold">
                    <th scope="row" className={FIRST_COLUMN}>
                      Total net cost
                    </th>
                    {rows.map(({ card, status }) => (
                      <td key={card.index} className={CELL}>
                        {gbp(status.result.cases[valueCase].netCost)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </section>
            <p className="mt-2 text-xs text-text-muted">Running costs are insurance, maintenance, VED and other costs together.</p>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        <h3 id="cd-cards-title" className="text-sm font-semibold text-text">
          Each option
        </h3>
        <div data-cards className={cn('grid items-start gap-3', GRID_COLUMNS[cards.length])}>
          {cards.map((card) => (
            <OptionCard key={card.index} card={card} valueCase={valueCase} gbp={gbp} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** A table's figure cell, one line, a minimum width (U36). */
const CELL = 'min-w-28 px-3 py-2 text-right tabular-nums whitespace-nowrap'
/** A table's first column, opaque over the figures scrolling under it, narrow, its labels wrapping (U36). */
const FIRST_COLUMN = 'sticky left-0 z-10 w-32 min-w-32 bg-surface px-3 py-2 text-left'

/** The cards' figures as a table (U17), the accessible equivalent: a column per option in the cards' order. */
export function CompareTable({ cards, valueCase, gbp }: { cards: readonly CardData[]; valueCase: ValueCase; gbp: Gbp }) {
  // Each option's column keeps a minimum width and its figures on one line, so with the first column sticky every figure
  // can be scrolled fully into view on a phone (3d-1 fix).
  const cell = 'min-w-28 px-3 py-2 text-right tabular-nums whitespace-nowrap'
  // The first column is opaque over the figures scrolling under it, narrow enough to leave room for them, its labels wrapping.
  const first = 'sticky left-0 z-10 w-32 min-w-32 bg-surface px-3 py-2 text-left'
  const ok = (card: CardData) => (card.status.kind === 'ok' ? card.status : null)
  const none = (card: CardData) =>
    card.status.kind === 'missing' ? 'Inputs missing' : card.status.kind === 'held' ? 'Input to fix' : 'No results'
  const shown = (key: keyof ReturnType<typeof measures>) => (card: CardData) => {
    const status = ok(card)
    return status ? measures(status, valueCase, gbp)[key] : none(card)
  }
  const rows: [string, (card: CardData) => ReactNode][] = [
    ['Average cost per month owned', shown('perMonth')],
    ['Total net cost', shown('total')],
    ['Coverage', shown('coverage')],
    ['Yours at the end', shown('equity')],
    ['Cash paid out', shown('cashOut')],
    ['Interest your cash could have earned', shown('opportunity')],
    [
      'Rate',
      (card) => {
        const status = ok(card)
        const rate = status ? rateFor(status) : null
        if (!rate) return status ? 'No finance' : none(card)
        if (rate.kind === 'none') return 'None'
        return (
          <>
            <span data-rate-value>{rateText(rate)}</span> {rate.kind === 'apr' ? 'APR' : 'effective'}
          </>
        )
      },
    ],
  ]
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <section
        aria-label="The options side by side"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (axe scrollable-region-focusable).
        tabIndex={0}
        className="relative overflow-x-auto rounded-lg border border-border bg-surface"
      >
        <table data-compare-table className="w-full border-collapse text-sm text-text">
          <caption className="sr-only">
            Each option’s figures in the {CASE_LABELS[valueCase].toLowerCase()} case, in the engine’s order
          </caption>
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className={`${first} font-medium`}>
                Measure
              </th>
              {cards.map((card) => (
                <th key={card.index} scope="col" className="min-w-28 max-w-48 px-3 py-2 text-right font-medium [overflow-wrap:anywhere]">
                  {card.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-border">
                <th scope="row" className={`${first} font-normal`}>
                  {label}
                </th>
                {cards.map((card) => (
                  <td key={card.index} className={cell}>
                    {value(card)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export type FlipState =
  | { readonly kind: 'no-pair' }
  | { readonly kind: 'same' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'ready'
      readonly pair: readonly [number, number]
      readonly flips: FlipPoints
      readonly lowest: boolean
      /** The first option's fuel or energy price threshold (F54) and its fuel; null while it is worked out, a step after the rest. */
      readonly fuel: { readonly flip: Flip<ExactPence>; readonly fuel: FuelCost } | null
    }

/**
 * "What changes the answer" (F22): the flip points for a pair of options (by default the two lowest; `picker` chooses
 * another), once worked out, then the first option's fuel or energy price threshold (F54), and that they are measured
 * over the whole horizon.
 */
export function WhatChanges({ state, inputs, gbp, picker }: { state: FlipState; inputs: CarDecisionInputs; gbp: Gbp; picker?: ReactNode }) {
  let body: ReactNode
  if (state.kind === 'no-pair')
    body = <p>Thresholds need two options that cover the whole horizon with results. Each option says what it still needs.</p>
  else if (state.kind === 'same') body = <p>Choose two different options to see the thresholds between them.</p>
  else if (state.kind === 'pending') body = <p>Working out the thresholds once the inputs settle…</p>
  else if (state.kind === 'refused') body = <p>The thresholds can’t be worked out for these inputs.</p>
  else {
    const names = pairNames(inputs, state.pair)
    const sentences: FlipSentence[] = flipSentences(state.flips, names, gbp)
    body = (
      <>
        <p>
          Between {names[0]} and {names[1]}
          {state.lowest ? ', the two lowest average costs per month owned,' : ','} in the {CASE_LABELS[inputs.valueCase].toLowerCase()}{' '}
          case. Each line changes one thing.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {sentences.map((s) => (
            <li key={s.id} data-flip={s.id}>
              {s.text}
            </li>
          ))}
          {state.fuel ? (
            <li data-flip="fuel">{fuelSentence(state.fuel.flip, state.fuel.fuel, names).text}</li>
          ) : (
            <li data-flip-pending>Working out the fuel or energy price threshold…</li>
          )}
        </ul>
      </>
    )
  }
  return (
    <section
      data-flips
      aria-labelledby="cd-flips-title"
      // A long unbroken option name wraps instead of widening the page.
      className="flex min-w-0 flex-col gap-3 text-sm text-text [overflow-wrap:anywhere]"
    >
      <h3 id="cd-flips-title" className="text-sm font-semibold">
        Thresholds
      </h3>
      {picker}
      {state.kind !== 'no-pair' && (
        <p data-flips-measured className="text-text-muted">
          Measured over the whole horizon, to month {inputs.horizonMonths}, whatever month the chart shows: each threshold is where the two
          average costs per month owned are equal at the end.
        </p>
      )}
      {body}
    </section>
  )
}
