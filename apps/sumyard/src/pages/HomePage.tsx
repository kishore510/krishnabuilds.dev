import { ChevronRight } from 'lucide-react'
import { CALCULATORS } from '@/calculators/index'
import type { CalculatorDefinition, HomeFigure } from '@/calculators/registry'
import { configFor } from '@/calculators/session'
import { IconTile } from '@/components/IconTile'
import { useStore } from '@/lib/store'
import { scenarioStore } from '@/scenarios/index'
import type { Scenario } from '@/scenarios/scenario'
import { type AmountStyle, settingsStore } from '@/settings/settings'
import { formatRowValue } from './ComparePage'
import { HOME_GROUPS, type HomeEntry } from './homeCatalogue'
import { formatPage } from './route'

/*
 * The home page: every calculator, in groups (homeCatalogue.ts), each card with the figure from its most recently
 * updated saved scenario, worked out again from its inputs.
 */

/** What a card's last line says: the latest scenario's figure, "Open to see results", or nothing saved. */
export type CardFigure =
  | { readonly kind: 'none' }
  | { readonly kind: 'no-result'; readonly name: string; readonly more: number }
  | { readonly kind: 'figure'; readonly figure: HomeFigure; readonly name: string; readonly more: number }

export function cardFigure(calculator: CalculatorDefinition, scenarios: readonly Scenario[]): CardFigure {
  const own = scenarios.filter((s) => s.calculatorId === calculator.id)
  const latest = own.reduce<Scenario | undefined>((a, s) => (a === undefined || s.updatedAt > a.updatedAt ? s : a), undefined)
  if (latest === undefined) return { kind: 'none' }
  const more = own.length - 1
  let figure: HomeFigure | null = null
  try {
    figure = calculator.homeFigure?.(latest.inputs, configFor(latest.taxYear)) ?? null
  } catch {
    figure = null
  }
  return figure === null ? { kind: 'no-result', name: latest.name, more } : { kind: 'figure', figure, name: latest.name, more }
}

function FigureLine({ figure, amounts }: { figure: CardFigure; amounts: AmountStyle }) {
  if (figure.kind === 'none') return <span className="text-sm text-text-muted">No saved scenarios yet</span>
  const more = figure.more > 0 && <span className="ml-auto text-xs text-text-muted">+{figure.more} saved</span>
  if (figure.kind === 'no-result')
    return (
      <>
        <span className="min-w-0 text-sm text-text-muted">
          <span className="font-medium text-text">{figure.name}</span> · open to see results
        </span>
        {more}
      </>
    )
  return (
    <>
      <span className="text-xl font-semibold tabular-nums">{formatRowValue(figure.figure.value, amounts)}</span>
      <span className="min-w-0 text-sm text-text-muted">
        {figure.figure.caption} · {figure.name}
      </span>
      {more}
    </>
  )
}

function CalculatorCard({ entry, scenarios, amounts }: { entry: HomeEntry; scenarios: readonly Scenario[]; amounts: AmountStyle }) {
  const calculator = CALCULATORS.get(entry.id)
  if (!calculator) return null
  return (
    <li>
      <a
        href={formatPage({ kind: 'calculator', id: calculator.id })}
        className="flex h-full min-h-touch flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-accent"
      >
        <span className="flex items-start gap-3">
          <IconTile swatch={entry.swatch} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-text">{calculator.name}</span>
            <span className="text-sm text-text-muted">{entry.line}</span>
            {calculator.placeholder && <span className="text-xs font-medium text-text">{calculator.placeholder}.</span>}
          </span>
          <ChevronRight aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
        </span>
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-3">
          <FigureLine figure={cardFigure(calculator, scenarios)} amounts={amounts} />
        </span>
      </a>
    </li>
  )
}

export function HomePage() {
  const scenarios = useStore(scenarioStore, (s) => s.scenarios)
  const amounts = useStore(settingsStore, (s) => s.amounts)
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 id="main-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          Sumyard
        </h1>
        <p className="text-text-muted">UK money calculators. What you enter stays on this device.</p>
      </div>

      {HOME_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`home-${group.id}`} className="flex flex-col gap-3">
          <h2 id={`home-${group.id}`} className="text-sm font-semibold text-text-muted">
            {group.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((entry) => (
              <CalculatorCard key={entry.id} entry={entry} scenarios={scenarios} amounts={amounts} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex max-w-prose flex-col gap-4">
      <h1 id="main-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
        No calculator here
      </h1>
      <p className="text-text-muted">
        This address doesn’t match a calculator in this version of Sumyard. It may have been renamed or not built yet.
      </p>
      <a href="#/" className="inline-flex min-h-touch items-center self-start font-medium text-accent underline underline-offset-2">
        Go to the home page
      </a>
    </div>
  )
}
