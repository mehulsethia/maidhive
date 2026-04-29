import { NextRequest } from 'next/server'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { cleanerSearchSchema } from '@/server/schemas/cleaner.schema'

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = cleanerSearchSchema.safeParse(params)
  if (!parsed.success) return err(parsed.error.message, 422)

  const {
    city,
    availability,
    transport_mode,
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

  const [cleaners, total] = await cleanerRepo.search({
    city,
    availability,
    transportMode: transport_mode,
    servicesOffered,
    minRating: min_rating,
    minPrice: min_price,
    maxPrice: max_price,
    page,
    pageSize: page_size,
  })

  const mapped = cleaners.map((cleaner) => ({
    id: cleaner.id,
    user_id: cleaner.userId,
    hourly_rate: Number(cleaner.hourlyRate),
    total_jobs: cleaner.totalJobs,
    average_rating: cleaner.averageRating ? Number(cleaner.averageRating) : null,
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
          email: cleaner.user.email,
          avatar_url: cleaner.user.avatarUrl,
        }
      : undefined,
    service_areas: cleaner.serviceAreas.map((area) => ({
      city: area.city,
      postcode_prefix: area.postcodePrefix,
      radius_km: area.radiusKm ? Number(area.radiusKm) : undefined,
    })),
  }))
  return ok({ cleaners: mapped, total, page, page_size })
}
