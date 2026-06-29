import { calculatePlatformFee, roundMoney } from '@/lib/platform-fee'

export type PriceSnapshot = {
  hourly_rate: number
  duration_hours: number
  subtotal: number
  platform_fee_pct: number
  platform_fee: number
  cleaner_payout: number
  total_amount: number
}

export function calculatePriceSnapshot(
  hourlyRate: number,
  durationHours: number,
  platformFeePct: number,
): PriceSnapshot {
  const subtotal = roundMoney(hourlyRate * durationHours)
  const platformFee = calculatePlatformFee(subtotal, platformFeePct)
  const cleanerPayout = subtotal
  const totalAmount = roundMoney(subtotal + platformFee)

  return {
    hourly_rate: hourlyRate,
    duration_hours: durationHours,
    subtotal,
    platform_fee_pct: platformFeePct,
    platform_fee: platformFee,
    cleaner_payout: cleanerPayout,
    total_amount: totalAmount,
  }
}
