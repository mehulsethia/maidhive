'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, Briefcase, Clock, Star } from 'lucide-react'
import { cleanersApi, reviewsApi } from '@/lib/api'
import { StarRating } from '@/components/star-rating'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { CleanerRead, ReviewRead } from '@/types'
import { toast } from 'sonner'

export default function CleanerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cleaner, setCleaner] = useState<CleanerRead | null>(null)
  const [reviews, setReviews] = useState<ReviewRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      cleanersApi.getById(id),
      reviewsApi.getForCleaner(id),
    ])
      .then(([cleanerRes, reviewsRes]) => {
        setCleaner(cleanerRes.data ?? null)
        setReviews(reviewsRes.data ?? [])
      })
      .catch(() => toast.error('Failed to load cleaner profile'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingSpinner />
  if (!cleaner) return <div className="text-center py-16 text-muted-foreground">Cleaner not found.</div>

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-2xl">C</span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Professional Cleaner</h1>
              <StarRating rating={cleaner.average_rating ?? 0} size="md" className="mt-1" />

              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  {cleaner.total_jobs} jobs completed
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {cleaner.years_experience} year{cleaner.years_experience !== 1 ? 's' : ''} experience
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{formatCurrency(cleaner.hourly_rate)}</p>
              <p className="text-sm text-muted-foreground">per hour</p>
            </div>
          </div>

          {cleaner.bio && (
            <>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground leading-relaxed">{cleaner.bio}</p>
            </>
          )}

          <Button
            className="w-full mt-5"
            size="lg"
            onClick={() => router.push(`/client/book/${id}`)}
          >
            Book this cleaner
          </Button>
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle>Reviews ({reviews.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No reviews yet.</p>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <StarRating rating={review.rating} showValue={false} />
                  <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
                </div>
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
