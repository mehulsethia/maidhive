import type { BookingRead } from '@/types'

export function getCancellationOriginLabel(booking: BookingRead) {
  if (booking.status !== 'cancelled' || !booking.cancelled_by) return null
  if (booking.cancelled_by === booking.client?.user?.id) return 'Cancelled by client'
  if (booking.cancelled_by === booking.cleaner?.user?.id) return 'Cancelled by cleaner'
  return 'Cancelled by platform'
}
