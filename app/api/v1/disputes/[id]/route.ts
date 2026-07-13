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
import { cleanerReliabilityService } from '@/server/services/cleaner-reliability.service'

const NO_SHOW_DELAY_MINUTES = 30
const DISPUTE_WINDOW_MS = config.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000
const DISPUTE_PAYOUT_PAUSED_MESSAGE =
  'This booking is now Under Review, and the cleaner payout has been paused until the case is resolved.'

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

async function pauseCleanerPayoutForDispute(bookingId: string) {
  const payment = await db.payment.findUnique({
    where: { bookingId },
    select: {
      id: true,
      status: true,
      cleanerPayout: true,
      transferredAt: true,
      stripeTransferId: true,
    },
  })
  if (!payment) return { paused: true, reason: 'no_payment' }

  const hasReleasedPayout =
    payment.status === 'transferred' ||
    Boolean(payment.transferredAt) ||
    Boolean(payment.stripeTransferId)
  if (hasReleasedPayout) {
    return { paused: false, reason: 'payout_already_released' }
  }

  const cleanerPayout = Number(payment.cleanerPayout ?? 0)
  if (cleanerPayout <= 0) return { paused: true, reason: 'no_cleaner_payout' }

  await db.payment.update({
    where: { id: payment.id },
    data: { payoutScheduledAt: null },
  })
  return { paused: true, reason: 'payout_schedule_cleared' }
}

async function hideReviewsForActiveDispute(bookingId: string) {
  return db.review.updateMany({
    where: {
      bookingId,
      isPublic: true,
    },
    data: {
      isPublic: false,
      hiddenByDispute: true,
    } as any,
  })
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
  const payoutPause = await pauseCleanerPayoutForDispute(bookingRecord.id)
  const hiddenReviews = await hideReviewsForActiveDispute(bookingRecord.id)

  if (hiddenReviews.count > 0) {
    try {
      await cleanerReliabilityService.recalculate(bookingRecord.cleanerId)
    } catch (reliabilityError) {
      await cleanerReliabilityService.markDirty(bookingRecord.cleanerId)
      console.error('dispute.review_lock.reliability_failed', reliabilityError)
    }
  }

  const clientPauseMessage = payoutPause.paused
    ? DISPUTE_PAYOUT_PAUSED_MESSAGE
    : 'This booking is now Under Review. MaidHive admin has been alerted to review the payment state for this case.'

  await pushInAppNotification({
    userId: bookingRecord.client.userId,
    type: 'dispute_under_review',
    title: 'Dispute under review',
    body: clientPauseMessage,
    data: { booking_id: bookingRecord.id, dispute_id: dispute.id },
  })
  await pushInAppNotification({
    userId: bookingRecord.cleaner.userId,
    type: 'dispute_under_review',
    title: 'Dispute under review',
    body: payoutPause.paused
      ? 'A dispute was raised for this booking. Cleaner payout is paused until the case is resolved.'
      : 'A dispute was raised for this booking. MaidHive admin has been alerted to review the payment state for this case.',
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
        body: payoutPause.paused
          ? `Booking ${bookingRecord.id.slice(0, 8)} has a new dispute requiring review. Cleaner payout is paused.`
          : `Booking ${bookingRecord.id.slice(0, 8)} has a new dispute requiring review. Cleaner payout was not paused automatically: ${payoutPause.reason}.`,
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
        statusMessage: clientPauseMessage,
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
