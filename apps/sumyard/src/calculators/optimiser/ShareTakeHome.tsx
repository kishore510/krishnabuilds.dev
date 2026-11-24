import { useCallback } from 'react'
import type { ShareOptions } from '@/components/share/model'
import SharedDialog from '@/components/share/ShareDialog'
import type { AmountStyle } from '@/settings/settings'
import { shareCsv, shareModel, type TakeHomeShare } from './share'

/* Share your take-home (TH4, TH5): the shared dialog with what a take-home says. No line names toggle. */

export default function ShareTakeHome({ share, onClose }: { share: TakeHomeShare; onClose: () => void }) {
  const build = useCallback(
    (options: ShareOptions, style: AmountStyle, now: Date) => ({
      model: shareModel(share, options, style, now),
      csv: shareCsv(share, options),
    }),
    [share],
  )
  return (
    <SharedDialog
      heading="Share your take-home"
      fileStem="sumyard-take-home"
      csvHint="Gross pay, each part and take-home, a month and a year (CSV)"
      amountsHint="Off: every figure as a share of your gross pay."
      build={build}
      onClose={onClose}
    />
  )
}
