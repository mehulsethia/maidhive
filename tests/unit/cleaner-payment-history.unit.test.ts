import { describe, expect, it } from 'vitest'
import {
  buildCleanerPaymentHistory,
  classifyCleanerPaymentHistoryBooking,
  dedupeBookingsById,
} from '@/lib/cleaner-payment-history'
import { getBookingReportDeadlineMs } from '@/lib/booking-release'
import type { BookingRead } from '@/types'

function booking(overrides: Partial<BookingRead>): BookingRead {
  return {
    id: 'booking_1',
    client_id: 'client_1',
    cleaner_id: 'cleaner_1',
    status: 'completed',
    service_type: 'standard',
    address: 'Addr',
    city: 'Larnaca',
    postcode: '6015',
    scheduled_start: new Date('2026-05-10T08:00:00.000Z').toISOString(),
    scheduled_end: new Date('2026-05-10T10:00:00.000Z').toISOString(),
    duration_hours: 2,
    hourly_rate: 16,
    total_amount: 35.2,
    cleaner_payout: 32,
    platform_fee: 3.2,
    created_at: new Date('2026-05-09T10:00:00.000Z').toISOString(),
    ...overrides,
  }
}

describe('Cleaner payment history mapping', () => {
  it('maps completed booking to awaiting/released based on report window', () => {
    const completed = booking({ status: 'completed', payment: { id: 'p1', status: 'authorized' } })
    const deadline = getBookingReportDeadlineMs(completed.scheduled_end)

    const before = classifyCleanerPaymentHistoryBooking(completed, deadline - 1)
    const after = classifyCleanerPaymentHistoryBooking(completed, deadline + 1)

    expect(before?.label).toBe('Awaiting release')
    expect(before?.tone).toBe('warn')
    expect(after?.label).toBe('Released')
    expect(after?.tone).toBe('ok')
  })

  it('maps active authorized bookings and failed/disputed bookings to correct labels', () => {
    const confirmedAuthorized = booking({
      id: 'booking_confirmed',
      status: 'confirmed',
      payment: { id: 'p2', status: 'authorized' },
    })
    const disputed = booking({
      id: 'booking_disputed',
      status: 'disputed',
      payment: { id: 'p3', status: 'captured' },
    })
    const failed = booking({
      id: 'booking_failed',
      status: 'cancelled',
      payment: { id: 'p4', status: 'failed' },
    })

    expect(classifyCleanerPaymentHistoryBooking(confirmedAuthorized)?.label).toBe('Payment authorised')
    expect(classifyCleanerPaymentHistoryBooking(disputed)?.label).toBe('Payment issue - admin review')
    expect(classifyCleanerPaymentHistoryBooking(failed)?.label).toBe('Payment issue - admin review')
  })

  it('dedupes bookings and returns history sorted by scheduled start desc', () => {
    const older = booking({
      id: 'older',
      status: 'confirmed',
      scheduled_start: new Date('2026-05-09T08:00:00.000Z').toISOString(),
      payment: { id: 'p5', status: 'authorized' },
    })
    const newer = booking({
      id: 'newer',
      status: 'confirmed',
      scheduled_start: new Date('2026-05-11T08:00:00.000Z').toISOString(),
      payment: { id: 'p6', status: 'captured' },
    })

    const deduped = dedupeBookingsById([older, newer, older])
    expect(deduped.map((b) => b.id)).toEqual(['older', 'newer'])

    const history = buildCleanerPaymentHistory(deduped)
    expect(history.map((entry) => entry.booking.id)).toEqual(['newer', 'older'])
  })
})
