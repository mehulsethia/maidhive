import { z } from 'zod'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export const dayScheduleSchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  start_time: z.string().regex(timeRegex, 'Must be HH:MM'),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM'),
  buffer_minutes: z.number().int().min(0).default(30),
  is_active: z.boolean().default(true),
}).superRefine((slot, ctx) => {
  const [sh, sm] = slot.start_time.split(':').map(Number)
  const [eh, em] = slot.end_time.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em

  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_time'],
      message: 'end_time must be after start_time',
    })
  }
})

export const setScheduleSchema = z.object({
  schedules: z.array(dayScheduleSchema).min(1).max(28),
}).superRefine((payload, ctx) => {
  const byDay = new Map<number, Array<(typeof payload.schedules)[number]>>()

  for (const slot of payload.schedules) {
    if (!slot.is_active) continue
    if (!byDay.has(slot.day_of_week)) byDay.set(slot.day_of_week, [])
    byDay.get(slot.day_of_week)!.push(slot)
  }

  for (const [day, slots] of byDay) {
    const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time))
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]

      const [peh, pem] = prev.end_time.split(':').map(Number)
      const [csh, csm] = curr.start_time.split(':').map(Number)
      const prevEnd = peh * 60 + pem
      const currStart = csh * 60 + csm
      const requiredGap = Math.max(0, prev.buffer_minutes)

      if (currStart < prevEnd + requiredGap) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schedules'],
          message: `Day ${day}: overlapping/invalid sequence. Next slot must start at least ${requiredGap} minutes after previous end.`,
        })
        break
      }
    }
  }
})

export const addBlockedTimeSchema = z.object({
  start_datetime: z.string().datetime(),
  end_datetime: z.string().datetime(),
  reason: z.string().max(500).optional(),
}).superRefine((payload, ctx) => {
  const start = new Date(payload.start_datetime)
  const end = new Date(payload.end_datetime)
  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_datetime'],
      message: 'end_datetime must be after start_datetime',
    })
  }
})

export const availableSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  duration_hours: z.coerce.number().min(1),
  exclude_booking_id: z.string().uuid().optional(),
})

export const availableDatesQuerySchema = z.object({
  duration_hours: z.coerce.number().min(1),
  days_ahead: z.coerce.number().int().min(1).max(28).default(28),
})
