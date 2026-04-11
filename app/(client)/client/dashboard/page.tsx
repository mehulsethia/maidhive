'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, CircleDollarSign, Clock3, Sparkles, Search, CircleAlert } from 'lucide-react'
import { authApi, bookingsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { EmptyState } from '@/components/empty-state'
import { DashboardPageSkeleton } from '@/components/page-skeletons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'accepted', 'confirmed', 'in_progress']
const UPCOMING_STATUSES: BookingStatus[] = ['accepted', 'confirmed', 'in_progress']

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

export default function ClientDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const meRes = await authApi.me()
        setName((meRes.data?.name ?? '').trim())
        const bookingRes = await bookingsApi.my()
        setBookings(bookingRes.data?.items ?? [])
      } catch {
        toast.error('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const stats = useMemo(() => {
    const total = bookings.length
    const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).length
    const completed = bookings.filter((b) => b.status === 'completed')
    const spent = completed.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)
    return { total, active, spent }
  }, [bookings])

  const recent = useMemo(
    () => [...bookings].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 4),
    [bookings],
  )

  const nextBooking = useMemo(() => {
    const now = Date.now()
    return bookings
      .filter((b) => UPCOMING_STATUSES.includes(b.status))
      .filter((b) => +new Date(b.scheduled_start) >= now)
      .sort((a, b) => +new Date(a.scheduled_start) - +new Date(b.scheduled_start))[0]
  }, [bookings])

  if (loading) return <DashboardPageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="marketplace-title text-3xl text-slate-900">Welcome back{name ? `, ${name.split(' ')[0]}` : ''}</h1>
          <p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening with your home services.</p>
        </div>
        <Link
          href="/client/cleaners"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(39,70,250,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95"
        >
          Book New Service
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Bookings</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><CalendarDays className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Bookings</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.active}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><Clock3 className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 sm:col-span-2 xl:col-span-1">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Spent</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.spent)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600"><CircleDollarSign className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Bookings</CardTitle>
              <Link href="/client/bookings" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="text-sm text-slate-500">Your latest service requests and statuses.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 ? (
              <EmptyState
                title="No bookings yet"
                description="Start by booking a cleaner from the marketplace."
                action={<Link href="/client/cleaners" className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-white">Browse cleaners</Link>}
              />
            ) : (
              recent.map((b) => {
                const cleanerName = (b as any)?.cleaner?.user?.name ?? 'Cleaner'
                return (
                  <Link key={b.id} href={`/client/bookings/${b.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50/70 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{SERVICE_LABELS[b.service_type] ?? b.service_type}</p>
                        <p className="text-sm text-slate-600">{cleanerName}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
                      </div>
                      <BookingStatusBadge status={b.status} />
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link href="/client/cleaners" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><Search className="h-4 w-4 text-primary" />Browse cleaners</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/client/bookings" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Manage bookings</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/client/report" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50">
                <span className="inline-flex items-center gap-2"><CircleAlert className="h-4 w-4 text-primary" />Raise dispute</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-base">Next Appointment</CardTitle></CardHeader>
            <CardContent>
              {!nextBooking ? (
                <p className="text-sm text-slate-500">No upcoming bookings.</p>
              ) : (
                <Link href={`/client/bookings/${nextBooking.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{SERVICE_LABELS[nextBooking.service_type] ?? nextBooking.service_type}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(nextBooking.scheduled_start)}</p>
                  <p className="mt-1 text-sm text-slate-700">{(nextBooking as any)?.cleaner?.user?.name ?? 'Cleaner'}</p>
                  <p className="text-xs text-slate-500">{nextBooking.city}, {nextBooking.postcode}</p>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
