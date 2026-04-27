import { z } from 'zod'

export const syncUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['client', 'cleaner']).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  experience: z.coerce.number().int().min(0).max(60).optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
})
