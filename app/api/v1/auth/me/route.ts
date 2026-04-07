import { requireAuth } from '@/server/auth'
import { ok } from '@/server/response'

export const GET = requireAuth(async (_req, _ctx, user) => {
  return ok(user)
})
