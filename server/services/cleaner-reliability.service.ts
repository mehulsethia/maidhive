import { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import {
  CANCELLATION_RECOVERY_COMPLETIONS,
  LAST_MINUTE_INCIDENT_WINDOW_DAYS,
  NO_SHOW_RECOVERY_COMPLETIONS,
  NO_SHOW_WINDOW_DAYS,
  ON_TIME_GRACE_MINUTES,
  STRIKE_ACTIVE_DAYS,
  cyprusCalendarDate,
  cancellationEvaluationWindowStart,
  classifyCleanerCancellationWindow,
  evaluateSuperCleaner,
  evaluateStartVerification,
  haversineDistanceM,
  publicOnTimeMetric,
} from '@/lib/super-cleaner'

const DAY_MS = 24 * 60 * 60 * 1000
const INCIDENT_LAST_MINUTE = 'last_minute_cancellation'
const INCIDENT_NO_SHOW = 'confirmed_no_show'

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function minimumFutureDate(values: Array<Date | null | undefined>, now: Date) {
  const dates = values.filter(
    (value): value is Date => Boolean(value && value.getTime() > now.getTime()),
  )
  if (dates.length === 0) return null
  return new Date(Math.min(...dates.map((value) => value.getTime())))
}

async function completedDuringRecovery(cleanerId: string, start: Date, days: number) {
  return db.booking.count({
    where: {
      cleanerId,
      status: 'completed',
      completedAt: { gte: start, lte: addDays(start, days) },
      payment: { is: { status: 'transferred' } },
    },
  })
}

export const cleanerReliabilityService = {
  async recalculate(cleanerId: string, now = new Date()) {
    const cleaner = await db.cleaner.findUnique({
      where: { id: cleanerId },
      select: { id: true, userId: true, reliabilitySnapshot: true },
    })
    if (!cleaner) return null

    const sixtyDaysAgo = addDays(now, -60)
    const thirtyDaysAgo = addDays(now, -LAST_MINUTE_INCIDENT_WINDOW_DAYS)
    const acceptedTail = await db.booking.findMany({
      where: { cleanerId, acceptedAt: { not: null } },
      select: { acceptedAt: true },
      orderBy: { acceptedAt: 'desc' },
      take: 20,
    })
    const cancellationBoundary = cancellationEvaluationWindowStart(
      now,
      acceptedTail.flatMap((booking) => booking.acceptedAt ? [booking.acceptedAt] : []),
    )

    const [
      completedReleasedCount,
      reviewAggregate,
      cancellationDenominator,
      cancellationNumerator,
      lastMinuteIncidents,
      noShowIncidents,
      verifiedJobCount,
      onTimeVerifiedCount,
      activeStrikes,
    ] = await Promise.all([
      db.booking.count({
        where: {
          cleanerId,
          status: 'completed',
          payment: { is: { status: 'transferred' } },
        },
      }),
      db.review.aggregate({
        where: { cleanerId, isPublic: true },
        _avg: { rating: true },
      }),
      db.booking.count({
        where: { cleanerId, acceptedAt: { gte: cancellationBoundary } },
      }),
      db.booking.count({
        where: {
          cleanerId,
          acceptedAt: { gte: cancellationBoundary },
          cancelledBy: cleaner.userId,
        },
      }),
      db.cleanerReliabilityIncident.findMany({
        where: {
          cleanerId,
          incidentType: INCIDENT_LAST_MINUTE,
          occurredAt: { gte: thirtyDaysAgo },
        },
        select: { occurredAt: true, latestAt: true },
        orderBy: { occurredAt: 'asc' },
      }),
      db.cleanerReliabilityIncident.findMany({
        where: {
          cleanerId,
          incidentType: INCIDENT_NO_SHOW,
          occurredAt: { gte: sixtyDaysAgo },
        },
        select: { occurredAt: true, latestAt: true },
        orderBy: { occurredAt: 'asc' },
      }),
      db.cleanerStartVerification.count({ where: { cleanerId, verified: true } }),
      db.cleanerStartVerification.count({
        where: { cleanerId, verified: true, onTime: true },
      }),
      db.cleanerStrike.findMany({
        where: {
          cleanerId,
          strikeType: { in: ['reliability_last_minute_cancellation', 'reliability_no_show'] },
          expiresAt: { gt: now },
        },
        select: { expiresAt: true },
      }),
    ])

    const previous = cleaner.reliabilitySnapshot
    const cancellationRecoveryStart = previous?.recoveryCancellationStartedAt ?? null
    const noShowRecoveryStart = previous?.recoveryNoShowStartedAt ?? null
    const cancellationRecoveryCompletions = cancellationRecoveryStart
      ? await completedDuringRecovery(
          cleanerId,
          cancellationRecoveryStart,
          LAST_MINUTE_INCIDENT_WINDOW_DAYS,
        )
      : 0
    const noShowRecoveryCompletions = noShowRecoveryStart
      ? await completedDuringRecovery(cleanerId, noShowRecoveryStart, NO_SHOW_WINDOW_DAYS)
      : 0
    const cancellationRecoveryComplete =
      !cancellationRecoveryStart ||
      (now >= addDays(cancellationRecoveryStart, LAST_MINUTE_INCIDENT_WINDOW_DAYS) &&
        cancellationRecoveryCompletions >= CANCELLATION_RECOVERY_COMPLETIONS)
    const noShowRecoveryComplete =
      !noShowRecoveryStart ||
      (now >= addDays(noShowRecoveryStart, NO_SHOW_WINDOW_DAYS) &&
        noShowRecoveryCompletions >= NO_SHOW_RECOVERY_COMPLETIONS)

    const averageRating = reviewAggregate._avg.rating ?? null
    const cancellationRate =
      cancellationDenominator > 0 ? cancellationNumerator / cancellationDenominator : 0
    const onTimeRate =
      verifiedJobCount > 0 ? onTimeVerifiedCount / verifiedJobCount : null
    const evaluation = evaluateSuperCleaner({
      completedReleasedCount,
      averageRating,
      noShowCount60d: noShowIncidents.length,
      lastMinuteIncidentCount30d: lastMinuteIncidents.length,
      cancellationRate,
      verifiedJobCount,
      onTimeRate,
      activeStrikeCount: activeStrikes.length,
      cancellationRecoveryComplete,
      noShowRecoveryComplete,
    })
    const wasSuperCleaner = previous?.isSuperCleaner ?? false
    const nextEvaluationAt = minimumFutureDate([
      ...lastMinuteIncidents.map((incident) =>
        addDays(incident.occurredAt, LAST_MINUTE_INCIDENT_WINDOW_DAYS),
      ),
      ...noShowIncidents.map((incident) => addDays(incident.occurredAt, NO_SHOW_WINDOW_DAYS)),
      cancellationRecoveryStart
        ? addDays(cancellationRecoveryStart, LAST_MINUTE_INCIDENT_WINDOW_DAYS)
        : null,
      noShowRecoveryStart ? addDays(noShowRecoveryStart, NO_SHOW_WINDOW_DAYS) : null,
      ...activeStrikes.map((strike) => strike.expiresAt),
    ], now)

    const data = {
      isSuperCleaner: evaluation.eligible,
      completedReleasedCount,
      averageRating,
      cancellationNumerator,
      cancellationDenominator,
      cancellationRate,
      lastMinuteIncidentCount30d: lastMinuteIncidents.length,
      noShowCount60d: noShowIncidents.length,
      verifiedJobCount,
      onTimeVerifiedCount,
      onTimeRate,
      activeStrikeCount: activeStrikes.length,
      criteria: evaluation.criteria as unknown as Prisma.InputJsonValue,
      recoveryCancellationStartedAt:
        evaluation.eligible && cancellationRecoveryComplete ? null : cancellationRecoveryStart,
      recoveryNoShowStartedAt:
        evaluation.eligible && noShowRecoveryComplete ? null : noShowRecoveryStart,
      lostAt:
        wasSuperCleaner && !evaluation.eligible ? now : previous?.lostAt ?? null,
      lossReason:
        wasSuperCleaner && !evaluation.eligible
          ? Object.entries(evaluation.criteria)
              .filter(([, passed]) => !passed)
              .map(([criterion]) => criterion)
              .join(',')
          : evaluation.eligible
            ? null
            : previous?.lossReason ?? null,
      awardedAt:
        evaluation.eligible && !wasSuperCleaner ? now : previous?.awardedAt ?? null,
      nextEvaluationAt,
      lastCalculatedAt: now,
      dirtyAt: null,
    }

    const snapshot = await db.cleanerReliabilitySnapshot.upsert({
      where: { cleanerId },
      create: { cleanerId, ...data },
      update: data,
    })
    await db.cleaner.update({
      where: { id: cleanerId },
      data: {
        totalJobs: completedReleasedCount,
        averageRating,
      },
    })

    if (wasSuperCleaner !== snapshot.isSuperCleaner) {
      console.info('cleaner_reliability.status_changed', {
        cleaner_id: cleanerId,
        was_super_cleaner: wasSuperCleaner,
        is_super_cleaner: snapshot.isSuperCleaner,
        loss_reason: snapshot.lossReason,
      })
    }
    return snapshot
  },

  async recordLastMinuteCancellation(input: {
    cleanerId: string
    bookingId: string
    occurredAt: Date
    issuedBy: string
  }) {
    const incidentDate = cyprusCalendarDate(input.occurredAt)
    const previous = await db.cleanerReliabilitySnapshot.findUnique({
      where: { cleanerId: input.cleanerId },
    })
    const incident = await db.$transaction(async (tx) => {
      if (typeof tx.$executeRawUnsafe === 'function') {
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          input.cleanerId,
        )
      }
      const existing = await tx.cleanerReliabilityIncident.findUnique({
        where: {
          cleanerId_incidentType_sourceKey: {
            cleanerId: input.cleanerId,
            incidentType: INCIDENT_LAST_MINUTE,
            sourceKey: incidentDate,
          },
        },
      })
      if (existing) {
        if (existing.bookingIds.includes(input.bookingId)) {
          return { record: existing, created: false, strikeIssued: false }
        }
        const updated = await tx.cleanerReliabilityIncident.update({
          where: { id: existing.id },
          data: {
            bookingIds: { push: input.bookingId },
            latestAt: input.occurredAt,
          },
        })
        return { record: updated, created: false, strikeIssued: false }
      }

      const created = await tx.cleanerReliabilityIncident.create({
        data: {
          cleanerId: input.cleanerId,
          bookingId: input.bookingId,
          bookingIds: [input.bookingId],
          incidentType: INCIDENT_LAST_MINUTE,
          incidentDate,
          sourceKey: incidentDate,
          occurredAt: input.occurredAt,
          latestAt: input.occurredAt,
        },
      })
      const priorIncident = await tx.cleanerReliabilityIncident.findFirst({
        where: {
          cleanerId: input.cleanerId,
          incidentType: INCIDENT_LAST_MINUTE,
          id: { not: created.id },
          occurredAt: { gte: addDays(input.occurredAt, -LAST_MINUTE_INCIDENT_WINDOW_DAYS) },
        },
      })
      if (priorIncident) {
        await tx.cleanerStrike.create({
          data: {
            cleanerId: input.cleanerId,
            bookingId: input.bookingId,
            incidentId: created.id,
            strikeType: 'reliability_last_minute_cancellation',
            reason: 'Repeated last-minute cancellation incident within 30 days',
            issuedBy: input.issuedBy,
            expiresAt: addDays(input.occurredAt, STRIKE_ACTIVE_DAYS),
          },
        })
      }
      return { record: created, created: true, strikeIssued: Boolean(priorIncident) }
    })

    if (
      incident.created &&
      Boolean(
        previous?.recoveryCancellationStartedAt ||
          (incident.strikeIssued && previous?.isSuperCleaner),
      )
    ) {
      await db.cleanerReliabilitySnapshot.updateMany({
        where: { cleanerId: input.cleanerId },
        data: {
          isSuperCleaner: false,
          recoveryCancellationStartedAt: input.occurredAt,
          lostAt: input.occurredAt,
          lossReason: 'repeated_last_minute_cancellation',
          dirtyAt: input.occurredAt,
        },
      })
    }
    return this.recalculate(input.cleanerId, input.occurredAt)
  },

  async recordCleanerCancellation(input: {
    cleanerId: string
    bookingId: string
    scheduledStart: Date
    cancelledAt: Date
    issuedBy: string
    acceptedBooking: boolean
  }) {
    const classification = classifyCleanerCancellationWindow(
      input.scheduledStart,
      input.cancelledAt,
    )
    const event = await db.cleanerCancellationEvent.upsert({
      where: { bookingId: input.bookingId },
      create: {
        cleanerId: input.cleanerId,
        bookingId: input.bookingId,
        cancelledByUserId: input.issuedBy,
        cancellationWindow: classification.window,
        acceptedBooking: input.acceptedBooking,
        isLastMinute: classification.isLastMinute,
        scheduledStart: input.scheduledStart,
        cancelledAt: input.cancelledAt,
        hoursBeforeStart: classification.hoursBeforeStart,
      },
      update: {
        cancelledByUserId: input.issuedBy,
        cancellationWindow: classification.window,
        acceptedBooking: input.acceptedBooking,
        isLastMinute: classification.isLastMinute,
        scheduledStart: input.scheduledStart,
        cancelledAt: input.cancelledAt,
        hoursBeforeStart: classification.hoursBeforeStart,
      },
    })

    if (input.acceptedBooking && classification.isLastMinute) {
      const snapshot = await this.recordLastMinuteCancellation({
        cleanerId: input.cleanerId,
        bookingId: input.bookingId,
        occurredAt: input.cancelledAt,
        issuedBy: input.issuedBy,
      })
      const incident = await db.cleanerReliabilityIncident.findUnique({
        where: {
          cleanerId_incidentType_sourceKey: {
            cleanerId: input.cleanerId,
            incidentType: INCIDENT_LAST_MINUTE,
            sourceKey: cyprusCalendarDate(input.cancelledAt),
          },
        },
        select: { id: true },
      })
      if (incident) {
        await db.cleanerCancellationEvent.update({
          where: { id: event.id },
          data: { incidentId: incident.id },
        })
      }
      return { event, snapshot }
    }

    const snapshot = await this.recalculate(input.cleanerId, input.cancelledAt)
    return { event, snapshot }
  },

  async recordConfirmedNoShow(input: {
    cleanerId: string
    bookingId: string
    occurredAt: Date
    confirmedBy: string
  }) {
    const incidentDate = cyprusCalendarDate(input.occurredAt)
    const previous = await db.cleanerReliabilitySnapshot.findUnique({
      where: { cleanerId: input.cleanerId },
    })
    const incident = await db.cleanerReliabilityIncident.upsert({
      where: {
        cleanerId_incidentType_sourceKey: {
          cleanerId: input.cleanerId,
          incidentType: INCIDENT_NO_SHOW,
          sourceKey: input.bookingId,
        },
      },
      create: {
        cleanerId: input.cleanerId,
        bookingId: input.bookingId,
        bookingIds: [input.bookingId],
        incidentType: INCIDENT_NO_SHOW,
        incidentDate,
        sourceKey: input.bookingId,
        occurredAt: input.occurredAt,
        latestAt: input.occurredAt,
        confirmedBy: input.confirmedBy,
      },
      update: {
        latestAt: input.occurredAt,
        confirmedBy: input.confirmedBy,
      },
    })
    await db.cleanerStrike.upsert({
      where: { incidentId: incident.id },
      create: {
        cleanerId: input.cleanerId,
        bookingId: input.bookingId,
        incidentId: incident.id,
        strikeType: 'reliability_no_show',
        reason: 'Admin-confirmed cleaner no-show',
        issuedBy: input.confirmedBy,
        expiresAt: addDays(input.occurredAt, STRIKE_ACTIVE_DAYS),
      },
      update: {},
    })
    if (previous?.isSuperCleaner || previous?.recoveryNoShowStartedAt) {
      await db.cleanerReliabilitySnapshot.updateMany({
        where: { cleanerId: input.cleanerId },
        data: {
          isSuperCleaner: false,
          recoveryNoShowStartedAt: input.occurredAt,
          lostAt: input.occurredAt,
          lossReason: 'confirmed_no_show',
          dirtyAt: input.occurredAt,
        },
      })
    }
    return this.recalculate(input.cleanerId, input.occurredAt)
  },

  async recordStartVerification(input: {
    bookingId: string
    cleanerId: string
    scheduledStart: Date
    startedAt: Date
    serviceLatitude: number | null
    serviceLongitude: number | null
    startLocation?: { latitude: number; longitude: number; accuracy_m?: number }
  }) {
    const accuracy = input.startLocation?.accuracy_m ?? null
    const hasTrustedCoordinates =
      input.serviceLatitude !== null && input.serviceLongitude !== null
    const distance =
      hasTrustedCoordinates && input.startLocation
        ? haversineDistanceM(
            {
              latitude: input.serviceLatitude!,
              longitude: input.serviceLongitude!,
            },
            input.startLocation,
          )
        : null
    const { verified, failureReason } = evaluateStartVerification({
      hasStartLocation: Boolean(input.startLocation),
      hasTrustedCoordinates,
      accuracyM: accuracy,
      distanceM: distance,
    })
    const onTime =
      verified &&
      input.startedAt.getTime() <=
        input.scheduledStart.getTime() + ON_TIME_GRACE_MINUTES * 60 * 1000

    await db.cleanerStartVerification.upsert({
      where: { bookingId: input.bookingId },
      create: {
        bookingId: input.bookingId,
        cleanerId: input.cleanerId,
        latitude: input.startLocation?.latitude,
        longitude: input.startLocation?.longitude,
        accuracyM: accuracy,
        distanceM: distance,
        verified,
        onTime,
        failureReason,
        startedAt: input.startedAt,
      },
      update: {},
    })
    return this.recalculate(input.cleanerId, input.startedAt)
  },

  async reconcileDue(limit = 100) {
    const now = new Date()
    const due = await db.cleanerReliabilitySnapshot.findMany({
      where: {
        OR: [{ dirtyAt: { not: null } }, { nextEvaluationAt: { lte: now } }],
      },
      select: { cleanerId: true },
      orderBy: [{ dirtyAt: 'asc' }, { nextEvaluationAt: 'asc' }],
      take: limit,
    })
    let recalculated = 0
    let failed = 0
    const errors: string[] = []
    for (const row of due) {
      try {
        await this.recalculate(row.cleanerId, now)
        recalculated += 1
      } catch (error) {
        failed += 1
        errors.push(`${row.cleanerId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return { checked: due.length, recalculated, failed, errors }
  },

  async reconcileCancellationEvents(limit = 100) {
    const missingBookings = await db.booking.findMany({
      where: {
        status: 'cancelled',
        cancelledAt: { not: null },
        cancelledBy: { not: null },
        cancelledByUser: { is: { role: 'cleaner' } },
        cancellationEvent: { is: null },
      },
      select: {
        id: true,
        cleanerId: true,
        acceptedAt: true,
        confirmedAt: true,
        scheduledStart: true,
        cancelledAt: true,
        cancelledBy: true,
        cleaner: { select: { userId: true } },
      },
      orderBy: { cancelledAt: 'asc' },
      take: limit,
    })
    let recorded = 0
    let reconciled = 0
    let failed = 0
    const errors: string[] = []
    for (const booking of missingBookings) {
      if (
        !booking.cancelledAt ||
        !booking.cancelledBy ||
        booking.cancelledBy !== booking.cleaner.userId
      ) {
        continue
      }
      try {
        await this.recordCleanerCancellation({
          cleanerId: booking.cleanerId,
          bookingId: booking.id,
          scheduledStart: booking.scheduledStart,
          cancelledAt: booking.cancelledAt,
          issuedBy: booking.cancelledBy,
          acceptedBooking: Boolean(booking.acceptedAt || booking.confirmedAt),
        })
        recorded += 1
      } catch (error) {
        failed += 1
        errors.push(`${booking.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const events = await db.cleanerCancellationEvent.findMany({
      where: {
        acceptedBooking: true,
        isLastMinute: true,
        incidentId: null,
      },
      orderBy: { cancelledAt: 'asc' },
      take: Math.max(0, limit - missingBookings.length),
    })
    for (const event of events) {
      try {
        await this.recordLastMinuteCancellation({
          cleanerId: event.cleanerId,
          bookingId: event.bookingId,
          occurredAt: event.cancelledAt,
          issuedBy: event.cancelledByUserId,
        })
        const incident = await db.cleanerReliabilityIncident.findUnique({
          where: {
            cleanerId_incidentType_sourceKey: {
              cleanerId: event.cleanerId,
              incidentType: INCIDENT_LAST_MINUTE,
              sourceKey: cyprusCalendarDate(event.cancelledAt),
            },
          },
          select: { id: true },
        })
        if (incident) {
          await db.cleanerCancellationEvent.update({
            where: { id: event.id },
            data: { incidentId: incident.id },
          })
        }
        await this.recalculate(event.cleanerId)
        reconciled += 1
      } catch (error) {
        failed += 1
        errors.push(`${event.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return {
      checked: missingBookings.length + events.length,
      recorded,
      reconciled,
      failed,
      errors,
    }
  },

  async reconcileMissing(limit = 100) {
    const cleaners = await db.cleaner.findMany({
      where: { reliabilitySnapshot: { is: null } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    let recalculated = 0
    let failed = 0
    const errors: string[] = []
    for (const cleaner of cleaners) {
      try {
        await this.recalculate(cleaner.id)
        recalculated += 1
      } catch (error) {
        failed += 1
        errors.push(`${cleaner.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return { checked: cleaners.length, recalculated, failed, errors }
  },

  async reconcileAll(limit = 200) {
    const cleaners = await db.cleaner.findMany({
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    })
    let recalculated = 0
    let failed = 0
    const errors: string[] = []
    for (const cleaner of cleaners) {
      try {
        await this.recalculate(cleaner.id)
        recalculated += 1
      } catch (error) {
        failed += 1
        errors.push(`${cleaner.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return { checked: cleaners.length, recalculated, failed, errors }
  },

  async markDirty(cleanerId: string) {
    try {
      await db.cleanerReliabilitySnapshot?.updateMany({
        where: { cleanerId },
        data: { dirtyAt: new Date() },
      })
    } catch (error) {
      console.error('cleaner_reliability.mark_dirty_failed', {
        cleaner_id: cleanerId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  },

  async publicFeatureEnabled() {
    try {
      const row = await db.platformConfig?.findUnique({
        where: { key: 'super_cleaner.public_enabled' },
      })
      return row?.value.trim().toLowerCase() === 'true'
    } catch {
      return false
    }
  },

  publicMetrics(snapshot: {
    isSuperCleaner: boolean
    verifiedJobCount: number
    onTimeRate: Prisma.Decimal | number | null
  } | null, enabled: boolean) {
    const verifiedJobCount = snapshot?.verifiedJobCount ?? 0
    const onTimeRate = snapshot?.onTimeRate === null || snapshot?.onTimeRate === undefined
      ? null
      : Number(snapshot.onTimeRate)
    return {
      super_cleaner: enabled && Boolean(snapshot?.isSuperCleaner),
      ...publicOnTimeMetric(verifiedJobCount, onTimeRate),
    }
  },
}
