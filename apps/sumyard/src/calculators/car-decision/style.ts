import {
  Banknote,
  Car,
  CarFront,
  Clock,
  Fuel,
  Gauge,
  HandCoins,
  Landmark,
  Percent,
  PiggyBank,
  Receipt,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  TrendingDown,
  Undo2,
  Wrench,
} from 'lucide-react'
import type { Swatch } from '@/components/IconTile'
import type { AcquisitionKind } from '../car-ownership/types'

/*
 * Colours and icons for the car decision page (the car decision redesign, CD1 and CD6; docs/design-tokens.md). An option
 * takes its colour by its place in the editor (`car-1` to `car-4`), so it keeps its colour when the order changes; a cost
 * part takes its own (`car-part-*`), from hues no option uses, so no colour means two things on the page (TH2). Class
 * names are written out whole so Tailwind finds them. Colour is never the only cue: every option and part is named beside
 * it, and chart lines keep their own dash and marker.
 */

/** Each option's colour by its place in the editor (CD1). */
export const OPTION_SWATCHES: readonly Omit<Swatch, 'icon'>[] = [
  { text: 'text-car-1', fill: 'bg-car-1', stroke: 'stroke-car-1', tint: 'bg-car-1/15' },
  { text: 'text-car-2', fill: 'bg-car-2', stroke: 'stroke-car-2', tint: 'bg-car-2/15' },
  { text: 'text-car-3', fill: 'bg-car-3', stroke: 'stroke-car-3', tint: 'bg-car-3/15' },
  { text: 'text-car-4', fill: 'bg-car-4', stroke: 'stroke-car-4', tint: 'bg-car-4/15' },
]

/** A chart line's colour for an option (SVG fill for its markers). */
export const OPTION_CHART_COLOURS: readonly { readonly stroke: string; readonly fill: string }[] = [
  { stroke: 'stroke-car-1', fill: 'fill-car-1' },
  { stroke: 'stroke-car-2', fill: 'fill-car-2' },
  { stroke: 'stroke-car-3', fill: 'fill-car-3' },
  { stroke: 'stroke-car-4', fill: 'fill-car-4' },
]

/** The colour token of each option, for the shared image card and print page (`--sy-<token>`). */
export const OPTION_TOKENS: readonly string[] = ['car-1', 'car-2', 'car-3', 'car-4']

/** How the car is had: one icon each (CD1). */
export const ACQUISITION_ICONS: Record<AcquisitionKind, Swatch['icon']> = {
  keep: Car,
  cash: Banknote,
  loan: Landmark,
  'hire-purchase': Receipt,
  pcp: CarFront,
}

/** An option's swatch: its place's colour and its kind's icon. */
export const optionSwatch = (index: number, kind: AcquisitionKind): Swatch => ({
  ...OPTION_SWATCHES[index % OPTION_SWATCHES.length]!,
  icon: ACQUISITION_ICONS[kind],
})

/** The parts the cost bars draw (CD6): the breakdown's running costs together, the rest as the breakdown has them. */
export type CostPartId = 'depreciation' | 'finance' | 'handedBack' | 'fuel' | 'running' | 'lostInterest'

export const PART_SWATCHES: Record<CostPartId, Swatch> = {
  depreciation: {
    icon: TrendingDown,
    text: 'text-car-part-depreciation',
    fill: 'bg-car-part-depreciation',
    stroke: 'stroke-car-part-depreciation',
    tint: 'bg-car-part-depreciation/15',
  },
  finance: {
    icon: Percent,
    text: 'text-car-part-finance',
    fill: 'bg-car-part-finance',
    stroke: 'stroke-car-part-finance',
    tint: 'bg-car-part-finance/15',
  },
  handedBack: {
    icon: Undo2,
    text: 'text-car-part-handed-back',
    fill: 'bg-car-part-handed-back',
    stroke: 'stroke-car-part-handed-back',
    tint: 'bg-car-part-handed-back/15',
  },
  fuel: {
    icon: Fuel,
    text: 'text-car-part-fuel',
    fill: 'bg-car-part-fuel',
    stroke: 'stroke-car-part-fuel',
    tint: 'bg-car-part-fuel/15',
  },
  running: {
    icon: Wrench,
    text: 'text-car-part-running',
    fill: 'bg-car-part-running',
    stroke: 'stroke-car-part-running',
    tint: 'bg-car-part-running/15',
  },
  lostInterest: {
    icon: PiggyBank,
    text: 'text-car-part-lost-interest',
    fill: 'bg-car-part-lost-interest',
    stroke: 'stroke-car-part-lost-interest',
    tint: 'bg-car-part-lost-interest/15',
  },
}

/** The colour token of each part, for the shared image card and print page. */
export const PART_TOKENS: Record<CostPartId, string> = {
  depreciation: 'car-part-depreciation',
  finance: 'car-part-finance',
  handedBack: 'car-part-handed-back',
  fuel: 'car-part-fuel',
  running: 'car-part-running',
  lostInterest: 'car-part-lost-interest',
}

const ACCENT = { text: 'text-accent', fill: 'bg-accent', stroke: 'stroke-accent', tint: 'bg-accent-subtle' } as const
const MUTED = { text: 'text-text-muted', fill: 'bg-border-strong', stroke: 'stroke-border-strong', tint: 'bg-surface-muted' } as const

/** The input and result sections' icons. */
export const SECTION_SWATCHES = {
  shared: { icon: SlidersHorizontal, ...MUTED },
  mileage: { icon: Gauge, ...ACCENT },
  horizon: { icon: Clock, ...ACCENT },
  money: { icon: HandCoins, ...ACCENT },
  month: { icon: Clock, ...ACCENT },
  changes: { icon: Scale, ...ACCENT },
  sure: { icon: RotateCcw, ...ACCENT },
} as const satisfies Record<string, Swatch>
