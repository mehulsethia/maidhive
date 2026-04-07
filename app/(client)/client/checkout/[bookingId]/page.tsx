'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { bookingsApi, paymentsApi } from '@/lib/api'
import { PriceBreakdownCard } from '@/components/price-breakdown-card'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Inner component — must live inside <Elements>
function CheckoutForm({ booking, onSuccess }: { booking: BookingRead; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      toast.error(error.message ?? 'Payment failed. Please try again.')
    } else {
      toast.success('Payment authorised! Your booking is confirmed.')
      onSuccess()
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!stripe || !elements}>
        Pay {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
      </Button>
    </form>
  )
}

export default function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const bookingRes = await bookingsApi.getById(bookingId)
        const b = bookingRes.data
        if (!b) throw new Error('Booking not found')
        if (b.status !== 'accepted') {
          toast.error('This booking cannot be paid right now.')
          router.push(`/client/bookings/${bookingId}`)
          return
        }
        setBooking(b)

        const intentRes = await paymentsApi.createIntent(bookingId)
        setClientSecret(intentRes.data?.client_secret ?? null)
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to initialise checkout')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [bookingId])

  if (loading) return <LoadingSpinner />
  if (!booking || !clientSecret) return <div className="text-center py-16 text-muted-foreground">Unable to load checkout.</div>

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Complete payment</h1>

      {/* Booking summary */}
      <Card>
        <CardHeader><CardTitle>Booking summary</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <BookingStatusBadge status={booking.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Scheduled</span>
            <span>{formatDate(booking.scheduled_start)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span>{booking.duration_hours}h</span>
          </div>
        </CardContent>
      </Card>

      <PriceBreakdownCard breakdown={{
        hourly_rate: booking.hourly_rate,
        duration_hours: booking.duration_hours,
        subtotal: booking.total_amount,
        platform_fee_pct: 15,
        platform_fee: booking.platform_fee,
        cleaner_payout: booking.cleaner_payout,
        total_amount: booking.total_amount,
      }} />

      {/* Stripe payment form */}
      <Card>
        <CardHeader><CardTitle>Payment details</CardTitle></CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <CheckoutForm booking={booking} onSuccess={() => router.push(`/client/bookings/${bookingId}`)} />
          </Elements>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Your card is authorised now. Payment is only captured after your job is completed.
      </p>
    </div>
  )
}
