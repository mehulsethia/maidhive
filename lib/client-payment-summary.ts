import type { BookingRead } from '@/types'
import { getClientCancellationPaymentOutcome } from '@/lib/booking-payment-outcome'

function money(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

function isSettledPaymentStatus(status?: string | null) {
  return ['captured', 'transferred', 'partially_refunded', 'refunded'].includes(String(status ?? ''))
}

export function getClientPaymentSummary(booking: BookingRead) {
  const cancellationPaymentOutcome = getClientCancellationPaymentOutcome(booking)
  const originalTotal = money(booking.payment?.amount ?? booking.total_amount)
  const refundAmount = cancellationPaymentOutcome.kind === 'refund_issued'
    ? money(cancellationPaymentOutcome.amount)
    : isSettledPaymentStatus(booking.payment?.status)
    ? Math.min(originalTotal, Math.max(0, money(booking.payment?.refund_amount)))
    : 0
  const finalAmountPaid = cancellationPaymentOutcome.kind === 'hold_released' || cancellationPaymentOutcome.kind === 'no_payment_taken'
    ? 0
    : money(Math.max(0, originalTotal - refundAmount))
  const hasRefund = refundAmount > 0
  const isFullyRefunded = hasRefund && finalAmountPaid === 0
  const isPartiallyRefunded = hasRefund && finalAmountPaid > 0
  const cancellationFinalLabel =
    cancellationPaymentOutcome.kind === 'hold_released'
      ? 'You have not been charged'
      : cancellationPaymentOutcome.kind === 'no_payment_taken'
        ? 'No payment was taken'
        : cancellationPaymentOutcome.kind === 'refund_issued'
          ? cancellationPaymentOutcome.compactMessage
          : null

  return {
    originalTotal,
    refundAmount,
    finalAmountPaid,
    hasRefund,
    isPartiallyRefunded,
    isFullyRefunded,
    refundLabel: isFullyRefunded ? 'Full refund' : isPartiallyRefunded ? 'Partial refund' : null,
    dashboardRefundLabel: cancellationFinalLabel ?? (isFullyRefunded ? 'Refunded' : isPartiallyRefunded ? 'Partial refund' : null),
    financialStatusLabel: cancellationFinalLabel ?? (isFullyRefunded
      ? 'Refunded'
      : isPartiallyRefunded
        ? 'Partially refunded'
        : null),
    cancellationPaymentOutcome,
  }
}
