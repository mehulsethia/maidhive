import { z } from 'zod'

export const DISPUTE_ISSUE_TYPES = [
  'cleaner_didnt_arrive',
  'client_no_show',
  'service_not_completed',
  'property_damage_safety',
  'other_issue',
] as const

export const createDisputeSchema = z.object({
  issue_type: z.enum(DISPUTE_ISSUE_TYPES),
  explanation: z.string().trim().min(20).max(2000),
  evidence: z.array(z.string().url()).optional(),
})

export const updateDisputeStatusSchema = z.object({
  status: z.enum(['under_review']),
})

const optionalPositiveNumber = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  z.number().positive().optional(),
)

const optionalPercentage = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  z.number().min(1).max(100).optional(),
)

export const resolveDisputeSchema = z.object({
  resolution_type: z.enum(['full_refund', 'partial_refund', 'no_refund', 'payment_released']),
  resolution_note: z.string().min(1),
  refund_amount: optionalPositiveNumber,
  charge_percentage: optionalPercentage,
})
