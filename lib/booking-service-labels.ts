import type { BookingRead } from '@/types'

export const SERVICE_CLASSIFICATION_LABELS: Record<string, string> = {
  standard: 'Regular home cleaning',
  deep_clean: 'Deep cleaning',
  end_of_tenancy: 'End-of-tenancy cleaning',
  move_in: 'End-of-tenancy cleaning',
}

const CLEANING_TYPE_LABEL_ALIASES: Record<string, string> = {
  'regular clean': 'Regular home cleaning',
  'regular home clean': 'Regular home cleaning',
  'regular home cleaning': 'Regular home cleaning',
  'standard clean': 'Regular home cleaning',
  'one-off clean': 'One-off cleaning',
  'one off clean': 'One-off cleaning',
  'one-off cleaning': 'One-off cleaning',
  'deep clean': 'Deep cleaning',
  'deep cleaning': 'Deep cleaning',
  'deep cleaning sessions': 'Deep cleaning',
  'end of tenancy': 'End-of-tenancy cleaning',
  'end-of-tenancy cleaning': 'End-of-tenancy cleaning',
  'move in/out': 'End-of-tenancy cleaning',
  'move-in/out': 'End-of-tenancy cleaning',
  'move out': 'End-of-tenancy cleaning',
  'move-out / end of tenancy': 'End-of-tenancy cleaning',
}

const PROPERTY_CONDITION_LABEL_ALIASES: Record<string, string> = {
  'light / well maintained': 'Light clean / well maintained',
  'light clean / well maintained': 'Light clean / well maintained',
  normal: 'Standard clean',
  'standard clean': 'Standard clean',
  'needs extra attention': 'Needs extra attention',
  'very dirty / heavy clean': 'Very dirty / heavy clean',
}

export function normalizeBookingCleaningTypeLabel(label?: string | null) {
  const trimmed = label?.trim()
  if (!trimmed) return trimmed ?? ''
  return CLEANING_TYPE_LABEL_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

export function normalizePropertyConditionLabel(label?: string | null) {
  const trimmed = label?.trim()
  if (!trimmed) return trimmed ?? ''
  return PROPERTY_CONDITION_LABEL_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

export function getBookingServiceClassificationLabel(booking: Pick<BookingRead, 'service_type'>) {
  return SERVICE_CLASSIFICATION_LABELS[booking.service_type] ?? booking.service_type
}

export function getBookingCleaningTypeLabel(
  booking: Pick<BookingRead, 'service_type' | 'special_instructions'>,
) {
  const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
  const snapshotJobType = snapshotMatch?.[1]?.trim()
  return normalizeBookingCleaningTypeLabel(snapshotJobType || getBookingServiceClassificationLabel(booking))
}
