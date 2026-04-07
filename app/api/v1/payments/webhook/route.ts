import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/server/stripe'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent
        const payment = await paymentRepo.findByStripeIntentId(pi.id)
        if (payment) {
          await paymentRepo.update(payment.id, { status: 'authorized', authorizedAt: new Date() })
          if (pi.metadata?.booking_id) {
            await bookingRepo.update(pi.metadata.booking_id, { status: 'confirmed', confirmedAt: new Date() })
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const payment = await paymentRepo.findByStripeIntentId(pi.id)
        if (payment) {
          await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
        }
        break
      }

      case 'charge.captured': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
        if (piId) {
          const payment = await paymentRepo.findByStripeIntentId(piId)
          if (payment) {
            await paymentRepo.update(payment.id, {
              status: 'captured',
              stripeChargeId: charge.id,
              capturedAt: new Date(),
            })
          }
        }
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        if (account.charges_enabled) {
          const cleaner = await cleanerRepo.findById(account.metadata?.cleaner_id ?? '')
          if (cleaner) {
            await cleanerRepo.update(cleaner.id, { stripeOnboardingComplete: true })
          }
        }
        break
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const piId = typeof transfer.source_transaction === 'string' ? transfer.source_transaction : null
        if (piId) {
          const payment = await paymentRepo.findByStripeIntentId(piId)
          if (payment) {
            await paymentRepo.update(payment.id, {
              status: 'transferred',
              stripeTransferId: transfer.id,
              transferredAt: new Date(),
            })
          }
        }
        break
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
