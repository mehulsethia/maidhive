import { z } from 'zod'

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  is_public: z.boolean().default(true),
})
