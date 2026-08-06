import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { db } from '@/server/db'
import { ok } from '@/server/response'

export const GET = requireCleaner(async (_req: NextRequest, _ctx, user) => {
  let cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) {
    cleaner = await cleanerRepo.create(user.id)
  }

  const [pending, inProgress, completed] = await Promise.all([
    db.booking.count({
      where: {
        cleanerId: cleaner.id,
        status: 'pending',
        payment: { is: { status: { in: ['authorized', 'captured', 'transferred'] } } },
      },
    }),
    db.booking.count({ where: { cleanerId: cleaner.id, status: 'in_progress' } }),
    db.booking.count({ where: { cleanerId: cleaner.id, status: { in: ['completed', 'disputed'] } } }),
  ])

  return ok({ pending, in_progress: inProgress, completed })
})
