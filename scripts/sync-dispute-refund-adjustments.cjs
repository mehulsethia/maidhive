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
  return Math.round(number * 100)
}

function money(cents) {
  return Number((cents / 100).toFixed(2))
}

function adjustedCleanerPayoutCents(originalCleanerPayoutCents, refundCents) {
  return Math.max(0, originalCleanerPayoutCents - Math.max(0, refundCents))
}

function adjustedPlatformFeeCents(netPaidCents, finalCleanerPayoutCents) {
  if (netPaidCents <= 0) return 0
  return Math.min(netPaidCents, Math.max(0, netPaidCents - Math.max(0, finalCleanerPayoutCents)))
}

function differs(current, next) {
  return moneyCents(current) !== moneyCents(next)
}

async function main() {
  console.log(`[sync-dispute-refund-adjustments] mode=${apply ? 'apply' : 'dry-run'}${bookingId ? ` bookingId=${bookingId}` : ''}`)

  const disputes = await prisma.dispute.findMany({
    where: {
      status: { in: ['resolved', 'closed'] },
      resolutionType: 'partial_refund',
      ...(bookingId ? { bookingId } : {}),
    },
    include: {
      booking: {
        include: {
          payment: true,
        },
      },
    },
    orderBy: { resolvedAt: 'asc' },
  })

  const changes = []
  const skipped = []

  for (const dispute of disputes) {
    const booking = dispute.booking
    const payment = booking?.payment
    if (!booking || !payment) {
      skipped.push({ disputeId: dispute.id, bookingId: dispute.bookingId, reason: 'missing_booking_or_payment' })
      continue
    }

    const refundCents = moneyCents(payment.refundAmount ?? dispute.refundAmount)
    if (refundCents <= 0) {
      skipped.push({ disputeId: dispute.id, bookingId: booking.id, paymentId: payment.id, reason: 'missing_successful_refund_amount' })
      continue
    }

    const originalCleanerPayoutCents = moneyCents(booking.cleanerPayout)
    const paymentAmountCents = moneyCents(payment.amount)
    const netPaidCents = Math.max(0, paymentAmountCents - refundCents)
    const finalCleanerPayoutCents = adjustedCleanerPayoutCents(originalCleanerPayoutCents, refundCents)
    const finalPlatformFeeCents = adjustedPlatformFeeCents(netPaidCents, finalCleanerPayoutCents)
    const nextStatus = payment.status === 'partially_refunded' ? 'captured' : payment.status

    const data = {}
    if (differs(payment.cleanerPayout, money(finalCleanerPayoutCents))) {
      data.cleanerPayout = money(finalCleanerPayoutCents)
    }
    if (differs(payment.platformFee, money(finalPlatformFeeCents))) {
      data.platformFee = money(finalPlatformFeeCents)
    }
    if (payment.refundAmount == null || differs(payment.refundAmount, money(refundCents))) {
      data.refundAmount = money(refundCents)
    }
    if (nextStatus !== payment.status) {
      data.status = nextStatus
    }

    if (Object.keys(data).length === 0) {
      skipped.push({ disputeId: dispute.id, bookingId: booking.id, paymentId: payment.id, reason: 'already_synced' })
      continue
    }

    const change = {
      disputeId: dispute.id,
      bookingId: booking.id,
      paymentId: payment.id,
      before: {
        status: payment.status,
        amount: Number(payment.amount),
        refundAmount: payment.refundAmount == null ? null : Number(payment.refundAmount),
        platformFee: Number(payment.platformFee),
        cleanerPayout: Number(payment.cleanerPayout),
      },
      after: {
        status: data.status ?? payment.status,
        amount: Number(payment.amount),
        refundAmount: data.refundAmount ?? Number(payment.refundAmount ?? 0),
        platformFee: data.platformFee ?? Number(payment.platformFee),
        cleanerPayout: data.cleanerPayout ?? Number(payment.cleanerPayout),
      },
    }
    changes.push({ change, data })
  }

  console.log(`[sync-dispute-refund-adjustments] candidates=${disputes.length} changes=${changes.length} skipped=${skipped.length}`)
  for (const item of changes) {
    console.log(JSON.stringify(item.change, null, 2))
  }
  if (skipped.length > 0) {
    console.log('[sync-dispute-refund-adjustments] skipped summary')
    console.log(JSON.stringify(skipped, null, 2))
  }

  if (apply) {
    for (const item of changes) {
      await prisma.payment.update({
        where: { id: item.change.paymentId },
        data: item.data,
      })
    }
    console.log(`[sync-dispute-refund-adjustments] applied=${changes.length}`)
  } else {
    console.log('[sync-dispute-refund-adjustments] dry-run only. Re-run with --apply to update rows.')
  }
}

main()
  .catch((error) => {
    console.error('[sync-dispute-refund-adjustments] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
