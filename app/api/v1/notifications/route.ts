import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { ok } from '@/server/response'

export const GET = requireAuth(async (req: NextRequest, _ctx, user) => {
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)
  const includeArchived = req.nextUrl.searchParams.get('include_archived') === 'true'
  const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true'
  const [notifications, total] = await notificationRepo.findByUserId(user.id, page, pageSize, {
    includeArchived,
    unreadOnly,
  })
  return ok({ notifications, total, page, page_size: pageSize })
})
