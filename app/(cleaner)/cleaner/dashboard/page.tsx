'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, Clock3, Euro, Star, ArrowUpRight, CalendarClock, MessageSquare } from 'lucide-react'
import { bookingsApi, cleanersApi } from '@/lib/api'
import { subscribeBookingsRefresh, triggerBookingsRefresh } from '@/lib/booking-sync'
import { compareBookingsByOperationalPriority } from '@/lib/booking-priority'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/ui/user-avatar'
import { DashboardPageSkeleton } from '@/components/page-skeletons'
import { EmptyState } from '@/components/empty-state'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus, CleanerOnboardingProgress } from '@/types'
import { deriveCleanerLifecycleStatus } from '@/lib/cleaner-status'
import { showJobStartedToast } from '@/lib/job-start-toast'
import { toast } from 'sonner'

const REQUEST_STATUSES: BookingStatus[] = ['pending']
const UPCOMING_STATUSES: BookingStatus[] = ['accepted', 'confirmed']
const ACTIVE_STATUSES: BookingStatus[] = ['in_progress']
const COMPLETED_STATUSES: BookingStatus[] = ['completed', 'disputed']

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

function resolveJobTypeTitle(booking: BookingRead) {
  const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
  const snapshotJobType = snapshotMatch?.[1]?.trim()
  if (snapshotJobType) return snapshotJobType
  return SERVICE_LABELS[booking.service_type] ?? booking.service_type
}

export default function CleanerDashboardPage() {
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [completionPct, setCompletionPct] = useState<number>(0)
  const [onboardingSteps, setOnboardingSteps] = useState<CleanerOnboardingProgress['steps'] | null>(null)
  const [lifecycleStatus, setLifecycleStatus] = useState<
    'pending_approval' | 'approved' | 'live' | 'rejected' | 'suspended'
  >('pending_approval')
  const [stripeConnected, setStripeConnected] = useState(false)
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [profileComplete, setProfileComplete] = useState(false)
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [submittingApproval, setSubmittingApproval] = useState(false)
  const [declineConfirmBooking, setDeclineConfirmBooking] = useState<BookingRead | null>(null)

  async function refresh() {
    try {
      // Call cleaners/me first — it auto-creates the cleaner profile if missing.
      // Bookings endpoint needs the cleaner row to exist, so this must complete first.
      try {
        const cleanerRes = await cleanersApi.me()
        setCompletionPct(cleanerRes.data?.onboarding?.completion_pct ?? 0)
        setOnboardingSteps(cleanerRes.data?.onboarding?.steps ?? null)
        const cleaner = cleanerRes.data?.cleaner as any
        setLifecycleStatus(
          (cleaner?.lifecycle_status as any) ??
            deriveCleanerLifecycleStatus({
              status: cleaner?.status,
              stripeOnboardingComplete: cleaner?.stripe_onboarding_complete ?? cleaner?.stripeOnboardingComplete,
              profileComplete: cleaner?.profile_complete ?? cleaner?.profileComplete,
            }),
        )
        setStripeConnected(Boolean(cleaner?.stripe_onboarding_complete ?? cleaner?.stripeOnboardingComplete))
        setRejectionReason(cleaner?.rejection_reason ?? '')
        setProfileComplete(cleaner?.profile_complete ?? false)
        setAvgRating(cleaner?.average_rating ?? null)
        resetLoadError('cleaner-dashboard-profile')
      } catch {
        reportLoadError('cleaner-dashboard-profile', 'Failed to load profile data.')
      }

      try {
        const bookingRes = await bookingsApi.my()
        setBookings(bookingRes.data?.items ?? [])
        resetLoadError('cleaner-dashboard-bookings')
      } catch {
        reportLoadError('cleaner-dashboard-bookings', 'Failed to load bookings.')
      }
    } catch {
      reportLoadError('cleaner-dashboard-root', 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const poll = setInterval(() => {
      refresh().catch(() => null)
    }, 20000)
    function onFocus() {
      refresh().catch(() => null)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    return subscribeBookingsRefresh(() => {
      refresh().catch(() => null)
    })
  }, [])

  async function handleAction(bookingId: string, action: 'accept' | 'start') {
    setActionLoading(`${bookingId}-${action}`)
    try {
      await bookingsApi.action(bookingId, action)
      if (action === 'accept') toast.success('Booking accepted.')
      if (action === 'start') showJobStartedToast(bookingId)
      await refresh()
      triggerBookingsRefresh({ bookingId, reason: `cleaner-dashboard:${action}` })
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed.')
    } finally {
      setActionLoading(null)
    }
  }

  async function declineBooking(bookingId: string) {
    setActionLoading(`${bookingId}-decline`)
    try {
      await bookingsApi.action(bookingId, 'decline')
      toast.success('Booking request declined.')
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Unable to decline booking.')
    } finally {
      setActionLoading(null)
    }
  }

  async function confirmDeclineBookingRequest() {
    if (!declineConfirmBooking) return
    await declineBooking(declineConfirmBooking.id)
    setDeclineConfirmBooking(null)
  }

  async function submitForApproval() {
    if (submittingApproval) return
    setSubmittingApproval(true)
    try {
      await cleanersApi.submitForApproval()
      toast.success('Profile submitted for approval!')
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit profile.')
    } finally {
      setSubmittingApproval(false)
    }
  }

  const stats = useMemo(() => {
    const requests = bookings.filter((b) => REQUEST_STATUSES.includes(b.status))
    const upcoming = bookings
      .filter((b) => UPCOMING_STATUSES.includes(b.status) || ACTIVE_STATUSES.includes(b.status))
      .sort(compareBookingsByOperationalPriority)
    const activeJobs = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status) || UPCOMING_STATUSES.includes(b.status))
    const completed = bookings.filter((b) => COMPLETED_STATUSES.includes(b.status))
    const prioritizedRecent = [...bookings].sort(compareBookingsByOperationalPriority)

    return {
      requests,
      upcoming,
      activeJobs,
      completed,
      prioritizedRecent,
      totalRevenue: completed.reduce((sum, b) => sum + b.cleaner_payout, 0),
    }
  }, [bookings])

  const nextUpcoming = useMemo(() => {
    if (stats.upcoming.length === 0) return null
    return stats.upcoming[0] ?? null
  }, [stats.upcoming])

  const missingOnboardingParts = useMemo(() => {
    if (!onboardingSteps) return []
    const labels: Array<[keyof CleanerOnboardingProgress['steps'], string]> = [
      ['step1_basic_details', 'Basic details'],
      ['step2_kyc', 'KYC and legal details'],
      ['step3_availability', 'Availability schedule'],
      ['step4_stripe_setup', 'Stripe step'],
      ['step5_training', 'Cleaning standards quiz'],
    ]
    return labels.filter(([key]) => !onboardingSteps[key]).map(([, label]) => label)
  }, [onboardingSteps])

  if (loading) return <DashboardPageSkeleton />

  return (
    <div className="space-y-6">
      <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
        <div className="client-stage__media" aria-hidden="true" />
        <div className="client-stage__grain" aria-hidden="true" />

        <div className="relative z-10 grid gap-3 px-5 py-4 sm:px-6 sm:py-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-6">
          <div className="animate-stage-up space-y-4">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-white/75">
              MaidHive Cleaner Hub
            </p>
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl">
              Cleaner Dashboard
            </h1>
            <p className="max-w-xl text-base text-slate-100/90 sm:text-lg">
              Track jobs, manage requests, and run your cleaner business from one focused workspace.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/cleaner/profile"
                className="inline-flex h-11 items-center rounded-full border border-white/30 bg-white/15 px-5 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/25"
              >
                Update profile
              </Link>
              <Link
                href="/cleaner/bookings?status=pending"
                className="inline-flex h-11 items-center rounded-full bg-[#f4b400] px-5 text-sm font-semibold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-[#ffca3a]"
              >
                View bookings
              </Link>
            </div>
          </div>

          <div className="animate-stage-up delay-120">
            <div className="ml-auto w-full max-w-lg rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-cyan-200/90">
                Live Snapshot
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <SnapshotStat label="Revenue" value={stats.totalRevenue > 0 ? formatCurrency(stats.totalRevenue) : '€0.00'} />
                <SnapshotStat label="Completed" value={String(stats.completed.length)} />
                <SnapshotStat label="Active" value={String(stats.activeJobs.length)} />
                <SnapshotStat label="Rating" value={avgRating ? Number(avgRating).toFixed(1) : '-'} />
              </div>

              <div className="my-3 h-px bg-white/20" />
              <p className="text-[0.66rem] uppercase tracking-[0.2em] text-white/65">Next job</p>
              {nextUpcoming ? (
                <Link
                  href={`/cleaner/bookings/${nextUpcoming.id}`}
                  className="mt-2 block rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 transition hover:-translate-y-0.5 hover:bg-white/20"
                >
                  <p className="text-base font-semibold text-white">{resolveJobTypeTitle(nextUpcoming)}</p>
                  <p className="text-sm text-white/85">{formatDate(nextUpcoming.scheduled_start)}</p>
                  <p className="text-sm text-white/75">{nextUpcoming.city}, {nextUpcoming.postcode}</p>
                </Link>
              ) : (
                <div className="mt-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5">
                  <p className="text-sm text-white/80">No upcoming jobs yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {lifecycleStatus === 'rejected' ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-900">Your profile was not approved.</p>
              {rejectionReason && (
                <p className="text-xs text-red-700 mt-1">Reason: {rejectionReason}</p>
              )}
              <p className="text-xs text-red-600 mt-1">Please update your profile and resubmit for review.</p>
            </div>
            <Link href="/cleaner/profile" className="inline-flex h-8 items-center rounded-xl bg-primary px-3 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 shrink-0">
              Update profile
            </Link>
          </div>
        </div>
      ) : lifecycleStatus === 'suspended' ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-900">Your account is suspended.</p>
          <p className="text-xs text-red-700">Contact support or admin for reactivation guidance.</p>
        </div>
      ) : lifecycleStatus === 'pending_approval' && completionPct < 100 ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">Profile incomplete ({completionPct}%). Complete these sections:</p>
              {missingOnboardingParts.length > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  {missingOnboardingParts.join(' • ')}
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-700">Complete your profile to submit it for admin approval.</p>
              )}
            </div>
            <Link href="/cleaner/profile" className="inline-flex h-8 items-center rounded-xl bg-primary px-3 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 shrink-0">
              Complete now
            </Link>
          </div>
        </div>
      ) : lifecycleStatus === 'pending_approval' && completionPct === 100 && !profileComplete ? (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900">Your profile is complete.</p>
              <p className="text-xs text-blue-700">Submit your profile for admin review to start receiving bookings.</p>
            </div>
            <Button
              size="sm"
              onClick={submitForApproval}
              loading={submittingApproval}
              className="shrink-0"
            >
              Submit for approval
            </Button>
          </div>
        </div>
      ) : lifecycleStatus === 'pending_approval' && profileComplete ? (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Profile submitted — awaiting admin approval.</p>
              <p className="text-xs text-amber-700">You'll be notified once your profile is reviewed. Once approved, you'll start receiving booking requests.</p>
            </div>
          </div>
        </div>
      ) : lifecycleStatus === 'approved' && !stripeConnected ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Approved — connect Stripe to go live. You must connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.</p>
        </div>
      ) : lifecycleStatus === 'live' ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <CircleCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-900">Live — your profile is approved and visible to clients.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">New Job Requests</CardTitle>
              <Link href="/cleaner/bookings?status=pending" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="text-sm text-slate-500">Respond quickly to increase booking conversion.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.requests.length === 0 ? (
              <EmptyState title="No new requests" description="You're all caught up for now." />
            ) : (
              stats.requests.slice(0, 4).map((b) => {
                  const trust = (b.client as any)?.trust as { memberSince?: string | null; completedBookingsCount?: number } | undefined
                  const memberSinceRaw = trust?.memberSince ?? (b.client as any)?.created_at ?? (b.client as any)?.createdAt
                  const memberSinceLabel = memberSinceRaw
                    ? new Date(memberSinceRaw).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })
                    : null
                  const completedBookingsCount = Number(trust?.completedBookingsCount ?? 0)
                  const clientName = b.client?.user?.name?.trim() || 'Client'
                  const clientAvatarUrl = b.client?.user?.avatar_url ?? null
                  const waitingForClientResponse = b.proposal_by === 'cleaner'
                  return (
                <div key={b.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{resolveJobTypeTitle(b)}</p>
                      <p className="text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
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
                    </div>
                    <BookingStatusBadge
                      status={b.status}
                      paymentStatus={b.payment?.status}
                      scheduledEnd={b.scheduled_end}
                      proposalBy={b.proposal_by}
                      showPaymentRequiredForUnpaid={false}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{b.city}, {b.postcode} · {b.duration_hours}h</p>
                  {b.special_instructions && (
                    <p className="mt-2 line-clamp-2 rounded-md bg-white px-2 py-1 text-xs text-slate-500">{b.special_instructions}</p>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(b.cleaner_payout)}</p>
                    <div className="w-full sm:w-auto sm:text-right">
                      {!stripeConnected && (
                        <p className="text-xs font-medium text-amber-700">Connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2 sm:justify-end">
                      <Link
                        href={`/cleaner/bookings/${b.id}`}
                        className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                      >
                        View details
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeclineConfirmBooking(b)}
                        loading={actionLoading === `${b.id}-decline`}
                      >
                        Decline
                      </Button>
                        {waitingForClientResponse ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                          >
                            Awaiting client response
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAction(b.id, 'accept')}
                            disabled={!stripeConnected}
                            loading={actionLoading === `${b.id}-accept`}
                          >
                            Accept
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                  )
                })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/cleaner/profile?tab=availability" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" />Update availability</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/cleaner/chats" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Open chats</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/cleaner/profile?tab=reviews" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><Star className="h-4 w-4 text-primary" />Manage reviews</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/cleaner/profile?tab=payments" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><Euro className="h-4 w-4 text-primary" />Payments &amp; payouts</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/cleaner/report" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Report a problem</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Upcoming Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming jobs yet.</p>
              ) : (
                stats.upcoming.slice(0, 3).map((b) => {
                  const hasProposal = Boolean(b.proposed_start && b.proposal_by)
                  const isActiveProposal = hasProposal && ['pending', 'accepted', 'confirmed'].includes(b.status)
                  const isAmendProposal = b.proposal_context === 'amend_start'
                  const proposalActor = b.proposal_by === 'client' ? 'Client' : 'You'
                  const proposalSummary = isAmendProposal
                    ? `${proposalActor} requested Amend Start Time: ${formatDate(b.scheduled_start)} → ${formatDate(b.proposed_start ?? b.scheduled_start)}`
                    : `${proposalActor} proposed: ${formatDate(b.scheduled_start)} → ${formatDate(b.proposed_start ?? b.scheduled_start)}`
                  return (
                    <Link key={b.id} href={`/cleaner/bookings/${b.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{resolveJobTypeTitle(b)}</p>
                        <BookingStatusBadge
                          status={b.status}
                          paymentStatus={b.payment?.status}
                          scheduledEnd={b.scheduled_end}
                          proposalBy={b.proposal_by}
                          showPaymentRequiredForUnpaid={false}
                        />
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
                      {isActiveProposal && (
                        <p className="mt-1 text-xs font-semibold text-blue-700">{proposalSummary}</p>
                      )}
                      <p className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(b.cleaner_payout)}</p>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Link href="/cleaner/bookings" className="rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10">
              Open bookings
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <EmptyState title="No bookings yet" description="Your jobs will appear here as clients book services." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {stats.prioritizedRecent.slice(0, 6).map((b) => {
                const hasProposal = Boolean(b.proposed_start && b.proposal_by)
                const isActiveProposal = hasProposal && ['pending', 'accepted', 'confirmed'].includes(b.status)
                const isAmendProposal = b.proposal_context === 'amend_start'
                const proposalActor = b.proposal_by === 'client' ? 'Client' : 'You'
                const proposalSummary = isAmendProposal
                  ? `${proposalActor} requested Amend Start Time: ${formatDate(b.scheduled_start)} → ${formatDate(b.proposed_start ?? b.scheduled_start)}`
                  : `${proposalActor} proposed: ${formatDate(b.scheduled_start)} → ${formatDate(b.proposed_start ?? b.scheduled_start)}`
                return (
                  <Link key={b.id} href={`/cleaner/bookings/${b.id}`} className="rounded-xl border border-slate-200 bg-white p-3 hover:border-primary/40 hover:shadow-sm">
                    <p className="font-medium text-slate-900">{resolveJobTypeTitle(b)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
                    <p className="mt-2 text-xs text-slate-500">{b.city}, {b.postcode}</p>
                    {isActiveProposal && (
                      <p className="mt-2 text-xs font-semibold text-blue-700">{proposalSummary}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <BookingStatusBadge
                        status={b.status}
                        paymentStatus={b.payment?.status}
                        scheduledEnd={b.scheduled_end}
                        proposalBy={b.proposal_by}
                        showPaymentRequiredForUnpaid={false}
                      />
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(b.cleaner_payout)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
          <div className="flex gap-2">
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
    </div>
  )
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2">
      <p className="text-[0.6rem] uppercase tracking-[0.08em] text-white/65 sm:text-[0.62rem]">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tracking-[-0.01em] text-white">{value}</p>
    </div>
  )
}
