import { getCancellationPaymentOutcome } from '@/lib/booking-payment-outcome'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead } from '@/types'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}

export function CancellationPaymentBreakdown({
  booking,
  compact = false,
  showAdminRows = false,
}: {
  booking: BookingRead
  compact?: boolean
  showAdminRows?: boolean
}) {
  const outcome = getCancellationPaymentOutcome(booking)
  if (!outcome) return null

  if (compact) {
    return (
      <p className="text-sm font-semibold text-rose-700">
        Amount not refunded: {formatCurrency(outcome.cancellationFee)}
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm">
      <h4 className="font-semibold tracking-tight text-rose-950">Cancellation payment outcome</h4>
      <Row label="Amount not refunded" value={formatCurrency(outcome.cancellationFee)} />
      <Row label="Original booking total" value={formatCurrency(outcome.originalAmount)} />
      <Row label="Client refund/released amount" value={formatCurrency(outcome.releasedAmount)} />
      {showAdminRows && (
        <>
          <Row label="Amount captured" value={formatCurrency(outcome.capturedAmount)} />
          <Row label="Cleaner payout due" value={formatCurrency(outcome.cleanerPayoutDue)} />
          <Row label="Final platform amount retained" value={`${formatCurrency(outcome.platformRetainedAmount)} before Stripe fees`} />
        </>
      )}
    </div>
  )
}
