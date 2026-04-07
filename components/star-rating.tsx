import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  max?: number
  size?: 'sm' | 'md'
  showValue?: boolean
  className?: string
}

export function StarRating({ rating, max = 5, size = 'sm', showValue = true, className }: StarRatingProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(iconSize, i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted-foreground')}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-xs text-muted-foreground">{rating > 0 ? rating.toFixed(1) : 'New'}</span>
      )}
    </span>
  )
}
