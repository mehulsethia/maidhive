import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { ok } from '@/server/response'

export const GET = requireAdmin(async (req: NextRequest) => {
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)
  const [disputes, total] = await disputeRepo.listOpen(page, pageSize)
  return ok({ disputes, total, page, page_size: pageSize })
})
