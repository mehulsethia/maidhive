import { bookingRepo } from '../repositories/booking.repo'
import { cleanerRepo } from '../repositories/cleaner.repo'
import { clientRepo } from '../repositories/client.repo'
import { availabilityRepo } from '../repositories/availability.repo'
import { paymentRepo } from '../repositories/payment.repo'
import { disputeRepo } from '../repositories/dispute.repo'
import { loopsEmailService } from './loops-email.service'
import { pushInAppNotification } from './in-app-notification.service'
import { googleCalendarService } from './google-calendar.service'
import { stripe } from '../stripe'
import { config } from '../config'
import type { User } from '@prisma/client'

const PLATFORM_FEE_PCT = Number(process.env.PLATFORM_FEE_PCT ?? 10)
const BOOKING_ACCEPT_TTL_MINUTES = Number(process.env.BOOKING_ACCEPT_TTL_MINUTES ?? 1440)
const BOOKING_PAY_TTL_MINUTES = Number(process.env.BOOKING_PAY_TTL_MINUTES ?? 15)
const RESCHEDULE_CUTOFF_HOURS = 24
const BOOKING_PRE_BUFFER_MS = 15 * 60 * 1000
const BOOKING_POST_BUFFER_MS = 15 * 60 * 1000
const NO_SHOW_REPORT_DELAY_MINUTES = 30
const COMPLETE_JOB_EARLY_MINUTES = 5

export const bookingService = {
  previewPrice(hourlyRate: number, durationHours: number, platformFeePct = PLATFORM_FEE_PCT) {
    const subtotal = hourlyRate * durationHours
    const platformFee = (subtotal * platformFeePct) / 100
    const cleanerPayout = subtotal - platformFee
    const totalAmount = subtotal
    return {
      hourly_rate: hourlyRate,
      duration_hours: durationHours,
      subtotal: round2(subtotal),
      platform_fee_pct: platformFeePct,
      platform_fee: round2(platformFee),
      cleaner_payout: round2(cleanerPayout),
      total_amount: round2(totalAmount),
    }
  },

  async create(user: User, data: {
    cleaner_id: string
    service_type: string
    special_instructions?: string
    address: string
    city: string
    postcode: string
    country: string
    scheduled_start: string
    duration_hours: number
  }) {
    const client = await clientRepo.findByUserId(user.id)
    if (!client) throw new ServiceError('Client profile not found', 404)

    const cleaner = await cleanerRepo.findById(data.cleaner_id)
    if (!cleaner) throw new ServiceError('Cleaner not found', 404)
    if (cleaner.status !== 'approved') throw new ServiceError('Cleaner is not available', 400)

    const scheduledStart = new Date(data.scheduled_start)
    const scheduledEnd = new Date(scheduledStart.getTime() + data.duration_hours * 60 * 60 * 1000)

    await validateBookingWindow(cleaner.id, scheduledStart, scheduledEnd)

    const acceptBy = new Date(Date.now() + BOOKING_ACCEPT_TTL_MINUTES * 60 * 1000)

    const pricing = bookingService.previewPrice(
      Number(cleaner.hourlyRate),
      data.duration_hours,
    )

    const booking = await bookingRepo.create({
      clientId: client.id,
      cleanerId: cleaner.id,
      serviceType: data.service_type,
      specialInstructions: data.special_instructions,
      address: data.address,
      city: data.city,
      postcode: data.postcode,
      country: data.country,
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
    })

    await pushInAppNotification({
      userId: booking.client.userId,
      type: 'booking_created_pending',
      title: 'Booking request created',
      body: 'Your booking request was created and is waiting for cleaner response.',
      data: { booking_id: booking.id },
    })

    try {
      await loopsEmailService.sendClientBookingCreatedPending({
        email: booking.client.user.email,
        fullName: booking.client.user.name ?? 'Client',
        cleanerName: booking.cleaner.user.name ?? 'Cleaner',
      })
    } catch (emailError) {
      console.error('Failed to send client booking created pending email via Loops:', emailError)
    }

    return booking
  },

  async applyAction(
    bookingId: string,
    user: User,
    payload: {
      action:
        | 'accept'
        | 'start'
        | 'propose_alternative'
        | 'counter_proposal'
        | 'accept_proposal'
        | 'decline_proposal'
      proposed_start?: string
      start_location?: {
        latitude: number
        longitude: number
        accuracy_m?: number
      }
    },
  ) {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const cleaner = await cleanerRepo.findByUserId(user.id)
    const client = await clientRepo.findByUserId(user.id)
    const isCleaner = Boolean(cleaner && booking.cleanerId === cleaner.id)
    const isClient = Boolean(client && booking.clientId === client.id)
    if (!isCleaner && !isClient) throw new ServiceError('Forbidden', 403)

    const action = payload.action

    if (action === 'start') {
      if (!isCleaner) throw new ServiceError('Only cleaner can start a booking', 403)
      if (!['accepted', 'confirmed'].includes(booking.status)) {
        throw new ServiceError(`Cannot start a booking in status '${booking.status}'`, 400)
      }
      assertPaymentAuthorized(booking.payment?.status, 'start')
      return bookingRepo.update(bookingId, {
        status: 'in_progress',
        startedAt: new Date(),
      })
    }

    if (action === 'accept') {
      if (!isCleaner) throw new ServiceError('Only cleaner can accept a booking', 403)
      if (booking.status !== 'pending') {
        throw new ServiceError(`Cannot accept a booking in status '${booking.status}'`, 400)
      }
      assertWithinRequestWindow(booking.acceptBy)
      assertPaymentAuthorized(booking.payment?.status, 'accept')
      const now = new Date()
      const updated = await bookingRepo.update(bookingId, {
        status: 'confirmed',
        acceptedAt: now,
        confirmedAt: now,
        payBy: null,
        proposedStart: null,
        proposedEnd: null,
        proposalBy: null,
      })
      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_accepted',
        title: 'Booking accepted',
        body: 'Cleaner accepted your booking request.',
        data: { booking_id: bookingId },
      })
      void googleCalendarService.upsertCleanerBookingEvent(updated.id).catch((e) => {
        console.error('Failed to sync cleaner Google Calendar event:', e)
      })
      return updated
    }

    if (action === 'propose_alternative') {
      if (!isCleaner) throw new ServiceError('Only cleaner can propose an alternative time', 403)
      if (booking.status !== 'pending') {
        throw new ServiceError(`Cannot propose a new time in status '${booking.status}'`, 400)
      }
      assertWithinRequestWindow(booking.acceptBy)
      assertRescheduleWindow(booking.scheduledStart)
      if (booking.proposalBy) {
        throw new ServiceError('A proposal is already active for this booking', 400)
      }
      if (booking.cleanerProposals >= 1) {
        throw new ServiceError('Cleaner can only propose an alternative time once', 400)
      }
      const proposedStart = parseProposedStart(payload.proposed_start)
      assertHalfHourBoundary(proposedStart)
      if (proposedStart.getTime() === booking.scheduledStart.getTime()) {
        throw new ServiceError('Proposed time must be different from current booking time', 400)
      }
      const proposedEnd = new Date(proposedStart.getTime() + Number(booking.durationHours) * 60 * 60 * 1000)
      await validateBookingWindow(booking.cleanerId, proposedStart, proposedEnd)

      const updated = await bookingRepo.update(bookingId, {
        proposedStart,
        proposedEnd,
        proposalBy: 'cleaner',
        cleanerProposals: { increment: 1 },
      })
      await pushInAppNotification({
        userId: booking.client.userId,
        type: 'booking_proposed_new_time',
        title: 'Cleaner proposed a new time',
        body: 'Review and accept, decline, or counter once before the request expires.',
        data: { booking_id: bookingId },
      })
      return updated
    }

    if (action === 'counter_proposal') {
      if (!isClient) throw new ServiceError('Only client can counter a proposal', 403)
      if (booking.status !== 'pending') {
        throw new ServiceError(`Cannot counter a proposal in status '${booking.status}'`, 400)
      }
      assertWithinRequestWindow(booking.acceptBy)
      assertRescheduleWindow(booking.scheduledStart)
      if (booking.proposalBy !== 'cleaner' || !booking.proposedStart || !booking.proposedEnd) {
        throw new ServiceError('No cleaner proposal available to counter', 400)
      }
      if (booking.clientProposals >= 1) {
        throw new ServiceError('Client can only counter once', 400)
      }
      const proposedStart = parseProposedStart(payload.proposed_start)
      assertHalfHourBoundary(proposedStart)
      const proposedEnd = new Date(proposedStart.getTime() + Number(booking.durationHours) * 60 * 60 * 1000)
      await validateBookingWindow(booking.cleanerId, proposedStart, proposedEnd)

      const updated = await bookingRepo.update(bookingId, {
        proposedStart,
        proposedEnd,
        proposalBy: 'client',
        clientProposals: { increment: 1 },
      })
      await pushInAppNotification({
        userId: booking.cleaner.userId,
        type: 'booking_counter_proposal',
        title: 'Client sent one counter-offer',
        body: 'Accept or decline this counter-offer before the request expires.',
        data: { booking_id: bookingId },
      })
      return updated
    }

    if (action === 'accept_proposal') {
      if (booking.status !== 'pending') {
        throw new ServiceError(`Cannot accept a proposal in status '${booking.status}'`, 400)
      }
      assertWithinRequestWindow(booking.acceptBy)
      if (!booking.proposedStart || !booking.proposedEnd || !booking.proposalBy) {
        throw new ServiceError('No proposal available to accept', 400)
      }

      if (booking.proposalBy === 'cleaner' && !isClient) {
        throw new ServiceError('Only client can accept cleaner proposal', 403)
      }
      if (booking.proposalBy === 'client' && !isCleaner) {
        throw new ServiceError('Only cleaner can accept client counter-offer', 403)
      }

      assertPaymentAuthorized(booking.payment?.status, 'accept')
      const now = new Date()
      const updated = await bookingRepo.update(bookingId, {
        status: 'confirmed',
        scheduledStart: booking.proposedStart,
        scheduledEnd: booking.proposedEnd,
        acceptedAt: now,
        confirmedAt: now,
        payBy: null,
        proposedStart: null,
        proposedEnd: null,
        proposalBy: null,
      })
      await pushInAppNotification({
        userId: isClient ? booking.cleaner.userId : booking.client.userId,
        type: 'booking_time_agreed',
        title: 'Booking time confirmed',
        body: 'The proposed booking time has been accepted and confirmed.',
        data: { booking_id: bookingId },
      })
      void googleCalendarService.upsertCleanerBookingEvent(updated.id).catch((e) => {
        console.error('Failed to sync cleaner Google Calendar event:', e)
      })
      return updated
    }

    if (action === 'decline_proposal') {
      if (booking.status !== 'pending') {
        throw new ServiceError(`Cannot decline a proposal in status '${booking.status}'`, 400)
      }
      assertWithinRequestWindow(booking.acceptBy)
      if (!booking.proposalBy) throw new ServiceError('No active proposal to decline', 400)
      if (booking.proposalBy === 'cleaner' && !isClient) {
        throw new ServiceError('Only client can decline cleaner proposal', 403)
      }
      if (booking.proposalBy === 'client' && !isCleaner) {
        throw new ServiceError('Only cleaner can decline client counter-offer', 403)
      }

      const updated = await bookingRepo.update(bookingId, {
        status: 'expired',
        proposedStart: null,
        proposedEnd: null,
        proposalBy: null,
      })
      await releasePaymentAuthorization(booking.payment?.id, booking.payment?.stripePaymentIntentId, booking.payment?.status)
      await pushInAppNotification({
        userId: isClient ? booking.cleaner.userId : booking.client.userId,
        type: 'booking_request_expired',
        title: 'Booking request closed',
        body: 'No final agreement was reached for this booking request.',
        data: { booking_id: bookingId },
      })
      void googleCalendarService.removeCleanerBookingEvent(updated.id).catch((e) => {
        console.error('Failed to remove cleaner Google Calendar event:', e)
      })
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

    if (!booking.startedAt) {
      throw new ServiceError('Start Cleaning is required before completing the job', 400)
    }

    assertCompletionWindow(booking.scheduledEnd)
    return completeBookingFlow(bookingId, {
      completedAt: new Date(),
      initiatedByUserId: user.id,
      initiatedByRole: 'cleaner',
    })
  },

  async completeByClient(bookingId: string, user: User) {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const client = await clientRepo.findByUserId(user.id)
    if (!client || booking.clientId !== client.id) {
      throw new ServiceError('Only booking client can complete this booking', 403)
    }

    if (!['in_progress', 'disputed'].includes(booking.status)) {
      throw new ServiceError(`Cannot complete a booking in status '${booking.status}'`, 400)
    }

    if (!booking.startedAt) {
      throw new ServiceError('Booking must be started before completion', 400)
    }

    assertCompletionWindow(booking.scheduledEnd)
    return completeBookingFlow(bookingId, {
      completedAt: new Date(),
      initiatedByUserId: user.id,
      initiatedByRole: 'client',
    })
  },

  async completeBySystem(bookingId: string, completedAt: Date) {
    return completeBookingFlow(bookingId, {
      completedAt,
      initiatedByRole: 'system',
    })
  },

  async cancel(bookingId: string, user: User, reason?: string) {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const cancellableStatuses = ['pending', 'accepted', 'confirmed']
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

    await applyCancellationPaymentPolicy(booking)

    const updated = await bookingRepo.update(bookingId, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledByUser: { connect: { id: user.id } },
      cancelledAt: new Date(),
    })

    // Notify the other party
    const notifyUserId =
      client && booking.clientId === client.id
        ? booking.cleaner.userId
        : booking.client.userId

    await pushInAppNotification({
      userId: notifyUserId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      body: 'A booking has been cancelled',
      data: { booking_id: bookingId },
    })
    void googleCalendarService.removeCleanerBookingEvent(updated.id).catch((e) => {
      console.error('Failed to remove cleaner Google Calendar event:', e)
    })

    try {
      await loopsEmailService.sendClientCancellationConfirmation({
        email: booking.client.user.email,
        fullName: booking.client.user.name ?? 'Client',
        date: new Date(),
      })
    } catch (emailError) {
      console.error('Failed to send client cancellation confirmation email via Loops:', emailError)
    }

    if (cleaner && booking.cleanerId === cleaner.id) {
      try {
        await loopsEmailService.sendCleanerCancellationWarningOrStrike({
          email: booking.cleaner.user.email,
          fullName: booking.cleaner.user.name ?? 'Cleaner',
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

function assertRescheduleWindow(scheduledStart: Date) {
  const hoursUntilStart = (scheduledStart.getTime() - Date.now()) / (60 * 60 * 1000)
  if (hoursUntilStart <= RESCHEDULE_CUTOFF_HOURS) {
    throw new ServiceError('Alternative proposals are only allowed for bookings more than 24 hours away', 400)
  }
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

  await paymentRepo.update(paymentId, {
    status: 'failed',
    failedAt: new Date(),
  })
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

async function completeBookingFlow(
  bookingId: string,
  args: {
    completedAt: Date
    initiatedByRole: 'cleaner' | 'client' | 'system'
    initiatedByUserId?: string
  },
) {
  const booking = await bookingRepo.findById(bookingId)
  if (!booking) throw new ServiceError('Booking not found', 404)

  if (!['in_progress', 'disputed'].includes(booking.status)) {
    throw new ServiceError(`Cannot complete a booking in status '${booking.status}'`, 400)
  }

  const dispute = await disputeRepo.findByBookingId(bookingId)
  const unresolvedDispute = Boolean(dispute && !['resolved', 'closed'].includes(String(dispute.status ?? '')))

  const nextStatus = unresolvedDispute ? 'disputed' : 'completed'
  const updated = await bookingRepo.update(bookingId, {
    status: nextStatus,
    completedAt: args.completedAt,
  })

  if (!unresolvedDispute && booking.payment?.status === 'authorized') {
    const captured = await stripe.paymentIntents.capture(booking.payment.stripePaymentIntentId)
    await paymentRepo.update(booking.payment.id, {
      status: 'captured',
      stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : undefined,
      capturedAt: new Date(),
      payoutScheduledAt: new Date(Date.now() + config.DISPUTE_WINDOW_HOURS * 60 * 60 * 1000),
    })
  }

  await pushInAppNotification({
    userId: booking.client.userId,
    type: 'booking_completed',
    title: 'Booking Completed',
    body:
      args.initiatedByRole === 'system'
        ? 'Booking was auto-completed after the scheduled end time.'
        : args.initiatedByRole === 'client'
          ? 'You marked this booking as completed.'
          : 'Cleaner marked this booking as completed.',
    data: { booking_id: bookingId },
  })

  await pushInAppNotification({
    userId: booking.cleaner.userId,
    type: 'booking_completed',
    title: 'Booking completed',
    body:
      args.initiatedByRole === 'system'
        ? 'This booking was auto-completed after the scheduled end time.'
        : args.initiatedByRole === 'client'
          ? 'Client marked this booking as completed. Payout will be released after the dispute window.'
        : 'Booking marked complete. Payout will be released after the dispute window.',
    data: { booking_id: bookingId },
  })

  try {
    await loopsEmailService.sendClientReviewRequest({
      email: booking.client.user.email,
      fullName: booking.client.user.name ?? 'Client',
      cleanerName: booking.cleaner.user.name ?? 'Cleaner',
      bookingId: booking.id,
    })
  } catch (emailError) {
    console.error('Failed to send client review request email via Loops:', emailError)
  }

  return updated
}

async function applyCancellationPaymentPolicy(booking: Awaited<ReturnType<typeof bookingRepo.findById>>) {
  if (!booking?.payment) return

  const payment = booking.payment
  if (!payment.stripePaymentIntentId) return

  if (payment.status === 'pending') {
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
    await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
    return
  }

  if (payment.status !== 'authorized') return

  const hoursUntilStart = (booking.scheduledStart.getTime() - Date.now()) / (60 * 60 * 1000)
  const totalAmountCents = Math.round(Number(booking.totalAmount) * 100)
  const subtotalCents = Math.round(Number(booking.subtotal) * 100)
  const platformFeeCents = Math.round(Number(booking.platformFee) * 100)

  if (hoursUntilStart > 24) {
    await stripe.paymentIntents.cancel(payment.stripePaymentIntentId)
    await paymentRepo.update(payment.id, { status: 'failed', failedAt: new Date() })
    return
  }

  let captureCents: number
  let applicationFeeCents: number

  if (hoursUntilStart > 12) {
    captureCents = Math.min(totalAmountCents, 500)
    applicationFeeCents = captureCents
  } else {
    const cleanerShareCents = Math.round(subtotalCents * 0.5)
    captureCents = Math.min(totalAmountCents, cleanerShareCents + platformFeeCents)
    applicationFeeCents = Math.min(captureCents, platformFeeCents)
  }

  const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
    amount_to_capture: Math.max(1, captureCents),
    application_fee_amount: Math.max(0, applicationFeeCents),
  })

  await paymentRepo.update(payment.id, {
    status: 'captured',
    stripeChargeId: typeof captured.latest_charge === 'string' ? captured.latest_charge : undefined,
    capturedAt: new Date(),
    payoutScheduledAt: new Date(),
  })
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

async function validateBookingWindow(cleanerId: string, scheduledStart: Date, scheduledEnd: Date) {
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
  if (scheduledStart.getTime() < leadTimeCutoff) {
    throw new ServiceError('Selected time must be at least 2 hours from now', 422)
  }

  const dayStart = startOfDayCyprus(scheduledStart)
  const dayEnd = endOfDayCyprus(scheduledStart)
  const dateStr = cyprusDateStr(scheduledStart)

  const [schedules, blockedTimes, existingBookings] = await Promise.all([
    availabilityRepo.getSchedule(cleanerId),
    availabilityRepo.getBlockedTimesInRange(cleanerId, dayStart, dayEnd),
    bookingRepo.findActiveForCleaner(cleanerId, dayStart, dayEnd),
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
