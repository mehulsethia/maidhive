export type CleanerLifecycleStatus =
  | 'pending_approval'
  | 'approved'
  | 'live'
  | 'rejected'
  | 'suspended'

export function deriveCleanerLifecycleStatus(input: {
  status?: string | null
  stripeOnboardingComplete?: boolean | null
}): CleanerLifecycleStatus {
  const status = String(input.status ?? '').toLowerCase()
  if (status === 'rejected') return 'rejected'
  if (status === 'suspended') return 'suspended'
  if (status === 'approved') {
    return input.stripeOnboardingComplete ? 'live' : 'approved'
  }
  return 'pending_approval'
}

export function cleanerLifecycleLabel(status: CleanerLifecycleStatus): string {
  switch (status) {
    case 'pending_approval':
      return 'Pending approval'
    case 'approved':
      return 'Approved'
    case 'live':
      return 'Live'
    case 'rejected':
      return 'Rejected'
    case 'suspended':
      return 'Suspended'
    default:
      return 'Pending approval'
  }
}

export const CLEANER_REJECTION_REASON_OPTIONS = [
  { code: 'id_not_clear', label: 'ID not clear' },
  { code: 'profile_incomplete', label: 'Profile incomplete' },
  { code: 'low_quality_profile', label: 'Low-quality profile' },
  { code: 'failed_standards_quiz', label: 'Failed standards/quiz' },
] as const

export type CleanerRejectionReasonCode = (typeof CLEANER_REJECTION_REASON_OPTIONS)[number]['code']

export function getCleanerRejectionReasonLabel(code: CleanerRejectionReasonCode): string {
  return (
    CLEANER_REJECTION_REASON_OPTIONS.find((item) => item.code === code)?.label ?? 'Profile update required'
  )
}

export function composeCleanerRejectionMessage(input: {
  reasonCode?: CleanerRejectionReasonCode | null
  customMessage?: string | null
}): string {
  const code = input.reasonCode ?? undefined
  const custom = input.customMessage?.trim()
  if (code && custom) {
    return `${getCleanerRejectionReasonLabel(code)}. ${custom}`
  }
  if (code) {
    return getCleanerRejectionReasonLabel(code)
  }
  return custom || 'Profile update required before resubmission.'
}

export function rejectionFixGuidance(code?: CleanerRejectionReasonCode | null): string {
  if (code === 'id_not_clear') return 'Upload a clear, readable government ID image.'
  if (code === 'profile_incomplete') return 'Complete every required profile field before resubmission.'
  if (code === 'low_quality_profile') return 'Improve profile quality: photo, bio, and service details.'
  if (code === 'failed_standards_quiz') return 'Review cleaning standards and pass the quiz again.'
  return 'Review the feedback and update your profile before resubmitting.'
}
