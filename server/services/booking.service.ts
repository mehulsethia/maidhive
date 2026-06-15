import { bookingRepo } from '../repositories/booking.repo'
import { cleanerRepo } from '../repositories/cleaner.repo'
import { clientRepo } from '../repositories/client.repo'
import { availabilityRepo } from '../repositories/availability.repo'
import { paymentRepo } from '../repositories/payment.repo'
import { disputeRepo } from '../repositories/dispute.repo'
import { db } from '../db'
import { loopsEmailService } from './loops-email.service'
import { pushInAppNotification } from './in-app-notification.service'
import { googleCalendarService } from './google-calendar.service'
import { stripe } from '../stripe'
import { config } from '../config'
import { calculatePriceSnapshot } from '../lib/pricing'
import { computeConfirmedCancellationPolicy, moneyFromCents } from '@/lib/cancellation-policy'
import { AMENDMENT_EXPIRED_BODY, AMENDMENT_EXPIRED_TITLE, AMENDMENT_EXPIRY_OUTCOME_COPY } from '@/lib/booking-amendment'
import type { User } from '@prisma/client'

const PLATFORM_FEE_PCT = 10
const BOOKING_ACCEPT_TTL_MINUTES = Number(process.env.BOOKING_ACCEPT_TTL_MINUTES ?? 1440)
const BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES = Number(process.env.BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES ?? 60)
const BOOKING_PAY_TTL_MINUTES = Number(process.env.BOOKING_PAY_TTL_MINUTES ?? 15)
const RESCHEDULE_CUTOFF_HOURS = 24
const MAX_BOOKING_WINDOW_DAYS = 28
const POST_CONFIRM_RESCHEDULE_WINDOW_DAYS = 14
const AMEND_WITHIN_HOURS = 24
const AMEND_MAX_SHIFT_HOURS = 3
const AMEND_FAST_RESPONSE_MINUTES = 15
const AMEND_STANDARD_RESPONSE_MINUTES = 60
const REAUTH_IMMEDIATE_THRESHOLD_HOURS = 48
const REAUTH_FAILURE_GRACE_HOURS = 24
const CLEANER_REPEAT_CANCELLATION_WINDOW_DAYS = 30
const BOOKING_PRE_BUFFER_MS = 15 * 60 * 1000
const BOOKING_POST_BUFFER_MS = 15 * 60 * 1000
const NO_SHOW_REPORT_DELAY_MINUTES = 30
const COMPLETE_JOB_EARLY_MINUTES = 5
const COMPLETE_JOB_AUTO_GRACE_MINUTES = 5
const START_JOB_EARLY_MINUTES = 15
const START_JOB_LATE_BUFFER_HOURS = 24

export const bookingService = {
  previewPrice(hourlyRate: number, durationHours: number, platformFeePct = PLATFORM_FEE_PCT) {
    return calculatePriceSnapshot(hourlyRate, durationHours, platformFeePct)
  },

  async reconcileSingleBookingDeadline(bookingId: string) {
    let booking = await bookingRepo.findById(bookingId)
    if (!booking) return null

    const nowMs = Date.now()
    const requestAcceptBy = resolveRequestAcceptBy(booking)
    const hasAuthorizedPayment = isPaymentAuthorizedStatus(booking.payment?.status)

    if (
      booking.status === 'pending' &&
      hasAuthorizedPayment &&
      requestAcceptBy &&
      requestAcceptBy.getTime() < nowMs
    ) {
      const expired = await db.booking.updateMany({
        where: { id: bookingId, status: 'pending' },
        data: {
          status: 'expired',
          ...clearedProposalState(),
        },
      })

      if (expired.count > 0) {
        await releasePaymentAuthorization(
          booking.payment?.id,
          booking.payment?.stripePaymentIntentId,
          booking.payment?.status,
        )
        await notifyPendingRequestExpired(booking)
        return bookingRepo.findById(bookingId)
      }
    }

    const proposalContext = booking.proposalContext ?? null
    const postConfirmationProposalExpired = (
      booking.status === 'accepted' || booking.status === 'confirmed'
    ) &&
      (proposalContext === 'post_confirmation' || proposalContext === 'amend_start') &&
      Boolean(booking.proposalExpiresAt) &&
      booking.proposalExpiresAt!.getTime() < nowMs

    if (postConfirmationProposalExpired) {
      const shouldPreserveRescheduleUsage = proposalContext === 'amend_start'
      const shouldPreserveAmendUsage = proposalContext === 'amend_start'
      const cleared = await db.booking.updateMany({
        where: {
          id: bookingId,
          status: { in: ['accepted', 'confirmed'] },
          proposalContext: { in: ['post_confirmation', 'amend_start'] },
          proposalExpiresAt: { lt: new Date(nowMs) },
        },
        data: clearedProposalState({
          preserveRescheduleUsage: shouldPreserveRescheduleUsage,
          preserveAmendUsage: shouldPreserveAmendUsage,
        }),
      })
      if (cleared.count > 0) {
        await notifyPostConfirmationProposalExpired(booking)
        return bookingRepo.findById(bookingId)
      }
    }

    const shouldAutoStart =
      ['accepted', 'confirmed'].includes(booking.status) &&
      !booking.startedAt &&
      hasAuthorizedPayment &&
      booking.scheduledStart.getTime() <= nowMs
    if (shouldAutoStart) {
      const started = await bookingService.startBySystem(booking.id, booking.scheduledStart)
      if (started) booking = started
    }

    const shouldAutoComplete =
      (
        booking.status === 'in_progress' ||
        (
          ['confirmed', 'disputed'].includes(booking.status) &&
          !booking.completedAt
        )
      ) &&
      booking.scheduledEnd.getTime() + COMPLETE_JOB_AUTO_GRACE_MINUTES * 60 * 1000 <= nowMs
    if (shouldAutoComplete) {
      return bookingService.completeBySystem(booking.id, booking.scheduledEnd)
    }

    const released = await maybeAutoReleaseCompletedBooking(booking)
    if (released) return released

    return booking
  },

  async reconcileDeadlinesForBookings(bookingIds: string[]) {
    const uniqueIds = Array.from(new Set(bookingIds.filter(Boolean)))
    if (uniqueIds.length === 0) return false
    let changed = false
    for (const id of uniqueIds) {
      const before = await bookingRepo.findById(id)
      if (!before) continue
      const after = await bookingService.reconcileSingleBookingDeadline(id)
      if (!after) continue
      if (
        before.status !== after.status ||
        before.payment?.status !== after.payment?.status ||
        before.payment?.transferredAt?.getTime() !== after.payment?.transferredAt?.getTime() ||
        before.proposalBy !== after.proposalBy ||
        before.proposalContext !== after.proposalContext ||
        before.proposedStart?.getTime() !== after.proposedStart?.getTime() ||
        before.proposalExpiresAt?.getTime() !== after.proposalExpiresAt?.getTime()
      ) {
        changed = true
      }
    }
    return changed
  },

  async create(user: User, data: {
    cleaner_id: string
    service_type: string
    special_instructions: string
    address: string
    city: string
    postcode: string
    country: string
    apartment_details?: string
    access_notes?: string
    scheduled_start: string
    duration_hours: number
  }) {
    const client = await clientRepo.findByUserId(user.id)
    if (!client) throw new ServiceError('Client profile not found', 404)

    const cleaner = await cleanerRepo.findById(data.cleaner_id)
    if (!cleaner) throw new ServiceError('Cleaner not found', 404)
    if (cleaner.status !== 'approved' || !cleaner.profileComplete || !cleaner.stripeOnboardingComplete) {
      throw new ServiceError('Cleaner is not available', 400)
    }

    const scheduledStart = new Date(data.scheduled_start)
    const scheduledEnd = new Date(scheduledStart.getTime() + data.duration_hours * 60 * 60 * 1000)

    await validateBookingWindow(cleaner.id, scheduledStart, scheduledEnd)

    const acceptBy = computePendingAcceptBy(Date.now(), scheduledStart)

    const pricing = bookingService.previewPrice(
      Number(cleaner.hourlyRate),
      data.duration_hours,
    )

    const requiresPickup = cleaner.transportMode === 'requires_pickup'
    const pickupSnapshot = cleaner.transportPickupLocation?.trim() ?? ''
    if (requiresPickup && !pickupSnapshot) {
      throw new ServiceError('Cleaner pickup location is not configured. Please choose another cleaner or try again later.', 400)
    }

    const specialInstructionsWithSnapshot =
      requiresPickup && !data.special_instructions.includes('Pickup location snapshot:')
        ? `${data.special_instructions}\n\nPickup location snapshot: ${pickupSnapshot}`
        : data.special_instructions

    const baseCreatePayload = {
      clientId: client.id,
      cleanerId: cleaner.id,
      serviceType: data.service_type,
      specialInstructions: specialInstructionsWithSnapshot,
      address: data.address,
      city: data.city,
      postcode: data.postcode,
      country: data.country,
      apartmentDetails: data.apartment_details,
      accessNotes: data.access_notes?.trim() ?? '',
      scheduledStart,
      scheduledEnd,
      durationHours: data.duration_hours,
      hourlyRate: pricing.hourly_rate,
      subtotal: pricing.subtotal,
      platformFeePct: pricing.platform_fee_pct,
      platformFee: pricing.platform_fee,
      cleanerPayout: pricing.cleaner_payout,
      totalAmount: pricing.total_amount,
      acceptBy,
      originalScheduledStart: scheduledStart,
    }

    const overlappingDraft = await bookingRepo.findOverlappingDraftForClient({
      clientId: client.id,
      cleanerId: cleaner.id,
      start: scheduledStart,
      end: scheduledEnd,
    })
    if (overlappingDraft) {
      return bookingRepo.update(overlappingDraft.id, {
        status: 'draft',
        serviceType: baseCreatePayload.serviceType,
        specialInstructions: baseCreatePayload.specialInstructions,
        address: baseCreatePayload.address,
        city: baseCreatePayload.city,
        postcode: baseCreatePayload.postcode,
        country: baseCreatePayload.country,
        apartmentDetails: baseCreatePayload.apartmentDetails,
        accessNotes: baseCreatePayload.accessNotes,
        scheduledStart: baseCreatePayload.scheduledStart,
        scheduledEnd: baseCreatePayload.scheduledEnd,
        durationHours: baseCreatePayload.durationHours,
        hourlyRate: baseCreatePayload.hourlyRate,
        subtotal: baseCreatePayload.subtotal,
        platformFeePct: baseCreatePayload.platformFeePct,
        platformFee: baseCreatePayload.platformFee,
        cleanerPayout: baseCreatePayload.cleanerPayout,
        totalAmount: baseCreatePayload.totalAmount,
        acceptBy: baseCreatePayload.acceptBy,
      })
    }

    return bookingRepo.create({
      ...baseCreatePayload,
      status: 'draft',
    })
  },

  async applyAction(
    bookingId: string,
    user: User,
    payload: {
      action:
        | 'accept'
        | 'decline'
        | 'start'
        | 'propose_alternative'
        | 'counter_proposal'
        | 'accept_proposal'
        | 'decline_proposal'
        | 'amend_start_time'
      proposed_start?: string
      start_location?: {
        latitude: number
        longitude: number
        accuracy_m?: number
      }
    },
  ) {
    let booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const cleaner = await cleanerRepo.findByUserId(user.id)
    const client = await clientRepo.findByUserId(user.id)
    const isCleaner = Boolean(cleaner && booking.cleanerId === cleaner.id)
    const isClient = Boolean(client && booking.clientId === client.id)
    if (!isCleaner && !isClient) throw new ServiceError('Forbidden', 403)

    const reconciled = await bookingService.reconcileSingleBookingDeadline(bookingId)
    if (reconciled) booking = reconciled

    const action = payload.action
    const requestAcceptBy = resolveRequestAcceptBy(booking)

    if (action === 'start') {
      if (!isCleaner) throw new ServiceError('Only cleaner can start a booking', 403)
      if (!['accepted', 'confirmed'].includes(booking.status)) {
        throw new ServiceError(`Cannot start a booking in status '${booking.status}'`, 400)
      }
      assertPaymentAuthorized(booking.payment?.status, 'start')
      const startUnlockAtMs = new Date(booking.scheduledStart).getTime() - START_JOB_EARLY_MINUTES * 60 * 1000
      if (!Number.isFinite(startUnlockAtMs) || Date.now() < startUnlockAtMs) {
        throw new ServiceError('You can only start this job 15 minutes before the scheduled time.', 400)
      }
      const startWindowClosesAtMs = new Date(booking.scheduledEnd).getTime() + START_JOB_LATE_BUFFER_HOURS * 60 * 60 * 1000
      if (!Number.isFinite(startWindowClosesAtMs) || Date.now() > startWindowClosesAtMs) {
        throw new ServiceError('Start Job is unavailable more than 24 hours after scheduled end time.', 400)
      }
      return startBookingFlow(bookingId, { initiatedBy: 'cleaner', startedAt: new Date() })
    }

    if (action === 'accept') {
      if (!isCleaner) throw new ServiceError('Only cleaner can accept a booking', 403)
      assertCleanerStripeReady(cleaner)
      if (booking.status !== 'pending') {
        throw new ServiceError(`Cannot accept a booking in status '${booking.status}'`, 400)
      }
      assertWithinRequestWindow(requestAcceptBy)
      const isPaymentAuthorized = ['authorized', 'captured', 'transferred'].includes(String(booking.payment?.status ?? ''))
      const now = new Date()
      const updated = await bookingRepo.update(bookingId, {
        status: isPaymentAuthorized ? 'confirmed' : 'accepted',
        acceptedAt: now,
        confirmedAt: isPaymentAuthorized ? now : null,
        payBy: null,
        ...clearedProposalState(),
      })
      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_accepted',
        title: 'Booking accepted',
        body: 'Cleaner accepted your booking request.',
        data: { booking_id: bookingId },
      })
      try {
        await loopsEmailService.sendCleanerBookingAcceptedConfirmation({
          email: booking.cleaner.user.email,
          fullName: booking.cleaner.user.name ?? 'Cleaner',
          bookingId: booking.id,
        })
      } catch (emailError) {
        console.error('Failed to send cleaner booking accepted confirmation email via Loops:', emailError)
      }
      if (isPaymentAuthorized) {
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
          console.error('Failed to send client booking accepted confirmation email via Loops:', emailError)
        }
      }
      void googleCalendarService.upsertCleanerBookingEvent(updated.id).catch((e) => {
        console.error('Failed to sync cleaner Google Calendar event:', e)
      })
      return updated
    }

    if (action === 'decline') {
      if (!isCleaner) throw new ServiceError('Only cleaner can decline a booking request', 403)
      if (booking.status !== 'pending') {
        throw new ServiceError(`Cannot decline a booking in status '${booking.status}'`, 400)
      }

      const updated = await bookingRepo.update(bookingId, {
        status: 'declined',
        ...clearedProposalState(),
      })
      await releasePaymentAuthorization(
        booking.payment?.id,
        booking.payment?.stripePaymentIntentId,
        booking.payment?.status,
      )
      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_request_declined',
        title: 'Booking request declined',
        body: 'Cleaner declined this booking request.',
        data: { booking_id: bookingId },
      })
      void googleCalendarService.removeCleanerBookingEvent(updated.id).catch((e) => {
        console.error('Failed to remove cleaner Google Calendar event:', e)
      })
      try {
        await loopsEmailService.sendClientBookingRejectedOrExpired({
          email: booking.client.user.email,
          fullName: booking.client.user.name ?? 'Client',
          cleanerName: booking.cleaner.user.name ?? 'Cleaner',
        })
      } catch (emailError) {
        console.error('Failed to send client booking declined email via Loops:', emailError)
      }
      return updated
    }

    if (action === 'propose_alternative') {
      if (!isCleaner && !isClient) throw new ServiceError('Forbidden', 403)

      const isPreConfirmation = booking.status === 'pending'
      const isPostConfirmation = ['accepted', 'confirmed'].includes(booking.status)
      if (!isPreConfirmation && !isPostConfirmation) {
        throw new ServiceError(`Cannot propose a new time in status '${booking.status}'`, 400)
      }

      const actor = isCleaner ? 'cleaner' : 'client'
      const proposedStart = parseProposedStart(payload.proposed_start)
      assertHalfHourBoundary(proposedStart)
      if (proposedStart.getTime() === booking.scheduledStart.getTime()) {
        throw new ServiceError('Proposed time must be different from current booking time', 400)
      }
      const proposedEnd = new Date(proposedStart.getTime() + Number(booking.durationHours) * 60 * 60 * 1000)
      await validateBookingWindow(
        booking.cleanerId,
        proposedStart,
        proposedEnd,
        { enforceMaxAdvanceWindow: isPreConfirmation },
      )

      if (isPreConfirmation) {
        assertWithinRequestWindow(requestAcceptBy)
        assertRescheduleWindow(booking.scheduledStart)
        if (booking.proposalBy) {
          throw new ServiceError('A proposal is already active for this booking', 400)
        }
        if (actor === 'cleaner' && booking.cleanerProposals >= 1) {
          throw new ServiceError('Cleaner can only propose an alternative time once', 400)
        }
        if (actor === 'client' && booking.clientProposals >= 1) {
          throw new ServiceError('Client can only propose an alternative time once', 400)
        }

        const updated = await bookingRepo.update(bookingId, {
          proposedStart,
          proposedEnd,
          proposalBy: actor,
          proposalContext: 'pre_confirmation',
          proposalExpiresAt: requestAcceptBy,
          cleanerProposals: actor === 'cleaner' ? { increment: 1 } : undefined,
          clientProposals: actor === 'client' ? { increment: 1 } : undefined,
        })
        await pushInAppNotification({
          userId: actor === 'cleaner' ? booking.client.userId : booking.cleaner.userId,
          type: 'booking_proposed_new_time',
          title: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} proposed a new time`,
          body: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} requested ${formatBookingTimeForMessage(proposedStart)} (original ${formatBookingTimeForMessage(booking.scheduledStart)}). Review and respond before request expiry.`,
          data: { booking_id: bookingId },
        })
        try {
          if (actor === 'cleaner') {
            await loopsEmailService.sendClientAlternateTimeProposed({
              email: booking.client.user.email,
              clientName: booking.client.user.name ?? 'Client',
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
              originalStart: booking.scheduledStart,
              proposedStart,
            })
          } else {
            await loopsEmailService.sendCleanerClientAlternateTimeProposed({
              email: booking.cleaner.user.email,
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
              clientName: booking.client.user.name ?? 'Client',
              originalStart: booking.scheduledStart,
              proposedStart,
            })
          }
        } catch (emailError) {
          console.error('Failed to send alternate-time proposal email via Loops:', emailError)
        }
        return updated
      }

      assertPostConfirmationRescheduleNotUsed(booking)
      assertPostConfirmationRescheduleWindow(booking.scheduledStart)
      const originalStart = booking.originalScheduledStart ?? booking.scheduledStart
      assertPostConfirmationDateLimit(originalStart, proposedStart)
      if (booking.proposalBy) {
        throw new ServiceError('A proposal is already active for this booking', 400)
      }
      if (actor === 'cleaner' && booking.postCleanerProposals >= 1) {
        throw new ServiceError('Cleaner can only make one counter-proposal in post-confirmation rescheduling', 400)
      }
      if (actor === 'client' && booking.postClientProposals >= 1) {
        throw new ServiceError('Client can only make one counter-proposal in post-confirmation rescheduling', 400)
      }

      const proposalExpiresAt = new Date(booking.scheduledStart.getTime() - RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1000)
      const updated = await bookingRepo.update(bookingId, {
        proposedStart,
        proposedEnd,
        proposalBy: actor,
        proposalContext: 'post_confirmation',
        proposalExpiresAt,
        postCleanerProposals: actor === 'cleaner' ? { increment: 1 } : undefined,
        postClientProposals: actor === 'client' ? { increment: 1 } : undefined,
      })
      await pushInAppNotification({
        userId: actor === 'cleaner' ? booking.client.userId : booking.cleaner.userId,
        type: 'booking_proposed_new_time',
        title: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} proposed a reschedule`,
        body: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} requested ${formatBookingTimeForMessage(proposedStart)} (original ${formatBookingTimeForMessage(booking.scheduledStart)}). Accept, decline, or counter once before cutoff.`,
        data: { booking_id: bookingId },
      })
      try {
        if (actor === 'cleaner') {
          await loopsEmailService.sendClientAlternateTimeProposed({
            email: booking.client.user.email,
            clientName: booking.client.user.name ?? 'Client',
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            originalStart: booking.scheduledStart,
            proposedStart,
          })
        } else {
          await loopsEmailService.sendCleanerClientAlternateTimeProposed({
            email: booking.cleaner.user.email,
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            clientName: booking.client.user.name ?? 'Client',
            originalStart: booking.scheduledStart,
            proposedStart,
          })
        }
      } catch (emailError) {
        console.error('Failed to send post-confirmation reschedule proposal email via Loops:', emailError)
      }
      return updated
    }

    if (action === 'counter_proposal') {
      if (!isCleaner && !isClient) throw new ServiceError('Forbidden', 403)
      const actor = isCleaner ? 'cleaner' : 'client'
      if (!['pending', 'accepted', 'confirmed'].includes(booking.status)) {
        throw new ServiceError(`Cannot counter a proposal in status '${booking.status}'`, 400)
      }
      if (!booking.proposalBy || !booking.proposedStart || !booking.proposedEnd) {
        throw new ServiceError('No active proposal available to counter', 400)
      }
      if (booking.proposalBy === actor) {
        throw new ServiceError('You cannot counter your own proposal', 400)
      }

      const proposedStart = parseProposedStart(payload.proposed_start)
      assertHalfHourBoundary(proposedStart)
      const proposedEnd = new Date(proposedStart.getTime() + Number(booking.durationHours) * 60 * 60 * 1000)
      const isPreConfirmation = booking.status === 'pending' && booking.proposalContext !== 'post_confirmation'
      await validateBookingWindow(
        booking.cleanerId,
        proposedStart,
        proposedEnd,
        { enforceMaxAdvanceWindow: isPreConfirmation },
      )

      if (isPreConfirmation) {
        assertWithinRequestWindow(requestAcceptBy)
        assertRescheduleWindow(booking.scheduledStart)
        if (actor === 'client' && booking.clientProposals >= 1) {
          throw new ServiceError('Client can only counter once', 400)
        }
        if (actor === 'cleaner' && booking.cleanerProposals >= 1) {
          throw new ServiceError('Cleaner can only counter once', 400)
        }

        const updated = await bookingRepo.update(bookingId, {
          proposedStart,
          proposedEnd,
          proposalBy: actor,
          proposalContext: 'pre_confirmation',
          proposalExpiresAt: requestAcceptBy,
          cleanerProposals: actor === 'cleaner' ? { increment: 1 } : undefined,
          clientProposals: actor === 'client' ? { increment: 1 } : undefined,
        })
        await pushInAppNotification({
          userId: actor === 'cleaner' ? booking.client.userId : booking.cleaner.userId,
          type: 'booking_counter_proposal',
          title: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} sent a counter-offer`,
          body: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} proposed ${formatBookingTimeForMessage(proposedStart)} (original ${formatBookingTimeForMessage(booking.scheduledStart)}). Accept, decline, or counter once before expiry.`,
          data: { booking_id: bookingId },
        })
        try {
          if (actor === 'cleaner') {
            await loopsEmailService.sendClientAlternateTimeProposed({
              email: booking.client.user.email,
              clientName: booking.client.user.name ?? 'Client',
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
              originalStart: booking.scheduledStart,
              proposedStart,
            })
          } else {
            await loopsEmailService.sendCleanerClientAlternateTimeProposed({
              email: booking.cleaner.user.email,
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
              clientName: booking.client.user.name ?? 'Client',
              originalStart: booking.scheduledStart,
              proposedStart,
            })
          }
        } catch (emailError) {
          console.error('Failed to send alternate-time counter-proposal email via Loops:', emailError)
        }
        return updated
      }

      const isAmendRequest = booking.proposalContext === 'amend_start'
      if (isAmendRequest) {
        throw new ServiceError('Counter-offers are not allowed for Amend Start Time. Accept or decline this amendment request.', 400)
      }

      assertPostConfirmationRescheduleNotUsed(booking)
      assertPostConfirmationRescheduleWindow(booking.scheduledStart)
      const originalStart = booking.originalScheduledStart ?? booking.scheduledStart
      assertPostConfirmationDateLimit(originalStart, proposedStart)
      if (actor === 'client' && booking.postClientProposals >= 1) {
        throw new ServiceError('Client has already used the single allowed counter-proposal', 400)
      }
      if (actor === 'cleaner' && booking.postCleanerProposals >= 1) {
        throw new ServiceError('Cleaner has already used the single allowed counter-proposal', 400)
      }
      const proposalExpiresAt = booking.proposalExpiresAt ??
        new Date(booking.scheduledStart.getTime() - RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1000)

      const updated = await bookingRepo.update(bookingId, {
        proposedStart,
        proposedEnd,
        proposalBy: actor,
        proposalContext: 'post_confirmation',
        proposalExpiresAt,
        postCleanerProposals: actor === 'cleaner' ? { increment: 1 } : undefined,
        postClientProposals: actor === 'client' ? { increment: 1 } : undefined,
      })
      await pushInAppNotification({
        userId: actor === 'cleaner' ? booking.client.userId : booking.cleaner.userId,
        type: 'booking_counter_proposal',
        title: 'Reschedule counter-offer received',
        body: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} proposed ${formatBookingTimeForMessage(proposedStart)} (original ${formatBookingTimeForMessage(booking.scheduledStart)}).`,
        data: { booking_id: bookingId },
      })
      try {
        if (actor === 'cleaner') {
          await loopsEmailService.sendClientAlternateTimeProposed({
            email: booking.client.user.email,
            clientName: booking.client.user.name ?? 'Client',
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            originalStart: booking.scheduledStart,
            proposedStart,
          })
        } else {
          await loopsEmailService.sendCleanerClientAlternateTimeProposed({
            email: booking.cleaner.user.email,
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            clientName: booking.client.user.name ?? 'Client',
            originalStart: booking.scheduledStart,
            proposedStart,
          })
        }
      } catch (emailError) {
        console.error('Failed to send post-confirmation reschedule counter email via Loops:', emailError)
      }
      return updated
    }

    if (action === 'accept_proposal') {
      if (!['pending', 'accepted', 'confirmed'].includes(booking.status)) {
        throw new ServiceError(`Cannot accept a proposal in status '${booking.status}'`, 400)
      }
      if (!booking.proposedStart || !booking.proposedEnd || !booking.proposalBy) {
        throw new ServiceError('No proposal available to accept', 400)
      }
      const proposalContext = booking.proposalContext ?? (booking.status === 'pending' ? 'pre_confirmation' : 'post_confirmation')

      if (booking.proposalBy === 'cleaner' && !isClient) {
        throw new ServiceError('Only client can accept cleaner proposal', 403)
      }
      if (booking.proposalBy === 'client' && !isCleaner) {
        throw new ServiceError('Only cleaner can accept client proposal', 403)
      }
      if (booking.proposalBy === 'client') {
        assertCleanerStripeReady(cleaner)
      }

      if (proposalContext === 'pre_confirmation') {
        assertWithinRequestWindow(requestAcceptBy)
        const isPaymentAuthorized = ['authorized', 'captured', 'transferred'].includes(String(booking.payment?.status ?? ''))
        const now = new Date()
        const updated = await bookingRepo.update(bookingId, {
          status: isPaymentAuthorized ? 'confirmed' : 'accepted',
          scheduledStart: booking.proposedStart,
          scheduledEnd: booking.proposedEnd,
          acceptedAt: now,
          confirmedAt: isPaymentAuthorized ? now : null,
          payBy: null,
          ...clearedProposalState(),
        })
        await pushInAppNotification({
          userId: isClient ? booking.cleaner.userId : booking.client.userId,
          type: 'booking_time_agreed',
          title: 'Booking time confirmed',
          body: 'The proposed booking time has been accepted and confirmed.',
          data: { booking_id: bookingId },
        })
        try {
          await loopsEmailService.sendCleanerBookingAcceptedConfirmation({
            email: booking.cleaner.user.email,
            fullName: booking.cleaner.user.name ?? 'Cleaner',
            bookingId: booking.id,
          })
        } catch (emailError) {
          console.error('Failed to send cleaner accepted confirmation email via Loops:', emailError)
        }
        try {
          if (isPaymentAuthorized) {
            await loopsEmailService.sendClientBookingConfirmed({
              email: booking.client.user.email,
              fullName: booking.client.user.name ?? 'Client',
              cleanerId: booking.cleanerId,
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
              scheduledStart: booking.proposedStart,
              durationHours: Number(booking.durationHours),
              bookingId: booking.id,
            })
          } else {
            await loopsEmailService.sendClientBookingCreatedPending({
              email: booking.client.user.email,
              fullName: booking.client.user.name ?? 'Client',
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            })
          }
        } catch (emailError) {
          console.error('Failed to send client proposal-accepted email via Loops:', emailError)
        }
        void googleCalendarService.upsertCleanerBookingEvent(updated.id).catch((e) => {
          console.error('Failed to sync cleaner Google Calendar event:', e)
        })
        return updated
      }

      if (proposalContext === 'amend_start') {
        assertAmendRequestStillValid(booking)
        const updated = await bookingRepo.update(bookingId, {
          scheduledStart: booking.proposedStart,
          scheduledEnd: booking.proposedEnd,
          ...clearedProposalState({ preserveRescheduleUsage: true, preserveAmendUsage: true }),
          cleanerProposals: 1,
          clientProposals: 1,
        })
        const acceptanceBody = `The booking start time has been updated to ${formatBookingTimeForMessage(booking.proposedStart)}.`
        await pushInAppNotification({
          userId: booking.client.userId,
          type: 'booking_time_agreed',
          title: 'Start time amended',
          body: acceptanceBody,
          data: { booking_id: bookingId },
        })
        await pushInAppNotification({
          userId: booking.cleaner.userId,
          type: 'booking_time_agreed',
          title: 'Start time amended',
          body: acceptanceBody,
          data: { booking_id: bookingId },
        })
        try {
          await loopsEmailService.sendAmendmentRequestAccepted({
            email: booking.cleaner.user.email,
            fullName: booking.cleaner.user.name ?? 'Cleaner',
            originalStart: booking.scheduledStart,
            newStart: booking.proposedStart,
          })
        } catch (emailError) {
          console.error('Failed to send cleaner amended-time acceptance email via Loops:', emailError)
        }
        try {
          await loopsEmailService.sendAmendmentRequestAccepted({
            email: booking.client.user.email,
            fullName: booking.client.user.name ?? 'Client',
            originalStart: booking.scheduledStart,
            newStart: booking.proposedStart,
          })
        } catch (emailError) {
          console.error('Failed to send client amended-time acceptance email via Loops:', emailError)
        }
        void googleCalendarService.upsertCleanerBookingEvent(updated.id).catch((e) => {
          console.error('Failed to sync cleaner Google Calendar event:', e)
        })
        return updated
      }

      assertPostConfirmationRescheduleWindow(booking.scheduledStart)
      assertPostConfirmationProposalOpen(booking.proposalExpiresAt)
      const updated = await bookingRepo.update(bookingId, {
        scheduledStart: booking.proposedStart,
        scheduledEnd: booking.proposedEnd,
        ...clearedProposalState(),
        ...appliedRescheduleUsageMarker(),
      })
      await resetAuthorizationAfterReschedule(updated.id)
      await pushInAppNotification({
        userId: isClient ? booking.cleaner.userId : booking.client.userId,
        type: 'booking_time_agreed',
        title: 'Reschedule accepted',
        body: 'Booking time updated. Client re-authorization is now required.',
        data: { booking_id: bookingId },
      })
      try {
        await loopsEmailService.sendCleanerBookingAcceptedConfirmation({
          email: booking.cleaner.user.email,
          fullName: booking.cleaner.user.name ?? 'Cleaner',
          bookingId: booking.id,
        })
      } catch (emailError) {
        console.error('Failed to send cleaner reschedule accepted email via Loops:', emailError)
      }
      try {
        await loopsEmailService.sendClientBookingCreatedPending({
          email: booking.client.user.email,
          fullName: booking.client.user.name ?? 'Client',
          cleanerName: booking.cleaner.user.name ?? 'Cleaner',
        })
      } catch (emailError) {
        console.error('Failed to send client reschedule accepted email via Loops:', emailError)
      }
      const refreshed = await bookingRepo.findById(updated.id)
      if (!refreshed) throw new ServiceError('Booking not found after reschedule update', 404)
      return refreshed
    }

    if (action === 'decline_proposal') {
      if (!['pending', 'accepted', 'confirmed'].includes(booking.status)) {
        throw new ServiceError(`Cannot decline a proposal in status '${booking.status}'`, 400)
      }
      if (!booking.proposalBy) throw new ServiceError('No active proposal to decline', 400)
      if (booking.proposalBy === 'cleaner' && !isClient) {
        throw new ServiceError('Only client can decline cleaner proposal', 403)
      }
      if (booking.proposalBy === 'client' && !isCleaner) {
        throw new ServiceError('Only cleaner can decline client proposal', 403)
      }

      const proposalContext = booking.proposalContext ?? (booking.status === 'pending' ? 'pre_confirmation' : 'post_confirmation')
      if (proposalContext === 'pre_confirmation') {
        const declinedByClientFromCleanerProposal = isClient && booking.proposalBy === 'cleaner'
        const proposedStartLabel = (booking.proposedStart ?? booking.scheduledStart).toLocaleString('en-IE', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Nicosia',
        })
        const updated = await bookingRepo.update(bookingId, {
          status: 'declined',
          ...clearedProposalState(),
        })
        await releasePaymentAuthorization(booking.payment?.id, booking.payment?.stripePaymentIntentId, booking.payment?.status)
        await pushInAppNotification({
          userId: isClient ? booking.cleaner.userId : booking.client.userId,
          type: 'booking_request_declined',
          title: declinedByClientFromCleanerProposal ? 'Client declined your proposed time' : 'Booking request declined',
          body: declinedByClientFromCleanerProposal
            ? `Client declined your proposed time for ${proposedStartLabel}. The booking request has been closed.`
            : 'This booking request was declined.',
          data: { booking_id: bookingId },
        })
        try {
          if (declinedByClientFromCleanerProposal) {
            await loopsEmailService.sendClientProposalDeclinedClosed({
              email: booking.client.user.email,
              clientName: booking.client.user.name ?? 'Client',
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            })
            await loopsEmailService.sendCleanerClientDeclinedProposal({
              email: booking.cleaner.user.email,
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
              clientName: booking.client.user.name ?? 'Client',
              proposedStart: booking.proposedStart ?? booking.scheduledStart,
            })
          } else {
            await loopsEmailService.sendClientBookingRejectedOrExpired({
              email: booking.client.user.email,
              fullName: booking.client.user.name ?? 'Client',
              cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            })
          }
        } catch (emailError) {
          console.error('Failed to send client proposal-declined email via Loops:', emailError)
        }
        void googleCalendarService.removeCleanerBookingEvent(updated.id).catch((e) => {
          console.error('Failed to remove cleaner Google Calendar event:', e)
        })
        return updated
      }

      const updated = await bookingRepo.update(bookingId, {
        ...clearedProposalState({
          preserveRescheduleUsage: proposalContext === 'amend_start',
          preserveAmendUsage: proposalContext === 'amend_start',
        }),
      })
      await pushInAppNotification({
        userId: isClient ? booking.cleaner.userId : booking.client.userId,
        type: 'booking_request_declined',
        title: proposalContext === 'amend_start' ? 'Amendment declined' : 'Reschedule declined',
        body: proposalContext === 'amend_start'
          ? 'Start-time amendment was declined. Original schedule remains active.'
          : 'Reschedule request was declined. Original booking remains active.',
        data: { booking_id: bookingId },
      })
      try {
        if (proposalContext === 'amend_start') {
          const amendmentRequester = booking.proposalBy === 'cleaner' ? booking.cleaner.user : booking.client.user
          await loopsEmailService.sendAmendmentRequestDeclined({
            email: amendmentRequester.email,
            fullName: amendmentRequester.name ?? (booking.proposalBy === 'cleaner' ? 'Cleaner' : 'Client'),
            originalStart: booking.scheduledStart,
          })
        } else {
          await loopsEmailService.sendClientBookingRejectedOrExpired({
            email: booking.client.user.email,
            fullName: booking.client.user.name ?? 'Client',
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
          })
        }
      } catch (emailError) {
        console.error('Failed to send schedule request declined email via Loops:', emailError)
      }
      return updated
    }

    if (action === 'amend_start_time') {
      if (!isClient && !isCleaner) throw new ServiceError('Forbidden', 403)
      if (!['accepted', 'confirmed'].includes(booking.status)) {
        throw new ServiceError(`Cannot amend start time in status '${booking.status}'`, 400)
      }
      if (booking.proposalBy) {
        throw new ServiceError('Another proposal is already active for this booking', 400)
      }
      const actor = isCleaner ? 'cleaner' : 'client'
      if (booking.cleanerProposals >= 1 && booking.clientProposals >= 1) {
        throw new ServiceError('Amend Start Time has already been finalised for this booking. No further amendments are allowed in MVP.', 400)
      }
      if (actor === 'cleaner' && booking.cleanerProposals >= 1) {
        throw new ServiceError('Cleaner has already used the single Amend Start Time request for this booking.', 400)
      }
      if (actor === 'client' && booking.clientProposals >= 1) {
        throw new ServiceError('Client has already used the single Amend Start Time request for this booking.', 400)
      }
      const proposedStart = parseProposedStart(payload.proposed_start)
      assertHalfHourBoundary(proposedStart)
      assertAmendWindow(booking.scheduledStart, proposedStart)
      const proposedEnd = new Date(proposedStart.getTime() + Number(booking.durationHours) * 60 * 60 * 1000)
      await validateBookingWindow(
        booking.cleanerId,
        proposedStart,
        proposedEnd,
        {
          enforceMaxAdvanceWindow: false,
          excludeBookingId: booking.id,
          skipMinLeadTime: true,
        },
      )

      const hoursUntilBooking = (booking.scheduledStart.getTime() - Date.now()) / (60 * 60 * 1000)
      const ttlMinutes = hoursUntilBooking < 2 ? AMEND_FAST_RESPONSE_MINUTES : AMEND_STANDARD_RESPONSE_MINUTES
      const proposalExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
      const updated = await bookingRepo.update(bookingId, {
        proposedStart,
        proposedEnd,
        proposalBy: actor,
        proposalContext: 'amend_start',
        proposalExpiresAt,
        cleanerProposals: actor === 'cleaner' ? { increment: 1 } : undefined,
        clientProposals: actor === 'client' ? { increment: 1 } : undefined,
      })
      await pushInAppNotification({
        userId: actor === 'cleaner' ? booking.client.userId : booking.cleaner.userId,
        type: 'booking_proposed_new_time',
        title: 'Start time amendment requested',
        body: `${actor === 'cleaner' ? 'Cleaner' : 'Client'} proposed ${formatBookingTimeForMessage(proposedStart)} (original ${formatBookingTimeForMessage(booking.scheduledStart)}). Respond within ${ttlMinutes} minutes. ${AMENDMENT_EXPIRY_OUTCOME_COPY}`,
        data: { booking_id: bookingId },
      })
      try {
        if (actor === 'cleaner') {
          await loopsEmailService.sendClientAlternateTimeProposed({
            email: booking.client.user.email,
            clientName: booking.client.user.name ?? 'Client',
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            originalStart: booking.scheduledStart,
            proposedStart,
            requestType: 'Amend Start Time request',
            expiryOutcome: AMENDMENT_EXPIRY_OUTCOME_COPY,
          })
        } else {
          await loopsEmailService.sendCleanerClientAlternateTimeProposed({
            email: booking.cleaner.user.email,
            cleanerName: booking.cleaner.user.name ?? 'Cleaner',
            clientName: booking.client.user.name ?? 'Client',
            originalStart: booking.scheduledStart,
            proposedStart,
            requestType: 'Amend Start Time request',
            expiryOutcome: AMENDMENT_EXPIRY_OUTCOME_COPY,
          })
        }
      } catch (emailError) {
        console.error('Failed to send amend request email via Loops:', emailError)
      }
      return updated
    }

    throw new ServiceError('Unsupported booking action', 400)
  },

  async completeByCleaner(bookingId: string, user: User) {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const cleaner = await cleanerRepo.findByUserId(user.id)
    if (!cleaner || booking.cleanerId !== cleaner.id) {
      throw new ServiceError('Only assigned cleaner can complete this booking', 403)
    }

    if (!['in_progress', 'disputed'].includes(booking.status)) {
      throw new ServiceError(`Cannot complete a booking in status '${booking.status}'`, 400)
    }

    assertCompletionWindow(booking.scheduledEnd)
    return completeBookingFlow(bookingId, {
      completedAt: new Date(),
      initiatedByUserId: user.id,
      initiatedByRole: 'cleaner',
    })
  },

  async completeBySystem(bookingId: string, completedAt: Date) {
    return completeBookingFlow(bookingId, {
      completedAt,
      initiatedByRole: 'system',
    })
  },

  async startBySystem(bookingId: string, startedAt = new Date()) {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) return null
    if (!['accepted', 'confirmed'].includes(booking.status)) return booking
    if (booking.startedAt) return booking
    if (!isPaymentAuthorizedStatus(booking.payment?.status)) return booking

    const startWindowClosesAtMs =
      new Date(booking.scheduledEnd).getTime() + START_JOB_LATE_BUFFER_HOURS * 60 * 60 * 1000
    if (!Number.isFinite(startWindowClosesAtMs) || Date.now() > startWindowClosesAtMs) {
      return booking
    }

    return startBookingFlow(bookingId, {
      initiatedBy: 'system',
      startedAt,
    })
  },

  async cancel(bookingId: string, user: User, reason?: string) {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const cancellableStatuses = ['draft', 'pending', 'accepted', 'confirmed']
    if (!cancellableStatuses.includes(booking.status)) {
      throw new ServiceError(`Cannot cancel a booking in status '${booking.status}'`, 400)
    }

    // Verify user is a party on this booking
    const client = await clientRepo.findByUserId(user.id)
    const cleaner = await cleanerRepo.findByUserId(user.id)
    const isParty =
      (client && booking.clientId === client.id) ||
      (cleaner && booking.cleanerId === cleaner.id)

    if (!isParty && user.role !== 'admin') throw new ServiceError('Forbidden', 403)

    try {
      await applyCancellationPaymentPolicy(booking, booking.status)
    } catch (error) {
      console.error('booking.cancel.payment_policy failed; proceeding with cancellation fallback', {
        bookingId,
        status: booking.status,
        paymentStatus: booking.payment?.status,
        message: error instanceof Error ? error.message : String(error),
      })
      try {
        await releasePaymentAuthorization(
          booking.payment?.id,
          booking.payment?.stripePaymentIntentId,
          booking.payment?.status,
        )
      } catch (releaseError) {
        console.error('booking.cancel.release_authorization_fallback failed; proceeding with cancellation anyway', {
          bookingId,
          paymentId: booking.payment?.id,
          paymentStatus: booking.payment?.status,
          message: releaseError instanceof Error ? releaseError.message : String(releaseError),
        })
      }
    }

      const updated = await bookingRepo.update(bookingId, {
        status: 'cancelled',
      cancellationReason: reason,
      cancelledByUser: { connect: { id: user.id } },
      cancelledAt: new Date(),
    })

    if (cleaner && booking.cleanerId === cleaner.id) {
      await maybeApplyCleanerCancellationStrike({
        booking,
        cleanerId: cleaner.id,
        cancelledByUserId: user.id,
        cancellationReason: reason,
      })
    }

    const cleanerUserId = booking.cleaner?.userId ?? null
    const cleanerEmail = booking.cleaner?.user?.email ?? null
    const cleanerName = booking.cleaner?.user?.name ?? 'Cleaner'
    const clientUserId = booking.client?.userId ?? null
    const clientEmail = booking.client?.user?.email ?? null
    const clientName = booking.client?.user?.name ?? 'Client'
    const isClientCancelling = Boolean(client && booking.clientId === client.id)
    const isPendingRequestCancellation = booking.status === 'pending'
    const isConfirmedBookingCancellation = booking.status === 'confirmed'
    const isAcceptedOrConfirmedCancellation = booking.status === 'accepted' || booking.status === 'confirmed'
    const scheduledStartLabel = formatBookingTimeForMessage(booking.scheduledStart)
    const isDraftLikePreAuthorisation =
      isClientCancelling &&
      (booking.status === 'draft' || (booking.status === 'pending' && !isPaymentAuthorizedStatus(booking.payment?.status)))

    if (!isDraftLikePreAuthorisation) {
      const notifyUserId =
        client && booking.clientId === client.id
          ? cleanerUserId
          : clientUserId

      if (notifyUserId) {
        await pushInAppNotification({
          userId: notifyUserId,
          type: 'booking_cancelled',
          title: isClientCancelling
            ? isPendingRequestCancellation
              ? 'Client cancelled booking request'
              : 'Client cancelled booking'
            : 'Booking cancelled',
          body: isClientCancelling
            ? isPendingRequestCancellation
              ? 'The client cancelled this booking request before confirmation.'
              : isConfirmedBookingCancellation
                ? `The client cancelled a confirmed booking scheduled for ${scheduledStartLabel}.`
                : `The client cancelled a booking scheduled for ${scheduledStartLabel}.`
            : 'A booking has been cancelled',
          data: { booking_id: bookingId },
        })
      }
      void googleCalendarService.removeCleanerBookingEvent(updated.id).catch((e) => {
        console.error('Failed to remove cleaner Google Calendar event:', e)
      })
    }

    if (isClientCancelling && isAcceptedOrConfirmedCancellation && clientUserId) {
      await pushInAppNotification({
        userId: clientUserId,
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        body: `Your booking scheduled for ${scheduledStartLabel} has been cancelled.`,
        data: { booking_id: bookingId },
      })
    }

    if (!isDraftLikePreAuthorisation) {
      try {
        if (!clientEmail) throw new Error('Missing client email for cancellation confirmation')
        await loopsEmailService.sendClientCancellationConfirmation({
          email: clientEmail,
          fullName: clientName,
          date: booking.scheduledStart,
          cleanerName,
          durationHours: Number(booking.durationHours),
        })
      } catch (emailError) {
        console.error('Failed to send client cancellation confirmation email via Loops:', emailError)
      }
    }

    if (isClientCancelling && isAcceptedOrConfirmedCancellation) {
      try {
        if (!cleanerEmail) throw new Error('Missing cleaner email for cancellation confirmation')
        await loopsEmailService.sendCleanerBookingCancelledByClient({
          email: cleanerEmail,
          fullName: cleanerName,
          clientName,
          date: booking.scheduledStart,
          durationHours: Number(booking.durationHours),
          bookingId: booking.id,
          cancellationReason: reason,
        })
      } catch (emailError) {
        console.error('Failed to send cleaner cancellation-by-client email via Loops:', emailError)
      }
    }

    if (cleaner && booking.cleanerId === cleaner.id) {
      try {
        if (!cleanerEmail) throw new Error('Missing cleaner email for strike warning')
        await loopsEmailService.sendCleanerCancellationWarningOrStrike({
          email: cleanerEmail,
          fullName: cleanerName,
        })
      } catch (emailError) {
        console.error('Failed to send cleaner cancellation warning/strike email via Loops:', emailError)
      }
    }

    return updated
  },
}

export class ServiceError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function isPaymentAuthorizedStatus(status?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(status ?? ''))
}

function parseProposedStart(proposedStart?: string) {
  if (!proposedStart) {
    throw new ServiceError('Missing proposed_start', 422)
  }
  const parsed = new Date(proposedStart)
  if (Number.isNaN(parsed.getTime())) {
    throw new ServiceError('Invalid proposed_start datetime', 422)
  }
  return parsed
}

function assertHalfHourBoundary(value: Date) {
  const minutes = value.getMinutes()
  if (minutes !== 0 && minutes !== 30) {
    throw new ServiceError('Proposed time must be in 30-minute intervals', 422)
  }
}

function assertWithinRequestWindow(acceptBy: Date | null) {
  if (!acceptBy) return
  if (acceptBy.getTime() < Date.now()) {
    throw new ServiceError('Booking request window has expired', 400)
  }
}

type BookingWithRelations = NonNullable<Awaited<ReturnType<typeof bookingRepo.findById>>>

function resolveRequestAcceptBy(booking: BookingWithRelations): Date | null {
  const currentAcceptBy = booking.acceptBy
  const paymentStatus = String(booking.payment?.status ?? '')
  const isPendingAuthorized = booking.status === 'pending' && ['authorized', 'captured', 'transferred'].includes(paymentStatus)
  if (!isPendingAuthorized) return currentAcceptBy

  const anchor =
    booking.payment?.authorizedAt
    ?? booking.payment?.capturedAt
    ?? booking.payment?.transferredAt
    ?? booking.payment?.updatedAt
    ?? booking.payment?.createdAt
    ?? null
  if (!anchor) return currentAcceptBy

  return computePendingAcceptBy(anchor, booking.scheduledStart)
}

function assertRescheduleWindow(scheduledStart: Date) {
  const hoursUntilStart = (scheduledStart.getTime() - Date.now()) / (60 * 60 * 1000)
  if (hoursUntilStart <= RESCHEDULE_CUTOFF_HOURS) {
    throw new ServiceError('Alternative proposals are only allowed for bookings more than 24 hours away', 400)
  }
}

function assertPostConfirmationRescheduleWindow(scheduledStart: Date) {
  const hoursUntilStart = (scheduledStart.getTime() - Date.now()) / (60 * 60 * 1000)
  if (hoursUntilStart <= RESCHEDULE_CUTOFF_HOURS) {
    throw new ServiceError('Post-confirmation rescheduling is only allowed more than 24 hours before start', 400)
  }
}

function assertPostConfirmationProposalOpen(proposalExpiresAt: Date | null) {
  if (!proposalExpiresAt) return
  if (proposalExpiresAt.getTime() <= Date.now()) {
    throw new ServiceError('Reschedule request has expired. Original booking remains active.', 400)
  }
}

function assertPostConfirmationRescheduleNotUsed(booking: BookingWithRelations) {
  if (
    !booking.proposalBy &&
    booking.postCleanerProposals >= 1 &&
    booking.postClientProposals >= 1
  ) {
    throw new ServiceError('This booking has already been rescheduled once. No further reschedules are allowed for this booking.', 400)
  }
}

function maxProposalDateFromOriginal(originalScheduledStart: Date, windowDays: number): Date {
  const originalStartDay = startOfDayCyprus(originalScheduledStart)
  const maxAllowedDay = new Date(originalStartDay)
  maxAllowedDay.setUTCDate(maxAllowedDay.getUTCDate() + windowDays)
  return endOfDayCyprus(maxAllowedDay)
}

function assertPostConfirmationDateLimit(originalScheduledStart: Date, proposedStart: Date) {
  const maxAllowed = maxProposalDateFromOriginal(originalScheduledStart, POST_CONFIRM_RESCHEDULE_WINDOW_DAYS)
  if (proposedStart.getTime() > maxAllowed.getTime()) {
    throw new ServiceError(`Post-confirmation reschedules must be within ${POST_CONFIRM_RESCHEDULE_WINDOW_DAYS} days of the original booking date`, 400)
  }
}

function assertAmendWindow(currentStart: Date, proposedStart: Date) {
  const now = Date.now()
  const hoursUntilCurrentStart = (currentStart.getTime() - now) / (60 * 60 * 1000)
  if (hoursUntilCurrentStart > AMEND_WITHIN_HOURS) {
    throw new ServiceError(`Amend Start Time is only allowed within ${AMEND_WITHIN_HOURS} hours of booking start`, 400)
  }

  const currentLocalDate = cyprusDateStr(currentStart)
  const proposedLocalDate = cyprusDateStr(proposedStart)
  if (currentLocalDate !== proposedLocalDate) {
    throw new ServiceError('Amend Start Time must stay on the same calendar day', 400)
  }

  const shiftHours = Math.abs(proposedStart.getTime() - currentStart.getTime()) / (60 * 60 * 1000)
  if (shiftHours > AMEND_MAX_SHIFT_HOURS) {
    throw new ServiceError('Amend Start Time can only shift by up to 3 hours from the current scheduled start time.', 400)
  }
}

function assertAmendRequestStillValid(booking: Awaited<ReturnType<typeof bookingRepo.findById>>) {
  if (!booking?.proposalExpiresAt) return
  if (booking.proposalExpiresAt.getTime() < Date.now()) {
    throw new ServiceError('Amend Start Time request expired. The original booking time remains in effect.', 400)
  }
}

function clearedProposalState(options?: { preserveRescheduleUsage?: boolean; preserveAmendUsage?: boolean }) {
  const preserveRescheduleUsage = Boolean(options?.preserveRescheduleUsage)
  const preserveAmendUsage = Boolean(options?.preserveAmendUsage)
  return {
    proposedStart: null,
    proposedEnd: null,
    proposalBy: null,
    proposalContext: null,
    proposalExpiresAt: null,
    cleanerProposals: preserveAmendUsage ? undefined : 0,
    clientProposals: preserveAmendUsage ? undefined : 0,
    postCleanerProposals: preserveRescheduleUsage ? undefined : 0,
    postClientProposals: preserveRescheduleUsage ? undefined : 0,
  }
}

function appliedRescheduleUsageMarker() {
  return {
    postCleanerProposals: 1,
    postClientProposals: 1,
  }
}

function formatBookingTimeForMessage(value: Date) {
  return value.toLocaleString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Nicosia',
  })
}

function formatDisputeWindowLabel(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return '24 hours'
  if (hours >= 1) return `${hours} hours`
  const minutes = Math.round(hours * 60)
  return `${minutes} minutes`
}

async function resetAuthorizationAfterReschedule(bookingId: string) {
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) throw new ServiceError('Booking not found', 404)

  await releasePaymentAuthorization(
    booking.payment?.id,
    booking.payment?.stripePaymentIntentId,
    booking.payment?.status,
  )

  const now = Date.now()
  const hoursToStart = (booking.scheduledStart.getTime() - now) / (60 * 60 * 1000)
  const requiresImmediateReauth = hoursToStart < REAUTH_IMMEDIATE_THRESHOLD_HOURS
  const payBy = requiresImmediateReauth
    ? new Date(Math.min(booking.scheduledStart.getTime(), now + REAUTH_FAILURE_GRACE_HOURS * 60 * 60 * 1000))
    : new Date(booking.scheduledStart.getTime() - REAUTH_IMMEDIATE_THRESHOLD_HOURS * 60 * 60 * 1000)

  await bookingRepo.update(bookingId, {
    status: 'accepted',
    confirmedAt: null,
    payBy,
    reauthorizationRequired: true,
    reauthorizationGraceExpiresAt: requiresImmediateReauth ? payBy : null,
  })

  await pushInAppNotification({
    userId: booking.client.userId,
    type: 'booking_payment_required',
    title: 'Card re-authorization required',
    body: requiresImmediateReauth
      ? 'Your rescheduled booking is less than 48 hours away. Re-authorize your card now.'
      : 'Please re-authorize your card before 48 hours prior to the rescheduled start time.',
    data: { booking_id: bookingId },
  })
}

function assertPaymentAuthorized(paymentStatus: string | null | undefined, action: string) {
  const isPaymentAuthorized = ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
  if (!isPaymentAuthorized) {
    throw new ServiceError(
      `Cannot ${action} booking before client card authorization is completed`,
      400,
    )
  }
}

function computePendingAcceptBy(anchorMsOrDate: number | Date, scheduledStart: Date): Date {
  const anchorMs = anchorMsOrDate instanceof Date ? anchorMsOrDate.getTime() : anchorMsOrDate
  const requestWindowEndsAtMs = anchorMs + BOOKING_ACCEPT_TTL_MINUTES * 60 * 1000
  const startCutoffMs = scheduledStart.getTime() - BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES * 60 * 1000
  return new Date(Math.min(requestWindowEndsAtMs, startCutoffMs))
}

async function releasePaymentAuthorization(
  paymentId?: string,
  paymentIntentId?: string,
  paymentStatus?: string | null,
) {
  if (!paymentId || !paymentIntentId) return
  if (!['pending', 'authorized'].includes(String(paymentStatus ?? ''))) return

  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch {
    // Keep booking state deterministic even if Stripe cancellation fails.
  }

  try {
    await paymentRepo.update(paymentId, {
      status: 'failed',
      failedAt: new Date(),
    })
  } catch (error) {
    // Cancellation flow must remain non-blocking even if legacy payment rows are inconsistent.
    console.error('releasePaymentAuthorization.payment_update failed', {
      paymentId,
      paymentStatus,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function notifyPendingRequestExpired(booking: BookingWithRelations) {
  const isCleanerProposal = booking.proposalBy === 'cleaner'
  const isClientProposal = booking.proposalBy === 'client'
  const cleanerBody = isCleanerProposal
    ? 'Client did not respond before expiry. The request expired and availability is released.'
    : isClientProposal
      ? 'Your request expired because no agreement was reached in time.'
      : 'This request expired before confirmation.'
  const clientBody = isCleanerProposal
    ? 'You did not respond before expiry. The request expired and your card authorization was released.'
    : isClientProposal
      ? 'Cleaner did not respond before expiry. The request expired and your card authorization was released.'
      : 'This request expired because the cleaner did not accept in time.'

  await pushInAppNotification({
    userId: booking.client.userId,
    type: 'booking_request_expired',
    title: 'Booking request expired',
    body: clientBody,
    data: { booking_id: booking.id },
  })
  await pushInAppNotification({
    userId: booking.cleaner.userId,
    type: 'booking_request_expired',
    title: 'Booking request expired',
    body: cleanerBody,
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

async function notifyPostConfirmationProposalExpired(booking: BookingWithRelations) {
  const title = booking.proposalContext === 'amend_start'
    ? AMENDMENT_EXPIRED_TITLE
    : 'Reschedule request expired'
  const body = booking.proposalContext === 'amend_start'
    ? AMENDMENT_EXPIRED_BODY
    : 'No agreement was reached before the cutoff. Original booking remains active.'

  await pushInAppNotification({
    userId: booking.client.userId,
    type: 'booking_request_expired',
    title,
    body,
    data: { booking_id: booking.id },
  })
  await pushInAppNotification({
    userId: booking.cleaner.userId,
    type: 'booking_request_expired',
    title,
    body,
    data: { booking_id: booking.id },
  })
  if (booking.proposalContext !== 'amend_start') return

  try {
    await loopsEmailService.sendAmendmentRequestExpired({
      email: booking.client.user.email,
      fullName: booking.client.user.name ?? 'Client',
      scheduledStart: booking.scheduledStart,
    })
  } catch (emailError) {
    console.error('Failed to send client amendment expiry email via Loops:', emailError)
  }
  try {
    await loopsEmailService.sendAmendmentRequestExpired({
      email: booking.cleaner.user.email,
      fullName: booking.cleaner.user.name ?? 'Cleaner',
      scheduledStart: booking.scheduledStart,
    })
  } catch (emailError) {
    console.error('Failed to send cleaner amendment expiry email via Loops:', emailError)
  }
}

function assertCompletionWindow(scheduledEnd: Date) {
  const completionOpensAt = scheduledEnd.getTime() - COMPLETE_JOB_EARLY_MINUTES * 60 * 1000
  if (Date.now() < completionOpensAt) {
    throw new ServiceError(
      `Complete Job becomes available ${COMPLETE_JOB_EARLY_MINUTES} minutes before scheduled end`,
      400,
    )
  }
}

function assertCleanerStripeReady(cleaner: Awaited<ReturnType<typeof cleanerRepo.findByUserId>> | null) {
  if (!cleaner?.stripeOnboardingComplete) {
    throw new ServiceError('You must connect Stripe to accept bookings and receive payouts', 403)
  }
}

async function completeBookingFlow(
  bookingId: string,
  args: {
    completedAt: Date
    initiatedByRole: 'cleaner' | 'system'
    initiatedByUserId?: string
  },
) {
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) throw new ServiceError('Booking not found', 404)

  if (!['confirmed', 'in_progress', 'disputed'].includes(booking.status)) {
    if (booking.status === 'completed' && booking.completedAt) return booking
    throw new ServiceError(`Cannot complete a booking in status '${booking.status}'`, 400)
  }
  if (booking.completedAt) return booking

  const dispute = await disputeRepo.findByBookingId(bookingId)
  const unresolvedDispute = Boolean(dispute && !['resolved', 'closed'].includes(String(dispute.status ?? '')))

  const scheduledEndMs = booking.scheduledEnd ? booking.scheduledEnd.getTime() : Number.NaN
  const completionAnchorAt = Number.isFinite(scheduledEndMs) ? new Date(scheduledEndMs) : args.completedAt
  const nextStatus = unresolvedDispute ? 'disputed' : 'completed'
  const completed = await db.booking.updateMany({
    where: {
      id: bookingId,
      status: { in: ['confirmed', 'in_progress', 'disputed'] },
      completedAt: null,
    },
    data: {
      status: nextStatus,
      completedAt: completionAnchorAt,
    },
  })
  if (completed.count === 0) {
    const current = await bookingRepo.findById(bookingId)
    if (current) return current
    throw new ServiceError('Booking not found', 404)
  }
  const updated = await bookingRepo.findById(bookingId)
  if (!updated) throw new ServiceError('Booking not found', 404)

  await pushInAppNotification({
    userId: booking.client.userId,
    type: 'booking_completed',
    title: 'Booking completed',
    body:
      args.initiatedByRole === 'system'
        ? `Your booking has been marked as completed. If there was an issue, please report it within ${formatDisputeWindowLabel(config.DISPUTE_WINDOW_HOURS)} of scheduled completion.`
        : `Cleaner marked this booking as completed. If there was an issue, please report it within ${formatDisputeWindowLabel(config.DISPUTE_WINDOW_HOURS)} of scheduled completion.`,
    data: { booking_id: bookingId },
  })

  await pushInAppNotification({
    userId: booking.cleaner.userId,
    type: 'booking_completed',
    title: 'Completed - awaiting release',
    body:
      args.initiatedByRole === 'system'
        ? `This booking was auto-completed after scheduled end time. Payout will release after the ${formatDisputeWindowLabel(config.DISPUTE_WINDOW_HOURS)} report window from scheduled completion if no issue is raised.`
        : `Booking marked complete. Payout will release after the ${formatDisputeWindowLabel(config.DISPUTE_WINDOW_HOURS)} report window from scheduled completion if no issue is raised.`,
    data: { booking_id: bookingId },
  })

  try {
    await loopsEmailService.sendClientBookingCompleted({
      email: booking.client.user.email,
      fullName: booking.client.user.name ?? 'Client',
      cleanerName: booking.cleaner.user.name ?? 'Cleaner',
      bookingId: booking.id,
      completedBy: args.initiatedByRole,
    })
  } catch (completionEmailError) {
    console.error('Failed to send client completion email via Loops:', completionEmailError)
  }

  try {
    await loopsEmailService.sendClientReviewRequest({
      email: booking.client.user.email,
      fullName: booking.client.user.name ?? 'Client',
      cleanerName: booking.cleaner.user.name ?? 'Cleaner',
      bookingId: booking.id,
    })
  } catch (reviewEmailError) {
    console.error('Failed to send client review request email via Loops:', reviewEmailError)
  }

  return updated
}

async function startBookingFlow(
  bookingId: string,
  args: {
    initiatedBy: 'cleaner' | 'system'
    startedAt: Date
  },
) {
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) throw new ServiceError('Booking not found', 404)

  if (!['accepted', 'confirmed'].includes(booking.status)) {
    throw new ServiceError(`Cannot start a booking in status '${booking.status}'`, 400)
  }
  assertPaymentAuthorized(booking.payment?.status, 'start')

  const updateResult = await db.booking.updateMany({
    where: {
      id: bookingId,
      status: { in: ['accepted', 'confirmed'] },
      startedAt: null,
    },
    data: {
      status: 'in_progress',
      startedAt: args.startedAt,
    },
  })

  if (updateResult.count > 0) {
    try {
      await db.$executeRaw`
        UPDATE public.bookings
        SET start_initiated_by = ${args.initiatedBy}
        WHERE id = ${bookingId}
      `
    } catch (error) {
      console.error('Failed to persist booking start source:', error)
    }
  }

  const updated = await bookingRepo.findById(bookingId)
  if (!updated) throw new ServiceError('Booking not found', 404)

  if (updateResult.count === 0) {
    return updated
  }

  await pushInAppNotification({
    userId: booking.client.userId,
    type: 'booking_started',
    title: 'Job started',
    body:
      args.initiatedBy === 'cleaner'
        ? 'Your cleaner has started the booking.'
        : 'Your booking started automatically at the scheduled time and is now In Progress.',
    data: { booking_id: bookingId, start_initiated_by: args.initiatedBy },
  })

  if (args.initiatedBy === 'cleaner') {
    try {
      await loopsEmailService.sendClientBookingStarted({
        email: booking.client.user.email,
        fullName: booking.client.user.name ?? 'Client',
        cleanerName: booking.cleaner.user.name ?? 'Cleaner',
        scheduledStart: booking.scheduledStart,
        durationHours: Number(booking.durationHours),
        bookingId: booking.id,
      })
    } catch (emailError) {
      console.error('Failed to send client job started email via Loops:', emailError)
    }
  }

  return updated
}

async function maybeApplyCleanerCancellationStrike(args: {
  booking: NonNullable<Awaited<ReturnType<typeof bookingRepo.findById>>>
  cleanerId: string
  cancelledByUserId: string
  cancellationReason?: string
}) {
  const { booking, cleanerId, cancelledByUserId, cancellationReason } = args
  if (!['accepted', 'confirmed'].includes(booking.status)) return

  const now = new Date()
  const cancelledLocalDay = cyprusDateStr(now)
  const bookingLocalDay = cyprusDateStr(booking.scheduledStart)
  if (cancelledLocalDay !== bookingLocalDay) return

  const normalizedReason = normalizeCancellationReason(cancellationReason)
  const eventKey = `${bookingLocalDay}|${normalizedReason}`
  const eventReason = `event_key=${eventKey}|Same-day cleaner cancellation event`

  const dayStart = startOfDayCyprus(now)
  const dayEnd = endOfDayCyprus(now)
  const existingTodayEvent = await db.cleanerStrike.findFirst({
    where: {
      cleanerId,
      strikeType: 'cleaner_same_day_cancellation_event',
      reason: { startsWith: `event_key=${eventKey}|` },
      createdAt: { gte: dayStart, lte: dayEnd },
    },
  })
  if (existingTodayEvent) return

  await db.cleanerStrike.create({
    data: {
      cleanerId,
      bookingId: booking.id,
      strikeType: 'cleaner_same_day_cancellation_event',
      reason: eventReason,
      issuedBy: cancelledByUserId,
    },
  })

  const repeatWindowStart = new Date(now.getTime() - CLEANER_REPEAT_CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const previousEvents = await db.cleanerStrike.count({
    where: {
      cleanerId,
      strikeType: 'cleaner_same_day_cancellation_event',
      reason: { contains: `|${normalizedReason}|` },
      createdAt: { gte: repeatWindowStart, lt: dayStart },
    },
  })

  if (previousEvents < 1) return

  await db.cleanerStrike.create({
    data: {
      cleanerId,
      bookingId: booking.id,
      strikeType: 'cleaner_repeat_cancellation_strike',
      reason: `Repeat same-day cancellation event within ${CLEANER_REPEAT_CANCELLATION_WINDOW_DAYS} days (${normalizedReason})`,
      issuedBy: cancelledByUserId,
    },
  })
}

function normalizeCancellationReason(reason?: string) {
  const normalized = String(reason ?? 'unspecified')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120)
  return normalized || 'unspecified'
}

async function applyCancellationPaymentPolicy(
  booking: Awaited<ReturnType<typeof bookingRepo.findById>>,
  bookingStatus: string,
) {
  if (!booking?.payment) return

  const payment = booking.payment
  if (!payment.stripePaymentIntentId) return

  if (payment.status === 'pending') {
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
    await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
    return
  }

  if (payment.status !== 'authorized') return

  // Pending cleaner acceptance cancellations should always release auth in full.
  if (bookingStatus === 'pending') {
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
    await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
    return
  }

  const policy = computeConfirmedCancellationPolicy({
    scheduledStart: booking.scheduledStart,
    totalAmount: booking.totalAmount,
    subtotal: booking.subtotal,
    platformFee: booking.platformFee,
  })
  if (!policy) return

  if (policy.window === 'more_than_24h') {
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
    await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
    return
  }

  const captureCents = policy.captureCents
  const applicationFeeCents = policy.platformRetainedCents

  const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
    amount_to_capture: Math.max(1, captureCents),
    application_fee_amount: Math.max(0, applicationFeeCents),
  })

  await paymentRepo.update(payment.id, {
    status: 'captured',
    stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : undefined,
    capturedAt: new Date(),
    refundAmount: moneyFromCents(policy.clientRefundCents),
    refundReason: 'client_cancellation_policy',
    platformFee: moneyFromCents(applicationFeeCents),
    cleanerPayout: moneyFromCents(policy.cleanerPayoutCents),
    payoutScheduledAt: policy.cleanerPayoutCents > 0 ? new Date() : null,
  })
}

async function maybeAutoReleaseCompletedBooking(booking: BookingWithRelations) {
  if (booking.status !== 'completed') return null
  if (!booking.payment) return null

  const paymentStatus = String(booking.payment.status ?? '')
  if (!['authorized', 'captured'].includes(paymentStatus)) return null

  const scheduledEndMs = booking.scheduledEnd?.getTime() ?? Number.NaN
  if (!Number.isFinite(scheduledEndMs)) return null

  const releaseDeadlineMs = scheduledEndMs + config.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000
  if (Date.now() <= releaseDeadlineMs) return null

  const dispute = await disputeRepo.findByBookingId(booking.id)
  const unresolvedDispute = Boolean(dispute && !['resolved', 'closed'].includes(String(dispute.status ?? '')))
  if (unresolvedDispute) return null

  const releasedAt = new Date()
  const releaseUpdate = await db.payment.updateMany({
    where: {
      id: booking.payment.id,
      status: { in: ['authorized', 'captured'] },
    },
    data: {
      status: 'transferred',
      transferredAt: releasedAt,
      payoutScheduledAt: booking.payment.payoutScheduledAt ?? releasedAt,
    },
  })

  if (releaseUpdate.count === 0) return null

  await pushInAppNotification({
    userId: booking.cleaner.userId,
    type: 'payout_released',
    title: 'Payout released',
    body: 'Payout has been marked as released after the report window closed.',
    data: { booking_id: booking.id },
  })

  return bookingRepo.findById(booking.id)
}

function isoWeekday(date: Date): number {
  const d = date.getUTCDay()
  return d === 0 ? 7 : d
}

const APP_TIMEZONE = 'Europe/Nicosia'

/**
 * Get the UTC offset in milliseconds for APP_TIMEZONE at a given instant.
 */
function tzOffsetMs(date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: APP_TIMEZONE })
  return new Date(tzStr).getTime() - new Date(utcStr).getTime()
}

/**
 * Convert a Cyprus local time (dateStr YYYY-MM-DD + hours + minutes) to UTC.
 * Handles DST automatically (EET = UTC+2, EEST = UTC+3).
 */
function cyprusToUTC(dateStr: string, hours: number, minutes: number): Date {
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const asUTC = new Date(`${dateStr}T${hh}:${mm}:00Z`)
  const offset = tzOffsetMs(asUTC)
  return new Date(asUTC.getTime() - offset)
}

/** Get YYYY-MM-DD date string in Cyprus timezone from a UTC date */
function cyprusDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(date)
}

function startOfDayCyprus(date: Date): Date {
  const dateStr = cyprusDateStr(date)
  return cyprusToUTC(dateStr, 0, 0)
}

function endOfDayCyprus(date: Date): Date {
  const dateStr = cyprusDateStr(date)
  const d = cyprusToUTC(dateStr, 23, 59)
  d.setUTCSeconds(59, 999)
  return d
}

async function validateBookingWindow(
  cleanerId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  options?: {
    enforceMaxAdvanceWindow?: boolean
    excludeBookingId?: string
    skipMinLeadTime?: boolean
  },
) {
  if (Number.isNaN(scheduledStart.getTime())) {
    throw new ServiceError('Invalid scheduled_start datetime', 422)
  }

  if (scheduledEnd <= scheduledStart) {
    throw new ServiceError('Invalid booking duration', 422)
  }

  const now = Date.now()
  if (scheduledStart.getTime() < now) {
    throw new ServiceError('Bookings cannot be created in the past', 422)
  }

  const leadTimeCutoff = now + 2 * 60 * 60 * 1000
  if (!options?.skipMinLeadTime && scheduledStart.getTime() < leadTimeCutoff) {
    throw new ServiceError('Selected time must be at least 2 hours from now', 422)
  }

  const enforceMaxAdvanceWindow = options?.enforceMaxAdvanceWindow ?? true
  if (enforceMaxAdvanceWindow) {
    const maxAdvanceWindow = now + MAX_BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000
    if (scheduledStart.getTime() > maxAdvanceWindow) {
      throw new ServiceError(`Bookings can only be made up to ${MAX_BOOKING_WINDOW_DAYS} days in advance`, 422)
    }
  }

  const dayStart = startOfDayCyprus(scheduledStart)
  const dayEnd = endOfDayCyprus(scheduledStart)
  const dateStr = cyprusDateStr(scheduledStart)

  const [schedules, blockedTimes, existingBookings] = await Promise.all([
    availabilityRepo.getSchedule(cleanerId),
    availabilityRepo.getBlockedTimesInRange(cleanerId, dayStart, dayEnd),
    bookingRepo.findActiveForCleaner(cleanerId, dayStart, dayEnd, options?.excludeBookingId),
  ])

  const dayOfWeek = isoWeekday(new Date(dateStr + 'T00:00:00Z'))
  const activeDaySchedules = schedules
    .filter((s) => s.dayOfWeek === dayOfWeek && s.isActive)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  if (activeDaySchedules.length === 0) {
    throw new ServiceError('Cleaner is unavailable on the selected day', 422)
  }

  const startMs = scheduledStart.getTime()
  const endMs = scheduledEnd.getTime()
  const fitsSingleSlot = activeDaySchedules.some((schedule) => {
    const [sh, sm] = schedule.startTime.split(':').map(Number)
    const [eh, em] = schedule.endTime.split(':').map(Number)

    // Schedule times are in Cyprus local time — convert to UTC
    const slotStart = cyprusToUTC(dateStr, sh, sm)
    const slotEnd = cyprusToUTC(dateStr, eh, em)

    const maxBookableStart = slotEnd.getTime() - 1 * 60 * 60 * 1000
    return startMs >= slotStart.getTime() && startMs <= maxBookableStart && endMs <= slotEnd.getTime()
  })

  if (!fitsSingleSlot) {
    throw new ServiceError('Selected start time and duration must fit within one continuous availability slot', 422)
  }

  const hasBlockedConflict = blockedTimes.some(
    (b) => b.startDatetime < scheduledEnd && b.endDatetime > scheduledStart,
  )
  if (hasBlockedConflict) {
    throw new ServiceError('Selected time conflicts with cleaner blocked dates/times', 409)
  }

  const hasBookingConflict = existingBookings.some(
    (b) => {
      const existingBufferedStart = new Date(b.scheduledStart.getTime() - BOOKING_PRE_BUFFER_MS)
      const existingBufferedEnd = new Date(b.scheduledEnd.getTime() + BOOKING_POST_BUFFER_MS)
      const requestedBufferedStart = new Date(scheduledStart.getTime() - BOOKING_PRE_BUFFER_MS)
      const requestedBufferedEnd = new Date(scheduledEnd.getTime() + BOOKING_POST_BUFFER_MS)
      return existingBufferedStart < requestedBufferedEnd && existingBufferedEnd > requestedBufferedStart
    },
  )
  if (hasBookingConflict) {
    throw new ServiceError('Selected time conflicts with booking buffer window (15 mins before and after each booking)', 409)
  }
}
