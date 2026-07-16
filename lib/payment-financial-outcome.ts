import type { BookingRead } from '@/types'

type PaymentLike = {
  status?: string | null
  amount?: number | null
  platform_fee?: number | null
  cleaner_payout?: number | null
  refund_amount?: number | null
  transferred_at?: string | Date | null
  stripe_transfer_id?: string | null
  transfer_amount?: number | null
  transfer_reversed_amount?: number | null
  transfer_reversed_at?: string | Date | null
  transfer_reversal_status?: string | null
}

type DisputeLike = {
  status?: string | null
  resolution_type?: string | null
  refund_amount?: number | null
}

type BookingFinancialInput = {
  total_amount?: number | null
  platform_fee?: number | null
  cleaner_payout?: number | null
  payment?: PaymentLike | null
  dispute?: DisputeLike | null
}

function money(value: unknown) {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function moneyCents(value: unknown) {
  return Math.round(money(value) * 100)
}

export function hasCleanerPayoutTransferred(payment?: PaymentLike | null) {
  return (
    String(payment?.status ?? '') === 'transferred' ||
    Boolean(payment?.transferred_at) ||
    Boolean(payment?.stripe_transfer_id)
  )
}

export function getCleanerTransferLifecycle(payment?: PaymentLike | null) {
  if (!hasCleanerPayoutTransferred(payment)) return 'not_transferred'

  const reversedCents = moneyCents(payment?.transfer_reversed_amount)
  if (reversedCents <= 0) return 'transferred'

  const currentCleanerPayoutCents = moneyCents(payment?.cleaner_payout)
  const transferAmountCents = moneyCents(payment?.transfer_amount)
  const effectiveTransferAmountCents = transferAmountCents > 0
    ? transferAmountCents
    : currentCleanerPayoutCents + reversedCents
  if (effectiveTransferAmountCents > 0 && reversedCents >= effectiveTransferAmountCents) return 'reversed'
  if (currentCleanerPayoutCents <= 0) return 'reversed'

  return 'partially_reversed'
}

export function getCleanerTransferLifecycleLabel(payment?: PaymentLike | null) {
  const lifecycle = getCleanerTransferLifecycle(payment)
  if (lifecycle === 'transferred') return 'Transferred'
  if (lifecycle === 'reversed') return 'Reversed'
  if (lifecycle === 'partially_reversed') return 'Partially reversed'
  return 'Not transferred'
}

export function getBookingFinancialOutcome(booking: BookingFinancialInput | BookingRead | null | undefined) {
  const originalClientPayment = money(booking?.payment?.amount ?? booking?.total_amount)
  const originalCleanerPayout = money(booking?.cleaner_payout)
  const originalPlatformFee = money(booking?.platform_fee)
  const refundToClient = Math.min(
    originalClientPayment,
    Math.max(0, money(booking?.payment?.refund_amount ?? booking?.dispute?.refund_amount)),
  )
  const fullRefund =
    String(booking?.payment?.status ?? '') === 'refunded' ||
    booking?.dispute?.resolution_type === 'full_refund' ||
    (originalClientPayment > 0 && refundToClient >= originalClientPayment)
  const finalClientAmountPaid = fullRefund
    ? 0
    : roundMoney(Math.max(0, originalClientPayment - refundToClient))
  const finalCleanerPayout = fullRefund
    ? 0
    : Math.max(0, money(booking?.payment?.cleaner_payout ?? booking?.cleaner_payout))
  const finalMaidHiveRetainedFee = roundMoney(Math.max(0, finalClientAmountPaid - finalCleanerPayout))
  const transferLifecycle = getCleanerTransferLifecycle(booking?.payment)
  const transferred = transferLifecycle === 'transferred'

  let financialStatus = 'Payment pending'
  if (fullRefund) financialStatus = 'Fully refunded'
  else if (refundToClient > 0) financialStatus = 'Partially refunded'
  else if (transferred) financialStatus = 'Payout transferred'
  else if (finalCleanerPayout > 0) financialStatus = 'Awaiting release'
  else if (originalClientPayment > 0) financialStatus = 'No payout due'

  return {
    originalClientPayment: roundMoney(originalClientPayment),
    originalCleanerPayout: roundMoney(originalCleanerPayout),
    originalPlatformFee: roundMoney(originalPlatformFee),
    refundToClient: roundMoney(refundToClient),
    finalClientAmountPaid: roundMoney(finalClientAmountPaid),
    finalCleanerPayout: roundMoney(finalCleanerPayout),
    finalMaidHiveRetainedFee,
    financialStatus,
    isFullyRefunded: fullRefund,
    cleanerPayoutTransferred: hasCleanerPayoutTransferred(booking?.payment),
    cleanerTransferLifecycle: transferLifecycle,
  }
}

export function getResolutionFinancialPreview(
  booking: BookingFinancialInput | null | undefined,
  resolutionType: string,
  partialRefundAmount?: number | null,
) {
  const originalClientPayment = money(booking?.payment?.amount ?? booking?.total_amount)
  const originalCleanerPayout = money(booking?.cleaner_payout)
  const originalPlatformFee = money(booking?.platform_fee)
  const safePartialRefund = Math.max(0, money(partialRefundAmount))
  const refundToClient = resolutionType === 'full_refund'
    ? originalClientPayment
    : resolutionType === 'partial_refund'
      ? Math.min(originalClientPayment, safePartialRefund)
      : 0
  const finalClientAmountPaid = roundMoney(Math.max(0, originalClientPayment - refundToClient))
  const finalCleanerPayout = resolutionType === 'full_refund'
    ? 0
    : resolutionType === 'partial_refund'
      ? roundMoney(Math.max(0, originalCleanerPayout - refundToClient))
      : originalCleanerPayout
  const finalMaidHiveRetainedFee = roundMoney(Math.max(0, finalClientAmountPaid - finalCleanerPayout))
  const cleanerPayoutTransferred = hasCleanerPayoutTransferred(booking?.payment)
  const transferCanBeReversed = Boolean(booking?.payment?.stripe_transfer_id)
  const refundResolution = resolutionType === 'full_refund' || resolutionType === 'partial_refund'
  const partialRefundInvalid =
    resolutionType === 'partial_refund' &&
    (safePartialRefund <= 0 || safePartialRefund >= originalClientPayment)

  return {
    originalClientPayment: roundMoney(originalClientPayment),
    originalCleanerPayout: roundMoney(originalCleanerPayout),
    originalPlatformFee: roundMoney(originalPlatformFee),
    refundToClient: roundMoney(refundToClient),
    finalClientAmountPaid,
    finalCleanerPayout,
    finalMaidHiveRetainedFee,
    cleanerPayoutTransferred,
    transferCanBeReversed,
    canSafelyApply: !partialRefundInvalid && !(refundResolution && cleanerPayoutTransferred && !transferCanBeReversed),
    safetyMessage: refundResolution && cleanerPayoutTransferred && !transferCanBeReversed
      ? 'Cleaner payout has already been transferred, but no Stripe Connect transfer id is recorded. Resolve the transfer recovery manually before completing this dispute.'
      : refundResolution && cleanerPayoutTransferred && transferCanBeReversed
        ? 'Cleaner payout has already been transferred. MaidHive will attempt to reverse the Stripe Connect transfer before completing this dispute.'
      : partialRefundInvalid
        ? 'Enter a partial refund greater than €0.00 and less than the original client payment.'
        : null,
  }
}

export function isFinalNoCleanerPayoutOutcome(booking: BookingFinancialInput | BookingRead | null | undefined) {
  if (!booking || (booking as BookingRead).status !== 'completed') return false
  const disputeStatus = booking.dispute?.status
  if (disputeStatus === 'open' || disputeStatus === 'under_review') return false

  const outcome = getBookingFinancialOutcome(booking)
  const disputeFinalized = disputeStatus === 'resolved' || disputeStatus === 'closed'
  const fullRefund = outcome.isFullyRefunded || booking.dispute?.resolution_type === 'full_refund'

  return disputeFinalized && fullRefund && outcome.finalCleanerPayout <= 0
}
