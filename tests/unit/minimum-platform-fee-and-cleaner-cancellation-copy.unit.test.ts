import { describe, expect, it } from 'vitest'
import {
  calculatePlatformFee,
  isMinimumPlatformFeeApplied,
} from '@/lib/platform-fee'
import { getCleanerCancellationConfirmationCopy } from '@/lib/cleaner-cancellation-copy'

describe('minimum platform fee display rules', () => {
  it.each([
    { subtotal: 6, fee: 2, minimumApplies: true },
    { subtotal: 10, fee: 2, minimumApplies: true },
    { subtotal: 15, fee: 2, minimumApplies: true },
    { subtotal: 20, fee: 2, minimumApplies: false },
    { subtotal: 32, fee: 3.2, minimumApplies: false },
  ])(
    'calculates and classifies a €$subtotal booking',
    ({ subtotal, fee, minimumApplies }) => {
      const platformFee = calculatePlatformFee(subtotal)

      expect(platformFee).toBe(fee)
      expect(isMinimumPlatformFeeApplied({
        subtotal,
        platformFee,
        platformFeePct: 10,
      })).toBe(minimumApplies)
    },
  )
})

describe('cleaner cancellation confirmation copy', () => {
  it('explains the full-refund outcome more than 24 hours before start', () => {
    const copy = getCleanerCancellationConfirmationCopy(true)

    expect(copy.title).toBe('Cancel booking?')
    expect(copy.consequences).toContain('The client will receive a full refund.')
    expect(copy.consequences).toContain('You will not receive any payout for this booking.')
    expect(copy.keepButton).toBe('Keep booking')
    expect(copy.cancelButton).toBe('Cancel booking')
  })

  it('explains the late-cancellation consequences within 24 hours', () => {
    const copy = getCleanerCancellationConfirmationCopy(false)

    expect(copy.consequences).toContain('The client will receive compensation in accordance with MaidHive’s cancellation policy.')
    expect(copy.consequences).toContain('You will not receive payment for this booking.')
    expect(copy.consequences.at(-1)).toContain('Super Cleaner eligibility')
  })
})
