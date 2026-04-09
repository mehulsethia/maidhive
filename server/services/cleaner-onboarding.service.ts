import type { Cleaner } from '@prisma/client'

export type CleanerOnboardingProgress = {
  completion_pct: number
  can_be_listed: boolean
  current_step: 1 | 2 | 3 | 4
  steps: {
    step1_basic_details: boolean
    step2_kyc: boolean
    step3_availability: boolean
    step4_stripe: boolean
  }
}

function hasValue(v?: string | null) {
  return typeof v === 'string' && v.trim().length > 0
}

export function computeCleanerOnboardingProgress(args: {
  cleaner: Cleaner
  hasAvailabilitySlots: boolean
}): CleanerOnboardingProgress {
  const { cleaner, hasAvailabilitySlots } = args

  const step1BasicDetails =
    hasValue(cleaner.profileImageUrl) &&
    hasValue(cleaner.bio) &&
    Number(cleaner.hourlyRate) >= 6 &&
    cleaner.skills.length > 0

  const needsPickupLocation = cleaner.transportMode === 'requires_pickup'
  const step2Kyc =
    hasValue(cleaner.transportMode) &&
    (!needsPickupLocation || hasValue(cleaner.transportPickupLocation)) &&
    hasValue(cleaner.idType) &&
    hasValue(cleaner.idFileName) &&
    cleaner.workEligibilityConfirmed &&
    cleaner.termsAccepted

  const step3Availability = hasAvailabilitySlots
  const step4Stripe = cleaner.stripeOnboardingComplete

  const completedSteps = [
    step1BasicDetails,
    step2Kyc,
    step3Availability,
    step4Stripe,
  ].filter(Boolean).length

  const completionPct = Math.round((completedSteps / 4) * 100)

  let currentStep: 1 | 2 | 3 | 4 = 1
  if (!step1BasicDetails) currentStep = 1
  else if (!step2Kyc) currentStep = 2
  else if (!step3Availability) currentStep = cleaner.onboardingSkippedStep3 ? 4 : 3
  else if (!step4Stripe) currentStep = 4
  else currentStep = 4

  return {
    completion_pct: completionPct,
    can_be_listed: completionPct === 100,
    current_step: currentStep,
    steps: {
      step1_basic_details: step1BasicDetails,
      step2_kyc: step2Kyc,
      step3_availability: step3Availability,
      step4_stripe: step4Stripe,
    },
  }
}
