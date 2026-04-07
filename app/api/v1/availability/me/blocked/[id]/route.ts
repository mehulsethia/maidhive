import { requireCleaner } from '@/server/auth'
import { availabilityRepo } from '@/server/repositories/availability.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'

export const DELETE = requireCleaner(async (_req, ctx, user) => {
  const { id } = await ctx.params
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)
  await availabilityRepo.deleteBlockedTime(id, cleaner.id)
  return ok({ deleted: true })
})
