import { Badge } from '@/components/ui/badge'
import type { BookingStatus } from '@/types'

const STATUS_CONFIG: Record<BookingStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info' }> = {
  pending:     { label: 'Pending',     variant: 'warning' },
  accepted:    { label: 'Accepted',    variant: 'info' },
  confirmed:   { label: 'Confirmed',   variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed:   { label: 'Completed',   variant: 'success' },
  cancelled:   { label: 'Cancelled',   variant: 'secondary' },
  expired:     { label: 'Expired',     variant: 'secondary' },
  disputed:    { label: 'Disputed',    variant: 'destructive' },
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
