import {
  csvText,
  plainPounds,
  SHARE_FOOTER,
  type ShareModel,
  type ShareOptions,
  type SharePart,
  type ShareTile,
  shareWhen,
  shareFileName as stemFileName,
} from '@/components/share/model'
import { formatGBP, formatPercent } from '@/lib/format'
import { add, compare, type Money, ratio, toPence, ZERO } from '@/lib/money'
import type { AmountStyle } from '@/settings/settings'
import { METHOD_LABELS, yearsAndMonths } from './definition'
import { type PaidPartId, paidParts, returnLines } from './results'
import { PART_TOKENS } from './style'
import type { MortgageInputs, MortgageResult } from './types'

/*
 * What a shared mortgage overpayment says (the mortgage redesign, as BD16 and TH5): interest saved, the time saved (or
 * what is owed at the end), where the payments go with overpaying, what you pay each month now and after the fixed
 * rate, and the guaranteed return per rate period. Not shared: dates, lump sums, the yearly table, the interest method's
 * settings. Amounts off: interest saved as a share of the interest without overpaying, the parts as shares of the total
 * paid, times and returns as they are; no pound figure anywhere. Figures are the engine's, formatted; nothing is worked
 * out again. Made on the device; nothing is sent anywhere.
 */

export interface MortgageShare {
  readonly result: MortgageResult
  readonly inputs: MortgageInputs
  /** The figures include the page's what-if. */
  readonly whatIf: boolean
}

const shareOf = (part: Money, whole: Money) => (toPence(whole) <= 0 ? 'n/a' : formatPercent(ratio(toPence(part), toPence(whole)), 1))

/** Part names short enough for the image card. */
const SHORT_LABELS: Record<PaidPartId, string> = { capital: 'Amount borrowed', interest: 'Interest', charge: 'Repayment charge' }

const RETURN_LABELS = { fixed: 'Return while fixed', reversion: 'Return after the fixed rate' } as const

/** The time saved, or what is owed at the end; with amounts off, owed at the end as a share of the amount borrowed. */
function sentence(s: MortgageShare, amounts: boolean, gbp: (m: Money) => string): string {
  const { result, inputs } = s
  const { baseline, overpaying } = result
  if (inputs.repaymentType !== 'repayment') {
    return amounts
      ? `${gbp(overpaying.owedAtEnd)} owed at the end instead of ${gbp(baseline.owedAtEnd)}`
      : `${shareOf(overpaying.owedAtEnd, inputs.balance)} of the amount borrowed owed at the end, instead of ${shareOf(baseline.owedAtEnd, inputs.balance)}`
  }
  if (overpaying.payoffMonth === null || baseline.payoffMonth === null) return 'Interest over the term'
  return `Cleared in ${yearsAndMonths(overpaying.payoffMonth)}, not ${yearsAndMonths(baseline.payoffMonth)}`
}

export function shareModel(s: MortgageShare, options: ShareOptions, style: AmountStyle, now: Date): ShareModel {
  const gbp = (amount: Money) => formatGBP(amount, style)
  const { result, inputs } = s
  const { baseline, overpaying } = result
  const parts: SharePart[] = paidParts(result, inputs, 'overpaying')
    .filter((p) => toPence(p.amount) > 0)
    .map((p) => ({
      id: p.id,
      label: SHORT_LABELS[p.id],
      colour: PART_TOKENS[p.id],
      year: toPence(p.amount),
      value: options.amounts ? gbp(p.amount) : shareOf(p.amount, overpaying.totalPaid),
      lines: [],
    }))
  const returns = returnLines(result, inputs).map((line) => ({ label: RETURN_LABELS[line.period], value: formatPercent(line.effective) }))
  const charged = compare(overpaying.totalErc, ZERO) > 0
  const first = overpaying.rows[0]
  const afterFixed = inputs.fixedEndMonth > 0 ? overpaying.rows[inputs.fixedEndMonth] : undefined
  const tiles: ShareTile[] =
    options.amounts && inputs.repaymentType === 'repayment'
      ? [
          ...(first
            ? [{ name: 'Each month now', value: gbp(add(first.payment, first.overpayment)), note: 'overpaying', short: false }]
            : []),
          ...(afterFixed && overpaying.paymentAfterFixedEnd !== null
            ? [
                {
                  name: 'After the fixed rate',
                  value: gbp(add(afterFixed.payment, afterFixed.overpayment)),
                  note: 'overpaying',
                  short: false,
                },
              ]
            : []),
        ]
      : []
  return {
    title: s.whatIf ? 'Mortgage overpayment, with a what-if' : 'Mortgage overpayment',
    when: shareWhen(now),
    period: 'over the term',
    headlineLabel: options.amounts ? 'Interest saved' : 'Less interest than without overpaying',
    headline: options.amounts ? gbp(result.interestSaved) : shareOf(result.interestSaved, baseline.totalInterest),
    negative: compare(result.interestSaved, ZERO) < 0,
    sentence: sentence(s, options.amounts, gbp),
    stats: [
      ...(options.amounts
        ? [
            { label: 'Total paid', value: gbp(overpaying.totalPaid) },
            ...(charged ? [{ label: 'Early repayment charge', value: gbp(overpaying.totalErc) }] : []),
            ...(result.charge ? [{ label: 'Net saving', value: gbp(result.charge.netSaving) }] : []),
          ]
        : []),
      ...returns,
    ],
    partsTitle: 'Where your payments go, with overpaying',
    parts,
    total: parts.reduce((t, p) => t + p.year, 0),
    tilesTitle: 'What you pay',
    tiles,
    biggestTitle: 'Interest over the term',
    biggest: options.amounts
      ? [`Without overpaying ${gbp(baseline.totalInterest)}`, `With overpaying ${gbp(overpaying.totalInterest)}`]
      : [`${shareOf(result.interestSaved, baseline.totalInterest)} less than without overpaying`],
    footer: SHARE_FOOTER,
    printNote: `Uses no tax rules. Interest ${METHOD_LABELS[inputs.policy.interestMethod].toLowerCase()}; the rate after the fixed rate is a guess. Lender terms vary: check against a statement.`,
  }
}

/** Without and with overpaying: each part of the total paid, interest saved and what is owed at the end. Amounts off: shares only. */
export function shareCsv(s: MortgageShare, options: ShareOptions): string {
  const { result, inputs } = s
  const { baseline, overpaying } = result
  const without = paidParts(result, inputs, 'baseline')
  const withOver = paidParts(result, inputs, 'overpaying')
  const head = (
    options.amounts
      ? ['Figure', 'Without overpaying', 'With overpaying']
      : ['Figure', 'Without overpaying (of total paid)', 'With overpaying (of total paid)']
  )
    .map(csvText)
    .join(',')
  const rows = [head]
  withOver.forEach((p, i) => {
    const b = without[i]!
    if (toPence(p.amount) === 0 && toPence(b.amount) === 0) return
    rows.push(
      options.amounts
        ? [csvText(p.label), plainPounds(b.amount), plainPounds(p.amount)].join(',')
        : [csvText(p.label), shareOf(b.amount, baseline.totalPaid), shareOf(p.amount, overpaying.totalPaid)].join(','),
    )
  })
  if (options.amounts) {
    rows.push([csvText('Total paid'), plainPounds(baseline.totalPaid), plainPounds(overpaying.totalPaid)].join(','))
    rows.push([csvText('Owed at the end'), plainPounds(baseline.owedAtEnd), plainPounds(overpaying.owedAtEnd)].join(','))
  }
  if (baseline.payoffMonth !== null && overpaying.payoffMonth !== null) {
    rows.push(
      [csvText('Cleared in'), csvText(yearsAndMonths(baseline.payoffMonth)), csvText(yearsAndMonths(overpaying.payoffMonth))].join(','),
    )
  }
  rows.push('')
  rows.push(
    [
      csvText(options.amounts ? 'Interest saved' : 'Interest saved (of interest without overpaying)'),
      options.amounts ? plainPounds(result.interestSaved) : shareOf(result.interestSaved, baseline.totalInterest),
    ].join(','),
  )
  if (options.amounts && result.charge) rows.push([csvText('Net saving'), plainPounds(result.charge.netSaving)].join(','))
  for (const line of returnLines(result, inputs)) rows.push([csvText(RETURN_LABELS[line.period]), formatPercent(line.effective)].join(','))
  return `${rows.join('\r\n')}\r\n`
}

/** A file name with the year and month, starting sumyard-mortgage. */
export const shareFileName = (now: Date, extension: string) => stemFileName('sumyard-mortgage', now, extension)
