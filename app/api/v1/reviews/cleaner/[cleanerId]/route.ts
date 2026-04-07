import { NextRequest } from 'next/server'
import { reviewRepo } from '@/server/repositories/review.repo'
import { ok } from '@/server/response'

export async function GET(req: NextRequest, ctx: { params: Promise<{ cleanerId: string }> }) {
  const { cleanerId } = await ctx.params
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)
  const [reviews, total] = await reviewRepo.findByCleanerId(cleanerId, page, pageSize)
  return ok({ reviews, total, page, page_size: pageSize })
}
