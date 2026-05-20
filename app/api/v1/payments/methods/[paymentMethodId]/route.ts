import { NextRequest } from 'next/server'
import { requireClient } from '@/server/auth'
import { clientRepo } from '@/server/repositories/client.repo'
import { paymentAuthorizationService } from '@/server/services/payment-authorization.service'
import { stripe } from '@/server/stripe'
import { db } from '@/server/db'
import { config } from '@/server/config'
import { ok, err } from '@/server/response'

const DISPUTE_WINDOW_MS = config.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000

export const DELETE = requireClient(async (req: NextRequest, ctx, user) => {
  const { paymentMethodId } = await ctx.params
  const client = await clientRepo.findByUserId(user.id)
  if (!client?.stripeCustomerId) return err('No saved payment methods found', 404)

  let method
  try {
    method = await stripe.paymentMethods.retrieve(paymentMethodId)
  } catch {
    return err('Card not found for this account', 404)
  }
  if (typeof method.customer !== 'string' || method.customer !== client.stripeCustomerId) {
    return err('Card not found for this account', 404)
  }

  const body = await req.json().catch(() => ({}))
  const replacementPaymentMethodId = typeof body?.replacement_payment_method_id === 'string'
    ? body.replacement_payment_method_id.trim()
    : ''

  let replacementMethodId: string | null = null
  if (replacementPaymentMethodId) {
    let replacement
    try {
      replacement = await stripe.paymentMethods.retrieve(replacementPaymentMethodId)
    } catch {
      return err('Replacement card is not available for this account', 404)
    }
    if (typeof replacement.customer !== 'string' || replacement.customer !== client.stripeCustomerId) {
      return err('Replacement card is not available for this account', 403)
    }
    if (replacementPaymentMethodId === paymentMethodId) {
      return err('Replacement card must be different', 400)
    }
    replacementMethodId = replacementPaymentMethodId
  }

  const bookings = await db.booking.findMany({
    where: {
      clientId: client.id,
      OR: [
        { status: { in: ['pending', 'accepted', 'confirmed', 'in_progress', 'disputed'] } },
        { status: 'completed' },
      ],
    },
    include: {
      payment: true,
      dispute: true,
    },
  })

  const now = Date.now()
  const linked = [] as Array<{ bookingId: string; paymentIntentId: string; status: string }>

  for (const booking of bookings) {
    if (!booking.payment?.stripePaymentIntentId) continue

    const scheduledEndMs = booking.scheduledEnd ? booking.scheduledEnd.getTime() : 0
    const withinCompletedProtection =
      booking.status === 'completed' &&
      (
        !scheduledEndMs ||
        now <= scheduledEndMs + DISPUTE_WINDOW_MS ||
        booking.payment.status !== 'captured'
      )

    const protectedState =
      ['pending', 'accepted', 'confirmed', 'in_progress', 'disputed'].includes(booking.status) ||
      withinCompletedProtection ||
      booking.payment.status === 'failed' ||
      (booking.dispute && !['resolved', 'closed'].includes(String(booking.dispute.status ?? '')))

    if (!protectedState) continue

    const pi = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentIntentId)
    if (pi.payment_method === paymentMethodId) {
      linked.push({
        bookingId: booking.id,
        paymentIntentId: pi.id,
        status: String(pi.status),
      })
    }
  }

  if (linked.length === 0) {
    await stripe.paymentMethods.detach(paymentMethodId)
    return ok({ removed: true })
  }

  if (!replacementMethodId) {
    return err(
      `Card is locked by active booking/payment processes (${linked.length}). Add/select another card and retry replacement removal.`,
      409,
    )
  }

  for (const item of linked) {
    if (item.status === 'requires_capture') {
      return err('Cannot replace card while payment authorisation is active. Complete or resolve linked bookings first.', 409)
    }
  }

  const updatedIntentIds: string[] = []
  try {
    for (const item of linked) {
      const updated = await stripe.paymentIntents.confirm(item.paymentIntentId, {
        payment_method: replacementMethodId,
      })
      updatedIntentIds.push(item.paymentIntentId)
      await paymentAuthorizationService.syncFromPaymentIntent(updated)
    }
  } catch {
    // Best-effort rollback for partial replacement success.
    for (const paymentIntentId of updatedIntentIds) {
      try {
        const reverted = await stripe.paymentIntents.confirm(paymentIntentId, {
          payment_method: paymentMethodId,
        })
        await paymentAuthorizationService.syncFromPaymentIntent(reverted)
      } catch {
        // If rollback fails on some intents, keep original card attached and return failure.
      }
    }
    return err('Card replacement failed: linked booking re-authorisation did not succeed. Original card remains active.', 409)
  }

  await stripe.paymentMethods.detach(paymentMethodId)
  return ok({ removed: true, replaced: true, linked_bookings_reauthorised: linked.length })
})
