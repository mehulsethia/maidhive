import type Stripe from 'stripe'
import { paymentRepo } from '../repositories/payment.repo'
import { bookingRepo } from '../repositories/booking.repo'
import { notificationRepo } from '../repositories/notification.repo'
import { loopsEmailService } from './loops-email.service'
import { pushInAppNotification } from './in-app-notification.service'
import { googleCalendarService } from './google-calendar.service'
import {
  computeAcceptByFromAuthorizedAt,
  DEFAULT_BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES,
  DEFAULT_BOOKING_ACCEPT_TTL_MINUTES,
} from '../lib/booking-request-window'
import { recordBookingActionEvent } from './booking-action-event.service'

const BOOKING_ACCEPT_TTL_MINUTES = DEFAULT_BOOKING_ACCEPT_TTL_MINUTES
const BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES = DEFAULT_BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES

export const paymentAuthorizationService = {
  async syncFromPaymentIntent(pi: Stripe.PaymentIntent) {
    const payment = await paymentRepo.findByStripeIntentId(pi.id)
    if (!payment) {
      return { updated: false, reason: 'payment_not_found' as const }
    }

    if (pi.currency !== 'eur') {
      await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
      return { updated: true, reason: 'invalid_currency' as const }
    }

    if (pi.status !== 'requires_capture') {
      return { updated: false, reason: 'not_capturable' as const }
    }

    const wasAuthorized = payment.status === 'authorized'
    const authorizedAt = new Date()
    await paymentRepo.update(payment.id, { status: 'authorized', authorizedAt })

    const bookingId = pi.metadata?.booking_id
    if (!bookingId) {
      return { updated: true, reason: 'authorized_no_booking' as const }
    }

    const booking = await bookingRepo.findById(bookingId)
    if (!booking) {
      return { updated: true, reason: 'authorized_booking_not_found' as const }
    }

    if (!wasAuthorized) {
      await recordBookingActionEvent({
        bookingId: booking.id,
        type: 'payment_authorized',
        actorRole: 'system',
        metadata: { amount: Number(payment.amount), status: 'authorized' },
        createdAt: authorizedAt,
      })
    }

    if (booking.status === 'draft' || booking.status === 'pending') {
      const movedToPending =
        booking.status === 'draft' ||
        (booking.status === 'pending' && !booking.acceptedAt && !booking.confirmedAt)
      const acceptBy = computeAcceptByFromAuthorizedAt(authorizedAt, booking.scheduledStart, {
        ttlMinutes: BOOKING_ACCEPT_TTL_MINUTES,
        cutoffBeforeStartMinutes: BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES,
      })
      await bookingRepo.update(booking.id, { status: 'pending', acceptBy })

      if (!wasAuthorized) {
        await pushInAppNotification({
          userId: booking.cleaner.userId,
          type: 'booking_request',
          title: 'New Request',
          body: `You have a new request from ${booking.client.user?.name ?? 'a client'}. Status: Pending Cleaner Acceptance.`,
          data: { booking_id: booking.id },
        })

        if (movedToPending) {
          await pushInAppNotification({
            userId: booking.client.userId,
            type: 'booking_created_pending',
            title: 'Booking request created',
            body: 'Your booking request was created and sent to the cleaner.',
            data: { booking_id: booking.id },
          })
        }

        try {
          await loopsEmailService.sendCleanerNewBookingRequest({
            email: booking.cleaner.user.email,
            fullName: booking.cleaner.user.name ?? 'Cleaner',
            clientName: booking.client.user.name ?? 'Client',
            date: booking.scheduledStart,
            durationHours: Number(booking.durationHours),
            bookingId: booking.id,
          })
        } catch (emailError) {
          console.error('Failed to send cleaner new booking request email via Loops:', emailError)
        }

        if (movedToPending) {
          try {
            await loopsEmailService.sendClientBookingCreatedPending({
              email: booking.client.user.email,
              fullName: booking.client.user.name ?? 'Client',
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            })
          } catch (emailError) {
            console.error('Failed to send client booking created pending email via Loops:', emailError)
          }
        }
      }

      return { updated: true, reason: movedToPending ? 'authorized_draft_pending_notified' as const : 'authorized_pending_notified' as const }
    }

    if (booking.status === 'accepted') {
      const isReauthorisationFlow = Boolean(booking.reauthorizationRequired)
      await bookingRepo.update(booking.id, {
        status: 'confirmed',
        confirmedAt: booking.confirmedAt ?? booking.acceptedAt ?? authorizedAt,
        payBy: null,
        reauthorizationRequired: false,
        reauthorizationGraceExpiresAt: null,
      })
      void googleCalendarService.upsertCleanerBookingEvent(booking.id).catch((e) => {
        console.error('Failed to sync cleaner Google Calendar event:', e)
      })

      if (isReauthorisationFlow) {
        await recordBookingActionEvent({
          bookingId: booking.id,
          type: 'payment_reauthorisation_completed',
          actorRole: 'system',
          metadata: {
            amount: Number(payment.amount),
            status: 'authorized',
            previous_confirmed_at: booking.confirmedAt ? booking.confirmedAt.toISOString() : null,
          },
          createdAt: authorizedAt,
        })
        await notificationRepo.deleteOutstandingBookingPaymentRequired(booking.client.userId, booking.id)
        await pushInAppNotification({
          userId: booking.client.userId,
          type: 'booking_payment_reauthorisation_complete',
          title: 'Payment re-authorisation complete',
          body: 'Your payment re-authorisation has been completed successfully. Your booking remains confirmed.',
          data: { booking_id: booking.id },
        })
        try {
          await loopsEmailService.sendClientPaymentReauthorisationComplete({
            email: booking.client.user.email,
            clientName: booking.client.user.name ?? 'Client',
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            scheduledStart: booking.scheduledStart,
            durationHours: Number(booking.durationHours),
            bookingId: booking.id,
          })
        } catch (emailError) {
          console.error('Failed to send client payment re-authorisation complete email via Loops:', emailError)
        }
        return { updated: true, reason: 'reauthorisation_completed_confirmed' as const }
      }

      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_confirmed',
        title: 'Booking confirmed',
        body: 'Payment authorisation is complete and your booking is now confirmed.',
        data: { booking_id: booking.id },
      })
      try {
        await loopsEmailService.sendClientBookingConfirmed({
          email: booking.client.user.email,
          fullName: booking.client.user.name ?? 'Client',
          cleanerId: booking.cleanerId,
          cleanerName: booking.cleaner.user.name ?? 'Cleaner',
          scheduledStart: booking.scheduledStart,
          durationHours: Number(booking.durationHours),
          bookingId: booking.id,
        })
      } catch (emailError) {
        console.error('Failed to send client booking confirmed email via Loops:', emailError)
      }
      return { updated: true, reason: 'authorized_accepted_confirmed' as const }
    }

    return { updated: true, reason: 'authorized_no_transition' as const }
  },
}
