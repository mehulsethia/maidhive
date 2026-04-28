'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { Grid3x3, List, MapPin, Briefcase, Car, Package, Clock3 } from 'lucide-react'
import { cleanersApi } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { StarRating } from '@/components/star-rating'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import type { CleanerSummary } from '@/types'
import { toast } from 'sonner'

type ViewMode = 'card' | 'list'
type AvailabilityFilter = 'any' | 'next_7_days'

type CleanerVM = CleanerSummary & {
  name: string
  city?: string
  years_experience?: number
  profile_image_url?: string
  created_at?: string
  unique_key: string
  skills: string[]
  transport_mode?: 'own_car' | 'bus_walk' | 'requires_pickup'
  cleaning_supplies?: 'own_supplies' | 'client_supplies'
}

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

function transportLabel(value?: string) {
  if (value === 'own_car') return 'Own car'
  if (value === 'bus_walk') return 'Bus / walk'
  if (value === 'requires_pickup') return 'Requires pick-up'
  return 'Transport not set'
}

function suppliesLabel(value?: string) {
  if (value === 'own_supplies') return 'Brings supplies'
  if (value === 'client_supplies') return 'Uses client supplies'
  return 'Supplies not set'
}

const SERVICE_FILTER_OPTIONS = [
  'Regular home cleaning',
  'One-off cleaning',
  'Airbnb / short-term rental cleaning',
  'Laundry / folding clothes',
  'Kitchen deep clean',
  'Bathroom deep clean',
  'Ironing',
  'Windows',
  'Deep cleaning',
  'Move in/out',
]

export default function ClientCleanersPage() {
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [city, setCity] = useState('')
  const [minRating, setMinRating] = useState('0')
  const [minRate, setMinRate] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [availability, setAvailability] = useState<AvailabilityFilter>('any')
  const [transport, setTransport] = useState('')
  const [service, setService] = useState('')
  const [view, setView] = useState<ViewMode>('card')
  const [cleaners, setCleaners] = useState<CleanerVM[]>([])

  async function load() {
    setLoading(true)
    try {
      const minRateValue = minRate ? Number(minRate) : undefined
      const maxRateValue = maxRate ? Number(maxRate) : undefined
      const minRatingValue = Number(minRating || 0)

      const res = await cleanersApi.search({
        city: city.trim() || undefined,
        availability,
        transport_mode: transport ? (transport as any) : undefined,
        services_offered: service || undefined,
        min_rating: minRatingValue > 0 ? minRatingValue : undefined,
        min_price: minRateValue,
        max_price: maxRateValue,
      })

      const items = (res.data?.items ?? []) as any[]
      startTransition(() => {
        setCleaners(
          items.map((cleaner) => ({
            ...cleaner,
            name: cleaner?.user?.name ?? 'Cleaner',
            city: cleaner?.service_areas?.[0]?.city,
            years_experience: cleaner?.years_experience ?? cleaner?.yearsExperience,
            profile_image_url:
              cleaner?.profile_image_url ?? cleaner?.profileImageUrl ?? cleaner?.user?.avatar_url,
            created_at: cleaner?.created_at ?? cleaner?.createdAt ?? cleaner?.user?.created_at,
            unique_key: cleaner?.user_id ?? cleaner?.id ?? '',
            skills: cleaner?.skills ?? [],
            transport_mode: cleaner?.transport_mode ?? cleaner?.transportMode,
            cleaning_supplies: cleaner?.cleaning_supplies ?? cleaner?.cleaningSupplies,
          })),
        )
        setLoading(false)
      })
    } catch {
      toast.error('Failed to load cleaners.')
      setCleaners([])
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [city, minRating, minRate, maxRate, availability, transport, service])

  const deferredCleaners = useDeferredValue(cleaners)

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return deferredCleaners.filter((cleaner) => {
      if (!q) return true
      return (
        cleaner.name.toLowerCase().includes(q) ||
        (cleaner.bio ?? '').toLowerCase().includes(q) ||
        (cleaner.city ?? '').toLowerCase().includes(q) ||
        cleaner.skills.join(' ').toLowerCase().includes(q)
      )
    })
  }, [deferredCleaners, searchQuery])

  return (
    <>
      <div className="client-cleaners-revamp space-y-7 md:space-y-9">
        <section className="client-stage overflow-hidden rounded-[2rem] border border-slate-200/70">
          <div className="client-stage__media" aria-hidden="true" />
          <div className="client-stage__grain" aria-hidden="true" />

          <div className="relative z-10 grid gap-3 px-5 py-3 sm:px-6 sm:py-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:px-8 lg:py-4">
            <div className="animate-stage-up space-y-4">
              <p className={`${monoFont.className} text-[0.7rem] uppercase tracking-[0.24em] text-white/75`}>
                MaidHive Talent Directory
              </p>
              <h1
                className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}
              >
                Find Your Cleaner
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Discover trusted professionals, compare rates and ratings, then book with confidence.
              </p>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Results
                </p>
                <p className={`${displayFont.className} mt-1 text-4xl font-bold tracking-[-0.02em] text-white`}>
                  {filtered.length}
                </p>
                <p className="mt-1 text-sm text-white/80">Approved cleaner profiles matching your filters.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full rounded-[1.5rem] border border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:px-6 sm:py-6">
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, bio, skills"
              className="w-full lg:col-span-2"
            />
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City"
              className="w-full"
            />
            <Select
              value={availability}
              onChange={(event) => setAvailability(event.target.value as AvailabilityFilter)}
              className="w-full"
            >
              <option value="any">Availability: Any</option>
              <option value="next_7_days">Availability: Next 7 days</option>
            </Select>
            <Select value={transport} onChange={(event) => setTransport(event.target.value)} className="w-full">
              <option value="">Transport: Any</option>
              <option value="own_car">Own car</option>
              <option value="bus_walk">Bus / walk</option>
              <option value="requires_pickup">Requires pick-up</option>
            </Select>
            <Select value={service} onChange={(event) => setService(event.target.value)} className="w-full lg:col-start-1">
              <option value="">Services: Any</option>
              {SERVICE_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="w-full">
              <option value="0">User rating: Any</option>
              <option value="3">3.0+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </Select>
            <Input
              type="number"
              min="0"
              value={minRate}
              onChange={(event) => setMinRate(event.target.value)}
              placeholder="Min €/hr"
              className="w-full"
            />
            <Input
              type="number"
              min="0"
              value={maxRate}
              onChange={(event) => setMaxRate(event.target.value)}
              placeholder="Max €/hr"
              className="w-full"
            />
            <div className="inline-flex h-10 w-full rounded-full border border-slate-200 p-0.5 sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`inline-flex flex-1 items-center justify-center gap-1 rounded-full px-2.5 text-sm font-semibold ${
                  view === 'list' ? 'bg-[#0d4bc9] text-white' : 'text-slate-600'
                }`}
              >
                <List className="h-4 w-4" /> List
              </button>
              <button
                type="button"
                onClick={() => setView('card')}
                className={`inline-flex flex-1 items-center justify-center gap-1 rounded-full px-2.5 text-sm font-semibold ${
                  view === 'card' ? 'bg-[#0d4bc9] text-white' : 'text-slate-600'
                }`}
              >
                <Grid3x3 className="h-4 w-4" /> Card
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <ListPageSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState title="No cleaners available right now" description="Try adjusting your filters and search criteria." />
        ) : view === 'card' ? (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((cleaner, index) => (
              <article
                key={cleaner.id}
                className="cleaner-row rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-[#8aa8e2] hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
                style={{ animationDelay: `${index * 65}ms` }}
              >
                <div className="flex items-start gap-2">
                  <UserAvatar
                    name={cleaner.name}
                    imageUrl={cleaner.profile_image_url}
                    alt={`${cleaner.name} profile`}
                    className="h-12 w-12 border border-slate-200"
                    textClassName="text-lg font-bold"
                    fallback="C"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3
                          className={`${displayFont.className} truncate text-[1.35rem] leading-none font-semibold tracking-[-0.02em] text-slate-900`}
                        >
                          {cleaner.name}
                        </h3>
                        <div className="mt-0.5">
                          <StarRating rating={Number(cleaner.average_rating ?? 0)} />
                        </div>
                      </div>
                      <p className={`${displayFont.className} shrink-0 text-lg font-bold tracking-[-0.02em] text-slate-900`}>
                        {formatCurrency(Number(cleaner.hourly_rate ?? 0))}
                        <span className="text-xs font-medium text-slate-500">/hr</span>
                      </p>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      {cleaner.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {cleaner.city}
                        </span>
                      )}
                      {cleaner.years_experience !== undefined && (
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" />
                          {cleaner.years_experience} years
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Car className="h-3.5 w-3.5" />
                        {transportLabel(cleaner.transport_mode)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {suppliesLabel(cleaner.cleaning_supplies)}
                      </span>
                    </div>

                    {cleaner.bio && <p className="mt-1 line-clamp-1 text-[12px] leading-5 text-slate-600">{cleaner.bio}</p>}

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(cleaner.skills ?? []).slice(0, 2).map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-1.5">
                      <Link
                        href={`/client/cleaners/${cleaner.id}`}
                        className="inline-flex h-8 items-center rounded-full border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View Profile
                      </Link>
                      <Link
                        href={`/client/book/${cleaner.id}`}
                        className="inline-flex h-8 items-center rounded-full bg-[#0d4bc9] px-2.5 text-xs font-semibold text-white hover:bg-[#0a3ea8]"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="space-y-2">
            {filtered.map((cleaner, index) => (
              <article
                key={cleaner.id}
                className="cleaner-row rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-[#8aa8e2] hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
                style={{ animationDelay: `${index * 65}ms` }}
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar
                      name={cleaner.name}
                      imageUrl={cleaner.profile_image_url}
                      alt={`${cleaner.name} profile`}
                      className="h-11 w-11 border border-slate-200"
                      textClassName="text-base font-bold"
                      fallback="C"
                    />
                    <div className="min-w-0">
                      <h3
                        className={`${displayFont.className} truncate text-lg font-semibold tracking-[-0.02em] text-slate-900`}
                      >
                        {cleaner.name}
                      </h3>
                      <div className="mt-1">
                        <StarRating rating={Number(cleaner.average_rating ?? 0)} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{transportLabel(cleaner.transport_mode)}</span>
                        <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />{suppliesLabel(cleaner.cleaning_supplies)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-1.5 lg:items-end">
                    <p className={`${displayFont.className} text-xl font-bold tracking-[-0.02em] text-slate-900`}>
                      {formatCurrency(Number(cleaner.hourly_rate ?? 0))}
                      <span className="text-xs font-medium text-slate-500">/hr</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/client/cleaners/${cleaner.id}`}
                        className="inline-flex h-8 items-center rounded-full border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View Profile
                      </Link>
                      <Link
                        href={`/client/book/${cleaner.id}`}
                        className="inline-flex h-8 items-center rounded-full bg-[#0d4bc9] px-2.5 text-xs font-semibold text-white hover:bg-[#0a3ea8]"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
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
          background-image: linear-gradient(105deg, rgba(2, 11, 27, 0.82) 10%, rgba(2, 11, 27, 0.5) 55%, rgba(8, 22, 44, 0.72) 100%),
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
          background-image: linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0) 45%),
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

        .cleaner-row {
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
