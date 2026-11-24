import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { CurrencyInput } from '@/components/inputs/CurrencyInput'
import { Select } from '@/components/inputs/Select'
import { TextInput } from '@/components/inputs/TextInput'
import { Toggle } from '@/components/inputs/Toggle'
import { Button } from '@/components/ui/button'
import { MAX_INPUT_AMOUNT, MAX_ITEM_NAME_LENGTH } from '@/lib/inputLimits'
import { ZERO } from '@/lib/money'
import { cn } from '@/lib/utils'
import { GROUP_LABELS, MAIN_ACCOUNT_LABEL, PERIOD_LABELS, PERIODS } from '../definition'
import { BUDGET_GROUPS, type BudgetGroup, MAIN_ACCOUNT, type OutgoingLine, SAVING_GROUP } from '../types'

/*
 * One outgoing line as a compact row (name, amount, paid from) that opens
 * into its editor: name, amount, how often, group, paid from, essential and
 * Remove (BD2, BD10, BD11, BD14). The row is a native button with
 * aria-expanded; the editor stays mounted while closed, so typed text and
 * invalid-input state survive.
 */

const PERIOD_OPTIONS = PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))
const GROUP_OPTIONS = BUDGET_GROUPS.map((value) => ({ value, label: GROUP_LABELS[value] }))

export interface AccountOption {
  readonly value: string
  readonly label: string
}

export function LineEditor({
  lineId,
  line,
  label,
  open,
  onOpenChange,
  figure,
  accounts,
  invalid,
  onChange,
  onValidity,
  onRemove,
}: {
  /** The DOM id stem, stable for the line (bd-out-<key>). */
  lineId: string
  line: OutgoingLine
  /** Its name, or a stand-in when blank. */
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The amount in the page's view, formatted, or blank before a result. */
  figure: string
  /** Main and every other account; the paid-from choice shows only with more than main. */
  accounts: readonly AccountOption[]
  invalid: boolean
  onChange: (patch: Partial<OutgoingLine>) => void
  onValidity: (part: 'name' | 'amount', ok: boolean) => void
  onRemove: () => void
}) {
  const paidFrom = accounts.find((a) => a.value === line.account)?.label ?? MAIN_ACCOUNT_LABEL
  const many = accounts.length > 1
  return (
    <li data-line className="border-t border-border first:border-t-0">
      <button
        id={`${lineId}-row`}
        type="button"
        aria-expanded={open}
        aria-controls={`${lineId}-editor`}
        onClick={() => onOpenChange(!open)}
        className="flex min-h-touch w-full items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-surface-muted"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('text-sm [overflow-wrap:anywhere]', line.name ? 'text-text' : 'text-text-muted')}>{label}</span>
          {(many || invalid) && (
            <span className={cn('text-xs', invalid ? 'font-medium text-danger' : 'text-text-muted')}>
              {invalid ? 'Fix this line' : `Paid from ${paidFrom}`}
            </span>
          )}
        </span>
        <span className="text-sm font-medium text-text tabular-nums">{figure}</span>
        <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-text-muted', open && 'rotate-180')} />
      </button>
      <fieldset id={`${lineId}-editor`} hidden={!open} className="mb-3 flex min-w-0 flex-col gap-3 rounded-md border border-border p-3">
        <legend className="sr-only">{label}</legend>
        <TextInput
          id={`${lineId}-name`}
          label="Name"
          value={line.name}
          maxLength={MAX_ITEM_NAME_LENGTH}
          onChange={(name) => onChange({ name })}
          onValidityChange={(ok) => onValidity('name', ok)}
        />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <CurrencyInput
            id={`${lineId}-amount`}
            label="Amount"
            value={line.amount}
            emptyValue={ZERO}
            placeholder="0.00"
            min={ZERO}
            max={MAX_INPUT_AMOUNT}
            onChange={(amount) => onChange({ amount })}
            onValidityChange={(ok) => onValidity('amount', ok)}
          />
          <Select
            id={`${lineId}-period`}
            label="How often"
            value={line.period}
            options={PERIOD_OPTIONS}
            onChange={(period) => onChange({ period })}
          />
          <Select
            id={`${lineId}-group`}
            label="Group"
            value={line.group}
            options={GROUP_OPTIONS}
            onChange={(group: BudgetGroup) => onChange({ group })}
          />
          {many && (
            <Select
              id={`${lineId}-account`}
              label="Paid from"
              value={line.account}
              options={accounts}
              onChange={(account) => onChange({ account })}
            />
          )}
        </div>
        {line.group !== SAVING_GROUP && (
          <Toggle
            id={`${lineId}-essential`}
            label="Essential"
            hint="Essentials count as needs in the 50/30/20 check; the rest as wants."
            checked={line.essential}
            onChange={(essential) => onChange({ essential })}
          />
        )}
        <div className="flex justify-end">
          <Button id={`${lineId}-remove`} variant="ghost" aria-label={`Remove ${label}`} onClick={onRemove}>
            <Trash2 />
            Remove
          </Button>
        </div>
      </fieldset>
    </li>
  )
}

/** Add a blank line, and quick-add buttons for common names. */
export function AddLines({
  id,
  presets,
  full,
  onAdd,
  fullText,
}: {
  id: string
  presets: readonly string[]
  full: boolean
  onAdd: (name: string) => void
  fullText: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Button
          id={id}
          variant="ghost"
          disabled={full}
          aria-describedby={full ? `${id}-full` : undefined}
          onClick={() => onAdd('')}
          className="h-auto min-h-touch border border-dashed border-border-strong py-1.5"
        >
          <Plus />
          Add a line
        </Button>
        {presets.map((name) => (
          <Button
            key={name}
            variant="ghost"
            disabled={full}
            aria-label={`Add ${name}`}
            onClick={() => onAdd(name)}
            className="h-auto min-h-touch rounded-full border border-border px-3 py-1.5 font-normal"
          >
            + {name}
          </Button>
        ))}
      </div>
      {full && (
        <p id={`${id}-full`} className="text-xs text-text-muted">
          {fullText}
        </p>
      )}
    </div>
  )
}

export const mainOption: AccountOption = { value: MAIN_ACCOUNT, label: MAIN_ACCOUNT_LABEL }
