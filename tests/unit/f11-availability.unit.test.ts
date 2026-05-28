import { describe, expect, it } from 'vitest'
import {
  addBlockedTimeSchema,
  availableDatesQuerySchema,
  availableSlotsQuerySchema,
  dayScheduleSchema,
  setScheduleSchema,
} from '@/server/schemas/availability.schema'

describe('F11 availability conflict unit coverage', () => {
  it('UT-AVAIL-01 day schedule validates valid time ranges and rejects end<=start', () => {
    const valid = dayScheduleSchema.safeParse({
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      buffer_minutes: 30,
      is_active: true,
    })

    const invalid = dayScheduleSchema.safeParse({
      day_of_week: 1,
      start_time: '17:00',
      end_time: '09:00',
      buffer_minutes: 30,
      is_active: true,
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('UT-AVAIL-02 set schedule rejects overlapping active slots on same day', () => {
    const overlapping = setScheduleSchema.safeParse({
      schedules: [
        { day_of_week: 2, start_time: '09:00', end_time: '11:00', buffer_minutes: 30, is_active: true },
        { day_of_week: 2, start_time: '11:15', end_time: '13:00', buffer_minutes: 30, is_active: true },
      ],
    })

    const nonOverlapping = setScheduleSchema.safeParse({
      schedules: [
        { day_of_week: 2, start_time: '09:00', end_time: '11:00', buffer_minutes: 30, is_active: true },
        { day_of_week: 2, start_time: '11:30', end_time: '13:00', buffer_minutes: 30, is_active: true },
      ],
    })

    expect(overlapping.success).toBe(false)
    expect(nonOverlapping.success).toBe(true)
  })

  it('UT-AVAIL-03 blocked time schema enforces end after start', () => {
    const valid = addBlockedTimeSchema.safeParse({
      start_datetime: '2026-06-20T00:00:00.000Z',
      end_datetime: '2026-06-20T23:00:00.000Z',
      reason: 'Holiday',
    })

    const invalid = addBlockedTimeSchema.safeParse({
      start_datetime: '2026-06-20T10:00:00.000Z',
      end_datetime: '2026-06-20T09:59:00.000Z',
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('UT-AVAIL-04 slots/dates query schemas validate duration, date, and max window bounds', () => {
    const validSlots = availableSlotsQuerySchema.safeParse({
      date: '2026-06-20',
      duration_hours: 2,
    })

    const invalidSlots = availableSlotsQuerySchema.safeParse({
      date: '20-06-2026',
      duration_hours: 0,
    })

    const validDates = availableDatesQuerySchema.safeParse({ duration_hours: 2, days_ahead: 14 })
    const invalidDates = availableDatesQuerySchema.safeParse({ duration_hours: 2, days_ahead: 45 })

    expect(validSlots.success).toBe(true)
    expect(invalidSlots.success).toBe(false)
    expect(validDates.success).toBe(true)
    expect(invalidDates.success).toBe(false)
  })
})
