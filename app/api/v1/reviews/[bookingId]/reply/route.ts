import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { reviewRepo } from '@/server/repositories/review.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { cleanerReviewResponseSchema } from '@/server/schemas/review.schema'
import { ok, err } from '@/server/response'

export const POST = requireCleaner(async (req: NextRequest, ctx, user) => {
  const { bookingId: reviewId } = await ctx.params
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  const review = await reviewRepo.findById(reviewId)
  if (!review) return err('Review not found', 404)
  if (review.cleanerId !== cleaner.id) return err('Forbidden', 403)
  if (review.cleanerReply) return err('Reply already submitted and cannot be edited', 409)

  const body = await req.json()
  const parsed = cleanerReviewResponseSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const updated = await reviewRepo.update(reviewId, {
    cleanerReply: parsed.data.response,
    cleanerReplyAt: new Date(),
  })
  return ok(updated)
})
