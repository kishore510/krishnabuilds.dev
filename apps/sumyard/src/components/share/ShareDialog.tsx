import { Copy, Download, FileSpreadsheet, FileText, Image, Printer, Share2, Type, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Toggle } from '@/components/inputs/Toggle'
import { Button } from '@/components/ui/button'
import { downloadBlob, downloadText } from '@/lib/download'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { type AmountStyle, settingsStore } from '@/settings/settings'
import { CARD_HEIGHT, CARD_WIDTH, type CardColours, drawCard } from './card'
import { type ShareModel, type ShareOptions, shareFileName, shareText } from './model'

/*
 * Share a result (BD16; the budget's, shared since the take-home redesign): a modal dialog (native <dialog>: focus stays
 * inside, Escape closes, focus returns to Share). Pick a format (an image
 * card, a PDF through the browser's print, a spreadsheet or text) and what
 * to include (amounts, and line names where a page has them); the preview updates as you choose. Every
 * file is made here, on the device; nothing is uploaded. The system share
 * sheet is offered only where the browser has one.
 */

type Format = 'image' | 'pdf' | 'csv' | 'text'

const formats = (csvHint: string): readonly { id: Format; name: string; hint: string; icon: typeof Image }[] => [
  { id: 'image', name: 'Image', hint: 'A card for messages and social', icon: Image },
  { id: 'pdf', name: 'PDF', hint: 'A4 summary to print or attach', icon: FileText },
  { id: 'csv', name: 'Spreadsheet', hint: csvHint, icon: FileSpreadsheet },
  { id: 'text', name: 'Text', hint: 'A short summary to paste', icon: Type },
]

export interface ShareDialogProps {
  /** "Share your budget". */
  readonly heading: string
  /** The start of each file's name: "sumyard-budget". */
  readonly fileStem: string
  /** What the spreadsheet holds, under its format name. */
  readonly csvHint: string
  /** The amounts switch's hint: "Off: every figure as a share of your income." */
  readonly amountsHint: string
  /** The line names switch's hint; no switch without one. */
  readonly namesHint?: string
  /** The names switch's label, when a page's names are not lines (the car decision's options). */
  readonly namesLabel?: string
  /** The model and the CSV for the chosen options. */
  readonly build: (options: ShareOptions, style: AmountStyle, now: Date) => { readonly model: ShareModel; readonly csv: string }
  readonly onClose: () => void
}

/** The card's colours: the light theme's tokens, read from an element set to it, so every card looks the same. */
function readColours(tokens: readonly string[]): CardColours {
  const probe = document.createElement('div')
  probe.setAttribute('data-theme', 'light')
  probe.hidden = true
  document.body.append(probe)
  const style = getComputedStyle(probe)
  const get = (name: string) => style.getPropertyValue(`--sy-${name}`).trim()
  const colours: CardColours = {
    surface: get('surface'),
    surfaceMuted: get('surface-muted'),
    border: get('border'),
    text: get('text'),
    muted: get('text-muted'),
    positive: get('positive'),
    positiveSubtle: get('positive-subtle'),
    danger: get('danger'),
    dangerSubtle: get('danger-subtle'),
    accent: get('accent'),
    onAccent: get('on-accent'),
    part: (token) => parts.get(token) ?? '',
  }
  const parts = new Map(tokens.map((t) => [t, get(t)]))
  probe.remove()
  return colours
}

const canShareFiles = (file: File) =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
const canShareText = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export default function ShareDialog({
  heading,
  fileStem,
  csvHint,
  amountsHint,
  namesHint,
  namesLabel = 'Include line names',
  build,
  onClose,
}: ShareDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const id = useId()
  const style = useStore(settingsStore, (s) => s.amounts)
  const [format, setFormat] = useState<Format>('image')
  const [options, setOptions] = useState<ShareOptions>({ amounts: true, names: true })
  const [status, setStatus] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [now] = useState(() => new Date())
  const { model, csv } = useMemo(() => build(options, style, now), [build, options, style, now])
  const text = useMemo(() => shareText(model), [model])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (typeof el.showModal === 'function' && !el.open) el.showModal()
    const close = () => onClose()
    el.addEventListener('close', close)
    return () => el.removeEventListener('close', close)
  }, [onClose])

  // Draw the card once the app's font is ready, again whenever what it says changes.
  useEffect(() => {
    if (format !== 'image') return
    let live = true
    const ready = typeof document.fonts?.ready?.then === 'function' ? document.fonts.ready : Promise.resolve()
    ready.then(() => {
      const ctx = live ? canvas.current?.getContext('2d') : null
      if (!ctx) return
      drawCard(ctx, model, readColours(model.parts.map((p) => p.colour)))
      canvas.current?.toBlob((blob) => {
        if (live && blob) setImageFile(new File([blob], shareFileName(fileStem, now, 'png'), { type: 'image/png' }))
      }, 'image/png')
    })
    return () => {
      live = false
    }
  }, [format, model, now, fileStem])

  const say = (message: string) => setStatus(message)
  const close = () => dialog.current?.close()

  const actions: Record<Format, { label: string; icon: typeof Image; run: () => void; disabled?: boolean }[]> = {
    image: [
      ...(imageFile && canShareFiles(imageFile)
        ? [
            {
              label: 'Share image…',
              icon: Share2,
              run: () => {
                navigator.share({ files: [imageFile], title: model.title }).catch(() => undefined)
              },
            },
          ]
        : []),
      {
        label: 'Download image',
        icon: Download,
        disabled: !imageFile,
        run: () => {
          if (imageFile && downloadBlob(imageFile.name, imageFile)) say('Image saved to your downloads.')
        },
      },
    ],
    pdf: [
      {
        label: 'Print or save as PDF',
        icon: Printer,
        run: () => {
          say('In the print window, choose Save as PDF to make a file.')
          window.print()
        },
      },
    ],
    csv: [
      {
        label: 'Download spreadsheet',
        icon: Download,
        run: () => {
          if (downloadText(shareFileName(fileStem, now, 'csv'), csv, 'text/csv')) say('Spreadsheet saved to your downloads.')
        },
      },
    ],
    text: [
      ...(canShareText()
        ? [
            {
              label: 'Share…',
              icon: Share2,
              run: () => {
                navigator.share({ text, title: model.title }).catch(() => undefined)
              },
            },
          ]
        : []),
      {
        label: 'Copy text',
        icon: Copy,
        run: () => {
          navigator.clipboard
            ?.writeText(text)
            .then(() => say('Copied. Paste it into a message.'))
            .catch(() => say('Couldn’t copy. Select the text and copy it instead.'))
        },
      },
    ],
  }

  return (
    <>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="m-auto max-h-[var(--sy-full-sheet-height)] w-full max-w-[var(--sy-content-max)] overflow-y-auto rounded-lg border border-border bg-surface p-0 text-text shadow-lg backdrop:bg-overlay"
      >
        <div className="flex flex-col gap-5 p-4 md:flex-row md:p-6">
          <div className="flex min-w-0 flex-col gap-5 md:w-80 md:shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`${id}-title`} className="text-xl font-semibold">
                  {heading}
                </h2>
                <p id={`${id}-desc`} className="text-sm text-text-muted">
                  Made on this device. Nothing is uploaded.
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close" title="Close (Esc)" onClick={close}>
                <X />
              </Button>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Format</legend>
              {formats(csvHint).map((f) => {
                const Icon = f.icon
                return (
                  <label
                    key={f.id}
                    className={cn(
                      'flex min-h-touch cursor-pointer items-center gap-3 rounded-md border-2 px-3 py-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
                      format === f.id ? 'border-accent bg-accent-subtle' : 'border-border',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-format`}
                      value={f.id}
                      checked={format === f.id}
                      onChange={() => {
                        setFormat(f.id)
                        say('')
                      }}
                      className="sr-only"
                    />
                    <Icon aria-hidden="true" className={cn('size-5 shrink-0', format === f.id ? 'text-accent' : 'text-text-muted')} />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{f.name}</span>
                      <span className="text-xs text-text-muted">{f.hint}</span>
                    </span>
                  </label>
                )
              })}
            </fieldset>

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">What to include</legend>
              <Toggle
                id={`${id}-amounts`}
                label="Show amounts"
                hint={amountsHint}
                checked={options.amounts}
                onChange={(amounts) => setOptions({ ...options, amounts })}
              />
              {namesHint && (
                <Toggle
                  id={`${id}-names`}
                  label={namesLabel}
                  hint={namesHint}
                  checked={options.names}
                  onChange={(names) => setOptions({ ...options, names })}
                />
              )}
            </fieldset>

            <div className="flex flex-wrap gap-2">
              {actions[format].map((a, i) => {
                const Icon = a.icon
                return (
                  <Button
                    key={a.label}
                    variant={i === actions[format].length - 1 ? 'primary' : 'secondary'}
                    disabled={a.disabled}
                    onClick={a.run}
                  >
                    <Icon />
                    {a.label}
                  </Button>
                )
              })}
            </div>
            <p role="status" className="min-h-5 text-sm text-text-muted">
              {status}
            </p>
          </div>

          <div className="flex min-w-0 flex-1 items-start justify-center rounded-md bg-surface-muted p-3 md:p-6">
            {format === 'image' && (
              <canvas
                ref={canvas}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                role="img"
                aria-label={`The image card: ${model.headlineLabel} ${model.headline}`}
                className="h-auto w-full max-w-sm rounded-lg shadow-md"
              />
            )}
            {format === 'pdf' && (
              <div className="w-full max-w-xl overflow-hidden rounded-sm bg-surface shadow-md" data-theme="light">
                <PrintPage model={model} />
              </div>
            )}
            {format === 'csv' && (
              <section
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-focusable (axe scrollable-region-focusable).
                tabIndex={0}
                aria-label="The spreadsheet, as it will be saved"
                className="w-full overflow-auto rounded-md bg-surface p-3 shadow-md"
              >
                <pre className="font-mono text-xs whitespace-pre text-text">{csv}</pre>
              </section>
            )}
            {format === 'text' && (
              <section aria-label="The text, as it will be copied" className="w-full max-w-xl">
                <pre className="rounded-md bg-surface p-4 font-sans text-sm whitespace-pre-wrap text-text shadow-md">{text}</pre>
              </section>
            )}
          </div>
        </div>
      </dialog>
      {createPortal(
        <div id="sy-print-root" data-theme="light">
          <PrintPage model={model} />
        </div>,
        document.body,
      )}
    </>
  )
}

/** The A4 summary: the preview and what prints. */
function PrintPage({ model: m }: { model: ShareModel }) {
  const parts = m.parts
  return (
    <article className="flex flex-col gap-5 bg-surface p-6 text-sm text-text">
      <header className="flex items-end justify-between gap-4 border-b-2 border-text pb-3">
        <div>
          <p className="text-xs text-text-muted">Sumyard</p>
          <h1 className="text-2xl font-bold">{m.title}</h1>
        </div>
        <p className="text-right text-text-muted">{m.when}</p>
      </header>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md bg-positive-subtle p-3">
          <p className="text-xs text-text">{m.headlineLabel}</p>
          <p className={cn('text-xl font-bold tabular-nums', m.negative ? 'text-danger' : 'text-positive')}>{m.headline}</p>
        </div>
        {m.stats.map((s) => (
          <div key={s.label} className="rounded-md bg-surface-muted p-3">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className="text-xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </section>
      {m.tiles.length > 0 && (
        <section>
          <h2 className="mb-1 text-base font-semibold">
            {m.tilesTitle}, {m.period}
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              {m.tiles.map((a) => (
                <tr key={a.name} className="border-t border-border">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {a.name}
                  </th>
                  <td className="py-1.5 text-right text-text-muted">{a.note}</td>
                  <td className={cn('py-1.5 pl-4 text-right font-semibold tabular-nums', a.short && 'text-danger')}>{a.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section>
        <h2 className="mb-1 text-base font-semibold">
          {m.partsTitle}, {m.period}
        </h2>
        <div aria-hidden="true" className="mb-2 flex h-3 gap-0.5 overflow-hidden rounded-full">
          {parts.map((p) => (
            <div key={p.id} style={{ width: `${(p.year / Math.max(m.total, 1)) * 100}%`, backgroundColor: partColour(p.colour) }} />
          ))}
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {parts.map((p) => (
              <PartRows key={p.id} part={p} />
            ))}
          </tbody>
        </table>
      </section>
      <footer className="border-t border-border pt-2 text-xs text-text-muted">
        {m.footer} {m.printNote}
      </footer>
    </article>
  )
}

/** A part's colour token as a CSS colour (the print page is in the light theme). */
const partColour = (token: string) => `var(--sy-${token})`

function PartRows({ part }: { part: ShareModel['parts'][number] }) {
  return (
    <>
      <tr className="border-t border-border bg-surface-muted">
        <th scope="row" className="py-1.5 pl-1 text-left font-semibold">
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-2.5 rounded-full"
            style={{ backgroundColor: partColour(part.colour) }}
          />
          {part.label}
        </th>
        <td className="py-1.5 pr-1 text-right font-semibold tabular-nums">{part.value}</td>
      </tr>
      {part.lines.map((l) => (
        <tr key={l.key} className="border-t border-border">
          <th scope="row" className="py-1 pl-6 text-left font-normal">
            {l.name}
            {l.note && <span className="text-text-muted"> · {l.note}</span>}
          </th>
          <td className="py-1 pr-1 text-right tabular-nums">{l.value}</td>
        </tr>
      ))}
    </>
  )
}
