import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'

export const DELETE = requireCleaner(async (_req, ctx, user) => {
  const { id } = await ctx.params
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  await cleanerRepo.removeServiceArea(id, cleaner.id)
  return ok({ deleted: true })
})
