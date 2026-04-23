'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/loading-spinner'
import { EmptyState } from '@/components/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

// ── Status groupings ──────────────────────────────────────────────────────────

const GROUPS: { key: string; label: string; statuses: BookingStatus[] }[] = [
  {
    key: 'all',
    label: 'All',
    statuses: [],
  },
  {
    key: 'active',
    label: 'Active',
    statuses: ['pending', 'accepted', 'confirmed', 'in_progress'],
  },
  {
    key: 'completed',
    label: 'Completed',
    statuses: ['completed'],
  },
  {
    key: 'issues',
    label: 'Issues',
    statuses: ['disputed', 'cancelled', 'expired'],
  },
]

const PAGE_SIZE = 20

// ── Booking table ─────────────────────────────────────────────────────────────

function BookingTable({ bookings }: { bookings: BookingRead[] }) {
  if (bookings.length === 0) return <EmptyState title="No bookings" />

  return (
    <div className="-mx-4 overflow-x-auto rounded-lg border sm:mx-0">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
            <th className="px-4 py-3 font-medium">Booking</th>
            <th className="px-4 py-3 font-medium">Service</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Scheduled</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Amount</th>
            <th className="px-4 py-3 font-medium text-right">Fee</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bookings.map(b => (
            <tr key={b.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground">#{b.id.slice(0, 8)}</span>
                <p className="text-[10px] text-muted-foreground">{formatDate(b.created_at)}</p>
              </td>
              <td className="px-4 py-3 capitalize">{b.service_type.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {b.city}, {b.postcode}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDate(b.scheduled_start)}
              </td>
              <td className="px-4 py-3">
                <BookingStatusBadge status={b.status} />
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(b.total_amount)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                {formatCurrency(b.platform_fee)}
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
  const [activeGroup, setActiveGroup] = useState('all')
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (group: string, p: number) => {
    setLoading(true)
    try {
      const g = GROUPS.find(g => g.key === group)
      const statusParam = g && g.statuses.length > 0
        ? g.statuses.join(',')
        : undefined

      const res = await adminApi.listBookings({ page: p, status: statusParam })
      setBookings(res.data?.items ?? [])
      setTotal(res.data?.total ?? 0)
      setHasNext(res.data?.has_next ?? false)
    } catch {
      toast.error('Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    load(activeGroup, 1)
  }, [activeGroup, load])

  useEffect(() => {
    load(activeGroup, page)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <Tabs value={activeGroup} onValueChange={v => { setActiveGroup(v) }}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
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
