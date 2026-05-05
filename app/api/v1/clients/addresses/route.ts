import { NextRequest } from 'next/server'
import { requireClient } from '@/server/auth'
import { clientRepo } from '@/server/repositories/client.repo'
import { clientAddressRepo } from '@/server/repositories/client-address.repo'
import { createClientAddressSchema } from '@/server/schemas/client-address.schema'
import { ok, err } from '@/server/response'
import {
  MAX_SAVED_ADDRESSES,
  MVP_CITY,
  MVP_COUNTRY_CODE,
  normalizeCyprusPostcode,
} from '@/lib/location-policy'

export const GET = requireClient(async (_req: NextRequest, _ctx, user) => {
  let client = await clientRepo.findByUserId(user.id)
  if (!client) client = await clientRepo.create(user.id)
  const addresses = await clientAddressRepo.listByClientId(client.id)
  return ok(addresses)
})

export const POST = requireClient(async (req: NextRequest, _ctx, user) => {
  try {
    const body = await req.json()
    const parsed = createClientAddressSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.message, 422)

    let client = await clientRepo.findByUserId(user.id)
    if (!client) client = await clientRepo.create(user.id)
    const existing = await clientAddressRepo.listByClientId(client.id)
    if (existing.length >= MAX_SAVED_ADDRESSES) {
      return err("You've reached the maximum number of saved addresses. Please remove an existing address to add a new one.", 422)
    }

    if (parsed.data.is_default) {
      await clientAddressRepo.clearDefaultForClient(client.id)
    }

    const created = await clientAddressRepo.create({
      clientId: client.id,
      label: parsed.data.label,
      addressLine1: parsed.data.address_line1,
      city: MVP_CITY,
      postcode: normalizeCyprusPostcode(parsed.data.postcode),
      country: MVP_COUNTRY_CODE,
      apartmentDetails: parsed.data.apartment_details,
      accessNotes: parsed.data.access_notes?.trim() || '',
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      isDefault: Boolean(parsed.data.is_default),
    })

    return ok(created, 201)
  } catch (e: any) {
    const message = String(e?.message ?? '')
    console.error('[clients/addresses][POST] save failed', {
      userId: user.id,
      message,
    })
    if (message.includes('duplicate key')) {
      return err('This address is already saved.', 409)
    }
    if (message.includes('column') && message.includes('client_addresses')) {
      return err('Address saving is temporarily unavailable while setup completes. Please try again in 1 minute.', 503)
    }
    if (message.includes('violates not-null constraint')) {
      return err('Unable to save this address due to missing required details. Please review the form and try again.', 422)
    }
    if (message.includes('violates check constraint')) {
      return err('Address does not match MVP location rules. Please use a Larnaca, Cyprus address with a 4-digit postcode.', 422)
    }
    if (message.includes('relation') && message.includes('client_addresses') && message.includes('does not exist')) {
      return err('Address setup is incomplete. Please try again in 1 minute.', 503)
    }
    return err('Unable to save this address right now. Please try again.', 500)
  }
})
