'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, ClipboardList, Clock3, Search } from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCleanerProposalEligibility, RESCHEDULE_CUTOFF_HOURS, toIsoFromDateTimeLocal } from '@/lib/booking-proposal'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const STATUS_FILTERS: Array<{ key: 'all' | BookingStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'New' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

export default function CleanerBookingsPage() {
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const [query, setQuery] = useState('')
  const [proposalBooking, setProposalBooking] = useState<BookingRead | null>(null)
  const [proposedStart, setProposedStart] = useState('')

  async function refresh() {
    try {
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

  async function action(
    id: string,
    type: 'accept' | 'start' | 'propose_alternative',
    customProposedStart?: string,
  ) {
    setActionLoading(`${id}-${type}`)
    try {
      await bookingsApi.action(id, type, customProposedStart)
      if (type === 'accept') toast.success('Booking accepted.')
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

    const proposedStartIso = toIsoFromDateTimeLocal(proposedStart)
    if (!proposedStartIso) {
      toast.error('Select a valid proposed start time.')
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
    setProposedStart('')
  }

  async function decline(id: string) {
    setActionLoading(`${id}-decline`)
    try {
      await bookingsApi.cancel(id, 'Cleaner declined')
      toast.success('Booking declined.')
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Unable to decline booking.')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filter !== 'all' && b.status !== filter) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        (SERVICE_LABELS[b.service_type] ?? b.service_type).toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.postcode.toLowerCase().includes(q)
      )
    })
  }, [bookings, filter, query])

  const summary = useMemo(() => {
    const pending = bookings.filter((b) => b.status === 'pending').length
    const inProgress = bookings.filter((b) => b.status === 'in_progress').length
    const completed = bookings.filter((b) => b.status === 'completed').length
    return { pending, inProgress, completed }
  }, [bookings])

  if (loading) return <ListPageSkeleton />

  return (
    <div className="space-y-6">
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
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  filter === f.key ? 'bg-primary text-white shadow-[0_8px_16px_rgba(39,70,250,0.3)]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
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
                return (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)] sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{SERVICE_LABELS[b.service_type] ?? b.service_type}</p>
                      <p className="text-sm text-slate-500">{formatDate(b.scheduled_start)}</p>
                      <p className="text-sm text-slate-500">{b.address}, {b.city}, {b.postcode}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <BookingStatusBadge status={b.status} />
                      <p className="mt-2 text-sm font-semibold text-emerald-700">{formatCurrency(b.cleaner_payout)}</p>
                    </div>
                  </div>

                  {b.special_instructions && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{b.special_instructions}</p>
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
                        {eligibility.canProposeAlternative && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setProposalBooking(b)
                              setProposedStart('')
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
                        <Button
                          size="sm"
                          onClick={() => action(b.id, 'accept')}
                          loading={actionLoading === `${b.id}-accept`}
                        >
                          Accept
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
                  </div>
                  {b.status === 'pending' && !eligibility.canProposeAlternative && !eligibility.canRespondToCounter && eligibility.proposeAlternativeDisabledReason && (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      {eligibility.proposeAlternativeDisabledReason}
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
          setProposedStart('')
        }}
      >
        <DialogTitle>Propose alternative time</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can propose one alternative time for bookings scheduled more than 24 hours away.
          </p>
          {proposalBooking && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Current booking time: {formatDate(proposalBooking.scheduled_start)}
            </div>
          )}
          <div>
            <Label>Proposed start time</Label>
            <Input
              type="datetime-local"
              value={proposedStart}
              onChange={(e) => setProposedStart(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            className="w-full"
            onClick={submitAlternativeProposal}
            disabled={!proposedStart || !proposalBooking}
            loading={proposalBooking ? actionLoading === `${proposalBooking.id}-propose_alternative` : false}
          >
            Send proposal
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
