import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { notificationRepo } from '@/server/repositories/notification.repo'
import { ok } from '@/server/response'

export const PATCH = requireAuth(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const archived = body?.archived !== false
  await notificationRepo.setArchived(id, user.id, archived)
  return ok({ updated: true, archived })
})
