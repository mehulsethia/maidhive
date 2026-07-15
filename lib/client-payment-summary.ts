import type { BookingRead } from '@/types'

function money(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

function isSettledPaymentStatus(status?: string | null) {
  return ['captured', 'transferred', 'partially_refunded', 'refunded'].includes(String(status ?? ''))
}

export function getClientPaymentSummary(booking: BookingRead) {
  const originalTotal = money(booking.payment?.amount ?? booking.total_amount)
  const refundAmount = isSettledPaymentStatus(booking.payment?.status)
    ? Math.min(originalTotal, Math.max(0, money(booking.payment?.refund_amount)))
    : 0
  const finalAmountPaid = money(Math.max(0, originalTotal - refundAmount))
  const hasRefund = refundAmount > 0
  const isFullyRefunded = hasRefund && finalAmountPaid === 0
  const isPartiallyRefunded = hasRefund && finalAmountPaid > 0

  return {
    originalTotal,
    refundAmount,
    finalAmountPaid,
    hasRefund,
    isPartiallyRefunded,
    isFullyRefunded,
    refundLabel: isFullyRefunded ? 'Full refund' : isPartiallyRefunded ? 'Partial refund' : null,
    dashboardRefundLabel: isFullyRefunded ? 'Refunded' : isPartiallyRefunded ? 'Partial refund' : null,
    financialStatusLabel: isFullyRefunded
      ? 'Refunded'
      : isPartiallyRefunded
        ? 'Partially refunded'
        : null,
  }
}
