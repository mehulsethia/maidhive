'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, ClipboardList, Clock3, Search } from 'lucide-react'
import { availabilityApi, bookingsApi, cleanersApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { BookingInstructions } from '@/components/booking-instructions'
import { CancellationPaymentBreakdown } from '@/components/cancellation-payment-breakdown'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { UserAvatar } from '@/components/ui/user-avatar'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import {
  getCleanerProposalEligibility,
  PLATFORM_BOOKING_WINDOW_DAYS,
  RESCHEDULE_CUTOFF_HOURS,
  maxPreConfirmationProposalDateInputValue,
  toDateInputValueCyprus,
  toIsoFromDateAndTimeInCyprus,
  toTimeInputValueCyprus,
  toTimeLabelInCyprus,
  toTimeValueInCyprus,
} from '@/lib/booking-proposal'
import { compareBookingsByOperationalPriority } from '@/lib/booking-priority'
import { isBookingReportWindowActive } from '@/lib/booking-release'
import { getCleanerEarningsLabel } from '@/lib/cleaner-earnings-label'
import { getClientTrustMetadata } from '@/lib/client-trust'
import { getCleanerBookingRequestDeadlineCopy } from '@/lib/booking-expiry-copy'
import { subscribeBookingsRefresh, triggerBookingsRefresh } from '@/lib/booking-sync'
import { showJobStartedToast } from '@/lib/job-start-toast'
import { setupVisiblePolling } from '@/lib/visible-polling'
import { formatCurrency, formatDate } from '@/lib/utils'
import { hasPendingAmendmentRequest } from '@/lib/booking-amendment'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const STATUS_FILTERS: Array<{ key: 'all' | BookingStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'declined', label: 'Declined' },
]

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}
const PHONE_REVEAL_PRE_START_MS = 6 * 60 * 60 * 1000
const PHONE_REVEAL_POST_END_MS = 30 * 60 * 1000

function cyprusDateStr(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(date)
}

export default function CleanerBookingsPage() {
  const searchParams = useSearchParams()
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [stripeConnected, setStripeConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const [query, setQuery] = useState('')
  const [proposalBooking, setProposalBooking] = useState<BookingRead | null>(null)
  const [declineConfirmBooking, setDeclineConfirmBooking] = useState<BookingRead | null>(null)
  const [proposalDate, setProposalDate] = useState('')
  const [proposalTime, setProposalTime] = useState('')
  const [proposalTimeOptions, setProposalTimeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [revealedPhoneByBookingId, setRevealedPhoneByBookingId] = useState<Record<string, boolean>>({})
  const START_JOB_EARLY_WINDOW_MS = 15 * 60 * 1000
  const proposalMinDate = toDateInputValueCyprus(new Date())
  const proposalMaxDate = maxPreConfirmationProposalDateInputValue()

  function getStartJobAvailability(scheduledStart: string, scheduledEnd: string) {
    const startsAt = new Date(scheduledStart).getTime()
    const endsAt = new Date(scheduledEnd).getTime()
    if (!Number.isFinite(startsAt)) {
      return { canStart: false, reason: 'Start job is unavailable for this booking time.' }
    }
    if (!Number.isFinite(endsAt)) {
      return { canStart: false, reason: 'Start job is unavailable for this booking time.' }
    }
    const lateCutoff = endsAt + 24 * 60 * 60 * 1000
    if (Date.now() > lateCutoff) {
      return { canStart: false, reason: 'Start Job is unavailable more than 24 hours after scheduled end time.' }
    }
    const unlocksAt = startsAt - START_JOB_EARLY_WINDOW_MS
    if (Date.now() >= unlocksAt) return { canStart: true, reason: '' }
    return { canStart: false, reason: 'Start job unlocks 15 minutes before the scheduled time.' }
  }

  async function refresh() {
    try {
      try {
        const cleanerRes = await cleanersApi.me()
        const cleaner = cleanerRes.data?.cleaner as any
        setStripeConnected(Boolean(cleaner?.stripe_onboarding_complete ?? cleaner?.stripeOnboardingComplete))
      } catch {
        // no-op: page can still load bookings
      }
      const res = await bookingsApi.my()
      setBookings(res.data?.items ?? [])
      resetLoadError('cleaner-bookings')
    } catch {
      reportLoadError('cleaner-bookings', 'Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const rawStatus = String(searchParams.get('status') ?? '').trim()
    if (!rawStatus) return
    const nextFilter = STATUS_FILTERS.find((item) => item.key === rawStatus)?.key
    if (!nextFilter) return
    setFilter(nextFilter)
  }, [searchParams])

  useEffect(() => {
    return setupVisiblePolling(() => {
      refresh().catch(() => null)
    }, Number(process.env.NEXT_PUBLIC_CLEANER_BOOKINGS_LIVE_REFRESH_MS ?? 45000))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    return subscribeBookingsRefresh(() => {
      refresh().catch(() => null)
    })
  }, [])

  useEffect(() => {
    if (!proposalBooking || !proposalDate) {
      setProposalTimeOptions([])
      setProposalTime('')
      return
    }

    availabilityApi
      .getSlots(proposalBooking.cleaner_id, proposalDate, proposalBooking.duration_hours)
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
  }, [proposalBooking, proposalDate, proposalTime])

  async function action(
    id: string,
    type: 'accept' | 'decline' | 'start' | 'propose_alternative',
    customProposedStart?: string,
  ) {
    setActionLoading(`${id}-${type}`)
    try {
      await bookingsApi.action(id, type, customProposedStart)
      if (type === 'accept') toast.success('Booking accepted.')
      if (type === 'decline') toast.success('Booking request declined.')
      if (type === 'start') showJobStartedToast(id)
      if (type === 'propose_alternative') toast.success('Alternative time sent to client.')
      await refresh()
      triggerBookingsRefresh({ bookingId: id, reason: `cleaner-bookings:${type}` })
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed.')
    } finally {
      setActionLoading(null)
    }
  }

  async function submitAlternativeProposal() {
    if (!proposalBooking) return

    const proposedStartIso = toIsoFromDateAndTimeInCyprus(proposalDate, proposalTime)
    if (!proposedStartIso) {
      toast.error('Select a valid date and time.')
      return
    }

    const proposedStartDate = new Date(proposedStartIso)
    const scheduledStartDate = new Date(proposalBooking.scheduled_start)
    if (!Number.isFinite(proposedStartDate.getTime()) || !Number.isFinite(scheduledStartDate.getTime())) {
      toast.error('Unable to validate proposed time. Please try again.')
      return
    }

    const minLeadMs = Date.now() + 2 * 60 * 60 * 1000
    if (proposedStartDate.getTime() < minLeadMs) {
      toast.error('Proposed time must be at least 2 hours from now.')
      return
    }

    const cutoffMs = Date.now() + RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1000
    if (scheduledStartDate.getTime() <= cutoffMs) {
      toast.error('Alternative proposals are only allowed for bookings more than 24 hours away.')
      return
    }

    if (proposalMaxDate && proposalDate > proposalMaxDate) {
      toast.error(`Alternative proposals during request stage must stay within ${PLATFORM_BOOKING_WINDOW_DAYS} days from today.`)
      return
    }

    await action(proposalBooking.id, 'propose_alternative', proposedStartIso)
    setProposalBooking(null)
    setProposalDate('')
    setProposalTime('')
  }

  async function decline(id: string) {
    await action(id, 'decline')
  }

  async function confirmDeclineBookingRequest() {
    if (!declineConfirmBooking) return
    await decline(declineConfirmBooking.id)
    setDeclineConfirmBooking(null)
  }

  function resolveJobTypeTitle(booking: BookingRead) {
    const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
    const snapshotJobType = snapshotMatch?.[1]?.trim()
    if (snapshotJobType) return snapshotJobType
    return SERVICE_LABELS[booking.service_type] ?? booking.service_type
  }

  const filtered = useMemo(() => {
    const cleanerVisible = bookings.filter((b) => b.status !== 'draft')
    return cleanerVisible.filter((b) => {
      if (filter === 'pending' && b.status !== 'pending') return false
      if (filter !== 'all' && filter !== 'pending' && b.status !== filter) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        resolveJobTypeTitle(b).toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.postcode.toLowerCase().includes(q)
      )
    }).sort(compareBookingsByOperationalPriority)
  }, [bookings, filter, query])

  const summary = useMemo(() => {
    const cleanerVisible = bookings.filter((b) => b.status !== 'draft')
    const pending = cleanerVisible.filter((b) => b.status === 'pending').length
    const inProgress = cleanerVisible.filter((b) => b.status === 'in_progress').length
    const completed = cleanerVisible.filter((b) => b.status === 'completed' || b.status === 'disputed').length
    return { pending, inProgress, completed }
  }, [bookings])

  if (loading) return <ListPageSkeleton />

  function pendingValidityLabel(bookingStart?: string, acceptBy?: string) {
    return getCleanerBookingRequestDeadlineCopy({ accept_by: acceptBy ?? null })
  }

  return (
    <div className="space-y-6">
      {!stripeConnected && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <CardContent className="flex min-h-[102px] items-start justify-between px-5 pb-5 pt-6 sm:px-6 sm:pb-5 sm:pt-6">
            <div>
              <p className="text-xs text-slate-500">New Requests</p>
              <p className="text-2xl font-bold">{summary.pending}</p>
            </div>
            <ClipboardList className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex min-h-[102px] items-start justify-between px-5 pb-5 pt-6 sm:px-6 sm:pb-5 sm:pt-6">
            <div>
              <p className="text-xs text-slate-500">In Progress</p>
              <p className="text-2xl font-bold">{summary.inProgress}</p>
            </div>
            <Clock3 className="h-5 w-5 text-violet-600" />
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex min-h-[102px] items-start justify-between px-5 pb-5 pt-6 sm:px-6 sm:pb-5 sm:pt-6">
            <div>
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-2xl font-bold">{summary.completed}</p>
            </div>
            <CalendarCheck2 className="h-5 w-5 text-emerald-600" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 px-5 pb-5 pt-6 sm:space-y-5 sm:px-6 sm:pb-6 sm:pt-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by city, postcode, or service"
                className="pl-9"
              />
            </div>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | BookingStatus)}
              className="w-full rounded-full border-slate-300 bg-white px-4 md:w-[220px] md:shrink-0"
              aria-label="Filter bookings by status"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No bookings found"
              description={bookings.length === 0 ? 'You have not received bookings yet.' : 'Try a different search or status filter.'}
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((b) => {
                const eligibility = getCleanerProposalEligibility(b)
                const trust = getClientTrustMetadata(b.client)
                const memberSinceRaw = trust.memberSince
                const memberSinceLabel = memberSinceRaw
                  ? new Date(memberSinceRaw).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })
                  : null
                const completedBookingsCount = trust.completedBookingsCount
                const startJobState = getStartJobAvailability(b.scheduled_start, b.scheduled_end)
                const scheduledStartMs = new Date(b.scheduled_start).getTime()
                const scheduledEndMs = new Date(b.scheduled_end).getTime()
                const createdAtMs = new Date(b.created_at).getTime()
                const reportWindowActive = isBookingReportWindowActive(b.scheduled_end)
                const canReportProblem = ['in_progress', 'completed'].includes(b.status) && reportWindowActive
                const canOpenDisputeCase = b.status === 'disputed' && reportWindowActive
                const earningsLabel = getCleanerEarningsLabel({
                  status: b.status,
                  paymentStatus: b.payment?.status,
                  scheduledEnd: b.scheduled_end,
                })
                const unlockAtMs = scheduledStartMs - PHONE_REVEAL_PRE_START_MS
                const sameDayCreated =
                  Number.isFinite(createdAtMs) &&
                  Number.isFinite(scheduledStartMs) &&
                  cyprusDateStr(new Date(createdAtMs)) === cyprusDateStr(new Date(scheduledStartMs))
                const createdWithinSixHoursOfStart = sameDayCreated && scheduledStartMs - createdAtMs < PHONE_REVEAL_PRE_START_MS
                const revealUnlocked = nowTick >= unlockAtMs || createdWithinSixHoursOfStart
                const revealExpired = Number.isFinite(scheduledEndMs) && nowTick > scheduledEndMs + PHONE_REVEAL_POST_END_MS
                const isPostCompletionPhoneLocked = ['completed', 'disputed'].includes(b.status)
                const canRevealPhoneWindow =
                  ['accepted', 'confirmed', 'in_progress'].includes(b.status) &&
                  revealUnlocked &&
                  !isPostCompletionPhoneLocked &&
                  !revealExpired
                const clientPhone = b.client?.user?.phone ?? ''
                const canRevealPhone = canRevealPhoneWindow && Boolean(clientPhone)
                const phoneRevealed = Boolean(revealedPhoneByBookingId[b.id])
                const clientName = b.client?.user?.name?.trim() || 'Client'
                const clientAvatarUrl = b.client?.user?.avatar_url ?? null
                const amendmentPending = hasPendingAmendmentRequest(b)
                return (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)] sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{resolveJobTypeTitle(b)}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <UserAvatar
                          name={clientName}
                          imageUrl={clientAvatarUrl}
                          className="h-7 w-7 border border-white object-cover shadow-sm"
                          textClassName="text-[10px]"
                          fallback="C"
                        />
                        <p className="text-sm text-slate-600">Client: {clientName}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {memberSinceLabel && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            Member since {memberSinceLabel}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {completedBookingsCount} completed bookings
                        </span>
                      </div>
                      {((b.client as any)?.idFileUrl || (b.client as any)?.id_file_url) && (
                        <p className="text-xs font-medium text-emerald-700">ID provided</p>
                      )}
                      <p className="text-sm text-slate-500">{formatDate(b.scheduled_start)}</p>
                      <p className="text-sm text-slate-500">{b.address}, {b.city}, {b.postcode}</p>
                      {b.status === 'pending' && (
                        <p className="mt-1 text-xs text-slate-500">Only approximate location details are shown before acceptance to protect client privacy.</p>
                      )}
                      {b.status === 'pending' && b.proposed_start && b.proposal_by && (
                        <p className="mt-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                          {b.proposal_by === 'cleaner'
                            ? `You proposed ${formatDate(b.scheduled_start)} → ${formatDate(b.proposed_start)}. Waiting for client response.`
                            : `Client proposed ${formatDate(b.scheduled_start)} → ${formatDate(b.proposed_start)}. Review and respond before expiry.`}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <BookingStatusBadge
                        status={b.status}
                        paymentStatus={b.payment?.status}
                        scheduledEnd={b.scheduled_end}
                        proposalBy={b.proposal_by}
                        showPaymentRequiredForUnpaid={false}
                      />
                      {amendmentPending && (
                        <div className="mt-2">
                          <span className="inline-flex max-w-full rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-left text-[11px] font-semibold leading-4 text-blue-700 whitespace-normal">
                            Amendment request pending
                          </span>
                        </div>
                      )}
                      {b.status === 'cancelled' ? (
                        <div className="mt-2">
                          <CancellationPaymentBreakdown booking={b} compact />
                        </div>
                      ) : (
                        <p className="mt-2 text-sm font-semibold text-emerald-700">
                          {earningsLabel} {formatCurrency(b.cleaner_payout)}
                        </p>
                      )}
                    </div>
                  </div>

                  {b.special_instructions && (
                    <BookingInstructions value={b.special_instructions} compact />
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/cleaner/bookings/${b.id}`}
                      className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                    >
                      Details
                    </Link>

                    {b.status === 'pending' && (
                      <>
                        {eligibility.isCleanerProposal ? (
                          <Button size="sm" variant="outline" disabled>
                            Awaiting client response
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => action(b.id, 'accept')}
                            disabled={!stripeConnected}
                            loading={actionLoading === `${b.id}-accept`}
                          >
                            Accept
                          </Button>
                        )}
                        {!stripeConnected && (
                          <p className="text-xs font-medium text-amber-700">
                            Connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.
                          </p>
                        )}
                        {eligibility.canProposeAlternative && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setProposalBooking(b)
                              setProposalDate(toDateInputValueCyprus(b.scheduled_start))
                              setProposalTime(toTimeInputValueCyprus(b.scheduled_start))
                            }}
                          >
                            Propose alternative time
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeclineConfirmBooking(b)}
                          loading={actionLoading === `${b.id}-decline`}
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {(b.status === 'accepted' || b.status === 'confirmed') && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => action(b.id, 'start')}
                          loading={actionLoading === `${b.id}-start`}
                          disabled={!startJobState.canStart}
                        >
                          Start job
                        </Button>
                        <p className="text-xs text-slate-500">
                          Location access is only used when starting a booking for arrival verification and dispute protection.
                        </p>
                      </>
                    )}
                    {(b.status === 'accepted' || b.status === 'confirmed') && !startJobState.canStart && (
                      <p className="text-xs text-slate-500">{startJobState.reason}</p>
                    )}

                    {canReportProblem && (
                      <Link
                        href={`/cleaner/report?booking=${b.id}`}
                        className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                      >
                        Report a problem
                      </Link>
                    )}
                    {canOpenDisputeCase && (
                      <Link
                        href={`/cleaner/report?booking=${b.id}`}
                        className="inline-flex min-h-8 max-w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-xs font-semibold leading-snug text-amber-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-100"
                      >
                        Add information to existing case
                      </Link>
                    )}
                    {canRevealPhoneWindow && (
                      phoneRevealed ? (
                        canRevealPhone ? (
                          <span className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs text-slate-700">
                            {clientPhone}
                          </span>
                        ) : (
                          <span className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                            Client has not added a phone number yet.
                          </span>
                        )
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRevealedPhoneByBookingId((prev) => ({ ...prev, [b.id]: true }))
                          }
                        >
                          Reveal number
                        </Button>
                      )
                    )}
                    {!canRevealPhoneWindow && ['accepted', 'confirmed', 'in_progress'].includes(b.status) && (
                      <span className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                        {revealExpired || isPostCompletionPhoneLocked
                          ? 'Phone access is now closed for this booking.'
                          : 'Client number becomes available 6 hours before the booking.'}
                      </span>
                    )}
                    {b.status === 'disputed' && (
                      <span className="inline-flex h-8 items-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700">
                        This booking is currently under review.
                      </span>
                    )}
                  </div>
                  {b.status === 'pending' && !eligibility.canProposeAlternative && !eligibility.canRespondToCounter && eligibility.proposeAlternativeDisabledReason && (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      {eligibility.proposeAlternativeDisabledReason}
                    </p>
                  )}
                  {b.status === 'pending' && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                      {pendingValidityLabel(b.scheduled_start, b.accept_by)}
                    </p>
                  )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(proposalBooking)}
        onClose={() => {
          setProposalBooking(null)
          setProposalDate('')
          setProposalTime('')
        }}
      >
        <DialogTitle>Propose alternative time</DialogTitle>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can propose one alternative time for bookings scheduled more than 24 hours away, within cleaner availability and up to {PLATFORM_BOOKING_WINDOW_DAYS} days from today.
          </p>
          {proposalBooking && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Current booking time: {formatDate(proposalBooking.scheduled_start)}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <Label className="text-sm font-semibold text-slate-700">Proposed start time</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input
                type="date"
                value={proposalDate}
                onChange={(e) => setProposalDate(e.target.value)}
                min={proposalMinDate}
                max={proposalMaxDate || undefined}
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
          </div>
          <Button
            className="w-full"
            onClick={submitAlternativeProposal}
            disabled={!proposalDate || !proposalTime || !proposalBooking}
            loading={proposalBooking ? actionLoading === `${proposalBooking.id}-propose_alternative` : false}
          >
            Send proposal
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(declineConfirmBooking)}
        onClose={() => {
          if (declineConfirmBooking && actionLoading === `${declineConfirmBooking.id}-decline`) return
          setDeclineConfirmBooking(null)
        }}
      >
        <DialogTitle>Decline booking request</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to decline this booking request?
          </p>
          <p className="text-sm text-muted-foreground">
            This will close the booking request and notify the client. This booking request will close without cancellation penalties.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setDeclineConfirmBooking(null)}
              disabled={Boolean(declineConfirmBooking && actionLoading === `${declineConfirmBooking.id}-decline`)}
            >
              Keep request
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={confirmDeclineBookingRequest}
              loading={Boolean(declineConfirmBooking && actionLoading === `${declineConfirmBooking.id}-decline`)}
              disabled={!declineConfirmBooking}
            >
              Decline booking request
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
