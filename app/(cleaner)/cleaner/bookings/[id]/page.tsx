'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, MapPin, ArrowLeft } from 'lucide-react'
import { authApi, bookingsApi } from '@/lib/api'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { Chat } from '@/components/chat'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { getCleanerProposalEligibility, toIsoFromDateTimeLocal } from '@/lib/booking-proposal'
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

export default function CleanerBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<BookingRead | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [proposalOpen, setProposalOpen] = useState(false)
  const [proposedStart, setProposedStart] = useState('')

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

  async function handleAction(action: 'start') {
    setActionLoading(true)
    try {
      let startLocation:
        | {
            latitude: number
            longitude: number
            accuracy_m?: number
          }
        | undefined

      if (action === 'start' && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 7000,
              maximumAge: 60000,
            })
          })
          startLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_m: position.coords.accuracy,
          }
        } catch {
          // Start Cleaning must remain available even when GPS is unavailable.
        }
      }

      await bookingsApi.action(id, action, undefined, startLocation)
      toast.success('Job started!')
      await refresh()
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
      toast.success('Job completed.')
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) { toast.error('Please provide a reason.'); return }
    setActionLoading(true)
    try {
      await bookingsApi.cancel(id, cancelReason)
      toast.success('Booking declined.')
      setCancelOpen(false)
      router.push('/cleaner/dashboard')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleBookingAction(
    action: 'accept' | 'propose_alternative' | 'accept_proposal' | 'decline_proposal',
    customProposedStart?: string,
  ) {
    setActionLoading(true)
    try {
      await bookingsApi.action(id, action, customProposedStart)
      const labels: Record<string, string> = {
        accept: 'Booking accepted.',
        propose_alternative: 'Alternative time sent to client.',
        accept_proposal: 'Counter-offer accepted. Booking confirmed.',
        decline_proposal: 'Counter-offer declined. Request closed.',
      }
      toast.success(labels[action])
      if (action === 'propose_alternative') {
        setProposalOpen(false)
        setProposedStart('')
      }
      await refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <DetailPageSkeleton />
  if (!booking) return <div className="text-center py-16 text-muted-foreground">Booking not found.</div>

  const {
    isPending,
    hasProposal,
    isCleanerProposal,
    canProposeAlternative,
    proposeAlternativeDisabledReason,
    canAcceptPending,
    canRespondToCounter,
  } = getCleanerProposalEligibility(booking)

  const chatCutoff = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime() + 30 * 60 * 1000
    : Infinity
  const showChat = CHAT_STATUSES.includes(booking.status) && Date.now() < chatCutoff
  const completeOpensAt = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime() - 5 * 60 * 1000
    : Infinity
  const canCompleteJob = ['in_progress', 'disputed'].includes(booking.status) &&
    Boolean(booking.started_at) &&
    Date.now() >= completeOpensAt

  return (
    <div className="w-full space-y-5">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center justify-end">
        <BookingStatusBadge status={booking.status} />
      </div>

      {/* Job info */}
      <Card>
        <CardContent className="space-y-3 px-5 pb-5 pt-6">
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Special instructions</p>
              <p className="text-sm">{booking.special_instructions}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Earnings */}
      <Card>
        <CardContent className="px-5 pb-5 pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">Total booking amount</p>
              <p className="font-semibold text-slate-900">{formatCurrency(booking.total_amount)}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">App commission deducted</p>
              <p className="font-semibold text-amber-700">- {formatCurrency(booking.platform_fee)}</p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your payout</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(booking.cleaner_payout)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Released 24h after job completion</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{formatCurrency(booking.hourly_rate)}/hr</p>
                <p>{booking.duration_hours}h</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {booking.status === 'pending' && hasProposal && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {isCleanerProposal
              ? 'You proposed a new time. Waiting for client response.'
              : `Client countered with ${formatDate(booking.proposed_start!)}. Accept or decline before request expiry.`}
          </p>
        )}
        {canAcceptPending && (
          <>
            <Button size="lg" onClick={() => handleBookingAction('accept')} loading={actionLoading}>
              Accept booking
            </Button>
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>Decline</Button>
          </>
        )}
        {canProposeAlternative && (
          <Button variant="outline" onClick={() => setProposalOpen(true)} disabled={actionLoading}>
            Propose alternative time
          </Button>
        )}
        {isPending && !canProposeAlternative && !canRespondToCounter && proposeAlternativeDisabledReason && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {proposeAlternativeDisabledReason}
          </p>
        )}
        {canRespondToCounter && (
          <>
            <Button size="lg" onClick={() => handleBookingAction('accept_proposal')} loading={actionLoading}>
              Accept counter-offer
            </Button>
            <Button variant="destructive" onClick={() => handleBookingAction('decline_proposal')} loading={actionLoading}>
              Decline counter-offer
            </Button>
          </>
        )}
        {(booking.status === 'accepted' || booking.status === 'confirmed') && (
          <Button size="lg" onClick={() => handleAction('start')} loading={actionLoading}>
            Start job
          </Button>
        )}
        {booking.status === 'in_progress' && !canCompleteJob && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Complete Job unlocks 5 minutes before the scheduled end time.
          </p>
        )}
        {canCompleteJob && (
          <Button size="lg" onClick={handleComplete} loading={actionLoading}>
            Complete Job
          </Button>
        )}
      </div>

      {/* Chat */}
      {showChat && currentUserId ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Messages</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Chat bookingId={id} currentUserId={currentUserId} />
          </CardContent>
        </Card>
      ) : !showChat ? (
        <p className="text-xs text-center text-muted-foreground">
          Chat becomes available once booking is confirmed.
        </p>
      ) : null}

      {/* Decline dialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <DialogTitle>Decline booking</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Declining a booking may result in a strike if done close to the scheduled time.</p>
          <div>
            <Label>Reason</Label>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Why can't you take this job?" className="mt-1" rows={3} />
          </div>
          <Button onClick={handleCancel} variant="destructive" className="w-full" loading={actionLoading}>
            Decline booking
          </Button>
        </div>
      </Dialog>

      <Dialog open={proposalOpen} onClose={() => setProposalOpen(false)}>
        <DialogTitle>Propose alternative time</DialogTitle>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can propose one alternative time for bookings scheduled more than 24 hours away.
          </p>
          <div>
            <Label>Proposed start time</Label>
            <Input
              type="datetime-local"
              value={proposedStart}
              onChange={(e) => setProposedStart(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const proposedStartIso = toIsoFromDateTimeLocal(proposedStart)
              if (!proposedStartIso) {
                toast.error('Select a valid proposed start time.')
                return
              }
              handleBookingAction('propose_alternative', proposedStartIso)
            }}
            disabled={!proposedStart}
            loading={actionLoading}
          >
            Send proposal
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
