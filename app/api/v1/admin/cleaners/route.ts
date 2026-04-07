import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok } from '@/server/response'

export const GET = requireAdmin(async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)

  const [cleaners, total] = await cleanerRepo.listAll({ status, page, pageSize })
  return ok({ cleaners, total, page, page_size: pageSize })
})
