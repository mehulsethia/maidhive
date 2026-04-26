'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CircleCheck, Clock3, Euro, Star, ArrowUpRight, CalendarClock, MessageSquare } from 'lucide-react'
import { bookingsApi, cleanersApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardPageSkeleton } from '@/components/page-skeletons'
import { EmptyState } from '@/components/empty-state'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus, CleanerOnboardingProgress } from '@/types'
import { cleanerLifecycleLabel, deriveCleanerLifecycleStatus } from '@/lib/cleaner-status'
import { toast } from 'sonner'

const REQUEST_STATUSES: BookingStatus[] = ['pending']
const UPCOMING_STATUSES: BookingStatus[] = ['accepted', 'confirmed']
const ACTIVE_STATUSES: BookingStatus[] = ['in_progress']
const COMPLETED_STATUSES: BookingStatus[] = ['completed']

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
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
            }),
        )
        setStripeConnected(Boolean(cleaner?.stripe_onboarding_complete ?? cleaner?.stripeOnboardingComplete))
        setRejectionReason(cleaner?.rejection_reason ?? '')
        setProfileComplete(cleaner?.profile_complete ?? false)
        setAvgRating(cleaner?.average_rating ?? null)
      } catch {
        toast.error('Failed to load profile data.')
      }

      try {
        const bookingRes = await bookingsApi.my()
        setBookings(bookingRes.data?.items ?? [])
      } catch {
        toast.error('Failed to load bookings.')
      }
    } catch {
      toast.error('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAction(bookingId: string, action: 'accept' | 'start') {
    setActionLoading(`${bookingId}-${action}`)
    try {
      await bookingsApi.action(bookingId, action)
      toast.success(action === 'accept' ? 'Booking accepted.' : 'Job started.')
      await refresh()
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
    const upcoming = bookings.filter((b) => UPCOMING_STATUSES.includes(b.status))
    const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status))
    const completed = bookings.filter((b) => COMPLETED_STATUSES.includes(b.status))

    return {
      requests,
      upcoming,
      active,
      completed,
      totalRevenue: completed.reduce((sum, b) => sum + b.cleaner_payout, 0),
    }
  }, [bookings])

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <Link href="/cleaner/profile" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
            Update profile
          </Link>
          <Link href="/cleaner/bookings" className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(39,70,250,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95">
            View bookings
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
        <p className="text-xs text-slate-500">Cleaner lifecycle status</p>
        <p className="text-sm font-semibold text-slate-900">{cleanerLifecycleLabel(lifecycleStatus)}</p>
      </div>

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
              <p className="text-sm font-semibold text-blue-900">Your profile is ready!</p>
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
              <p className="text-xs text-amber-700">You'll be notified once your profile is reviewed.</p>
            </div>
          </div>
        </div>
      ) : lifecycleStatus === 'approved' && !stripeConnected ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Approved — connect Stripe to go live. You must connect Stripe to receive payouts and accept bookings.</p>
        </div>
      ) : lifecycleStatus === 'live' ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <CircleCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-900">Live — your profile is approved and visible to clients.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-4 !pt-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Revenue</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><Euro className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-4 !pt-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Jobs Completed</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.completed.length}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><CircleCheck className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-4 !pt-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Jobs</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.active.length}</p>
            </div>
            <div className="rounded-xl bg-violet-50 p-2 text-violet-600"><Clock3 className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-4 !pt-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Average Rating</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{avgRating ? Number(avgRating).toFixed(1) : '—'}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600"><Star className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">New Job Requests</CardTitle>
              <Link href="/cleaner/bookings" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
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
              stats.requests.slice(0, 4).map((b) => (
                <div key={b.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{SERVICE_LABELS[b.service_type] ?? b.service_type}</p>
                      <p className="text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
                    </div>
                    <BookingStatusBadge status={b.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{b.city}, {b.postcode} · {b.duration_hours}h</p>
                  {b.special_instructions && (
                    <p className="mt-2 line-clamp-2 rounded-md bg-white px-2 py-1 text-xs text-slate-500">{b.special_instructions}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(b.cleaner_payout)}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => declineBooking(b.id)}
                        loading={actionLoading === `${b.id}-decline`}
                      >
                        Decline
                      </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAction(b.id, 'accept')}
                          disabled={!stripeConnected}
                          loading={actionLoading === `${b.id}-accept`}
                        >
                          Accept
                      </Button>
                    </div>
                  </div>
                </div>
              ))
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
                <span className="inline-flex items-center gap-2"><Euro className="h-4 w-4 text-primary" />Payout settings</span>
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
                stats.upcoming.slice(0, 3).map((b) => (
                  <Link key={b.id} href={`/cleaner/bookings/${b.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{SERVICE_LABELS[b.service_type] ?? b.service_type}</p>
                      <BookingStatusBadge status={b.status} />
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
                    <p className="mt-1 text-sm text-emerald-700 font-semibold">{formatCurrency(b.cleaner_payout)}</p>
                  </Link>
                ))
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
              {bookings.slice(0, 6).map((b) => (
                <Link key={b.id} href={`/cleaner/bookings/${b.id}`} className="rounded-xl border border-slate-200 bg-white p-3 hover:border-primary/40 hover:shadow-sm">
                  <p className="font-medium text-slate-900">{SERVICE_LABELS[b.service_type] ?? b.service_type}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
                  <p className="mt-2 text-xs text-slate-500">{b.city}, {b.postcode}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <BookingStatusBadge status={b.status} />
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(b.cleaner_payout)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
