import { bookingRepo } from '../repositories/booking.repo'
import { cleanerRepo } from '../repositories/cleaner.repo'
import { clientRepo } from '../repositories/client.repo'
import { notificationRepo } from '../repositories/notification.repo'
import type { User } from '@prisma/client'

const PLATFORM_FEE_PCT = Number(process.env.PLATFORM_FEE_PCT ?? 15)
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

    // Notify cleaner
    await notificationRepo.create({
      userId: cleaner.userId,
      type: 'booking_request',
      title: 'New Booking Request',
      body: `You have a new booking request from ${user.name}`,
      data: { booking_id: booking.id },
    })

    return booking
  },

  async applyAction(bookingId: string, user: User, action: 'accept' | 'start' | 'complete') {
    const booking = await bookingRepo.findById(bookingId)
    if (!booking) throw new ServiceError('Booking not found', 404)

    const cleaner = await cleanerRepo.findByUserId(user.id)
    if (!cleaner || booking.cleanerId !== cleaner.id) {
      throw new ServiceError('Forbidden', 403)
    }

    const transitions: Record<string, { from: string; to: string; field: string }> = {
      accept: { from: 'pending', to: 'accepted', field: 'acceptedAt' },
      start: { from: 'confirmed', to: 'in_progress', field: 'startedAt' },
      complete: { from: 'in_progress', to: 'completed', field: 'completedAt' },
    }

    const t = transitions[action]
    if (booking.status !== t.from) {
      throw new ServiceError(`Cannot ${action} a booking in status '${booking.status}'`, 400)
    }

    const now = new Date()
    const updateData: Record<string, unknown> & { status: string } = {
      status: t.to,
      [t.field]: now,
    }

    if (action === 'accept') {
      updateData.payBy = new Date(now.getTime() + BOOKING_PAY_TTL_MINUTES * 60 * 1000)
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
