import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { db } from '@/server/db'
import { ok } from '@/server/response'

export const PATCH = requireAuth(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const archived = body?.archived !== false
  if (user.role === 'admin') {
    const adminUsers = await db.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    })
    await notificationRepo.setArchivedForUsers(id, adminUsers.map((u) => u.id), archived)
  } else {
    await notificationRepo.setArchived(id, user.id, archived)
  }
  return ok({ updated: true, archived })
})
