import { BadgeAlert, Calculator, CalendarClock, House, Lock, Percent, SlidersHorizontal, TrendingDown, Wallet } from 'lucide-react'
import type { Swatch } from '@/components/IconTile'
import type { SectionId } from './definition'
import type { PaidPartId } from './results'

/*
 * Colours and icons for the mortgage page (the mortgage redesign; docs/design-tokens.md). Class names are written out
 * whole so Tailwind finds them. Colour is never the only cue: every part and section is named beside it.
 */

export const PART_SWATCHES: Record<PaidPartId, Swatch> = {
  capital: {
    icon: House,
    text: 'text-mortgage-capital',
    fill: 'bg-mortgage-capital',
    stroke: 'stroke-mortgage-capital',
    tint: 'bg-mortgage-capital/15',
  },
  interest: {
    icon: Percent,
    text: 'text-mortgage-interest',
    fill: 'bg-mortgage-interest',
    stroke: 'stroke-mortgage-interest',
    tint: 'bg-mortgage-interest/15',
  },
  charge: {
    icon: BadgeAlert,
    text: 'text-mortgage-charge',
    fill: 'bg-mortgage-charge',
    stroke: 'stroke-mortgage-charge',
    tint: 'bg-mortgage-charge/15',
  },
}

/** The colour token of each part, for the shared image card and print page (`--sy-<token>`). */
export const PART_TOKENS: Record<PaidPartId, string> = {
  capital: 'mortgage-capital',
  interest: 'mortgage-interest',
  charge: 'mortgage-charge',
}

const ACCENT = { text: 'text-accent', fill: 'bg-accent', stroke: 'stroke-accent', tint: 'bg-accent-subtle' } as const
const POSITIVE = { text: 'text-positive', fill: 'bg-positive', stroke: 'stroke-positive', tint: 'bg-positive-subtle' } as const
const MUTED = { text: 'text-text-muted', fill: 'bg-border-strong', stroke: 'stroke-border-strong', tint: 'bg-surface-muted' } as const

/** Overpaying, and what overpaying saves. */
export const OVERPAY_SWATCH: Swatch = { icon: TrendingDown, ...POSITIVE }
/** What you pay each month. */
export const PAYMENT_SWATCH: Swatch = { icon: Wallet, ...ACCENT }
/** The fixed rate, and figures that rest on it. */
export const FIXED_SWATCH: Swatch = { icon: Lock, ...ACCENT }
/** After the fixed rate: figures that rest on the guessed rate. */
export const AFTER_FIXED_SWATCH: Swatch = { icon: CalendarClock, ...MUTED }

/** Each input section's icon (the mortgage redesign, as the budget's groups). */
export const SECTION_SWATCHES: Record<SectionId | 'whatif', Swatch> = {
  loan: PART_SWATCHES.capital,
  fixed: FIXED_SWATCH,
  overpay: OVERPAY_SWATCH,
  whatif: { icon: SlidersHorizontal, ...ACCENT },
  erc: PART_SWATCHES.charge,
  advanced: { icon: Calculator, ...MUTED },
}
