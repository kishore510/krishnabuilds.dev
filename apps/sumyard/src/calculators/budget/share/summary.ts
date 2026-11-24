import {
  csvText,
  plainPounds,
  SHARE_FOOTER,
  type ShareModel,
  type ShareOptions,
  type SharePart,
  type ShareTile,
  shareText,
  shareWhen,
  shareFileName as stemFileName,
} from '@/components/share/model'
import { formatGBP, formatPercent } from '@/lib/format'
import { type Money, type Ratio, ratio, subtract, toPence, ZERO } from '@/lib/money'
import type { AmountStyle } from '@/settings/settings'
import { ACCOUNT_KIND_LABELS, type BudgetPageInputs, GROUP_LABELS, MAIN_ACCOUNT_LABEL } from '../definition'
import { type BudgetGroup, type BudgetResult, MAIN_ACCOUNT, SAVING_GROUP, type YearAndMonth } from '../types'

/*
 * What a shared budget says (BD16), built once from the inputs and the
 * engine's result, then written out as text, a spreadsheet (CSV) or drawn as
 * an image card. The person chooses whether amounts show (else each figure
 * as a share of income) and whether line names show (else groups only).
 * Everything here is made on the device; nothing is sent anywhere. Figures
 * are the engine's, formatted; nothing is worked out again. The model, text,
 * CSV helpers, card and dialog are shared (`src/components/share/`).
 */

export type { ShareModel, ShareOptions }
export { csvText, plainPounds, SHARE_FOOTER, shareText }

/** Each part's colour token: a group's own, pots in the saving colour, what is left neutral. */
const PART_COLOURS: Record<BudgetGroup | 'pots' | 'leftover', string> = {
  home: 'group-home',
  bills: 'group-bills',
  food: 'group-food',
  transport: 'group-transport',
  personal: 'group-personal',
  debt: 'group-debt',
  saving: 'group-saving',
  other: 'group-other',
  pots: 'group-saving',
  leftover: 'border-strong',
}

const share = (part: Money, income: Money): string =>
  toPence(income) === 0 ? 'n/a' : formatPercent(ratio(toPence(part), toPence(income)), 0)

export function shareModel(inputs: BudgetPageInputs, r: BudgetResult, options: ShareOptions, style: AmountStyle, now: Date): ShareModel {
  const gbp = (amount: Money) => formatGBP(amount, style)
  const value = (figure: YearAndMonth) => (options.amounts ? gbp(figure.month) : share(figure.year, r.income.year))
  const accountName = (id: string) => (id === MAIN_ACCOUNT ? MAIN_ACCOUNT_LABEL : (inputs.accounts.find((a) => a.id === id)?.name ?? ''))
  const negative = toPence(r.leftover.year) < 0
  const many = r.accounts.length > 1

  const parts: SharePart[] = r.perGroup
    .filter((g) => toPence(g.year) > 0)
    .map((g) => ({
      id: g.group,
      colour: PART_COLOURS[g.group],
      label: GROUP_LABELS[g.group],
      year: toPence(g.year),
      value: value(g),
      lines: options.names
        ? r.outgoingLines
            .filter((l) => l.line.group === g.group && toPence(l.year) > 0)
            .map((l) => ({
              key: r.outgoingLines.indexOf(l),
              name: l.line.name || GROUP_LABELS[g.group],
              value: value(l),
              note: accountName(l.line.account),
            }))
        : [],
    }))
  if (toPence(r.potSaved.year) > 0)
    parts.push({
      id: 'pots',
      colour: PART_COLOURS.pots,
      label: 'Savings pots',
      year: toPence(r.potSaved.year),
      value: value(r.potSaved),
      lines: [],
    })
  if (!negative)
    parts.push({
      id: 'leftover',
      colour: PART_COLOURS.leftover,
      label: 'Left over',
      year: toPence(r.leftover.year),
      value: value(r.leftover),
      lines: [],
    })

  const accounts: ShareTile[] = many
    ? r.accounts.map((a) => {
        const short = toPence(a.short.year) > 0
        const shown: YearAndMonth = short
          ? { year: subtract(ZERO, a.short.year), month: subtract(ZERO, a.short.month) }
          : a.kind === 'savings'
            ? a.saved
            : a.left
        const name = a.id === MAIN_ACCOUNT ? MAIN_ACCOUNT_LABEL : a.name || ACCOUNT_KIND_LABELS[a.kind as keyof typeof ACCOUNT_KIND_LABELS]
        return {
          name,
          value: options.amounts ? gbp(shown.month) : share(shown.year, r.income.year),
          note: short ? 'short, topped up from main' : a.kind === 'savings' ? 'put aside' : toPence(a.left.year) > 0 ? 'left' : 'all used',
          short,
        }
      })
    : []

  const biggest = options.names
    ? r.outgoingLines
        .filter((l) => l.line.group !== SAVING_GROUP && toPence(l.year) > 0)
        .sort((a, b) => toPence(b.year) - toPence(a.year))
        .slice(0, 3)
        .map((l) => `${l.line.name || GROUP_LABELS[l.line.group]} ${value(l)}`)
    : []

  return {
    title: 'Household budget',
    when: shareWhen(now),
    period: 'a month',
    headlineLabel: `Left over${many ? ' across accounts' : ''} each month`,
    headline: options.amounts ? gbp(r.leftover.month) : share(r.leftover.year, r.income.year),
    negative,
    sentence: options.amounts
      ? `${share(r.leftover.year, r.income.year)} of take-home, after spending and saving`
      : 'of take-home, after spending and saving',
    stats: options.amounts
      ? [
          { label: 'Take-home', value: gbp(r.income.month) },
          ...(toPence(r.fromOthers.year) > 0 ? [{ label: 'Put in by others', value: gbp(r.fromOthers.month) }] : []),
          { label: 'Going out', value: gbp(r.outgoings.month) },
          { label: 'Saving rate', value: r.savingsRate ? formatPercent(r.savingsRate, 1) : 'n/a' },
        ]
      : [
          { label: 'Going out', value: share(r.outgoings.year, r.income.year) },
          { label: 'Saving rate', value: r.savingsRate ? formatPercent(r.savingsRate, 1) : 'n/a' },
        ],
    partsTitle: 'Where it goes',
    parts,
    total: toPence(negative ? r.outgoings.year : r.income.year) + (negative ? 0 : toPence(r.fromOthers.year)),
    tilesTitle: 'Left in each account',
    tiles: accounts,
    biggestTitle: 'Biggest outgoings',
    biggest,
    footer: SHARE_FOOTER,
    printNote: 'Amounts as entered; a year is twelve months. Uses no tax rules.',
  }
}

/* ── CSV ──────────────────────────────────────────────────────────── */

const shareCell = (part: Money, income: Money) => (toPence(income) === 0 ? '' : formatPercent(ratio(toPence(part), toPence(income)), 1))

/** Every line (or every group, without names), a month and a year, then each account. Amounts off: shares only. */
export function shareCsv(inputs: BudgetPageInputs, r: BudgetResult, options: ShareOptions): string {
  const accountName = (id: string) => (id === MAIN_ACCOUNT ? MAIN_ACCOUNT_LABEL : (inputs.accounts.find((a) => a.id === id)?.name ?? ''))
  const money = (figure: YearAndMonth) => (options.amounts ? [plainPounds(figure.month), plainPounds(figure.year)] : [])
  const head = (cells: string[]) => cells.map(csvText).join(',')
  const row = (texts: string[], numbers: string[]) => [...texts.map(csvText), ...numbers].join(',')
  const rows: string[] = []
  const amountHeads = options.amounts ? ['A month', 'A year'] : []
  if (options.names) {
    rows.push(head(['Group', 'Line', 'Paid from', ...amountHeads, 'Of income']))
    for (const l of r.outgoingLines)
      rows.push(
        row([GROUP_LABELS[l.line.group], l.line.name, accountName(l.line.account)], [...money(l), shareCell(l.year, r.income.year)]),
      )
  } else {
    rows.push(head(['Group', ...amountHeads, 'Of income']))
    for (const g of r.perGroup)
      if (toPence(g.year) > 0) rows.push(row([GROUP_LABELS[g.group]], [...money(g), shareCell(g.year, r.income.year)]))
  }
  const pad = options.names ? ['', ''] : []
  if (toPence(r.potSaved.year) > 0)
    rows.push(row(['Put aside in savings pots', ...pad], [...money(r.potSaved), shareCell(r.potSaved.year, r.income.year)]))
  rows.push(row(['Outgoings', ...pad], [...money(r.outgoings), shareCell(r.outgoings.year, r.income.year)]))
  rows.push(row(['Left over', ...pad], [...money(r.leftover), shareCell(r.leftover.year, r.income.year)]))
  rows.push(row(['Income', ...pad], [...money(r.income), shareCell(r.income.year, r.income.year)]))
  if (toPence(r.fromOthers.year) > 0) rows.push(row(['Put in by others', ...pad], [...money(r.fromOthers), '']))
  if (r.accounts.length > 1) {
    rows.push('')
    const flows = options.amounts ? ['In a month', 'Paid a month', 'Left a month'] : ['Left, of income']
    rows.push(head(['Account', 'Kind', ...flows]))
    for (const a of r.accounts) {
      const kind = a.kind === 'main' ? 'Main' : ACCOUNT_KIND_LABELS[a.kind]
      const name = a.id === MAIN_ACCOUNT ? MAIN_ACCOUNT_LABEL : a.name
      rows.push(
        row(
          [name, kind],
          options.amounts
            ? [plainPounds(a.moneyIn.month), plainPounds(a.paid.month), plainPounds(a.left.month)]
            : [shareCell(a.left.year, r.income.year)],
        ),
      )
    }
  }
  return `${rows.join('\r\n')}\r\n`
}

/** A file name with the month: sumyard-budget-2026-11. */
export const shareFileName = (now: Date, extension: string) => stemFileName('sumyard-budget', now, extension)

/** For tests and the card: a share of the parts' total. */
export const partShare = (part: number, total: number): Ratio | null => (total > 0 ? ratio(part, total) : null)
