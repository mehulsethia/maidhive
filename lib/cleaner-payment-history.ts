import { isCompletedBookingReleased } from '@/lib/booking-release'
import { getCancellationPaymentOutcome } from '@/lib/booking-payment-outcome'
import { getCleanerPayoutSummary } from '@/lib/cleaner-payout'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'

export type CleanerPaymentHistoryTone = 'ok' | 'warn' | 'issue'

export type CleanerPaymentHistoryEntry = {
  booking: BookingRead
  paymentType: 'Booking payout' | 'Cancellation compensation' | 'No-show compensation' | 'Payment issue'
  label: string
  tone: CleanerPaymentHistoryTone
  amount?: number
}

export const CLEANER_PAYMENT_HISTORY_SOURCE_STATUSES: BookingStatus[] = [
  'completed',
  'disputed',
  'accepted',
  'confirmed',
  'in_progress',
  'cancelled',
]

export function classifyCleanerPaymentHistoryBooking(
  booking: BookingRead,
  nowMs = Date.now(),
): Omit<CleanerPaymentHistoryEntry, 'booking'> | null {
  const paymentStatus = String(booking.payment?.status ?? '').trim()
  const cancellationContext = `${booking.cancellation_reason ?? ''} ${booking.payment?.refund_reason ?? ''}`
    .toLowerCase()
    .replace(/[_-]/g, ' ')
  const isClientNoShowCompensation = booking.dispute?.issue_type === 'client_no_show' ||
    cancellationContext.includes('client no show')

  if (booking.status === 'completed') {
    const released = isCompletedBookingReleased({
      status: booking.status,
      paymentStatus: booking.payment?.status,
      transferredAt: booking.payment?.transferred_at,
      scheduledEnd: booking.scheduled_end,
      nowMs,
    })
    const payout = getCleanerPayoutSummary(booking).finalCleanerPayout
    return {
      paymentType: isClientNoShowCompensation ? 'No-show compensation' : 'Booking payout',
      label: released ? 'Released' : 'Awaiting release',
      tone: released ? 'ok' : 'warn',
      amount: payout,
    }
  }

  if (booking.status === 'cancelled') {
    const cancellationOutcome = getCancellationPaymentOutcome(booking)
    const cancellationCompensation = cancellationOutcome?.cleanerPayoutDue ?? Number(booking.payment?.cleaner_payout ?? booking.cleaner_payout ?? 0)
    const paymentType = isClientNoShowCompensation
      ? 'No-show compensation' as const
      : 'Cancellation compensation' as const
    if (paymentStatus === 'failed') {
      return { paymentType: 'Payment issue', label: 'Payment issue - admin review', tone: 'issue' }
    }
    if (cancellationCompensation > 0) {
      const released = paymentStatus === 'transferred' || Boolean(booking.payment?.transferred_at)
      return {
        paymentType,
        label: released
          ? `Cancellation compensation released: ${formatCurrency(cancellationCompensation)}`
          : `Cancellation compensation: ${formatCurrency(cancellationCompensation)}`,
        tone: released ? 'ok' : 'warn',
        amount: cancellationCompensation,
      }
    }
    return { paymentType, label: 'Cancelled - no payout due', tone: 'warn', amount: 0 }
  }

  if (paymentStatus === 'failed' || booking.status === 'disputed') {
    return { paymentType: 'Payment issue', label: 'Payment issue - admin review', tone: 'issue' }
  }

  if (['accepted', 'confirmed', 'in_progress'].includes(booking.status)) {
    if (['authorized', 'captured', 'transferred'].includes(paymentStatus)) {
      return { paymentType: 'Booking payout', label: 'Payment authorised', tone: 'ok' }
    }
    return { paymentType: 'Payment issue', label: 'Payment issue - admin review', tone: 'issue' }
  }

  return null
}

export function getReleasedCleanerEarnings(bookings: BookingRead[], nowMs = Date.now()) {
  return bookings.reduce((sum, booking) => {
    const payout = booking.status === 'cancelled'
      ? (getCancellationPaymentOutcome(booking)?.cleanerPayoutDue ?? Number(booking.payment?.cleaner_payout ?? 0))
      : getCleanerPayoutSummary(booking).finalCleanerPayout
    if (!Number.isFinite(payout) || payout <= 0) return sum
    return isCleanerEarningReleased(booking, nowMs) ? sum + payout : sum
  }, 0)
}

export function isCleanerEarningReleased(booking: BookingRead, nowMs = Date.now()) {
  if (booking.status === 'completed') {
    return isCompletedBookingReleased({
      status: booking.status,
      paymentStatus: booking.payment?.status,
      transferredAt: booking.payment?.transferred_at,
      scheduledEnd: booking.scheduled_end,
      nowMs,
    })
  }

  return booking.status === 'cancelled' && (
    booking.payment?.status === 'transferred' || Boolean(booking.payment?.transferred_at)
  )
}

export function buildCleanerPaymentHistory(
  bookings: BookingRead[],
  nowMs = Date.now(),
): CleanerPaymentHistoryEntry[] {
  return bookings
    .map((booking) => {
      const classified = classifyCleanerPaymentHistoryBooking(booking, nowMs)
      if (!classified) return null
      return { booking, ...classified }
    })
    .filter((entry): entry is CleanerPaymentHistoryEntry => Boolean(entry))
    .sort((a, b) => new Date(b.booking.scheduled_start).getTime() - new Date(a.booking.scheduled_start).getTime())
}

export function dedupeBookingsById(bookings: BookingRead[]): BookingRead[] {
  const seen = new Set<string>()
  const deduped: BookingRead[] = []
  for (const booking of bookings) {
    if (!booking?.id || seen.has(booking.id)) continue
    seen.add(booking.id)
    deduped.push(booking)
  }
  return deduped
}
