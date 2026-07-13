import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireClient } from '@/server/auth'
import { db } from '@/server/db'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { clientFavoriteRepo } from '@/server/repositories/client-favorite.repo'
import { ok, err } from '@/server/response'

const addFavoriteSchema = z.object({
  cleaner_id: z.string().uuid(),
})

export const GET = requireClient(async (_req: NextRequest, _ctx, user) => {
  let client = await clientRepo.findByUserId(user.id)
  if (!client) client = await clientRepo.create(user.id)

  const favorites = await clientFavoriteRepo.listByClientId(client.id)
  const visibleFavorites = favorites
    .filter((favorite) => {
      const cleaner = favorite.cleaner
      return cleaner.status === 'approved' && cleaner.profileComplete && cleaner.stripeOnboardingComplete
    })
  const cleanerIds = visibleFavorites.map((favorite) => favorite.cleaner.id)

  const [completedJobsAgg, reviewsAgg] = cleanerIds.length
    ? await Promise.all([
        db.booking.groupBy({
          by: ['cleanerId'],
          where: {
            cleanerId: { in: cleanerIds },
            status: { in: ['completed', 'disputed'] },
          },
          _count: { _all: true },
        }),
        db.review.groupBy({
          by: ['cleanerId'],
          where: {
            cleanerId: { in: cleanerIds },
            isPublic: true,
          },
          _count: { _all: true },
          _avg: { rating: true },
        }),
      ])
    : [[], []]

  const completedJobsByCleanerId = new Map<string, number>(
    completedJobsAgg.map((entry) => [entry.cleanerId, entry._count._all]),
  )
  const reviewsByCleanerId = new Map<string, { count: number; avg: number | null }>(
    reviewsAgg.map((entry) => [
      entry.cleanerId,
      {
        count: entry._count._all,
        avg: entry._avg.rating ?? null,
      },
    ]),
  )

  const mapped = visibleFavorites.map((favorite) => {
      const cleaner = favorite.cleaner
      const jobsCount = completedJobsByCleanerId.get(cleaner.id) ?? 0
      const reviewMetrics = reviewsByCleanerId.get(cleaner.id)
      return {
        cleaner_id: cleaner.id,
        user_id: cleaner.userId,
        hourly_rate: Number(cleaner.hourlyRate),
        total_jobs: jobsCount,
        average_rating: reviewMetrics?.avg ?? null,
        review_count: reviewMetrics?.count ?? 0,
        years_experience: cleaner.yearsExperience,
        transport_mode: cleaner.transportMode,
        cleaning_supplies: cleaner.cleaningSupplies,
        bio: cleaner.bio,
        profile_image_url: cleaner.profileImageUrl,
        created_at: cleaner.createdAt,
        user: cleaner.user
          ? {
              id: cleaner.user.id,
              name: cleaner.user.name,
              avatar_url: cleaner.user.avatarUrl,
            }
          : undefined,
        service_areas: cleaner.serviceAreas.map((area) => ({
          city: area.city,
          postcode_prefix: area.postcodePrefix,
          radius_km: area.radiusKm ? Number(area.radiusKm) : undefined,
        })),
      }
    })

  return ok(mapped)
})

export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  const body = await req.json().catch(() => ({}))
  const parsed = addFavoriteSchema.safeParse(body)
  if (!parsed.success) return err('Invalid cleaner selection', 422)

  let client = await clientRepo.findByUserId(user.id)
  if (!client) client = await clientRepo.create(user.id)

  const cleaner = await cleanerRepo.findById(parsed.data.cleaner_id)
  if (!cleaner || cleaner.status !== 'approved' || !cleaner.profileComplete || !cleaner.stripeOnboardingComplete) {
    return err('Cleaner not found', 404)
  }

  await clientFavoriteRepo.add(client.id, cleaner.id)
  return ok({ favorite: true }, 201)
})
