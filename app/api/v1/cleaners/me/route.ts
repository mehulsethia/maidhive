import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { availabilityRepo } from '@/server/repositories/availability.repo'
import { computeCleanerOnboardingProgress } from '@/server/services/cleaner-onboarding.service'
import { ok, err } from '@/server/response'
import { updateCleanerSchema } from '@/server/schemas/cleaner.schema'

export const GET = requireCleaner(async (_req, _ctx, user) => {
  let cleaner = await cleanerRepo.findByUserId(user.id)

  // Auto-create the cleaner profile if it doesn't exist yet (e.g. sync race condition)
  if (!cleaner) {
    cleaner = await cleanerRepo.create(user.id)
  }

  const schedules = await availabilityRepo.getSchedule(cleaner.id)
  const hasAvailabilitySlots = schedules.some((s) => s.isActive)
  const onboarding = computeCleanerOnboardingProgress({ cleaner, hasAvailabilitySlots })

  return ok({ cleaner, onboarding })
})

export const PATCH = requireCleaner(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = updateCleanerSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  let cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) {
    cleaner = await cleanerRepo.create(user.id)
  }

  const interim = await cleanerRepo.update(cleaner.id, {
    ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
    ...(parsed.data.profile_image_url !== undefined ? { profileImageUrl: parsed.data.profile_image_url } : {}),
    ...(parsed.data.skills !== undefined ? { skills: parsed.data.skills } : {}),
    ...(parsed.data.years_experience !== undefined ? { yearsExperience: parsed.data.years_experience } : {}),
    ...(parsed.data.hourly_rate !== undefined ? { hourlyRate: parsed.data.hourly_rate } : {}),
    ...(parsed.data.transport_mode !== undefined ? { transportMode: parsed.data.transport_mode } : {}),
    ...(parsed.data.transport_pickup_location !== undefined
      ? { transportPickupLocation: parsed.data.transport_pickup_location }
      : {}),
    ...(parsed.data.id_type !== undefined ? { idType: parsed.data.id_type } : {}),
    ...(parsed.data.id_file_name !== undefined ? { idFileName: parsed.data.id_file_name } : {}),
    ...(parsed.data.pet_acceptance !== undefined ? { petAcceptance: parsed.data.pet_acceptance } : {}),
    ...(parsed.data.work_eligibility_confirmed !== undefined
      ? { workEligibilityConfirmed: parsed.data.work_eligibility_confirmed }
      : {}),
    ...(parsed.data.terms_accepted !== undefined ? { termsAccepted: parsed.data.terms_accepted } : {}),
    ...(parsed.data.onboarding_skipped_step3 !== undefined
      ? { onboardingSkippedStep3: parsed.data.onboarding_skipped_step3 }
      : {}),
    ...(parsed.data.onboarding_skipped_step4 !== undefined
      ? { onboardingSkippedStep4: parsed.data.onboarding_skipped_step4 }
      : {}),
    ...(parsed.data.onboarding_step !== undefined ? { onboardingStep: parsed.data.onboarding_step } : {}),
  })

  const schedules = await availabilityRepo.getSchedule(cleaner.id)
  const hasAvailabilitySlots = schedules.some((s) => s.isActive)
  const onboarding = computeCleanerOnboardingProgress({ cleaner: interim, hasAvailabilitySlots })

  const updated = await cleanerRepo.update(cleaner.id, {
    profileComplete: parsed.data.profile_complete ?? onboarding.can_be_listed,
    onboardingStep: parsed.data.onboarding_step ?? onboarding.current_step,
    onboardingCompletedAt: onboarding.can_be_listed ? interim.onboardingCompletedAt ?? new Date() : null,
  })

  return ok({ cleaner: updated, onboarding })
})
