'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react'
import { authApi, availabilityApi, bookingsApi, paymentsApi, reviewsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { BookingInstructions } from '@/components/booking-instructions'
import { PriceBreakdownCard } from '@/components/price-breakdown-card'
import { Chat } from '@/components/chat'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  ALTERNATIVE_PROPOSAL_WINDOW_DAYS,
  maxAlternativeProposalDateInputValue,
  maxPreConfirmationProposalDateInputValue,
  toDateInputValueCyprus,
  toIsoFromDateAndTimeInCyprus,
  toTimeInputValueCyprus,
  toTimeLabelInCyprus,
  toTimeValueInCyprus,
} from '@/lib/booking-proposal'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatDate } from '@/lib/utils'
import { canViewChatHistoryForBooking, isChatReadOnly } from '@/lib/chat-window'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}
const RESCHEDULE_CUTOFF_HOURS = 24
const RESCHEDULE_CUTOFF_MS = RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1000
const AMEND_MAX_SHIFT_MS = 3 * 60 * 60 * 1000
const PHONE_REVEAL_PRE_START_MS = 6 * 60 * 60 * 1000
const PHONE_REVEAL_POST_END_MS = 30 * 60 * 1000
const DISPUTE_WINDOW_HOURS = Number(process.env.NEXT_PUBLIC_DISPUTE_WINDOW_HOURS ?? 24)
const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_HOURS * 60 * 60 * 1000

function isPaymentAuthorized(paymentStatus?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
}

function isOverdueUnpaidDraftLike(booking: BookingRead) {
  const isUnpaidDraftLike = booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status))
  if (!isUnpaidDraftLike) return false
  return new Date(booking.scheduled_start).getTime() <= Date.now()
}

function pendingValidityLabel(booking: BookingRead) {
  if (!booking.accept_by) {
    return 'This request expires 1 hour before the scheduled start time. If the cleaner does not respond, the booking request will expire automatically and your card authorisation will be released.'
  }
  const validUntilText = new Date(booking.accept_by).toLocaleString('en-IE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `This request expires on ${validUntilText}. If the cleaner does not respond, the booking request will expire automatically and your card authorisation will be released.`
}

function cyprusDateStr(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(date)
}

function formatReportWindowDeadline(valueMs: number) {
  return new Date(valueMs).toLocaleString('en-IE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', ' at')
}

export default function ClientBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [actionLoading, setActionLoading] = useState<
    | 'accept_proposal'
    | 'decline_proposal'
    | 'counter_proposal'
    | 'propose_alternative'
    | 'amend_start_time'
    | 'cancel_request'
    | 'review'
    | null
  >(null)
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterDate, setCounterDate] = useState('')
  const [counterTime, setCounterTime] = useState('')
  const [counterTimeOptions, setCounterTimeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [proposalOpen, setProposalOpen] = useState(false)
  const [proposalAction, setProposalAction] = useState<'propose_alternative' | 'amend_start_time'>('propose_alternative')
  const [proposalDate, setProposalDate] = useState('')
  const [proposalTime, setProposalTime] = useState('')
  const [proposalTimeOptions, setProposalTimeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [phoneRevealed, setPhoneRevealed] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [declineProposalConfirmOpen, setDeclineProposalConfirmOpen] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const refresh = () =>
    bookingsApi
      .getById(id)
      .then((response) => {
        setBooking(response.data ?? null)
        resetLoadError('client-booking-detail')
      })
      .catch(() => reportLoadError('client-booking-detail', 'Failed to load booking'))
      .finally(() => setLoading(false))

  useEffect(() => {
    refresh()
    authApi.me().then((meRes) => setCurrentUserId(meRes.data?.id ?? null)).catch(() => setCurrentUserId(null))
  }, [id])

  useEffect(() => {
    const paymentFlag = searchParams.get('payment')
    if (paymentFlag !== 'authorized') return

    paymentsApi
      .syncAuthorization(id)
      .then(() => refresh())
      .catch(() => {
        // webhook may still complete the transition shortly
      })
  }, [id, searchParams])

  useEffect(() => {
    if (!booking || !counterOpen || !counterDate) {
      setCounterTimeOptions([])
      return
    }

    const isAmendContext = booking.proposal_context === 'amend_start'
    availabilityApi
      .getSlots(
        booking.cleaner_id,
        counterDate,
        booking.duration_hours,
        isAmendContext ? { excludeBookingId: booking.id } : undefined,
      )
      .then((res) => {
        const options = (res.data ?? [])
          .filter((slot) => !slot.disabled)
          .map((slot) => {
            const start = new Date(slot.start)
            const value = toTimeValueInCyprus(start)
            const label = toTimeLabelInCyprus(start)
            return { value, label }
          })
        setCounterTimeOptions(options)
        if (!options.some((o) => o.value === counterTime)) {
          setCounterTime(options[0]?.value ?? '')
        }
      })
      .catch(() => {
        setCounterTimeOptions([])
        setCounterTime('')
      })
  }, [booking, counterOpen, counterDate, counterTime])

  useEffect(() => {
    if (!booking || !proposalOpen || !proposalDate) {
      setProposalTimeOptions([])
      return
    }

    availabilityApi
      .getSlots(
        booking.cleaner_id,
        proposalDate,
        booking.duration_hours,
        proposalAction === 'amend_start_time' ? { excludeBookingId: booking.id } : undefined,
      )
      .then((res) => {
        const options = (res.data ?? [])
          .filter((slot) => !slot.disabled)
          .map((slot) => {
            const start = new Date(slot.start)
            const value = toTimeValueInCyprus(start)
            const label = toTimeLabelInCyprus(start)
            return { value, label }
          })
        setProposalTimeOptions(options)
        if (!options.some((o) => o.value === proposalTime)) {
          setProposalTime(options[0]?.value ?? '')
        }
      })
      .catch(() => {
        setProposalTimeOptions([])
        setProposalTime('')
      })
  }, [booking, proposalOpen, proposalDate, proposalTime])

  useEffect(() => {
    setPhoneRevealed(false)
  }, [booking?.id, booking?.status, booking?.cleaner?.user?.phone])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  async function handleReview() {
    setActionLoading('review')
    try {
      await reviewsApi.create(id, { rating: reviewRating, comment: reviewComment || undefined })
      toast.success('Review submitted!')
      setReviewOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBookingAction(
    action: 'accept_proposal' | 'decline_proposal' | 'counter_proposal' | 'propose_alternative' | 'amend_start_time',
    proposedStart?: string,
  ) {
    setActionLoading(action)
    try {
      await bookingsApi.action(id, action, proposedStart)
      const isLiveScheduleRequest = booking?.proposal_context === 'post_confirmation' || booking?.proposal_context === 'amend_start'
      const labels: Record<string, string> = {
        accept_proposal: 'Proposed time accepted. Booking confirmed.',
        decline_proposal: isLiveScheduleRequest
          ? 'Request declined. Original booking time kept.'
          : 'Proposal declined. Request closed.',
        counter_proposal: 'Counter-offer sent to cleaner.',
        propose_alternative: 'Reschedule proposal sent to cleaner.',
        amend_start_time: 'Amend Start Time request sent to cleaner.',
      }
      toast.success(labels[action])
      if (action === 'counter_proposal') {
        setCounterOpen(false)
        setCounterDate('')
        setCounterTime('')
        setCounterTimeOptions([])
      }
      if (action === 'propose_alternative' || action === 'amend_start_time') {
        setProposalOpen(false)
        setProposalDate('')
        setProposalTime('')
        setProposalTimeOptions([])
      }
      if (action === 'decline_proposal') {
        setDeclineProposalConfirmOpen(false)
      }
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelRequest() {
    setActionLoading('cancel_request')
    try {
      const reason = canCancelDraft
        ? 'Cancelled by client while in draft payment-required state'
        : canCancelBookingRequest
          ? 'Cancelled by client while pending cleaner acceptance'
          : moreThan24HoursAway
            ? 'Cancelled by client more than 24 hours before scheduled start'
            : 'Cancelled by client within 24 hours of scheduled start'
      await bookingsApi.cancel(id, reason)
      if (booking?.cleaner_id && (canCancelDraft || canCancelBookingRequest)) {
        await bookingsApi.clearFlowDraft(booking.cleaner_id).catch(() => null)
      }
      toast.success(
        canCancelDraft
          ? 'Draft booking cancelled'
          : canCancelBookingRequest
            ? 'Booking request cancelled'
            : 'Booking cancelled',
      )
      setCancelConfirmOpen(false)
      await refresh()
      router.push('/client/bookings')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel booking request')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <DetailPageSkeleton />
  if (!booking) return <div className="py-16 text-center text-muted-foreground">Booking not found.</div>

  const paymentStatus = booking.payment?.status ?? null
  const isAuthorized = ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
  const overdueUnpaidDraftLike = isOverdueUnpaidDraftLike(booking)
  const canAuthorize = booking.status === 'accepted' && !isAuthorized
  const canContinuePayment = !overdueUnpaidDraftLike && (booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status)))
  const canCancelDraft = !overdueUnpaidDraftLike && (booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status)))
  const canCancelBookingRequest = booking.status === 'pending' && isPaymentAuthorized(booking.payment?.status)
  const reviewWindowOpened = Number.isFinite(new Date(booking.scheduled_end).getTime()) && Date.now() >= new Date(booking.scheduled_end).getTime()
  const canReview = Boolean(booking.completed_at) && ['completed', 'disputed'].includes(booking.status) && !booking.review && reviewWindowOpened
  const isPending = booking.status === 'pending'
  const hasProposal = Boolean(booking.proposed_start && booking.proposal_by)
  const cleanerProposed = booking.proposal_by === 'cleaner'
  const clientProposed = booking.proposal_by === 'client'
  const scheduledStartMs = new Date(booking.scheduled_start).getTime()
  const millisUntilStart = scheduledStartMs - Date.now()
  const hasStarted = Number.isFinite(scheduledStartMs) && millisUntilStart <= 0
  const moreThan24HoursAway = Number.isFinite(scheduledStartMs) && millisUntilStart > RESCHEDULE_CUTOFF_MS
  const within24HoursBeforeStart = Number.isFinite(scheduledStartMs) && millisUntilStart > 0 && millisUntilStart <= RESCHEDULE_CUTOFF_MS
  const hasAlreadyRescheduled = (booking.post_cleaner_proposals ?? 0) >= 1 && (booking.post_client_proposals ?? 0) >= 1
  const canRescheduleBooking = booking.status === 'confirmed' && moreThan24HoursAway && !hasStarted && !hasProposal && !hasAlreadyRescheduled
  const clientAmendRequestUsed = (booking.client_proposals ?? 0) >= 1
  const amendFinalised = (booking.client_proposals ?? 0) >= 1 && (booking.cleaner_proposals ?? 0) >= 1
  const canAmendStartTime = booking.status === 'confirmed' && within24HoursBeforeStart && !hasProposal && !clientAmendRequestUsed && !amendFinalised
  const canCancelConfirmedBooking = booking.status === 'confirmed' && !hasStarted
  const proposalContext =
    booking.proposal_context ??
    (booking.status === 'pending' ? 'pre_confirmation' : booking.status === 'accepted' || booking.status === 'confirmed' ? 'post_confirmation' : null)
  const canCounterProposal = cleanerProposed
    && hasProposal
    && (
      proposalContext === 'pre_confirmation'
        ? moreThan24HoursAway && (booking.client_proposals ?? 0) < 1
        : proposalContext === 'post_confirmation'
          ? moreThan24HoursAway && (booking.post_client_proposals ?? 0) < 1
          : proposalContext === 'amend_start'
            ? false
            : false
    )
  const hasOpenProposalFlow = hasProposal && ['pending', 'accepted', 'confirmed'].includes(booking.status)
  const canRespondToCleanerProposal = hasOpenProposalFlow && cleanerProposed
  const canReportInProgress = booking.status === 'in_progress'
  const isCompletedAwaitingRelease = booking.status === 'completed' && paymentStatus !== 'transferred'
  const isCompletedReleased = booking.status === 'completed' && paymentStatus === 'transferred'
  const isPostConfirmationRescheduleDecline = proposalContext === 'post_confirmation' && cleanerProposed && ['accepted', 'confirmed'].includes(booking.status)
  const isAmendProposal = proposalContext === 'amend_start'
  const counterMinDate = isAmendProposal ? toDateInputValueCyprus(booking.scheduled_start) : toDateInputValueCyprus(new Date())
  const counterMaxDate = isAmendProposal
    ? toDateInputValueCyprus(booking.scheduled_start)
    : proposalContext === 'post_confirmation'
      ? maxAlternativeProposalDateInputValue(booking.original_scheduled_start ?? booking.scheduled_start)
      : maxPreConfirmationProposalDateInputValue()
  const proposalMinDate = proposalAction === 'amend_start_time'
    ? toDateInputValueCyprus(booking.scheduled_start)
    : toDateInputValueCyprus(new Date())
  const proposalMaxDate = proposalAction === 'amend_start_time'
    ? toDateInputValueCyprus(booking.scheduled_start)
    : maxAlternativeProposalDateInputValue(booking.original_scheduled_start ?? booking.scheduled_start)
  const showChat = canViewChatHistoryForBooking(booking)
  const chatIsReadOnly = isChatReadOnly(booking.scheduled_end)
  const scheduledEndMs = new Date(booking.scheduled_end).getTime()
  const createdAtMs = new Date(booking.created_at).getTime()
  const sixHoursBeforeStart = nowTick >= scheduledStartMs - PHONE_REVEAL_PRE_START_MS
  const sameDayCreated =
    Number.isFinite(createdAtMs) &&
    Number.isFinite(scheduledStartMs) &&
    cyprusDateStr(new Date(createdAtMs)) === cyprusDateStr(new Date(scheduledStartMs))
  const createdWithinSixHoursOfStart = sameDayCreated && scheduledStartMs - createdAtMs < PHONE_REVEAL_PRE_START_MS
  const revealUnlockReached = sixHoursBeforeStart || createdWithinSixHoursOfStart
  const isPostCompletionPhoneLocked = ['completed', 'disputed'].includes(booking.status)
  const revealExpired = Number.isFinite(scheduledEndMs) && nowTick > scheduledEndMs + PHONE_REVEAL_POST_END_MS
  const canRevealCleanerPhone =
    ['accepted', 'confirmed', 'in_progress'].includes(booking.status) &&
    revealUnlockReached &&
    !isPostCompletionPhoneLocked &&
    !revealExpired
  const cleanerPhone = booking.cleaner?.user?.phone ?? ''
  const reportAnchorMs = Number.isFinite(scheduledEndMs) ? scheduledEndMs : 0
  const reportDeadlineMs = reportAnchorMs ? reportAnchorMs + DISPUTE_WINDOW_MS : 0
  const reportableStatus = booking.status === 'completed' || booking.status === 'disputed'
  const reportWindowActive = Boolean(reportableStatus && reportAnchorMs && Date.now() <= reportDeadlineMs)
  const reportWindowExpired = Boolean(reportableStatus && reportAnchorMs && Date.now() > reportDeadlineMs)
  const proposalExpiresMs = booking.proposal_expires_at ? new Date(booking.proposal_expires_at).getTime() : null
  const proposalCountdownLabel = proposalExpiresMs && proposalExpiresMs > nowTick
    ? `${Math.ceil((proposalExpiresMs - nowTick) / 60_000)} min`
    : null

  return (
    <>
      <div className="client-booking-detail-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Booking Detail
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                {SERVICE_LABELS[booking.service_type]}
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Manage actions, review booking details, and continue chat for this booking.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Current Status
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <BookingStatusBadge status={booking.status} paymentStatus={booking.payment?.status} proposalBy={booking.proposal_by} />
                  <p className={`${displayFont.className} text-xl font-bold tracking-[-0.02em] text-white`}>
                    {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            onClick={() => router.push('/client/bookings')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to bookings
          </Button>
        </div>

        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="min-w-0 space-y-4">
            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-3 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                <h2 className={`${displayFont.className} text-xl font-semibold tracking-[-0.02em]`}>
                  Booking Information
                </h2>
                <Separator />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Calendar className="h-4 w-4" />{formatDate(booking.scheduled_start)}</p>
                  <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{booking.duration_hours} hours</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{booking.address}, {booking.city}, {booking.postcode}</p>
                </div>
                {booking.special_instructions && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Special instructions</p>
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
                subtotal: booking.subtotal ?? booking.total_amount - booking.platform_fee,
                platform_fee_pct: 10,
                platform_fee: booking.platform_fee,
                cleaner_payout: booking.cleaner_payout,
                total_amount: booking.total_amount,
              }}
            />

          </div>

          <div className="min-w-0 space-y-4">
            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-2 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                <h2 className={`${displayFont.className} text-lg font-semibold tracking-[-0.02em] text-slate-900`}>
                  Cleaner contact
                </h2>
                {isPostCompletionPhoneLocked || revealExpired ? (
                  <p className="text-sm text-slate-500">Phone access is now closed for this booking.</p>
                ) : canRevealCleanerPhone ? (
                  cleanerPhone ? (
                    phoneRevealed ? (
                      <p className="text-sm text-slate-600">{cleanerPhone}</p>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setPhoneRevealed(true)}>
                        Reveal number
                      </Button>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">Cleaner phone is not available yet.</p>
                  )
                ) : (
                  <p className="text-sm text-slate-500">Cleaner number becomes available 6 hours before the booking.</p>
                )}
                {booking.status === 'in_progress' && (
                  <p className="text-xs text-slate-500">
                    Phone access automatically closes 30 minutes after scheduled booking end.
                  </p>
                )}
              </CardContent>
            </Card>

            {hasOpenProposalFlow && (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {cleanerProposed
                  ? isAmendProposal
                    ? `Cleaner requested Amend Start Time: ${formatDate(booking.scheduled_start)} → ${formatDate(booking.proposed_start!)}. The other party can accept or decline this amendment request.`
                    : `Cleaner proposed ${formatDate(booking.scheduled_start)} → ${formatDate(booking.proposed_start!)}. Accept, decline, or counter once before expiry.`
                  : clientProposed && isAmendProposal
                    ? `You requested Amend Start Time: ${formatDate(booking.scheduled_start)} → ${formatDate(booking.proposed_start!)}. Waiting for cleaner response.`
                    : `You proposed a reschedule: ${formatDate(booking.scheduled_start)} → ${formatDate(booking.proposed_start!)}. Waiting for cleaner response before the 24-hour cutoff.`}
              </p>
            )}
            {hasOpenProposalFlow && proposalCountdownLabel && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Response window: {proposalCountdownLabel} remaining.
              </p>
            )}
            {booking.status === 'pending' && booking.accept_by && (
              <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                {canAuthorize
                  ? 'Authorise your card to send this booking request to the cleaner.'
                  : pendingValidityLabel(booking)}
              </p>
            )}
            {booking.status === 'accepted' && canAuthorize && (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Authorise your card now to keep this booking active. Your card is reserved, not charged yet.
              </p>
            )}

            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-2 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                <h2 className={`${displayFont.className} text-lg font-semibold tracking-[-0.02em] text-slate-900`}>
                  Next actions
                </h2>
                {Boolean(reportableStatus && reportAnchorMs) && (
                  <p
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      reportWindowActive
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {reportWindowActive
                      ? `Report window active until ${formatReportWindowDeadline(reportDeadlineMs)}.`
                      : `Report window closed on ${formatReportWindowDeadline(reportDeadlineMs)}.`}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {canRespondToCleanerProposal && (
                    <>
                      <Button
                        size="lg"
                        className="w-full sm:w-auto"
                        onClick={() => handleBookingAction('accept_proposal')}
                        loading={actionLoading === 'accept_proposal'}
                        disabled={Boolean(actionLoading)}
                      >
                        Accept proposed time
                      </Button>
                      {canCounterProposal && (
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            const seed = booking.proposed_start ?? booking.scheduled_start
                            setCounterDate(toDateInputValueCyprus(isAmendProposal ? booking.scheduled_start : seed))
                            setCounterTime(toTimeInputValueCyprus(seed))
                            setCounterOpen(true)
                          }}
                          disabled={Boolean(actionLoading)}
                        >
                          Counter once with another time
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={() => setDeclineProposalConfirmOpen(true)}
                        disabled={Boolean(actionLoading)}
                      >
                        Decline proposal
                      </Button>
                    </>
                  )}
                  {canAuthorize && (
                    <Button size="lg" className="w-full sm:w-auto" onClick={() => router.push(`/client/checkout/${id}`)}>
                      Authorise card
                    </Button>
                  )}
                  {canContinuePayment && (
                    <>
                      <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push(`/client/book/${booking.cleaner_id}?continue=1&bookingId=${booking.id}&step=3`)}>
                        Continue payment
                      </Button>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Need to change something? Cancel this draft and start a new booking.
                      </p>
                    </>
                  )}
                  {canCancelDraft && (
                    <Button variant="outline" className="w-full sm:w-auto border-red-300 text-red-700 hover:bg-red-50" onClick={() => setCancelConfirmOpen(true)}>
                      Cancel draft
                    </Button>
                  )}
                  {canCancelBookingRequest && (
                    <Button variant="outline" className="w-full sm:w-auto border-red-300 text-red-700 hover:bg-red-50" onClick={() => setCancelConfirmOpen(true)}>
                      Cancel booking request
                    </Button>
                  )}
                  {canRescheduleBooking && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const seed = booking.proposed_start ?? booking.scheduled_start
                        setProposalAction('propose_alternative')
                        setProposalDate(toDateInputValueCyprus(seed))
                        setProposalTime(toTimeInputValueCyprus(seed))
                        setProposalOpen(true)
                      }}
                      disabled={Boolean(actionLoading)}
                    >
                      Reschedule booking
                    </Button>
                  )}
                  {canAmendStartTime && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const seed = booking.scheduled_start
                        setProposalAction('amend_start_time')
                        setProposalDate(toDateInputValueCyprus(seed))
                        setProposalTime(toTimeInputValueCyprus(seed))
                        setProposalOpen(true)
                      }}
                      disabled={Boolean(actionLoading)}
                    >
                      Amend Start Time
                    </Button>
                  )}
                  {canAmendStartTime && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Small same-day adjustment only (up to +/-3 hours).
                    </p>
                  )}
                  {canCancelConfirmedBooking && (
                    <Button variant="outline" className="w-full sm:w-auto border-red-300 text-red-700 hover:bg-red-50" onClick={() => setCancelConfirmOpen(true)}>
                      Cancel booking
                    </Button>
                  )}
                  {booking.status === 'confirmed' && within24HoursBeforeStart && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Less than 24 hours remain before start. Cancellation charges may apply under the cancellation policy.
                    </p>
                  )}
                  {booking.status === 'confirmed' && moreThan24HoursAway && hasAlreadyRescheduled && !hasProposal && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      This booking has already been rescheduled once. Further rescheduling is not available for MVP.
                    </p>
                  )}
                  {booking.status === 'confirmed' && within24HoursBeforeStart && !hasProposal && clientAmendRequestUsed && !amendFinalised && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      You have already used your single Amend Start Time request for this booking.
                    </p>
                  )}
                  {booking.status === 'confirmed' && within24HoursBeforeStart && !hasProposal && amendFinalised && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Amend Start Time has already been finalised for this booking.
                    </p>
                  )}
                  {(booking.status === 'expired' || booking.status === 'cancelled' || booking.status === 'declined' || overdueUnpaidDraftLike) && (
                    <>
                      <Button className="w-full sm:w-auto" onClick={() => router.push(`/client/book/${booking.cleaner_id}?reset=1&step=1`)}>
                        Book again
                      </Button>
                      <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/client/cleaners')}>
                        Choose another cleaner
                      </Button>
                    </>
                  )}
                  {booking.status === 'in_progress' && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Cleaner can complete this job from 5 minutes before scheduled end time.
                    </p>
                  )}
                  {canReportInProgress && (
                    <Button variant="destructive" className="w-full sm:w-auto" onClick={() => router.push(`/client/report?booking=${id}`)}>
                      Report a problem
                    </Button>
                  )}
                  {isCompletedReleased && (
                    <Button className="w-full sm:w-auto" onClick={() => router.push(`/client/book/${booking.cleaner_id}?reset=1&step=1`)}>
                      Book again
                    </Button>
                  )}
                  {canReview && (
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setReviewOpen(true)}>
                      Leave a review
                    </Button>
                  )}
                  {reportWindowActive && isCompletedAwaitingRelease && (
                    <Button variant="destructive" className="w-full sm:w-auto" onClick={() => router.push(`/client/report?booking=${id}`)}>
                      Report a Problem
                    </Button>
                  )}
                  {reportWindowExpired && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      The {DISPUTE_WINDOW_HOURS}-hour report window has expired for this booking.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {showChat && currentUserId ? (
              <Card className="border-slate-200 bg-white/90">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Messages</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Chat
                    bookingId={id}
                    currentUserId={currentUserId}
                    readOnly={chatIsReadOnly}
                    readOnlyMessage="This booking chat is now closed. Messaging closed 30 minutes after scheduled booking completion."
                    autoScroll={false}
                  />
                </CardContent>
              </Card>
            ) : !showChat ? (
              <p className="text-center text-xs text-muted-foreground">
                Booking chat history is unavailable for this booking.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <Dialog
        open={counterOpen}
        onClose={() => {
          setCounterOpen(false)
          setCounterDate('')
          setCounterTime('')
          setCounterTimeOptions([])
        }}
      >
        <DialogTitle>Counter with one new time</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can counter once. Cleaner will then only be able to accept or decline.
          </p>
          <div>
            <Label>Counter start time</Label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Input
                type="date"
                value={counterDate}
                onChange={(e) => setCounterDate(e.target.value)}
                min={counterMinDate}
                max={counterMaxDate || undefined}
                disabled={isAmendProposal}
              />
              <select
                value={counterTime}
                onChange={(e) => setCounterTime(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>{counterDate ? 'Select time' : 'Select date first'}</option>
                {counterTimeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-500">Only valid availability slots are shown for the selected date and duration.</p>
            {isAmendProposal && (
              <p className="mt-2 text-xs text-slate-600">Small same-day adjustment only (up to +/-3 hours).</p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const iso = toIsoFromDateAndTimeInCyprus(counterDate, counterTime)
              if (!iso) {
                toast.error('Select a valid date and time.')
                return
              }
              handleBookingAction('counter_proposal', iso)
            }}
            disabled={!counterDate || !counterTime}
            loading={actionLoading === 'counter_proposal'}
          >
            Send counter-offer
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={proposalOpen}
        onClose={() => {
          if (actionLoading === 'propose_alternative' || actionLoading === 'amend_start_time') return
          setProposalOpen(false)
          setProposalDate('')
          setProposalTime('')
          setProposalTimeOptions([])
        }}
      >
        <DialogTitle>{proposalAction === 'propose_alternative' ? 'Reschedule booking' : 'Amend Start Time'}</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {proposalAction === 'propose_alternative'
              ? 'You can request a new date or time for this booking. The other party must accept before the booking changes. If they decline or do not respond before the 24-hour cutoff, the original booking time will remain unchanged.'
              : 'Choose an available slot on the same day. Cleaner can only accept or decline this amendment request.'}
          </p>
          {proposalAction === 'propose_alternative' && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Only available more than 24h before booking start</li>
              <li>New time must be within 14 days of original booking date</li>
              <li>Must fit cleaner availability, booking duration, and buffer rules</li>
              <li>Other party can accept, decline, or counter once</li>
              <li>If no agreement before 24h cutoff, original booking remains</li>
              <li>No penalty applies if reschedule fails</li>
              <li>Once reschedule is successfully agreed, no further reschedule is allowed for MVP</li>
            </ul>
          )}
          <div>
            <Label>{proposalAction === 'propose_alternative' ? 'Proposed start time' : 'Amended start time'}</Label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Input
                type="date"
                value={proposalDate}
                onChange={(e) => setProposalDate(e.target.value)}
                min={proposalMinDate}
                max={proposalMaxDate || undefined}
                disabled={proposalAction === 'amend_start_time'}
              />
              <select
                value={proposalTime}
                onChange={(e) => setProposalTime(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>{proposalDate ? 'Select time' : 'Select date first'}</option>
                {proposalTimeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-500">Only valid availability slots are shown for the selected date and duration.</p>
            {proposalAction === 'propose_alternative' && (
              <p className="mt-2 text-xs text-slate-600">
                If this request is declined or expires, the original booking time will remain unchanged.
              </p>
            )}
            {proposalAction === 'amend_start_time' && (
              <p className="mt-2 text-xs text-slate-600">Small same-day adjustment only (up to +/-3 hours).</p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const iso = toIsoFromDateAndTimeInCyprus(proposalDate, proposalTime)
              if (!iso) {
                toast.error('Select a valid date and time.')
                return
              }
              if (proposalAction === 'amend_start_time') {
                const proposedMs = new Date(iso).getTime()
                const currentMs = new Date(booking.scheduled_start).getTime()
                if (Math.abs(proposedMs - currentMs) > AMEND_MAX_SHIFT_MS) {
                  toast.error('Amend Start Time can only shift by up to 3 hours from the current scheduled start time.')
                  return
                }
              }
              handleBookingAction(proposalAction, iso)
            }}
            disabled={!proposalDate || !proposalTime}
            loading={actionLoading === proposalAction}
          >
            {proposalAction === 'propose_alternative' ? 'Send reschedule proposal' : 'Send amendment request'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={declineProposalConfirmOpen}
        onClose={() => {
          if (actionLoading === 'decline_proposal') return
          setDeclineProposalConfirmOpen(false)
        }}
      >
        <DialogTitle>{(isPostConfirmationRescheduleDecline || isAmendProposal) ? 'Decline request?' : 'Decline proposed time?'}</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {(isPostConfirmationRescheduleDecline || isAmendProposal)
              ? 'Declining this request will keep the original booking date and time unchanged. The booking will continue as originally scheduled unless one side later cancels.'
              : 'Declining this proposed time will close the booking request. Your card authorisation will be released if no booking is confirmed.'}
          </p>
          {!(isPostConfirmationRescheduleDecline || isAmendProposal) && (
            <p className="text-sm text-muted-foreground">
              If you still want this booking, you can accept the proposed time or counter once with another available time.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDeclineProposalConfirmOpen(false)}
              disabled={Boolean(actionLoading)}
            >
              {(isPostConfirmationRescheduleDecline || isAmendProposal) ? 'Keep request' : 'Keep booking request'}
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleBookingAction('decline_proposal')}
              loading={actionLoading === 'decline_proposal'}
              disabled={Boolean(actionLoading) && actionLoading !== 'decline_proposal'}
            >
              {(isPostConfirmationRescheduleDecline || isAmendProposal) ? 'Decline request' : 'Decline & close request'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)}>
        <DialogTitle>
          {canCancelDraft
            ? 'Cancel draft booking'
            : canCancelBookingRequest
              ? 'Cancel booking request'
              : 'Cancel booking?'}
        </DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {canCancelDraft
              ? 'Are you sure you want to cancel this draft booking?'
              : canCancelBookingRequest
                ? 'Are you sure you want to cancel this booking request?'
                : 'Are you sure you want to cancel this booking? Cancellation rules may apply depending on how close the booking is to the scheduled start time.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full" onClick={() => setCancelConfirmOpen(false)} disabled={Boolean(actionLoading)}>
              {canCancelDraft ? 'Keep draft' : canCancelBookingRequest ? 'Keep request' : 'Keep booking'}
            </Button>
            <Button variant="destructive" className="w-full" onClick={handleCancelRequest} loading={actionLoading === 'cancel_request'}>
              {canCancelDraft ? 'Cancel draft' : canCancelBookingRequest ? 'Cancel booking request' : 'Cancel booking'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)}>
        <DialogTitle>Leave a review</DialogTitle>
        <div className="space-y-4">
          <div>
            <Label>Rating</Label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setReviewRating(rating)}
                  className={`h-10 w-10 rounded-full border-2 text-sm font-semibold transition-colors ${
                    rating <= reviewRating
                      ? 'bg-yellow-400 border-yellow-400 text-white'
                      : 'border-muted text-muted-foreground hover:border-yellow-300'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">1 = very poor, 5 = excellent</p>
          </div>
          <div>
            <Label>Comment (optional)</Label>
            <Textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="How was the service?"
              className="mt-1"
              rows={3}
            />
          </div>
          <Button onClick={handleReview} className="w-full" loading={actionLoading === 'review'} disabled={Boolean(actionLoading)}>
            Submit review
          </Button>
        </div>
      </Dialog>

      <style jsx>{`
        .client-stage {
          position: relative;
          isolation: isolate;
          background: linear-gradient(125deg, #04162f 8%, #0f3b76 58%, #0e5698);
        }

        .client-stage__media {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(105deg, rgba(2, 11, 27, 0.82) 10%, rgba(2, 11, 27, 0.5) 55%, rgba(8, 22, 44, 0.72) 100%),
            radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px);
          background-size: cover;
          background-position: center;
          mix-blend-mode: screen;
          opacity: 0.9;
        }

        .client-stage__grain {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0) 45%),
            radial-gradient(circle at 18% 22%, rgba(56, 220, 255, 0.22), transparent 28%),
            radial-gradient(circle at 82% 12%, rgba(244, 180, 0, 0.2), transparent 22%);
          animation: hero-sweep 11s ease-in-out infinite;
          pointer-events: none;
        }

        .animate-stage-up {
          animation: stage-up 0.72s cubic-bezier(0.18, 0.82, 0.3, 1) both;
        }

        .delay-120 {
          animation-delay: 120ms;
        }

        @keyframes stage-up {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes hero-sweep {
          0%,
          100% {
            transform: translateX(0%);
            opacity: 1;
          }
          50% {
            transform: translateX(1.8%);
            opacity: 0.88;
          }
        }
      `}</style>
    </>
  )
}
