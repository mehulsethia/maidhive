import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { bookingService } from '@/server/services/booking.service'
import { ok, err } from '@/server/response'
import { previewPriceSchema } from '@/server/schemas/booking.schema'

export const POST = requireAuth(async (req: NextRequest, _ctx) => {
  const body = await req.json()
  const parsed = previewPriceSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const cleaner = await cleanerRepo.findById(parsed.data.cleaner_id)
  if (!cleaner) return err('Cleaner not found', 404)

  const pricing = bookingService.previewPrice(Number(cleaner.hourlyRate), parsed.data.duration_hours)
  return ok(pricing)
})
