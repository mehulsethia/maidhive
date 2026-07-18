import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BookingInstructions } from '@/components/booking-instructions'
import { CancellationPaymentBreakdown } from '@/components/cancellation-payment-breakdown'
import { getCleaningSuppliesResponsibility } from '@/lib/cleaning-supplies'
import {
  getAdminPaymentStateLabel,
  getPaymentReleaseDescription,
  isNormalCancellationPaymentRelease,
} from '@/lib/cancellation-payment-state'
import type { BookingRead } from '@/types'

function cancelledBooking(overrides: Partial<BookingRead> = {}): BookingRead {
  return {
    id: 'booking_1',
    client_id: 'client_profile',
    cleaner_id: 'cleaner_profile',
    status: 'cancelled',
    service_type: 'standard',
    address: 'Address',
    city: 'Larnaca',
    postcode: '6015',
    scheduled_start: '2026-07-03T07:00:00.000Z',
    scheduled_end: '2026-07-03T09:00:00.000Z',
    duration_hours: 2,
    hourly_rate: 16,
    total_amount: 35.2,
    subtotal: 32,
    cleaner_payout: 32,
    platform_fee: 3.2,
    cancelled_at: '2026-07-01T06:00:00.000Z',
    cancelled_by: 'client_user',
    created_at: '2026-06-30T09:00:00.000Z',
    client: { id: 'client_profile', user: { id: 'client_user' } as any },
    cleaner: { id: 'cleaner_profile', user: { id: 'cleaner_user' } as any },
    payment: { id: 'payment_1', status: 'failed', failed_at: '2026-07-01T06:00:00.000Z' },
    ...overrides,
  }
}

describe('normal cancellation payment releases', () => {
  it('relabels legacy failed rows and describes an early client release', () => {
    const booking = cancelledBooking()

    expect(isNormalCancellationPaymentRelease(booking)).toBe(true)
    expect(getAdminPaymentStateLabel(booking)).toBe('payment released')
    expect(getPaymentReleaseDescription(booking)).toBe(
      'Client payment authorisation was released because the client cancelled more than 24 hours before the scheduled start.',
    )
  })

  it('does not hide an automatic re-authorisation failure', () => {
    const booking = cancelledBooking({
      cancelled_by: null,
      cancellation_reason: 'Re-authorization was not completed within the grace period.',
    })

    expect(isNormalCancellationPaymentRelease(booking)).toBe(false)
    expect(getAdminPaymentStateLabel(booking)).toBe('failed')
  })

  it('keeps client cancellation charges off cleaner cards', () => {
    const booking = cancelledBooking({ payment: { id: 'payment_1', status: 'released' } })
    const clientMarkup = renderToStaticMarkup(
      createElement(CancellationPaymentBreakdown, { booking, compact: true }),
    )
    const cleanerMarkup = renderToStaticMarkup(
      createElement(CancellationPaymentBreakdown, { booking, compact: true, audience: 'cleaner' }),
    )

    expect(clientMarkup).toContain('You have not been charged')
    expect(clientMarkup).not.toContain('€0.00')
    expect(cleanerMarkup).not.toContain('cancellation charge')
    expect(cleanerMarkup).toContain('No cleaner compensation')
  })

  it('shows only cleaner compensation for a charged client cancellation', () => {
    const booking = cancelledBooking({
      payment: {
        id: 'payment_1',
        status: 'transferred',
        amount: 35.2,
        refund_amount: 22,
        platform_fee: 1.2,
        cleaner_payout: 12,
        transferred_at: '2026-07-01T06:01:00.000Z',
      },
    })
    const cleanerMarkup = renderToStaticMarkup(
      createElement(CancellationPaymentBreakdown, { booking, compact: true, audience: 'cleaner' }),
    )

    expect(cleanerMarkup).toContain('Cleaner compensation: €12.00')
    expect(cleanerMarkup).not.toContain('Cancellation charge')
    expect(cleanerMarkup).not.toContain('€13.20')
  })

  it('retains no-charge confirmation when the cleaner cancelled', () => {
    const booking = cancelledBooking({
      cancelled_by: 'cleaner_user',
      payment: { id: 'payment_1', status: 'released' },
    })
    const cleanerMarkup = renderToStaticMarkup(
      createElement(CancellationPaymentBreakdown, { booking, compact: true, audience: 'cleaner' }),
    )

    expect(cleanerMarkup).toContain('Cancelled by you')
    expect(cleanerMarkup).toContain('Final payout: €0.00')
    expect(cleanerMarkup).not.toContain('No cancellation charge')
  })
})

describe('cleaning supplies responsibility', () => {
  it.each([
    ['I will provide cleaning supplies', 'Provided by client'],
    ['client_provides', 'Provided by client'],
    ['Cleaner should bring supplies', 'Provided by cleaner'],
    ['cleaner_brings', 'Provided by cleaner'],
  ])('maps %s to %s', (value, expected) => {
    expect(getCleaningSuppliesResponsibility(value)).toBe(expected)
  })

  it('renders explicit responsibility from legacy booking instructions', () => {
    const markup = renderToStaticMarkup(createElement(BookingInstructions, {
      value: 'Job type: Regular clean\nCleaning supplies: I will provide cleaning supplies',
    }))

    expect(markup).toContain('Cleaning supplies:')
    expect(markup).toContain('Provided by client')
    expect(markup).not.toContain('I will provide cleaning supplies')
  })
})
