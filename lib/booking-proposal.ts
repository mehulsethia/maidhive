import type { BookingRead } from '@/types'

export const RESCHEDULE_CUTOFF_HOURS = 24
export const POST_CONFIRMATION_REAUTH_ACCEPT_MIN_LEAD_HOURS = 4
export const ALTERNATIVE_PROPOSAL_WINDOW_DAYS = 14
export const PLATFORM_BOOKING_WINDOW_DAYS = 28
export const RESCHEDULE_NO_LONGER_AVAILABLE_TITLE = 'Reschedule no longer available'
export const RESCHEDULE_NO_LONGER_AVAILABLE_BODY = 'This reschedule can no longer be accepted because the proposed start time is less than 4 hours away. Your original booking remains unchanged.'
const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const APP_TIMEZONE = 'Europe/Nicosia'

export type CleanerProposalEligibility = {
  isPending: boolean
  hasProposal: boolean
  isCleanerProposal: boolean
  isClientCounter: boolean
  moreThanCutoffHoursAway: boolean
  canAcceptPending: boolean
  canRespondToCounter: boolean
  canProposeAlternative: boolean
  proposeAlternativeDisabledReason: string | null
}

export function getCleanerProposalEligibility(booking: BookingRead): CleanerProposalEligibility {
  const isPending = booking.status === 'pending'
  const hasProposal = Boolean(booking.proposed_start && booking.proposal_by)
  const isCleanerProposal = booking.proposal_by === 'cleaner'
  const isClientCounter = booking.proposal_by === 'client'
  const cleanerProposals = booking.cleaner_proposals ?? 0

  const scheduledStart = new Date(booking.scheduled_start)
  const scheduledStartMs = scheduledStart.getTime()
  const validScheduledStart = Number.isFinite(scheduledStartMs)
  const moreThanCutoffHoursAway =
    validScheduledStart && scheduledStartMs - Date.now() > RESCHEDULE_CUTOFF_HOURS * MS_PER_HOUR

  const canAcceptPending = isPending && !isClientCounter
  const canRespondToCounter = isPending && isClientCounter
  const canProposeAlternative = isPending && moreThanCutoffHoursAway && !hasProposal && cleanerProposals < 1

  const proposeAlternativeDisabledReason = !isPending
    ? null
    : hasProposal
      ? isCleanerProposal
        ? 'Alternative time already sent. Waiting for client response.'
        : 'Client already sent a counter-offer. You can accept or decline it.'
      : cleanerProposals >= 1
        ? 'You can only suggest one alternate time per booking.'
        : !validScheduledStart
          ? 'Unable to validate booking start time. Open details and try again.'
          : !moreThanCutoffHoursAway
            ? 'Alternate time can be suggested only when the booking is more than 24 hours away.'
            : null

  return {
    isPending,
    hasProposal,
    isCleanerProposal,
    isClientCounter,
    moreThanCutoffHoursAway,
    canAcceptPending,
    canRespondToCounter,
    canProposeAlternative,
    proposeAlternativeDisabledReason,
  }
}

function minToTime(m: number): string {
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number)
  const suffix = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
  return `${h12}:${mm.toString().padStart(2, '0')} ${suffix}`
}

export const THIRTY_MIN_TIME_OPTIONS: Array<{ value: string; label: string }> = Array.from(
  { length: (24 * 60) / 30 },
  (_, i) => {
    const value = minToTime(i * 30)
    return { value, label: formatTime12(value) }
  },
)

export function toIsoFromDateAndTimeLocal(dateValue: string, timeValue: string): string | null {
  if (!dateValue || !timeValue) return null
  const parsed = new Date(`${dateValue}T${timeValue}:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone })
  return new Date(tzStr).getTime() - new Date(utcStr).getTime()
}

export function toIsoFromDateAndTimeInCyprus(dateValue: string, timeValue: string): string | null {
  if (!dateValue || !timeValue) return null
  const asUTC = new Date(`${dateValue}T${timeValue}:00Z`)
  if (Number.isNaN(asUTC.getTime())) return null
  const offset = tzOffsetMs(asUTC, APP_TIMEZONE)
  return new Date(asUTC.getTime() - offset).toISOString()
}

export function toDateInputValue(dateLike: string | Date): string {
  const parsed = new Date(dateLike)
  if (Number.isNaN(parsed.getTime())) return ''
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toDateInputValueCyprus(dateLike: string | Date): string {
  const parsed = new Date(dateLike)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(parsed)
}

export function maxAlternativeProposalDateInputValue(originalStartLike: string | Date): string {
  const originalStart = new Date(originalStartLike)
  if (Number.isNaN(originalStart.getTime())) return ''

  const maxFromOriginal = new Date(originalStart.getTime() + ALTERNATIVE_PROPOSAL_WINDOW_DAYS * MS_PER_DAY)
  return toDateInputValueCyprus(maxFromOriginal)
}

export function maxPreConfirmationProposalDateInputValue(nowLike: string | Date = new Date()): string {
  const base = new Date(nowLike)
  if (Number.isNaN(base.getTime())) return ''
  const maxAllowed = new Date(base.getTime() + PLATFORM_BOOKING_WINDOW_DAYS * MS_PER_DAY)
  return toDateInputValueCyprus(maxAllowed)
}

export function isPostConfirmationRescheduleNoLongerAcceptable(
  booking: Pick<BookingRead, 'status' | 'proposal_context' | 'proposed_start'>,
  nowMs = Date.now(),
): boolean {
  if (!['accepted', 'confirmed'].includes(booking.status)) return false
  if (booking.proposal_context !== 'post_confirmation') return false
  if (!booking.proposed_start) return false

  const proposedStartMs = new Date(booking.proposed_start).getTime()
  if (!Number.isFinite(proposedStartMs)) return false
  return proposedStartMs - nowMs < POST_CONFIRMATION_REAUTH_ACCEPT_MIN_LEAD_HOURS * MS_PER_HOUR
}

function dateMs(value: string | Date | null | undefined) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function cyprusDateStr(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(date)
}

export function getPostConfirmationRescheduleEffectiveDeadlineMs(
  booking: Pick<BookingRead, 'proposal_context' | 'proposal_expires_at' | 'proposed_start'>,
) {
  const proposalExpiresMs = dateMs(booking.proposal_expires_at)
  if (booking.proposal_context !== 'post_confirmation') return proposalExpiresMs

  const proposedStartMs = dateMs(booking.proposed_start)
  if (proposedStartMs === null) return proposalExpiresMs

  const latestAcceptMs = proposedStartMs - POST_CONFIRMATION_REAUTH_ACCEPT_MIN_LEAD_HOURS * MS_PER_HOUR
  if (proposalExpiresMs === null) return latestAcceptMs
  return Math.min(proposalExpiresMs, latestAcceptMs)
}

function formatTime24InCyprus(value: Date) {
  return value.toLocaleTimeString('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatProposalResponseDeadlineInCyprus(deadlineMs: number, nowMs = Date.now()) {
  const deadline = new Date(deadlineMs)
  if (!Number.isFinite(deadline.getTime())) return null
  const time = formatTime24InCyprus(deadline)
  const deadlineDate = cyprusDateStr(deadline)
  const todayDate = cyprusDateStr(new Date(nowMs))
  if (deadlineDate === todayDate) return `Respond by ${time} today`
  const dayMonth = deadline.toLocaleDateString('en-GB', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
  })
  return `Respond by ${time} on ${dayMonth}`
}

export function toTimeInputValue(dateLike: string | Date): string {
  const parsed = new Date(dateLike)
  if (Number.isNaN(parsed.getTime())) return ''
  const mins = parsed.getMinutes()
  const roundedMins = mins < 15 ? 0 : mins < 45 ? 30 : 0
  const nextHour = mins >= 45
  const base = new Date(parsed)
  if (nextHour) {
    base.setHours(base.getHours() + 1, 0, 0, 0)
  } else {
    base.setMinutes(roundedMins, 0, 0)
  }
  const hh = String(base.getHours()).padStart(2, '0')
  const mm = String(base.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function toTimeInputValueCyprus(dateLike: string | Date): string {
  const parsed = new Date(dateLike)
  if (Number.isNaN(parsed.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsed)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  const roundedMins = minute < 15 ? 0 : minute < 45 ? 30 : 0
  const nextHour = minute >= 45
  const normalizedHour = nextHour ? (hour + 1) % 24 : hour
  return `${String(normalizedHour).padStart(2, '0')}:${String(roundedMins).padStart(2, '0')}`
}

export function toTimeValueInCyprus(dateLike: string | Date): string {
  const parsed = new Date(dateLike)
  if (Number.isNaN(parsed.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsed)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

export function toTimeLabelInCyprus(dateLike: string | Date): string {
  const parsed = new Date(dateLike)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('en-IE', {
    timeZone: APP_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
