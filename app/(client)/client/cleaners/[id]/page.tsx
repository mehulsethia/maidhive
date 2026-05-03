'use client'

import { useDeferredValue, useEffect, useState, startTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import {
  ArrowLeft,
  Briefcase,
  CalendarCheck,
  CheckCircle,
  Clock,
  MapPin,
  Star,
  TrendingUp,
} from 'lucide-react'
import { availabilityApi, bookingsApi, cleanersApi, reviewsApi } from '@/lib/api'
import { StarRating } from '@/components/star-rating'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/user-avatar'
import { isChatActiveForBooking } from '@/lib/chat-window'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { CleanerRead, ReviewRead } from '@/types'
import { toast } from 'sonner'

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

export default function CleanerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cleaner, setCleaner] = useState<CleanerRead | null>(null)
  const [reviews, setReviews] = useState<ReviewRead[]>([])
  const [bookableDates, setBookableDates] = useState<string[]>([])
  const [closestSlots, setClosestSlots] = useState<string[]>([])
  const [canMessageCleaner, setCanMessageCleaner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'reviews' | 'availability'>('overview')

  useEffect(() => {
    Promise.allSettled([
      cleanersApi.getById(id),
      reviewsApi.getForCleaner(id),
      availabilityApi.getBookableDates(id, 2, 28),
      bookingsApi.my(),
    ])
      .then(([cleanerRes, reviewsRes, availabilityRes, bookingsRes]) => {
        if (cleanerRes.status !== 'fulfilled') throw new Error('Failed to load cleaner profile')
        startTransition(() => {
          setCleaner(cleanerRes.value.data ?? null)
          setReviews(reviewsRes.status === 'fulfilled' ? (reviewsRes.value.data ?? []) : [])
          const dates = availabilityRes.status === 'fulfilled' ? (availabilityRes.value.data ?? []) : []
          setBookableDates(dates)
          if (bookingsRes.status === 'fulfilled') {
            const clientBookings = bookingsRes.value.data?.items ?? []
            const canMessage = clientBookings.some(
              (booking) =>
                booking.cleaner_id === id &&
                isChatActiveForBooking(booking),
            )
            setCanMessageCleaner(canMessage)
          } else {
            setCanMessageCleaner(false)
          }
          setLoading(false)
        })
      })
      .catch(() => {
        toast.error('Failed to load cleaner profile')
        setLoading(false)
      })
  }, [id])

  const deferredReviews = useDeferredValue(reviews)

  useEffect(() => {
    let active = true
    async function loadSlots() {
      if (bookableDates.length === 0) {
        setClosestSlots([])
        return
      }
      const nearest: string[] = []
      const candidateDates = bookableDates.slice(0, 3)
      for (const date of candidateDates) {
        if (!active) return
        try {
          const slotsRes = await availabilityApi.getSlots(id, date, 2)
          const firstEnabled = (slotsRes.data ?? []).find((slot) => !slot.disabled)
          if (firstEnabled?.start) {
            nearest.push(firstEnabled.start)
          }
        } catch {
          continue
        }
      }
      if (active) setClosestSlots(nearest.slice(0, 3))
    }
    loadSlots()
    return () => {
      active = false
    }
  }, [bookableDates, id])

  const avgRating =
    deferredReviews.length === 0
      ? 0
      : deferredReviews.reduce((sum, review) => sum + review.rating, 0) / deferredReviews.length

  const ratingDistribution = [0, 0, 0, 0, 0]
  deferredReviews.forEach((review) => {
    if (review.rating >= 1 && review.rating <= 5) ratingDistribution[review.rating - 1]++
  })

  const completionRate = typeof (cleaner as any)?.on_time_percentage === 'number' && (cleaner as any).on_time_percentage > 0
    ? (cleaner as any).on_time_percentage
    : null

  if (loading) return <DetailPageSkeleton />
  if (!cleaner) return <div className="py-16 text-center text-muted-foreground">Cleaner not found.</div>

  const cleanerName = cleaner.user?.name ?? 'Professional Cleaner'
  const memberSince = cleaner.created_at
    ? new Date(cleaner.created_at).toLocaleDateString('en-IE', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Europe/Nicosia',
      })
    : ''
  const location = cleaner.service_areas?.[0]?.city ?? ''
  const nextAvailable = closestSlots[0]
  const cleanerImageUrl = (cleaner as any)?.profile_image_url ?? (cleaner as any)?.profileImageUrl ?? cleaner.user?.avatar_url

  function suppliesText(value?: string) {
    if (value === 'own_supplies') return 'Brings own supplies'
    if (value === 'client_supplies') return 'Uses client supplies'
    return null
  }

  function responseTimeText(minutes?: number) {
    if (!minutes || minutes <= 0) return 'Not enough data yet'
    if (minutes < 60) return `${minutes} min average`
    const hours = Math.round((minutes / 60) * 10) / 10
    return `${hours}h average`
  }

  return (
    <>
      <div className="client-cleaner-detail-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Cleaner Profile
              </p>
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={cleanerName}
                  imageUrl={cleanerImageUrl}
                  alt={`${cleanerName} profile`}
                  className="h-12 w-12 border border-white/30 sm:h-14 sm:w-14"
                  textClassName="text-lg font-bold"
                  fallback="C"
                />
                <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                  {cleanerName}
                </h1>
              </div>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                View expertise, service quality, and recent client feedback before booking.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Snapshot
                </p>
                <p className={`${displayFont.className} mt-1 text-2xl font-bold tracking-[-0.02em] text-white`}>
                  {formatCurrency(cleaner.hourly_rate)} / hr
                </p>
                <p className="mt-1 text-sm text-white/80">{deferredReviews.length} reviews · {cleaner.total_jobs} jobs completed</p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => router.push(`/client/book/${id}`)} className="h-9 rounded-full bg-[#f4b400] px-4 text-slate-950 hover:bg-[#ffca3a]">
                    Book Service
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canMessageCleaner}
                    className="h-9 rounded-full border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-65"
                    title={!canMessageCleaner ? 'Messaging available after booking is confirmed.' : 'Open messaging'}
                  >
                    {canMessageCleaner ? 'Send Message' : 'Messaging available after booking is confirmed.'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Jobs Completed" value={cleaner.total_jobs} icon={<CheckCircle className="h-6 w-6 text-[#0d4bc9]" />} displayFont={displayFont.className} />
          <MetricCard title="Average Rating" value={avgRating > 0 ? `${avgRating.toFixed(1)}/5` : 'No reviews yet'} icon={<Star className="h-6 w-6 text-amber-400" />} displayFont={displayFont.className} />
          {completionRate !== null && (
            <MetricCard title="On-time Rate" value={`${completionRate}%`} icon={<TrendingUp className="h-6 w-6 text-emerald-500" />} displayFont={displayFont.className} />
          )}
        </section>

        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-6">
          <div className="flex justify-center border-b border-slate-200">
            <button
              onClick={() => setTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'overview'
                  ? 'border-[#0d4bc9] text-[#0d4bc9]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setTab('reviews')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'reviews'
                  ? 'border-[#0d4bc9] text-[#0d4bc9]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Reviews
            </button>
            <button
              onClick={() => setTab('availability')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'availability'
                  ? 'border-[#0d4bc9] text-[#0d4bc9]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Availability
            </button>
          </div>

          {tab === 'overview' && (
            <div className="grid gap-4 px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-6 lg:grid-cols-[1fr_300px]">
              <div className="space-y-4">
                <Card className="border-slate-200">
                  <CardContent className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                    <h3 className={`${displayFont.className} mb-2 text-xl font-semibold tracking-[-0.02em] text-slate-900`}>
                      About {cleanerName}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">{cleaner.bio || 'No bio provided yet.'}</p>

                    {cleaner.skills && cleaner.skills.length > 0 && (
                      <div className="mt-4">
                        <h4 className="mb-2 text-sm font-semibold text-slate-900">Services</h4>
                        <div className="flex flex-wrap gap-2">
                          {cleaner.skills.map((skill) => (
                            <span key={skill} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="h-fit border-slate-200">
                <CardContent className="space-y-4 px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                  <h3 className="font-semibold text-slate-900">Cleaner Details</h3>
                  {cleaner.transport_mode && (
                    <InfoLine
                      icon={<Clock className="h-4 w-4 text-slate-400" />}
                      title="Mode Of Transport"
                      value={
                        cleaner.transport_mode === 'own_car'
                          ? 'Own Car'
                          : cleaner.transport_mode === 'bus_walk'
                            ? 'Bus / Walk'
                            : 'Requires Pick-up'
                      }
                    />
                  )}
                  {nextAvailable ? (
                    <InfoLine
                      icon={<CalendarCheck className="h-4 w-4 text-slate-400" />}
                      title="Availability"
                      value={`Next available: ${new Date(nextAvailable).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`}
                    />
                  ) : (
                    <InfoLine icon={<CalendarCheck className="h-4 w-4 text-slate-400" />} title="Availability" value="No upcoming availability right now" />
                  )}
                  {closestSlots.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-500">Next available times</p>
                      <div className="mt-1 space-y-1">
                        {closestSlots.map((slot) => (
                          <p key={slot} className="text-xs font-medium text-slate-700">
                            {new Date(slot).toLocaleString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {location && <InfoLine icon={<MapPin className="h-4 w-4 text-slate-400" />} title="City" value={location} />}
                  <InfoLine
                    icon={<Briefcase className="h-4 w-4 text-slate-400" />}
                    title="Experience"
                    value={`${cleaner.years_experience} year${cleaner.years_experience !== 1 ? 's' : ''}`}
                  />
                  <InfoLine
                    icon={<Briefcase className="h-4 w-4 text-slate-400" />}
                    title="Completed Jobs"
                    value={`${cleaner.total_jobs}`}
                  />
                  {(cleaner as any).on_time_percentage > 0 && (
                    <InfoLine
                      icon={<TrendingUp className="h-4 w-4 text-slate-400" />}
                      title="On-time Percentage"
                      value={`${(cleaner as any).on_time_percentage}%`}
                    />
                  )}
                  {(cleaner as any).avg_response_minutes > 0 && (
                    <InfoLine
                      icon={<Clock className="h-4 w-4 text-slate-400" />}
                      title="Average Response Time"
                      value={responseTimeText((cleaner as any).avg_response_minutes)}
                    />
                  )}
                  {suppliesText((cleaner as any).cleaning_supplies) && (
                    <InfoLine
                      icon={<Clock className="h-4 w-4 text-slate-400" />}
                      title="Supplies"
                      value={suppliesText((cleaner as any).cleaning_supplies) as string}
                    />
                  )}
                  <InfoLine icon={<CalendarCheck className="h-4 w-4 text-slate-400" />} title="Member Since" value={memberSince} />
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="grid gap-4 px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-6 lg:grid-cols-[240px_1fr]">
              <Card className="h-fit border-slate-200">
                <CardContent className="px-5 pb-5 pt-6 text-center sm:px-6 sm:pb-6 sm:pt-6">
                  <p className={`${displayFont.className} text-4xl font-bold tracking-[-0.02em] text-slate-900`}>
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                  </p>
                  <StarRating rating={avgRating} size="md" showValue={false} className="mt-1 justify-center" />
                  <p className="mt-1 text-sm text-slate-500">
                    {deferredReviews.length} Review{deferredReviews.length !== 1 ? 's' : ''}
                  </p>

                  <div className="mt-4 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = ratingDistribution[star - 1]
                      const pct = deferredReviews.length > 0 ? Math.round((count / deferredReviews.length) * 100) : 0
                      return (
                        <div key={star} className="flex items-center gap-2 text-sm">
                          <span className="w-3 text-right text-slate-600">{star}</span>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs text-slate-500">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {deferredReviews.length === 0 ? (
                  <Card className="border-slate-200">
                    <CardContent className="px-8 pb-8 pt-6 text-center text-sm text-slate-500">No reviews yet</CardContent>
                  </Card>
                ) : (
                  deferredReviews.map((review, index) => (
                    <Card key={review.id} className="review-row border-slate-200" style={{ animationDelay: `${index * 65}ms` }}>
                      <CardContent className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">Client</p>
                            <p className={`${monoFont.className} text-[0.68rem] tracking-wide text-slate-500`}>
                              {formatDate(review.created_at)}
                            </p>
                          </div>
                          <StarRating rating={review.rating} showValue={false} />
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600">
                          {review.comment || 'No written comment provided.'}
                        </p>
                        {review.cleaner_reply && (
                          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                            <p className="text-xs font-semibold text-blue-900">Cleaner reply</p>
                            <p className="mt-1 text-sm text-blue-900">{review.cleaner_reply}</p>
                            {review.cleaner_reply_at && (
                              <p className="mt-1 text-xs text-blue-700">
                                {formatDate(review.cleaner_reply_at)}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'availability' && (
            <div className="px-4 pb-4 pt-6 sm:px-5 sm:pb-5 sm:pt-6">
              {bookableDates.length === 0 ? (
                <Card className="border-slate-200">
                  <CardContent className="px-8 pb-8 pt-6 text-center text-sm text-slate-500">
                    No upcoming availability currently shown.
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-slate-200">
                  <CardContent className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-6">
                    <h3 className={`${displayFont.className} mb-3 text-xl font-semibold tracking-[-0.02em] text-slate-900`}>
                      Upcoming Available Dates
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {bookableDates.slice(0, 14).map((dateStr) => (
                        <div
                          key={dateStr}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                          {new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
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

        .review-row {
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

function MetricCard({
  title,
  value,
  icon,
  displayFont,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  displayFont: string
}) {
  return (
    <Card className="border-slate-200 bg-white/90">
      <CardContent className="flex min-h-[124px] flex-col items-center justify-center gap-2 px-6 pb-6 pt-6 text-center">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100">{icon}</span>
        <p className={`${displayFont} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>{value}</p>
        <p className="text-xs font-medium text-slate-500">{title}</p>
      </CardContent>
    </Card>
  )
}

function InfoLine({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div>
        <p className="text-xs text-slate-500">{title}</p>
        <p className="text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  )
}
