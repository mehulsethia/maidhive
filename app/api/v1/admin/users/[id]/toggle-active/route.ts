import { requireAdmin } from '@/server/auth'
import { userRepo } from '@/server/repositories/user.repo'
import { ok, err } from '@/server/response'

export const PATCH = requireAdmin(async (_req, ctx) => {
  const { id } = await ctx.params
  const user = await userRepo.findById(id)
  if (!user) return err('User not found', 404)

  const updated = await userRepo.toggleActive(id, !user.isActive)
  return ok(updated)
})
