'use client'

import { Suspense, useDeferredValue, useEffect, useState, startTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { MessageCircleMore, Search } from 'lucide-react'
import { authApi, bookingsApi } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { Chat } from '@/components/chat'
import { SplitChatPageSkeleton } from '@/components/page-skeletons'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

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
        const CHAT_CUTOFF_MS = 30 * 60 * 1000

        const chatBookings = (data?.items ?? []).filter((booking) => {
          if (!CHAT_AVAILABLE.includes(booking.status)) return false
          if (['completed', 'disputed'].includes(booking.status) && booking.scheduled_end) {
            const endTime = new Date(booking.scheduled_end).getTime()
            if (now > endTime + CHAT_CUTOFF_MS) return false
          }
          return true
        })

        startTransition(() => {
          setBookings(chatBookings)
          const initialSelection =
            (bookingFromQuery && chatBookings.some((booking) => booking.id === bookingFromQuery)
              ? bookingFromQuery
              : null) ??
            chatBookings[0]?.id ??
            null
          setSelectedBookingId(initialSelection)
          setCurrentUserId(userRes.data.user?.id ?? meRes?.data?.id ?? null)
          setLoading(false)
        })
      } catch {
        toast.error('Failed to load chats.')
        setLoading(false)
      }
    })()
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

  if (loading) return <SplitChatPageSkeleton />

  if (!currentUserId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Unable to load your account for chat.
      </div>
    )
  }

  return (
    <>
      <div className="client-chats-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Message Channel
              </p>
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Client Chats
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

        <section className="grid gap-4 lg:h-[calc(100vh-16rem)] lg:grid-cols-[360px_1fr]">
          <div className="flex min-h-[34rem] flex-col rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-5">
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
                No conversations yet.
              </div>
            ) : (
              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {filtered.map((booking, index) => {
                  const active = booking.id === selectedBookingId
                  const cleanerName = booking.cleaner?.user?.name ?? 'Cleaner'
                  const cleanerImage = booking.cleaner?.profile_image_url
                  const initial = cleanerName.charAt(0).toUpperCase()
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
                        {cleanerImage ? (
                          <img src={cleanerImage} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0d4bc9]/10">
                            <span className="text-sm font-bold text-[#0d4bc9]">{initial}</span>
                          </div>
                        )}
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

          <div className="min-h-[34rem] rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-0 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm">
            {!selected ? (
              <div className="flex h-full min-h-[34rem] flex-col items-center justify-center gap-3 text-center text-slate-500">
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
                  <Chat bookingId={selected.id} currentUserId={currentUserId} fullHeight />
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
