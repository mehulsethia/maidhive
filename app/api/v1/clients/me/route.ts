import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthSessionUser, requireClient } from '@/server/auth'
import { clientRepo } from '@/server/repositories/client.repo'
import { userRepo } from '@/server/repositories/user.repo'
import { ok, err } from '@/server/response'
import { isCyprusPostcode, isMvpCity, MVP_CITY, MVP_COUNTRY_CODE } from '@/lib/location-policy'
import { isLikelyE164, normalizePhoneE164 } from '@/server/lib/phone'

const updateClientMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  default_address: z.string().trim().max(255).nullable().optional(),
  default_city: z.string().trim().max(120).nullable().optional().refine((value) => value == null || isMvpCity(value), `${MVP_CITY} only for MVP`),
  default_postcode: z.string().trim().max(40).nullable().optional().refine((value) => value == null || isCyprusPostcode(value), 'Postcode must be 4 digits'),
  default_country: z.string().trim().length(2).nullable().optional().refine((value) => value == null || value.toUpperCase() === MVP_COUNTRY_CODE, `${MVP_COUNTRY_CODE} only for MVP`),
})

export const GET = requireClient(async (req, _ctx, user) => {
  let client = await clientRepo.findByUserId(user.id)
  if (!client) {
    client = await clientRepo.create(user.id)
  }
  const authSessionUser = await getAuthSessionUser(req)
  return ok({
    ...client,
    user: client.user
      ? {
          ...client.user,
          email_confirmed_at: authSessionUser?.email_confirmed_at ?? null,
        }
      : undefined,
  })
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
  const normalizedPhone = data.phone !== undefined ? normalizePhoneE164(data.phone) : undefined
  if (normalizedPhone !== undefined && !isLikelyE164(normalizedPhone)) {
    return err('Phone must be in international format, e.g. +447911123456.', 422)
  }

  if (data.name !== undefined || data.phone !== undefined) {
    await userRepo.update(user.id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: normalizedPhone } : {}),
      ...(data.phone !== undefined && normalizedPhone !== (user.phone ?? null) ? { phoneVerifiedAt: null } : {}),
    })
  }

  const updated = await clientRepo.update(client.id, {
    ...(data.default_address !== undefined ? { defaultAddress: data.default_address } : {}),
    ...(data.default_city !== undefined ? { defaultCity: data.default_city } : {}),
    ...(data.default_postcode !== undefined ? { defaultPostcode: data.default_postcode } : {}),
    ...(data.default_country !== undefined && data.default_country !== null
      ? { defaultCountry: data.default_country.toUpperCase() }
      : { defaultCountry: MVP_COUNTRY_CODE }),
  })

  const full = await clientRepo.findById(updated.id)
  return ok(full)
})
