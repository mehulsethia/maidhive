import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { reviewRepo } from '@/server/repositories/review.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { cleanerReviewResponseSchema } from '@/server/schemas/review.schema'

export const POST = requireCleaner(async (req: NextRequest, ctx, user) => {
  const { bookingId } = await ctx.params

  const booking = await bookingRepo.findById(bookingId)
  if (!booking) return err('Booking not found', 404)

  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner || booking.cleanerId !== cleaner.id) return err('Forbidden', 403)

  const review = await reviewRepo.findByBookingId(bookingId)
  if (!review) return err('Review not found for this booking', 404)
  if (review.cleanerResponse) return err('Review response already submitted and cannot be edited', 409)

  const body = await req.json()
  const parsed = cleanerReviewResponseSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const updated = await reviewRepo.update(review.id, {
    cleanerResponse: parsed.data.response,
    cleanerRespondedAt: new Date(),
  })

  return ok(updated)
})
