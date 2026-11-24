import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * An icon on a light tint of its colour: the budget's groups and accounts (0.33.0) and the home page's calculators.
 * Class names are written out whole where a Swatch is made, so Tailwind finds them. Colour is never the only cue:
 * whatever a tile marks is named beside it.
 */

export interface Swatch {
  readonly icon: LucideIcon
  /** Text and icon colour. */
  readonly text: string
  /** A solid fill (bars, legend keys). */
  readonly fill: string
  /** An SVG stroke (the donut). */
  readonly stroke: string
  /** A light tint behind the icon. */
  readonly tint: string
}

/** An icon on its tint, the size of a touch target's content. */
export function IconTile({ swatch, size = 'md' }: { swatch: Swatch; size?: 'sm' | 'md' }) {
  const Icon = swatch.icon
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-md', swatch.tint, size === 'md' ? 'size-9' : 'size-7')}
    >
      <Icon className={cn(swatch.text, size === 'md' ? 'size-5' : 'size-4')} />
    </span>
  )
}
