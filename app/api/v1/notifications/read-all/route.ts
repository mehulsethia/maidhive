import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { ok } from '@/server/response'

export const PATCH = requireAuth(async (_req, _ctx, user) => {
  await notificationRepo.markAllRead(user.id)
  return ok({ updated: true })
})
