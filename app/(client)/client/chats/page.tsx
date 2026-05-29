'use client'

import { Suspense, useDeferredValue, useEffect, useRef, useState, startTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { MessageCircleMore, Search } from 'lucide-react'
import { authApi, bookingsApi } from '@/lib/api'
import { Chat } from '@/components/chat'
import { SplitChatPageSkeleton } from '@/components/page-skeletons'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/user-avatar'
import { compareConversationsByOperationalPriority } from '@/lib/booking-priority'
import { canViewChatHistoryForBooking, getChatReadOnlyMessage, isChatReadOnly } from '@/lib/chat-window'
import { recoverBookingsFromNotifications } from '@/lib/booking-data-recovery'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { setupVisiblePolling } from '@/lib/visible-polling'
import { formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

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
  const [chatLoadError, setChatLoadError] = useState<string | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const recoveryAttemptedRef = useRef(false)

  async function loadChats() {
    try {
      const [bookingsRes, meRes] = await Promise.allSettled([
        bookingsApi.my(),
        authApi.me().catch(() => null),
      ])

      const data = bookingsRes.status === 'fulfilled' ? bookingsRes.value?.data : null
      const me = meRes.status === 'fulfilled' ? meRes.value : null
      const primaryBookings = data?.items ?? []
      let fallbackBookings: BookingRead[] = []
      if (primaryBookings.length === 0 && !recoveryAttemptedRef.current) {
        recoveryAttemptedRef.current = true
        fallbackBookings = await recoverBookingsFromNotifications().catch(() => [])
      }

      const chatBookings = (primaryBookings.length > 0 ? primaryBookings : fallbackBookings)
        .filter((booking) => canViewChatHistoryForBooking(booking))
        .sort(compareConversationsByOperationalPriority)

      startTransition(() => {
        setBookings(chatBookings)
        const initialSelection =
          (bookingFromQuery && chatBookings.some((booking) => booking.id === bookingFromQuery)
            ? bookingFromQuery
            : null) ??
          chatBookings[0]?.id ??
          null
        setSelectedBookingId(initialSelection)
        setCurrentUserId(me?.data?.id ?? chatBookings[0]?.client?.user?.id ?? null)
        setLoading(false)
      })
      setChatLoadError(
        primaryBookings.length === 0 && fallbackBookings.length > 0
          ? 'Live chat thread sync failed. Showing recovered conversations from recent notifications.'
          : null,
      )
      resetLoadError('client-chats')
    } catch {
      setChatLoadError('Chat conversations could not be loaded right now. Please refresh and try again.')
      reportLoadError('client-chats', 'Failed to load chats.')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChats().catch(() => null)
  }, [bookingFromQuery])

  useEffect(() => {
    return setupVisiblePolling(() => {
      loadChats().catch(() => null)
    }, Number(process.env.NEXT_PUBLIC_CHATS_LIVE_REFRESH_MS ?? 45000))
  }, [bookingFromQuery])

  const deferredBookings = useDeferredValue(bookings)

  const filtered = deferredBookings.filter((booking) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    const service = (SERVICE_LABELS[booking.service_type] ?? booking.service_type).toLowerCase()
    const cleanerName = (booking.cleaner?.user?.name ?? '').toLowerCase()

    return (
      service.includes(q) ||
      cleanerName.includes(q) ||
      booking.city.toLowerCase().includes(q) ||
      booking.postcode.toLowerCase().includes(q)
    )
  })

  const selected = deferredBookings.find((booking) => booking.id === selectedBookingId) ?? null
  const effectiveCurrentUserId = currentUserId ?? selected?.client?.user?.id ?? null

  if (loading) return <SplitChatPageSkeleton />

  if (!effectiveCurrentUserId && selected) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Unable to load your account for chat.
      </div>
    )
  }

  return (
    <>
      <div className="client-chats-revamp space-y-7 md:space-y-9">
        {chatLoadError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {chatLoadError}
          </div>
        )}
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Message Channel
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Messages
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Keep every cleaner conversation in one continuous workspace tied directly to each booking.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Active Threads
                </p>
                <p className={`${displayFont.className} mt-1 text-4xl font-bold tracking-[-0.02em] text-white`}>
                  {deferredBookings.length}
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {deferredBookings.length === 0
                    ? 'No available conversations right now.'
                    : 'Select a thread and continue the in-booking chat.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:h-[calc(100vh-16rem)] lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr] 2xl:grid-cols-[360px_1fr]">
          <div className="min-w-0 flex min-h-[20rem] flex-col rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:min-h-[24rem] sm:p-5 lg:min-h-0">
            <div>
              <h2 className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>Conversations</h2>
              <p className="mt-1 text-sm text-slate-500">Search and switch between booking threads.</p>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversation"
                className="h-11 rounded-full border-slate-300 pl-9"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                {chatLoadError && deferredBookings.length === 0
                  ? 'Unable to load conversations right now.'
                  : 'No conversations yet.'}
              </div>
            ) : (
              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {filtered.map((booking, index) => {
                  const active = booking.id === selectedBookingId
                  const cleanerName = booking.cleaner?.user?.name ?? 'Cleaner'
                  const cleanerImage = booking.cleaner?.profile_image_url
                  return (
                    <button
                      key={booking.id}
                      onClick={() => setSelectedBookingId(booking.id)}
                      className={`chat-row w-full rounded-2xl border px-3 py-3 text-left transition duration-300 ${
                        active
                          ? 'border-[#0d4bc9]/30 bg-[#0d4bc9]/10'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:bg-slate-50'
                      }`}
                      style={{ animationDelay: `${index * 65}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={cleanerName}
                          imageUrl={cleanerImage}
                          className="h-10 w-10 shrink-0"
                          textClassName="text-sm font-bold text-[#0d4bc9]"
                          fallbackClassName="bg-[#0d4bc9]/10 text-[#0d4bc9]"
                          fallback="C"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{cleanerName}</p>
                          <p className={`${monoFont.className} truncate text-[0.7rem] tracking-wide text-slate-500`}>
                            {formatDate(booking.scheduled_start)}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="min-w-0 min-h-[20rem] rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-0 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:min-h-[24rem] lg:min-h-0">
            {!selected ? (
              <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-3 text-center text-slate-500 sm:min-h-[24rem] lg:min-h-0">
                <MessageCircleMore className="h-9 w-9 text-slate-300" />
                <p className="text-sm">Select a conversation to start chatting.</p>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col p-3 md:p-4">
                <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className={`${displayFont.className} text-base font-semibold tracking-[-0.01em] text-slate-900`}>
                    {SERVICE_LABELS[selected.service_type] ?? selected.service_type}
                  </p>
                  <p className="text-xs text-slate-600">{selected.cleaner?.user?.name ?? 'Cleaner'}</p>
                  <p className={`${monoFont.className} text-[0.7rem] tracking-wide text-slate-500`}>
                    {selected.city}, {selected.postcode} · {formatDate(selected.scheduled_start)}
                  </p>
                  <Link href={`/client/bookings/${selected.id}`} className="mt-1 inline-block text-xs font-medium text-[#0d4bc9] hover:underline">
                    Open booking details
                  </Link>
                </div>
                <div className="min-h-0 flex-1">
                  <Chat
                    bookingId={selected.id}
                    currentUserId={effectiveCurrentUserId!}
                    fullHeight
                    readOnly={isChatReadOnly(selected.scheduled_end, Date.now(), selected.status)}
                    readOnlyMessage={getChatReadOnlyMessage(selected.status)}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
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

        .chat-row {
          animation: row-enter 0.45s ease both;
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

        @keyframes row-enter {
          from {
            opacity: 0;
            transform: translateY(8px);
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

export default function ClientChatsPage() {
  return (
    <Suspense fallback={<SplitChatPageSkeleton />}>
      <ClientChatsPageContent />
    </Suspense>
  )
}
