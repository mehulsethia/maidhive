import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { cleanerService } from '@/server/services/cleaner.service'
import { ok, err } from '@/server/response'
import { approveCleanerSchema } from '@/server/schemas/cleaner.schema'
import { ServiceError } from '@/server/services/booking.service'
import type { CleanerRejectionReasonCode } from '@/lib/cleaner-status'

export const POST = requireAdmin(async (req: NextRequest, ctx, user) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = approveCleanerSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  try {
    const cleaner = await cleanerService.approve(
      id,
      user,
      parsed.data.action,
      parsed.data.rejection_reason,
      parsed.data.rejection_reason_code as CleanerRejectionReasonCode | undefined,
      parsed.data.rejection_custom_message,
    )
    return ok(cleaner)
  } catch (e) {
    if (e instanceof ServiceError) return err(e.message, e.status)
    throw e
  }
})
