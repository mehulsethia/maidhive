import { z } from 'zod'

export const updateCleanerSchema = z.object({
  bio: z.string().max(1000).optional().nullable(),
  profile_image_url: z.string().min(1).optional().nullable(),
  skills: z.array(z.string().min(1)).max(12).optional(),
  years_experience: z.number().int().min(0).optional(),
  hourly_rate: z.number().min(6).max(20).optional(),
  transport_mode: z.enum(['own_car', 'bus_walk', 'requires_pickup']).optional().nullable(),
  transport_pickup_location: z.string().max(200).optional().nullable(),
  id_type: z.enum(['passport', 'national_id', 'drivers_licence']).optional().nullable(),
  id_file_name: z.string().max(255).optional().nullable(),
  pet_acceptance: z.boolean().optional(),
  work_eligibility_confirmed: z.boolean().optional(),
  terms_accepted: z.boolean().optional(),
  onboarding_step: z.number().int().min(1).max(4).optional(),
  onboarding_skipped_step3: z.boolean().optional(),
  onboarding_skipped_step4: z.boolean().optional(),
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
