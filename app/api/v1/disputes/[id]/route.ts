import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { createDisputeSchema } from '@/server/schemas/dispute.schema'
import { loopsEmailService } from '@/server/services/loops-email.service'
import { pushInAppNotification } from '@/server/services/in-app-notification.service'
import { db } from '@/server/db'
import { config } from '@/server/config'
import { DISPUTE_REASON_LABELS } from '@/lib/dispute-issues'

const NO_SHOW_DELAY_MINUTES = 30
const DISPUTE_WINDOW_MS = config.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000

function disputeWindowLabel() {
  const hours = config.DISPUTE_WINDOW_HOURS
  if (hours >= 1) {
    return `${hours} hours`
  }
  const minutes = Math.round(hours * 60)
  return `${minutes} minutes`
}

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
  if (existing && ['open', 'under_review'].includes(existing.status)) {
    return err('This booking is currently under review by MaidHive.', 409)
  }
  if (existing) return err('Dispute already exists for this booking', 409)

  const body = await req.json()
  const parsed = createDisputeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)
  const issueType = parsed.data.issue_type
  const allowedForClient = new Set(['cleaner_no_show', 'service_issue', 'safety_concern', 'property_issue_damage'])
  const allowedForCleaner = new Set(['client_no_show', 'access_issue', 'safety_concern', 'service_dispute'])
  if (isClient && !allowedForClient.has(issueType)) {
    return err('Invalid report reason for client reporting.', 422)
  }
  if (isCleaner && !allowedForCleaner.has(issueType)) {
    return err('Invalid report reason for cleaner reporting.', 422)
  }
  const isNoShowIssue = issueType === 'cleaner_no_show' || issueType === 'client_no_show'

  if (isNoShowIssue) {
    const noShowAvailableAt = booking.scheduledStart.getTime() + NO_SHOW_DELAY_MINUTES * 60 * 1000
    if (Date.now() < noShowAvailableAt) {
      return err(`No-show reporting is available ${NO_SHOW_DELAY_MINUTES} minutes after scheduled start`, 400)
    }

    if (issueType === 'cleaner_no_show' && !isClient) {
      return err('Only the client can report cleaner no-show', 403)
    }
    if (issueType === 'client_no_show' && !isCleaner) {
      return err('Only the cleaner can report client no-show', 403)
    }

    if (['cancelled', 'expired'].includes(booking.status)) {
      return err('No-show cannot be reported for cancelled or expired bookings', 400)
    }
  } else {
    if (!isClient && !isCleaner) {
      return err('Only the client or assigned cleaner can submit this report type', 403)
    }

    if (!['in_progress', 'completed', 'disputed'].includes(booking.status)) {
      return err('This report can only be raised during or after the cleaning', 400)
    }

    const reportWindowEndsAt = booking.scheduledEnd.getTime() + DISPUTE_WINDOW_MS
    if (Date.now() > reportWindowEndsAt) {
      return err(`Reporting window has expired (${disputeWindowLabel()} after scheduled completion)`, 400)
    }
  }

  const created = await disputeRepo.create({
    bookingId: id,
    raisedBy: user.id,
    reason: DISPUTE_REASON_LABELS[issueType] ?? 'Service issue',
    issueType,
    explanation: parsed.data.explanation,
    evidence: parsed.data.evidence,
    reporterRole: isClient ? 'client' : isCleaner ? 'cleaner' : 'admin',
    bookingStatusAtReport: booking.status,
  })
  const dispute = await disputeRepo.update(created.id, { status: 'under_review' })

  if (!['cancelled', 'expired'].includes(booking.status)) {
    await bookingRepo.update(id, { status: 'disputed' })
  }

  await pushInAppNotification({
    userId: booking.client.userId,
    type: 'dispute_under_review',
    title: 'Dispute under review',
    body: 'Your dispute is now under review by MaidHive.',
    data: { booking_id: booking.id, dispute_id: dispute.id },
  })
  await pushInAppNotification({
    userId: booking.cleaner.userId,
    type: 'dispute_under_review',
    title: 'Dispute under review',
    body: 'A dispute was raised for this booking and is under review.',
    data: { booking_id: booking.id, dispute_id: dispute.id },
  })

  const admins = await db.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { id: true },
  })
  await Promise.all(
    admins.map((admin) =>
      pushInAppNotification({
        userId: admin.id,
        type: 'dispute_raised',
        title: 'New dispute raised',
        body: `Booking ${booking.id.slice(0, 8)} has a new dispute requiring review.`,
        data: { booking_id: booking.id, dispute_id: dispute.id },
      }),
    ),
  )

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
