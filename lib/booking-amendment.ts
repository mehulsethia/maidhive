import type { BookingRead } from '@/types'

export const AMEND_MAX_SHIFT_MS = 3 * 60 * 60 * 1000
export const AMENDMENT_EXPIRY_OUTCOME_COPY =
  'If no response is received before the response window expires, the amendment request will expire and the original booking time will remain in effect.'
export const AMENDMENT_EXPIRED_TITLE = 'Amend Start Time Request Expired'
export const AMENDMENT_EXPIRED_BODY =
  'The amendment request expired because no response was received before the response window. The original booking time remains in effect.'

function cyprusDateStr(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(date)
}

export function isWithinAmendStartWindow(
  slotStartLike: string | Date,
  scheduledStartLike: string | Date,
  maxShiftMs = AMEND_MAX_SHIFT_MS,
) {
  const slotStart = new Date(slotStartLike)
  const scheduledStart = new Date(scheduledStartLike)
  if (Number.isNaN(slotStart.getTime()) || Number.isNaN(scheduledStart.getTime())) return false
  if (cyprusDateStr(slotStart) !== cyprusDateStr(scheduledStart)) return false
  return Math.abs(slotStart.getTime() - scheduledStart.getTime()) <= maxShiftMs
}

export function hasPendingAmendmentRequest(booking: Pick<BookingRead, 'proposal_context' | 'proposed_start' | 'proposal_by' | 'status'>) {
  return (
    booking.proposal_context === 'amend_start' &&
    Boolean(booking.proposed_start && booking.proposal_by) &&
    ['accepted', 'confirmed'].includes(booking.status)
  )
}
