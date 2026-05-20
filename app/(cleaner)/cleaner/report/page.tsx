'use client'

import { Suspense, useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'
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
import { CLEANER_DISPUTE_ISSUES } from '@/lib/dispute-issues'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatDate } from '@/lib/utils'
import type { BookingRead, ClientDispute } from '@/types'
import { toast } from 'sonner'

type ReportStatus = 'open' | 'under_review' | 'resolved' | 'closed'
type ReportDashboardFilter = 'open' | 'under_review' | 'resolved'
const CLEANER_WINDOW_MS = 24 * 60 * 60 * 1000
const NO_SHOW_DELAY_MS = 30 * 60 * 1000
const MAX_EVIDENCE_IMAGES = 5
const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024
const REPORT_AVAILABILITY_COPY = 'Report issues during the booking and up to 24 hours after scheduled completion.'

const STATUS_STYLES: Record<ReportStatus, string> = {
  open: 'bg-rose-100 text-rose-700',
  under_review: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-700',
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Resolved',
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
  const [issueType, setIssueType] = useState<(typeof CLEANER_DISPUTE_ISSUES)[number]['value']>('access_issue')
  const [explanation, setExplanation] = useState('')
  const [evidenceInput, setEvidenceInput] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all')
  const [dashboardFilter, setDashboardFilter] = useState<ReportDashboardFilter | null>(null)

  function isActiveDisputeStatus(status?: string | null) {
    return status === 'open' || status === 'under_review'
  }

  function addEvidenceFiles(filesToAdd: File[]) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
    const next = [...evidenceFiles]
    for (const file of filesToAdd) {
      if (!allowed.has(file.type)) {
        toast.error('Only JPG, PNG, and HEIC images are supported.')
        continue
      }
      if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
        toast.error(`${file.name} is over 10MB.`)
        continue
      }
      if (next.length >= MAX_EVIDENCE_IMAGES) {
        toast.error(`You can upload up to ${MAX_EVIDENCE_IMAGES} images.`)
        break
      }
      next.push(file)
    }
    setEvidenceFiles(next)
  }

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
      resetLoadError('cleaner-report')
    } catch {
      reportLoadError('cleaner-report', 'Failed to load reports.')
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [bookingFromQuery])

  const deferredBookings = useDeferredValue(bookings)
  const deferredDisputes = useDeferredValue(disputes)
  const evidencePreviews = useMemo(
    () =>
      evidenceFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [evidenceFiles],
  )

  useEffect(() => {
    return () => {
      for (const preview of evidencePreviews) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [evidencePreviews])
  const disputeByBookingId = new Map(deferredDisputes.map((dispute) => [getDisputeBookingId(dispute), dispute]))
  const queryBookingDisputeStatus = bookingFromQuery ? disputeByBookingId.get(bookingFromQuery)?.status : undefined

  const eligibleBookings = deferredBookings.filter((booking) => {
    const dispute = disputeByBookingId.get(booking.id)
    if (dispute && isActiveDisputeStatus(dispute.status)) return false
    if (!['confirmed', 'in_progress', 'completed', 'disputed'].includes(booking.status)) return false
    return Date.now() <= new Date(booking.scheduled_end).getTime() + CLEANER_WINDOW_MS
  })

  const bookingOptions = (() => {
    const map = new Map(eligibleBookings.map((booking) => [booking.id, booking]))
    if (bookingFromQuery) {
      const queryBooking = deferredBookings.find((booking) => booking.id === bookingFromQuery)
      if (queryBooking) map.set(queryBooking.id, queryBooking)
    }
    return Array.from(map.values())
  })()

  useEffect(() => {
    if (bookingOptions.length === 0) {
      if (bookingId) setBookingId('')
      return
    }
    if (!bookingOptions.some((booking) => booking.id === bookingId)) {
      setBookingId(bookingOptions[0].id)
    }
  }, [bookingOptions, bookingId])

  const selectedBooking = bookingOptions.find((booking) => booking.id === bookingId)
  const canUseClientNoShowOption = selectedBooking
    ? Date.now() >= new Date(selectedBooking.scheduled_start).getTime() + NO_SHOW_DELAY_MS
    : false

  useEffect(() => {
    if (!canUseClientNoShowOption && issueType === 'client_no_show') {
      setIssueType('access_issue')
    }
  }, [canUseClientNoShowOption, issueType])

  async function submitReport() {
    if (!bookingId) return toast.error('Select a booking.')
    const activeDispute = disputeByBookingId.get(bookingId)
    if (activeDispute && isActiveDisputeStatus(activeDispute.status)) {
      return toast.error('This booking is currently under review.')
    }
    if (!eligibleBookings.some((booking) => booking.id === bookingId)) {
      return toast.error('This booking cannot be reported right now.')
    }
    if (!selectedBooking) return toast.error('Invalid booking selection.')
    if (issueType === 'client_no_show') {
      const canReportNoShowAt = new Date(selectedBooking.scheduled_start).getTime() + NO_SHOW_DELAY_MS
      if (Date.now() < canReportNoShowAt) {
        return toast.error('Client no-show can be reported 30 minutes after the scheduled start time.')
      }
    }
    if (explanation.trim().length < 20) return toast.error('Please provide at least 20 characters in your explanation.')
    setConfirmOpen(true)
  }

  async function confirmSubmitReport() {
    setConfirmOpen(false)
    const evidence = evidenceInput
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)
    const uploadedUrls: string[] = []
    if (evidenceFiles.length > 0) {
      setUploadingEvidence(true)
      try {
        for (const file of evidenceFiles) {
          const form = new FormData()
          form.append('file', file)
          const res = await fetch('/api/v1/upload/dispute-evidence', {
            method: 'POST',
            body: form,
          })
          const json = await res.json().catch(() => null)
          if (!res.ok || !json?.success || !json?.data?.url) {
            throw new Error(json?.message ?? `Failed to upload ${file.name}`)
          }
          uploadedUrls.push(json.data.url)
        }
      } catch (err: any) {
        setUploadingEvidence(false)
        return toast.error(err.message ?? 'Failed to upload evidence')
      } finally {
        setUploadingEvidence(false)
      }
    }

    setSaving(true)
    try {
      await disputesApi.createForBooking(bookingId, {
        issue_type: issueType,
        explanation: explanation.trim(),
        evidence: [...evidence, ...uploadedUrls].length ? [...evidence, ...uploadedUrls] : undefined,
      })
      toast.success('Report submitted. Booking is now under review and sent to admin.')
      setIssueType('access_issue')
      setExplanation('')
      setEvidenceInput('')
      setEvidenceFiles([])
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
    if (dashboardFilter === 'open' && dispute.status !== 'open') return false
    if (dashboardFilter === 'under_review' && dispute.status !== 'under_review') return false
    if (dashboardFilter === 'resolved' && dispute.status !== 'resolved' && dispute.status !== 'closed') return false
    if (
      statusFilter !== 'all' &&
      !(statusFilter === 'resolved' ? dispute.status === 'resolved' || dispute.status === 'closed' : dispute.status === statusFilter)
    ) return false
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
    <>
    <div className="client-report-revamp space-y-7 md:space-y-9">
      <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
        <div className="client-stage__media" aria-hidden="true" />
        <div className="client-stage__grain" aria-hidden="true" />
        <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
          <div className="animate-stage-up space-y-4">
            <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
              MaidHive Resolution Desk
            </p>
            <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
              Reports &amp; Disputes
            </h1>
            <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
              Report no-shows, access problems, safety concerns, and disputes for admin review.
            </p>
          </div>

          <div className="animate-stage-up delay-120">
            <div className="ml-auto grid w-full max-w-sm grid-cols-1 gap-2 rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm sm:grid-cols-3">
              <StatTile label="Open" value={openCount} monoFont={monoFont.className} displayFont={displayFont.className} active={dashboardFilter === 'open'} onClick={() => { setDashboardFilter('open'); setStatusFilter('all') }} />
              <StatTile label="Review" value={underReviewCount} monoFont={monoFont.className} displayFont={displayFont.className} active={dashboardFilter === 'under_review'} onClick={() => { setDashboardFilter('under_review'); setStatusFilter('all') }} />
              <StatTile label="Resolved" value={doneCount} monoFont={monoFont.className} displayFont={displayFont.className} active={dashboardFilter === 'resolved'} onClick={() => { setDashboardFilter('resolved'); setStatusFilter('all') }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] sm:p-5">
          <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>Report a problem</h2>
          <p className="mt-1 text-sm text-slate-500">{REPORT_AVAILABILITY_COPY}</p>
          {isActiveDisputeStatus(queryBookingDisputeStatus) && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              This booking is currently under review by MaidHive.
            </p>
          )}
          {bookingOptions.length === 0 ? (
            <div className="mt-4"><EmptyState title="No bookings available to report." description="No eligible bookings right now." /></div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <Label>Booking</Label>
                <Select value={bookingId} onChange={(event) => setBookingId(event.target.value)} className="mt-1">
                  {bookingOptions.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.client?.user?.name ?? 'Client'} · {formatDate(booking.scheduled_start)} · {booking.city}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Report reason</Label>
                <Select value={issueType} onChange={(event) => setIssueType(event.target.value as (typeof CLEANER_DISPUTE_ISSUES)[number]['value'])} className="mt-1">
                  {CLEANER_DISPUTE_ISSUES.filter((option) =>
                    option.value === 'client_no_show' ? canUseClientNoShowOption : true,
                  ).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                {!canUseClientNoShowOption && (
                  <p className="mt-1 text-xs text-slate-500">
                    “Client no-show” becomes available 30 minutes after scheduled start.
                  </p>
                )}
              </div>
              <div>
                <Label>Short explanation (minimum 20 characters)</Label>
                <Textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} className="mt-1" rows={4} placeholder="Describe what happened in clear detail." />
                <p className="mt-1 text-xs text-slate-500">{explanation.trim().length}/20 minimum</p>
              </div>
              <div>
                <Label>Upload evidence (optional photos/screenshots)</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/heif"
                  multiple
                  onChange={(event) => {
                    addEvidenceFiles(Array.from(event.target.files ?? []))
                    event.currentTarget.value = ''
                  }}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-slate-500">Photos/screenshots help admin review disputes faster.</p>
                {evidenceFiles.length > 0 && (
                  <>
                    <p className="mt-1 text-xs text-slate-500">{evidenceFiles.length} of {MAX_EVIDENCE_IMAGES} image(s) selected</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {evidencePreviews.map((preview, index) => (
                        <div key={`${preview.file.name}-${index}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                          <img src={preview.url} alt={preview.file.name} className="h-24 w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEvidenceFiles((prev) => prev.filter((_, i) => i !== index))}
                            className="absolute right-1 top-1 rounded bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div>
                <Label>Additional evidence links (optional)</Label>
                <Textarea
                  value={evidenceInput}
                  onChange={(event) => setEvidenceInput(event.target.value)}
                  className="mt-1"
                  rows={3}
                  placeholder="Paste links to videos, screenshots, or files"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={submitReport} loading={saving || uploadingEvidence} className="rounded-full bg-[#0d4bc9] hover:bg-[#0a3ea8]">Submit Report</Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] sm:p-5">
          <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>Report history</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by reason or booking id" className="h-11 rounded-full border-slate-300 pl-9" />
            </div>
            <Select value={statusFilter} onChange={(event) => { setDashboardFilter(null); setStatusFilter(event.target.value as 'all' | ReportStatus) }}>
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
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
            <Button onClick={confirmSubmitReport} loading={saving || uploadingEvidence}>Confirm Report</Button>
          </div>
        </div>
      </Dialog>
    </div>

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

function StatTile({
  label,
  value,
  monoFont,
  displayFont,
  active = false,
  onClick,
}: {
  label: string
  value: number
  monoFont: string
  displayFont: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left text-white transition ${
        active
          ? 'border-white/40 bg-white/20'
          : 'border-white/25 bg-white/10 hover:border-white/35 hover:bg-white/15'
      }`}
    >
      <p className={`${monoFont} text-[0.6rem] uppercase tracking-[0.18em] text-white/70`}>{label}</p>
      <p className={`${displayFont} mt-1 text-xl font-bold tracking-[-0.02em]`}>{value}</p>
    </button>
  )
}

export default function CleanerReportPage() {
  return (
    <Suspense fallback={<ReportPageSkeleton />}>
      <CleanerReportPageContent />
    </Suspense>
  )
}
