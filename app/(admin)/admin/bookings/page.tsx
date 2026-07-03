'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { CancellationPaymentBreakdown } from '@/components/cancellation-payment-breakdown'
import { Button, buttonVariants } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/loading-spinner'
import { EmptyState } from '@/components/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'

// ── Status groupings ──────────────────────────────────────────────────────────

const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  {
    key: 'all',
    label: 'All',
    statuses: [],
  },
  {
    key: 'pending',
    label: 'Pending',
    statuses: ['pending'],
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    statuses: ['confirmed', 'accepted', 'in_progress'],
  },
  {
    key: 'completed',
    label: 'Completed',
    statuses: ['completed'],
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    statuses: ['cancelled', 'declined'],
  },
  {
    key: 'expired',
    label: 'Expired',
    statuses: ['expired'],
  },
  {
    key: 'failed_payments',
    label: 'Failed payments',
    statuses: ['failed_payments'],
  },
]

const PAGE_SIZE = 20

// ── Booking table ─────────────────────────────────────────────────────────────

function BookingTable({ bookings }: { bookings: BookingRead[] }) {
  if (bookings.length === 0) return <EmptyState title="No bookings" />

  return (
    <div className="-mx-4 w-[calc(100%+2rem)] max-w-none overflow-x-auto overscroll-x-contain rounded-lg border sm:mx-0 sm:w-full" role="region" aria-label="Admin bookings table">
      <table className="w-full min-w-[760px] text-sm sm:min-w-[860px]">
        <thead className="bg-muted/40">
          <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
            <th className="px-4 py-3 font-medium">Booking</th>
            <th className="px-4 py-3 font-medium">Service</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Scheduled</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Amount</th>
            <th className="px-4 py-3 font-medium text-right">Platform Fee</th>
            <th className="px-4 py-3 font-medium text-right">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bookings.map(b => (
            <tr key={b.id} className="group hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 min-w-[140px]">
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
                >
                  #{b.id.slice(0, 8)}
                </Link>
                <p className="text-[10px] text-muted-foreground">{formatDate(b.created_at)}</p>
              </td>
              <td className="px-4 py-3 min-w-[120px] capitalize">{b.service_type.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3 min-w-[110px] text-muted-foreground">
                {b.city}, {b.postcode}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDate(b.scheduled_start)}
              </td>
              <td className="px-4 py-3">
                <BookingStatusBadge
                  status={b.status}
                  paymentStatus={b.payment?.status}
                  scheduledEnd={b.scheduled_end}
                  proposalBy={b.proposal_by}
                />
                {(b.start_initiated_by === 'cleaner' || b.start_initiated_by === 'system') && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Start: {b.start_initiated_by === 'system' ? 'Auto-started by system' : 'Started manually by cleaner'}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {b.status === 'cancelled' ? <CancellationPaymentBreakdown booking={b} compact /> : formatCurrency(b.total_amount)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                {formatCurrency(b.platform_fee)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/bookings/${b.id}`}
                  aria-label={`Open booking ${b.id.slice(0, 8)}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminBookingsPage() {
  const searchParams = useSearchParams()
  const [activeGroup, setActiveGroup] = useState(() => {
    const filter = searchParams.get('filter')
    return filter && GROUPS.some((group) => group.key === filter) ? filter : 'all'
  })
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const loadRequestRef = useRef(0)

  const load = useCallback(async (group: string, p: number) => {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    try {
      const g = GROUPS.find(g => g.key === group)
      const statusParam = g && g.statuses.length > 0
        ? g.statuses.join(',')
        : undefined

      const res = await adminApi.listBookings({ page: p, status: statusParam })
      if (requestId !== loadRequestRef.current) return

      setBookings(res.data?.items ?? [])
      setTotal(res.data?.total ?? 0)
      setHasNext(res.data?.has_next ?? false)
      resetLoadError('admin-bookings')
    } catch {
      if (requestId !== loadRequestRef.current) return
      reportLoadError('admin-bookings', 'Failed to load bookings.')
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(activeGroup, page)
  }, [activeGroup, page, load])

  useEffect(() => {
    const filter = searchParams.get('filter')
    const nextGroup = filter && GROUPS.some((group) => group.key === filter) ? filter : 'all'
    setActiveGroup(nextGroup)
    setPage(1)
  }, [searchParams])

  return (
    <div className="space-y-6">
      <Tabs value={activeGroup} onValueChange={v => {
        setActiveGroup(v)
        setPage(1)
      }}>
      <TabsList className="scrollbar-hide h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap pb-1 [-webkit-overflow-scrolling:touch]">
          {GROUPS.map(g => (
            <TabsTrigger key={g.key} value={g.key}>
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {GROUPS.map(g => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            {loading ? (
              <LoadingSpinner />
            ) : (
              <BookingTable bookings={bookings} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Page {page} · {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setPage(p => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
