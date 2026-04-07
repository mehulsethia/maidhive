import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { availabilityRepo } from '@/server/repositories/availability.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { addBlockedTimeSchema } from '@/server/schemas/availability.schema'

export const POST = requireCleaner(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = addBlockedTimeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  const block = await availabilityRepo.addBlockedTime(cleaner.id, {
    startDatetime: new Date(parsed.data.start_datetime),
    endDatetime: new Date(parsed.data.end_datetime),
    reason: parsed.data.reason,
  })
  return ok(block, 201)
})
