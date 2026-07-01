import type { ConfirmedCancellationPolicy } from '@/lib/cancellation-policy'

function formatEuroFromCents(cents: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, cents) / 100)
}

export function getClientSelfCancellationEmailOutcome(
  policy: ConfirmedCancellationPolicy,
) {
  if (policy.window === 'more_than_24h') {
    return {
      cancellationWindowMessage:
        'You cancelled more than 24 hours before the scheduled start.',
      cancellationChargeMessage: 'No cancellation charge applies.',
      refundOrReleaseMessage:
        `Your full payment of ${formatEuroFromCents(policy.clientRefundCents)} will be refunded or released.`,
    }
  }

  if (policy.window === 'between_12h_and_24h') {
    return {
      cancellationWindowMessage:
        'You cancelled between 12 and 24 hours before the scheduled start.',
      cancellationChargeMessage:
        `Cancellation charge: ${formatEuroFromCents(policy.captureCents)}.`,
      refundOrReleaseMessage:
        `${formatEuroFromCents(policy.clientRefundCents)} will be refunded or released.`,
    }
  }

  return {
    cancellationWindowMessage:
      'You cancelled less than 12 hours before the scheduled start.',
    cancellationChargeMessage:
      `Cancellation charge: ${formatEuroFromCents(policy.captureCents)}.`,
    refundOrReleaseMessage:
      `You will receive a 50% refund of ${formatEuroFromCents(policy.clientRefundCents)}.`,
  }
}
