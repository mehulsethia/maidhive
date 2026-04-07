import Link from 'next/link'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

interface BookingCardProps {
  booking: BookingRead
  viewAs?: 'client' | 'cleaner'
}

export function BookingCard({ booking, viewAs = 'client' }: BookingCardProps) {
  const basePath = viewAs === 'client' ? '/client' : '/cleaner'

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">{SERVICE_LABELS[booking.service_type] ?? booking.service_type}</span>
              <BookingStatusBadge status={booking.status} />
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {formatDate(booking.scheduled_start)}
              </p>
              <p className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {booking.duration_hours}h
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {booking.city}, {booking.postcode}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="font-bold text-lg">{formatCurrency(booking.total_amount)}</p>
            {viewAs === 'cleaner' && (
              <p className="text-xs text-muted-foreground">
                You earn {formatCurrency(booking.cleaner_payout)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Link href={`${basePath}/bookings/${booking.id}`}>
            <Button variant="outline" size="sm" className="w-full">View details</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
