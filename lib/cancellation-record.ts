import { computeConfirmedCancellationPolicy } from '@/lib/cancellation-policy'
import { getCancellationOriginLabel } from '@/lib/cancellation-origin'
import type { BookingRead } from '@/types'

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`
}

export function getCancellationLeadTimeLabel(booking: BookingRead) {
  if (!booking.cancelled_at) return null
  const cancelledAtMs = new Date(booking.cancelled_at).getTime()
  const scheduledStartMs = new Date(booking.scheduled_start).getTime()
  if (!Number.isFinite(cancelledAtMs) || !Number.isFinite(scheduledStartMs)) return null

  const totalMinutes = Math.max(0, Math.floor((scheduledStartMs - cancelledAtMs) / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${plural(minutes, 'minute')} before scheduled start`
  if (minutes <= 0) return `${plural(hours, 'hour')} before scheduled start`
  return `${plural(hours, 'hour')} ${plural(minutes, 'minute')} before scheduled start`
}

export function getCancellationPolicyBandLabel(booking: BookingRead) {
  if (!booking.cancelled_at) return null
  const origin = getCancellationOriginLabel(booking)
  const policy = computeConfirmedCancellationPolicy({
    scheduledStart: booking.scheduled_start,
    cancelledAt: booking.cancelled_at,
    totalAmount: booking.total_amount,
    subtotal: booking.subtotal ?? Math.max(Number(booking.total_amount ?? 0) - Number(booking.platform_fee ?? 0), 0),
    platformFee: booking.platform_fee,
  })
  if (!policy) return null

  const actorPrefix = origin === 'Cancelled by cleaner'
    ? 'Cleaner cancellation'
    : origin === 'Cancelled by client'
      ? 'Client cancellation'
      : 'Platform cancellation'

  if (policy.window === 'more_than_24h') return `${actorPrefix} more than 24 hours before start`
  if (policy.window === 'between_12h_and_24h') return `${actorPrefix} 12–24 hours before start`
  return `${actorPrefix} under 12 hours before start`
}

export function getAdminCancellationRecordSummary(booking: BookingRead) {
  const origin = getCancellationOriginLabel(booking)
  if (!origin) return null

  const leadTime = getCancellationLeadTimeLabel(booking)
  const policyBand = getCancellationPolicyBandLabel(booking)
  return [
    origin,
    leadTime,
    policyBand ? `Policy band: ${policyBand}` : null,
  ].filter(Boolean).join('. ')
}
