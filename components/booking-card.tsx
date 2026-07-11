import Link from 'next/link'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { CancellationPaymentBreakdown } from '@/components/cancellation-payment-breakdown'
import { isCompletedBookingReleased } from '@/lib/booking-release'
import { getCleanerPayoutSummary } from '@/lib/cleaner-payout'
import { getClientPaymentSummary } from '@/lib/client-payment-summary'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { getCancellationOriginLabel } from '@/lib/cancellation-origin'

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
  const payoutReleased = isCompletedBookingReleased({
    status: booking.status,
    paymentStatus: booking.payment?.status,
    transferredAt: booking.payment?.transferred_at,
    scheduledEnd: booking.scheduled_end,
  })
  const payoutSummary = getCleanerPayoutSummary(booking)
  const clientPaymentSummary = getClientPaymentSummary(booking)
  const showProjectedEarnings =
    booking.status === 'confirmed' ||
    booking.status === 'in_progress' ||
    (booking.status === 'completed' && !payoutReleased)
  const earningsLabel = payoutReleased
    ? 'You earned'
    : booking.status === 'disputed'
      ? 'Payout pending review'
      : showProjectedEarnings
      ? 'You will earn'
      : 'Booking value'

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">{SERVICE_LABELS[booking.service_type] ?? booking.service_type}</span>
              <BookingStatusBadge
                status={booking.status}
                paymentStatus={booking.payment?.status}
                transferredAt={booking.payment?.transferred_at}
                scheduledEnd={booking.scheduled_end}
                proposalBy={booking.proposal_by}
                showPaymentRequiredForUnpaid={viewAs !== 'cleaner'}
                audience={viewAs}
              />
              {viewAs === 'client' && getCancellationOriginLabel(booking) && (
                <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                  {getCancellationOriginLabel(booking)}
                </span>
              )}
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
            {booking.status === 'cancelled' ? (
              <CancellationPaymentBreakdown booking={booking} compact />
            ) : viewAs === 'client' && clientPaymentSummary.hasRefund ? (
              <div className="space-y-0.5">
                <p className="font-bold text-lg">{formatCurrency(clientPaymentSummary.finalAmountPaid)}</p>
                <p className="text-xs font-medium text-emerald-700">Refunded {formatCurrency(clientPaymentSummary.refundAmount)}</p>
              </div>
            ) : (
              <p className="font-bold text-lg">{formatCurrency(booking.total_amount)}</p>
            )}
            {viewAs === 'cleaner' && booking.status !== 'cancelled' && (
              <p className="text-xs text-muted-foreground">
                {earningsLabel} {formatCurrency(payoutSummary.finalCleanerPayout)}
              </p>
            )}
            {viewAs === 'cleaner' && booking.status === 'disputed' && (
              <p className="text-xs text-amber-700">Payout paused pending dispute resolution.</p>
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
