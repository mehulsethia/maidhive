import { describe, expect, it } from 'vitest'
import { sanitizeBookingForRole, sanitizeBookingsForRole } from '@/server/services/booking-visibility.service'

describe('F17 list/count visibility unit coverage', () => {
  it('UT-LIST-01 cleaner visibility sanitizer removes direct phone when outside reveal window', () => {
    const booking: any = {
      id: 'booking_1',
      status: 'confirmed',
      city: 'Larnaca',
      scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() + 26 * 60 * 60 * 1000),
      createdAt: new Date(),
      client: {
        createdAt: new Date(),
        _count: { bookings: 3 },
        user: { name: 'Jane Doe', phone: '+35799000000' },
      },
    }

    const sanitized = sanitizeBookingForRole(booking, 'cleaner')
    expect(sanitized.client.user.name).toBe('Jane')
    expect(sanitized.client.user.phone).toBeNull()
    expect(sanitized.cleanerPrivacy.addressVisible).toBe(true)
  })

  it('UT-LIST-02 cleaners do not see exact address for non-operational statuses', () => {
    const booking: any = {
      id: 'booking_2',
      status: 'draft',
      city: 'Larnaca',
      address: 'Hidden address',
      client: { user: { name: 'Client X', phone: null } },
    }

    const sanitized = sanitizeBookingForRole(booking, 'cleaner')
    expect(sanitized.address).toContain('Approximate area near')
    expect(sanitized.cleanerPrivacy.addressVisible).toBe(false)
  })

  it('UT-LIST-03 bulk sanitizer applies same policy across list payload', () => {
    const list: any[] = [
      { id: 'b1', status: 'draft', city: 'Larnaca', client: { user: { name: 'A B', phone: null } } },
      { id: 'b2', status: 'confirmed', city: 'Larnaca', client: { user: { name: 'C D', phone: null } } },
    ]

    const sanitized = sanitizeBookingsForRole(list, 'cleaner')
    expect(sanitized.length).toBe(2)
    expect(sanitized[0].cleanerPrivacy).toBeTruthy()
    expect(sanitized[1].cleanerPrivacy).toBeTruthy()
  })
})
