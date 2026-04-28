import { z } from 'zod'
import { CLEANER_REJECTION_REASON_OPTIONS } from '@/lib/cleaner-status'

export const updateCleanerSchema = z.object({
  bio: z.string().max(1000).optional().nullable(),
  profile_image_url: z.string().min(1).optional().nullable(),
  skills: z.array(z.string().min(1)).max(12).optional(),
  cleaning_supplies: z.enum(['own_supplies', 'client_supplies']).optional().nullable(),
  years_experience: z.number().int().min(0).optional(),
  hourly_rate: z.number().min(6).max(20).optional(),
  transport_mode: z.enum(['own_car', 'bus_walk', 'requires_pickup']).optional().nullable(),
  transport_pickup_location: z.string().max(200).optional().nullable(),
  id_type: z.enum(['passport', 'national_id', 'drivers_licence']).optional().nullable(),
  id_file_name: z.string().max(255).optional().nullable(),
  id_file_url: z.string().max(2000).optional().nullable(),
  pet_acceptance: z.boolean().optional(),
  pet_comfortable: z.boolean().optional().nullable(),
  work_eligibility_answer: z.boolean().optional().nullable(),
  work_eligibility_confirmed: z.boolean().optional(),
  terms_accepted: z.boolean().optional(),
  cleaning_standards_accepted: z.boolean().optional(),
  cleaning_quiz_score: z.number().int().min(0).max(100).optional().nullable(),
  standards_completed: z.boolean().optional(),
  quiz_passed: z.boolean().optional(),
  quiz_score: z.number().int().min(0).max(100).optional().nullable(),
  onboarding_step: z.number().int().min(1).max(5).optional(),
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
  rejection_reason_code: z.enum(CLEANER_REJECTION_REASON_OPTIONS.map((item) => item.code) as [string, ...string[]]).optional(),
  rejection_custom_message: z.string().max(500).optional(),
}).superRefine((payload, ctx) => {
  if (payload.action !== 'reject') return
  const hasLegacy = Boolean(payload.rejection_reason?.trim())
  const hasCode = Boolean(payload.rejection_reason_code)
  const hasCustom = Boolean(payload.rejection_custom_message?.trim())
  if (!hasLegacy && !hasCode && !hasCustom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejection_reason'],
      message: 'Rejection reason is required when rejecting a cleaner.',
    })
  }
})

export const cleanerSearchSchema = z.object({
  city: z.string().optional(),
  availability: z.enum(['any', 'next_7_days']).optional().default('any'),
  transport_mode: z.enum(['own_car', 'bus_walk', 'requires_pickup']).optional(),
  services_offered: z.string().optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
}).superRefine((payload, ctx) => {
  if (payload.min_price !== undefined && payload.max_price !== undefined && payload.min_price > payload.max_price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['max_price'],
      message: 'max_price must be greater than or equal to min_price',
    })
  }
})
