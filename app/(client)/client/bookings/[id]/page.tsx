'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react'
import { authApi, availabilityApi, bookingsApi, paymentsApi, reviewsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { BookingInstructions } from '@/components/booking-instructions'
import { PriceBreakdownCard } from '@/components/price-breakdown-card'
import { Chat } from '@/components/chat'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toDateInputValue, toIsoFromDateAndTimeLocal, toTimeInputValue } from '@/lib/booking-proposal'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { isChatActiveForBooking, isChatReadOnly } from '@/lib/chat-window'
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

function isPaymentAuthorized(paymentStatus?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
}

export default function ClientBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterDate, setCounterDate] = useState('')
  const [counterTime, setCounterTime] = useState('')
  const [counterTimeOptions, setCounterTimeOptions] = useState<Array<{ value: string; label: string }>>([])
  const [phoneRevealed, setPhoneRevealed] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

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

  useEffect(() => {
    if (!booking || !counterOpen || !counterDate) {
      setCounterTimeOptions([])
      return
    }

    availabilityApi
      .getSlots(booking.cleaner_id, counterDate, booking.duration_hours)
      .then((res) => {
        const options = (res.data ?? [])
          .filter((slot) => !slot.disabled)
          .map((slot) => {
            const start = new Date(slot.start)
            const value = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
            const label = start.toLocaleTimeString('en-IE', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
            return { value, label }
          })
        setCounterTimeOptions(options)
        if (!options.some((o) => o.value === counterTime)) {
          setCounterTime(options[0]?.value ?? '')
        }
      })
      .catch(() => {
        setCounterTimeOptions([])
        setCounterTime('')
      })
  }, [booking, counterOpen, counterDate, counterTime])

  useEffect(() => {
    setPhoneRevealed(false)
  }, [booking?.id, booking?.status, booking?.cleaner?.user?.phone])

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

  async function handleBookingAction(
    action: 'accept_proposal' | 'decline_proposal' | 'counter_proposal',
    proposedStart?: string,
  ) {
    setActionLoading(true)
    try {
      await bookingsApi.action(id, action, proposedStart)
      const labels: Record<string, string> = {
        accept_proposal: 'Proposed time accepted. Booking confirmed.',
        decline_proposal: 'Proposal declined. Request closed.',
        counter_proposal: 'Counter-offer sent to cleaner.',
      }
      toast.success(labels[action])
      if (action === 'counter_proposal') {
        setCounterOpen(false)
        setCounterDate('')
        setCounterTime('')
        setCounterTimeOptions([])
      }
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancelRequest() {
    setActionLoading(true)
    try {
      await bookingsApi.cancel(id, 'Cancelled by client while pending cleaner acceptance')
      if (booking?.cleaner_id) {
        await bookingsApi.clearFlowDraft(booking.cleaner_id).catch(() => null)
      }
      toast.success('Booking request cancelled')
      setCancelConfirmOpen(false)
      await refresh()
      router.push('/client/bookings')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel booking request')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <DetailPageSkeleton />
  if (!booking) return <div className="py-16 text-center text-muted-foreground">Booking not found.</div>

  const paymentStatus = booking.payment?.status ?? null
  const isAuthorized = ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
  const canAuthorize = ['draft', 'pending', 'accepted'].includes(booking.status) && !isAuthorized
  const canReview = Boolean(booking.completed_at) && ['completed', 'disputed'].includes(booking.status)
  const isPending = booking.status === 'pending'
  const hasProposal = Boolean(booking.proposed_start && booking.proposal_by)
  const cleanerProposed = booking.proposal_by === 'cleaner'
  const moreThan24HoursAway = new Date(booking.scheduled_start).getTime() - Date.now() > 24 * 60 * 60 * 1000
  const canCounterProposal = isPending && cleanerProposed && (booking.client_proposals ?? 0) < 1 && moreThan24HoursAway
  const showChat = isChatActiveForBooking(booking)
  const chatIsReadOnly = isChatReadOnly(booking.scheduled_end)
  const sixHoursBeforeStart = Date.now() >= new Date(booking.scheduled_start).getTime() - 6 * 60 * 60 * 1000
  const canRevealCleanerPhone =
    ['confirmed', 'in_progress', 'completed', 'disputed'].includes(booking.status) &&
    sixHoursBeforeStart
  const cleanerPhone = booking.cleaner?.user?.phone ?? ''

  return (
    <>
      <div className="client-booking-detail-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Booking Detail
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                {SERVICE_LABELS[booking.service_type]}
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Manage actions, review booking details, and continue chat for this booking.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Current Status
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <BookingStatusBadge status={booking.status} paymentStatus={booking.payment?.status} />
                  <p className={`${displayFont.className} text-xl font-bold tracking-[-0.02em] text-white`}>
                    {new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            onClick={() => router.push('/client/bookings')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to bookings
          </Button>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-3 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                <h2 className={`${displayFont.className} text-xl font-semibold tracking-[-0.02em]`}>
                  Booking Information
                </h2>
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
                      <BookingInstructions value={booking.special_instructions} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <PriceBreakdownCard
              breakdown={{
                hourly_rate: booking.hourly_rate,
                duration_hours: booking.duration_hours,
                subtotal: booking.subtotal ?? booking.total_amount - booking.platform_fee,
                platform_fee_pct: 10,
                platform_fee: booking.platform_fee,
                cleaner_payout: booking.cleaner_payout,
                total_amount: booking.total_amount,
              }}
            />

          </div>

          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-2 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                <h2 className={`${displayFont.className} text-lg font-semibold tracking-[-0.02em] text-slate-900`}>
                  Cleaner contact
                </h2>
                {canRevealCleanerPhone ? (
                  cleanerPhone ? (
                    phoneRevealed ? (
                      <p className="text-sm text-slate-600">{cleanerPhone}</p>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setPhoneRevealed(true)}>
                        Reveal number
                      </Button>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">Cleaner phone is not available yet.</p>
                  )
                ) : (
                  <p className="text-sm text-slate-500">Chat becomes available once the booking is confirmed. Cleaner phone number is revealed 6 hours before the booking start time.</p>
                )}
              </CardContent>
            </Card>

            {isPending && hasProposal && (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Cleaner proposed {formatDate(booking.proposed_start!)}. Accept, decline, or counter once before expiry.
              </p>
            )}
            {booking.status === 'pending' && booking.accept_by && (
              <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                {canAuthorize
                  ? 'Authorise your card to send this booking request to the cleaner.'
                  : 'This request is valid for 24 hours. If not accepted, it will expire automatically and your card authorisation will be released.'}
              </p>
            )}
            {booking.status === 'accepted' && canAuthorize && (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Authorise your card now to keep this booking active. Your card is reserved, not charged yet.
              </p>
            )}

            <Card className="border-slate-200 bg-white/90">
              <CardContent className="space-y-2 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                <h2 className={`${displayFont.className} text-lg font-semibold tracking-[-0.02em] text-slate-900`}>
                  Next actions
                </h2>
                <div className="flex flex-col gap-2">
                  {isPending && cleanerProposed && (
                    <>
                      <Button size="lg" onClick={() => handleBookingAction('accept_proposal')} loading={actionLoading}>
                        Accept proposed time
                      </Button>
                      {canCounterProposal && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            const seed = booking.proposed_start ?? booking.scheduled_start
                            setCounterDate(toDateInputValue(seed))
                            setCounterTime(toTimeInputValue(seed))
                            setCounterOpen(true)
                          }}
                        >
                          Counter once with another time
                        </Button>
                      )}
                      <Button variant="destructive" onClick={() => handleBookingAction('decline_proposal')} loading={actionLoading}>
                        Decline proposal
                      </Button>
                    </>
                  )}
                  {canAuthorize && (
                    <Button size="lg" onClick={() => router.push(`/client/checkout/${id}`)}>
                      Authorise card
                    </Button>
                  )}
                  {(booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorized(booking.payment?.status))) && (
                    <>
                      <Button variant="outline" onClick={() => router.push(`/client/book/${booking.cleaner_id}?continue=1&bookingId=${booking.id}&step=3`)}>
                        Continue payment in booking flow
                      </Button>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Need to change something? Cancel this draft and start a new booking.
                      </p>
                    </>
                  )}
                  {(booking.status === 'draft' || booking.status === 'pending') && (
                    <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setCancelConfirmOpen(true)}>
                      {booking.status === 'draft' ? 'Cancel draft' : 'Cancel request'}
                    </Button>
                  )}
                  {booking.status === 'expired' && (
                    <>
                      <Button onClick={() => router.push(`/client/book/${booking.cleaner_id}?reset=1&step=1`)}>
                        Book again
                      </Button>
                      <Button variant="outline" onClick={() => router.push('/client/cleaners')}>
                        Choose another cleaner
                      </Button>
                    </>
                  )}
                  {booking.status === 'in_progress' && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Cleaner can complete this job from 5 minutes before scheduled end time.
                    </p>
                  )}
                  {canReview && (
                    <Button variant="outline" onClick={() => setReviewOpen(true)}>
                      Leave a review
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {showChat && currentUserId ? (
              <Card className="border-slate-200 bg-white/90">
                <CardHeader>
                  <CardTitle className="text-base">Messages</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Chat
                    bookingId={id}
                    currentUserId={currentUserId}
                    readOnly={chatIsReadOnly}
                    readOnlyMessage="Chat closes 30 minutes after the scheduled end time."
                    autoScroll={false}
                  />
                </CardContent>
              </Card>
            ) : !showChat ? (
              <p className="text-center text-xs text-muted-foreground">
                Chat is available for confirmed bookings and closes 30 minutes after scheduled end.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <Dialog
        open={counterOpen}
        onClose={() => {
          setCounterOpen(false)
          setCounterDate('')
          setCounterTime('')
          setCounterTimeOptions([])
        }}
      >
        <DialogTitle>Counter with one new time</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can counter once. Cleaner will then only be able to accept or decline.
          </p>
          <div>
            <Label>Counter start time</Label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Input
                type="date"
                value={counterDate}
                onChange={(e) => setCounterDate(e.target.value)}
              />
              <select
                value={counterTime}
                onChange={(e) => setCounterTime(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>{counterDate ? 'Select time' : 'Select date first'}</option>
                {counterTimeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-500">Only valid availability slots are shown for the selected date and duration.</p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const iso = toIsoFromDateAndTimeLocal(counterDate, counterTime)
              if (!iso) {
                toast.error('Select a valid date and time.')
                return
              }
              handleBookingAction('counter_proposal', iso)
            }}
            disabled={!counterDate || !counterTime}
            loading={actionLoading}
          >
            Send counter-offer
          </Button>
        </div>
      </Dialog>

      <Dialog open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)}>
        <DialogTitle>Cancel booking request</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Are you sure you want to cancel this request?</p>
          <div className="flex gap-2">
            <Button variant="outline" className="w-full" onClick={() => setCancelConfirmOpen(false)} disabled={actionLoading}>
              Keep request
            </Button>
            <Button variant="destructive" className="w-full" onClick={handleCancelRequest} loading={actionLoading}>
              Cancel request
            </Button>
          </div>
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
