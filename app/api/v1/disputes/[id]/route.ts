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
import { Prisma } from '@prisma/client'

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

function bookingReference(bookingId: string) {
  const raw = bookingId.replace(/[^a-z0-9]/gi, '')
  return `MH-${raw.slice(-6).toUpperCase()}`
}

export const POST = requireAuth(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const booking = await bookingRepo.findById(id)
  if (!booking) return err('Booking not found', 404)
  const bookingRecord = booking

  const client = await clientRepo.findByUserId(user.id)
  const cleaner = await cleanerRepo.findByUserId(user.id)
  const isClient = Boolean(client && bookingRecord.clientId === client.id)
  const isCleaner = Boolean(cleaner && bookingRecord.cleanerId === cleaner.id)
  if (!isClient && !isCleaner && user.role !== 'admin') return err('Forbidden', 403)

  const body = await req.json()
  const parsed = createDisputeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)
  const disputePayload = parsed.data
  const issueType = disputePayload.issue_type
  const participantRole = isClient ? 'client' : isCleaner ? 'cleaner' : 'admin'
  const reportWindowEndsAt = bookingRecord.scheduledEnd.getTime() + DISPUTE_WINDOW_MS
  if (Date.now() > reportWindowEndsAt) {
    return err(`Reporting window has expired (${disputeWindowLabel()} after scheduled completion)`, 400)
  }

  async function attachResponseToExistingDispute(existing: NonNullable<Awaited<ReturnType<typeof disputeRepo.findByBookingId>>>) {
    if (!['open', 'under_review'].includes(existing.status)) {
      return err('This dispute has already been resolved or closed.', 409)
    }
    if (!isClient && !isCleaner) {
      return err('Only the client or assigned cleaner can respond to this dispute.', 403)
    }
    if (existing.raisedBy === user.id || existing.reporterRole === participantRole) {
      return err('You have already submitted information for this dispute.', 409)
    }
    if (existing.respondedBy || existing.respondedAt || existing.responderRole) {
      return err('The other party has already submitted a response for this dispute.', 409)
    }

    const responseWrite = await disputeRepo.attachParticipantResponse(existing.id, {
      explanation: disputePayload.explanation,
      evidence: disputePayload.evidence,
      respondedBy: user.id,
      responderRole: participantRole,
      respondedAt: new Date(),
    })
    if (responseWrite.count === 0) {
      return err('A response has already been submitted for this dispute.', 409)
    }
    const updated = await disputeRepo.findByBookingId(bookingRecord.id)
    if (!updated) return err('Dispute not found', 404)

    await pushInAppNotification({
      userId: existing.raisedBy,
      type: 'dispute_response_submitted',
      title: 'Dispute response submitted',
      body: 'The other party added information to the existing dispute case.',
      data: { booking_id: bookingRecord.id, dispute_id: updated.id },
    })

    const admins = await db.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    })
    await Promise.all(
      admins.map((admin) =>
        pushInAppNotification({
          userId: admin.id,
          type: 'dispute_response_submitted',
          title: 'Dispute response submitted',
          body: `Booking ${bookingRecord.id.slice(0, 8)} has a response ready for review.`,
          data: { booking_id: bookingRecord.id, dispute_id: updated.id },
        }),
      ),
    )

    return ok(updated, 200)
  }

  const existing = await disputeRepo.findByBookingId(id)
  if (existing) {
    return attachResponseToExistingDispute(existing)
  }

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
    const noShowAvailableAt = bookingRecord.scheduledStart.getTime() + NO_SHOW_DELAY_MINUTES * 60 * 1000
    if (Date.now() < noShowAvailableAt) {
      return err(`No-show reporting is available ${NO_SHOW_DELAY_MINUTES} minutes after scheduled start`, 400)
    }

    if (issueType === 'cleaner_no_show' && !isClient) {
      return err('Only the client can report cleaner no-show', 403)
    }
    if (issueType === 'client_no_show' && !isCleaner) {
      return err('Only the cleaner can report client no-show', 403)
    }

    if (['cancelled', 'expired'].includes(bookingRecord.status)) {
      return err('No-show cannot be reported for cancelled or expired bookings', 400)
    }
  } else {
    if (!isClient && !isCleaner) {
      return err('Only the client or assigned cleaner can submit this report type', 403)
    }

    if (!['in_progress', 'completed', 'disputed'].includes(bookingRecord.status)) {
      return err('This report can only be raised during or after the cleaning', 400)
    }

  }

  let created: Awaited<ReturnType<typeof disputeRepo.create>>
  try {
    created = await disputeRepo.create({
      bookingId: id,
      raisedBy: user.id,
      reason: DISPUTE_REASON_LABELS[issueType] ?? 'Service issue',
      issueType,
      explanation: disputePayload.explanation,
      evidence: disputePayload.evidence,
      reporterRole: participantRole,
      bookingStatusAtReport: bookingRecord.status,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await disputeRepo.findByBookingId(id)
      if (duplicate) return attachResponseToExistingDispute(duplicate)
    }
    throw error
  }
  const dispute = await disputeRepo.update(created.id, { status: 'under_review' })

  if (!['cancelled', 'expired'].includes(bookingRecord.status)) {
    await bookingRepo.update(id, { status: 'disputed' })
  }

  await pushInAppNotification({
    userId: bookingRecord.client.userId,
    type: 'dispute_under_review',
    title: 'Dispute under review',
    body: 'Your dispute is now under review by MaidHive.',
    data: { booking_id: bookingRecord.id, dispute_id: dispute.id },
  })
  await pushInAppNotification({
    userId: bookingRecord.cleaner.userId,
    type: 'dispute_under_review',
    title: 'Dispute under review',
    body: 'A dispute was raised for this booking and is under review.',
    data: { booking_id: bookingRecord.id, dispute_id: dispute.id },
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
        body: `Booking ${bookingRecord.id.slice(0, 8)} has a new dispute requiring review.`,
        data: { booking_id: bookingRecord.id, dispute_id: dispute.id },
      }),
    ),
  )

  try {
    await loopsEmailService.sendAdminDisputeRaised({
      bookingId: bookingRecord.id,
      clientName: bookingRecord.client.user.name ?? 'Client',
      cleanerName: bookingRecord.cleaner.user.name ?? 'Cleaner',
      date: bookingRecord.scheduledStart.toISOString(),
    })
  } catch (emailError) {
    console.error('Failed to send admin dispute raised email via Loops:', emailError)
  }

  const issueLabel = DISPUTE_REASON_LABELS[issueType] ?? 'Service issue'
  const reference = bookingReference(bookingRecord.id)
  const reporter = isCleaner
    ? { user: bookingRecord.cleaner.user, disputePath: `/cleaner/report?booking=${bookingRecord.id}` }
    : { user: bookingRecord.client.user, disputePath: `/client/report?booking=${bookingRecord.id}` }
  const counterparty = isCleaner
    ? { user: bookingRecord.client.user, disputePath: `/client/report?booking=${bookingRecord.id}` }
    : { user: bookingRecord.cleaner.user, disputePath: `/cleaner/report?booking=${bookingRecord.id}` }

  try {
    await Promise.all([
      loopsEmailService.sendDisputeSubmittedConfirmation({
        email: reporter.user.email,
        fullName: reporter.user.name ?? 'User',
        bookingReference: reference,
        issueType: issueLabel,
        disputePath: reporter.disputePath,
      }),
      loopsEmailService.sendDisputeRaisedAgainstNotification({
        email: counterparty.user.email,
        fullName: counterparty.user.name ?? 'User',
        bookingReference: reference,
        issueType: issueLabel,
        disputePath: counterparty.disputePath,
      }),
    ])
  } catch (emailError) {
    console.error('Failed to send dispute participant emails via Loops:', emailError)
  }

  return ok(dispute, 201)
})
