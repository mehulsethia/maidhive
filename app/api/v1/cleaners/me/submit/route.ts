import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { availabilityRepo } from '@/server/repositories/availability.repo'
import {
  computeCleanerOnboardingProgress,
  validateCleanerSubmissionRequirements,
} from '@/server/services/cleaner-onboarding.service'
import { loopsEmailService } from '@/server/services/loops-email.service'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'
import { db } from '@/server/db'
import { ok, err } from '@/server/response'

export const POST = requireCleaner(async (_req, _ctx, user) => {
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found.', 404)
  const shouldNotifyAdmin = cleaner.status !== 'pending' || !cleaner.profileComplete

  const schedules = await availabilityRepo.getSchedule(cleaner.id)
  const hasAvailabilitySlots = schedules.some((s) => s.isActive)
  const onboarding = computeCleanerOnboardingProgress({ cleaner, hasAvailabilitySlots })
  const submissionValidation = validateCleanerSubmissionRequirements({ cleaner, hasAvailabilitySlots })

  if (!submissionValidation.valid || onboarding.completion_pct < 100) {
    const missing = submissionValidation.missingFields
    const guidance =
      missing.length > 0
        ? ` Missing: ${missing.join(', ')}.`
        : ''
    return err(`Profile is not yet complete. Please finish all onboarding requirements first.${guidance}`, 400)
  }

  if (cleaner.status === 'approved') {
    return err('Profile is already approved.', 400)
  }

  const updated = await cleanerRepo.update(cleaner.id, {
    profileComplete: true,
    status: 'pending',
    rejectionReason: null,
  })

  await pushInAppNotification({
    userId: user.id,
    type: 'cleaner_application_submitted',
    title: 'Application submitted',
    body: 'Your cleaner profile has been submitted for admin review.',
    data: { cleaner_id: cleaner.id },
  })

  if (shouldNotifyAdmin) {
    const admins = await db.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    })
    await Promise.all(
      admins.map((admin) =>
        pushInAppNotification({
          userId: admin.id,
          type: 'cleaner_application_submitted',
          title: 'New cleaner application',
          body: `${cleaner.user?.name ?? 'A cleaner'} submitted onboarding for approval.`,
          data: { cleaner_id: cleaner.id },
        }),
      ),
    )

    try {
      await loopsEmailService.sendAdminNewCleanerApplication({
        cleanerName: cleaner.user?.name ?? 'Cleaner',
        cleanerEmail: cleaner.user?.email ?? '',
      })
    } catch (emailError) {
      console.error('Failed to send admin cleaner application email via Loops:', emailError)
    }
  }

  return ok({ cleaner: updated, onboarding })
})
