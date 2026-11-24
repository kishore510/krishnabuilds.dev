import { describe, expect, it } from 'vitest'
import { taxYear } from '@/config/tax/2026-27'
import { taxYearLabel } from '@/config/tax/index'
import { formatGBP } from '@/lib/format'
import { fromPounds, toPence } from '@/lib/money'
import { breakdown } from './breakdown'
import { takeHome } from './calc'
import { optimiserCalculator, REGION_LABELS, toTaxInputs } from './definition'
import { shareCsv, shareFileName, shareModel, type TakeHomeShare } from './share'
import { DEFAULT_POLICY } from './types'

/* What a shared take-home says (TH4, TH5). Expected figures come from the engine, never written here. */

const share = (patch: Record<string, unknown> = {}, period: 'year' | 'month' = 'month'): TakeHomeShare => {
  const inputs = { ...optimiserCalculator.defaultInputs(), salary: fromPounds(70_000), studentLoans: ['plan2'], ...patch }
  const result = takeHome(toTaxInputs(inputs as ReturnType<typeof optimiserCalculator.defaultInputs>), taxYear, DEFAULT_POLICY)
  if (!result.ok) throw new Error('refused')
  return {
    year: breakdown(result.annual, 'year'),
    month: breakdown(result.annual, 'month'),
    period,
    taxYear: taxYearLabel(taxYear.id),
    region: REGION_LABELS.rUK,
  }
}
const now = new Date(2026, 10, 24)
const on = { amounts: true, names: false }
const off = { amounts: false, names: false }

describe('take-home share model', () => {
  it('headline is take-home for the chosen period; the parts add up to gross pay, nothing drawn at nothing', () => {
    for (const period of ['year', 'month'] as const) {
      const s = share({}, period)
      const shown = period === 'year' ? s.year : s.month
      const m = shareModel(s, on, 'pence', now)
      expect(m.headline).toBe(formatGBP(shown.takeHome, 'pence'))
      expect(m.total).toBe(toPence(shown.gross))
      expect(m.parts.every((p) => p.year > 0)).toBe(true)
      expect(m.parts.map((p) => p.id)).toEqual(['incomeTax', 'nationalInsurance', 'studentLoan', 'takeHome'])
      expect(m.parts.every((p) => p.colour.length > 0)).toBe(true)
    }
  })

  it('names the tax year and region, and no item names or tax code (TH5)', () => {
    const m = shareModel(share({ taxCode: '1257L' }), on, 'pence', now)
    expect(m.sentence).toContain(taxYearLabel(taxYear.id))
    expect(m.sentence).toContain(REGION_LABELS.rUK)
    expect(JSON.stringify(m)).not.toContain('1257L')
  })

  it('with amounts off, no pound figure anywhere: model, text and CSV (TH4)', () => {
    const s = share()
    const m = shareModel(s, off, 'pence', now)
    expect(JSON.stringify({ ...m, parts: m.parts.map((p) => ({ ...p, year: 0 })), total: 0 })).not.toMatch(/£/)
    const csv = shareCsv(s, off)
    expect(csv).not.toMatch(/£|\d+\.\d\d,/)
    expect(csv.split('\r\n')[0]).toBe('"Part","Of gross pay"')
  })

  it('CSV: gross, each part with something in it and take-home, a month and a year, from whole pence', () => {
    const s = share()
    const lines = shareCsv(s, on).split('\r\n')
    expect(lines[0]).toBe('"Part","A month","A year","Of gross pay"')
    expect(lines[1]!.startsWith('"Gross pay",')).toBe(true)
    expect(lines.some((l) => l.startsWith('"Student loan",'))).toBe(true)
    expect(lines.some((l) => l.startsWith('"Child Benefit charge",'))).toBe(false)
    const take = lines.find((l) => l.startsWith('"Take-home",'))!
    expect(take.split(',')[2]).toBe((toPence(s.year.takeHome) / 100).toFixed(2))
  })

  it('file names start sumyard-take-home with the month', () => {
    expect(shareFileName(now, 'png')).toBe('sumyard-take-home-2026-11.png')
  })
})
