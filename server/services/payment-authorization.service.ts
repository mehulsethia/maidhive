import type Stripe from 'stripe'
import { paymentRepo } from '../repositories/payment.repo'
import { bookingRepo } from '../repositories/booking.repo'
import { loopsEmailService } from './loops-email.service'
import { pushInAppNotification } from './in-app-notification.service'
import { googleCalendarService } from './google-calendar.service'
const BOOKING_ACCEPT_TTL_MINUTES = 24 * 60

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

    if (booking.status === 'draft' || booking.status === 'pending') {
      const movedToPending =
        booking.status === 'draft' ||
        (booking.status === 'pending' && !booking.acceptedAt && !booking.confirmedAt)
      const requestWindowEndsAt = new Date(authorizedAt.getTime() + BOOKING_ACCEPT_TTL_MINUTES * 60 * 1000)
      const acceptBy = new Date(Math.min(requestWindowEndsAt.getTime(), booking.scheduledStart.getTime()))
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
      await bookingRepo.update(booking.id, {
        status: 'confirmed',
        confirmedAt: new Date(),
        payBy: null,
        reauthorizationRequired: false,
        reauthorizationGraceExpiresAt: null,
      })
      void googleCalendarService.upsertCleanerBookingEvent(booking.id).catch((e) => {
        console.error('Failed to sync cleaner Google Calendar event:', e)
      })
      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_confirmed',
        title: 'Booking confirmed',
        body: 'Payment authorization is complete and your booking is now confirmed.',
        data: { booking_id: booking.id },
      })
      try {
        await loopsEmailService.sendClientBookingConfirmed({
          email: booking.client.user.email,
          fullName: booking.client.user.name ?? 'Client',
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
