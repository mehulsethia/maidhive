import { Badge } from '@/components/ui/badge'
import { isCompletedBookingReleased } from '@/lib/booking-release'
import type { BookingStatus } from '@/types'

const STATUS_CONFIG: Record<BookingStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info' }> = {
  draft:       { label: 'Draft', variant: 'outline' },
  pending:     { label: 'Pending Cleaner Acceptance',     variant: 'warning' },
  accepted:    { label: 'Accepted',    variant: 'info' },
  confirmed:   { label: 'Confirmed',   variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed:   { label: 'Completed - Awaiting Release',   variant: 'success' },
  cancelled:   { label: 'Cancelled',   variant: 'secondary' },
  declined:    { label: 'Declined',    variant: 'secondary' },
  expired:     { label: 'Expired',     variant: 'secondary' },
  disputed:    { label: 'Under Review',    variant: 'destructive' },
}

function isPaymentAuthorized(paymentStatus?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
}

function pendingLabel(proposalBy?: 'client' | 'cleaner' | null) {
  if (proposalBy === 'cleaner') return 'Awaiting Client Response'
  if (proposalBy === 'client') return 'Awaiting Cleaner Response'
  return STATUS_CONFIG.pending.label
}

export function BookingStatusBadge({
  status,
  paymentStatus,
  transferredAt,
  scheduledEnd,
  proposalBy,
  showPaymentRequiredForUnpaid = true,
  audience,
  cleanerNoPayout = false,
}: {
  status: BookingStatus
  paymentStatus?: string | null
  transferredAt?: string | Date | null
  scheduledEnd?: string | Date | null
  proposalBy?: 'client' | 'cleaner' | null
  showPaymentRequiredForUnpaid?: boolean
  audience?: 'client' | 'cleaner' | 'admin'
  cleanerNoPayout?: boolean
}) {
  const paymentWasFullyRefunded = String(paymentStatus ?? '') === 'refunded'
  const completedLabel = audience === 'cleaner' && (cleanerNoPayout || paymentWasFullyRefunded)
    ? 'Completed · No payout'
    : audience === 'client' || paymentWasFullyRefunded
    ? 'Completed'
    : isCompletedBookingReleased({ status, paymentStatus, transferredAt, scheduledEnd })
    ? 'Completed - Released'
    : STATUS_CONFIG.completed.label

  const config = (showPaymentRequiredForUnpaid && (status === 'draft' || (status === 'pending' && !isPaymentAuthorized(paymentStatus))))
    ? { label: 'Payment Required', variant: 'warning' as const }
    : status === 'pending'
      ? { label: pendingLabel(proposalBy), variant: STATUS_CONFIG.pending.variant }
      : status === 'completed'
        ? { label: completedLabel, variant: STATUS_CONFIG.completed.variant }
      : STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
