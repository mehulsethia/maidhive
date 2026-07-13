import { NextRequest } from 'next/server'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { db } from '@/server/db'
import { ok, err } from '@/server/response'
import { cleanerSearchSchema } from '@/server/schemas/cleaner.schema'
import { isNewCleanerByCompletedJobs } from '@/lib/cleaner-badges'
import { cleanerReliabilityService } from '@/server/services/cleaner-reliability.service'

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = cleanerSearchSchema.safeParse(params)
  if (!parsed.success) return err(parsed.error.message, 422)

  const {
    city,
    availability,
    transport_mode,
    brings_own_supplies,
    services_offered,
    min_rating,
    min_price,
    max_price,
    page,
    page_size,
  } = parsed.data
  const servicesOffered = services_offered
    ? services_offered
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    : undefined

  const publicSuperCleanerEnabled = await cleanerReliabilityService.publicFeatureEnabled()
  const [cleaners, total] = await cleanerRepo.search({
    city,
    availability,
    transportMode: transport_mode,
    cleaningSupplies: brings_own_supplies === 'yes' ? 'own_supplies' : brings_own_supplies === 'no' ? 'client_supplies' : undefined,
    servicesOffered,
    minRating: min_rating,
    minPrice: min_price,
    maxPrice: max_price,
    page,
    pageSize: page_size,
    prioritizeSuperCleaner: publicSuperCleanerEnabled,
  })
  const cleanerIds = cleaners.map((cleaner) => cleaner.id)
  const completedJobsAgg = cleanerIds.length
    ? await db.booking.groupBy({
      by: ['cleanerId'],
      where: {
        cleanerId: { in: cleanerIds },
        status: 'completed',
        payment: { is: { status: 'transferred' } },
      },
      _count: { _all: true },
    })
    : []
  const reviewsAgg = cleanerIds.length
    ? await db.review.groupBy({
      by: ['cleanerId'],
      where: { cleanerId: { in: cleanerIds }, isPublic: true },
      _avg: { rating: true },
    })
    : []
  const completedJobsByCleanerId = new Map<string, number>(
    completedJobsAgg.map((entry) => [entry.cleanerId, entry._count._all]),
  )
  const avgRatingByCleanerId = new Map<string, number | null>(
    reviewsAgg.map((entry) => [entry.cleanerId, entry._avg.rating ?? null]),
  )

  const mapped = cleaners.map((cleaner) => {
    const completedJobs = completedJobsByCleanerId.get(cleaner.id) ?? 0
    return {
      id: cleaner.id,
      user_id: cleaner.userId,
      hourly_rate: Number(cleaner.hourlyRate),
      total_jobs: completedJobs,
      new_cleaner_badge: isNewCleanerByCompletedJobs(completedJobs),
      average_rating:
        completedJobs >= 5 ? avgRatingByCleanerId.get(cleaner.id) ?? null : null,
      ...cleanerReliabilityService.publicMetrics(
        cleaner.reliabilitySnapshot,
        publicSuperCleanerEnabled,
      ),
      years_experience: cleaner.yearsExperience,
      transport_mode: cleaner.transportMode,
      cleaning_supplies: cleaner.cleaningSupplies,
      created_at: cleaner.createdAt,
      bio: cleaner.bio,
      skills: cleaner.skills,
      profile_image_url: cleaner.profileImageUrl,
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
  return ok({ cleaners: mapped, total, page, page_size })
}
