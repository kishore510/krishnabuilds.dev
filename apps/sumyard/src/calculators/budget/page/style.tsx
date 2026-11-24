import { Car, CircleAlert, CreditCard, Ellipsis, House, Landmark, ShoppingBag, ShoppingCart, TrendingUp, Wallet, Zap } from 'lucide-react'
import type { Swatch } from '@/components/IconTile'
import { cn } from '@/lib/utils'
import type { BudgetGroup } from '../types'

/*
 * Token classes and icons for the budget's groups and accounts (BD10, BD11;
 * docs/design-tokens.md, 0.33.0). Class names are written out whole so
 * Tailwind finds them. Colour is never the only cue: every group and account
 * is named beside its colour.
 */

export { IconTile, type Swatch } from '@/components/IconTile'

export const GROUP_SWATCHES: Record<BudgetGroup, Swatch> = {
  home: { icon: House, text: 'text-group-home', fill: 'bg-group-home', stroke: 'stroke-group-home', tint: 'bg-group-home/15' },
  bills: { icon: Zap, text: 'text-group-bills', fill: 'bg-group-bills', stroke: 'stroke-group-bills', tint: 'bg-group-bills/15' },
  food: { icon: ShoppingCart, text: 'text-group-food', fill: 'bg-group-food', stroke: 'stroke-group-food', tint: 'bg-group-food/15' },
  transport: {
    icon: Car,
    text: 'text-group-transport',
    fill: 'bg-group-transport',
    stroke: 'stroke-group-transport',
    tint: 'bg-group-transport/15',
  },
  personal: {
    icon: ShoppingBag,
    text: 'text-group-personal',
    fill: 'bg-group-personal',
    stroke: 'stroke-group-personal',
    tint: 'bg-group-personal/15',
  },
  debt: { icon: CreditCard, text: 'text-group-debt', fill: 'bg-group-debt', stroke: 'stroke-group-debt', tint: 'bg-group-debt/15' },
  saving: {
    icon: TrendingUp,
    text: 'text-group-saving',
    fill: 'bg-group-saving',
    stroke: 'stroke-group-saving',
    tint: 'bg-group-saving/15',
  },
  other: { icon: Ellipsis, text: 'text-group-other', fill: 'bg-group-other', stroke: 'stroke-group-other', tint: 'bg-group-other/15' },
}

/** What is left over, in the donut and bar: a neutral part. */
export const LEFTOVER_SWATCH: Swatch = {
  icon: Wallet,
  text: 'text-text-muted',
  fill: 'bg-border-strong',
  stroke: 'stroke-border-strong',
  tint: 'bg-surface-muted',
}

/** What savings pots put aside: shown with the saving colour. */
export const POT_SWATCH: Swatch = { ...GROUP_SWATCHES.saving, icon: Landmark }

export const SHORT_ICON = CircleAlert

/** Main first, then each account by its place: a fixed cycle. */
const ACCOUNT_CYCLE: readonly Swatch[] = [
  GROUP_SWATCHES.transport,
  GROUP_SWATCHES.bills,
  GROUP_SWATCHES.food,
  GROUP_SWATCHES.personal,
  GROUP_SWATCHES.home,
]

export const MAIN_SWATCH: Swatch = { ...LEFTOVER_SWATCH, text: 'text-text', fill: 'bg-text-muted', icon: Landmark }

export const accountSwatch = (index: number): Swatch => ({ ...ACCOUNT_CYCLE[index % ACCOUNT_CYCLE.length]!, icon: Landmark })

/** A small square key for a legend. */
export const Key = ({ swatch }: { swatch: Swatch }) => (
  <span aria-hidden="true" className={cn('inline-block size-3 shrink-0 rounded-full', swatch.fill)} />
)
