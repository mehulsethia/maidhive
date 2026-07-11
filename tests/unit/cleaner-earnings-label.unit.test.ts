import { describe, expect, it } from 'vitest'
import { getCleanerEarningsLabel } from '@/lib/cleaner-earnings-label'
import type { BookingStatus } from '@/types'

function labelFor(status: BookingStatus, scheduledEndOffsetHours: number, paymentStatus?: string | null) {
  const now = Date.now()
  const scheduledEnd = new Date(now + scheduledEndOffsetHours * 60 * 60 * 1000).toISOString()
  return getCleanerEarningsLabel({ status, paymentStatus, scheduledEnd })
}

describe('Cleaner earnings label', () => {
  it('shows projected earnings only for confirmed/in_progress/completed-awaiting-release', () => {
    expect(labelFor('confirmed', 10, 'authorized')).toBe('You will earn')
    expect(labelFor('in_progress', 1, 'authorized')).toBe('You will earn')
    expect(labelFor('completed', 1, 'authorized')).toBe('You will earn')
  })

  it('shows earned label for released completed bookings', () => {
    expect(labelFor('completed', -30, 'authorized')).toBe('You will earn')
    expect(labelFor('completed', 10, 'transferred')).toBe('You earned')
  })

  it('never shows projected earnings for declined/expired/cancelled bookings', () => {
    expect(labelFor('declined', 10, 'authorized')).toBe('Booking value')
    expect(labelFor('expired', 10, 'authorized')).toBe('Booking value')
    expect(labelFor('cancelled', 10, 'authorized')).toBe('Booking value')
  })

  it('shows paused payout wording for under-review bookings', () => {
    expect(labelFor('disputed', 10, 'authorized')).toBe('Payout pending review')
  })
})
