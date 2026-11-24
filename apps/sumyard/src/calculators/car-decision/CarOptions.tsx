import { ChevronDown, CopyPlus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { IconTile } from '@/components/IconTile'
import { Select } from '@/components/inputs/Select'
import { Button } from '@/components/ui/button'
import { MAX_CAR_OPTIONS, MAX_ITEM_NAME_LENGTH } from '@/lib/inputLimits'
import type { Money } from '@/lib/money'
import { cn } from '@/lib/utils'
import { toasts } from '@/toast/toasts'
import type { ValueCase } from '../car-ownership/types'
import {
  blankOption,
  type CarDecisionInputs,
  type OptionField,
  type OptionInputs,
  type OptionStatus,
  optionName,
  sectionFields,
} from './definition'
import { fieldName, OptionEditor } from './OptionEditor'
import { CAR_FIELDS, copyCar, optionSummary, START_TEMPLATES, startFrom, type TemplateId } from './setup'
import { optionSwatch } from './style'

/*
 * The options as compact rows (the car decision redesign, CD2): each row its option's colour and icon (CD1), its name, a
 * one-line summary and its average cost a month once costed; tap a row to open its editor, one at a time. Start from
 * (CD3) sets common kinds and names, with Undo; Copy the car (CD4) takes another option's car into this one. Add,
 * Duplicate and Remove (with Undo) as before (U9). Which row is open is the page's only, never stored.
 */

type Gbp = (amount: Money) => string

/** A duplicate's name: the name and "(copy)", kept within the longest name. */
const copyName = (name: string) => (name ? Array.from(`${name} (copy)`).slice(0, MAX_ITEM_NAME_LENGTH).join('') : '')

/** Every field an option shows for its kind, fuel type and pricing. */
const shownFields = (option: OptionInputs): OptionField[] => [
  'name',
  ...sectionFields('car', option),
  ...sectionFields('finance', option),
  ...sectionFields('running', option),
]

/** A row's figure: its average cost a month in the case shown, or what stops it having one. */
function rowFigure(status: OptionStatus | null, valueCase: ValueCase, gbp: Gbp): { text: string; muted: boolean } {
  if (!status) return { text: '', muted: true }
  switch (status.kind) {
    case 'ok':
      return { text: `${gbp(status.result.cases[valueCase].netCostPerCoverageMonth)} a month`, muted: false }
    case 'missing':
      return { text: `Needs ${status.missing.length} more`, muted: true }
    case 'held':
      return { text: 'Fix an input', muted: true }
    default:
      return { text: 'No results', muted: true }
  }
}

export function CarOptions({
  inputs,
  keys,
  inserted,
  removed,
  invalidFor,
  statuses,
  gbp,
  set,
  forget,
  setValid,
  revision,
  getRevision,
  getOptions,
}: {
  inputs: CarDecisionInputs
  keys: readonly number[]
  inserted: (index: number) => number
  removed: (index: number) => void
  invalidFor: (key: number) => OptionField[]
  statuses: readonly OptionStatus[] | null
  gbp: Gbp
  set: (patch: Partial<CarDecisionInputs>) => void
  forget: (...fields: string[]) => void
  setValid: (field: string, ok: boolean) => void
  revision: number
  getRevision: () => number
  getOptions: () => readonly OptionInputs[]
}) {
  const options = inputs.options
  const full = options.length >= MAX_CAR_OPTIONS
  // The open row: a fresh page opens the first option still needing boxes, so the page starts on what to fill in.
  const [open, setOpen] = useState<number | null>(() => {
    const first = statuses?.findIndex((s) => s.kind === 'missing') ?? 0
    return first >= 0 ? (keys[first] ?? null) : null
  })
  // What takes focus after the next render: a new option's name, a restored option's row, or Add after a removal.
  const [focus, setFocus] = useState<string | null>(null)
  const latest = useRef({ inserted, setFocus, setOpen })
  latest.current = { inserted, setFocus, setOpen }
  useEffect(() => {
    if (focus === null) return
    document.getElementById(focus)?.focus()
    setFocus(null)
  }, [focus])

  const setOptions = (next: readonly OptionInputs[]) => set({ options: next })
  const update = (index: number, key: number, patch: Partial<OptionInputs>) => {
    const next = { ...options[index]!, ...patch }
    // Boxes no longer shown (another kind, fuel type or pricing) can't stay "to fix": they would hold the option back unseen.
    const shown = shownFields(next)
    forget(...invalidFor(key).flatMap((field) => (shown.includes(field) ? [] : [fieldName(key, field)])))
    setOptions(options.map((option, i) => (i === index ? next : option)))
  }
  const add = () => {
    const key = inserted(options.length)
    setOptions([...options, blankOption('cash')])
    setOpen(key)
    setFocus(`cd-o${key}-name`)
  }
  const duplicate = (index: number) => {
    const key = inserted(index + 1)
    const source = options[index]!
    setOptions([...options.slice(0, index + 1), { ...source, name: copyName(source.name) }, ...options.slice(index + 1)])
    setOpen(key)
    setFocus(`cd-o${key}-name`)
  }
  const copyFrom = (index: number, key: number, from: number) => {
    const before = options[index]!
    // The car's boxes are replaced: none of them can stay "to fix".
    forget(...invalidFor(key).flatMap((field) => (CAR_FIELDS.includes(field) ? [fieldName(key, field)] : [])))
    setOptions(options.map((option, i) => (i === index ? copyCar(options[from]!, option) : option)))
    const label = optionName(before, index)
    toasts.show({
      message: `Copied the car from “${optionName(options[from]!, from)}” into “${label}”.`,
      undo: {
        blocked: () => (getRevision() !== revision ? 'Couldn’t undo: other inputs have been loaded since.' : undefined),
        run: () => {
          const now = getOptions()
          if (index < now.length) set({ options: now.map((option, i) => (i === index ? copyCar(before, option) : option)) })
        },
        done: `“${label}” has its own car again.`,
      },
    })
  }
  const remove = (index: number, key: number) => {
    const option = options[index]!
    const label = optionName(option, index)
    forget(...invalidFor(key).map((field) => fieldName(key, field)))
    removed(index)
    setOptions(options.filter((_, i) => i !== index))
    setFocus('cd-add')
    toasts.show({
      message: `Removed “${label}”.`,
      undo: {
        blocked: () =>
          getRevision() !== revision
            ? 'Couldn’t undo: other inputs have been loaded since.'
            : getOptions().length >= MAX_CAR_OPTIONS
              ? 'Couldn’t undo: there are already as many options as Sumyard compares.'
              : undefined,
        run: () => {
          const now = getOptions()
          const at = Math.min(index, now.length)
          const restored = latest.current.inserted(at)
          set({ options: [...now.slice(0, at), option, ...now.slice(at)] })
          latest.current.setFocus(`cd-o${restored}-row`)
        },
        done: `Restored “${label}”.`,
      },
    })
  }
  const start = (id: TemplateId) => {
    const before = options
    const template = START_TEMPLATES.find((t) => t.id === id)!
    forget(...keys.flatMap((key) => invalidFor(key).map((field) => fieldName(key, field))))
    for (let i = options.length - 1; i >= 0; i--) removed(i)
    const fresh = startFrom(id)
    const first = fresh.map((_, i) => inserted(i))[0] ?? null
    setOptions(fresh)
    setOpen(first)
    toasts.show({
      message: `Started from “${template.label}”.`,
      undo: {
        blocked: () => (getRevision() !== revision ? 'Couldn’t undo: other inputs have been loaded since.' : undefined),
        run: () => {
          const now = getOptions()
          for (let i = now.length - 1; i >= 0; i--) removed(i)
          for (let i = 0; i < before.length; i++) latest.current.inserted(i)
          latest.current.setOpen(null)
          set({ options: before })
        },
        done: 'Your options are back as they were.',
      },
    })
  }

  return (
    <section
      aria-labelledby="cd-options-title"
      className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 id="cd-options-title" className="text-base font-semibold text-text">
          Your options
        </h2>
        <p className="text-xs text-text-muted">Up to {MAX_CAR_OPTIONS}. Tap an option to fill it in.</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-text">Start from</legend>
        <div className="flex flex-wrap gap-2">
          {START_TEMPLATES.map((t) => (
            <Button
              key={t.id}
              id={`cd-template-${t.id}`}
              variant="ghost"
              aria-describedby={`cd-template-${t.id}-hint`}
              onClick={() => start(t.id)}
              className="h-auto min-h-touch rounded-full border border-border px-3 py-2 text-sm font-medium"
            >
              {t.label}
              <span id={`cd-template-${t.id}-hint`} className="sr-only">
                {t.hint} Replaces your options; you can undo it.
              </span>
            </Button>
          ))}
        </div>
      </fieldset>
      <ul className="flex flex-col gap-2">
        {options.map((option, index) => {
          const key = keys[index] ?? index
          const base = `cd-o${key}`
          const isOpen = open === key
          const swatch = optionSwatch(index, option.acquisition)
          const name = optionName(option, index)
          const figure = rowFigure(statuses?.[index] ?? null, inputs.valueCase, gbp)
          const invalid = invalidFor(key)
          const others = options.flatMap((o, i) => (i === index ? [] : [{ value: String(i), label: optionName(o, i) }]))
          return (
            <li key={key} data-option-row={index} className="min-w-0 rounded-md border border-border">
              <button
                id={`${base}-row`}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${base}-panel`}
                onClick={() => setOpen(isOpen ? null : key)}
                className={cn(
                  'flex min-h-touch w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-muted',
                  isOpen && 'rounded-b-none bg-surface-muted',
                )}
              >
                <IconTile swatch={swatch} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-text [overflow-wrap:anywhere]">{name}</span>
                  <span
                    className={cn('text-xs [overflow-wrap:anywhere]', invalid.length > 0 ? 'font-medium text-danger' : 'text-text-muted')}
                  >
                    {invalid.length > 0 ? 'Fix the highlighted input' : optionSummary(option, gbp)}
                  </span>
                </span>
                <span
                  data-row-figure
                  className={cn('text-right text-sm tabular-nums', figure.muted ? 'text-text-muted' : 'font-semibold text-text')}
                >
                  {figure.text}
                </span>
                <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-text-muted', isOpen && '-scale-y-100')} />
              </button>
              {/* Mounted while closed, so typed text and the "fix this input" state survive. */}
              <div id={`${base}-panel`} hidden={!isOpen} className="p-2">
                <OptionEditor
                  option={option}
                  index={index}
                  optionKey={key}
                  status={statuses?.[index] ?? null}
                  invalid={invalid}
                  sharedMileage={inputs.annualMileage}
                  gbp={gbp}
                  update={(patch) => update(index, key, patch)}
                  setValid={(field, ok) => setValid(fieldName(key, field), ok)}
                  actions={
                    <div className="flex flex-col gap-3 border-t border-border pt-3">
                      {others.length > 0 && (
                        <div className="min-w-0">
                          <Select
                            id={`${base}-copy-from`}
                            label="Copy the car from"
                            hint="Its price, end values, mileage, fuel and running costs. Not its finance."
                            value=""
                            options={[{ value: '', label: 'Choose an option' }, ...others]}
                            onChange={(value) => value !== '' && copyFrom(index, key, Number(value))}
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button id={`${base}-duplicate`} variant="ghost" disabled={full} onClick={() => duplicate(index)}>
                          <CopyPlus aria-hidden="true" />
                          Duplicate<span className="sr-only"> {name}</span>
                        </Button>
                        <Button id={`${base}-remove`} variant="ghost" disabled={options.length === 1} onClick={() => remove(index, key)}>
                          <Trash2 aria-hidden="true" />
                          Remove<span className="sr-only"> {name}</span>
                        </Button>
                      </div>
                    </div>
                  }
                />
              </div>
            </li>
          )
        })}
      </ul>
      <Button id="cd-add" variant="secondary" disabled={full} onClick={add} className="self-start">
        <Plus aria-hidden="true" />
        Add an option
      </Button>
    </section>
  )
}
