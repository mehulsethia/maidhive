import {
  getCancellationPaymentOutcome,
  getClientCancellationPaymentOutcome,
} from '@/lib/booking-payment-outcome'
import { getCancellationOriginLabel } from '@/lib/cancellation-origin'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead } from '@/types'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 text-right font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  )
}

export function CancellationPaymentBreakdown({
  booking,
  compact = false,
  showAdminRows = false,
  audience = 'client',
}: {
  booking: BookingRead
  compact?: boolean
  showAdminRows?: boolean
  audience?: 'client' | 'cleaner'
}) {
  const outcome = getCancellationPaymentOutcome(booking)
  if (!outcome) return null
  const clientPaymentOutcome = getClientCancellationPaymentOutcome(booking)

  if (compact) {
    if (audience === 'cleaner') {
      const cancelledByCleaner = getCancellationOriginLabel(booking) === 'Cancelled by cleaner'
      if (cancelledByCleaner) {
        return (
          <div className="min-w-0 space-y-0.5 text-sm">
            <p className="font-semibold text-rose-700">Cancelled by you</p>
            <p className="font-semibold text-slate-900">Final payout: {formatCurrency(0)}</p>
          </div>
        )
      }
      return (
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-emerald-700">
            {outcome.cleanerPayoutDue > 0
              ? `Cleaner compensation: ${formatCurrency(outcome.cleanerPayoutDue)}`
              : 'No cleaner compensation'}
          </p>
        </div>
      )
    }
    if (clientPaymentOutcome.kind !== 'none') {
      return (
        <p className="min-w-0 text-sm font-semibold text-emerald-700">
          {clientPaymentOutcome.compactMessage}
        </p>
      )
    }
    const cancellationCharge = outcome.cancellationFee <= 0
      ? 'No cancellation charge'
      : `Cancellation charge: ${formatCurrency(outcome.cancellationFee)}`
    return (
      <p className="min-w-0 text-sm font-semibold text-rose-700">
        {cancellationCharge}
      </p>
    )
  }

  if (audience === 'cleaner') {
    const cancelledByCleaner = getCancellationOriginLabel(booking) === 'Cancelled by cleaner'
    if (cancelledByCleaner) {
      return (
        <div className="min-w-0 space-y-2 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm">
          <h4 className="font-semibold tracking-tight text-rose-950">Cancellation payout outcome</h4>
          <Row label="Original cleaner payout" value={formatCurrency(Number(booking.cleaner_payout ?? 0))} />
          <Row label="Final cleaner payout" value={formatCurrency(0)} />
          <Row label="Reason" value="Cleaner cancelled booking" />
          <Row label="Compensation" value="Not applicable" />
        </div>
      )
    }
    const compensationReleased = booking.payment?.status === 'transferred' || booking.payment?.transferred_at
      ? outcome.cleanerPayoutDue
      : 0
    return (
      <div className="min-w-0 space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm">
        <h4 className="font-semibold tracking-tight text-emerald-950">Compensation outcome</h4>
        <Row label="Cleaner compensation" value={formatCurrency(outcome.cleanerPayoutDue)} />
        <Row label="Original booking value" value={formatCurrency(outcome.originalAmount)} />
        <Row label="Compensation released" value={formatCurrency(compensationReleased)} />
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-2 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-sm">
      <h4 className="font-semibold tracking-tight text-rose-950">Cancellation payment outcome</h4>
      {clientPaymentOutcome.kind !== 'none' && (
        <p className="font-medium text-rose-900">{clientPaymentOutcome.primaryMessage}</p>
      )}
      {outcome.cancellationFee <= 0
        ? clientPaymentOutcome.kind === 'none'
          ? <p className="font-medium text-rose-900">No cancellation charge</p>
          : null
        : <Row label="Cancellation charge" value={formatCurrency(outcome.cancellationFee)} />}
      <Row label="Original booking total" value={formatCurrency(outcome.originalAmount)} />
      {clientPaymentOutcome.amountLabel && clientPaymentOutcome.amount !== null && (
        <Row label={clientPaymentOutcome.amountLabel} value={formatCurrency(clientPaymentOutcome.amount)} />
      )}
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
