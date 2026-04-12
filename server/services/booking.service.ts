import { bookingRepo } from '../repositories/booking.repo'
import { cleanerRepo } from '../repositories/cleaner.repo'
import { clientRepo } from '../repositories/client.repo'
import { notificationRepo } from '../repositories/notification.repo'
import { availabilityRepo } from '../repositories/availability.repo'
import type { User } from '@prisma/client'

const PLATFORM_FEE_PCT = Number(process.env.PLATFORM_FEE_PCT ?? 10)
const BOOKING_ACCEPT_TTL_MINUTES = Number(process.env.BOOKING_ACCEPT_TTL_MINUTES ?? 60)
const BOOKING_PAY_TTL_MINUTES = Number(process.env.BOOKING_PAY_TTL_MINUTES ?? 15)

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

    return booking
  },

  async applyAction(bookingId: string, user: User, action: 'accept' | 'start') {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const cleaner = await cleanerRepo.findByUserId(user.id)
    if (!cleaner || booking.cleanerId !== cleaner.id) {
      throw new ServiceError('Forbidden', 403)
    }

    const transitions: Record<'accept' | 'start', { from: string | string[]; to: string; field: string }> = {
      accept: { from: 'pending', to: 'accepted', field: 'acceptedAt' },
      start: { from: ['accepted', 'confirmed'], to: 'in_progress', field: 'startedAt' },
    }

    const t = transitions[action]
    const validFrom = Array.isArray(t.from) ? t.from : [t.from]
    if (!validFrom.includes(booking.status)) {
      throw new ServiceError(`Cannot ${action} a booking in status '${booking.status}'`, 400)
    }

    const paymentStatus = booking.payment?.status
    const isPaymentAuthorized = ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
    if (!isPaymentAuthorized) {
      throw new ServiceError(
        `Cannot ${action} booking before client card authorization is completed`,
        400,
      )
    }

    const now = new Date()
    const updateData: Record<string, unknown> & { status: string } = {
      status: t.to,
      [t.field]: now,
    }

    if (action === 'accept') {
      updateData.payBy = null
    }

    const updated = await bookingRepo.update(bookingId, updateData)

    // Notify client
    await notificationRepo.create({
      userId: booking.client.userId,
      type: `booking_${action}ed`,
      title: `Booking ${capitalize(action)}ed`,
      body: `Your booking has been ${action}ed by the cleaner`,
      data: { booking_id: bookingId },
    })

    return updated
  },

  async completeByClient(bookingId: string, user: User) {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const client = await clientRepo.findByUserId(user.id)
    if (!client || booking.clientId !== client.id) {
      throw new ServiceError('Forbidden', 403)
    }

    if (booking.status !== 'in_progress') {
      throw new ServiceError(`Cannot complete a booking in status '${booking.status}'`, 400)
    }

    const updated = await bookingRepo.update(bookingId, {
      status: 'completed',
      completedAt: new Date(),
    })

    await notificationRepo.create({
      userId: booking.cleaner.userId,
      type: 'booking_completed',
      title: 'Booking Completed',
      body: 'Client marked this booking as completed',
      data: { booking_id: bookingId },
    })

    return updated
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

    await notificationRepo.create({
      userId: notifyUserId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      body: 'A booking has been cancelled',
      data: { booking_id: bookingId },
    })

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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
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
    (b) => b.scheduledStart < scheduledEnd && b.scheduledEnd > scheduledStart,
  )
  if (hasBookingConflict) {
    throw new ServiceError('Selected time is no longer available', 409)
  }
}
