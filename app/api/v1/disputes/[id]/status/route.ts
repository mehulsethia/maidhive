import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { ok, err } from '@/server/response'
import { updateDisputeStatusSchema } from '@/server/schemas/dispute.schema'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'

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
