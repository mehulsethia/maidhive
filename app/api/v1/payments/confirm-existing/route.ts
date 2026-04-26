import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireClient } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { paymentAuthorizationService } from '@/server/services/payment-authorization.service'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'

const schema = z.object({
  booking_id: z.string().uuid(),
  payment_method_id: z.string().min(1),
})

export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const booking = await bookingRepo.findById(parsed.data.booking_id)
  if (!booking) return err('Booking not found', 404)

  const client = await clientRepo.findByUserId(user.id)
  if (!client || booking.clientId !== client.id) return err('Forbidden', 403)
  if (!client.stripeCustomerId) return err('No saved payment method found', 400)

  const payment = await paymentRepo.findByBookingId(booking.id)
  if (!payment) return err('Payment intent not initialized', 400)

  const method = await stripe.paymentMethods.retrieve(parsed.data.payment_method_id)
  if (typeof method.customer !== 'string' || method.customer !== client.stripeCustomerId) {
    return err('Selected card is not available for this account', 403)
  }

  const confirmed = await stripe.paymentIntents.confirm(payment.stripePaymentIntentId, {
    payment_method: parsed.data.payment_method_id,
  })

  const sync = await paymentAuthorizationService.syncFromPaymentIntent(confirmed)
  return ok({
    payment_intent_id: confirmed.id,
    payment_intent_status: confirmed.status,
    sync,
  })
})
