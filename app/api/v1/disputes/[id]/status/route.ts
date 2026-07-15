import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { ok, err } from '@/server/response'
import { updateDisputeStatusSchema } from '@/server/schemas/dispute.schema'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'
import { db } from '@/server/db'
import { cleanerReliabilityService } from '@/server/services/cleaner-reliability.service'
import { recordBookingActionEvent } from '@/server/services/booking-action-event.service'

export const PATCH = requireAdmin(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = updateDisputeStatusSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const dispute = await disputeRepo.findById(id)
  if (!dispute) return err('Dispute not found', 404)

  const updated = await disputeRepo.update(id, { status: parsed.data.status })

  if (parsed.data.status === 'under_review') {
    const booking = await bookingRepo.findById(dispute.bookingId)
    if (booking) {
      const hiddenReviews = await db.review.updateMany({
        where: {
          bookingId: booking.id,
          isPublic: true,
        },
        data: {
          isPublic: false,
          hiddenByDispute: true,
        } as any,
      })
      if (hiddenReviews.count > 0) {
        try {
          await cleanerReliabilityService.recalculate(booking.cleanerId)
        } catch (reliabilityError) {
          await cleanerReliabilityService.markDirty(booking.cleanerId)
          console.error('dispute.status.review_lock.reliability_failed', reliabilityError)
        }
      }

      const payment = await db.payment.findUnique({
        where: { bookingId: booking.id },
        select: {
          id: true,
          status: true,
          cleanerPayout: true,
          transferredAt: true,
          stripeTransferId: true,
        },
      })
      const cleanerPayout = Number(payment?.cleanerPayout ?? 0)
      const payoutAlreadyTransferred =
        payment?.status === 'transferred' ||
        Boolean(payment?.transferredAt) ||
        Boolean(payment?.stripeTransferId)
      if (payment && cleanerPayout > 0 && !payoutAlreadyTransferred) {
        await db.payment.update({
          where: { id: payment.id },
          data: { payoutScheduledAt: null },
        })
        await recordBookingActionEvent({
          bookingId: booking.id,
          type: 'cleaner_payout_paused',
          actorRole: 'system',
          metadata: {
            amount: cleanerPayout,
            reason: 'dispute_under_review',
            transfer_status: 'not_transferred',
          },
        })
      }

      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'dispute_under_review',
        title: 'Dispute under review',
        body: 'MaidHive is actively reviewing this dispute.',
        data: { booking_id: booking.id, dispute_id: updated.id },
      })
      await pushInAppNotification({
        userId: booking.cleaner.userId,
        type: 'dispute_under_review',
        title: 'Dispute under review',
        body: 'MaidHive is actively reviewing this dispute.',
        data: { booking_id: booking.id, dispute_id: updated.id },
      })
    }
  }

  return ok(updated)
})
