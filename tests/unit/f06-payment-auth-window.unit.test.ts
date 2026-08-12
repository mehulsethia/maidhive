import { describe, expect, it } from 'vitest'
import { computeAcceptByFromAuthorizedAt } from '@/server/lib/booking-request-window'
import { getClientBookingRequestDeadlineCopy } from '@/lib/booking-expiry-copy'

describe('F06 Payment authorization sync unit scaffold', () => {
  it('UT-PAYAUTH-02 uses request TTL when booking is far in the future', () => {
    const authorizedAt = new Date('2026-06-01T08:00:00.000Z')
    const scheduledStart = new Date('2026-06-05T08:00:00.000Z')

    const acceptBy = computeAcceptByFromAuthorizedAt(authorizedAt, scheduledStart, {
      ttlMinutes: 60,
      cutoffBeforeStartMinutes: 30,
    })

    expect(acceptBy.toISOString()).toBe('2026-06-01T09:00:00.000Z')
  })

  it('UT-PAYAUTH-02 uses start cutoff when start is earlier than TTL', () => {
    const authorizedAt = new Date('2026-06-01T08:00:00.000Z')
    const scheduledStart = new Date('2026-06-01T08:40:00.000Z')

    const acceptBy = computeAcceptByFromAuthorizedAt(authorizedAt, scheduledStart, {
      ttlMinutes: 120,
      cutoffBeforeStartMinutes: 15,
    })

    expect(acceptBy.toISOString()).toBe('2026-06-01T08:25:00.000Z')
  })

  it('uses payment re-authorisation guidance once an accepted booking requires client action', () => {
    const copy = getClientBookingRequestDeadlineCopy({
      accept_by: '2026-08-10T13:25:00.000Z',
      pay_by: '2026-08-12T08:00:00.000Z',
      reauthorization_required: true,
    })

    expect(copy).toContain('Payment re-authorisation required')
    expect(copy).toContain('Please re-authorise your card by')
    expect(copy).toContain('Your booking has already been accepted by the cleaner.')
    expect(copy).not.toContain('This booking request must be responded to by the cleaner')
  })

  it.todo('UT-PAYAUTH-01 authorization status mapper accepts valid transitions')
  it.todo('UT-PAYAUTH-03 invalid currency/status paths move payment safely')
})
