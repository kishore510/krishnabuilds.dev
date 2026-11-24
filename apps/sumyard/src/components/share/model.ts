import { type Money, toPence } from '@/lib/money'

/*
 * What a shared result says, whatever the page (BD16, TH5). A page builds one
 * of these from its inputs and its engine's result; the dialog writes it out
 * as text, draws it as the image card and lays it out as the print page.
 * Figures arrive formatted: nothing here works anything out again.
 */

export interface ShareOptions {
  /** Show amounts; off: every figure as a share (of income, or of gross pay). */
  readonly amounts: boolean
  /** Show line names; off: groups only. Pages without named lines ignore it. */
  readonly names: boolean
}

export interface SharePartLine {
  readonly key: number
  readonly name: string
  readonly value: string
  /** Said after the name, such as the account a budget line is paid from. */
  readonly note?: string
}

export interface SharePart {
  readonly id: string
  readonly label: string
  /** The part's colour token, without its prefix ("group-home" for `--sy-group-home`). */
  readonly colour: string
  /** Pence for the period, for drawing only; never shown when amounts are off. */
  readonly year: number
  /** As the options say: an amount or a share. */
  readonly value: string
  readonly lines: readonly SharePartLine[]
}

/** A small figure card under the ring, such as what is left in a budget's account. */
export interface ShareTile {
  readonly name: string
  readonly value: string
  readonly note: string
  readonly short: boolean
}

export interface ShareModel {
  readonly title: string
  /** "November 2026". */
  readonly when: string
  /** How the figures are measured, such as "a month". */
  readonly period: string
  readonly headlineLabel: string
  readonly headline: string
  readonly negative: boolean
  readonly sentence: string
  readonly stats: readonly { readonly label: string; readonly value: string }[]
  /** "Where it goes". */
  readonly partsTitle: string
  readonly parts: readonly SharePart[]
  /** The pence the parts add up to. */
  readonly total: number
  readonly tilesTitle: string
  readonly tiles: readonly ShareTile[]
  readonly biggestTitle: string
  readonly biggest: readonly string[]
  readonly footer: string
  /** A line for the print page's footer, after `footer`. */
  readonly printNote: string
}

export const SHARE_FOOTER = 'Illustrative only, not financial advice. Made with Sumyard.'

/** A short summary to paste into a message. */
export function shareText(m: ShareModel): string {
  const lines = [`${m.title}, ${m.when} (${m.period})`, '']
  for (const s of m.stats) lines.push(`${s.label}: ${s.value}`)
  lines.push(`${m.headlineLabel}: ${m.headline}`)
  if (m.tiles.length > 0) {
    lines.push('', `${m.tilesTitle}:`)
    for (const t of m.tiles) lines.push(`• ${t.name}: ${t.value} (${t.note})`)
  }
  lines.push('', `${m.partsTitle}:`)
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

/** A file name with the month: `sumyard-budget-2026-11.png`. */
export function shareFileName(stem: string, now: Date, extension: string): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${stem}-${now.getFullYear()}-${month}.${extension}`
}

export const shareWhen = (now: Date) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(now)
