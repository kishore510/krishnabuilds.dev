/* Chart data. Values are plain numbers (for money, integer pence); null is a gap. */

/**
 * A line's look: colour token, dash and marker shape together, so no two differ by colour alone. `neutral` is for a
 * reference-like line (money paid in); `secondary` is a fourth line that is not a warning. Neither is the danger
 * colour; `danger` is for a genuine warning only (`dangerStyle.test.ts`).
 */
export type ChartStyle = 'accent' | 'contrast' | 'danger' | 'neutral' | 'secondary'

export interface ChartSeries {
  readonly id: string
  readonly label: string
  readonly kind: 'line' | 'bar'
  readonly values: readonly (number | null)[]
  /** Its look; by default the series' place in the list picks one. */
  readonly style?: ChartStyle
  /**
   * A token colour in place of the style's (the car decision's option colours, CD1), written out whole so Tailwind finds
   * them. The style's dash and marker stay, so lines still differ by more than colour. Never the danger colour.
   */
  readonly colour?: { readonly stroke: string; readonly fill: string }
}

/** A horizontal reference line (a threshold), labelled. */
export interface ChartReference {
  readonly label: string
  readonly value: number
}

/** A vertical marker at an x value (numeric x only), numbered on the chart and listed with its label. */
export interface ChartMarker {
  readonly x: number
  readonly label: string
}

/** A range of x values (numeric x only), lettered and shaded on the chart; the line across it is dashed. */
export interface ChartSpan {
  readonly from: number
  readonly to: number
  readonly label: string
}
