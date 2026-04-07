import { NextRequest } from 'next/server'
import { requireClient } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'
import { z } from 'zod'

const schema = z.object({ booking_id: z.string().uuid() })

export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const booking = await bookingRepo.findById(parsed.data.booking_id)
  if (!booking) return err('Booking not found', 404)
  if (booking.status !== 'accepted') return err('Booking must be in accepted status', 400)

  const client = await clientRepo.findByUserId(user.id)
  if (!client || booking.clientId !== client.id) return err('Forbidden', 403)

  const cleaner = booking.cleaner
  if (!cleaner.stripeAccountId) return err('Cleaner has not completed Stripe onboarding', 400)

  const amountCents = Math.round(Number(booking.totalAmount) * 100)
  const feeCents = Math.round(Number(booking.platformFee) * 100)

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    capture_method: 'manual',
    application_fee_amount: feeCents,
    transfer_data: { destination: cleaner.stripeAccountId },
    metadata: {
      booking_id: booking.id,
      client_id: client.id,
      cleaner_id: cleaner.id,
    },
  })

  await paymentRepo.create({
    bookingId: booking.id,
    stripePaymentIntentId: intent.id,
    amount: Number(booking.totalAmount),
    platformFee: Number(booking.platformFee),
    cleanerPayout: Number(booking.cleanerPayout),
  })

  return ok({ client_secret: intent.client_secret, payment_intent_id: intent.id })
})
