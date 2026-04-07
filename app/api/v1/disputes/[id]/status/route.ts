import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { disputeRepo } from '@/server/repositories/dispute.repo'
import { ok, err } from '@/server/response'
import { updateDisputeStatusSchema } from '@/server/schemas/dispute.schema'

export const PATCH = requireAdmin(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = updateDisputeStatusSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const dispute = await disputeRepo.findById(id)
  if (!dispute) return err('Dispute not found', 404)

  const updated = await disputeRepo.update(id, { status: parsed.data.status })
  return ok(updated)
})
