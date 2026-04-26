import { db } from '../db'

type ClientAddressRow = {
  id: string
  client_id: string
  label: string | null
  address_line1: string
  city: string
  postcode: string
  country: string
  apartment_details: string | null
  access_notes: string
  latitude: number | null
  longitude: number | null
  is_default: boolean
  created_at: Date
  updated_at: Date
}

export const clientAddressRepo = {
  listByClientId: (clientId: string) =>
    db.$queryRawUnsafe<ClientAddressRow[]>(
      `
      SELECT
        id,
        client_id,
        label,
        address_line1,
        city,
        postcode,
        country,
        apartment_details,
        access_notes,
        latitude::float8 AS latitude,
        longitude::float8 AS longitude,
        is_default,
        created_at,
        updated_at
      FROM public.client_addresses
      WHERE client_id = $1
      ORDER BY is_default DESC, updated_at DESC
      `,
      clientId,
    ),

  create: (data: {
    clientId: string
    label?: string
    addressLine1: string
    city: string
    postcode: string
    country: string
    apartmentDetails?: string
    accessNotes: string
    latitude?: number
    longitude?: number
    isDefault?: boolean
  }) =>
    db.$queryRawUnsafe<ClientAddressRow[]>(
      `
      INSERT INTO public.client_addresses (
        client_id,
        label,
        address_line1,
        city,
        postcode,
        country,
        apartment_details,
        access_notes,
        latitude,
        longitude,
        is_default
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING
        id,
        client_id,
        label,
        address_line1,
        city,
        postcode,
        country,
        apartment_details,
        access_notes,
        latitude::float8 AS latitude,
        longitude::float8 AS longitude,
        is_default,
        created_at,
        updated_at
      `,
      data.clientId,
      data.label ?? null,
      data.addressLine1,
      data.city,
      data.postcode,
      data.country,
      data.apartmentDetails ?? null,
      data.accessNotes,
      data.latitude ?? null,
      data.longitude ?? null,
      Boolean(data.isDefault),
    ).then((rows) => rows[0]),

  clearDefaultForClient: (clientId: string) =>
    db.$executeRawUnsafe(
      `
      UPDATE public.client_addresses
      SET is_default = FALSE
      WHERE client_id = $1
        AND is_default = TRUE
      `,
      clientId,
    ),
}
