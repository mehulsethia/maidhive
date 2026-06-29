export const DEFAULT_PLATFORM_FEE_PCT = 10
export const MINIMUM_PLATFORM_FEE = 2

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculatePlatformFee(
  subtotal: number,
  platformFeePct = DEFAULT_PLATFORM_FEE_PCT,
) {
  const percentageFee = roundMoney((subtotal * platformFeePct) / 100)
  return roundMoney(Math.max(percentageFee, MINIMUM_PLATFORM_FEE))
}

export function isMinimumPlatformFeeApplied(args: {
  subtotal: number
  platformFee: number
  platformFeePct?: number
}) {
  const platformFeePct = args.platformFeePct ?? DEFAULT_PLATFORM_FEE_PCT
  const percentageFee = roundMoney((args.subtotal * platformFeePct) / 100)
  return percentageFee < MINIMUM_PLATFORM_FEE && args.platformFee >= MINIMUM_PLATFORM_FEE
}
