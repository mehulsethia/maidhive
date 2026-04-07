import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { availabilityService } from '@/server/services/availability.service'
import { ok, err } from '@/server/response'
import { availableSlotsQuerySchema } from '@/server/schemas/availability.schema'

export const GET = requireAuth(async (req: NextRequest, ctx) => {
  const { cleanerId } = await ctx.params
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = availableSlotsQuerySchema.safeParse(params)
  if (!parsed.success) return err(parsed.error.message, 422)

  const slots = await availabilityService.getAvailableSlots(
    cleanerId,
    parsed.data.date,
    parsed.data.duration_hours,
  )
  return ok(slots)
})
