import { z } from 'zod'

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  is_public: z.boolean().default(true),
})

export const cleanerReviewResponseSchema = z.object({
  response: z.string().trim().min(10).max(2000),
})
