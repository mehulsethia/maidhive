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
  const bio = cleaner.bio?.trim() || 'Detail-oriented cleaner with a calm, methodical approach.'
  const name = cleaner.name ?? cleaner.user?.name ?? 'Cleaner'

  return (
    <Card className="rounded-[2rem] border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-[#8aa8e2] hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5 sm:gap-4">
          <UserAvatar
            name={name}
            imageUrl={cleaner.profile_image_url ?? cleaner.user?.avatar_url}
            className="h-16 w-16 shrink-0 border border-slate-200 sm:h-[6.5rem] sm:w-[6.5rem]"
            textClassName="text-base sm:text-lg"
            fallback="C"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0 pr-2">
                <h3 className="truncate text-[2rem] leading-none font-semibold tracking-[-0.02em] text-slate-900 sm:text-[2.2rem]">
                  {name}
                </h3>
                <div className="mt-1.5 flex items-center gap-2 whitespace-nowrap">
                  <StarRating rating={averageRating} />
                  <span className="text-[2rem] font-semibold leading-none text-slate-900 sm:text-[2.1rem]">
                    {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
                  </span>
                  <span className="text-[1.8rem] leading-none text-slate-400 sm:text-[2rem]">({reviewCount})</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-[2rem] leading-none font-bold tracking-[-0.02em] text-slate-900 sm:text-[2.1rem]">
                  {formatCurrency(cleaner.hourly_rate)}
                  <span className="ml-1 text-[1.9rem] font-medium text-slate-400 sm:text-[2rem]">/hr</span>
                </p>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(cleaner.id)}
                  aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                  className={cn(
                    'inline-flex h-14 w-14 items-center justify-center rounded-full border transition',
                    isFavorite
                      ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-rose-200 bg-white text-rose-400 hover:bg-rose-50',
                  )}
                >
                  <Heart className={cn('h-6 w-6', isFavorite ? 'fill-current' : '')} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[1.9rem] leading-tight text-slate-600 sm:text-[2rem]">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-5 w-5 text-slate-400" />
                {years} yrs experience
              </span>
              {transportText && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Car className="h-5 w-5 text-slate-400" />
                    {transportText}
                  </span>
                </>
              )}
              {suppliesText && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="h-5 w-5 text-slate-400" />
                    {suppliesText}
                  </span>
                </>
              )}
            </div>

            <p className="mt-4 text-[2rem] leading-[1.4] text-slate-600 line-clamp-3 sm:text-[2.1rem]">
              {bio}
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#e9eef9] px-4 py-2 text-[1.7rem] font-semibold leading-none text-[#3051ca] sm:text-[1.8rem]">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 h-px bg-slate-200" />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href={`/client/cleaners/${cleaner.id}`}
                className="inline-flex h-14 items-center justify-center rounded-full border border-slate-300 text-[2rem] font-semibold text-slate-800 hover:bg-slate-50 sm:text-[2.1rem]"
              >
                View Profile
              </Link>
              <Link
                href={`/client/book/${cleaner.id}`}
                className="inline-flex h-14 items-center justify-center rounded-full bg-[#2846cc] text-[2rem] font-semibold text-white hover:bg-[#1f3cb6] sm:text-[2.1rem]"
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
