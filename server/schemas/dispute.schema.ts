import { z } from 'zod'

export const createDisputeSchema = z.object({
  reason: z.string().min(1).max(2000),
  evidence: z.array(z.string().url()).optional(),
})

export const updateDisputeStatusSchema = z.object({
  status: z.enum(['under_review']),
})

export const resolveDisputeSchema = z.object({
  resolution_type: z.enum(['full_refund', 'partial_refund', 'no_refund', 'payment_released']),
  resolution_note: z.string().min(1),
  refund_amount: z.number().positive().optional(),
})
