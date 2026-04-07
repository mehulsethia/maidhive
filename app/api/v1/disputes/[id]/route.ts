import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { createDisputeSchema } from '@/server/schemas/dispute.schema'

export const POST = requireAuth(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const booking = await bookingRepo.findById(id)
  if (!booking) return err('Booking not found', 404)

  const client = await clientRepo.findByUserId(user.id)
  const cleaner = await cleanerRepo.findByUserId(user.id)
  const isParty =
    (client && booking.clientId === client.id) ||
    (cleaner && booking.cleanerId === cleaner.id)
  if (!isParty) return err('Forbidden', 403)

  if (!['completed', 'in_progress'].includes(booking.status)) {
    return err('Can only dispute completed or in-progress bookings', 400)
  }

  const existing = await disputeRepo.findByBookingId(id)
  if (existing) return err('Dispute already exists for this booking', 409)

  const body = await req.json()
  const parsed = createDisputeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const dispute = await disputeRepo.create({
    bookingId: id,
    raisedBy: user.id,
    reason: parsed.data.reason,
    evidence: parsed.data.evidence,
  })

  await bookingRepo.update(id, { status: 'disputed' })

  return ok(dispute, 201)
})
