import { describe, expect, it } from 'vitest'
import { shareText } from '@/components/share/model'
import { formatGBP } from '@/lib/format'
import type { Money } from '@/lib/money'
import { type CarDecisionInputs, calculate, toEngineShared, uniqueNames } from './definition'
import { inputs, keep, loan, ownerPage, pcp } from './fixtures/inputs'
import { engineNames, verdict } from './narrative'
import { type CarShare, shareCsv, shareModel } from './share'

/*
 * Sharing a car decision (CD9): what is shared, amounts off as percentages above the lowest with no pound figure, and
 * option names off as how each car is had. Figures are the engine's; the expected text comes from the owner's page.
 */

const NOW = new Date(2026, 10, 24)

function shareOf(i: CarDecisionInputs): CarShare {
  const outcome = calculate(i)
  if (outcome.kind !== 'ok' || !outcome.comparison) throw new Error('not compared')
  const names = engineNames(outcome.statuses, uniqueNames(i.options))
  const gbp = (amount: Money) => formatGBP(amount, 'pence')
  return {
    outcome,
    inputs: i,
    verdict: verdict(outcome.comparison, i.valueCase, names, toEngineShared(i).savingsReturn, gbp),
    names,
  }
}

const all = { amounts: true, names: true }

describe('share model (CD9)', () => {
  it('the owner’s page: the lowest, the gap a month and in all, each option a month', () => {
    const m = shareModel(shareOf(ownerPage()), all, 'pence', NOW)
    expect(m.headline).toBe('Current car')
    expect(m.sentence).toBe('£182.26 a month less than New car PCP')
    expect(m.stats).toContainEqual({ label: 'Less than New car PCP in all', value: '£8,748.56' })
    expect(m.tiles.map((t) => [t.name, t.value])).toEqual([
      ['Current car', '£379.85 a month'],
      ['New car PCP', '£562.11 a month'],
    ])
    expect(m.partsTitle).toContain('Current car')
    expect(m.biggest).toEqual(['New car PCP: £182.26 a month more'])
  })

  it('the parts are the lowest option’s above nothing, each with the other options’ figure', () => {
    const s = shareOf(inputs([keep(), loan(), pcp()]))
    const m = shareModel(s, all, 'pence', NOW)
    expect(m.parts.length).toBeGreaterThan(0)
    for (const p of m.parts) {
      expect(p.year).toBeGreaterThan(0)
      expect(p.lines).toHaveLength(2)
    }
    expect(m.total).toBe(m.parts.reduce((t, p) => t + p.year, 0))
  })

  it('amounts off: no pound figure anywhere, each option above the lowest as a percentage', () => {
    const s = shareOf(ownerPage())
    const m = shareModel(s, { amounts: false, names: true }, 'pence', NOW)
    const text = shareText(m)
    expect(text).not.toMatch(/£/)
    expect(shareCsv(s, { amounts: false, names: true })).not.toMatch(/£|\d+\.\d\d(,|\r)/)
    expect(m.tiles.map((t) => t.value)).toEqual(['Lowest', expect.stringMatching(/^\+\d+(\.\d)?%$/)])
    expect(m.sentence).toMatch(/^New car PCP costs \d+(\.\d)?% more a month$/)
  })

  it('names off: each option by how the car is had, numbered when two are the same', () => {
    const s = shareOf(inputs([loan({ name: 'Dealer A' }), loan({ name: 'Dealer B' }), keep({ name: 'My old car' })]))
    const m = shareModel(s, { amounts: true, names: false }, 'pence', NOW)
    const text = shareText(m)
    for (const name of ['Dealer A', 'Dealer B', 'My old car']) expect(text).not.toContain(name)
    expect(m.tiles.map((t) => t.name).sort()).toEqual(['Keep current car', 'Loan 1', 'Loan 2'])
    expect(shareCsv(s, { amounts: true, names: false })).not.toMatch(/Dealer|My old car/)
  })

  it('the CSV has each option’s cost a month, total and every part, in pounds and pence', () => {
    const csv = shareCsv(shareOf(ownerPage()), all)
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('"Figure","Current car","New car PCP"')
    expect(lines[1]).toBe('"Average cost per month owned",379.85,562.11')
    expect(lines.map((l) => l.split(',')[0])).toEqual([
      '"Figure"',
      '"Average cost per month owned"',
      '"Total net cost"',
      '"Months covered"',
      '"Depreciation"',
      '"Interest and fees"',
      '"Equity handed back"',
      '"Fuel or energy"',
      '"Running costs"',
      '"Interest your cash could have earned"',
    ])
  })
})
