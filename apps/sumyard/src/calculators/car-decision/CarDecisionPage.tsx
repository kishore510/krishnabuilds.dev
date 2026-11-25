import { Share2 } from 'lucide-react'
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AssumptionsPanel } from '@/components/AssumptionsPanel'
import { IconTile } from '@/components/IconTile'
import { Field } from '@/components/inputs/Field'
import { NumberInput } from '@/components/inputs/NumberInput'
import { PercentInput } from '@/components/inputs/PercentInput'
import { Segmented } from '@/components/inputs/Segmented'
import { Select } from '@/components/inputs/Select'
import { NoTaxRulesBadge } from '@/components/NoTaxRulesBadge'
import { RefusalNotice } from '@/components/RefusalNotice'
import { ScenarioBar } from '@/components/ScenarioBar'
import { Section } from '@/components/Section'
import { SETTLE_MS, StickyResult } from '@/components/StickyResult'
import { InlineNotice } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useItemKeys } from '@/hooks/useItemKeys'
import { formatGBP, formatPercent } from '@/lib/format'
import { MAX_ANNUAL_MILEAGE, MAX_CAR_OPTIONS, MAX_HORIZON_MONTHS } from '@/lib/inputLimits'
import { compare, type Money } from '@/lib/money'
import { percentRatio } from '@/lib/parse'
import { MONTHS_PER_YEAR } from '@/lib/periods'
import { useStore } from '@/lib/store'
import { settingsStore } from '@/settings/settings'
import { DISCLAIMER } from '@/sheets/parts'
import type { ValueCase } from '../car-ownership/types'
import { sessionFor } from '../session'
import { AnswerCard, type RankRow, ScenarioTable } from './CarAnswer'
import { BridgeSection, type BridgeState } from './CarBridge'
import { CarOptions } from './CarOptions'
import { type CardData, CompareTable, CostSection, type FlipState, WhatChanges } from './CarResults'
import { CrossoverView, SensitivityView, useSensitivity } from './CarViews'
import {
  CASE_LABELS,
  type CarDecisionInputs,
  calculate,
  carDecisionCalculator,
  DECIMALS,
  hasRange,
  type OptionField,
  optionName,
  SHARED_LABELS,
  SHARED_LIMITS,
  type SharedField,
  toEngineShared,
  uniqueNames,
  VALUE_CASES,
} from './definition'
import { emptyCostsDiffer, emptyRunningCosts, engineNames, type NoVerdict, scenarioTable, verdict } from './narrative'
import { bridgeFor, bridgeUnavailable, cardOrder, flipPair, flipSentences, flipsFor, fuelFlipFor, pairChoices, pairNames } from './results'
import { costParts } from './setup'
import type { CarShare } from './share'
import { SECTION_SWATCHES } from './style'

const ShareCar = lazy(() => import('./ShareCar'))

/*
 * The car decision page (slice 3c-1; the car decision redesign, CD1 to CD12) at #/c/car-decision, on the 3a and 3b engines.
 * Inputs: the options as compact rows, one editor open at a time, with Start from and Copy the car (./CarOptions.tsx);
 * then the horizon and the shared annual mileage, and the shared assumptions in a section. Results first (StickyResult):
 * the verdict in the phone bar; in the results column the answer (the verdict's gap as the headline, a bar per option,
 * the switch cost). Below the columns, sections with live summaries: where the money goes (cost bars and slim cards),
 * month by month (the chart, net cost or cash paid so far), what changes the answer (the pair's bridge and thresholds,
 * one pair picker) and how sure this is (the three cases, shown once an option has a range, and the sensitivity). Share
 * beside the title. The selected month, the pair, the open row and which sections are open are the page's only, never
 * stored. Uses no tax rules. Every figure is the engine's (compareOptions, flipPoints, fuelPriceFlip, costBridge,
 * costPerMile, apr) through ./definition.ts, ./results.ts, ./setup.ts and ./rates.ts; the page writes none.
 */

const session = sessionFor(carDecisionCalculator)

type Gbp = (amount: Money) => string
type Unit = 'months' | 'years'

const CASE_OPTIONS = VALUE_CASES.map((value) => ({ value, label: CASE_LABELS[value] }))
const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
]
const MAX_YEARS = Math.floor(MAX_HORIZON_MONTHS / MONTHS_PER_YEAR)

const SHARED_HINTS = {
  horizon: 'Every option is costed over the same time.',
  mileage: 'Miles a year for every option, unless an option drives a different distance.',
  valueCase: 'Which end value the results use. Shown once an option has a low and high value.',
  savingsReturn: 'What your money would earn a year after tax if it weren’t spent on the car: your own assumption.',
  generalIncrease: 'How much insurance, maintenance, VED and other costs rise each year. It can be negative.',
} as const

/** The phone bar's words when there is no verdict; the reason in full is in the results. */
const NO_VERDICT_SHORT: Record<NoVerdict, string> = {
  'one-option': 'No verdict: one option only',
  'no-full': 'No verdict: no option covers the horizon',
  'partial-lower': 'No verdict: see the results',
  'one-full': 'No verdict: one option covers the horizon',
}

/** What the page adds to the engines' assumptions. No figures. */
const PAGE_ASSUMPTIONS = [
  'Each car’s value falls (or rises) by the same percentage every year between today’s value and the end value: an illustrative shape, not a forecast.',
  'The low, expected and high end values are your own inputs. What a car is worth at the end is the most uncertain figure here and usually moves the answer most: try all three cases.',
  'The savings return is your own after-tax assumption, the same for every option.',
  'VED, insurance and the other running costs are the amounts you enter. Sumyard holds no VED figures and models no tax rules or electric car benefit rules.',
  'No replacement car is modelled: a car handed back at the end of a PCP leaves the rest of the horizon uncovered, so it is shown per month owned and not ordered against options that cover the whole horizon.',
  'A loan’s APR, and HP’s when there is no option to purchase fee, is worked out from the agreement’s payments under the APR rules. For a PCP, and HP with an option fee, the card shows the effective interest rate instead, which is not the lender’s APR.',
  'An optional cost or fee left empty counts as nothing. The price, the end values, the mileage, the fuel figures and the finance terms an option needs are never assumed: until they are entered, the option has no figures.',
  'The month-by-month chart shows each option’s net cost so far at the end of each month, in the end-value case chosen, from the same engine as the cards. A line stops where its car is handed back. Lines that cross are not an order: the cards are ordered at the horizon.',
  'The thresholds in “What changes the answer” are measured over the whole horizon, whatever month the chart shows.',
  'Near a threshold the two penny-rounded totals can be level, or pennies apart either way, over a narrow band: the search carries on past it and names the option lower on each side.',
  'The fuel or energy price threshold changes only the first option’s fuel or energy cost per mile, with its mileage, yearly fuel price change and everything else as entered. For an electric car it is home and public charging together, the split as entered.',
  '“Where the difference comes from” splits the difference in average cost per month owned between two options that cover the whole horizon into the parts each card shows: each part’s difference divided by the months owned, to the penny, so the parts add up to the difference.',
  'The sensitivity view moves one input at a time by a constant percentage of its current value (the end value in the case chosen, the savings return, the annual mileage or the fuel or energy price), with every other input held at its current value, and shows the engine’s change in average cost per month owned. Illustrative only, not a forecast and not advice.',
  'Average cost per month owned is the engine’s net cost per month of coverage: the net cost divided by the months the option covers.',
  'The verdict, the bottom line and the switch cost compare only options that cover the whole horizon. An option that covers less is never compared by total.',
  'Money in and out on each card is the cash that changes hands (upfront, each month, at the end), apart from the net cost.',
  'An option without a low and high end value uses its expected end value in all three cases.',
  'Every option drives the shared annual mileage unless it is set to drive a different distance.',
  'The cost bars put insurance, maintenance, VED and other costs together as running costs; the table under them lists each part the engine gives.',
  'Uses no tax rules: nothing here depends on the tax rules of any year.',
  'Illustrative only, not financial advice.',
]

const SHARED_FIELDS: readonly SharedField[] = ['horizonMonths', 'savingsReturn', 'generalIncrease', 'annualMileage']

const set = (patch: Partial<CarDecisionInputs>) => session.setInputs(patch)
const forget = (...fields: string[]) => {
  for (const field of fields) session.setFieldValid(field, true)
}

export default function CarDecisionPage() {
  const state = useStore(session)
  const amounts = useStore(settingsStore, (s) => s.amounts)
  const stored = state.inputs
  // Three cases only once an option has a range (CD10): until then every case is the expected one, so it is the one said.
  const anyRange = stored.options.some(hasRange)
  const inputs: CarDecisionInputs = useMemo(() => (anyRange ? stored : { ...stored, valueCase: 'expected' }), [stored, anyRange])
  const gbp: Gbp = (amount) => formatGBP(amount, amounts)
  const { keys, inserted, removed } = useItemKeys(inputs.options.length)
  const sharedInvalid = state.invalid.some((field) => (SHARED_FIELDS as readonly string[]).includes(field))
  const invalidFor = (key: number) =>
    state.invalid.flatMap((field) => (field.startsWith(`o${key}.`) ? [field.slice(`o${key}.`.length) as OptionField] : []))
  const heldKey = keys.map((key) => invalidFor(key).length > 0).join()
  // The engine's comparison: redo it only when the inputs or which options are held back change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: heldKey stands for the held options.
  const outcome = useMemo(() => {
    if (sharedInvalid) return null
    const held = new Set(keys.flatMap((key, index) => (invalidFor(key).length > 0 ? [index] : [])))
    return calculate(inputs, held)
  }, [sharedInvalid, inputs, heldKey])
  // The month the chart and readout show (the horizon until one is picked) and the flip pair: the page's, reset by a load.
  const [picked, setPicked] = useState<{ revision: number; month: number } | null>(null)
  const month = picked && picked.revision === state.revision ? Math.min(picked.month, inputs.horizonMonths) : inputs.horizonMonths
  const [chosenPair, setChosenPair] = useState<{ revision: number; pair: [number, number] } | null>(null)
  const ok = outcome?.kind === 'ok' ? outcome : null
  const choices = ok ? pairChoices(ok, inputs.valueCase) : []
  const defaultPair = ok ? flipPair(ok, inputs.valueCase) : null
  const pair: readonly [number, number] | null =
    chosenPair && chosenPair.revision === state.revision && chosenPair.pair.every((i) => choices.includes(i))
      ? chosenPair.pair
      : defaultPair
  const flips = useFlips(outcome, inputs, pair)
  // Sensitivity is worked out only while its section is open: it reruns the engine many times (docs/performance.md).
  const [sensitivityOpen, setSensitivityOpen] = useState(false)
  const sensitivity = useSensitivity(ok, inputs, sensitivityOpen)
  const [sharing, setSharing] = useState(false)
  const uniques = uniqueNames(inputs.options)
  const pickPair = (which: 0 | 1, index: number) => {
    const next: [number, number] = [pair?.[0] ?? index, pair?.[1] ?? index]
    next[which] = index
    setChosenPair({ revision: state.revision, pair: next })
  }
  // One pair for the bridge and the thresholds, chosen in one place (F56, CD8).
  const pairPicker =
    choices.length >= 2 && pair ? (
      <div data-pair-picker className="grid min-w-0 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {([0, 1] as const).map((which) => (
          <Select
            key={which}
            id={`cd-pair-${which === 0 ? 'first' : 'second'}`}
            label={which === 0 ? 'First option' : 'Second option'}
            value={String(pair[which])}
            options={choices.map((index) => ({ value: String(index), label: uniques[index]! }))}
            onChange={(value) => pickPair(which, Number(value))}
          />
        ))}
      </div>
    ) : null
  const bridge: BridgeState | null = !ok
    ? null
    : choices.length < 2 || !pair
      ? { kind: 'no-pair', reason: bridgeUnavailable(ok, uniques) }
      : pair[0] === pair[1]
        ? { kind: 'same' }
        : (() => {
            const found = bridgeFor(ok, inputs, pair)
            return found
              ? { kind: 'ready', names: pairNames(inputs, pair), bridge: found }
              : { kind: 'no-pair', reason: bridgeUnavailable(ok, uniques) }
          })()

  const names = inputs.options.map(optionName)
  const order = ok ? cardOrder(ok, inputs.valueCase, inputs.options.length) : []
  const cards: CardData[] = ok
    ? order.map((index) => ({
        index,
        name: names[index]!,
        kind: inputs.options[index]!.acquisition,
        status: ok.statuses[index]!,
        inputs: inputs.options[index]!,
      }))
    : []
  const rankRows: RankRow[] = cards.map(({ index, name, kind, status }) => ({ index, name, kind, status }))
  // The answer first (3d-1, CD5): the verdict from the engine's full-coverage ordering, in words, by engine index.
  const comparison = ok?.comparison ?? null
  const answerNames = ok ? engineNames(ok.statuses, uniques) : []
  const savingsReturn = outcome?.kind === 'ok' ? toEngineShared(inputs).savingsReturn : null
  const said = comparison && savingsReturn ? verdict(comparison, inputs.valueCase, answerNames, savingsReturn, gbp) : null
  // Costed options that differ in which running-cost boxes are left empty: one line under the verdict (3d-1 fix).
  const emptyNote = ok
    ? emptyCostsDiffer(
        ok.statuses.flatMap((status, index) =>
          status.kind === 'ok' ? [{ name: uniques[index]!, boxes: emptyRunningCosts(inputs.options[index]!) }] : [],
        ),
      )
    : null
  const value = said && said.kind !== 'none' ? said.short : null
  const label = 'Lowest net cost under these assumptions'
  const emptyText =
    outcome === null
      ? 'Fix the highlighted inputs'
      : outcome.kind === 'missing-shared'
        ? 'Enter the shared assumptions'
        : said?.kind === 'none'
          ? NO_VERDICT_SHORT[said.reason]
          : 'Fill in two options to compare'
  // What is shown is what is shared (CD9).
  const share: CarShare | null = useMemo(
    () => (ok && comparison && said ? { outcome: ok, inputs, verdict: said, names: answerNames } : null),
    [ok, comparison, said, inputs, answerNames],
  )

  const assumptions = [
    ...new Set([
      ...(ok?.comparison
        ? [
            ...ok.comparison.assumptions,
            ...ok.comparison.options.flatMap((o) => o.assumptions),
            ...ok.comparison.options.flatMap((o) =>
              o.finance
                ? o.finance.assumptions.map(
                    (line) => `${o.acquisition === 'keep' ? 'Finance still owed on a kept car' : 'Finance agreements'}: ${line}`,
                  )
                : [],
            ),
          ]
        : []),
      ...PAGE_ASSUMPTIONS,
    ]),
  ]
  const caseControl = (id: string) =>
    anyRange && (
      <Segmented
        id={id}
        label="End value"
        hint={id === 'cd-case' ? SHARED_HINTS.valueCase : undefined}
        value={inputs.valueCase}
        options={CASE_OPTIONS}
        onChange={(valueCase: ValueCase) => set({ valueCase })}
      />
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 id="main-title" tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
            {carDecisionCalculator.name}
          </h1>
          <p className="text-text-muted">{PAGE_SUMMARY}</p>
          {/* On a phone the badge is in the sticky bar instead. */}
          <div className="hidden md:flex">
            <NoTaxRulesBadge />
          </div>
        </div>
        <Button
          id="cd-share"
          variant="primary"
          disabled={!share}
          aria-haspopup="dialog"
          onClick={() => setSharing(true)}
          className="h-auto min-h-touch py-2"
        >
          <Share2 />
          Share
        </Button>
      </div>

      <StickyResult
        label={label}
        value={value}
        emptyText={emptyText}
        announcement={said ? said.text : null}
        controls={
          <>
            {caseControl('cd-case-bar')}
            <div className="flex">
              <NoTaxRulesBadge />
            </div>
          </>
        }
        results={
          outcome === null ? (
            <Waiting>Fix the highlighted inputs to see results.</Waiting>
          ) : outcome.kind === 'missing-shared' ? (
            <Waiting>
              Enter the {outcome.missing.map((f) => SHARED_LABELS[f].toLowerCase()).join(' and the ')} under Shared assumptions to see
              results.
            </Waiting>
          ) : outcome.kind === 'refused' ? (
            <RefusalNotice refusal={outcome.refusal} />
          ) : comparison && said && savingsReturn ? (
            <AnswerCard
              verdict={said}
              emptyNote={emptyNote}
              comparison={comparison}
              valueCase={inputs.valueCase}
              names={answerNames}
              rows={rankRows}
              savingsReturn={savingsReturn}
              table={<CompareTable cards={cards} valueCase={inputs.valueCase} gbp={gbp} />}
              gbp={gbp}
            />
          ) : (
            <Waiting>Fill in at least one option to see results. Each option says what it still needs.</Waiting>
          )
        }
      >
        <ScenarioBar calculator={carDecisionCalculator} session={session} />
        {/* Keyed by revision: a loaded scenario or a fresh start resets every box, the open row and which sections are open. */}
        <CarOptions
          key={`options-${state.revision}`}
          inputs={inputs}
          keys={keys}
          inserted={inserted}
          removed={removed}
          invalidFor={invalidFor}
          statuses={ok?.statuses ?? null}
          gbp={gbp}
          set={set}
          forget={forget}
          setValid={(field, valid) => session.setFieldValid(field, valid)}
          revision={state.revision}
          getRevision={() => session.get().revision}
          getOptions={() => session.get().inputs.options}
        />
        <SharedControls key={`shared-${state.revision}`} inputs={inputs} invalid={state.invalid} />
      </StickyResult>

      {ok && cards.length > 0 && (
        <div data-result-sections className="flex min-w-0 flex-col gap-4">
          <Section
            id="cd-section-money"
            title="Where the money goes"
            summary={moneySummary(cards, inputs.valueCase)}
            icon={<IconTile swatch={SECTION_SWATCHES.money} size="sm" />}
            defaultOpen
          >
            <CostSection cards={cards} valueCase={inputs.valueCase} gbp={gbp} />
          </Section>
          <Section
            id="cd-section-month"
            title="Month by month"
            summary={`Net cost and cash paid so far, each month to month ${inputs.horizonMonths}`}
            icon={<IconTile swatch={SECTION_SWATCHES.month} size="sm" />}
          >
            <CrossoverView
              outcome={ok}
              inputs={inputs}
              month={month}
              onMonth={(next) => setPicked({ revision: state.revision, month: next })}
              gbp={gbp}
            />
          </Section>
          <Section
            id="cd-section-changes"
            title="What changes the answer"
            summary={changesSummary(flips, inputs, gbp)}
            icon={<IconTile swatch={SECTION_SWATCHES.changes} size="sm" />}
          >
            {pairPicker}
            {pairPicker && <p className="text-xs text-text-muted">Both parts below use this pair; by default the two lowest.</p>}
            {bridge && <BridgeSection state={bridge} valueCase={inputs.valueCase} gbp={gbp} />}
            <WhatChanges state={flips} inputs={inputs} gbp={gbp} />
          </Section>
          <Section
            id="cd-section-sure"
            title="How sure is this"
            summary={sureSummary(anyRange, comparison, answerNames)}
            icon={<IconTile swatch={SECTION_SWATCHES.sure} size="sm" />}
          >
            {anyRange && comparison ? (
              <>
                {caseControl('cd-case')}
                <ScenarioTable comparison={comparison} valueCase={inputs.valueCase} names={answerNames} gbp={gbp} />
              </>
            ) : (
              <p data-no-range className="text-sm text-text">
                What a car is worth at the end is usually the most uncertain figure. Turn on “{RANGE_SWITCH}” in an option to see the low,
                expected and high cases side by side.
              </p>
            )}
            <SensitivityView state={sensitivity} inputs={inputs} amounts={amounts} onOpenChange={setSensitivityOpen} />
          </Section>
        </div>
      )}

      <AssumptionsPanel items={assumptions}>
        <p className="text-text-muted">Illustrative only, not financial advice. {DISCLAIMER}</p>
      </AssumptionsPanel>

      {sharing && share && (
        <Suspense fallback={null}>
          <ShareCar
            share={share}
            onClose={() => {
              setSharing(false)
              document.getElementById('cd-share')?.focus()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

/** The page's one line under the title (shorter than the calculator's summary, which the home page and compare use). */
const PAGE_SUMMARY =
  'Keep your car, or buy with cash, a loan, HP or PCP: what each really costs a month over the same time, and what would change the answer.'

/** The range switch's label, named in "How sure is this". */
const RANGE_SWITCH = 'Add a low and high end value'

/** "Where the money goes" in one line: the part that is largest for most options. */
function moneySummary(cards: readonly CardData[], valueCase: ValueCase): string {
  const largest = cards.flatMap((card) => {
    if (card.status.kind !== 'ok') return []
    const parts = costParts(card.status.result.cases[valueCase].breakdown)
    const top = parts.reduce((a, b) => (compare(b.value, a.value) > 0 ? b : a))
    return [top.label]
  })
  if (largest.length === 0) return 'No option has figures yet'
  const counts = new Map<string, number>()
  for (const part of largest) counts.set(part, (counts.get(part) ?? 0) + 1)
  const [part, count] = [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))
  return largest.length === 1
    ? `The largest part is ${part.toLowerCase()}`
    : `${part} is the largest part for ${count === largest.length ? 'every option' : `${count} of ${largest.length} options`}`
}

/** "What changes the answer" in one line. */
function changesSummary(flips: FlipState, inputs: CarDecisionInputs, gbp: Gbp): string {
  if (flips.kind === 'no-pair') return 'Needs two options that cover the whole horizon'
  if (flips.kind === 'same') return 'Choose two different options'
  if (flips.kind === 'pending') return 'Working out once the inputs settle'
  if (flips.kind === 'refused') return 'Can’t be worked out for these inputs'
  const [a, b] = pairNames(inputs, flips.pair)
  const count = flipSentences(flips.flips, [a, b], gbp).length + (flips.fuel ? 1 : 0)
  return `${a} and ${b}: where the difference comes from, and ${count} threshold${count === 1 ? '' : 's'}`
}

/** "How sure is this" in one line. */
function sureSummary(anyRange: boolean, comparison: Parameters<typeof scenarioTable>[0] | null, names: readonly string[]): string {
  if (!anyRange || !comparison) return 'Add a low and high end value to an option to see three cases; what moves each cost most'
  return scenarioTable(comparison, names).sentence
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <div data-results-waiting>
      <InlineNotice tone="warning" title="No results yet">
        <p>{children}</p>
      </InlineNotice>
    </div>
  )
}

/** Flip points by inputs and pair: going back to a pair or inputs already seen shows them at once. Small, cleared when full. */
const flipMemo = new Map<string, FlipState>()
const FLIP_MEMO_SIZE = MAX_CAR_OPTIONS * MAX_CAR_OPTIONS

/**
 * The flip points for the pair, worked out once the inputs have settled (SETTLE_MS, as the announcement): a search costs
 * both options many times, too slow to redo on each keystroke (docs/performance.md). Another pair on the same inputs is
 * worked out at once.
 */
function useFlips(
  outcome: ReturnType<typeof calculate> | null,
  inputs: CarDecisionInputs,
  pair: readonly [number, number] | null,
): FlipState {
  const [ready, setReady] = useState<{ for: unknown; pair: string; state: FlipState } | null>(null)
  const settled = useRef<unknown>(null)
  const pairable = outcome?.kind === 'ok' && outcome.comparison !== null && outcome.comparison.ranking[inputs.valueCase].full.length >= 2
  const same = pair !== null && pair[0] === pair[1]
  const pairKey = pair ? pair.join() : ''
  // biome-ignore lint/correctness/useExhaustiveDependencies: pairKey stands for the pair.
  useEffect(() => {
    if (!pairable || !outcome || !pair || same || outcome.kind !== 'ok') return
    const status = (index: number) => outcome.statuses[index]!
    const key = JSON.stringify([
      pair.map((index) => {
        const s = status(index)
        return s.kind === 'ok' ? s.option : index
      }),
      toEngineShared(inputs),
      inputs.valueCase,
      pair,
    ])
    let timer: ReturnType<typeof setTimeout>
    const show = (state: FlipState) => setReady({ for: outcome, pair: pair.join(), state })
    // The fuel or energy price threshold a step after the rest (F54): each search is one task, so the page can respond between.
    const fuelStep = (state: Extract<FlipState, { kind: 'ready' }>) => {
      timer = setTimeout(() => {
        const first = status(pair[0])
        const flip = fuelFlipFor(outcome, inputs, pair)
        const done: FlipState =
          flip && first.kind === 'ok' ? { ...state, fuel: { flip, fuel: first.option.car.fuel } } : { kind: 'refused' }
        if (flipMemo.size >= FLIP_MEMO_SIZE) flipMemo.clear()
        flipMemo.set(key, done)
        show(done)
      }, 0)
    }
    const work = () => {
      let state = flipMemo.get(key)
      if (!state) {
        const lowestPair = flipPair(outcome, inputs.valueCase)
        const found = flipsFor(outcome, inputs, pair)
        state = found
          ? {
              kind: 'ready',
              ...found,
              lowest: lowestPair !== null && lowestPair[0] === pair[0] && lowestPair[1] === pair[1],
              fuel: null,
            }
          : { kind: 'refused' }
      }
      settled.current = outcome
      show(state)
      if (state.kind === 'ready' && !state.fuel) fuelStep(state)
      else if (!flipMemo.has(key)) flipMemo.set(key, state)
    }
    timer = setTimeout(work, settled.current === outcome ? 0 : SETTLE_MS)
    return () => clearTimeout(timer)
  }, [pairable, outcome, inputs, pairKey, same])
  if (!pairable) return { kind: 'no-pair' }
  if (same) return { kind: 'same' }
  return ready && ready.for === outcome && ready.pair === pairKey ? ready.state : { kind: 'pending' }
}

const validShared = (field: SharedField) => (ok: boolean) => session.setFieldValid(field, ok)

/** The horizon and the shared annual mileage (always visible), then the shared assumptions in a section (U1 to U3). */
function SharedControls({ inputs, invalid }: { inputs: CarDecisionInputs; invalid: readonly string[] }) {
  const [unit, setUnit] = useState<Unit>('months')
  // Open while the results still need one of its boxes (U42); once both are entered its summary says them.
  const [openOnMount] = useState(() => inputs.savingsReturn === null || inputs.generalIncrease === null)
  const months = inputs.horizonMonths
  const years = Math.floor(months / MONTHS_PER_YEAR)
  const rest = months % MONTHS_PER_YEAR
  const inWords = `${months} month${months === 1 ? '' : 's'}${years > 0 ? `: ${years} year${years === 1 ? '' : 's'}${rest > 0 ? ` and ${rest} month${rest === 1 ? '' : 's'}` : ''}` : ''}`
  const changeUnit = (next: Unit) => {
    setUnit(next)
    // Years are whole: the horizon moves to the nearest whole year, at least one.
    if (next === 'years' && rest !== 0) set({ horizonMonths: Math.max(1, Math.round(months / MONTHS_PER_YEAR)) * MONTHS_PER_YEAR })
  }
  const summary = (() => {
    if (invalid.includes('savingsReturn') || invalid.includes('generalIncrease')) return 'Fix the highlighted input'
    const part = (field: 'savingsReturn' | 'generalIncrease', what: string) =>
      inputs[field] === null ? `${what} not entered` : `${what} ${formatPercent(percentRatio(inputs[field]!))} a year`
    if (inputs.savingsReturn === null && inputs.generalIncrease === null)
      return 'Needed for results: a savings return and a yearly increase'
    return `${part('savingsReturn', 'Savings return')}; ${part('generalIncrease', 'costs rise')}`
  })()
  return (
    <>
      <section
        data-shared-controls
        aria-labelledby="cd-shared-title"
        className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
      >
        <h2 id="cd-shared-title" className="flex items-center gap-2 text-base font-semibold">
          <IconTile swatch={SECTION_SWATCHES.horizon} size="sm" />
          For every option
        </h2>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <NumberInput
            id="cd-horizon"
            label={unit === 'months' ? 'Over how many months?' : 'Over how many years?'}
            hint={SHARED_HINTS.horizon}
            value={unit === 'months' ? months : years}
            min={unit === 'months' ? SHARED_LIMITS.horizonMonths.min : 1}
            max={unit === 'months' ? SHARED_LIMITS.horizonMonths.max : MAX_YEARS}
            suffix={unit}
            onChange={(n) => set({ horizonMonths: unit === 'months' ? n : n * MONTHS_PER_YEAR })}
            onValidityChange={validShared('horizonMonths')}
          />
          <Segmented id="cd-horizon-unit" label="In" value={unit} options={UNIT_OPTIONS} onChange={changeUnit} />
        </div>
        <Field id="cd-horizon-range" label="Horizon slider">
          <input
            id="cd-horizon-range"
            type="range"
            min={unit === 'months' ? SHARED_LIMITS.horizonMonths.min : MONTHS_PER_YEAR}
            max={unit === 'months' ? SHARED_LIMITS.horizonMonths.max : MAX_YEARS * MONTHS_PER_YEAR}
            step={unit === 'months' ? 1 : MONTHS_PER_YEAR}
            value={months}
            aria-valuetext={inWords}
            aria-describedby="cd-horizon-words"
            onChange={(e) => {
              forget('horizonMonths')
              set({ horizonMonths: Number(e.currentTarget.value) })
            }}
            className="min-h-touch w-full accent-accent"
          />
          <p id="cd-horizon-words" className="text-xs text-text-muted">
            {inWords}
          </p>
        </Field>
        <NumberInput
          id="cd-mileage"
          label="Annual mileage"
          hint={SHARED_HINTS.mileage}
          allowEmpty
          value={inputs.annualMileage}
          min={0}
          max={MAX_ANNUAL_MILEAGE}
          suffix="miles"
          onChange={(annualMileage: number | null) => set({ annualMileage })}
          onValidityChange={validShared('annualMileage')}
        />
      </section>
      <Section
        id="cd-section-shared"
        title="Shared assumptions"
        summary={summary}
        defaultOpen={openOnMount}
        icon={<IconTile swatch={SECTION_SWATCHES.shared} size="sm" />}
      >
        <PercentInput
          id="cd-savings"
          label={SHARED_LABELS.savingsReturn}
          hint={SHARED_HINTS.savingsReturn}
          allowEmpty
          value={inputs.savingsReturn}
          min={SHARED_LIMITS.savingsReturn.min}
          max={SHARED_LIMITS.savingsReturn.max}
          maxDecimals={DECIMALS}
          onChange={(savingsReturn) => set({ savingsReturn })}
          onValidityChange={validShared('savingsReturn')}
        />
        <PercentInput
          id="cd-increase"
          label={SHARED_LABELS.generalIncrease}
          hint={SHARED_HINTS.generalIncrease}
          allowEmpty
          value={inputs.generalIncrease}
          min={SHARED_LIMITS.generalIncrease.min}
          max={SHARED_LIMITS.generalIncrease.max}
          maxDecimals={DECIMALS}
          onChange={(generalIncrease) => set({ generalIncrease })}
          onValidityChange={validShared('generalIncrease')}
        />
      </Section>
    </>
  )
}
