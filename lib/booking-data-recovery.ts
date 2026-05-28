import { bookingsApi, notificationsApi } from '@/lib/api'
import { compareBookingsByOperationalPriority } from '@/lib/booking-priority'
import type { BookingRead, NotificationRead } from '@/types'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function extractBookingIds(notifications: NotificationRead[]) {
  const ids = new Set<string>()
  for (const notification of notifications) {
    const bookingId = String(notification.data?.booking_id ?? '').trim()
    if (bookingId && isUuid(bookingId)) ids.add(bookingId)
  }
  return Array.from(ids)
}

export async function recoverBookingsFromNotifications(maxBookings = 24) {
  const notificationsRes = await notificationsApi.list({ page: 1, page_size: 250 })
  const bookingIds = extractBookingIds(notificationsRes.data?.notifications ?? []).slice(0, maxBookings)
  if (bookingIds.length === 0) return []

  const bookingResponses = await Promise.allSettled(
    bookingIds.map((bookingId) => bookingsApi.getById(bookingId)),
  )

  const deduped = new Map<string, BookingRead>()
  for (const response of bookingResponses) {
    if (response.status !== 'fulfilled') continue
    const booking = response.value.data
    if (booking?.id) deduped.set(booking.id, booking)
  }

  return Array.from(deduped.values()).sort(compareBookingsByOperationalPriority)
}

