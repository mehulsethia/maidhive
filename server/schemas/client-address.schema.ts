import { z } from 'zod'

export const createClientAddressSchema = z.object({
  label: z.string().trim().max(80).optional(),
  address_line1: z.string().trim().min(1).max(255),
  city: z.string().trim().min(1).max(120),
  postcode: z.string().trim().min(1).max(32),
  country: z.string().trim().length(2).default('IE'),
  apartment_details: z.string().trim().max(255).optional(),
  access_notes: z.string().trim().min(5).max(1000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_default: z.boolean().optional(),
})
