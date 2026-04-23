import Link from 'next/link'
import { MapPin, Briefcase } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/star-rating'
import { UserAvatar } from '@/components/ui/user-avatar'
import { formatCurrency } from '@/lib/utils'
import type { CleanerSummary } from '@/types'

interface CleanerCardProps {
  cleaner: CleanerSummary & { name?: string; city?: string }
}

export function CleanerCard({ cleaner }: CleanerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Avatar */}
          <UserAvatar
            name={cleaner.name ?? cleaner.user?.name}
            imageUrl={cleaner.profile_image_url ?? cleaner.user?.avatar_url}
            className="h-14 w-14 shrink-0"
            textClassName="text-lg"
            fallback="C"
          />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{cleaner.name ?? 'Cleaner'}</h3>
            {cleaner.city && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {cleaner.city}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <StarRating rating={cleaner.average_rating ?? 0} />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {cleaner.total_jobs} jobs
              </span>
            </div>

            {cleaner.bio && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{cleaner.bio}</p>
            )}
          </div>

          <div className="text-right shrink-0">
            <p className="font-bold text-lg">{formatCurrency(cleaner.hourly_rate)}</p>
            <p className="text-xs text-muted-foreground">per hour</p>
          </div>
        </div>

        <div className="mt-4">
          <Link href={`/client/cleaners/${cleaner.id}`}>
            <Button className="w-full" size="sm">View profile</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
