import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { availabilityRepo } from '@/server/repositories/availability.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { setScheduleSchema } from '@/server/schemas/availability.schema'

export const GET = requireCleaner(async (_req, _ctx, user) => {
  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)
  const schedules = await availabilityRepo.getSchedule(cleaner.id)
  return ok(schedules)
})

export const PUT = requireCleaner(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = setScheduleSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  const schedules = await availabilityRepo.upsertSchedule(
    cleaner.id,
    parsed.data.schedules.map((s) => ({
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      bufferMinutes: s.buffer_minutes,
      isActive: s.is_active,
    })),
  )
  return ok(schedules)
})
