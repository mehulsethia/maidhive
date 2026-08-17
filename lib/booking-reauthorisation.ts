import type { BookingRead } from '@/types'

export const PAYMENT_REAUTHORISATION_DEADLINE_EXPIRED_REASON = 'Payment re-authorisation deadline expired'
export const PAYMENT_REAUTHORISATION_DEADLINE_EXPIRED_ACTION_LOG =
  'Re-authorisation was not completed by the required deadline after reschedule. No penalties applied.'

export function isPaymentReauthorisationCancelled(booking: Pick<BookingRead, 'status' | 'cancellation_reason'>) {
  if (booking.status !== 'cancelled') return false
  const reason = String(booking.cancellation_reason ?? '').toLowerCase()
  return reason.includes('re-authorisation') || reason.includes('reauthorisation')
}

export function isPaymentReauthorisationPending(booking: Pick<BookingRead, 'status' | 'reauthorization_required'>) {
  return booking.status === 'accepted' && Boolean(booking.reauthorization_required)
}
