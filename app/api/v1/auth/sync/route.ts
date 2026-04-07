import { NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth'
import { userRepo } from '@/server/repositories/user.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { ok } from '@/server/response'
import { syncUserSchema } from '@/server/schemas/user.schema'

export const POST = requireAuth(async (req: NextRequest, _ctx, user) => {
  const body = await req.json().catch(() => ({}))
  const parsed = syncUserSchema.safeParse(body)
  const data = parsed.success ? parsed.data : {}

  // Ensure role-specific profile exists
  if (user.role === 'client') {
    const existing = await clientRepo.findByUserId(user.id)
    if (!existing) await clientRepo.create(user.id)
  } else if (user.role === 'cleaner') {
    const existing = await cleanerRepo.findByUserId(user.id)
    if (!existing) await cleanerRepo.create(user.id)
  }

  const updated = await userRepo.findById(user.id)
  return ok(updated)
})
