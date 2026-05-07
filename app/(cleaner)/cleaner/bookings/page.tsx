'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, ClipboardList, Clock3, Search } from 'lucide-react'
import { availabilityApi, bookingsApi, cleanersApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { BookingInstructions } from '@/components/booking-instructions'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getCleanerProposalEligibility,
  RESCHEDULE_CUTOFF_HOURS,
  toDateInputValue,
  toIsoFromDateAndTimeLocal,
  toTimeInputValue,
} from '@/lib/booking-proposal'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

export default function CleanerBookingsPage() {
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [stripeConnected, setStripeConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [proposalBooking, setProposalBooking] = useState<BookingRead | null>(null)
  const [proposalDate, setProposalDate] = useState('')
  const [proposalTime, setProposalTime] = useState('')
  const [proposalTimeOptions, setProposalTimeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [, setNowTick] = useState(() => Date.now())

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
    } catch {
      toast.error('Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(timer)
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
            const value = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
            const label = start.toLocaleTimeString('en-IE', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
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
      if (type === 'start') toast.success('Job started.')
      if (type === 'propose_alternative') toast.success('Alternative time sent to client.')
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed.')
    } finally {
      setActionLoading(null)
    }
  }

  async function submitAlternativeProposal() {
    if (!proposalBooking) return

    const proposedStartIso = toIsoFromDateAndTimeLocal(proposalDate, proposalTime)
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

    await action(proposalBooking.id, 'propose_alternative', proposedStartIso)
    setProposalBooking(null)
    setProposalDate('')
    setProposalTime('')
  }

  async function decline(id: string) {
    await action(id, 'decline')
  }

  function resolveJobTypeTitle(booking: BookingRead) {
    const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
    const snapshotJobType = snapshotMatch?.[1]?.trim()
    if (snapshotJobType) return snapshotJobType
    return SERVICE_LABELS[booking.service_type] ?? booking.service_type
  }

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== 'completed') return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        resolveJobTypeTitle(b).toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.postcode.toLowerCase().includes(q)
      )
    })
  }, [bookings, query])

  const summary = useMemo(() => {
    const pending = 0
    const inProgress = 0
    const completed = bookings.filter((b) => b.status === 'completed').length
    return { pending, inProgress, completed }
  }, [bookings])

  if (loading) return <ListPageSkeleton />

  function pendingExpiryLabel(acceptBy?: string) {
    if (!acceptBy) return 'This request expires soon.'
    const ms = new Date(acceptBy).getTime() - Date.now()
    if (ms <= 0) return 'This request has expired.'
    const hours = ms / (60 * 60 * 1000)
    if (hours >= 1) return `This request expires in ${Math.ceil(hours)} hour${Math.ceil(hours) === 1 ? '' : 's'}.`
    const mins = Math.max(1, Math.ceil(ms / (60 * 1000)))
    return `This request expires in ${mins} minute${mins === 1 ? '' : 's'}.`
  }

  return (
    <div className="space-y-6">
      {!stripeConnected && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Connect Stripe to accept bookings and receive payouts. Go to: Profile → Payments to complete setup.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by city, postcode, or service"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-[0_8px_16px_rgba(39,70,250,0.3)]">
              Completed
            </span>
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
                const trust = (b.client as any)?.trust as { memberSince?: string | null; completedBookingsCount?: number } | undefined
                const memberSinceRaw = trust?.memberSince ?? (b.client as any)?.created_at ?? (b.client as any)?.createdAt
                const memberSinceLabel = memberSinceRaw
                  ? new Date(memberSinceRaw).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })
                  : null
                const completedBookingsCount = Number(trust?.completedBookingsCount ?? 0)
                return (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)] sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{resolveJobTypeTitle(b)}</p>
                      <p className="text-sm text-slate-600">Client: {b.client?.user?.name ?? 'Client'}</p>
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
                        <p className="mt-1 text-xs text-slate-500">Approximate map location shown with 50-100m privacy offset until acceptance.</p>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <BookingStatusBadge status={b.status} />
                      <p className="mt-2 text-sm font-semibold text-emerald-700">You will earn {formatCurrency(b.cleaner_payout)}</p>
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
                        <Button
                          size="sm"
                          onClick={() => action(b.id, 'accept')}
                          disabled={!stripeConnected}
                          loading={actionLoading === `${b.id}-accept`}
                        >
                          Accept
                        </Button>
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
                              setProposalDate(toDateInputValue(b.scheduled_start))
                              setProposalTime(toTimeInputValue(b.scheduled_start))
                            }}
                          >
                            Propose alternative time
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decline(b.id)}
                          loading={actionLoading === `${b.id}-decline`}
                        >
                          Decline
                        </Button>
                      </>
                    )}

                    {(b.status === 'accepted' || b.status === 'confirmed') && (
                      <Button
                        size="sm"
                        onClick={() => action(b.id, 'start')}
                        loading={actionLoading === `${b.id}-start`}
                      >
                        Start job
                      </Button>
                    )}

                    {b.status === 'in_progress' && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        Waiting for client completion
                      </span>
                    )}
                    {['in_progress', 'completed', 'disputed'].includes(b.status) && (
                      <Link
                        href={`/cleaner/bookings/${b.id}`}
                        className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                      >
                        Report a problem
                      </Link>
                    )}
                  </div>
                  {b.status === 'pending' && !eligibility.canProposeAlternative && !eligibility.canRespondToCounter && eligibility.proposeAlternativeDisabledReason && (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      {eligibility.proposeAlternativeDisabledReason}
                    </p>
                  )}
                  {b.status === 'pending' && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                      {pendingExpiryLabel(b.accept_by)} This request is valid for 24 hours. If not accepted, it will expire automatically and your card authorisation will be released.
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
            You can propose one alternative time for bookings scheduled more than 24 hours away.
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
    </div>
  )
}
