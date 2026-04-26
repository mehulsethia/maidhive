type Role = 'client' | 'cleaner' | 'admin'

const ADDRESS_VISIBLE_STATUSES = new Set([
  'accepted',
  'confirmed',
  'in_progress',
  'completed',
  'disputed',
  'cancelled',
])

export function sanitizeBookingForRole<T extends Record<string, any>>(booking: T, role: Role): T {
  if (role !== 'cleaner') return booking
  return sanitizeBookingForCleaner(booking)
}

export function sanitizeBookingsForRole<T extends Record<string, any>>(bookings: T[], role: Role): T[] {
  if (role !== 'cleaner') return bookings
  return bookings.map((booking) => sanitizeBookingForCleaner(booking))
}

function sanitizeBookingForCleaner<T extends Record<string, any>>(booking: T): T {
  const copy: Record<string, any> = { ...booking }
  const status = String(copy.status ?? '')
  const scheduledStartMs = copy.scheduledStart ? new Date(copy.scheduledStart).getTime() : 0
  const phoneVisibleAtMs = scheduledStartMs - 6 * 60 * 60 * 1000
  const isAddressVisible = ADDRESS_VISIBLE_STATUSES.has(status)
  const isPhoneVisible = isAddressVisible && Date.now() >= phoneVisibleAtMs

  const fullClientName = String(copy?.client?.user?.name ?? '').trim()
  const firstName = fullClientName ? fullClientName.split(/\s+/)[0] : 'Client'

  if (copy.client?.user) {
    copy.client = {
      ...copy.client,
      user: {
        ...copy.client.user,
        name: firstName,
        phone: isPhoneVisible ? copy.client.user.phone : null,
      },
    }
  }

  if (!isAddressVisible) {
    copy.address = `Approximate area near ${copy.city ?? 'service location'}`
    copy.apartmentDetails = null
    copy.accessNotes = null
  }

  copy.cleanerPrivacy = {
    addressVisible: isAddressVisible,
    phoneVisible: isPhoneVisible,
    phoneVisibleAt: isAddressVisible && Number.isFinite(phoneVisibleAtMs)
      ? new Date(phoneVisibleAtMs).toISOString()
      : null,
    mapMode: isAddressVisible ? 'exact' : 'offset_50_100m',
    requestExpiresAt: copy.acceptBy ?? null,
  }

  return copy as T
}
