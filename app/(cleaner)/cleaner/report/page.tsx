'use client'

import { Suspense, useDeferredValue, useEffect, useState, startTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { CalendarDays, Search } from 'lucide-react'
import { bookingsApi, disputesApi } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { ReportPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import type { BookingRead, ClientDispute } from '@/types'
import { toast } from 'sonner'

type ReportStatus = 'open' | 'under_review' | 'resolved' | 'closed'
const CLEANER_WINDOW_MS = 24 * 60 * 60 * 1000

const ISSUE_OPTIONS = [
  { value: 'client_no_show', label: 'Client no-show' },
  { value: 'other_issue', label: 'Access issue' },
  { value: 'property_damage_safety', label: 'Safety concern' },
  { value: 'service_not_completed', label: 'Service dispute' },
] as const

const STATUS_STYLES: Record<ReportStatus, string> = {
  open: 'bg-rose-100 text-rose-700',
  under_review: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-700',
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Pending Review',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
}

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

function getDisputeBookingId(dispute: any) {
  return dispute?.booking_id ?? dispute?.bookingId ?? ''
}

function CleanerReportPageContent() {
  const searchParams = useSearchParams()
  const bookingFromQuery = searchParams.get('booking') ?? ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [disputes, setDisputes] = useState<ClientDispute[]>([])
  const [bookingId, setBookingId] = useState('')
  const [issueType, setIssueType] = useState<(typeof ISSUE_OPTIONS)[number]['value']>('other_issue')
  const [explanation, setExplanation] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all')

  async function load() {
    setLoading(true)
    try {
      const [bookingRes, disputeRes] = await Promise.all([bookingsApi.my(), disputesApi.listMine()])
      const bookingItems = bookingRes.data?.items ?? []
      const disputeItems = (disputeRes.data?.items ?? []) as ClientDispute[]
      startTransition(() => {
        setBookings(bookingItems)
        setDisputes(disputeItems)
        if (bookingFromQuery && bookingItems.some((booking) => booking.id === bookingFromQuery)) {
          setBookingId(bookingFromQuery)
        } else if (!bookingId && bookingItems.length > 0) {
          setBookingId(bookingItems[0].id)
        }
        setLoading(false)
      })
    } catch {
      toast.error('Failed to load reports.')
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [bookingFromQuery])

  const deferredBookings = useDeferredValue(bookings)
  const deferredDisputes = useDeferredValue(disputes)
  const disputeByBookingId = new Map(deferredDisputes.map((dispute) => [getDisputeBookingId(dispute), dispute]))
  const disputeBookingIds = new Set(disputeByBookingId.keys())

  const eligibleBookings = deferredBookings.filter((booking) => {
    if (disputeBookingIds.has(booking.id)) return false
    if (!['in_progress', 'completed', 'disputed'].includes(booking.status)) return false
    return Date.now() <= new Date(booking.scheduled_end).getTime() + CLEANER_WINDOW_MS
  })

  useEffect(() => {
    if (eligibleBookings.length === 0) {
      if (bookingId) setBookingId('')
      return
    }
    if (!eligibleBookings.some((booking) => booking.id === bookingId)) {
      setBookingId(eligibleBookings[0].id)
    }
  }, [eligibleBookings, bookingId])

  async function submitReport() {
    if (!bookingId) return toast.error('Select a booking.')
    if (explanation.trim().length < 20) return toast.error('Please provide at least 20 characters in your explanation.')
    setConfirmOpen(true)
  }

  async function confirmSubmitReport() {
    setConfirmOpen(false)
    setSaving(true)
    try {
      await disputesApi.createForBooking(bookingId, {
        issue_type: issueType,
        explanation: explanation.trim(),
      })
      toast.success('Report submitted. Booking is now under review and sent to admin.')
      setIssueType('other_issue')
      setExplanation('')
      await load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit report.')
    } finally {
      setSaving(false)
    }
  }

  const openCount = deferredDisputes.filter((d) => d.status === 'open').length
  const underReviewCount = deferredDisputes.filter((d) => d.status === 'under_review').length
  const doneCount = deferredDisputes.filter((d) => d.status === 'resolved' || d.status === 'closed').length
  const filteredDisputes = deferredDisputes.filter((dispute) => {
    if (statusFilter !== 'all' && dispute.status !== statusFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      dispute.reason.toLowerCase().includes(q) ||
      String(dispute.booking?.service_type ?? '').toLowerCase().includes(q) ||
      String(getDisputeBookingId(dispute)).toLowerCase().includes(q)
    )
  })

  if (loading) return <ReportPageSkeleton />

  return (
    <div className="space-y-7 md:space-y-9">
      <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] sm:p-5">
        <div className="grid w-full grid-cols-1 gap-2 sm:max-w-sm sm:grid-cols-3 sm:gap-3">
          <StatTile label="Open" value={openCount} monoFont={monoFont.className} displayFont={displayFont.className} />
          <StatTile label="Review" value={underReviewCount} monoFont={monoFont.className} displayFont={displayFont.className} />
          <StatTile label="Done" value={doneCount} monoFont={monoFont.className} displayFont={displayFont.className} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] sm:p-5">
          <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>Report a problem</h2>
          <p className="mt-1 text-sm text-slate-500">Available during the job and up to 24 hours after scheduled completion.</p>
          {eligibleBookings.length === 0 ? (
            <div className="mt-4"><EmptyState title="No bookings available to report." description="No eligible bookings right now." /></div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <Label>Booking</Label>
                <Select value={bookingId} onChange={(event) => setBookingId(event.target.value)} className="mt-1">
                  {eligibleBookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.client?.user?.name ?? 'Client'} · {formatDate(booking.scheduled_start)} · {booking.city}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Report reason</Label>
                <Select value={issueType} onChange={(event) => setIssueType(event.target.value as (typeof ISSUE_OPTIONS)[number]['value'])} className="mt-1">
                  {ISSUE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Short explanation (minimum 20 characters)</Label>
                <Textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} className="mt-1" rows={4} placeholder="Describe what happened in clear detail." />
              </div>
              <div className="flex justify-end">
                <Button onClick={submitReport} loading={saving} className="rounded-full bg-[#0d4bc9] hover:bg-[#0a3ea8]">Submit Report</Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] sm:p-5">
          <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>Report history</h2>
          <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_170px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by reason or booking id" className="h-11 rounded-full border-slate-300 pl-9" />
            </div>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ReportStatus)}>
              <option value="all">All Status</option>
              <option value="open">Pending Review</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
          {filteredDisputes.length === 0 ? (
            <div className="mt-4"><EmptyState title="No reports found" description="Submitted reports will appear here." /></div>
          ) : (
            <div className="mt-4 space-y-3">
              {filteredDisputes.map((dispute) => {
                const status = (dispute.status ?? 'open') as ReportStatus
                return (
                  <article key={dispute.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className={`${displayFont.className} text-base font-semibold tracking-[-0.01em] text-slate-900`}>
                          {dispute.booking?.service_type ?? 'Service booking'}
                        </p>
                        <p className={`${monoFont.className} text-[0.68rem] tracking-wide text-slate-500`}>
                          Booking {getDisputeBookingId(dispute)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{dispute.explanation ?? dispute.reason}</p>
                    <div className="mt-2 text-xs text-slate-500 inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(dispute.created_at)}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Report Submission</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Submitting false or misleading reports may result in account penalties or suspension.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmSubmitReport} loading={saving}>Confirm Report</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function StatTile({
  label,
  value,
  monoFont,
  displayFont,
}: {
  label: string
  value: number
  monoFont: string
  displayFont: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900">
      <p className={`${monoFont} text-[0.6rem] uppercase tracking-[0.18em] text-slate-500`}>{label}</p>
      <p className={`${displayFont} mt-1 text-xl font-bold tracking-[-0.02em]`}>{value}</p>
    </div>
  )
}

export default function CleanerReportPage() {
  return (
    <Suspense fallback={<ReportPageSkeleton />}>
      <CleanerReportPageContent />
    </Suspense>
  )
}
