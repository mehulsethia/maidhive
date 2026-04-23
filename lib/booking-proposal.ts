import type { BookingRead } from '@/types'

export const RESCHEDULE_CUTOFF_HOURS = 24
const MS_PER_HOUR = 60 * 60 * 1000

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

export function toIsoFromDateTimeLocal(value: string): string | null {
  if (!value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}
