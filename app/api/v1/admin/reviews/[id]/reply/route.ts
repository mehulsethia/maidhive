import { requireAdmin } from '@/server/auth'
import { reviewRepo } from '@/server/repositories/review.repo'
import { ok, err } from '@/server/response'

export const DELETE = requireAdmin(async (_req, ctx) => {
  const { id } = await ctx.params
  const review = await reviewRepo.findById(id)
  if (!review) return err('Review not found', 404)

  const updated = await reviewRepo.update(id, {
    cleanerReply: null,
    cleanerReplyAt: null,
  })

  return ok(updated)
})
