import { cleanerRepo } from '../repositories/cleaner.repo'
import { db } from '../db'
import { ServiceError } from './booking.service'
import type { User } from '@prisma/client'

const STRIKE_SUSPEND_THRESHOLD = 3

export const cleanerService = {
  async approve(cleanerId: string, adminUser: User, action: 'approve' | 'reject', rejectionReason?: string) {
    const cleaner = await cleanerRepo.findById(cleanerId)
    if (!cleaner) throw new ServiceError('Cleaner not found', 404)
    if (cleaner.status !== 'pending') throw new ServiceError('Cleaner is not in pending status', 400)

    return cleanerRepo.update(cleanerId, {
      status: action === 'approve' ? 'approved' : 'rejected',
      rejectionReason: action === 'reject' ? (rejectionReason ?? null) : null,
      approvedAt: action === 'approve' ? new Date() : null,
      approvedBy: action === 'approve' ? adminUser.id : null,
    })
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
