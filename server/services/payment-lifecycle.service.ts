import { db } from '../db'
import { stripe } from '../stripe'
import { config } from '../config'
import { loopsEmailService } from './loops-email.service'
import { bookingService } from './booking.service'

export const paymentLifecycleService = {
  async processAutoCompletions(limit = 200) {
    const overdue = await db.booking.findMany({
      where: {
        status: { in: ['in_progress', 'disputed'] },
        scheduledEnd: { lte: new Date() },
        completedAt: null,
      },
      include: {
        dispute: true,
      },
      orderBy: { scheduledEnd: 'asc' },
      take: limit,
    })

    const summary = {
      checked: overdue.length,
      completed: 0,
      paused_by_dispute: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const booking of overdue) {
      try {
        if (booking.dispute && !['resolved', 'closed'].includes(String(booking.dispute.status ?? ''))) {
          const isNoShowIssue = ['cleaner_didnt_arrive', 'client_no_show'].includes(
            String(booking.dispute.issueType ?? ''),
          )
          if (isNoShowIssue) {
            summary.paused_by_dispute += 1
            continue
          }
        }

        await bookingService.completeBySystem(booking.id, booking.scheduledEnd)
        summary.completed += 1
      } catch (e: any) {
        summary.failed += 1
        summary.errors.push(`${booking.id}: ${e?.message ?? 'auto_complete_failed'}`)
      }
    }

    return summary
  },

  async processDueCaptures(limit = 200) {
    const dueBefore = new Date(Date.now() - config.CAPTURE_DELAY_HOURS * 60 * 60 * 1000)

    const candidates = await db.payment.findMany({
      where: {
        status: 'authorized',
        booking: {
          status: { in: ['completed', 'disputed'] },
          completedAt: { lte: dueBefore },
        },
      },
      include: {
        booking: {
          include: { dispute: true },
        },
      },
      orderBy: { authorizedAt: 'asc' },
      take: limit,
    })

    const summary = {
      checked: candidates.length,
      captured: 0,
      paused_by_dispute: 0,
      skipped_non_due: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const payment of candidates) {
      try {
        const dispute = payment.booking.dispute

        if (dispute && dispute.status !== 'resolved') {
          summary.paused_by_dispute += 1
          continue
        }

        if (dispute?.status === 'resolved' && dispute.resolutionType === 'full_refund') {
          summary.skipped_non_due += 1
          continue
        }

        const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId)
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'captured',
            stripeChargeId:
              typeof captured.latest_charge === 'string' ? captured.latest_charge : undefined,
            capturedAt: new Date(),
            payoutScheduledAt: new Date(Date.now() + config.PAYOUT_DELAY_HOURS * 60 * 60 * 1000),
          },
        })
        summary.captured += 1
      } catch (e: any) {
        summary.failed += 1
        summary.errors.push(`${payment.id}: ${e?.message ?? 'capture_failed'}`)
      }
    }

    return summary
  },

  async expireBookingDeadlines() {
    const now = new Date()
    const expiredPendingBookings = await db.booking.findMany({
      where: {
        status: 'pending',
        acceptBy: { lt: now },
      },
      include: {
        payment: true,
        client: { include: { user: true } },
        cleaner: { include: { user: true } },
      },
    })

    let expiredPendingCount = 0
    let cancelledPendingIntents = 0

    for (const booking of expiredPendingBookings) {
      await db.booking.update({
        where: { id: booking.id },
        data: {
          status: 'expired',
          proposedStart: null,
          proposedEnd: null,
          proposalBy: null,
        },
      })
      expiredPendingCount += 1

      if (booking.payment && ['pending', 'authorized'].includes(booking.payment.status)) {
        try {
          await stripe.paymentIntents.cancel(booking.payment.stripePaymentIntentId)
          await db.payment.update({
            where: { id: booking.payment.id },
            data: {
              status: 'failed',
              failedAt: new Date(),
            },
          })
          cancelledPendingIntents += 1
        } catch {
          // Keep booking expiry deterministic even if Stripe cancellation fails.
        }
      }
    }

    for (const booking of expiredPendingBookings) {
      try {
        await loopsEmailService.sendClientBookingRejectedOrExpired({
          email: booking.client.user.email,
          fullName: booking.client.user.name ?? 'Client',
          cleanerName: booking.cleaner.user.name ?? 'Cleaner',
        })
      } catch (emailError) {
        console.error('Failed to send client booking expired email via Loops:', emailError)
      }
    }

    const acceptedExpired = await db.booking.findMany({
      where: {
        status: 'accepted',
        payBy: { lt: now },
      },
      include: {
        payment: true,
        client: { include: { user: true } },
        cleaner: { include: { user: true } },
      },
    })

    let accepted = 0
    let cancelledIntents = 0

    for (const booking of acceptedExpired) {
      await db.booking.update({ where: { id: booking.id }, data: { status: 'expired' } })
      accepted += 1

      try {
        await loopsEmailService.sendClientBookingRejectedOrExpired({
          email: booking.client.user.email,
          fullName: booking.client.user.name ?? 'Client',
          cleanerName: booking.cleaner.user.name ?? 'Cleaner',
        })
      } catch (emailError) {
        console.error('Failed to send client booking expired email via Loops:', emailError)
      }

      if (booking.payment && booking.payment.status === 'pending') {
        try {
          await stripe.paymentIntents.cancel(booking.payment.stripePaymentIntentId)
          await db.payment.update({
            where: { id: booking.payment.id },
            data: {
              status: 'failed',
              failedAt: new Date(),
            },
          })
          cancelledIntents += 1
        } catch {
          // Keep booking expiry deterministic even if Stripe cancellation fails.
        }
      }
    }

    return {
      expired_pending: expiredPendingCount,
      expired_accepted: accepted,
      cancelled_pending_intents: cancelledIntents + cancelledPendingIntents,
    }
  },
}
