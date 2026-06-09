export type ConfirmedCancellationPolicyWindow =
  | 'more_than_24h'
  | 'between_12h_and_24h'
  | 'under_12h'

export type ConfirmedCancellationPolicy = {
  window: ConfirmedCancellationPolicyWindow
  hoursUntilStart: number
  totalAmountCents: number
  subtotalCents: number
  platformFeeCents: number
  clientRefundCents: number
  captureCents: number
  cleanerPayoutCents: number
  platformRetainedCents: number
}

function toCents(value: unknown) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.round(numeric * 100))
}

function fromCents(cents: number) {
  return Number((Math.max(0, Math.round(cents)) / 100).toFixed(2))
}

export function moneyFromCents(cents: number) {
  return fromCents(cents)
}

export function computeConfirmedCancellationPolicy(args: {
  scheduledStart: Date | string
  cancelledAt?: Date | string
  totalAmount: unknown
  subtotal: unknown
  platformFee?: unknown
}): ConfirmedCancellationPolicy | null {
  const scheduledStartMs = new Date(args.scheduledStart).getTime()
  const cancelledAtMs = args.cancelledAt ? new Date(args.cancelledAt).getTime() : Date.now()
  if (!Number.isFinite(scheduledStartMs) || !Number.isFinite(cancelledAtMs)) return null

  const hoursUntilStart = (scheduledStartMs - cancelledAtMs) / (60 * 60 * 1000)
  const totalAmountCents = toCents(args.totalAmount)
  const subtotalCents = toCents(args.subtotal)
  const platformFeeCents = toCents(args.platformFee)

  if (hoursUntilStart > 24) {
    return {
      window: 'more_than_24h',
      hoursUntilStart,
      totalAmountCents,
      subtotalCents,
      platformFeeCents,
      clientRefundCents: totalAmountCents,
      captureCents: 0,
      cleanerPayoutCents: 0,
      platformRetainedCents: 0,
    }
  }

  if (hoursUntilStart >= 12) {
    const captureCents = Math.min(totalAmountCents, 500)
    return {
      window: 'between_12h_and_24h',
      hoursUntilStart,
      totalAmountCents,
      subtotalCents,
      platformFeeCents,
      clientRefundCents: Math.max(0, totalAmountCents - captureCents),
      captureCents,
      cleanerPayoutCents: 0,
      platformRetainedCents: captureCents,
    }
  }

  const clientRefundCents = Math.min(totalAmountCents, Math.round(totalAmountCents * 0.5))
  const captureCents = Math.max(0, totalAmountCents - clientRefundCents)
  const cleanerPayoutCents = Math.min(captureCents, Math.round(subtotalCents * 0.5))
  const platformRetainedCents = Math.max(0, captureCents - cleanerPayoutCents)

  return {
    window: 'under_12h',
    hoursUntilStart,
    totalAmountCents,
    subtotalCents,
    platformFeeCents,
    clientRefundCents,
    captureCents,
    cleanerPayoutCents,
    platformRetainedCents,
  }
}
