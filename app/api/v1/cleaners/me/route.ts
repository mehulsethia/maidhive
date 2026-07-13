import { NextRequest } from 'next/server'
import { getAuthSessionUser, requireCleaner } from '@/server/auth'
import { db } from '@/server/db'
import { cleanerRepo } from '@/server/repositories/cleaner.repo'
import { availabilityRepo } from '@/server/repositories/availability.repo'
import { computeCleanerOnboardingProgress, validateCleanerSubmissionRequirements } from '@/server/services/cleaner-onboarding.service'
import { ok, err } from '@/server/response'
import { updateCleanerSchema } from '@/server/schemas/cleaner.schema'
import { deriveCleanerLifecycleStatus } from '@/lib/cleaner-status'
import { cleanerReliabilityService } from '@/server/services/cleaner-reliability.service'
import { calculateDisputeAdjustedCleanerPayoutCents } from '@/lib/cleaner-payout'
import { computeConfirmedCancellationPolicy } from '@/lib/cancellation-policy'

function withCleanerAliases(cleaner: any) {
  const rawSupplies = cleaner.cleaningSupplies
  const normalizedSupplies =
    rawSupplies === 'cleaner_brings'
      ? 'own_supplies'
      : rawSupplies === 'client_provides'
        ? 'client_supplies'
        : rawSupplies

  const rawIdType = cleaner.idType
  const normalizedIdType = rawIdType === 'drivers_license' ? 'drivers_licence' : rawIdType

  return {
    ...cleaner,
    cleaningSupplies: normalizedSupplies,
    idType: normalizedIdType,
    standards_completed: cleaner.standardsCompleted,
    quiz_passed: cleaner.quizPassed,
    quiz_score: cleaner.quizScore,
  }
}

function normalizeCleaningSuppliesInput(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value === 'cleaner_brings') return 'own_supplies'
  if (value === 'client_provides') return 'client_supplies'
  return String(value)
}

function toLegacyCleaningSupplies(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value === 'own_supplies') return 'cleaner_brings'
  if (value === 'client_supplies') return 'client_provides'
  return value
}

function normalizeIdTypeInput(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value === 'drivers_license') return 'drivers_licence'
  return String(value)
}

function toLegacyIdType(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value === 'drivers_licence') return 'drivers_license'
  return value
}

function moneyCents(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100)
}

function getClientCancellationPolicyPayoutCents(payment: {
  status: string
  refundReason: string | null
  booking: {
    status: string
    cancellationReason: string | null
    cancelledAt: Date | null
    scheduledStart: Date
    totalAmount: unknown
    subtotal: unknown
    platformFee: unknown
  }
}) {
  const booking = payment.booking
  if (booking.status !== 'cancelled' || !booking.cancelledAt) return null

  const context = `${booking.cancellationReason ?? ''} ${payment.refundReason ?? ''}`
    .toLowerCase()
    .replace(/[_-]/g, ' ')
  if (context.includes('no show') || context.includes('cancelled by cleaner')) return null
  if (
    !context.includes('client cancellation policy') &&
    !context.includes('cancelled by client') &&
    !context.includes('client cancelled')
  ) {
    return null
  }

  const policy = computeConfirmedCancellationPolicy({
    scheduledStart: booking.scheduledStart,
    cancelledAt: booking.cancelledAt,
    totalAmount: booking.totalAmount,
    subtotal: booking.subtotal,
    platformFee: booking.platformFee,
  })

  return policy?.cleanerPayoutCents ?? null
}

export const GET = requireCleaner(async (req, _ctx, user) => {
  let cleaner = await cleanerRepo.findByUserId(user.id)

  // Auto-create the cleaner profile if it doesn't exist yet (e.g. sync race condition)
  if (!cleaner) {
    cleaner = await cleanerRepo.create(user.id)
  }

  const schedules = await availabilityRepo.getSchedule(cleaner.id)
  const hasAvailabilitySlots = schedules.some((s) => s.isActive)
  const onboarding = computeCleanerOnboardingProgress({ cleaner, hasAvailabilitySlots })
  const [completedBookings, respondedBookings, reviewAgg, releasedPayments] = await Promise.all([
    db.booking.findMany({
      where: {
        cleanerId: cleaner.id,
        status: 'completed',
        payment: { is: { status: 'transferred' } },
      },
      select: {
        scheduledStart: true,
        startedAt: true,
      },
    }),
    db.booking.findMany({
      where: {
        cleanerId: cleaner.id,
        acceptedAt: { not: null },
      },
      select: {
        createdAt: true,
        acceptedAt: true,
      },
    }),
    db.review.aggregate({
      where: { cleanerId: cleaner.id, isPublic: true },
      _avg: { rating: true },
    }),
    db.payment.findMany({
      where: {
        booking: { cleanerId: cleaner.id },
        OR: [
          { status: 'transferred' },
          { transferredAt: { not: null } },
        ],
      },
      select: {
        status: true,
        cleanerPayout: true,
        refundAmount: true,
        refundReason: true,
        booking: {
          select: {
            status: true,
            scheduledStart: true,
            cancelledAt: true,
            cancellationReason: true,
            totalAmount: true,
            subtotal: true,
            platformFee: true,
            cleanerPayout: true,
            dispute: {
              select: {
                resolutionType: true,
                refundAmount: true,
              },
            },
          },
        },
      },
    }),
  ])
  const releasedEarnings = releasedPayments.reduce((sum, payment) => {
    const clientCancellationPolicyPayoutCents = getClientCancellationPolicyPayoutCents(payment)
    if (clientCancellationPolicyPayoutCents !== null) {
      return sum + Math.max(0, clientCancellationPolicyPayoutCents) / 100
    }

    const paymentCleanerPayoutCents = moneyCents(payment.cleanerPayout)
    const originalCleanerPayoutCents = moneyCents(payment.booking.cleanerPayout)
    const refundCents = moneyCents(payment.refundAmount ?? payment.booking.dispute?.refundAmount)
    const resolutionType = payment.booking.dispute?.resolutionType
    const finalPayoutCents = resolutionType === 'full_refund'
      ? 0
      : resolutionType === 'partial_refund'
        ? Math.min(
            paymentCleanerPayoutCents,
            calculateDisputeAdjustedCleanerPayoutCents({
              originalCleanerPayoutCents,
              refundCents,
            }),
          )
        : paymentCleanerPayoutCents
    return sum + Math.max(0, finalPayoutCents) / 100
  }, 0)
  const onTimeThresholdMs = 15 * 60 * 1000
  const onTimeCount = completedBookings.filter((booking) => {
    if (!booking.startedAt) return false
    return booking.startedAt.getTime() <= booking.scheduledStart.getTime() + onTimeThresholdMs
  }).length
  const onTimePercentage =
    completedBookings.length > 0 ? Math.round((onTimeCount / completedBookings.length) * 100) : 0

  const totalResponseMinutes = respondedBookings.reduce((sum, booking) => {
    if (!booking.acceptedAt) return sum
    const diffMs = booking.acceptedAt.getTime() - booking.createdAt.getTime()
    return sum + Math.max(diffMs, 0) / (60 * 1000)
  }, 0)
  const avgResponseMinutes =
    respondedBookings.length > 0 ? Math.round(totalResponseMinutes / respondedBookings.length) : 0
  const authSessionUser = await getAuthSessionUser(req)
  let reliability = cleaner.reliabilitySnapshot
  try {
    reliability = await cleanerReliabilityService.recalculate(cleaner.id)
  } catch (error) {
    console.error('cleaner.me.reliability_recalculate_failed', {
      cleaner_id: cleaner.id,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  return ok({
    cleaner: {
      ...withCleanerAliases(cleaner),
      user: cleaner.user
        ? {
            ...cleaner.user,
            email_confirmed_at: authSessionUser?.email_confirmed_at ?? null,
          }
        : undefined,
      totalJobs: completedBookings.length,
      averageRating: reviewAgg._avg.rating ?? null,
      releasedEarnings,
      on_time_percentage: onTimePercentage,
      avg_response_minutes: avgResponseMinutes,
      lifecycle_status: deriveCleanerLifecycleStatus({
        status: cleaner.status,
        stripeOnboardingComplete: cleaner.stripeOnboardingComplete,
        profileComplete: cleaner.profileComplete,
      }),
      reliability: reliability
        ? {
            is_super_cleaner: reliability.isSuperCleaner,
            completed_released_count: reliability.completedReleasedCount,
            average_rating: reliability.averageRating === null ? null : Number(reliability.averageRating),
            cancellation_rate: reliability.cancellationRate === null ? null : Number(reliability.cancellationRate),
            cancellation_numerator: reliability.cancellationNumerator,
            cancellation_denominator: reliability.cancellationDenominator,
            last_minute_incidents_30d: reliability.lastMinuteIncidentCount30d,
            no_shows_60d: reliability.noShowCount60d,
            verified_job_count: reliability.verifiedJobCount,
            on_time_percentage:
              reliability.onTimeRate === null ? null : Math.round(Number(reliability.onTimeRate) * 100),
            active_strike_count: reliability.activeStrikeCount,
            criteria: reliability.criteria,
            recovery_cancellation_started_at: reliability.recoveryCancellationStartedAt,
            recovery_no_show_started_at: reliability.recoveryNoShowStartedAt,
            last_calculated_at: reliability.lastCalculatedAt,
          }
        : null,
    },
    onboarding,
  })
})

export const PATCH = requireCleaner(async (req: NextRequest, _ctx, user) => {
  const body = await req.json()
  const parsed = updateCleanerSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 422)
  if (parsed.data.quiz_passed === true) {
    const score = parsed.data.quiz_score ?? parsed.data.cleaning_quiz_score
    if (score === null || score === undefined || score < 80) {
      return err('Quiz pass score (80%+) is required when marking quiz as passed.', 422)
    }
  }

  let cleaner = await cleanerRepo.findByUserId(user.id)
  if (!cleaner) {
    cleaner = await cleanerRepo.create(user.id)
  }

  const normalizedIdType = normalizeIdTypeInput(parsed.data.id_type)
  const currentIdType = normalizeIdTypeInput(cleaner.idType)
  const idTypeChangeRequested =
    normalizedIdType !== undefined && normalizedIdType !== currentIdType
  const idFileNameChangeRequested =
    parsed.data.id_file_name !== undefined && parsed.data.id_file_name !== cleaner.idFileName
  const idFileUrlChangeRequested =
    parsed.data.id_file_url !== undefined && parsed.data.id_file_url !== cleaner.idFileUrl
  const kycMutationRequested =
    idTypeChangeRequested || idFileNameChangeRequested || idFileUrlChangeRequested
  const kycLocked = cleaner.profileComplete && cleaner.status !== 'rejected'
  if (kycMutationRequested && kycLocked) {
    return err('KYC document cannot be changed after submission unless your application is rejected.', 409)
  }

  const normalizedCleaningSupplies = normalizeCleaningSuppliesInput(parsed.data.cleaning_supplies)

  const updatePayload = {
    ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
    ...(parsed.data.profile_image_url !== undefined ? { profileImageUrl: parsed.data.profile_image_url } : {}),
    ...(parsed.data.skills !== undefined ? { skills: parsed.data.skills } : {}),
    ...(normalizedCleaningSupplies !== undefined ? { cleaningSupplies: normalizedCleaningSupplies } : {}),
    ...(parsed.data.years_experience !== undefined ? { yearsExperience: parsed.data.years_experience } : {}),
    ...(parsed.data.hourly_rate !== undefined ? { hourlyRate: parsed.data.hourly_rate } : {}),
    ...(parsed.data.transport_mode !== undefined ? { transportMode: parsed.data.transport_mode } : {}),
    ...(parsed.data.transport_pickup_location !== undefined
      ? { transportPickupLocation: parsed.data.transport_pickup_location }
      : {}),
    ...(normalizedIdType !== undefined ? { idType: normalizedIdType } : {}),
    ...(parsed.data.pet_acceptance !== undefined ? { petAcceptance: parsed.data.pet_acceptance } : {}),
    ...(parsed.data.pet_comfortable !== undefined ? { petComfortable: parsed.data.pet_comfortable } : {}),
    ...(parsed.data.work_eligibility_answer !== undefined
      ? { workEligibilityAnswer: parsed.data.work_eligibility_answer }
      : {}),
    ...(parsed.data.work_eligibility_confirmed !== undefined
      ? { workEligibilityConfirmed: parsed.data.work_eligibility_confirmed }
      : {}),
    ...(parsed.data.terms_accepted !== undefined ? { termsAccepted: parsed.data.terms_accepted } : {}),
    ...(parsed.data.cleaning_standards_accepted !== undefined
      ? { cleaningStandardsAccepted: parsed.data.cleaning_standards_accepted }
      : {}),
    ...(parsed.data.cleaning_quiz_score !== undefined ? { cleaningQuizScore: parsed.data.cleaning_quiz_score } : {}),
    ...(parsed.data.standards_completed !== undefined ? { standardsCompleted: parsed.data.standards_completed } : {}),
    ...(parsed.data.quiz_passed !== undefined ? { quizPassed: parsed.data.quiz_passed } : {}),
    ...(parsed.data.quiz_score !== undefined ? { quizScore: parsed.data.quiz_score } : {}),
    ...(parsed.data.cleaning_standards_accepted
      ? { cleaningQuizPassedAt: new Date() }
      : {}),
    ...(parsed.data.onboarding_skipped_step3 !== undefined
      ? { onboardingSkippedStep3: parsed.data.onboarding_skipped_step3 }
      : {}),
    ...(parsed.data.onboarding_skipped_step4 !== undefined
      ? { onboardingSkippedStep4: parsed.data.onboarding_skipped_step4 }
      : {}),
    ...(parsed.data.onboarding_step !== undefined ? { onboardingStep: parsed.data.onboarding_step } : {}),
  }

  let interim
  try {
    interim = await cleanerRepo.update(cleaner.id, updatePayload)
  } catch (error) {
    const legacyCleaningSupplies = toLegacyCleaningSupplies(normalizedCleaningSupplies)
    const legacyIdType = toLegacyIdType(normalizedIdType)
    const shouldRetryWithLegacy =
      (normalizedCleaningSupplies !== undefined &&
        legacyCleaningSupplies !== normalizedCleaningSupplies) ||
      (normalizedIdType !== undefined && legacyIdType !== normalizedIdType)

    if (!shouldRetryWithLegacy) throw error

    interim = await cleanerRepo.update(cleaner.id, {
      ...updatePayload,
      ...(normalizedCleaningSupplies !== undefined ? { cleaningSupplies: legacyCleaningSupplies } : {}),
      ...(normalizedIdType !== undefined ? { idType: legacyIdType } : {}),
    })
  }

  const schedules = await availabilityRepo.getSchedule(cleaner.id)
  const hasAvailabilitySlots = schedules.some((s) => s.isActive)
  const onboarding = computeCleanerOnboardingProgress({ cleaner: interim, hasAvailabilitySlots })
  const submissionValidation = validateCleanerSubmissionRequirements({ cleaner: interim, hasAvailabilitySlots })

  if (parsed.data.profile_complete === true && (!onboarding.can_be_listed || !submissionValidation.valid)) {
    const missing = submissionValidation.missingFields.length > 0
      ? ` Missing: ${submissionValidation.missingFields.join(', ')}.`
      : ''
    return err(`Cannot mark onboarding as complete until all required steps are valid.${missing}`, 422)
  }

  const updated = await cleanerRepo.update(cleaner.id, {
    profileComplete: parsed.data.profile_complete === true ? true : interim.profileComplete,
    onboardingStep: parsed.data.onboarding_step ?? onboarding.current_step,
    onboardingCompletedAt: onboarding.can_be_listed ? interim.onboardingCompletedAt ?? new Date() : null,
  })

  return ok({
    cleaner: {
      ...withCleanerAliases(updated),
      lifecycle_status: deriveCleanerLifecycleStatus({
        status: updated.status,
        stripeOnboardingComplete: updated.stripeOnboardingComplete,
        profileComplete: updated.profileComplete,
      }),
    },
    onboarding,
  })
})
