import { Separator } from '@/components/ui/separator'
import { PlatformFeeNotice } from '@/components/platform-fee-notice'
import { isMinimumPlatformFeeApplied } from '@/lib/platform-fee'
import { formatCurrency } from '@/lib/utils'
import type { PriceBreakdown } from '@/types'

export function PriceBreakdownCard({
  breakdown,
  showPlatformFee = true,
}: {
  breakdown: PriceBreakdown
  showPlatformFee?: boolean
}) {
  const minimumFeeApplied = isMinimumPlatformFeeApplied({
    subtotal: breakdown.subtotal,
    platformFee: breakdown.platform_fee,
    platformFeePct: breakdown.platform_fee_pct,
  })

  return (
    <div className="min-w-0 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <h4 className="font-semibold tracking-tight">Price breakdown</h4>
      <Separator />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 text-muted-foreground">
          {formatCurrency(breakdown.hourly_rate)} × {breakdown.duration_hours}h
        </span>
        <span className="shrink-0 text-right tabular-nums">{formatCurrency(breakdown.subtotal)}</span>
      </div>
      {showPlatformFee && (
        <div className="space-y-1">
          <div className="flex min-w-0 items-start justify-between gap-3 text-muted-foreground">
            <span className="min-w-0">
              Secure booking &amp; support fee{minimumFeeApplied ? '' : ` (${breakdown.platform_fee_pct}%)`}
            </span>
            <span className="shrink-0 text-right tabular-nums">{formatCurrency(breakdown.platform_fee)}</span>
          </div>
          <PlatformFeeNotice
            subtotal={breakdown.subtotal}
            platformFee={breakdown.platform_fee}
            platformFeePct={breakdown.platform_fee_pct}
          />
        </div>
      )}
      <Separator />
      <div className="flex min-w-0 items-start justify-between gap-3 text-base font-semibold">
        <span className="min-w-0">Total</span>
        <span className="shrink-0 text-right tabular-nums">{formatCurrency(breakdown.total_amount)}</span>
      </div>
    </div>
  )
}
