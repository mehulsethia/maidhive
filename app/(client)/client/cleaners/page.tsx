'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { Grid3x3, List, Car, Package, Heart, Briefcase, Star } from 'lucide-react'
import { cleanersApi, favoritesApi } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CleanerCard } from '@/components/cleaner-card'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatCurrency } from '@/lib/utils'
import type { CleanerSummary } from '@/types'
import { toast } from 'sonner'
import { SuperCleanerBadge } from '@/components/super-cleaner-badge'

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
  new_cleaner_badge?: boolean
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
  if (value === 'own_supplies') return 'Brings own supplies'
  if (value === 'client_supplies') return 'Client must provide supplies'
  return null
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
  const [minRating, setMinRating] = useState('0')
  const [minRate, setMinRate] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [availability, setAvailability] = useState<AvailabilityFilter>('any')
  const [transport, setTransport] = useState('')
  const [bringsOwnSupplies, setBringsOwnSupplies] = useState<'any' | 'yes' | 'no'>('any')
  const [service, setService] = useState('')
  const [view, setView] = useState<ViewMode>('card')
  const [cleaners, setCleaners] = useState<CleanerVM[]>([])
  const [favoriteCleanerIds, setFavoriteCleanerIds] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    try {
      const minRateValue = minRate ? Number(minRate) : undefined
      const maxRateValue = maxRate ? Number(maxRate) : undefined
      const minRatingValue = Number(minRating || 0)
      const cityFromSearch = searchQuery.trim()

      const [res, favoritesRes] = await Promise.all([
        cleanersApi.search({
        city: cityFromSearch || undefined,
        availability,
        transport_mode: transport ? (transport as any) : undefined,
        brings_own_supplies: bringsOwnSupplies === 'any' ? undefined : bringsOwnSupplies,
        services_offered: service || undefined,
        min_rating: minRatingValue > 0 ? minRatingValue : undefined,
        min_price: minRateValue,
        max_price: maxRateValue,
        }),
        favoritesApi.list().catch(() => ({ data: [] as any[] })),
      ])

      const items = (res.data?.items ?? []) as any[]
      const favoriteIds = new Set<string>(((favoritesRes as any)?.data ?? []).map((item: any) => item.cleaner_id))
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
        setFavoriteCleanerIds(favoriteIds)
        setLoading(false)
      })
      resetLoadError('client-cleaners')
    } catch {
      reportLoadError('client-cleaners', 'Failed to load cleaners.')
      setCleaners([])
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [searchQuery, minRating, minRate, maxRate, availability, transport, bringsOwnSupplies, service])

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
    }).sort((a, b) => Number(favoriteCleanerIds.has(b.id)) - Number(favoriteCleanerIds.has(a.id)))
  }, [deferredCleaners, searchQuery, favoriteCleanerIds])


  async function toggleFavorite(cleanerId: string) {
    const currentlyFavorite = favoriteCleanerIds.has(cleanerId)
    setFavoriteCleanerIds((prev) => {
      const next = new Set(prev)
      if (currentlyFavorite) next.delete(cleanerId)
      else next.add(cleanerId)
      return next
    })
    try {
      if (currentlyFavorite) {
        await favoritesApi.remove(cleanerId)
      } else {
        await favoritesApi.add(cleanerId)
      }
    } catch {
      setFavoriteCleanerIds((prev) => {
        const next = new Set(prev)
        if (currentlyFavorite) next.add(cleanerId)
        else next.delete(cleanerId)
        return next
      })
      toast.error('Could not update favourites. Please try again.')
    }
  }

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
              placeholder="Search name, bio, skills, city"
              className="w-full lg:col-span-2"
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
            <Select
              value={bringsOwnSupplies}
              onChange={(event) => setBringsOwnSupplies(event.target.value as 'any' | 'yes' | 'no')}
              className="w-full"
            >
              <option value="any">Brings own supplies: Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
            <Select value={service} onChange={(event) => setService(event.target.value)} className="w-full">
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
              <div key={cleaner.id} className="cleaner-row" style={{ animationDelay: `${index * 65}ms` }}>
                <CleanerCard
                  cleaner={cleaner}
                  isFavorite={favoriteCleanerIds.has(cleaner.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            ))}
          </section>
        ) : (
          <section className="space-y-2.5">
            {filtered.map((cleaner, index) => (
              <article
                key={cleaner.id}
                className="cleaner-row rounded-[20px] border border-[#ecedf3] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,51,0.04),0_10px_28px_-14px_rgba(15,23,51,0.12)]"
                style={{ animationDelay: `${index * 65}ms` }}
              >
                <div className="grid gap-4 xl:grid-cols-[320px_1fr_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={cleaner.name}
                      imageUrl={cleaner.profile_image_url}
                      alt={`${cleaner.name} profile`}
                      className="h-[58px] w-[58px] border border-[#e3e6ef]"
                      textClassName="text-lg font-bold"
                      fallback="C"
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className={`${displayFont.className} min-w-0 truncate text-[20px] font-bold tracking-[-0.02em] text-[#0f1733]`}>
                          {cleaner.name}
                        </h3>
                        {cleaner.super_cleaner && <SuperCleanerBadge />}
                        {(cleaner.new_cleaner_badge ?? Number(cleaner.total_jobs ?? 0) < 5) && (
                          <span
                            title="Newly approved cleaner on MaidHive."
                            className="inline-flex shrink-0 items-center rounded-full border border-[#dbe1f3] bg-[#f5f7ff] px-2 py-0.5 text-[11px] font-semibold text-[#51608a]"
                          >
                            New Cleaner
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center gap-0.5 text-[#f5b400]">
                          {Array.from({ length: 5 }).map((_, idx) => {
                            const avg = Number(cleaner.average_rating ?? 0)
                            const filled = avg > 0 && avg >= idx + 1
                            return <Star key={idx} className={`h-[13px] w-[13px] ${filled ? 'fill-current' : 'text-[#c9cdda]'}`} />
                          })}
                        </span>
                        {Number(cleaner.average_rating ?? 0) > 0 ? (
                          <span className="text-[14px] font-semibold leading-none text-[#0f1733]">
                            {Number(cleaner.average_rating ?? 0).toFixed(1)}
                          </span>
                        ) : null}
                        <span className="text-[14px] leading-none text-[#8a90a8]">({Number(cleaner.total_jobs ?? 0)})</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#4a5170]">
                      <span className="inline-flex items-center gap-1.5"><Briefcase className="h-[15px] w-[15px] text-[#8a90a8]" />{cleaner.years_experience ?? 0} yrs</span>
                      <span className="text-[#e3e6ef]">•</span>
                      <span className="inline-flex items-center gap-1.5"><Car className="h-[15px] w-[15px] text-[#8a90a8]" />{transportLabel(cleaner.transport_mode)}</span>
                      {suppliesLabel(cleaner.cleaning_supplies) ? (
                        <>
                          <span className="text-[#e3e6ef]">•</span>
                          <span className="inline-flex items-center gap-1.5"><Package className="h-[15px] w-[15px] text-[#8a90a8]" />{suppliesLabel(cleaner.cleaning_supplies)}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[16px] leading-[1.25] text-[#4a5170]">
                      {cleaner.bio?.trim() || 'Detail-oriented cleaner with a calm, methodical approach.'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['Pro Cleaner', ...(cleaner.skills ?? []).slice(0, 3)].map((tag) => (
                        <span key={tag} className="rounded-full bg-[#eef1ff] px-[11px] py-[5px] text-[12.5px] font-semibold tracking-[0.005em] text-[#1f3bd6]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap items-center justify-start gap-2.5 xl:w-auto xl:justify-end">
                    <p className={`${displayFont.className} shrink-0 text-[18px] font-bold tracking-[-0.02em] text-[#0f1733]`}>
                      {formatCurrency(Number(cleaner.hourly_rate ?? 0))}
                      <span className="ml-1 text-[12px] font-medium text-[#8a90a8]">/hr</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(cleaner.id)}
                      aria-label={favoriteCleanerIds.has(cleaner.id) ? 'Remove from favourites' : 'Add to favourites'}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                        favoriteCleanerIds.has(cleaner.id)
                          ? 'border-[#ffd9dd] bg-[#fff1f2] text-[#e11d48]'
                          : 'border-[#ffd9dd] bg-white text-[#f06a84] hover:bg-[#fff1f2]'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${favoriteCleanerIds.has(cleaner.id) ? 'fill-current' : ''}`} />
                    </button>
                    <Link
                      href={`/client/cleaners/${cleaner.id}`}
                      className="inline-flex h-[44px] items-center justify-center rounded-xl border border-[#e3e6ef] px-4 text-[14px] font-semibold text-[#0f1733] hover:bg-[#fafbfe]"
                    >
                      View Profile
                    </Link>
                    <Link
                      href={`/client/book/${cleaner.id}?reset=1&step=1`}
                      className="inline-flex h-[44px] items-center justify-center rounded-xl bg-[#1f3bd6] px-4 text-[14px] font-semibold text-white hover:bg-[#182fb3]"
                    >
                      Book Now
                    </Link>
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
