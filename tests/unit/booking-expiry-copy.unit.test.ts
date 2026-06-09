import { describe, expect, it } from 'vitest'
import {
  getCleanerBookingRequestDeadlineCopy,
  getClientBookingRequestDeadlineCopy,
} from '@/lib/booking-expiry-copy'

describe('booking request expiry copy', () => {
  it('uses cleaner-facing response deadline copy without client payment language', () => {
    const copy = getCleanerBookingRequestDeadlineCopy({
      accept_by: '2026-06-09T00:30:00.000Z',
    })

    expect(copy).toContain('Please respond to this booking request before')
    expect(copy).toContain('If you do not respond before then, the request will expire automatically.')
    expect(copy).not.toMatch(/card authori[sz]ation/i)
    expect(copy).not.toContain('If the cleaner does not respond')
  })

  it('keeps client-facing copy focused on cleaner response and payment release', () => {
    const copy = getClientBookingRequestDeadlineCopy({
      accept_by: '2026-06-09T00:30:00.000Z',
    })

    expect(copy).toContain('must be responded to by the cleaner')
    expect(copy).toMatch(/card authori[sz]ation will be released/i)
  })
})
