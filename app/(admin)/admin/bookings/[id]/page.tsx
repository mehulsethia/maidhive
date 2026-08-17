'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  CreditCard,
  FileText,
  History,
  MapPin,
  ReceiptText,
  RefreshCw,
  Star,
  UserRound,
} from 'lucide-react'
import { adminApi } from '@/lib/api'
import { BookingInstructions } from '@/components/booking-instructions'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { PriceBreakdownCard } from '@/components/price-breakdown-card'
import { CancellationPaymentBreakdown } from '@/components/cancellation-payment-breakdown'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import {
  getCancellationPaymentOutcome,
  getClientCancellationPaymentOutcome,
  isNonPayableBookingState,
  isSuccessfulPaymentStatus,
} from '@/lib/booking-payment-outcome'
import {
  getAdminPaymentStateLabel,
  getPaymentReleaseDescription,
  isNormalCancellationPaymentRelease,
} from '@/lib/cancellation-payment-state'
import { getAdminClientCancellationCopy } from '@/lib/client-cancellation-context'
import { getCleanerPayoutSummary } from '@/lib/cleaner-payout'
import {
  getAdminTransferLifecycleLabel,
  getBookingFinancialOutcome,
  getCleanerTransferLifecycle,
  hasCleanerPayoutTransferred,
} from '@/lib/payment-financial-outcome'
import {
  getBookingCleaningTypeLabel,
  getBookingServiceClassificationLabel,
} from '@/lib/booking-service-labels'
import {
  getAdminCancellationRecordSummary,
  getCancellationLeadTimeLabel,
  getCancellationPolicyLabel,
  getCancellationPolicyBandLabel,
  getCancellationReasonLabel,
} from '@/lib/cancellation-record'
import { getCancellationOriginLabel } from '@/lib/cancellation-origin'
import {
  isPaymentReauthorisationCancelled,
  PAYMENT_REAUTHORISATION_DEADLINE_EXPIRED_ACTION_LOG,
} from '@/lib/booking-reauthorisation'
import { START_VERIFICATION_RADIUS_M } from '@/lib/super-cleaner'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'

type TimelineEvent = {
  id: string
  at: string
  title: string
  description: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

function isValidDate(value?: string | null) {
  return Boolean(value && Number.isFinite(new Date(value).getTime()))
}

function addEvent(events: TimelineEvent[], event: TimelineEvent | null) {
  if (!event || !isValidDate(event.at)) return
  events.push(event)
}

function actorLabel(actor?: string | null) {
  if (actor === 'client') return 'Client'
  if (actor === 'cleaner') return 'Cleaner'
  if (actor === 'system') return 'System'
  return 'Platform'
}

function proposalContextLabel(context?: string | null) {
  if (context === 'amend_start') return 'amend start time'
  if (context === 'post_confirmation') return 'post-confirmation reschedule'
  return 'pre-confirmation proposal'
}

function actionEventDate(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && isValidDate(value) ? value : null
}

function actionEventMoney(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = Number(metadata?.[key])
  return Number.isFinite(value) ? value : null
}

function actionEventString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : null
}

function formatActionLogDate(value: string | Date) {
  return formatDate(value).replace(/, (?=\d{2}:\d{2}$)/, ' at ')
}

function hasActionEvent(booking: BookingRead, ...types: string[]) {
  return (booking.action_events ?? []).some((event) => types.includes(event.type))
}

function getBookingCreatedScheduledStart(booking: BookingRead) {
  if (booking.original_scheduled_start && isValidDate(booking.original_scheduled_start)) {
    return booking.original_scheduled_start
  }
  const rescheduleAccepted = (booking.action_events ?? []).find((event) => event.type === 'post_confirmation_reschedule_accepted')
  return actionEventDate(rescheduleAccepted?.metadata, 'previous_scheduled_start') ?? booking.scheduled_start
}

function actionEventSource(
  event: NonNullable<BookingRead['action_events']>[number],
): 'client' | 'cleaner' | 'admin' | 'system' | null {
  const metadataSource = actionEventString(event.metadata, 'source')
  if (metadataSource === 'client' || metadataSource === 'cleaner' || metadataSource === 'admin' || metadataSource === 'system') {
    return metadataSource
  }
  return event.actor_role ?? null
}

function bookingStartedTimelineCopy(source: string | null | undefined) {
  if (source === 'system') {
    return {
      title: 'Cleaning started automatically',
      description: 'The booking moved to In Progress automatically at the scheduled start time.',
    }
  }
  if (source === 'cleaner') {
    return {
      title: 'Cleaning started by cleaner',
      description: 'The cleaner started the booking manually.',
    }
  }
  return {
    title: 'Cleaning started',
    description: 'The booking moved to In Progress. The start source was not recorded.',
  }
}

function formatMeters(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available'
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`
  return `${Math.round(value)} m`
}

function hasStartLocationCapture(verification: BookingRead['start_verification']) {
  return (
    typeof verification?.latitude === 'number' &&
    Number.isFinite(verification.latitude) &&
    typeof verification.longitude === 'number' &&
    Number.isFinite(verification.longitude)
  )
}

function formatStartVerificationReason(verification: BookingRead['start_verification']) {
  const reason = verification?.failure_reason
  const locationCaptured = hasStartLocationCapture(verification)
  if (reason === 'gps_permission_denied') return 'Location permission denied'
  if (reason === 'gps_unavailable') {
    return locationCaptured ? 'Unable to verify captured cleaner location' : 'Cleaner location unavailable'
  }
  if (reason === 'booking_coordinates_unavailable') return 'Booking address coordinates unavailable'
  if (reason === 'gps_accuracy_insufficient') return 'GPS accuracy insufficient'
  if (reason === 'outside_required_radius') return 'Outside required arrival radius'
  return reason ? reason.replace(/_/g, ' ') : null
}

function formatStartArrivalVerification(booking: BookingRead) {
  const verification = booking.start_verification
  if (!booking.started_at) return null
  if (!verification && booking.start_initiated_by === 'cleaner') return 'Not recorded'
  if (!verification) return null
  if (verification.verified) return 'Verified'
  if (verification.failure_reason === 'outside_required_radius') return 'Outside permitted area'
  return 'Unable to verify'
}

function formatCleanerLocationCaptured(verification: BookingRead['start_verification']) {
  if (!verification) return null
  return hasStartLocationCapture(verification) ? 'Yes' : 'No — cleaner location unavailable'
}

function formatStartCoordinates(verification: BookingRead['start_verification']) {
  const latitude = verification?.latitude
  const longitude = verification?.longitude
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return 'Not available'
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

function getStartVerificationSummary(booking: BookingRead) {
  const verification = booking.start_verification
  if (!booking.started_at || !verification) return null
  const startedAt = formatDate(booking.started_at)
  if (verification.verified) {
    return `Arrival verified. Cleaner started the booking ${formatMeters(verification.distance_m)} from the booking address at ${startedAt}.`
  }
  const reason = formatStartVerificationReason(verification) ?? 'Location verification was not successful'
  const distance = typeof verification.distance_m === 'number'
    ? ` Distance from booking address: ${formatMeters(verification.distance_m)}.`
    : ''
  return `Arrival not verified. ${reason}.${distance} Booking was allowed to start without verified location.`
}

function bookingCompletedTimelineCopy(source: string | null | undefined) {
  if (source === 'system') {
    return {
      title: 'Cleaning completed automatically',
      description: 'The booking was automatically completed after the scheduled end time.',
    }
  }
  if (source === 'cleaner') {
    return {
      title: 'Cleaning completed by cleaner',
      description: 'The cleaner marked the booking as complete.',
    }
  }
  return {
    title: 'Cleaning completed',
    description: 'The booking was completed. The completion source was not recorded.',
  }
}

function describeCleanerPayoutState(booking: BookingRead, finalCleanerPayout: number) {
  const paymentStatus = String(booking.payment?.status ?? '')
  const transferLifecycle = getCleanerTransferLifecycle(booking.payment)
  if (booking.dispute?.status === 'open' || booking.dispute?.status === 'under_review') {
    return 'Paused pending dispute resolution'
  }
  if (transferLifecycle === 'reversed') return 'Not due — transfer reversed'
  if (transferLifecycle === 'partially_reversed') return `Adjusted — ${formatCurrency(finalCleanerPayout)}`
  if (transferLifecycle === 'transferred') return `Released — ${formatCurrency(finalCleanerPayout)}`
  if (paymentStatus === 'refunded' || finalCleanerPayout <= 0) return 'Not due'
  if (booking.payment?.payout_scheduled_at) return `Scheduled — ${formatCurrency(finalCleanerPayout)}`
  if (paymentStatus === 'captured' || paymentStatus === 'authorized') return `Awaiting release — ${formatCurrency(finalCleanerPayout)}`
  return 'Not scheduled'
}

function describeTransferState(booking: BookingRead) {
  return getAdminTransferLifecycleLabel(booking)
}

function buildTimeline(booking: BookingRead): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const payment = booking.payment
  const cancellationOutcome = getCancellationPaymentOutcome(booking)
  const payoutSummary = getCleanerPayoutSummary(booking)
  const paymentReleaseDescription = getPaymentReleaseDescription(booking)
  const clientCancellationCopy = getAdminClientCancellationCopy(booking)

  addEvent(events, {
    id: 'created',
    at: booking.created_at,
    title: 'Booking created',
    description: `${getBookingCleaningTypeLabel(booking)} requested for ${formatActionLogDate(getBookingCreatedScheduledStart(booking))}.`,
  })

  addEvent(events, payment?.created_at ? {
    id: 'payment-created',
    at: payment.created_at,
    title: 'Payment record created',
    description: `Payment record opened for ${formatCurrency(payment.amount ?? booking.total_amount)}.`,
  } : null)

  addEvent(events, payment?.authorized_at && !hasActionEvent(booking, 'payment_authorized') ? {
    id: 'payment-authorized',
    at: payment.authorized_at,
    title: 'Payment authorised',
    description: `Card authorisation recorded for ${formatCurrency(payment.amount ?? booking.total_amount)}.`,
    tone: 'success',
  } : null)

  addEvent(events, booking.accepted_at ? {
    id: 'accepted',
    at: booking.accepted_at,
    title: 'Cleaner accepted',
    description: 'The cleaner accepted the booking request.',
    tone: 'success',
  } : null)

  addEvent(events, booking.confirmed_at ? {
    id: 'confirmed',
    at: booking.confirmed_at,
    title: 'Booking confirmed',
    description: 'The booking moved into a confirmed operational state.',
    tone: 'success',
  } : null)

  const hasRecordedAmendmentProposal = booking.action_events?.some((event) => event.type === 'amend_start_proposed')
  addEvent(events, booking.proposed_start && (booking.updated_at || booking.proposal_expires_at) && !hasRecordedAmendmentProposal ? {
    id: 'proposal',
    at: booking.updated_at ?? booking.proposal_expires_at!,
    title: `${actorLabel(booking.proposal_by)} proposed a time change`,
    description: `${proposalContextLabel(booking.proposal_context)} from ${formatDate(booking.scheduled_start)} to ${formatDate(booking.proposed_start)}${booking.proposal_expires_at ? `, expires ${formatDate(booking.proposal_expires_at)}` : ''}.`,
    tone: 'warning',
  } : null)

  for (const event of booking.action_events ?? []) {
    const metadata = event.metadata
    const originalStart = actionEventDate(metadata, 'original_start')
    const proposedStart = actionEventDate(metadata, 'proposed_start')
    const proposedBy = metadata?.proposed_by === 'client' ? 'Client' : 'Cleaner'

    if (event.type === 'booking_started') {
      const copy = bookingStartedTimelineCopy(actionEventSource(event))
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: copy.title,
        description: copy.description,
        tone: 'success',
      })
    }

    if (event.type === 'booking_completed') {
      const copy = bookingCompletedTimelineCopy(actionEventSource(event))
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: copy.title,
        description: copy.description,
        tone: 'success',
      })
    }

    if (event.type === 'payment_authorized') {
      const amount = actionEventMoney(metadata, 'amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Payment authorised',
        description: amount == null
          ? 'Card authorisation was recorded.'
          : `Card authorisation recorded for ${formatCurrency(amount)}.`,
        tone: 'success',
      })
    }

    if (event.type === 'payment_reauthorisation_required') {
      const deadline = actionEventDate(metadata, 'deadline')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Card re-authorisation required',
        description: deadline
          ? `Client must re-authorise the card by ${formatDate(deadline)}.`
          : 'Client must re-authorise the card to keep this booking active.',
        tone: 'warning',
      })
    }

    if (event.type === 'post_confirmation_reschedule_accepted') {
      const previousStart = actionEventDate(metadata, 'previous_scheduled_start')
      const newStart = actionEventDate(metadata, 'new_scheduled_start')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Reschedule accepted',
        description: previousStart && newStart
          ? `Booking rescheduled from ${formatActionLogDate(previousStart)} to ${formatActionLogDate(newStart)}.`
          : 'Post-confirmation reschedule accepted.',
        tone: 'success',
      })
    }

    if (event.type === 'payment_reauthorisation_completed') {
      const amount = actionEventMoney(metadata, 'amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Payment re-authorisation completed',
        description: amount == null
          ? 'New card authorisation recorded. The booking remains confirmed.'
          : `New card authorisation recorded for ${formatCurrency(amount)}. The booking remains confirmed.`,
        tone: 'success',
      })
    }

    if (event.type === 'payment_reauthorisation_expired') {
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Booking cancelled',
        description: PAYMENT_REAUTHORISATION_DEADLINE_EXPIRED_ACTION_LOG,
        tone: 'danger',
      })
    }

    if (event.type === 'payment_captured') {
      const amount = actionEventMoney(metadata, 'amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Payment captured',
        description: amount == null
          ? 'Payment was captured for this booking.'
          : `Captured ${formatCurrency(amount)} for this booking.`,
        tone: 'success',
      })
    }

    if (event.type === 'payment_authorisation_released') {
      const amount = actionEventMoney(metadata, 'amount')
      const reason = actionEventString(metadata, 'reason')
      const previousState = actionEventString(metadata, 'payment_state_before')
      const resultingState = actionEventString(metadata, 'payment_state_after')
      const actorReason = reason?.includes('cleaner_cancelled')
        ? 'the cleaner cancelled the booking before capture'
        : reason?.includes('client_cancelled')
          ? 'the client cancelled the booking before capture'
          : reason?.includes('reauthorisation')
            ? 'the booking requires client payment re-authorisation after reschedule'
          : 'the booking was cancelled before capture'
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: amount == null
          ? 'Payment authorisation released'
          : `Payment authorisation released — ${formatCurrency(amount)}`,
        description: [
          `The client was not charged because ${actorReason}.`,
          previousState || resultingState
            ? `Payment state: ${previousState ?? 'not recorded'} → ${resultingState ?? 'released'}.`
            : null,
          reason ? `Reason: ${reason.replace(/_/g, ' ')}.` : null,
        ].filter(Boolean).join(' '),
        tone: 'success',
      })
    }

    if (event.type === 'payout_scheduled') {
      const amount = actionEventMoney(metadata, 'amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Payout scheduled',
        description: amount == null
          ? 'Cleaner payout was scheduled.'
          : `Cleaner payout scheduled for ${formatCurrency(amount)}.`,
      })
    }

    if (event.type === 'cleaner_payout_paused') {
      const amount = actionEventMoney(metadata, 'amount')
      const transferStatus = actionEventString(metadata, 'transfer_status_label')
        ?? (metadata?.transfer_status === 'transferred' ? 'Transferred — subject to reversal if required' : null)
        ?? (metadata?.transfer_status === 'reversed' ? 'Reversed' : null)
        ?? (metadata?.transfer_status === 'partially_reversed' ? 'Partially reversed' : null)
        ?? (metadata?.transfer_status === 'not_transferred' ? 'Not transferred' : 'Not recorded')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Cleaner payout paused due to dispute',
        description: amount == null
          ? `Transfer status: ${transferStatus}.`
          : `Original payout: ${formatCurrency(amount)}. Transfer status: ${transferStatus}.`,
        tone: 'warning',
      })
    }

    if (event.type === 'cleaner_payout_adjusted') {
      const fromAmount = actionEventMoney(metadata, 'from_amount')
      const toAmount = actionEventMoney(metadata, 'to_amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Cleaner payout adjusted',
        description: fromAmount == null || toAmount == null
          ? 'Cleaner payout was adjusted during dispute resolution.'
          : `Cleaner payout adjusted from ${formatCurrency(fromAmount)} to ${formatCurrency(toAmount)}.`,
        tone: 'warning',
      })
    }

    if (event.type === 'stripe_transfer_reversed') {
      const amount = actionEventMoney(metadata, 'amount')
      const applicationFeeAmount = actionEventMoney(metadata, 'application_fee_amount')
      const status = metadata?.status === 'failed' ? 'failed' : 'succeeded'
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: status === 'failed' ? 'Stripe Connect transfer reversal failed' : 'Stripe Connect transfer reversed',
        description: amount == null
          ? `Transfer reversal ${status}.`
          : [
              `Stripe Connect transfer reversed (${formatCurrency(amount)}) ${status}.`,
              applicationFeeAmount != null ? `MaidHive application fee: ${formatCurrency(applicationFeeAmount)}.` : null,
            ].filter(Boolean).join(' '),
        tone: status === 'failed' ? 'danger' : 'warning',
      })
    }

    if (event.type === 'payment_refunded' || event.type === 'payment_partially_refunded') {
      const amount = actionEventMoney(metadata, 'amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: event.type === 'payment_refunded' ? 'Full refund completed' : 'Refund completed',
        description: amount == null
          ? 'Refund completed for this booking.'
          : `${event.type === 'payment_refunded' ? 'Full refund' : 'Refund'} of ${formatCurrency(amount)} completed.`,
        tone: 'warning',
      })
    }

    if (event.type === 'payout_transferred') {
      const amount = actionEventMoney(metadata, 'amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Payout transferred',
        description: amount == null
          ? 'Cleaner payout was transferred.'
          : `Transferred ${formatCurrency(amount)} to the cleaner.`,
        tone: 'success',
      })
    }

    if (event.type === 'amend_start_proposed') {
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: `${proposedBy} proposed Amend Start Time`,
        description: originalStart && proposedStart
          ? `Original: ${formatDate(originalStart)}. Proposed: ${formatDate(proposedStart)}.`
          : 'An amended start time was proposed.',
        tone: 'warning',
      })
    }

    if (event.type === 'amend_start_declined') {
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: `${actorLabel(event.actor_role)} declined Amend Start Time`,
        description: 'Original booking time remained unchanged.',
        tone: 'warning',
      })
    }

    if (event.type === 'amend_start_accepted') {
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: `${actorLabel(event.actor_role)} accepted Amend Start Time`,
        description: proposedStart
          ? `Booking start time updated to ${formatDate(proposedStart)}.`
          : 'The amended start time was accepted.',
        tone: 'success',
      })
    }
  }

  addEvent(events, booking.started_at && !hasActionEvent(booking, 'booking_started') ? {
    id: 'started',
    at: booking.started_at,
    title: bookingStartedTimelineCopy(booking.start_initiated_by).title,
    description: bookingStartedTimelineCopy(booking.start_initiated_by).description,
    tone: 'success',
  } : null)

  addEvent(events, booking.completed_at && !hasActionEvent(booking, 'booking_completed') ? {
    id: 'completed',
    at: booking.completed_at,
    title: bookingCompletedTimelineCopy(null).title,
    description: bookingCompletedTimelineCopy(null).description,
    tone: 'success',
  } : null)

  addEvent(events, payment?.captured_at && !hasActionEvent(booking, 'payment_captured') ? {
    id: 'payment-captured',
    at: payment.captured_at,
    title: 'Payment captured',
    description: `Captured ${formatCurrency(cancellationOutcome?.capturedAmount ?? payment.amount ?? booking.total_amount)} for this booking.`,
    tone: 'success',
  } : null)

  addEvent(events, payment?.payout_scheduled_at && !hasActionEvent(booking, 'payout_scheduled') && (!cancellationOutcome || cancellationOutcome.cleanerPayoutDue > 0) ? {
    id: 'payout-scheduled',
    at: payment.payout_scheduled_at,
    title: 'Payout scheduled',
    description: `Cleaner payout scheduled for ${formatCurrency(cancellationOutcome?.cleanerPayoutDue ?? payoutSummary.originalCleanerPayout)}.`,
  } : null)

  addEvent(events, payment?.transferred_at && !hasActionEvent(booking, 'payout_transferred') && (!cancellationOutcome || cancellationOutcome.cleanerPayoutDue > 0) ? {
    id: 'payment-transferred',
    at: payment.transferred_at,
    title: 'Cleaner payout transferred',
    description: `Transferred ${formatCurrency(cancellationOutcome?.cleanerPayoutDue ?? payment.cleaner_payout ?? payoutSummary.finalCleanerPayout)} to the cleaner.`,
    tone: 'success',
  } : null)

  addEvent(events, payment?.failed_at && !paymentReleaseDescription ? {
    id: 'payment-failed',
    at: payment.failed_at,
    title: 'Payment failed',
    description: 'The payment attempt failed and requires review.',
    tone: 'danger',
  } : null)

  addEvent(events, paymentReleaseDescription && booking.cancelled_at && !hasActionEvent(booking, 'payment_authorisation_released') ? {
    id: 'payment-released',
    at: booking.cancelled_at,
    title: 'Payment released',
    description: paymentReleaseDescription,
    tone: 'success',
  } : null)

  addEvent(events, payment?.refunded_at && !hasActionEvent(booking, 'payment_refunded', 'payment_partially_refunded') ? {
    id: 'payment-refunded',
    at: payment.refunded_at,
    title: payment.status === 'refunded' ? 'Full refund completed' : 'Refund completed',
    description: `${payment.status === 'refunded' ? 'Full refund' : 'Refund'} of ${formatCurrency(payment.refund_amount ?? 0)} completed${payment.refund_reason ? `: ${payment.refund_reason}` : ''}.`,
    tone: 'warning',
  } : null)

  addEvent(events, booking.cancelled_at && !hasActionEvent(booking, 'payment_reauthorisation_expired') ? {
    id: 'cancelled',
    at: booking.cancelled_at,
    title: getCancellationOriginLabel(booking) ?? 'Booking cancelled',
    description: clientCancellationCopy?.actionLogDescription
      || (isPaymentReauthorisationCancelled(booking) ? PAYMENT_REAUTHORISATION_DEADLINE_EXPIRED_ACTION_LOG : null)
      || getAdminCancellationRecordSummary(booking)
      || booking.cancellation_reason
      || 'No cancellation reason was recorded.',
    tone: 'danger',
  } : null)

  addEvent(events, booking.review?.created_at ? {
    id: 'review',
    at: booking.review.created_at,
    title: 'Review submitted',
    description: `${booking.review.rating}/5 rating${booking.review.comment ? `: ${booking.review.comment}` : ''}.`,
  } : null)

  addEvent(events, booking.dispute?.created_at ? {
    id: 'dispute-submitted',
    at: booking.dispute.created_at,
    title: `Dispute submitted by ${booking.dispute.reporter_role ?? 'participant'}`,
    description: booking.dispute.reason,
    tone: 'danger',
  } : null)

  addEvent(events, booking.dispute?.responded_at ? {
    id: 'dispute-response',
    at: booking.dispute.responded_at,
    title: `${actorLabel(booking.dispute.responder_role)} response submitted`,
    description: booking.dispute.response_explanation || 'A response was added to the dispute case.',
    tone: 'warning',
  } : null)

  addEvent(events, booking.dispute?.resolved_at ? {
    id: 'dispute-resolved',
    at: booking.dispute.resolved_at,
    title: 'Dispute resolved',
    description: booking.dispute.resolution_note || 'The dispute was resolved by an administrator.',
    tone: 'success',
  } : null)

  addEvent(events, booking.updated_at && !booking.dispute ? {
    id: 'updated',
    at: booking.updated_at,
    title: 'Booking last updated',
    description: `Current booking status is ${booking.status.replace(/_/g, ' ')}.`,
  } : null)

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value === null || value === undefined || value === '' ? 'Not recorded' : value

  return (
    <div className="min-w-0 flex flex-col gap-0.5 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="break-words text-sm font-medium text-slate-900">{displayValue}</span>
    </div>
  )
}

function TimelineIcon({ tone }: { tone?: TimelineEvent['tone'] }) {
  if (tone === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (tone === 'warning') return <RefreshCw className="h-4 w-4 text-amber-600" />
  if (tone === 'danger') return <CircleDot className="h-4 w-4 text-rose-600" />
  return <CircleDot className="h-4 w-4 text-slate-400" />
}

export default function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [loading, setLoading] = useState(true)
  const rawReturnTo = searchParams.get('returnTo')
  const returnHref = rawReturnTo?.startsWith('/admin/disputes') || rawReturnTo?.startsWith('/admin/bookings')
    ? rawReturnTo
    : '/admin/bookings'
  const returnLabel = returnHref.startsWith('/admin/disputes') ? 'Back to disputes' : 'Back to bookings'

  useEffect(() => {
    setLoading(true)
    adminApi
      .getBooking(id)
      .then((response) => {
        setBooking(response.data ?? null)
        resetLoadError('admin-booking-detail')
      })
      .catch(() => reportLoadError('admin-booking-detail', 'Failed to load booking.'))
      .finally(() => setLoading(false))
  }, [id])

  const timeline = useMemo(() => (booking ? buildTimeline(booking) : []), [booking])

  if (loading) return <DetailPageSkeleton />
  if (!booking) return <div className="py-16 text-center text-muted-foreground">Booking not found.</div>

  const clientName = booking.client?.user?.name?.trim() || 'Client'
  const cleanerName = booking.cleaner?.user?.name?.trim() || 'Cleaner'
  const subtotal = booking.subtotal ?? booking.total_amount - booking.platform_fee
  const cleaningTypeLabel = getBookingCleaningTypeLabel(booking)
  const serviceClassificationLabel = getBookingServiceClassificationLabel(booking)
  const startArrivalVerification = formatStartArrivalVerification(booking)
  const cleanerLocationCaptured = formatCleanerLocationCaptured(booking.start_verification)
  const startVerificationReason = formatStartVerificationReason(booking.start_verification)
  const startVerificationSummary = getStartVerificationSummary(booking)
  const shouldShowStartVerification = Boolean(startArrivalVerification)
  const cancellationLeadTimeLabel = getCancellationLeadTimeLabel(booking)
  const cancellationPolicyBandLabel = getCancellationPolicyBandLabel(booking)
  const cancellationReasonLabel = getCancellationReasonLabel(booking)
  const cancellationPolicyLabel = getCancellationPolicyLabel(booking)
  const adminCancellationRecordSummary = getAdminCancellationRecordSummary(booking)
  const paymentStateLabel = getAdminPaymentStateLabel(booking)
  const cancellationOutcome = (
    isSuccessfulPaymentStatus(booking.payment?.status) ||
    isNormalCancellationPaymentRelease(booking)
  )
    ? getCancellationPaymentOutcome(booking)
    : null
  const clientCancellationPaymentOutcome = getClientCancellationPaymentOutcome(booking)
  const useProjectedPaymentLabels = isNonPayableBookingState(booking)
  const payoutSummary = getCleanerPayoutSummary(booking)
  const financialOutcome = getBookingFinancialOutcome(booking)
  const disputeFinalized = booking.dispute?.status === 'resolved' || booking.dispute?.status === 'closed'
  const showMutableFinancialLabels =
    !cancellationOutcome &&
    ['accepted', 'confirmed', 'in_progress'].includes(booking.status) &&
    !financialOutcome.cleanerPayoutTransferred &&
    !disputeFinalized
  const cleanerPayoutState = describeCleanerPayoutState(booking, financialOutcome.finalCleanerPayout)
  const transferState = describeTransferState(booking)
  const reauthorisationCompletedEvent = booking.action_events?.find((event) => event.type === 'payment_reauthorisation_completed')
  const hasReauthorisationHistory = Boolean(
    booking.reauthorization_required ||
    booking.action_events?.some((event) => (
      event.type === 'payment_reauthorisation_required' ||
      event.type === 'payment_reauthorisation_completed'
    )),
  )
  const isReleasedReauthorisationPending =
    booking.status === 'accepted' &&
    Boolean(booking.reauthorization_required) &&
    booking.payment?.status === 'released'

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-fit"
          onClick={() => router.push(returnHref)}
        >
          <ArrowLeft className="h-4 w-4" />
          {returnLabel}
        </Button>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="max-w-full font-mono">#{booking.id.slice(0, 8)}</Badge>
          <BookingStatusBadge
            status={booking.status}
            paymentStatus={booking.payment?.status}
            transferredAt={booking.payment?.transferred_at}
            scheduledEnd={booking.scheduled_end}
            proposalBy={booking.proposal_by}
            audience="admin"
          />
        </div>
      </div>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ReceiptText className="h-5 w-5 text-slate-500" />
                Booking details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <DetailRow label="Cleaning type" value={cleaningTypeLabel} />
                {serviceClassificationLabel !== cleaningTypeLabel && (
                  <DetailRow label="Internal service classification" value={serviceClassificationLabel} />
                )}
                <DetailRow label="Duration" value={`${booking.duration_hours} hours`} />
                <DetailRow label="Scheduled start" value={formatDate(booking.scheduled_start)} />
                <DetailRow label="Scheduled end" value={formatDate(booking.scheduled_end)} />
              </div>

              <Separator />

              <div className="min-w-0 space-y-2 text-sm text-slate-600">
                <p className="flex min-w-0 items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{formatDate(booking.scheduled_start)}</span>
                </p>
                <p className="flex min-w-0 items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{booking.duration_hours} hours at {formatCurrency(booking.hourly_rate)}/hr</span>
                </p>
                <p className="flex min-w-0 items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{booking.address}, {booking.city}, {booking.postcode}</span>
                </p>
              </div>

              {(booking.apartment_details || booking.access_notes) && (
                <>
                  <Separator />
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <DetailRow label="Apartment details" value={booking.apartment_details} />
                    <DetailRow label="Access notes" value={booking.access_notes} />
                  </div>
                </>
              )}

              {booking.special_instructions && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Job instructions</p>
                    <BookingInstructions value={booking.special_instructions} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <PriceBreakdownCard
            breakdown={{
              hourly_rate: booking.hourly_rate,
              duration_hours: booking.duration_hours,
              subtotal,
              platform_fee_pct: booking.platform_fee_pct ?? 10,
              platform_fee: booking.platform_fee,
              cleaner_payout: booking.cleaner_payout,
              total_amount: booking.total_amount,
            }}
          />
          {cancellationOutcome && (
            <CancellationPaymentBreakdown booking={booking} showAdminRows />
          )}

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="h-5 w-5 text-slate-500" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <DetailRow label="Client" value={clientName} />
                <DetailRow label="Client ID" value={booking.client_id} />
                <DetailRow label="Cleaner" value={cleanerName} />
                <DetailRow label="Cleaner ID" value={booking.cleaner_id} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-slate-500" />
                Payment state
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1" data-testid="admin-payment-state">
                <DetailRow label="Stripe payment status" value={paymentStateLabel} />
                <DetailRow label="Cleaner payout" value={cleanerPayoutState} />
                <DetailRow label="Transfer status" value={transferState} />
                <DetailRow label="Original booking amount" value={formatCurrency(booking.total_amount)} />
                {cancellationOutcome ? (
                  <>
                    <DetailRow label="Amount captured" value={formatCurrency(cancellationOutcome.capturedAmount)} />
                    {clientCancellationPaymentOutcome.amountLabel && clientCancellationPaymentOutcome.amount !== null && (
                      <DetailRow
                        label={clientCancellationPaymentOutcome.amountLabel}
                        value={formatCurrency(clientCancellationPaymentOutcome.amount)}
                      />
                    )}
                    <DetailRow label="Cancellation charge" value={formatCurrency(cancellationOutcome.cancellationFee)} />
                    <DetailRow label="Final cleaner payout" value={formatCurrency(cancellationOutcome.cleanerPayoutDue)} />
                    <DetailRow label="Final platform amount retained" value={`${formatCurrency(cancellationOutcome.platformRetainedAmount)} before Stripe fees`} />
                  </>
                ) : (
                  <>
                    {showMutableFinancialLabels ? (
                      <>
                        <DetailRow label="Expected cleaner payout" value={formatCurrency(financialOutcome.originalCleanerPayout)} />
                        <DetailRow label="Expected MaidHive fee" value={formatCurrency(financialOutcome.originalPlatformFee)} />
                        <DetailRow
                          label={isReleasedReauthorisationPending ? 'Previous authorised amount' : 'Authorised client amount'}
                          value={isReleasedReauthorisationPending
                            ? `${formatCurrency(financialOutcome.originalClientPayment)} — released`
                            : formatCurrency(financialOutcome.originalClientPayment)}
                        />
                      </>
                    ) : (
                      <>
                        <DetailRow
                          label={useProjectedPaymentLabels ? 'Projected cleaner payout' : 'Original cleaner payout'}
                          value={formatCurrency(financialOutcome.originalCleanerPayout)}
                        />
                        <DetailRow
                          label={useProjectedPaymentLabels ? 'Projected platform fee' : 'Original platform fee'}
                          value={formatCurrency(financialOutcome.originalPlatformFee)}
                        />
                        <DetailRow label="Refund amount" value={formatCurrency(financialOutcome.refundToClient)} />
                        {payoutSummary.hasDisputeAdjustment && (
                          <DetailRow label="Dispute adjustment" value={formatCurrency(payoutSummary.disputeAdjustment)} />
                        )}
                        <DetailRow label="Final cleaner payout" value={formatCurrency(financialOutcome.finalCleanerPayout)} />
                        <DetailRow label="Final MaidHive retained fee" value={formatCurrency(financialOutcome.finalMaidHiveRetainedFee)} />
                        <DetailRow label="Final client amount paid" value={formatCurrency(financialOutcome.finalClientAmountPaid)} />
                      </>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-slate-500" />
                Booking state
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1" data-testid="admin-booking-state">
                <DetailRow label="Created" value={formatDate(booking.created_at)} />
                <DetailRow label="Booking status" value={booking.status === 'completed' ? 'Completed' : booking.status.replace(/_/g, ' ')} />
                <DetailRow label="Financial status" value={financialOutcome.financialStatus} />
                <DetailRow
                  label={showMutableFinancialLabels ? 'Expected cleaner payout' : 'Final cleaner payout'}
                  value={formatCurrency(showMutableFinancialLabels ? financialOutcome.originalCleanerPayout : financialOutcome.finalCleanerPayout)}
                />
                <DetailRow label="Accept by" value={booking.accept_by ? formatDate(booking.accept_by) : null} />
                <DetailRow label="Pay by" value={booking.pay_by ? formatDate(booking.pay_by) : null} />
                <DetailRow label="Accepted" value={booking.accepted_at ? formatDate(booking.accepted_at) : null} />
                <DetailRow label={hasReauthorisationHistory ? 'Originally confirmed' : 'Confirmed'} value={booking.confirmed_at ? formatDate(booking.confirmed_at) : null} />
                {reauthorisationCompletedEvent && (
                  <DetailRow label="Payment re-authorisation completed" value={formatDate(reauthorisationCompletedEvent.created_at)} />
                )}
                <DetailRow label="Started" value={booking.started_at ? formatDate(booking.started_at) : null} />
                {shouldShowStartVerification && (
                  <>
                    <DetailRow label="Cleaner location captured" value={cleanerLocationCaptured} />
                    <DetailRow label="Arrival verification" value={startArrivalVerification} />
                    {booking.start_verification && (
                      <>
                        <DetailRow label="Start GPS distance" value={formatMeters(booking.start_verification.distance_m)} />
                        <DetailRow label="GPS accuracy" value={formatMeters(booking.start_verification.accuracy_m)} />
                        <DetailRow label="Permitted verification radius" value={formatMeters(START_VERIFICATION_RADIUS_M)} />
                        <DetailRow label="Start GPS coordinates" value={formatStartCoordinates(booking.start_verification)} />
                        {startVerificationReason && (
                          <DetailRow label="Reason" value={startVerificationReason} />
                        )}
                      </>
                    )}
                    {startVerificationSummary && (
                      <p className="break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {startVerificationSummary}
                      </p>
                    )}
                  </>
                )}
                <DetailRow label="Completed" value={booking.completed_at ? formatDate(booking.completed_at) : null} />
                {booking.dispute?.created_at && (
                  <DetailRow label="Under Review" value={formatDate(booking.dispute.created_at)} />
                )}
                {booking.dispute?.resolved_at && (
                  <DetailRow label="Dispute Resolved" value={formatDate(booking.dispute.resolved_at)} />
                )}
                {booking.status === 'completed' && booking.payment?.transferred_at && (
                  <DetailRow label="Completed – Released" value={formatDate(booking.payment.transferred_at)} />
                )}
                <DetailRow label="Cancelled" value={booking.cancelled_at ? formatDate(booking.cancelled_at) : null} />
                <DetailRow label="Cancellation lead time" value={cancellationLeadTimeLabel} />
                <DetailRow label="Cancellation reason" value={cancellationReasonLabel} />
                <DetailRow
                  label={isPaymentReauthorisationCancelled(booking) ? 'Cancellation policy' : 'Cancellation policy band'}
                  value={isPaymentReauthorisationCancelled(booking) ? cancellationPolicyLabel : cancellationPolicyBandLabel}
                />
              </div>
              {(getAdminClientCancellationCopy(booking)?.stateLabel || adminCancellationRecordSummary || booking.cancellation_reason) && (
                <p className="break-words rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {getAdminClientCancellationCopy(booking)?.stateLabel || adminCancellationRecordSummary || booking.cancellation_reason}
                </p>
              )}
            </CardContent>
          </Card>

          {booking.review && (
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="h-5 w-5 text-slate-500" />
                  Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">{booking.review.rating}/5 rating</p>
                {booking.review.comment && (
                  <p className="break-words rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{booking.review.comment}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-slate-500" />
            Booking action log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No booking activity has been recorded yet.</p>
          ) : (
            <ol className="min-w-0 space-y-3" data-testid="admin-booking-action-log">
              {timeline.map((event) => (
                <li key={event.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3 sm:flex-row sm:gap-3">
                  <div className="mt-0.5">
                    <TimelineIcon tone={event.tone} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{event.title}</p>
                      <time dateTime={event.at} className="shrink-0 text-xs text-slate-500 sm:text-right">{formatDate(event.at)}</time>
                    </div>
                    <p className="mt-1 break-words text-sm text-slate-600">{event.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
