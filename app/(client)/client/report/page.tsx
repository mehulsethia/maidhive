'use client'

import { Suspense, useDeferredValue, useEffect, useState, startTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft, CalendarDays, Search } from 'lucide-react'
import { bookingsApi, disputesApi } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { ReportPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import type { BookingRead, ClientDispute } from '@/types'
import { toast } from 'sonner'

type ReportStatus = 'open' | 'under_review' | 'resolved' | 'closed'
const DISPUTE_WINDOW_MINUTES = Number(process.env.NEXT_PUBLIC_POST_COMPLETION_BUFFER_MINUTES ?? 30)
const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_MINUTES * 60 * 1000

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

function getDisputeCreatedAt(dispute: any) {
  return dispute?.created_at ?? dispute?.createdAt ?? new Date().toISOString()
}

function getDisputeResolutionNote(dispute: any) {
  return dispute?.resolution_note ?? dispute?.resolutionNote ?? ''
}

function ClientReportPageContent() {
  const router = useRouter()
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

  const disputeBookingIds = new Set(deferredDisputes.map((dispute) => getDisputeBookingId(dispute)))

  const eligibleBookings = deferredBookings.filter((booking) => {
    if (booking.status !== 'completed') return false
    if (disputeBookingIds.has(booking.id)) return false

    const completedAt = booking.completed_at ? new Date(booking.completed_at).getTime() : 0
    if (!completedAt) return false

    return Date.now() <= completedAt + DISPUTE_WINDOW_MS
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
    if (!eligibleBookings.some((booking) => booking.id === bookingId)) {
      return toast.error('This booking is outside the dispute window or already has a dispute.')
    }
    if (!reason.trim()) return toast.error('Please describe the issue.')

    const evidence = evidenceInput
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      await disputesApi.createForBooking(bookingId, {
        reason: reason.trim(),
        evidence: evidence.length ? evidence : undefined,
      })
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

  const pendingCount = deferredDisputes.filter((dispute) => dispute.status === 'open').length
  const underReviewCount = deferredDisputes.filter((dispute) => dispute.status === 'under_review').length
  const resolvedCount = deferredDisputes.filter((dispute) =>
    dispute.status === 'resolved' || dispute.status === 'closed',
  ).length

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
    <>
      <div className="client-report-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <Button
                variant="outline"
                size="sm"
                className="w-fit rounded-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() =>
                  router.push(bookingFromQuery ? `/client/bookings/${bookingFromQuery}` : '/client/bookings')
                }
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Resolution Desk
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Reports & Disputes
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Raise issues within the dispute window and monitor every case from submission to resolution.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto grid w-full max-w-sm grid-cols-1 gap-2 rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm sm:grid-cols-3">
                <StatTile label="Open" value={pendingCount} monoFont={monoFont.className} displayFont={displayFont.className} />
                <StatTile label="Review" value={underReviewCount} monoFont={monoFont.className} displayFont={displayFont.className} />
                <StatTile label="Done" value={resolvedCount} monoFont={monoFont.className} displayFont={displayFont.className} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm">
            <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>
              Raise a new dispute
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Only completed bookings in the {DISPUTE_WINDOW_MINUTES}-minute dispute window can be reported.
            </p>

            {eligibleBookings.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No eligible bookings" description="Complete a booking first, then raise a report within the allowed window." />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <Label>Booking</Label>
                  <Select value={bookingId} onChange={(event) => setBookingId(event.target.value)} className="mt-1">
                    {eligibleBookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.cleaner?.user?.name ?? 'Cleaner'} · {formatDate(booking.scheduled_start)} · {booking.city}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Issue Description</Label>
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-1"
                    rows={4}
                    placeholder="Describe what happened and how you want this resolved."
                  />
                </div>

                <div>
                  <Label>Evidence URLs (optional)</Label>
                  <Textarea
                    value={evidenceInput}
                    onChange={(event) => setEvidenceInput(event.target.value)}
                    className="mt-1"
                    rows={3}
                    placeholder="One URL per line (screenshots/files)"
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={submitReport} loading={saving} className="rounded-full bg-[#0d4bc9] hover:bg-[#0a3ea8]">
                    Submit Report
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm">
            <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>
              Report history
            </h2>
            <p className="mt-1 text-sm text-slate-500">Filter and track all submitted cases.</p>

            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_170px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by reason or booking id"
                  className="h-11 rounded-full border-slate-300 pl-9"
                />
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
              <div className="mt-4">
                <EmptyState title="No reports found" description="Submitted reports will appear here." />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filteredDisputes.map((dispute, index) => {
                  const status = (dispute.status ?? 'open') as ReportStatus
                  const booking = dispute.booking
                  return (
                    <article
                      key={dispute.id}
                      className="report-row rounded-2xl border border-slate-200 bg-white p-4"
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className={`${displayFont.className} text-base font-semibold tracking-[-0.01em] text-slate-900`}>
                            {booking?.service_type ?? 'Service booking'}
                          </p>
                          <p className={`${monoFont.className} text-[0.68rem] tracking-wide text-slate-500`}>
                            Booking {getDisputeBookingId(dispute)}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
                          {STATUS_LABELS[status]}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-700">{dispute.reason}</p>

                      {getDisputeResolutionNote(dispute) && (
                        <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                          Resolution: {getDisputeResolutionNote(dispute)}
                        </p>
                      )}

                      <div className="mt-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(getDisputeCreatedAt(dispute))}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
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

        .report-row {
          animation: row-enter 0.45s ease both;
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

        @keyframes row-enter {
          from {
            opacity: 0;
            transform: translateY(8px);
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
}: {
  label: string
  value: number
  monoFont: string
  displayFont: string
}) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-3 text-white">
      <p className={`${monoFont} text-[0.6rem] uppercase tracking-[0.18em] text-white/70`}>{label}</p>
      <p className={`${displayFont} mt-1 text-xl font-bold tracking-[-0.02em]`}>{value}</p>
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
