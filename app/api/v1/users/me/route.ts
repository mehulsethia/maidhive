import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { userRepo } from '@/server/repositories/user.repo'
import { ok, err } from '@/server/response'
import { updateUserSchema } from '@/server/schemas/user.schema'

export const PATCH = requireAuth(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const updated = await userRepo.update(user.id, {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
    ...(parsed.data.avatar_url !== undefined ? { avatarUrl: parsed.data.avatar_url } : {}),
  })
  return ok(updated)
})

export const DELETE = requireAuth(async (_req, _ctx, user) => {
  await userRepo.softDelete(user.id)
  return ok({ message: 'Account deleted' })
})
