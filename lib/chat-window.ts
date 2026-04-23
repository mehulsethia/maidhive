const DEFAULT_DISPUTE_WINDOW_HOURS = 24

export const CHAT_ELIGIBLE_STATUSES = ['confirmed', 'in_progress', 'completed', 'disputed'] as const

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
  return endMs + getDisputeWindowMs()
}

export function isChatReadOnly(scheduledEnd?: string | Date | null, nowMs = Date.now()) {
  return nowMs > getChatExpiryMs(scheduledEnd)
}
