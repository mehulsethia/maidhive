import { isCompletedBookingReleased } from '@/lib/booking-release'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'

export type CleanerPaymentHistoryTone = 'ok' | 'warn' | 'issue'

export type CleanerPaymentHistoryEntry = {
  booking: BookingRead
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

  if (booking.status === 'completed') {
    const released = isCompletedBookingReleased({
      status: booking.status,
      paymentStatus: booking.payment?.status,
      scheduledEnd: booking.scheduled_end,
      nowMs,
    })
    return {
      label: released ? 'Released' : 'Awaiting release',
      tone: released ? 'ok' : 'warn',
    }
  }

  if (booking.status === 'cancelled') {
    const cancellationCompensation = Number(booking.payment?.cleaner_payout ?? booking.cleaner_payout ?? 0)
    if (cancellationCompensation > 0) {
      if (paymentStatus === 'failed') {
        return { label: 'Payment issue - admin review', tone: 'issue' }
      }
      const released = paymentStatus === 'transferred' || Boolean(booking.payment?.transferred_at)
      return {
        label: released
          ? `Cancellation compensation released: ${formatCurrency(cancellationCompensation)}`
          : `Cancellation compensation: ${formatCurrency(cancellationCompensation)}`,
        tone: released ? 'ok' : 'warn',
        amount: cancellationCompensation,
      }
    }
    return { label: 'Cancelled - no payout due', tone: 'warn', amount: 0 }
  }

  if (paymentStatus === 'failed' || booking.status === 'disputed') {
    return { label: 'Payment issue - admin review', tone: 'issue' }
  }

  if (['accepted', 'confirmed', 'in_progress'].includes(booking.status)) {
    if (['authorized', 'captured', 'transferred'].includes(paymentStatus)) {
      return { label: 'Payment authorised', tone: 'ok' }
    }
    return { label: 'Payment issue - admin review', tone: 'issue' }
  }

  return null
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
