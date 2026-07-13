import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { paymentRepo } from '@/server/repositories/payment.repo'
import { stripe } from '@/server/stripe'
import { ok, err } from '@/server/response'
import { resolveDisputeSchema } from '@/server/schemas/dispute.schema'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'
import { loopsEmailService } from '@/server/services/loops-email.service'
import { db } from '@/server/db'
import { getDisputeResolutionOutcome } from '@/lib/dispute-resolution'
import { calculateDisputeAdjustedCleanerPayoutCents } from '@/lib/cleaner-payout'
import { formatCurrency } from '@/lib/utils'
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
      const originalCleanerPayoutCents = Math.round(Number(payment.cleanerPayout) * 100)

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
          const adjustedCleanerPayoutCents = calculateDisputeAdjustedCleanerPayoutCents({
            originalCleanerPayoutCents,
            refundCents,
          })
          const adjustedPlatformFeeCents = getAdjustedPlatformFeeCents(
            amountToCapture,
            adjustedCleanerPayoutCents,
          )
          const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
            amount_to_capture: amountToCapture,
            application_fee_amount: adjustedPlatformFeeCents,
          })
          resolvedRefundAmount = Number(((paymentAmountCents - amountToCapture) / 100).toFixed(2))
          await paymentRepo.update(payment.id, {
            status: 'captured',
            stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : (captured.latest_charge as any)?.id,
            capturedAt: new Date(),
            payoutScheduledAt: new Date(),
            platformFee: Number((adjustedPlatformFeeCents / 100).toFixed(2)),
            cleanerPayout: Number((adjustedCleanerPayoutCents / 100).toFixed(2)),
            refundAmount: resolvedRefundAmount,
            refundReason: parsed.data.resolution_note,
          })
        } else if (pi.status === 'succeeded') {
          const adjustedCleanerPayoutCents = calculateDisputeAdjustedCleanerPayoutCents({
            originalCleanerPayoutCents,
            refundCents,
          })
          const adjustedPlatformFeeCents = getAdjustedPlatformFeeCents(
            paymentAmountCents - refundCents,
            adjustedCleanerPayoutCents,
          )
          const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            amount: refundCents,
            reverse_transfer: true,
          })
          resolvedRefundAmount = Number((refundCents / 100).toFixed(2))
          await paymentRepo.update(payment.id, {
            status: payment.status === 'transferred' ? 'transferred' : 'captured',
            stripeRefundId: refund.id,
            platformFee: Number((adjustedPlatformFeeCents / 100).toFixed(2)),
            cleanerPayout: Number((adjustedCleanerPayoutCents / 100).toFixed(2)),
            refundAmount: resolvedRefundAmount,
            refundReason: parsed.data.resolution_note,
            refundedAt: new Date(),
          })
        }
      }

      if (parsed.data.resolution_type === 'no_refund') {
        if (pi.status === 'requires_capture') {
          const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
            amount_to_capture: paymentAmountCents,
            application_fee_amount: Math.min(paymentAmountCents, Math.max(0, originalPlatformFeeCents)),
          })
          await paymentRepo.update(payment.id, {
            status: 'captured',
            stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : (captured.latest_charge as any)?.id,
            capturedAt: new Date(),
            payoutScheduledAt: new Date(),
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
      const existingBooking = await bookingRepo.findById(dispute.bookingId)
      if (existingBooking?.status === 'disputed' && existingBooking.completedAt) {
        await bookingRepo.update(dispute.bookingId, { status: 'completed' })
      }
    } catch (bookingUpdateError) {
      // Legacy disputed bookings are normalized back to completed when possible.
      console.error('Resolved dispute but failed to normalize legacy booking status:', bookingUpdateError)
    }

    try {
      const restoredReviews = await db.review.updateMany({
        where: {
          bookingId: dispute.bookingId,
          hiddenByDispute: true,
        } as any,
        data: {
          isPublic: true,
          hiddenByDispute: false,
        } as any,
      })
      if (restoredReviews.count > 0) {
        const review = await db.review.findUnique({
          where: { bookingId: dispute.bookingId },
          select: { cleanerId: true },
        })
        if (review) {
          try {
            await cleanerReliabilityService.recalculate(review.cleanerId)
          } catch (reliabilityError) {
            await cleanerReliabilityService.markDirty(review.cleanerId)
            console.error('dispute.review_unlock.reliability_failed', reliabilityError)
          }
        }
      }
    } catch (reviewUnlockError) {
      console.error('Resolved dispute but failed to restore dispute-hidden reviews:', reviewUnlockError)
    }

    const booking = await bookingRepo.findById(dispute.bookingId)
    const resolvedPayment = await paymentRepo.findByBookingId(dispute.bookingId)
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
      const reference = bookingReference(booking.id)
      const cleanerPayoutOutcome = getCleanerPayoutOutcomeCopy({
        resolutionType: parsed.data.resolution_type,
        refundAmount: resolvedRefundAmount,
        cleanerPayout: Number(resolvedPayment?.cleanerPayout ?? booking.cleanerPayout ?? 0),
        paymentStatus: String(resolvedPayment?.status ?? ''),
        transferredAt: resolvedPayment?.transferredAt ?? null,
      })

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

      try {
        await Promise.all([
          loopsEmailService.sendDisputeResolvedOutcome({
            email: booking.client.user.email,
            fullName: booking.client.user.name ?? 'Client',
            bookingReference: reference,
            resolutionOutcome: resolutionCopy,
            refundAmount: resolvedRefundAmount,
            cleanerPayoutOutcome,
            resolutionNote: parsed.data.resolution_note,
          }),
          loopsEmailService.sendDisputeResolvedOutcome({
            email: booking.cleaner.user.email,
            fullName: booking.cleaner.user.name ?? 'Cleaner',
            bookingReference: reference,
            resolutionOutcome: resolutionCopy,
            refundAmount: resolvedRefundAmount,
            cleanerPayoutOutcome,
            resolutionNote: parsed.data.resolution_note,
          }),
        ])
      } catch (emailError) {
        console.error('Failed to send dispute resolved outcome emails via Loops:', emailError)
      }
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


function bookingReference(bookingId: string) {
  const raw = bookingId.replace(/[^a-z0-9]/gi, '')
  return `MH-${raw.slice(-6).toUpperCase()}`
}

function getCleanerPayoutOutcomeCopy(args: {
  resolutionType: string
  refundAmount?: number | null
  cleanerPayout: number
  paymentStatus?: string | null
  transferredAt?: Date | string | null
}) {
  const cleanerPayout = Number.isFinite(args.cleanerPayout) ? Math.max(0, args.cleanerPayout) : 0
  if (args.resolutionType === 'full_refund') {
    return 'Cleaner payout was not released.'
  }
  if (args.resolutionType === 'partial_refund') {
    return args.refundAmount != null && args.refundAmount > 0
      ? `Cleaner payout adjusted to ${formatCurrency(cleanerPayout)} after a ${formatCurrency(args.refundAmount)} dispute adjustment.`
      : `Cleaner payout adjusted to ${formatCurrency(cleanerPayout)}.`
  }
  if (args.paymentStatus === 'transferred' || args.transferredAt) {
    return `Cleaner payout released: ${formatCurrency(cleanerPayout)}.`
  }
  return `Cleaner payout approved for release: ${formatCurrency(cleanerPayout)}.`
}

function getAdjustedPlatformFeeCents(
  amountToCaptureCents: number,
  adjustedCleanerPayoutCents: number,
) {
  if (amountToCaptureCents <= 0) return 0
  return Math.min(
    amountToCaptureCents,
    Math.max(0, amountToCaptureCents - Math.max(0, adjustedCleanerPayoutCents)),
  )
}
