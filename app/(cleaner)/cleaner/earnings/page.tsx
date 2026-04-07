'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Briefcase, Clock, DollarSign } from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { LoadingSpinner } from '@/components/loading-spinner'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

export default function EarningsPage() {
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bookingsApi.my()
      .then(r => setBookings(r.data?.items ?? []))
      .catch(() => toast.error('Failed to load earnings'))
      .finally(() => setLoading(false))
  }, [])

  const completed = bookings.filter(b => b.status === 'completed')
  const totalEarned = completed.reduce((sum, b) => sum + b.cleaner_payout, 0)
  const totalHours = completed.reduce((sum, b) => sum + b.duration_hours, 0)
  const avgRating = 0 // Would come from cleaner profile

  const pending = bookings.filter(b => ['confirmed', 'in_progress'].includes(b.status))
  const pendingAmount = pending.reduce((sum, b) => sum + b.cleaner_payout, 0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Earnings</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total earned</p>
            <p className="text-2xl font-bold">{formatCurrency(totalEarned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Jobs completed</p>
            <p className="text-2xl font-bold">{completed.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hours worked</p>
            <p className="text-2xl font-bold">{totalHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pending payout</p>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending payouts */}
      {pending.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 text-base">Upcoming payouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm py-1">
                <div>
                  <span className="font-medium capitalize">{b.service_type.replace('_', ' ')}</span>
                  <span className="text-muted-foreground ml-2">{formatDate(b.scheduled_start)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookingStatusBadge status={b.status} />
                  <span className="font-semibold">{formatCurrency(b.cleaner_payout)}</span>
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
          {completed.length === 0 ? (
            <EmptyState title="No completed jobs yet" description="Earnings from completed jobs will appear here." />
          ) : (
            <div className="space-y-0">
              {completed.map((b, i) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-sm capitalize">{b.service_type.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(b.scheduled_start)} · {b.duration_hours}h · {b.city}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-700">+{formatCurrency(b.cleaner_payout)}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(b.hourly_rate)}/hr</p>
                    </div>
                  </div>
                  {i < completed.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Payouts are released 24 hours after job completion via Stripe.
      </p>
    </div>
  )
}
