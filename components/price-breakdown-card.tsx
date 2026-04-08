import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import type { PriceBreakdown } from '@/types'

export function PriceBreakdownCard({ breakdown }: { breakdown: PriceBreakdown }) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <h4 className="font-semibold tracking-tight">Price breakdown</h4>
      <Separator />
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          {formatCurrency(breakdown.hourly_rate)} × {breakdown.duration_hours}h
        </span>
        <span>{formatCurrency(breakdown.subtotal)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Platform fee ({breakdown.platform_fee_pct}%)</span>
        <span>{formatCurrency(breakdown.platform_fee)}</span>
      </div>
      <Separator />
      <div className="flex justify-between font-semibold text-base">
        <span>Total</span>
        <span>{formatCurrency(breakdown.total_amount)}</span>
      </div>
    </div>
  )
}
