'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useState, startTransition } from 'react'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { CalendarCheck2, CircleX, Clock3, Search } from 'lucide-react'
import { bookingsApi, disputesApi } from '@/lib/api'
import { compareBookingsByOperationalPriority } from '@/lib/booking-priority'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { canViewChatHistoryForBooking, getDisputeWindowMs } from '@/lib/chat-window'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

type ClientStatusFilter = 'all' | BookingStatus | 'awaiting_client_response'

const STATUS_FILTERS: Array<{ key: ClientStatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_client_response', label: 'Awaiting Client Response' },
  { key: 'pending', label: 'Pending Response / Payment Required' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'declined', label: 'Declined' },
  { key: 'expired', label: 'Expired' },
  { key: 'disputed', label: 'Disputed' },
]
type DashboardStatusFilter = 'active' | 'completed' | 'closed'

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

const LIVE_REFRESH_MS = 10000

function getBookingDisplayTitle(booking: BookingRead) {
  const instructions = String(booking.special_instructions ?? '')
  const match = instructions.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
  const jobType = match?.[1]?.trim()
  return jobType || SERVICE_LABELS[booking.service_type] || booking.service_type
}

const DISPUTE_WINDOW_MS = getDisputeWindowMs()

function isPaymentAuthorized(paymentStatus?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
}

function isOverdueUnpaid(booking: BookingRead) {
  const isUnpaid = booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status))
  if (!isUnpaid) return false
  return new Date(booking.scheduled_start).getTime() <= Date.now()
}

export default function ClientBookingsPage() {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [bookingDisputeStatus, setBookingDisputeStatus] = useState<Map<string, string>>(new Map())
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ClientStatusFilter>('all')
  const [dashboardFilter, setDashboardFilter] = useState<DashboardStatusFilter | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [cancelTargetBookingId, setCancelTargetBookingId] = useState<string | null>(null)

  async function loadBookings() {
    try {
      const [bookingsRes, disputesRes] = await Promise.allSettled([bookingsApi.my(1), disputesApi.listMine()])
      const res = bookingsRes.status === 'fulfilled' ? bookingsRes.value : null
      const disputes = disputesRes.status === 'fulfilled' ? disputesRes.value : null
      const disputeMap = new Map<string, string>()
      for (const dispute of disputes?.data?.items ?? []) {
        if (dispute?.booking_id) disputeMap.set(dispute.booking_id, dispute.status)
      }
      startTransition(() => {
        setBookings(res?.data?.items ?? [])
        setBookingDisputeStatus(disputeMap)
        setLoading(false)
      })
      if (res) {
        resetLoadError('client-bookings')
      } else {
        reportLoadError('client-bookings', 'Failed to load bookings.')
      }
    } catch {
      reportLoadError('client-bookings', 'Failed to load bookings.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [])

  useEffect(() => {
    const poll = setInterval(() => {
      loadBookings().catch(() => null)
    }, LIVE_REFRESH_MS)
    function onFocus() {
      loadBookings().catch(() => null)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function handleCancel(bookingId: string) {
    setActionLoadingId(bookingId)
    try {
      const booking = bookings.find((item) => item.id === bookingId)
      const isDraftLike = booking ? (booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status))) : false
      await bookingsApi.cancel(
        bookingId,
        isDraftLike
          ? 'Cancelled by client while in draft payment-required state'
          : 'Cancelled by client while pending cleaner acceptance',
      )
      if (booking?.cleaner_id) {
        await bookingsApi.clearFlowDraft(booking.cleaner_id).catch(() => null)
      }
      toast.success(isDraftLike ? 'Draft booking cancelled.' : 'Booking request cancelled.')
      await loadBookings()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel booking request.')
    } finally {
      setActionLoadingId(null)
    }
  }

  function openCancelConfirm(bookingId: string) {
    setCancelTargetBookingId(bookingId)
    setCancelConfirmOpen(true)
  }

  async function confirmCancelRequest() {
    if (!cancelTargetBookingId) return
    await handleCancel(cancelTargetBookingId)
    setCancelConfirmOpen(false)
    setCancelTargetBookingId(null)
  }

  const deferredBookings = useDeferredValue(bookings)
  const cancelTargetBooking = cancelTargetBookingId
    ? bookings.find((item) => item.id === cancelTargetBookingId) ?? null
    : null
  const cancelTargetIsDraftLike = cancelTargetBooking
    ? (cancelTargetBooking.status === 'draft' || (cancelTargetBooking.status === 'pending' && !isPaymentAuthorized(cancelTargetBooking.payment?.status)))
    : true

  const filtered = deferredBookings.filter((booking) => {
    if (dashboardFilter === 'active') {
      const isActiveStatus = ['draft', 'pending', 'accepted', 'confirmed', 'in_progress'].includes(booking.status)
      if (!isActiveStatus) return false
    }
    if (dashboardFilter === 'completed' && booking.status !== 'completed') return false
    if (dashboardFilter === 'closed' && !['cancelled', 'declined', 'expired'].includes(booking.status)) return false
    if (filter !== 'all') {
      if (filter === 'awaiting_client_response') {
        const awaitingClient = booking.status === 'pending' && booking.proposal_by === 'cleaner'
        if (!awaitingClient) return false
      } else if (filter === 'pending') {
        const isPendingOrPaymentRequired = booking.status === 'draft' || booking.status === 'pending'
        if (!isPendingOrPaymentRequired) return false
      } else if (booking.status !== filter) {
        return false
      }
    }
    if (!query.trim()) return true

    const q = query.toLowerCase()
    const cleanerName = (booking.cleaner?.user?.name ?? '').toLowerCase()

    return (
      cleanerName.includes(q) ||
      getBookingDisplayTitle(booking).toLowerCase().includes(q) ||
      booking.city.toLowerCase().includes(q) ||
      booking.postcode.toLowerCase().includes(q)
    )
  }).sort(compareBookingsByOperationalPriority)

  const activeCount = deferredBookings.filter((booking) => {
    const isActiveStatus = ['draft', 'pending', 'accepted', 'confirmed', 'in_progress'].includes(booking.status)
    if (!isActiveStatus) return false
    return true
  }).length
  const completedCount = deferredBookings.filter((booking) => booking.status === 'completed').length
  const cancelledCount = deferredBookings.filter((booking) =>
    ['cancelled', 'declined', 'expired'].includes(booking.status),
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
                Your Bookings
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
                <MetricChip label="Active" value={activeCount} icon={<Clock3 className="h-4 w-4" />} monoFont={monoFont.className} displayFont={displayFont.className} active={dashboardFilter === 'active'} onClick={() => { setDashboardFilter('active'); setFilter('all') }} />
                <MetricChip label="Done" value={completedCount} icon={<CalendarCheck2 className="h-4 w-4" />} monoFont={monoFont.className} displayFont={displayFont.className} active={dashboardFilter === 'completed'} onClick={() => { setDashboardFilter('completed'); setFilter('all') }} />
                <MetricChip label="Closed" value={cancelledCount} icon={<CircleX className="h-4 w-4" />} monoFont={monoFont.className} displayFont={displayFont.className} active={dashboardFilter === 'closed'} onClick={() => { setDashboardFilter('closed'); setFilter('all') }} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-6">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by cleaner, service, city, or postcode"
                  className="h-11 rounded-full border-slate-300 pl-9"
                />
              </div>
              <Select
                value={filter}
                onChange={(event) => {
                  setDashboardFilter(null)
                  setFilter(event.target.value as ClientStatusFilter)
                }}
                className="h-11 w-full rounded-full border-slate-300 bg-white px-4 sm:w-[220px] sm:shrink-0"
                aria-label="Filter bookings by status"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status.key} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </Select>
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
                  const scheduledEndMs = new Date(booking.scheduled_end).getTime()
                  const isWithinDisputeWindow =
                    Number.isFinite(scheduledEndMs) && Date.now() <= scheduledEndMs + DISPUTE_WINDOW_MS
                  const canDispute = booking.status === 'completed' && isWithinDisputeWindow && !disputeStatusForBooking
                  const canChat = canViewChatHistoryForBooking(booking)
                  const isOverdueDraftState = isOverdueUnpaid(booking)
                  const canContinuePayment = !isOverdueDraftState && (booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status)))
                  const canCancelDraft = !isOverdueDraftState && (booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status)))

                  return (
                    <article
                      key={booking.id}
                      className="booking-row rounded-2xl border border-slate-200 bg-white px-4 py-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#9eb7ec] hover:bg-[#f8fbff]"
                      style={{ animationDelay: `${index * 75}ms` }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className={`${displayFont.className} text-lg font-semibold tracking-[-0.01em] text-slate-900`}>
                            {getBookingDisplayTitle(booking)}
                          </p>
                          <p className="text-sm text-slate-600">{booking.cleaner?.user?.name ?? 'Cleaner'}</p>
                          <p className={`${monoFont.className} mt-1 text-[0.72rem] tracking-wide text-slate-500`}>
                            {formatDate(booking.scheduled_start)}
                          </p>
                          <p className="text-xs text-slate-500">{booking.address}, {booking.city}, {booking.postcode}</p>
                          {booking.status === 'pending' && booking.proposed_start && booking.proposal_by && (
                            <p className="mt-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                              {booking.proposal_by === 'cleaner'
                                ? `Cleaner proposed ${formatDate(booking.scheduled_start)} → ${formatDate(booking.proposed_start)}.`
                                : `You proposed ${formatDate(booking.scheduled_start)} → ${formatDate(booking.proposed_start)}. Waiting for cleaner response.`}
                            </p>
                          )}
                        </div>

                        <div className="text-left sm:text-right">
                          <BookingStatusBadge status={booking.status} paymentStatus={booking.payment?.status} proposalBy={booking.proposal_by} />
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
                        {canContinuePayment && (
                          <Link
                            href={`/client/book/${booking.cleaner_id}?continue=1&bookingId=${booking.id}&step=3`}
                            className="inline-flex h-8 items-center rounded-full bg-[#0d4bc9] px-3 text-xs font-semibold text-white transition hover:bg-[#0a3ea8]"
                          >
                            Continue payment
                          </Link>
                        )}
                        {canCancelDraft && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                            onClick={() => openCancelConfirm(booking.id)}
                            loading={actionLoadingId === booking.id}
                          >
                            Cancel draft
                          </Button>
                        )}
                        {booking.status === 'pending' && isPaymentAuthorized(booking.payment?.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                            onClick={() => openCancelConfirm(booking.id)}
                            loading={actionLoadingId === booking.id}
                          >
                            Cancel booking request
                          </Button>
                        )}

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
                            Report a problem
                          </Link>
                        )}
                        {(disputeStatusForBooking === 'open' || disputeStatusForBooking === 'under_review') && (
                          <span className="inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700">
                            This booking is currently under review.
                          </span>
                        )}

                        {(booking.status === 'expired' || booking.status === 'cancelled' || booking.status === 'declined' || isOverdueDraftState) && (
                          <>
                            <Link
                              href={`/client/book/${booking.cleaner_id}?reset=1&step=1`}
                              className="inline-flex h-8 items-center rounded-full bg-[#0d4bc9] px-3 text-xs font-semibold text-white transition hover:bg-[#0a3ea8]"
                            >
                              Book again
                            </Link>
                            <Link
                              href="/client/cleaners"
                              className="inline-flex h-8 items-center rounded-full border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Choose another cleaner
                            </Link>
                          </>
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

      <Dialog
        open={cancelConfirmOpen}
        onClose={() => {
          if (actionLoadingId) return
          setCancelConfirmOpen(false)
          setCancelTargetBookingId(null)
        }}
      >
        <DialogTitle>{cancelTargetIsDraftLike ? 'Cancel draft booking' : 'Cancel booking request'}</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {cancelTargetIsDraftLike
              ? 'Need to change something? Cancel this draft and start a new booking.'
              : 'Are you sure you want to cancel this booking request?'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCancelConfirmOpen(false)
                setCancelTargetBookingId(null)
              }}
              disabled={Boolean(actionLoadingId)}
            >
              {cancelTargetIsDraftLike ? 'Keep draft' : 'Keep request'}
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={confirmCancelRequest}
              loading={Boolean(cancelTargetBookingId && actionLoadingId === cancelTargetBookingId)}
            >
              {cancelTargetIsDraftLike ? 'Cancel draft' : 'Cancel booking request'}
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
  active,
  onClick,
}: {
  label: string
  value: number
  icon: React.ReactNode
  monoFont: string
  displayFont: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3 text-white text-left transition ${active ? 'border-white/70 bg-white/25' : 'border-white/25 bg-white/10 hover:bg-white/20'}`}
    >
      <div className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-cyan-100">
        {icon}
      </div>
      <p className={`${monoFont} text-[0.6rem] uppercase tracking-[0.18em] text-white/70`}>{label}</p>
      <p className={`${displayFont} mt-1 text-xl font-bold tracking-[-0.02em]`}>{value}</p>
    </button>
  )
}
