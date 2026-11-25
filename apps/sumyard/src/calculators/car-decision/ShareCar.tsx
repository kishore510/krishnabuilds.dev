import { useCallback } from 'react'
import type { ShareOptions } from '@/components/share/model'
import SharedDialog from '@/components/share/ShareDialog'
import type { AmountStyle } from '@/settings/settings'
import { type CarShare, shareCsv, shareModel } from './share'

/* Share a car decision (CD9): the shared dialog with what this page says, and a switch for the options' names. */

export default function ShareCar({ share, onClose }: { share: CarShare; onClose: () => void }) {
  const build = useCallback(
    (options: ShareOptions, style: AmountStyle, now: Date) => ({
      model: shareModel(share, options, style, now),
      csv: shareCsv(share, options),
    }),
    [share],
  )
  return (
    <SharedDialog
      heading="Share your car decision"
      fileStem="sumyard-car-decision"
      csvHint="Each option’s cost a month, its total and every part of it (CSV)"
      amountsHint="Off: each option as a percentage above the lowest, and its parts as shares, with no pound figure."
      namesLabel="Show option names"
      namesHint="Off: each option by how the car is had, such as PCP or Loan."
      build={build}
      onClose={onClose}
    />
  )
}
