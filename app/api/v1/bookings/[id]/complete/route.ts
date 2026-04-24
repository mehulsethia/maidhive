import { requireClientOrCleaner } from '@/server/auth'
import { bookingService, ServiceError } from '@/server/services/booking.service'
import { ok, err } from '@/server/response'

// POST /api/v1/bookings/:id/complete — cleaner or client marks in-progress booking as completed
export const POST = requireClientOrCleaner(async (_req, ctx, user) => {
  const { id } = await ctx.params

  try {
    const booking = user.role === 'cleaner'
      ? await bookingService.completeByCleaner(id, user)
      : await bookingService.completeByClient(id, user)
    return ok(booking)
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    throw e
  }
})
