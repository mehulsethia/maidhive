import { cleanerRepo } from '../repositories/cleaner.repo'
import { db } from '../db'
import { ServiceError } from './booking.service'
import { loopsEmailService } from './loops-email.service'
import { pushInAppNotification } from './in-app-notification.service'
import type { User } from '@prisma/client'

const STRIKE_SUSPEND_THRESHOLD = 3

export const cleanerService = {
  async approve(cleanerId: string, adminUser: User, action: 'approve' | 'reject', rejectionReason?: string) {
    const cleaner = await cleanerRepo.findById(cleanerId)
    if (!cleaner) throw new ServiceError('Cleaner not found', 404)
    if (cleaner.status !== 'pending') throw new ServiceError('Cleaner is not in pending status', 400)

    const updated = await cleanerRepo.update(cleanerId, {
      status: action === 'approve' ? 'approved' : 'rejected',
      rejectionReason: action === 'reject' ? (rejectionReason ?? null) : null,
      approvedAt: action === 'approve' ? new Date() : null,
      approvedBy: action === 'approve' ? adminUser.id : null,
    })

    await pushInAppNotification({
      userId: updated.userId,
      type: action === 'approve' ? 'cleaner_application_approved' : 'cleaner_application_rejected',
      title: action === 'approve' ? 'Cleaner profile approved' : 'Cleaner profile rejected',
      body:
        action === 'approve'
          ? 'Your cleaner profile has been approved and is now live.'
          : `Your cleaner profile was rejected${rejectionReason ? `: ${rejectionReason}` : '.'}`,
      data: { cleaner_id: updated.id },
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
