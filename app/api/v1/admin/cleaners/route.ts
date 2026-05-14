import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { db } from '@/server/db'
import { ok } from '@/server/response'
import { deriveCleanerLifecycleStatus } from '@/lib/cleaner-status'

export const GET = requireAdmin(async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)

  const [cleaners, total] = await cleanerRepo.listAll({ status, page, pageSize })
  const cleanerIds = cleaners.map((cleaner) => cleaner.id)
  const completedJobsAgg = cleanerIds.length
    ? await db.booking.groupBy({
        by: ['cleanerId'],
        where: {
          cleanerId: { in: cleanerIds },
          status: { in: ['completed', 'disputed'] },
        },
        _count: { _all: true },
      })
    : []
  const reviewsAgg = cleanerIds.length
    ? await db.review.groupBy({
        by: ['cleanerId'],
        where: { cleanerId: { in: cleanerIds } },
        _avg: { rating: true },
      })
    : []
  const completedJobsByCleanerId = new Map<string, number>(
    completedJobsAgg.map((entry) => [entry.cleanerId, entry._count._all]),
  )
  const avgRatingByCleanerId = new Map<string, number | null>(
    reviewsAgg.map((entry) => [entry.cleanerId, entry._avg.rating ?? null]),
  )

  const formatted = cleaners.map((cleaner) => {
    const fullName = cleaner.user?.name?.trim()
    const fallbackName =
      fullName && fullName.length > 0
        ? fullName
        : cleaner.user?.email?.split('@')[0] || 'Cleaner'
    const lifecycleStatus = deriveCleanerLifecycleStatus({
      status: cleaner.status,
      stripeOnboardingComplete: cleaner.stripeOnboardingComplete,
      profileComplete: cleaner.profileComplete,
    })
    const completedJobs = completedJobsByCleanerId.get(cleaner.id) ?? 0
    return {
      id: cleaner.id,
      user_id: cleaner.userId,
      user_name: fallbackName,
      user_email: cleaner.user?.email ?? '',
      user_phone: cleaner.user?.phone ?? undefined,
      bio: cleaner.bio,
      skills: cleaner.skills,
      cleaning_supplies: cleaner.cleaningSupplies,
      years_experience: cleaner.yearsExperience,
      hourly_rate: cleaner.hourlyRate,
      transport_mode: cleaner.transportMode,
      id_type: cleaner.idType,
      id_file_name: cleaner.idFileName,
      id_file_url: cleaner.idFileUrl,
      profile_image_url: cleaner.profileImageUrl,
      status: cleaner.status,
      lifecycle_status: lifecycleStatus,
      rejection_reason: cleaner.rejectionReason,
      profile_complete: cleaner.profileComplete,
      identity_verified: cleaner.identityVerified,
      cleaning_standards_accepted: cleaner.cleaningStandardsAccepted,
      standards_completed: cleaner.standardsCompleted,
      quiz_passed: cleaner.quizPassed,
      quiz_score: cleaner.quizScore,
      stripe_onboarding_complete: cleaner.stripeOnboardingComplete,
      trial_period_flag: completedJobs < 10,
      total_jobs: completedJobs,
      average_rating: avgRatingByCleanerId.get(cleaner.id) ?? null,
      created_at: cleaner.createdAt,
    }
  })
  return ok({ cleaners: formatted, total, page, page_size: pageSize })
})
