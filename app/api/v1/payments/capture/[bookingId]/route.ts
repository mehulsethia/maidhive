import { requireAdmin } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'
import { config } from '@/server/config'

export const POST = requireAdmin(async (_req, ctx) => {
  const { bookingId } = await ctx.params
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) return err('Booking not found', 404)
  if (booking.status !== 'completed') return err('Booking must be completed before capture', 400)
  if (booking.dispute?.status === 'open' || booking.dispute?.status === 'under_review') {
    return err('Payment capture is paused while this booking is Under Review.', 409)
  }

  const payment = await paymentRepo.findByBookingId(booking.id)
  if (!payment) return err('Payment not found', 404)
  if (payment.status !== 'authorized') return err('Payment must be authorized', 400)

  const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId)

  const updated = await paymentRepo.update(payment.id, {
    status: 'captured',
    stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : undefined,
    capturedAt: new Date(),
    payoutScheduledAt: new Date(Date.now() + config.PAYOUT_DELAY_HOURS * 60 * 60 * 1000),
  })

  return ok(updated)
})
