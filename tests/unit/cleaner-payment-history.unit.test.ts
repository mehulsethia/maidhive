import { describe, expect, it } from 'vitest'
import {
  buildCleanerPaymentHistory,
  classifyCleanerPaymentHistoryBooking,
  dedupeBookingsById,
  getReleasedCleanerEarnings,
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
  it('maps completed booking to awaiting/released based on payment transfer', () => {
    const completed = booking({ status: 'completed', payment: { id: 'p1', status: 'authorized' } })
    const deadline = getBookingReportDeadlineMs(completed.scheduled_end)

    const before = classifyCleanerPaymentHistoryBooking(completed, deadline - 1)
    const after = classifyCleanerPaymentHistoryBooking(completed, deadline + 1)

    expect(before?.label).toBe('Awaiting release')
    expect(before?.paymentType).toBe('Booking payout')
    expect(before?.tone).toBe('warn')
    expect(after?.label).toBe('Awaiting release')
    expect(after?.tone).toBe('warn')

    const transferred = booking({ status: 'completed', payment: { id: 'p1-released', status: 'transferred' } })
    expect(classifyCleanerPaymentHistoryBooking(transferred)?.label).toBe('Released')

    const resolvedNoShow = booking({
      status: 'completed',
      payment: { id: 'p1-no-show', status: 'transferred' },
      dispute: {
        id: 'd1',
        status: 'resolved',
        reason: 'Client no-show',
        issue_type: 'client_no_show',
        created_at: new Date().toISOString(),
      },
    })
    expect(classifyCleanerPaymentHistoryBooking(resolvedNoShow)?.paymentType).toBe('No-show compensation')
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
    expect(classifyCleanerPaymentHistoryBooking(disputed)?.paymentType).toBe('Payment issue')
    expect(classifyCleanerPaymentHistoryBooking(failed)?.label).toBe('Payment issue - admin review')
  })

  it('maps cancelled bookings to cancellation payout labels', () => {
    const noPayout = booking({
      id: 'booking_cancelled_no_payout',
      status: 'cancelled',
      cleaner_payout: 32,
      payment: { id: 'p7', status: 'refunded', cleaner_payout: 0 },
    })
    const compensationDue = booking({
      id: 'booking_cancelled_comp_due',
      status: 'cancelled',
      payment: { id: 'p8', status: 'captured', cleaner_payout: 16 },
    })
    const compensationReleased = booking({
      id: 'booking_cancelled_comp_released',
      status: 'cancelled',
      payment: { id: 'p9', status: 'transferred', cleaner_payout: 16, transferred_at: new Date().toISOString() },
    })
    const noShowReleased = booking({
      id: 'booking_no_show_comp_released',
      status: 'cancelled',
      cancellation_reason: 'Client no-show confirmed',
      payment: { id: 'p10', status: 'transferred', cleaner_payout: 20, transferred_at: new Date().toISOString() },
    })

    expect(classifyCleanerPaymentHistoryBooking(noPayout)).toMatchObject({
      label: 'Cancelled - no payout due',
      amount: 0,
      tone: 'warn',
    })
    expect(classifyCleanerPaymentHistoryBooking(compensationDue)).toMatchObject({
      label: 'Cancellation compensation: €16.00',
      amount: 16,
      tone: 'warn',
    })
    expect(classifyCleanerPaymentHistoryBooking(compensationReleased)).toMatchObject({
      paymentType: 'Cancellation compensation',
      label: 'Cancellation compensation released: €16.00',
      amount: 16,
      tone: 'ok',
    })
    expect(classifyCleanerPaymentHistoryBooking(noShowReleased)?.paymentType).toBe('No-show compensation')
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

  it('includes transferred cancellation and no-show compensation in released earnings', () => {
    const completedPayout = booking({
      id: 'completed_released',
      status: 'completed',
      cleaner_payout: 32,
      payment: { id: 'p11', status: 'transferred', cleaner_payout: 32 },
    })
    const cancellationCompensation = booking({
      id: 'cancelled_released',
      status: 'cancelled',
      payment: { id: 'p12', status: 'transferred', cleaner_payout: 16 },
    })
    const noShowCompensation = booking({
      id: 'no_show_released',
      status: 'cancelled',
      cancellation_reason: 'Client no-show',
      payment: { id: 'p13', status: 'transferred', cleaner_payout: 20 },
    })
    const pendingCompensation = booking({
      id: 'cancelled_pending',
      status: 'cancelled',
      payment: { id: 'p14', status: 'captured', cleaner_payout: 12 },
    })
    const disputedCapturedPayout = booking({
      id: 'disputed_captured',
      status: 'disputed',
      payment: { id: 'p15', status: 'captured', cleaner_payout: 32 },
    })

    expect(getReleasedCleanerEarnings([
      completedPayout,
      cancellationCompensation,
      noShowCompensation,
      pendingCompensation,
      disputedCapturedPayout,
    ])).toBe(68)
  })

  it('uses final adjusted payout for released partial dispute refunds', () => {
    const adjusted = booking({
      id: 'partial_dispute_released',
      status: 'completed',
      cleaner_payout: 24,
      payment: {
        id: 'p16',
        status: 'transferred',
        cleaner_payout: 24,
        refund_amount: 8,
      },
      dispute: {
        id: 'd16',
        status: 'resolved',
        reason: 'Partial service issue',
        issue_type: 'service_issue',
        resolution_type: 'partial_refund',
        refund_amount: 8,
        created_at: new Date().toISOString(),
      },
    })

    const history = classifyCleanerPaymentHistoryBooking(adjusted)
    expect(history).toMatchObject({
      label: 'Released',
      amount: 16,
    })
    expect(getReleasedCleanerEarnings([adjusted])).toBe(16)
  })
})
