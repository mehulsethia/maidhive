import { describe, expect, it } from 'vitest'
import { calculatePriceSnapshot } from '@/server/lib/pricing'

describe('F05 Pricing snapshot unit scaffold', () => {
  it('UT-PRICE-01 computes subtotal, fee, payout, and total correctly', () => {
    const result = calculatePriceSnapshot(20, 3, 10)

    expect(result).toEqual({
      hourly_rate: 20,
      duration_hours: 3,
      subtotal: 60,
      platform_fee_pct: 10,
      platform_fee: 6,
      cleaner_payout: 60,
      total_amount: 66,
    })
  })

  it('UT-PRICE-01 rounds to two decimal places', () => {
    const result = calculatePriceSnapshot(17.335, 2.5, 10)
    expect(result.subtotal).toBe(43.34)
    expect(result.platform_fee).toBe(4.33)
    expect(result.total_amount).toBe(47.67)
  })

  it('calculates the fee and total from the stored two-decimal cleaning cost', () => {
    const result = calculatePriceSnapshot(6.01, 4.5, 10)

    expect(result.subtotal).toBe(27.05)
    expect(result.platform_fee).toBe(2.71)
    expect(result.total_amount).toBe(29.76)
    expect(result.subtotal + result.platform_fee).toBe(result.total_amount)
  })

  it.each([
    { cleaningCost: 6, expectedFee: 2 },
    { cleaningCost: 10, expectedFee: 2 },
    { cleaningCost: 15, expectedFee: 2 },
    { cleaningCost: 20, expectedFee: 2 },
    { cleaningCost: 32, expectedFee: 3.2 },
  ])(
    'applies the €2 minimum platform fee to a €$cleaningCost cleaning cost',
    ({ cleaningCost, expectedFee }) => {
      const result = calculatePriceSnapshot(cleaningCost, 1, 10)
      expect(result.platform_fee).toBe(expectedFee)
      expect(result.total_amount).toBe(cleaningCost + expectedFee)
    },
  )

  it.todo('UT-PRICE-02 booking create schema enforces constraints')
  it.todo('UT-PRICE-03 snapshot fields remain immutable post-create')
})
