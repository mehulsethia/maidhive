import { isCompletedBookingReleased } from '@/lib/booking-release'
import type { BookingStatus } from '@/types'

export function getCleanerEarningsLabel(args: {
  status: BookingStatus
  paymentStatus?: string | null
  transferredAt?: string | Date | null
  scheduledEnd?: string | Date | null
  disputeStatus?: string | null
}) {
  const { status, paymentStatus, transferredAt, scheduledEnd, disputeStatus } = args
  const payoutReleased = isCompletedBookingReleased({
    status,
    paymentStatus,
    transferredAt,
    scheduledEnd,
    disputeStatus,
  })
  const showProjectedEarnings =
    status === 'confirmed' ||
    status === 'in_progress' ||
    (status === 'completed' && !payoutReleased)

  if (status === 'disputed' || disputeStatus === 'open' || disputeStatus === 'under_review') return 'Payout pending review'
  if (payoutReleased) return 'You earned'
  if (showProjectedEarnings) return 'You will earn'
  return 'Booking value'
}
