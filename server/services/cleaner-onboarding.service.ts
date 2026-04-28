import type { Cleaner } from '@prisma/client'

export type CleanerOnboardingProgress = {
  completion_pct: number
  can_be_listed: boolean
  current_step: 1 | 2 | 3 | 4 | 5
  steps: {
    step1_basic_details: boolean
    step2_kyc: boolean
    step3_availability: boolean
    step4_stripe_setup: boolean
    step5_training: boolean
  }
}

function hasValue(v?: string | null) {
  return typeof v === 'string' && v.trim().length > 0
}

export type CleanerSubmissionValidation = {
  valid: boolean
  missingFields: string[]
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
    cleaner.skills.length > 0 &&
    hasValue(cleaner.cleaningSupplies)

  const needsPickupLocation = cleaner.transportMode === 'requires_pickup'
  const step2Kyc =
    hasValue(cleaner.transportMode) &&
    (!needsPickupLocation || hasValue(cleaner.transportPickupLocation)) &&
    hasValue(cleaner.idType) &&
    hasValue(cleaner.idFileName) &&
    cleaner.petComfortable !== null &&
    cleaner.workEligibilityAnswer === true &&
    cleaner.workEligibilityConfirmed &&
    cleaner.termsAccepted

  const step3Availability = hasAvailabilitySlots
  const step4StripeSetup =
    cleaner.stripeOnboardingComplete ||
    cleaner.onboardingSkippedStep4 ||
    cleaner.onboardingStep >= 5
  const step5Training =
    cleaner.standardsCompleted &&
    cleaner.quizPassed &&
    cleaner.quizScore !== null &&
    cleaner.quizScore >= 80

  const completedSteps = [
    step1BasicDetails,
    step2Kyc,
    step3Availability,
    step4StripeSetup,
    step5Training,
  ].filter(Boolean).length

  const completionPct = Math.round((completedSteps / 5) * 100)

  let currentStep: 1 | 2 | 3 | 4 | 5 = 1
  if (!step1BasicDetails) currentStep = 1
  else if (!step2Kyc) currentStep = 2
  else if (!step3Availability) currentStep = cleaner.onboardingSkippedStep3 ? 4 : 3
  else if (!step4StripeSetup) currentStep = 4
  else if (!step5Training) currentStep = 5
  else currentStep = 5

  return {
    completion_pct: completionPct,
    can_be_listed: completionPct === 100,
    current_step: currentStep,
    steps: {
      step1_basic_details: step1BasicDetails,
      step2_kyc: step2Kyc,
      step3_availability: step3Availability,
      step4_stripe_setup: step4StripeSetup,
      step5_training: step5Training,
    },
  }
}

export function validateCleanerSubmissionRequirements(args: {
  cleaner: Cleaner
  hasAvailabilitySlots: boolean
}): CleanerSubmissionValidation {
  const { cleaner, hasAvailabilitySlots } = args
  const missingFields: string[] = []

  if (!hasValue(cleaner.bio)) missingFields.push('Professional bio')
  if (!Array.isArray(cleaner.skills) || cleaner.skills.length === 0) missingFields.push('Services offered')
  if (Number(cleaner.hourlyRate) < 6) missingFields.push('Hourly rate')
  if (!hasValue(cleaner.cleaningSupplies)) missingFields.push('Supplies preference')
  if (!hasValue(cleaner.transportMode)) missingFields.push('Transport mode')
  if (cleaner.transportMode === 'requires_pickup' && !hasValue(cleaner.transportPickupLocation)) {
    missingFields.push('Pickup location')
  }
  if (!hasValue(cleaner.idType)) missingFields.push('ID document type')
  if (!hasValue(cleaner.idFileName) || !hasValue(cleaner.idFileUrl)) {
    missingFields.push('Uploaded ID document')
  }
  if (cleaner.workEligibilityAnswer !== true || !cleaner.workEligibilityConfirmed) {
    missingFields.push('Work eligibility confirmation')
  }
  if (!cleaner.termsAccepted) missingFields.push('Terms acceptance')
  if (!hasAvailabilitySlots) missingFields.push('Availability schedule')
  if (!cleaner.standardsCompleted) missingFields.push('Cleaning standards confirmation')
  if (!cleaner.quizPassed || (cleaner.quizScore ?? 0) < 80) {
    missingFields.push('Quiz pass (80%+)')
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  }
}
