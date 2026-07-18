import type { ConfirmedCancellationPolicyWindow } from '@/lib/cancellation-policy'

const EARLY_CANCELLATION_CONSEQUENCES = [
  'This booking will be cancelled immediately.',
  'The client will receive a full refund for this booking.',
  'You will not receive any payout for this booking.',
  'This cancellation will be recorded on your reliability history and may affect future performance metrics.',
  'Client refund: full original booking payment',
  'Cleaner payout: €0.00',
  'MaidHive retained fee: €0.00',
] as const

const BETWEEN_12_AND_24_HOURS_CONSEQUENCES = [
  'This booking will be cancelled immediately.',
  'The client will receive a full refund for this booking.',
  'You will not receive payment for this booking.',
  'This cancellation will be recorded in your 12–24-hour cancellation history and included in your cancellation rate. It will not create a strike, but it may affect your Super Cleaner eligibility if your cancellation rate exceeds the permitted threshold.',
  'Client refund: full original booking payment',
  'Cleaner payout: €0.00',
  'MaidHive retained fee: €0.00',
] as const

const UNDER_12_HOURS_CONSEQUENCES = [
  'This booking will be cancelled immediately.',
  'The client will receive a full refund for this booking.',
  'You will not receive payment for this booking.',
  'This under-12-hour cancellation will be recorded in your last-minute cancellation history and may create a reliability strike under MaidHive policy.',
  'Client refund: full original booking payment',
  'Cleaner payout: €0.00',
  'MaidHive retained fee: €0.00',
] as const

function consequencesForWindow(window: ConfirmedCancellationPolicyWindow | boolean | null | undefined) {
  if (window === true || window === 'more_than_24h') return EARLY_CANCELLATION_CONSEQUENCES
  if (window === 'between_12h_and_24h') return BETWEEN_12_AND_24_HOURS_CONSEQUENCES
  return UNDER_12_HOURS_CONSEQUENCES
}

export function getCleanerCancellationConfirmationCopy(
  window: ConfirmedCancellationPolicyWindow | boolean | null | undefined,
) {
  return {
    title: 'Cancel booking?',
    prompt: 'Are you sure you want to cancel this booking?',
    consequences: consequencesForWindow(window),
    keepButton: 'Keep booking',
    cancelButton: 'Cancel booking',
  } as const
}
