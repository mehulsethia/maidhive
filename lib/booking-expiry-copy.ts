type BookingDeadline = {
  accept_by?: string | null
  pay_by?: string | null
  reauthorization_required?: boolean | null
  reauthorization_grace_expires_at?: string | null
}

function formatDeadline(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString('en-IE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Nicosia',
  })
}

export function getClientBookingRequestDeadlineCopy(booking: BookingDeadline) {
  if (booking.reauthorization_required) {
    const deadline = formatDeadline(booking.pay_by ?? booking.reauthorization_grace_expires_at)
    return [
      'Payment re-authorisation required',
      `Please re-authorise your card by ${deadline ?? 'the payment re-authorisation deadline'} to keep your booking active.`,
      'Your booking has already been accepted by the cleaner. This is a renewal of your payment authorisation only.',
      'Your card will not be charged now. Payment will only be captured after the cleaning has been completed and the dispute window has ended.',
      'If you do not complete re-authorisation before the deadline, your booking may be cancelled.',
    ].join('\n')
  }

  const deadline = formatDeadline(booking.accept_by)
  if (!deadline) {
    return 'This booking request must be responded to by the cleaner before the response deadline. If no response is received by then, the request will expire automatically and your card authorisation will be released.'
  }
  return `This booking request must be responded to by the cleaner before ${deadline}. If no response is received by then, the request will expire automatically and your card authorisation will be released.`
}

export function getCleanerBookingRequestDeadlineCopy(booking: BookingDeadline) {
  const deadline = formatDeadline(booking.accept_by)
  if (!deadline) {
    return 'Please respond to this booking request before the response deadline. If you do not respond before then, the request will expire automatically.'
  }
  return `Please respond to this booking request before ${deadline}. If you do not respond before then, the request will expire automatically.`
}
