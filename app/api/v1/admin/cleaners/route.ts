import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok } from '@/server/response'
import { deriveCleanerLifecycleStatus } from '@/lib/cleaner-status'

export const GET = requireAdmin(async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)

  const [cleaners, total] = await cleanerRepo.listAll({ status, page, pageSize })
  const formatted = cleaners.map((cleaner) => {
    const fullName = cleaner.user?.name?.trim()
    const fallbackName =
      fullName && fullName.length > 0
        ? fullName
        : cleaner.user?.email?.split('@')[0] || 'Cleaner'
    const lifecycleStatus = deriveCleanerLifecycleStatus({
      status: cleaner.status,
      stripeOnboardingComplete: cleaner.stripeOnboardingComplete,
    })
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
      trial_period_flag: cleaner.totalJobs < 10,
      total_jobs: cleaner.totalJobs,
      average_rating: cleaner.averageRating,
      created_at: cleaner.createdAt,
    }
  })
  return ok({ cleaners: formatted, total, page, page_size: pageSize })
})
