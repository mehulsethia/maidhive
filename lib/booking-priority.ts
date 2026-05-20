import type { BookingRead, BookingStatus } from '@/types'

const STATUS_PRIORITY: Record<BookingStatus, number> = {
  draft: 2,
  in_progress: 0,
  accepted: 1,
  confirmed: 1,
  pending: 2,
  completed: 3,
  disputed: 3,
  cancelled: 4,
  declined: 4,
  expired: 4,
}

export function getBookingStatusPriority(status: BookingStatus) {
  return STATUS_PRIORITY[status] ?? 99
}

function toMs(value?: string) {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

export function compareBookingsByOperationalPriority(a: BookingRead, b: BookingRead) {
  const priorityDiff = getBookingStatusPriority(a.status) - getBookingStatusPriority(b.status)
  if (priorityDiff !== 0) return priorityDiff

  const aPriority = getBookingStatusPriority(a.status)
  const bPriority = getBookingStatusPriority(b.status)
  const historyBand = aPriority >= 3 && bPriority >= 3

  const aStart = toMs(a.scheduled_start)
  const bStart = toMs(b.scheduled_start)
  if (aStart !== bStart) return historyBand ? bStart - aStart : aStart - bStart

  return toMs(b.created_at) - toMs(a.created_at)
}
