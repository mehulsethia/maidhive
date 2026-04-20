'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useState, startTransition } from 'react'
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google'
import { Grid3x3, List, Search, MapPin, Briefcase } from 'lucide-react'
import { cleanersApi } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { ListPageSkeleton } from '@/components/page-skeletons'
import { StarRating } from '@/components/star-rating'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import type { CleanerSummary } from '@/types'
import { toast } from 'sonner'

type ViewMode = 'card' | 'list'

type CleanerVM = CleanerSummary & {
  name: string
  city?: string
  years_experience?: number
  profile_image_url?: string
  skills: string[]
}

const displayFont = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '700', '800'] })
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] })

function avatarLetter(name: string) {
  return (name.trim().charAt(0) || 'C').toUpperCase()
}

export default function ClientCleanersPage() {
  const [loading, setLoading] = useState(true)
  const [cityQuery, setCityQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [minRating, setMinRating] = useState('0')
  const [minRate, setMinRate] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [view, setView] = useState<ViewMode>('card')
  const [cleaners, setCleaners] = useState<CleanerVM[]>([])

  async function load(city?: string) {
    setLoading(true)
    try {
      const res = await cleanersApi.search({ city: city || undefined })
      const items = (res.data?.items ?? []) as any[]
      startTransition(() => {
        setCleaners(
          items.map((cleaner) => ({
            ...cleaner,
            name: cleaner?.user?.name ?? 'Cleaner',
            city: cleaner?.service_areas?.[0]?.city,
            years_experience: cleaner?.years_experience ?? cleaner?.yearsExperience,
            profile_image_url: cleaner?.profile_image_url ?? cleaner?.profileImageUrl,
            skills: cleaner?.skills ?? [],
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
  }, [])

  const deferredCleaners = useDeferredValue(cleaners)

  const minRatingValue = Number(minRating || 0)
  const minRateValue = minRate ? Number(minRate) : null
  const maxRateValue = maxRate ? Number(maxRate) : null

  const filtered = deferredCleaners.filter((cleaner) => {
    const rate = Number(cleaner.hourly_rate ?? 0)
    const rating = Number(cleaner.average_rating ?? 0)
    if (rating < minRatingValue) return false
    if (minRateValue !== null && rate < minRateValue) return false
    if (maxRateValue !== null && rate > maxRateValue) return false

    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      cleaner.name.toLowerCase().includes(q) ||
      (cleaner.bio ?? '').toLowerCase().includes(q) ||
      (cleaner.city ?? '').toLowerCase().includes(q) ||
      cleaner.skills.join(' ').toLowerCase().includes(q)
    )
  })

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
              <h1 className={`${displayFont.className} text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl lg:text-4xl`}>
                Find Your Cleaner
              </h1>
              <p className="max-w-xl text-sm text-slate-100/90 sm:text-base">
                Discover vetted professionals, compare rates and ratings, then book with confidence.
              </p>

              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  load(cityQuery)
                }}
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  <Input
                    value={cityQuery}
                    onChange={(event) => setCityQuery(event.target.value)}
                    placeholder="Search by city"
                    className="h-11 rounded-full border-white/35 bg-white/10 pl-9 text-white placeholder:text-white/65"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center rounded-full bg-[#f4b400] px-4 text-sm font-semibold text-slate-950 transition hover:bg-[#ffca3a]"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="animate-stage-up delay-120">
              <div className="ml-auto w-full max-w-sm rounded-3xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm">
                <p className={`${monoFont.className} text-[0.62rem] uppercase tracking-[0.18em] text-cyan-200/90`}>
                  Results
                </p>
                <p className={`${displayFont.className} mt-1 text-4xl font-bold tracking-[-0.02em] text-white`}>
                  {filtered.length}
                </p>
                <p className="mt-1 text-sm text-white/80">Cleaners matching your current query and filters.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(11,33,78,0.08)] backdrop-blur-sm sm:p-6">
          <div className="grid gap-2 md:grid-cols-[1fr_170px_130px_130px_auto]">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, bio, skills"
            />
            <Select value={minRating} onChange={(event) => setMinRating(event.target.value)}>
              <option value="0">Minimum rating</option>
              <option value="3">3.0+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </Select>
            <Input type="number" min="0" value={minRate} onChange={(event) => setMinRate(event.target.value)} placeholder="Min €/hr" />
            <Input type="number" min="0" value={maxRate} onChange={(event) => setMaxRate(event.target.value)} placeholder="Max €/hr" />
            <div className="inline-flex h-10 rounded-full border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 text-sm font-semibold ${
                  view === 'list' ? 'bg-[#0d4bc9] text-white' : 'text-slate-600'
                }`}
              >
                <List className="h-4 w-4" /> List
              </button>
              <button
                type="button"
                onClick={() => setView('card')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 text-sm font-semibold ${
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
          <EmptyState
            title="No cleaners found"
            description="Try adjusting your filters or searching in a different city."
          />
        ) : view === 'card' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {filtered.map((cleaner, index) => (
              <article
                key={cleaner.id}
                className="cleaner-row rounded-2xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#9eb7ec] hover:bg-[#f8fbff]"
                style={{ animationDelay: `${index * 65}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-[#0d4bc9]/10 text-xl font-bold text-[#0d4bc9]">
                    {avatarLetter(cleaner.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`${displayFont.className} truncate text-2xl font-semibold tracking-[-0.02em] text-slate-900`}>
                          {cleaner.name}
                        </h3>
                        <div className="mt-1"><StarRating rating={Number(cleaner.average_rating ?? 0)} /></div>
                      </div>
                      <p className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>
                        {formatCurrency(Number(cleaner.hourly_rate ?? 0))}
                        <span className="text-sm font-medium text-slate-500">/hr</span>
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      {cleaner.city && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{cleaner.city}</span>}
                      {cleaner.years_experience !== undefined && (
                        <span className="inline-flex items-center gap-1"><Briefcase className="h-4 w-4" />{cleaner.years_experience} years</span>
                      )}
                    </div>

                    {cleaner.bio && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{cleaner.bio}</p>}

                    <div className="mt-2 flex flex-wrap gap-2">
                      {(cleaner.skills ?? []).slice(0, 3).map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Link href={`/client/cleaners/${cleaner.id}`} className="inline-flex h-9 items-center rounded-full border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        View Profile
                      </Link>
                      <Link href={`/client/book/${cleaner.id}`} className="inline-flex h-9 items-center rounded-full bg-[#0d4bc9] px-3 text-sm font-semibold text-white hover:bg-[#0a3ea8]">
                        Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="space-y-3">
            {filtered.map((cleaner, index) => (
              <article
                key={cleaner.id}
                className="cleaner-row rounded-2xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#9eb7ec] hover:bg-[#f8fbff]"
                style={{ animationDelay: `${index * 65}ms` }}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-[#0d4bc9]/10 text-lg font-bold text-[#0d4bc9]">
                      {avatarLetter(cleaner.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className={`${displayFont.className} truncate text-xl font-semibold tracking-[-0.02em] text-slate-900`}>
                        {cleaner.name}
                      </h3>
                      <div className="mt-1"><StarRating rating={Number(cleaner.average_rating ?? 0)} /></div>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-600">{cleaner.bio || 'Professional cleaner available for bookings.'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <p className={`${displayFont.className} text-2xl font-bold tracking-[-0.02em] text-slate-900`}>
                      {formatCurrency(Number(cleaner.hourly_rate ?? 0))}
                      <span className="text-sm font-medium text-slate-500">/hr</span>
                    </p>
                    <Link href={`/client/cleaners/${cleaner.id}`} className="inline-flex h-9 items-center rounded-full border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      View Profile
                    </Link>
                    <Link href={`/client/book/${cleaner.id}`} className="inline-flex h-9 items-center rounded-full bg-[#0d4bc9] px-3 text-sm font-semibold text-white hover:bg-[#0a3ea8]">
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
