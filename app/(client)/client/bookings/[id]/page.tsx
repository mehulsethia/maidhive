'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react'
import { authApi, bookingsApi, paymentsApi, reviewsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { PriceBreakdownCard } from '@/components/price-breakdown-card'
import { Chat } from '@/components/chat'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

const CHAT_STATUSES = ['confirmed', 'in_progress', 'completed', 'disputed']

export default function ClientBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const refresh = () =>
    bookingsApi
      .getById(id)
      .then((response) => setBooking(response.data ?? null))
      .catch(() => toast.error('Failed to load booking'))
      .finally(() => setLoading(false))

  useEffect(() => {
    refresh()
    Promise.all([createClient().auth.getUser(), authApi.me().catch(() => null)]).then(([userRes, meRes]) => {
      setCurrentUserId(userRes.data.user?.id ?? meRes?.data?.id ?? null)
    })
  }, [id])

  useEffect(() => {
    const paymentFlag = searchParams.get('payment')
    if (paymentFlag !== 'authorized') return

    paymentsApi
      .syncAuthorization(id)
      .then(() => refresh())
      .catch(() => {
        // webhook may still complete the transition shortly
      })
  }, [id, searchParams])

  async function handleCancel() {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason.')
      return
    }
    setActionLoading(true)
    try {
      await bookingsApi.cancel(id, cancelReason)
      toast.success('Booking cancelled.')
      setCancelOpen(false)
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReview() {
    setActionLoading(true)
    try {
      await reviewsApi.create(id, { rating: reviewRating, comment: reviewComment || undefined })
      toast.success('Review submitted!')
      setReviewOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleComplete() {
    setActionLoading(true)
    try {
      await bookingsApi.complete(id)
      toast.success('Booking marked as completed.')
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <DetailPageSkeleton />
  if (!booking) return <div className="py-16 text-center text-muted-foreground">Booking not found.</div>

  const canCancel = ['pending', 'accepted', 'confirmed'].includes(booking.status)
  const paymentStatus = booking.payment?.status ?? null
  const isAuthorized = ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
  const canAuthorize = ['pending', 'accepted'].includes(booking.status) && !isAuthorized
  const canComplete = booking.status === 'in_progress'
  const canReview = booking.status === 'completed'
  const chatCutoff = booking.scheduled_end ? new Date(booking.scheduled_end).getTime() + 30 * 60 * 1000 : Infinity
  const showChat = CHAT_STATUSES.includes(booking.status) && Date.now() < chatCutoff

  return (
    <>
      <div className="client-booking-detail-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-7 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-10 lg:py-9">
            <div className="animate-stage-up space-y-4">
              <Button
                variant="outline"
                size="sm"
                className="w-fit rounded-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() => router.push('/client/bookings')}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to bookings
              </Button>
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Booking Detail
              </p>
              <h1 className={`${displayFont.className} text-4xl font-extrabold tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl`}>
                {SERVICE_LABELS[booking.service_type]}
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Manage actions, view payment breakdown, and continue chat for this booking.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Current Status
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <BookingStatusBadge status={booking.status} />
                  <p className={`${displayFont.className} text-xl font-bold tracking-[-0.02em] text-white`}>
                    {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-3 p-5">
                <span className={`${displayFont.className} text-xl font-semibold tracking-[-0.02em]`}>
                  Booking Information
                </span>
                <Separator />
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Calendar className="h-4 w-4" />{formatDate(booking.scheduled_start)}</p>
                  <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{booking.duration_hours} hours</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{booking.address}, {booking.city}, {booking.postcode}</p>
                </div>
                {booking.special_instructions && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Special instructions</p>
                      <p className="text-sm">{booking.special_instructions}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <PriceBreakdownCard
              breakdown={{
                hourly_rate: booking.hourly_rate,
                duration_hours: booking.duration_hours,
                subtotal: booking.total_amount,
                platform_fee_pct: 10,
                platform_fee: booking.platform_fee,
                cleaner_payout: booking.cleaner_payout,
                total_amount: booking.total_amount,
              }}
            />

            {showChat && currentUserId ? (
              <Card className="border-slate-200 bg-white/90">
                <CardHeader>
                  <CardTitle className="text-base">Messages</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Chat bookingId={id} currentUserId={currentUserId} />
                </CardContent>
              </Card>
            ) : !showChat ? (
              <p className="text-center text-xs text-muted-foreground">
                Chat will be available once the cleaner accepts and card authorization is confirmed.
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            {booking.status === 'pending' && booking.accept_by && (
              <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                {canAuthorize
                  ? 'Authorize your card to send this booking request to the cleaner.'
                  : `Waiting for cleaner to accept. Expires: ${formatDate(booking.accept_by)}`}
              </p>
            )}
            {booking.status === 'accepted' && canAuthorize && (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Authorize your card now to keep this booking active. Your card is reserved, not charged yet.
              </p>
            )}

            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-2 p-5">
                <p className={`${displayFont.className} text-lg font-semibold tracking-[-0.02em] text-slate-900`}>
                  Next actions
                </p>
                <div className="flex flex-col gap-2">
                  {canAuthorize && (
                    <Button size="lg" onClick={() => router.push(`/client/checkout/${id}`)}>
                      Authorize card
                    </Button>
                  )}
                  {canComplete && (
                    <Button size="lg" onClick={handleComplete} loading={actionLoading}>
                      Mark service complete
                    </Button>
                  )}
                  {canReview && (
                    <Button variant="outline" onClick={() => setReviewOpen(true)}>
                      Leave a review
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                      Cancel booking
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <DialogTitle>Cancel booking</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {booking.status === 'confirmed'
              ? 'Cancelling after payment may result in a partial or no refund depending on timing.'
              : 'Cancellation before payment is free.'}
          </p>
          <div>
            <Label>Reason</Label>
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Why are you cancelling?"
              className="mt-1"
              rows={3}
            />
          </div>
          <Button onClick={handleCancel} variant="destructive" className="w-full" loading={actionLoading}>
            Confirm cancellation
          </Button>
        </div>
      </Dialog>

      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)}>
        <DialogTitle>Leave a review</DialogTitle>
        <div className="space-y-4">
          <div>
            <Label>Rating</Label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setReviewRating(rating)}
                  className={`h-10 w-10 rounded-full border-2 text-sm font-semibold transition-colors ${
                    rating <= reviewRating
                      ? 'bg-yellow-400 border-yellow-400 text-white'
                      : 'border-muted text-muted-foreground hover:border-yellow-300'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Comment (optional)</Label>
            <Textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="How was the service?"
              className="mt-1"
              rows={3}
            />
          </div>
          <Button onClick={handleReview} className="w-full" loading={actionLoading}>
            Submit review
          </Button>
        </div>
      </Dialog>

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
            url('/images/hero-client.gif');
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
