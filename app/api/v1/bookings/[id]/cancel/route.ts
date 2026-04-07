import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { bookingService, ServiceError } from '@/server/services/booking.service'
import { ok, err } from '@/server/response'
import { cancelBookingSchema } from '@/server/schemas/booking.schema'

export const POST = requireAuth(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const parsed = cancelBookingSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  try {
    const booking = await bookingService.cancel(id, user, parsed.data.reason)
    return ok(booking)
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    throw e
  }
})
