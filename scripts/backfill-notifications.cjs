#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')

// Load env in priority order for local execution.
for (const envFile of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), envFile)
  if (fs.existsSync(full)) {
    dotenv.config({ path: full, override: false })
  }
}

const prisma = new PrismaClient()

const dryRun = process.argv.includes('--dry-run')

function isoOrNow(input) {
  return input instanceof Date && !Number.isNaN(input.getTime()) ? input : new Date()
}

function shortBooking(bookingId) {
  return typeof bookingId === 'string' ? bookingId.slice(0, 8) : ''
}

function makeBackfillKey(userId, type, ref) {
  return `${userId}|${type}|${ref ?? 'global'}`
}

async function main() {
  console.log(`Starting notification backfill${dryRun ? ' (dry-run)' : ''}...`)

  const [existingNotifications, bookings, disputes, users, cleaners, admins] = await Promise.all([
    prisma.notification.findMany({
      select: { userId: true, type: true, data: true },
    }),
    prisma.booking.findMany({
      include: {
        client: { include: { user: true } },
        cleaner: { include: { user: true } },
        payment: true,
      },
    }),
    prisma.dispute.findMany({
      include: {
        booking: {
          include: {
            client: { include: { user: true } },
            cleaner: { include: { user: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ['client', 'cleaner'] } },
      select: { id: true, role: true, createdAt: true },
    }),
    prisma.cleaner.findMany({
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    }),
  ])

  const existingKeys = new Set()
  for (const row of existingNotifications) {
    const backfillKey = row?.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? row.data._backfill_key
      : null
    if (typeof backfillKey === 'string' && backfillKey.length > 0) {
      existingKeys.add(backfillKey)
    }
  }

  const pending = []
  const typeCounts = new Map()

  function queueNotification({ userId, type, title, body, data, createdAt, ref }) {
    const key = makeBackfillKey(userId, type, ref)
    if (existingKeys.has(key)) return
    existingKeys.add(key)

    pending.push({
      userId,
      type,
      title,
      body,
      data: {
        ...(data ?? {}),
        _backfill: true,
        _backfill_key: key,
      },
      createdAt: isoOrNow(createdAt),
    })
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
  }

  // Account created notifications
  for (const user of users) {
    if (user.role === 'client') {
      queueNotification({
        userId: user.id,
        type: 'account_created',
        title: 'Welcome to MaidHive',
        body: 'Your client profile is ready. Start by browsing available cleaners.',
        createdAt: user.createdAt,
        ref: `account:${user.id}`,
      })
    } else if (user.role === 'cleaner') {
      queueNotification({
        userId: user.id,
        type: 'account_created',
        title: 'Welcome to MaidHive',
        body: 'Your cleaner profile is created. Complete onboarding to start receiving jobs.',
        createdAt: user.createdAt,
        ref: `account:${user.id}`,
      })
    }
  }

  // Cleaner application notifications
  for (const cleaner of cleaners) {
    const cleanerUserId = cleaner.userId
    const name = cleaner.user?.name ?? 'Cleaner'
    if (cleaner.status === 'pending' && cleaner.profileComplete) {
      queueNotification({
        userId: cleanerUserId,
        type: 'cleaner_application_submitted',
        title: 'Application submitted',
        body: 'Your cleaner profile has been submitted for admin review.',
        data: { cleaner_id: cleaner.id },
        createdAt: cleaner.updatedAt ?? cleaner.createdAt,
        ref: `cleaner_submission:${cleaner.id}:self`,
      })
      for (const admin of admins) {
        queueNotification({
          userId: admin.id,
          type: 'cleaner_application_submitted',
          title: 'New cleaner application',
          body: `${name} submitted onboarding for approval.`,
          data: { cleaner_id: cleaner.id },
          createdAt: cleaner.updatedAt ?? cleaner.createdAt,
          ref: `cleaner_submission:${cleaner.id}:admin`,
        })
      }
    }

    if (cleaner.status === 'approved') {
      queueNotification({
        userId: cleanerUserId,
        type: 'cleaner_application_approved',
        title: 'Cleaner profile approved',
        body: 'Your cleaner profile has been approved and is now live.',
        data: { cleaner_id: cleaner.id },
        createdAt: cleaner.approvedAt ?? cleaner.updatedAt ?? cleaner.createdAt,
        ref: `cleaner_approved:${cleaner.id}`,
      })
    }

    if (cleaner.status === 'rejected') {
      queueNotification({
        userId: cleanerUserId,
        type: 'cleaner_application_rejected',
        title: 'Cleaner profile rejected',
        body: cleaner.rejectionReason
          ? `Your cleaner profile was rejected: ${cleaner.rejectionReason}`
          : 'Your cleaner profile was rejected.',
        data: { cleaner_id: cleaner.id },
        createdAt: cleaner.updatedAt ?? cleaner.createdAt,
        ref: `cleaner_rejected:${cleaner.id}`,
      })
    }
  }

  // Booking + payment-derived notifications
  for (const booking of bookings) {
    const bookingRef = `booking:${booking.id}`
    const clientUserId = booking.client?.userId
    const cleanerUserId = booking.cleaner?.userId
    if (!clientUserId || !cleanerUserId) continue

    queueNotification({
      userId: clientUserId,
      type: 'booking_created_pending',
      title: 'Booking request created',
      body: 'Your booking request was created and is waiting for cleaner response.',
      data: { booking_id: booking.id },
      createdAt: booking.createdAt,
      ref: `${bookingRef}:created_pending`,
    })

    if (booking.payment && ['authorized', 'captured', 'transferred', 'partially_refunded', 'refunded'].includes(booking.payment.status)) {
      queueNotification({
        userId: cleanerUserId,
        type: 'booking_request',
        title: 'New Booking Request',
        body: `You have a new booking request from ${booking.client?.user?.name ?? 'a client'}`,
        data: { booking_id: booking.id },
        createdAt: booking.payment.authorizedAt ?? booking.confirmedAt ?? booking.createdAt,
        ref: `${bookingRef}:request`,
      })
    }

    if (booking.acceptedAt) {
      queueNotification({
        userId: clientUserId,
        type: 'booking_accepted',
        title: 'Booking accepted',
        body: 'Cleaner accepted your booking request.',
        data: { booking_id: booking.id },
        createdAt: booking.acceptedAt,
        ref: `${bookingRef}:accepted`,
      })
    }

    if (booking.confirmedAt) {
      queueNotification({
        userId: clientUserId,
        type: 'booking_confirmed',
        title: 'Booking confirmed',
        body: 'Payment authorization is complete and your booking is now confirmed.',
        data: { booking_id: booking.id },
        createdAt: booking.confirmedAt,
        ref: `${bookingRef}:confirmed`,
      })
    }

    if (booking.status === 'expired') {
      queueNotification({
        userId: clientUserId,
        type: 'booking_request_expired',
        title: 'Booking request expired',
        body: 'This booking request closed before confirmation.',
        data: { booking_id: booking.id },
        createdAt: booking.updatedAt ?? booking.createdAt,
        ref: `${bookingRef}:expired:client`,
      })
      queueNotification({
        userId: cleanerUserId,
        type: 'booking_request_expired',
        title: 'Booking request expired',
        body: 'This booking request closed before confirmation.',
        data: { booking_id: booking.id },
        createdAt: booking.updatedAt ?? booking.createdAt,
        ref: `${bookingRef}:expired:cleaner`,
      })
    }

    if (booking.status === 'cancelled') {
      const cancelledBy = booking.cancelledBy
      const notifyUserId = cancelledBy && cancelledBy === clientUserId ? cleanerUserId : clientUserId
      queueNotification({
        userId: notifyUserId,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        body: 'A booking has been cancelled',
        data: { booking_id: booking.id },
        createdAt: booking.cancelledAt ?? booking.updatedAt ?? booking.createdAt,
        ref: `${bookingRef}:cancelled:${notifyUserId}`,
      })
    }

    if (booking.completedAt) {
      queueNotification({
        userId: clientUserId,
        type: 'booking_completed',
        title: 'Booking Completed',
        body: 'Cleaner marked this booking as completed.',
        data: { booking_id: booking.id },
        createdAt: booking.completedAt,
        ref: `${bookingRef}:completed:client`,
      })
      queueNotification({
        userId: cleanerUserId,
        type: 'booking_completed',
        title: 'Booking completed',
        body: 'Booking marked complete. Payout will be released after the dispute window.',
        data: { booking_id: booking.id },
        createdAt: booking.completedAt,
        ref: `${bookingRef}:completed:cleaner`,
      })
    }

    if (booking.payment?.capturedAt) {
      queueNotification({
        userId: clientUserId,
        type: 'payment_captured',
        title: 'Payment captured',
        body: 'Payment was captured successfully after booking completion.',
        data: { booking_id: booking.id },
        createdAt: booking.payment.capturedAt,
        ref: `${bookingRef}:payment_captured`,
      })
    }

    if (booking.payment?.transferredAt || booking.payment?.status === 'transferred') {
      queueNotification({
        userId: cleanerUserId,
        type: 'payout_released',
        title: 'Payout released',
        body: 'Payout was released to your connected Stripe account.',
        data: { booking_id: booking.id },
        createdAt: booking.payment.transferredAt ?? booking.payment.updatedAt ?? booking.updatedAt,
        ref: `${bookingRef}:payout_released`,
      })
    }
  }

  // Dispute-derived notifications
  for (const dispute of disputes) {
    const booking = dispute.booking
    if (!booking?.client?.userId || !booking?.cleaner?.userId) continue
    const bookingId = booking.id
    const disputeRef = `dispute:${dispute.id}`

    if (dispute.status === 'under_review' || dispute.status === 'open') {
      queueNotification({
        userId: booking.client.userId,
        type: 'dispute_under_review',
        title: 'Dispute under review',
        body: 'Your dispute is now under review by MaidHive.',
        data: { booking_id: bookingId, dispute_id: dispute.id },
        createdAt: dispute.updatedAt ?? dispute.createdAt,
        ref: `${disputeRef}:under_review:client`,
      })
      queueNotification({
        userId: booking.cleaner.userId,
        type: 'dispute_under_review',
        title: 'Dispute under review',
        body: 'A dispute was raised for this booking and is under review.',
        data: { booking_id: bookingId, dispute_id: dispute.id },
        createdAt: dispute.updatedAt ?? dispute.createdAt,
        ref: `${disputeRef}:under_review:cleaner`,
      })
      for (const admin of admins) {
        queueNotification({
          userId: admin.id,
          type: 'dispute_raised',
          title: 'New dispute raised',
          body: `Booking ${shortBooking(bookingId)} has a new dispute requiring review.`,
          data: { booking_id: bookingId, dispute_id: dispute.id },
          createdAt: dispute.createdAt,
          ref: `${disputeRef}:raised:admin`,
        })
      }
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      const resolutionCopy = (() => {
        if (dispute.resolutionType === 'full_refund') return 'Resolution: full refund issued.'
        if (dispute.resolutionType === 'partial_refund') return 'Resolution: partial refund issued.'
        if (dispute.resolutionType === 'payment_released') return 'Resolution: payment released to cleaner.'
        return 'Resolution: no refund, payment released to cleaner.'
      })()

      queueNotification({
        userId: booking.client.userId,
        type: 'dispute_resolved',
        title: 'Dispute resolved',
        body: resolutionCopy,
        data: { booking_id: bookingId, dispute_id: dispute.id },
        createdAt: dispute.resolvedAt ?? dispute.updatedAt ?? dispute.createdAt,
        ref: `${disputeRef}:resolved:client`,
      })
      queueNotification({
        userId: booking.cleaner.userId,
        type: 'dispute_resolved',
        title: 'Dispute resolved',
        body: resolutionCopy,
        data: { booking_id: bookingId, dispute_id: dispute.id },
        createdAt: dispute.resolvedAt ?? dispute.updatedAt ?? dispute.createdAt,
        ref: `${disputeRef}:resolved:cleaner`,
      })
      for (const admin of admins) {
        queueNotification({
          userId: admin.id,
          type: 'dispute_resolved',
          title: 'Dispute resolved',
          body: `Dispute for booking ${shortBooking(bookingId)} was resolved.`,
          data: { booking_id: bookingId, dispute_id: dispute.id },
          createdAt: dispute.resolvedAt ?? dispute.updatedAt ?? dispute.createdAt,
          ref: `${disputeRef}:resolved:admin`,
        })
      }
    }
  }

  const sortedTypeCounts = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])
  console.log(`Planned notifications: ${pending.length}`)
  for (const [type, count] of sortedTypeCounts) {
    console.log(`  ${type}: ${count}`)
  }

  if (dryRun) {
    console.log('Dry-run complete. No rows inserted.')
    return
  }

  if (pending.length === 0) {
    console.log('No missing notifications found. Nothing to insert.')
    return
  }

  const chunkSize = 500
  let inserted = 0
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize)
    await prisma.notification.createMany({
      data: chunk,
    })
    inserted += chunk.length
    console.log(`Inserted ${inserted}/${pending.length}`)
  }

  console.log(`Backfill complete. Inserted ${inserted} notifications.`)
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
