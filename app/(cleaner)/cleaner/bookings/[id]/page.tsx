'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, MapPin, ArrowLeft } from 'lucide-react'
import { authApi, availabilityApi, bookingsApi, cleanersApi, disputesApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { BookingInstructions } from '@/components/booking-instructions'
import { Chat } from '@/components/chat'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  ALTERNATIVE_PROPOSAL_WINDOW_DAYS,
  getCleanerProposalEligibility,
  maxAlternativeProposalDateInputValue,
  toDateInputValueCyprus,
  toIsoFromDateAndTimeInCyprus,
  toTimeInputValueCyprus,
  toTimeLabelInCyprus,
  toTimeValueInCyprus,
} from '@/lib/booking-proposal'
import { isChatActiveForBooking, isChatReadOnly } from '@/lib/chat-window'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}
const START_JOB_EARLY_WINDOW_MS = 15 * 60 * 1000

function resolveJobTypeTitle(booking: BookingRead) {
  const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
  const snapshotJobType = snapshotMatch?.[1]?.trim()
  if (snapshotJobType) return snapshotJobType
  return SERVICE_LABELS[booking.service_type] ?? booking.service_type
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
  const [declineCounterOfferOpen, setDeclineCounterOfferOpen] = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [proposalDate, setProposalDate] = useState('')
  const [proposalTime, setProposalTime] = useState('')
  const [proposalTimeOptions, setProposalTimeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [reportIssueType, setReportIssueType] = useState<'client_no_show' | 'service_not_completed' | 'property_damage_safety' | 'other_issue'>('other_issue')
  const [reportExplanation, setReportExplanation] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [phoneRevealed, setPhoneRevealed] = useState(false)
  const [, setNowTick] = useState(() => Date.now())
  const proposalMinDate = toDateInputValueCyprus(new Date())
  const proposalMaxDate = booking ? maxAlternativeProposalDateInputValue(booking.scheduled_start) : ''

  const refresh = () =>
    bookingsApi.getById(id)
      .then(r => setBooking(r.data ?? null))
      .catch(() => toast.error('Failed to load booking'))
      .finally(() => setLoading(false))

  useEffect(() => {
    refresh()
    Promise.all([createClient().auth.getUser(), authApi.me().catch(() => null)]).then(([userRes, meRes]) => {
      setCurrentUserId(userRes.data.user?.id ?? meRes?.data?.id ?? null)
    })
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
    setPhoneRevealed(false)
  }, [booking?.id, booking?.status, booking?.client?.user?.phone])

  useEffect(() => {
    if (!booking || !proposalDate || !proposalOpen) {
      setProposalTimeOptions([])
      return
    }

    availabilityApi
      .getSlots(booking.cleaner_id, proposalDate, booking.duration_hours)
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
      toast.success('Job started!')
      await refresh()
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

  async function handleBookingAction(
    action: 'accept' | 'propose_alternative' | 'accept_proposal' | 'decline_proposal',
    customProposedStart?: string,
  ) {
    setActionLoading(action)
    try {
      await bookingsApi.action(id, action, customProposedStart)
      const labels: Record<string, string> = {
        accept: 'Booking accepted.',
        propose_alternative: 'Alternative time sent to client.',
        accept_proposal: 'Counter-offer accepted. Booking confirmed.',
        decline_proposal: 'Counter-offer declined. Request closed.',
      }
      toast.success(labels[action])
      if (action === 'propose_alternative') {
        setProposalOpen(false)
        setProposalDate('')
        setProposalTime('')
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

  async function handleReportProblem() {
    if (!booking) return
    if (reportExplanation.trim().length < 20) {
      toast.error('Please provide at least 20 characters in your explanation.')
      return
    }
    setReportLoading(true)
    try {
      await disputesApi.createForBooking(booking.id, {
        issue_type: reportIssueType,
        explanation: reportExplanation.trim(),
      })
      toast.success('Report submitted. This booking is now under review.')
      setReportOpen(false)
      setReportExplanation('')
      setReportIssueType('other_issue')
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit report.')
    } finally {
      setReportLoading(false)
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

  const showChat = isChatActiveForBooking(booking)
  const chatIsReadOnly = isChatReadOnly(booking.scheduled_end)
  const pendingValidityLabel = (() => {
    if (!booking.accept_by) {
      return 'This request expires 24 hours after card authorisation. If the cleaner does not respond, the booking request will expire automatically and your card authorisation will be released.'
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
  })()
  const completeOpensAt = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime() - 5 * 60 * 1000
    : Infinity
  const canCompleteJob = ['in_progress', 'disputed'].includes(booking.status) &&
    Boolean(booking.started_at) &&
    Date.now() >= completeOpensAt
  const bookingStartsAtMs = new Date(booking.scheduled_start).getTime()
  const canStartJobNow = Number.isFinite(bookingStartsAtMs) && Date.now() >= bookingStartsAtMs - START_JOB_EARLY_WINDOW_MS
  const cleanerReportWindowEndsAtMs = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime() + 24 * 60 * 60 * 1000
    : 0
  const canReportProblem = ['in_progress', 'completed', 'disputed'].includes(booking.status) &&
    Date.now() <= cleanerReportWindowEndsAtMs
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
  const cleanerPrivacy = (booking as any)?.cleanerPrivacy as {
    phoneVisible?: boolean
    phoneVisibleAt?: string | null
  } | undefined
  const canRevealPhone = ['confirmed', 'in_progress', 'completed', 'disputed'].includes(booking.status) && Boolean(cleanerPrivacy?.phoneVisible)
  const clientPhone = booking.client?.user?.phone ?? ''
  const isCancelledPreConfirmation = booking.status === 'cancelled' && !booking.accepted_at && !booking.confirmed_at

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <BookingStatusBadge status={booking.status} proposalBy={booking.proposal_by} showPaymentRequiredForUnpaid={false} />
      </div>

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
            {canRevealPhone ? (
              phoneRevealed ? (
                <p className="text-xs text-slate-500">Phone: {clientPhone}</p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-fit px-3 text-xs"
                  onClick={() => setPhoneRevealed(true)}
                >
                  Reveal number
                </Button>
              )
            ) : (
              <p className="text-xs text-slate-500">
                Client phone can be revealed only inside confirmed bookings.
                {cleanerPrivacy?.phoneVisibleAt ? ` Available from ${formatDate(cleanerPrivacy.phoneVisibleAt)}.` : ''}
              </p>
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">You will earn</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(booking.cleaner_payout)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCancelledPreConfirmation ? 'Informational only — this request was cancelled before confirmation.' : 'Released 24h after job completion'}
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

      {/* Actions */}
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
        {!isCancelledPreConfirmation && isPending && !canProposeAlternative && !canRespondToCounter && proposeAlternativeDisabledReason && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {proposeAlternativeDisabledReason}
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
          <Button size="lg" onClick={() => handleAction('start')} loading={actionLoading === 'start'} disabled={!canStartJobNow}>
            Start job
          </Button>
        )}
        {!isCancelledPreConfirmation && (booking.status === 'accepted' || booking.status === 'confirmed') && !canStartJobNow && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Start job unlocks 15 minutes before the scheduled time.
          </p>
        )}
        {!isCancelledPreConfirmation && booking.status === 'in_progress' && !canCompleteJob && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Complete Job unlocks 5 minutes before the scheduled end time.
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
            onClick={() => setReportOpen(true)}
            disabled={reportLoading}
          >
            Report a problem
          </Button>
        )}
        {!isCancelledPreConfirmation && !canReportProblem && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Report a problem is available during the job and up to 24 hours after scheduled completion.
          </p>
        )}
      </div>

      {/* Chat */}
      {showChat && currentUserId ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Messages</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Chat
            bookingId={id}
            currentUserId={currentUserId}
            readOnly={chatIsReadOnly}
            readOnlyMessage="Chat closes 30 minutes after the scheduled end time."
            autoScroll={false}
          />
        </CardContent>
      </Card>
      ) : !showChat ? (
        <p className="text-xs text-center text-muted-foreground">
          Chat is available for confirmed bookings and closes 30 minutes after scheduled end.
        </p>
      ) : null}

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

      <Dialog open={proposalOpen} onClose={() => setProposalOpen(false)}>
        <DialogTitle>Propose alternative time</DialogTitle>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can propose one alternative time for bookings scheduled more than 24 hours away, within the booking window, and up to {ALTERNATIVE_PROPOSAL_WINDOW_DAYS} days after the original booking date.
          </p>
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
            onClick={() => {
              const proposedStartIso = toIsoFromDateAndTimeInCyprus(proposalDate, proposalTime)
              if (!proposedStartIso) {
                toast.error('Select a valid date and time.')
                return
              }
              if (proposalMaxDate && proposalDate > proposalMaxDate) {
                toast.error(`Alternative proposals must be within ${ALTERNATIVE_PROPOSAL_WINDOW_DAYS} days of the original booking date.`)
                return
              }
              handleBookingAction('propose_alternative', proposedStartIso)
            }}
            disabled={!proposalDate || !proposalTime}
            loading={actionLoading === 'propose_alternative'}
          >
            Send proposal
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
        <DialogTitle>Decline counter-offer</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to decline this counter-offer?
          </p>
          <p className="text-sm text-muted-foreground">
            This will close the booking request and notify the client. This booking request will close without cancellation penalties.
          </p>
          <div className="flex gap-2">
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
              Decline counter-offer
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={reportOpen}
        onClose={() => {
          setReportOpen(false)
          setReportExplanation('')
          setReportIssueType('other_issue')
        }}
      >
        <DialogTitle>Report a problem</DialogTitle>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Available during the booking and up to 24 hours after scheduled completion.
          </p>
          <div>
            <Label>Issue type</Label>
            <Select
              value={reportIssueType}
              onChange={(event) =>
                setReportIssueType(
                  event.target.value as 'client_no_show' | 'service_not_completed' | 'property_damage_safety' | 'other_issue',
                )
              }
              className="mt-1"
            >
              <option value="client_no_show">Client no-show</option>
              <option value="service_not_completed">Service not completed as expected</option>
              <option value="property_damage_safety">Property damage or safety issue</option>
              <option value="other_issue">Other issue</option>
            </Select>
          </div>
          <div>
            <Label>Explanation</Label>
            <Textarea
              value={reportExplanation}
              onChange={(event) => setReportExplanation(event.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Describe what happened (minimum 20 characters)."
            />
          </div>
          <Button
            className="w-full"
            onClick={handleReportProblem}
            loading={reportLoading}
            disabled={reportExplanation.trim().length < 20}
          >
            Submit report
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
