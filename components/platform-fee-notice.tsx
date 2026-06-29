import { Info } from 'lucide-react'
import { isMinimumPlatformFeeApplied } from '@/lib/platform-fee'

export function PlatformFeeNotice({
  subtotal,
  platformFee,
  platformFeePct = 10,
  className = '',
}: {
  subtotal: number
  platformFee: number
  platformFeePct?: number
  className?: string
}) {
  if (!isMinimumPlatformFeeApplied({ subtotal, platformFee, platformFeePct })) return null

  return (
    <details
      className={`group min-w-0 max-w-full text-xs text-amber-800 ${className}`}
      data-testid="minimum-platform-fee-notice"
    >
      <summary className="inline-flex max-w-full cursor-pointer list-none items-start gap-1 text-left font-medium leading-relaxed hover:underline">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">Minimum platform fee of €2.00 applies.</span>
      </summary>
      <p className="mt-1 max-w-prose break-words rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 leading-relaxed [overflow-wrap:anywhere]">
        Platform fees are normally 10% of the cleaning cost. For bookings where 10% would be less than €2.00, a minimum platform fee of €2.00 applies.
      </p>
    </details>
  )
}
