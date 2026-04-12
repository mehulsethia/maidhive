'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Briefcase, CalendarCheck, CheckCircle, Clock, MapPin, Phone, Star, TrendingUp } from 'lucide-react'
import { cleanersApi, reviewsApi } from '@/lib/api'
import { StarRating } from '@/components/star-rating'
import { DetailPageSkeleton } from '@/components/page-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { CleanerRead, ReviewRead } from '@/types'
import { toast } from 'sonner'

export default function CleanerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cleaner, setCleaner] = useState<CleanerRead | null>(null)
  const [reviews, setReviews] = useState<ReviewRead[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'reviews'>('overview')

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

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  }, [reviews])

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]
    reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++ })
    return dist
  }, [reviews])

  const completionRate = useMemo(() => {
    if (!cleaner || cleaner.total_jobs === 0) return 0
    return 98 // placeholder — real value would come from backend
  }, [cleaner])

  if (loading) return <DetailPageSkeleton />
  if (!cleaner) return <div className="text-center py-16 text-muted-foreground">Cleaner not found.</div>

  const cleanerName = cleaner.user?.name ?? 'Professional Cleaner'
  const memberSince = cleaner.created_at ? new Date(cleaner.created_at).toLocaleDateString('en-IE', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Europe/Nicosia' }) : ''
  const location = cleaner.service_areas?.[0]?.city ?? ''

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Hero section */}
      <div className="relative">
        {/* Cover image */}
        <div className="h-48 rounded-t-2xl bg-gradient-to-r from-primary/80 to-indigo-500/80 overflow-hidden">
          <div className="h-full w-full bg-[url('https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=400&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-40" />
        </div>

        {/* Profile card overlaying the cover */}
        <Card className="relative mx-4 -mt-20 border-slate-200 shadow-lg">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              {/* Avatar */}
              <div className="shrink-0 -mt-16 sm:-mt-16">
                {cleaner.profile_image_url ? (
                  <img
                    src={cleaner.profile_image_url}
                    alt={cleanerName}
                    className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full border-4 border-white bg-primary flex items-center justify-center shadow-md">
                    <span className="text-3xl font-bold text-white">{cleanerName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{cleanerName}</h1>
                    <p className="text-sm text-slate-500">Member since {memberSince}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600">
                      <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" /> {cleaner.years_experience} year{cleaner.years_experience !== 1 ? 's' : ''} experience</span>
                      {location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <StarRating rating={avgRating} size="sm" />
                      <p className="text-xs text-slate-500 mt-0.5">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{formatCurrency(cleaner.hourly_rate)}</p>
                      <p className="text-xs text-slate-500">/hr</p>
                    </div>
                  </div>
                </div>

                {/* CTA buttons */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="lg" className="flex-1 sm:flex-none min-w-[160px]" onClick={() => router.push(`/client/book/${id}`)}>
                    Book Service
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1 sm:flex-none min-w-[160px]">
                    Send Message
                  </Button>
                  {cleaner.user?.phone && (
                    <a href={`tel:${cleaner.user.phone}`} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-slate-50">
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center justify-center p-4 text-center">
            <CheckCircle className="h-6 w-6 text-primary mb-2" />
            <p className="text-2xl font-bold text-slate-900">{cleaner.total_jobs}</p>
            <p className="text-xs text-slate-500">Jobs Completed</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center justify-center p-4 text-center">
            <Star className="h-6 w-6 text-amber-400 mb-2" />
            <p className="text-2xl font-bold text-slate-900">{avgRating > 0 ? `${avgRating.toFixed(1)}/5` : '—'}</p>
            <p className="text-xs text-slate-500">Average Rating</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center justify-center p-4 text-center">
            <TrendingUp className="h-6 w-6 text-emerald-500 mb-2" />
            <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
            <p className="text-xs text-slate-500">Completion Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex justify-center border-b border-slate-200">
        <button
          onClick={() => setTab('overview')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab('reviews')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'reviews' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Reviews
        </button>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {/* About */}
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <h3 className="font-semibold text-slate-900 mb-2">About {cleanerName}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {cleaner.bio || 'No bio provided yet.'}
                </p>

                {cleaner.skills && cleaner.skills.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Services</h4>
                    <div className="flex flex-wrap gap-2">
                      {cleaner.skills.map(s => (
                        <span key={s} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contact info sidebar */}
          <Card className="border-slate-200 h-fit">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">Contact Information</h3>
              {cleaner.user?.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Phone Number</p>
                    <p className="text-sm font-medium text-slate-900">{cleaner.user.phone}</p>
                  </div>
                </div>
              )}
              {cleaner.transport_mode && (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Mode Of Transport</p>
                    <p className="text-sm font-medium text-slate-900">
                      {cleaner.transport_mode === 'own_car' ? 'Own Car' : cleaner.transport_mode === 'bus_walk' ? 'Bus / Walk' : 'Requires Pick-up'}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <CalendarCheck className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Availability</p>
                  <p className="text-sm font-medium text-slate-900">Available this week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {/* Rating summary */}
          <Card className="border-slate-200 h-fit">
            <CardContent className="p-5 text-center">
              <p className="text-4xl font-bold text-slate-900">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
              <StarRating rating={avgRating} size="md" showValue={false} className="justify-center mt-1" />
              <p className="text-sm text-slate-500 mt-1">{reviews.length} Review{reviews.length !== 1 ? 's' : ''}</p>

              {/* Rating distribution */}
              <div className="mt-4 space-y-1.5">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = ratingDistribution[star - 1]
                  const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0
                  return (
                    <div key={star} className="flex items-center gap-2 text-sm">
                      <span className="w-3 text-right text-slate-600">{star}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs text-slate-500">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Reviews list */}
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <Card className="border-slate-200">
                <CardContent className="p-8 text-center text-sm text-slate-500">
                  No reviews yet.
                </CardContent>
              </Card>
            ) : (
              reviews.map(review => (
                <Card key={review.id} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-900">Client</p>
                        <p className="text-xs text-slate-500">{formatDate(review.created_at)}</p>
                      </div>
                      <StarRating rating={review.rating} showValue={false} />
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {review.comment || 'No written comment provided.'}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
