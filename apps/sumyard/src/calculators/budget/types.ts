import type { Money, Ratio } from '@/lib/money'
import type { ContributionFrequency } from '@/lib/periods'

/*
 * Types for the household budget engine. The decisions behind these shapes
 * are BD2 to BD5, BD7, BD9 and BD10 to BD14 in docs/modelling-decisions.md.
 */

/** What an outgoing is for (BD10): a fixed list. */
export type BudgetGroup = 'home' | 'bills' | 'food' | 'transport' | 'personal' | 'debt' | 'saving' | 'other'

export const BUDGET_GROUPS: readonly BudgetGroup[] = ['home', 'bills', 'food', 'transport', 'personal', 'debt', 'saving', 'other']

/** The group the savings rate counts (BD13). */
export const SAVING_GROUP: BudgetGroup = 'saving'

/** What an account besides main is (BD11). */
export type AccountKind = 'spending' | 'joint' | 'savings'

export const ACCOUNT_KINDS: readonly AccountKind[] = ['spending', 'joint', 'savings']

/** The account pay lands in (BD11). Every other account's id differs from it. */
export const MAIN_ACCOUNT = 'main'

/** How often a line's amount is paid (BD2): weekly, monthly, quarterly or yearly. */
export type BudgetPeriod = ContributionFrequency

/** A line of income (BD3): its amount is after tax, and it lands in main. */
export interface IncomeLine {
  readonly name: string
  readonly amount: Money
  readonly period: BudgetPeriod
}

/** An account besides main, with its regular transfer from main (BD11). For a joint account, the person's own share. */
export interface Account {
  /** Stable within a scenario; never MAIN_ACCOUNT. */
  readonly id: string
  readonly name: string
  readonly kind: AccountKind
  readonly amount: Money
  readonly period: BudgetPeriod
  /** What others (a partner) put into it, in the same period (BD17). Not the person's income. */
  readonly othersIn: Money
}

/** A line of outgoings (BD2, BD10, BD11, BD14). */
export interface OutgoingLine extends IncomeLine {
  readonly group: BudgetGroup
  /** MAIN_ACCOUNT or an account's id. */
  readonly account: string
  readonly essential: boolean
}

/** What the engine takes. Amounts are whole pence; a blank is nothing (BD4). */
export interface BudgetInputs {
  readonly income: readonly IncomeLine[]
  readonly accounts: readonly Account[]
  readonly outgoings: readonly OutgoingLine[]
}

/** A yearly figure and its month figure: the year divided by the months, to the nearest penny (BD2). */
export interface YearAndMonth {
  readonly year: Money
  readonly month: Money
}

export type WithShare = YearAndMonth & { readonly share: Ratio | null }

/** A line or transfer as entered, with its yearly and month figures. */
export interface ResolvedLine<L extends IncomeLine = IncomeLine> extends YearAndMonth {
  readonly line: L
}

/** A group's total and its share of income; the share is null with no income (BD5). */
export interface GroupTotal extends WithShare {
  readonly group: BudgetGroup
}

/** One account's figures (BD12). Main comes first. */
export interface AccountResult {
  /** MAIN_ACCOUNT or the account's id. */
  readonly id: string
  readonly name: string
  readonly kind: AccountKind | 'main'
  /** Main: income. Others: the transfer from main plus what others put in. */
  readonly moneyIn: YearAndMonth
  /** What others put in (BD17); nothing for main. */
  readonly fromOthers: YearAndMonth
  /** The lines paid from this account. */
  readonly paid: YearAndMonth
  /** Main: every transfer out. Others: nothing. */
  readonly transfersOut: YearAndMonth
  /** In less paid less transfers out; may be below nothing. */
  readonly left: YearAndMonth
  /** A savings pot's left above nothing: put aside, counted as saving (BD12, BD13). Nothing for others. */
  readonly saved: YearAndMonth
  /** Left below nothing, as a positive amount: the top-up it needs. Nothing for main. */
  readonly short: YearAndMonth
}

/**
 * What the month rows, each rounded on its own, add up to less the month figure they sit beside (BD2): nothing when they
 * agree. Positive when the rows add up to more.
 */
export interface PennyDrift {
  /** The income lines' month figures less income's. */
  readonly income: Money
  /** The groups' month totals and the pots' saved figures less outgoings'. */
  readonly groups: Money
  /** Each group's lines' month figures less the group's month total. */
  readonly lines: Readonly<Record<BudgetGroup, Money>>
  /** Income and what others put in less outgoings, each a month, less what is left a month. */
  readonly leftover: Money
}

export type BudgetWarning =
  /** Outgoings are more than income (BD5). */
  | 'negative-leftover'
  /** There is no income, so no share can be worked out (BD5). */
  | 'no-income'
  /** An account besides main pays out more than goes in (BD12). */
  | 'account-short'
  /** Main pays out and transfers more than comes in (BD12). */
  | 'main-short'

export interface BudgetResult {
  readonly income: YearAndMonth
  /** Every line plus what savings pots put aside (BD12). Transfers are not outgoings. */
  readonly outgoings: WithShare
  /** Income and what others put in, less outgoings, across accounts; may be below nothing (BD5, BD12, BD17). */
  readonly leftover: WithShare
  /** What others put into the person's accounts, together (BD17). Not income: shares stay of income. */
  readonly fromOthers: WithShare
  /** Every group, in BUDGET_GROUPS order, including those with nothing. */
  readonly perGroup: readonly GroupTotal[]
  /** What savings pots put aside, together (BD12). */
  readonly potSaved: WithShare
  /** Needs, wants and saving (BD14); they add up to outgoings. */
  readonly needs: WithShare
  readonly wants: WithShare
  readonly saving: WithShare
  /** The saving share of income (BD13); null with no income. */
  readonly savingsRate: Ratio | null
  /** Main first, then each account in the order given. */
  readonly accounts: readonly AccountResult[]
  /** Every account's shortfall, together: the top-up from main (BD12). */
  readonly topUp: YearAndMonth
  readonly incomeLines: readonly ResolvedLine[]
  readonly outgoingLines: readonly ResolvedLine<OutgoingLine>[]
  readonly pennyDrift: PennyDrift
  readonly warnings: readonly BudgetWarning[]
  /** Plain-language assumptions with no figures, for the page to show. */
  readonly assumptions: readonly string[]
}

/** Why an input or the result is refused (BD9, BD11). */
export type BudgetProblemReason =
  | 'not-a-list'
  | 'too-many-lines'
  | 'not-money'
  | 'below-minimum'
  | 'above-maximum'
  | 'not-a-choice'
  | 'too-large'
  | 'too-many-accounts'
  | 'bad-account-id'
  | 'unknown-account'

export interface BudgetProblem {
  readonly field: 'income' | 'accounts' | 'outgoings' | 'result'
  /** The line or account, from nothing, when the problem is in one. */
  readonly index?: number
  readonly reason: BudgetProblemReason
}

/** A result, or a typed refusal that names each problem. Never a wrong number. */
export type BudgetOutcome =
  | { readonly ok: true; readonly result: BudgetResult }
  | { readonly ok: false; readonly problems: readonly BudgetProblem[] }
