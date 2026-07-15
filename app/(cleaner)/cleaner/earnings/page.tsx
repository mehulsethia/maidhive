'use client'

import { useEffect, useState } from 'react'
import { bookingsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import {
  classifyCleanerPaymentHistoryBooking,
  getReleasedCleanerEarnings,
  isCleanerEarningReleased,
} from '@/lib/cleaner-payment-history'
import { getCleanerPayoutSummary } from '@/lib/cleaner-payout'

export default function EarningsPage() {
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bookingsApi.my()
      .then((r) => {
        setBookings(r.data?.items ?? [])
        resetLoadError('cleaner-earnings')
      })
      .catch(() => reportLoadError('cleaner-earnings', 'Failed to load earnings'))
      .finally(() => setLoading(false))
  }, [])

  const settled = bookings.filter((booking) => isCleanerEarningReleased(booking))
  const totalEarned = getReleasedCleanerEarnings(bookings)
  const totalHours = settled.reduce((sum, b) => sum + b.duration_hours, 0)

  const settledBookingIds = new Set(settled.map((booking) => booking.id))
  const unsettled = bookings.filter((booking) => !settledBookingIds.has(booking.id))
  const upcoming = unsettled.filter((b) => ['confirmed', 'in_progress', 'completed', 'disputed'].includes(b.status))

  if (loading) return <ListPageSkeleton />

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="px-4 pb-4 pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total earned</p>
            <p className="text-2xl font-bold">{formatCurrency(totalEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 pb-4 pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Jobs completed</p>
            <p className="text-2xl font-bold">{settled.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 pb-4 pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hours worked</p>
            <p className="text-2xl font-bold">{totalHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 pb-4 pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pending payout</p>
            <p className="text-2xl font-bold text-yellow-600">{upcoming.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending payouts */}
      {upcoming.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 text-base">Upcoming payouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm py-1">
                <div>
                  <span className="font-medium capitalize">{b.service_type.replace('_', ' ')}</span>
                  <span className="text-muted-foreground ml-2">{formatDate(b.scheduled_start)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookingStatusBadge
                    status={b.status}
                    paymentStatus={b.payment?.status}
                    transferredAt={b.payment?.transferred_at}
                    scheduledEnd={b.scheduled_end}
                    proposalBy={b.proposal_by}
                    showPaymentRequiredForUnpaid={false}
                    audience="cleaner"
                  />
                  <span className="text-xs text-muted-foreground">{settlementLabel(b)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent>
          {settled.length === 0 ? (
            <EmptyState title="No completed jobs yet" description="Earnings from completed jobs will appear here." />
          ) : (
            <div className="space-y-0">
              {settled.map((b, i) => {
                const payoutSummary = getCleanerPayoutSummary(b)
                const paymentHistory = classifyCleanerPaymentHistoryBooking(b)
                const noPayout = paymentHistory?.label === 'No payout'
                return (
                <div key={b.id}>
                  <div className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm capitalize">{b.service_type.replace('_', ' ')}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                        {paymentHistory?.paymentType ?? 'Booking payout'}
                      </p>
                      <p className="break-words text-xs text-muted-foreground">{formatDate(b.scheduled_start)} · {b.duration_hours}h · {b.city}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="font-semibold text-green-700">{noPayout ? '' : '+'}{formatCurrency(payoutSummary.finalCleanerPayout)}</p>
                      <p className="text-xs text-muted-foreground">{paymentHistory?.label ?? `${formatCurrency(b.hourly_rate)}/hr`}</p>
                    </div>
                  </div>
                  {i < settled.length - 1 && <Separator />}
                </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Payout states update from booking and payment status. Amounts are shown only after settlement.
      </p>
    </div>
  )
}

function settlementLabel(booking: BookingRead) {
  if (booking.status === 'confirmed' || booking.status === 'in_progress') return 'Awaiting completion'
  if (booking.status === 'disputed' || booking.dispute?.status === 'open' || booking.dispute?.status === 'under_review') return 'Paused due to dispute'
  if (booking.status === 'completed') return 'In 24h hold window'
  return 'Pending settlement'
}
