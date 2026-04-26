import { NextRequest } from 'next/server'
import { requireClient } from '@/server/auth'
import { clientRepo } from '@/server/repositories/client.repo'
import { clientAddressRepo } from '@/server/repositories/client-address.repo'
import { createClientAddressSchema } from '@/server/schemas/client-address.schema'
import { ok, err } from '@/server/response'

export const GET = requireClient(async (_req: NextRequest, _ctx, user) => {
  let client = await clientRepo.findByUserId(user.id)
  if (!client) client = await clientRepo.create(user.id)
  const addresses = await clientAddressRepo.listByClientId(client.id)
  return ok(addresses)
})

export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = createClientAddressSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)

  let client = await clientRepo.findByUserId(user.id)
  if (!client) client = await clientRepo.create(user.id)

  if (parsed.data.is_default) {
    await clientAddressRepo.clearDefaultForClient(client.id)
  }

  const created = await clientAddressRepo.create({
    clientId: client.id,
    label: parsed.data.label,
    addressLine1: parsed.data.address_line1,
    city: parsed.data.city,
    postcode: parsed.data.postcode,
    country: parsed.data.country,
    apartmentDetails: parsed.data.apartment_details,
    accessNotes: parsed.data.access_notes,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    isDefault: Boolean(parsed.data.is_default),
  })

  return ok(created, 201)
})
