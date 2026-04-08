'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { bookingsApi, disputesApi } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { ReportPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import type { BookingRead, ClientDispute } from '@/types'
import { toast } from 'sonner'

type ReportStatus = 'open' | 'under_review' | 'resolved' | 'closed'

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

function getDisputeBookingId(dispute: any) {
  return dispute?.booking_id ?? dispute?.bookingId ?? ''
}

function getDisputeCreatedAt(dispute: any) {
  return dispute?.created_at ?? dispute?.createdAt ?? new Date().toISOString()
}

function getDisputeResolutionNote(dispute: any) {
  return dispute?.resolution_note ?? dispute?.resolutionNote ?? ''
}

function ClientReportPageContent() {
  const searchParams = useSearchParams()
  const bookingFromQuery = searchParams.get('booking') ?? ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [disputes, setDisputes] = useState<ClientDispute[]>([])

  const [bookingId, setBookingId] = useState('')
  const [reason, setReason] = useState('')
  const [evidenceInput, setEvidenceInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all')

  async function load() {
    setLoading(true)
    try {
      const [bookingRes, disputeRes] = await Promise.all([bookingsApi.my(), disputesApi.listMine()])
      const bookItems = bookingRes.data?.items ?? []
      const eligible = bookItems.filter((b) => ['in_progress', 'completed'].includes(b.status))
      setBookings(eligible)

      const ds = (disputeRes.data?.items ?? []) as ClientDispute[]
      setDisputes(ds)

      if (bookingFromQuery && eligible.some((b) => b.id === bookingFromQuery)) {
        setBookingId(bookingFromQuery)
      } else if (!bookingId && eligible.length > 0) {
        setBookingId(eligible[0].id)
      }
    } catch {
      toast.error('Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingFromQuery])

  async function submitReport() {
    if (!bookingId) return toast.error('Select a booking.')
    if (!reason.trim()) return toast.error('Please describe the issue.')

    const evidence = evidenceInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      await disputesApi.createForBooking(bookingId, { reason: reason.trim(), evidence: evidence.length ? evidence : undefined })
      toast.success('Report submitted successfully.')
      setReason('')
      setEvidenceInput('')
      await load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit report.')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const total = disputes.length
    const pending = disputes.filter((d) => d.status === 'open').length
    const underReview = disputes.filter((d) => d.status === 'under_review').length
    const resolved = disputes.filter((d) => d.status === 'resolved' || d.status === 'closed').length
    return { total, pending, underReview, resolved }
  }, [disputes])

  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        d.reason.toLowerCase().includes(q) ||
        String((d as any)?.booking?.service_type ?? '').toLowerCase().includes(q) ||
        String(getDisputeBookingId(d)).toLowerCase().includes(q)
      )
    })
  }, [disputes, statusFilter, search])

  if (loading) return <ReportPageSkeleton />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="marketplace-title text-3xl text-slate-900">My Reports</h1>
        <p className="text-sm text-slate-500">Raise and track disputes for your bookings.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-slate-200"><CardContent className="p-4 text-center"><p className="text-3xl font-bold">{summary.total}</p><p className="text-sm text-slate-500">Total Reports</p></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4 text-center"><p className="text-3xl font-bold text-rose-600">{summary.pending}</p><p className="text-sm text-slate-500">Pending Review</p></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4 text-center"><p className="text-3xl font-bold text-amber-600">{summary.underReview}</p><p className="text-sm text-slate-500">Under Review</p></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4 text-center"><p className="text-3xl font-bold text-emerald-600">{summary.resolved}</p><p className="text-sm text-slate-500">Resolved</p></CardContent></Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-5">
          <p className="text-lg font-semibold text-slate-900">Raise a new dispute</p>
          {bookings.length === 0 ? (
            <EmptyState
              title="No eligible bookings"
              description="Only in-progress or completed bookings can be reported."
            />
          ) : (
            <>
              <div>
                <Label>Booking</Label>
                <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="mt-1">
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(b as any)?.cleaner?.user?.name ?? 'Cleaner'} · {formatDate(b.scheduled_start)} · {b.city}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Issue Description</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1"
                  rows={4}
                  placeholder="Describe what happened and how you want this resolved."
                />
              </div>

              <div>
                <Label>Evidence URLs (optional)</Label>
                <Textarea
                  value={evidenceInput}
                  onChange={(e) => setEvidenceInput(e.target.value)}
                  className="mt-1"
                  rows={3}
                  placeholder="One URL per line (screenshots/files)"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={submitReport} loading={saving}>Submit Report</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-2 md:grid-cols-[1fr_160px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports by reason or booking id"
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | ReportStatus)}>
              <option value="all">All Status</option>
              <option value="open">Pending Review</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
          </div>

          {filteredDisputes.length === 0 ? (
            <EmptyState title="No reports found" description="Submitted reports will appear here." />
          ) : (
            <div className="space-y-3">
              {filteredDisputes.map((d) => {
                const status = (d.status ?? 'open') as ReportStatus
                const booking = (d as any)?.booking
                return (
                  <article key={d.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{booking?.service_type ?? 'Service booking'}</p>
                        <p className="text-xs text-slate-500">Booking {getDisputeBookingId(d)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{d.reason}</p>
                    {getDisputeResolutionNote(d) && (
                      <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Resolution: {getDisputeResolutionNote(d)}
                      </p>
                    )}
                    <div className="mt-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(getDisputeCreatedAt(d))}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ClientReportPage() {
  return (
    <Suspense fallback={<ReportPageSkeleton />}>
      <ClientReportPageContent />
    </Suspense>
  )
}
