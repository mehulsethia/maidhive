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
  if (role === 'admin') return booking
  const withoutAdminAudit = { ...booking, actionEvents: undefined }
  if (role === 'client') return withoutAdminAudit
  return sanitizeBookingForCleaner(withoutAdminAudit)
}

export function sanitizeBookingsForRole<T extends Record<string, any>>(bookings: T[], role: Role): T[] {
  if (role !== 'cleaner') return bookings
  return bookings.map((booking) => sanitizeBookingForCleaner(booking))
}

function sanitizeBookingForCleaner<T extends Record<string, any>>(booking: T): T {
  const copy: Record<string, any> = { ...booking }
  const status = String(copy.status ?? '')
  const cancelledBeforeConfirmation =
    status === 'cancelled' &&
    !copy.acceptedAt &&
    !copy.confirmedAt
  const scheduledStartMs = copy.scheduledStart ? new Date(copy.scheduledStart).getTime() : 0
  const scheduledEndMs = copy.scheduledEnd ? new Date(copy.scheduledEnd).getTime() : 0
  const createdAtMs = copy.createdAt ? new Date(copy.createdAt).getTime() : Number.NaN
  const phoneVisibleAtMs = scheduledStartMs - 6 * 60 * 60 * 1000
  const phoneVisibleUntilMs = scheduledEndMs + 30 * 60 * 1000
  const sameCyprusDayCreated =
    Number.isFinite(createdAtMs) &&
    Number.isFinite(scheduledStartMs) &&
    cyprusDateStr(new Date(createdAtMs)) === cyprusDateStr(new Date(scheduledStartMs))
  const createdWithinSixHoursOfStart =
    sameCyprusDayCreated &&
    scheduledStartMs - createdAtMs < 6 * 60 * 60 * 1000
  const unlockedByRule = Date.now() >= phoneVisibleAtMs || createdWithinSixHoursOfStart
  const isAddressVisible = ADDRESS_VISIBLE_STATUSES.has(status) && !cancelledBeforeConfirmation
  const isPostCompletionPhoneLocked = status === 'completed' || status === 'disputed'
  const isPhoneVisible = isAddressVisible && unlockedByRule && Date.now() <= phoneVisibleUntilMs && !isPostCompletionPhoneLocked

  const fullClientName = String(copy?.client?.user?.name ?? '').trim()
  const firstName = fullClientName ? fullClientName.split(/\s+/)[0] : 'Client'

  if (copy.client?.user) {
    const completedBookingsCount = Number(copy?.client?._count?.bookings ?? 0)
    const memberSince = copy?.client?.createdAt
      ? new Date(copy.client.createdAt).toISOString()
      : null

    copy.client = {
      ...copy.client,
      _count: undefined,
      user: {
        ...copy.client.user,
        name: firstName,
        phone: isPhoneVisible ? copy.client.user.phone : null,
      },
      trust: {
        memberSince,
        completedBookingsCount,
        idSubmitted: Boolean(copy.client.idFileUrl ?? copy.client.id_file_url),
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
    phoneVisibleUntil: isAddressVisible && Number.isFinite(phoneVisibleUntilMs)
      ? new Date(phoneVisibleUntilMs).toISOString()
      : null,
    mapMode: isAddressVisible ? 'exact' : 'offset_50_100m',
    requestExpiresAt: copy.acceptBy ?? null,
  }

  return copy as T
}

function cyprusDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(date)
}
