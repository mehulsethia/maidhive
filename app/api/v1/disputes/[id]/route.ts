import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { createDisputeSchema } from '@/server/schemas/dispute.schema'
import { loopsEmailService } from '@/server/services/loops-email.service'

const ISSUE_LABELS: Record<string, string> = {
  cleaner_didnt_arrive: "Cleaner didn't arrive",
  client_no_show: 'Client no-show',
  service_not_completed: 'Service not completed as expected',
  property_damage_safety: 'Property damage or safety issue',
  other_issue: 'Other issue',
}

const NO_SHOW_DELAY_MINUTES = 30

export const POST = requireAuth(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const booking = await bookingRepo.findById(id)
  if (!booking) return err('Booking not found', 404)

  const client = await clientRepo.findByUserId(user.id)
  const cleaner = await cleanerRepo.findByUserId(user.id)
  const isClient = Boolean(client && booking.clientId === client.id)
  const isCleaner = Boolean(cleaner && booking.cleanerId === cleaner.id)
  if (!isClient && !isCleaner && user.role !== 'admin') return err('Forbidden', 403)

  const existing = await disputeRepo.findByBookingId(id)
  if (existing?.status === 'under_review') {
    return err('This booking is currently under review by MaidHive.', 409)
  }
  if (existing) return err('Dispute already exists for this booking', 409)

  const body = await req.json()
  const parsed = createDisputeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)
  const issueType = parsed.data.issue_type
  const isNoShowIssue = issueType === 'cleaner_didnt_arrive' || issueType === 'client_no_show'

  if (isNoShowIssue) {
    const noShowAvailableAt = booking.scheduledStart.getTime() + NO_SHOW_DELAY_MINUTES * 60 * 1000
    if (Date.now() < noShowAvailableAt) {
      return err(`No-show reporting is available ${NO_SHOW_DELAY_MINUTES} minutes after scheduled start`, 400)
    }

    if (issueType === 'cleaner_didnt_arrive' && !isClient) {
      return err('Only the client can report cleaner no-show', 403)
    }
    if (issueType === 'client_no_show' && !isCleaner) {
      return err('Only the cleaner can report client no-show', 403)
    }

    if (['cancelled', 'expired'].includes(booking.status)) {
      return err('No-show cannot be reported for cancelled or expired bookings', 400)
    }
  } else {
    if (!isClient) return err('Only the client can submit this report type', 403)

    if (!['in_progress', 'completed', 'disputed'].includes(booking.status)) {
      return err('This report can only be raised during or after the cleaning', 400)
    }

    if (booking.status !== 'in_progress') {
      if (!booking.completedAt) return err('Completed timestamp missing for this booking', 400)
      const disputeWindowMs = 24 * 60 * 60 * 1000
      if (Date.now() > booking.completedAt.getTime() + disputeWindowMs) {
        return err('Dispute window has expired (24 hours after completion)', 400)
      }
    }
  }

  const created = await disputeRepo.create({
    bookingId: id,
    raisedBy: user.id,
    reason: ISSUE_LABELS[issueType] ?? 'Other issue',
    issueType,
    explanation: parsed.data.explanation,
    evidence: parsed.data.evidence,
  })
  const dispute = await disputeRepo.update(created.id, { status: 'under_review' })

  if (!['cancelled', 'expired'].includes(booking.status)) {
    await bookingRepo.update(id, { status: 'disputed' })
  }

  try {
    await loopsEmailService.sendAdminDisputeRaised({
      bookingId: booking.id,
      clientName: booking.client.user.name ?? 'Client',
      cleanerName: booking.cleaner.user.name ?? 'Cleaner',
      date: booking.scheduledStart.toISOString(),
    })
  } catch (emailError) {
    console.error('Failed to send admin dispute raised email via Loops:', emailError)
  }

  const recipient = issueType === 'client_no_show' ? booking.cleaner.user : booking.client.user
  try {
    await loopsEmailService.sendClientIssueOrNoShowNotification({
      email: recipient.email,
      fullName: recipient.name ?? 'User',
      bookingId: booking.id,
    })
  } catch (emailError) {
    console.error('Failed to send issue/no-show email via Loops:', emailError)
  }

  return ok(dispute, 201)
})
