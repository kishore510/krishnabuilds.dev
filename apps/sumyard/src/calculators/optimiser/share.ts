import {
  csvText,
  plainPounds,
  SHARE_FOOTER,
  type ShareModel,
  type ShareOptions,
  type SharePart,
  shareWhen,
  shareFileName as stemFileName,
} from '@/components/share/model'
import { formatGBP, formatPercent } from '@/lib/format'
import { type Money, ratio, subtract, toPence } from '@/lib/money'
import type { AmountStyle } from '@/settings/settings'
import type { Breakdown } from './breakdown'
import { SPLIT_LABELS, SPLIT_SEGMENTS, type SplitSegmentId, splitSegments } from './results'
import { PAY_TOKENS } from './style'

/*
 * What a shared take-home says (TH5): the headline, where gross pay goes and the breakdown for the chosen period, with
 * the tax year and region. Not shared: benefit and deduction item names, the tax code, the pension compare. Amounts off:
 * every figure as a share of gross pay and no pound figure anywhere (TH4). Figures are the engine's, formatted; nothing
 * is worked out again. Made on the device; nothing is sent anywhere.
 */

export interface TakeHomeShare {
  /** The year's and a month's breakdown; `period` picks which the image, text and print page show. */
  readonly year: Breakdown
  readonly month: Breakdown
  readonly period: 'year' | 'month'
  /** The tax year, as labelled. */
  readonly taxYear: string
  /** Where the person lives, as the page's short label. */
  readonly region: string
}

const PERIOD_WORDS = { year: 'for the year', month: 'a month' } as const

const shareOf = (part: Money, gross: Money) => (toPence(gross) <= 0 ? 'n/a' : formatPercent(ratio(toPence(part), toPence(gross)), 1))

const amounts = (b: Breakdown): Record<SplitSegmentId, Money> =>
  Object.fromEntries(splitSegments(b).map((s) => [s.id, s.amount])) as Record<SplitSegmentId, Money>

export function shareModel(s: TakeHomeShare, options: ShareOptions, style: AmountStyle, now: Date): ShareModel {
  const gbp = (amount: Money) => formatGBP(amount, style)
  const shown = s.period === 'year' ? s.year : s.month
  const ratios = s.year
  const value = (id: SplitSegmentId, amount: Money) => (options.amounts ? gbp(amount) : shareOf(amounts(ratios)[id], ratios.gross))
  const negative = toPence(shown.takeHome) < 0
  const parts: SharePart[] = splitSegments(shown)
    .filter((p) => toPence(p.amount) > 0)
    .map((p) => ({ id: p.id, label: p.label, colour: PAY_TOKENS[p.id], year: toPence(p.amount), value: value(p.id, p.amount), lines: [] }))
  const takenOff = subtract(shown.gross, shown.takeHome)
  const period = PERIOD_WORDS[s.period]
  return {
    title: 'Take-home pay',
    when: shareWhen(now),
    period,
    headlineLabel: `Take-home ${period}`,
    headline: options.amounts ? gbp(shown.takeHome) : shareOf(s.year.takeHome, s.year.gross),
    negative,
    sentence: options.amounts
      ? `${shareOf(s.year.takeHome, s.year.gross)} of gross pay · ${s.taxYear} · ${s.region}`
      : `of gross pay · ${s.taxYear} · ${s.region}`,
    stats: options.amounts
      ? [
          { label: 'Gross pay', value: gbp(shown.gross) },
          { label: 'Taken off', value: gbp(takenOff) },
        ]
      : [{ label: 'Taken off', value: shareOf(subtract(s.year.gross, s.year.takeHome), s.year.gross) }],
    partsTitle: 'Where your gross pay goes',
    parts,
    total: parts.reduce((t, p) => t + p.year, 0),
    tilesTitle: '',
    tiles: [],
    biggestTitle: 'Gross pay and what is taken off',
    biggest: options.amounts
      ? [`Gross pay ${gbp(shown.gross)}`, `Taken off ${gbp(takenOff)}`]
      : [`Taken off ${shareOf(subtract(s.year.gross, s.year.takeHome), s.year.gross)} of gross pay`],
    footer: SHARE_FOOTER,
    printNote: `Tax year ${s.taxYear}, ${s.region}. A month is each yearly figure divided by twelve, to the nearest penny. Take-home is after the year’s tax, not a payslip.`,
  }
}

/** Gross pay, each part and take-home, a month and a year, with each one's share of gross pay. Amounts off: shares only. */
export function shareCsv(s: TakeHomeShare, options: ShareOptions): string {
  const year = amounts(s.year)
  const month = amounts(s.month)
  const head = ['Part', ...(options.amounts ? ['A month', 'A year'] : []), 'Of gross pay'].map(csvText).join(',')
  const row = (label: string, m: Money, y: Money) =>
    [csvText(label), ...(options.amounts ? [plainPounds(m), plainPounds(y)] : []), shareOf(y, s.year.gross)].join(',')
  const rows = [head, row('Gross pay', s.month.gross, s.year.gross)]
  for (const id of SPLIT_SEGMENTS) {
    if (id === 'takeHome' || toPence(year[id]) === 0) continue
    rows.push(row(SPLIT_LABELS[id], month[id], year[id]))
  }
  rows.push(row(SPLIT_LABELS.takeHome, s.month.takeHome, s.year.takeHome))
  rows.push('', [csvText('Tax year'), csvText(s.taxYear)].join(','), [csvText('Region'), csvText(s.region)].join(','))
  return `${rows.join('\r\n')}\r\n`
}

/** A file name with the year and month, starting sumyard-take-home. */
export const shareFileName = (now: Date, extension: string) => stemFileName('sumyard-take-home', now, extension)
