import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { db } from '@/server/db'
import { ok } from '@/server/response'

export const PATCH = requireAuth(async (_req, _ctx, user) => {
  if (user.role === 'admin') {
    const adminUsers = await db.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    })
    await notificationRepo.markAllReadForUsers(adminUsers.map((u) => u.id))
  } else {
    await notificationRepo.markAllRead(user.id)
  }
  return ok({ updated: true })
})
