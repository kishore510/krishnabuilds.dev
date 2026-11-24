import { Plus, Trash2 } from 'lucide-react'
import { CurrencyInput } from '@/components/inputs/CurrencyInput'
import { Select } from '@/components/inputs/Select'
import { TextInput } from '@/components/inputs/TextInput'
import { Button } from '@/components/ui/button'
import { MAX_BUDGET_ACCOUNTS, MAX_INPUT_AMOUNT, MAX_ITEM_NAME_LENGTH } from '@/lib/inputLimits'
import { subtract, toPence, ZERO } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  ACCOUNT_KIND_HINTS,
  ACCOUNT_KIND_LABELS,
  ACCOUNT_TEMPLATES,
  type BudgetPageInputs,
  currentTemplate,
  GROUP_LABELS,
  MAIN_ACCOUNT_LABEL,
  PERIOD_LABELS,
  PERIODS,
  type TemplateId,
} from '../definition'
import { ACCOUNT_KINDS, type Account, type AccountKind, type BudgetResult, MAIN_ACCOUNT } from '../types'
import { accountFigure, type Gbp, IN_VIEW, pick, type View } from './Results'
import { accountSwatch, GROUP_SWATCHES, IconTile, Key, MAIN_SWATCH, POT_SWATCH } from './style'

/*
 * "Where it's paid from" (BD11, BD12): set up accounts from a template, then
 * each account's name, kind and transfer from main, with what it pays for and
 * what is left in it. Main is fixed: pay lands there. Removing an account
 * moves its lines to main (with Undo, on the page). Which account pays a line
 * is set in the line's editor, under "What it's for".
 */

const PERIOD_OPTIONS = PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))
const KIND_OPTIONS = ACCOUNT_KINDS.map((value) => ({ value, label: ACCOUNT_KIND_LABELS[value] }))

export function Accounts({
  inputs,
  result,
  view,
  gbp,
  invalidFields,
  onAccount,
  onValidity,
  onRemove,
  onAdd,
  onTemplate,
}: {
  inputs: BudgetPageInputs
  result: BudgetResult | null
  view: View
  gbp: Gbp
  invalidFields: readonly string[]
  onAccount: (id: string, patch: Partial<Account>) => void
  onValidity: (field: string, ok: boolean) => void
  onRemove: (id: string) => void
  onAdd: (kind: AccountKind) => void
  onTemplate: (id: TemplateId) => void
}) {
  const template = currentTemplate(inputs)
  const full = inputs.accounts.length >= MAX_BUDGET_ACCOUNTS
  const per = IN_VIEW[view]
  const linesOf = (id: string) => (result ? result.outgoingLines.filter((l) => l.line.account === id) : [])
  const figureOf = (id: string) => result?.accounts.find((a) => a.id === id)

  const lineList = (id: string, extra: { label: string; amount: string; className?: string }[] = []) => {
    const lines = linesOf(id)
    return (
      <ul className="flex flex-col text-sm">
        {lines.map((l) => (
          <li
            key={result?.outgoingLines.indexOf(l)}
            className="flex min-h-9 items-center gap-2 border-t border-dashed border-border first:border-t-0"
          >
            <Key swatch={GROUP_SWATCHES[l.line.group]} />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{l.line.name || GROUP_LABELS[l.line.group]}</span>
            <span className="font-medium tabular-nums">{gbp(pick(l, view))}</span>
          </li>
        ))}
        {extra.map((x) => (
          <li
            key={x.label}
            className={cn('flex min-h-9 items-center gap-2 border-t border-dashed border-border first:border-t-0', x.className)}
          >
            <span className="min-w-0 flex-1">{x.label}</span>
            <span className="tabular-nums">{x.amount}</span>
          </li>
        ))}
      </ul>
    )
  }

  const main = figureOf(MAIN_ACCOUNT)
  const signed = gbp

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm font-medium text-text">Start from</legend>
          {ACCOUNT_TEMPLATES.map((t) => (
            <Button
              key={t.id}
              id={`bd-template-${t.id}`}
              variant="ghost"
              aria-pressed={template === t.id}
              onClick={() => onTemplate(t.id)}
              className="h-auto min-h-touch rounded-full border border-border px-3 py-1.5 text-sm font-medium"
            >
              {t.label}
            </Button>
          ))}
        </fieldset>
      </div>

      <ul className="flex flex-col gap-3">
        <li data-account-card="main" className="rounded-md border border-border">
          <div className="flex items-center gap-3 rounded-t-md bg-surface-muted px-3 py-2">
            <IconTile swatch={MAIN_SWATCH} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{MAIN_ACCOUNT_LABEL}</span>
              <span className="text-xs text-text-muted">Your pay lands here</span>
            </span>
            {main && (
              <span className="text-right">
                <span className="block text-xs text-text-muted">Pay in, {per}</span>
                <span className="block font-semibold tabular-nums">{gbp(pick(main.moneyIn, view))}</span>
              </span>
            )}
          </div>
          <div className="px-3 py-2">
            {main &&
              lineList(MAIN_ACCOUNT, [
                ...inputs.accounts.map((a) => {
                  const f = figureOf(a.id)
                  return {
                    label: `To ${a.name || ACCOUNT_KIND_LABELS[a.kind]}`,
                    amount: f ? gbp(pick(f.moneyIn, view)) : '',
                    className: 'font-medium',
                  }
                }),
                {
                  label: 'Left in account',
                  amount: signed(pick(main.left, view)),
                  className: cn('font-semibold', toPence(main.left.year) < 0 ? 'text-danger' : 'text-positive'),
                },
                ...(result && toPence(result.topUp.year) > 0
                  ? [
                      { label: 'Needed to top up short accounts', amount: `−${gbp(pick(result.topUp, view))}`, className: 'text-danger' },
                      {
                        label: 'Really left',
                        amount: signed(subtract(pick(main.left, view), pick(result.topUp, view))),
                        className: 'font-bold',
                      },
                    ]
                  : []),
              ])}
          </div>
        </li>

        {inputs.accounts.map((a, i) => {
          const f = figureOf(a.id)
          const swatch = a.kind === 'savings' ? POT_SWATCH : accountSwatch(i)
          const label = a.name || ACCOUNT_KIND_LABELS[a.kind]
          const id = `bd-acc-${a.id}`
          const figure = f ? accountFigure(f) : null
          const planned = f ? Math.min(toPence(f.paid.year), toPence(f.moneyIn.year)) : 0
          const into = f ? toPence(f.moneyIn.year) : 0
          const invalid = invalidFields.some((x) => x.startsWith(`${id}-`))
          return (
            <li key={a.id} data-account-card={a.id} className={cn('rounded-md border', invalid ? 'border-danger' : 'border-border')}>
              <div className="flex items-center gap-3 rounded-t-md bg-surface-muted px-3 py-2">
                <IconTile swatch={swatch} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold [overflow-wrap:anywhere]">{label}</span>
                  <span className="text-xs text-text-muted">{ACCOUNT_KIND_HINTS[a.kind]}</span>
                </span>
                <Button
                  id={`${id}-remove`}
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${label}`}
                  title="Delete"
                  onClick={() => onRemove(a.id)}
                >
                  <Trash2 className="text-danger" />
                </Button>
              </div>
              <div className="flex flex-col gap-3 px-3 py-3">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <TextInput
                    id={`${id}-name`}
                    label="Account name"
                    value={a.name}
                    maxLength={MAX_ITEM_NAME_LENGTH}
                    onChange={(name) => onAccount(a.id, { name })}
                    onValidityChange={(ok) => onValidity(`${id}-name`, ok)}
                  />
                  <Select
                    id={`${id}-kind`}
                    label="Kind"
                    value={a.kind}
                    options={KIND_OPTIONS}
                    onChange={(kind) => {
                      if (kind !== 'joint') onValidity(`${id}-others`, true)
                      onAccount(a.id, kind === 'joint' ? { kind } : { kind, othersIn: ZERO })
                    }}
                  />
                  <CurrencyInput
                    id={`${id}-amount`}
                    label={a.kind === 'joint' ? 'Your share moved in' : 'Moved in from main'}
                    value={a.amount}
                    emptyValue={ZERO}
                    placeholder="0.00"
                    min={ZERO}
                    max={MAX_INPUT_AMOUNT}
                    onChange={(amount) => onAccount(a.id, { amount })}
                    onValidityChange={(ok) => onValidity(`${id}-amount`, ok)}
                  />
                  <Select
                    id={`${id}-period`}
                    label="How often"
                    value={a.period}
                    options={PERIOD_OPTIONS}
                    onChange={(period) => onAccount(a.id, { period })}
                  />
                  {a.kind === 'joint' && (
                    <CurrencyInput
                      id={`${id}-others`}
                      label="Others put in"
                      hint="A partner’s share, for example, at the same how often. Not counted as your income."
                      value={a.othersIn}
                      emptyValue={ZERO}
                      placeholder="0.00"
                      min={ZERO}
                      max={MAX_INPUT_AMOUNT}
                      onChange={(othersIn) => onAccount(a.id, { othersIn })}
                      onValidityChange={(ok) => onValidity(`${id}-others`, ok)}
                    />
                  )}
                </div>
                {f && figure && (
                  <div className="flex flex-col gap-1.5">
                    <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-muted">
                      {into > 0 && <div className={swatch.fill} style={{ width: `${(planned / into) * 100}%` }} />}
                      {into > 0 && toPence(f.left.year) > 0 && (
                        <div className="bg-positive" style={{ width: `${(toPence(f.left.year) / into) * 100}%` }} />
                      )}
                    </div>
                    <p className="flex flex-wrap justify-between gap-2 text-xs">
                      <span className="text-text-muted">
                        {gbp(pick(f.paid, view))} {per} goes on the lines below
                      </span>
                      <span
                        data-account-status
                        className={cn(
                          'rounded-full px-2 font-semibold',
                          figure.tone === 'danger' ? 'bg-danger-subtle text-danger' : 'bg-positive-subtle text-positive',
                        )}
                      >
                        {toPence(f.short.year) > 0
                          ? `${gbp(pick(f.short, view))} short`
                          : a.kind === 'savings'
                            ? `${gbp(pick(f.saved, view))} put aside`
                            : toPence(f.left.year) > 0
                              ? `${gbp(pick(f.left, view))} left to spend`
                              : 'Every pound planned'}
                      </span>
                    </p>
                  </div>
                )}
                {linesOf(a.id).length > 0 ? (
                  lineList(a.id)
                ) : a.kind === 'savings' ? (
                  <p className="text-sm text-text-muted">Nothing is paid from this pot, so all of it is put aside.</p>
                ) : (
                  <p className="text-sm text-text-muted">
                    Nothing is paid from here yet. Under <strong>What it’s for</strong>, open a line and choose this account.
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-text">Add an account</p>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_KINDS.map((kind) => (
            <Button
              key={kind}
              id={`bd-add-account-${kind}`}
              variant="ghost"
              disabled={full}
              onClick={() => onAdd(kind)}
              className="h-auto min-h-touch border border-dashed border-border-strong py-1.5"
            >
              <Plus />
              {ACCOUNT_KIND_LABELS[kind]}
            </Button>
          ))}
        </div>
        {full && <p className="text-xs text-text-muted">That’s the most accounts Sumyard holds ({MAX_BUDGET_ACCOUNTS}).</p>}
      </div>
    </div>
  )
}
