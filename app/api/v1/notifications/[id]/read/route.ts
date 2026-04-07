import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { ok } from '@/server/response'

export const PATCH = requireAuth(async (_req, ctx, user) => {
  const { id } = await ctx.params
  await notificationRepo.markRead(id, user.id)
  return ok({ updated: true })
})
