export function toUtcDateOnly(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().slice(0, 10)
}

export function todayUtcDateOnly(): string {
  return toUtcDateOnly(new Date())
}

export function startOfUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`)
}

export function endOfUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T23:59:59.999Z`)
}

export function addUtcDays(dateOnly: string, days: number): string {
  const date = startOfUtcDate(dateOnly)
  date.setUTCDate(date.getUTCDate() + days)
  return toUtcDateOnly(date)
}

export function dateOnlyLabel(dateOnly: string, locale?: string): string {
  return new Date(`${dateOnly}T12:00:00.000Z`).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
