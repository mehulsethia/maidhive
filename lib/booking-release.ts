import { getDisputeWindowMs } from '@/lib/chat-window'

function toMs(value?: string | Date | null) {
  if (!value) return Number.NaN
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : Number.NaN
}

export function getBookingReportDeadlineMs(scheduledEnd?: string | Date | null) {
  const endMs = toMs(scheduledEnd)
  if (!Number.isFinite(endMs)) return Number.NaN
  return endMs + getDisputeWindowMs()
}

export function isBookingReportWindowActive(scheduledEnd?: string | Date | null, nowMs = Date.now()) {
  const deadlineMs = getBookingReportDeadlineMs(scheduledEnd)
  return Number.isFinite(deadlineMs) && nowMs <= deadlineMs
}

export function isCompletedBookingReleased(args: {
  status?: string | null
  paymentStatus?: string | null
  scheduledEnd?: string | Date | null
  nowMs?: number
}) {
  const { status, paymentStatus, scheduledEnd, nowMs = Date.now() } = args
  if (status !== 'completed') return false
  if (String(paymentStatus ?? '') === 'transferred') return true
  return !isBookingReportWindowActive(scheduledEnd, nowMs)
}
