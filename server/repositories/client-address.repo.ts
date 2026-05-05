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
  listByClientId: async (clientId: string) => {
    try {
      return await db.$queryRawUnsafe<ClientAddressRow[]>(
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
        WHERE client_id = $1::uuid
        ORDER BY is_default DESC, updated_at DESC
        `,
        clientId,
      )
    } catch {
      const rows = await db.$queryRawUnsafe<any[]>(
        `
        SELECT *
        FROM public.client_addresses
        WHERE client_id = $1::uuid
        ORDER BY id DESC
        `,
        clientId,
      )
      return rows.map((row) => ({
        id: row.id,
        client_id: row.client_id,
        label: row.label ?? null,
        address_line1: row.address_line1,
        city: row.city,
        postcode: row.postcode,
        country: row.country ?? 'CY',
        apartment_details: row.apartment_details ?? null,
        access_notes: row.access_notes ?? '',
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        is_default: Boolean(row.is_default),
        created_at: row.created_at ?? new Date(),
        updated_at: row.updated_at ?? new Date(),
      }))
    }
  },

  create: async (data: {
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
  }) => {
    try {
      const rows = await db.$queryRawUnsafe<ClientAddressRow[]>(
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
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
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
      )
      return rows[0]
    } catch {
      const insertedRows = await db.$queryRawUnsafe<any[]>(
        `
        INSERT INTO public.client_addresses (
          client_id,
          address_line1,
          city,
          postcode,
          country,
          apartment_details,
          access_notes,
          is_default
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        data.clientId,
        data.addressLine1,
        data.city,
        data.postcode,
        data.country,
        data.apartmentDetails ?? null,
        data.accessNotes ?? '',
        Boolean(data.isDefault),
      )
      const row = insertedRows[0]
      return {
        id: row.id,
        client_id: row.client_id,
        label: row.label ?? null,
        address_line1: row.address_line1,
        city: row.city,
        postcode: row.postcode,
        country: row.country ?? 'CY',
        apartment_details: row.apartment_details ?? null,
        access_notes: row.access_notes ?? '',
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        is_default: Boolean(row.is_default),
        created_at: row.created_at ?? new Date(),
        updated_at: row.updated_at ?? new Date(),
      } as ClientAddressRow
    }
  },

  clearDefaultForClient: (clientId: string) =>
    db.$executeRawUnsafe(
      `
      UPDATE public.client_addresses
      SET is_default = FALSE
      WHERE client_id = $1::uuid
        AND is_default = TRUE
      `,
      clientId,
    ),

  findById: (id: string) =>
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
      WHERE id = $1::uuid
      LIMIT 1
      `,
      id,
    ).then((rows) => rows[0] ?? null),

  updateById: (
    id: string,
    data: {
      label?: string | null
      addressLine1?: string
      city?: string
      postcode?: string
      country?: string
      apartmentDetails?: string | null
      accessNotes?: string
      latitude?: number | null
      longitude?: number | null
      isDefault?: boolean
    },
  ) =>
    db.$queryRawUnsafe<ClientAddressRow[]>(
      `
      UPDATE public.client_addresses
      SET
        label = COALESCE($2, label),
        address_line1 = COALESCE($3, address_line1),
        city = COALESCE($4, city),
        postcode = COALESCE($5, postcode),
        country = COALESCE($6, country),
        apartment_details = COALESCE($7, apartment_details),
        access_notes = COALESCE($8, access_notes),
        latitude = COALESCE($9, latitude),
        longitude = COALESCE($10, longitude),
        is_default = COALESCE($11, is_default),
        updated_at = NOW()
      WHERE id = $1::uuid
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
      id,
      data.label ?? null,
      data.addressLine1 ?? null,
      data.city ?? null,
      data.postcode ?? null,
      data.country ?? null,
      data.apartmentDetails ?? null,
      data.accessNotes ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.isDefault ?? null,
    ).then((rows) => rows[0] ?? null),

  deleteById: (id: string) =>
    db.$executeRawUnsafe(
      `
      DELETE FROM public.client_addresses
      WHERE id = $1::uuid
      `,
      id,
    ),
}
