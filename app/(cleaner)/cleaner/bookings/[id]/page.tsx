'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, MapPin, ArrowLeft } from 'lucide-react'
import { authApi, availabilityApi, bookingsApi, cleanersApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { BookingInstructions } from '@/components/booking-instructions'
import { CancellationPaymentBreakdown } from '@/components/cancellation-payment-breakdown'
import { Chat } from '@/components/chat'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  ALTERNATIVE_PROPOSAL_WINDOW_DAYS,
  PLATFORM_BOOKING_WINDOW_DAYS,
  getCleanerProposalEligibility,
  maxAlternativeProposalDateInputValue,
  maxPreConfirmationProposalDateInputValue,
  toDateInputValueCyprus,
  toIsoFromDateAndTimeInCyprus,
  toTimeInputValueCyprus,
  toTimeLabelInCyprus,
  toTimeValueInCyprus,
} from '@/lib/booking-proposal'
import { canViewChatHistoryForBooking, getChatReadOnlyMessage, isChatReadOnly } from '@/lib/chat-window'
import { isBookingReportWindowActive } from '@/lib/booking-release'
import { getCleanerEarningsLabel } from '@/lib/cleaner-earnings-label'
import { getCleanerBookingRequestDeadlineCopy } from '@/lib/booking-expiry-copy'
import { getCancellationPaymentOutcome } from '@/lib/booking-payment-outcome'
import { subscribeBookingsRefresh, triggerBookingsRefresh } from '@/lib/booking-sync'
import { showJobStartedToast } from '@/lib/job-start-toast'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}
const START_JOB_EARLY_WINDOW_MS = 15 * 60 * 1000
const RESCHEDULE_CUTOFF_MS = 24 * 60 * 60 * 1000
const AMEND_MAX_SHIFT_MS = 3 * 60 * 60 * 1000
const PHONE_REVEAL_PRE_START_MS = 6 * 60 * 60 * 1000
const PHONE_REVEAL_POST_END_MS = 30 * 60 * 1000
const DISPUTE_WINDOW_HOURS = Number(process.env.NEXT_PUBLIC_DISPUTE_WINDOW_HOURS ?? 24)

function resolveJobTypeTitle(booking: BookingRead) {
  const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
  const snapshotJobType = snapshotMatch?.[1]?.trim()
  if (snapshotJobType) return snapshotJobType
  return SERVICE_LABELS[booking.service_type] ?? booking.service_type
}

function cyprusDateStr(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(date)
}

function disputeWindowLabel() {
  if (!Number.isFinite(DISPUTE_WINDOW_HOURS) || DISPUTE_WINDOW_HOURS <= 0) return '24 hours'
  if (DISPUTE_WINDOW_HOURS >= 1) return `${DISPUTE_WINDOW_HOURS} hours`
  return `${Math.round(DISPUTE_WINDOW_HOURS * 60)} minutes`
}

export default function CleanerBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [stripeConnected, setStripeConnected] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelBookingOpen, setCancelBookingOpen] = useState(false)
  const [declineCounterOfferOpen, setDeclineCounterOfferOpen] = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [proposalAction, setProposalAction] = useState<'propose_alternative' | 'counter_proposal' | 'amend_start_time'>('propose_alternative')
  const [proposalDate, setProposalDate] = useState('')
  const [proposalTime, setProposalTime] = useState('')
  const [proposalTimeOptions, setProposalTimeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [phoneRevealed, setPhoneRevealed] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const refresh = () =>
    bookingsApi.getById(id)
      .then((r) => {
        setBooking(r.data ?? null)
        resetLoadError('cleaner-booking-detail')
      })
      .catch(() => reportLoadError('cleaner-booking-detail', 'Failed to load booking'))
      .finally(() => setLoading(false))

  useEffect(() => {
    refresh()
    authApi.me().then((meRes) => setCurrentUserId(meRes.data?.id ?? null)).catch(() => setCurrentUserId(null))
    cleanersApi.me()
      .then((cleanerRes) => {
        const cleaner = cleanerRes.data?.cleaner as any
        setStripeConnected(Boolean(cleaner?.stripe_onboarding_complete ?? cleaner?.stripeOnboardingComplete))
      })
      .catch(() => null)
  }, [id])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    return subscribeBookingsRefresh((payload) => {
      if (payload.bookingId && payload.bookingId !== id) return
      refresh().catch(() => null)
    })
  }, [id])

  useEffect(() => {
    setPhoneRevealed(false)
  }, [booking?.id, booking?.status, booking?.client?.user?.phone])

  useEffect(() => {
    if (!booking || !proposalDate || !proposalOpen) {
      setProposalTimeOptions([])
      return
    }

    const isAmendContext =
      proposalAction === 'amend_start_time' ||
      (proposalAction === 'counter_proposal' && booking.proposal_context === 'amend_start')
    availabilityApi
      .getSlots(
        booking.cleaner_id,
        proposalDate,
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
        setProposalTimeOptions(options)
        if (!options.some((o) => o.value === proposalTime)) {
          setProposalTime(options[0]?.value ?? '')
        }
      })
      .catch(() => {
        setProposalTimeOptions([])
        setProposalTime('')
      })
  }, [booking, proposalDate, proposalOpen, proposalTime])

  async function handleAction(action: 'start') {
    setActionLoading(action)
    try {
      let startLocation:
        | {
            latitude: number
            longitude: number
            accuracy_m?: number
          }
        | undefined

      if (action === 'start' && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 7000,
              maximumAge: 60000,
            })
          })
          startLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_m: position.coords.accuracy,
          }
        } catch {
          // Start Cleaning must remain available even when GPS is unavailable.
        }
      }

      await bookingsApi.action(id, action, undefined, startLocation)
      showJobStartedToast(id)
      await refresh()
      triggerBookingsRefresh({ bookingId: id, reason: 'cleaner-booking-detail:start' })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleComplete() {
    setActionLoading('complete')
    try {
      await bookingsApi.complete(id)
      toast.success('Job completed.')
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancel() {
    setActionLoading('decline')
    try {
      await bookingsApi.action(id, 'decline')
      toast.success('Booking request declined.')
      setCancelOpen(false)
      router.push('/cleaner/dashboard')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelBooking() {
    if (!booking) return
    setActionLoading('cancel')
    try {
      const reason = moreThan24HoursAway
        ? 'Cancelled by cleaner more than 24 hours before scheduled start'
        : 'Cancelled by cleaner within 24 hours of scheduled start'
      await bookingsApi.cancel(booking.id, reason)
      toast.success('Booking cancelled.')
      setCancelBookingOpen(false)
      await refresh()
      router.push('/cleaner/bookings')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel booking')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBookingAction(
    action: 'accept' | 'propose_alternative' | 'counter_proposal' | 'accept_proposal' | 'decline_proposal' | 'amend_start_time',
    customProposedStart?: string,
  ) {
    setActionLoading(action)
    try {
      await bookingsApi.action(id, action, customProposedStart)
      const isLiveScheduleRequest = booking?.proposal_context === 'post_confirmation' || booking?.proposal_context === 'amend_start'
      const labels: Record<string, string> = {
        accept: 'Booking accepted.',
        propose_alternative: 'Alternative time sent to client.',
        counter_proposal: 'Counter-offer sent to client.',
        amend_start_time: 'Amend Start Time request sent to client.',
        accept_proposal: 'Counter-offer accepted. Booking confirmed.',
        decline_proposal: isLiveScheduleRequest
          ? 'Request declined. Original booking time kept.'
          : 'Counter-offer declined. Request closed.',
      }
      toast.success(labels[action])
      if (action === 'propose_alternative' || action === 'counter_proposal' || action === 'amend_start_time') {
        setProposalOpen(false)
        setProposalDate('')
        setProposalTime('')
        setProposalTimeOptions([])
      }
      if (action === 'decline_proposal') {
        setDeclineCounterOfferOpen(false)
      }
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <DetailPageSkeleton />
  if (!booking) return <div className="text-center py-16 text-muted-foreground">Booking not found.</div>

  const {
    isPending,
    hasProposal,
    isCleanerProposal,
    canProposeAlternative,
    proposeAlternativeDisabledReason,
    canAcceptPending,
    canRespondToCounter,
  } = getCleanerProposalEligibility(booking)

  const showChat = canViewChatHistoryForBooking(booking)
  const chatIsReadOnly = isChatReadOnly(booking.scheduled_end, Date.now(), booking.status)
  const pendingValidityLabel = (() => {
    return getCleanerBookingRequestDeadlineCopy(booking)
  })()
  const completeOpensAt = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime() - 5 * 60 * 1000
    : Infinity
  const canCompleteJob = ['in_progress', 'disputed'].includes(booking.status) &&
    Boolean(booking.started_at) &&
    Date.now() >= completeOpensAt
  const bookingStartsAtMs = new Date(booking.scheduled_start).getTime()
  const bookingEndsAtMs = new Date(booking.scheduled_end).getTime()
  const millisUntilStart = bookingStartsAtMs - Date.now()
  const moreThan24HoursAway = Number.isFinite(bookingStartsAtMs) && millisUntilStart > RESCHEDULE_CUTOFF_MS
  const startWindowExpired = Number.isFinite(bookingEndsAtMs) && Date.now() > bookingEndsAtMs + 24 * 60 * 60 * 1000
  const canStartJobNow = Number.isFinite(bookingStartsAtMs) && Date.now() >= bookingStartsAtMs - START_JOB_EARLY_WINDOW_MS && !startWindowExpired
  const canReportProblem = ['in_progress', 'completed'].includes(booking.status) &&
    isBookingReportWindowActive(booking.scheduled_end)
  const earningsLabel = getCleanerEarningsLabel({
    status: booking.status,
    paymentStatus: booking.payment?.status,
    scheduledEnd: booking.scheduled_end,
  })
  const cancellationOutcome = getCancellationPaymentOutcome(booking)
  const isClosedNonPayableStatus = ['cancelled', 'declined', 'expired'].includes(booking.status)
  const clientTrust = (booking.client as any)?.trust as {
    memberSince?: string | null
    completedBookingsCount?: number
  } | undefined
  const memberSinceRaw = clientTrust?.memberSince ?? (booking.client as any)?.created_at ?? (booking.client as any)?.createdAt
  const memberSinceLabel = memberSinceRaw
    ? new Date(memberSinceRaw).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })
    : null
  const completedBookingsCount = Number(clientTrust?.completedBookingsCount ?? 0)
  const clientDisplayName = booking.client?.user?.name?.trim() || 'Client'
  const clientAvatarUrl = booking.client?.user?.avatar_url ?? null
  const createdAtMs = new Date(booking.created_at).getTime()
  const scheduledEndMs = new Date(booking.scheduled_end).getTime()
  const unlockAtMs = bookingStartsAtMs - PHONE_REVEAL_PRE_START_MS
  const sameDayCreated =
    Number.isFinite(createdAtMs) &&
    Number.isFinite(bookingStartsAtMs) &&
    cyprusDateStr(new Date(createdAtMs)) === cyprusDateStr(new Date(bookingStartsAtMs))
  const createdWithinSixHoursOfStart = sameDayCreated && bookingStartsAtMs - createdAtMs < PHONE_REVEAL_PRE_START_MS
  const revealUnlocked = nowTick >= unlockAtMs || createdWithinSixHoursOfStart
  const isPostCompletionPhoneLocked = ['completed', 'disputed'].includes(booking.status)
  const revealExpired = Number.isFinite(scheduledEndMs) && nowTick > scheduledEndMs + PHONE_REVEAL_POST_END_MS
  const canRevealPhoneWindow =
    ['accepted', 'confirmed', 'in_progress'].includes(booking.status) &&
    revealUnlocked &&
    !isPostCompletionPhoneLocked &&
    !revealExpired
  const clientPhone = booking.client?.user?.phone ?? ''
  const canRevealPhone = canRevealPhoneWindow && Boolean(clientPhone)
  const isCancelledPreConfirmation = booking.status === 'cancelled' && !booking.accepted_at && !booking.confirmed_at
  const isConfirmed = booking.status === 'confirmed'
  const hasAlreadyRescheduled = (booking.post_cleaner_proposals ?? 0) >= 1 && (booking.post_client_proposals ?? 0) >= 1
  const proposalContext =
    booking.proposal_context ??
    (booking.status === 'pending' ? 'pre_confirmation' : booking.status === 'accepted' || booking.status === 'confirmed' ? 'post_confirmation' : null)
  const isPostConfirmationProposal = Boolean(hasProposal && proposalContext === 'post_confirmation')
  const isAmendProposal = Boolean(hasProposal && proposalContext === 'amend_start')
  const hasOpenProposalFlow = hasProposal && ['pending', 'accepted', 'confirmed'].includes(booking.status)
  const isClientPostConfirmationProposal = isPostConfirmationProposal && booking.proposal_by === 'client'
  const isCleanerPostConfirmationProposal = isPostConfirmationProposal && booking.proposal_by === 'cleaner'
  const canPostConfirmProposeAlternative =
    isConfirmed &&
    moreThan24HoursAway &&
    !hasProposal &&
    !hasAlreadyRescheduled &&
    (booking.post_cleaner_proposals ?? 0) < 1
  const canRespondToClientPostConfirmationProposal =
    isClientPostConfirmationProposal &&
    moreThan24HoursAway
  const canRespondToClientAmendProposal =
    isAmendProposal &&
    booking.proposal_by === 'client' &&
    ['accepted', 'confirmed'].includes(booking.status)
  const canAmendStartTime =
    isConfirmed &&
    millisUntilStart > 0 &&
    millisUntilStart <= RESCHEDULE_CUTOFF_MS &&
    !hasProposal &&
    (booking.cleaner_proposals ?? 0) < 1 &&
    !((booking.cleaner_proposals ?? 0) >= 1 && (booking.client_proposals ?? 0) >= 1)
  const isPostConfirmationDecline = proposalContext === 'post_confirmation' && booking.proposal_by === 'client' && ['accepted', 'confirmed'].includes(booking.status)
  const canCancelConfirmedBooking = isConfirmed && millisUntilStart > 0
  const isAmendDateFlow =
    proposalAction === 'amend_start_time' ||
    (proposalAction === 'counter_proposal' && proposalContext === 'amend_start')
  const proposalMinDate = isAmendDateFlow ? toDateInputValueCyprus(booking.scheduled_start) : toDateInputValueCyprus(new Date())
  const proposalMaxDate = isAmendDateFlow
    ? toDateInputValueCyprus(booking.scheduled_start)
    : proposalContext === 'post_confirmation'
      ? maxAlternativeProposalDateInputValue(booking.original_scheduled_start ?? booking.scheduled_start)
      : maxPreConfirmationProposalDateInputValue()
  const canCounterClientProposal =
    isClientPostConfirmationProposal
      ? (booking.post_cleaner_proposals ?? 0) < 1
      : isAmendProposal
        ? false
        : false
  const proposalExpiresMs = booking.proposal_expires_at ? new Date(booking.proposal_expires_at).getTime() : null
  const proposalCountdownLabel = proposalExpiresMs && proposalExpiresMs > nowTick
    ? `${Math.ceil((proposalExpiresMs - nowTick) / 60_000)} min`
    : null

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <BookingStatusBadge
          status={booking.status}
          paymentStatus={booking.payment?.status}
          scheduledEnd={booking.scheduled_end}
          proposalBy={booking.proposal_by}
          showPaymentRequiredForUnpaid={false}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 space-y-4">
          {/* Job info */}
          <Card>
            <CardContent className="space-y-3 px-5 pb-5 pt-6">
              <span className="font-semibold">{resolveJobTypeTitle(booking)}</span>
              <Separator />
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <UserAvatar
                    name={clientDisplayName}
                    imageUrl={clientAvatarUrl}
                    className="h-9 w-9 shrink-0 border border-white object-cover shadow-sm"
                    textClassName="text-xs"
                    fallback="C"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Client</p>
                    <p className="truncate text-sm font-semibold text-slate-800">{clientDisplayName}</p>
                  </div>
                </div>
                <p className="flex items-center gap-2"><Calendar className="h-4 w-4" />{formatDate(booking.scheduled_start)}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{booking.duration_hours} hours</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{booking.address}, {booking.city}, {booking.postcode}</p>
                {((booking.client as any)?.idFileUrl || (booking.client as any)?.id_file_url) && (
                  <p className="text-xs font-medium text-emerald-700">Client trust badge: ID provided</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {memberSinceLabel && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Member since {memberSinceLabel}
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {completedBookingsCount} completed bookings
                  </span>
                </div>
                {booking.status === 'pending' && (
                  <p className="text-xs text-slate-500">Only approximate location details are shown before acceptance to protect client privacy.</p>
                )}
                {booking.apartment_details && (
                  <p className="text-xs text-slate-500">Apartment details: {booking.apartment_details}</p>
                )}
                {booking.access_notes && (
                  <p className="text-xs text-slate-500">Access notes: {booking.access_notes}</p>
                )}
              </div>
              {booking.special_instructions && (
                <>
                  <Separator />
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Special instructions</p>
                  <BookingInstructions value={booking.special_instructions} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Earnings */}
          <Card>
            <CardContent className="px-5 pb-5 pt-6">
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{cancellationOutcome ? 'Cleaner payout due' : earningsLabel}</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(cancellationOutcome ? cancellationOutcome.cleanerPayoutDue : booking.cleaner_payout)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isCancelledPreConfirmation
                        ? 'Informational only — this request was cancelled before confirmation.'
                        : isClosedNonPayableStatus
                          ? 'Payout is not applicable for this booking status.'
                          : `Released after the ${disputeWindowLabel()} report window from scheduled completion`}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{formatCurrency(booking.hourly_rate)}/hr</p>
                    <p>{booking.duration_hours}h</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {booking.status === 'cancelled' && (
            <CancellationPaymentBreakdown booking={booking} />
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-2 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-900">
                Client contact
              </h2>
              {isPostCompletionPhoneLocked || revealExpired ? (
                <p className="text-sm text-slate-500">Phone access is now closed for this booking.</p>
              ) : canRevealPhoneWindow ? (
                phoneRevealed ? (
                  canRevealPhone ? (
                    <p className="text-sm text-slate-600">{clientPhone}</p>
                  ) : (
                    <p className="text-sm text-slate-500">Client has not added a phone number yet.</p>
                  )
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => setPhoneRevealed(true)}
                  >
                    Reveal number
                  </Button>
                )
              ) : (
                <p className="text-sm text-slate-500">Client number becomes available 6 hours before the booking.</p>
              )}
              {booking.status === 'in_progress' && (
                <p className="text-xs text-slate-500">
                  Phone access automatically closes 30 minutes after scheduled booking end.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Next actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-col gap-2">
        {isCancelledPreConfirmation && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This booking request was cancelled by the client before confirmation.
          </p>
        )}
        {!stripeConnected && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.
          </p>
        )}
        {!isCancelledPreConfirmation && booking.status === 'pending' && hasProposal && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {isCleanerProposal
              ? `You proposed a new time (${formatDate(booking.proposed_start!)}). Waiting for client response.`
              : `Client countered with ${formatDate(booking.proposed_start!)}. Accept or decline before request expiry.`}
          </p>
        )}
        {!isCancelledPreConfirmation && isCleanerPostConfirmationProposal && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            You proposed a reschedule: {formatDate(booking.scheduled_start)} → {formatDate(booking.proposed_start!)}. Waiting for client response before the 24-hour cutoff.
          </p>
        )}
        {!isCancelledPreConfirmation && isClientPostConfirmationProposal && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Client proposed a reschedule: {formatDate(booking.scheduled_start)} → {formatDate(booking.proposed_start!)}. Accept, decline, or counter once before the 24-hour cutoff.
          </p>
        )}
        {!isCancelledPreConfirmation && isAmendProposal && booking.proposal_by === 'cleaner' && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            You requested Amend Start Time: {formatDate(booking.scheduled_start)} → {formatDate(booking.proposed_start!)}. Waiting for client response.
          </p>
        )}
        {!isCancelledPreConfirmation && canRespondToClientAmendProposal && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Client requested Amend Start Time: {formatDate(booking.scheduled_start)} → {formatDate(booking.proposed_start!)}. The other party can accept or decline this amendment request.
          </p>
        )}
        {!isCancelledPreConfirmation && hasOpenProposalFlow && proposalCountdownLabel && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Response window: {proposalCountdownLabel} remaining.
          </p>
        )}
        {!isCancelledPreConfirmation && booking.status === 'pending' && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {pendingValidityLabel}
          </p>
        )}
        {!isCancelledPreConfirmation && canAcceptPending && (
          <>
            <Button size="lg" onClick={() => handleBookingAction('accept')} loading={actionLoading === 'accept'} disabled={!stripeConnected || isCleanerProposal}>
              Accept booking
            </Button>
            {canProposeAlternative && (
              <Button
                variant="outline"
                onClick={() => {
                  setProposalDate(toDateInputValueCyprus(booking.scheduled_start))
                  setProposalTime(toTimeInputValueCyprus(booking.scheduled_start))
                  setProposalOpen(true)
                }}
                disabled={Boolean(actionLoading)}
              >
                Propose alternative time
              </Button>
            )}
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>Decline</Button>
          </>
        )}
        {!isCancelledPreConfirmation && canPostConfirmProposeAlternative && (
          <Button
            variant="outline"
            onClick={() => {
              setProposalAction('propose_alternative')
              setProposalDate(toDateInputValueCyprus(booking.scheduled_start))
              setProposalTime(toTimeInputValueCyprus(booking.scheduled_start))
              setProposalOpen(true)
            }}
            disabled={Boolean(actionLoading)}
          >
            Reschedule booking
          </Button>
        )}
        {!isCancelledPreConfirmation && canAmendStartTime && (
          <>
            <Button
              variant="outline"
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
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Small same-day adjustment only (up to +/-3 hours).
            </p>
          </>
        )}
        {!isCancelledPreConfirmation && canCancelConfirmedBooking && (
          <Button
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => setCancelBookingOpen(true)}
            disabled={Boolean(actionLoading)}
          >
            Cancel booking
          </Button>
        )}
        {!isCancelledPreConfirmation && (canRespondToClientPostConfirmationProposal || canRespondToClientAmendProposal) && (
          <>
            <Button
              size="lg"
              onClick={() => handleBookingAction('accept_proposal')}
              loading={actionLoading === 'accept_proposal'}
              disabled={!stripeConnected}
            >
              Accept proposal
            </Button>
            {canCounterClientProposal && (
              <Button
                variant="outline"
                onClick={() => {
                  const seed = booking.proposed_start ?? booking.scheduled_start
                  setProposalAction('counter_proposal')
                  setProposalDate(toDateInputValueCyprus(isAmendProposal ? booking.scheduled_start : seed))
                  setProposalTime(toTimeInputValueCyprus(seed))
                  setProposalOpen(true)
                }}
                disabled={Boolean(actionLoading)}
              >
                Counter once with another time
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => setDeclineCounterOfferOpen(true)}
              loading={actionLoading === 'decline_proposal'}
            >
              Decline proposal
            </Button>
          </>
        )}
        {!isCancelledPreConfirmation && isPending && !canProposeAlternative && !canRespondToCounter && proposeAlternativeDisabledReason && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {proposeAlternativeDisabledReason}
          </p>
        )}
        {!isCancelledPreConfirmation && isConfirmed && !hasProposal && !canPostConfirmProposeAlternative && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {hasAlreadyRescheduled
              ? 'This booking has already been rescheduled once. Further rescheduling is not available for MVP.'
              : 'Reschedule proposals can only be started more than 24 hours before the scheduled start.'}
          </p>
        )}
        {!isCancelledPreConfirmation && isConfirmed && millisUntilStart > 0 && millisUntilStart <= RESCHEDULE_CUTOFF_MS && !hasProposal && (booking.cleaner_proposals ?? 0) >= 1 && (booking.client_proposals ?? 0) < 1 && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            You have already used your single Amend Start Time request for this booking.
          </p>
        )}
        {!isCancelledPreConfirmation && isConfirmed && millisUntilStart > 0 && millisUntilStart <= RESCHEDULE_CUTOFF_MS && !hasProposal && (booking.cleaner_proposals ?? 0) >= 1 && (booking.client_proposals ?? 0) >= 1 && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Amend Start Time has already been finalised for this booking.
          </p>
        )}
        {!isCancelledPreConfirmation && canRespondToCounter && (
          <>
            <Button size="lg" onClick={() => handleBookingAction('accept_proposal')} loading={actionLoading === 'accept_proposal'} disabled={!stripeConnected}>
              Accept counter-offer
            </Button>
            <Button variant="destructive" onClick={() => setDeclineCounterOfferOpen(true)} loading={actionLoading === 'decline_proposal'}>
              Decline counter-offer
            </Button>
          </>
        )}
        {!isCancelledPreConfirmation && (booking.status === 'accepted' || booking.status === 'confirmed') && (
          <>
            <Button size="lg" onClick={() => handleAction('start')} loading={actionLoading === 'start'} disabled={!canStartJobNow}>
              Start job
            </Button>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Location access is only used when starting a booking for arrival verification and dispute protection.
            </p>
          </>
        )}
        {!isCancelledPreConfirmation && (booking.status === 'accepted' || booking.status === 'confirmed') && !canStartJobNow && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {startWindowExpired
              ? 'Start Job is unavailable more than 24 hours after scheduled end time.'
              : 'Start job unlocks 15 minutes before the scheduled time.'}
          </p>
        )}
        {!isCancelledPreConfirmation && booking.status === 'in_progress' && !canCompleteJob && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Complete Job unlocks 5 minutes before the scheduled end time. If you finish early, you can still use Report a problem for support, but early force-completion is blocked.
          </p>
        )}
        {!isCancelledPreConfirmation && canCompleteJob && (
          <Button size="lg" onClick={handleComplete} loading={actionLoading === 'complete'}>
            Complete Job
          </Button>
        )}
        {!isCancelledPreConfirmation && canReportProblem && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push(`/cleaner/report?booking=${booking.id}`)}
          >
            Report a problem
          </Button>
        )}
        {!isCancelledPreConfirmation && booking.status === 'disputed' && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This booking is currently under review.
          </p>
        )}
        {!isCancelledPreConfirmation && booking.status !== 'disputed' && !canReportProblem && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {`Report issues during the booking and up to ${disputeWindowLabel()} after scheduled completion.`}
          </p>
        )}
              </div>
            </CardContent>
          </Card>

          {showChat && currentUserId ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Messages</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Chat
                  bookingId={id}
                  currentUserId={currentUserId}
                  readOnly={chatIsReadOnly}
                  readOnlyMessage={getChatReadOnlyMessage(booking.status)}
                  autoScroll={false}
                />
              </CardContent>
            </Card>
          ) : !showChat ? (
            <p className="text-xs text-center text-muted-foreground">
              Booking chat history is unavailable for this booking.
            </p>
          ) : null}
        </div>
      </section>

      {/* Decline dialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <DialogTitle>Decline booking</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">You can decline this request freely. Strikes only apply to late cancellations after accepting a booking.</p>
          <p className="text-sm text-muted-foreground">This will close the pending request for the client.</p>
          <Button onClick={handleCancel} variant="destructive" className="w-full" loading={actionLoading === 'decline'}>
            Decline booking
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={proposalOpen}
        onClose={() => {
          if (actionLoading === 'propose_alternative' || actionLoading === 'counter_proposal' || actionLoading === 'amend_start_time') return
          setProposalOpen(false)
          setProposalDate('')
          setProposalTime('')
          setProposalTimeOptions([])
        }}
      >
        <DialogTitle>
          {proposalAction === 'propose_alternative'
            ? 'Reschedule booking'
            : proposalAction === 'amend_start_time'
              ? 'Amend Start Time'
              : 'Counter with another time'}
        </DialogTitle>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {proposalAction === 'propose_alternative'
              ? 'You can request a new date or time for this booking. The booking will only change once the other party accepts the proposal. If they decline or do not respond before the 24-hour cutoff, the original booking time will remain unchanged.'
              : proposalAction === 'amend_start_time'
                ? 'Small same-day adjustment only (up to +/-3 hours). The other party can accept or decline this amendment request.'
                : 'You can counter once. After both sides use their counter, only accept or decline is allowed.'}
          </p>
          {proposalAction === 'propose_alternative' && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Only available more than 24 hours before booking start</li>
              <li>New time must be within 14 days of the original booking date</li>
              <li>Must fit cleaner availability, booking duration, and buffer rules</li>
              <li>The other party may accept, decline, or send one counter proposal</li>
              <li>If no agreement is reached before the 24-hour cutoff, the original booking time will remain unchanged</li>
              <li>No penalty applies if a reschedule proposal is declined or expires</li>
              <li>Once a reschedule is successfully agreed, no further reschedules are allowed</li>
            </ul>
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <Label className="text-sm font-semibold text-slate-700">
              {proposalAction === 'propose_alternative' ? 'Proposed start time' : 'Counter start time'}
            </Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input
                type="date"
                value={proposalDate}
                onChange={(e) => setProposalDate(e.target.value)}
                min={proposalMinDate}
                max={proposalMaxDate || undefined}
                disabled={isAmendDateFlow}
                className="h-10 rounded-lg border-slate-200 bg-white"
              />
              <select
                value={proposalTime}
                onChange={(e) => setProposalTime(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>{proposalDate ? 'Select time' : 'Select date first'}</option>
                {proposalTimeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Only valid availability slots are shown for the selected date and duration.
            </p>
            {proposalAction === 'propose_alternative' && (
              <p className="mt-2 text-xs text-slate-600">
                If this request is declined or expires, the original booking time will remain unchanged.
              </p>
            )}
            {proposalAction === 'amend_start_time' && (
              <p className="mt-2 text-xs text-slate-600">
                Small same-day adjustment only (up to +/-3 hours).
              </p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const proposedStartIso = toIsoFromDateAndTimeInCyprus(proposalDate, proposalTime)
              if (!proposedStartIso) {
                toast.error('Select a valid date and time.')
                return
              }
              if (proposalMaxDate && proposalDate > proposalMaxDate) {
                if (proposalContext === 'post_confirmation') {
                  toast.error(`Alternative proposals must be within ${ALTERNATIVE_PROPOSAL_WINDOW_DAYS} days of the original booking date.`)
                } else {
                  toast.error(`Alternative proposals during request stage must stay within ${PLATFORM_BOOKING_WINDOW_DAYS} days from today.`)
                }
                return
              }
              if (proposalAction === 'amend_start_time') {
                const proposedMs = new Date(proposedStartIso).getTime()
                const currentMs = new Date(booking.scheduled_start).getTime()
                if (Math.abs(proposedMs - currentMs) > AMEND_MAX_SHIFT_MS) {
                  toast.error('Amend Start Time can only shift by up to 3 hours from the current scheduled start time.')
                  return
                }
              }
              handleBookingAction(proposalAction, proposedStartIso)
            }}
            disabled={!proposalDate || !proposalTime}
            loading={actionLoading === proposalAction}
          >
            {proposalAction === 'propose_alternative'
              ? 'Send reschedule proposal'
              : proposalAction === 'amend_start_time'
                ? 'Send amendment request'
                : 'Send counter-offer'}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={declineCounterOfferOpen}
        onClose={() => {
          if (actionLoading === 'decline_proposal') return
          setDeclineCounterOfferOpen(false)
        }}
      >
        <DialogTitle>{(isPostConfirmationDecline || isAmendProposal) ? 'Decline request?' : 'Decline counter-offer'}</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {(isPostConfirmationDecline || isAmendProposal)
              ? 'Declining this request will keep the original booking date and time unchanged. The booking will continue as originally scheduled unless one side later cancels.'
              : 'Are you sure you want to decline this counter-offer?'}
          </p>
          {!(isPostConfirmationDecline || isAmendProposal) && (
            <p className="text-sm text-muted-foreground">
              This will close the booking request and notify the client. This booking request will close without cancellation penalties.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDeclineCounterOfferOpen(false)}
              disabled={Boolean(actionLoading)}
            >
              Keep request
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleBookingAction('decline_proposal')}
              loading={actionLoading === 'decline_proposal'}
              disabled={Boolean(actionLoading) && actionLoading !== 'decline_proposal'}
            >
              {(isPostConfirmationDecline || isAmendProposal) ? 'Decline request' : 'Decline counter-offer'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={cancelBookingOpen}
        onClose={() => {
          if (actionLoading === 'cancel') return
          setCancelBookingOpen(false)
        }}
      >
        <DialogTitle>Cancel booking?</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to cancel this booking? This may affect your reliability record depending on timing and platform rules.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCancelBookingOpen(false)}
              disabled={Boolean(actionLoading)}
            >
              Keep booking
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancelBooking}
              loading={actionLoading === 'cancel'}
              disabled={Boolean(actionLoading) && actionLoading !== 'cancel'}
            >
              Cancel booking
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  )
}
