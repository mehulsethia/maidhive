import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'
import { resolveDisputeSchema } from '@/server/schemas/dispute.schema'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'
import { db } from '@/server/db'
import { getDisputeResolutionOutcome } from '@/lib/dispute-resolution'
import { cleanerReliabilityService } from '@/server/services/cleaner-reliability.service'

export const POST = requireAdmin(async (req: NextRequest, ctx, user) => {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = resolveDisputeSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.message, 422)

    const dispute = await disputeRepo.findById(id)
    if (!dispute) return err('Dispute not found', 404)
    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      // Idempotent behavior prevents confusing "already resolved" hard failures
      // when admin retries resolution from a stale UI state.
      return ok(dispute)
    }
    if (
      dispute.issueType === 'cleaner_no_show' &&
      !parsed.data.no_show_finding
    ) {
      return err('Confirm or reject the cleaner no-show finding', 422)
    }

    const payment = await paymentRepo.findByBookingId(dispute.bookingId)
    let resolvedRefundAmount: number | undefined = parsed.data.refund_amount

    if (payment && payment.currency !== 'eur') {
      return err('Only EUR payments are supported', 422)
    }

    if (payment && payment.stripePaymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId)
      const paymentAmount = Number(payment.amount)
      const paymentAmountCents = Math.round(paymentAmount * 100)
      const originalPlatformFeeCents = Math.round(Number(payment.platformFee) * 100)
      const chargePct = parsed.data.charge_percentage

      if (parsed.data.resolution_type === 'full_refund') {
        if (pi.status === 'requires_capture') {
          await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
          resolvedRefundAmount = paymentAmount
          await paymentRepo.update(payment.id, {
            status: 'refunded',
            refundAmount: resolvedRefundAmount,
            refundReason: parsed.data.resolution_note,
            refundedAt: new Date(),
          })
        } else if (pi.status === 'succeeded') {
          const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
          })
          resolvedRefundAmount = paymentAmount
          await paymentRepo.update(payment.id, {
            status: 'refunded',
            stripeRefundId: refund.id,
            refundAmount: resolvedRefundAmount,
            refundReason: parsed.data.resolution_note,
            refundedAt: new Date(),
          })
        } else if (pi.status === 'canceled') {
          // Already canceled, just update local DB
          resolvedRefundAmount = paymentAmount
          await paymentRepo.update(payment.id, {
            status: 'refunded',
            refundAmount: resolvedRefundAmount,
            refundReason: parsed.data.resolution_note,
            refundedAt: new Date(),
          })
        }
      }

      if (parsed.data.resolution_type === 'partial_refund') {
        const explicitRefund = parsed.data.refund_amount!
        const refundCents = Math.round(explicitRefund * 100)
        if (refundCents >= paymentAmountCents) {
          return err('Partial refund amount must be less than the payment amount', 422)
        }

        if (pi.status === 'requires_capture') {
          const amountToCapture = paymentAmountCents - refundCents
          const proportionalFeeCents = getProportionalFeeCents(
            amountToCapture,
            paymentAmountCents,
            originalPlatformFeeCents,
          )
          const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
            amount_to_capture: amountToCapture,
            application_fee_amount: proportionalFeeCents,
          })
          resolvedRefundAmount = Number(((paymentAmountCents - amountToCapture) / 100).toFixed(2))
          await paymentRepo.update(payment.id, {
            status: 'captured',
            stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : (captured.latest_charge as any)?.id,
            capturedAt: new Date(),
            payoutScheduledAt: new Date(),
            refundAmount: resolvedRefundAmount,
            refundReason: parsed.data.resolution_note,
          })
        } else if (pi.status === 'succeeded') {
          const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            amount: refundCents,
          })
          resolvedRefundAmount = Number((refundCents / 100).toFixed(2))
          await paymentRepo.update(payment.id, {
            status: 'partially_refunded',
            stripeRefundId: refund.id,
            refundAmount: resolvedRefundAmount,
            refundReason: parsed.data.resolution_note,
            refundedAt: new Date(),
          })
        }
      }

      if (parsed.data.resolution_type === 'no_refund' || parsed.data.resolution_type === 'payment_released') {
        if (pi.status === 'requires_capture') {
          const pct = chargePct ?? 100
          const amountToCapture = Math.max(1, Math.floor((paymentAmountCents * pct) / 100))
          const proportionalFeeCents = getProportionalFeeCents(
            amountToCapture,
            paymentAmountCents,
            originalPlatformFeeCents,
          )
          const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
            amount_to_capture: amountToCapture,
            application_fee_amount: proportionalFeeCents,
          })
          resolvedRefundAmount = Number(((paymentAmountCents - amountToCapture) / 100).toFixed(2))
          await paymentRepo.update(payment.id, {
            status: 'captured',
            stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : (captured.latest_charge as any)?.id,
            capturedAt: new Date(),
            payoutScheduledAt: new Date(),
            refundAmount: resolvedRefundAmount > 0 ? resolvedRefundAmount : undefined,
            refundReason: resolvedRefundAmount && resolvedRefundAmount > 0 ? parsed.data.resolution_note : undefined,
          })
        }
      }
    }


    const updated = await disputeRepo.update(id, {
      status: 'resolved',
      resolutionType: parsed.data.resolution_type,
      resolutionNote: parsed.data.resolution_note,
      noShowFinding: parsed.data.no_show_finding,
      refundAmount: resolvedRefundAmount,
      resolvedByUser: { connect: { id: user.id } },
      resolvedAt: new Date(),
    })

    try {
      await bookingRepo.update(dispute.bookingId, { status: 'completed' })
    } catch (bookingUpdateError) {
      // Do not roll back a successfully resolved dispute due to a booking update side-effect.
      console.error('Resolved dispute but failed to update booking status:', bookingUpdateError)
    }

    const booking = await bookingRepo.findById(dispute.bookingId)
    if (booking) {
      if (
        dispute.issueType === 'cleaner_no_show' &&
        parsed.data.no_show_finding === 'confirmed'
      ) {
        try {
          await cleanerReliabilityService.recordConfirmedNoShow({
            cleanerId: booking.cleanerId,
            bookingId: booking.id,
            occurredAt: booking.scheduledStart,
            confirmedBy: user.id,
          })
        } catch (error) {
          await cleanerReliabilityService.markDirty(booking.cleanerId)
          console.error('cleaner_reliability.no_show_record_failed', {
            cleaner_id: booking.cleanerId,
            booking_id: booking.id,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
      const resolutionCopy = getDisputeResolutionOutcome(
        parsed.data.resolution_type,
        resolvedRefundAmount,
      )

      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'dispute_resolved',
        title: 'Dispute resolved',
        body: resolutionCopy,
        data: { booking_id: booking.id, dispute_id: updated.id },
      })
      await pushInAppNotification({
        userId: booking.cleaner.userId,
        type: 'dispute_resolved',
        title: 'Dispute resolved',
        body: resolutionCopy,
        data: { booking_id: booking.id, dispute_id: updated.id },
      })

      const admins = await db.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true },
      })
      await Promise.all(
        admins.map((admin) =>
          pushInAppNotification({
            userId: admin.id,
            type: 'dispute_resolved',
            title: 'Dispute resolved',
            body: `Dispute resolved — ${resolutionCopy}`,
            data: { booking_id: booking.id, dispute_id: updated.id },
          }),
        ),
      )
    }

    return ok(updated)
  } catch (error: any) {
    
    // Handle Stripe errors specifically
    if (error?.type?.startsWith('Stripe')) {
      return err(`Stripe Error: ${error.message || 'Unknown Stripe error'}`, 400)
    }

    return err(error.message || 'Internal server error during dispute resolution', 500)
  }
})


function getProportionalFeeCents(
  amountToCaptureCents: number,
  originalAmountCents: number,
  originalPlatformFeeCents: number,
) {
  if (amountToCaptureCents <= 0 || originalAmountCents <= 0 || originalPlatformFeeCents <= 0) {
    return 0
  }

  const proportional = Math.round((originalPlatformFeeCents * amountToCaptureCents) / originalAmountCents)
  return Math.min(amountToCaptureCents, Math.max(0, proportional))
}
