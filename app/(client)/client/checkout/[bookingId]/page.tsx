'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { bookingsApi, paymentsApi } from '@/lib/api'
import { CheckoutPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

function CheckoutForm({ booking, onSuccess }: { booking: BookingRead; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'saved' | 'new'>('new')
  const [savedCards, setSavedCards] = useState<Array<{
    id: string
    brand: string
    last4: string
    exp_month: number | null
    exp_year: number | null
  }>>([])
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>('')

  useEffect(() => {
    paymentsApi.listMethods()
      .then((res) => {
        const cards = res.data ?? []
        setSavedCards(cards)
        if (cards.length > 0) {
          setMode('saved')
          setSelectedSavedCardId(cards[0].id)
        }
      })
      .catch(() => null)
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (mode === 'saved') {
      if (!selectedSavedCardId) {
        toast.error('Select a saved card or switch to add a new card.')
        return
      }
      setSubmitting(true)
      try {
        await paymentsApi.confirmWithSavedMethod(booking.id, selectedSavedCardId)
        toast.success('Saved card authorised. Your booking request is now sent to the cleaner.')
        onSuccess()
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to authorise saved card.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!stripe || !elements) return

    setSubmitting(true)
    const returnUrl = `${window.location.origin}/client/bookings/${booking.id}?payment=authorized`
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: returnUrl },
    })

    if (error) {
      toast.error(error.message ?? 'Payment failed. Please try again.')
    } else {
      try {
        await paymentsApi.syncAuthorization(booking.id)
      } catch {
        // webhook normally handles this; sync is fallback
      }
      toast.success('Card authorised. Your booking request is now sent to the cleaner.')
      onSuccess()
    }

    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2 rounded-xl border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-900">Payment option</p>
        {savedCards.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2">
            <input type="radio" name="pm-mode" checked={mode === 'saved'} onChange={() => setMode('saved')} className="mt-1" />
            <span className="text-sm text-slate-700">Use a previously saved card</span>
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2">
          <input type="radio" name="pm-mode" checked={mode === 'new'} onChange={() => setMode('new')} className="mt-1" />
          <span className="text-sm text-slate-700">Add and use a new card</span>
        </label>
      </div>

      {mode === 'saved' && savedCards.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          {savedCards.map((card) => (
            <label key={card.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-2">
              <input
                type="radio"
                name="saved-card"
                checked={selectedSavedCardId === card.id}
                onChange={() => setSelectedSavedCardId(card.id)}
              />
              <span className="text-sm text-slate-700">
                {card.brand.toUpperCase()} •••• {card.last4}
                {card.exp_month && card.exp_year ? ` (exp ${card.exp_month}/${card.exp_year})` : ''}
              </span>
            </label>
          ))}
        </div>
      )}

      {mode === 'new' && <PaymentElement />}
      <p className="text-sm font-medium text-slate-700">
        Your card will NOT be charged now. Payment is only captured after the job is completed.
      </p>
      <p className="text-xs text-slate-500">
        This request is valid for 24 hours. If not accepted, it will expire automatically and your card authorisation will be released.
      </p>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={submitting}
        disabled={mode === 'new' ? (!stripe || !elements) : !selectedSavedCardId}
      >
        Authorise {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
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
  const [showBreakdown, setShowBreakdown] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const bookingRes = await bookingsApi.getById(bookingId)
        const nextBooking = bookingRes.data
        if (!nextBooking) throw new Error('Booking not found')

        if (!['draft', 'pending', 'accepted'].includes(nextBooking.status)) {
          toast.error('This booking cannot be authorised right now.')
          router.push(`/client/bookings/${bookingId}`)
          return
        }

        setBooking(nextBooking)
        const intentRes = await paymentsApi.createIntent(bookingId)
        setClientSecret(intentRes.data?.client_secret ?? null)
      } catch (err: any) {
        toast.error(err.message ?? 'Failed to initialise card authorization')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [bookingId])

  if (loading) return <CheckoutPageSkeleton />
  if (!booking || !clientSecret) return <div className="py-16 text-center text-muted-foreground">Unable to load checkout.</div>

  return (
    <>
      <div className="client-checkout-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Secure Checkout
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Authorise Card
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Reserve payment securely now. Capture happens only after service completion and dispute window.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Total to authorise
                </p>
                <p className={`${displayFont.className} mt-1 text-4xl font-bold tracking-[-0.02em] text-white`}>
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
                </p>
                <p className="mt-1 text-sm text-white/80">Status: {booking.status.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-5xl">
          <Button
            variant="outline"
            size="sm"
            className="w-fit rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            onClick={() => router.push(`/client/bookings/${bookingId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to booking
          </Button>
        </div>

        <section className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/90">
              <CardHeader>
                <CardTitle>Booking summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <BookingStatusBadge status={booking.status} paymentStatus={booking.payment?.status} />
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

            <Card className="border-slate-200 bg-white/90">
              <CardHeader>
                <CardTitle>Total</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-2xl font-bold text-primary">
                  {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
                </p>
                <p className="text-xs text-slate-500">Includes secure booking &amp; support fee</p>
                <button
                  type="button"
                  onClick={() => setShowBreakdown((value) => !value)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {showBreakdown ? 'Hide price breakdown' : 'View price breakdown'}
                </button>
                {showBreakdown && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                    <p>
                      {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.hourly_rate)} × {booking.duration_hours}h ={' '}
                      {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
                        booking.subtotal ?? (booking.total_amount - booking.platform_fee),
                      )}
                    </p>
                    <p>
                      Secure booking &amp; support fee (10%) ={' '}
                      {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.platform_fee)}
                    </p>
                    <p className="font-semibold text-slate-900">
                      Total = {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 bg-white/90">
            <CardHeader>
              <CardTitle>Card authorisation</CardTitle>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                <CheckoutForm booking={booking} onSuccess={() => router.push(`/client/bookings/${bookingId}`)} />
              </Elements>
            </CardContent>
          </Card>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Your card will NOT be charged now. Payment is only captured after the job is completed.
        </p>
      </div>

      <style jsx>{`
        .client-stage {
          position: relative;
          isolation: isolate;
          background: linear-gradient(125deg, #04162f 8%, #0f3b76 58%, #0e5698);
        }

        .client-stage__media {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(105deg, rgba(2, 11, 27, 0.82) 10%, rgba(2, 11, 27, 0.5) 55%, rgba(8, 22, 44, 0.72) 100%),
            radial-gradient(circle at 82% 18%, rgba(56, 220, 255, 0.24), transparent 34%),
            repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0 2px, rgba(255, 255, 255, 0) 2px 12px);
          background-size: cover;
          background-position: center;
          mix-blend-mode: screen;
          opacity: 0.9;
        }

        .client-stage__grain {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0) 45%),
            radial-gradient(circle at 18% 22%, rgba(56, 220, 255, 0.22), transparent 28%),
            radial-gradient(circle at 82% 12%, rgba(244, 180, 0, 0.2), transparent 22%);
          animation: hero-sweep 11s ease-in-out infinite;
          pointer-events: none;
        }

        .animate-stage-up {
          animation: stage-up 0.72s cubic-bezier(0.18, 0.82, 0.3, 1) both;
        }

        .delay-120 {
          animation-delay: 120ms;
        }

        @keyframes stage-up {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes hero-sweep {
          0%,
          100% {
            transform: translateX(0%);
            opacity: 1;
          }
          50% {
            transform: translateX(1.8%);
            opacity: 0.88;
          }
        }
      `}</style>
    </>
  )
}
