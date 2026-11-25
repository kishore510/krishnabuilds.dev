import {
  csvText,
  plainPounds,
  SHARE_FOOTER,
  type ShareModel,
  type ShareOptions,
  type SharePart,
  type ShareTile,
  shareWhen,
} from '@/components/share/model'
import { formatGBP, formatPercent } from '@/lib/format'
import { compare, type Money, ratio, subtract, toPence, ZERO } from '@/lib/money'
import type { AmountStyle } from '@/settings/settings'
import type { OwnershipResult } from '../car-ownership/types'
import { ACQUISITION_LABELS, CASE_LABELS, type CarDecisionInputs, hasRange, type PageOutcome } from './definition'
import { list, switchCosts, type Verdict } from './narrative'
import { COST_PART_LABELS, costParts } from './setup'
import { PART_TOKENS } from './style'

/*
 * What a shared car decision says (the redesign's CD9, as BD16, TH5 and MD3): the lowest average cost per month owned
 * and the gap to the next option, each option's cost a month and over the horizon, and where the lowest option's money
 * goes, each part beside every option's figure; the switch cost against keeping. Not shared: prices, finance terms,
 * running costs typed, the thresholds or the chart. Amounts off: each option as a percentage above the lowest a month,
 * and each part as a share of its option's total; no pound figure anywhere. Option names off: each option by how the
 * car is had, numbered if two are the same. Figures are the engine's, formatted; nothing is worked out again but the
 * percentages. Made on the device; nothing is sent anywhere.
 */

export interface CarShare {
  readonly outcome: Extract<PageOutcome, { kind: 'ok' }>
  readonly inputs: CarDecisionInputs
  readonly verdict: Verdict
  /** The page's names by engine index. */
  readonly names: readonly string[]
}

type Gbp = (amount: Money) => string

/** Part names short enough for the image card. */
const SHORT_LABELS: Partial<Record<keyof typeof COST_PART_LABELS, string>> = { lostInterest: 'Interest on your cash' }

/** A part over a whole, as a percentage to one place; n/a when the whole is nothing or below. */
const shareOf = (part: Money, whole: Money) => (toPence(whole) <= 0 ? 'n/a' : formatPercent(ratio(toPence(part), toPence(whole)), 1))

/** How far above the lowest a month an option is, as a percentage; "Lowest" for the lowest itself. */
function aboveLowest(perMonth: Money, lowest: Money): string {
  const gap = subtract(perMonth, lowest)
  if (compare(gap, ZERO) === 0) return 'Lowest'
  if (toPence(lowest) <= 0) return 'n/a'
  return `${compare(gap, ZERO) > 0 ? '+' : ''}${formatPercent(ratio(toPence(gap), toPence(lowest)), 1)}`
}

/** Names as the options say: the page's, or how each car is had, numbered when two are the same. */
function namesFor(s: CarShare, options: ShareOptions): string[] {
  const results = s.outcome.comparison!.options
  if (options.names) return [...s.names]
  const kinds = results.map((r) => ACQUISITION_LABELS[r.acquisition])
  return kinds.map((kind, i) =>
    kinds.filter((k) => k === kind).length > 1 ? `${kind} ${kinds.slice(0, i + 1).filter((k) => k === kind).length}` : kind,
  )
}

const perMonthOf = (result: OwnershipResult, s: CarShare) => result.cases[s.inputs.valueCase].netCostPerCoverageMonth

/** The engine index of the lowest full-coverage option, or the first costed one when none covers the horizon. */
function lowestIndex(s: CarShare): number {
  const ranking = s.outcome.comparison!.ranking[s.inputs.valueCase]
  return ranking.full[0]?.option ?? ranking.partial[0]?.option ?? 0
}

function headline(s: CarShare, names: readonly string[], options: ShareOptions, gbp: Gbp) {
  const v = s.verdict
  const comparison = s.outcome.comparison!
  if (v.kind === 'lowest') {
    const lowest = list(v.lowest.map((o) => names[o]!))
    const next = names[v.next]!
    const sentence = options.amounts
      ? `${gbp(v.gapPerMonth)} a month less than ${next}`
      : `${next} costs ${aboveLowest(perMonthOf(comparison.options[v.next]!, s), perMonthOf(comparison.options[v.lowest[0]!]!, s)).replace('+', '')} more a month`
    return { label: 'Lowest average cost per month owned', value: lowest, sentence }
  }
  if (v.kind === 'tie')
    return { label: 'The same average cost per month owned', value: list(v.lowest.map((o) => names[o]!)), sentence: 'Tied' }
  return { label: 'No verdict', value: 'Not compared', sentence: v.text.replace(/ It uses a savings return.*$/, '') }
}

export function shareModel(s: CarShare, options: ShareOptions, style: AmountStyle, now: Date): ShareModel {
  const gbp = (amount: Money) => formatGBP(amount, style)
  const comparison = s.outcome.comparison!
  const valueCase = s.inputs.valueCase
  const names = namesFor(s, options)
  const months = comparison.horizonMonths
  const low = lowestIndex(s)
  const lowestPerMonth = perMonthOf(comparison.options[low]!, s)
  const order = [...comparison.ranking[valueCase].full, ...comparison.ranking[valueCase].partial].map((e) => e.option)
  const tiles: ShareTile[] = order.map((o) => {
    const result = comparison.options[o]!
    const covers = result.fullCoverage ? '' : `; covers ${result.coverageMonths} of ${months} months`
    return {
      name: names[o]!,
      value: options.amounts ? `${gbp(perMonthOf(result, s))} a month` : aboveLowest(perMonthOf(result, s), lowestPerMonth),
      note: `${options.amounts ? `${gbp(result.cases[valueCase].netCost)} in all` : ACQUISITION_LABELS[result.acquisition]}${covers}`,
      short: false,
    }
  })
  const lowestParts = costParts(comparison.options[low]!.cases[valueCase].breakdown)
  const lowestTotal = comparison.options[low]!.cases[valueCase].netCost
  const parts: SharePart[] = lowestParts
    .filter((p) => compare(p.value, ZERO) > 0)
    .map((p) => ({
      id: p.id,
      label: SHORT_LABELS[p.id] ?? p.label,
      colour: PART_TOKENS[p.id],
      year: toPence(p.value),
      value: options.amounts ? gbp(p.value) : shareOf(p.value, lowestTotal),
      lines: order
        .filter((o) => o !== low)
        .map((o) => {
          const other = costParts(comparison.options[o]!.cases[valueCase].breakdown).find((q) => q.id === p.id)!
          const total = comparison.options[o]!.cases[valueCase].netCost
          return { key: o, name: names[o]!, value: options.amounts ? gbp(other.value) : shareOf(other.value, total) }
        }),
    }))
  const said = headline(s, names, options, gbp)
  // Short for the card: the option switched to and its cost a month against keeping.
  const switches = options.amounts
    ? switchCosts(comparison, valueCase, names, gbp).map((x) =>
        x.direction === 'same' ? `${names[x.option]}: the same` : `${names[x.option]}: ${gbp(x.perMonth)} a month ${x.direction}`,
      )
    : []
  const anyRange = s.inputs.options.some(hasRange)
  return {
    title: anyRange ? `Car decision, ${CASE_LABELS[valueCase].toLowerCase()} end value` : 'Car decision',
    when: shareWhen(now),
    period: `over ${months} months`,
    headlineLabel: said.label,
    headline: said.value,
    negative: false,
    sentence: said.sentence,
    stats: [
      { label: 'Compared over', value: `${months} months` },
      ...(options.amounts && s.verdict.kind === 'lowest'
        ? [{ label: `Less than ${names[s.verdict.next]} in all`, value: gbp(s.verdict.gapTotal) }]
        : []),
      { label: 'Options', value: String(comparison.options.length) },
    ],
    partsTitle: `Where ${names[low]}’s money goes${options.amounts ? '' : ' (share of its cost)'}`,
    parts,
    total: parts.reduce((t, p) => t + p.year, 0),
    tilesTitle: options.amounts ? 'Average cost per month owned' : 'Above the lowest, a month',
    tiles,
    biggestTitle: 'Switching against keeping, a month',
    biggest: switches,
    footer: SHARE_FOOTER,
    printNote:
      'Uses no tax rules. Average cost per month owned is everything paid, less what the car is worth at the end after anything owed, plus the interest the cash could have earned, over the months owned.',
  }
}

/** Each option's average cost a month, total and parts. Amounts off: each option above the lowest and parts as shares. */
export function shareCsv(s: CarShare, options: ShareOptions): string {
  const comparison = s.outcome.comparison!
  const valueCase = s.inputs.valueCase
  const names = namesFor(s, options)
  const order = [...comparison.ranking[valueCase].full, ...comparison.ranking[valueCase].partial].map((e) => e.option)
  const lowestPerMonth = perMonthOf(comparison.options[lowestIndex(s)]!, s)
  const rows = [['Figure', ...order.map((o) => names[o]!)].map(csvText).join(',')]
  const row = (label: string, cell: (o: number) => string) => rows.push([csvText(label), ...order.map(cell)].join(','))
  if (options.amounts) {
    row('Average cost per month owned', (o) => plainPounds(perMonthOf(comparison.options[o]!, s)))
    row('Total net cost', (o) => plainPounds(comparison.options[o]!.cases[valueCase].netCost))
  } else {
    row('Above the lowest, a month', (o) => csvText(aboveLowest(perMonthOf(comparison.options[o]!, s), lowestPerMonth)))
  }
  row('Months covered', (o) => String(comparison.options[o]!.coverageMonths))
  for (const id of Object.keys(COST_PART_LABELS) as (keyof typeof COST_PART_LABELS)[]) {
    row(options.amounts ? COST_PART_LABELS[id] : `${COST_PART_LABELS[id]} (of its total)`, (o) => {
      const c = comparison.options[o]!.cases[valueCase]
      const part = costParts(c.breakdown).find((p) => p.id === id)!
      return options.amounts ? plainPounds(part.value) : csvText(shareOf(part.value, c.netCost))
    })
  }
  return `${rows.join('\r\n')}\r\n`
}
