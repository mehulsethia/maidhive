import { NextRequest } from 'next/server'
import { requireAdmin } from '@/server/auth'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { db } from '@/server/db'
import { ok } from '@/server/response'
import { deriveCleanerLifecycleStatus } from '@/lib/cleaner-status'

export const GET = requireAdmin(async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const page = Number(req.nextUrl.searchParams.get('page') ?? 1)
  const pageSize = Number(req.nextUrl.searchParams.get('page_size') ?? 20)

  const [cleaners, total] = await cleanerRepo.listAll({ status, page, pageSize })
  const cleanerIds = cleaners.map((cleaner) => cleaner.id)
  const completedJobsAgg = cleanerIds.length
    ? await db.booking.groupBy({
        by: ['cleanerId'],
        where: {
          cleanerId: { in: cleanerIds },
          status: { in: ['completed', 'disputed'] },
        },
        _count: { _all: true },
      })
    : []
  const reviewsAgg = cleanerIds.length
    ? await db.review.groupBy({
        by: ['cleanerId'],
        where: { cleanerId: { in: cleanerIds } },
        _avg: { rating: true },
      })
    : []
  const cancellationWindowAgg = cleanerIds.length && db.cleanerCancellationEvent?.groupBy
    ? await db.cleanerCancellationEvent.groupBy({
        by: ['cleanerId', 'cancellationWindow'],
        where: {
          cleanerId: { in: cleanerIds },
          acceptedBooking: true,
        },
        _count: { _all: true },
      })
    : []
  const cancellationWindowsByCleaner = new Map<
    string,
    Record<string, number>
  >()
  for (const entry of cancellationWindowAgg) {
    const counts = cancellationWindowsByCleaner.get(entry.cleanerId) ?? {}
    counts[entry.cancellationWindow] = entry._count._all
    cancellationWindowsByCleaner.set(entry.cleanerId, counts)
  }
  const completedJobsByCleanerId = new Map<string, number>(
    completedJobsAgg.map((entry) => [entry.cleanerId, entry._count._all]),
  )
  const avgRatingByCleanerId = new Map<string, number | null>(
    reviewsAgg.map((entry) => [entry.cleanerId, entry._avg.rating ?? null]),
  )

  const formatted = cleaners.map((cleaner) => {
    const fullName = cleaner.user?.name?.trim()
    const fallbackName =
      fullName && fullName.length > 0
        ? fullName
        : cleaner.user?.email?.split('@')[0] || 'Cleaner'
    const lifecycleStatus = deriveCleanerLifecycleStatus({
      status: cleaner.status,
      stripeOnboardingComplete: cleaner.stripeOnboardingComplete,
      profileComplete: cleaner.profileComplete,
    })
    const completedJobs = completedJobsByCleanerId.get(cleaner.id) ?? 0
    return {
      id: cleaner.id,
      user_id: cleaner.userId,
      user_name: fallbackName,
      user_email: cleaner.user?.email ?? '',
      user_phone: cleaner.user?.phone ?? undefined,
      bio: cleaner.bio,
      skills: cleaner.skills,
      cleaning_supplies: cleaner.cleaningSupplies,
      years_experience: cleaner.yearsExperience,
      hourly_rate: cleaner.hourlyRate,
      transport_mode: cleaner.transportMode,
      id_type: cleaner.idType,
      id_file_name: cleaner.idFileName,
      id_file_url: cleaner.idFileUrl,
      profile_image_url: cleaner.profileImageUrl,
      status: cleaner.status,
      lifecycle_status: lifecycleStatus,
      rejection_reason: cleaner.rejectionReason,
      profile_complete: cleaner.profileComplete,
      identity_verified: cleaner.identityVerified,
      cleaning_standards_accepted: cleaner.cleaningStandardsAccepted,
      standards_completed: cleaner.standardsCompleted,
      quiz_passed: cleaner.quizPassed,
      quiz_score: cleaner.quizScore,
      stripe_onboarding_complete: cleaner.stripeOnboardingComplete,
      trial_period_flag: completedJobs < 10,
      total_jobs: completedJobs,
      average_rating: avgRatingByCleanerId.get(cleaner.id) ?? null,
      reliability: cleaner.reliabilitySnapshot
        ? {
            is_super_cleaner: cleaner.reliabilitySnapshot.isSuperCleaner,
            completed_released_count: cleaner.reliabilitySnapshot.completedReleasedCount,
            cancellation_rate:
              cleaner.reliabilitySnapshot.cancellationRate === null
                ? null
                : Number(cleaner.reliabilitySnapshot.cancellationRate),
            cancellation_numerator: cleaner.reliabilitySnapshot.cancellationNumerator,
            cancellation_denominator: cleaner.reliabilitySnapshot.cancellationDenominator,
            last_minute_incidents_30d:
              cleaner.reliabilitySnapshot.lastMinuteIncidentCount30d,
            no_shows_60d: cleaner.reliabilitySnapshot.noShowCount60d,
            verified_job_count: cleaner.reliabilitySnapshot.verifiedJobCount,
            on_time_percentage:
              cleaner.reliabilitySnapshot.onTimeRate === null
                ? null
                : Math.round(Number(cleaner.reliabilitySnapshot.onTimeRate) * 100),
            active_strike_count: cleaner.reliabilitySnapshot.activeStrikeCount,
            criteria: cleaner.reliabilitySnapshot.criteria,
            recovery_cancellation_started_at:
              cleaner.reliabilitySnapshot.recoveryCancellationStartedAt,
            recovery_no_show_started_at:
              cleaner.reliabilitySnapshot.recoveryNoShowStartedAt,
            last_calculated_at: cleaner.reliabilitySnapshot.lastCalculatedAt,
          }
        : null,
      reliability_incidents: (cleaner.reliabilityIncidents ?? []).map((incident) => ({
        id: incident.id,
        type: incident.incidentType,
        incident_date: incident.incidentDate,
        booking_count: incident.bookingIds.length,
        occurred_at: incident.occurredAt,
      })),
      cancellation_windows: {
        more_than_24h:
          cancellationWindowsByCleaner.get(cleaner.id)?.more_than_24h ?? 0,
        between_12h_24h:
          cancellationWindowsByCleaner.get(cleaner.id)?.between_12h_24h ?? 0,
        less_than_12h:
          cancellationWindowsByCleaner.get(cleaner.id)?.less_than_12h ?? 0,
      },
      cancellation_events: (cleaner.cancellationEvents ?? []).map((event) => ({
        id: event.id,
        booking_id: event.bookingId,
        window: event.cancellationWindow,
        accepted_booking: event.acceptedBooking,
        incident_id: event.incidentId,
        hours_before_start: Number(event.hoursBeforeStart),
        cancelled_at: event.cancelledAt,
      })),
      reliability_strikes: (cleaner.strikes ?? []).map((strike) => ({
        id: strike.id,
        type: strike.strikeType,
        reason: strike.reason,
        issued_at: strike.createdAt,
        expires_at: strike.expiresAt,
      })),
      created_at: cleaner.createdAt,
    }
  })
  return ok({ cleaners: formatted, total, page, page_size: pageSize })
})
