import { describe, expect, it } from 'vitest'
import {
  getBookingReportDeadlineMs,
  isBookingReportWindowActive,
  isCompletedBookingReleased,
} from '@/lib/booking-release'
import { compareBookingsByOperationalPriority } from '@/lib/booking-priority'

describe('Post-24h release and booking priority', () => {
  it('hides report window after scheduled end + dispute window', () => {
    const scheduledEnd = '2026-05-10T10:00:00.000Z'
    const deadline = getBookingReportDeadlineMs(scheduledEnd)
    expect(Number.isFinite(deadline)).toBe(true)

    expect(isBookingReportWindowActive(scheduledEnd, deadline - 1)).toBe(true)
    expect(isBookingReportWindowActive(scheduledEnd, deadline + 1)).toBe(false)
  })

  it('marks completed booking as released after report window even if payment not transferred yet', () => {
    const scheduledEnd = '2026-05-10T10:00:00.000Z'
    const deadline = getBookingReportDeadlineMs(scheduledEnd)

    expect(isCompletedBookingReleased({
      status: 'completed',
      paymentStatus: 'authorized',
      scheduledEnd,
      nowMs: deadline - 1,
    })).toBe(false)

    expect(isCompletedBookingReleased({
      status: 'completed',
      paymentStatus: 'authorized',
      scheduledEnd,
      nowMs: deadline + 1,
    })).toBe(true)
  })

  it('treats transferred payment as released immediately', () => {
    const scheduledEnd = '2099-05-10T10:00:00.000Z'
    expect(isCompletedBookingReleased({
      status: 'completed',
      paymentStatus: 'transferred',
      scheduledEnd,
      nowMs: Date.now(),
    })).toBe(true)
  })

  it('sorts active and completed-released states in operational order', () => {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    const bookings: any[] = [
      { id: 'cancelled', status: 'cancelled', created_at: new Date(now).toISOString(), scheduled_start: new Date(now + 8 * oneHour).toISOString() },
      { id: 'completed-released', status: 'completed', payment: { status: 'authorized' }, created_at: new Date(now).toISOString(), scheduled_start: new Date(now - 4 * oneHour).toISOString(), scheduled_end: new Date(now - 30 * oneHour).toISOString() },
      { id: 'completed-awaiting', status: 'completed', payment: { status: 'authorized' }, created_at: new Date(now).toISOString(), scheduled_start: new Date(now - 2 * oneHour).toISOString(), scheduled_end: new Date(now - 2 * oneHour).toISOString() },
      { id: 'confirmed', status: 'confirmed', created_at: new Date(now).toISOString(), scheduled_start: new Date(now + 2 * oneHour).toISOString() },
      { id: 'in-progress', status: 'in_progress', created_at: new Date(now).toISOString(), scheduled_start: new Date(now - oneHour).toISOString() },
    ]

    const sorted = [...bookings].sort(compareBookingsByOperationalPriority)
    expect(sorted.map((b) => b.id)).toEqual([
      'in-progress',
      'confirmed',
      'completed-awaiting',
      'completed-released',
      'cancelled',
    ])
  })
})
