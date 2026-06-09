import type { BookingRead } from '@/types'

export type CancellationPaymentOutcome = {
  originalAmount: number
  capturedAmount: number
  releasedAmount: number
  cancellationFee: number
  cleanerPayoutDue: number
  platformRetainedAmount: number
}

function money(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function isSuccessfulPaymentStatus(status?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(status ?? ''))
}

export function isNonPayableBookingState(booking: BookingRead) {
  const paymentStatus = booking.payment?.status ?? null
  if (booking.status === 'draft' || booking.status === 'expired') return true
  if (paymentStatus === 'failed') return true
  if (booking.status === 'cancelled' && !isSuccessfulPaymentStatus(paymentStatus)) return true
  if (booking.status === 'pending' && !isSuccessfulPaymentStatus(paymentStatus)) return true
  return false
}

export function getCancellationPaymentOutcome(booking: BookingRead): CancellationPaymentOutcome | null {
  if (booking.status !== 'cancelled') return null

  const originalAmount = money(booking.total_amount)
  const paymentStatus = booking.payment?.status ?? null
  const paymentRefundAmount = booking.payment?.refund_amount
  const hasSuccessfulPayment = isSuccessfulPaymentStatus(paymentStatus)

  if (!hasSuccessfulPayment) {
    return {
      originalAmount,
      capturedAmount: 0,
      releasedAmount: originalAmount,
      cancellationFee: 0,
      cleanerPayoutDue: 0,
      platformRetainedAmount: 0,
    }
  }

  let capturedAmount = 0
  let cleanerPayoutDue = 0
  const explicitRefund = paymentRefundAmount == null ? null : money(paymentRefundAmount)

  if (paymentStatus === 'captured' || paymentStatus === 'transferred') {
    if (explicitRefund !== null) {
      capturedAmount = Math.max(0, originalAmount - explicitRefund)
    } else if (booking.cancelled_at) {
      const cancelledAtMs = new Date(booking.cancelled_at).getTime()
      const startsAtMs = new Date(booking.scheduled_start).getTime()
      const hoursUntilStart = (startsAtMs - cancelledAtMs) / (60 * 60 * 1000)
      const subtotal = money(booking.subtotal ?? Math.max(originalAmount - money(booking.platform_fee), 0))
      const platformFee = money(booking.platform_fee)

      if (Number.isFinite(hoursUntilStart) && hoursUntilStart > 12 && hoursUntilStart <= 24) {
        capturedAmount = Math.min(originalAmount, 5)
      } else if (Number.isFinite(hoursUntilStart) && hoursUntilStart <= 12) {
        capturedAmount = Math.min(originalAmount, subtotal * 0.5 + platformFee)
        cleanerPayoutDue = Math.max(0, capturedAmount - platformFee)
      } else {
        capturedAmount = money(booking.payment?.amount ?? originalAmount)
      }
    } else {
      capturedAmount = money(booking.payment?.amount ?? originalAmount)
    }
  }

  const roundedCaptured = roundMoney(Math.min(originalAmount, capturedAmount))
  const releasedAmount = roundMoney(Math.max(0, originalAmount - roundedCaptured))
  const cancellationFee = roundedCaptured

  return {
    originalAmount,
    capturedAmount: roundedCaptured,
    releasedAmount,
    cancellationFee,
    cleanerPayoutDue: roundMoney(cleanerPayoutDue),
    platformRetainedAmount: roundMoney(Math.max(0, roundedCaptured - cleanerPayoutDue)),
  }
}
