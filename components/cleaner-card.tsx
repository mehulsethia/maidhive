import Link from 'next/link'
import { Briefcase, Car, Heart, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StarRating } from '@/components/star-rating'
import { UserAvatar } from '@/components/ui/user-avatar'
import { formatCurrency } from '@/lib/utils'
import type { CleanerSummary } from '@/types'
import { cn } from '@/lib/utils'

interface CleanerCardProps {
  cleaner: CleanerSummary & {
    name?: string
    city?: string
    years_experience?: number
    profile_image_url?: string
    skills?: string[]
    transport_mode?: 'own_car' | 'bus_walk' | 'requires_pickup'
    cleaning_supplies?: 'own_supplies' | 'client_supplies'
  }
  isFavorite: boolean
  onToggleFavorite: (cleanerId: string) => void
}

export function CleanerCard({ cleaner, isFavorite, onToggleFavorite }: CleanerCardProps) {
  const averageRating = Number(cleaner.average_rating ?? 0)
  const reviewCount = Number(cleaner.total_jobs ?? 0)
  const years = cleaner.years_experience ?? 0
  const transportText = cleaner.transport_mode === 'own_car'
    ? 'Own car'
    : cleaner.transport_mode === 'bus_walk'
      ? 'Bus / walk'
      : cleaner.transport_mode === 'requires_pickup'
        ? 'Requires pick-up'
        : null
  const suppliesText = cleaner.cleaning_supplies === 'own_supplies'
    ? 'Brings supplies'
    : cleaner.cleaning_supplies === 'client_supplies'
      ? 'Client supplies'
      : null
  const tags = ['Pro Cleaner', ...(cleaner.skills ?? []).slice(0, 3)]

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-[#8aa8e2] hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <UserAvatar
            name={cleaner.name ?? cleaner.user?.name}
            imageUrl={cleaner.profile_image_url ?? cleaner.user?.avatar_url}
            className="h-12 w-12 shrink-0 border border-slate-200 sm:h-14 sm:w-14"
            textClassName="text-base sm:text-lg"
            fallback="C"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[1.7rem] leading-none font-semibold tracking-[-0.02em] text-slate-900 sm:text-[2rem]">
                  {cleaner.name ?? 'Cleaner'}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <StarRating rating={averageRating} />
                  <span className="text-sm font-semibold text-slate-800">{averageRating > 0 ? averageRating.toFixed(1) : '0.0'}</span>
                  <span className="text-sm text-slate-500">({reviewCount})</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 sm:shrink-0">
                <p className="text-[1.7rem] leading-none font-bold tracking-[-0.02em] text-slate-900 sm:text-[2rem]">
                  {formatCurrency(cleaner.hourly_rate)}
                  <span className="ml-1 text-lg font-medium text-slate-400 sm:text-xl">/hr</span>
                </p>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(cleaner.id)}
                  aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                  className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-full border transition sm:h-12 sm:w-12',
                    isFavorite
                      ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-rose-200 bg-white text-rose-400 hover:bg-rose-50',
                  )}
                >
                  <Heart className={cn('h-5 w-5', isFavorite ? 'fill-current' : '')} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600 sm:mt-4">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-slate-400" />
                {years} yrs experience
              </span>
              {transportText && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Car className="h-4 w-4 text-slate-400" />
                    {transportText}
                  </span>
                </>
              )}
              {suppliesText && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-slate-400" />
                    {suppliesText}
                  </span>
                </>
              )}
            </div>

            <p className="mt-3 text-[0.98rem] leading-7 text-slate-600 line-clamp-3 sm:mt-4 sm:text-base sm:leading-8">
              {cleaner.bio?.trim() || 'Professional cleaner focused on reliable, detail-oriented home care.'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#e9eef9] px-3.5 py-1.5 text-[0.95rem] font-semibold text-[#3051ca] sm:px-4 sm:text-sm">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 h-px bg-slate-200 sm:mt-5" />

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <Link
                href={`/client/cleaners/${cleaner.id}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 text-base font-semibold text-slate-800 hover:bg-slate-50 sm:text-lg"
              >
                View Profile
              </Link>
              <Link
                href={`/client/book/${cleaner.id}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#2846cc] text-base font-semibold text-white hover:bg-[#1f3cb6] sm:text-lg"
              >
                Book Now
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
