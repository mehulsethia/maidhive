import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok, err } from '@/server/response'
import { addServiceAreaSchema } from '@/server/schemas/cleaner.schema'

export const POST = requireCleaner(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = addServiceAreaSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) return err('Cleaner profile not found', 404)

  const area = await cleanerRepo.addServiceArea(cleaner.id, {
    city: parsed.data.city,
    postcodePrefix: parsed.data.postcode_prefix,
    radiusKm: parsed.data.radius_km,
  })
  return ok(area, 201)
})
