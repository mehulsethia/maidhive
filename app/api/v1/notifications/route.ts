import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { db } from '@/server/db'
import { ok } from '@/server/response'

export const GET = requireAuth(async (req: NextRequest, _ctx, user) => {
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)
  const includeArchived = req.nextUrl.searchParams.get('include_archived') === 'true'
  const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true'

  let notifications: any[] = []
  let total = 0

  if (user.role === 'admin') {
    const adminUsers = await db.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    })
    const adminIds = adminUsers.map((u) => u.id)
    ;[notifications, total] = await notificationRepo.findByUserIds(adminIds, page, pageSize, {
      includeArchived,
      unreadOnly,
    })
  } else {
    ;[notifications, total] = await notificationRepo.findByUserId(user.id, page, pageSize, {
      includeArchived,
      unreadOnly,
    })
  }

  return ok({ notifications, total, page, page_size: pageSize })
})
