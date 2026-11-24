import { type ReactNode, useId, useState } from 'react'
import { formatPercent } from '@/lib/format'
import { ratio } from '@/lib/money'
import { cn } from '@/lib/utils'

/*
 * A ring split into parts of a total (docs/ui-patterns.md, U7, as SplitBar):
 * where the household budget's income goes. Hand-rolled SVG; colours only
 * from token stroke classes the caller gives; parts differ by more than
 * colour (a gap between each and a legend naming each with its value and
 * share). Screen readers get the title and a text summary, and everyone can
 * open the same figures as a table. A part below nothing, or parts that don't
 * add up to the total, can't be drawn: the ring says so and keeps the table.
 * No animation. Geometry constants are layout, not design tokens.
 */

const SIZE = 160
const STROKE = 26
const R = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R
/** The gap between parts, along the ring. */
const GAP = 2

export interface DonutPart {
  readonly id: string
  readonly label: string
  /** Whole units (for money, pence). */
  readonly value: number
  /** A token stroke class for the ring (stroke-group-home). */
  readonly stroke: string
  /** The legend key. */
  readonly key: ReactNode
}

export function Donut({
  title,
  parts,
  total,
  centre,
  formatValue,
  emptyText,
}: {
  title: string
  parts: readonly DonutPart[]
  /** What the parts add up to, in the same units. */
  total: number
  /** Inside the ring: the total, in words. */
  centre: ReactNode
  formatValue: (value: number) => string
  emptyText: string
}) {
  const id = useId()
  const [table, setTable] = useState(false)
  const shown = parts.filter((p) => p.value > 0)
  const drawable = total > 0 && parts.every((p) => p.value >= 0) && parts.reduce((s, p) => s + p.value, 0) === total
  const share = (value: number) => (total > 0 ? formatPercent(ratio(value, total), 1) : 'n/a')
  const summary = shown.map((p) => `${p.label} ${formatValue(p.value)}, ${share(p.value)}`).join('; ')

  let start = 0
  const arcs = shown.map((p) => {
    const length = (p.value / total) * CIRCUMFERENCE
    const arc = { ...p, dash: Math.max(length - (shown.length > 1 ? GAP : 0), 0), offset: -start }
    start += length
    return arc
  })

  return (
    <figure aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-3">
      <figcaption id={`${id}-title`} className="text-base font-semibold text-text">
        {title}
      </figcaption>
      {shown.length === 0 || !drawable ? (
        <p className="rounded-md border border-dashed border-border-strong px-3 py-4 text-center text-sm text-text-muted">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg
              role="img"
              aria-label={`${title}: ${summary}`}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              width={SIZE}
              height={SIZE}
              className="-rotate-90"
            >
              {arcs.map((a) => (
                <circle
                  key={a.id}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  strokeWidth={STROKE}
                  className={a.stroke}
                  strokeDasharray={`${a.dash} ${CIRCUMFERENCE}`}
                  strokeDashoffset={a.offset}
                />
              ))}
            </svg>
            <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {centre}
            </div>
          </div>
          <ul className="grid min-w-44 flex-1 gap-1.5 text-sm">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                {p.key}
                <span className="min-w-0 flex-1">{p.label}</span>
                <span className="text-text-muted tabular-nums">{share(p.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <button
          type="button"
          aria-expanded={table}
          aria-controls={`${id}-table`}
          onClick={() => setTable(!table)}
          className="min-h-touch text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          {table ? 'Hide the table' : 'Show as a table'}
        </button>
        <div id={`${id}-table`} hidden={!table}>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (axe scrollable-region-focusable). */}
          <section tabIndex={0} aria-label={`${title}, as a table`} className="overflow-x-auto">
            <table className="w-full text-sm text-text">
              <thead>
                <tr className="text-text-muted">
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">
                    Part
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">
                    Amount
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <th scope="row" className="px-2 py-1.5 text-left font-normal">
                      {p.label}
                    </th>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums')}>{formatValue(p.value)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{share(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </figure>
  )
}
