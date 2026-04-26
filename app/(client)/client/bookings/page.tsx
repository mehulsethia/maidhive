'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useState, startTransition } from 'react'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { CalendarCheck2, CircleX, Clock3, Search } from 'lucide-react'
import { bookingsApi, disputesApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getDisputeWindowMs } from '@/lib/chat-window'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

const STATUS_FILTERS: Array<{ key: 'all' | BookingStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending Cleaner Acceptance' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'disputed', label: 'Disputed' },
]

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

const DISPUTE_WINDOW_MS = getDisputeWindowMs()

export default function ClientBookingsPage() {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [bookingDisputeStatus, setBookingDisputeStatus] = useState<Map<string, string>>(new Map())
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')

  async function loadBookings() {
    try {
      const [res, disputesRes] = await Promise.all([bookingsApi.my(), disputesApi.listMine()])
      const disputeMap = new Map<string, string>()
      for (const dispute of disputesRes.data?.items ?? []) {
        if (dispute?.booking_id) disputeMap.set(dispute.booking_id, dispute.status)
      }
      startTransition(() => {
        setBookings(res.data?.items ?? [])
        setBookingDisputeStatus(disputeMap)
        setLoading(false)
      })
    } catch {
      toast.error('Failed to load bookings.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [])

  async function handleComplete(bookingId: string) {
    setActionLoadingId(bookingId)
    try {
      await bookingsApi.complete(bookingId)
      toast.success('Booking marked as completed.')
      await loadBookings()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to mark booking as complete.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const deferredBookings = useDeferredValue(bookings)

  const filtered = deferredBookings.filter((booking) => {
    if (filter !== 'all' && booking.status !== filter) return false
    if (!query.trim()) return true

    const q = query.toLowerCase()
    const cleanerName = (booking.cleaner?.user?.name ?? '').toLowerCase()

    return (
      cleanerName.includes(q) ||
      (SERVICE_LABELS[booking.service_type] ?? booking.service_type).toLowerCase().includes(q) ||
      booking.city.toLowerCase().includes(q) ||
      booking.postcode.toLowerCase().includes(q)
    )
  })

  const activeCount = deferredBookings.filter((booking) =>
    ['pending', 'accepted', 'confirmed', 'in_progress'].includes(booking.status),
  ).length
  const completedCount = deferredBookings.filter((booking) => booking.status === 'completed').length
  const cancelledCount = deferredBookings.filter((booking) =>
    ['cancelled', 'expired'].includes(booking.status),
  ).length

  if (loading) return <ListPageSkeleton />

  return (
    <>
      <div className="client-bookings-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Booking Command
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Your Booking Ledger
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Track status, complete active jobs, and jump to details from one focused booking stream.
              </p>
              <Link
                href="/client/cleaners"
                className="inline-flex h-11 items-center rounded-full bg-[#f4b400] px-5 text-sm font-semibold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-[#ffca3a]"
              >
                Book another service
              </Link>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto grid w-full max-w-sm grid-cols-1 gap-2 rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm sm:grid-cols-3 sm:gap-3">
                <MetricChip label="Active" value={activeCount} icon={<Clock3 className="h-4 w-4" />} monoFont={monoFont.className} displayFont={displayFont.className} />
                <MetricChip label="Done" value={completedCount} icon={<CalendarCheck2 className="h-4 w-4" />} monoFont={monoFont.className} displayFont={displayFont.className} />
                <MetricChip label="Closed" value={cancelledCount} icon={<CircleX className="h-4 w-4" />} monoFont={monoFont.className} displayFont={displayFont.className} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by cleaner, service, city, or postcode"
                className="h-11 rounded-full border-slate-300 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status.key}
                  onClick={() => setFilter(status.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === status.key
                      ? 'bg-[#0d4bc9] text-white shadow-[0_8px_16px_rgba(13,75,201,0.32)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            {filtered.length === 0 ? (
              <EmptyState
                title="No bookings found"
                description={
                  deferredBookings.length === 0
                    ? 'You do not have bookings yet.'
                    : 'Try a different search or status filter.'
                }
                action={
                  <Link
                    href="/client/cleaners"
                    className="inline-flex h-9 items-center rounded-full bg-[#0d4bc9] px-4 text-sm font-semibold text-white hover:bg-[#0a3ea8]"
                  >
                    Browse cleaners
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((booking, index) => {
                  const disputeStatusForBooking = bookingDisputeStatus.get(booking.id)
                  const completedAtMs = booking.completed_at ? new Date(booking.completed_at).getTime() : 0
                  const isWithinDisputeWindow = completedAtMs > 0 && Date.now() <= completedAtMs + DISPUTE_WINDOW_MS
                  const canDispute = booking.status === 'completed' && isWithinDisputeWindow && !disputeStatusForBooking
                  const isActiveBooking = ['pending', 'accepted', 'confirmed', 'in_progress'].includes(booking.status)
                  const canComplete = booking.status === 'in_progress'
                  const canChat = ['confirmed', 'in_progress', 'completed', 'disputed'].includes(booking.status)

                  return (
                    <article
                      key={booking.id}
                      className="booking-row rounded-2xl border border-slate-200 bg-white px-4 py-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#9eb7ec] hover:bg-[#f8fbff]"
                      style={{ animationDelay: `${index * 75}ms` }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className={`${displayFont.className} text-lg font-semibold tracking-[-0.01em] text-slate-900`}>
                            {SERVICE_LABELS[booking.service_type] ?? booking.service_type}
                          </p>
                          <p className="text-sm text-slate-600">{booking.cleaner?.user?.name ?? 'Cleaner'}</p>
                          <p className={`${monoFont.className} mt-1 text-[0.72rem] tracking-wide text-slate-500`}>
                            {formatDate(booking.scheduled_start)}
                          </p>
                          <p className="text-xs text-slate-500">{booking.address}, {booking.city}, {booking.postcode}</p>
                        </div>

                        <div className="text-left sm:text-right">
                          <BookingStatusBadge status={booking.status} />
                          <p className={`${displayFont.className} mt-2 text-base font-semibold text-slate-900`}>
                            {formatCurrency(Number(booking.total_amount ?? 0))}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/client/bookings/${booking.id}`}
                          className="inline-flex h-8 items-center rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View details
                        </Link>

                        {canChat && (
                          <Link
                            href={`/client/chats?booking=${booking.id}`}
                            className="inline-flex h-8 items-center rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Message
                          </Link>
                        )}

                        {canDispute && (
                          <Link
                            href={`/client/report?booking=${booking.id}`}
                            className="inline-flex h-8 items-center rounded-full bg-[#0d4bc9] px-3 text-xs font-semibold text-white transition hover:bg-[#0a3ea8]"
                          >
                            Report a Problem
                          </Link>
                        )}
                        {disputeStatusForBooking === 'under_review' && (
                          <span className="inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700">
                            This booking is currently under review by MaidHive.
                          </span>
                        )}

                        {isActiveBooking && (
                          <Button
                            size="sm"
                            onClick={() => handleComplete(booking.id)}
                            loading={actionLoadingId === booking.id}
                            disabled={!canComplete}
                            title={
                              canComplete
                                ? 'Mark this booking as complete'
                                : 'Available when booking is in progress'
                            }
                          >
                            Mark as Complete
                          </Button>
                        )}
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

        .booking-row {
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

function MetricChip({
  label,
  value,
  icon,
  monoFont,
  displayFont,
}: {
  label: string
  value: number
  icon: React.ReactNode
  monoFont: string
  displayFont: string
}) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-3 text-white">
      <div className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-cyan-100">
        {icon}
      </div>
      <p className={`${monoFont} text-[0.6rem] uppercase tracking-[0.18em] text-white/70`}>{label}</p>
      <p className={`${displayFont} mt-1 text-xl font-bold tracking-[-0.02em]`}>{value}</p>
    </div>
  )
}
