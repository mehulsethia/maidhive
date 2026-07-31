import { getDisputeResolutionOutcome } from '@/lib/dispute-resolution'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead } from '@/types'

type Role = 'client' | 'cleaner'

function disputeIssueType(booking: BookingRead) {
  return booking.dispute?.issue_type ?? null
}

function noShowFinding(booking: BookingRead) {
  return booking.dispute?.no_show_finding ?? null
}

export function hasResolvedBookingCase(booking: BookingRead) {
  const status = booking.dispute?.status
  return status === 'resolved' || status === 'closed'
}

export function getResolutionOutcomeLabel(booking: BookingRead) {
  if (disputeIssueType(booking) === 'cleaner_no_show' && noShowFinding(booking) === 'confirmed') {
    return 'Cleaner no-show confirmed'
  }
  if (disputeIssueType(booking) === 'cleaner_no_show' && noShowFinding(booking) === 'rejected') {
    return 'Cleaner no-show rejected'
  }
  if (booking.dispute?.resolution_type === 'full_refund') return 'Refund resolution recorded'
  return getDisputeResolutionOutcome(booking.dispute?.resolution_type, booking.dispute?.refund_amount).replace(/\.$/, '')
}

export function getResolutionReportHref(role: Role, booking: BookingRead) {
  const base = role === 'cleaner' ? '/cleaner/report' : '/client/report'
  const params = new URLSearchParams({ booking: booking.id })
  if (booking.dispute?.id) params.set('case', booking.dispute.id)
  return `${base}?${params.toString()}`
}

export function getResolutionSummaryRows(booking: BookingRead) {
  const originalClientPayment = Number(booking.payment?.amount ?? booking.total_amount ?? 0)
  const refundAmount = Number(booking.payment?.refund_amount ?? booking.dispute?.refund_amount ?? 0)
  const finalClientPaid = Math.max(0, originalClientPayment - Math.max(0, refundAmount))
  const resolutionType = booking.dispute?.resolution_type
  const finalCleanerPayout = resolutionType === 'full_refund'
    ? 0
    : Number(booking.payment?.cleaner_payout ?? booking.cleaner_payout ?? 0)
  const reliabilityOutcome =
    disputeIssueType(booking) === 'cleaner_no_show' && noShowFinding(booking) === 'confirmed'
      ? 'Cleaner reliability record updated: no-show strike and recovery requirement.'
      : null

  return {
    outcome: getResolutionOutcomeLabel(booking),
    clientPaymentOutcome:
      resolutionType === 'full_refund'
        ? 'Client received a complete refund.'
        : refundAmount > 0
          ? `${formatCurrency(refundAmount)} refund issued. Final client payment: ${formatCurrency(finalClientPaid)}.`
          : `Final client payment: ${formatCurrency(finalClientPaid)}.`,
    cleanerPayoutOutcome:
      finalCleanerPayout <= 0
        ? 'No cleaner payout is due for this booking.'
        : `Final cleaner payout: ${formatCurrency(finalCleanerPayout)}.`,
    reliabilityOutcome,
    resolvedAt: booking.dispute?.resolved_at ?? null,
  }
}
