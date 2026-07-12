#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')

for (const envFile of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), envFile)
  if (fs.existsSync(full)) {
    dotenv.config({ path: full, override: false })
  }
}

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const bookingIdArg = process.argv.find((arg) => arg.startsWith('--booking-id='))
const bookingId = bookingIdArg ? bookingIdArg.split('=')[1] : null

function moneyCents(value) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.round(number * 100))
}

function money(cents) {
  return Number((Math.max(0, Math.round(cents)) / 100).toFixed(2))
}

function differs(current, next) {
  return moneyCents(current) !== moneyCents(next)
}

function computeConfirmedCancellationPolicy(booking) {
  const scheduledStartMs = new Date(booking.scheduledStart).getTime()
  const cancelledAtMs = new Date(booking.cancelledAt).getTime()
  if (!Number.isFinite(scheduledStartMs) || !Number.isFinite(cancelledAtMs)) return null

  const hoursUntilStart = (scheduledStartMs - cancelledAtMs) / (60 * 60 * 1000)
  const totalAmountCents = moneyCents(booking.totalAmount)
  const subtotalCents = moneyCents(booking.subtotal)
  const platformFeeCents = moneyCents(booking.platformFee)

  if (hoursUntilStart > 24) {
    return {
      window: 'more_than_24h',
      totalAmountCents,
      subtotalCents,
      platformFeeCents,
      clientRefundCents: totalAmountCents,
      captureCents: 0,
      cleanerPayoutCents: 0,
      platformRetainedCents: 0,
    }
  }

  if (hoursUntilStart >= 12) {
    const captureCents = Math.min(totalAmountCents, 500)
    return {
      window: 'between_12h_and_24h',
      totalAmountCents,
      subtotalCents,
      platformFeeCents,
      clientRefundCents: Math.max(0, totalAmountCents - captureCents),
      captureCents,
      cleanerPayoutCents: 0,
      platformRetainedCents: captureCents,
    }
  }

  const clientRefundCents = Math.min(totalAmountCents, Math.round(totalAmountCents * 0.5))
  const captureCents = Math.max(0, totalAmountCents - clientRefundCents)
  const cleanerPayoutCents = Math.min(captureCents, Math.round(subtotalCents * 0.5))

  return {
    window: 'under_12h',
    totalAmountCents,
    subtotalCents,
    platformFeeCents,
    clientRefundCents,
    captureCents,
    cleanerPayoutCents,
    platformRetainedCents: Math.max(0, captureCents - cleanerPayoutCents),
  }
}

function hasClientCancellationPolicyMetadata(booking, payment) {
  const context = `${booking.cancellationReason ?? ''} ${payment.refundReason ?? ''}`
    .toLowerCase()
    .replace(/[_-]/g, ' ')

  if (context.includes('no show') || context.includes('cancelled by cleaner')) return false
  return (
    context.includes('client cancellation policy') ||
    context.includes('cancelled by client') ||
    context.includes('client cancelled')
  )
}

async function main() {
  console.log(`[sync-client-cancellation-payouts] mode=${apply ? 'apply' : 'dry-run'}${bookingId ? ` bookingId=${bookingId}` : ''}`)

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'cancelled',
      cancelledAt: { not: null },
      ...(bookingId ? { id: bookingId } : {}),
      payment: {
        is: {
          status: { in: ['captured', 'transferred'] },
        },
      },
    },
    include: { payment: true },
    orderBy: { cancelledAt: 'asc' },
  })

  const changes = []
  const skipped = []

  for (const booking of bookings) {
    const payment = booking.payment
    if (!payment) {
      skipped.push({ bookingId: booking.id, reason: 'missing_payment' })
      continue
    }
    if (!hasClientCancellationPolicyMetadata(booking, payment)) {
      skipped.push({ bookingId: booking.id, paymentId: payment.id, reason: 'not_client_cancellation_policy' })
      continue
    }

    const policy = computeConfirmedCancellationPolicy(booking)
    if (!policy || policy.window === 'more_than_24h') {
      skipped.push({ bookingId: booking.id, paymentId: payment.id, reason: policy ? 'more_than_24h' : 'invalid_dates' })
      continue
    }

    const data = {}
    const nextRefundAmount = money(policy.clientRefundCents)
    const nextPlatformFee = money(policy.platformRetainedCents)
    const nextCleanerPayout = money(policy.cleanerPayoutCents)

    if (differs(payment.refundAmount, nextRefundAmount)) data.refundAmount = nextRefundAmount
    if (differs(payment.platformFee, nextPlatformFee)) data.platformFee = nextPlatformFee
    if (differs(payment.cleanerPayout, nextCleanerPayout)) data.cleanerPayout = nextCleanerPayout
    if (payment.refundReason !== 'client_cancellation_policy') data.refundReason = 'client_cancellation_policy'
    if (policy.cleanerPayoutCents === 0 && payment.payoutScheduledAt) data.payoutScheduledAt = null
    if (policy.cleanerPayoutCents > 0 && !payment.payoutScheduledAt) data.payoutScheduledAt = payment.capturedAt ?? booking.cancelledAt

    if (Object.keys(data).length === 0) {
      skipped.push({ bookingId: booking.id, paymentId: payment.id, reason: 'already_synced' })
      continue
    }

    const change = {
      bookingId: booking.id,
      paymentId: payment.id,
      window: policy.window,
      before: {
        refundAmount: payment.refundAmount == null ? null : Number(payment.refundAmount),
        platformFee: Number(payment.platformFee),
        cleanerPayout: Number(payment.cleanerPayout),
        payoutScheduledAt: payment.payoutScheduledAt,
        refundReason: payment.refundReason,
      },
      after: {
        refundAmount: data.refundAmount ?? (payment.refundAmount == null ? null : Number(payment.refundAmount)),
        platformFee: data.platformFee ?? Number(payment.platformFee),
        cleanerPayout: data.cleanerPayout ?? Number(payment.cleanerPayout),
        payoutScheduledAt: data.payoutScheduledAt === undefined ? payment.payoutScheduledAt : data.payoutScheduledAt,
        refundReason: data.refundReason ?? payment.refundReason,
      },
    }
    changes.push({ change, data })
  }

  console.log(`[sync-client-cancellation-payouts] candidates=${bookings.length} changes=${changes.length} skipped=${skipped.length}`)
  for (const item of changes) {
    console.log(JSON.stringify(item.change, null, 2))
  }
  if (skipped.length > 0) {
    console.log('[sync-client-cancellation-payouts] skipped summary')
    console.log(JSON.stringify(skipped, null, 2))
  }

  if (apply) {
    for (const item of changes) {
      await prisma.payment.update({
        where: { id: item.change.paymentId },
        data: item.data,
      })
    }
    console.log(`[sync-client-cancellation-payouts] applied=${changes.length}`)
  } else {
    console.log('[sync-client-cancellation-payouts] dry-run only. Re-run with --apply to update rows.')
  }
}

main()
  .catch((error) => {
    console.error('[sync-client-cancellation-payouts] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
