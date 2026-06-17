import { isCompletedBookingReleased } from '@/lib/booking-release'
import type { BookingStatus } from '@/types'

export function getCleanerEarningsLabel(args: {
  status: BookingStatus
  paymentStatus?: string | null
  scheduledEnd?: string | Date | null
}) {
  const { status, paymentStatus, scheduledEnd } = args
  const payoutReleased = isCompletedBookingReleased({
    status,
    paymentStatus,
    scheduledEnd,
  })
  const showProjectedEarnings =
    status === 'confirmed' ||
    status === 'in_progress' ||
    (status === 'completed' && !payoutReleased)

  if (status === 'disputed') return 'Payout pending review'
  if (payoutReleased) return 'You earned'
  if (showProjectedEarnings) return 'You will earn'
  return 'Booking value'
}
