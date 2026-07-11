import { Separator } from '@/components/ui/separator'
import { getClientPaymentSummary } from '@/lib/client-payment-summary'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead } from '@/types'

export function ClientPaymentOutcome({ booking }: { booking: BookingRead }) {
  const summary = getClientPaymentSummary(booking)
  if (!summary.hasRefund) return null

  return (
    <div className="min-w-0 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <div>
        <h4 className="font-semibold tracking-tight text-emerald-950">Final payment outcome</h4>
        <p className="mt-0.5 text-xs text-emerald-800">
          {summary.isPartiallyRefunded ? 'Partial refund issued.' : 'Refund issued.'}
        </p>
      </div>
      <Separator className="bg-emerald-200" />
      <div className="flex min-w-0 items-start justify-between gap-3 text-emerald-950">
        <span className="min-w-0">Original total</span>
        <span className="shrink-0 text-right tabular-nums">{formatCurrency(summary.originalTotal)}</span>
      </div>
      <div className="flex min-w-0 items-start justify-between gap-3 font-semibold text-emerald-800">
        <span className="min-w-0">Partial refund</span>
        <span className="shrink-0 text-right tabular-nums">-{formatCurrency(summary.refundAmount)}</span>
      </div>
      <Separator className="bg-emerald-200" />
      <div className="flex min-w-0 items-start justify-between gap-3 text-base font-semibold text-emerald-950">
        <span className="min-w-0">Final amount paid</span>
        <span className="shrink-0 text-right tabular-nums">{formatCurrency(summary.finalAmountPaid)}</span>
      </div>
    </div>
  )
}
