import { z } from 'zod'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export const dayScheduleSchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  start_time: z.string().regex(timeRegex, 'Must be HH:MM'),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM'),
  buffer_minutes: z.number().int().min(0).default(30),
  is_active: z.boolean().default(true),
})

export const setScheduleSchema = z.object({
  schedules: z.array(dayScheduleSchema).min(1).max(28),
})

export const addBlockedTimeSchema = z.object({
  start_datetime: z.string().datetime(),
  end_datetime: z.string().datetime(),
  reason: z.string().max(500).optional(),
})

export const availableSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  duration_hours: z.coerce.number().min(1),
})
