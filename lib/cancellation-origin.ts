import type { BookingRead } from '@/types'

export function getCancellationOriginLabel(booking: BookingRead) {
  if (booking.status !== 'cancelled') return null
  if (booking.cancelled_by === booking.client?.user?.id) return 'Cancelled by client'
  if (booking.cancelled_by === booking.cleaner?.user?.id) return 'Cancelled by cleaner'
  if (booking.cancelled_by) return 'Cancelled by platform'

  const reason = String(booking.cancellation_reason ?? '').toLowerCase()
  if (reason.includes('cancelled by client')) return 'Cancelled by client'
  if (reason.includes('cancelled by cleaner')) return 'Cancelled by cleaner'
  return null
}
