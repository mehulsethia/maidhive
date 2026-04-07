'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Play, ThumbsUp } from 'lucide-react'
import { bookingsApi } from '@/lib/api'
import { BookingCard } from '@/components/booking-card'
import { EmptyState } from '@/components/empty-state'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const INCOMING: BookingStatus[] = ['pending']
const UPCOMING: BookingStatus[] = ['confirmed', 'accepted']
const ACTIVE: BookingStatus[] = ['in_progress']
const PAST: BookingStatus[] = ['completed', 'cancelled', 'expired', 'disputed']

export default function CleanerDashboard() {
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const refresh = () =>
    bookingsApi.my()
      .then(r => setBookings(r.data?.items ?? []))
      .catch(() => toast.error('Failed to load jobs'))
      .finally(() => setLoading(false))

  useEffect(() => { refresh() }, [])

  async function handleAction(bookingId: string, action: 'accept' | 'start' | 'complete') {
    setActionLoading(bookingId + action)
    try {
      await bookingsApi.action(bookingId, action)
      toast.success(`Booking ${action === 'accept' ? 'accepted' : action === 'start' ? 'started' : 'completed'}!`)
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const incoming = bookings.filter(b => INCOMING.includes(b.status))
  const upcoming = bookings.filter(b => UPCOMING.includes(b.status))
  const active = bookings.filter(b => ACTIVE.includes(b.status))
  const past = bookings.filter(b => PAST.includes(b.status))

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Jobs</h1>

      {/* Active job banner */}
      {active.map(b => (
        <Card key={b.id} className="mb-6 border-primary border-2 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-semibold text-sm">Job in progress</span>
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(b.scheduled_start)} · {b.city}</p>
                <p className="text-sm font-medium mt-1">Earn {formatCurrency(b.cleaner_payout)}</p>
              </div>
              <Button
                size="sm"
                onClick={() => handleAction(b.id, 'complete')}
                loading={actionLoading === b.id + 'complete'}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark complete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Tabs defaultValue="incoming">
        <TabsList>
          <TabsTrigger value="incoming">
            New requests {incoming.length > 0 && <span className="ml-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">{incoming.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="incoming">
          {incoming.length === 0 ? (
            <EmptyState title="No new requests" description="New booking requests will appear here." />
          ) : (
            <div className="space-y-4">
              {incoming.map(b => (
                <Card key={b.id} className="border-yellow-200">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold capitalize">{b.service_type.replace('_', ' ')}</span>
                          <BookingStatusBadge status={b.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{formatDate(b.scheduled_start)}</p>
                        <p className="text-sm text-muted-foreground">{b.city}, {b.postcode} · {b.duration_hours}h</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg">{formatCurrency(b.cleaner_payout)}</p>
                        <p className="text-xs text-muted-foreground">your payout</p>
                      </div>
                    </div>
                    {b.special_instructions && (
                      <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 mb-3">
                        "{b.special_instructions}"
                      </p>
                    )}
                    {b.accept_by && (
                      <p className="text-xs text-yellow-700 mb-3">Accept by: {formatDate(b.accept_by)}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAction(b.id, 'accept')}
                        loading={actionLoading === b.id + 'accept'}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={async () => {
                          try {
                            await bookingsApi.cancel(b.id, 'Cleaner declined')
                            await refresh()
                          } catch (err: any) {
                            toast.error(err.message)
                          }
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming jobs" description="Accepted bookings will appear here." />
          ) : (
            <div className="space-y-4">
              {upcoming.map(b => (
                <Card key={b.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold capitalize">{b.service_type.replace('_', ' ')}</span>
                          <BookingStatusBadge status={b.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{formatDate(b.scheduled_start)}</p>
                        <p className="text-sm text-muted-foreground">{b.address}, {b.city}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(b.cleaner_payout)}</p>
                        <p className="text-xs text-muted-foreground">your payout</p>
                      </div>
                    </div>
                    {b.status === 'confirmed' && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleAction(b.id, 'start')}
                        loading={actionLoading === b.id + 'start'}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start job
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {past.length === 0 ? (
            <EmptyState title="No past jobs" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {past.map(b => <BookingCard key={b.id} booking={b} viewAs="cleaner" />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
