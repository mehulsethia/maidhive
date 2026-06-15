export function getClientTrustMetadata(client: any) {
  const trust = client?.trust ?? {}
  const completedBookingsRaw =
    trust.completedBookingsCount ??
    trust.completed_bookings_count ??
    0

  return {
    memberSince:
      trust.memberSince ??
      trust.member_since ??
      client?.created_at ??
      client?.createdAt ??
      null,
    completedBookingsCount: Number(completedBookingsRaw) || 0,
  }
}
