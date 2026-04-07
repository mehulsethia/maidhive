'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { bookingsApi } from '@/lib/api'
import { BookingCard } from '@/components/booking-card'
import { EmptyState } from '@/components/empty-state'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { BookingRead, BookingStatus } from '@/types'
import { toast } from 'sonner'

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'accepted', 'confirmed', 'in_progress']
const PAST_STATUSES: BookingStatus[] = ['completed', 'cancelled', 'expired', 'disputed']

export default function ClientDashboard() {
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bookingsApi.my()
      .then(r => setBookings(r.data?.items ?? []))
      .catch(() => toast.error('Failed to load bookings'))
      .finally(() => setLoading(false))
  }, [])

  const active = bookings.filter(b => ACTIVE_STATUSES.includes(b.status))
  const past = bookings.filter(b => PAST_STATUSES.includes(b.status))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <Link href="/client/search">
          <Button>Book a cleaner</Button>
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Find a trusted cleaner and book your first appointment."
          action={
            <Link href="/client/search">
              <Button>Find cleaners</Button>
            </Link>
          }
        />
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active">
            {active.length === 0 ? (
              <EmptyState title="No active bookings" description="Your upcoming bookings will appear here." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {active.map(b => <BookingCard key={b.id} booking={b} viewAs="client" />)}
              </div>
            )}
          </TabsContent>
          <TabsContent value="past">
            {past.length === 0 ? (
              <EmptyState title="No past bookings" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map(b => <BookingCard key={b.id} booking={b} viewAs="client" />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
