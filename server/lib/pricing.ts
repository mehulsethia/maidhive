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
  const subtotal = hourlyRate * durationHours
  const platformFee = (subtotal * platformFeePct) / 100
  const cleanerPayout = subtotal
  const totalAmount = subtotal + platformFee

  return {
    hourly_rate: hourlyRate,
    duration_hours: durationHours,
    subtotal: round2(subtotal),
    platform_fee_pct: platformFeePct,
    platform_fee: round2(platformFee),
    cleaner_payout: round2(cleanerPayout),
    total_amount: round2(totalAmount),
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
