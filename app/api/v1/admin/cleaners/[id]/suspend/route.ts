import { requireAdmin } from '@/server/auth'
import { cleanerService } from '@/server/services/cleaner.service'
import { ServiceError } from '@/server/services/booking.service'
import { ok, err } from '@/server/response'

export const POST = requireAdmin(async (_req, ctx) => {
  const { id } = await ctx.params
  try {
    const cleaner = await cleanerService.toggleSuspension(id)
    return ok(cleaner)
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    throw e
  }
})
