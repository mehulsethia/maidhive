import type { BookingRead } from '@/types'

function toMoneyCents(value: unknown) {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

function centsToMoney(cents: number) {
  return Number((cents / 100).toFixed(2))
}

export function calculateDisputeAdjustedCleanerPayoutCents(args: {
  originalCleanerPayoutCents: number
  refundCents?: number | null
}) {
  const original = Math.max(0, Math.round(args.originalCleanerPayoutCents))
  const refund = Math.max(0, Math.round(args.refundCents ?? 0))
  return Math.max(0, original - refund)
}

export function getCleanerPayoutSummary(booking: BookingRead) {
  const originalCleanerPayoutCents = toMoneyCents(booking.cleaner_payout)
  const paymentCleanerPayoutCents =
    booking.payment?.cleaner_payout == null ? null : toMoneyCents(booking.payment.cleaner_payout)
  const paymentRefundCents =
    booking.payment?.refund_amount == null ? null : toMoneyCents(booking.payment.refund_amount)
  const disputeRefundCents =
    booking.dispute?.refund_amount == null ? null : toMoneyCents(booking.dispute.refund_amount)
  const refundCents = paymentRefundCents ?? disputeRefundCents
  const resolutionType = booking.dispute?.resolution_type ?? null

  let finalCleanerPayoutCents = paymentCleanerPayoutCents ?? originalCleanerPayoutCents
  if (resolutionType === 'full_refund') {
    finalCleanerPayoutCents = 0
  } else if (resolutionType === 'partial_refund' && refundCents != null) {
    const adjusted = calculateDisputeAdjustedCleanerPayoutCents({
      originalCleanerPayoutCents,
      refundCents,
    })
    finalCleanerPayoutCents = Math.min(finalCleanerPayoutCents, adjusted)
  }

  const disputeAdjustmentCents = finalCleanerPayoutCents - originalCleanerPayoutCents

  return {
    originalCleanerPayout: centsToMoney(originalCleanerPayoutCents),
    disputeAdjustment: centsToMoney(disputeAdjustmentCents),
    finalCleanerPayout: centsToMoney(finalCleanerPayoutCents),
    refundAmount: refundCents == null ? null : centsToMoney(refundCents),
    hasDisputeAdjustment: disputeAdjustmentCents !== 0,
  }
}
