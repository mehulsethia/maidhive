import { NextRequest } from 'next/server'
import { requireClient } from '@/server/auth'
import { reviewRepo } from '@/server/repositories/review.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { ok, err } from '@/server/response'
import { createReviewSchema } from '@/server/schemas/review.schema'

export const POST = requireClient(async (req: NextRequest, ctx, user) => {
  const { bookingId } = await ctx.params
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) return err('Booking not found', 404)
  if (booking.status !== 'completed') return err('Can only review completed bookings', 400)

  const client = await clientRepo.findByUserId(user.id)
  if (!client || booking.clientId !== client.id) return err('Forbidden', 403)

  const existing = await reviewRepo.findByBookingId(bookingId)
  if (existing) return err('Review already submitted', 409)

  const body = await req.json()
  const parsed = createReviewSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const review = await reviewRepo.create({
    bookingId,
    cleanerId: booking.cleanerId,
    clientId: client.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    isPublic: parsed.data.is_public,
  })
  return ok(review, 201)
})
