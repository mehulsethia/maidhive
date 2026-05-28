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

  it('UT-PAY-02 resolve schema accepts full/partial/no-refund/payment_released variants', () => {
    const full = resolveDisputeSchema.safeParse({
      resolution_type: 'full_refund',
      resolution_note: 'Service not delivered',
    })

    const partial = resolveDisputeSchema.safeParse({
      resolution_type: 'partial_refund',
      resolution_note: 'Partial completion',
      refund_amount: 20,
      charge_percentage: 75,
    })

    const release = resolveDisputeSchema.safeParse({
      resolution_type: 'payment_released',
      resolution_note: 'No refund required',
      charge_percentage: 100,
    })

    expect(full.success).toBe(true)
    expect(partial.success).toBe(true)
    expect(release.success).toBe(true)
  })

  it('UT-PAY-03 resolve schema rejects invalid refund or charge percentage bounds', () => {
    const invalidRefund = resolveDisputeSchema.safeParse({
      resolution_type: 'partial_refund',
      resolution_note: 'Invalid refund amount',
      refund_amount: -1,
    })

    const invalidPct = resolveDisputeSchema.safeParse({
      resolution_type: 'partial_refund',
      resolution_note: 'Invalid charge percentage',
      charge_percentage: 120,
    })

    expect(invalidRefund.success).toBe(false)
    expect(invalidPct.success).toBe(false)
  })

  it('UT-PAY-04 dispute status patch schema only allows under_review transition payload', () => {
    const valid = updateDisputeStatusSchema.safeParse({ status: 'under_review' })
    const invalid = updateDisputeStatusSchema.safeParse({ status: 'resolved' })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })
})
