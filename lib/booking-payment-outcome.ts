import type { BookingRead } from '@/types'
import { computeConfirmedCancellationPolicy, moneyFromCents } from '@/lib/cancellation-policy'

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

function normalizedCancellationContext(booking: BookingRead) {
  return `${booking.cancellation_reason ?? ''} ${booking.payment?.refund_reason ?? ''}`
    .toLowerCase()
    .replace(/[_-]/g, ' ')
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

export function getClientCancellationPolicyOutcome(booking: BookingRead) {
  if (booking.status !== 'cancelled' || !booking.cancelled_at) return null
  if (!isSuccessfulPaymentStatus(booking.payment?.status)) return null

  const context = normalizedCancellationContext(booking)
  if (context.includes('no show') || context.includes('cancelled by cleaner')) return null

  const hasClientCancellationPolicyMetadata =
    context.includes('client cancellation policy') ||
    context.includes('cancelled by client') ||
    context.includes('client cancelled')
  if (!hasClientCancellationPolicyMetadata) return null

  return computeConfirmedCancellationPolicy({
    scheduledStart: booking.scheduled_start,
    cancelledAt: booking.cancelled_at,
    totalAmount: booking.total_amount,
    subtotal: booking.subtotal ?? Math.max(money(booking.total_amount) - money(booking.platform_fee), 0),
    platformFee: booking.platform_fee,
  })
}

export function getCancellationPaymentOutcome(booking: BookingRead): CancellationPaymentOutcome | null {
  if (booking.status !== 'cancelled') return null

  const originalAmount = money(booking.total_amount)
  const paymentStatus = booking.payment?.status ?? null
  const paymentRefundAmount = booking.payment?.refund_amount
  const hasSuccessfulPayment = isSuccessfulPaymentStatus(paymentStatus)
  const clientCancellationPolicy = getClientCancellationPolicyOutcome(booking)

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
  let cleanerPayoutDue = money(booking.payment?.cleaner_payout)
  const explicitRefund = paymentRefundAmount == null ? null : money(paymentRefundAmount)

  if (paymentStatus === 'captured' || paymentStatus === 'transferred') {
    if (explicitRefund !== null) {
      capturedAmount = Math.max(0, originalAmount - explicitRefund)
      if (clientCancellationPolicy) {
        cleanerPayoutDue = moneyFromCents(clientCancellationPolicy.cleanerPayoutCents)
      }
    } else if (booking.cancelled_at) {
      const policy = clientCancellationPolicy ?? computeConfirmedCancellationPolicy({
        scheduledStart: booking.scheduled_start,
        cancelledAt: booking.cancelled_at,
        totalAmount: booking.total_amount,
        subtotal: booking.subtotal ?? Math.max(originalAmount - money(booking.platform_fee), 0),
        platformFee: booking.platform_fee,
      })

      if (policy && policy.window !== 'more_than_24h') {
        capturedAmount = moneyFromCents(policy.captureCents)
        cleanerPayoutDue = moneyFromCents(policy.cleanerPayoutCents)
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
