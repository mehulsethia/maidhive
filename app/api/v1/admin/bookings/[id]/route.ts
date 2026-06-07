import { requireAdmin } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { bookingService } from '@/server/services/booking.service'
import { err, ok } from '@/server/response'

export const GET = requireAdmin(async (_req, ctx) => {
  const { id } = await ctx.params

  await bookingService.reconcileSingleBookingDeadline(id)
  const booking = await bookingRepo.findById(id)
  if (!booking) return err('Booking not found', 404)

  return ok(booking)
})
