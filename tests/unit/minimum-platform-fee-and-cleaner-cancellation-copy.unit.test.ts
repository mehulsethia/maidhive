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
    expect(copy.consequences).toContain('The client will receive a full refund for this booking.')
    expect(copy.consequences).toContain('You will not receive any payout for this booking.')
    expect(copy.keepButton).toBe('Keep booking')
    expect(copy.cancelButton).toBe('Cancel booking')
  })

  it('explains the 12-24 hour cancellation consequences without a strike', () => {
    const copy = getCleanerCancellationConfirmationCopy('between_12h_and_24h')

    expect(copy.consequences).toContain('The client will receive a full refund for this booking.')
    expect(copy.consequences).toContain('You will not receive payment for this booking.')
    expect(copy.consequences).toContain('This cancellation will be recorded in your 12–24-hour cancellation history and included in your cancellation rate. It will not create a strike, but it may affect your Super Cleaner eligibility if your cancellation rate exceeds the permitted threshold.')
    expect(copy.consequences).toContain('Client refund: full original booking payment')
    expect(copy.consequences).toContain('Cleaner payout: €0.00')
    expect(copy.consequences).toContain('MaidHive retained fee: €0.00')
  })

  it('explains under-12 hour cancellation consequences as last-minute', () => {
    const copy = getCleanerCancellationConfirmationCopy('under_12h')

    expect(copy.consequences).toContain('This under-12-hour cancellation will be recorded in your last-minute cancellation history and may create a reliability strike under MaidHive policy.')
  })
})
