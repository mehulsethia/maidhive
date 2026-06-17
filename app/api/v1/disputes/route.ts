import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { ok } from '@/server/response'

export const GET = requireAuth(async (req: NextRequest, _ctx, user) => {
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)

  const [disputes, total] =
    user.role === 'admin'
      ? await disputeRepo.listOpen(page, pageSize)
      : await disputeRepo.listByParticipantUserId(user.id, page, pageSize)

  return ok({ disputes, total, page, page_size: pageSize })
})
