import { cn } from '@/lib/utils'

function toInitials(name?: string, fallback = 'U') {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return fallback.toUpperCase().slice(0, 2)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function UserAvatar({
  name,
  imageUrl,
  className,
  fallbackClassName,
  textClassName,
  alt = '',
  fallback = 'U',
}: {
  name?: string
  imageUrl?: string | null
  className?: string
  fallbackClassName?: string
  textClassName?: string
  alt?: string
  fallback?: string
}) {
  const initials = toInitials(name, fallback)

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={cn('rounded-full object-cover', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'grid place-items-center rounded-full bg-primary/10 text-primary',
        className,
        fallbackClassName,
      )}
      aria-label={name ? `${name} avatar` : 'avatar'}
    >
      <span className={cn('font-semibold uppercase', textClassName)}>{initials}</span>
    </div>
  )
}

