import type { BookingRead } from '@/types'
import { computeConfirmedCancellationPolicy, moneyFromCents } from '@/lib/cancellation-policy'
import { getCancellationOriginLabel } from '@/lib/cancellation-origin'
import { formatCurrency } from '@/lib/utils'

export function getClientCancellationContext(booking: BookingRead) {
  if (booking.status !== 'cancelled') return null

  const origin = getCancellationOriginLabel(booking)
  if (origin === 'Cancelled by cleaner') {
    return 'Cleaner cancelled this booking. No client cancellation charge applies.'
  }
  if (origin === 'Cancelled by platform') {
    return 'MaidHive cancelled this booking. The payment outcome is shown below.'
  }
  if (origin !== 'Cancelled by client') return null

  if (!booking.accepted_at && !booking.confirmed_at) {
    return 'Client cancelled before confirmation. No cancellation charge applied.'
  }

  const policy = computeConfirmedCancellationPolicy({
    scheduledStart: booking.scheduled_start,
    cancelledAt: booking.cancelled_at,
    totalAmount: booking.total_amount,
    subtotal: booking.subtotal ?? Math.max(Number(booking.total_amount) - Number(booking.platform_fee), 0),
    platformFee: booking.platform_fee,
  })
  if (!policy) return 'Client cancelled this booking. The payment outcome is shown below.'

  if (policy.window === 'more_than_24h') {
    return 'Client cancelled more than 24 hours before start. No late cancellation charge applied.'
  }
  if (policy.window === 'between_12h_and_24h') {
    return `Client cancelled between 12 and 24 hours before start. ${formatCurrency(moneyFromCents(policy.captureCents))} administration fee applied.`
  }
  return 'Client cancelled less than 12 hours before start. Late cancellation policy applied.'
}

export function getAdminClientCancellationCopy(booking: BookingRead) {
  if (booking.status !== 'cancelled' || getCancellationOriginLabel(booking) !== 'Cancelled by client') {
    return null
  }
  if (!booking.cancelled_at || (!booking.accepted_at && !booking.confirmed_at)) return null

  const policy = computeConfirmedCancellationPolicy({
    scheduledStart: booking.scheduled_start,
    cancelledAt: booking.cancelled_at,
    totalAmount: booking.total_amount,
    subtotal: booking.subtotal ?? Math.max(Number(booking.total_amount) - Number(booking.platform_fee), 0),
    platformFee: booking.platform_fee,
  })
  if (policy?.window !== 'between_12h_and_24h') return null

  const cancellationCharge = moneyFromCents(policy.captureCents)
  const formattedCharge = Number.isInteger(cancellationCharge)
    ? `€${cancellationCharge}`
    : formatCurrency(cancellationCharge)

  return {
    stateLabel: 'Cancelled by client between 12 and 24 hours before scheduled start',
    actionLogDescription:
      `Client cancelled between 12 and 24 hours before scheduled start. ${formattedCharge} cancellation charge applied. No cleaner payout due.`,
  }
}
