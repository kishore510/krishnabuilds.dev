import { Baby, Gift, GraduationCap, Landmark, PiggyBank, Receipt, ShieldCheck, SlidersHorizontal, Wallet } from 'lucide-react'
import type { Swatch } from '@/components/IconTile'
import type { SplitSegmentId } from './results'
import type { SectionId } from './sections'

/*
 * Colours and icons for the parts of pay on the take-home page (TH2, TH3; docs/design-tokens.md, the take-home redesign). Class
 * names are written out whole so Tailwind finds them. Colour is never the only cue: every part is named beside it.
 */

export const PAY_SWATCHES: Record<SplitSegmentId, Swatch> = {
  incomeTax: { icon: Landmark, text: 'text-pay-tax', fill: 'bg-pay-tax', stroke: 'stroke-pay-tax', tint: 'bg-pay-tax/15' },
  nationalInsurance: { icon: ShieldCheck, text: 'text-pay-ni', fill: 'bg-pay-ni', stroke: 'stroke-pay-ni', tint: 'bg-pay-ni/15' },
  studentLoan: {
    icon: GraduationCap,
    text: 'text-pay-student-loan',
    fill: 'bg-pay-student-loan',
    stroke: 'stroke-pay-student-loan',
    tint: 'bg-pay-student-loan/15',
  },
  pension: { icon: PiggyBank, text: 'text-pay-pension', fill: 'bg-pay-pension', stroke: 'stroke-pay-pension', tint: 'bg-pay-pension/15' },
  hicbc: { icon: Baby, text: 'text-pay-hicbc', fill: 'bg-pay-hicbc', stroke: 'stroke-pay-hicbc', tint: 'bg-pay-hicbc/15' },
  benefits: { icon: Gift, text: 'text-pay-benefits', fill: 'bg-pay-benefits', stroke: 'stroke-pay-benefits', tint: 'bg-pay-benefits/15' },
  postTaxDeductions: {
    icon: Receipt,
    text: 'text-pay-deductions',
    fill: 'bg-pay-deductions',
    stroke: 'stroke-pay-deductions',
    tint: 'bg-pay-deductions/15',
  },
  takeHome: { icon: Wallet, text: 'text-text-muted', fill: 'bg-border-strong', stroke: 'stroke-border-strong', tint: 'bg-surface-muted' },
}

/** The colour token of each part, for the shared image card and print page (`--sy-<token>`). */
export const PAY_TOKENS: Record<SplitSegmentId, string> = {
  incomeTax: 'pay-tax',
  nationalInsurance: 'pay-ni',
  studentLoan: 'pay-student-loan',
  pension: 'pay-pension',
  hicbc: 'pay-hicbc',
  benefits: 'pay-benefits',
  postTaxDeductions: 'pay-deductions',
  takeHome: 'border-strong',
}

/** Each input section's icon: the part of pay it changes, where there is one. */
export const SECTION_SWATCHES: Record<SectionId, Swatch> = {
  pension: PAY_SWATCHES.pension,
  allowances: { ...PAY_SWATCHES.pension, icon: SlidersHorizontal },
  benefits: PAY_SWATCHES.benefits,
  studentLoans: PAY_SWATCHES.studentLoan,
  childBenefit: PAY_SWATCHES.hicbc,
  taxCode: PAY_SWATCHES.incomeTax,
}
