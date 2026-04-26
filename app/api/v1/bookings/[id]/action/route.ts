import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { bookingService, ServiceError } from '@/server/services/booking.service'
import { sanitizeBookingForRole } from '@/server/services/booking-visibility.service'
import { ok, err } from '@/server/response'
import { bookingActionSchema } from '@/server/schemas/booking.schema'

export const POST = requireAuth(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = bookingActionSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  try {
    const booking = await bookingService.applyAction(id, user, parsed.data)
    return ok(sanitizeBookingForRole(booking as any, user.role as 'client' | 'cleaner' | 'admin'))
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    throw e
  }
})
