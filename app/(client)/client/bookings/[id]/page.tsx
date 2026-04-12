'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Clock, MapPin } from 'lucide-react'
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
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

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
    bookingsApi.getById(id)
      .then(r => setBooking(r.data ?? null))
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

    paymentsApi.syncAuthorization(id)
      .then(() => refresh())
      .catch(() => {
        // If sync fails, webhook may still complete the transition shortly.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams])

  async function handleCancel() {
    if (!cancelReason.trim()) { toast.error('Please provide a cancellation reason.'); return }
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
  if (!booking) return <div className="text-center py-16 text-muted-foreground">Booking not found.</div>

  const canCancel = ['pending', 'accepted', 'confirmed'].includes(booking.status)
  const paymentStatus = booking.payment?.status ?? null
  const isAuthorized = ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
  const canAuthorize = ['pending', 'accepted'].includes(booking.status) && !isAuthorized
  const canComplete = booking.status === 'in_progress'
  const canReview = booking.status === 'completed'
  const chatCutoff = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime() + 30 * 60 * 1000
    : Infinity
  const showChat = CHAT_STATUSES.includes(booking.status) && Date.now() < chatCutoff

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="marketplace-title text-2xl text-slate-900">Booking details</h1>
        <BookingStatusBadge status={booking.status} />
      </div>

      {/* Job info */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <span className="font-semibold">{SERVICE_LABELS[booking.service_type]}</span>
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Special instructions</p>
                <p className="text-sm">{booking.special_instructions}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment */}
      <PriceBreakdownCard breakdown={{
        hourly_rate: booking.hourly_rate,
        duration_hours: booking.duration_hours,
        subtotal: booking.total_amount,
        platform_fee_pct: 10,
        platform_fee: booking.platform_fee,
        cleaner_payout: booking.cleaner_payout,
        total_amount: booking.total_amount,
      }} />

      {/* TTL warnings */}
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

      {/* Actions */}
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
          <Button variant="outline" onClick={() => setReviewOpen(true)}>Leave a review</Button>
        )}
        {canCancel && (
          <Button variant="destructive" onClick={() => setCancelOpen(true)}>Cancel booking</Button>
        )}
      </div>

      {/* Chat — only visible once booking is confirmed */}
      {showChat && currentUserId ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Messages</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Chat bookingId={id} currentUserId={currentUserId} />
          </CardContent>
        </Card>
      ) : !showChat ? (
        <p className="text-xs text-center text-muted-foreground">
          Chat will be available once the cleaner accepts and card authorization is confirmed.
        </p>
      ) : null}

      {/* Cancel dialog */}
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
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Why are you cancelling?" className="mt-1" rows={3} />
          </div>
          <Button onClick={handleCancel} variant="destructive" className="w-full" loading={actionLoading}>
            Confirm cancellation
          </Button>
        </div>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)}>
        <DialogTitle>Leave a review</DialogTitle>
        <div className="space-y-4">
          <div>
            <Label>Rating</Label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map(r => (
                <button key={r} type="button" onClick={() => setReviewRating(r)}
                  className={`h-10 w-10 rounded-full border-2 font-semibold text-sm transition-colors ${
                    r <= reviewRating ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-muted text-muted-foreground hover:border-yellow-300'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Comment (optional)</Label>
            <Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
              placeholder="How was the service?" className="mt-1" rows={3} />
          </div>
          <Button onClick={handleReview} className="w-full" loading={actionLoading}>Submit review</Button>
        </div>
      </Dialog>
    </div>
  )
}
