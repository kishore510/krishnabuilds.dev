import { type HTMLAttributes, type ReactNode, useId } from 'react'
import { cn } from '@/lib/utils'

/*
 * Results: a card with an optional headline figure and rows of label and
 * value (StatRow). Values are passed already formatted (src/lib/format.ts).
 * `heading` sets the title's level where cards sit under a section heading
 * (the car decision's option cards); `footer` holds notices after the rows;
 * other attributes (tabIndex, data markers) go on the card. `emphasis` makes
 * the headline the page's answer, as the budget's (larger, in `positive`),
 * with an optional sentence under it (the take-home redesign).
 */

export function ResultCard({
  title,
  headline,
  headlineLabel,
  heading: H = 'h2',
  emphasis = false,
  sentence,
  footer,
  children,
  className,
  ...rest
}: {
  title: string
  /** The main figure, shown large. */
  headline?: string
  /** What the headline is, read with it. */
  headlineLabel?: string
  heading?: 'h2' | 'h3'
  /** The headline as the page's answer: larger, in the positive colour. */
  emphasis?: boolean
  /** A line under the headline. */
  sentence?: ReactNode
  /** After the rows: notices, a breakdown. */
  footer?: ReactNode
  children?: ReactNode
  className?: string
} & Omit<HTMLAttributes<HTMLElement>, 'title' | 'children' | 'className'>) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      {...rest}
      className={cn('flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm', className)}
    >
      <H id={titleId} className="text-base font-semibold text-text [overflow-wrap:anywhere]">
        {title}
      </H>
      {headline !== undefined && (
        <p className="flex flex-col">
          {headlineLabel && <span className="text-sm text-text-muted">{headlineLabel}</span>}
          <span
            data-headline
            className={cn(
              'tracking-tight tabular-nums',
              emphasis ? 'text-3xl font-bold text-positive' : 'text-2xl font-semibold text-text',
            )}
          >
            {headline}
          </span>
          {sentence && <span className="mt-1 text-sm text-text">{sentence}</span>}
        </p>
      )}
      {children && <dl className="flex flex-col">{children}</dl>}
      {footer}
    </section>
  )
}

/** A label and its value; `marker` names the value for tests and links (data-<marker>). */
export function StatRow({
  label,
  value,
  detail,
  marker,
  icon,
}: {
  label: string
  value: string
  detail?: string
  marker?: string
  /** Before the label, hidden from screen readers (an IconTile). */
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-border py-2 first:border-t-0 first:pt-0">
      <dt className={cn('min-w-0 text-sm text-text-muted', icon && 'flex items-center gap-2 self-center')}>
        {icon}
        {label}
      </dt>
      <dd className="ml-auto text-right text-sm font-medium text-text tabular-nums">
        <span {...(marker ? { [`data-${marker}`]: '' } : {})}>{value}</span>
        {detail && <span className="block text-xs font-normal text-text-muted">{detail}</span>}
      </dd>
    </div>
  )
}
