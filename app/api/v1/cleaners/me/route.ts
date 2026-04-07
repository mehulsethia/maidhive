import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { updateCleanerSchema } from '@/server/schemas/cleaner.schema'

export const PATCH = requireCleaner(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = updateCleanerSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  const updated = await cleanerRepo.update(cleaner.id, {
    ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
    ...(parsed.data.years_experience !== undefined ? { yearsExperience: parsed.data.years_experience } : {}),
    ...(parsed.data.hourly_rate !== undefined ? { hourlyRate: parsed.data.hourly_rate } : {}),
    ...(parsed.data.profile_complete !== undefined ? { profileComplete: parsed.data.profile_complete } : {}),
  })
  return ok(updated)
})
