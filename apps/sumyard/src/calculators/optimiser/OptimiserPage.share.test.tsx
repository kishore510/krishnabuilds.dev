// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { taxYear } from '@/config/tax/2026-27'
import { taxYearLabel } from '@/config/tax/index'
import { fromPounds } from '@/lib/money'
import { scenarioStore } from '@/scenarios/index'
import { settingsStore } from '@/settings/settings'
import { click, mount, type } from '@/test/dom'
import { toasts } from '@/toast/toasts'
import { sessionFor } from '../session'
import { breakdown } from './breakdown'
import { takeHome } from './calc'
import { optimiserCalculator, REGION_LABELS, toTaxInputs } from './definition'
import OptimiserPage from './OptimiserPage'
import ShareTakeHome from './ShareTakeHome'
import { DEFAULT_POLICY } from './types'

/* The take-home redesign (TH1 to TH5): section icons, the ring's empty state and Share. Kept apart from the large page file. */

let view: ReturnType<typeof mount>
const session = sessionFor(optimiserCalculator)
beforeEach(() => {
  localStorage.clear()
  scenarioStore.clear()
  settingsStore.update({ amounts: 'pence', region: 'ruk' })
  session.startNew()
  view = mount(<OptimiserPage />)
})
afterEach(() => {
  view.unmount()
  toasts.dismiss()
})

const $ = (selector: string) => document.querySelector(selector)
const box = (id: string) => $(`#${id}`) as HTMLInputElement

describe('take-home redesign', () => {
  it('every input section has an icon tile, hidden from screen readers', () => {
    const headers = [...view.host.querySelectorAll('[data-section^="opt-section-"] button[aria-expanded]')]
    expect(headers.length).toBeGreaterThan(0)
    for (const h of headers) expect(h.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
  })

  it('Share is off while an input needs fixing', () => {
    type(box('opt-salary'), '56,000')
    const share = $('#opt-share') as HTMLButtonElement
    expect(share.disabled).toBe(false)
    expect(share.getAttribute('aria-haspopup')).toBe('dialog')
    type(box('opt-salary'), 'abc')
    expect(share.disabled).toBe(true)
  })

  it('the take-home dialog has an amounts switch and no line names switch; amounts off shows no pound figure', () => {
    const result = takeHome(toTaxInputs({ ...optimiserCalculator.defaultInputs(), salary: fromPounds(56_000) }), taxYear, DEFAULT_POLICY)
    if (!result.ok) throw new Error('refused')
    const dialog = mount(
      <ShareTakeHome
        share={{
          year: breakdown(result.annual, 'year'),
          month: breakdown(result.annual, 'month'),
          period: 'month',
          taxYear: taxYearLabel(taxYear.id),
          region: REGION_LABELS.rUK,
        }}
        onClose={() => undefined}
      />,
    )
    try {
      const el = $('dialog')!
      expect(el.textContent).toMatch(/Share your take-home/)
      expect(el.querySelectorAll('[role="switch"]')).toHaveLength(1)
      click($('dialog input[value="text"]'))
      expect($('dialog pre')!.textContent).toMatch(/^Take-home pay, .* \(a month\)/)
      expect($('dialog pre')!.textContent).toMatch(/£/)
      click(el.querySelector('[role="switch"]'))
      expect($('dialog pre')!.textContent).not.toMatch(/£/)
    } finally {
      dialog.unmount()
    }
  })

  it('a take-home below nothing says the ring cannot be drawn and keeps the table', () => {
    type(box('opt-salary'), '20,000')
    click($('#opt-section-benefits-button'))
    click($('#opt-deductions-add'))
    const item = [...view.host.querySelectorAll('[data-item]')].filter((el) => el.id.startsWith('opt-deductions-')).at(-1)!
    type(box(`${item.id}-amount`), '40,000')
    click($(`input[name="${item.id}-period"][value="year"]`))
    expect($('[data-split]')!.textContent).toMatch(/below nothing/)
    expect($('[data-split] table')).not.toBeNull()
  })
})
