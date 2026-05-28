export const DEFAULT_BOOKING_ACCEPT_TTL_MINUTES = 24 * 60
export const DEFAULT_BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES = 60

export function computeAcceptByFromAuthorizedAt(
  authorizedAt: Date,
  scheduledStart: Date,
  options: {
    ttlMinutes?: number
    cutoffBeforeStartMinutes?: number
  } = {},
) {
  const ttlMinutes = options.ttlMinutes ?? DEFAULT_BOOKING_ACCEPT_TTL_MINUTES
  const cutoffBeforeStartMinutes =
    options.cutoffBeforeStartMinutes ?? DEFAULT_BOOKING_ACCEPT_CUTOFF_BEFORE_START_MINUTES

  const requestWindowEndsAtMs = authorizedAt.getTime() + ttlMinutes * 60 * 1000
  const startCutoffMs = scheduledStart.getTime() - cutoffBeforeStartMinutes * 60 * 1000
  return new Date(Math.min(requestWindowEndsAtMs, startCutoffMs))
}
