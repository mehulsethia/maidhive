import { Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SuperCleanerBadgeProps {
  className?: string
  onDark?: boolean
}

export function SuperCleanerBadge({
  className,
  onDark = false,
}: SuperCleanerBadgeProps) {
  return (
    <span
      title="Cleaners with consistent high ratings, reliability and performance."
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        onDark
          ? 'border-amber-200/50 bg-amber-300/20 text-amber-100'
          : 'border-amber-300 bg-amber-50 text-amber-800',
        className,
      )}
    >
      <Award className="h-3 w-3" aria-hidden="true" />
      Super Cleaner
    </span>
  )
}
