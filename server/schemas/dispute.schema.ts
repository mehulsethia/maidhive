import { z } from 'zod'
import { DISPUTE_ISSUE_TYPES } from '@/lib/dispute-issues'

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

export const resolveDisputeSchema = z.object({
  resolution_type: z.enum(['full_refund', 'partial_refund', 'no_refund']),
  resolution_note: z.string().trim().min(1, 'Resolution note is required'),
  refund_amount: optionalPositiveNumber,
  no_show_finding: z.enum(['confirmed', 'rejected']).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.resolution_type === 'partial_refund' && value.refund_amount === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['refund_amount'],
      message: 'Refund amount is required for a partial refund',
    })
  }

  if (value.resolution_type !== 'partial_refund' && value.refund_amount !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['refund_amount'],
      message: 'Refund amount can only be used for a partial refund',
    })
  }
})
