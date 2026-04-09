import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireClient } from '@/server/auth'
import { clientRepo } from '@/server/repositories/client.repo'
import { userRepo } from '@/server/repositories/user.repo'
import { ok, err } from '@/server/response'

const updateClientMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  default_address: z.string().trim().max(255).nullable().optional(),
  default_city: z.string().trim().max(120).nullable().optional(),
  default_postcode: z.string().trim().max(40).nullable().optional(),
  default_country: z.string().trim().length(2).nullable().optional(),
})

export const GET = requireClient(async (_req, _ctx, user) => {
  let client = await clientRepo.findByUserId(user.id)
  if (!client) {
    client = await clientRepo.create(user.id)
  }
  return ok(client)
})

export const PATCH = requireClient(async (req: NextRequest, _ctx, user) => {
  let client = await clientRepo.findByUserId(user.id)
  if (!client) {
    client = await clientRepo.create(user.id)
  }

  const body = await req.json()
  const parsed = updateClientMeSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  const data = parsed.data

  if (data.name !== undefined || data.phone !== undefined) {
    await userRepo.update(user.id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    })
  }

  const updated = await clientRepo.update(client.id, {
    ...(data.default_address !== undefined ? { defaultAddress: data.default_address } : {}),
    ...(data.default_city !== undefined ? { defaultCity: data.default_city } : {}),
    ...(data.default_postcode !== undefined ? { defaultPostcode: data.default_postcode } : {}),
    ...(data.default_country !== undefined && data.default_country !== null
      ? { defaultCountry: data.default_country.toUpperCase() }
      : {}),
  })

  const full = await clientRepo.findById(updated.id)
  return ok(full)
})
