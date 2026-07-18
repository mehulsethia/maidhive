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
  active_strikes: boolean
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
  activeStrikeCount?: number
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
    active_strikes: (input.activeStrikeCount ?? 0) === 0,
    cancellation_recovery: input.cancellationRecoveryComplete ?? true,
    no_show_recovery: input.noShowRecoveryComplete ?? true,
  }

  return {
    eligible: Object.values(criteria).every(Boolean),
    criteria,
  }
}

export type SuperCleanerEligibilityChecklistItem = {
  key: keyof SuperCleanerCriteria
  label: string
  value: string
  requirement: string
  met: boolean
}

function formatPercent(value: number | null) {
  if (value === null) return 'Not available'
  return `${(value * 100).toFixed(1)}%`
}

function formatRating(value: number | null) {
  if (value === null) return 'No public rating'
  return value.toFixed(1)
}

export function buildSuperCleanerEligibilityChecklist(input: {
  completedReleasedCount: number
  averageRating: number | null
  noShowCount60d: number
  lastMinuteIncidentCount30d: number
  cancellationRate: number
  verifiedJobCount: number
  onTimeRate: number | null
  activeStrikeCount?: number
  cancellationRecoveryComplete?: boolean
  noShowRecoveryComplete?: boolean
}): SuperCleanerEligibilityChecklistItem[] {
  const { criteria } = evaluateSuperCleaner(input)
  const activeStrikeCount = input.activeStrikeCount ?? 0
  const onTimeValue =
    input.verifiedJobCount < SUPER_CLEANER_VERIFIED_MIN || input.onTimeRate === null
      ? 'Not enough verified jobs'
      : `${formatPercent(input.onTimeRate)} / ${formatPercent(SUPER_CLEANER_ON_TIME_MIN)} required`

  return [
    {
      key: 'completed_bookings',
      label: 'Successfully completed bookings',
      value: `${input.completedReleasedCount} / ${SUPER_CLEANER_COMPLETED_MIN}`,
      requirement: `${SUPER_CLEANER_COMPLETED_MIN} required`,
      met: criteria.completed_bookings,
    },
    {
      key: 'average_rating',
      label: 'Average rating',
      value: `${formatRating(input.averageRating)} / ${SUPER_CLEANER_RATING_MIN.toFixed(1)} required`,
      requirement: `${SUPER_CLEANER_RATING_MIN.toFixed(1)} required`,
      met: criteria.average_rating,
    },
    {
      key: 'no_no_shows_60d',
      label: `No-shows (last ${NO_SHOW_WINDOW_DAYS} days)`,
      value: String(input.noShowCount60d),
      requirement: 'Must be 0',
      met: criteria.no_no_shows_60d,
    },
    {
      key: 'last_minute_incidents_30d',
      label: `Last-minute cancellations (last ${LAST_MINUTE_INCIDENT_WINDOW_DAYS} days)`,
      value: String(input.lastMinuteIncidentCount30d),
      requirement: 'Must be fewer than 2',
      met: criteria.last_minute_incidents_30d,
    },
    {
      key: 'cancellation_rate',
      label: 'Cancellation rate',
      value: `${formatPercent(input.cancellationRate)} (must be below 10%)`,
      requirement: 'Must be below 10%',
      met: criteria.cancellation_rate,
    },
    {
      key: 'verified_jobs',
      label: 'Verified jobs',
      value: `${input.verifiedJobCount} / ${SUPER_CLEANER_VERIFIED_MIN}`,
      requirement: `${SUPER_CLEANER_VERIFIED_MIN} required`,
      met: criteria.verified_jobs,
    },
    {
      key: 'on_time_rate',
      label: 'On-time rate',
      value: onTimeValue,
      requirement: `${formatPercent(SUPER_CLEANER_ON_TIME_MIN)} required from ${SUPER_CLEANER_VERIFIED_MIN} verified jobs`,
      met: criteria.on_time_rate,
    },
    {
      key: 'active_strikes',
      label: 'Active strikes',
      value: String(activeStrikeCount),
      requirement: 'Must be 0',
      met: criteria.active_strikes,
    },
    {
      key: 'cancellation_recovery',
      label: 'Last-minute cancellation recovery',
      value: input.cancellationRecoveryComplete === false ? 'Recovery requirement active' : 'No active recovery requirement',
      requirement: `${CANCELLATION_RECOVERY_COMPLETIONS} completed bookings after recovery window when required`,
      met: criteria.cancellation_recovery,
    },
    {
      key: 'no_show_recovery',
      label: 'No-show recovery',
      value: input.noShowRecoveryComplete === false ? 'Recovery requirement active' : 'No active recovery requirement',
      requirement: `${NO_SHOW_RECOVERY_COMPLETIONS} completed bookings after recovery window when required`,
      met: criteria.no_show_recovery,
    },
  ]
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
