'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, CircleX, Clock3, Search } from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const STATUS_FILTERS: Array<{ key: 'all' | BookingStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
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

export default function ClientBookingsPage() {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await bookingsApi.my()
        setBookings(res.data?.items ?? [])
      } catch {
        toast.error('Failed to load bookings.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filter !== 'all' && b.status !== filter) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      const cleanerName = ((b as any)?.cleaner?.user?.name ?? '').toLowerCase()
      return (
        cleanerName.includes(q) ||
        (SERVICE_LABELS[b.service_type] ?? b.service_type).toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.postcode.toLowerCase().includes(q)
      )
    })
  }, [bookings, filter, query])

  const summary = useMemo(() => {
    const active = bookings.filter((b) => ['pending', 'accepted', 'confirmed', 'in_progress'].includes(b.status)).length
    const completed = bookings.filter((b) => b.status === 'completed').length
    const cancelled = bookings.filter((b) => ['cancelled', 'expired'].includes(b.status)).length
    return { active, completed, cancelled }
  }, [bookings])

  if (loading) return <ListPageSkeleton />

  return (
    <div className="space-y-12">
      <div className="mb-4">
        <h1 className="marketplace-title text-4xl text-slate-900">My Bookings</h1>
        <p className="mt-3 text-sm text-slate-500">Track all bookings, statuses, and next actions.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-10 pt-10 md:pt-10">
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-2xl font-bold">{summary.active}</p>
            </div>
            <Clock3 className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-10 pt-10 md:pt-10">
            <div>
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-2xl font-bold">{summary.completed}</p>
            </div>
            <CalendarCheck2 className="h-5 w-5 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex items-center justify-between p-10 pt-10 md:pt-10">
            <div>
              <p className="text-xs text-slate-500">Cancelled/Expired</p>
              <p className="text-2xl font-bold">{summary.cancelled}</p>
            </div>
            <CircleX className="h-5 w-5 text-rose-600" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-10 p-10 pt-10 md:pt-10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by cleaner, service, city, postcode"
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
              description={bookings.length === 0 ? 'You do not have bookings yet.' : 'Try a different search or filter.'}
              action={
                <Link href="/client/cleaners" className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5">
                  Browse cleaners
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((b) => {
                const cleanerName = (b as any)?.cleaner?.user?.name ?? 'Cleaner'
                const canDispute = ['in_progress', 'completed', 'disputed'].includes(b.status)
                const chatCutoff = b.scheduled_end ? new Date(b.scheduled_end).getTime() + 30 * 60 * 1000 : Infinity
                const canChat = ['confirmed', 'in_progress', 'completed', 'disputed'].includes(b.status) && Date.now() < chatCutoff
                return (
                  <article key={b.id} className="rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{SERVICE_LABELS[b.service_type] ?? b.service_type}</p>
                        <p className="text-sm text-slate-600">{cleanerName}</p>
                        <p className="text-xs text-slate-500">{formatDate(b.scheduled_start)}</p>
                        <p className="text-xs text-slate-500">{b.address}, {b.city}, {b.postcode}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <BookingStatusBadge status={b.status} />
                        <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(Number(b.total_amount ?? 0))}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/client/bookings/${b.id}`}
                        className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                      >
                        View details
                      </Link>
                      {canChat && (
                        <Link
                          href={`/client/chats?booking=${b.id}`}
                          className="inline-flex h-8 items-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                        >
                          Message
                        </Link>
                      )}
                      {canDispute && (
                        <Link
                          href={`/client/report?booking=${b.id}`}
                          className="inline-flex h-8 items-center rounded-xl bg-primary px-3 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95"
                        >
                          Report issue
                        </Link>
                      )}
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
