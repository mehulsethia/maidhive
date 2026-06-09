import Link from 'next/link'
import { Briefcase, Car, Heart, Package, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
  const hasRating = averageRating > 0
  const displayRating = hasRating ? averageRating.toFixed(1) : null
  const displayCount = hasRating ? `(${reviewCount})` : '(0)'
  const showNewCleanerBadge = cleaner.new_cleaner_badge ?? reviewCount < 5

  return (
    <Card className="rounded-[20px] border-[#ecedf3] bg-white shadow-[0_1px_2px_rgba(15,23,51,0.04),0_12px_32px_-12px_rgba(15,23,51,0.10)]">
      <CardContent className="p-4 sm:p-[22px]">
        <div className="space-y-5">
	          <div className="flex min-w-0 items-start gap-3.5">
            <UserAvatar
              name={name}
              imageUrl={cleaner.profile_image_url ?? cleaner.user?.avatar_url}
              className="h-14 w-14 shrink-0 border border-[#e3e6ef]"
              textClassName="text-base"
              fallback="C"
            />
            <div className="min-w-0 flex-1">
	              <div className="flex min-w-0 flex-col gap-2.5 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between sm:gap-3">
                <div className="min-w-0 pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[18px] leading-[1.15] font-bold tracking-[-0.01em] text-[#0f1733]">
                      {name}
                    </h3>
                    {showNewCleanerBadge && (
                      <span
                        title="Newly approved cleaner on MaidHive."
                        className="inline-flex shrink-0 items-center rounded-full border border-[#dbe1f3] bg-[#f5f7ff] px-2 py-0.5 text-[11px] font-semibold text-[#51608a]"
                      >
                        New Cleaner
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-0.5 text-[#f5b400]">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const filled = hasRating && averageRating >= index + 1
                        return (
                          <Star
                            key={index}
                            className={cn('h-[13px] w-[13px]', filled ? 'fill-current text-[#f5b400]' : 'text-[#c9cdda]')}
                          />
                        )
                      })}
                    </span>
                    {displayRating ? (
                      <span className="text-[12.5px] font-semibold leading-none text-[#0f1733]">
                        {displayRating}
                      </span>
                    ) : null}
                    <span className="text-[12.5px] leading-none text-[#8a90a8]">{displayCount}</span>
                  </div>
                </div>
	                <div className="flex shrink-0 items-center gap-2">
	                  <p className="text-[18px] font-bold leading-none tracking-[-0.01em] text-[#0f1733]">
                    {formatCurrency(cleaner.hourly_rate)}
                    <span className="ml-1 text-[12px] font-medium text-[#8a90a8]">/hr</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(cleaner.id)}
                    aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-full border transition',
                      isFavorite
                        ? 'border-[#ffd9dd] bg-[#fff1f2] text-[#e11d48]'
                        : 'border-[#ffd9dd] bg-white text-[#f06a84] hover:bg-[#fff1f2]',
                    )}
                  >
                    <Heart className={cn('h-[15px] w-[15px]', isFavorite ? 'fill-current' : '')} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#4a5170]">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-[15px] w-[15px] text-[#8a90a8]" />
                {years} yrs
              </span>
              {transportText && (
                <>
                  <span className="text-[#e3e6ef]">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Car className="h-[15px] w-[15px] text-[#8a90a8]" />
                    {transportText}
                  </span>
                </>
              )}
              {suppliesText && (
                <>
                  <span className="text-[#e3e6ef]">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="h-[15px] w-[15px] text-[#8a90a8]" />
                    {suppliesText}
                  </span>
                </>
              )}
          </div>

          <p className="text-[15px] leading-[1.5] text-[#4a5170] line-clamp-3">
            {bio}
          </p>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#eef1ff] px-[11px] py-[5px] text-[12.5px] font-semibold tracking-[0.005em] text-[#1f3bd6]">
                {tag}
              </span>
            ))}
          </div>

          <div className="h-px bg-[#ecedf3]" />

	          <div className="grid gap-2.5 min-[360px]:grid-cols-2">
	            <Link
	              href={`/client/cleaners/${cleaner.id}`}
	              className="inline-flex min-h-[44px] min-w-0 items-center justify-center rounded-xl border border-[#e3e6ef] px-3 text-center text-[14px] font-semibold leading-snug text-[#0f1733] hover:bg-[#fafbfe]"
	            >
	              View Profile
	            </Link>
	            <Link
	              href={`/client/book/${cleaner.id}?fresh=1`}
	              className="inline-flex min-h-[44px] min-w-0 items-center justify-center rounded-xl bg-[#1f3bd6] px-3 text-center text-[14px] font-semibold leading-snug text-white hover:bg-[#182fb3]"
	            >
	              Book Now
            </Link>
          </div>
          </div>
      </CardContent>
    </Card>
  )
}
