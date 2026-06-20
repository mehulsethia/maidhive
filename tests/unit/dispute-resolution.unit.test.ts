import { describe, expect, it } from 'vitest'
import { getDisputeResolutionOutcome } from '@/lib/dispute-resolution'

describe('Dispute resolution outcome copy', () => {
  it('formats every admin and participant resolution outcome', () => {
    expect(getDisputeResolutionOutcome('full_refund')).toBe('Full refund issued to client.')
    expect(getDisputeResolutionOutcome('partial_refund', 10)).toBe('Partial refund €10.00 issued to client.')
    expect(getDisputeResolutionOutcome('no_refund')).toBe('No refund — payment released to cleaner.')
    expect(getDisputeResolutionOutcome('payment_released')).toBe('Dispute withdrawn — payment released to cleaner.')
  })
})
