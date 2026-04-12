import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** IANA timezone for all user-facing times (Cyprus) */
export const APP_TIMEZONE = 'Europe/Nicosia'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(new Date(date))
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(new Date(date))
}
