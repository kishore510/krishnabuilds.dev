import { Banknote, Car, ChartPie, House, Split, TrendingUp } from 'lucide-react'
import type { Swatch } from '@/components/IconTile'

/*
 * The home page's groups, in order, and for each calculator its icon tile and a short line. The short line is the
 * home page's own: each calculator's `summary` stays the longer intro on its page. Tiles reuse the budget's group
 * colours (0.33.0); no new tokens. Every registered calculator is in exactly one group (homeCatalogue.test.ts).
 */

export interface HomeEntry {
  readonly id: string
  readonly line: string
  readonly swatch: Swatch
}

export interface HomeGroup {
  readonly id: string
  readonly title: string
  readonly entries: readonly HomeEntry[]
}

const swatch = (icon: Swatch['icon'], text: string, tint: string): Swatch => ({ icon, text, tint, fill: '', stroke: '' })

export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    id: 'pay',
    title: 'Pay and budget',
    entries: [
      {
        id: 'optimiser',
        line: 'Pay after tax, NI, pension and student loan.',
        swatch: swatch(Banknote, 'text-group-bills', 'bg-group-bills/15'),
      },
      {
        id: 'budget',
        line: 'Where it goes, account by account, and what’s left.',
        swatch: swatch(ChartPie, 'text-group-food', 'bg-group-food/15'),
      },
    ],
  },
  {
    id: 'grow',
    title: 'Save, invest and repay',
    entries: [
      {
        id: 'next-pound',
        line: 'One lump sum: pension, mortgage or ISA, side by side.',
        swatch: swatch(Split, 'text-group-personal', 'bg-group-personal/15'),
      },
      {
        id: 'mortgage',
        line: 'Interest saved and time cut, with any early repayment charge.',
        swatch: swatch(House, 'text-group-home', 'bg-group-home/15'),
      },
      {
        id: 'compound-interest',
        line: 'How savings could grow, after fees and inflation.',
        swatch: swatch(TrendingUp, 'text-group-saving', 'bg-group-saving/15'),
      },
    ],
  },
  {
    id: 'cars',
    title: 'Cars',
    entries: [
      {
        id: 'car-decision',
        line: 'Keep, buy, loan, HP or PCP: cost per month, side by side.',
        swatch: swatch(Car, 'text-group-transport', 'bg-group-transport/15'),
      },
    ],
  },
]
