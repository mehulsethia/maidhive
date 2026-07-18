import type { BookingRead } from '@/types'

export const SERVICE_CLASSIFICATION_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep_clean: 'Deep Clean',
  end_of_tenancy: 'End of Tenancy',
  move_in: 'Move-in Clean',
}

export function getBookingServiceClassificationLabel(booking: Pick<BookingRead, 'service_type'>) {
  return SERVICE_CLASSIFICATION_LABELS[booking.service_type] ?? booking.service_type
}

export function getBookingCleaningTypeLabel(
  booking: Pick<BookingRead, 'service_type' | 'special_instructions'>,
) {
  const snapshotMatch = booking.special_instructions?.match(/(?:^|\n)Job type:\s*([^\n]+)/i)
  const snapshotJobType = snapshotMatch?.[1]?.trim()
  return snapshotJobType || getBookingServiceClassificationLabel(booking)
}
