import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { userRepo } from '@/server/repositories/user.repo'
import { ok } from '@/server/response'

export const GET = requireAdmin(async (req: NextRequest) => {
  const role = req.nextUrl.searchParams.get('role') ?? undefined
  const search = req.nextUrl.searchParams.get('search') ?? undefined
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)

  const [users, total] = await userRepo.list({ role, search, page, pageSize })
  return ok({ users, total, page, page_size: pageSize })
})
