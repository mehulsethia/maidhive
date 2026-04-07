import { NextRequest } from 'next/server'
import { requireCleaner } from '@/server/auth'
import { bookingService, ServiceError } from '@/server/services/booking.service'
import { ok, err } from '@/server/response'
import { bookingActionSchema } from '@/server/schemas/booking.schema'

export const POST = requireCleaner(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = bookingActionSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  try {
    const booking = await bookingService.applyAction(id, user, parsed.data.action)
    return ok(booking)
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    throw e
  }
})
