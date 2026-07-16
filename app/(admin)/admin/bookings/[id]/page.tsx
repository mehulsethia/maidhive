'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import { getCancellationPaymentOutcome, isNonPayableBookingState, isSuccessfulPaymentStatus } from '@/lib/booking-payment-outcome'
import {
  getAdminPaymentStateLabel,
  getPaymentReleaseDescription,
  isNormalCancellationPaymentRelease,
} from '@/lib/cancellation-payment-state'
import { getAdminClientCancellationCopy } from '@/lib/client-cancellation-context'
import { getCleanerPayoutSummary } from '@/lib/cleaner-payout'
import {
  getBookingFinancialOutcome,
  getCleanerTransferLifecycle,
  getCleanerTransferLifecycleLabel,
  hasCleanerPayoutTransferred,
} from '@/lib/payment-financial-outcome'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

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

function hasActionEvent(booking: BookingRead, ...types: string[]) {
  return (booking.action_events ?? []).some((event) => types.includes(event.type))
}

function describeCleanerPayoutState(booking: BookingRead, finalCleanerPayout: number) {
  const paymentStatus = String(booking.payment?.status ?? '')
  const transferLifecycle = getCleanerTransferLifecycle(booking.payment)
  if (transferLifecycle === 'reversed') return 'Not due — transfer reversed'
  if (transferLifecycle === 'partially_reversed') return 'Adjusted — transfer partially reversed'
  if (transferLifecycle === 'transferred') return 'Released — transferred to cleaner'
  if (booking.dispute?.status === 'open' || booking.dispute?.status === 'under_review') {
    return 'Paused — dispute under review'
  }
  if (paymentStatus === 'refunded' || finalCleanerPayout <= 0) return 'Not due'
  if (booking.payment?.payout_scheduled_at) return 'Scheduled'
  if (paymentStatus === 'captured' || paymentStatus === 'authorized') return 'Awaiting release'
  return 'Not scheduled'
}

function describeTransferState(booking: BookingRead) {
  return getCleanerTransferLifecycleLabel(booking.payment)
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
    description: `${SERVICE_LABELS[booking.service_type] ?? booking.service_type} requested for ${formatDate(booking.scheduled_start)}.`,
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
    description: `Card authorization recorded for ${formatCurrency(payment.amount ?? booking.total_amount)}.`,
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

    if (event.type === 'payment_authorized') {
      const amount = actionEventMoney(metadata, 'amount')
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: 'Payment authorised',
        description: amount == null
          ? 'Card authorization was recorded.'
          : `Card authorization recorded for ${formatCurrency(amount)}.`,
        tone: 'success',
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
      const transferStatus = metadata?.transfer_status === 'not_transferred' ? 'Not transferred' : 'Not recorded'
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
      const status = metadata?.status === 'failed' ? 'failed' : 'succeeded'
      addEvent(events, {
        id: event.id,
        at: event.created_at,
        title: status === 'failed' ? 'Stripe Connect transfer reversal failed' : 'Stripe Connect transfer reversed',
        description: amount == null
          ? `Transfer reversal ${status}.`
          : `Transfer reversal of ${formatCurrency(amount)} ${status}.`,
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

  addEvent(events, booking.started_at ? {
    id: 'started',
    at: booking.started_at,
    title: 'Cleaning started',
    description: `Start was ${booking.start_initiated_by === 'system' ? 'auto-started by system' : 'started manually by cleaner'}.`,
    tone: 'success',
  } : null)

  addEvent(events, booking.completed_at ? {
    id: 'completed',
    at: booking.completed_at,
    title: 'Cleaning completed',
    description: 'The cleaner marked the booking as complete.',
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

  addEvent(events, paymentReleaseDescription && booking.cancelled_at ? {
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

  addEvent(events, booking.cancelled_at ? {
    id: 'cancelled',
    at: booking.cancelled_at,
    title: 'Booking cancelled',
    description: clientCancellationCopy?.actionLogDescription
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
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [loading, setLoading] = useState(true)

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
  const paymentStateLabel = getAdminPaymentStateLabel(booking)
  const cancellationOutcome = (
    isSuccessfulPaymentStatus(booking.payment?.status) ||
    isNormalCancellationPaymentRelease(booking)
  )
    ? getCancellationPaymentOutcome(booking)
    : null
  const useProjectedPaymentLabels = isNonPayableBookingState(booking)
  const payoutSummary = getCleanerPayoutSummary(booking)
  const financialOutcome = getBookingFinancialOutcome(booking)
  const cleanerPayoutState = describeCleanerPayoutState(booking, financialOutcome.finalCleanerPayout)
  const transferState = describeTransferState(booking)

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-fit"
          onClick={() => router.push('/admin/bookings')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bookings
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
                <DetailRow label="Service" value={SERVICE_LABELS[booking.service_type] ?? booking.service_type} />
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
                <DetailRow label="Stripe Payment Status" value={paymentStateLabel} />
                <DetailRow label="Cleaner payout" value={cleanerPayoutState} />
                <DetailRow label="Transfer status" value={transferState} />
                <DetailRow label="Original booking amount" value={formatCurrency(booking.total_amount)} />
                {cancellationOutcome ? (
                  <>
                    <DetailRow label="Amount captured" value={formatCurrency(cancellationOutcome.capturedAmount)} />
                    <DetailRow label="Refund/released amount" value={formatCurrency(cancellationOutcome.releasedAmount)} />
                    <DetailRow label="Cancellation charge" value={formatCurrency(cancellationOutcome.cancellationFee)} />
                    <DetailRow label="Cleaner payout due" value={formatCurrency(cancellationOutcome.cleanerPayoutDue)} />
                    <DetailRow label="Final platform amount retained" value={`${formatCurrency(cancellationOutcome.platformRetainedAmount)} before Stripe fees`} />
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
                <DetailRow label="Final cleaner payout" value={formatCurrency(financialOutcome.finalCleanerPayout)} />
                <DetailRow label="Accept by" value={booking.accept_by ? formatDate(booking.accept_by) : null} />
                <DetailRow label="Pay by" value={booking.pay_by ? formatDate(booking.pay_by) : null} />
                <DetailRow label="Accepted" value={booking.accepted_at ? formatDate(booking.accepted_at) : null} />
                <DetailRow label="Confirmed" value={booking.confirmed_at ? formatDate(booking.confirmed_at) : null} />
                <DetailRow label="Started" value={booking.started_at ? formatDate(booking.started_at) : null} />
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
              </div>
              {(getAdminClientCancellationCopy(booking)?.stateLabel || booking.cancellation_reason) && (
                <p className="break-words rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {getAdminClientCancellationCopy(booking)?.stateLabel || booking.cancellation_reason}
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
