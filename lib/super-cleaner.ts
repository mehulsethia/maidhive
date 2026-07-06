export const SUPER_CLEANER_COMPLETED_MIN = 20
export const SUPER_CLEANER_RATING_MIN = 4.6
export const SUPER_CLEANER_ON_TIME_MIN = 0.9
export const SUPER_CLEANER_VERIFIED_MIN = 10
export const PUBLIC_ON_TIME_VERIFIED_MIN = 5
export const LAST_MINUTE_CANCELLATION_HOURS = 12
export const LAST_MINUTE_INCIDENT_WINDOW_DAYS = 30
export const NO_SHOW_WINDOW_DAYS = 60
export const STRIKE_ACTIVE_DAYS = 90
export const CANCELLATION_RECOVERY_COMPLETIONS = 3
export const NO_SHOW_RECOVERY_COMPLETIONS = 5
export const START_VERIFICATION_RADIUS_M = 100
export const START_VERIFICATION_MAX_ACCURACY_M = 100
export const ON_TIME_GRACE_MINUTES = 15

export type CleanerCancellationWindow =
  | 'more_than_24h'
  | 'between_12h_24h'
  | 'less_than_12h'

export type SuperCleanerCriteria = {
  completed_bookings: boolean
  average_rating: boolean
  no_no_shows_60d: boolean
  last_minute_incidents_30d: boolean
  cancellation_rate: boolean
  verified_jobs: boolean
  on_time_rate: boolean
  cancellation_recovery: boolean
  no_show_recovery: boolean
}

export function evaluateSuperCleaner(input: {
  completedReleasedCount: number
  averageRating: number | null
  noShowCount60d: number
  lastMinuteIncidentCount30d: number
  cancellationRate: number
  verifiedJobCount: number
  onTimeRate: number | null
  cancellationRecoveryComplete?: boolean
  noShowRecoveryComplete?: boolean
}) {
  const criteria: SuperCleanerCriteria = {
    completed_bookings: input.completedReleasedCount >= SUPER_CLEANER_COMPLETED_MIN,
    average_rating:
      input.averageRating !== null && input.averageRating >= SUPER_CLEANER_RATING_MIN,
    no_no_shows_60d: input.noShowCount60d === 0,
    last_minute_incidents_30d: input.lastMinuteIncidentCount30d < 2,
    cancellation_rate: input.cancellationRate < 0.1,
    verified_jobs: input.verifiedJobCount >= SUPER_CLEANER_VERIFIED_MIN,
    on_time_rate:
      input.verifiedJobCount >= SUPER_CLEANER_VERIFIED_MIN &&
      input.onTimeRate !== null &&
      input.onTimeRate >= SUPER_CLEANER_ON_TIME_MIN,
    cancellation_recovery: input.cancellationRecoveryComplete ?? true,
    no_show_recovery: input.noShowRecoveryComplete ?? true,
  }

  return {
    eligible: Object.values(criteria).every(Boolean),
    criteria,
  }
}

export function isLastMinuteCancellation(scheduledStart: Date, cancelledAt: Date) {
  return classifyCleanerCancellationWindow(scheduledStart, cancelledAt).window === 'less_than_12h'
}

export function classifyCleanerCancellationWindow(
  scheduledStart: Date,
  cancelledAt: Date,
): {
  window: CleanerCancellationWindow
  hoursBeforeStart: number
  isLastMinute: boolean
} {
  const hoursBeforeStart =
    (scheduledStart.getTime() - cancelledAt.getTime()) / (60 * 60 * 1000)
  const window: CleanerCancellationWindow =
    hoursBeforeStart < LAST_MINUTE_CANCELLATION_HOURS
      ? 'less_than_12h'
      : hoursBeforeStart <= 24
        ? 'between_12h_24h'
        : 'more_than_24h'
  return {
    window,
    hoursBeforeStart,
    isLastMinute: window === 'less_than_12h',
  }
}

export function cyprusCalendarDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(date)
}

export function haversineDistanceM(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusM = 6_371_000
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const firstLatitude = radians(first.latitude)
  const secondLatitude = radians(second.latitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function evaluateStartVerification(input: {
  hasStartLocation: boolean
  hasTrustedCoordinates: boolean
  accuracyM: number | null
  distanceM: number | null
}) {
  const verified =
    input.hasStartLocation &&
    input.hasTrustedCoordinates &&
    input.accuracyM !== null &&
    input.accuracyM <= START_VERIFICATION_MAX_ACCURACY_M &&
    input.distanceM !== null &&
    input.distanceM <= START_VERIFICATION_RADIUS_M
  const failureReason = verified
    ? null
    : !input.hasStartLocation
      ? 'gps_unavailable'
      : !input.hasTrustedCoordinates
        ? 'booking_coordinates_unavailable'
        : input.accuracyM === null ||
            input.accuracyM > START_VERIFICATION_MAX_ACCURACY_M
          ? 'gps_accuracy_insufficient'
          : 'outside_required_radius'
  return { verified, failureReason }
}

export function publicOnTimeMetric(verifiedJobCount: number, onTimeRate: number | null) {
  if (verifiedJobCount < PUBLIC_ON_TIME_VERIFIED_MIN || onTimeRate === null) {
    return { on_time_percentage: null, on_time_label: 'Not enough data yet' }
  }
  const percentage = Math.round(onTimeRate * 100)
  return { on_time_percentage: percentage, on_time_label: `${percentage}%` }
}

export function cancellationEvaluationWindowStart(now: Date, recentAcceptedAt: Date[]) {
  const sixtyDaysAgo = new Date(now.getTime() - NO_SHOW_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const ordered = [...recentAcceptedAt]
    .sort((first, second) => second.getTime() - first.getTime())
    .slice(0, 20)
  const oldestOfLastTwenty = ordered.at(-1)
  if (!oldestOfLastTwenty) return sixtyDaysAgo
  return oldestOfLastTwenty.getTime() < sixtyDaysAgo.getTime()
    ? oldestOfLastTwenty
    : sixtyDaysAgo
}
