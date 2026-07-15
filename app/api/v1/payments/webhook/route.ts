import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/server/stripe'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { paymentAuthorizationService } from '@/server/services/payment-authorization.service'
import { loopsEmailService } from '@/server/services/loops-email.service'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'
import { recordBookingActionEvent } from '@/server/services/booking-action-event.service'
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
        await paymentAuthorizationService.syncFromPaymentIntent(pi)
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const payment = await paymentRepo.findByStripeIntentId(pi.id)
        if (payment) {
          await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
          const booking = await bookingRepo.findById(payment.bookingId)
          if (booking && booking.status === 'accepted' && booking.reauthorizationRequired) {
            const graceEndsAt = new Date(
              Math.min(
                booking.scheduledStart.getTime(),
                Date.now() + 24 * 60 * 60 * 1000,
              ),
            )
            await bookingRepo.update(booking.id, {
              payBy: graceEndsAt,
              reauthorizationGraceExpiresAt: graceEndsAt,
            })
            await pushInAppNotification({
              userId: booking.client.userId,
              type: 'booking_payment_required',
              title: 'Re-authorization failed',
              body: 'Please fix your payment method within 24 hours to keep this rescheduled booking active.',
              data: { booking_id: booking.id },
            })
            await pushInAppNotification({
              userId: booking.cleaner.userId,
              type: 'booking_payment_required',
              title: 'Waiting for client re-authorization',
              body: 'Client has up to 24 hours to resolve payment for this rescheduled booking.',
              data: { booking_id: booking.id },
            })
          }
        }
        break
      }

      case 'charge.captured': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
        if (piId) {
          const payment = await paymentRepo.findByStripeIntentId(piId)
          if (payment) {
            const wasCaptured = payment.status === 'captured'
            const capturedAt = new Date()
            await paymentRepo.update(payment.id, {
              status: 'captured',
              stripeChargeId: charge.id,
              capturedAt,
            })

            if (!wasCaptured) {
              const booking = await bookingRepo.findById(payment.bookingId)
              if (booking) {
                await recordBookingActionEvent({
                  bookingId: booking.id,
                  type: 'payment_captured',
                  actorRole: 'system',
                  metadata: { amount: Number(payment.amount), status: 'captured' },
                  createdAt: capturedAt,
                })
                await pushInAppNotification({
                  userId: booking.client.userId,
                  type: 'payment_captured',
                  title: 'Payment captured',
                  body: 'Payment was captured successfully after booking completion.',
                  data: { booking_id: booking.id },
                })
                try {
                  await loopsEmailService.sendClientPaymentReceipt({
                    email: booking.client.user.email,
                    fullName: booking.client.user.name ?? 'Client',
                    amount: Number(payment.amount),
                    cleanerName: booking.cleaner.user.name ?? 'Cleaner',
                    date: new Date(),
                  })
                } catch (emailError) {
                  console.error('Failed to send client payment receipt email via Loops:', emailError)
                }
              }
            }
          }
        }
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const cleaner = await cleanerRepo.findById(account.metadata?.cleaner_id ?? '')
        if (cleaner) {
          const restrictedOrIncomplete =
            (account.requirements?.currently_due?.length ?? 0) > 0 ||
            (account.requirements?.past_due?.length ?? 0) > 0 ||
            Boolean(account.requirements?.disabled_reason)
          const connected =
            account.details_submitted &&
            account.charges_enabled &&
            account.payouts_enabled &&
            !restrictedOrIncomplete

          await cleanerRepo.update(cleaner.id, {
            stripeOnboardingComplete: connected,
          })
        }
        break
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const chargeId = typeof transfer.source_transaction === 'string' ? transfer.source_transaction : null
        if (chargeId) {
          const payment = await paymentRepo.findByStripeChargeId(chargeId)
          if (payment) {
            const wasTransferred = payment.status === 'transferred'
            const transferredAt = new Date()
            await paymentRepo.update(payment.id, {
              status: 'transferred',
              stripeTransferId: transfer.id,
              transferredAt,
            })

            if (!wasTransferred) {
              const booking = await bookingRepo.findById(payment.bookingId)
              if (booking) {
                await recordBookingActionEvent({
                  bookingId: booking.id,
                  type: 'payout_transferred',
                  actorRole: 'system',
                  metadata: { amount: Number(payment.cleanerPayout), status: 'transferred' },
                  createdAt: transferredAt,
                })
                await pushInAppNotification({
                  userId: booking.cleaner.userId,
                  type: 'payout_released',
                  title: 'Payout released',
                  body: 'Payout was released to your connected Stripe account.',
                  data: { booking_id: booking.id },
                })
                try {
                  await loopsEmailService.sendCleanerPayoutNotification({
                    email: booking.cleaner.user.email,
                    fullName: booking.cleaner.user.name ?? 'Cleaner',
                    amount: Number(payment.cleanerPayout),
                  })
                } catch (emailError) {
                  console.error('Failed to send cleaner payout notification email via Loops:', emailError)
                }
              }
            }
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
