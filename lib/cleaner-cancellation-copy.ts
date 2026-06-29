const EARLY_CANCELLATION_CONSEQUENCES = [
  'This booking will be cancelled immediately.',
  'The client will receive a full refund.',
  'You will not receive any payout for this booking.',
  'This cancellation will be recorded on your reliability history and may affect future performance metrics.',
] as const

const LATE_CANCELLATION_CONSEQUENCES = [
  'This booking will be cancelled immediately.',
  'The client will receive compensation in accordance with MaidHive’s cancellation policy.',
  'You will not receive payment for this booking.',
  'This late cancellation will be recorded on your reliability history and may affect your account status, performance metrics and Super Cleaner eligibility.',
] as const

export function getCleanerCancellationConfirmationCopy(moreThan24HoursAway: boolean) {
  return {
    title: 'Cancel booking?',
    prompt: 'Are you sure you want to cancel this booking?',
    consequences: moreThan24HoursAway
      ? EARLY_CANCELLATION_CONSEQUENCES
      : LATE_CANCELLATION_CONSEQUENCES,
    keepButton: 'Keep booking',
    cancelButton: 'Cancel booking',
  } as const
}
