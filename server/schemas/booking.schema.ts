import { z } from 'zod'

export const SERVICE_TYPES = ['standard', 'deep_clean', 'end_of_tenancy', 'move_in'] as const
export const BOOKING_STATUSES = [
  'pending', 'accepted', 'confirmed', 'in_progress',
  'completed', 'cancelled', 'expired', 'disputed',
] as const
export const CLEANER_ACTIONS = ['accept', 'start', 'complete'] as const

export const previewPriceSchema = z.object({
  cleaner_id: z.string().uuid(),
  duration_hours: z.number().min(1),
})

export const createBookingSchema = z.object({
  cleaner_id: z.string().uuid(),
  service_type: z.enum(SERVICE_TYPES),
  special_instructions: z.string().max(1000).optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  postcode: z.string().min(1),
  country: z.string().default('IE'),
  scheduled_start: z.string().datetime(),
  duration_hours: z.number().min(1),
})

export const bookingActionSchema = z.object({
  action: z.enum(CLEANER_ACTIONS),
})

export const cancelBookingSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
})

export const myBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(BOOKING_STATUSES).optional(),
})
