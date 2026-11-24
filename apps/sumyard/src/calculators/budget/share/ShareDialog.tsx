import { useCallback } from 'react'
import type { ShareOptions } from '@/components/share/model'
import SharedDialog from '@/components/share/ShareDialog'
import type { AmountStyle } from '@/settings/settings'
import type { BudgetPageInputs } from '../definition'
import type { BudgetResult } from '../types'
import { shareCsv, shareModel } from './summary'

/* Share your budget (BD16): the shared dialog with what a budget says. */

export default function ShareDialog({ inputs, result, onClose }: { inputs: BudgetPageInputs; result: BudgetResult; onClose: () => void }) {
  const build = useCallback(
    (options: ShareOptions, style: AmountStyle, now: Date) => ({
      model: shareModel(inputs, result, options, style, now),
      csv: shareCsv(inputs, result, options),
    }),
    [inputs, result],
  )
  return (
    <SharedDialog
      heading="Share your budget"
      fileStem="sumyard-budget"
      csvHint="Every line, a month and a year (CSV)"
      amountsHint="Off: every figure as a share of your income."
      namesHint="Off: groups only, such as Home and Food."
      build={build}
      onClose={onClose}
    />
  )
}
