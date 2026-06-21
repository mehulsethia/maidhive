import { describe, expect, it } from 'vitest'
import { getCancellationOriginLabel } from '@/lib/cancellation-origin'
import type { BookingRead } from '@/types'

function cancelledBooking(cancelledBy: string | null): BookingRead {
  return {
    id: 'booking_1',
    client_id: 'client_profile',
    cleaner_id: 'cleaner_profile',
    status: 'cancelled',
    service_type: 'standard',
    address: 'Address',
    city: 'Larnaca',
    postcode: '6015',
    scheduled_start: '2026-06-20T10:00:00.000Z',
    scheduled_end: '2026-06-20T12:00:00.000Z',
    duration_hours: 2,
    hourly_rate: 16,
    total_amount: 35.2,
    cleaner_payout: 32,
    platform_fee: 3.2,
    cancelled_by: cancelledBy,
    created_at: '2026-06-19T10:00:00.000Z',
    client: { id: 'client_profile', user: { id: 'client_user' } as any },
    cleaner: { id: 'cleaner_profile', user: { id: 'cleaner_user' } as any },
  }
}

describe('Cleaner cancellation origin label', () => {
  it('identifies client, cleaner, platform and unavailable origins', () => {
    expect(getCancellationOriginLabel(cancelledBooking('client_user'))).toBe('Cancelled by client')
    expect(getCancellationOriginLabel(cancelledBooking('cleaner_user'))).toBe('Cancelled by cleaner')
    expect(getCancellationOriginLabel(cancelledBooking('admin_user'))).toBe('Cancelled by platform')
    expect(getCancellationOriginLabel(cancelledBooking(null))).toBeNull()
    expect(getCancellationOriginLabel({
      ...cancelledBooking(null),
      cancellation_reason: 'Cancelled by client within 24 hours of scheduled start',
    })).toBe('Cancelled by client')
  })
})
