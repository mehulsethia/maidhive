import { cleanerRepo } from '../repositories/cleaner.repo'
import { db } from '../db'
import { ServiceError } from './booking.service'
import { loopsEmailService } from './loops-email.service'
import { pushInAppNotification } from './in-app-notification.service'
import { availabilityRepo } from '../repositories/availability.repo'
import { validateCleanerSubmissionRequirements } from './cleaner-onboarding.service'
import type { User } from '@prisma/client'
import {
  CleanerRejectionReasonCode,
  composeCleanerRejectionMessage,
  rejectionFixGuidance,
} from '@/lib/cleaner-status'

const STRIKE_SUSPEND_THRESHOLD = 3

export const cleanerService = {
  async approve(
    cleanerId: string,
    adminUser: User,
    action: 'approve' | 'reject',
    rejectionReason?: string,
    rejectionReasonCode?: CleanerRejectionReasonCode,
    rejectionCustomMessage?: string,
  ) {
    const cleaner = await cleanerRepo.findById(cleanerId)
    if (!cleaner) throw new ServiceError('Cleaner not found', 404)
    if (cleaner.status !== 'pending') throw new ServiceError('Cleaner is not in pending status', 400)
    if (action === 'approve') {
      const schedules = await availabilityRepo.getSchedule(cleaner.id)
      const hasAvailabilitySlots = schedules.some((s) => s.isActive)
      const submissionValidation = validateCleanerSubmissionRequirements({ cleaner, hasAvailabilitySlots })
      if (!submissionValidation.valid) {
        throw new ServiceError(
          `Cleaner profile is incomplete and cannot be approved. Missing: ${submissionValidation.missingFields.join(', ')}.`,
          400,
        )
      }
      if (!cleaner.profileComplete) {
        throw new ServiceError('Cleaner profile is not submitted yet. Ask the cleaner to submit onboarding first.', 400)
      }
    }
    const resolvedRejectionMessage = composeCleanerRejectionMessage({
      reasonCode: rejectionReasonCode,
      customMessage: rejectionCustomMessage ?? rejectionReason,
    })

    const updated = await cleanerRepo.update(cleanerId, {
      status: action === 'approve' ? 'approved' : 'rejected',
      rejectionReason: action === 'reject' ? resolvedRejectionMessage : null,
      approvedAt: action === 'approve' ? new Date() : null,
      approvedBy: action === 'approve' ? adminUser.id : null,
    })

    await pushInAppNotification({
      userId: updated.userId,
      type: action === 'approve' ? 'cleaner_application_approved' : 'cleaner_application_rejected',
      title: action === 'approve' ? 'Cleaner profile approved' : 'Cleaner profile rejected',
      body:
        action === 'approve'
          ? updated.stripeOnboardingComplete
            ? 'Your profile is approved and live for client bookings.'
            : 'Your profile is approved. Connect Stripe to go live.'
          : `Your cleaner profile was rejected: ${resolvedRejectionMessage} ${rejectionFixGuidance(rejectionReasonCode)}`,
      data: {
        cleaner_id: updated.id,
        rejection_reason_code: rejectionReasonCode ?? null,
      },
    })

    try {
      if (action === 'approve') {
        await loopsEmailService.sendCleanerApplicationApproved({
          email: updated.user.email,
          fullName: updated.user.name ?? 'Cleaner',
        })
      } else {
        await loopsEmailService.sendCleanerApplicationRejected({
          email: updated.user.email,
          fullName: updated.user.name ?? 'Cleaner',
        })
      }
    } catch (emailError) {
      console.error('Failed to send cleaner application status email via Loops:', emailError)
    }

    return updated
  },

  async issueStrike(
    cleanerId: string,
    issuedBy: string | null,
    strikeType: string,
    reason: string,
    bookingId?: string,
  ) {
    await db.cleanerStrike.create({
      data: {
        cleanerId,
        strikeType,
        reason,
        issuedBy,
        bookingId,
      },
    })

    const strikeCount = await cleanerRepo.countStrikes(cleanerId)
    if (strikeCount >= STRIKE_SUSPEND_THRESHOLD) {
      await cleanerRepo.update(cleanerId, { status: 'suspended' })
    }

    return strikeCount
  },

  async toggleSuspension(cleanerId: string) {
    const cleaner = await cleanerRepo.findById(cleanerId)
    if (!cleaner) throw new ServiceError('Cleaner not found', 404)

    const suspend = cleaner.status !== 'suspended'
    return cleanerRepo.suspend(cleanerId, suspend)
  },
}
