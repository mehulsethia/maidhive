import { describe, expect, it } from 'vitest'
import { saveBookingFlowDraftSchema } from '@/server/schemas/booking.schema'

describe('F04 Booking draft lifecycle unit scaffold', () => {
  it('UT-DRAFT-01 accepts a valid draft payload', () => {
    const payload = {
      cleaner_id: '11111111-1111-1111-1111-111111111111',
      booking_id: '22222222-2222-2222-2222-222222222222',
      last_step: 2,
      duration_hours: 3,
      selected_date: '2026-06-10',
      selected_slot: '2026-06-10T08:00:00.000Z',
      payload: {
        service_type: 'standard',
      },
    }

    const parsed = saveBookingFlowDraftSchema.parse(payload)
    expect(parsed.cleaner_id).toBe(payload.cleaner_id)
    expect(parsed.last_step).toBe(2)
    expect(parsed.selected_slot).toBe('2026-06-10T08:00:00.000Z')
  })

  it('UT-DRAFT-01 rejects step outside supported booking wizard bounds', () => {
    const parsed = saveBookingFlowDraftSchema.safeParse({
      cleaner_id: '11111111-1111-1111-1111-111111111111',
      last_step: 4,
    })
    expect(parsed.success).toBe(false)
  })

  it.todo('UT-DRAFT-02 draft expiry/cleanup helper ignores non-eligible states')
  it.todo('UT-DRAFT-03 matching draft reuse logic picks correct overlapping draft')
})
