import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import {
  getAdminClientCancellationCopy,
  getClientCancellationContext,
} from '@/lib/client-cancellation-context'
import { getClientPaymentSummary } from '@/lib/client-payment-summary'
import { getClientTotalSpent } from '@/lib/client-spend'
import {
  getBookingCleaningTypeLabel,
  getBookingServiceClassificationLabel,
} from '@/lib/booking-service-labels'
import {
  getAdminCancellationRecordSummary,
  getCancellationPolicyBandLabel,
} from '@/lib/cancellation-record'
import type { BookingRead } from '@/types'

function cancelledBooking(overrides: Partial<BookingRead> = {}): BookingRead {
  return {
    id: 'booking_1', client_id: 'client_profile', cleaner_id: 'cleaner_profile', status: 'cancelled',
    service_type: 'standard', address: 'Address', city: 'Larnaca', postcode: '6015',
    scheduled_start: '2026-06-20T12:00:00.000Z', scheduled_end: '2026-06-20T14:00:00.000Z',
    duration_hours: 2, hourly_rate: 16, total_amount: 35.2, subtotal: 32, cleaner_payout: 32,
    platform_fee: 3.2, accepted_at: '2026-06-18T10:00:00.000Z',
    confirmed_at: '2026-06-18T10:05:00.000Z', cancelled_at: '2026-06-20T00:30:00.000Z',
    cancelled_by: 'client_user', created_at: '2026-06-18T09:00:00.000Z',
    client: { id: 'client_profile', user: { id: 'client_user' } as any },
    cleaner: { id: 'cleaner_profile', user: { id: 'cleaner_user' } as any },
    ...overrides,
  }
}

describe('client account display rules', () => {
  it('hides cleaner payout release states from client completed badges', () => {
    const clientBadge = renderToStaticMarkup(createElement(BookingStatusBadge, {
      status: 'completed', paymentStatus: 'transferred', audience: 'client',
    }))
    const cleanerBadge = renderToStaticMarkup(createElement(BookingStatusBadge, {
      status: 'completed', paymentStatus: 'transferred', audience: 'cleaner',
    }))
    expect(clientBadge).toContain('Completed')
    expect(clientBadge).not.toContain('Released')
    expect(clientBadge).not.toContain('Awaiting Release')
    expect(cleanerBadge).toContain('Completed - Released')
  })

  it('does not show awaiting release for fully refunded completed bookings', () => {
    const adminBadge = renderToStaticMarkup(createElement(BookingStatusBadge, {
      status: 'completed', paymentStatus: 'refunded', audience: 'admin',
    }))
    const cleanerBadge = renderToStaticMarkup(createElement(BookingStatusBadge, {
      status: 'completed', paymentStatus: 'refunded', audience: 'cleaner', cleanerNoPayout: true,
    }))

    expect(adminBadge).toContain('Completed')
    expect(adminBadge).not.toContain('Awaiting Release')
    expect(adminBadge).not.toContain('Released')
    expect(cleanerBadge).toContain('Completed · No payout')
    expect(cleanerBadge).not.toContain('Awaiting Release')
  })

  it('explains each client cancellation window in plain language', () => {
    expect(getClientCancellationContext(cancelledBooking())).toContain('less than 12 hours')
    expect(getClientCancellationContext(cancelledBooking({ cancelled_at: '2026-06-19T18:00:00.000Z' })))
      .toContain('between 12 and 24 hours')
    expect(getClientCancellationContext(cancelledBooking({ cancelled_at: '2026-06-18T08:00:00.000Z' })))
      .toContain('more than 24 hours')
    expect(getClientCancellationContext(cancelledBooking({ cancelled_by: 'cleaner_user' })))
      .toBe('Cleaner cancelled this booking. No client cancellation charge applies.')
  })

  it('uses the exact 12-24 hour policy outcome in the admin audit copy', () => {
    const copy = getAdminClientCancellationCopy(cancelledBooking({
      cancelled_at: '2026-06-19T18:00:00.000Z',
      cancellation_reason: 'Cancelled by client within 24 hours of scheduled start',
    }))

    expect(copy).toEqual({
      stateLabel: 'Cancelled by client between 12 and 24 hours before scheduled start',
      actionLogDescription:
        'Client cancelled between 12 and 24 hours before scheduled start. €5 cancellation charge applied. No cleaner payout due.',
    })
  })

  it('defines spend as net successfully captured money across payment outcomes', () => {
    expect(getClientTotalSpent([
      { status: 'transferred', amount: 35.2 },
      { status: 'captured', amount: 35.2, refundAmount: 30.2 },
      { status: 'transferred', amount: 26.4, refundAmount: 8 },
      { status: 'partially_refunded', amount: 80, refundAmount: 20 },
      { status: 'refunded', amount: 40, refundAmount: 40 },
      { status: 'authorized', amount: 50 },
    ])).toBe(118.6)
  })

  it('summarises partial refunds as original, refund, and final paid amount', () => {
    const summary = getClientPaymentSummary({
      ...cancelledBooking({ status: 'completed' }),
      total_amount: 26.4,
      payment: {
        id: 'payment_1',
        status: 'captured',
        amount: 26.4,
        refund_amount: 8,
      },
    })

    expect(summary).toMatchObject({
      originalTotal: 26.4,
      refundAmount: 8,
      finalAmountPaid: 18.4,
      isPartiallyRefunded: true,
      refundLabel: 'Partial refund',
      dashboardRefundLabel: 'Partial refund',
      financialStatusLabel: 'Partially refunded',
    })
  })

  it('summarises full refunds with full-refund wording', () => {
    const summary = getClientPaymentSummary({
      ...cancelledBooking({ status: 'completed' }),
      total_amount: 22,
      payment: {
        id: 'payment_full_refund',
        status: 'refunded',
        amount: 22,
        refund_amount: 22,
      },
    })

    expect(summary).toMatchObject({
      originalTotal: 22,
      refundAmount: 22,
      finalAmountPaid: 0,
      isFullyRefunded: true,
      isPartiallyRefunded: false,
      refundLabel: 'Full refund',
      dashboardRefundLabel: 'Refunded',
      financialStatusLabel: 'Refunded',
    })
  })

  it('summarises released authorisations as not charged for cancelled bookings', () => {
    const summary = getClientPaymentSummary({
      ...cancelledBooking({ cancelled_by: 'cleaner_user' }),
      total_amount: 33,
      payment: {
        id: 'payment_released_hold',
        status: 'released',
        amount: 33,
        refund_reason: 'payment_authorisation_released',
      },
    })

    expect(summary).toMatchObject({
      originalTotal: 33,
      refundAmount: 0,
      finalAmountPaid: 0,
      dashboardRefundLabel: 'You have not been charged',
      financialStatusLabel: 'You have not been charged',
    })
    expect(summary.cancellationPaymentOutcome).toMatchObject({
      primaryMessage: 'You have not been charged.',
      amountLabel: 'Temporary payment hold released',
      amount: 33,
    })
  })

  it('shows the client selected cleaning type before internal service classification', () => {
    const booking = cancelledBooking({
      service_type: 'standard',
      special_instructions: 'Job type: One-off clean\nCleaning supplies: cleaner_brings',
    })

    expect(getBookingCleaningTypeLabel(booking)).toBe('One-off clean')
    expect(getBookingServiceClassificationLabel(booking)).toBe('Standard Clean')
  })

  it('summarises cleaner cancellation actor and precise 12-24 hour policy band for admin records', () => {
    const booking = cancelledBooking({
      cancelled_by: 'cleaner_user',
      scheduled_start: '2026-07-17T11:30:00.000Z',
      cancelled_at: '2026-07-16T20:00:00.000Z',
    })

    expect(getCancellationPolicyBandLabel(booking)).toBe('Cleaner cancellation 12–24 hours before start')
    expect(getAdminCancellationRecordSummary(booking)).toContain('Cancelled by cleaner')
    expect(getAdminCancellationRecordSummary(booking)).toContain('15 hours 30 minutes before scheduled start')
    expect(getAdminCancellationRecordSummary(booking)).toContain('Policy band: Cleaner cancellation 12–24 hours before start')
  })
})
