import { describe, expect, it } from 'vitest'
import {
  cancellationEvaluationWindowStart,
  classifyCleanerCancellationWindow,
  cyprusCalendarDate,
  evaluateSuperCleaner,
  evaluateStartVerification,
  haversineDistanceM,
  isLastMinuteCancellation,
  publicOnTimeMetric,
} from '@/lib/super-cleaner'

function eligibleInput(overrides: Record<string, unknown> = {}) {
  return {
    completedReleasedCount: 20,
    averageRating: 4.6,
    noShowCount60d: 0,
    lastMinuteIncidentCount30d: 0,
    cancellationRate: 0.099,
    verifiedJobCount: 10,
    onTimeRate: 0.9,
    ...overrides,
  }
}

describe('Super Cleaner reliability rules', () => {
  it('requires every locked threshold', () => {
    expect(evaluateSuperCleaner(eligibleInput()).eligible).toBe(true)
    expect(evaluateSuperCleaner(eligibleInput({ completedReleasedCount: 19 })).eligible).toBe(false)
    expect(evaluateSuperCleaner(eligibleInput({ averageRating: 4.59 })).eligible).toBe(false)
    expect(evaluateSuperCleaner(eligibleInput({ noShowCount60d: 1 })).eligible).toBe(false)
    expect(evaluateSuperCleaner(eligibleInput({ lastMinuteIncidentCount30d: 2 })).eligible).toBe(false)
    expect(evaluateSuperCleaner(eligibleInput({ cancellationRate: 0.1 })).eligible).toBe(false)
    expect(evaluateSuperCleaner(eligibleInput({ verifiedJobCount: 9 })).eligible).toBe(false)
    expect(evaluateSuperCleaner(eligibleInput({ onTimeRate: 0.899 })).eligible).toBe(false)
  })

  it('requires both recovery obligations when they apply', () => {
    expect(
      evaluateSuperCleaner(eligibleInput({ cancellationRecoveryComplete: false })).eligible,
    ).toBe(false)
    expect(
      evaluateSuperCleaner(eligibleInput({ noShowRecoveryComplete: false })).eligible,
    ).toBe(false)
  })

  it('treats exactly 12 hours as non-last-minute and anything below it as last-minute', () => {
    const start = new Date('2026-07-10T12:00:00.000Z')
    expect(isLastMinuteCancellation(start, new Date('2026-07-10T00:00:00.000Z'))).toBe(false)
    expect(isLastMinuteCancellation(start, new Date('2026-07-10T00:00:00.001Z'))).toBe(true)
    expect(
      classifyCleanerCancellationWindow(
        start,
        new Date('2026-07-09T11:59:59.999Z'),
      ).window,
    ).toBe('more_than_24h')
    expect(
      classifyCleanerCancellationWindow(
        start,
        new Date('2026-07-09T12:00:00.001Z'),
      ).window,
    ).toBe('between_12h_24h')
    expect(
      classifyCleanerCancellationWindow(
        start,
        new Date('2026-07-10T00:00:00.000Z'),
      ).window,
    ).toBe('between_12h_24h')
  })

  it('groups multiple cancellations by Cyprus calendar day', () => {
    expect(cyprusCalendarDate(new Date('2026-07-05T21:30:00.000Z'))).toBe('2026-07-06')
    expect(cyprusCalendarDate(new Date('2026-07-06T18:00:00.000Z'))).toBe('2026-07-06')
  })

  it('uses the larger history represented by 60 days or the last 20 acceptances', () => {
    const now = new Date('2026-07-06T12:00:00.000Z')
    const dates = Array.from({ length: 20 }, (_, index) =>
      new Date(now.getTime() - (index + 50) * 24 * 60 * 60 * 1000),
    )
    expect(cancellationEvaluationWindowStart(now, dates).toISOString()).toBe(
      dates.at(-1)!.toISOString(),
    )
    expect(cancellationEvaluationWindowStart(now, []).toISOString()).toBe(
      '2026-05-07T12:00:00.000Z',
    )
  })

  it('uses the five-job public threshold independently of ten-job eligibility', () => {
    expect(publicOnTimeMetric(4, 1)).toEqual({
      on_time_percentage: null,
      on_time_label: 'Not enough data yet',
    })
    expect(publicOnTimeMetric(5, 0.8)).toEqual({
      on_time_percentage: 80,
      on_time_label: '80%',
    })
  })

  it('calculates distance closely enough for the 100 metre boundary rule', () => {
    expect(
      haversineDistanceM(
        { latitude: 34.917, longitude: 33.629 },
        { latitude: 34.9175, longitude: 33.629 },
      ),
    ).toBeGreaterThan(50)
    expect(
      evaluateStartVerification({
        hasStartLocation: true,
        hasTrustedCoordinates: true,
        accuracyM: 100,
        distanceM: 100,
      }),
    ).toEqual({ verified: true, failureReason: null })
    expect(
      evaluateStartVerification({
        hasStartLocation: true,
        hasTrustedCoordinates: true,
        accuracyM: 100,
        distanceM: 100.01,
      }),
    ).toEqual({ verified: false, failureReason: 'outside_required_radius' })
    expect(
      evaluateStartVerification({
        hasStartLocation: true,
        hasTrustedCoordinates: true,
        accuracyM: 100.01,
        distanceM: 50,
      }),
    ).toEqual({ verified: false, failureReason: 'gps_accuracy_insufficient' })
  })
})
