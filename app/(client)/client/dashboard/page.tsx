'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useState, startTransition } from 'react'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import {
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  Clock3,
  Search,
  Sparkles,
} from 'lucide-react'
import { authApi, bookingsApi, favoritesApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { DashboardPageSkeleton } from '@/components/page-skeletons'
import { UserAvatar } from '@/components/ui/user-avatar'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus, FavoriteCleaner } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'accepted', 'confirmed', 'in_progress']
const UPCOMING_STATUSES: BookingStatus[] = ['pending', 'accepted', 'confirmed', 'in_progress']

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

function isPaymentAuthorized(paymentStatus?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
}

function isRealActiveBooking(booking: BookingRead) {
  if (!ACTIVE_STATUSES.includes(booking.status)) return false
  if (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status)) return false
  return true
}

function isValidUpcomingBooking(booking: BookingRead, nowMs: number) {
  if (!UPCOMING_STATUSES.includes(booking.status)) return false
  if (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status)) return false

  const scheduledStartMs = +new Date(booking.scheduled_start)
  if (booking.status === 'in_progress') {
    const scheduledEndMs = +new Date(booking.scheduled_end)
    return scheduledEndMs >= nowMs
  }
  return scheduledStartMs >= nowMs
}

export default function ClientDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [favorites, setFavorites] = useState<FavoriteCleaner[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const [meRes, bookingRes, favoritesRes] = await Promise.all([authApi.me(), bookingsApi.my(), favoritesApi.list()])
        if (!active) return

        startTransition(() => {
          setName((meRes.data?.name ?? '').trim())
          setBookings(bookingRes.data?.items ?? [])
          setFavorites(favoritesRes.data ?? [])
          setLoading(false)
        })
      } catch {
        if (!active) return
        toast.error('Failed to load dashboard data.')
        setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const deferredBookings = useDeferredValue(bookings)
  const firstName = name ? name.split(' ')[0] : ''

  const total = deferredBookings.length
  const activeCount = deferredBookings.filter((b) => isRealActiveBooking(b)).length
  const completedBookings = deferredBookings.filter((b) => b.status === 'completed')
  const totalSpent = completedBookings.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)

  const recent = [...deferredBookings]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 5)

  const now = Date.now()
  const nextBooking = deferredBookings
    .filter((b) => isValidUpcomingBooking(b, now))
    .sort((a, b) => +new Date(a.scheduled_start) - +new Date(b.scheduled_start))[0]

  if (loading) return <DashboardPageSkeleton />

  return (
    <>
      <div className="dashboard-revamp space-y-8 md:space-y-10">
        <section className="dashboard-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="dashboard-stage__media" aria-hidden="true" />
          <div className="dashboard-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:min-h-[12rem] lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:px-8 lg:py-4">
            <div className="space-y-5 lg:space-y-6 animate-stage-up">
              <p className={`${monoFont.className} text-[0.72rem] uppercase tracking-[0.28em] text-white/75`}>
                MaidHive Client Space
              </p>

              <div className="space-y-2">
                <p className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                  MaidHive
                </p>
                <h1 className={`${displayFont.className} text-lg font-medium tracking-[-0.01em] text-white/90 sm:text-xl`}>
                  {firstName
                    ? `${firstName}, manage your bookings and upcoming cleans.`
                    : 'Manage your bookings and upcoming cleans.'}
                </h1>
              </div>

              <p className="max-w-xl text-sm leading-relaxed text-slate-100/90 sm:text-base">
                View and manage your scheduled cleaning services, confirm upcoming jobs, and track progress from request to completion.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/client/cleaners"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f4b400] px-5 text-sm font-semibold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-[#ffca3a]"
                >
                  Book New Service
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/client/bookings"
                  className="inline-flex h-11 items-center rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/20"
                >
                  Open Bookings
                </Link>
              </div>
            </div>

            <div className="animate-stage-up delay-150">
              <div className="ml-auto w-full max-w-md rounded-3xl border border-white/25 bg-black/35 p-5 backdrop-blur-sm sm:p-6">
                <p className={`${monoFont.className} text-[0.68rem] uppercase tracking-[0.24em] text-cyan-200/90`}>
                  Live Snapshot
                </p>

                <dl className="mt-4 grid grid-cols-1 gap-3 text-white sm:grid-cols-3 sm:gap-4">
                  <div>
                    <dt className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-white/60`}>
                      Total
                    </dt>
                    <dd className={`${displayFont.className} mt-1 text-2xl font-bold tracking-[-0.02em]`}>
                      {total}
                    </dd>
                  </div>
                  <div>
                    <dt className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-white/60`}>
                      Active
                    </dt>
                    <dd className={`${displayFont.className} mt-1 text-2xl font-bold tracking-[-0.02em]`}>
                      {activeCount}
                    </dd>
                  </div>
                  <div>
                    <dt className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-white/60`}>
                      Spent
                    </dt>
                    <dd className={`${displayFont.className} mt-1 text-2xl font-bold tracking-[-0.02em]`}>
                      {formatCurrency(totalSpent)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 h-px bg-white/20" />

                <div className="mt-4">
                  <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-white/60`}>
                    Next Appointment
                  </p>

                  {!nextBooking ? (
                    <p className="mt-2 text-sm text-white/80">No upcoming booking is currently scheduled.</p>
                  ) : (
                    <Link
                      href={`/client/bookings/${nextBooking.id}`}
                      className="mt-2 block rounded-2xl border border-white/30 bg-white/10 p-3 transition hover:bg-white/20"
                    >
                      <p className="text-sm font-semibold text-white">
                        {SERVICE_LABELS[nextBooking.service_type] ?? nextBooking.service_type}
                      </p>
                      <p className="mt-1 text-xs text-white/75">{formatDate(nextBooking.scheduled_start)}</p>
                      <p className="mt-1 text-sm text-white/90">{nextBooking.cleaner?.user?.name ?? 'Cleaner'}</p>
                      <p className="text-xs text-white/70">{nextBooking.city}, {nextBooking.postcode}</p>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_0.95fr]">
          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className={`${monoFont.className} text-[0.68rem] uppercase tracking-[0.22em] text-slate-500`}>
                  Booking Feed
                </p>
                <h2 className={`${displayFont.className} mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-900`}>
                  Recent Activity
                </h2>
              </div>
              <Link href="/client/bookings" className="text-sm font-semibold text-[#0d4bc9] hover:underline">
                View all
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center">
                <p className={`${displayFont.className} text-lg font-semibold text-slate-800`}>
                  No bookings yet
                </p>
                <p className="mt-1 text-sm text-slate-500">Start by exploring trusted cleaners near you.</p>
                <Link
                  href="/client/cleaners"
                  className="mt-4 inline-flex h-10 items-center rounded-full bg-[#0d4bc9] px-4 text-sm font-semibold text-white hover:bg-[#0a3ea8]"
                >
                  Browse cleaners
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((booking, index) => (
                  <Link
                    key={booking.id}
                    href={`/client/bookings/${booking.id}`}
                    className="booking-row flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 transition duration-300 hover:-translate-y-0.5 hover:border-[#9eb7ec] hover:bg-[#f8fbff] sm:px-4"
                    style={{ animationDelay: `${index * 85}ms` }}
                  >
                    <div className="min-w-0">
                      <p className={`${displayFont.className} truncate text-base font-semibold tracking-[-0.01em] text-slate-900`}>
                        {SERVICE_LABELS[booking.service_type] ?? booking.service_type}
                      </p>
                      <p className="text-sm text-slate-600">{booking.cleaner?.user?.name ?? 'Cleaner'}</p>
                      <p className={`${monoFont.className} mt-1 text-[0.72rem] tracking-wide text-slate-500`}>
                        {formatDate(booking.scheduled_start)}
                      </p>
                    </div>
                    <BookingStatusBadge status={booking.status} paymentStatus={booking.payment?.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_36px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-5">
              <p className={`${monoFont.className} text-[0.68rem] uppercase tracking-[0.22em] text-slate-500`}>
                Quick Actions
              </p>
              <h2 className={`${displayFont.className} mt-1 text-xl font-bold tracking-[-0.02em] text-slate-900`}>
                Move faster
              </h2>

              <div className="mt-4 space-y-2">
                <ActionLink href="/client/cleaners" icon={<Search className="h-4 w-4" />} label="Browse cleaners" />
                <ActionLink href="/client/bookings" icon={<Sparkles className="h-4 w-4" />} label="Manage bookings" />
                <ActionLink href="/client/report" icon={<CircleAlert className="h-4 w-4" />} label="Report a problem" />
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-slate-200/80 bg-gradient-to-br from-[#0e2a66] to-[#0c448f] p-4 text-white shadow-[0_16px_36px_rgba(11,33,78,0.25)] sm:p-5">
              <p className={`${monoFont.className} text-[0.68rem] uppercase tracking-[0.22em] text-cyan-200/85`}>
                This Week
              </p>
              <h2 className={`${displayFont.className} mt-1 text-xl font-bold tracking-[-0.02em]`}>
                Service rhythm
              </h2>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{total} total bookings</p>
                    <p className="text-xs text-cyan-100/80">Across all statuses</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{activeCount} currently active</p>
                    <p className="text-xs text-cyan-100/80">Pending, accepted, confirmed, in progress</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_36px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-5">
              <p className={`${monoFont.className} text-[0.68rem] uppercase tracking-[0.22em] text-slate-500`}>
                Saved
              </p>
              <h2 className={`${displayFont.className} mt-1 text-xl font-bold tracking-[-0.02em] text-slate-900`}>
                Your favourite cleaners
              </h2>
              {favorites.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  You haven&apos;t saved any cleaners yet. Tap the heart on a cleaner profile to add them here.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {favorites.slice(0, 4).map((favorite) => (
                    <div key={favorite.cleaner_id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <UserAvatar
                            name={favorite.user?.name ?? 'Cleaner'}
                            imageUrl={favorite.profile_image_url}
                            className="h-9 w-9 border border-slate-200"
                            textClassName="text-sm font-semibold"
                            fallback="C"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{favorite.user?.name ?? 'Cleaner'}</p>
                            <p className="truncate text-xs text-slate-500">
                              {favorite.average_rating ? `${Number(favorite.average_rating).toFixed(1)}★` : 'No rating yet'} · {favorite.review_count ?? 0} reviews · {favorite.total_jobs} jobs
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-xs font-semibold text-slate-700">{formatCurrency(favorite.hourly_rate)}/hr</p>
                          <div className="mt-1 flex items-center gap-2 sm:justify-end">
                            <Link
                              href={`/client/cleaners/${favorite.cleaner_id}`}
                              className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View profile
                            </Link>
                            <Link
                              href={`/client/book/${favorite.cleaner_id}?reset=1&step=1`}
                              className="inline-flex h-7 items-center rounded-full bg-[#0d4bc9] px-2.5 text-[11px] font-semibold text-white hover:bg-[#0a3ea8]"
                            >
                              Book
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .dashboard-revamp {
          --dash-stage-top: #04162f;
          --dash-stage-mid: #0f3b76;
          --dash-stage-bottom: #0e5698;
        }

        .dashboard-stage {
          position: relative;
          isolation: isolate;
          background: linear-gradient(125deg, var(--dash-stage-top) 8%, var(--dash-stage-mid) 58%, var(--dash-stage-bottom));
        }

        .dashboard-stage__media {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(105deg, rgba(2, 11, 27, 0.82) 10%, rgba(2, 11, 27, 0.48) 55%, rgba(8, 22, 44, 0.72) 100%),
            radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px);
          background-size: cover;
          background-position: center;
          mix-blend-mode: screen;
          opacity: 0.94;
        }

        .dashboard-stage__grain {
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
          animation: stage-up 0.75s cubic-bezier(0.18, 0.82, 0.3, 1) both;
        }

        .delay-150 {
          animation-delay: 150ms;
        }

        .booking-row {
          animation: row-enter 0.5s ease both;
        }

        @keyframes stage-up {
          from {
            opacity: 0;
            transform: translateY(20px);
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

        @media (max-width: 768px) {
          .dashboard-stage__media {
            background-position: 64% center;
          }
        }
      `}</style>
    </>
  )
}

function ActionLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:border-[#9eb7ec] hover:bg-[#f8fbff]"
    >
      <span className="inline-flex items-center gap-2 text-slate-700">
        <span className="text-[#0d4bc9]">{icon}</span>
        {label}
      </span>
      <ArrowUpRight className="h-4 w-4 text-slate-500" />
    </Link>
  )
}
