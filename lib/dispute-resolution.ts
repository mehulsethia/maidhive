import { formatCurrency } from '@/lib/utils'

export function getDisputeResolutionOutcome(
  resolutionType?: string | null,
  refundAmount?: number | null,
) {
  if (resolutionType === 'full_refund') return 'Full refund issued to client.'
  if (resolutionType === 'partial_refund') {
    return refundAmount != null
      ? `Partial refund ${formatCurrency(Number(refundAmount))} issued to client.`
      : 'Partial refund issued to client.'
  }
  if (resolutionType === 'payment_released') return 'Dispute withdrawn — payment released to cleaner.'
  if (resolutionType === 'no_refund') return 'No refund — payment released to cleaner.'
  return 'Resolution recorded.'
}
