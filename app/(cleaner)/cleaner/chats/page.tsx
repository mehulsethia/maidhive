'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageCircleMore } from 'lucide-react'
import { authApi, bookingsApi } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { Chat } from '@/components/chat'
import { SplitChatPageSkeleton } from '@/components/page-skeletons'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/user-avatar'
import { isChatActiveForBooking, isChatReadOnly } from '@/lib/chat-window'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'

const SERVICE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

function resolveJobTypeTitle(booking: BookingRead) {
  const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
  const snapshotJobType = snapshotMatch?.[1]?.trim()
  if (snapshotJobType) return snapshotJobType
  return SERVICE_LABELS[booking.service_type] ?? booking.service_type
}

export default function CleanerChatsPage() {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<BookingRead[]>([])
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [bookingsRes, userRes, meRes] = await Promise.allSettled([
          bookingsApi.my(),
          createClient().auth.getUser(),
          authApi.me(),
        ])

        if (bookingsRes.status === 'fulfilled') {
          const chatBookings = (bookingsRes.value.data?.items ?? []).filter((b) => {
            return isChatActiveForBooking(b)
          })
          setBookings(chatBookings)
          setSelectedBookingId(chatBookings[0]?.id ?? null)
          resetLoadError('cleaner-chats')
        } else {
          reportLoadError('cleaner-chats', 'Failed to load chats.')
        }

        const supabaseUserId =
          userRes.status === 'fulfilled' ? userRes.value.data.user?.id : null
        const apiUserId =
          meRes.status === 'fulfilled' ? meRes.value.data?.id : null
        setCurrentUserId(supabaseUserId ?? apiUserId ?? null)
      } catch {
        reportLoadError('cleaner-chats', 'Failed to load chats.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return bookings
    const q = query.toLowerCase()
    return bookings.filter((b) => {
      const service = resolveJobTypeTitle(b)
      const clientName = ((b as any)?.client?.user?.name ?? '').toLowerCase()
      return (
        service.toLowerCase().includes(q) ||
        clientName.includes(q) ||
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
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Unable to load your account for chat. Please try refreshing the page.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:h-[calc(100vh-12.5rem)] md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
      <Card className="border-slate-200 md:h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Conversations</CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col space-y-3">
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
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {filtered.map((b) => {
                const active = b.id === selectedBookingId
                const clientName = (b as any)?.client?.user?.name ?? 'Client'
                const clientImage = (b as any)?.client?.user?.avatar_url as string | undefined
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
                      <UserAvatar
                        name={clientName}
                        imageUrl={clientImage}
                        className="h-10 w-10 shrink-0"
                        textClassName="text-sm font-bold"
                        fallbackClassName="bg-primary/10 text-primary"
                        fallback="C"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{clientName}</p>
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

      <Card className="border-slate-200 md:h-full">
        <CardContent className="h-full p-0">
          {!selected ? (
            <div className="flex h-full min-h-[22rem] flex-col items-center justify-center gap-3 text-center text-slate-500 sm:min-h-[26rem] md:min-h-0">
              <MessageCircleMore className="h-9 w-9 text-slate-300" />
              <p className="text-sm">Select a conversation to start chatting.</p>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col p-3 md:p-4">
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{resolveJobTypeTitle(selected)}</p>
                <p className="text-xs text-slate-500">{selected.city}, {selected.postcode} · {formatDate(selected.scheduled_start)}</p>
                <Link href={`/cleaner/bookings/${selected.id}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                  Open booking details
                </Link>
              </div>
              <div className="min-h-0 flex-1">
                <Chat
                  bookingId={selected.id}
                  currentUserId={currentUserId}
                  fullHeight
                  readOnly={isChatReadOnly(selected.scheduled_end)}
                  readOnlyMessage="Chat closes 30 minutes after the scheduled end time."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
