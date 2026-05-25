import { db } from '../db'
import { stripe } from '../stripe'
import { config } from '../config'
import { loopsEmailService } from './loops-email.service'
import { bookingService } from './booking.service'
import { pushInAppNotification } from './in-app-notification.service'

const AUTO_COMPLETION_GRACE_MINUTES = 5

export const paymentLifecycleService = {
  async processAutoStarts(limit = 200) {
    const now = new Date()
    const lateCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const due = await db.booking.findMany({
      where: {
        status: { in: ['accepted', 'confirmed'] },
        startedAt: null,
        scheduledStart: { lte: now },
        scheduledEnd: { gte: lateCutoff },
        payment: {
          is: {
            status: { in: ['authorized', 'captured', 'transferred'] },
          },
        },
      },
      select: {
        id: true,
        scheduledStart: true,
      },
      orderBy: { scheduledStart: 'asc' },
      take: limit,
    })

    const summary = {
      checked: due.length,
      started: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const booking of due) {
      try {
        const updated = await bookingService.startBySystem(booking.id, booking.scheduledStart)
        if (updated?.status === 'in_progress') {
          summary.started += 1
        }
      } catch (e: any) {
        summary.failed += 1
        summary.errors.push(`${booking.id}: ${e?.message ?? 'auto_start_failed'}`)
      }
    }

    return summary
  },

  async processAutoCompletions(limit = 200) {
    const autoCompleteCutoff = new Date(Date.now() - AUTO_COMPLETION_GRACE_MINUTES * 60 * 1000)
    const overdue = await db.booking.findMany({
      where: {
        scheduledEnd: { lte: autoCompleteCutoff },
        OR: [
          { status: 'in_progress' },
          { status: 'confirmed', completedAt: null },
          { status: 'disputed', completedAt: null },
        ],
      },
      select: {
        id: true,
        status: true,
        scheduledEnd: true,
        dispute: {
          select: {
            status: true,
            reason: true,
          },
        },
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
        if (booking.status !== 'disputed' && booking.dispute && !['resolved', 'closed'].includes(String(booking.dispute.status ?? ''))) {
          summary.paused_by_dispute += 1
          continue
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
          scheduledEnd: { lte: dueBefore },
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

  async processDueReleaseTransitions(limit = 200) {
    const dueBefore = new Date(Date.now() - config.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000)
    const candidates = await db.payment.findMany({
      where: {
        status: { in: ['authorized', 'captured'] },
        booking: {
          status: 'completed',
          scheduledEnd: { lte: dueBefore },
          OR: [
            { dispute: { is: null } },
            { dispute: { is: { status: { in: ['resolved', 'closed'] } } } },
          ],
        },
      },
      include: {
        booking: {
          include: {
            cleaner: { include: { user: true } },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    })

    const summary = {
      checked: candidates.length,
      released: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const payment of candidates) {
      try {
        const releasedAt = new Date()
        const updated = await db.payment.updateMany({
          where: {
            id: payment.id,
            status: { in: ['authorized', 'captured'] },
          },
          data: {
            status: 'transferred',
            transferredAt: releasedAt,
            payoutScheduledAt: payment.payoutScheduledAt ?? releasedAt,
          },
        })

        if (updated.count === 0) {
          continue
        }

        summary.released += 1

        await pushInAppNotification({
          userId: payment.booking.cleaner.userId,
          type: 'payout_released',
          title: 'Payout released',
          body: 'Payout has been marked as released after the report window closed.',
          data: { booking_id: payment.booking.id },
        })
      } catch (e: any) {
        summary.failed += 1
        summary.errors.push(`${payment.id}: ${e?.message ?? 'release_transition_failed'}`)
      }
    }

    return summary
  },

  async expireBookingDeadlines() {
    const now = new Date()
    const expiredUnpaidDrafts = await db.booking.findMany({
      where: {
        status: { in: ['draft', 'pending'] },
        scheduledStart: { lt: now },
        OR: [
          { payment: null },
          {
            payment: {
              is: {
                status: { in: ['pending', 'failed'] },
              },
            },
          },
        ],
      },
      include: {
        payment: true,
      },
    })

    let expiredUnpaidDraftCount = 0
    let cancelledDraftIntents = 0

    for (const booking of expiredUnpaidDrafts) {
      await db.booking.update({
        where: { id: booking.id },
        data: {
          status: 'expired',
          proposedStart: null,
          proposedEnd: null,
          proposalBy: null,
          proposalContext: null,
          proposalExpiresAt: null,
          cleanerProposals: 0,
          clientProposals: 0,
          postCleanerProposals: 0,
          postClientProposals: 0,
        },
      })
      expiredUnpaidDraftCount += 1

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
          cancelledDraftIntents += 1
        } catch {
          // Keep booking expiry deterministic even if Stripe cancellation fails.
        }
      }
    }

    const expiredPendingBookings = await db.booking.findMany({
      where: {
        status: 'pending',
        acceptBy: { lt: now },
        payment: {
          is: {
            status: { in: ['authorized', 'captured', 'transferred'] },
          },
        },
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
          proposalContext: null,
          proposalExpiresAt: null,
          cleanerProposals: 0,
          clientProposals: 0,
          postCleanerProposals: 0,
          postClientProposals: 0,
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
      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_request_expired',
        title: 'Booking request expired',
        body: 'This request expired because the cleaner did not accept in time.',
        data: { booking_id: booking.id },
      })
      await pushInAppNotification({
        userId: booking.cleaner.userId,
        type: 'booking_request_expired',
        title: 'Booking request expired',
        body: 'This request expired before confirmation.',
        data: { booking_id: booking.id },
      })
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
      const isReauthFlow = Boolean(booking.reauthorizationRequired)
      await db.booking.update({
        where: { id: booking.id },
        data: {
          status: isReauthFlow ? 'cancelled' : 'expired',
          cancellationReason: isReauthFlow
            ? 'Re-authorization was not completed within the grace period after reschedule. No penalties applied.'
            : null,
          cancelledAt: isReauthFlow ? new Date() : null,
        },
      })
      accepted += 1

      await pushInAppNotification({
        userId: booking.client.userId,
        type: isReauthFlow ? 'booking_cancelled' : 'booking_request_expired',
        title: isReauthFlow ? 'Booking cancelled after unresolved re-authorization' : 'Booking payment window expired',
        body: isReauthFlow
          ? 'Re-authorization remained unresolved after the 24-hour grace period. Booking was auto-cancelled with no penalties.'
          : 'This booking was closed because payment authorization did not complete in time.',
        data: { booking_id: booking.id },
      })
      await pushInAppNotification({
        userId: booking.cleaner.userId,
        type: isReauthFlow ? 'booking_cancelled' : 'booking_request_expired',
        title: isReauthFlow ? 'Booking cancelled after unresolved re-authorization' : 'Booking payment window expired',
        body: isReauthFlow
          ? 'Client did not complete re-authorization during the grace period. Booking was auto-cancelled with no penalties.'
          : 'This booking was closed because client authorization did not complete in time.',
        data: { booking_id: booking.id },
      })

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

    const expiredRescheduleNegotiations = await db.booking.findMany({
      where: {
        status: { in: ['accepted', 'confirmed'] },
        proposalContext: { in: ['post_confirmation', 'amend_start'] },
        proposalExpiresAt: { lt: now },
      },
      include: {
        client: { include: { user: true } },
        cleaner: { include: { user: true } },
      },
    })

    for (const booking of expiredRescheduleNegotiations) {
      const preserveRescheduleUsage = booking.proposalContext === 'amend_start'
      const preserveAmendUsage = booking.proposalContext === 'amend_start'
      await db.booking.update({
        where: { id: booking.id },
        data: {
          proposedStart: null,
          proposedEnd: null,
          proposalBy: null,
          proposalContext: null,
          proposalExpiresAt: null,
          cleanerProposals: preserveAmendUsage ? undefined : 0,
          clientProposals: preserveAmendUsage ? undefined : 0,
          postCleanerProposals: preserveRescheduleUsage ? undefined : 0,
          postClientProposals: preserveRescheduleUsage ? undefined : 0,
        },
      })
      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_request_expired',
        title: booking.proposalContext === 'amend_start' ? 'Amend Start Time expired' : 'Reschedule request expired',
        body: 'No agreement was reached before the cutoff. Original booking remains active.',
        data: { booking_id: booking.id },
      })
      await pushInAppNotification({
        userId: booking.cleaner.userId,
        type: 'booking_request_expired',
        title: booking.proposalContext === 'amend_start' ? 'Amend Start Time expired' : 'Reschedule request expired',
        body: 'No agreement was reached before the cutoff. Original booking remains active.',
        data: { booking_id: booking.id },
      })
    }

    return {
      expired_unpaid_drafts: expiredUnpaidDraftCount,
      expired_pending: expiredPendingCount,
      expired_accepted: accepted,
      expired_reschedule_negotiations: expiredRescheduleNegotiations.length,
      cancelled_pending_intents: cancelledIntents + cancelledPendingIntents + cancelledDraftIntents,
    }
  },
}
