import type { BookingRead } from '@/types'

function eventMs(value?: string | null) {
  const ms = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(ms) ? ms : 0
}

export function getBookingLatestActivityMs(booking: BookingRead) {
  const actionEventMs = Math.max(
    0,
    ...(booking.action_events ?? []).map((event) => eventMs(event.created_at)),
  )
  return Math.max(
    actionEventMs,
    eventMs(booking.dispute?.resolved_at),
    eventMs(booking.payment?.transferred_at),
    eventMs(booking.completed_at),
    eventMs(booking.cancelled_at),
    eventMs(booking.confirmed_at),
    eventMs(booking.accepted_at),
    eventMs(booking.updated_at),
    eventMs(booking.created_at),
  )
}

export function compareBookingsByRecentActivity(a: BookingRead, b: BookingRead) {
  const activityDiff = getBookingLatestActivityMs(b) - getBookingLatestActivityMs(a)
  if (activityDiff !== 0) return activityDiff
  return eventMs(b.created_at) - eventMs(a.created_at)
}
