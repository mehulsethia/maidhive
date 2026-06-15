const DEFAULT_DISPUTE_WINDOW_HOURS = 24
const CHAT_WINDOW_MINUTES = 30

export const CHAT_HISTORY_STATUSES = ['confirmed', 'in_progress', 'completed', 'disputed'] as const

export function getDisputeWindowHours() {
  const parsed = Number(process.env.NEXT_PUBLIC_DISPUTE_WINDOW_HOURS ?? DEFAULT_DISPUTE_WINDOW_HOURS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DISPUTE_WINDOW_HOURS
}

export function getDisputeWindowMs() {
  return getDisputeWindowHours() * 60 * 60 * 1000
}

export function getChatExpiryMs(scheduledEnd?: string | Date | null) {
  if (!scheduledEnd) return Infinity
  const endMs = new Date(scheduledEnd).getTime()
  if (!Number.isFinite(endMs)) return Infinity
  return endMs + CHAT_WINDOW_MINUTES * 60 * 1000
}

export function isChatReadOnly(
  scheduledEnd?: string | Date | null,
  nowMs = Date.now(),
  bookingStatus?: string | null,
) {
  if (String(bookingStatus ?? '') === 'cancelled') return true
  return nowMs > getChatExpiryMs(scheduledEnd)
}

export function getChatReadOnlyMessage(bookingStatus?: string | null) {
  if (String(bookingStatus ?? '') === 'cancelled') {
    return 'This booking chat is now closed. Messaging is locked immediately after cancellation.'
  }
  return 'This booking chat is now closed. Messaging closed 30 minutes after scheduled booking completion.'
}

export function canViewChatHistoryForBooking(booking: {
  status?: string | null
  scheduled_end?: string | Date | null
  _count?: {
    messages?: number | null
  } | null
}) {
  const status = String(booking.status ?? '')
  if (status === 'cancelled') {
    const messageCount = Number(booking._count?.messages ?? 0)
    return Number.isFinite(messageCount) && messageCount > 0
  }
  return CHAT_HISTORY_STATUSES.includes(status as (typeof CHAT_HISTORY_STATUSES)[number])
}

export function isChatActiveForBooking(booking: {
  status?: string | null
  scheduled_end?: string | Date | null
  _count?: {
    messages?: number | null
  } | null
}, nowMs = Date.now()) {
  return canViewChatHistoryForBooking(booking) &&
    !isChatReadOnly(booking.scheduled_end, nowMs, booking.status)
}

export function canShowActiveMessageCta(booking: {
  status?: string | null
  scheduled_end?: string | Date | null
  _count?: {
    messages?: number | null
  } | null
}, nowMs = Date.now()) {
  const status = String(booking.status ?? '')
  if (['cancelled', 'declined', 'expired'].includes(status)) return false
  return isChatActiveForBooking(booking, nowMs)
}
