import { NextRequest } from 'next/server'
import { requireClient } from '@/server/auth'
import { bookingRepo } from '@/server/repositories/booking.repo'
import { clientRepo } from '@/server/repositories/client.repo'
import { ok } from '@/server/response'

export const GET = requireClient(async (_req: NextRequest, _ctx, user) => {
  let client = await clientRepo.findByUserId(user.id)
  if (!client) {
    client = await clientRepo.create(user.id)
  }

  return ok(await bookingRepo.countClientStats(client.id))
})
