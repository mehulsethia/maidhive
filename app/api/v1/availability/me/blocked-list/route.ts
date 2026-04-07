import { requireCleaner } from '@/server/auth'
import { availabilityRepo } from '@/server/repositories/availability.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'

export const GET = requireCleaner(async (_req, _ctx, user) => {
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)
  const blocks = await availabilityRepo.getBlockedTimes(cleaner.id)
  return ok(blocks)
})
