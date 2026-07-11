import type { BookingRead, BookingStatus } from '@/types'
import { isCompletedBookingReleased } from '@/lib/booking-release'

const STATUS_PRIORITY: Record<BookingStatus, number> = {
  draft: 2,
  in_progress: 0,
  accepted: 1,
  confirmed: 1,
  pending: 2,
  completed: 3,
  disputed: 3,
  cancelled: 5,
  declined: 5,
  expired: 5,
}

export function getBookingStatusPriority(status: BookingStatus) {
  return STATUS_PRIORITY[status] ?? 99
}

function toMs(value?: string) {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function getConversationPriorityBand(booking: BookingRead) {
  switch (booking.status) {
    case 'confirmed':
      return 0
    case 'in_progress':
      return 1
    case 'disputed':
      return 2
    case 'accepted':
      return 3
    case 'completed':
      return 4
    case 'cancelled':
    case 'declined':
    case 'expired':
      return 5
    default:
      return 6
  }
}

export function compareBookingsByOperationalPriority(a: BookingRead, b: BookingRead) {
  const aPriority = getBookingStatusPriority(a.status)
  const bPriority = getBookingStatusPriority(b.status)
  const aCompletedReleased = isCompletedBookingReleased({
    status: a.status,
    paymentStatus: a.payment?.status,
    transferredAt: a.payment?.transferred_at,
    scheduledEnd: a.scheduled_end,
  })
  const bCompletedReleased = isCompletedBookingReleased({
    status: b.status,
    paymentStatus: b.payment?.status,
    transferredAt: b.payment?.transferred_at,
    scheduledEnd: b.scheduled_end,
  })
  const aEffectivePriority = a.status === 'completed' && aCompletedReleased ? aPriority + 1 : aPriority
  const bEffectivePriority = b.status === 'completed' && bCompletedReleased ? bPriority + 1 : bPriority
  const priorityDiff = aEffectivePriority - bEffectivePriority
  if (priorityDiff !== 0) return priorityDiff

  const historyBand = aEffectivePriority >= 3 && bEffectivePriority >= 3

  const aStart = toMs(a.scheduled_start)
  const bStart = toMs(b.scheduled_start)
  if (aStart !== bStart) return historyBand ? bStart - aStart : aStart - bStart

  return toMs(b.created_at) - toMs(a.created_at)
}

export function compareConversationsByOperationalPriority(a: BookingRead, b: BookingRead) {
  const aBand = getConversationPriorityBand(a)
  const bBand = getConversationPriorityBand(b)
  if (aBand !== bBand) return aBand - bBand

  const aStart = toMs(a.scheduled_start)
  const bStart = toMs(b.scheduled_start)
  if (aStart !== bStart) {
    if (aBand <= 3) {
      return aStart - bStart
    }
    return bStart - aStart
  }

  return toMs(b.created_at) - toMs(a.created_at)
}
