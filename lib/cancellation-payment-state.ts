import { getCancellationOriginLabel } from '@/lib/cancellation-origin'
import type { BookingRead } from '@/types'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export function isNormalCancellationPaymentRelease(booking: BookingRead) {
  if (booking.status !== 'cancelled' || !booking.payment) return false
  if (booking.payment.status === 'released') return true

  return (
    booking.payment.status === 'failed' &&
    getCancellationOriginLabel(booking) !== null
  )
}

export function getAdminPaymentStateLabel(booking: BookingRead) {
  if (isNormalCancellationPaymentRelease(booking)) return 'payment released'
  return String(booking.payment?.status ?? 'not recorded').replace(/_/g, ' ')
}

export function getPaymentReleaseDescription(booking: BookingRead) {
  if (!isNormalCancellationPaymentRelease(booking)) return null

  const origin = getCancellationOriginLabel(booking)
  const cancelledAtMs = new Date(booking.cancelled_at ?? '').getTime()
  const scheduledStartMs = new Date(booking.scheduled_start).getTime()
  const moreThan24HoursBeforeStart =
    Number.isFinite(cancelledAtMs) &&
    Number.isFinite(scheduledStartMs) &&
    scheduledStartMs - cancelledAtMs > TWENTY_FOUR_HOURS_MS

  if (origin === 'Cancelled by cleaner') {
    return moreThan24HoursBeforeStart
      ? 'Client payment authorisation was released because the cleaner cancelled more than 24 hours before the scheduled start.'
      : 'Client payment authorisation was released because the cleaner cancelled the booking.'
  }

  if (origin === 'Cancelled by client') {
    return moreThan24HoursBeforeStart
      ? 'Client payment authorisation was released because the client cancelled more than 24 hours before the scheduled start.'
      : 'Client payment authorisation was released because the client cancelled the booking.'
  }

  return 'Client payment authorisation was released as part of the normal cancellation process.'
}
