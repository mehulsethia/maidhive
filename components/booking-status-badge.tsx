import { Badge } from '@/components/ui/badge'
import type { BookingStatus } from '@/types'

const STATUS_CONFIG: Record<BookingStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info' }> = {
  draft:       { label: 'Draft', variant: 'outline' },
  pending:     { label: 'Pending Cleaner Acceptance',     variant: 'warning' },
  accepted:    { label: 'Accepted',    variant: 'info' },
  confirmed:   { label: 'Confirmed',   variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed:   { label: 'Completed - Awaiting Release',   variant: 'success' },
  cancelled:   { label: 'Cancelled',   variant: 'secondary' },
  expired:     { label: 'Expired',     variant: 'secondary' },
  disputed:    { label: 'Under Review',    variant: 'destructive' },
}

function isPaymentAuthorized(paymentStatus?: string | null) {
  return ['authorized', 'captured', 'transferred'].includes(String(paymentStatus ?? ''))
}

export function BookingStatusBadge({
  status,
  paymentStatus,
  showPaymentRequiredForUnpaid = true,
}: {
  status: BookingStatus
  paymentStatus?: string | null
  showPaymentRequiredForUnpaid?: boolean
}) {
  const config = (showPaymentRequiredForUnpaid && (status === 'draft' || (status === 'pending' && !isPaymentAuthorized(paymentStatus))))
    ? { label: 'Payment Required', variant: 'warning' as const }
    : STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
