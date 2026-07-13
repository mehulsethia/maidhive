import { requireAdmin } from '@/server/auth'
import { reviewRepo } from '@/server/repositories/review.repo'
import { ok, err } from '@/server/response'
import { db } from '@/server/db'

export const DELETE = requireAdmin(async (_req, ctx) => {
  const { id } = await ctx.params
  const review = await reviewRepo.findById(id)
  if (!review) return err('Review not found', 404)
  const activeDispute = await db.dispute.findFirst({
    where: {
      bookingId: review.bookingId,
      status: { in: ['open', 'under_review'] },
    },
    select: { id: true },
  })
  if (activeDispute) return err('Reviews are locked while this booking is Under Review.', 409)

  const updated = await reviewRepo.update(id, {
    cleanerReply: null,
    cleanerReplyAt: null,
  })

  return ok(updated)
})
