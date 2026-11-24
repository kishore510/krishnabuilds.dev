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
 * are the engine's, formatted; nothing is worked out again.
 */

export interface ShareOptions {
  /** Show amounts; off: every figure as a share of income. */
  readonly amounts: boolean
  /** Show line names; off: groups only. */
  readonly names: boolean
}

export interface SharePart {
  /** A group, or 'pots' or 'leftover'. */
  readonly id: BudgetGroup | 'pots' | 'leftover'
  readonly label: string
  /** Pence a year, for drawing; never shown when amounts are off. */
  readonly year: number
  /** A month, as the options say: an amount or a share. */
  readonly value: string
  /** Each line, keyed by its place among the outgoings. */
  readonly lines: readonly { readonly key: number; readonly name: string; readonly value: string; readonly paidFrom: string }[]
}

export interface ShareAccount {
  readonly name: string
  readonly value: string
  readonly note: string
  readonly short: boolean
}

export interface ShareModel {
  readonly title: string
  /** "November 2026". */
  readonly when: string
  readonly headlineLabel: string
  readonly headline: string
  readonly negative: boolean
  readonly sentence: string
  readonly stats: readonly { readonly label: string; readonly value: string }[]
  /** Groups with something in them, then what pots put aside, then what is left (when above nothing). */
  readonly parts: readonly SharePart[]
  /** Pence a year the parts add up to: income, or outgoings when they are more. */
  readonly total: number
  /** Each account, main first; empty with only main. */
  readonly accounts: readonly ShareAccount[]
  /** The three biggest lines outside saving, as text, when names show. */
  readonly biggest: readonly string[]
  readonly footer: string
}

export const SHARE_FOOTER = 'Illustrative only, not financial advice. Made with Sumyard.'

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
              paidFrom: accountName(l.line.account),
            }))
        : [],
    }))
  if (toPence(r.potSaved.year) > 0)
    parts.push({ id: 'pots', label: 'Savings pots', year: toPence(r.potSaved.year), value: value(r.potSaved), lines: [] })
  if (!negative) parts.push({ id: 'leftover', label: 'Left over', year: toPence(r.leftover.year), value: value(r.leftover), lines: [] })

  const accounts: ShareAccount[] = many
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
    when: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(now),
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
    parts,
    total: toPence(negative ? r.outgoings.year : r.income.year) + (negative ? 0 : toPence(r.fromOthers.year)),
    accounts,
    biggest,
    footer: SHARE_FOOTER,
  }
}

/* ── Text ─────────────────────────────────────────────────────────── */

/** A short summary to paste into a message. */
export function shareText(m: ShareModel): string {
  const lines = [`${m.title}, ${m.when} (a month)`, '']
  for (const s of m.stats) lines.push(`${s.label}: ${s.value}`)
  lines.push(`${m.headlineLabel}: ${m.headline}`)
  if (m.accounts.length > 0) {
    lines.push('', 'Left in each account:')
    for (const a of m.accounts) lines.push(`• ${a.name}: ${a.value} (${a.note})`)
  }
  lines.push('', 'Where it goes:')
  for (const p of m.parts) {
    lines.push(`• ${p.label}: ${p.value}`)
    for (const l of p.lines) lines.push(`   – ${l.name}: ${l.value}`)
  }
  lines.push('', m.footer)
  return lines.join('\n')
}

/* ── CSV ──────────────────────────────────────────────────────────── */

/** Characters a spreadsheet reads as the start of a formula (BD16). */
const FORMULA = /^[=+\-@\t\r]/

/** A text cell: quoted, quotes doubled, and a leading formula character made plain with an apostrophe. */
export const csvText = (text: string) => `"${(FORMULA.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`

/** Pence as plain pounds and pence for a spreadsheet ("-230.00"), from whole pence, never a float. */
export function plainPounds(amount: Money): string {
  const pence = BigInt(toPence(amount))
  const size = pence < 0n ? -pence : pence
  return `${pence < 0n ? '-' : ''}${size / 100n}.${String(size % 100n).padStart(2, '0')}`
}

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
export function shareFileName(now: Date, extension: string): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `sumyard-budget-${now.getFullYear()}-${month}.${extension}`
}

/** For tests and the card: a share of the parts' total. */
export const partShare = (part: number, total: number): Ratio | null => (total > 0 ? ratio(part, total) : null)
