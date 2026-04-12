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

  async function handleAction(action: 'accept' | 'start') {
    setActionLoading(true)
    try {
      await bookingsApi.action(id, action)
      const labels = { accept: 'Booking accepted!', start: 'Job started!' }
      toast.success(labels[action])
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

  if (loading) return <DetailPageSkeleton />
  if (!booking) return <div className="text-center py-16 text-muted-foreground">Booking not found.</div>

  const chatCutoff = booking.scheduled_end
    ? new Date(booking.scheduled_end).getTime() + 30 * 60 * 1000
    : Infinity
  const showChat = CHAT_STATUSES.includes(booking.status) && Date.now() < chatCutoff

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="marketplace-title text-2xl text-slate-900">Job details</h1>
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Special instructions</p>
              <p className="text-sm">{booking.special_instructions}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Earnings */}
      <Card>
        <CardContent className="p-5">
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
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {booking.status === 'pending' && (
          <>
            <Button size="lg" onClick={() => handleAction('accept')} loading={actionLoading}>
              Accept booking
            </Button>
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>Decline</Button>
          </>
        )}
        {(booking.status === 'accepted' || booking.status === 'confirmed') && (
          <Button size="lg" onClick={() => handleAction('start')} loading={actionLoading}>
            Start job
          </Button>
        )}
        {booking.status === 'in_progress' && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Waiting for the client to mark this booking as completed.
          </p>
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
          Chat becomes available once payment is confirmed.
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
    </div>
  )
}
