'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageCircleMore } from 'lucide-react'
import { authApi, bookingsApi } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { Chat } from '@/components/chat'
import { SplitChatPageSkeleton } from '@/components/page-skeletons'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const CHAT_AVAILABLE = ['confirmed', 'in_progress', 'completed', 'disputed']

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

function ClientChatsPageContent() {
  const searchParams = useSearchParams()
  const bookingFromQuery = searchParams.get('booking')

  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [{ data }, userRes, meRes] = await Promise.all([
          bookingsApi.my(),
          createClient().auth.getUser(),
          authApi.me().catch(() => null),
        ])
        const now = Date.now()
        const CHAT_CUTOFF_MS = 30 * 60 * 1000 // 30 minutes after scheduled end
        const chatBookings = (data?.items ?? []).filter((b) => {
          if (!CHAT_AVAILABLE.includes(b.status)) return false
          // Hide chat 30 min after scheduled end (for completed/disputed)
          if (['completed', 'disputed'].includes(b.status) && b.scheduled_end) {
            const endTime = new Date(b.scheduled_end).getTime()
            if (now > endTime + CHAT_CUTOFF_MS) return false
          }
          return true
        })
        setBookings(chatBookings)

        const initialSelection =
          (bookingFromQuery && chatBookings.some((b) => b.id === bookingFromQuery) ? bookingFromQuery : null) ??
          chatBookings[0]?.id ??
          null
        setSelectedBookingId(initialSelection)
        setCurrentUserId(userRes.data.user?.id ?? meRes?.data?.id ?? null)
      } catch {
        toast.error('Failed to load chats.')
      } finally {
        setLoading(false)
      }
    })()
  }, [bookingFromQuery])

  const filtered = useMemo(() => {
    if (!query.trim()) return bookings
    const q = query.toLowerCase()
    return bookings.filter((b) => {
      const service = SERVICE_LABELS[b.service_type] ?? b.service_type
      const cleanerName = ((b as any)?.cleaner?.user?.name ?? '').toLowerCase()
      return (
        service.toLowerCase().includes(q) ||
        cleanerName.includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.postcode.toLowerCase().includes(q)
      )
    })
  }, [bookings, query])

  const selected = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  )

  if (loading) return <SplitChatPageSkeleton />

  if (!currentUserId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Unable to load your account for chat.
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="marketplace-title text-2xl">Chats</CardTitle>
          <p className="text-sm text-slate-500">Manage all your conversations with cleaners.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversation"
          />

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              No conversations yet.
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {filtered.map((b) => {
                const active = b.id === selectedBookingId
                const cleanerName = (b as any)?.cleaner?.user?.name ?? 'Cleaner'
                const cleanerImage = (b as any)?.cleaner?.profile_image_url
                const initial = cleanerName.charAt(0).toUpperCase()
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBookingId(b.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                      active
                        ? 'border-primary/30 bg-primary/10'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {cleanerImage ? (
                        <img src={cleanerImage} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">{initial}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{cleanerName}</p>
                        <p className="text-xs text-slate-500 truncate">{formatDate(b.scheduled_start)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {!selected ? (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center text-slate-500">
              <MessageCircleMore className="h-9 w-9 text-slate-300" />
              <p className="text-sm">Select a conversation to start chatting.</p>
            </div>
          ) : (
            <div className="p-3 md:p-4">
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{SERVICE_LABELS[selected.service_type] ?? selected.service_type}</p>
                <p className="text-xs text-slate-600">{(selected as any)?.cleaner?.user?.name ?? 'Cleaner'}</p>
                <p className="text-xs text-slate-500">{selected.city}, {selected.postcode} · {formatDate(selected.scheduled_start)}</p>
                <Link href={`/client/bookings/${selected.id}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                  Open booking details
                </Link>
              </div>
              <Chat bookingId={selected.id} currentUserId={currentUserId} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ClientChatsPage() {
  return (
    <Suspense fallback={<SplitChatPageSkeleton />}>
      <ClientChatsPageContent />
    </Suspense>
  )
}
