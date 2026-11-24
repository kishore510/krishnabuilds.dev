import { describe, expect, it } from 'vitest'
import { shareText } from '@/components/share/model'
import { formatGBP, formatPercent } from '@/lib/format'
import { fromPounds, percent, toPence } from '@/lib/money'
import { overpay } from './calc'
import { yearsAndMonths } from './definition'
import { inputs } from './fixtures/inputs'
import { type MortgageShare, shareCsv, shareFileName, shareModel } from './share'
import type { MortgageInputs } from './types'

/* What a shared mortgage overpayment says (the mortgage redesign). Every figure is the engine's; contract figures are made up. */

const NOW = new Date(2026, 10, 24)
const ON = { amounts: true, names: true }
const OFF = { amounts: false, names: true }

function share(overrides: Partial<MortgageInputs> = {}, whatIf = false): MortgageShare {
  const i = inputs({ regular: { amount: fromPounds(300), fromMonth: 1, toMonth: 300 }, ...overrides })
  const out = overpay(i)
  if (!out.ok) throw new Error('refused')
  return { result: out.result, inputs: i, whatIf }
}

const withCharge = {
  lumpSums: [{ month: 3, amount: fromPounds(40_000) }],
  erc: { rate: percent('3'), endMonth: 24, allowance: { kind: 'rate' as const, rate: percent('10') } },
}

describe('shareModel', () => {
  it('amounts on: interest saved, the time saved, the parts adding up to the total paid, the returns', () => {
    const s = share(withCharge)
    const m = shareModel(s, ON, 'pence', NOW)
    const r = s.result
    expect(m.title).toBe('Mortgage overpayment')
    expect(m.headline).toBe(formatGBP(r.interestSaved, 'pence'))
    expect(m.sentence).toBe(`Cleared in ${yearsAndMonths(r.overpaying.payoffMonth!)}, not ${yearsAndMonths(r.baseline.payoffMonth!)}`)
    expect(m.parts.map((p) => p.id)).toEqual(['capital', 'interest', 'charge'])
    expect(m.total).toBe(toPence(r.overpaying.totalPaid))
    expect(m.stats).toContainEqual({ label: 'Net saving', value: formatGBP(r.charge!.netSaving, 'pence') })
    expect(m.stats).toContainEqual({ label: 'Return while fixed', value: formatPercent(r.returns[0]!.effective) })
    expect(m.tiles.map((t) => t.name)).toEqual(['Each month now', 'After the fixed rate'])
  })

  it('amounts off: no pound figure anywhere, shares and times only', () => {
    for (const s of [share(withCharge), share({ repaymentType: 'interest-only' }), share({}, true)]) {
      const m = shareModel(s, OFF, 'pence', NOW)
      expect(shareText(m)).not.toMatch(/£/)
      expect(shareCsv(s, OFF)).not.toMatch(/£|\d\.\d\d,|\d\.\d\d\r/)
      expect(m.tiles).toEqual([])
      expect(m.headline).toMatch(/%$/)
    }
  })

  it('interest-only: what is owed at the end, not a time', () => {
    const s = share({ repaymentType: 'interest-only' })
    const m = shareModel(s, ON, 'pence', NOW)
    expect(m.sentence).toBe(
      `${formatGBP(s.result.overpaying.owedAtEnd, 'pence')} owed at the end instead of ${formatGBP(s.result.baseline.owedAtEnd, 'pence')}`,
    )
    expect(m.parts.map((p) => p.id)).toEqual(['capital', 'interest'])
  })

  it('says when it shows a what-if', () => {
    expect(shareModel(share({}, true), ON, 'pence', NOW).title).toBe('Mortgage overpayment, with a what-if')
  })
})

describe('shareCsv', () => {
  it('without and with overpaying, pounds from whole pence, and the returns', () => {
    const s = share(withCharge)
    const csv = shareCsv(s, ON)
    expect(csv.split('\r\n')[0]).toBe('"Figure","Without overpaying","With overpaying"')
    expect(csv).toContain('"Interest",')
    expect(csv).toContain('"Return while fixed",')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('a file name with the month', () => {
    expect(shareFileName(NOW, 'csv')).toBe('sumyard-mortgage-2026-11.csv')
  })
})
