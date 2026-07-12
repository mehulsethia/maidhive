import { describe, expect, it } from 'vitest'
import { createDisputeSchema, resolveDisputeSchema, updateDisputeStatusSchema } from '@/server/schemas/dispute.schema'

describe('F10 payments/disputes unit coverage', () => {
  it('UT-PAY-01 dispute create schema enforces issue type and explanation length', () => {
    const valid = createDisputeSchema.safeParse({
      issue_type: 'service_issue',
      explanation: 'Cleaner completed only part of the requested checklist and left early.',
    })

    const invalid = createDisputeSchema.safeParse({
      issue_type: 'service_issue',
      explanation: 'Too short',
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it('UT-PAY-02 resolve schema accepts full/partial/no-refund variants', () => {
    const full = resolveDisputeSchema.safeParse({
      resolution_type: 'full_refund',
      resolution_note: 'Service not delivered',
    })

    const partial = resolveDisputeSchema.safeParse({
      resolution_type: 'partial_refund',
      resolution_note: 'Partial completion',
      refund_amount: 20,
    })

    const noRefund = resolveDisputeSchema.safeParse({
      resolution_type: 'no_refund',
      resolution_note: 'No refund required',
    })

    expect(full.success).toBe(true)
    expect(partial.success).toBe(true)
    expect(noRefund.success).toBe(true)
  })

  it('UT-PAY-03 resolve schema rejects invalid or conflicting reduced-payment inputs', () => {
    const invalidRefund = resolveDisputeSchema.safeParse({
      resolution_type: 'partial_refund',
      resolution_note: 'Invalid refund amount',
      refund_amount: -1,
    })

    const conflictingPct = resolveDisputeSchema.safeParse({
      resolution_type: 'partial_refund',
      resolution_note: 'Conflicting inputs',
      refund_amount: 20,
      charge_percentage: 75,
    })

    const withdrawn = resolveDisputeSchema.safeParse({
      resolution_type: 'payment_released',
      resolution_note: 'Withdrawn dispute',
    })

    const noRefundWithPercentage = resolveDisputeSchema.safeParse({
      resolution_type: 'no_refund',
      resolution_note: 'No refund required',
      charge_percentage: 75,
    })

    expect(invalidRefund.success).toBe(false)
    expect(conflictingPct.success).toBe(false)
    expect(withdrawn.success).toBe(false)
    expect(noRefundWithPercentage.success).toBe(false)
  })

  it('requires a non-empty resolution note after trimming whitespace', () => {
    const result = resolveDisputeSchema.safeParse({
      resolution_type: 'no_refund',
      resolution_note: '   ',
    })

    expect(result.success).toBe(false)
  })

  it('UT-PAY-04 dispute status patch schema only allows under_review transition payload', () => {
    const valid = updateDisputeStatusSchema.safeParse({ status: 'under_review' })
    const invalid = updateDisputeStatusSchema.safeParse({ status: 'resolved' })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })
})
