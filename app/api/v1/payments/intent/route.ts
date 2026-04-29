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
  if (!['pending', 'accepted'].includes(booking.status)) {
    return err('Booking must be pending or accepted for authorization', 400)
  }

  const client = await clientRepo.findByUserId(user.id)
  if (!client || booking.clientId !== client.id) return err('Forbidden', 403)

  const cleaner = booking.cleaner
  if (!cleaner.stripeAccountId) return err('Cleaner has not completed Stripe onboarding', 400)

  const account = await stripe.accounts.retrieve(cleaner.stripeAccountId)
  const restrictedOrIncomplete =
    (account.requirements?.currently_due?.length ?? 0) > 0 ||
    (account.requirements?.past_due?.length ?? 0) > 0 ||
    Boolean(account.requirements?.disabled_reason)
  if (!account.details_submitted || !account.charges_enabled || !account.payouts_enabled || restrictedOrIncomplete) {
    return err('Cleaner Stripe account is not fully ready to receive payments', 400)
  }

  let stripeCustomerId = client.stripeCustomerId ?? null
  if (stripeCustomerId) {
    try {
      await stripe.customers.retrieve(stripeCustomerId)
    } catch {
      stripeCustomerId = null
    }
  }
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: booking.client.user.email,
      name: booking.client.user.name ?? undefined,
      metadata: {
        app_client_id: client.id,
        app_user_id: booking.client.userId,
      },
    })
    stripeCustomerId = customer.id
    await clientRepo.update(client.id, { stripeCustomerId })
  }

  const existing = await paymentRepo.findByBookingId(booking.id)
  if (existing) {
    const pi = await stripe.paymentIntents.retrieve(existing.stripePaymentIntentId)
    if (pi.currency !== 'eur') {
      return err('Only EUR payments are supported', 422)
    }

    if (pi.status === 'requires_capture' || existing.status === 'authorized') {
      return err('Payment already authorized for this booking', 409)
    }

    if (['succeeded', 'processing'].includes(pi.status) || ['captured', 'transferred'].includes(existing.status)) {
      return err('Payment already processed for this booking', 409)
    }

    if (pi.client_secret) {
      return ok({ client_secret: pi.client_secret, payment_intent_id: pi.id })
    }
  }

  const amountCents = Math.round(Number(booking.totalAmount) * 100)
  const feeCents = Math.round(Number(booking.platformFee) * 100)

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    customer: stripeCustomerId,
    payment_method_types: ['card', 'link'],
    capture_method: 'manual',
    setup_future_usage: 'off_session',
    application_fee_amount: feeCents,
    transfer_data: { destination: cleaner.stripeAccountId },
    metadata: {
      booking_id: booking.id,
      client_id: client.id,
      cleaner_id: cleaner.id,
    },
  })

  await paymentRepo.upsert({
    bookingId: booking.id,
    stripePaymentIntentId: intent.id,
    amount: Number(booking.totalAmount),
    platformFee: Number(booking.platformFee),
    cleanerPayout: Number(booking.cleanerPayout),
    currency: 'eur',
  })

  return ok({ client_secret: intent.client_secret, payment_intent_id: intent.id })
})
