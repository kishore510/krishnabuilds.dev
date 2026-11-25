import { add, type Money, ZERO } from '@/lib/money'
import type { Breakdown } from '../car-ownership/types'
import { ACQUISITION_LABELS, blankOption, type OptionField, type OptionInputs } from './definition'
import type { CostPartId } from './style'

/*
 * The car decision redesign's page helpers: Start from (CD3), Copy the car (CD4), an option row's one-line summary (CD2)
 * and the cost parts the bars draw (CD6). No figure is held here: a template sets kinds and names only, a summary reads
 * the inputs, and the parts are the engine's breakdown, the running costs summed in whole pence.
 */

type Gbp = (amount: Money) => string

export type TemplateId = 'keep-or-replace' | 'cash-or-finance' | 'finance-offers'

export interface StartTemplate {
  readonly id: TemplateId
  readonly label: string
  readonly hint: string
  readonly options: readonly (readonly [OptionInputs['acquisition'], string])[]
}

/** Common comparisons, as kinds and names (CD3). */
export const START_TEMPLATES: readonly StartTemplate[] = [
  {
    id: 'keep-or-replace',
    label: 'Keep or replace',
    hint: 'Your car now against a new one on PCP.',
    options: [
      ['keep', 'Keep my car'],
      ['pcp', 'New car on PCP'],
    ],
  },
  {
    id: 'cash-or-finance',
    label: 'Cash or finance',
    hint: 'One car three ways: fill in the first, then copy its car into the others.',
    options: [
      ['cash', 'Pay cash'],
      ['loan', 'Loan'],
      ['pcp', 'PCP'],
    ],
  },
  {
    id: 'finance-offers',
    label: 'Compare finance offers',
    hint: 'A loan, HP and PCP: fill in the first car, then copy it into the others.',
    options: [
      ['loan', 'Loan'],
      ['hire-purchase', 'HP'],
      ['pcp', 'PCP'],
    ],
  },
]

/** A template's options: fresh, every amount empty, named. */
export function startFrom(id: TemplateId): OptionInputs[] {
  const template = START_TEMPLATES.find((t) => t.id === id)!
  return template.options.map(([kind, name]) => ({ ...blankOption(kind), name }))
}

/** What "Copy the car" takes from another option (CD4): the car, its mileage, fuel and running costs. Never finance. */
export const CAR_FIELDS: readonly OptionField[] = [
  'value',
  'endLow',
  'endExpected',
  'endHigh',
  'annualMileage',
  'ownMileage',
  'fuelMode',
  'milesPerGallon',
  'pencePerLitre',
  'milesPerKwh',
  'homeShare',
  'homePencePerKwh',
  'publicPencePerKwh',
  'pencePerMile',
  'fuelPriceChange',
  'insurance',
  'maintenance',
  'ved',
  'other',
]

/** The target with the source's car (CD4); its name, kind and finance stay its own. */
export function copyCar(source: OptionInputs, target: OptionInputs): OptionInputs {
  const copied: Record<string, unknown> = { ...target }
  for (const field of CAR_FIELDS) copied[field] = source[field]
  return copied as unknown as OptionInputs
}

/** An option row's one-line summary (CD2): how the car is had and its main figures, from the inputs. */
export function optionSummary(option: OptionInputs, gbp: Gbp): string {
  const parts: string[] = [ACQUISITION_LABELS[option.acquisition]]
  if (option.value !== null) parts.push(option.acquisition === 'keep' ? `worth ${gbp(option.value)}` : gbp(option.value))
  if (option.acquisition === 'keep' && option.owesFinance && option.settlement !== null) parts.push(`${gbp(option.settlement)} to settle`)
  if (option.acquisition === 'loan' && option.loanAmount !== null && option.term !== null)
    parts.push(`${gbp(option.loanAmount)} over ${option.term} months`)
  else if ((option.acquisition === 'hire-purchase' || option.acquisition === 'pcp') && option.term !== null)
    parts.push(`${option.term} months`)
  if (parts.length === 1) parts.push('not filled in yet')
  return parts.join(' · ')
}

/** Each cost part's name (CD6, CD7). */
export const COST_PART_LABELS: Record<CostPartId, string> = {
  depreciation: 'Depreciation',
  finance: 'Interest and fees',
  handedBack: 'Equity handed back',
  fuel: 'Fuel or energy',
  running: 'Running costs',
  lostInterest: 'Interest your cash could have earned',
}

export interface CostPart {
  readonly id: CostPartId
  readonly label: string
  readonly value: Money
}

/**
 * The engine's breakdown (F26) as the bars' parts: insurance, maintenance, VED and other together as running costs, the
 * rest as they are. Whole pence summed exactly, so the parts still add up to the net cost.
 */
export function costParts(b: Breakdown): CostPart[] {
  const values: Record<CostPartId, Money> = {
    depreciation: b.depreciation,
    finance: b.interestAndFees,
    handedBack: b.equityHandedBack,
    fuel: b.fuel,
    running: [b.insurance, b.maintenance, b.ved, b.other].reduce((sum, part) => add(sum, part), ZERO),
    lostInterest: b.opportunityCost,
  }
  return (Object.keys(COST_PART_LABELS) as CostPartId[]).map((id) => ({ id, label: COST_PART_LABELS[id], value: values[id] }))
}
