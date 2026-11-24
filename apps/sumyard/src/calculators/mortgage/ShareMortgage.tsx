import { useCallback } from 'react'
import type { ShareOptions } from '@/components/share/model'
import SharedDialog from '@/components/share/ShareDialog'
import type { AmountStyle } from '@/settings/settings'
import { type MortgageShare, shareCsv, shareModel } from './share'

/* Share a mortgage overpayment (the mortgage redesign): the shared dialog with what this page says. No line names toggle. */

export default function ShareMortgage({ share, onClose }: { share: MortgageShare; onClose: () => void }) {
  const build = useCallback(
    (options: ShareOptions, style: AmountStyle, now: Date) => ({
      model: shareModel(share, options, style, now),
      csv: shareCsv(share, options),
    }),
    [share],
  )
  return (
    <SharedDialog
      heading="Share your mortgage overpayment"
      fileStem="sumyard-mortgage"
      csvHint="Without and with overpaying: each part of what you pay, interest saved and the returns (CSV)"
      amountsHint="Off: shares and times only, with no pound figure (the balance stays private)."
      build={build}
      onClose={onClose}
    />
  )
}
