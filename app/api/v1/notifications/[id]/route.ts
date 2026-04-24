import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { db } from '@/server/db'
import { ok } from '@/server/response'

export const DELETE = requireAuth(async (_req, ctx, user) => {
  const { id } = await ctx.params
  if (user.role === 'admin') {
    const adminUsers = await db.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    })
    await notificationRepo.deleteForUsers(id, adminUsers.map((u) => u.id))
  } else {
    await notificationRepo.delete(id, user.id)
  }
  return ok({ deleted: true })
})
