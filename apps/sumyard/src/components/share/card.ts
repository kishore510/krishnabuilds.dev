import type { ShareModel } from './model'

/*
 * The image card (BD16; shared since the take-home redesign): a page's share model drawn on a canvas, a 4:5
 * portrait that suits messages and social posts. Colours come from the
 * design tokens (read by the dialog, always the light theme so a card looks
 * the same to whoever receives it); the font is the app's own Inter. Layout
 * numbers here are drawing geometry, not design tokens.
 */

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

export interface CardColours {
  readonly surface: string
  readonly surfaceMuted: string
  readonly border: string
  readonly text: string
  readonly muted: string
  readonly positive: string
  readonly positiveSubtle: string
  readonly danger: string
  readonly dangerSubtle: string
  readonly accent: string
  readonly onAccent: string
  /** A part's colour from its token name (`ShareModel` part `colour`). */
  readonly part: (token: string) => string
}

const FONT = "'Inter Variable', ui-sans-serif, system-ui, sans-serif"
const PAD = 72

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`

/** Draws text cut to fit `width`, with an ellipsis. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number) {
  if (ctx.measureText(text).width <= width) {
    ctx.fillText(text, x, y)
    return
  }
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1)
  ctx.fillText(`${cut}…`, x, y)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawCard(ctx: CanvasRenderingContext2D, m: ShareModel, c: CardColours) {
  const W = CARD_WIDTH
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = c.surface
  ctx.fillRect(0, 0, W, CARD_HEIGHT)

  // Header: a mark, the title and the month.
  roundRect(ctx, PAD, PAD - 4, 52, 52, 14)
  ctx.fillStyle = c.accent
  ctx.fill()
  ctx.fillStyle = c.onAccent
  ctx.font = font(800, 32)
  ctx.textAlign = 'center'
  ctx.fillText('£', PAD + 26, PAD + 34)
  ctx.textAlign = 'left'
  ctx.fillStyle = c.text
  ctx.font = font(700, 38)
  ctx.fillText(m.title, PAD + 72, PAD + 34)
  ctx.textAlign = 'right'
  ctx.fillStyle = c.muted
  ctx.font = font(500, 30)
  ctx.fillText(m.when, W - PAD, PAD + 34)
  ctx.textAlign = 'left'

  // Headline.
  let y = PAD + 130
  ctx.fillStyle = c.muted
  ctx.font = font(500, 34)
  ctx.fillText(m.headlineLabel, PAD, y)
  y += 112
  ctx.fillStyle = m.negative ? c.danger : c.positive
  ctx.font = font(800, 116)
  fitText(ctx, m.headline, PAD, y, W - 2 * PAD)
  y += 52
  ctx.fillStyle = c.text
  ctx.font = font(500, 32)
  fitText(ctx, m.sentence, PAD, y, W - 2 * PAD)

  // Donut and legend.
  y += 56
  const cx = PAD + 170
  const cy = y + 180
  const radius = 140
  const thick = 64
  const drawn = m.parts.filter((p) => p.year > 0)
  let angle = -Math.PI / 2
  const gap = drawn.length > 1 ? 0.025 : 0
  for (const p of drawn) {
    const sweep = (p.year / m.total) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(cx, cy, radius, angle + gap / 2, angle + Math.max(sweep - gap / 2, gap / 2))
    ctx.strokeStyle = c.part(p.colour)
    ctx.lineWidth = thick
    ctx.stroke()
    angle += sweep
  }
  const legendX = PAD + 380
  const rows = drawn
  const rowHeight = Math.min(46, 400 / Math.max(rows.length, 1))
  let ly = cy - (rows.length * rowHeight) / 2 + rowHeight * 0.7
  for (const p of rows) {
    roundRect(ctx, legendX, ly - 22, 24, 24, 6)
    ctx.fillStyle = c.part(p.colour)
    ctx.fill()
    ctx.fillStyle = c.text
    ctx.font = font(500, 30)
    fitText(ctx, p.label, legendX + 40, ly, W - PAD - legendX - 40 - 170)
    ctx.textAlign = 'right'
    ctx.font = font(700, 30)
    ctx.fillText(p.value, W - PAD, ly)
    ctx.textAlign = 'left'
    ly += rowHeight
  }
  y = cy + radius + thick / 2 + 48

  // Tiles (the budget's accounts).
  if (m.tiles.length > 0) {
    ctx.fillStyle = c.muted
    ctx.font = font(600, 28)
    ctx.fillText(m.tilesTitle, PAD, y)
    y += 20
    const shown = m.tiles.slice(0, 4)
    const cols = shown.length <= 2 ? shown.length : 2
    const tileW = (W - 2 * PAD - (cols - 1) * 20) / cols
    const tileH = 104
    shown.forEach((a, i) => {
      const tx = PAD + (i % cols) * (tileW + 20)
      const ty = y + Math.floor(i / cols) * (tileH + 16)
      roundRect(ctx, tx, ty, tileW, tileH, 18)
      ctx.fillStyle = a.short ? c.dangerSubtle : c.surfaceMuted
      ctx.fill()
      ctx.fillStyle = c.text
      ctx.font = font(500, 26)
      fitText(ctx, a.name, tx + 22, ty + 38, tileW - 44)
      ctx.fillStyle = a.short ? c.danger : c.text
      ctx.font = font(800, 36)
      ctx.fillText(a.value, tx + 22, ty + 82)
      ctx.fillStyle = c.muted
      ctx.font = font(500, 22)
      ctx.textAlign = 'right'
      fitText(ctx, a.short ? 'short' : a.note, tx + tileW - 22, ty + 82, tileW / 2)
      ctx.textAlign = 'left'
    })
    y += Math.ceil(shown.length / cols) * (tileH + 16) + 20
  }

  // Biggest lines.
  if (m.biggest.length > 0 && y < CARD_HEIGHT - 200) {
    roundRect(ctx, PAD, y, W - 2 * PAD, 96, 18)
    ctx.fillStyle = c.surfaceMuted
    ctx.fill()
    ctx.fillStyle = c.text
    ctx.font = font(700, 26)
    ctx.fillText(m.biggestTitle, PAD + 24, y + 38)
    ctx.font = font(500, 26)
    fitText(ctx, m.biggest.join('  ·  '), PAD + 24, y + 76, W - 2 * PAD - 48)
  }

  // Footer.
  ctx.strokeStyle = c.border
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, CARD_HEIGHT - PAD - 44)
  ctx.lineTo(W - PAD, CARD_HEIGHT - PAD - 44)
  ctx.stroke()
  ctx.fillStyle = c.muted
  ctx.font = font(500, 24)
  ctx.fillText(m.footer, PAD, CARD_HEIGHT - PAD)
  ctx.restore()
}
