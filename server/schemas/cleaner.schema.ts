import { z } from 'zod'

export const updateCleanerSchema = z.object({
  bio: z.string().max(1000).optional().nullable(),
  years_experience: z.number().int().min(0).optional(),
  hourly_rate: z.number().min(15).optional(),
  profile_complete: z.boolean().optional(),
})

export const addServiceAreaSchema = z.object({
  city: z.string().min(1),
  postcode_prefix: z.string().optional(),
  radius_km: z.number().positive().optional(),
})

export const approveCleanerSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().optional(),
})

export const cleanerSearchSchema = z.object({
  city: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
})
