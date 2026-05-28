import { describe, expect, it } from 'vitest'
import { bookingActionSchema, cancelBookingSchema } from '@/server/schemas/booking.schema'

describe('F09 cancel/reschedule policy unit coverage', () => {
  it('UT-CANCEL-01 cancellation reason validator accepts optional reason and rejects >500 chars', () => {
    const valid = cancelBookingSchema.safeParse({ reason: 'Need to cancel due to travel change' })
    const invalid = cancelBookingSchema.safeParse({ reason: 'x'.repeat(501) })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('UT-CANCEL-02 reschedule/amend actions require proposed_start', () => {
    const amendMissing = bookingActionSchema.safeParse({ action: 'amend_start_time' })
    const proposeMissing = bookingActionSchema.safeParse({ action: 'propose_alternative' })

    expect(amendMissing.success).toBe(false)
    expect(proposeMissing.success).toBe(false)
  })

  it('UT-CANCEL-03 reschedule/amend actions accept valid proposed_start ISO datetime', () => {
    const amendValid = bookingActionSchema.safeParse({
      action: 'amend_start_time',
      proposed_start: '2026-06-15T09:30:00.000Z',
    })
    const counterValid = bookingActionSchema.safeParse({
      action: 'counter_proposal',
      proposed_start: '2026-06-16T12:00:00.000Z',
    })

    expect(amendValid.success).toBe(true)
    expect(counterValid.success).toBe(true)
  })

  it('UT-CANCEL-04 start action location payload enforces valid coordinate bounds', () => {
    const valid = bookingActionSchema.safeParse({
      action: 'start',
      start_location: { latitude: 34.91, longitude: 33.63, accuracy_m: 12 },
    })

    const invalid = bookingActionSchema.safeParse({
      action: 'start',
      start_location: { latitude: 123.45, longitude: 33.63 },
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })
})
