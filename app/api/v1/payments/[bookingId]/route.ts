import { requireAuth } from '@/server/auth'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { ok, err } from '@/server/response'

export const GET = requireAuth(async (_req, ctx, user) => {
  const { bookingId } = await ctx.params
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) return err('Booking not found', 404)

  const client = await clientRepo.findByUserId(user.id)
  if (!client || booking.clientId !== client.id) return err('Forbidden', 403)

  const payment = await paymentRepo.findByBookingId(bookingId)
  if (!payment) return err('Payment not found', 404)

  return ok(payment)
})
