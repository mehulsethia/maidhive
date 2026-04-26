import { z } from 'zod'

export const SERVICE_TYPES = ['standard', 'deep_clean', 'end_of_tenancy', 'move_in'] as const
export const BOOKING_STATUSES = [
  'pending', 'accepted', 'confirmed', 'in_progress',
  'completed', 'cancelled', 'expired', 'disputed',
] as const
export const BOOKING_ACTIONS = [
  'accept',
  'decline',
  'start',
  'propose_alternative',
  'counter_proposal',
  'accept_proposal',
  'decline_proposal',
] as const

export const previewPriceSchema = z.object({
  cleaner_id: z.string().uuid(),
  duration_hours: z.number().min(1).max(8),
})

export const createBookingSchema = z.object({
  cleaner_id: z.string().uuid(),
  service_type: z.enum(SERVICE_TYPES),
  special_instructions: z.string().trim().min(20, 'Job description must be at least 20 characters').max(1000),
  address: z.string().min(1),
  city: z.string().min(1),
  postcode: z.string().min(1),
  country: z.string().default('IE'),
  apartment_details: z.string().max(255).optional(),
  access_notes: z.string().trim().min(5, 'Access notes are required').max(1000),
  scheduled_start: z.string().datetime(),
  duration_hours: z.number().min(1).max(8),
})

export const bookingActionSchema = z.object({
  action: z.enum(BOOKING_ACTIONS),
  proposed_start: z.string().datetime().optional(),
  start_location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy_m: z.number().positive().optional(),
  }).optional(),
}).superRefine((val, ctx) => {
  if ((val.action === 'propose_alternative' || val.action === 'counter_proposal') && !val.proposed_start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'proposed_start is required for proposal actions',
      path: ['proposed_start'],
    })
  }
})

export const cancelBookingSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
})

export const myBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(BOOKING_STATUSES).optional(),
})
