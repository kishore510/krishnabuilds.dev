// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { tally } from '@/calculators/fixtures/fakeCalculators'
import { CALCULATORS } from '@/calculators/index'
import { configFor } from '@/calculators/session'
import type { Scenario } from '@/scenarios/scenario'
import { mount } from '@/test/dom'
import { cardFigure, HomePage } from './HomePage'
import { HOME_GROUPS } from './homeCatalogue'

const scenario = (calculatorId: string, name: string, updatedAt: string, inputs: unknown): Scenario => ({
  id: `${calculatorId}-${name}`,
  calculatorId,
  name,
  inputs,
  inputsVersion: CALCULATORS.get(calculatorId)?.inputsVersion ?? 1,
  createdAt: updatedAt,
  updatedAt,
})

const ids = HOME_GROUPS.flatMap((g) => g.entries.map((e) => e.id))

describe('home catalogue', () => {
  it('puts every registered calculator in exactly one group, and nothing else', () => {
    expect([...ids].sort()).toEqual(
      CALCULATORS.list()
        .map((c) => c.id)
        .sort(),
    )
  })

  it('gives every calculator a home figure', () => {
    for (const calculator of CALCULATORS.list()) expect(calculator.homeFigure, calculator.id).toBeTypeOf('function')
  })

  it('finds each summary row it names (fresh inputs give a result for these three)', () => {
    for (const id of ['optimiser', 'budget', 'compound-interest']) {
      const calculator = CALCULATORS.get(id)!
      expect(calculator.homeFigure!(calculator.defaultInputs(), configFor(undefined)), id).not.toBeNull()
    }
  })

  it('shows the lump sum and the options counted, never a leg or a winner (G13)', () => {
    const next = CALCULATORS.get('next-pound')!
    expect(next.homeFigure!(next.defaultInputs(), configFor(undefined))?.value.kind).toBe('money')
    expect(next.homeFigure!(next.defaultInputs(), configFor(undefined))?.caption).toMatch(/^over \d+ years?$/)
    const car = CALCULATORS.get('car-decision')!
    expect(car.homeFigure!(car.defaultInputs(), configFor(undefined))?.value).toEqual({
      kind: 'text',
      text: expect.stringMatching(/^\d+ options?$/),
    })
  })
})

describe('cardFigure', () => {
  const budget = CALCULATORS.get('budget')!

  it('is none with no saved scenario', () => {
    expect(cardFigure(budget, [])).toEqual({ kind: 'none' })
  })

  it('uses the most recently updated scenario and counts the rest', () => {
    const inputs = budget.defaultInputs()
    const figure = cardFigure(budget, [
      scenario('budget', 'Old', '2026-01-01T00:00:00.000Z', inputs),
      scenario('budget', 'New', '2026-03-01T00:00:00.000Z', inputs),
      scenario('budget', 'Middle', '2026-02-01T00:00:00.000Z', inputs),
      scenario('compound-interest', 'Other', '2026-04-01T00:00:00.000Z', {}),
    ])
    expect(figure).toMatchObject({ kind: 'figure', name: 'New', more: 2, figure: { caption: 'left over a year' } })
  })

  it('says open to see results when there is no figure (refused, or none defined)', () => {
    const mortgage = CALCULATORS.get('mortgage')!
    const refused = cardFigure(mortgage, [scenario('mortgage', 'Fix', '2026-01-01T00:00:00.000Z', mortgage.defaultInputs())])
    expect(refused).toEqual({ kind: 'no-result', name: 'Fix', more: 0 })
    const fake = cardFigure(tally, [scenario('tally', 'T', '2026-01-01T00:00:00.000Z', { count: 1, label: '' })])
    expect(fake).toEqual({ kind: 'no-result', name: 'T', more: 0 })
  })
})

describe('HomePage', () => {
  it('shows each group as a heading with its calculators as links', () => {
    const { host, unmount } = mount(<HomePage />)
    const headings = [...host.querySelectorAll('h2')].map((h) => h.textContent)
    expect(headings).toEqual(HOME_GROUPS.map((g) => g.title))
    const links = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(links).toEqual(ids.map((id) => `#/c/${id}`))
    expect(host.textContent).toContain('No saved scenarios yet')
    unmount()
  })
})
